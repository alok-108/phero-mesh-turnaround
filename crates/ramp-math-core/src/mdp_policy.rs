// Deterministic Markov Decision Process (MDP) Safe Action Solver
// Evaluates turnaround state constraints and computes optimal tactical ramp actions in <1ms

pub const NUM_ACTIONS: usize = 7;

#[derive(Debug, Clone, Copy)]
pub struct SafeAction {
    pub id: u32,
    pub code: &'static str,
    pub title: &'static str,
    pub target_node: usize,
    pub nominal_recovery_min: f32,
    pub safety_index: f32, // 0.0 to 1.0 safety rating
    pub protocol: &'static str,
}

pub const ACTIONS: [SafeAction; NUM_ACTIONS] = [
    SafeAction {
        id: 0,
        code: "NOMINAL_MONITORING",
        title: "Nominal Ramp Swarm Monitoring",
        target_node: 11,
        nominal_recovery_min: 0.0,
        safety_index: 1.0,
        protocol: "Apron operating within nominal float tolerance. Maintain standard servicing velocity.",
    },
    SafeAction {
        id: 1,
        code: "RESEQUENCE_REAR_GALLEY_CLEANING",
        title: "Resequence Aft Galley Cleaning Crew",
        target_node: 4, // Cabin Cleaning
        nominal_recovery_min: 6.5,
        safety_index: 0.98,
        protocol: "Bypass forward cabin row 1-12; route cleaning team to aft galley to de-conflict deplaning pax flow.",
    },
    SafeAction {
        id: 2,
        code: "PRIORITIZE_CONVEYOR_BELT_2",
        title: "Prioritize Dual Belt Loader Conveyor 2",
        target_node: 1, // Baggage Offload
        nominal_recovery_min: 5.5,
        safety_index: 0.95,
        protocol: "Deploy auxiliary electric belt loader to rear bulk cargo hold; accelerate transfer bag offload.",
    },
    SafeAction {
        id: 3,
        code: "ACCELERATE_GATE_BOARDING_PACE",
        title: "Engage Dual-Door Biometric Boarding",
        target_node: 8, // Passenger Boarding
        nominal_recovery_min: 7.0,
        safety_index: 0.96,
        protocol: "Deploy mobile stairs to starboard 2R door; initiate zone 3/4 boarding while jetbridge boards zone 1/2.",
    },
    SafeAction {
        id: 4,
        code: "PARALLEL_REFUEL_BOARD_PROTOCOL",
        title: "Engage ICAO Refuel-With-Pax-Onboard Safety Protocol",
        target_node: 2, // Refueling
        nominal_recovery_min: 8.0,
        safety_index: 0.94,
        protocol: "Station airport fire rescue tender at wingtip; illuminate exit signs; enable concurrent boarding during fueling.",
    },
    SafeAction {
        id: 5,
        code: "DEPLOY_STANDBY_BAGGAGE_CREW",
        title: "Deploy Standby Ramp Loading Squad",
        target_node: 7, // Baggage Loading
        nominal_recovery_min: 6.0,
        safety_index: 0.97,
        protocol: "Route reserve ground handling squad from gate B12 to expedite container loading into forward hold.",
    },
    SafeAction {
        id: 6,
        code: "FAST_TRACK_PREFLIGHT_CLEARANCE",
        title: "Fast-Track Digital Airframe Signoff",
        target_node: 9, // Pre-Flight Inspection
        nominal_recovery_min: 4.0,
        safety_index: 0.99,
        protocol: "Parallelize exterior visual walkaround with digital ACARS electronic technical logbook signoff.",
    },
];

#[derive(Debug, Clone, Copy)]
pub struct MdpState {
    pub schedule_deviation: f32, // Positive if turnaround exceeds target 45 min
    pub max_heat: f32,
    pub bottleneck_node: usize,
    pub is_fueling_active: bool,
    pub is_cabin_door_open: bool,
}

pub struct MdpSolver;

impl MdpSolver {
    pub fn select_optimal_action(
        delays: &[f32; 12],
        is_critical: &[bool; 12],
        heat: &[f32; 12],
        state: &MdpState,
    ) -> (u32, f32, f32) {
        // If no schedule deviation and low heat, nominal monitoring is optimal
        if state.schedule_deviation <= 0.0 && state.max_heat < 0.15 {
            return (0, 0.0, 1.0);
        }

        let mut best_action_id = 0u32;
        let mut max_q_value = -100.0f32;
        let mut expected_recovery = 0.0f32;
        let mut safety_score = 1.0f32;

        for action in &ACTIONS {
            if action.id == 0 {
                continue;
            }

            let target = action.target_node;
            let target_delay = delays[target];
            let target_critical = is_critical[target];
            let target_heat = heat[target];

            // Calculate reward: how much buffer this action restores on the bottleneck
            let mut utility = 0.0f32;

            // Direct delay mitigation bonus
            if target_delay > 0.0 {
                utility += target_delay.min(action.nominal_recovery_min) * 2.5;
            }

            // Critical path urgency weight
            if target_critical {
                utility += 4.0;
            }

            // Predictive heat impact
            utility += target_heat * 3.0;

            // Alignment with current identified bottleneck
            if target == state.bottleneck_node {
                utility += 5.0;
            }

            // Safety penalty / constraint verification
            let q_value = utility * action.safety_index;

            if q_value > max_q_value {
                max_q_value = q_value;
                best_action_id = action.id;
                expected_recovery = action.nominal_recovery_min.min(target_delay.max(3.0));
                safety_score = action.safety_index;
            }
        }

        (best_action_id, expected_recovery, safety_score)
    }
}
