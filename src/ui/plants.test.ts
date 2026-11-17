import { describe, expect, it } from 'vitest';
import { BACKDROP, MERCADO, PLANTS, SIERRA, TILE } from '../config/tuning';
import { LEVEL_0_1 } from '../levels/level0-1';
import { LEVEL_1_2 } from '../levels/level1-2';
import { LEVEL_1_3 } from '../levels/level1-3';
import { LEVEL_1_4 } from '../levels/level1-4';
import { LEVEL_2_1 } from '../levels/level2-1';
import { LEVEL_2_2 } from '../levels/level2-2';
import { LEVEL_2_3 } from '../levels/level2-3';
import { LEVEL_2_4 } from '../levels/level2-4';
import { LAB_3C_LEVEL } from '../levels/lab3c';
import { SANDBOX_LEVEL } from '../levels/sandbox';
import { SLOPES_LEVEL } from '../levels/slopes';
import { railGround, railLength, warningPost, type Rail } from '../sim/cart';
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

/** GDD-ART-06: the columns of World 2's decor on the floor at row 14, and how many tiles tall the item at a column there is. */
const decorCols = (l: Level) => plantSpots(l, MERCADO.decor).filter((s) => s.row === 14).map((s) => s.col);
const tilesOf = (col: number) => Math.ceil(MERCADO.decor[(3 * col + 5 * 14) % 7]!.h / TILE);

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

  // Column 26 grows a cholla (kind 1), 20 px = 2 tiles; column 36 a palm yucca (kind 3), 36 px = 3 tiles.
  it('GDD-ART-06 a solid tile 2 rows above the cholla (20 px is 2 tiles) removes it, and one 3 rows above does not', () => {
    expect(cols(level(14, [[26, 12]]), 14)).not.toContain(26);
    expect(cols(level(14, [[26, 11]]), 14)).toContain(26);
  });

  it('GDD-ART-06 a solid tile 3 rows above the palm yucca (36 px is 3 tiles) removes it', () => {
    expect(cols(level(14, [[36, 11]]), 14)).not.toContain(36);
    expect(cols(level(14, [[36, 10]]), 14)).toContain(36);
  });

  // GDD-ART-06: a plant never pokes into a wall or a platform, and fragile walls, crumbling tiles, piñatas and doors are not level tiles.
  it('GDD-ART-06 a fragile wall tile 2 rows above the ocotillo removes it', () => {
    expect(cols(level(14, [], { fragiles: [{ col: 27, row: 12 }] }), 14)).not.toContain(27);
  });

  it('GDD-ART-06 a crumbling tile 2 rows above the ocotillo removes it', () => {
    expect(cols(level(14, [], { crumbles: [{ col: 27, row: 12 }] }), 14)).not.toContain(27);
  });

  it('GDD-ART-06 a pinata 3 rows above the ocotillo removes it', () => {
    expect(cols(level(14, [], { pinatas: [{ col: 27, row: 11 }] }), 14)).not.toContain(27);
  });

  it('GDD-ART-06 a door tile 3 rows above the ocotillo removes it', () => {
    expect(cols(level(14, [], { doors: [{ col: 27, row: 10, height: 2 }] }), 14)).not.toContain(27);
    expect(cols(level(14, [], { doors: [{ col: 27, row: 9, height: 2 }] }), 14)).toContain(27);
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

  it('GDD-ART-06 a tile under a slope is no top tile and grows no plant', () => {
    const rows = Array.from({ length: 17 }, (_, r) => (r >= 14 ? '#'.repeat(WIDTH) : '.'.repeat(WIDTH)));
    rows[13] = rows[13]!.slice(0, 9) + '/' + rows[13]!.slice(10);
    const sloped: Level = { ...level(14), world: parseTiles(rows) };
    // Column 9 is gone from the flat floor's list [0, 8, 9, 17, 18, 26, 27, 35, 36]; the rest is unchanged.
    expect(plantSpots(sloped).map((s) => s.col)).toEqual([0, 8, 17, 18, 26, 27, 35, 36]);
  });

  it('GDD-ART-06 the slopes level grows one plant, a nopal at column 0', () => {
    // On row 14 the formula picks columns 0, 8, 9, 17, 18, 26, 27; 8 is under the hill's tile, 9, 17, 18 and 26 are under slopes, 27 is within
    // 2 columns of the Tlacuache's start (column 29); rows 12 and 13 give no spot on a top tile; column 0 is 3 columns from the spawn (column 3).
    expect(plantSpots(SLOPES_LEVEL)).toEqual([{ kind: 0, col: 0, row: 14 }]);
  });

  it('GDD-ART-06 level 1-2 has its 11 plants, none on a slope or on the tile under one', () => {
    // Worked out by hand from the formulas: a top tile at (c, r) with (37c + 11r) mod 9 of 0 or 1, kind (3c + 5r) mod 7; none under a slope, under a
    // blocking tile up to the plant's height, or within 2 columns of a thing on its row or the row above. Five kinds, no biznaga and no flower clump.
    const spots = plantSpots(LEVEL_1_2);
    expect(spots.map((s) => [s.col, s.row, s.kind])).toEqual([[0, 14, 0], [10, 13, 4], [11, 13, 0], [53, 14, 5], [54, 14, 1], [71, 14, 3], [79, 10, 0], [116, 14, 5], [117, 14, 1], [125, 14, 4], [179, 14, 5]]);
    for (const s of spots) {
      expect(LEVEL_1_2.world.slopeAt(s.col, s.row), `plant at ${s.col},${s.row}`).toBeNull();
      expect(LEVEL_1_2.world.slopeAt(s.col, s.row - 1), `plant at ${s.col},${s.row}`).toBeNull();
    }
  });

  it('GDD-ART-06 the arena 1-4 has its 4 plants on the floor at columns 8, 9, 17 and 18, none on a pillar', () => {
    // Row 14: (c + 1) mod 9 is 0 or 1 for c = 8, 9, 17, 18 among its floor tops (columns 4 to 25); row 11, the pillar tops (columns 0 to 3
    // and 26 to 29): (c + 4) mod 9 gives none. Kinds (3c + 5r) mod 7: 3 (palm yucca), 6 (flowers), 2 (biznaga), 5 (agave).
    expect(plantSpots(LEVEL_1_4).map((s) => [s.col, s.row, s.kind])).toEqual([[8, 14, 3], [9, 14, 6], [17, 14, 2], [18, 14, 5]]);
  });
});

