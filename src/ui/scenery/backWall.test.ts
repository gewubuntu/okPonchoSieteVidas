import { describe, expect, it } from 'vitest';
import { TILE } from '../../config/tuning';
import { LEVEL_3_1, LEVEL_3_1_GROUND, LEVEL_3_1_PIECES } from '../../levels/level3-1';
import type { Level } from '../../sim/run';
import { parseTiles } from '../../sim/tilemap';
import { BACK_WALL_DEPTH, BACK_WALL_VERSIONS, backWallTiles } from './backWall';

/** The back wall tiles of each version over 3-1's two rectangles, measured. */
const VERSIONS_3_1 = [70, 65, 75, 69];

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

  it('GDD-WLD-17 backwall version: one of four, never the version of the tile above or beside it, the hash picking among the rest', () => {
    // A wide open field, one rectangle over all of it but the floor.
    const rows = [...Array.from({ length: 40 }, () => '.'.repeat(120)), '#'.repeat(120)];
    const level = levelOf(rows, [{ col0: 0, col1: 119, row0: 0, row1: 39 }]);
    const tiles = backWallTiles(level);
    const at = new Map(tiles.map(({ tx, ty, frame }) => [`${tx},${ty}`, frame]));
    expect(BACK_WALL_VERSIONS).toBe(4);
    for (const { tx, ty, frame } of tiles) {
      expect([0, 1, 2, 3]).toContain(frame);
      expect(frame, `${tx},${ty} under ${tx},${ty - 1}`).not.toBe(at.get(`${tx},${ty - 1}`));
      expect(frame, `${tx},${ty} beside ${tx - 1},${ty}`).not.toBe(at.get(`${tx - 1},${ty}`));
    }
    // Every version shows, in about a quarter of the tiles each, and the same level gives the same wall.
    for (let v = 0; v < 4; v++) expect(Math.abs(tiles.filter((t) => t.frame === v).length / tiles.length - 0.25), `version ${v}`).toBeLessThan(0.03);
    expect(backWallTiles(level)).toEqual(tiles);
    // Two rectangles, the lower listed first: the tile under the upper one's last row still differs from it (the versions are chosen from
    // the top row down whatever the order of the rectangles).
    const split = levelOf(rows, [{ col0: 0, col1: 119, row0: 20, row1: 39 }, { col0: 0, col1: 119, row0: 0, row1: 19 }]);
    const splitAt = new Map(backWallTiles(split).map(({ tx, ty, frame }) => [`${tx},${ty}`, frame]));
    for (let tx = 0; tx < 120; tx++) expect(splitAt.get(`${tx},20`), `column ${tx}`).not.toBe(splitAt.get(`${tx},19`));
  });

  it('GDD-WLD-17 backwall over 3-1 galleries: no checker and no stripes, no version in one column more than 3 rows running', () => {
    // 3-1's two rectangles as one field (columns 136 to 164, rows 27 to 37; 25 x 11 where both reach).
    const tiles = backWallTiles(LEVEL_3_1);
    const at = new Map(tiles.map(({ tx, ty, frame }) => [`${tx},${ty}`, frame]));
    const [a, b] = LEVEL_3_1.backWalls!;
    const runs: string[] = [];
    for (let tx = a!.col0; tx <= b!.col1; tx++) {
      let run = 1;
      for (let ty = a!.row0 + 1; ty <= b!.row1; ty++) {
        run = at.has(`${tx},${ty}`) && at.get(`${tx},${ty}`) === at.get(`${tx},${ty - 1}`) ? run + 1 : 1;
        if (run > 3) runs.push(`column ${tx} to row ${ty}`);
      }
    }
    for (let ty = a!.row0; ty <= b!.row1; ty++) {
      let run = 1;
      for (let tx = a!.col0 + 1; tx <= b!.col1; tx++) {
        run = at.has(`${tx},${ty}`) && at.get(`${tx},${ty}`) === at.get(`${tx - 1},${ty}`) ? run + 1 : 1;
        if (run > 3) runs.push(`row ${ty} to column ${tx}`);
      }
    }
    expect(runs).toEqual([]);
    // No checker: neither the rows nor the columns repeat every second tile, and diagonal neighbours do not always match.
    const same = (dx: number, dy: number) => tiles.filter(({ tx, ty, frame }) => at.has(`${tx + dx},${ty + dy}`) && at.get(`${tx + dx},${ty + dy}`) === frame).length;
    const pairs = (dx: number, dy: number) => tiles.filter(({ tx, ty }) => at.has(`${tx + dx},${ty + dy}`)).length;
    for (const [dx, dy] of [[2, 0], [0, 2], [1, 1], [1, -1]] as const) {
      expect(same(dx, dy), `${dx},${dy}`).toBeLessThan(pairs(dx, dy) / 2);
      expect(pairs(dx, dy), `${dx},${dy}`).toBeGreaterThan(100);
    }
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
    // Measured: 279 tiles (the rectangles hold 107 and 172 open tiles), and of each version, in order (L-072).
    expect(tiles.length).toBe(279);
    expect([0, 1, 2, 3].map((v) => tiles.filter((t) => t.frame === v).length)).toEqual(VERSIONS_3_1);
    expect(TILE).toBe(16);
  });
});
