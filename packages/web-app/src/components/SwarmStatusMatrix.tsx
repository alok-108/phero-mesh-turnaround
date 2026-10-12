// Swarm P2P Mesh Status Matrix, Web Locks Leader Election & Binary Packet Telemetry

import React from 'react';
import { ShardRole, SHARD_ROLE_NAMES } from '../engine/types';
import { Activity, Cpu, Crown, ExternalLink, Network, Radio, Wifi } from 'lucide-react';

interface SwarmStatusMatrixProps {
  currentRole: ShardRole;
  isLeader: boolean;
  busMetrics: {
    packetsSent: number;
    packetsReceived: number;
    lastLatencyMs: number;
    peerCount: number;
  };
  computeTimeMs: number;
  onLaunchNewTab: (role: ShardRole) => void;
}

export const SwarmStatusMatrix: React.FC<SwarmStatusMatrixProps> = ({
  currentRole,
  isLeader,
  busMetrics,
  computeTimeMs,
  onLaunchNewTab,
}) => {
  return (
    <div className="hud-panel rounded-lg p-4 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#1F293D] pb-3">
        <div className="flex items-center gap-2">
          <Network className="w-4 h-4 text-cyan-400" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-200">
            SWARM P2P MESH MATRIX (28-BYTE BINARY)
          </h3>
        </div>

        <div className="flex items-center gap-2">
          {isLeader ? (
            <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-mono font-bold flex items-center gap-1.5">
              <Crown className="w-3 h-3 text-amber-400" />
              WEB LOCKS MASTER
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-[10px] font-mono font-semibold flex items-center gap-1.5">
              <Radio className="w-3 h-3 text-cyan-400" />
              OPERATIONAL SHARD
            </span>
          )}
        </div>
      </div>

      {/* Grid Telemetry Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Bus Latency */}
        <div className="bg-[#101522] border border-[#1F293D] rounded-md p-2.5 flex flex-col">
          <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
            <Activity className="w-3 h-3 text-cyan-400" />
            BUS LATENCY
          </span>
          <span className="text-base font-bold font-mono text-cyan-300 mt-1">
            {busMetrics.lastLatencyMs < 1 ? `< 0.9 ms` : `${busMetrics.lastLatencyMs.toFixed(2)} ms`}
          </span>
          <span className="text-[9px] text-slate-500 mt-0.5">BroadcastChannel 28B</span>
        </div>

        {/* WASM Convergence */}
        <div className="bg-[#101522] border border-[#1F293D] rounded-md p-2.5 flex flex-col">
          <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
            <Cpu className="w-3 h-3 text-emerald-400" />
            WASM COMPUTE
          </span>
          <span className="text-base font-bold font-mono text-emerald-300 mt-1">
            {computeTimeMs.toFixed(2)} ms
          </span>
          <span className="text-[9px] text-slate-500 mt-0.5">Sub-4ms Zero-Copy</span>
        </div>

        {/* Binary Packets Sent / Received */}
        <div className="bg-[#101522] border border-[#1F293D] rounded-md p-2.5 flex flex-col">
          <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
            <Radio className="w-3 h-3 text-amber-400" />
            PACKETS I/O
          </span>
          <span className="text-base font-bold font-mono text-amber-300 mt-1">
            {busMetrics.packetsSent} / {busMetrics.packetsReceived}
          </span>
          <span className="text-[9px] text-slate-500 mt-0.5">Zero JSON Serialization</span>
        </div>

        {/* Active Nodes / Tabs */}
        <div className="bg-[#101522] border border-[#1F293D] rounded-md p-2.5 flex flex-col">
          <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
            <Wifi className="w-3 h-3 text-cyan-400" />
            ACTIVE NODES
          </span>
          <span className="text-base font-bold font-mono text-slate-100 mt-1">
            {busMetrics.peerCount} {busMetrics.peerCount === 1 ? 'Tab' : 'Tabs'}
          </span>
          <span className="text-[9px] text-slate-500 mt-0.5">Mesh Peer Discovery</span>
        </div>
      </div>

      {/* Multi-Window Test Launcher */}
      <div className="bg-[#161C2E] border border-[#1F293D] rounded-md p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold text-slate-200">
            Multi-Window Swarm Simulation Mode
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            Open dedicated role shards in separate browser windows to test instant &lt;4ms inter-tab coordination:
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => onLaunchNewTab(ShardRole.FUELING_CREW)}
            className="px-2.5 py-1 rounded bg-[#1F293D] hover:bg-[#26334C] text-xs font-mono text-cyan-300 flex items-center gap-1.5 transition-colors"
            title="Open Fueling Crew Shard in new tab"
          >
            <ExternalLink className="w-3 h-3" />
            Fuel Shard
          </button>
          <button
            onClick={() => onLaunchNewTab(ShardRole.BAGGAGE_HANDLING)}
            className="px-2.5 py-1 rounded bg-[#1F293D] hover:bg-[#26334C] text-xs font-mono text-amber-300 flex items-center gap-1.5 transition-colors"
            title="Open Baggage Tug Scanner in new tab"
          >
            <ExternalLink className="w-3 h-3" />
            Baggage Shard
          </button>
          <button
            onClick={() => onLaunchNewTab(ShardRole.CABIN_SERVICES)}
            className="px-2.5 py-1 rounded bg-[#1F293D] hover:bg-[#26334C] text-xs font-mono text-emerald-300 flex items-center gap-1.5 transition-colors"
            title="Open Cabin Services Shard in new tab"
          >
            <ExternalLink className="w-3 h-3" />
            Clean Shard
          </button>
        </div>
      </div>
    </div>
  );
};
