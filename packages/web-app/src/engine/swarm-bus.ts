// 28-Byte Binary Packet BroadcastChannel Router & Mesh Protocol

import {
  PACKET_BYTE_LENGTH,
  PacketType,
  ShardRole,
  type SwarmNodePeer,
  type SwarmPacket,
} from './types';

export type PacketHandler = (packet: SwarmPacket, latencyMs: number) => void;

class SwarmBus {
  private channel: BroadcastChannel | null = null;
  private tabId: string;
  private currentRole: ShardRole = ShardRole.MASTER_HUB;
  private subscribers: Set<PacketHandler> = new Set();
  
  // Peer discovery & metrics
  private peers: Map<string, SwarmNodePeer> = new Map();
  private packetsSent = 0;
  private packetsReceived = 0;
  private lastLatencyMs = 0.42; // default sub-millisecond local reference
  private heartbeatInterval: number | null = null;

  constructor() {
    this.tabId = 'tab_' + Math.random().toString(36).substring(2, 9);
  }

  public initialize(initialRole: ShardRole): void {
    this.currentRole = initialRole;

    if (typeof BroadcastChannel !== 'undefined') {
      this.channel = new BroadcastChannel('phero_mesh_tarmac_bus');
      this.channel.onmessage = this.handleIncomingMessage.bind(this);
    } else {
      console.warn('[SwarmBus] BroadcastChannel not supported in this environment.');
    }

    // Start periodic peer heartbeat (every 1.5 seconds)
    if (typeof window !== 'undefined') {
      this.heartbeatInterval = window.setInterval(() => {
        this.broadcastHeartbeat();
        this.pruneDeadPeers();
      }, 1500);
    }
  }

  public setRole(role: ShardRole): void {
    this.currentRole = role;
    this.broadcastHeartbeat();
  }

  public getRole(): ShardRole {
    return this.currentRole;
  }

  public getTabId(): string {
    return this.tabId;
  }

  public getMetrics() {
    return {
      packetsSent: this.packetsSent,
      packetsReceived: this.packetsReceived,
      lastLatencyMs: this.lastLatencyMs,
      peerCount: this.peers.size + 1, // include self
      activePeers: Array.from(this.peers.values()),
    };
  }

  public subscribe(handler: PacketHandler): () => void {
    this.subscribers.add(handler);
    return () => this.subscribers.delete(handler);
  }

  // 28-Byte Binary Packet Encoder
  public static encode(packet: SwarmPacket): ArrayBuffer {
    const buffer = new ArrayBuffer(PACKET_BYTE_LENGTH);
    const view = new DataView(buffer);

    view.setUint8(0x00, packet.packetType);
    view.setUint8(0x01, packet.sourceShardId);
    view.setUint16(0x02, packet.nodeIndex, true); // Little-endian
    view.setFloat64(0x04, packet.timestamp, true);

    const [f0, f1, f2, f3] = packet.payload;
    view.setFloat32(0x0c, f0, true);
    view.setFloat32(0x10, f1, true);
    view.setFloat32(0x14, f2, true);
    view.setFloat32(0x18, f3, true);

    return buffer;
  }

  // 28-Byte Binary Packet Decoder
  public static decode(buffer: ArrayBuffer): SwarmPacket | null {
    if (buffer.byteLength < PACKET_BYTE_LENGTH) return null;

    const view = new DataView(buffer);
    const packetType = view.getUint8(0x00) as PacketType;
    const sourceShardId = view.getUint8(0x01) as ShardRole;
    const nodeIndex = view.getUint16(0x02, true);
    const timestamp = view.getFloat64(0x04, true);

    const payload: [number, number, number, number] = [
      view.getFloat32(0x0c, true),
      view.getFloat32(0x10, true),
      view.getFloat32(0x14, true),
      view.getFloat32(0x18, true),
    ];

    return {
      packetType,
      sourceShardId,
      nodeIndex,
      timestamp,
      payload,
    };
  }

  public broadcast(packet: SwarmPacket): void {
    const buffer = SwarmBus.encode(packet);
    this.packetsSent++;

    if (this.channel) {
      this.channel.postMessage(buffer);
    }

    // Also dispatch locally to own tab subscribers
    this.subscribers.forEach((cb) => cb(packet, 0.05));
  }

  public broadcastDelayInjection(nodeIndex: number, delayDelta: number, slackTime: number = 0): void {
    const packet: SwarmPacket = {
      packetType: PacketType.DELAY_INJECT,
      sourceShardId: this.currentRole,
      nodeIndex,
      timestamp: performance.now(),
      payload: [delayDelta, slackTime, delayDelta * 0.4, 1.0],
    };
    this.broadcast(packet);
  }

  public broadcastSync(bottleneckNodeId: number, scheduleDeviation: number, criticalCount: number): void {
    const packet: SwarmPacket = {
      packetType: PacketType.CRITICAL_PATH_SYNC,
      sourceShardId: this.currentRole,
      nodeIndex: bottleneckNodeId,
      timestamp: performance.now(),
      payload: [scheduleDeviation, criticalCount, 0, 1.0],
    };
    this.broadcast(packet);
  }

  public broadcastResetAll(): void {
    const packet: SwarmPacket = {
      packetType: PacketType.RESET_ALL,
      sourceShardId: this.currentRole,
      nodeIndex: 0,
      timestamp: performance.now(),
      payload: [0, 0, 0, 0],
    };
    this.broadcast(packet);
  }

  private broadcastHeartbeat(): void {
    const packet: SwarmPacket = {
      packetType: PacketType.HEARTBEAT,
      sourceShardId: this.currentRole,
      nodeIndex: 0,
      timestamp: performance.now(),
      payload: [0, 0, 0, 0],
    };

    const buffer = SwarmBus.encode(packet);
    if (this.channel) {
      this.channel.postMessage(buffer);
    }
  }

  private handleIncomingMessage(event: MessageEvent): void {
    if (!(event.data instanceof ArrayBuffer)) return;

    const packet = SwarmBus.decode(event.data);
    if (!packet) return;

    this.packetsReceived++;
    const now = performance.now();
    const latency = Math.max(0.01, now - packet.timestamp);
    this.lastLatencyMs = latency;

    // Track peer node
    const peerKey = `peer_role_${packet.sourceShardId}`;
    this.peers.set(peerKey, {
      shardId: packet.sourceShardId,
      tabId: peerKey,
      isLeader: packet.sourceShardId === ShardRole.MASTER_HUB,
      lastHeartbeat: Date.now(),
      latencyMs: latency,
      packetsSent: 0,
      packetsReceived: this.packetsReceived,
    });

    // Notify local subscribers
    this.subscribers.forEach((cb) => cb(packet, latency));
  }

  private pruneDeadPeers(): void {
    const now = Date.now();
    for (const [key, peer] of this.peers.entries()) {
      if (now - peer.lastHeartbeat > 5000) {
        this.peers.delete(key);
      }
    }
  }

  public destroy(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    if (this.channel) {
      this.channel.close();
      this.channel = null;
    }
    this.subscribers.clear();
  }
}

export const swarmBus = new SwarmBus();
