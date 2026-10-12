// Critical Path Method (CPM) Engine for Airbus A320 45-Minute Turnaround DAG
// Deterministic forward/backward pass with Early/Late Start/Finish & Total Slack

pub const NUM_NODES: usize = 12;
pub const TARGET_TURNAROUND_MINUTES: f32 = 45.0;

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct MilestoneDef {
    pub id: usize,
    pub name: &'static str,
    pub base_duration: f32,
    pub zone: &'static str,
}

pub const MILESTONES: [MilestoneDef; NUM_NODES] = [
    MilestoneDef { id: 0,  name: "Deplaning",                base_duration: 10.0, zone: "Forward Cabin" },
    MilestoneDef { id: 1,  name: "Baggage Offload",           base_duration: 15.0, zone: "Aft/Fwd Cargo Holds" },
    MilestoneDef { id: 2,  name: "Refueling",                 base_duration: 20.0, zone: "Starboard Wing Box" },
    MilestoneDef { id: 3,  name: "Catering Replenishment",    base_duration: 15.0, zone: "Forward/Aft Galleys" },
    MilestoneDef { id: 4,  name: "Cabin Cleaning",            base_duration: 18.0, zone: "Main Cabin Pax Deck" },
    MilestoneDef { id: 5,  name: "Lavatory Service",          base_duration: 8.0,  zone: "Aft Waste Service Panel" },
    MilestoneDef { id: 6,  name: "Water Service",             base_duration: 6.0,  zone: "Aft Potable Water Panel" },
    MilestoneDef { id: 7,  name: "Baggage Loading",           base_duration: 20.0, zone: "Aft/Fwd Cargo Holds" },
    MilestoneDef { id: 8,  name: "Passenger Boarding",        base_duration: 22.0, zone: "Port Door 1L / Jetbridge" },
    MilestoneDef { id: 9,  name: "Pre-Flight Inspection",     base_duration: 10.0, zone: "Exterior Airframe Perimeter" },
    MilestoneDef { id: 10, name: "Cargo Doors Closed",        base_duration: 5.0,  zone: "Cargo Hatches 1 & 2" },
    MilestoneDef { id: 11, name: "Pushback Clearance",        base_duration: 5.0,  zone: "Nose Gear Tug Staging" },
];

#[derive(Debug, Clone)]
pub struct CpmEngine {
    pub delays: [f32; NUM_NODES],
    pub es: [f32; NUM_NODES],
    pub ef: [f32; NUM_NODES],
    pub ls: [f32; NUM_NODES],
    pub lf: [f32; NUM_NODES],
    pub total_slack: [f32; NUM_NODES],
    pub is_critical: [bool; NUM_NODES],
    pub project_duration: f32,
    // Adjacency matrix: adj[u][v] == 1 means edge u -> v (u precedes v)
    pub adj: [[f32; NUM_NODES]; NUM_NODES],
    // Predecessors list for fast topological traversal
    pub predecessors: [Vec<usize>; NUM_NODES],
    pub successors: [Vec<usize>; NUM_NODES],
}

impl CpmEngine {
    pub fn new() -> Self {
        let mut adj = [[0.0f32; NUM_NODES]; NUM_NODES];
        let mut preds: [Vec<usize>; NUM_NODES] = Default::default();
        let mut succs: [Vec<usize>; NUM_NODES] = Default::default();

        let edges = [
            // Deplaning precedes interior cleaning, catering, lavatory, water
            (0, 3), // Deplaning -> Catering
            (0, 4), // Deplaning -> Cabin Cleaning
            (0, 5), // Deplaning -> Lavatory Service
            (0, 6), // Deplaning -> Water Service
            // Deplaning also completes before passenger boarding can begin
            // Baggage Offload must complete before Baggage Loading begins
            (1, 7), // Baggage Offload -> Baggage Loading
            // Refueling starts after deplaning clears cabin or during parallel fueling
            (0, 2), // Deplaning -> Refueling
            // Cabin Cleaning, Catering, and Refueling must finish before Passenger Boarding
            (2, 8), // Refueling -> Passenger Boarding
            (3, 8), // Catering -> Passenger Boarding
            (4, 8), // Cabin Cleaning -> Passenger Boarding
            // Baggage Loading completes, then Cargo Doors are secured & closed
            (7, 10), // Baggage Loading -> Cargo Doors Closed
            // Pre-flight inspection runs and coordinates with doors & boarding
            (0, 9),  // Deplaning -> Pre-Flight Inspection walkaround
            // Pushback Clearance requires Boarding complete, Cargo closed, Inspection signed
            (8, 11),  // Passenger Boarding -> Pushback Clearance
            (10, 11), // Cargo Doors Closed -> Pushback Clearance
            (9, 11),  // Pre-Flight Inspection -> Pushback Clearance
        ];

        for (u, v) in edges {
            adj[u][v] = 1.0;
            preds[v].push(u);
            succs[u].push(v);
        }

        let mut engine = Self {
            delays: [0.0; NUM_NODES],
            es: [0.0; NUM_NODES],
            ef: [0.0; NUM_NODES],
            ls: [0.0; NUM_NODES],
            lf: [0.0; NUM_NODES],
            total_slack: [0.0; NUM_NODES],
            is_critical: [false; NUM_NODES],
            project_duration: 0.0,
            adj,
            predecessors: preds,
            successors: succs,
        };

        engine.recalculate();
        engine
    }

    pub fn set_delay(&mut self, node_id: usize, delay_minutes: f32) {
        if node_id < NUM_NODES {
            self.delays[node_id] = delay_minutes.max(0.0);
            self.recalculate();
        }
    }

    pub fn reset_all_delays(&mut self) {
        self.delays = [0.0; NUM_NODES];
        self.recalculate();
    }

    pub fn duration_of(&self, i: usize) -> f32 {
        MILESTONES[i].base_duration + self.delays[i]
    }

    pub fn recalculate(&mut self) {
        // Topological forward pass (0..NUM_NODES since graph is ordered DAG)
        for i in 0..NUM_NODES {
            let mut max_pred_ef = 0.0f32;
            for &p in &self.predecessors[i] {
                if self.ef[p] > max_pred_ef {
                    max_pred_ef = self.ef[p];
                }
            }
            self.es[i] = max_pred_ef;
            self.ef[i] = self.es[i] + self.duration_of(i);
        }

        // Project duration is max EF across all nodes
        self.project_duration = 0.0;
        for i in 0..NUM_NODES {
            if self.ef[i] > self.project_duration {
                self.project_duration = self.ef[i];
            }
        }

        // Backward pass
        // Set late finish of sink nodes to project duration
        for i in (0..NUM_NODES).rev() {
            if self.successors[i].is_empty() {
                self.lf[i] = self.project_duration;
            } else {
                let mut min_succ_ls = f32::INFINITY;
                for &s in &self.successors[i] {
                    if self.ls[s] < min_succ_ls {
                        min_succ_ls = self.ls[s];
                    }
                }
                self.lf[i] = min_succ_ls;
            }
            self.ls[i] = self.lf[i] - self.duration_of(i);
            
            // Total Slack TS = LS - ES
            let raw_slack = self.ls[i] - self.es[i];
            // Snap tiny floating point inaccuracies to 0
            self.total_slack[i] = if raw_slack.abs() < 1e-4 { 0.0 } else { raw_slack };

            // Critical path: any milestone with TS <= 0.001
            self.is_critical[i] = self.total_slack[i] <= 0.01;
        }
    }
}
