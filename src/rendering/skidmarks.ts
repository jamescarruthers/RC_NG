import * as THREE from 'three';
import { Vehicle } from '../physics/vehicle';
import { TIRE } from '../utils/constants';

const MAX_MARKS = 2000;
const MARK_WIDTH = TIRE.width * 0.8;
const SLIP_THRESHOLD = 0.15;

export class SkidMarks {
  private meshes: THREE.Mesh[] = [];
  private geometry: THREE.BufferGeometry;
  private positions: Float32Array;
  private colors: Float32Array;
  private index = 0;
  private prevPoints: (THREE.Vector3 | null)[] = [null, null, null, null];
  private mesh: THREE.Mesh;

  constructor(scene: THREE.Scene) {
    // Use a single buffer geometry with quads for all marks
    this.geometry = new THREE.BufferGeometry();
    this.positions = new Float32Array(MAX_MARKS * 4 * 3); // 4 verts per quad
    this.colors = new Float32Array(MAX_MARKS * 4 * 4); // RGBA

    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 4));

    // Build index buffer for quads
    const indices = new Uint32Array(MAX_MARKS * 6);
    for (let i = 0; i < MAX_MARKS; i++) {
      const base = i * 4;
      const idx = i * 6;
      indices[idx] = base;
      indices[idx + 1] = base + 1;
      indices[idx + 2] = base + 2;
      indices[idx + 3] = base + 2;
      indices[idx + 4] = base + 1;
      indices[idx + 5] = base + 3;
    }
    this.geometry.setIndex(new THREE.BufferAttribute(indices, 1));

    const material = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -1,
    });

    this.mesh = new THREE.Mesh(this.geometry, material);
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
  }

  update(vehicle: Vehicle): void {
    for (let i = 0; i < 4; i++) {
      const contact = vehicle.suspension.contacts[i];
      const state = vehicle.tires.states[i];

      if (!contact.hasContact || state.combinedSlip < SLIP_THRESHOLD) {
        this.prevPoints[i] = null;
        continue;
      }

      const point = contact.worldPoint.clone();
      point.y += 0.01; // Slightly above ground

      const prev = this.prevPoints[i];
      if (prev && prev.distanceTo(point) > 0.1) {
        this.addMark(prev, point, state.combinedSlip, vehicle);
      }
      this.prevPoints[i] = point;
    }
  }

  private addMark(from: THREE.Vector3, to: THREE.Vector3, slip: number, vehicle: Vehicle): void {
    const idx = this.index % MAX_MARKS;
    const base = idx * 4 * 3;
    const colorBase = idx * 4 * 4;

    const dir = new THREE.Vector3().subVectors(to, from).normalize();
    const right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();
    const halfW = MARK_WIDTH * 0.5;

    const p0 = from.clone().addScaledVector(right, -halfW);
    const p1 = from.clone().addScaledVector(right, halfW);
    const p2 = to.clone().addScaledVector(right, -halfW);
    const p3 = to.clone().addScaledVector(right, halfW);

    this.positions[base] = p0.x; this.positions[base + 1] = p0.y; this.positions[base + 2] = p0.z;
    this.positions[base + 3] = p1.x; this.positions[base + 4] = p1.y; this.positions[base + 5] = p1.z;
    this.positions[base + 6] = p2.x; this.positions[base + 7] = p2.y; this.positions[base + 8] = p2.z;
    this.positions[base + 9] = p3.x; this.positions[base + 10] = p3.y; this.positions[base + 11] = p3.z;

    // Color: dark marks with alpha based on slip intensity
    const alpha = Math.min((slip - SLIP_THRESHOLD) / 0.5, 0.8);
    for (let v = 0; v < 4; v++) {
      const ci = colorBase + v * 4;
      this.colors[ci] = 0.1;
      this.colors[ci + 1] = 0.1;
      this.colors[ci + 2] = 0.1;
      this.colors[ci + 3] = alpha;
    }

    (this.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (this.geometry.attributes.color as THREE.BufferAttribute).needsUpdate = true;

    this.index++;
  }
}