describe('GDD-ART-06 plants in 1-3', () => {
  it('GDD-ART-06 1-3 grows 16 plants, none in a crusher column', () => {
    const spots = plantSpots(LEVEL_1_3);
    expect(spots.map((s) => [s.col, s.row, PLANTS[s.kind]!.name])).toEqual([
      [0, 14, 'nopal'], [27, 14, 'ocotillo'], [35, 14, 'nopal'], [62, 14, 'ocotillo'], [63, 14, 'nopal'],
      [89, 14, 'cholla'], [90, 14, 'ocotillo'], [102, 12, 'biznaga'], [103, 12, 'agave'], [112, 12, 'ocotillo'],
      [125, 14, 'ocotillo'], [126, 14, 'nopal'],
      [135, 9, 'biznaga'], [135, 14, 'flowers'], [136, 9, 'agave'], [147, 12, 'ocotillo'],
    ]);
    // GDD-WLD-09: the plant rule does not look at moving blocks, so this is a fact of the layout, checked here: every column a block sweeps.
    const crusherCols = LEVEL_1_3.blocks!.flatMap((b) => {
      const c0 = Math.floor(Math.min(b.x0, b.x1) / TILE);
      const c1 = Math.floor((Math.max(b.x0, b.x1) + b.w - 1) / TILE);
      return Array.from({ length: c1 - c0 + 1 }, (_, i) => c0 + i);
    });
    expect(spots.filter((s) => crusherCols.includes(s.col))).toEqual([]);
  });
});

