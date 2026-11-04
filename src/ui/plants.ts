// GDD-ART-06: where World 1's plants grow, and World 2's decor stands by the same rule. Pure logic, no Phaser.
import { PLANTS, TILE } from '../config/tuning';
import type { Level } from '../sim/run';
import { isTopTile } from './groundTiles';

/** A plant to draw: its kind (the index into `PLANTS`, or into World 2's `MERCADO.decor`) and the top tile it stands on. */
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
 * GDD-ART-06: the plants of a level, sorted by column then row. A top tile (no level tile or slope directly above it) at (column, row) gets a plant when (37 x column + 11 x row)
 * mod 9 is 0 or 1; its kind is (3 x column + 5 x row) mod 7. It gets none when a tile above it, up to the plant's height, is solid or holds a fragile wall, a crumbling tile, a piñata or a door, or
 * when a spawn, ofrenda, exit, spike, spring, door, key, piñata, taco, veladora or enemy start stands within 2 columns on its row or
 * the row above. `sizes` are the kinds' sizes in game px: World 1's plants, or World 2's decor (`MERCADO.decor`), which follows the same rule.
 * World 2's awnings, cordeles and rollos (GDD-WLD-10, GDD-WLD-11) count as blocks in every tile their top crosses, and their poles stand
 * at both ends: a top tile within 2 columns of an end, below it, gets no plant either.
 */
export function plantSpots(level: Level, sizes: readonly { readonly h: number }[] = PLANTS): PlantSpot[] {
  const solid = (tx: number, ty: number) => level.world.solidTile(tx, ty);
  // GDD-ART-06, GDD-MOV-09: a level tile under a sand slope is no top tile.
  const ground = (tx: number, ty: number) => solid(tx, ty) || level.world.slopeAt(tx, ty) !== null;
  // What a plant must not poke into: the level's tiles and the blocks that are not in them (fragile walls, crumbling tiles, piñatas, doors).
  // GDD-ART-06: World 2's awnings and strings (a rollo over its whole line), with the columns of their two ends, where their poles stand.
  const covers = [...(level.awnings ?? []), ...(level.cordeles ?? []), ...(level.rollos ?? [])].map((c) => ({ row: Math.floor(c.y / TILE), from: Math.floor(c.x / TILE), to: Math.floor((c.x + c.w - 1) / TILE) }));
  const coverTiles = covers.flatMap((c) => Array.from({ length: c.to - c.from + 1 }, (_, i) => ({ col: c.from + i, row: c.row })));
  const blocks = new Set([...level.fragiles, ...level.crumbles, ...level.pinatas, ...level.doors.flatMap((d) => Array.from({ length: d.height }, (_, i) => ({ col: d.col, row: d.row + i }))), ...coverTiles].map((t) => `${t.col},${t.row}`));
  const filled = (tx: number, ty: number) => solid(tx, ty) || blocks.has(`${tx},${ty}`);
  const things = thingTiles(level);
  const spots: PlantSpot[] = [];
  for (let col = 0; col < level.world.width; col++) {
    for (let row = 0; row < level.world.height; row++) {
      if (!solid(col, row) || !isTopTile(ground, col, row)) continue;
      if ((37 * col + 11 * row) % 9 > 1) continue;
      const kind = (3 * col + 5 * row) % 7;
      const tiles = Math.ceil(sizes[kind]!.h / TILE);
      if (Array.from({ length: tiles }, (_, i) => filled(col, row - 1 - i)).some(Boolean)) continue;
      if (things.some((t) => Math.abs(t.col - col) <= 2 && (t.row === row || t.row === row - 1))) continue;
      if (covers.some((c) => c.row < row && (Math.abs(c.from - col) <= 2 || Math.abs(c.to - col) <= 2))) continue;
      spots.push({ kind, col, row });
    }
  }
  return spots;
}
