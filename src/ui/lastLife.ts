// GDD-LIFE-04: with exactly one life left, the last triangle on the HUD pulses. Pure timing and geometry, counted in
// simulation steps, no Phaser, so it pauses with the game and can be unit tested. The scene draws what this returns.
import { LAST_LIFE } from '../config/tuning';
import type { LifeTriangle } from './livesLayout';

/** How large the last triangle is drawn on step `now`, 1 to LAST_LIFE.pulseScale, or null when it does not pulse. */
export function lastLifePulse(lives: number, now: number): number | null {
  if (lives !== 1) return null;
  const phase = (now % LAST_LIFE.pulseSteps) / LAST_LIFE.pulseSteps;
  return 1 + (LAST_LIFE.pulseScale - 1) * (1 - Math.cos(2 * Math.PI * phase)) / 2;
}

/** The triangle's points scaled about its centre. */
export function pulsedPoints(triangle: LifeTriangle, scale: number): number[] {
  const p = triangle.points;
  const cx = (p[0] + p[2] + p[4]) / 3;
  const cy = (p[1] + p[3] + p[5]) / 3;
  return p.map((v, i) => (i % 2 === 0 ? cx + (v - cx) * scale : cy + (v - cy) * scale));
}
