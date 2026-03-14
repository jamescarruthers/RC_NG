import { Vehicle } from '../physics/vehicle';
import { ENGINE } from '../utils/constants';

export class HUD {
  private speedEl: HTMLElement;
  private gearEl: HTMLElement;
  private rpmBar: HTMLElement;
  private suspBars: HTMLElement[] = [];
  private slipDots: HTMLElement[] = [];
  private gforceDot: HTMLElement;

  constructor() {
    this.speedEl = document.getElementById('speed-display')!;
    this.gearEl = document.getElementById('gear-display')!;
    this.rpmBar = document.getElementById('rpm-bar')!;
    this.gforceDot = document.getElementById('gforce-dot')!;

    const wheelIds = ['fl', 'fr', 'rl', 'rr'];
    for (const id of wheelIds) {
      this.suspBars.push(document.getElementById(`susp-${id}`)!);
      this.slipDots.push(document.getElementById(`slip-${id}`)!);
    }
  }

  update(vehicle: Vehicle): void {
    // Speed
    const speedKmh = Math.round(vehicle.getSpeedKmh());
    this.speedEl.innerHTML = `${speedKmh} <span id="speed-unit">km/h</span>`;

    // Gear
    this.gearEl.textContent = `${vehicle.currentGear + 1}`;

    // RPM bar
    const rpmFrac = Math.min(vehicle.engineRPM / ENGINE.redline, 1);
    this.rpmBar.style.width = `${rpmFrac * 100}%`;
    if (vehicle.engineRPM > ENGINE.redline * 0.85) {
      this.rpmBar.style.backgroundColor = '#f44';
    } else if (vehicle.engineRPM > ENGINE.redline * 0.6) {
      this.rpmBar.style.backgroundColor = '#fa4';
    } else {
      this.rpmBar.style.backgroundColor = '#4f4';
    }

    // Suspension bars + slip dots
    for (let i = 0; i < 4; i++) {
      const contact = vehicle.suspension.contacts[i];
      const p = i < 2
        ? vehicle.suspension.params.front
        : vehicle.suspension.params.rear;

      // Suspension compression ratio
      const compRatio = contact.compression / p.maxTravel;
      this.suspBars[i].style.height = `${compRatio * 100}%`;

      if (compRatio > 0.8) {
        this.suspBars[i].style.backgroundColor = '#f44';
      } else if (compRatio > 0.5) {
        this.suspBars[i].style.backgroundColor = '#fa4';
      } else {
        this.suspBars[i].style.backgroundColor = '#4af';
      }

      // Slip indicators
      const slip = vehicle.tires.states[i].combinedSlip;
      if (slip > 0.3) {
        this.slipDots[i].style.backgroundColor = '#f44';
      } else if (slip > 0.1) {
        this.slipDots[i].style.backgroundColor = '#fa4';
      } else {
        this.slipDots[i].style.backgroundColor = '#4f4';
      }
    }

    // G-force dot
    const gx = Math.max(-2, Math.min(2, vehicle.gForce.x));
    const gy = Math.max(-2, Math.min(2, vehicle.gForce.y));
    const dotX = 50 + (gx / 2) * 40; // percentage
    const dotY = 50 - (gy / 2) * 40;
    this.gforceDot.style.left = `${dotX}%`;
    this.gforceDot.style.top = `${dotY}%`;
  }
}
