// GDD-PWR-02 and GDD-PWR-06: a taco released from a piñata walks away along the ground, turns at walls and falls off
// ledges, like a Mario mushroom. Pure logic, no Phaser (GDD-TEC-02).
import { GRAVITY, HITBOX, STEP, TACO, TILE } from '../config/tuning';
import type { PlayerState } from './movement';
import type { Pinata } from './pinata';
import type { TileGrid } from './tilemap';

export interface Item {
  /** Middle of the item, and the y of its feet, like Poncho's own position. */
  readonly x: number;
  readonly y: number;
  readonly vx: number;
  readonly vy: number;
}

const HALF = TACO.size / 2;
const EDGE = 1e-6;

/** Does a TACO.size square with its feet at (x, y) overlap a solid tile? */
function blockedAt(world: TileGrid, x: number, y: number): boolean {
  const left = Math.floor((x - HALF) / TILE);
  const right = Math.floor((x + HALF - EDGE) / TILE);
  const top = Math.floor((y - TACO.size) / TILE);
  const bottom = Math.floor((y - EDGE) / TILE);
  for (let ty = top; ty <= bottom; ty++) {
    for (let tx = left; tx <= right; tx++) if (world.solidTile(tx, ty)) return true;
  }
  return false;
}

/**
 * The taco a piñata releases: standing on top of it, heading right, or null if there is no room (a wall or another
 * block in the way), so an item is never placed inside a wall (GDD-PWR-06).
 */
export function releaseFrom(p: Pinata, world: TileGrid): Item | null {
  const x = p.col * TILE + TILE / 2;
  const y = p.row * TILE;
  return blockedAt(world, x, y) ? null : { x, y, vx: TACO.walkSpeed, vy: 0 };
}

/** Advances one fixed step: gravity, then one axis at a time, turning round when it meets a wall. */
export function stepItem(item: Item, world: TileGrid): Item {
  let { x, y, vx, vy } = item;
  x += vx * STEP;
  if (blockedAt(world, x, y)) {
    x = vx > 0 ? Math.floor((x + HALF - EDGE) / TILE) * TILE - HALF : (Math.floor((x - HALF) / TILE) + 1) * TILE + HALF;
    vx = -vx;
  }
  const vy1 = Math.min(vy + GRAVITY.falling * STEP, GRAVITY.terminalVelocity);
  y += ((vy + vy1) / 2) * STEP;
  vy = vy1;
  if (blockedAt(world, x, y)) {
    y = Math.floor((y - EDGE) / TILE) * TILE;
    vy = 0;
  }
  return { x, y, vx, vy };
}

/** Whether Poncho's body box overlaps the item's box (GDD-PWR-06). Boxes that only share an edge do not touch. */
export function touchesItem(player: PlayerState, item: Item): boolean {
  return (
    Math.abs(player.x - item.x) < (HITBOX.width + TACO.size) / 2 &&
    player.y > item.y - TACO.size &&
    player.y - HITBOX.height < item.y
  );
}
