import * as THREE from 'three';
import { Vehicle } from '../physics/vehicle';
import { VEHICLE, TIRE } from '../utils/constants';

export class VehicleModel {
  group: THREE.Group;
  chassisMesh: THREE.Mesh;
  wheelMeshes: THREE.Mesh[] = [];

  constructor(scene: THREE.Scene) {
    this.group = new THREE.Group();

    // Chassis - composed of multiple boxes for a car-like shape
    const chassisGroup = new THREE.Group();

    // Main body
    const bodyGeo = new THREE.BoxGeometry(VEHICLE.width, 0.6, VEHICLE.length * 0.85);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0xcc2222,
      metalness: 0.7,
      roughness: 0.3,
    });
    const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    bodyMesh.position.y = 0.1;
    bodyMesh.castShadow = true;
    chassisGroup.add(bodyMesh);

    // Cabin (windowed top)
    const cabinGeo = new THREE.BoxGeometry(VEHICLE.width * 0.85, 0.55, VEHICLE.length * 0.45);
    const cabinMat = new THREE.MeshStandardMaterial({
      color: 0x222233,
      metalness: 0.3,
      roughness: 0.2,
      transparent: true,
      opacity: 0.7,
    });
    const cabinMesh = new THREE.Mesh(cabinGeo, cabinMat);
    cabinMesh.position.set(0, 0.65, -0.2);
    cabinMesh.castShadow = true;
    chassisGroup.add(cabinMesh);

    // Hood slope (angled front section)
    const hoodGeo = new THREE.BoxGeometry(VEHICLE.width * 0.9, 0.15, VEHICLE.length * 0.3);
    const hoodMesh = new THREE.Mesh(hoodGeo, bodyMat);
    hoodMesh.position.set(0, 0.5, 1.2);
    hoodMesh.rotation.x = -0.15;
    hoodMesh.castShadow = true;
    chassisGroup.add(hoodMesh);

    // Rear
    const rearGeo = new THREE.BoxGeometry(VEHICLE.width * 0.92, 0.3, 0.4);
    const rearMesh = new THREE.Mesh(rearGeo, bodyMat);
    rearMesh.position.set(0, 0.5, -1.7);
    rearMesh.castShadow = true;
    chassisGroup.add(rearMesh);

    this.chassisMesh = bodyMesh; // Reference for shadow casting
    this.group.add(chassisGroup);

    // Wheels
    const wheelGeo = new THREE.CylinderGeometry(TIRE.radius, TIRE.radius, TIRE.width, 16);
    wheelGeo.rotateZ(Math.PI / 2);
    const wheelMat = new THREE.MeshStandardMaterial({
      color: 0x222222,
      metalness: 0.1,
      roughness: 0.8,
    });

    // Rim detail (hub cap)
    const hubGeo = new THREE.CylinderGeometry(TIRE.radius * 0.6, TIRE.radius * 0.6, TIRE.width + 0.02, 8);
    hubGeo.rotateZ(Math.PI / 2);
    const hubMat = new THREE.MeshStandardMaterial({
      color: 0x888888,
      metalness: 0.8,
      roughness: 0.2,
    });

    for (let i = 0; i < 4; i++) {
      const wheelGroup = new THREE.Group();
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.castShadow = true;
      wheelGroup.add(wheel);

      const hub = new THREE.Mesh(hubGeo, hubMat);
      wheelGroup.add(hub);

      this.wheelMeshes.push(wheelGroup as unknown as THREE.Mesh);
      scene.add(wheelGroup);
    }

    scene.add(this.group);
  }

  updateFromPhysics(vehicle: Vehicle, alpha: number): void {
    const body = vehicle.body;

    // Interpolate chassis position and orientation
    const pos = body.prevPosition.clone().lerp(body.position, alpha);
    const orient = body.prevOrientation.clone().slerp(body.orientation, alpha);

    this.group.position.copy(pos);
    this.group.quaternion.copy(orient);

    // Update wheel positions
    for (let i = 0; i < 4; i++) {
      const contact = vehicle.suspension.contacts[i];
      const mountLocal = vehicle.mountPoints[i];
      const mountWorld = body.getWorldPoint(mountLocal);
      const wheelMesh = this.wheelMeshes[i];

      if (contact.hasContact) {
        // Wheel sits at ground + tire radius
        wheelMesh.position.set(
          mountWorld.x,
          contact.worldPoint.y + TIRE.radius,
          mountWorld.z
        );
      } else {
        // Fully extended
        const suspDown = body.getUp().negate();
        const p = i < 2
          ? vehicle.suspension.params.front
          : vehicle.suspension.params.rear;
        wheelMesh.position.copy(mountWorld).addScaledVector(suspDown, p.restLength);
      }

      // Wheel rotation (spin)
      const spinAngle = vehicle.tires.wheelAngularVelocity[i];
      const isFront = i < 2;
      const isLeft = i % 2 === 0;

      // Copy chassis orientation and add steer + spin
      wheelMesh.quaternion.copy(orient);
      if (isFront) {
        const steerQuat = new THREE.Quaternion().setFromAxisAngle(
          new THREE.Vector3(0, 1, 0),
          vehicle.tires.steerAngle
        );
        wheelMesh.quaternion.multiply(steerQuat);
      }

      // Accumulate spin visually (we just track from angular velocity)
      // Store a running spin angle on the mesh userData
      if (wheelMesh.userData.spinAngle === undefined) {
        wheelMesh.userData.spinAngle = 0;
      }
      wheelMesh.userData.spinAngle += spinAngle * (1 / 240); // approximate
      const spinQuat = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(1, 0, 0),
        wheelMesh.userData.spinAngle * (isLeft ? 1 : -1)
      );
      wheelMesh.quaternion.multiply(spinQuat);
    }
  }
}
