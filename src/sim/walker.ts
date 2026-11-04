// GDD-ENM-02, GDD-ENM-03, GDD-MOV-09: how an enemy walks along the ground: the Alacrán, the Tlacuache, the Paloma (also along a cordel,
// GDD-WLD-11) and the Trompo. Pure logic, no Phaser (GDD-TEC-02).
import { STEP, TILE } from '../config/tuning';
import type { PlatformPos } from './platform';
import { boxBlocked, isGround, stepDown, stepUp } from './slope';
import type { TileGrid } from './tilemap';

const EDGE = 1e-6;

export const turn = (dir: 1 | -1): 1 | -1 => (dir > 0 ? -1 : 1);

/** Where a walker is after a step of `walk`: the middle of it, its feet, the way it faces, and whether it turned round. */
export interface Walked {
  readonly x: number;
  readonly y: number;
  readonly dir: 1 | -1;
  readonly turned: boolean;
}

/** GDD-WLD-11: is there a top (a cordel's) level with the feet `y` under the point `x`? */
const onTop = (tops: readonly PlatformPos[], x: number, y: number): boolean => tops.some((t) => Math.abs(t.y - y) < EDGE && x >= t.x - EDGE && x <= t.x + t.w + EDGE);

/**
 * Moves a walker `width` x `height` px, the middle of its feet at (`x`, `feet`), `speed` px/s the way it faces. Its feet follow the ground
 * up and down slopes by up to SLOPE.stepPx a step (GDD-MOV-09); a higher rise (a slope's high side) turns it like a wall. It turns round
 * when its box meets a wall (flush against it), and when the ground under its leading edge ends (no level tile and no slope in the row of
 * its feet or the row below, and no top in `tops` level with its feet), so it never walks off a ledge or the end of a cordel (GDD-ENM-02,
 * GDD-ENM-03).
 */
export function walk(world: TileGrid, x0: number, feet: number, dir: 1 | -1, size: { readonly width: number; readonly height: number }, speed: number, tops: readonly PlatformPos[] = []): Walked {
  const half = size.width / 2;
  const x = x0 + dir * speed * STEP;
  const up = stepUp(world, x, feet);
  if (up === 'wall') return { x: x0, y: feet, dir: turn(dir), turned: true };
  const y = up ?? stepDown(world, x, feet) ?? feet;
  if (boxBlocked(world, x, y, size.width, size.height)) {
    const flush = dir > 0 ? Math.floor((x + half - EDGE) / TILE) * TILE - half : (Math.floor((x - half) / TILE) + 1) * TILE + half;
    return { x: flush, y: feet, dir: turn(dir), turned: true };
  }
  // The ground under its leading edge: a level tile or a slope in the row of its feet or the row below (GDD-MOV-09), or a cordel's top.
  const lead = x + dir * (half - EDGE);
  const col = Math.floor(lead / TILE);
  const row = Math.floor((y - EDGE) / TILE);
  const ground = isGround(world, col, row) || isGround(world, col, row + 1) || onTop(tops, lead, y);
  return ground ? { x, y, dir, turned: false } : { x: x0, y: feet, dir: turn(dir), turned: true };
}
