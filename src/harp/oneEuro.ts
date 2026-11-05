// The "one euro" filter: smooths a trembling reading, follows a fast one
// with little lag (its cut-off rises with the speed). Plain code.
export class OneEuro {
  private x: number | null = null;

  private dx = 0;

  private t = 0;

  constructor(
    private readonly minCutoff = 2,
    private readonly beta = 20,
    private readonly dCutoff = 8,
  ) {}

  private static alpha(cutoff: number, dt: number) {
    const tau = 1 / (2 * Math.PI * cutoff);
    return 1 / (1 + tau / dt);
  }

  push(t: number, x: number) {
    if (this.x === null || t <= this.t) {
      if (this.x === null) this.x = x;
      this.t = t;
      return this.x;
    }
    const dt = Math.min(0.2, t - this.t);
    this.t = t;
    const dxNow = (x - this.x) / dt;
    this.dx += (dxNow - this.dx) * OneEuro.alpha(this.dCutoff, dt);
    const cutoff = this.minCutoff + this.beta * Math.abs(this.dx);
    this.x += (x - this.x) * OneEuro.alpha(cutoff, dt);
    return this.x;
  }

  reset() {
    this.x = null;
    this.dx = 0;
  }
}