// GDD-ART-06 World 2's decor (maceta, bugambilia, huacal, ollas, farol, rebozos, letrero de lotería) stands by World 1's plant rule,
// with its own sizes: only the heights differ, so only the "tiles above it, up to its height" clause can place it differently.
describe('GDD-ART-06 World 2 decor', () => {
  it('GDD-ART-06 decor heights: a tile 3 rows up stops a palm yucca but not ollas, a tile 2 rows up stops rebozos but not an agave', () => {
    // Row 14: column 8 is kind 3 (palm yucca 36 px, 3 tiles; ollas 14 px, 1 tile), column 18 kind 5 (agave 12 px, 1 tile; rebozos
    // 24 px, 2 tiles). The tiles at (8, 11) and (18, 12) are no spots themselves: (8 + 22) and (18 + 24) mod 9 are 3 and 6.
    const l = level(14, [
      [8, 11],
      [18, 12],
    ]);
    expect(cols(l, 14)).toEqual([0, 9, 17, 18, 26, 27, 35, 36]);
    expect(plantSpots(l, MERCADO.decor).filter((s) => s.row === 14).map((s) => s.col)).toEqual([0, 8, 9, 17, 26, 27, 35, 36]);
  });

  // GDD-ART-06, L-014: what the rule places in World 2's levels, counted on their real data, with the kinds it gives (MERCADO.decor's
  // indices).
  for (const [id, lv, count, kindsOf] of [
    ['2-1', LEVEL_2_1, 20, [0, 1, 2, 3, 4, 5, 6]],
    ['2-2', LEVEL_2_2, 22, [0, 1, 2, 3, 4, 5, 6]],
    ['2-3', LEVEL_2_3, 20, [0, 1, 2, 3, 4, 5, 6]],
    ['2-4', LEVEL_2_4, 1, [0]],
  ] as const) {
    it(`GDD-ART-06 decor in ${id}: ${count} items of ${kindsOf.length} kinds`, () => {
      const spots = plantSpots(lv, MERCADO.decor);
      expect(spots).toHaveLength(count);
      expect(new Set(spots.map((s) => s.kind))).toEqual(new Set(kindsOf));
    });
  }

  it('GDD-ART-06 decor and awnings: no item within 2 columns of an end of an awning, where its poles stand', () => {
    const base = decorCols(level(14));
    // An awning over columns 19 to 24, its top 48 px over the floor: its poles are at columns 19 and 24, each with items within 2 columns.
    const withAwning = decorCols(level(14, [], { awnings: [{ x: 19 * TILE, y: 176, w: 6 * TILE }] }));
    expect(within2(base, 19).length).toBeGreaterThan(0);
    expect(within2(base, 24).filter((c) => Math.abs(c - 19) > 2).length).toBeGreaterThan(0);
    expect(withAwning).toEqual(base.filter((c) => Math.abs(c - 19) > 2 && Math.abs(c - 24) > 2));
  });

  it('GDD-ART-06 decor and cordeles: an item as tall as the cordel is high stands under it no more, a short one does', () => {
    const base = decorCols(level(14));
    // A cordel 32 px over the floor (row 12) over columns 10 to 30: an item of 2 tiles reaches it; one of 1 tile does not.
    const cordel = { x: 10 * TILE, y: 192, w: 21 * TILE };
    const under = decorCols(level(14, [], { cordeles: [cordel] }));
    const expected = base.filter((c) => Math.abs(c - 10) > 2 && Math.abs(c - 30) > 2).filter((c) => c < 10 || c > 30 || tilesOf(c) < 2);
    expect(base.some((c) => c > 12 && c < 28 && tilesOf(c) >= 2)).toBe(true);
    expect(base.some((c) => c > 12 && c < 28 && tilesOf(c) < 2)).toBe(true);
    expect(under).toEqual(expected);
  });

  it('GDD-ART-06 decor and rollos: a rollo counts over its whole line, rolled up or not', () => {
    const base = decorCols(level(14));
    const rollo = { x: 10 * TILE, y: 192, w: 21 * TILE, post: 'left' as const };
    const cordel = { x: 10 * TILE, y: 192, w: 21 * TILE };
    expect(decorCols(level(14, [], { rollos: [rollo] }))).toEqual(decorCols(level(14, [], { cordeles: [cordel] })));
    expect(decorCols(level(14, [], { rollos: [rollo] }))).not.toEqual(base);
  });
});

