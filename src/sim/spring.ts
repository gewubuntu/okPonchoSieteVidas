// GDD-WLD-05: springs. A spring tile is solid like a floor; standing on its top, by landing or by walking onto it, throws
// Poncho up at SPRING.velocity. Pure logic, no Phaser (GDD-TEC-02).
import { SPRING } from '../config/tuning';
import { standsOn } from './crumble';
import type { PlayerState } from './movement';
import type { TileGrid } from './tilemap';

/** The tile a spring stands in. */
export interface Spring {
  readonly col: number;
  readonly row: number;
}

/** The level's tiles plus the spring tiles. */
export function withSprings(world: TileGrid, springs: readonly Spring[]): TileGrid {
  if (springs.length === 0) return world;
  return { ...world, solidTile: (tx, ty) => world.solidTile(tx, ty) || springs.some((s) => s.col === tx && s.row === ty) };
}

/**
 * Poncho right after a step: if he stands on a spring he is launched at once, so he is never grounded on one for a
 * whole step. Releasing jump does not cut the launch short, and a held jump does not make it higher: it is always
 * SPRING.velocity.
 */
export function bounce(player: PlayerState, springs: readonly Spring[]): PlayerState {
  if (!springs.some((s) => standsOn(player, s))) return player;
  return { ...player, vy: -SPRING.velocity, grounded: false, coyote: 0, jumpBuffer: 0, bounced: true };
}
