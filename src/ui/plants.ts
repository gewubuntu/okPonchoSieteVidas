// GDD-ART-06: where World 1's plants grow. Pure logic, no Phaser.
import { PLANTS, TILE } from '../config/tuning';
import type { Level } from '../sim/run';
import { isTopTile } from './groundTiles';

/** A plant to draw: its kind (the index into `PLANTS`) and the top tile it stands on. */
export interface PlantSpot {
  readonly kind: number;
  readonly col: number;
  readonly row: number;
}

/** The tile a thing with its feet at (x, y) stands in: the tile above y, as every thing stands on a tile's top edge. */
const standing = ({ x, y }: { x: number; y: number }) => ({ col: Math.floor(x / TILE), row: y / TILE - 1 });

/** The tiles things stand in (a thing standing on a top tile is in the row above it), from the whole level. */
function thingTiles(level: Level): { col: number; row: number }[] {
  const doorTiles = level.doors.flatMap((d) => Array.from({ length: d.height }, (_, i) => ({ col: d.col, row: d.row + i })));
  return [
    standing(level.spawn),
    ...level.ofrendas.map(standing),
    ...(level.exit ? [standing(level.exit)] : []),
    ...level.enemies.map(standing),
    ...level.spikes,
    ...level.springs,
    ...doorTiles,
    ...level.keys,
    ...level.pinatas,
    ...level.tacos,
    ...(level.veladora ? [level.veladora] : []),
  ];
}

/**
 * GDD-ART-06: the plants of a level, sorted by column then row. A top tile at (column, row) gets a plant when (37 x column + 11 x row)
 * mod 9 is 0 or 1; its kind is (3 x column + 5 x row) mod 7. It gets none when a tile above it, up to the plant's height, is solid, or
 * when a spawn, ofrenda, exit, spike, spring, door, key, piñata, taco, veladora or enemy start stands within 2 columns on its row or
 * the row above.
 */
export function plantSpots(level: Level): PlantSpot[] {
  const solid = (tx: number, ty: number) => level.world.solidTile(tx, ty);
  const things = thingTiles(level);
  const spots: PlantSpot[] = [];
  for (let col = 0; col < level.world.width; col++) {
    for (let row = 0; row < level.world.height; row++) {
      if (!solid(col, row) || !isTopTile(solid, col, row)) continue;
      if ((37 * col + 11 * row) % 9 > 1) continue;
      const kind = (3 * col + 5 * row) % 7;
      const tiles = Math.ceil(PLANTS[kind]!.h / TILE);
      if (Array.from({ length: tiles }, (_, i) => solid(col, row - 1 - i)).some(Boolean)) continue;
      if (things.some((t) => Math.abs(t.col - col) <= 2 && (t.row === row || t.row === row - 1))) continue;
      spots.push({ kind, col, row });
    }
  }
  return spots;
}
