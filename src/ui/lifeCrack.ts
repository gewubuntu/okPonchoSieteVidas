// GDD-LIFE-02: when a life is lost, its triangle on the HUD cracks and fades to an outline over 0.4 s. Pure data and
// timing, counted in simulation steps, no Phaser, so it can be unit tested. The scene draws what this returns.
import { LIFE_LOSS } from '../config/tuning';
import type { LifeTriangle } from './livesLayout';

/** One triangle that is cracking: its place in the row and the step on which it started. */
export interface Crack {
  readonly index: number;
  readonly start: number;
}

export interface CrackFrame {
  /** How much of the red fill is still drawn, 1 to 0. */
  readonly fillAlpha: number;
  /** How visible the crack line is: it appears quickly, then fades with the fill. */
  readonly crackAlpha: number;
}

/**
 * The cracks running now, after the lives went from `previous` to `lives` on step `now`. Lives fill from the left, so
 * the triangles that were just lost are the ones from `lives` up to `previous - 1`. Finished cracks are dropped, and so
 * are cracks on triangles that are filled again.
 */
export function updateCracks(cracks: readonly Crack[], previous: number, lives: number, now: number): Crack[] {
  const running = cracks.filter((c) => c.index >= lives && crackFrame(c, now) !== null);
  const added: Crack[] = [];
  for (let index = lives; index < previous; index++) added.push({ index, start: now });
  return [...running, ...added];
}

/** The picture for a crack on step `now`, or null when it has not started or is over. */
export function crackFrame(crack: Crack, now: number): CrackFrame | null {
  const steps = now - crack.start;
  if (steps < 0 || steps >= LIFE_LOSS.crackSteps) return null;
  const p = steps / LIFE_LOSS.crackSteps;
  return { fillAlpha: 1 - p, crackAlpha: p < 0.2 ? p / 0.2 : 1 - (p - 0.2) / 0.8 };
}

/** A zigzag from the apex to the base of a triangle, as x, y pairs, staying inside it. */
export function crackLine(triangle: LifeTriangle): number[] {
  const [ax, ay, bx, by, cx] = triangle.points;
  const h = by - ay;
  const w = cx - bx;
  return [ax, ay, ax - w * 0.1, ay + h * 0.35, ax + w * 0.08, ay + h * 0.6, ax - w * 0.04, by];
}
