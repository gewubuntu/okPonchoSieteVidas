// GDD-WLD-05: doors and keys. A door is a solid tile that opens, for good, when Poncho touches its side carrying a key;
// the key is used up. A key is picked up by touch. Pure logic, no Phaser (GDD-TEC-02).
import { HITBOX, KEY, TILE } from '../config/tuning';
import type { PlayerState } from './movement';
import { touchesPickup } from './taco';
import type { TileGrid } from './tilemap';

/** A door one tile wide: `height` tiles tall from `row` down, opened as one by a single key. */
export interface Door {
  readonly col: number;
  readonly row: number;
  readonly height: number;
}

/** The tile a key lies in. */
export interface Key {
  readonly col: number;
  readonly row: number;
}

/** GDD-WLD-05: every door shut and every key waiting, as at the start of the level and after a life is lost. */
export const freshFlags = (items: readonly unknown[]): readonly boolean[] => items.map(() => false);

/** The level's tiles plus the doors that are still shut. */
export function withDoors(world: TileGrid, doors: readonly Door[], open: readonly boolean[]): TileGrid {
  if (doors.length === 0) return world;
  return { ...world, solidTile: (tx, ty) => world.solidTile(tx, ty) || doors.some((d, i) => d.col === tx && ty >= d.row && ty < d.row + d.height && !open[i]) };
}

/** Whether Poncho's body box overlaps the key's box. */
export const touchesKey = (player: PlayerState, key: Key): boolean => touchesPickup(player, key.col, key.row, KEY.size);

/**
 * Whether Poncho is touching the side of the door: his body box, widened by KEY.doorReachPx on each side, overlaps its
 * column, and it overlaps it in height. Standing on top of a door, or bumping it from below, does not count.
 */
export function touchesDoor(player: PlayerState, door: Door): boolean {
  const top = door.row * TILE;
  const bottom = (door.row + door.height) * TILE;
  return (
    Math.abs(player.x - (door.col * TILE + TILE / 2)) < (HITBOX.width + TILE) / 2 + KEY.doorReachPx &&
    player.y > top &&
    player.y - HITBOX.height < bottom
  );
}
