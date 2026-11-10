// GDD-PWR-02 and GDD-PWR-06: a taco released from a piñata walks away along the ground (up and down sand slopes, GDD-MOV-09), turns at walls and falls off
// ledges, like a Mario mushroom. Pure logic, no Phaser (GDD-TEC-02).
import { GRAVITY, HITBOX, STEP, TACO, TILE } from '../config/tuning';
import type { PlayerState } from './movement';
import { boxBlocked, groundTop, stepDown, stepUp } from './slope';
import type { ItemKind } from './taco';
import type { Pinata } from './pinata';
import type { TileGrid } from './tilemap';

export interface Item {
  /** Middle of the item, and the y of its feet, like Poncho's own position. */
  readonly x: number;
  readonly y: number;
  readonly vx: number;
  readonly vy: number;
  /** A taco walks, a chile and the Chile Fantasma stay where they are (GDD-PWR-03, GDD-PWR-04). */
  readonly kind: ItemKind;
}

const HALF = TACO.size / 2;
const EDGE = 1e-6;

/** Does a `size` px square, centred on x with its feet at y, overlap a level tile? Slopes count as GDD-MOV-09 says (see `boxBlocked`). */
export const squareBlocked = (world: TileGrid, x: number, y: number, size: number): boolean => boxBlocked(world, x, y, size, size);

const blockedAt = (world: TileGrid, x: number, y: number): boolean => squareBlocked(world, x, y, TACO.size);

/**
 * The item a piñata releases: standing on top of it, a taco heading right and a chile or a Chile Fantasma staying put, or null if there is
 * no room (a wall or another block in the way), so an item is never placed inside a wall (GDD-PWR-06).
 */
export function releaseFrom(p: Pinata, world: TileGrid, kind: ItemKind): Item | null {
  const x = p.col * TILE + TILE / 2;
  const y = p.row * TILE;
  return blockedAt(world, x, y) ? null : { x, y, vx: kind === 'taco' ? TACO.walkSpeed : 0, vy: 0, kind };
}

/** Advances one fixed step: gravity, then one axis at a time, turning round when it meets a wall. It follows slopes (GDD-MOV-09). */
export function stepItem(item: Item, world: TileGrid): Item {
  let { x, y, vx, vy } = item;
  // GDD-MOV-09: standing (it landed on the step before, or was just released) it follows the ground down a slope.
  const standing = vy === 0;
  const fromX = x;
  const fromY = y;
  x += vx * STEP;
  // GDD-MOV-09: feet moved into the ground step up onto it by up to SLOPE.stepPx; a higher rise (a slope's high side) turns it like a wall.
  const up = stepUp(world, x, y);
  if (up === 'wall') {
    x = fromX;
    vx = -vx;
  } else {
    if (up !== null) y = up;
    if (blockedAt(world, x, y)) {
      if (up !== null) {
        // GDD-MOV-09: a step up that puts it into a tile (a ceiling over a slope) is not taken.
        x = fromX;
        y = fromY;
      } else {
        x = vx > 0 ? Math.floor((x + HALF - EDGE) / TILE) * TILE - HALF : (Math.floor((x - HALF) / TILE) + 1) * TILE + HALF;
      }
      vx = -vx;
    }
  }
  const vy1 = Math.min(vy + GRAVITY.falling * STEP, GRAVITY.terminalVelocity);
  y += ((vy + vy1) / 2) * STEP;
  vy = vy1;
  if (blockedAt(world, x, y)) {
    y = Math.floor((y - EDGE) / TILE) * TILE;
    vy = 0;
  }
  // GDD-MOV-09: feet in the ground after the fall (below a slope's surface) are put on its top.
  const top = groundTop(world, x, y);
  if (top !== null) {
    y = top;
    vy = 0;
  }
  // GDD-MOV-09: standing at the start of the step and not landed, feet that left the ground by up to SLOPE.stepPx are put back on it.
  if (standing && vy !== 0) {
    const down = stepDown(world, x, y);
    if (down !== null) {
      y = down;
      vy = 0;
    }
  }
  return { x, y, vx, vy, kind: item.kind };
}

/** Whether Poncho's body box overlaps the item's box (GDD-PWR-06). Boxes that only share an edge do not touch. */
export function touchesItem(player: PlayerState, item: Item): boolean {
  return (
    Math.abs(player.x - item.x) < (HITBOX.width + TACO.size) / 2 &&
    player.y > item.y - TACO.size &&
    player.y - HITBOX.height < item.y
  );
}