// GDD-ART-06 World 3's decor stands by the same rule, with three more clearances for its railway: a rail blocks the decor in every tile it
// crosses, like a level tile, and no item stands within 2 columns of a rail's start (its cart), its end (the buffer past it, or its broken
// end) or its warning post, on the same row or the row above (GDD-WLD-15's helpers say where those are).
/** The tiles a rail crosses: those its 4 px over its ground (the rail and its sleepers) lie in, px column by px column. */
function railTiles(rail: Rail): Set<string> {
  const tiles = new Set<string>();
  for (let d = 0; d < railLength(rail); d++) {
    const x = rail.dir > 0 ? rail.x + d : rail.x - d - 1;
    const ground = railGround(rail, d + 0.5);
    for (let row = Math.floor((ground - 4) / TILE); row <= Math.floor((ground - 1) / TILE); row++) tiles.add(`${Math.floor(x / TILE)},${row}`);
  }
  return tiles;
}

/** The tiles the rail's cart (at its start), its end and its warning post stand in: the column, and the row above the ground there. */
function railThings(rail: Rail): { col: number; row: number }[] {
  const end = rail.x + rail.dir * railLength(rail);
  // A buffer stands past the rail's last px; a broken end is its last px.
  const endX = rail.end === 'buffer' ? end + rail.dir * 0.5 : end - rail.dir * 0.5;
  const post = warningPost(rail);
  return [
    { col: Math.floor((rail.x + rail.dir * 0.5) / TILE), row: rail.y / TILE - 1 },
    { col: Math.floor(endX / TILE), row: railGround(rail, railLength(rail)) / TILE - 1 },
    ...(post ? [{ col: Math.floor(post.x / TILE), row: post.y / TILE - 1 }] : []),
  ];
}

