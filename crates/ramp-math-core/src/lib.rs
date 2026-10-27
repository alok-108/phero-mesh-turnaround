use std::sync::Mutex;
use wasm_bindgen::prelude::*;

pub mod cpm;
pub mod stigmergy;
pub mod laplacian;
pub mod mdp_policy;

use cpm::{CpmEngine, MILESTONES, NUM_NODES, TARGET_TURNAROUND_MINUTES};
use stigmergy::StigmergyMatrix;
use laplacian::LaplacianDiffusion;
use mdp_policy::{ACTIONS, MdpSolver, MdpState};

const NODE_STRIDE: usize = 8;
const BUFFER_LEN: usize = NUM_NODES * NODE_STRIDE + 8; // 96 + 8 = 104 floats
const MATRIX_LEN: usize = NUM_NODES * NUM_NODES;

pub struct SwarmCore {
    pub engine: CpmEngine,
    pub stigmergy: StigmergyMatrix,
    pub diffusion: LaplacianDiffusion,
    pub zero_copy_buffer: [f32; BUFFER_LEN],
    pub pheromone_buffer: [f32; MATRIX_LEN],
    pub adjacency_buffer: [f32; MATRIX_LEN],
}

impl SwarmCore {
    pub fn new() -> Self {
        let engine = CpmEngine::new();
        let stigmergy = StigmergyMatrix::new();
        let diffusion = LaplacianDiffusion::new();

        let mut adjacency_buffer = [0.0f32; MATRIX_LEN];
        for i in 0..NUM_NODES {
            for j in 0..NUM_NODES {
                adjacency_buffer[i * NUM_NODES + j] = engine.adj[i][j];
            }
        }

        Self {
            engine,
            stigmergy,
            diffusion,
            zero_copy_buffer: [0.0; BUFFER_LEN],
            pheromone_buffer: [0.0; MATRIX_LEN],
            adjacency_buffer,
        }
    }
}

static CORE: Mutex<Option<SwarmCore>> = Mutex::new(None);

#[wasm_bindgen]
pub fn init_turnaround_dag() {
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();

    let mut lock = CORE.lock().unwrap();
    *lock = Some(SwarmCore::new());
}

#[wasm_bindgen]
pub fn inject_service_delay(node_id: usize, delay_minutes: f32) {
    let mut lock = CORE.lock().unwrap();
    if let Some(ref mut core) = *lock {
        core.engine.set_delay(node_id, delay_minutes);
        core.stigmergy.deposit_delay_pheromone(
            node_id,
            delay_minutes,
            &core.engine.successors[node_id],
        );
        core.diffusion.compute_laplacian(&core.engine.adj, &core.stigmergy.tau);
        core.diffusion.step_diffusion(&core.engine.delays);
    }
}

#[wasm_bindgen]
pub fn reset_all_delays() {
    let mut lock = CORE.lock().unwrap();
    if let Some(ref mut core) = *lock {
        core.engine.reset_all_delays();
        core.stigmergy.reset();
        core.diffusion.reset();
    }
}

#[wasm_bindgen]
pub fn tick_stigmergy_decay(dt_factor: f32) {
    let mut lock = CORE.lock().unwrap();
    if let Some(ref mut core) = *lock {
        core.stigmergy.tick_decay(dt_factor);
        core.diffusion.compute_laplacian(&core.engine.adj, &core.stigmergy.tau);
        core.diffusion.step_diffusion(&core.engine.delays);
    }
}

