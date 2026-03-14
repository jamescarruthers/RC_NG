import { Vehicle } from './physics/vehicle';
import { Terrain } from './physics/terrain';
import { createScene } from './rendering/scene';
import { VehicleModel } from './rendering/vehicleModel';
import { CameraController } from './rendering/camera';
import { SkidMarks } from './rendering/skidmarks';
import { DustParticles } from './rendering/particles';
import { InputControls } from './input/controls';
import { HUD } from './ui/hud';
import { DebugPanel } from './ui/debug';
import { AudioEngine } from './audio/engine';
import { PHYSICS_DT } from './utils/constants';

// Core systems
const terrain = new Terrain(512, 256);
const { scene, renderer } = createScene(terrain);
const vehicle = new Vehicle();
const vehicleModel = new VehicleModel(scene);
const cameraController = new CameraController();
const input = new InputControls();
const hud = new HUD();
const debugPanel = new DebugPanel(vehicle);
const skidMarks = new SkidMarks(scene);
const dustParticles = new DustParticles(scene);
const audio = new AudioEngine();

// Start audio on first user interaction
let audioStarted = false;
function initAudio(): void {
  if (!audioStarted) {
    audio.init();
    audioStarted = true;
  }
}
window.addEventListener('keydown', initAudio, { once: false });
window.addEventListener('click', initAudio, { once: false });

// Game loop
let lastTimestamp = 0;
let accumulator = 0;

function gameLoop(timestamp: number): void {
  const frameDt = lastTimestamp === 0 ? 0.016 : (timestamp - lastTimestamp) / 1000;
  lastTimestamp = timestamp;

  // Clamp to prevent spiral of death
  accumulator += Math.min(frameDt, 0.05);

  // Process input events
  const events = input.consumeEvents();
  if (events.toggleCamera) cameraController.toggleMode();
  if (events.resetVehicle) vehicle.reset();
  if (events.toggleDebug) debugPanel.toggle();

  // Update input smoothing
  input.update(frameDt);

  // Apply input to vehicle
  vehicle.throttle = input.throttle;
  vehicle.brake = input.brake;
  vehicle.steerInput = input.steer;
  vehicle.handbrake = input.handbrake;

  // Fixed-timestep physics
  while (accumulator >= PHYSICS_DT) {
    vehicle.update(terrain, PHYSICS_DT);
    accumulator -= PHYSICS_DT;
  }

  const alpha = accumulator / PHYSICS_DT;

  // Update rendering
  vehicleModel.updateFromPhysics(vehicle, alpha);
  cameraController.update(vehicle, frameDt);
  skidMarks.update(vehicle);
  dustParticles.update(vehicle, frameDt);

  // Update HUD
  hud.update(vehicle);

  // Update audio
  if (audioStarted) audio.update(vehicle);

  // Render
  renderer.render(scene, cameraController.camera);

  requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);
