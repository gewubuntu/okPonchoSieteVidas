// GDD-UI-01 and GDD-LIFE-01: where the seven life triangles go and which are filled. Pure data, no Phaser,
// so the HUD can be unit tested. The scene draws whatever this returns.
import { LIVES_MAX } from '../config/tuning';

export interface LifeTriangle {
  /** Apex (top), then bottom-left, then bottom-right, in game pixels. */
  readonly points: readonly [x1: number, y1: number, x2: number, y2: number, x3: number, y3: number];
  /** Filled = a life left. Outline only = a life lost (GDD-UI-03: not told apart by colour alone). */
  readonly filled: boolean;
}

/** Top-left corner of the HUD and the size of one triangle, in game pixels (GDD-UI-01). */
export const LIVES_HUD = { left: 8, top: 8, width: 10, height: 9, gap: 3 } as const;

/**
 * Seven triangles left to right. Lives fill from the left, so a lost life empties the rightmost filled one.
 * Out-of-range or fractional input is clamped so the HUD can never show more than seven or fewer than zero.
 */
export function layoutLives(lives: number, max: number = LIVES_MAX): LifeTriangle[] {
  const filledCount = Math.max(0, Math.min(max, Math.floor(lives)));
  const { left, top, width, height, gap } = LIVES_HUD;
  return Array.from({ length: max }, (_, i) => {
    const x = left + i * (width + gap);
    return {
      points: [x + width / 2, top, x, top + height, x + width, top + height],
      filled: i < filledCount,
    };
  });
}
