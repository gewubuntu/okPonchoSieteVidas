// The slope tiles every world's ground sheet shares (GDD-ART-06, GDD-MOV-09): the six slopes in frame order and the cut that moves a
// world's top tile over its wall tile down to a slope's surface. Moved out of desert.mjs unchanged (World 1's tiles stay pixel for pixel).
import { Cells } from './cells.mjs';

/** GDD-MOV-09's slopes in the order the ground sheet draws them, with their surface height at the tile's left and right edge in game px (cells). */
export const SLOPE_ORDER = [['/', 0, 16], ['\\', 16, 0], ['r', 0, 8], ['R', 8, 16], ['F', 16, 8], ['f', 8, 0]];

/** The row of a slope tile's top ground cell in cell column x: the cell its surface passes through at the column's middle. */
export const slopeTopRow = (left, right, x) => Math.floor(16 - (left + ((right - left) * (x + 0.5)) / 16));

/**
 * A slope tile and the tile under it (GDD-ART-06, GDD-MOV-09): the top tile over the wall tile of the same version, a 16 x 32 cell
 * strip, each column moved down to its `slopeTopRow`, then cut back into the two tiles. Cells moved above the surface are left empty.
 */
export function cutSlope(top, wall, left, right) {
  const slope = new Cells(16, 16);
  const foot = new Cells(16, 16);
  for (let x = 0; x < 16; x++) {
    const shift = slopeTopRow(left, right, x);
    for (let r = 0; r + shift < 32; r++) {
      const colour = r < 16 ? top.get(x, r) : wall.get(x, r - 16);
      if (r + shift < 16) slope.set(x, r + shift, colour);
      else foot.set(x, r + shift - 16, colour);
    }
  }
  return { slope, foot };
}
