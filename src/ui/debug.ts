import { Vehicle } from '../physics/vehicle';

interface DebugParam {
  label: string;
  get: () => number;
  set: (v: number) => void;
  min: number;
  max: number;
  step: number;
}

const STORAGE_KEY = 'drivesim_debug_params';

export class DebugPanel {
  private panel: HTMLElement;
  private visible = false;
  private params: DebugParam[] = [];
  private vehicle: Vehicle;

  constructor(vehicle: Vehicle) {
    this.vehicle = vehicle;
    this.panel = document.getElementById('debug-panel')!;
    this.buildPanel();
    this.loadFromStorage();
  }

  toggle(): void {
    this.visible = !this.visible;
    this.panel.classList.toggle('visible', this.visible);
  }

  private buildPanel(): void {
    const v = this.vehicle;
    const sections: { title: string; params: DebugParam[] }[] = [
      {
        title: 'Suspension - Front',
        params: [
          { label: 'Spring Rate', get: () => v.suspension.params.front.springRate, set: (x) => v.suspension.params.front.springRate = x, min: 10000, max: 80000, step: 1000 },
          { label: 'Damp Comp', get: () => v.suspension.params.front.dampingCompression, set: (x) => v.suspension.params.front.dampingCompression = x, min: 500, max: 10000, step: 100 },
          { label: 'Damp Rebound', get: () => v.suspension.params.front.dampingRebound, set: (x) => v.suspension.params.front.dampingRebound = x, min: 500, max: 10000, step: 100 },
          { label: 'Anti-Roll', get: () => v.suspension.params.front.antiRollRate, set: (x) => v.suspension.params.front.antiRollRate = x, min: 0, max: 20000, step: 500 },
        ],
      },
      {
        title: 'Suspension - Rear',
        params: [
          { label: 'Spring Rate', get: () => v.suspension.params.rear.springRate, set: (x) => v.suspension.params.rear.springRate = x, min: 10000, max: 80000, step: 1000 },
          { label: 'Damp Comp', get: () => v.suspension.params.rear.dampingCompression, set: (x) => v.suspension.params.rear.dampingCompression = x, min: 500, max: 10000, step: 100 },
          { label: 'Damp Rebound', get: () => v.suspension.params.rear.dampingRebound, set: (x) => v.suspension.params.rear.dampingRebound = x, min: 500, max: 10000, step: 100 },
          { label: 'Anti-Roll', get: () => v.suspension.params.rear.antiRollRate, set: (x) => v.suspension.params.rear.antiRollRate = x, min: 0, max: 20000, step: 500 },
        ],
      },
      {
        title: 'Tires',
        params: [
          { label: 'Peak Mu', get: () => v.tires.peakMu, set: (x) => v.tires.peakMu = x, min: 0.3, max: 2.0, step: 0.05 },
          { label: 'Pacejka B', get: () => v.tires.pacejkaB, set: (x) => v.tires.pacejkaB = x, min: 2, max: 20, step: 0.5 },
          { label: 'Pacejka C (lat)', get: () => v.tires.pacejkaCLat, set: (x) => v.tires.pacejkaCLat = x, min: 1.0, max: 3.0, step: 0.05 },
          { label: 'Pacejka C (long)', get: () => v.tires.pacejkaCLong, set: (x) => v.tires.pacejkaCLong = x, min: 1.0, max: 3.0, step: 0.05 },
          { label: 'Pacejka E', get: () => v.tires.pacejkaE, set: (x) => v.tires.pacejkaE = x, min: 0.5, max: 1.0, step: 0.01 },
        ],
      },
      {
        title: 'Camera',
        params: [
          // Populated externally if needed
        ],
      },
    ];

    let html = '';
    for (const section of sections) {
      if (section.params.length === 0) continue;
      html += `<div class="debug-section">`;
      html += `<div class="debug-section-title">${section.title}</div>`;
      for (const p of section.params) {
        this.params.push(p);
        const idx = this.params.length - 1;
        html += `<div class="debug-row">
          <label>${p.label}</label>
          <input type="range" min="${p.min}" max="${p.max}" step="${p.step}" value="${p.get()}" data-idx="${idx}">
          <span class="debug-val" data-val-idx="${idx}">${p.get()}</span>
        </div>`;
      }
      html += `</div>`;
    }

    this.panel.innerHTML = html;

    // Bind events
    this.panel.querySelectorAll('input[type="range"]').forEach((input) => {
      const el = input as HTMLInputElement;
      el.addEventListener('input', () => {
        const idx = parseInt(el.dataset.idx!);
        const val = parseFloat(el.value);
        this.params[idx].set(val);
        const valEl = this.panel.querySelector(`[data-val-idx="${idx}"]`) as HTMLElement;
        if (valEl) valEl.textContent = val.toString();
        this.saveToStorage();
      });
    });
  }

  private saveToStorage(): void {
    const data: Record<string, number> = {};
    for (let i = 0; i < this.params.length; i++) {
      data[`p${i}`] = this.params[i].get();
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch { /* ignore */ }
  }

  private loadFromStorage(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      for (let i = 0; i < this.params.length; i++) {
        const key = `p${i}`;
        if (data[key] !== undefined) {
          this.params[i].set(data[key]);
          // Update slider
          const slider = this.panel.querySelector(`[data-idx="${i}"]`) as HTMLInputElement;
          if (slider) slider.value = data[key].toString();
          const valEl = this.panel.querySelector(`[data-val-idx="${i}"]`) as HTMLElement;
          if (valEl) valEl.textContent = data[key].toString();
        }
      }
    } catch { /* ignore */ }
  }
}
