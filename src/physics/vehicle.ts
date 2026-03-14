import * as THREE from 'three';
import { RigidBody } from './rigidbody';
import { SuspensionSystem } from './suspension';
import { TireSystem } from './tire';
import { Terrain } from './terrain';
import { MOUNT_POINTS, AERO, VEHICLE } from '../utils/constants';

export class Vehicle {
  body: RigidBody;
  suspension: SuspensionSystem;
  tires: TireSystem;

  mountPoints: THREE.Vector3[];
  currentGear = 0;
  engineRPM = 800;

  // Input state (smoothed)
  throttle = 0;
  brake = 0;
  steerInput = 0;
  handbrake = false;

  // G-force tracking
  gForce = new THREE.Vector2(0, 0); // lateral, longitudinal
  private prevVelocity = new THREE.Vector3();

  constructor() {
    this.body = new RigidBody();
    this.suspension = new SuspensionSystem();
    this.tires = new TireSystem();

    this.mountPoints = [
      new THREE.Vector3(MOUNT_POINTS.fl.x, MOUNT_POINTS.fl.y, MOUNT_POINTS.fl.z),
      new THREE.Vector3(MOUNT_POINTS.fr.x, MOUNT_POINTS.fr.y, MOUNT_POINTS.fr.z),
      new THREE.Vector3(MOUNT_POINTS.rl.x, MOUNT_POINTS.rl.y, MOUNT_POINTS.rl.z),
      new THREE.Vector3(MOUNT_POINTS.rr.x, MOUNT_POINTS.rr.y, MOUNT_POINTS.rr.z),
    ];
  }

  update(terrain: Terrain, dt: number): void {
    this.body.resetAccumulators();

    // Set tire steer angle (max ~30 degrees)
    this.tires.steerAngle = this.steerInput * (Math.PI / 6);

    // Suspension
    this.suspension.update(this.body, this.mountPoints, terrain, dt);

    // Tires & drivetrain
    const result = this.tires.update(
      this.body,
      this.suspension.contacts,
      this.mountPoints,
      this.throttle,
      this.brake,
      this.handbrake,
      this.currentGear,
      dt
    );
    this.engineRPM = result.engineRPM;
    this.currentGear = result.gear;

    // Aerodynamic drag
    const v = this.body.linearVelocity;
    const speed = v.length();
    if (speed > 0.1) {
      const dragMag = 0.5 * AERO.cd * AERO.frontalArea * AERO.airDensity * speed * speed;
      const dragForce = v.clone().normalize().multiplyScalar(-dragMag);
      this.body.applyForce(dragForce);
    }

    // Integrate
    this.body.integrate(dt);

    // Compute G-forces
    const accel = this.body.linearVelocity.clone().sub(this.prevVelocity).divideScalar(dt);
    this.prevVelocity.copy(this.body.linearVelocity);
    const lateralG = accel.dot(this.body.getRight()) / 9.81;
    const longG = accel.dot(this.body.getForward()) / 9.81;
    this.gForce.set(lateralG, longG);
  }

  getSpeed(): number {
    return this.body.linearVelocity.length();
  }

  getSpeedKmh(): number {
    return this.getSpeed() * 3.6;
  }

  reset(): void {
    this.body.reset(new THREE.Vector3(0, 2, 0));
    this.tires.wheelAngularVelocity = [0, 0, 0, 0];
    this.currentGear = 0;
    this.engineRPM = 800;
    this.throttle = 0;
    this.brake = 0;
    this.steerInput = 0;
    this.handbrake = false;
    this.prevVelocity.set(0, 0, 0);
  }
}
