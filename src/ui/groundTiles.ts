// GDD-ART-06: which ground tile picture a solid tile gets, and (GDD-MOV-09) a sand slope tile and the tile under it. Pure logic, no Phaser.
import { SLOPE_CHARS, type SlopeChar, type TileGrid } from '../sim/tilemap';
import type { Place } from './scenery/looks';

/**
 * The frames of the ground sheet: two versions of the top tile, then two of the earth tile, then the six slopes (GDD-MOV-09) in the
 * order of `SLOPE_CHARS`, two versions each, then the six tiles under them.
 */
export const TOP_FRAME = 0;
export const EARTH_FRAME = 2;
export const SLOPE_FRAME = 4;
export const FOOT_FRAME = 16;

/** The version of tile (tx, ty): (7 x column + 3 x row) mod 2, which alternates like a checkerboard. */
export const version = (tx: number, ty: number): number => (7 * tx + 3 * ty) % 2;

/** Whether the solid tile at (`tx`, `ty`) is a top tile: nothing solid directly above it, or it is in the level's top row. */
export const isTopTile = (solid: (tx: number, ty: number) => boolean, tx: number, ty: number): boolean => ty === 0 || !solid(tx, ty - 1);

/**
 * The frame for the tile at (`tx`, `ty`): a top tile when no solid tile lies directly above it (or it is in the level's top row), else an
 * earth tile; the version is (7 x column + 3 x row) mod 2, which alternates like a checkerboard, so neighbours differ. A slope tile
 * (`slope` says which; left out, there are none) gets its slope's frame, and the tile under it that slope's foot frame in the slope's
 * version, so the strip cut along the slope lines up (GDD-MOV-09).
 */
export function groundFrame(
  solid: (tx: number, ty: number) => boolean,
  tx: number,
  ty: number,
  slope: (tx: number, ty: number) => SlopeChar | null = () => null,
): number {
  // GDD-ART-06, GDD-MOV-09: a slope tile, and the tile under it, which takes the slope's version so the cut strip lines up.
  const here = slope(tx, ty);
  if (here !== null) return SLOPE_FRAME + 2 * SLOPE_CHARS.indexOf(here) + version(tx, ty);
  const above = slope(tx, ty - 1);
  if (above !== null) return FOOT_FRAME + 2 * SLOPE_CHARS.indexOf(above) + version(tx, ty - 1);
  const top = isTopTile(solid, tx, ty);
  return (top ? TOP_FRAME : EARTH_FRAME) + version(tx, ty);
}

/**
 * A mixing hash of a tile's column and row, a whole number from 0 to 2^32 - 1: neighbouring tiles get unrelated values, so a choice made
 * from it shows no checker and no stripes.
 */
export const tileHash = (tx: number, ty: number): number => {
  let h = Math.imul(tx, 0x27d4eb2d) ^ Math.imul(ty + 0x9e37, 0x165667b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
};

/**
 * The mine's ground sheet (`ground-mina.png`) keeps the shared layout's 28 frames and adds after them: the underside (a lip along the
 * bottom edge, two versions), deep rock (two versions), the one-tile ledge (the walk line and the lip, two versions) and the plain rock
 * tile's second version with no ore. Its frame 3, the rock tile's second version, is the one with the ore streak.
 */
export const MINE_UNDERSIDE_FRAME = 28;
export const MINE_DEEP_FRAME = 30;
export const MINE_LEDGE_FRAME = 32;
export const MINE_ROCK_FRAME = 34;
export const MINE_ORE_FRAME = 3;

/** A mine tile's kind: what its ground picture shows (GDD-ART-06). */
export type MineTile = 'top' | 'underside' | 'ledge' | 'deep' | 'rock' | 'ore' | 'slope' | 'foot';

/** Open air at (tx, ty): inside the level, not solid and no slope. */
const openAir = (grid: TileGrid, tx: number, ty: number): boolean =>
  tx >= 0 && ty >= 0 && tx < grid.width && ty < grid.height && !grid.solidTile(tx, ty) && grid.slopeAt(tx, ty) === null;

/** Solid or off the level (a slope is neither). */
const solidOrOff = (grid: TileGrid, tx: number, ty: number): boolean => tx < 0 || ty < 0 || tx >= grid.width || ty >= grid.height || grid.solidTile(tx, ty);

const AROUND = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]] as const;

/**
 * GDD-ART-06: the kind of the mine tile at (`tx`, `ty`), null where no ground image is. A slope and the tile under it keep their frames. A
 * solid tile with open air directly above it is a top, with open air directly under it an underside, with both a one-tile ledge; one
 * whose eight neighbours are all solid or off the level is deep rock (so the level's top row, with no air over it, is no top here); any
 * other is plain rock, the lit skin, which carries the ore streak where it touches open air and `tileHash` is a multiple of 4.
 */
export function mineTileKind(grid: TileGrid, tx: number, ty: number): MineTile | null {
  if (grid.slopeAt(tx, ty) !== null) return 'slope';
  if (!grid.solidTile(tx, ty)) return null;
  if (grid.slopeAt(tx, ty - 1) !== null) return 'foot';
  const over = openAir(grid, tx, ty - 1);
  const under = openAir(grid, tx, ty + 1);
  if (over) return under ? 'ledge' : 'top';
  if (under) return 'underside';
  if (AROUND.every(([dx, dy]) => solidOrOff(grid, tx + dx, ty + dy))) return 'deep';
  const air = AROUND.some(([dx, dy]) => openAir(grid, tx + dx, ty + dy));
  return air && tileHash(tx, ty) % 4 === 0 ? 'ore' : 'rock';
}

/**
 * GDD-ART-06: the frame of the mine's ground sheet for the tile at (`tx`, `ty`), by its kind (`mineTileKind`), in the tile's version
 * (`version`): a top, a slope and the tile under it as `groundFrame` gives them; the underside, deep rock and the one-tile ledge from the
 * frames after the 28; plain rock frame 2 or, in its second version, the one with no ore; the ore streak frame 3.
 */
export function mineGroundFrame(grid: TileGrid, tx: number, ty: number): number {
  const v = version(tx, ty);
  switch (mineTileKind(grid, tx, ty)) {
    case 'underside':
      return MINE_UNDERSIDE_FRAME + v;
    case 'deep':
      return MINE_DEEP_FRAME + v;
    case 'ledge':
      return MINE_LEDGE_FRAME + v;
    case 'rock':
      return v === 0 ? EARTH_FRAME : MINE_ROCK_FRAME;
    case 'ore':
      return MINE_ORE_FRAME;
    default:
      return groundFrame((x, y) => grid.solidTile(x, y), tx, ty, (x, y) => grid.slopeAt(x, y));
  }
}

/** GDD-ART-06: the ground frame of a tile in a level of `place`: the mine's rule in the mine, `groundFrame` everywhere else. */
export const groundFrameFor = (place: Place | null, grid: TileGrid, tx: number, ty: number): number =>
  place === 'mina' ? mineGroundFrame(grid, tx, ty) : groundFrame((x, y) => grid.solidTile(x, y), tx, ty, (x, y) => grid.slopeAt(x, y));
