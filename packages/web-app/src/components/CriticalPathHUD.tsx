// Dynamic DAG Gantt Chart, CPM Float Slack HUD & Bottleneck Alert Center

import React from 'react';
import type { TurnaroundTelemetry } from '../engine/types';
import { AlertTriangle, Clock, ShieldCheck, Zap } from 'lucide-react';

interface CriticalPathHUDProps {
  telemetry: TurnaroundTelemetry | null;
  selectedNodeId: number | null;
  onSelectNode: (nodeId: number) => void;
}

export const CriticalPathHUD: React.FC<CriticalPathHUDProps> = ({
  telemetry,
  selectedNodeId,
  onSelectNode,
}) => {
  if (!telemetry) {
    return (
      <div className="hud-panel rounded-lg p-6 flex items-center justify-center text-slate-500 font-mono text-xs">
        INITIALIZING WASM CPM DAG ENGINE...
      </div>
    );
  }

  const { milestones, projectDuration, targetDuration, scheduleDeviation, bottleneckNodeId, action } = telemetry;
  const maxTime = Math.max(projectDuration + 5, 55);

  return (
    <div className="hud-panel rounded-lg p-4 flex flex-col gap-4">
      {/* HUD Header & Metrics */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1F293D] pb-3">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-cyan-400" />
          <h2 className="text-sm font-semibold tracking-wide text-slate-200">
            CRITICAL PATH CPM GANTT (45-MIN TURNAROUND)
          </h2>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">PROJECTED TURN:</span>
            <span className={`font-bold ${scheduleDeviation > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
              {projectDuration.toFixed(1)}m
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">TARGET:</span>
            <span className="text-cyan-400">{targetDuration.toFixed(0)}m</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">DEVIATION:</span>
            <span className={`font-bold px-2 py-0.5 rounded text-[11px] ${
              scheduleDeviation > 0
                ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
            }`}>
              {scheduleDeviation > 0 ? `+${scheduleDeviation.toFixed(1)}m` : `${scheduleDeviation.toFixed(1)}m`}
            </span>
          </div>
        </div>
      </div>

      {/* Bottleneck Alert & Recommended Action Callout */}
      {scheduleDeviation > 0 ? (
        <div className="bg-red-950/40 border border-red-500/40 rounded-md p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5 animate-pulse" />
            <div>
              <div className="text-xs font-semibold text-red-200 flex items-center gap-2">
                <span>BOTTLENECK DETECTED: {milestones[bottleneckNodeId]?.name.toUpperCase()}</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-red-900/60 text-red-300">
                  SLACK EXHAUSTED
                </span>
              </div>
              <div className="text-[11px] text-slate-300 mt-0.5">
                Deterministic MDP Tactical Policy: <span className="text-cyan-300 font-semibold">{action.title}</span>
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5 italic">
                {action.protocol}
              </div>
            </div>
          </div>

          <div className="flex sm:flex-col items-center sm:items-end justify-between gap-1 flex-shrink-0 pl-7 sm:pl-0">
            <div className="text-[11px] font-mono text-emerald-400 font-semibold flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              Recovers ~{action.expectedRecovery.toFixed(1)}m
            </div>
            <div className="text-[10px] font-mono text-cyan-400 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              Safety Index: {(action.safetyScore * 100).toFixed(0)}%
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-md p-2.5 flex items-center gap-2.5 text-xs text-emerald-300">
          <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span>Turnaround schedule within safe float envelope. All 12 services synchronized.</span>
        </div>
      )}

      {/* Gantt Timeline View */}
      <div className="flex flex-col gap-1.5 overflow-x-auto select-none">
        {/* Time Axis Header */}
        <div className="flex items-center text-[10px] font-mono text-slate-500 pb-1 border-b border-[#1F293D]/60 pl-36">
          <div className="relative w-full h-4">
            {[0, 10, 20, 30, 40, 45, 50, 60].map((t) => {
              if (t > maxTime) return null;
              const leftPct = (t / maxTime) * 100;
              return (
                <div
                  key={t}
                  className="absolute -translate-x-1/2 flex flex-col items-center"
                  style={{ left: `${leftPct}%` }}
                >
                  <span className={t === 45 ? 'text-cyan-400 font-bold' : ''}>{t}m</span>
                  <div className={`w-px h-1.5 ${t === 45 ? 'bg-cyan-500' : 'bg-slate-700'}`} />
                </div>
              );
            })}
          </div>
        </div>

        {/* Milestone Rows */}
        {milestones.map((m) => {
          const isSelected = selectedNodeId === m.id;
          const leftPct = (m.earlyStart / maxTime) * 100;
          const duration = m.earlyFinish - m.earlyStart;
          const widthPct = Math.max(2, (duration / maxTime) * 100);
          const slackPct = Math.max(0, (m.totalSlack / maxTime) * 100);

          let barColor = 'bg-cyan-600 border-cyan-400';
          let textColor = 'text-cyan-200';
          if (m.isCritical) {
            barColor = 'bg-red-600/90 border-red-400 shadow-[0_0_12px_rgba(239,68,68,0.5)]';
            textColor = 'text-red-200';
          } else if (m.totalSlack <= 5) {
            barColor = 'bg-amber-600 border-amber-400';
            textColor = 'text-amber-200';
          } else {
            barColor = 'bg-emerald-600 border-emerald-400';
            textColor = 'text-emerald-200';
          }

          return (
            <div
              key={m.id}
              onClick={() => onSelectNode(m.id)}
              className={`flex items-center gap-2 px-2 py-1 rounded cursor-pointer transition-colors ${
                isSelected
                  ? 'bg-cyan-950/40 border border-cyan-500/50'
                  : 'hover:bg-[#161C2E] border border-transparent'
              }`}
            >
              {/* Row Label */}
              <div className="w-32 flex-shrink-0 flex items-center justify-between text-[11px] font-mono">
                <span className={`truncate ${m.isCritical ? 'font-bold text-red-300' : 'text-slate-300'}`}>
                  {m.name}
                </span>
                {m.delay > 0 && (
                  <span className="text-[9px] px-1 rounded bg-red-950 border border-red-800 text-red-400 font-bold ml-1">
                    +{m.delay.toFixed(0)}m
                  </span>
                )}
              </div>

              {/* Gantt Bar Area */}
              <div className="relative flex-grow h-6 bg-[#0A0D14]/70 rounded overflow-hidden border border-[#1F293D]/50">
                {/* 45-min Target Deadline Marker Line */}
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-cyan-500/70 z-10 pointer-events-none"
                  style={{ left: `${(targetDuration / maxTime) * 100}%` }}
                />

                {/* Milestone Active Duration Bar */}
                <div
                  className={`absolute top-1 bottom-1 rounded border flex items-center px-1.5 text-[9px] font-mono font-semibold transition-all ${barColor} ${textColor}`}
                  style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                  title={`${m.name}: ${m.earlyStart.toFixed(1)}m -> ${m.earlyFinish.toFixed(1)}m (Slack: ${m.totalSlack.toFixed(1)}m)`}
                >
                  <span className="truncate">{duration.toFixed(0)}m</span>
                </div>

                {/* Slack Float Buffer Bar (if positive) */}
                {m.totalSlack > 0.05 && (
                  <div
                    className="absolute top-2 bottom-2 bg-slate-700/30 border-r border-t border-b border-dashed border-slate-500/40 rounded-r"
                    style={{ left: `${leftPct + widthPct}%`, width: `${slackPct}%` }}
                    title={`Float Slack: ${m.totalSlack.toFixed(1)}m`}
                  />
                )}
              </div>

              {/* Float Slack Value HUD */}
              <div className="w-14 text-right flex-shrink-0 text-[10px] font-mono">
                <span className={m.isCritical ? 'text-red-400 font-bold' : m.totalSlack <= 5 ? 'text-amber-400' : 'text-emerald-400'}>
                  TS: {m.totalSlack.toFixed(0)}m
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