describe('GDD-ART-06 World 3 decor and the rails', () => {
  const sizes = SIERRA.decor;
  /** The spots of `l` that break the rule of `rails`, as `col,row`. */
  const breaking = (l: Level, rails: readonly Rail[]): string[] => {
    const tiles = new Set(rails.flatMap((r) => [...railTiles(r)]));
    const things = rails.flatMap(railThings);
    return plantSpots(l, sizes)
      .filter((s) => {
        const tall = Math.ceil(sizes[s.kind]!.h / TILE);
        const onTrack = Array.from({ length: tall }, (_, i) => tiles.has(`${s.col},${s.row - 1 - i}`)).some(Boolean);
        const nearThing = things.some((t) => Math.abs(t.col - s.col) <= 2 && (t.row === s.row || t.row === s.row - 1));
        return onTrack || nearThing;
      })
      .map((s) => `${s.col},${s.row}`);
  };

  it('GDD-ART-06 nothing stands on a rail\'s tiles or within 2 columns of a cart\'s start, a rail\'s end or its warning post in lab-3c', () => {
    // Over every rail of lab-3c (R1 to R6: level, climbing, descending, rolling left, two broken ends with their posts).
    const rails = LAB_3C_LEVEL.rails!;
    expect(rails).toHaveLength(6);
    expect(breaking(LAB_3C_LEVEL, rails)).toEqual([]);
    // Without its rails the formula would put items on such spots: the rule is what keeps them clear.
    expect(breaking({ ...LAB_3C_LEVEL, rails: [] }, rails).length).toBeGreaterThan(0);
  });

  // A made-up level, 60 tiles wide with its floor at row 14 and the spawn far right (column 58): rail A from column s on a plateau (columns
  // s - 4 to s + 1, its top at row 11), 2 tiles level, 3 down over air to the floor, 6 level on it, broken (its post 6 tiles before its end,
  // at the descent's foot, column s + 5); rail B rolling left, 16 tiles on the floor (columns b to b + 15), ending in a buffer (column b - 1).
  // The spots each clearance alone keeps clear: behind A's start on the plateau (s - 1, s - 2), 2 columns before A's post on the floor under
  // the descent, where the rail runs 2 rows up and a short item (a maguey, a tocón or a zacatón, 1 tile) fits under it (s + 3), past A's
  // broken end (s + 11, s + 12), past B's buffer (b - 3 to b - 1), behind B's start (b + 16, b + 17), and on B's track more than 2 columns
  // from both its ends (b + 2 to b + 12). s and b are found by search, so that the formula puts an item on each without the rails.
  const WIDE = 60;
  const fixture = (s: number, b: number, withRails: boolean): Level => {
    const rows = Array.from({ length: 17 }, (_, r) => Array.from({ length: WIDE }, (_c, c) => (r >= 14 || (r >= 11 && c >= s - 4 && c <= s + 1) ? '#' : '.')).join(''));
    const rails: Rail[] = [
      { x: s * TILE, y: 11 * TILE, dir: 1, segments: [{ kind: 'level', tiles: 2 }, { kind: 'descent', tiles: 3 }, { kind: 'level', tiles: 6 }], end: 'broken' },
      { x: (b + 16) * TILE, y: 14 * TILE, dir: -1, segments: [{ kind: 'level', tiles: 16 }], end: 'buffer' },
    ];
    return { ...level(14), world: parseTiles(rows), spawn: { x: mid(58), y: 14 * TILE }, ...(withRails ? { rails } : {}) };
  };
  const spotsOf = (l: Level) => new Map(plantSpots(l, sizes).map((p) => [`${p.col},${p.row}`, p.kind]));
  const short = (kind: number | undefined) => kind !== undefined && sizes[kind]!.h <= TILE;
  /** For each clearance, the spots of it the formula fills without the rails. */
  const wanted = (s: number, b: number) => {
    const bare = spotsOf(fixture(s, b, false));
    const has = (cs: number[], row: number) => cs.filter((c) => bare.has(`${c},${row}`)).map((c) => `${c},${row}`);
    return {
      start: has([s - 1, s - 2], 11),
      post: short(bare.get(`${s + 3},14`)) ? [`${s + 3},14`] : [],
      brokenEnd: has([s + 11, s + 12], 14),
      buffer: has([b - 3, b - 2, b - 1], 14),
      startLeft: has([b + 16, b + 17], 14),
      track: has(Array.from({ length: 11 }, (_, i) => b + 2 + i), 14),
    };
  };
  let found: { s: number; b: number } | null = null;
  for (let s = 4; s <= 20 && !found; s++) {
    for (let b = s + 16; b <= 38 && !found; b++) if (Object.values(wanted(s, b)).every((v) => v.length > 0)) found = { s, b };
  }

  it('GDD-ART-06 nothing stands on a rail\'s tiles or within 2 columns of a cart\'s start, a rail\'s end or its warning post, each clearance alone', () => {
    expect(found).not.toBeNull();
    const { s, b } = found!;
    const want = wanted(s, b);
    const withRails = spotsOf(fixture(s, b, true));
    for (const [rule, keys] of Object.entries(want)) for (const k of keys) expect(withRails.has(k), `${rule}: ${k}`).toBe(false);
    expect(breaking(fixture(s, b, true), fixture(s, b, true).rails!)).toEqual([]);
    // The spots away from the rails are kept.
    expect([...spotsOf(fixture(s, b, false)).keys()].filter((k) => withRails.has(k)).length).toBeGreaterThan(0);
  });
});
