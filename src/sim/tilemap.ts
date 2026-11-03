// GDD-MOV-06, GDD-MOV-09 and GDD-TEC-04: a grid of solid, empty and sand slope tiles. Pure data, no Phaser.
import { TILE } from '../config/tuning';

/** GDD-MOV-09: the six sand slope characters, in the order the ground sheet draws them (GDD-ART-06). */
export const SLOPE_CHARS = ['/', '\\', 'r', 'R', 'F', 'f'] as const;
export type SlopeChar = (typeof SLOPE_CHARS)[number];

/** GDD-MOV-09: each slope's surface height at its tile's left and right edge, in px up from the tile's bottom edge. */
export const SLOPE_HEIGHTS: Readonly<Record<SlopeChar, { readonly left: number; readonly right: number }>> = {
  '/': { left: 0, right: TILE },
  '\\': { left: TILE, right: 0 },
  r: { left: 0, right: TILE / 2 },
  R: { left: TILE / 2, right: TILE },
  F: { left: TILE, right: TILE / 2 },
  f: { left: TILE / 2, right: 0 },
};

export interface TileGrid {
  readonly width: number;
  readonly height: number;
  /**
   * Is tile (tx, ty) solid? Tile (0, 0) covers x and y from 0 to 16. The left and right edges of the level are
   * solid walls so Poncho cannot walk out. Above the level is open sky and below it is open space (a pit).
   */
  solidTile(tx: number, ty: number): boolean;
  /**
   * GDD-MOV-09: the slope in tile (tx, ty), or null for a level tile, an empty tile and anything outside the level. A slope tile is not
   * solid (`solidTile` is false for it).
   */
  slopeAt(tx: number, ty: number): SlopeChar | null;
}

/**
 * Builds a grid from rows of text: `#` is a solid tile, `.` is empty, and `/ \ r R F f` are the sand slopes (GDD-MOV-09). Every row
 * must have the same length.
 */
export function parseTiles(rows: readonly string[]): TileGrid {
  const width = rows[0]?.length ?? 0;
  rows.forEach((row, i) => {
    if (row.length !== width) throw new Error(`Tile row ${i} has ${row.length} tiles, expected ${width}`);
    if (/[^#./\\rRFf]/.test(row)) throw new Error(`Tile row ${i} has a character other than "#", ".", and the slopes "/\\rRFf"`);
  });
  return {
    width,
    height: rows.length,
    solidTile(tx, ty) {
      if (tx < 0 || tx >= width) return true;
      if (ty < 0 || ty >= rows.length) return false;
      return rows[ty]?.[tx] === '#';
    },
    slopeAt(tx, ty) {
      const c = rows[ty]?.[tx];
      return SLOPE_CHARS.find((slope) => slope === c) ?? null;
    },
  };
}
