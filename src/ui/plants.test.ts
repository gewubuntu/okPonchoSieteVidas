import { describe, expect, it } from 'vitest';
import { BACKDROP, PLANTS, TILE } from '../config/tuning';
import { LEVEL_0_1 } from '../levels/level0-1';
import { SANDBOX_LEVEL } from '../levels/sandbox';
import type { Level } from '../sim/run';
import { parseTiles } from '../sim/tilemap';
import { plantSpots } from './plants';

// GDD-ART-06 World 1's plants: a top tile at (column, row) gets a plant when (37 x column + 11 x row) mod 9 is 0 or 1; its kind is
// (3 x column + 5 x row) mod 7 of nopal, cholla, biznaga, palm yucca, ocotillo, agave, flowers; it gets none when the tiles above it, up to
// the plant's height, are not all empty, or when a thing stands within 2 columns on its row or the row above.
// The expected lists below are worked out by hand from the formulas, not read from the code. 37 mod 9 is 1 and 11 mod 9 is 2, so a spot
// qualifies when (column + 2 x row) mod 9 is 0 or 1.

const WIDTH = 40;
/** A level `WIDTH` tiles wide: a flat floor in `floor` (and two rows of earth under it), `extra` solid tiles as [col, row], the spawn far away at column 39. */
function level(floor: number, extra: [number, number][] = [], over: Partial<Level> = {}): Level {
  const rows = Array.from({ length: 17 }, (_, r) => (r >= floor ? '#'.repeat(WIDTH) : '.'.repeat(WIDTH)));
  for (const [c, r] of extra) rows[r] = rows[r]!.slice(0, c) + '#' + rows[r]!.slice(c + 1);
  return {
    world: parseTiles(rows),
    spawn: { x: 39 * TILE + TILE / 2, y: floor * TILE },
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
    ...over,
  };
}
const cols = (l: Level, row: number) => plantSpots(l).filter((s) => s.row === row).map((s) => s.col);
/** x of the middle of tile column `c`. */
const mid = (c: number) => c * TILE + TILE / 2;
/** The kinds of a level's plants in order. */
const kinds = (l: Level) => plantSpots(l).map((s) => s.kind);

/** The columns of `list` within 2 of column `c`. */
const within2 = (list: number[], c: number) => list.filter((x) => Math.abs(x - c) <= 2);

