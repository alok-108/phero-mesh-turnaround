use ramp_math_core::cpm::{CpmEngine, MILESTONES, NUM_NODES};
use ramp_math_core::stigmergy::StigmergyMatrix;
use ramp_math_core::laplacian::LaplacianDiffusion;
use ramp_math_core::mdp_policy::{MdpSolver, MdpState};
use ramp_math_core::{
    init_turnaround_dag, inject_service_delay, compute_critical_path,
    reset_all_delays, tick_stigmergy_decay, get_critical_path_buffer_len,
    get_node_name, get_action_code, SwarmCore,
};
use std::time::Instant;

#[test]
fn test_cpm_nominal_calculation() {
    let engine = CpmEngine::new();
    assert_eq!(engine.delays, [0.0; NUM_NODES]);
    
    // Project duration must be positive and non-zero
    assert!(engine.project_duration > 0.0);
    
    // Deplaning is the source node, Early Start must be 0
    assert_eq!(engine.es[0], 0.0);
    assert_eq!(engine.ef[0], MILESTONES[0].base_duration);

    // Pushback clearance is the sink node (id 11)
    assert_eq!(engine.ef[11], engine.project_duration);
    assert_eq!(engine.lf[11], engine.project_duration);
    assert_eq!(engine.total_slack[11], 0.0);
    assert!(engine.is_critical[11]);

    // Check that at least one complete critical path exists from source to sink
    let critical_count = engine.is_critical.iter().filter(|&&c| c).count();
    assert!(critical_count >= 3, "Critical path should contain at least 3 nodes");
}

#[test]
fn test_cpm_delay_propagation() {
    let mut engine = CpmEngine::new();
    let nominal_duration = engine.project_duration;

    // Inject 15 minute delay on node 0 (Deplaning, which is on the critical path)
    let injected_delay = 15.0;
    engine.set_delay(0, injected_delay);

    assert_eq!(engine.delays[0], injected_delay);
    assert_eq!(
        engine.project_duration,
        nominal_duration + injected_delay,
        "Critical path delay must propagate linearly to total project duration"
    );

    // Reset delays and verify recovery
    engine.reset_all_delays();
    assert_eq!(engine.project_duration, nominal_duration);
}

#[test]
fn test_stigmergy_deposition_and_decay() {
    let mut stigmergy = StigmergyMatrix::new();
    assert_eq!(stigmergy.node_intensity, [0.0; NUM_NODES]);

    // Deposit pheromone on node 1 (Baggage Offload) with successor [7] (Baggage Loading)
    let delay = 12.0;
    stigmergy.deposit_delay_pheromone(1, delay, &[7]);

    assert!(stigmergy.node_intensity[1] > 0.0);
    assert!(stigmergy.tau[1][7] > 0.0);
    assert_eq!(stigmergy.tau[7][1], 0.0, "Pheromone matrix should be directional");

    let initial_tau = stigmergy.tau[1][7];
    
    // Simulate decay ticks
    for _ in 0..10 {
        stigmergy.tick_decay(1.0);
    }

    assert!(stigmergy.tau[1][7] < initial_tau, "Pheromone must evaporate over time");
    assert!(stigmergy.tau[1][7] >= 0.0);

    // Reset check
    stigmergy.reset();
    assert_eq!(stigmergy.tau[1][7], 0.0);
    assert_eq!(stigmergy.node_intensity[1], 0.0);
}

