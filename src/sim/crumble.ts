// GDD-WLD-05: crumbling tiles. Solid like a floor until Poncho has stood on one for 0.5 s, then gone until he loses a life.
// Pure logic, no Phaser (GDD-TEC-02).
import { CRUMBLE, HITBOX, TILE } from '../config/tuning';
import type { PlayerState } from './movement';
import type { TileGrid } from './tilemap';

/** The tile a crumbling ledge stands in. Each tile crumbles on its own. */
export interface Crumble {
  readonly col: number;
  readonly row: number;
}

export interface CrumbleState {
  readonly phase: 'idle' | 'warning' | 'gone';
  /** Steps of warning left. Only used while warning. */
  readonly steps: number;
}

const IDLE: CrumbleState = { phase: 'idle', steps: 0 };

/** Every tile whole again, as at the start of the level and after a life is lost (GDD-LIFE-02). */
export const freshCrumbles = (crumbles: readonly Crumble[]): CrumbleState[] => crumbles.map(() => IDLE);

/** The level's tiles plus the crumbling ones that have not gone yet. */
export function withCrumbles(world: TileGrid, crumbles: readonly Crumble[], states: readonly CrumbleState[]): TileGrid {
  if (crumbles.length === 0) return world;
  return {
    ...world,
    solidTile: (tx, ty) =>
      world.solidTile(tx, ty) || crumbles.some((c, i) => c.col === tx && c.row === ty && states[i]?.phase !== 'gone'),
  };
}

/** Is Poncho standing on the top of this tile? His body box overlaps the tile's column, and his feet are on its top. */
export function standsOn(player: PlayerState, c: Crumble): boolean {
  return player.grounded && player.y === c.row * TILE && Math.abs(player.x - (c.col * TILE + TILE / 2)) < (HITBOX.width + TILE) / 2;
}

/**
 * Advances every tile one step. Landing on an idle tile starts its warning with the full 0.5 s; from then on it counts
 * down on its own, even if Poncho walks off, and the tile is gone when it reaches 0.
 */
export function stepCrumbles(crumbles: readonly Crumble[], states: readonly CrumbleState[], player: PlayerState): CrumbleState[] {
  return crumbles.map((c, i) => {
    const s = states[i] ?? IDLE;
    if (s.phase === 'idle') return standsOn(player, c) ? { phase: 'warning', steps: CRUMBLE.warningSteps } : s;
    if (s.phase === 'warning') return s.steps <= 1 ? { phase: 'gone', steps: 0 } : { phase: 'warning', steps: s.steps - 1 };
    return s;
  });
}
