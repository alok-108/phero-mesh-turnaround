// 60 FPS Deterministic HTML5 Canvas Apron Simulation with Stigmergy Heat Trails

import React, { useRef, useEffect, useState, useCallback } from 'react';
import type { TurnaroundTelemetry } from '../engine/types';
import { A320_DAG_NODES } from '../simulation/aircraft-dag';
import { GateSimulation } from '../simulation/airport-gate';

interface TarmacCanvasProps {
  telemetry: TurnaroundTelemetry | null;
  selectedNodeId: number | null;
  onSelectNode: (nodeId: number) => void;
}

export const TarmacCanvas: React.FC<TarmacCanvasProps> = ({
  telemetry,
  selectedNodeId,
  onSelectNode,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gateSimRef = useRef<GateSimulation>(new GateSimulation());
  const [fps, setFps] = useState<number>(60);
  const frameCountRef = useRef(0);
  const lastFpsTimeRef = useRef(performance.now());
  const lastTimeRef = useRef(performance.now());

  // Setup vehicle anchors
  useEffect(() => {
    const anchors = new Map<number, { x: number; y: number }>();
    A320_DAG_NODES.forEach((node) => {
      anchors.set(node.id, node.anchor);
    });
    gateSimRef.current.setAnchorTargets(anchors);
  }, []);

  const handleCanvasClick = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const clickY = event.clientY - rect.top;

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    // Check hit test on the 12 milestone anchors
    let clickedId: number | null = null;
    let minDistance = 28; // hit radius

    A320_DAG_NODES.forEach((node) => {
      const sx = centerX + node.anchor.x;
      const sy = centerY + node.anchor.y;
      const dist = Math.hypot(clickX - sx, clickY - sy);
      if (dist < minDistance) {
        minDistance = dist;
        clickedId = node.id;
      }
    });

    if (clickedId !== null) {
      onSelectNode(clickedId);
    }
  }, [onSelectNode]);

  // Main 60 FPS Render Loop
  useEffect(() => {
    let animationFrameId: number;

    const render = (currentTime: number) => {
      const dt = Math.min(0.05, (currentTime - lastTimeRef.current) / 1000);
      lastTimeRef.current = currentTime;

      // Calculate FPS
      frameCountRef.current++;
      if (currentTime - lastFpsTimeRef.current >= 1000) {
        setFps(Math.round((frameCountRef.current * 1000) / (currentTime - lastFpsTimeRef.current)));
        frameCountRef.current = 0;
        lastFpsTimeRef.current = currentTime;
      }

      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const width = canvas.width;
      const height = canvas.height;
      const centerX = width / 2;
      const centerY = height / 2;

      // Extract current CPM metrics
      const delays: number[] = new Array(12).fill(0);
      const criticalSet = new Set<number>();
      const slackMap = new Map<number, number>();

      if (telemetry) {
        telemetry.milestones.forEach((m) => {
          delays[m.id] = m.delay;
          slackMap.set(m.id, m.totalSlack);
          if (m.isCritical) criticalSet.add(m.id);
        });
      }

      // Update vehicle physics simulation
      gateSimRef.current.update(dt, delays, criticalSet);

      // --- 1. Background Apron Clearing & Grid ---
      ctx.fillStyle = '#0A0D14';
      ctx.fillRect(0, 0, width, height);

      // Apron grid lines
      ctx.strokeStyle = 'rgba(31, 41, 61, 0.4)';
      ctx.lineWidth = 1;
      const gridSize = 40;
      for (let x = 0; x < width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // --- 2. Gate 42B Lead-in Guideline & Markings ---
      ctx.save();
      ctx.translate(centerX, centerY);

      // Yellow centerline guideline
      ctx.strokeStyle = '#F59E0B';
      ctx.lineWidth = 3;
      ctx.setLineDash([12, 8]);
      ctx.beginPath();
      ctx.moveTo(0, -280);
      ctx.lineTo(0, 240);
      ctx.stroke();
      ctx.setLineDash([]);

      // Stop Bar (A320 nose gear mark)
      ctx.strokeStyle = '#EF4444';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(-35, -160);
      ctx.lineTo(35, -160);
      ctx.stroke();

      ctx.fillStyle = '#EF4444';
      ctx.font = 'bold 10px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('STOP A320', 0, -170);

      // Equipment Restraint Area (ERA) Box (Red & White Dashed)
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.6)';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 8]);
      ctx.strokeRect(-180, -220, 360, 440);
      ctx.setLineDash([]);

      // Fuel Safety Exclusion Zone (radius around starboard wing box)
      const fuelActive = delays[2] > 0 || (telemetry?.milestones[2]?.isCritical ?? false);
      ctx.strokeStyle = fuelActive ? 'rgba(239, 68, 68, 0.8)' : 'rgba(245, 158, 11, 0.35)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.arc(110, 15, 65, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      
      ctx.fillStyle = fuelActive ? '#EF4444' : '#F59E0B';
      ctx.font = '9px "JetBrains Mono", monospace';
      ctx.fillText('FUEL SAFETY ZONE 3M', 110, 92);

      // --- 3. Stigmergic Pheromone Diffusion Matrix Trails ---
      if (telemetry && telemetry.pheromoneMatrix) {
        const pMatrix = telemetry.pheromoneMatrix;
        for (let u = 0; u < 12; u++) {
          for (let v = 0; v < 12; v++) {
            const tau = pMatrix[u * 12 + v];
            if (tau > 0.05) {
              const fromNode = A320_DAG_NODES[u];
              const toNode = A320_DAG_NODES[v];

              const intensity = Math.min(1.0, tau / 8.0);
              const alpha = Math.min(0.9, 0.2 + intensity * 0.7);

              // Stigmergic bezier trail
              const isBottleneckEdge = criticalSet.has(u) && criticalSet.has(v);
              const strokeColor = isBottleneckEdge
                ? `rgba(239, 68, 68, ${alpha})`
                : `rgba(245, 158, 11, ${alpha})`;

              ctx.strokeStyle = strokeColor;
              ctx.lineWidth = 2 + intensity * 3;
              ctx.shadowColor = strokeColor;
              ctx.shadowBlur = 10 * intensity;

              ctx.beginPath();
              ctx.moveTo(fromNode.anchor.x, fromNode.anchor.y);
              // Slight curved arc
              const mx = (fromNode.anchor.x + toNode.anchor.x) / 2 + 15;
              const my = (fromNode.anchor.y + toNode.anchor.y) / 2 - 15;
              ctx.quadraticCurveTo(mx, my, toNode.anchor.x, toNode.anchor.y);
              ctx.stroke();

              ctx.shadowBlur = 0; // reset glow
            }
          }
        }
      }

      // --- 4. Airbus A320 Geometric Technical Outline ---
      ctx.save();
      // Aircraft body colors
      ctx.fillStyle = '#161C2E';
      ctx.strokeStyle = '#06B6D4';
      ctx.lineWidth = 1.8;

      // Fuselage (Cylindrical streamline)
      ctx.beginPath();
      // Nose cone
      ctx.moveTo(0, -180);
      // Starboard side
      ctx.bezierCurveTo(22, -140, 22, 100, 18, 140);
      // Tail cone
      ctx.lineTo(0, 180);
      // Port side
      ctx.lineTo(-18, 140);
      ctx.bezierCurveTo(-22, 100, -22, -140, 0, -180);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Wings (Swept back with wingtip Sharklets)
      ctx.fillStyle = '#1A233A';
      // Starboard Wing (Right)
      ctx.beginPath();
      ctx.moveTo(18, -40);
      ctx.lineTo(165, 45); // Wingtip
      ctx.lineTo(168, 38); // Sharklet
      ctx.lineTo(160, 52);
      ctx.lineTo(20, 65);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Port Wing (Left)
      ctx.beginPath();
      ctx.moveTo(-18, -40);
      ctx.lineTo(-165, 45); // Wingtip
      ctx.lineTo(-168, 38); // Sharklet
      ctx.lineTo(-160, 52);
      ctx.lineTo(-20, 65);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // CFM LEAP-1A Engines
      ctx.fillStyle = '#26334C';
      // Starboard Engine
      ctx.beginPath();
      ctx.ellipse(75, 10, 12, 24, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Port Engine
      ctx.beginPath();
      ctx.ellipse(-75, 10, 12, 24, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Horizontal Stabilizers (Tailplanes)
      ctx.beginPath();
      ctx.moveTo(14, 135);
      ctx.lineTo(65, 165);
      ctx.lineTo(62, 175);
      ctx.lineTo(8, 168);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(-14, 135);
      ctx.lineTo(-65, 165);
      ctx.lineTo(-62, 175);
      ctx.lineTo(-8, 168);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Cockpit Windshield (Aviation Cyan)
      ctx.fillStyle = '#06B6D4';
      ctx.beginPath();
      ctx.moveTo(0, -165);
      ctx.lineTo(10, -150);
      ctx.lineTo(-10, -150);
      ctx.closePath();
      ctx.fill();

      // Jetbridge representation connected to Door 1L
      ctx.strokeStyle = '#64748B';
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.moveTo(-220, -90);
      ctx.lineTo(-24, -90);
      ctx.stroke();

      // Jetbridge accordion cab
      ctx.fillStyle = '#0EA5E9';
      ctx.fillRect(-34, -96, 12, 12);

      // Passenger flow dots inside jetbridge
      const pFlowPhase = (currentTime * 0.003) % 1;
      for (let p = 0; p < 5; p++) {
        const px = -210 + ((pFlowPhase + p / 5) % 1) * 180;
        ctx.fillStyle = '#38BDF8';
        ctx.beginPath();
        ctx.arc(px, -90, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore(); // restore aircraft translation

      // --- 5. Render Ground Support Vehicles & Milestones ---
      A320_DAG_NODES.forEach((node) => {
        const v = gateSimRef.current.vehicles.get(node.id);
        const posX = v ? v.currentX : node.anchor.x;
        const posY = v ? v.currentY : node.anchor.y;

        const slack = slackMap.get(node.id) ?? 10.0;
        const delay = delays[node.id];
        const isCritical = criticalSet.has(node.id);
        const isSelected = selectedNodeId === node.id;

        // Color coding by Slack:
        // Green: On schedule (TS > 5m)
        // Yellow: Buffer eroded (0 < TS <= 5m)
        // Pulsing Red: Critical Path Blocker (TS <= 0)
        let haloColor = '#10B981'; // Green
        let pulseRate = 1.0;

        if (isCritical || slack <= 0.01) {
          haloColor = '#EF4444'; // Pulsing Crimson
          pulseRate = 4.0;
        } else if (slack <= 5.0) {
          haloColor = '#F59E0B'; // Neon Amber
          pulseRate = 2.0;
        }

        const pulse = 0.5 + 0.5 * Math.sin((currentTime * 0.005 * pulseRate) + (v?.pulsePhase ?? 0));

        // Connect hose / belt from vehicle to aircraft anchor
        if (node.id === 2) {
          // Fuel Hose to wing
          ctx.strokeStyle = haloColor;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(posX, posY);
          ctx.lineTo(node.anchor.x, node.anchor.y);
          ctx.stroke();
        } else if (node.id === 1 || node.id === 7) {
          // Baggage conveyor belt
          ctx.strokeStyle = '#F59E0B';
          ctx.lineWidth = 3;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.moveTo(posX, posY);
          ctx.lineTo(node.anchor.x, node.anchor.y);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        // Draw glowing vehicle halo
        ctx.shadowColor = haloColor;
        ctx.shadowBlur = (isCritical ? 16 : 8) * pulse;

        // Base vehicle box
        ctx.fillStyle = '#101522';
        ctx.strokeStyle = isSelected ? '#FFFFFF' : haloColor;
        ctx.lineWidth = isSelected ? 2.5 : 1.5;

        const boxSize = 24;
        ctx.fillRect(posX - boxSize / 2, posY - boxSize / 2, boxSize, boxSize);
        ctx.strokeRect(posX - boxSize / 2, posY - boxSize / 2, boxSize, boxSize);

        ctx.shadowBlur = 0; // Reset shadow

        // Inner service indicator dot
        ctx.fillStyle = haloColor;
        ctx.beginPath();
        ctx.arc(posX, posY, 4, 0, Math.PI * 2);
        ctx.fill();

        // Label: Milestone Code + Slack/Delay HUD badge
        ctx.font = 'bold 9px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(node.code, posX, posY - 16);

        // Slack / Delay badge text
        const badgeText = delay > 0 ? `+${delay.toFixed(0)}m` : `TS:${slack.toFixed(0)}m`;
        ctx.fillStyle = haloColor;
        ctx.font = '8px "JetBrains Mono", monospace';
        ctx.fillText(badgeText, posX, posY + 22);
      });

      ctx.restore(); // end gate translation

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [telemetry, selectedNodeId]);

  return (
    <div className="relative w-full h-full bg-[#0A0D14] rounded-lg overflow-hidden border border-[#1F293D] flex flex-col">
      {/* Canvas Top Bar HUD */}
      <div className="absolute top-3 left-3 right-3 z-10 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-3">
          <div className="px-2.5 py-1 rounded bg-[#101522]/90 border border-[#1F293D] backdrop-blur-md flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <span className="text-xs font-mono text-cyan-400 font-semibold tracking-wider">GATE 42B APRON HUD</span>
          </div>
          <div className="px-2 py-0.5 rounded bg-[#101522]/80 border border-[#1F293D] text-[11px] font-mono text-slate-400">
            AIRCRAFT: AIRBUS A320-271N
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="px-2 py-0.5 rounded bg-[#101522]/80 border border-[#1F293D] text-[11px] font-mono text-emerald-400 flex items-center gap-1.5">
            <span className="text-slate-400">FPS:</span>
            <span className="font-bold">{fps}</span>
          </div>
          <div className="px-2 py-0.5 rounded bg-[#101522]/80 border border-[#1F293D] text-[11px] font-mono text-cyan-400">
            MATH: RUST WASM (ZERO-COPY)
          </div>
        </div>
      </div>

      {/* Main Canvas Element */}
      <canvas
        ref={canvasRef}
        width={720}
        height={600}
        onClick={handleCanvasClick}
        className="w-full h-full cursor-crosshair object-contain"
        title="Click on any service team to inspect telemetry"
      />

      {/* Slack Legend HUD */}
      <div className="absolute bottom-3 left-3 z-10 flex items-center gap-2 pointer-events-none">
        <div className="px-3 py-1.5 rounded bg-[#101522]/90 border border-[#1F293D] backdrop-blur-md flex items-center gap-4 text-[10px] font-mono">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded bg-emerald-500" />
            <span className="text-slate-300">Slack &gt; 5m</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded bg-amber-500" />
            <span className="text-slate-300">0 &lt; Slack &le; 5m</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded bg-red-500 animate-pulse" />
            <span className="text-red-300 font-semibold">Critical (Slack &le; 0)</span>
          </div>
          <div className="flex items-center gap-1.5 border-l border-[#1F293D] pl-3">
            <span className="w-3 h-0.5 bg-amber-400 shadow-[0_0_8px_#f59e0b]" />
            <span className="text-amber-300">Pheromone Trail</span>
          </div>
        </div>
      </div>
    </div>
  );
};
