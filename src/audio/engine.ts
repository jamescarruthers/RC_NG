import { Vehicle } from '../physics/vehicle';
import { ENGINE } from '../utils/constants';

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private osc1: OscillatorNode | null = null;
  private osc2: OscillatorNode | null = null;
  private gainNode: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;

  // Tire screech
  private noiseSource: AudioBufferSourceNode | null = null;
  private screechGain: GainNode | null = null;
  private screechFilter: BiquadFilterNode | null = null;

  private started = false;

  init(): void {
    if (this.started) return;

    try {
      this.ctx = new AudioContext();

      // Engine oscillators
      this.gainNode = this.ctx.createGain();
      this.gainNode.gain.value = 0;

      this.filter = this.ctx.createBiquadFilter();
      this.filter.type = 'lowpass';
      this.filter.frequency.value = 800;
      this.filter.Q.value = 2;

      this.osc1 = this.ctx.createOscillator();
      this.osc1.type = 'sawtooth';
      this.osc1.frequency.value = 80;

      this.osc2 = this.ctx.createOscillator();
      this.osc2.type = 'sawtooth';
      this.osc2.frequency.value = 40;

      const gain2 = this.ctx.createGain();
      gain2.gain.value = 0.6;

      this.osc1.connect(this.gainNode);
      this.osc2.connect(gain2);
      gain2.connect(this.gainNode);
      this.gainNode.connect(this.filter);
      this.filter.connect(this.ctx.destination);

      this.osc1.start();
      this.osc2.start();

      // Tire screech - white noise
      this.screechGain = this.ctx.createGain();
      this.screechGain.gain.value = 0;

      this.screechFilter = this.ctx.createBiquadFilter();
      this.screechFilter.type = 'bandpass';
      this.screechFilter.frequency.value = 3000;
      this.screechFilter.Q.value = 5;

      // Create noise buffer
      const bufferSize = this.ctx.sampleRate * 2;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      this.noiseSource = this.ctx.createBufferSource();
      this.noiseSource.buffer = buffer;
      this.noiseSource.loop = true;
      this.noiseSource.connect(this.screechFilter);
      this.screechFilter.connect(this.screechGain);
      this.screechGain.connect(this.ctx.destination);
      this.noiseSource.start();

      this.started = true;
    } catch {
      // Audio not available
    }
  }

  update(vehicle: Vehicle): void {
    if (!this.ctx || !this.started) return;

    // Resume context on user interaction
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    const rpm = vehicle.engineRPM;
    const throttle = vehicle.throttle;

    // Map RPM to frequency (60-200 Hz base)
    const freq = 40 + (rpm / ENGINE.redline) * 180;
    if (this.osc1) this.osc1.frequency.value = freq;
    if (this.osc2) this.osc2.frequency.value = freq * 0.5;

    // Gain based on throttle and RPM
    const baseGain = 0.03 + throttle * 0.07;
    if (this.gainNode) {
      this.gainNode.gain.value += (baseGain - this.gainNode.gain.value) * 0.1;
    }

    // Filter cutoff opens with RPM
    if (this.filter) {
      this.filter.frequency.value = 400 + (rpm / ENGINE.redline) * 2000;
    }

    // Tire screech
    if (this.screechGain) {
      let maxSlip = 0;
      for (let i = 0; i < 4; i++) {
        const slip = vehicle.tires.states[i].combinedSlip;
        if (slip > maxSlip) maxSlip = slip;
      }
      const screechTarget = maxSlip > 0.2 ? Math.min((maxSlip - 0.2) * 0.8, 0.15) : 0;
      this.screechGain.gain.value += (screechTarget - this.screechGain.gain.value) * 0.1;
    }
  }
}
