import { describe, expect, it } from 'vitest';
import { TILE } from '../../config/tuning';
import { LEVEL_3_1, LEVEL_3_1_GROUND, LEVEL_3_1_PIECES } from '../../levels/level3-1';
import type { Level } from '../../sim/run';
import { parseTiles } from '../../sim/tilemap';
import { BACK_WALL_DEPTH, backWallTiles } from './backWall';

/** A level of `rows` with back walls `walls`, nothing else in it. */
const levelOf = (rows: string[], walls: Level['backWalls']): Level => ({
  world: parseTiles(rows),
  spawn: { x: 8, y: 16 },
  ofrendas: [],
  spikes: [],
  crumbles: [],
  springs: [],
  platforms: [],
  tacos: [],
  pinatas: [],
  doors: [],
  keys: [],
  fragiles: [],
  enemies: [],
  ...(walls ? { backWalls: walls } : {}),
});

describe('GDD-WLD-17 the rock back wall', () => {
  it('GDD-WLD-17 backwall tiles: every tile inside a rectangle that is not solid and holds no slope, and no other', () => {
    // A 6 x 4 level: a solid tile at (2, 1), a slope at (3, 2) on the floor row 3; one wall over columns 1 to 4, rows 0 to 2.
    const level = levelOf(['......', '..#...', '...F..', '######'], [{ col0: 1, col1: 4, row0: 0, row1: 2 }]);
    const tiles = backWallTiles(level).map(({ tx, ty }) => `${tx},${ty}`);
    expect(tiles).toEqual(['1,0', '2,0', '3,0', '4,0', '1,1', '3,1', '4,1', '1,2', '2,2', '4,2']);
    // A rectangle over the floor gets nothing there; none, no tiles.
    expect(backWallTiles(levelOf(['....', '####'], [{ col0: 0, col1: 3, row0: 1, row1: 1 }]))).toEqual([]);
    expect(backWallTiles(levelOf(['....', '####'], undefined))).toEqual([]);
  });

  it('GDD-WLD-17 backwall version: (7 x column + 3 x row) mod 2, as the rock tile', () => {
    const level = levelOf(['....', '....', '####'], [{ col0: 0, col1: 3, row0: 0, row1: 1 }]);
    expect(backWallTiles(level).map(({ tx, ty, frame }) => [tx, ty, frame])).toEqual([
      [0, 0, 0], [1, 0, 1], [2, 0, 0], [3, 0, 1],
      [0, 1, 1], [1, 1, 0], [2, 1, 1], [3, 1, 0],
    ]);
  });

  it('GDD-WLD-17 backwall depth: in front of the backdrop layers, behind everything in the level', () => {
    // The mid band is drawn at -0.5, the decor at 0.5, the ground at 1, and anything the scene draws with no depth of its own at 0.
    expect(BACK_WALL_DEPTH).toBeGreaterThan(-0.5);
    expect(BACK_WALL_DEPTH).toBeLessThan(0);
  });

  it('GDD-WLD-17 3-1 the back walls stand behind its two galleries, from under F1 down to the lower gallery floor, and nothing above F1', () => {
    // Read from the level's pieces (L-062): F1 (rows 25 and 26 from column 136), F2 (row 31), the buttress (columns 161 to 164, rows 17
    // to 31), the lower gallery's floor (row 38 from column 136). The cliff's face is column 135's right edge.
    const [f1, , f2a, , buttress] = LEVEL_3_1_PIECES;
    expect([f1, f2a, buttress]).toEqual([{ col0: 136, col1: 157, row0: 25, row1: 26 }, { col0: 139, col1: 145, row0: 31, row1: 31 }, { col0: 161, col1: 164, row0: 17, row1: 31 }]);
    const floor = LEVEL_3_1_GROUND.find((s) => s.col0 === f1!.col0)!;
    expect(floor.row).toBe(38);
    // (a) under F1 and over F2, from the cliff's face to the buttress, F2's own row too (the shaft and the crumbling floor in it); (b) under
    // F2 down to the floor, as far right as the buttress, the gallery's roof, goes: it opens to the sky at column 165.
    expect(LEVEL_3_1.backWalls).toEqual([
      { col0: f1!.col0, col1: buttress!.col0 - 1, row0: f1!.row1 + 1, row1: f2a!.row0 },
      { col0: f1!.col0, col1: buttress!.col1, row0: f2a!.row0 + 1, row1: floor.row - 1 },
    ]);
    expect(LEVEL_3_1.backWalls).toEqual([{ col0: 136, col1: 160, row0: 27, row1: 31 }, { col0: 136, col1: 164, row0: 32, row1: 37 }]);
    const tiles = backWallTiles(LEVEL_3_1);
    // Nothing above F1's underside, none at or right of column 165, none on a solid tile.
    expect(tiles.every(({ tx, ty }) => ty >= 27 && tx >= 136 && tx <= 164 && !LEVEL_3_1.world.solidTile(tx, ty))).toBe(true);
    // Measured: 279 tiles, 138 of version 0 and 141 of version 1 (the rectangles hold 107 and 172 open tiles).
    expect([tiles.length, tiles.filter((t) => t.frame === 0).length, tiles.filter((t) => t.frame === 1).length]).toEqual([279, 138, 141]);
    expect(TILE).toBe(16);
  });
});
