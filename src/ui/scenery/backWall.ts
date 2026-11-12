// GDD-WLD-17, GDD-WLD-16: the rock back wall that stands behind a gallery cut into a cliff (`assets/sprites/sierra/backwall.png`, two
// versions of one tile). Pure logic, no Phaser: which tiles get its image, in which version, and at what depth.
import type { Level } from '../../sim/run';
import { version } from '../groundTiles';

/**
 * The back wall's depth: in front of the backdrop's layers (the mid band is at -0.5) and behind everything in the level: the decor (0.5),
 * the ground (1), and the things, enemies and Poncho, whatever is drawn with no depth of its own (0) included.
 */
export const BACK_WALL_DEPTH = -0.25;

/**
 * The tiles of the level's back walls, row by row and left to right in each rectangle: each tile inside a rectangle that is not solid and
 * holds no slope, with the frame of its version, (7 x column + 3 x row) mod 2 as the ground's rock tile.
 */
export function backWallTiles(level: Level): { tx: number; ty: number; frame: number }[] {
  const { world } = level;
  const tiles: { tx: number; ty: number; frame: number }[] = [];
  for (const { col0, col1, row0, row1 } of level.backWalls ?? []) {
    for (let ty = row0; ty <= row1; ty++) {
      for (let tx = col0; tx <= col1; tx++) {
        if (world.solidTile(tx, ty) || world.slopeAt(tx, ty) !== null) continue;
        tiles.push({ tx, ty, frame: version(tx, ty) });
      }
    }
  }
  return tiles;
}
