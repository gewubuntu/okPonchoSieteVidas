// GDD-WLD-17, GDD-WLD-16: the rock back wall that stands behind a gallery cut into a cliff (`assets/sprites/sierra/backwall.png`, four
// versions of one tile). Pure logic, no Phaser: which tiles get its image, in which version, and at what depth.
import type { Level } from '../../sim/run';
import { tileHash } from '../groundTiles';

/**
 * The back wall's depth: in front of the backdrop's layers (the mid band is at -0.5) and behind everything in the level: the decor (0.5),
 * the ground (1), and the things, enemies and Poncho, whatever is drawn with no depth of its own (0) included.
 */
export const BACK_WALL_DEPTH = -0.25;

/** The back wall's versions, the frames of its sheet. */
export const BACK_WALL_VERSIONS = 4;

/**
 * The tiles of the level's back walls, row by row and left to right in each rectangle: each tile inside a rectangle that is not solid and
 * holds no slope, with the frame of its version. The versions are chosen over all the level's back wall tiles from the top row down and
 * left to right in each row: of the versions that differ from the back wall tiles directly above and to the left, the one a mixing hash of
 * the tile's column and row picks (`tileHash`). So no two tiles side by side or one over the other share a version, and the wall shows
 * neither the checker nor the stripes of versions taken in turn.
 */
export function backWallTiles(level: Level): { tx: number; ty: number; frame: number }[] {
  const { world } = level;
  const tiles: { tx: number; ty: number; frame: number }[] = [];
  for (const { col0, col1, row0, row1 } of level.backWalls ?? []) {
    for (let ty = row0; ty <= row1; ty++) {
      for (let tx = col0; tx <= col1; tx++) {
        if (world.solidTile(tx, ty) || world.slopeAt(tx, ty) !== null) continue;
        tiles.push({ tx, ty, frame: 0 });
      }
    }
  }
  const byPlace = new Map(tiles.map((tile) => [`${tile.tx},${tile.ty}`, tile]));
  const rows = tiles.map(({ ty }) => ty), cols = tiles.map(({ tx }) => tx);
  for (let ty = Math.min(...rows); ty <= Math.max(...rows); ty++) {
    for (let tx = Math.min(...cols); tx <= Math.max(...cols); tx++) {
      const tile = byPlace.get(`${tx},${ty}`);
      if (tile === undefined) continue;
      const taken = [byPlace.get(`${tx},${ty - 1}`)?.frame, byPlace.get(`${tx - 1},${ty}`)?.frame];
      const free = Array.from({ length: BACK_WALL_VERSIONS }, (_, v) => v).filter((v) => !taken.includes(v));
      tile.frame = free[tileHash(tx, ty) % free.length]!;
    }
  }
  return tiles;
}
