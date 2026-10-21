// GDD-PWR-05: piñata blocks. A piñata is a solid tile; hitting it from below with the head opens it once, and it stays
// solid as a broken shell. Pure logic, no Phaser (GDD-TEC-02).
import { HITBOX, TILE } from '../config/tuning';
import type { PlayerState } from './movement';
import type { TileGrid } from './tilemap';

/** The tile a piñata hangs in. */
export interface Pinata {
  readonly col: number;
  readonly row: number;
}

/** GDD-PWR-05: every piñata starts closed: one flag per piñata, true once it is open. */
export const freshPinatas = (pinatas: readonly Pinata[]): readonly boolean[] => pinatas.map(() => false);

/** The level's tiles plus the piñata tiles, which are solid whether closed or open. */
export function withPinatas(world: TileGrid, pinatas: readonly Pinata[]): TileGrid {
  if (pinatas.length === 0) return world;
  return { ...world, solidTile: (tx, ty) => world.solidTile(tx, ty) || pinatas.some((p) => p.col === tx && p.row === ty) };
}

/**
 * Which piñata (by position in the list) the head of Poncho has just bumped, or -1. A bump is a step that ends with his
 * head flush against the underside of the tile after he was rising, so it never counts when he only stands or walks under
 * one, or when corner correction slides him past the edge. The body box has to overlap the tile's column; if it
 * overlaps two (two neighbouring piñatas), the one whose middle is nearer his own wins.
 */
export function bumpedPinata(before: PlayerState, after: PlayerState, pinatas: readonly Pinata[]): number {
  if (before.vy >= 0 || after.vy !== 0) return -1;
  const head = after.y - HITBOX.height;
  let best = -1;
  let bestDistance = Infinity;
  pinatas.forEach((p, i) => {
    const distance = Math.abs(after.x - (p.col * TILE + TILE / 2));
    if (Math.abs(head - (p.row + 1) * TILE) > 1e-6 || distance >= (HITBOX.width + TILE) / 2) return;
    if (distance < bestDistance) {
      best = i;
      bestDistance = distance;
    }
  });
  return best;
}