describe('GDD-ART-06 plants', () => {
  // Row 14: (c + 28) mod 9 = (c + 1) mod 9 is 0 for c = 8, 17, 26, 35 and 1 for c = 0, 9, 18, 27, 36. The spawn at column 39 clears 37 to 41.
  // Kind (3c + 70) mod 7 = 3c mod 7: c = 0, 8, 9, 17, 18, 26, 27, 35, 36 give 0, 3, 6, 2, 5, 1, 4, 0, 3.
  it('GDD-ART-06 on a flat floor at row 14 a plant grows at the columns where (37c + 154) mod 9 is 0 or 1', () => {
    expect(plantSpots(level(14)).map((s) => s.col)).toEqual([0, 8, 9, 17, 18, 26, 27, 35, 36]);
    expect(new Set(plantSpots(level(14)).map((s) => s.row))).toEqual(new Set([14]));
  });

  it('GDD-ART-06 the spots are sorted by column then row', () => {
    // A platform of 40 tiles at row 11 over the floor at row 14: both give spots; columns come first.
    const l = level(14, Array.from({ length: WIDTH }, (_, c) => [c, 11] as [number, number]));
    const spots = plantSpots(l);
    expect(spots.length).toBeGreaterThan(4);
    for (let i = 1; i < spots.length; i++) {
      const a = spots[i - 1]!;
      const b = spots[i]!;
      expect(a.col < b.col || (a.col === b.col && a.row < b.row), `${a.col},${a.row} before ${b.col},${b.row}`).toBe(true);
    }
  });

  it('GDD-ART-06 the row counts in the formula: column 0 grows a plant on row 14 but not on row 10', () => {
    // Row 10: (c + 20) mod 9 = (c + 2) mod 9 is 0 for c = 7, 16, 25, 34 and 1 for c = 8, 17, 26, 35.
    expect(cols(level(14), 14)).toContain(0);
    expect(cols(level(10), 10)).toEqual([7, 8, 16, 17, 25, 26, 34, 35]);
    expect(cols(level(10), 10)).not.toContain(0);
  });

  it('GDD-ART-06 the kind is (3c + 5r) mod 7, in the order nopal, cholla, biznaga, palm yucca, ocotillo, agave, flowers', () => {
    expect(kinds(level(14))).toEqual([0, 3, 6, 2, 5, 1, 4, 0, 3]); // see above
    // Row 10: (3c + 50) mod 7 = (3c + 1) mod 7 for c = 7, 8, 16, 17, 25, 26, 34, 35 gives 1, 4, 0, 3, 6, 2, 5, 1.
    expect(kinds(level(10))).toEqual([1, 4, 0, 3, 6, 2, 5, 1]);
    // Row 11: (c + 22) mod 9 = (c + 4) mod 9 is 0 for c = 5, 14, 23, 32 and 1 for c = 6, 15, 24, 33; (3c + 55) mod 7 for c = 5, 6, 14, 15, 23,
    // 24, 32, 33 gives 0, 3, 6, 2, 5, 1, 4, 0.
    expect(cols(level(11), 11)).toEqual([5, 6, 14, 15, 23, 24, 32, 33]);
    expect(kinds(level(11))).toEqual([0, 3, 6, 2, 5, 1, 4, 0]);
  });

  it('GDD-ART-06 the kinds are the seven in order, with the sizes the GDD gives', () => {
    expect(PLANTS.map((p) => [p.w, p.h])).toEqual([[16, 16], [12, 20], [10, 10], [14, 36], [16, 40], [16, 12], [12, 8]]);
  });

  it('GDD-ART-06 the far strip scrolls at 0.5 of the camera and starts at y 180', () => {
    expect(BACKDROP.desertFactor).toBe(0.5);
    expect(BACKDROP.desertTop).toBe(180);
  });

  // On the floor at row 14, column 27 grows the ocotillo (kind 4), 40 px = 3 tiles tall. Column 35 grows a nopal (kind 0), 16 px = 1 tile.
  it('GDD-ART-06 a solid tile 2 rows above a tall plant removes it', () => {
    expect(cols(level(14, [[27, 12]]), 14)).toEqual([0, 8, 9, 17, 18, 26, 35, 36]);
  });

  it('GDD-ART-06 a solid tile 3 rows above the ocotillo (40 px is 3 tiles) removes it', () => {
    expect(cols(level(14, [[27, 11]]), 14)).toEqual([0, 8, 9, 17, 18, 26, 35, 36]);
  });

  it('GDD-ART-06 a solid tile 4 rows above a tall plant does not remove it', () => {
    expect(cols(level(14, [[27, 10]]), 14)).toEqual([0, 8, 9, 17, 18, 26, 27, 35, 36]);
  });

  it('GDD-ART-06 a solid tile directly above a short plant removes it, and one 2 rows above a nopal (16 px) does not', () => {
    expect(cols(level(14, [[35, 13]]), 14)).toEqual([0, 8, 9, 17, 18, 26, 27, 36]);
    expect(cols(level(14, [[35, 12]]), 14)).toEqual([0, 8, 9, 17, 18, 26, 27, 35, 36]);
  });

  it('GDD-ART-06 above the level\'s top row counts as empty', () => {
    // Floor at row 1: (c + 2) mod 9 is 0 for c = 7, 16, 25, 34 and 1 for c = 8, 17, 26, 35. Kind (3c + 5) mod 7 includes the cholla (20 px,
    // 2 tiles) at c = 8, the ocotillo at 16 and the palm yucca at 25: their tiles above run out of the level at row -1, which is empty.
    expect(plantSpots(level(1)).map((s) => [s.col, s.kind])).toEqual([[7, 5], [8, 1], [16, 4], [17, 0], [25, 3], [26, 6], [34, 2], [35, 5]]);
  });

  it('GDD-ART-06 a plant on the top row has nothing above it to stop it', () => {
    // Floor at row 0: c mod 9 is 0 for c = 0, 9, 18, 27, 36 and 1 for c = 1, 10, 19, 28, 37; the spawn at column 39 (feet at y = 0, tile row -1)
    // clears 37 to 41. Kinds 3c mod 7 include the ocotillo at 27.
    expect(plantSpots(level(0)).map((s) => [s.col, s.kind])).toEqual([[0, 0], [1, 3], [9, 6], [10, 2], [18, 5], [19, 1], [27, 4], [28, 0], [36, 3]]);
  });

  // One test per kind of thing: a plant at column 18 on the floor at row 14 is cleared by it 2 columns away on either side, and
  // not by it 3 columns away. Things stand on the floor, in the tile row 13 (their feet at y = 224), unless said otherwise.
  const C = 18; // a plant on the floor at row 14 (kind 5, the agave)
  const clears = (make: (col: number) => Partial<Level>) => {
    const grows = (col: number) => cols(level(14, [], make(col)), 14).includes(C);
    expect(grows(C + 2), 'thing 2 columns right').toBe(false);
    expect(grows(C - 2), 'thing 2 columns left').toBe(false);
    expect(grows(C + 3), 'thing 3 columns right').toBe(true);
    expect(grows(C - 3), 'thing 3 columns left').toBe(true);
  };

  it('GDD-ART-06 a plant is cleared by the spawn within 2 columns', () => {
    clears((c) => ({ spawn: { x: mid(c), y: 14 * TILE } }));
  });

  it('GDD-ART-06 a plant is cleared by an ofrenda within 2 columns', () => {
    clears((c) => ({ ofrendas: [{ id: 'o', x: mid(c), y: 14 * TILE }] }));
  });

  it('GDD-ART-06 a plant is cleared by the exit within 2 columns', () => {
    clears((c) => ({ exit: { x: mid(c), y: 14 * TILE } }));
  });

  it('GDD-ART-06 a plant is cleared by a spike within 2 columns', () => {
    clears((c) => ({ spikes: [{ col: c, row: 13 }] }));
  });

  it('GDD-ART-06 a plant is cleared by a spring within 2 columns, which sits in the floor row itself', () => {
    clears((c) => ({ springs: [{ col: c, row: 14 }] }));
  });

  it('GDD-ART-06 a plant is cleared by a door within 2 columns, by any tile of the door', () => {
    clears((c) => ({ doors: [{ col: c, row: 11, height: 3 }] })); // rows 11 to 13: only its lowest tile, row 13, is next to the floor
  });

  it('GDD-ART-06 a plant is cleared by a key within 2 columns', () => {
    clears((c) => ({ keys: [{ col: c, row: 13 }] }));
  });

  it('GDD-ART-06 a plant is cleared by a pinata within 2 columns, on the row above the floor', () => {
    clears((c) => ({ pinatas: [{ col: c, row: 13 }] }));
  });

  it('GDD-ART-06 a plant is cleared by a taco within 2 columns', () => {
    clears((c) => ({ tacos: [{ col: c, row: 13 }] }));
  });

  it('GDD-ART-06 a plant is cleared by the veladora within 2 columns', () => {
    clears((c) => ({ veladora: { col: c, row: 13 } }));
  });

  it('GDD-ART-06 a plant is cleared by an enemy start within 2 columns', () => {
    clears((c) => ({ enemies: [{ x: mid(c), y: 14 * TILE }] }));
  });

  it('GDD-ART-06 a thing on the same row as the floor clears the plant too, not only the row above', () => {
    // A key lying in the floor row itself (row 14): the same row as the spot.
    expect(cols(level(14, [], { keys: [{ col: 19, row: 14 }] }), 14)).not.toContain(C);
  });

  it('GDD-ART-06 a thing 2 rows above the spot does not clear it', () => {
    // An ofrenda whose feet are at y = 13 x 16 stands in tile row 12, 2 rows above the floor row 14.
    expect(cols(level(14, [], { ofrendas: [{ id: 'o', x: mid(C), y: 13 * TILE }] }), 14)).toContain(C);
    expect(cols(level(14, [], { keys: [{ col: C, row: 12 }] }), 14)).toContain(C);
  });

  // Level 0-1: the spawn at column 3, ofrendas at 23, 49 and 76, the exit at 87, spikes at 43, 44, 64, 65, 66, all standing in tile row 13 on the floor (row 14).
  const floorCols = plantSpots(LEVEL_0_1).filter((s) => s.row === 14).map((s) => s.col);

  it('GDD-ART-06 level 0-1 has no plant within 2 columns of the spawn, an ofrenda or the exit on its floor', () => {
    for (const c of [3, 23, 49, 76, 87]) expect(within2(floorCols, c), `column ${c}`).toEqual([]);
  });

  it('GDD-ART-06 level 0-1 has no plant within 2 columns of a spike on its floor', () => {
    for (const c of [43, 44]) expect(within2(floorCols, c), `column ${c}`).toEqual([]);
    for (const c of [64, 65, 66]) expect(within2(cols(LEVEL_0_1, 14), c), `column ${c}`).toEqual([]);
  });

  it('GDD-ART-06 level 0-1 has its 12 plants and none in a gap', () => {
    // By hand: (c + 2r) mod 9 is 0 or 1. Row 14 gives c = 0, 8, 9, 17, 18, 26, 27, 35, 36, 44, 45, 53, 54, 62, 63, 71, 72, 80, 81, 89; the walls
    // at 7, 8, 27 and 37 (a tile with solid above is no top tile), the spikes at 43 to 44 and 64 to 66, the ofrendas at 49 and 76, the Alacrán at 32
    // and 81, the exit at 87, the gaps (53 to 55, 71 to 73) and the spawn clear all but 0, 9, 17, 18, 26, 35, 36. Row 13: (c + 8) mod 9 gives 37
    // (the top of the 1-tile wall there). Row 12: (c + 6) mod 9 gives 12 and 84, both tops of 2-tile walls. Row 11: (c + 4) mod 9 gives 59, the
    // top of the wall at 58 and 59. Row 10: (c + 2) mod 9 gives 62, the left end of the raised platform. Kinds (3c + 5r) mod 7:
    // 0, 6, 5, 2, 5, 1, 0, 3, 1, 1, 5, 4 in that order of columns.
    expect(plantSpots(LEVEL_0_1).map((s) => [s.col, s.row, s.kind])).toEqual([
      [0, 14, 0],
      [9, 14, 6],
      [12, 12, 5],
      [17, 14, 2],
      [18, 14, 5],
      [26, 14, 1],
      [35, 14, 0],
      [36, 14, 3],
      [37, 13, 1],
      [59, 11, 1],
      [62, 10, 5],
      [84, 12, 4],
    ]);
    const gaps = [16, 19, 20, 53, 54, 55, 71, 72, 73];
    expect(floorCols.filter((c) => gaps.includes(c))).toEqual([]);
  });

  it('GDD-ART-06 the sandbox has its 4 plants, none within 2 columns of the cactus buddy or a spike', () => {
    const spots = plantSpots(SANDBOX_LEVEL);
    // By hand: row 14 gives c = 0, 8, 9, 17, 18, 26, 27 on its floor tops; the door at column 8, the ofrenda at 19, the taco at 18 and the ofrenda
    // at 25 clear all but 0. Row 11: (c + 4) mod 9 gives 23 (the top of the 3-tile wall; 22 does not qualify). Row 7: (c + 5) mod 9 gives 13 and
    // 14, the ledge. Row 6 (the Tlacuache's ledge, c = 25 to 29) gives 25, which the Tlacuache at column 27 clears; row 10 (the platform) gives 7,
    // which the piñata at column 8 clears; row 12 gives 10 only with solid above. Kinds (3c + 5r) mod 7: 0, 4, 0, 5.
    expect(spots.map((s) => [s.col, s.row, s.kind])).toEqual([[0, 14, 0], [13, 7, 4], [14, 7, 0], [23, 11, 5]]);
    // The cactus buddy starts at x = 184, y = 192: tile column 11, row 11, on the 2-tile wall's top (row 12). The spikes at columns 20 and 21 stand in row 13 on the floor (row 14).
    expect(spots.filter((s) => (s.row === 12 || s.row === 11) && Math.abs(s.col - 11) <= 2)).toEqual([]);
    expect(spots.filter((s) => (s.row === 14 || s.row === 13) && (Math.abs(s.col - 20) <= 2 || Math.abs(s.col - 21) <= 2))).toEqual([]);
  });
});