#[wasm_bindgen]
pub fn compute_critical_path() -> *const f32 {
    let mut lock = CORE.lock().unwrap();
    if let Some(ref mut core) = *lock {
        core.engine.recalculate();
        core.diffusion.compute_laplacian(&core.engine.adj, &core.stigmergy.tau);
        core.diffusion.step_diffusion(&core.engine.delays);

        let bottleneck_node = core.diffusion.find_highest_risk_downstream(
            &core.engine.delays,
            &core.engine.is_critical,
        );
        let mut critical_count = 0.0f32;

        for i in 0..NUM_NODES {
            let offset = i * NODE_STRIDE;
            core.zero_copy_buffer[offset]     = core.engine.es[i];
            core.zero_copy_buffer[offset + 1] = core.engine.ef[i];
            core.zero_copy_buffer[offset + 2] = core.engine.ls[i];
            core.zero_copy_buffer[offset + 3] = core.engine.lf[i];
            core.zero_copy_buffer[offset + 4] = core.engine.total_slack[i];
            core.zero_copy_buffer[offset + 5] = core.engine.delays[i];
            core.zero_copy_buffer[offset + 6] = core.diffusion.heat[i];
            core.zero_copy_buffer[offset + 7] = if core.engine.is_critical[i] { 1.0 } else { 0.0 };

            if core.engine.is_critical[i] {
                critical_count += 1.0;
            }
        }

        let schedule_dev = (core.engine.project_duration - TARGET_TURNAROUND_MINUTES).max(-15.0);
        let max_heat = core.diffusion.heat.iter().cloned().fold(0.0f32, f32::max);

        let state = MdpState {
            schedule_deviation: schedule_dev,
            max_heat,
            bottleneck_node,
            is_fueling_active: core.engine.delays[2] > 0.0,
            is_cabin_door_open: true,
        };

        let (action_id, recovery, safety) = MdpSolver::select_optimal_action(
            &core.engine.delays,
            &core.engine.is_critical,
            &core.diffusion.heat,
            &state,
        );

        // Summary metrics
        let base = NUM_NODES * NODE_STRIDE;
        core.zero_copy_buffer[base]     = core.engine.project_duration;
        core.zero_copy_buffer[base + 1] = TARGET_TURNAROUND_MINUTES;
        core.zero_copy_buffer[base + 2] = schedule_dev;
        core.zero_copy_buffer[base + 3] = critical_count;
        core.zero_copy_buffer[base + 4] = bottleneck_node as f32;
        core.zero_copy_buffer[base + 5] = action_id as f32;
        core.zero_copy_buffer[base + 6] = recovery;
        core.zero_copy_buffer[base + 7] = safety;

        // Update pheromone buffer
        for i in 0..NUM_NODES {
            for j in 0..NUM_NODES {
                core.pheromone_buffer[i * NUM_NODES + j] = core.stigmergy.tau[i][j];
            }
        }

        core.zero_copy_buffer.as_ptr()
    } else {
        std::ptr::null()
    }
}

#[wasm_bindgen]
pub fn get_critical_path_buffer_len() -> usize {
    BUFFER_LEN
}

#[wasm_bindgen]
pub fn get_pheromone_matrix() -> *const f32 {
    let lock = CORE.lock().unwrap();
    if let Some(ref core) = *lock {
        core.pheromone_buffer.as_ptr()
    } else {
        std::ptr::null()
    }
}

#[wasm_bindgen]
pub fn get_edge_pheromone(u: usize, v: usize) -> f32 {
    let lock = CORE.lock().unwrap();
    if let Some(ref core) = *lock {
        core.stigmergy.get_edge_weight(u, v)
    } else {
        0.0
    }
}

#[wasm_bindgen]
pub fn get_adjacency_matrix() -> *const f32 {
    let lock = CORE.lock().unwrap();
    if let Some(ref core) = *lock {
        core.adjacency_buffer.as_ptr()
    } else {
        std::ptr::null()
    }
}

#[wasm_bindgen]
pub fn get_bottleneck_recommendation() -> u32 {
    let lock = CORE.lock().unwrap();
    if let Some(ref core) = *lock {
        let base = NUM_NODES * NODE_STRIDE;
        core.zero_copy_buffer[base + 5] as u32
    } else {
        0
    }
}

#[wasm_bindgen]
pub fn get_node_name(node_id: usize) -> String {
    if node_id < NUM_NODES {
        MILESTONES[node_id].name.to_string()
    } else {
        String::new()
    }
}

#[wasm_bindgen]
pub fn get_node_zone(node_id: usize) -> String {
    if node_id < NUM_NODES {
        MILESTONES[node_id].zone.to_string()
    } else {
        String::new()
    }
}

#[wasm_bindgen]
pub fn get_node_base_duration(node_id: usize) -> f32 {
    if node_id < NUM_NODES {
        MILESTONES[node_id].base_duration
    } else {
        0.0
    }
}

#[wasm_bindgen]
pub fn get_action_code(action_id: u32) -> String {
    ACTIONS.iter()
        .find(|a| a.id == action_id)
        .map(|a| a.code.to_string())
        .unwrap_or_else(|| "UNKNOWN".to_string())
}

#[wasm_bindgen]
pub fn get_action_title(action_id: u32) -> String {
    ACTIONS.iter()
        .find(|a| a.id == action_id)
        .map(|a| a.title.to_string())
        .unwrap_or_else(|| "Nominal Monitoring".to_string())
}

#[wasm_bindgen]
pub fn get_action_protocol(action_id: u32) -> String {
    ACTIONS.iter()
        .find(|a| a.id == action_id)
        .map(|a| a.protocol.to_string())
        .unwrap_or_else(|| "No protocol required".to_string())
}
