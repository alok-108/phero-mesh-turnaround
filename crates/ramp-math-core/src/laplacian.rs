// Laplacian Heat Diffusion & Spectral Bottleneck Detection Engine
// Computes graph Laplacian L = D - (A + tau) and simulates discrete heat diffusion

pub const NUM_NODES: usize = 12;
pub const DIFFUSION_ALPHA: f32 = 0.12;

#[derive(Debug, Clone)]
pub struct LaplacianDiffusion {
    // Current heat/risk vector h in [0.0, 1.0] across all 12 milestones
    pub heat: [f32; NUM_NODES],
    pub laplacian: [[f32; NUM_NODES]; NUM_NODES],
}

impl LaplacianDiffusion {
    pub fn new() -> Self {
        Self {
            heat: [0.0; NUM_NODES],
            laplacian: [[0.0; NUM_NODES]; NUM_NODES],
        }
    }

    pub fn compute_laplacian(
        &mut self,
        adj: &[[f32; NUM_NODES]; NUM_NODES],
        tau: &[[f32; NUM_NODES]; NUM_NODES],
    ) {
        // Combined weight matrix W = A + tau
        let mut w = [[0.0f32; NUM_NODES]; NUM_NODES];
        for i in 0..NUM_NODES {
            for j in 0..NUM_NODES {
                let base = adj[i][j];
                let pheromone = tau[i][j];
                w[i][j] = base + pheromone * 0.2;
            }
        }

        // Degree matrix D[i][i] = sum_j (W[i][j] + W[j][i]) (symmetrized for stable heat diffusion)
        let mut d = [0.0f32; NUM_NODES];
        for i in 0..NUM_NODES {
            let mut deg = 0.0f32;
            for j in 0..NUM_NODES {
                deg += 0.7 * w[i][j] + 0.3 * w[j][i];
            }
            d[i] = deg;
        }

        // Laplacian L = D - W
        for i in 0..NUM_NODES {
            for j in 0..NUM_NODES {
                if i == j {
                    self.laplacian[i][j] = d[i];
                } else {
                    let weight = 0.7 * w[i][j] + 0.3 * w[j][i];
                    self.laplacian[i][j] = -weight;
                }
            }
        }
    }

    pub fn step_diffusion(&mut self, delays: &[f32; NUM_NODES]) {
        // Heat source injection based on active delays
        let mut source = [0.0f32; NUM_NODES];
        for i in 0..NUM_NODES {
            if delays[i] > 0.0 {
                // Injected heat proportional to delay (normalized)
                source[i] = (delays[i] / 15.0).min(1.0);
            }
        }

        // Discrete diffusion: h_new = h - alpha * (L * h) + source
        let mut l_times_h = [0.0f32; NUM_NODES];
        for i in 0..NUM_NODES {
            let mut sum = 0.0f32;
            for j in 0..NUM_NODES {
                sum += self.laplacian[i][j] * self.heat[j];
            }
            l_times_h[i] = sum;
        }

        // Update heat with dampening
        for i in 0..NUM_NODES {
            let direct_source = source[i];
            let diffused = self.heat[i] - DIFFUSION_ALPHA * l_times_h[i];
            let cooled = diffused * 0.96; // Cooling factor
            self.heat[i] = (cooled + direct_source * 0.4).max(0.0).min(1.0);
        }
    }

    pub fn find_highest_risk_downstream(
        &self,
        delays: &[f32; NUM_NODES],
        is_critical: &[bool; NUM_NODES],
    ) -> usize {
        let mut best_node = 0;
        let mut max_risk = -1.0f32;

        for i in 0..NUM_NODES {
            // Factor heat, critical status, and whether delay has already struck
            let mut score = self.heat[i];
            if is_critical[i] {
                score += 0.3;
            }
            // Prioritize downstream milestones that haven't absorbed full delay yet
            if delays[i] == 0.0 && self.heat[i] > 0.1 {
                score += 0.25;
            }

            if score > max_risk {
                max_risk = score;
                best_node = i;
            }
        }

        best_node
    }

    pub fn reset(&mut self) {
        self.heat = [0.0; NUM_NODES];
        self.laplacian = [[0.0; NUM_NODES]; NUM_NODES];
    }
}
