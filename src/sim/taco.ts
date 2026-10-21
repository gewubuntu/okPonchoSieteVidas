// GDD-PWR-01 and GDD-PWR-02: the Taco power-up state and the taco pickup. Pure logic, no Phaser (GDD-TEC-02).
// Piñata blocks (GDD-PWR-05) and the walking taco arrive later; for now a taco sits still in a tile.
import { HITBOX, TACO, TILE } from '../config/tuning';
import type { PlayerState } from './movement';

/** GDD-PWR-01: Poncho is in exactly one state. */
export type Power = 'base' | 'taco' | 'fuego';

/** GDD-PWR-02 and GDD-PWR-03: what a released item is. */
export type ItemKind = 'taco' | 'chile';

/**
 * The state after eating an item. A taco takes Base to Taco and does nothing in Taco or Fuego (it would not improve the
 * state, which gives hilos, GDD-PWR-01, not built yet). A chile takes Taco to Fuego, Base to Taco (one step better, like a
 * Mario flower when small) and does nothing in Fuego.
 */
export function eat(power: Power, kind: ItemKind): Power {
  if (power === 'base') return 'taco';
  return kind === 'chile' ? 'fuego' : power; // Taco or Fuego here
}

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
