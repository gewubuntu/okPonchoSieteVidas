// GDD-UI-01 and GDD-LIFE-01: where the seven life triangles go and which are filled. Pure data, no Phaser,
// so the HUD can be unit tested. The scene draws whatever this returns.
import { LIVES_MAX } from '../config/tuning';
import { pulsedPoints } from './lastLife';

/** A triangle's three corners, six numbers in game pixels. */
export type TrianglePoints = readonly [x1: number, y1: number, x2: number, y2: number, x3: number, y3: number];

export interface LifeTriangle {
  /** Apex (top), then bottom-left, then bottom-right, in game pixels. */
  readonly points: TrianglePoints;
  /** Filled = a life left. Outline only = a life lost (GDD-UI-03: not told apart by colour alone). */
  readonly filled: boolean;
}

/**
 * Top-left corner of the HUD and the size of one triangle, in game pixels (GDD-UI-01), and the dark line just outside each triangle's
 * edge, the boss bar's stroke colour (`BOSS_BAR.nameStroke`), 1 px wide.
 */
export const LIVES_HUD = { left: 8, top: 8, width: 10, height: 9, gap: 3, outline: { colour: 0x2a1f2e, px: 1 } } as const;

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

/**
 * GDD-UI-01: a triangle (six numbers, three corners) grown outward by `px` on every side: each edge moved out along its normal by `px`, the
 * corners where the moved edges meet, in the same order.
 */
export function outlinePoints(points: readonly number[], px: number): TrianglePoints {
  const corner = (i: number) => [points[2 * (i % 3)]!, points[2 * (i % 3) + 1]!] as const;
  // Each edge i, from corner i to corner i + 1, as a point on it moved out and its direction.
  const moved = [0, 1, 2].map((i) => {
    const [ax, ay] = corner(i);
    const [bx, by] = corner(i + 1);
    const [cx, cy] = corner(i + 2);
    const len = Math.hypot(bx - ax, by - ay);
    let [nx, ny] = [(by - ay) / len, -(bx - ax) / len];
    // The normal points away from the third corner.
    if (nx * (cx - ax) + ny * (cy - ay) > 0) [nx, ny] = [-nx, -ny];
    return { x: ax + nx * px, y: ay + ny * px, dx: bx - ax, dy: by - ay };
  });
  // Corner i is where the moved edges i - 1 and i meet.
  const meet = (i: number): [number, number] => {
    const e = moved[(i + 2) % 3]!;
    const f = moved[i]!;
    const t = ((f.x - e.x) * f.dy - (f.y - e.y) * f.dx) / (e.dx * f.dy - e.dy * f.dx);
    return [e.x + e.dx * t, e.y + e.dy * t];
  };
  return [...meet(0), ...meet(1), ...meet(2)];
}

/**
 * GDD-UI-01, GDD-LIFE-04: a life triangle as the HUD draws it, pulsed to `pulse` times its size (null: at rest), and its dark outline grown
 * from that, so the pulsing triangle's outline grows with it.
 */
export function drawnLife(triangle: LifeTriangle, pulse: number | null): { points: TrianglePoints; outline: TrianglePoints } {
  const points = pulse === null ? triangle.points : six(pulsedPoints(triangle, pulse));
  return { points, outline: outlinePoints(points, LIVES_HUD.outline.px) };
}

/** Six numbers as a triangle's corners. */
const six = (p: readonly number[]): TrianglePoints => [p[0]!, p[1]!, p[2]!, p[3]!, p[4]!, p[5]!];
