// GDD-PWR-01 and GDD-PWR-02: the Taco power-up state and the taco pickup. Pure logic, no Phaser (GDD-TEC-02).
// Piñata blocks (GDD-PWR-05) and the walking taco arrive later; for now a taco sits still in a tile.
import { HITBOX, TACO, TILE } from '../config/tuning';
import type { PlayerState } from './movement';

/** GDD-PWR-01: Poncho is in exactly one state. Fuego (GDD-PWR-03) comes later. */
export type Power = 'base' | 'taco';

/** The tile a taco pickup sits in. */
export interface Taco {
  readonly col: number;
  readonly row: number;
}

/**
 * Whether Poncho's body box overlaps a square pickup, `size` px wide, in the middle of tile (col, row). Boxes that only
 * share an edge do not touch (GDD-PWR-06).
 */
export function touchesPickup(player: PlayerState, col: number, row: number, size: number): boolean {
  const cx = col * TILE + TILE / 2;
  const cy = row * TILE + TILE / 2;
  return (
    Math.abs(player.x - cx) < (HITBOX.width + size) / 2 &&
    player.y > cy - size / 2 &&
    player.y - HITBOX.height < cy + size / 2
  );
}

/** Whether Poncho's body box overlaps the taco's box. */
export const touchesTaco = (player: PlayerState, taco: Taco): boolean => touchesPickup(player, taco.col, taco.row, TACO.size);

/** GDD-PWR-01: every taco starts out there to be picked up. */
export const freshTacos = (tacos: readonly Taco[]): readonly boolean[] => tacos.map(() => false);
