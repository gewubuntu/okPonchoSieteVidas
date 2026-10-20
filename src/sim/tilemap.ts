// GDD-MOV-06 and GDD-TEC-04: a grid of solid and empty tiles. Pure data, no Phaser.
export interface TileGrid {
  readonly width: number;
  readonly height: number;
  /**
   * Is tile (tx, ty) solid? Tile (0, 0) covers x and y from 0 to 16. The left and right edges of the level are
   * solid walls so Poncho cannot walk out. Above the level is open sky and below it is open space (a pit).
   */
  solidTile(tx: number, ty: number): boolean;
}

/** Builds a grid from rows of text: `#` is a solid tile, `.` is empty. Every row must have the same length. */
export function parseTiles(rows: readonly string[]): TileGrid {
  const width = rows[0]?.length ?? 0;
  rows.forEach((row, i) => {
    if (row.length !== width) throw new Error(`Tile row ${i} has ${row.length} tiles, expected ${width}`);
    if (/[^#.]/.test(row)) throw new Error(`Tile row ${i} has a character other than "#" and "."`);
  });
  return {
    width,
    height: rows.length,
    solidTile(tx, ty) {
      if (tx < 0 || tx >= width) return true;
      if (ty < 0 || ty >= rows.length) return false;
      return rows[ty]?.[tx] === '#';
    },
  };
}
