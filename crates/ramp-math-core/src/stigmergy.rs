// Stigmergic Pheromone Diffusion Matrix
// Models collective delay momentum across apron service dependencies with evaporation

pub const NUM_NODES: usize = 12;
pub const RHO_EVAPORATION_RATE: f32 = 0.05; // 5% evaporation per nominal tick

#[derive(Debug, Clone)]
pub struct StigmergyMatrix {
    // tau[i][j] represents pheromone intensity on directed edge i -> j
    pub tau: [[f32; NUM_NODES]; NUM_NODES],
    pub node_intensity: [f32; NUM_NODES],
}

impl StigmergyMatrix {
    pub fn new() -> Self {
        Self {
            tau: [[0.0f32; NUM_NODES]; NUM_NODES],
            node_intensity: [0.0f32; NUM_NODES],
        }
    }

    pub fn deposit_delay_pheromone(
        &mut self,
        node_id: usize,
        delay_minutes: f32,
        successors: &[usize],
    ) {
        if node_id >= NUM_NODES || delay_minutes <= 0.0 {
            return;
        }

        let delta_tau = (delay_minutes * 0.35).min(10.0);
        self.node_intensity[node_id] = (self.node_intensity[node_id] + delta_tau).min(20.0);

        for &succ in successors {
            if succ < NUM_NODES {
                self.tau[node_id][succ] = (self.tau[node_id][succ] + delta_tau).min(25.0);
            }
        }
    }

    pub fn tick_decay(&mut self, dt_factor: f32) {
        let decay_multiplier = (1.0 - RHO_EVAPORATION_RATE * dt_factor).max(0.0).min(1.0);

        for i in 0..NUM_NODES {
            self.node_intensity[i] *= decay_multiplier;
            if self.node_intensity[i] < 0.001 {
                self.node_intensity[i] = 0.0;
            }

            for j in 0..NUM_NODES {
                self.tau[i][j] *= decay_multiplier;
                if self.tau[i][j] < 0.001 {
                    self.tau[i][j] = 0.0;
                }
            }
        }
    }

    pub fn reset(&mut self) {
        self.tau = [[0.0; NUM_NODES]; NUM_NODES];
        self.node_intensity = [0.0; NUM_NODES];
    }

    pub fn get_edge_weight(&self, u: usize, v: usize) -> f32 {
        if u < NUM_NODES && v < NUM_NODES {
            self.tau[u][v]
        } else {
            0.0
        }
    }
}
