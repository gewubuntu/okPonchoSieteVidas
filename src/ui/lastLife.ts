// GDD-LIFE-04: with exactly one life left, the last triangle on the HUD pulses. Pure timing and geometry, counted in
// simulation steps, no Phaser, so it pauses with the game and can be unit tested. The scene draws what this returns.
import { LAST_LIFE } from '../config/tuning';
import type { LifeTriangle } from './livesLayout';

/**
 * How large the last triangle is drawn `steps` steps after the lives dropped to one, 1 to LAST_LIFE.pulseScale, or null
 * when it does not pulse. Counting from that step makes every pulse start at its normal size and grow smoothly.
 */
export function lastLifePulse(lives: number, steps: number): number | null {
  if (lives !== 1) return null;
  const phase = (steps % LAST_LIFE.pulseSteps) / LAST_LIFE.pulseSteps;
  return 1 + (LAST_LIFE.pulseScale - 1) * (1 - Math.cos(2 * Math.PI * phase)) / 2;
}

/** The triangle's points scaled about its centre. */
export function pulsedPoints(triangle: LifeTriangle, scale: number): number[] {
  const p = triangle.points;
  const cx = (p[0] + p[2] + p[4]) / 3;
  const cy = (p[1] + p[3] + p[5]) / 3;
  return p.map((v, i) => (i % 2 === 0 ? cx + (v - cx) * scale : cy + (v - cy) * scale));
}

/**
 * The step the current pulse started on: kept while one life is left, set to `now` on the step the lives drop to one, and
 * cleared at any other count, so every drop to one (also a second one, after a life came back) starts a fresh pulse.
 */
export function updatePulseStart(start: number | null, lives: number, now: number): number | null {
  if (lives !== 1) return null;
  return start ?? now;
}
