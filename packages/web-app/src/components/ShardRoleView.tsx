// Dedicated Shard Role Terminal View for Multi-Tab Distributed Swarm

import React from 'react';
import { ShardRole, SHARD_ROLE_NAMES, type TurnaroundTelemetry } from '../engine/types';
import {
  Crown,
  Droplets,
  Fuel,
  Luggage,
  Sparkles,
  Users,
  AlertCircle,
  Lock,
  Unlock,
  Radio,
} from 'lucide-react';

interface ShardRoleViewProps {
  currentRole: ShardRole;
  onSelectRole: (role: ShardRole) => void;
  telemetry: TurnaroundTelemetry | null;
  onInjectDelay: (nodeId: number, delayMinutes: number) => void;
  onResetDelays: () => void;
}

export const ShardRoleView: React.FC<ShardRoleViewProps> = ({
  currentRole,
  onSelectRole,
  telemetry,
  onInjectDelay,
  onResetDelays,
}) => {
  const getRoleIcon = (role: ShardRole) => {
    switch (role) {
      case ShardRole.MASTER_HUB:
        return <Crown className="w-3.5 h-3.5 text-amber-400" />;
      case ShardRole.FUELING_CREW:
        return <Fuel className="w-3.5 h-3.5 text-pink-400" />;
      case ShardRole.BAGGAGE_HANDLING:
        return <Luggage className="w-3.5 h-3.5 text-amber-400" />;
      case ShardRole.CABIN_SERVICES:
        return <Sparkles className="w-3.5 h-3.5 text-emerald-400" />;
      case ShardRole.GATE_SUPERVISOR:
        return <Users className="w-3.5 h-3.5 text-cyan-400" />;
    }
  };

  const fuelNode = telemetry?.milestones[2];
  const baggageOffloadNode = telemetry?.milestones[1];
  const cabinCleanNode = telemetry?.milestones[4];
  const boardingNode = telemetry?.milestones[8];

  return (
    <div className="hud-panel rounded-lg p-4 flex flex-col gap-4">
      {/* Role Switcher Tab Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#1F293D] pb-3">
        <div className="flex items-center gap-2">
          <Radio className="w-4 h-4 text-cyan-400 animate-pulse" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-200">
            LOCAL NODE ROLE SHARD SELECTOR
          </h3>
        </div>

        {/* Role Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            ShardRole.MASTER_HUB,
            ShardRole.FUELING_CREW,
            ShardRole.BAGGAGE_HANDLING,
            ShardRole.CABIN_SERVICES,
            ShardRole.GATE_SUPERVISOR,
          ].map((role) => {
            const isActive = currentRole === role;
            return (
              <button
                key={role}
                onClick={() => onSelectRole(role)}
                className={`px-2.5 py-1 rounded text-xs font-mono flex items-center gap-1.5 transition-all ${
                  isActive
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400 font-semibold shadow-[0_0_10px_rgba(6,182,212,0.3)]'
                    : 'bg-[#101522] text-slate-400 border border-[#1F293D] hover:bg-[#161C2E] hover:text-slate-200'
                }`}
              >
                {getRoleIcon(role)}
                <span>{SHARD_ROLE_NAMES[role].split(' ')[0]}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Role-Specific Specialized Telemetry Dashboard */}
      {currentRole === ShardRole.FUELING_CREW && (
        <div className="bg-[#101522] border border-pink-500/30 rounded-md p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Fuel className="w-5 h-5 text-pink-400" />
              <div>
                <h4 className="text-xs font-bold text-pink-300 uppercase tracking-wide">
                  FUELING CREW TACTICAL SHARD (WING HYDRANT PIT 4B)
                </h4>
                <div className="text-[11px] text-slate-400">
                  Target Load: 3,850 kg Jet A-1 | Pumping Pressure: 42 PSI
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded text-[10px] font-mono flex items-center gap-1 ${
                fuelNode && fuelNode.delay > 0
                  ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
              }`}>
                {fuelNode && fuelNode.delay > 0 ? <Unlock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                {fuelNode && fuelNode.delay > 0 ? 'SAFETY HOLD ACTIVE' : 'HYDRANT LOCKED'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <div className="bg-[#161C2E] p-2.5 rounded border border-[#1F293D]">
              <span className="text-[10px] font-mono text-slate-400">FUEL FLOW RATE</span>
              <div className="text-base font-mono font-bold text-pink-400 mt-1">
                {fuelNode && fuelNode.delay > 0 ? '0 LPM (JAMMED)' : '850 LPM'}
              </div>
              <span className="text-[9px] text-slate-500">Hydrant Hose Coupler 2</span>
            </div>

            <div className="bg-[#161C2E] p-2.5 rounded border border-[#1F293D]">
              <span className="text-[10px] font-mono text-slate-400">TOTAL SLACK</span>
              <div className={`text-base font-mono font-bold mt-1 ${
                (fuelNode?.totalSlack ?? 10) <= 0 ? 'text-red-400' : 'text-emerald-400'
              }`}>
                {fuelNode?.totalSlack.toFixed(1)}m
              </div>
              <span className="text-[9px] text-slate-500">Network Float Window</span>
            </div>

            <div className="bg-[#161C2E] p-2.5 rounded border border-[#1F293D]">
              <span className="text-[10px] font-mono text-slate-400">DELAY INJECTED</span>
              <div className="text-base font-mono font-bold text-amber-400 mt-1">
                +{fuelNode?.delay.toFixed(0)}m
              </div>
              <span className="text-[9px] text-slate-500">Local Shard Offset</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              onClick={() => onInjectDelay(2, (fuelNode?.delay ?? 0) + 8)}
              className="px-3 py-1.5 rounded bg-pink-950/80 hover:bg-pink-900 border border-pink-700/60 text-xs font-mono text-pink-200 transition-colors"
            >
              +8m Refueling Hose Delay
            </button>
            <button
              onClick={() => onInjectDelay(2, 0)}
              className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-xs font-mono text-slate-300 transition-colors"
            >
              Clear Fuel Delay
            </button>
          </div>
        </div>
      )}

      {currentRole === ShardRole.BAGGAGE_HANDLING && (
        <div className="bg-[#101522] border border-amber-500/30 rounded-md p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Luggage className="w-5 h-5 text-amber-400" />
              <div>
                <h4 className="text-xs font-bold text-amber-300 uppercase tracking-wide">
                  BAGGAGE TUG & CONVEYOR BELT SCANNER SHARD
                </h4>
                <div className="text-[11px] text-slate-400">
                  Cargo Hold 1 (Forward): 48 Bags | Cargo Hold 2 (Aft): 72 Bags
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <div className="bg-[#161C2E] p-2.5 rounded border border-[#1F293D]">
              <span className="text-[10px] font-mono text-slate-400">CONVEYOR VELOCITY</span>
              <div className="text-base font-mono font-bold text-amber-400 mt-1">
                {baggageOffloadNode && baggageOffloadNode.delay > 0 ? '0.2 m/s (DEGRADED)' : '1.4 m/s (NOMINAL)'}
              </div>
              <span className="text-[9px] text-slate-500">Electric Belt Loader #2</span>
            </div>

            <div className="bg-[#161C2E] p-2.5 rounded border border-[#1F293D]">
              <span className="text-[10px] font-mono text-slate-400">OFFLOAD SLACK</span>
              <div className={`text-base font-mono font-bold mt-1 ${
                (baggageOffloadNode?.totalSlack ?? 10) <= 0 ? 'text-red-400' : 'text-emerald-400'
              }`}>
                {baggageOffloadNode?.totalSlack.toFixed(1)}m
              </div>
              <span className="text-[9px] text-slate-500">Predecessor to Loading</span>
            </div>

            <div className="bg-[#161C2E] p-2.5 rounded border border-[#1F293D]">
              <span className="text-[10px] font-mono text-slate-400">OFFLOAD DELAY</span>
              <div className="text-base font-mono font-bold text-amber-400 mt-1">
                +{baggageOffloadNode?.delay.toFixed(0)}m
              </div>
              <span className="text-[9px] text-slate-500">Aft Belly Container Jam</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              onClick={() => onInjectDelay(1, (baggageOffloadNode?.delay ?? 0) + 10)}
              className="px-3 py-1.5 rounded bg-amber-950/80 hover:bg-amber-900 border border-amber-700/60 text-xs font-mono text-amber-200 transition-colors"
            >
              +10m Cargo Belt Jam
            </button>
            <button
              onClick={() => onInjectDelay(1, 0)}
              className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-xs font-mono text-slate-300 transition-colors"
            >
              Clear Baggage Delay
            </button>
          </div>
        </div>
      )}

      {currentRole === ShardRole.CABIN_SERVICES && (
        <div className="bg-[#101522] border border-emerald-500/30 rounded-md p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-emerald-400" />
              <div>
                <h4 className="text-xs font-bold text-emerald-300 uppercase tracking-wide">
                  CABIN SERVICES & GALLEY CLEANING SHARD
                </h4>
                <div className="text-[11px] text-slate-400">
                  Main Pax Cabin: 30 Rows (180 Seats) | 6 Sanitation Crew Squad
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <div className="bg-[#161C2E] p-2.5 rounded border border-[#1F293D]">
              <span className="text-[10px] font-mono text-slate-400">CLEANING VELOCITY</span>
              <div className="text-base font-mono font-bold text-emerald-400 mt-1">
                {cabinCleanNode && cabinCleanNode.delay > 0 ? '0.9 rows/min' : '1.8 rows/min'}
              </div>
              <span className="text-[9px] text-slate-500">Deplaning Interlock</span>
            </div>

            <div className="bg-[#161C2E] p-2.5 rounded border border-[#1F293D]">
              <span className="text-[10px] font-mono text-slate-400">CABIN SLACK</span>
              <div className={`text-base font-mono font-bold mt-1 ${
                (cabinCleanNode?.totalSlack ?? 10) <= 0 ? 'text-red-400' : 'text-emerald-400'
              }`}>
                {cabinCleanNode?.totalSlack.toFixed(1)}m
              </div>
              <span className="text-[9px] text-slate-500">Blocks Pax Boarding</span>
            </div>

            <div className="bg-[#161C2E] p-2.5 rounded border border-[#1F293D]">
              <span className="text-[10px] font-mono text-slate-400">ACTIVE DELAY</span>
              <div className="text-base font-mono font-bold text-amber-400 mt-1">
                +{cabinCleanNode?.delay.toFixed(0)}m
              </div>
              <span className="text-[9px] text-slate-500">Aisle Sanitization Hold</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              onClick={() => onInjectDelay(4, (cabinCleanNode?.delay ?? 0) + 12)}
              className="px-3 py-1.5 rounded bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-700/60 text-xs font-mono text-emerald-200 transition-colors"
            >
              +12m Mid-Cabin Spill Delay
            </button>
            <button
              onClick={() => onInjectDelay(4, 0)}
              className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-xs font-mono text-slate-300 transition-colors"
            >
              Clear Cleaning Delay
            </button>
          </div>
        </div>
      )}

      {currentRole === ShardRole.GATE_SUPERVISOR && (
        <div className="bg-[#101522] border border-cyan-500/30 rounded-md p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-cyan-400" />
              <div>
                <h4 className="text-xs font-bold text-cyan-300 uppercase tracking-wide">
                  GATE 42B BOARDING SUPERVISOR SHARD
                </h4>
                <div className="text-[11px] text-slate-400">
                  168 Booked Passengers | Jetbridge Door 1L + Mobile Stairs Door 2R
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <div className="bg-[#161C2E] p-2.5 rounded border border-[#1F293D]">
              <span className="text-[10px] font-mono text-slate-400">BOARDING PACE</span>
              <div className="text-base font-mono font-bold text-cyan-400 mt-1">
                {boardingNode && boardingNode.delay > 0 ? '7 pax/min (SLOW)' : '14 pax/min (DUAL)'}
              </div>
              <span className="text-[9px] text-slate-500">Biometric E-Gates</span>
            </div>

            <div className="bg-[#161C2E] p-2.5 rounded border border-[#1F293D]">
              <span className="text-[10px] font-mono text-slate-400">BOARDING SLACK</span>
              <div className={`text-base font-mono font-bold mt-1 ${
                (boardingNode?.totalSlack ?? 10) <= 0 ? 'text-red-400' : 'text-emerald-400'
              }`}>
                {boardingNode?.totalSlack.toFixed(1)}m
              </div>
              <span className="text-[9px] text-slate-500">Directly Precedes Pushback</span>
            </div>

            <div className="bg-[#161C2E] p-2.5 rounded border border-[#1F293D]">
              <span className="text-[10px] font-mono text-slate-400">BOARDING DELAY</span>
              <div className="text-base font-mono font-bold text-amber-400 mt-1">
                +{boardingNode?.delay.toFixed(0)}m
              </div>
              <span className="text-[9px] text-slate-500">Gate Reader Desync</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              onClick={() => onInjectDelay(8, (boardingNode?.delay ?? 0) + 14)}
              className="px-3 py-1.5 rounded bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-700/60 text-xs font-mono text-cyan-200 transition-colors"
            >
              +14m Gate Boarding Jam
            </button>
            <button
              onClick={() => onInjectDelay(8, 0)}
              className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-xs font-mono text-slate-300 transition-colors"
            >
              Clear Boarding Delay
            </button>
          </div>
        </div>
      )}

      {currentRole === ShardRole.MASTER_HUB && (
        <div className="bg-[#101522] border border-amber-500/30 rounded-md p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Crown className="w-5 h-5 text-amber-400 flex-shrink-0" />
            <div>
              <h4 className="text-xs font-bold text-amber-300 uppercase tracking-wide">
                RAMP MASTER HUB COORDINATOR (AIRSIDE SWARM SYNCHRONIZER)
              </h4>
              <div className="text-[11px] text-slate-400">
                Operating global Web Locks leader election and 28-byte binary mesh broadcast.
              </div>
            </div>
          </div>

          <button
            onClick={onResetDelays}
            className="px-3 py-1.5 rounded bg-[#1F293D] hover:bg-red-950 hover:text-red-300 border border-[#26334C] text-xs font-mono text-slate-200 transition-colors flex-shrink-0"
          >
            Reset All Turnaround Delays
          </button>
        </div>
      )}
    </div>
  );
};
