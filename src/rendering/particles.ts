import * as THREE from 'three';
import { Vehicle } from '../physics/vehicle';

const MAX_PARTICLES = 500;
const PARTICLE_LIFETIME = 1.5;

interface Particle {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
  size: number;
}

export class DustParticles {
  private particles: Particle[] = [];
  private geometry: THREE.BufferGeometry;
  private positions: Float32Array;
  private sizes: Float32Array;
  private alphas: Float32Array;
  private points: THREE.Points;
  private spawnTimer = 0;

  constructor(scene: THREE.Scene) {
    this.positions = new Float32Array(MAX_PARTICLES * 3);
    this.sizes = new Float32Array(MAX_PARTICLES);
    this.alphas = new Float32Array(MAX_PARTICLES);

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('size', new THREE.BufferAttribute(this.sizes, 1));
    this.geometry.setAttribute('alpha', new THREE.BufferAttribute(this.alphas, 1));

    const material = new THREE.PointsMaterial({
      color: 0xaa9966,
      size: 1.5,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
    });

    this.points = new THREE.Points(this.geometry, material);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }

  update(vehicle: Vehicle, dt: number): void {
    // Spawn new particles from wheels on dirt
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = 0.02;
      for (let i = 0; i < 4; i++) {
        const contact = vehicle.suspension.contacts[i];
        if (!contact.hasContact || contact.surfaceType < 0.3) continue;

        const speed = vehicle.getSpeed();
        if (speed < 2) continue;

        const slip = vehicle.tires.states[i].combinedSlip;
        if (slip < 0.05 && speed < 10) continue;

        this.spawn(
          contact.worldPoint.clone(),
          vehicle.body.linearVelocity.clone().multiplyScalar(-0.1).add(
            new THREE.Vector3(
              (Math.random() - 0.5) * 3,
              Math.random() * 2 + 1,
              (Math.random() - 0.5) * 3
            )
          ),
          0.5 + Math.random() * 1.5
        );
      }
    }

    // Update existing particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      p.velocity.y -= 2 * dt; // gravity
      p.position.addScaledVector(p.velocity, dt);
      p.velocity.multiplyScalar(0.98); // drag
    }

    // Update buffer
    for (let i = 0; i < MAX_PARTICLES; i++) {
      if (i < this.particles.length) {
        const p = this.particles[i];
        this.positions[i * 3] = p.position.x;
        this.positions[i * 3 + 1] = p.position.y;
        this.positions[i * 3 + 2] = p.position.z;
        this.sizes[i] = p.size * (p.life / p.maxLife);
        this.alphas[i] = p.life / p.maxLife;
      } else {
        this.positions[i * 3] = 0;
        this.positions[i * 3 + 1] = -1000;
        this.positions[i * 3 + 2] = 0;
        this.sizes[i] = 0;
        this.alphas[i] = 0;
      }
    }

    (this.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (this.geometry.attributes.size as THREE.BufferAttribute).needsUpdate = true;
  }

  private spawn(position: THREE.Vector3, velocity: THREE.Vector3, size: number): void {
    if (this.particles.length >= MAX_PARTICLES) return;
    this.particles.push({
      position,
      velocity,
      life: PARTICLE_LIFETIME,
      maxLife: PARTICLE_LIFETIME,
      size,
    });
  }
}
