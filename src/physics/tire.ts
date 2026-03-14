import * as THREE from 'three';
import { RigidBody } from './rigidbody';
import { WheelContact } from './suspension';
import { TIRE, WHEEL, ENGINE } from '../utils/constants';

export interface TireState {
  slipRatio: number;
  slipAngle: number;
  combinedSlip: number;
  fx: number;
  fy: number;
  wheelAngVel: number;
  rpm: number;
}

export class TireSystem {
  wheelAngularVelocity = [0, 0, 0, 0]; // FL, FR, RL, RR
  steerAngle = 0;
  states: TireState[] = [];

  // Tunable
  peakMu = TIRE.peakMu;
  pacejkaB = TIRE.pacejkaB;
  pacejkaCLat = TIRE.pacejkaCLat;
  pacejkaCLong = TIRE.pacejkaCLong;
  pacejkaE = TIRE.pacejkaE;

  constructor() {
    for (let i = 0; i < 4; i++) {
      this.states.push({
        slipRatio: 0, slipAngle: 0, combinedSlip: 0,
        fx: 0, fy: 0, wheelAngVel: 0, rpm: 0,
      });
    }
  }

  update(
    body: RigidBody,
    contacts: WheelContact[],
    mountPoints: THREE.Vector3[],
    throttle: number,
    brake: number,
    handbrake: boolean,
    currentGear: number,
    dt: number
  ): { engineRPM: number; gear: number } {
    // Compute engine RPM from rear wheel speed average
    const rearAvgAngVel = (Math.abs(this.wheelAngularVelocity[2]) + Math.abs(this.wheelAngularVelocity[3])) / 2;
    const gearRatio = ENGINE.gearRatios[currentGear] * ENGINE.finalDrive;
    let engineRPM = (rearAvgAngVel * gearRatio * 60) / (2 * Math.PI);
    engineRPM = Math.max(engineRPM, ENGINE.idle);

    // Auto shift
    let gear = currentGear;
    if (engineRPM > ENGINE.shiftUpRPM && gear < ENGINE.gearRatios.length - 1) {
      gear = currentGear + 1;
    } else if (engineRPM < ENGINE.shiftDownRPM && gear > 0) {
      gear = currentGear - 1;
    }

    // Engine torque
    const rpmNorm = (engineRPM - ENGINE.peakRPM) / ENGINE.peakRPM;
    let engineTorque = ENGINE.peakTorque * (1 - rpmNorm * rpmNorm);
    engineTorque = Math.max(0, engineTorque);

    // Clamp at redline
    if (engineRPM > ENGINE.redline) {
      engineTorque = 0;
    }

    // Drive torque to rear wheels (RWD)
    const driveTorquePerWheel = (engineTorque * throttle * gearRatio) / 2;

    for (let i = 0; i < 4; i++) {
      const contact = contacts[i];
      const state = this.states[i];
      const isFront = i < 2;

      state.wheelAngVel = this.wheelAngularVelocity[i];

      if (!contact.hasContact) {
        // Free spinning wheel (no ground contact)
        const driveTorque = isFront ? 0 : driveTorquePerWheel;
        this.wheelAngularVelocity[i] += (driveTorque / WHEEL.inertia) * dt;
        // Slow down from air resistance
        this.wheelAngularVelocity[i] *= 0.999;
        state.slipRatio = 0;
        state.slipAngle = 0;
        state.combinedSlip = 0;
        state.fx = 0;
        state.fy = 0;
        continue;
      }

      const Fz = contact.suspensionForce;
      if (Fz <= 0) {
        state.slipRatio = 0;
        state.slipAngle = 0;
        state.combinedSlip = 0;
        state.fx = 0;
        state.fy = 0;
        continue;
      }

      // Get velocity at contact point in world space
      const contactWorld = contact.worldPoint.clone();
      contactWorld.y += TIRE.radius; // approximate application point
      const vel = body.getVelocityAtPoint(contactWorld);

      // Get wheel local directions
      let wheelForward = body.getForward();
      const wheelRight = body.getRight();

      // Apply steering to front wheels
      if (isFront) {
        const steerQuat = new THREE.Quaternion().setFromAxisAngle(body.getUp(), this.steerAngle);
        wheelForward = wheelForward.applyQuaternion(steerQuat);
      }

      // Project velocity onto wheel plane (along ground)
      const vLong = vel.dot(wheelForward);
      const vLat = vel.dot(wheelRight);

      // Longitudinal slip ratio
      const wheelSpeed = this.wheelAngularVelocity[i] * TIRE.radius;
      const absVLong = Math.max(Math.abs(vLong), 0.5);
      const slipRatio = (wheelSpeed - vLong) / absVLong;

      // Lateral slip angle
      const slipAngle = Math.atan2(vLat, absVLong);

      state.slipRatio = slipRatio;
      state.slipAngle = slipAngle;

      // Combined slip
      const combinedSlip = Math.sqrt(slipRatio * slipRatio + slipAngle * slipAngle);
      state.combinedSlip = combinedSlip;

      // Pacejka magic formula
      const forceMag = combinedSlip > 0.0001
        ? this.pacejka(combinedSlip, this.pacejkaCLat) * Fz
        : 0;

      // Split into longitudinal and lateral using friction ellipse
      let fx = 0;
      let fy = 0;
      if (combinedSlip > 0.0001) {
        fx = (slipRatio / combinedSlip) * forceMag;
        fy = (slipAngle / combinedSlip) * forceMag;
      }

      // Reduce grip on grass
      const surfaceGrip = 1 - contact.surfaceType * 0.4;
      fx *= surfaceGrip;
      fy *= surfaceGrip;

      state.fx = fx;
      state.fy = fy;

      // Apply tire forces to chassis
      const tireForce = new THREE.Vector3();
      tireForce.addScaledVector(wheelForward, fx);
      tireForce.addScaledVector(wheelRight, -fy); // negative because slip angle sign convention
      body.applyForceAtPoint(tireForce, contactWorld);

      // Update wheel angular velocity
      // Drive torque (rear wheels only)
      const driveTorque = isFront ? 0 : driveTorquePerWheel;

      // Brake torque
      const brakeBias = isFront ? WHEEL.brakeBias : (1 - WHEEL.brakeBias);
      let brakeTorque = brake * WHEEL.brakeMaxTorque * brakeBias;

      // Handbrake - lock rear wheels
      if (handbrake && !isFront) {
        brakeTorque = WHEEL.brakeMaxTorque * 2;
      }

      // Brake opposes wheel rotation
      const brakeSign = this.wheelAngularVelocity[i] > 0 ? -1 : 1;
      const effectiveBrake = brakeTorque * brakeSign;

      // Tire reaction torque
      const tireReactionTorque = -fx * TIRE.radius;

      const totalWheelTorque = driveTorque + effectiveBrake + tireReactionTorque;
      this.wheelAngularVelocity[i] += (totalWheelTorque / WHEEL.inertia) * dt;

      // Prevent brake from reversing wheel direction
      if (brakeTorque > 0) {
        const newVel = this.wheelAngularVelocity[i];
        if ((brakeSign > 0 && newVel > 0) || (brakeSign < 0 && newVel < 0)) {
          // Brake has reversed the wheel - clamp to zero
          if (Math.abs(driveTorque) < brakeTorque) {
            this.wheelAngularVelocity[i] = 0;
          }
        }
      }
    }

    return { engineRPM, gear };
  }

  private pacejka(slip: number, C: number): number {
    const B = this.pacejkaB;
    const E = this.pacejkaE;
    const Bx = B * slip;
    return this.peakMu * Math.sin(C * Math.atan(Bx - E * (Bx - Math.atan(Bx))));
  }

  getRPM(): number {
    const rearAvgAngVel = (Math.abs(this.wheelAngularVelocity[2]) + Math.abs(this.wheelAngularVelocity[3])) / 2;
    return rearAvgAngVel * 30 / Math.PI; // Convert rad/s to RPM of wheel
  }
}
