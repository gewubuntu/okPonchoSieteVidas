import { STEP } from '../config/tuning';

/**
 * GDD-TEC-02: runs the simulation at a fixed rate whatever the display rate is.
 * Long frames (tab switch, slow device) are capped so the game never spirals.
 */
export class FixedStepper {
  private accumulator = 0;

  constructor(
    private readonly step: number = STEP,
    private readonly maxStepsPerFrame = 5,
  ) {}

  /** Feeds one rendered frame. Returns the render interpolation factor in [0, 1). */
  advance(frameSeconds: number, tick: () => void): number {
    this.accumulator += Math.min(Math.max(frameSeconds, 0), this.step * this.maxStepsPerFrame);
    while (this.accumulator >= this.step) {
      tick();
      this.accumulator -= this.step;
    }
    return this.accumulator / this.step;
  }

  reset(): void {
    this.accumulator = 0;
  }
}
