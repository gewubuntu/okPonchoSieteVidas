// GDD-ART-06: which ground tile picture a solid tile gets, and (GDD-MOV-09) a sand slope tile and the tile under it. Pure logic, no Phaser.
import { SLOPE_CHARS, type SlopeChar } from '../sim/tilemap';

/**
 * The frames of the ground sheet: two versions of the top tile, then two of the earth tile, then the six slopes (GDD-MOV-09) in the
 * order of `SLOPE_CHARS`, two versions each, then the six tiles under them.
 */
export const TOP_FRAME = 0;
export const EARTH_FRAME = 2;
export const SLOPE_FRAME = 4;
export const FOOT_FRAME = 16;

/** The version of tile (tx, ty): (7 x column + 3 x row) mod 2, which alternates like a checkerboard. */
const version = (tx: number, ty: number): number => (7 * tx + 3 * ty) % 2;

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
