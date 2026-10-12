// Zero-Copy TypedArray Interface to Rust WASM Engine

import initWasm, {
  init_turnaround_dag,
  inject_service_delay,
  reset_all_delays as wasm_reset_delays,
  tick_stigmergy_decay,
  compute_critical_path as wasm_compute_critical_path,
  get_pheromone_matrix as wasm_get_pheromone_matrix,
  get_adjacency_matrix as wasm_get_adjacency_matrix,
  get_node_name,
  get_node_zone,
  get_node_base_duration,
  get_action_code,
  get_action_title,
  get_action_protocol,
  type InitOutput,
} from '../wasm/ramp_math_core';
import type { MilestoneState, RecommendedAction, TurnaroundTelemetry } from './types';

class WasmBridge {
  private wasmInstance: InitOutput | null = null;
  private isInitialized = false;
  private nodeMetadata: Array<{ name: string; zone: string; baseDuration: number }> = [];

  public async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      this.wasmInstance = await initWasm();
      init_turnaround_dag();

      // Cache static node definitions
      this.nodeMetadata = [];
      for (let i = 0; i < 12; i++) {
        this.nodeMetadata.push({
          name: get_node_name(i),
          zone: get_node_zone(i),
          baseDuration: get_node_base_duration(i),
        });
      }

      this.isInitialized = true;
    } catch (err) {
      console.error('[WASM Bridge] Initialization failed:', err);
      throw err;
    }
  }

  public get ready(): boolean {
    return this.isInitialized;
  }

  public injectDelay(nodeId: number, delayMinutes: number): void {
    if (!this.isInitialized) return;
    inject_service_delay(nodeId, delayMinutes);
  }

  public resetAllDelays(): void {
    if (!this.isInitialized) return;
    wasm_reset_delays();
  }

  public tickDecay(dtFactor: number = 1.0): void {
    if (!this.isInitialized) return;
    tick_stigmergy_decay(dtFactor);
  }

  public computeTelemetry(): TurnaroundTelemetry | null {
    if (!this.isInitialized || !this.wasmInstance) return null;

    const t0 = performance.now();
    const ptr = wasm_compute_critical_path();
    const computeTimeMs = performance.now() - t0;

    if (ptr === 0) return null;

    // Zero-copy view into WASM linear memory
    const memoryBuffer = this.wasmInstance.memory.buffer;
    const view = new Float32Array(memoryBuffer, ptr, 104);

    const milestones: MilestoneState[] = [];
    const NODE_STRIDE = 8;

    for (let i = 0; i < 12; i++) {
      const offset = i * NODE_STRIDE;
      const meta = this.nodeMetadata[i] || {
        name: `Milestone ${i}`,
        zone: 'Ramp Area',
        baseDuration: 10,
      };

      milestones.push({
        id: i,
        name: meta.name,
        zone: meta.zone,
        baseDuration: meta.baseDuration,
        earlyStart: view[offset],
        earlyFinish: view[offset + 1],
        lateStart: view[offset + 2],
        lateFinish: view[offset + 3],
        totalSlack: view[offset + 4],
        delay: view[offset + 5],
        heat: view[offset + 6],
        isCritical: view[offset + 7] > 0.5,
      });
    }

    const summaryBase = 12 * NODE_STRIDE;
    const projectDuration = view[summaryBase];
    const targetDuration = view[summaryBase + 1];
    const scheduleDeviation = view[summaryBase + 2];
    const criticalCount = view[summaryBase + 3];
    const bottleneckNodeId = Math.round(view[summaryBase + 4]);
    const actionId = Math.round(view[summaryBase + 5]);
    const expectedRecovery = view[summaryBase + 6];
    const safetyScore = view[summaryBase + 7];

    const action: RecommendedAction = {
      id: actionId,
      code: get_action_code(actionId),
      title: get_action_title(actionId),
      protocol: get_action_protocol(actionId),
      expectedRecovery,
      safetyScore,
    };

    // Pheromone & Adjacency views
    const pheroPtr = wasm_get_pheromone_matrix();
    const pheromoneMatrix = pheroPtr !== 0
      ? new Float32Array(memoryBuffer, pheroPtr, 144)
      : new Float32Array(144);

    const adjPtr = wasm_get_adjacency_matrix();
    const adjacencyMatrix = adjPtr !== 0
      ? new Float32Array(memoryBuffer, adjPtr, 144)
      : new Float32Array(144);

    return {
      projectDuration,
      targetDuration,
      scheduleDeviation,
      criticalCount,
      bottleneckNodeId,
      milestones,
      action,
      pheromoneMatrix: new Float32Array(pheromoneMatrix), // Snapshot for immutable rendering
      adjacencyMatrix: new Float32Array(adjacencyMatrix),
      computeTimeMs,
    };
  }
}

export const wasmBridge = new WasmBridge();
