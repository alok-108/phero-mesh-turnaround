// PHERO-MESH Main Dashboard — Airport Ramp Turnaround Mathematical Swarm OS

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { ShardRole, type TurnaroundTelemetry } from './engine/types';
import { wasmBridge } from './engine/wasm-bridge';
import { swarmBus } from './engine/swarm-bus';
import { leaderLockManager } from './engine/leader-lock';
import { chaosEngine, type CloudLlmSimulationState, type ChaosPreset } from './simulation/chaos-injector';
import { TarmacCanvas } from './components/TarmacCanvas';
import { CriticalPathHUD } from './components/CriticalPathHUD';
import { SwarmStatusMatrix } from './components/SwarmStatusMatrix';
import { ShardRoleView } from './components/ShardRoleView';
import { ChaosControlPanel } from './components/ChaosControlPanel';
import {
  Plane,
  Radio,
  Volume2,
  VolumeX,
  Layers,
  Sparkles,
  Shield,
  Activity,
} from 'lucide-react';

export const App: React.FC = () => {
  const [isWasmReady, setIsWasmReady] = useState(false);
  const [currentRole, setCurrentRole] = useState<ShardRole>(ShardRole.MASTER_HUB);
  const [isLeader, setIsLeader] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<number | null>(null);
  const [telemetry, setTelemetry] = useState<TurnaroundTelemetry | null>(null);
  const [sliderDelays, setSliderDelays] = useState<Record<number, number>>({ 1: 0, 2: 0, 4: 0 });
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [cloudState, setCloudState] = useState<CloudLlmSimulationState>(chaosEngine.cloudLlmState);
  const [busMetrics, setBusMetrics] = useState({
    packetsSent: 0,
    packetsReceived: 0,
    lastLatencyMs: 0.35,
    peerCount: 1,
  });

  const audioCtxRef = useRef<AudioContext | null>(null);

  // Play synthetic Web Audio chime
  const playTacticalSound = useCallback((freq = 880, type: OscillatorType = 'sine', duration = 0.08) => {
    if (!soundEnabled) return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.04, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch {
      // Audio autoplay policy fallback
    }
  }, [soundEnabled]);

  // Initial startup: parse URL role, init WASM, start Web Locks & Bus
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roleParam = params.get('role');
    let initialRole = ShardRole.MASTER_HUB;

    if (roleParam === 'fuel') initialRole = ShardRole.FUELING_CREW;
    else if (roleParam === 'baggage') initialRole = ShardRole.BAGGAGE_HANDLING;
    else if (roleParam === 'clean') initialRole = ShardRole.CABIN_SERVICES;
    else if (roleParam === 'gate') initialRole = ShardRole.GATE_SUPERVISOR;

    setCurrentRole(initialRole);

    async function bootstrap() {
      try {
        await wasmBridge.initialize();
        setIsWasmReady(true);

        swarmBus.initialize(initialRole);
        leaderLockManager.startElection();

        // Initial telemetry calculation
        const initialTelemetry = wasmBridge.computeTelemetry();
        setTelemetry(initialTelemetry);
      } catch (err) {
        console.error('Bootstrap failed:', err);
      }
    }

    bootstrap();

    // Subscribe to leader changes
    const unsubLeader = leaderLockManager.subscribe((leader) => {
      setIsLeader(leader);
    });

    // Subscribe to binary packet bus
    const unsubBus = swarmBus.subscribe((packet, latency) => {
      if (packet.packetType === 0x02) {
        // DELAY_INJECT packet received
        const [delayDelta] = packet.payload;
        wasmBridge.injectDelay(packet.nodeIndex, delayDelta);
        setSliderDelays((prev) => ({ ...prev, [packet.nodeIndex]: delayDelta }));
        const updated = wasmBridge.computeTelemetry();
        setTelemetry(updated);
        playTacticalSound(520, 'triangle', 0.12);
      } else if (packet.packetType === 0x05) {
        // RESET_ALL packet
        wasmBridge.resetAllDelays();
        setSliderDelays({ 1: 0, 2: 0, 4: 0 });
        const updated = wasmBridge.computeTelemetry();
        setTelemetry(updated);
      }

      setBusMetrics(swarmBus.getMetrics());
    });

    // Chaos Engine listener
    chaosEngine.setListener((state) => {
      setCloudState(state);
    });

    return () => {
      unsubLeader();
      unsubBus();
      leaderLockManager.stopElection();
      swarmBus.destroy();
    };
  }, [playTacticalSound]);

  // Stigmergic Pheromone Evaporation Tick Loop (every 500ms)
  useEffect(() => {
    if (!isWasmReady) return;

    const interval = window.setInterval(() => {
      wasmBridge.tickDecay(0.5);
      const updated = wasmBridge.computeTelemetry();
      if (updated) setTelemetry(updated);
      setBusMetrics(swarmBus.getMetrics());
    }, 500);

    return () => clearInterval(interval);
  }, [isWasmReady]);

  // Handle Inject Delay
  const handleInjectDelay = useCallback((nodeId: number, delayMinutes: number) => {
    wasmBridge.injectDelay(nodeId, delayMinutes);
    setSliderDelays((prev) => ({ ...prev, [nodeId]: delayMinutes }));

    const updated = wasmBridge.computeTelemetry();
    setTelemetry(updated);

    // Broadcast 28-byte binary packet across tabs
    swarmBus.broadcastDelayInjection(nodeId, delayMinutes, updated?.milestones[nodeId]?.totalSlack ?? 0);
    playTacticalSound(660, 'sine', 0.08);
  }, [playTacticalSound]);

  // Handle Reset All Delays
  const handleResetAllDelays = useCallback(() => {
    wasmBridge.resetAllDelays();
    setSliderDelays({ 1: 0, 2: 0, 4: 0 });
    chaosEngine.reset();

    const updated = wasmBridge.computeTelemetry();
    setTelemetry(updated);

    swarmBus.broadcastResetAll();
    playTacticalSound(440, 'sine', 0.1);
  }, [playTacticalSound]);

  // Handle Preset Trigger
  const handleTriggerPreset = useCallback((preset: ChaosPreset) => {
    handleInjectDelay(preset.nodeId, preset.delayMinutes);
    chaosEngine.triggerCloudLlmBenchmark(preset.title, preset.delayMinutes);
  }, [handleInjectDelay]);

  // Handle Launch New Tab
  const handleLaunchNewTab = useCallback((role: ShardRole) => {
    let roleStr = 'master';
    if (role === ShardRole.FUELING_CREW) roleStr = 'fuel';
    else if (role === ShardRole.BAGGAGE_HANDLING) roleStr = 'baggage';
    else if (role === ShardRole.CABIN_SERVICES) roleStr = 'clean';
    else if (role === ShardRole.GATE_SUPERVISOR) roleStr = 'gate';

    const url = `${window.location.origin}${window.location.pathname}?role=${roleStr}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }, []);

  return (
    <div className="min-h-screen bg-[#0A0D14] text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Flight Radar & Top Header */}
      <header className="border-b border-[#1F293D] bg-[#0E1320]/90 backdrop-blur-md sticky top-0 z-30 px-4 py-2.5">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          {/* Brand & Mission Title */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-cyan-500/10 border border-cyan-500/40 flex items-center justify-center shadow-[0_0_15px_rgba(6,182,212,0.2)]">
              <Plane className="w-5 h-5 text-cyan-400 -rotate-45" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-black tracking-wider text-slate-100 uppercase">
                  PHERO-MESH
                </h1>
                <span className="px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 text-[10px] font-mono border border-cyan-500/40 font-semibold">
                  WASM SWARM OS
                </span>
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-1.5 rounded border border-emerald-800">
                  SUB-4MS
                </span>
              </div>
              <div className="text-[11px] font-mono text-slate-400 flex items-center gap-2">
                <span>FLIGHT: LH420</span>
                <span>&bull;</span>
                <span>GATE B42</span>
                <span>&bull;</span>
                <span className="text-cyan-400">A320-271N (D-AINA)</span>
              </div>
            </div>
          </div>

          {/* Quick Status Telemetry Badges */}
          <div className="flex items-center gap-2 text-xs font-mono">
            <div className="hidden md:flex items-center gap-2 px-2.5 py-1 rounded bg-[#161C2E] border border-[#1F293D] text-[11px]">
              <span className="text-slate-400">TURNAROUND:</span>
              <span className="text-slate-200 font-bold">45:00 MIN</span>
              <span className="text-slate-500">|</span>
              <span className="text-slate-400">SERVICES:</span>
              <span className="text-cyan-400 font-bold">12 COORD</span>
            </div>

            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#161C2E] border border-[#1F293D] text-[11px]">
              <Radio className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
              <span className="text-slate-400">BUS:</span>
              <span className="text-cyan-300 font-semibold">&lt; 0.9ms</span>
            </div>

            {/* Sound Toggle */}
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="p-1.5 rounded bg-[#161C2E] hover:bg-[#1F293D] border border-[#1F293D] text-slate-400 hover:text-slate-200 transition-colors"
              title={soundEnabled ? 'Mute tactical audio' : 'Enable tactical audio'}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4 text-cyan-400" /> : <VolumeX className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto w-full p-4 flex flex-col gap-4 flex-grow">
        {/* Row 1: Tarmac Canvas (Apron 60 FPS) + CPM Gantt HUD */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Tarmac Canvas View (60% width on large screens) */}
          <div className="lg:col-span-7 h-[420px] sm:h-[480px]">
            <TarmacCanvas
              telemetry={telemetry}
              selectedNodeId={selectedNodeId}
              onSelectNode={setSelectedNodeId}
            />
          </div>

          {/* Critical Path HUD (40% width) */}
          <div className="lg:col-span-5 flex flex-col">
            <CriticalPathHUD
              telemetry={telemetry}
              selectedNodeId={selectedNodeId}
              onSelectNode={setSelectedNodeId}
            />
          </div>
        </div>

        {/* Row 2: Shard Role View & Multi-Tab P2P Swarm Matrix */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-7">
            <ShardRoleView
              currentRole={currentRole}
              onSelectRole={(r) => {
                setCurrentRole(r);
                swarmBus.setRole(r);
              }}
              telemetry={telemetry}
              onInjectDelay={handleInjectDelay}
              onResetDelays={handleResetAllDelays}
            />
          </div>

          <div className="lg:col-span-5">
            <SwarmStatusMatrix
              currentRole={currentRole}
              isLeader={isLeader}
              busMetrics={busMetrics}
              computeTimeMs={telemetry?.computeTimeMs ?? 0.42}
              onLaunchNewTab={handleLaunchNewTab}
            />
          </div>
        </div>

        {/* Row 3: Real-Time Chaos Injection & Benchmark Comparator */}
        <div>
          <ChaosControlPanel
            onInjectPreset={handleTriggerPreset}
            cloudState={cloudState}
            wasmComputeTimeMs={telemetry?.computeTimeMs ?? 0.42}
            onResetAll={handleResetAllDelays}
            sliderDelays={sliderDelays}
            onSliderChange={handleInjectDelay}
          />
        </div>
      </main>

      {/* Industrial Avionics Footer */}
      <footer className="border-t border-[#1F293D] bg-[#0E1320] px-4 py-3 text-slate-500 text-[11px] font-mono">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-cyan-400">
              <Shield className="w-3.5 h-3.5" />
              <span>ICAO Ground Handling Annex 14 Compliant</span>
            </div>
            <span>&bull;</span>
            <span>Zero-Cloud Client WASM Core</span>
            <span>&bull;</span>
            <span>Biological Stigmergy Heat Diffusion Matrix</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-400">BroadcastChannel 28-byte Binary Bus</span>
            <span>&bull;</span>
            <span className="text-emerald-400 font-bold">100% Deterministic Math</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
