/**
 * 1€ Filter (One Euro Filter)
 * Reference: Casiez, G., Roussel, N. and Vogel, D. (2012).
 * 1 € filter: a simple speed-based low-pass filter for noisy input in human-computer interfaces.
 * ACM CHI 2012.
 */

class LowPassFilter {
  private y: number | null = null;
  private s: number | null = null;

  filter(value: number, alpha: number): number {
    if (this.y === null) {
      this.s = value;
      this.y = value;
      return value;
    }
    this.y = value;
    this.s = alpha * value + (1.0 - alpha) * (this.s as number);
    return this.s;
  }

  hasLast(): boolean {
    return this.y !== null;
  }

  last(): number {
    return this.y ?? 0;
  }

  reset() {
    this.y = null;
    this.s = null;
  }
}

export class OneEuroFilter {
  private minCutoff: number;
  private beta: number;
  private dCutoff: number;
  private xFilt: LowPassFilter;
  private dxFilt: LowPassFilter;
  private lastTime: number | null = null;

  constructor(minCutoff = 1.0, beta = 0.005, dCutoff = 1.0) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
    this.xFilt = new LowPassFilter();
    this.dxFilt = new LowPassFilter();
  }

  private alpha(cutoff: number, dt: number): number {
    const tau = 1.0 / (2.0 * Math.PI * cutoff);
    return 1.0 / (1.0 + tau / dt);
  }

  filter(value: number, timestamp: number): number {
    if (this.lastTime === null) {
      this.lastTime = timestamp;
      return this.xFilt.filter(value, 1.0);
    }

    let dt = (timestamp - this.lastTime) / 1000.0;
    this.lastTime = timestamp;

    if (dt <= 0.0) {
      dt = 0.001; // Avoid division by zero
    }

    const dx = this.xFilt.hasLast() ? (value - this.xFilt.last()) / dt : 0.0;
    const edx = this.dxFilt.filter(dx, this.alpha(this.dCutoff, dt));
    const cutoff = this.minCutoff + this.beta * Math.abs(edx);

    return this.xFilt.filter(value, this.alpha(cutoff, dt));
  }

  reset() {
    this.xFilt.reset();
    this.dxFilt.reset();
    this.lastTime = null;
  }
}

export interface Point3D {
  x: number;
  y: number;
  z: number;
}

export class OneEuroFilter3D {
  private filterX: OneEuroFilter;
  private filterY: OneEuroFilter;
  private filterZ: OneEuroFilter;

  constructor(minCutoff = 1.0, beta = 0.005, dCutoff = 1.0) {
    this.filterX = new OneEuroFilter(minCutoff, beta, dCutoff);
    this.filterY = new OneEuroFilter(minCutoff, beta, dCutoff);
    this.filterZ = new OneEuroFilter(minCutoff, beta, dCutoff);
  }

  filter(x: number, y: number, z: number, timestamp: number): Point3D {
    return {
      x: this.filterX.filter(x, timestamp),
      y: this.filterY.filter(y, timestamp),
      z: this.filterZ.filter(z, timestamp),
    };
  }

  reset() {
    this.filterX.reset();
    this.filterY.reset();
    this.filterZ.reset();
  }
}
