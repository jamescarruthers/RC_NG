import * as THREE from 'three';
import { RigidBody } from './rigidbody';
import { Terrain } from './terrain';
import { SUSPENSION_DEFAULTS, TIRE } from '../utils/constants';

export interface SuspensionParams {
  springRate: number;
  dampingCompression: number;
  dampingRebound: number;
  antiRollRate: number;
  restLength: number;
  maxTravel: number;
}

export interface WheelContact {
  hasContact: boolean;
  worldPoint: THREE.Vector3;
  normal: THREE.Vector3;
  compression: number;
  compressionVelocity: number;
  suspensionForce: number;
  surfaceType: number;
}

export class SuspensionSystem {
  params: { front: SuspensionParams; rear: SuspensionParams };
  prevCompression = [0, 0, 0, 0]; // FL, FR, RL, RR
  contacts: WheelContact[] = [];

  constructor() {
    this.params = {
      front: {
        springRate: SUSPENSION_DEFAULTS.springRate.front,
        dampingCompression: SUSPENSION_DEFAULTS.dampingCompression.front,
        dampingRebound: SUSPENSION_DEFAULTS.dampingRebound.front,
        antiRollRate: SUSPENSION_DEFAULTS.antiRollRate.front,
        restLength: SUSPENSION_DEFAULTS.restLength,
        maxTravel: SUSPENSION_DEFAULTS.maxTravel,
      },
      rear: {
        springRate: SUSPENSION_DEFAULTS.springRate.rear,
        dampingCompression: SUSPENSION_DEFAULTS.dampingCompression.rear,
        dampingRebound: SUSPENSION_DEFAULTS.dampingRebound.rear,
        antiRollRate: SUSPENSION_DEFAULTS.antiRollRate.rear,
        restLength: SUSPENSION_DEFAULTS.restLength,
        maxTravel: SUSPENSION_DEFAULTS.maxTravel,
      },
    };
    for (let i = 0; i < 4; i++) {
      this.contacts.push({
        hasContact: false,
        worldPoint: new THREE.Vector3(),
        normal: new THREE.Vector3(0, 1, 0),
        compression: 0,
        compressionVelocity: 0,
        suspensionForce: 0,
        surfaceType: 0,
      });
    }
  }

  update(
    body: RigidBody,
    mountPoints: THREE.Vector3[], // local space [FL, FR, RL, RR]
    terrain: Terrain,
    dt: number
  ): void {
    for (let i = 0; i < 4; i++) {
      const isFront = i < 2;
      const p = isFront ? this.params.front : this.params.rear;
      const contact = this.contacts[i];

      // Get world-space mount point
      const mountWorld = body.getWorldPoint(mountPoints[i]);

      // Raycast: from mount point downward along chassis -Y
      const rayLength = p.restLength + TIRE.radius;
      const groundY = terrain.getHeight(mountWorld.x, mountWorld.z);
      const groundNormal = terrain.getNormal(mountWorld.x, mountWorld.z);

      // Vertical distance from mount point to ground
      const dist = mountWorld.y - groundY;

      if (dist > rayLength) {
        // No contact
        contact.hasContact = false;
        contact.compression = 0;
        contact.compressionVelocity = 0;
        contact.suspensionForce = 0;
        this.prevCompression[i] = 0;
        continue;
      }

      contact.hasContact = true;
      contact.worldPoint.set(mountWorld.x, groundY, mountWorld.z);
      contact.normal.copy(groundNormal);
      contact.surfaceType = terrain.getSurfaceType(mountWorld.x, mountWorld.z);

      // Compression = restLength - (dist - tireRadius)
      const springLength = dist - TIRE.radius;
      const compression = Math.max(0, Math.min(p.restLength - springLength, p.maxTravel));
      contact.compression = compression;

      // Compression velocity
      const compressionVelocity = (compression - this.prevCompression[i]) / dt;
      contact.compressionVelocity = compressionVelocity;
      this.prevCompression[i] = compression;

      // Spring force
      const springForce = p.springRate * compression;

      // Damper force
      const dampRate = compressionVelocity > 0 ? p.dampingCompression : p.dampingRebound;
      const damperForce = dampRate * compressionVelocity;

      // Total (before anti-roll)
      let totalForce = springForce + damperForce;
      contact.suspensionForce = totalForce;
    }

    // Anti-roll bars
    // Front axle (wheels 0, 1)
    this.applyAntiRoll(0, 1, this.params.front.antiRollRate);
    // Rear axle (wheels 2, 3)
    this.applyAntiRoll(2, 3, this.params.rear.antiRollRate);

    // Clamp forces >= 0 and apply
    for (let i = 0; i < 4; i++) {
      const contact = this.contacts[i];
      contact.suspensionForce = Math.max(0, contact.suspensionForce);

      if (contact.hasContact && contact.suspensionForce > 0) {
        const forceDir = body.getUp();
        const force = forceDir.multiplyScalar(contact.suspensionForce);
        // Apply at the contact point (wheel bottom)
        const appPoint = body.getWorldPoint(mountPoints[i]);
        body.applyForceAtPoint(force, appPoint);
      }
    }
  }

  private applyAntiRoll(leftIdx: number, rightIdx: number, rate: number): void {
    const leftContact = this.contacts[leftIdx];
    const rightContact = this.contacts[rightIdx];
    if (!leftContact.hasContact && !rightContact.hasContact) return;

    const delta = leftContact.compression - rightContact.compression;
    const antiRollForce = rate * delta;
    leftContact.suspensionForce -= antiRollForce;
    rightContact.suspensionForce += antiRollForce;
  }
}
