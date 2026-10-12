// Airport Gate 42B Geometry & Service Vehicle Kinematics

export interface GateVehicleState {
  nodeId: number;
  currentX: number;
  currentY: number;
  targetX: number;
  targetY: number;
  headingRad: number;
  speed: number;
  status: 'idle' | 'en_route' | 'servicing' | 'delayed' | 'completed';
  pulsePhase: number;
}

export class GateSimulation {
  public vehicles: Map<number, GateVehicleState> = new Map();

  constructor() {
    this.initVehicles();
  }

  public initVehicles(): void {
    // 12 vehicle instances initialized at staging areas outside safety lines
    for (let i = 0; i < 12; i++) {
      const stagingAngle = (i / 12) * Math.PI * 2;
      const stagingDist = 260;
      this.vehicles.set(i, {
        nodeId: i,
        currentX: Math.cos(stagingAngle) * stagingDist,
        currentY: Math.sin(stagingAngle) * stagingDist,
        targetX: 0,
        targetY: 0,
        headingRad: stagingAngle + Math.PI,
        speed: 1.5,
        status: 'servicing',
        pulsePhase: Math.random() * Math.PI * 2,
      });
    }
  }

  public update(deltaTimeSec: number, delays: number[], criticalPathNodes: Set<number>): void {
    for (const [nodeId, v] of this.vehicles.entries()) {
      v.pulsePhase += deltaTimeSec * 3.5;

      const isDelayed = delays[nodeId] > 0;
      const isCritical = criticalPathNodes.has(nodeId);

      if (isDelayed || isCritical) {
        v.status = isDelayed ? 'delayed' : 'servicing';
      } else {
        v.status = 'servicing';
      }

      // Smooth kinematic lerp towards assigned target anchor
      const dx = v.targetX - v.currentX;
      const dy = v.targetY - v.currentY;
      const dist = Math.hypot(dx, dy);

      if (dist > 1.0) {
        const step = Math.min(dist, v.speed * 60 * deltaTimeSec);
        v.currentX += (dx / dist) * step;
        v.currentY += (dy / dist) * step;
        v.headingRad = Math.atan2(dy, dx);
      }
    }
  }

  public setAnchorTargets(anchors: Map<number, { x: number; y: number }>): void {
    for (const [nodeId, anchor] of anchors.entries()) {
      const v = this.vehicles.get(nodeId);
      if (v) {
        v.targetX = anchor.x;
        v.targetY = anchor.y;
      }
    }
  }
}
