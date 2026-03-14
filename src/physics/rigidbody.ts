import * as THREE from 'three';
import { VEHICLE, GRAVITY } from '../utils/constants';

export class RigidBody {
  position = new THREE.Vector3(0, 2, 0);
  orientation = new THREE.Quaternion();
  linearVelocity = new THREE.Vector3();
  angularVelocity = new THREE.Vector3();

  mass = VEHICLE.mass;
  inertia = new THREE.Vector3(VEHICLE.inertia.xx, VEHICLE.inertia.yy, VEHICLE.inertia.zz);
  inertiaInv = new THREE.Vector3(1 / VEHICLE.inertia.xx, 1 / VEHICLE.inertia.yy, 1 / VEHICLE.inertia.zz);

  // Accumulators for the current step
  private totalForce = new THREE.Vector3();
  private totalTorque = new THREE.Vector3();

  // Previous state for interpolation
  prevPosition = new THREE.Vector3(0, 2, 0);
  prevOrientation = new THREE.Quaternion();

  resetAccumulators(): void {
    this.totalForce.set(0, 0, 0);
    this.totalTorque.set(0, 0, 0);
  }

  applyForce(force: THREE.Vector3): void {
    this.totalForce.add(force);
  }

  applyForceAtPoint(force: THREE.Vector3, worldPoint: THREE.Vector3): void {
    this.totalForce.add(force);
    const r = new THREE.Vector3().subVectors(worldPoint, this.position);
    const torque = new THREE.Vector3().crossVectors(r, force);
    this.totalTorque.add(torque);
  }

  applyTorque(torque: THREE.Vector3): void {
    this.totalTorque.add(torque);
  }

  integrate(dt: number): void {
    // Save previous state for interpolation
    this.prevPosition.copy(this.position);
    this.prevOrientation.copy(this.orientation);

    // Apply gravity
    this.totalForce.y -= this.mass * GRAVITY;

    // Semi-implicit Euler: update velocity first, then position
    // Linear
    const accel = this.totalForce.clone().divideScalar(this.mass);
    this.linearVelocity.addScaledVector(accel, dt);
    this.position.addScaledVector(this.linearVelocity, dt);

    // Angular - in body space
    const bodyAngVel = this.worldToBody(this.angularVelocity);
    const bodyTorque = this.worldToBody(this.totalTorque);

    // Euler's rotation equation: I * alpha = torque - omega x (I * omega)
    const Iw = new THREE.Vector3(
      this.inertia.x * bodyAngVel.x,
      this.inertia.y * bodyAngVel.y,
      this.inertia.z * bodyAngVel.z
    );
    const gyroscopic = new THREE.Vector3().crossVectors(bodyAngVel, Iw);
    const angAccelBody = new THREE.Vector3(
      (bodyTorque.x - gyroscopic.x) * this.inertiaInv.x,
      (bodyTorque.y - gyroscopic.y) * this.inertiaInv.y,
      (bodyTorque.z - gyroscopic.z) * this.inertiaInv.z
    );
    const angAccelWorld = this.bodyToWorld(angAccelBody);
    this.angularVelocity.addScaledVector(angAccelWorld, dt);

    // Update orientation: q' = q + 0.5 * dt * omega * q
    const wq = new THREE.Quaternion(
      this.angularVelocity.x,
      this.angularVelocity.y,
      this.angularVelocity.z,
      0
    );
    wq.multiply(this.orientation);
    this.orientation.x += 0.5 * dt * wq.x;
    this.orientation.y += 0.5 * dt * wq.y;
    this.orientation.z += 0.5 * dt * wq.z;
    this.orientation.w += 0.5 * dt * wq.w;
    this.orientation.normalize();

    // Light angular damping to prevent slow drift
    this.angularVelocity.multiplyScalar(1 - 0.001);
  }

  worldToBody(v: THREE.Vector3): THREE.Vector3 {
    const inv = this.orientation.clone().invert();
    return v.clone().applyQuaternion(inv);
  }

  bodyToWorld(v: THREE.Vector3): THREE.Vector3 {
    return v.clone().applyQuaternion(this.orientation);
  }

  getLocalAxis(axis: THREE.Vector3): THREE.Vector3 {
    return axis.clone().applyQuaternion(this.orientation);
  }

  getUp(): THREE.Vector3 {
    return this.getLocalAxis(new THREE.Vector3(0, 1, 0));
  }

  getForward(): THREE.Vector3 {
    return this.getLocalAxis(new THREE.Vector3(0, 0, 1));
  }

  getRight(): THREE.Vector3 {
    return this.getLocalAxis(new THREE.Vector3(1, 0, 0));
  }

  getVelocityAtPoint(worldPoint: THREE.Vector3): THREE.Vector3 {
    const r = new THREE.Vector3().subVectors(worldPoint, this.position);
    const rotVel = new THREE.Vector3().crossVectors(this.angularVelocity, r);
    return this.linearVelocity.clone().add(rotVel);
  }

  getWorldPoint(localPoint: THREE.Vector3): THREE.Vector3 {
    return localPoint.clone().applyQuaternion(this.orientation).add(this.position);
  }

  reset(pos?: THREE.Vector3): void {
    this.position.copy(pos || new THREE.Vector3(0, 2, 0));
    this.orientation.identity();
    this.linearVelocity.set(0, 0, 0);
    this.angularVelocity.set(0, 0, 0);
    this.prevPosition.copy(this.position);
    this.prevOrientation.copy(this.orientation);
  }
}
