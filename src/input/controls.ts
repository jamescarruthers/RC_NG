export class InputControls {
  // Raw key state
  private keys: Record<string, boolean> = {};

  // Smoothed axes
  throttle = 0;
  brake = 0;
  steer = 0;
  handbrake = false;

  // Events
  toggleCamera = false;
  resetVehicle = false;
  toggleDebug = false;

  private gamepad: Gamepad | null = null;

  constructor() {
    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      if (e.code === 'KeyC') this.toggleCamera = true;
      if (e.code === 'KeyR') this.resetVehicle = true;
      if (e.code === 'Tab' || e.code === 'Backquote') {
        e.preventDefault();
        this.toggleDebug = true;
      }
    });
    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });

    window.addEventListener('gamepadconnected', (e) => {
      this.gamepad = navigator.getGamepads()[e.gamepad.index];
    });
    window.addEventListener('gamepaddisconnected', () => {
      this.gamepad = null;
    });
  }

  update(dt: number): void {
    const rampUp = 1 - Math.exp(-10 * dt);   // ~0.3s to full
    const rampDown = 1 - Math.exp(-15 * dt);  // ~0.2s to zero
    const steerUp = 1 - Math.exp(-8 * dt);
    const steerDown = 1 - Math.exp(-12 * dt);

    // Keyboard input
    const wantThrottle = (this.keys['KeyW'] || this.keys['ArrowUp']) ? 1 : 0;
    const wantBrake = (this.keys['KeyS'] || this.keys['ArrowDown']) ? 1 : 0;
    let wantSteer = 0;
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) wantSteer -= 1;
    if (this.keys['KeyD'] || this.keys['ArrowRight']) wantSteer += 1;

    // Gamepad override
    const gamepads = navigator.getGamepads();
    let gp: Gamepad | null = null;
    for (const g of gamepads) {
      if (g) { gp = g; break; }
    }
    if (gp) {
      // Right trigger = throttle, left trigger = brake
      const gpThrottle = gp.buttons[7]?.value ?? 0;
      const gpBrake = gp.buttons[6]?.value ?? 0;
      const gpSteer = Math.abs(gp.axes[0]) > 0.1 ? gp.axes[0] : 0;

      if (gpThrottle > 0.05 || gpBrake > 0.05 || Math.abs(gpSteer) > 0.05) {
        // Use gamepad values
        this.throttle = gpThrottle;
        this.brake = gpBrake;
        this.steer = gpSteer;
        this.handbrake = gp.buttons[0]?.pressed ?? false;
        return;
      }
    }

    // Smooth throttle
    if (wantThrottle > this.throttle) {
      this.throttle += (wantThrottle - this.throttle) * rampUp;
    } else {
      this.throttle += (wantThrottle - this.throttle) * rampDown;
    }

    // Smooth brake
    if (wantBrake > this.brake) {
      this.brake += (wantBrake - this.brake) * rampUp;
    } else {
      this.brake += (wantBrake - this.brake) * rampDown;
    }

    // Smooth steer
    if (Math.abs(wantSteer) > Math.abs(this.steer) || Math.sign(wantSteer) !== Math.sign(this.steer)) {
      this.steer += (wantSteer - this.steer) * steerUp;
    } else {
      this.steer += (wantSteer - this.steer) * steerDown;
    }

    this.handbrake = this.keys['Space'] ?? false;
  }

  consumeEvents(): { toggleCamera: boolean; resetVehicle: boolean; toggleDebug: boolean } {
    const events = {
      toggleCamera: this.toggleCamera,
      resetVehicle: this.resetVehicle,
      toggleDebug: this.toggleDebug,
    };
    this.toggleCamera = false;
    this.resetVehicle = false;
    this.toggleDebug = false;
    return events;
  }
}
