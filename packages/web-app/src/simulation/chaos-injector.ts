// Chaos Injection Suite & Deterministic WASM vs Cloud LLM Benchmark

export interface ChaosPreset {
  id: string;
  title: string;
  nodeId: number;
  delayMinutes: number;
  description: string;
  severity: 'warning' | 'critical' | 'emergency';
}

export const CHAOS_PRESETS: ChaosPreset[] = [
  {
    id: 'fuel_valve_jam',
    title: '12-min Fuel Valve Jam',
    nodeId: 2, // Refueling
    delayMinutes: 12.0,
    description: 'High-pressure hydrant pit valve failure on starboard wing. Flow stopped at 40% target fuel load.',
    severity: 'critical',
  },
  {
    id: 'cargo_belt_fail',
    title: 'Cargo Belly Scanner Failure',
    nodeId: 1, // Baggage Offload
    delayMinutes: 15.0,
    description: 'Optical barcode conveyor jam in aft cargo hold. Transfer bag routing halted.',
    severity: 'critical',
  },
  {
    id: 'aisle_spill',
    title: 'Spill on Aisle 14 (Cleaning)',
    nodeId: 4, // Cabin Cleaning
    delayMinutes: 14.0,
    description: 'Chemical spill in mid-cabin galley cross-aisle. Bio-hazard sanitation protocol initiated.',
    severity: 'warning',
  },
  {
    id: 'catering_hydraulic',
    title: 'Catering Truck Hydraulic Fault',
    nodeId: 3, // Catering Replenishment
    delayMinutes: 10.0,
    description: 'High-lift scissor platform locked at door 1R. Emergency lowering procedure required.',
    severity: 'warning',
  },
  {
    id: 'boarding_jam',
    title: 'Biometric Gate Reader Failure',
    nodeId: 8, // Passenger Boarding
    delayMinutes: 16.0,
    description: 'Gate 42B passport scanner desync. Manual boarding pass verification required for 168 pax.',
    severity: 'emergency',
  },
];

export interface CloudLlmSimulationState {
  isActive: boolean;
  status: 'idle' | 'calling_cloud' | 'synthesizing' | 'completed';
  elapsedSeconds: number;
  targetSeconds: number;
  tokensUsed: number;
  estimatedCostUsd: number;
  hallucinationWarning: string | null;
  proposedPlan: string | null;
}

export class ChaosEngine {
  public cloudLlmState: CloudLlmSimulationState = {
    isActive: false,
    status: 'idle',
    elapsedSeconds: 0,
    targetSeconds: 18.2,
    tokensUsed: 0,
    estimatedCostUsd: 0,
    hallucinationWarning: null,
    proposedPlan: null,
  };

  private timerInterval: number | null = null;
  private onStateChange: ((state: CloudLlmSimulationState) => void) | null = null;

  public setListener(cb: (state: CloudLlmSimulationState) => void): void {
    this.onStateChange = cb;
  }

  public triggerCloudLlmBenchmark(chaosTitle: string, delayMinutes: number): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }

    this.cloudLlmState = {
      isActive: true,
      status: 'calling_cloud',
      elapsedSeconds: 0,
      targetSeconds: 18.2,
      tokensUsed: 1200,
      estimatedCostUsd: 0.024,
      hallucinationWarning: null,
      proposedPlan: null,
    };

    if (this.onStateChange) this.onStateChange({ ...this.cloudLlmState });

    const stepMs = 100;
    this.timerInterval = window.setInterval(() => {
      this.cloudLlmState.elapsedSeconds += stepMs / 1000;
      this.cloudLlmState.tokensUsed += 165;
      this.cloudLlmState.estimatedCostUsd = (this.cloudLlmState.tokensUsed / 1000) * 0.015;

      if (this.cloudLlmState.elapsedSeconds > 6.0 && this.cloudLlmState.status === 'calling_cloud') {
        this.cloudLlmState.status = 'synthesizing';
      }

      if (this.cloudLlmState.elapsedSeconds >= this.cloudLlmState.targetSeconds) {
        this.cloudLlmState.status = 'completed';
        this.cloudLlmState.hallucinationWarning =
          'CRITICAL SAFETY WARNING: Cloud LLM proposed concurrent boarding without mandatory ICAO fire marshal coverage during active wing hydrant pumping. Rejected by safety gate!';
        this.cloudLlmState.proposedPlan = `Cloud plan generated after 18.2s network round-trip. Cost: $${this.cloudLlmState.estimatedCostUsd.toFixed(3)}`;

        if (this.timerInterval) {
          clearInterval(this.timerInterval);
          this.timerInterval = null;
        }
      }

      if (this.onStateChange) this.onStateChange({ ...this.cloudLlmState });
    }, stepMs);
  }

  public reset(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    this.cloudLlmState = {
      isActive: false,
      status: 'idle',
      elapsedSeconds: 0,
      targetSeconds: 18.2,
      tokensUsed: 0,
      estimatedCostUsd: 0,
      hallucinationWarning: null,
      proposedPlan: null,
    };
    if (this.onStateChange) this.onStateChange({ ...this.cloudLlmState });
  }
}

export const chaosEngine = new ChaosEngine();
