import * as THREE from 'three';
import { Terrain } from '../physics/terrain';

export function createScene(terrain: Terrain): {
  scene: THREE.Scene;
  renderer: THREE.WebGLRenderer;
  terrainMesh: THREE.Mesh;
} {
  const scene = new THREE.Scene();

  // Sky
  scene.background = new THREE.Color(0x87ceeb);
  scene.fog = new THREE.Fog(0x87ceeb, 200, 500);

  // Directional light (sun)
  const sun = new THREE.DirectionalLight(0xffffff, 1.5);
  sun.position.set(50, 80, 30);
  sun.castShadow = true;
  sun.shadow.mapSize.width = 2048;
  sun.shadow.mapSize.height = 2048;
  sun.shadow.camera.left = -80;
  sun.shadow.camera.right = 80;
  sun.shadow.camera.top = 80;
  sun.shadow.camera.bottom = -80;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 200;
  sun.shadow.bias = -0.001;
  scene.add(sun);

  // Ambient light
  const ambient = new THREE.AmbientLight(0x6688aa, 0.6);
  scene.add(ambient);

  // Hemisphere light for nice sky/ground color blending
  const hemi = new THREE.HemisphereLight(0x87ceeb, 0x445522, 0.4);
  scene.add(hemi);

  // Terrain mesh
  const terrainMesh = terrain.createMesh();
  scene.add(terrainMesh);

  // Renderer
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  document.body.prepend(renderer.domElement);

  window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  return { scene, renderer, terrainMesh };
}