#[test]
fn test_laplacian_heat_diffusion() {
    let engine = CpmEngine::new();
    let mut stigmergy = StigmergyMatrix::new();
    let mut diffusion = LaplacianDiffusion::new();

    // Compute Laplacian on nominal DAG
    diffusion.compute_laplacian(&engine.adj, &stigmergy.tau);

    // Test degree property: row sum of L * 1 vector should be close to 0
    for i in 0..NUM_NODES {
        let row_sum: f32 = diffusion.laplacian[i].iter().sum();
        assert!(row_sum.abs() < 1e-3, "Laplacian row sum must be zero for each node, got {}", row_sum);
    }

    // Step diffusion with no delay: heat should remain zero
    diffusion.step_diffusion(&engine.delays);
    for i in 0..NUM_NODES {
        assert_eq!(diffusion.heat[i], 0.0);
    }

    // Now inject delay on node 4 (Cabin Cleaning) and deposit pheromone
    stigmergy.deposit_delay_pheromone(4, 20.0, &engine.successors[4]);
    diffusion.compute_laplacian(&engine.adj, &stigmergy.tau);

    let mut delays = [0.0f32; NUM_NODES];
    delays[4] = 20.0;

    for _ in 0..5 {
        diffusion.step_diffusion(&delays);
    }

    assert!(diffusion.heat[4] > 0.0, "Source node must have positive heat");

    let bottleneck = diffusion.find_highest_risk_downstream(&delays, &engine.is_critical);
    assert!(bottleneck < NUM_NODES);
}

#[test]
fn test_mdp_policy_solver_determinism() {
    let delays = [0.0f32; NUM_NODES];
    let is_critical = [false; NUM_NODES];
    let heat = [0.0f32; NUM_NODES];

    let nominal_state = MdpState {
        schedule_deviation: 0.0,
        max_heat: 0.05,
        bottleneck_node: 0,
        is_fueling_active: false,
        is_cabin_door_open: true,
    };

    // Under nominal condition, action 0 (NOMINAL_MONITORING) must be chosen
    let (action_id, recovery, safety) = MdpSolver::select_optimal_action(
        &delays,
        &is_critical,
        &heat,
        &nominal_state,
    );
    assert_eq!(action_id, 0);
    assert_eq!(recovery, 0.0);
    assert_eq!(safety, 1.0);

    // Under severe delay on Baggage Offload (node 1)
    let mut delayed_delays = [0.0f32; NUM_NODES];
    delayed_delays[1] = 18.0;
    let mut delayed_critical = [false; NUM_NODES];
    delayed_critical[1] = true;
    let mut delayed_heat = [0.0f32; NUM_NODES];
    delayed_heat[1] = 0.85;

    let disrupted_state = MdpState {
        schedule_deviation: 15.0,
        max_heat: 0.85,
        bottleneck_node: 1,
        is_fueling_active: false,
        is_cabin_door_open: true,
    };

    let (disrupted_action_id, expected_rec, safety_score) = MdpSolver::select_optimal_action(
        &delayed_delays,
        &delayed_critical,
        &delayed_heat,
        &disrupted_state,
    );

    // Action 2 is PRIORITIZE_CONVEYOR_BELT_2 for Baggage Offload
    assert_eq!(disrupted_action_id, 2);
    assert!(expected_rec > 0.0);
    assert!(safety_score >= 0.90, "ICAO safety score must meet minimum safety threshold");
}

#[test]
fn test_full_swarm_core_e2e_and_sub_millisecond_benchmark() {
    let core = SwarmCore::new();
    assert_eq!(core.zero_copy_buffer.len(), get_critical_path_buffer_len());

    // Test wasm entrypoints
    init_turnaround_dag();
    inject_service_delay(2, 10.0); // Refueling delay

    let ptr = compute_critical_path();
    assert!(!ptr.is_null());

    tick_stigmergy_decay(1.0);
    reset_all_delays();

    // Verify metadata lookups
    assert_eq!(get_node_name(0), "Deplaning");
    assert_eq!(get_action_code(0), "NOMINAL_MONITORING");

    // Benchmark sub-millisecond execution (< 0.1 ms / 100 microseconds per cycle)
    let iterations = 1000;
    let start = Instant::now();
    for _ in 0..iterations {
        compute_critical_path();
    }
    let elapsed = start.elapsed();
    let per_iteration_micros = (elapsed.as_micros() as f64) / (iterations as f64);

    println!(
        "Benchmark: {:?} for {} iterations ({:.2} µs / iteration)",
        elapsed, iterations, per_iteration_micros
    );

    // Assert that each iteration takes less than 1000 µs (1.0 ms) in debug, and typically < 100 µs in release
    assert!(
        per_iteration_micros < 1000.0,
        "Single CPM + Diffusion + MDP cycle must execute in < 1 ms, took {:.2} µs",
        per_iteration_micros
    );
}
