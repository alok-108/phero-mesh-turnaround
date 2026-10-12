// Turnaround schema, DAG types, and 28-byte binary mesh protocol definitions

export enum ShardRole {
  GATE_SUPERVISOR = 1,
  FUELING_CREW = 2,
  BAGGAGE_HANDLING = 3,
  CABIN_SERVICES = 4,
  MASTER_HUB = 5,
}

export const SHARD_ROLE_NAMES: Record<ShardRole, string> = {
  [ShardRole.GATE_SUPERVISOR]: 'Gate Operations Shard',
  [ShardRole.FUELING_CREW]: 'Fueling Crew Shard',
  [ShardRole.BAGGAGE_HANDLING]: 'Baggage Tug Scanner',
  [ShardRole.CABIN_SERVICES]: 'Cabin Services Shard',
  [ShardRole.MASTER_HUB]: 'Ramp Master Hub',
};

export enum PacketType {
  DWELL_FOCUS = 0x01,
  DELAY_INJECT = 0x02,
  CRITICAL_PATH_SYNC = 0x03,
  HEARTBEAT = 0x04,
  RESET_ALL = 0x05,
}

// 28-Byte Binary Packet Layout:
// Offset 0x00: PacketType (Uint8)
// Offset 0x01: SourceShardId (Uint8)
// Offset 0x02: NodeIndex (Uint16)
// Offset 0x04: MonotonicTimestamp (Float64 - performance.now())
// Offset 0x0C: FloatPayload[4] (Float32 x 4: [DelayDelta, SlackTime, PheromoneWeight, Velocity])
export const PACKET_BYTE_LENGTH = 28;

export interface SwarmPacket {
  packetType: PacketType;
  sourceShardId: ShardRole;
  nodeIndex: number;
  timestamp: number;
  payload: [number, number, number, number]; // [DelayDelta, SlackTime, PheromoneWeight, Velocity]
}

export interface MilestoneState {
  id: number;
  name: string;
  zone: string;
  baseDuration: number;
  earlyStart: number;
  earlyFinish: number;
  lateStart: number;
  lateFinish: number;
  totalSlack: number;
  delay: number;
  heat: number;
  isCritical: boolean;
}

export interface RecommendedAction {
  id: number;
  code: string;
  title: string;
  protocol: string;
  expectedRecovery: number;
  safetyScore: number;
}

export interface TurnaroundTelemetry {
  projectDuration: number;
  targetDuration: number;
  scheduleDeviation: number;
  criticalCount: number;
  bottleneckNodeId: number;
  milestones: MilestoneState[];
  action: RecommendedAction;
  pheromoneMatrix: Float32Array; // 12x12 = 144
  adjacencyMatrix: Float32Array; // 12x12 = 144
  computeTimeMs: number;
}

export interface SwarmNodePeer {
  shardId: ShardRole;
  tabId: string;
  isLeader: boolean;
  lastHeartbeat: number;
  latencyMs: number;
  packetsSent: number;
  packetsReceived: number;
}
