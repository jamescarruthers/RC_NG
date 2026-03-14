import * as THREE from 'three';
import { Vehicle } from '../physics/vehicle';
import { CAMERA } from '../utils/constants';

export class CameraController {
  camera: THREE.PerspectiveCamera;
  private currentPos = new THREE.Vector3();
  private currentLookAt = new THREE.Vector3();
  private mode: 'chase' | 'cockpit' = 'chase';

  stiffness = CAMERA.stiffness;
  lookAtStiffness = CAMERA.lookAtStiffness;
  distance = CAMERA.distance;
  height = CAMERA.height;

  constructor() {
    this.camera = new THREE.PerspectiveCamera(
      65,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this.currentPos.set(0, 5, -10);
    this.currentLookAt.set(0, 0, 0);
    this.camera.position.copy(this.currentPos);

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
    });
  }

  toggleMode(): void {
    this.mode = this.mode === 'chase' ? 'cockpit' : 'chase';
  }

  update(vehicle: Vehicle, dt: number): void {
    const body = vehicle.body;

    if (this.mode === 'chase') {
      this.updateChase(vehicle, dt);
    } else {
      this.updateCockpit(vehicle, dt);
    }
  }

  private updateChase(vehicle: Vehicle, dt: number): void {
    const body = vehicle.body;
    const back = body.getForward().negate();
    const up = new THREE.Vector3(0, 1, 0);

    const idealPos = body.position.clone()
      .addScaledVector(back, this.distance)
      .addScaledVector(up, this.height);

    const idealLookAt = body.position.clone().addScaledVector(up, 0.5);

    // Spring-damp
    const posLerp = 1 - Math.exp(-this.stiffness * dt);
    const lookLerp = 1 - Math.exp(-this.lookAtStiffness * dt);

    this.currentPos.lerp(idealPos, posLerp);
    this.currentLookAt.lerp(idealLookAt, lookLerp);

    this.camera.position.copy(this.currentPos);
    this.camera.lookAt(this.currentLookAt);
  }

  private updateCockpit(vehicle: Vehicle, dt: number): void {
    const body = vehicle.body;

    // Position at driver's eye level, slightly right of center
    const localEye = new THREE.Vector3(0.3, 0.9, 0.2);
    const worldEye = body.getWorldPoint(localEye);

    // Look forward
    const lookTarget = worldEye.clone().add(body.getForward().multiplyScalar(10));

    // Add slight shake from suspension
    const avgCompression = vehicle.suspension.contacts.reduce(
      (sum, c) => sum + c.compressionVelocity, 0
    ) / 4;
    worldEye.y += avgCompression * 0.01;

    this.currentPos.lerp(worldEye, 0.5);
    this.currentLookAt.lerp(lookTarget, 0.5);

    this.camera.position.copy(this.currentPos);
    this.camera.lookAt(this.currentLookAt);
  }
}
