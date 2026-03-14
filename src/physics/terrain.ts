import * as THREE from 'three';

// Simple Perlin-ish noise (value noise with smoothstep interpolation)
function hash(x: number, z: number): number {
  let n = x * 73856093 + z * 19349663;
  n = (n << 13) ^ n;
  return ((n * (n * n * 15731 + 789221) + 1376312589) & 0x7fffffff) / 2147483647.0;
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

function valueNoise(x: number, z: number): number {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const sx = smoothstep(fx);
  const sz = smoothstep(fz);

  const v00 = hash(ix, iz);
  const v10 = hash(ix + 1, iz);
  const v01 = hash(ix, iz + 1);
  const v11 = hash(ix + 1, iz + 1);

  const a = v00 + (v10 - v00) * sx;
  const b = v01 + (v11 - v01) * sx;
  return a + (b - a) * sz;
}

function fbm(x: number, z: number, octaves: number): number {
  let value = 0;
  let amplitude = 1;
  let frequency = 1;
  let totalAmp = 0;
  for (let i = 0; i < octaves; i++) {
    value += amplitude * valueNoise(x * frequency, z * frequency);
    totalAmp += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }
  return value / totalAmp;
}

export class Terrain {
  size: number;
  resolution: number;
  heightData: Float32Array;
  cellSize: number;

  constructor(size = 512, resolution = 256) {
    this.size = size;
    this.resolution = resolution;
    this.cellSize = size / resolution;
    this.heightData = new Float32Array((resolution + 1) * (resolution + 1));
    this.generate();
  }

  generate(): void {
    const res = this.resolution;
    const half = this.size / 2;
    for (let iz = 0; iz <= res; iz++) {
      for (let ix = 0; ix <= res; ix++) {
        const worldX = (ix / res) * this.size - half;
        const worldZ = (iz / res) * this.size - half;

        // Distance from center for flat tarmac zone
        const dist = Math.sqrt(worldX * worldX + worldZ * worldZ);

        // Base terrain: gentle hills
        let h = fbm(worldX * 0.008, worldZ * 0.008, 5) * 15 - 5;

        // Add some rougher terrain further out
        if (dist > 100) {
          const t = Math.min((dist - 100) / 100, 1);
          h += t * fbm(worldX * 0.03, worldZ * 0.03, 3) * 3;
        }

        // Flatten center area (tarmac zone, ~80m radius)
        if (dist < 80) {
          const flatBlend = smoothstep(1 - dist / 80);
          h = h * (1 - flatBlend);
        }

        // Add a ramp
        if (worldX > 30 && worldX < 40 && worldZ > -5 && worldZ < 5) {
          const rampProgress = (worldX - 30) / 10;
          h = Math.max(h, rampProgress * 3);
        }

        this.heightData[iz * (res + 1) + ix] = h;
      }
    }
  }

  getHeight(worldX: number, worldZ: number): number {
    const half = this.size / 2;
    const fx = (worldX + half) / this.size * this.resolution;
    const fz = (worldZ + half) / this.size * this.resolution;

    const ix = Math.floor(fx);
    const iz = Math.floor(fz);
    const tx = fx - ix;
    const tz = fz - iz;

    const res = this.resolution;
    if (ix < 0 || ix >= res || iz < 0 || iz >= res) return 0;

    const stride = res + 1;
    const h00 = this.heightData[iz * stride + ix];
    const h10 = this.heightData[iz * stride + ix + 1];
    const h01 = this.heightData[(iz + 1) * stride + ix];
    const h11 = this.heightData[(iz + 1) * stride + ix + 1];

    // Bilinear interpolation
    const a = h00 + (h10 - h00) * tx;
    const b = h01 + (h11 - h01) * tx;
    return a + (b - a) * tz;
  }

  getNormal(worldX: number, worldZ: number): THREE.Vector3 {
    const eps = this.cellSize * 0.5;
    const hL = this.getHeight(worldX - eps, worldZ);
    const hR = this.getHeight(worldX + eps, worldZ);
    const hD = this.getHeight(worldX, worldZ - eps);
    const hU = this.getHeight(worldX, worldZ + eps);

    const normal = new THREE.Vector3(
      (hL - hR) / (2 * eps),
      1,
      (hD - hU) / (2 * eps)
    );
    normal.normalize();
    return normal;
  }

  // Returns 0 = tarmac, 1 = grass/dirt based on distance from center
  getSurfaceType(worldX: number, worldZ: number): number {
    const dist = Math.sqrt(worldX * worldX + worldZ * worldZ);
    if (dist < 60) return 0;
    if (dist < 80) return (dist - 60) / 20;
    return 1;
  }

  createMesh(): THREE.Mesh {
    const res = this.resolution;
    const geometry = new THREE.PlaneGeometry(this.size, this.size, res, res);
    geometry.rotateX(-Math.PI / 2);

    const positions = geometry.attributes.position;
    const colors = new Float32Array(positions.count * 3);

    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const z = positions.getZ(i);
      const y = this.getHeight(x, z);
      positions.setY(i, y);

      // Vertex coloring: tarmac (gray) vs grass (green)
      const surface = this.getSurfaceType(x, z);
      const tarmac = [0.3, 0.3, 0.32];
      const grass = [0.2, 0.45, 0.15];
      colors[i * 3] = tarmac[0] + (grass[0] - tarmac[0]) * surface;
      colors[i * 3 + 1] = tarmac[1] + (grass[1] - tarmac[1]) * surface;
      colors[i * 3 + 2] = tarmac[2] + (grass[2] - tarmac[2]) * surface;
    }

    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.computeVertexNormals();

    const material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.9,
      metalness: 0.0,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.receiveShadow = true;
    return mesh;
  }
}
