import { describe, expect, it } from 'vitest';
import { CACOMIXTLE, CAMERA, CART, HITBOX, LEVEL_RULES, RUN, TILE } from '../config/tuning';
import { railGround, railLength, rollCarts, warningPost, type CartState } from '../sim/cart';
import { kindOf } from '../sim/enemy';
import type { PlayerInput } from '../sim/movement';
import { platformAt } from '../sim/platform';
import { startRun, touchesOfrenda, type Level, type RunState } from '../sim/run';
import { parseTiles } from '../sim/tilemap';
import { cameraLimitsAt } from '../ui/camera';
import { LEVEL_3_3_AT, LEVEL_3_3_PITS, LEVEL_3_3_PLATFORM, LEVEL_3_3_RAILS, LEVEL_3_3_ROWS } from './level3-3';
import {
  at, apart, bounced, cartOf, colOf, endOf, entry, faceOf, fly, idle, inCart, L, landedAs, last, middleOf, mid, NAMES, play, railOf, rideOn, right, standsOnTile, took, tookOf, underBat, velaTaken, whereIs, world, Y,
  type Flight, type Name,
} from './level3-3.drive';
import { gaps, openGaps, validateLevel } from './validate';

// GDD-WLD-18: level 3-3, "Las Cumbres", built and registered after 3-2 in `index.ts`. Every expected number is the design's (GDD-WLD-18, laid
// out by the World 3 design swarm before any code, its tables re-typed here); where the real simulation gives another, the test pins the
// measured value with a comment "GDD says N" (L-003). Part 1 is the layout; Part 2 measures the layout's reaches on the real level with
// every enemy in it, asserting the lives and where he ends (L-014); a test that measures a reach alone on a copy without an enemy says so.

// ---------------------------------------------------------------------------------------------------------------------------------------
// Part 1: the layout, from GDD-WLD-18's bullets.

/** GDD-WLD-18's ground, column by column: [from, to, top row]; the pits and the slopes are left out. */
const GROUND: readonly (readonly [number, number, number])[] = [
  [0, 4, 34], [5, 6, 35], [8, 9, 34], [14, 31, 35], [32, 33, 35], [34, 52, 26], [54, 58, 27], [59, 71, 28], [75, 88, 25], [99, 107, 29], [108, 119, 22], [127, 140, 25], [153, 159, 25],
  [167, 167, 25], [176, 198, 25], [199, 201, 25], [202, 210, 17], [211, 215, 9], [219, 225, 12], [232, 234, 15], [235, 239, 4],
];
/** The open pits and the pits under the plank bridges: [from, to]. */
const PITS: readonly (readonly [number, number])[] = [[10, 13], [89, 98], [120, 126], [141, 152], [160, 166], [168, 175], [226, 231]];
/** The slopes: [from, to, row of the first slope tile, its character]: down to the right, one row a column, or up. */
const SLOPES: readonly (readonly [number, number, number, '\\' | '/'])[] = [[7, 7, 34, '/'], [53, 53, 26, '\\'], [72, 74, 27, '/'], [216, 218, 9, '\\']];
/** Pier V's hollow (its wall to row 31, its floor in row 31 and its cap; the shelf runs under it, rows 32 to 34 open)  and the piñatas' walls: [from, to, first row, last row]. */
const PIECES: readonly (readonly [number, number, number, number])[] = [[22, 22, 26, 31], [23, 24, 31, 31], [22, 25, 26, 26], [62, 62, 26, 27], [132, 132, 23, 24]];

const slopeRow = ([a, , row, ch]: (typeof SLOPES)[number], col: number) => (ch === '\\' ? row + col - a : row - (col - a));
/** Is tile (col, row) solid by the tables? The spring's tile at (106, 29) is an empty tile in the rows. */
const solid = (col: number, row: number) => {
  if (col === 106 && row === 29) return false;
  const ground = GROUND.find(([a, b]) => col >= a && col <= b)?.[2];
  const slope = SLOPES.find(([a, b]) => col >= a && col <= b);
  return (ground !== undefined && row >= ground) || (slope !== undefined && row > slopeRow(slope, col)) || PIECES.some(([a, b, r0, r1]) => col >= a && col <= b && row >= r0 && row <= r1);
};

/** The top row of the table's ground in column `col`. */
const groundRow = (col: number) => GROUND.find(([a, b]) => col >= a && col <= b)![2];

/** The hilos standing in a solid tile or a slope tile, as "col,row". */
const hilosInTiles = (level: Level) => level.hilos!.filter((h) => level.world.solidTile(h.col, h.row) || level.world.slopeAt(h.col, h.row) !== null).map((h) => `${h.col},${h.row}`);

/** The bank GDD-WLD-15's limit reads: tiles from rail `n`'s broken end to column `col`, and the drop. */
const bank = (n: Name, col: number) => ({ tiles: col - endOf(n) / TILE, drop: groundRow(col) - railGround(railOf(n), railLength(railOf(n))) / TILE });

describe('GDD-WLD-18 level 3-3 layout', () => {
  it('GDD-WLD-18 3-3 is 240 by 37 tiles and passes the validator', () => {
    expect([world.width, world.height]).toEqual([240, 37]);
    // Every check, (h) included (GDD-ENM-04, user, 2026-11-17: "Every button").
    expect(validateLevel(entry())).toEqual([]);
    // GDD-PRG-01: the glide on, the wall cling off; its crumbling planks come back (GDD-WLD-05).
    expect(L.abilities).toEqual({ glide: true });
    expect(L.crumblesReturn).toBe(true);
    // The spawn at column 2 on G0 (row 34), the exit at column 234 on the bank (row 15): x = 234 * 16 + 8, y = 240, 19 tiles over the start.
    expect(L.spawn).toEqual({ x: mid(2), y: Y(34) });
    expect(L.exit).toEqual({ x: 234 * 16 + 8, y: 240 });
    expect((L.spawn.y - L.exit!.y) / TILE).toBe(19);
    // The lowest ground is row 35, with 2 rows of rock under it; the highest row 9, under 9 empty rows.
    expect(Math.max(...GROUND.map((g) => g[2]))).toBe(35);
    expect(world.height - 35).toBe(2);
    for (let row = 0; row < 9; row++) for (let col = 0; col < 235; col++) expect(world.solidTile(col, row), `${col},${row}`).toBe(false);
    // The veladora in the hollow at column 23, row 30; the piñatas at 64 row 24 and at 134 row 21, each 48 px over its ground.
    expect(L.veladora).toEqual({ col: 23, row: 30 });
    expect(L.pinatas).toEqual([{ col: 64, row: 24 }, { col: 134, row: 21 }]);
    expect([Y(28) - Y(25), Y(25) - Y(22)]).toEqual([48, 48]);
    // The spring at column 106 in L1's top, the planks, the platforms (`y` their tops: the perch's 40 px over P1, y = 376).
    expect(L.springs).toEqual([{ col: 106, row: 29 }]);
    expect(L.crumbles.map((c) => `${c.col},${c.row}`)).toEqual([
      ...[...Array(12).keys()].map((i) => `${141 + i},25`),
      ...[...Array(7).keys()].map((i) => `${160 + i},25`),
      ...[...Array(8).keys()].map((i) => `${168 + i},25`),
      '204,15', '205,15', '206,13', '207,13', '208,11', '209,11',
    ]);
    expect(L.platforms).toEqual([
      { x0: 512, y0: 560, x1: 512, y1: 416, w: 32 },
      { x0: 672, y0: 376, x1: 672, y1: 376, w: 32 },
      { x0: 1680, y0: 416, x1: 1680, y1: 352, w: 48 },
      { x0: 3184, y0: 400, x1: 3184, y1: 272, w: 48 },
    ]);
  }, 60_000);

  it("GDD-WLD-18 3-3 ground, slopes, the hollow and the gable are the table's, tile for tile", () => {
    for (let col = 0; col < 240; col++) {
      for (let row = 0; row < 37; row++) {
        expect(world.solidTile(col, row), `${col},${row}`).toBe(solid(col, row));
        const slope = SLOPES.find(([a, b]) => col >= a && col <= b);
        expect(world.slopeAt(col, row), `slope ${col},${row}`).toBe(slope && row === slopeRow(slope, col) ? slope[3] : null);
      }
    }
    // Every column is a ground, a pit or a slope, and only one.
    for (let col = 0; col < 240; col++) {
      const kinds = [GROUND.some(([a, b]) => col >= a && col <= b), PITS.some(([a, b]) => col >= a && col <= b), SLOPES.some(([a, b]) => col >= a && col <= b)];
      expect(kinds.filter(Boolean).length, `column ${col}`).toBe(1);
    }
    // Each slope joins the grounds either side: R1's from C1's dip (35) up to G0 (34), R2's from P1 (26) to T1's step (27), R3's from T1 (28) up to P2 (25), R7's from P6 (9) to the
    // shelf (12).
    expect(SLOPES.map(([a, b, row, ch]) => (ch === '\\' ? [row, row + b - a + 1] : [row + 1, row - (b - a)]))).toEqual([[35, 34], [26, 27], [28, 25], [9, 12]]);
    // The hollow: rows 27 to 30 of columns 23 and 24 are empty, under the cap and over the floor, and open to the right (25, under the cap).
    for (let row = 27; row <= 30; row++) for (const col of [23, 24, 25]) expect(world.solidTile(col, row), `${col},${row}`).toBe(false);
    // The tunnel under pier V (user, 2026-11-18): the wall (column 22) and the floor (23 and 24) stop at row 31, rows 32 to 34 are open under them and row 35, the shelf's top, is solid.
    for (let row = 32; row <= 34; row++) for (const col of [22, 23, 24]) expect(world.solidTile(col, row), `${col},${row}`).toBe(false);
    for (const col of [22, 23, 24]) expect([world.solidTile(col, 31), world.solidTile(col, 35)], `${col}`).toEqual([true, true]);
    // The gable: solid from row 4 down, over the exit bank's 11 rows.
    expect(Y(15) - Y(4)).toBe(176);
  });

  it('GDD-WLD-18 3-3 pits and their raised bottoms', () => {
    expect(gaps(world, L.bottoms).map((g) => [g.col, g.col + g.width - 1])).toEqual(PITS);
    expect(openGaps(L).map((g) => [g.col, g.col + g.width - 1])).toEqual(PITS);
    expect(Object.values(LEVEL_3_3_PITS).map((p) => [p.col0, p.col1])).toEqual(PITS);
    // Each open gap: its width, the drop from its left bank to its right (tiles), and World 3's limit for that drop (GDD-WLD-03); the bridges'
    // pits hold planks, banks at their own height, so they are no gap (a plank is a bank, not a pit column, in a level whose ledges return).
    const rule = LEVEL_RULES.world3Gap;
    const open = [[10, 13], [89, 98], [120, 126], [226, 231]].map(([a, b]) => {
      const drop = groundRow(b! + 1) - groundRow(a! - 1);
      return { width: b! - a! + 1, drop, limit: rule.base + rule.perDropTile * drop };
    });
    expect(open).toEqual([
      { width: 4, drop: 1, limit: 7 },
      { width: 10, drop: 4, limit: 10 },
      { width: 7, drop: 3, limit: 9 },
      { width: 6, drop: 3, limit: 9 },
    ]);
    // The bridges: 12, 7 and 8 tiles, every pit column under a plank at the lips' height (row 25), and no pit has a higher far side.
    for (const [a, b] of [[141, 152], [160, 166], [168, 175]]) {
      for (let col = a!; col <= b!; col++) expect(L.crumbles.some((c) => c.col === col && c.row === 25), `${col}`).toBe(true);
      expect([groundRow(a! - 1), groundRow(b! + 1)]).toEqual([25, 25]);
    }
    // The raised bottoms, 4 rows under each pit's lower lip but bridge B's, 5 under it; the first pit's would be row 39, past the last row
    // (36), so it has none and is open to the level's last row.
    expect(L.bottoms).toEqual([
      { fromCol: 89, toCol: 98, row: 29 + 4 },
      { fromCol: 120, toCol: 126, row: 25 + 4 },
      { fromCol: 141, toCol: 152, row: 25 + 4 },
      { fromCol: 160, toCol: 175, row: 25 + 5 },
      { fromCol: 226, toCol: 231, row: 15 + 4 },
    ]);
    expect(35 + 4).toBeGreaterThan(world.height - 1);
    // GDD-UI-04, GDD-ENM-04 (h): bridge B's bottom is 5 rows down, the fewest that pass. Its floor line is (30 + 1) * 16 = 496 and the camera's
    // bottom limit at column 165 is 496 - 2 - 270 = 224; his feet on a plank at 400 want 400 - 162 = 238, clamped to 224, and K2's cart's box
    // (its bottom on the rail's ground, 400) is on screen at 160 to 176, 4 px clear of the mirrored mode switch (180 to 220). With the bottom
    // 4 rows down (row 29) the limit is 480 - 2 - 270 = 208, the box at 176 to 192, 12 px into the switch.
    expect(cameraLimitsAt(L, mid(165)).bottom).toBe(224);
    const at29: Level = { ...L, bottoms: L.bottoms!.map((b) => (b.fromCol === 160 ? { ...b, row: 29 } : b)) };
    expect(cameraLimitsAt(at29, mid(165)).bottom).toBe(208);
    expect(validateLevel(entry(at29))).toEqual([
      "cacomixtle at 2848,392 has its cart's box 32 x 12 px over the phone's mode button (mirrored layout, buttons mode) where it first sees him, standing at column 165, y 400",
    ]);
    // Bridge A's bottom (141 to 152) keeps its own limit: the camera's limits are read from the column he is in alone.
    expect(cameraLimitsAt(L, mid(150)).bottom).toBe(208);
    // The gap rule at its limit: the chasm is 10 tiles and 4 down, the limit; one tile wider (L1 starting at 100) fails.
    const rows = LEVEL_3_3_ROWS.map((s, row) => (row >= 29 ? `${s.slice(0, 99)}.${s.slice(100)}` : s));
    const wider: Level = { ...L, world: parseTiles(rows), bottoms: L.bottoms!.map((b) => (b.fromCol === 89 ? { ...b, toCol: 99 } : b)) };
    expect(validateLevel(entry(wider))).toEqual(['gap of 11 tiles at columns 89 to 99 with a drop of 4 tiles, World 3 allows 10']);
  });

  it('GDD-WLD-18 3-3 rails: each start, stretches and end; each ride measured by rolling its cart', () => {
    const table = NAMES.map((n) => {
      const r = railOf(n);
      return { n, middle: r.x + (r.dir * CART.width) / 2, y: r.y, dir: r.dir, segments: r.segments.map((s) => `${s.kind} ${s.tiles}`), end: r.end, endX: endOf(n), endY: railGround(r, railLength(r)) };
    });
    expect(table).toEqual([
      { n: 'R1', middle: Y(6), y: Y(35), dir: 1, segments: ['level 2', 'climb 1', 'level 3', 'climb 4', 'level 2', 'climb 4', 'level 18'], end: 'buffer', endX: Y(39), endY: Y(26) },
      { n: 'R2', middle: 928, y: Y(27), dir: -1, segments: ['level 5', 'climb 1', 'level 11'], end: 'buffer', endX: Y(42), endY: Y(26) },
      { n: 'R3', middle: Y(69), y: Y(28), dir: 1, segments: ['level 4', 'climb 3', 'level 15'], end: 'broken', endX: 1440, endY: Y(25) },
      { n: 'R4', middle: Y(138), y: Y(25), dir: 1, segments: ['level 19'], end: 'buffer', endX: Y(156), endY: Y(25) },
      { n: 'R5', middle: 2848, y: Y(25), dir: -1, segments: ['level 21'], end: 'buffer', endX: Y(158), endY: Y(25) },
      { n: 'R6', middle: 3152, y: Y(25), dir: -1, segments: ['level 16'], end: 'buffer', endX: Y(182), endY: Y(25) },
      { n: 'R7', middle: Y(213), y: Y(9), dir: 1, segments: ['level 4', 'descent 3', 'level 8'], end: 'broken', endX: 3632, endY: Y(12) },
    ]);
    // The slopes under R2, R3 and R7 lie under the rail: its ground at each slope's ends is the ground's there; R2's row-27 stretch lies on
    // T1's step (54 to 58).
    expect([railGround(railOf('R2'), Y(59) - Y(54)), railGround(railOf('R2'), Y(59) - Y(53))]).toEqual([Y(27), Y(26)]);
    expect([railGround(railOf('R3'), Y(72) - Y(68)), railGround(railOf('R3'), Y(75) - Y(68))]).toEqual([Y(28), Y(25)]);
    expect([railGround(railOf('R7'), Y(216) - Y(212)), railGround(railOf('R7'), Y(219) - Y(212))]).toEqual([Y(9), Y(12)]);
    // The posts, 6 tiles (96 px) before each broken end: R3's at 84, R7's at 221; the buffer rails have none. Each broken end is 15 and 8
    // level tiles after its slope and 22 and 15 tiles from its cart's start.
    expect(NAMES.map((n) => warningPost(railOf(n))?.x)).toEqual([undefined, undefined, Y(84), undefined, undefined, undefined, Y(221)]);
    expect([railLength(railOf('R3')) / TILE, railLength(railOf('R7')) / TILE]).toEqual([22, 15]);
    // GDD-WLD-15's limits left to the level's test: from each broken end to the far bank at most 5 tiles plus one per tile of drop (R3: 9
    // tiles to L1, 4 down; R7: 5 tiles to the bank, 3 down), and 7 empty tiles over the rail's ground along each broken rail.
    expect([bank('R3', 99), bank('R7', 232)]).toEqual([{ tiles: 9, drop: 4 }, { tiles: 5, drop: 3 }]);
    for (const n of ['R3', 'R7'] as const) {
      const rail = railOf(n);
      for (let across = TILE / 2; across < railLength(rail); across += TILE) {
        const [col, row] = [Math.floor((rail.x + across) / TILE), Math.floor(railGround(rail, across) / TILE)];
        for (let k = 1; k <= 7; k++) expect(world.solidTile(col, row - k), `${n} over ${col},${row - k}`).toBe(false);
      }
    }
    // Each cart rolled alone from its start, to its buffer or to leaving its broken end; for a Cacomixtle's, also to the column GDD-WLD-18
    // says it reaches (its box's front edge into that column: K1's 46 on P1, K2's pier at 167, K3's 187), plus its 30-step telegraph.
    const reach: Partial<Record<Name, number>> = { R2: 46, R5: 167, R6: 187 };
    const rides = NAMES.map((n) => {
      const i = cartOf(n);
      const rail = railOf(n);
      let carts: CartState[] = LEVEL_3_3_RAILS.map((_, j) => ({ phase: j === i ? 'rolling' : 'waiting', m: CART.width / 2 }));
      let k = 0;
      let to: number | undefined;
      const front = () => rail.x + rail.dir * (carts[i]!.m + CART.width / 2);
      for (; k < 900 && carts[i]!.phase === 'rolling'; k++) {
        carts = rollCarts(LEVEL_3_3_RAILS, carts);
        if (to === undefined && reach[n] !== undefined && front() < (reach[n] + 1) * TILE) to = k + 1 + CACOMIXTLE.telegraphSteps;
      }
      return { n, steps: k, ...(to !== undefined ? { fromFlash: to } : {}) };
    });
    expect(rides).toEqual([
      { n: 'R1', steps: 249 }, // 4.15 s, as GDD-WLD-18 gives it
      { n: 'R2', steps: 101, fromFlash: 99 }, // 1.68 s to its buffer; at column 46 1.65 s after the first flash, as GDD-WLD-18 gives it
      { n: 'R3', steps: 149 }, // 2.48 s from the cart's start at 68, as GDD-WLD-18 gives it
      { n: 'R4', steps: 109 }, // 1.82 s, as GDD-WLD-18 gives it
      { n: 'R5', steps: 122, fromFlash: 88 }, // 2.03 s to its buffer; at the pier 1.47 s after the first flash, as GDD-WLD-18 gives it
      { n: 'R6', steps: 90, fromFlash: 82 }, // 1.5 s to its buffer; at column 187 1.37 s after the first flash, as GDD-WLD-18 gives it
      { n: 'R7', steps: 93 }, // 1.55 s, as GDD-WLD-18 gives it
    ]);
  });
});

describe('GDD-WLD-18 level 3-3 its things', () => {
  it('GDD-WLD-18 3-3 has the 50 hilos as listed, none in a tile', () => {
    const listed: readonly (readonly [number, number])[] = [
      [3, 33], [4, 32], [8, 32], [13, 30], [15, 28], [19, 26], [23, 24], [27, 24], [31, 24], [35, 24],
      [30, 27], [27, 28], [42, 22], [43, 22], [53, 25], [62, 25],
      [70, 26], [73, 24], [77, 23], [81, 23], [85, 23], [88, 23], [93, 20], [96, 21], [99, 23], [102, 24],
      [106, 26], [106, 24], [113, 14], [118, 12], [123, 10], [124, 10], [122, 17], [126, 19],
      [132, 22], [144, 23], [148, 23], [167, 23], [190, 23], [200, 21], [200, 18], [205, 13], [207, 11], [209, 9],
      [217, 8], [221, 10], [224, 10], [229, 7], [232, 8], [233, 13],
    ];
    expect(L.hilos!.map((h) => [h.col, h.row])).toEqual(listed);
    expect(listed).toHaveLength(50);
    expect(hilosInTiles(L)).toEqual([]);
    // None above row 7.
    expect(Math.min(...listed.map(([, row]) => row))).toBe(7);
    // (3,33) is air over G0 (row 34) and (23,24) air over R1's level stretch in row 26; moved into the cap's row, (23,26), it is in a tile.
    const moved: Level = { ...L, hilos: L.hilos!.map((h) => (h.col === 23 && h.row === 24 ? { col: 23, row: 26 } : h)) };
    expect(hilosInTiles(moved)).toEqual(['23,26']);
  });

  it('GDD-WLD-18 3-3 ofrendas at 65, 130, 203', () => {
    expect(L.ofrendas.map((o) => [o.id, o.x, o.y])).toEqual([
      ['3-3-1', mid(65), Y(28)],
      ['3-3-2', mid(130), Y(25)],
      ['3-3-3', mid(203), Y(17)],
    ]);
    // Each stands on the ground there: T1, P4 and A.
    for (const o of L.ofrendas) expect([world.solidTile(Math.floor(o.x / TILE), o.y / TILE), world.solidTile(Math.floor(o.x / TILE), o.y / TILE - 1)], o.id).toEqual([true, false]);
    // Their share of the width, from their middles: GDD says 27.1%, 54.2% and 84.6% (each column's left edge over 240).
    expect(L.ofrendas.map((o) => Math.round((o.x / (240 * TILE)) * 1000) / 10)).toEqual([27.3, 54.4, 84.8]);
    expect([65, 130, 203].map((c) => Math.round((c / 240) * 1000) / 10)).toEqual([27.1, 54.2, 84.6]);
    // Each is 3 to 9 tiles before a cart of his: C2 at 68, C3 at 137, C4 at 212.
    expect([68 - 65, 137 - 130, 212 - 203]).toEqual([3, 7, 9]);
    expect([railOf('R3').x, railOf('R4').x, railOf('R7').x].map((x) => x / TILE)).toEqual([68, 137, 212]);
  });

  it('GDD-WLD-18 3-3 enemies: eight, as listed, each 3 tiles or more from every respawn', () => {
    expect(L.enemies).toEqual([
      { x: 928, y: Y(27) - 8, kind: 'cacomixtle', rail: 1 },
      { x: 2848, y: Y(25) - 8, kind: 'cacomixtle', rail: 4 },
      { x: 3152, y: Y(25) - 8, kind: 'cacomixtle', rail: 5 },
      { x: mid(114), y: Y(22), kind: 'armadillo' },
      { x: mid(111), y: Y(22) - 48, kind: 'murcielago', ry: 8 },
      { x: mid(116), y: Y(22) - 80, kind: 'murcielago', ry: 8 },
      { x: mid(121), y: Y(22) - 112, kind: 'murcielago', ry: 8 },
      // Its line from 2976 to 3072: 48 px either side of x = 3024, column 188.5's middle (ZOPILOTE.range), so its sight (96 px more) is x 2880 to 3168,
      // clear of a rider on MP2 (from x 3179); at y = 280: the lowest point of its cruise 108 px over P5's top (the bob 12 px either way).
      { x: 189 * TILE, y: Y(25) - 108 - 12, kind: 'zopilote' },
    ]);
    // GDD-ENM-01: 3 tiles (48 px, the validator's rule, which passes); 3-2's own 192 px is not GDD-WLD-18's. The nearest is K1, 122.4 px from
    // the first ofrenda, 120 across and 24 up (GDD says 120).
    const d = L.enemies.flatMap((e) => [L.spawn, ...L.ofrendas].map((r) => ({ kind: kindOf(e), x: e.x, to: r.x, d: Math.hypot(e.x - r.x, e.y - r.y) })));
    expect(d.filter((x) => x.d < LEVEL_RULES.enemyClearance)).toEqual([]);
    const nearest = d.reduce((a, b) => (b.d < a.d ? b : a));
    expect(nearest).toMatchObject({ kind: 'cacomixtle', x: 928, to: mid(65) });
    expect(nearest.d).toBeCloseTo(122.38, 2);
    // 3-2's test held its enemies 192 px from every respawn; two of 3-3's are nearer: K1 to the first ofrenda, K3 (158.8 px) to the third.
    expect(d.filter((x) => x.d < 192).map((x) => `${x.kind} ${x.x} to ${x.to} ${x.d.toFixed(1)}`)).toEqual(['cacomixtle 928 to 1048 122.4', 'cacomixtle 3152 to 3256 158.8']);
  });

  it('GDD-WLD-18 3-3 the Cacomixtles pass every validator check, K1 with no sight exception', () => {
    // GDD-ENM-04 (f) and (h) for the three Cacomixtles, and no exception named: K1's ground rule passes once its cart waits a row higher.
    expect(validateLevel(entry()).filter((p) => p.startsWith('cacomixtle'))).toEqual([]);
    expect(L.enemies.filter((e) => e.sightException !== undefined)).toEqual([]);
    // K1 from P1, after the rise: R2's ground under the cart's middle is 432 (row 27), the cart's floor 424, its box 416 to 432. The sight's
    // edge is 216 px ahead of the rail's start: x = 944 - 216 = 728, column 45, on P1. His feet at 416 put the camera at 416 - 162 = 254
    // (under column 45's bottom limit, 592 - 2 - 270 = 320), so the box is on screen at 162 to 178, 2 px over the mirrored mode switch (180).
    const r2 = railOf('R2');
    const edge = r2.x + r2.dir * (CART.width / 2 + CACOMIXTLE.sightX);
    expect([railGround(r2, CART.width / 2), L.enemies[0]!.y, edge, cameraLimitsAt(L, edge).bottom]).toEqual([432, 424, 728, 320]);
    const cameraY = Y(LEVEL_3_3_AT.P1.row) - CAMERA.upFeet;
    const ground = railGround(r2, CART.width / 2);
    expect([cameraY, ground - CART.height - cameraY, ground - cameraY]).toEqual([254, 162, 178]);
    // (f) by the numbers: P1's top (416) is 8 px over the cart's floor and T1's step (432) 8 px under it, both within 8. The perch (672 to 704)
    // is short of the sight's edge, outside the stretch's columns (45 to 57): at 45 and 46 (720 to 752) it held x = 728.
    expect([L.enemies[0]!.y - Y(LEVEL_3_3_AT.P1.row), Y(LEVEL_3_3_AT.T1step.row) - L.enemies[0]!.y]).toEqual([8, 8]);
    const perch = LEVEL_3_3_PLATFORM.perch;
    expect([perch.x0, perch.x0 + perch.w, perch.y0]).toEqual([672, 704, 376]);
    expect(perch.x0 + perch.w).toBeLessThan(edge);
  });
});

/** K1, the first enemy, in run `r`. */
const k1 = (r: RunState) => r.enemies[0]!;

/** R1's hilos: into C1, then along R1 at the rider's chest. */
const R1_HILOS: readonly (readonly [number, number])[] = [[3, 33], [4, 32], [8, 32], [13, 30], [15, 28], [19, 26], [23, 24], [27, 24], [31, 24], [35, 24]];

/** Right held from the spawn, nothing else, until C1 stops at its buffer (or 600 steps): every state. */
const walkIntoC1 = () => play(startRun(L), 600, () => right, (r) => r.carts[0]!.phase === 'stopped' || r.phase !== 'playing');

// A hop: right held from the spawn until his middle is at x, then jump held while he rises, the direction held on (`run`) or let go
// (`up`, a hop straight up as he slows); nothing held once C1 rolls, to its buffer.
const hop = (x: number, way: 'run' | 'up') => {
  let boarded = -1;
  let stopped = -1;
  let pressed = false;
  const ride = play(
    startRun(L),
    600,
    (r) => {
      if (boarded >= 0) return idle;
      if (!pressed && r.player.x >= x) pressed = true;
      return { move: pressed && way === 'up' ? 0 : 1, jumpHeld: pressed && (r.player.grounded || r.player.vy < 0) };
    },
    (r, i) => {
      if (boarded < 0 && r.carts[0]!.phase !== 'waiting') boarded = i;
      if (stopped < 0 && r.carts[0]!.phase === 'stopped') stopped = i;
      return stopped >= 0 || r.phase !== 'playing';
    },
  );
  const end = last(ride);
  return { boarded, stopped, lives: end.lives.lives, missed: R1_HILOS.filter(([c, w]) => !took(end, c, w)).map(([c, w]) => `${c},${w}`), end };
};

describe('GDD-WLD-18 level 3-3 Ki, measured', () => {
  it('GDD-WLD-18 3-3 C1 boarded on foot: right held from the spawn drops into the dip onto its floor and rides R1 to P1', () => {
    // GDD-WLD-18: "right held from the spawn boards C1". C1 stands in G0's dip (columns 5 and 6, row 35): its floor is at 552, 8 px under
    // G0's top (544), so he walks off G0's edge (x = 80) and lands on it, which starts it (GDD-WLD-15), with no hop.
    const walk = walkIntoC1();
    const landed = walk.findIndex((r) => r.carts[0]!.phase !== 'waiting');
    expect([landed + 1, walk[landed]!.player.x, walk[landed]!.player.y, walk[landed]!.player.grounded, inCart(walk[landed]!, 'R1')]).toEqual([34, 96, 552, true, true]);
    expect([railOf('R1').y, Y(LEVEL_3_3_AT.dip.row) - CART.floorPx - Y(LEVEL_3_3_AT.G0.row)]).toEqual([Y(35), 8]);
    expect(walk.slice(0, landed).every((r) => r.player.y <= 552 && r.player.vy >= 0)).toBe(true);
    // The ride, from the landing to the buffer: 249 steps, 4.15 s (GDD says 4.0 s, a target), every life; he stands in C1 at its buffer.
    const stopped = walk.length - 1;
    expect([stopped - landed, last(walk).carts[0]!.phase, last(walk).lives.lives]).toEqual([249, 'stopped', 7]);
    expect(last(walk).player).toMatchObject({ y: Y(26) - 8, grounded: true });
    expect(last(walk).player.x).toBeCloseTo(608, 0);
    // R1 climbs out of the dip over the slope tile at (7, 34), so its line lies on ground and he rides anchored at the cart's middle all the
    // way (with G0's solid tile there instead, his box met it and he stood 7 steps, up to 13.2 px, behind the cart's middle).
    const behind = walk.slice(landed).map((r) => r.player.x - (railOf('R1').x + r.carts[0]!.m)).filter((d) => Math.abs(d) > 0.5);
    expect(behind).toEqual([]);
    // Out at its end: right held on until he stands on P1, then nothing: on P1 short of K1's wake line (x = 728), K1 still waiting, every life.
    const out = play(last(walk), 200, (r) => (r.player.grounded && r.player.y === Y(26) ? idle : right), (r) => r.player.grounded && r.player.y === Y(26) && r.player.vx === 0);
    const off = last(out);
    expect([whereIs(off), off.lives.lives, off.enemies[0]!.ride]).toEqual(['P1', 7, { phase: 'waiting', t: 0 }]);
    expect(off.player.x).toBeLessThan(728);
  });

  it('GDD-WLD-18 3-3 C1 on foot takes every R1 hilo, the two into it on the walk line', () => {
    // The hilos into C1, (3,33) and (4,32), are in empty tiles over G0 where his body (32 px tall, his feet at 544) passes on the walk: he
    // takes them on steps 8 and 16, before the dip; the ride takes the other eight. Every R1 hilo, none missed.
    const walk = walkIntoC1();
    expect([[3, 33], [4, 32]].map(([c, w]) => walk.findIndex((r) => took(r, c!, w!)) + 1)).toEqual([8, 16]);
    expect(hilosInTiles({ ...L, hilos: R1_HILOS.map(([col, row]) => ({ col, row })) })).toEqual([]);
    expect(tookOf(last(walk), R1_HILOS)).toEqual(R1_HILOS.map(([c, w]) => `${c},${w}`));
  });

  it('GDD-WLD-18 3-3 C1 and R1: hops into C1 from the spawn, the ride to the buffer with every R1 hilo, and out onto P1', () => {
    // At a run, take-offs 0.2 tile apart from the spawn to the cart's middle: the take-offs that board, and the hilos into C1 that each misses.
    // The bot jumps again on every landing (`jumpHeld` while grounded): from 40 to 46.4 it lands in C1 over the slope at column 7; from 49.6 to 75.2 the jump clears C1's floor in the dip, lands on G0
    // past it and the next jump carries him into the first pit (lost); from 78.4 to 84.8 the jumps carry him over the pit and on (`past`);
    // from 88 on he has dropped into the dip and boarded on foot before the take-off.
    const running = apart(40, 96).map((x) => {
      const h = hop(x, 'run');
      return `${x.toFixed(1)} ${h.boarded < 0 ? (h.lives < 7 ? 'lost' : 'past') : `in, missing ${h.missed.join(' ') || 'none'}`}`;
    });
    expect(running).toEqual([
      '40.0 in, missing 3,33 4,32',
      '43.2 in, missing 3,33 4,32',
      '46.4 in, missing 4,32',
      ...['49.6', '52.8', '56.0', '59.2', '62.4', '65.6', '68.8', '72.0', '75.2'].map((x) => `${x} lost`),
      ...['78.4', '81.6', '84.8'].map((x) => `${x} past`),
      ...['88.0', '91.2', '94.4'].map((x) => `${x} in, missing none`),
    ]);
    // Walked to the cart and a hop straight up: from 56 to 62.4 he comes down on G0 short of the dip and stands there (no life lost); every
    // take-off from 65.6 to the cart's middle boards it with every R1 hilo, from 88 on by the walk into the dip before the take-off.
    const upright = apart(56, 96).map((x) => {
      const h = hop(x, 'up');
      return `${x.toFixed(1)} ${h.boarded < 0 ? (h.lives < 7 ? 'lost' : 'out') : `in ${h.lives}, missing ${h.missed.join(' ') || 'none'}`}`;
    });
    expect(upright).toEqual([
      ...['56.0', '59.2', '62.4'].map((x) => `${x} out`),
      ...['65.6', '68.8', '72.0', '75.2', '78.4', '81.6', '84.8', '88.0', '91.2', '94.4'].map((x) => `${x} in 7, missing none`),
    ]);
    const { boarded, stopped, end } = hop(72, 'up');
    // The ride from a hop at 72, from the landing to the buffer: 249 steps, 4.15 s (GDD says 4.0 s, a target). He stands in C1 at its buffer,
    // its middle at 608.
    expect([boarded, stopped, stopped - boarded]).toEqual([56, 305, 249]);
    expect(end.player).toMatchObject({ x: 608, y: Y(26) - 8, grounded: true });
    expect(end.lives.lives).toBe(7);
    // Out of the cart at its end: right held until he stands on P1, then nothing: he stands on P1 at x = 650.2 (column 40.6), short of K1's
    // wake line (x = 728), K1 still waiting, every life.
    const out = play(end, 200, (r) => (r.player.grounded && r.player.y === Y(26) ? idle : right), (r) => r.player.grounded && r.player.y === Y(26) && r.player.vx === 0);
    const off = last(out);
    expect(whereIs(off)).toBe('P1');
    expect(off.player.x).toBeCloseTo(650.22, 2);
    expect([out.length, off.lives.lives, off.enemies[0]!.ride]).toEqual([30, 7, { phase: 'waiting', t: 0 }]);
  });

  it('GDD-WLD-18 3-3 the perch: K1 woken from P1 passes under him with its real ringtail and parks under the perch', () => {
    // The perch (672 to 704, its top 376) is short of K1's wake line (x = 728): standing on it never wakes K1, so he wakes it from P1. From
    // x = 650 on P1, right held until K1's telegraph starts; then a jump held to the landing with left held for its first `left` steps; then
    // L-075, he walks to a place on the perch (every 0.2 tile from its left edge to its right, 11 places) and stands there till the cart parks.
    const perch = LEVEL_3_3_PLATFORM.perch;
    const PERCH_TOP = Y(26) - 40;
    const woke = last(play(at(650, Y(26)), 300, () => right, (r) => k1(r).ride!.phase !== 'waiting'));
    // He wakes it on P1 at x = 731.0, 3 px past the line after the step's run.
    expect([whereIs(woke), Math.round(woke.player.x * 10) / 10, k1(woke).ride]).toEqual(['P1', 731, { phase: 'telegraph', t: 1 }]);
    /** From the wake: the jump back, then to `place` (if given), then still until the cart has parked and 120 steps on. */
    const back = (left: number, place?: number) => {
      const jump = play(woke, 200, (_r, i) => ({ move: i < left ? -1 : 0, jumpHeld: true }), (r, i) => i > 0 && r.player.grounded);
      const landed = last(jump);
      let gap = Infinity;
      let hit = false;
      // To the place: towards it while it is farther than his stopping distance on the ground, then nothing.
      const to = (r: RunState): PlayerInput => {
        const d = place === undefined ? 0 : place - r.player.x;
        return Math.abs(d) > r.player.vx ** 2 / (2 * RUN.groundDecel) + 0.5 ? { move: Math.sign(d), jumpHeld: false } : idle;
      };
      const rest = play(landed, 600, to, (r, i) => {
        const e = k1(r);
        // His feet to the ringtail's top (its box 14 tall on the cart's floor) while their boxes overlap across.
        if (Math.abs(r.player.x - e.x) < (HITBOX.width + CACOMIXTLE.width) / 2) gap = Math.min(gap, e.y! - CACOMIXTLE.height - r.player.y);
        if (r.invulnerable > 0) hit = true;
        return r.carts[cartOf('R2')]!.phase === 'stopped' && i >= 120;
      });
      return { landed, end: last(rest), gap, hit };
    };
    // The jump back: with left held 24 steps or more he lands on the perch (from 706.4 to 697.5); less, back on P1 in the cart's path, where
    // the cart hits him.
    const jumps = [...Array(21).keys()].map((n) => {
      const b = back(2 * n);
      return `${2 * n} ${whereIs(b.landed)} ${b.end.lives.lives}`;
    });
    expect(jumps).toEqual([...[...Array(12).keys()].map((n) => `${2 * n} P1 6`), ...[...Array(9).keys()].map((n) => `${24 + 2 * n} perch 7`)]);
    // Standing on the perch at each place: the cart passes under him and parks at its buffer, its middle at 688 under the perch, the ringtail's
    // top 18 px under his feet at the nearest (408 - 14 = 394 against 376); he is never touched and stays on the perch with every life. At the
    // perch's left edge (672) the ringtail, parked at 681 to 695, never comes under him across.
    const places = [...Array(11).keys()].map((k) => perch.x0 + k * 3.2);
    for (const place of places) {
      const b = back(34, place);
      expect([whereIs(b.end), b.end.player.y, b.end.lives.lives, b.hit, b.gap], `${place}`).toEqual(['perch', PERCH_TOP, 7, false, place === 672 ? Infinity : 18]);
      expect(Math.abs(b.end.player.x - place), `${place}`).toBeLessThan(1);
      expect(b.end.carts[cartOf('R2')], `${place}`).toEqual({ phase: 'stopped', m: 256 });
      expect([k1(b.end).alive, k1(b.end).ride!.phase, k1(b.end).x, k1(b.end).y], `${place}`).toEqual([true, 'parked', 688, 408]);
      // The perch's two hilos are over it, (42,22) and (43,22): landing at 697.5 takes the second, walking to its left part the first too.
      expect(tookOf(b.end, [[42, 22], [43, 22]]), `${place}`).toEqual(place < 690 ? ['42,22', '43,22'] : ['43,22']);
    }
  });

  it('GDD-WLD-18 3-3 the shelf and MP0: from the shelf the lift takes him up to P1, at every 6th start time of its round', () => {
    // L-075: from the shelf (column 29), right held, at every 6th start time of MP0's 432-step round (3.6 s each way): he walks onto the
    // lift at its foot (or waits at P1's face for it to come down onto him), rides it up and steps onto P1. Every start time gets there.
    const steps: number[] = [];
    for (let t = 0; t < 432; t += 6) {
      const states = play(at(mid(29), Y(35), 0, t), 900, () => right, (r) => r.player.grounded && r.player.y === Y(26) && r.player.x - 6 >= Y(34));
      const e = last(states);
      expect(states.some((r) => whereIs(r) === 'MP0'), `${t}`).toBe(true);
      expect([whereIs(e), e.lives.lives], `${t}`).toEqual(['P1', 7]);
      steps.push(states.length);
    }
    // From 250 steps (4.2 s, the lift on its way down to him) to 676 (11.3 s, the lift just gone up).
    expect([Math.min(...steps), Math.max(...steps)]).toEqual([250, 676]);
  });
});


/** A lost plain jump: how far his body's front was short of L1's lip (x = 1584) when his feet went below its top. */
const short = (f: Flight) => {
  const q = f.states.find((r) => r.player.y > Y(29));
  return q ? Math.round((Y(99) - (q.player.x + HITBOX.width / 2)) * 10) / 10 : null;
};

describe('GDD-WLD-18 level 3-3 Sho, measured', () => {
  it("GDD-WLD-18 3-3 R3's broken end: a jump held and a plain one at every step from the post to the end and through coyote time", () => {
    const ride = rideOn('R3', 6);
    const leave = ride.findIndex((s) => s.carts[cartOf('R3')]!.phase === 'falling');
    const post = ride.findIndex((s) => middleOf(s, 'R3') >= warningPost(railOf('R3'))!.x);
    // The cart's middle passes the post at column 84 on step 111 of the ride and leaves the rail on step 149 (2.48 s after the landing).
    expect([post, leave]).toEqual([111, 149]);
    // A still rider takes R3's six hilos by the end.
    expect(tookOf(ride[leave]!, [[70, 26], [73, 24], [77, 23], [81, 23], [85, 23], [88, 23]])).toEqual(['70,26', '73,24', '77,23', '81,23', '85,23', '88,23']);
    // Each take-off is a state of the ride (k counted from the step the cart leaves the rail: a press at k = -1 is on the leaving step, at
    // k = 4 the last of coyote time), right held: where a held jump and a plain one end. A held jump that comes down on the spring at 106
    // is launched against P3's face and lands on L1 (`+spring`).
    const flights = ride.slice(1, leave + 6).map((s, i) => ({ k: i + 1 - leave, s, held: fly(s, 'held', 1), plain: fly(s, 'top', 1) }));
    const runs = (as: (f: (typeof flights)[number]) => string) => {
      const out: string[] = [];
      let from = 0;
      for (let i = 1; i <= flights.length; i++) {
        if (i < flights.length && as(flights[i]!) === as(flights[from]!)) continue;
        out.push(`${flights[from]!.k} to ${flights[i - 1]!.k} ${as(flights[from]!)}`);
        from = i;
      }
      return out;
    };
    expect(runs((f) => `${landedAs(f.held)}${bounced(f.held) ? '+spring' : ''}`)).toEqual([
      '-148 to -136 cart R3', '-135 to -130 P2', '-129 to -119 cart R3', '-118 to -97 P2', '-96 to -69 cart R3',
      // The window that lands on L1: 169.3 px before the end (k = -68) to the last step of coyote time.
      '-68 to -31 L1', '-30 to -20 L1+spring', '-19 to 4 L1',
      '5 to 5 lost',
    ]);
    expect(runs((f) => landedAs(f.plain))).toEqual(['-148 to -134 cart R3', '-133 to -130 P2', '-129 to -107 cart R3', '-106 to -97 P2', '-96 to -35 cart R3', '-34 to 5 lost']);
    const byK = (k: number) => flights.find((f) => f.k === k)!;
    // Held from the post (k = -38, 94.3 px before the end) he lands at column 104.4 (GDD says 104.3); from 3 tiles before it (k = -19, 46.8
    // px) at 107.4 (GDD says 107.3); from the end (k = 0) he meets P3's face 19.3 px over L1 (GDD says 19) and drops onto it.
    expect([post - leave, colOf(byK(-38).held)]).toEqual([-38, 104.4]);
    expect(Math.round((1440 - byK(-38).s.player.x) * 10) / 10).toBe(94.3);
    expect([Math.round((1440 - byK(-19).s.player.x) * 10) / 10, colOf(byK(-19).held)]).toEqual([46.8, 107.4]);
    expect([faceOf(byK(0).held, Y(108), Y(29)), colOf(byK(0).held)]).toEqual([19.3, 107.6]);
    // A plain jump from the post lands back in the cart, which rides on to the end; from k = -34 on it falls short: from the end by 22.3 px
    // (GDD says 23), from the last step of coyote time by 14.8 px (GDD says about 8).
    expect([short(byK(-34).plain), short(byK(0).plain), short(byK(4).plain)]).toEqual([107.2, 22.3, 14.8]);
    // The hilos (93,20) (96,21) (99,23) (102,24) are on the held jump's line from the end (a press on the leaving step).
    expect([[93, 20], [96, 21], [99, 23], [102, 24]].every(([c, w]) => took(byK(-1).held.landed!, c!, w!))).toBe(true);
    // Every life is kept by every landing; staying in costs one, in the chasm, 185 steps after the landing in C2.
    for (const f of flights) if (!f.held.lost) expect(f.held.landed!.lives.lives).toBe(7);
    const stay = play(ride[0]!, 600, () => idle, (r) => r.phase !== 'playing');
    expect([stay.length, last(stay).lives.lives]).toEqual([185, 6]);
  });

  it("GDD-WLD-18 3-3 on foot from P2's lip: a held jump and a plain one over the 3 tiles before it, standing and running", () => {
    const lip = Y(89);
    const out: string[] = [];
    for (const vx of [0, 120]) {
      for (const x of apart(lip - 3 * TILE, lip)) {
        expect(standsOnTile(x, 25), `${x}`).toBe(true);
        const h = fly(at(x, Y(25), vx), 'held', 1);
        const t = fly(at(x, Y(25), vx), 'top', 1);
        expect([landedAs(h), h.landed?.lives.lives, landedAs(t)], `${vx} at ${x}`).toEqual(['L1', 7, 'lost']);
        out.push(`${vx === 0 ? 'standing' : 'running'} ${(lip - x).toFixed(1)} ${colOf(h)}`);
      }
    }
    // Every held jump lands on L1, the farthest from the lip at a run, column 104.4 (GDD says 104.1), one 2 tiles early at 102.4 (GDD says
    // 102.3); standing, 103.7 and 101.7. Every plain jump is lost.
    const landing = (way: string, px: string) => out.find((o) => o.startsWith(`${way} ${px} `))!.split(' ')[2];
    expect([landing('running', '0.0'), landing('running', '32.0'), landing('standing', '0.0'), landing('standing', '32.0')]).toEqual(['104.4', '102.4', '103.7', '101.7']);
    expect([landing('running', '48.0'), landing('standing', '48.0')]).toEqual(['101.4', '100.7']);
  });

  it('GDD-WLD-18 3-3 the spring and MP1: a plain launch at every 8th arrival time of the lift, to P3', () => {
    // From L1 (column 103) right held onto the spring, no button pressed: nothing held from the launch until he stands on MP1, then right
    // held, against P3's face as the lift rises, onto P3 at its top. At each of 24 start times of MP1's 192-step round (8 steps apart).
    const out: number[] = [];
    for (let t = 0; t < 192; t += 8) {
      let launched = false;
      let onLift = false;
      const states = play(at(mid(103), Y(29), 0, t), 900, (r) => {
        if (r.player.vy < -400) launched = true;
        if (whereIs(r) === 'MP1') onLift = true;
        return !launched || onLift ? right : idle;
      }, (r) => r.phase !== 'playing' || (r.player.grounded && r.player.y === Y(22) && r.player.x - 6 >= Y(108)));
      const launch = states.findIndex((r) => r.player.vy < -400);
      const e = last(states);
      expect([whereIs(e), e.lives.lives, launch], `${t}`).toEqual(['P3', 7, 21]);
      // The spring's two hilos are on the launch's line.
      expect(tookOf(e, [[106, 26], [106, 24]]), `${t}`).toEqual(['106,26', '106,24']);
      out.push(states.length - launch);
    }
    // From the launch to standing on P3: 85 to 269 steps (1.4 to 4.5 s; GDD says 94 to 278), none lost.
    expect([Math.min(...out), Math.max(...out)]).toEqual([85, 269]);
    // With right held through the launch too, he flies against P3's face and, at 12 of the 24 times (the lift above his launch's top),
    // comes down on L1 beside the spring, under the lift, where right held keeps him (no life lost): the plain launch reaches the lift at
    // any arrival time only when he lets go in the air.
    const held: number[] = [];
    for (let t = 0; t < 192; t += 8) {
      const e = last(play(at(mid(103), Y(29), 0, t), 900, () => right, (r) => r.phase !== 'playing' || (r.player.grounded && r.player.y === Y(22) && r.player.x - 6 >= Y(108))));
      expect(e.lives.lives).toBe(7);
      if (whereIs(e) === 'P3') held.push(t);
    }
    expect(held).toEqual([0, 104, 112, 120, 128, 136, 144, 152, 160, 168, 176, 184]);
  });

  it("GDD-WLD-18 3-3 the glide on foot from P3's lip over the pit to P4, and the ofrenda at 130 it passes over", () => {
    const lip = Y(120);
    const out: string[] = [];
    const glideHilos: string[] = [];
    for (const vx of [0, 120]) {
      for (const x of apart(lip - 3 * TILE, lip)) {
        expect(standsOnTile(x, 22), `${x}`).toBe(true);
        const h = fly(at(x, Y(22), vx), 'held', 1);
        const t = fly(at(x, Y(22), vx), 'top', 1);
        // Held, he lands on P4 with every life, and his flight passes over the ofrenda at 130 and reaches it (GDD-WLD-05's fly-over rule).
        expect([landedAs(h), h.landed!.lives.lives, h.landed!.checkpointIndex, h.states.some((r) => touchesOfrenda(r.player, L.ofrendas[1]!))], `${vx} at ${x}`).toEqual(['P4', 7, 1, true]);
        expect(landedAs(t), `${vx} at ${x}`).toBe('lost');
        out.push(`${vx === 0 ? 'standing' : 'running'} ${(lip - x).toFixed(1)} ${colOf(h)} ${underBat(h).toFixed(1)}`);
        glideHilos.push(`${vx === 0 ? 'standing' : 'running'} ${tookOf(h.landed!, [[122, 17], [126, 19]]).join(' ') || 'none'}`);
      }
    }
    const of = (way: string, px: string) => out.find((o) => o.startsWith(`${way} ${px} `))!.split(' ').slice(2);
    // From the lip, and from 2 tiles early, a held jump lands against the wall at 132 (GDD says 131.6), standing and running; from 3 tiles
    // early standing, at 130.0, over the ofrenda's column. Under the last bat (GDD says the plain glide passes 17 px under it): from the lip
    // 14.9 px, running 2 tiles early 17.0, standing 2 tiles early 22.0.
    expect([of('standing', '0.0'), of('standing', '32.0'), of('running', '0.0'), of('running', '32.0'), of('standing', '48.0'), of('running', '48.0')]).toEqual([
      ['131.6', '14.9'], ['131', '22.0'], ['131.6', '14.9'], ['131.6', '17.0'], ['130', '30.2'], ['130.8', '25.0'],
    ]);
    // The glide's two hilos (122,17) and (126,19): both from the lip up to 1.4 tiles early standing (8 take-offs) and up to 2 tiles early
    // running (11); only the first from 1.6 to 2 tiles early standing and 2.2 to 2.6 running; none from further back.
    const tally = (way: string) => ['122,17 126,19', '122,17', 'none'].map((w) => glideHilos.filter((g) => g === `${way} ${w}`).length);
    expect([tally('standing'), tally('running')]).toEqual([[8, 3, 5], [11, 3, 2]]);
    // A walk off the lip, at a run, is lost.
    const walk = play(at(lip - 8, Y(22), 120), 200, () => right, (r) => r.phase !== 'playing' || (r.player.grounded && r.player.x > lip + 8));
    expect([last(walk).phase, last(walk).lives.lives]).toEqual(['respawning', 6]);
  });
});

const onP5 = (r: RunState) => r.player.grounded && r.player.y === Y(25) && r.player.x - 6 >= Y(176);

describe('GDD-WLD-18 level 3-3 Ten, measured', () => {
  it('GDD-WLD-18 3-3 bridge A and C3: the ride crosses the planks and sets none off', () => {
    const ride = rideOn('R4', 30);
    const stop = ride.findIndex((s) => s.carts[cartOf('R4')]!.phase === 'stopped');
    const e = last(ride);
    // From the landing in C3 to its buffer at 156: 109 steps (1.82 s; GDD says 1.8 s). He stands in it on Q, its middle at x = 2480, every
    // plank of bridge A whole all the way (a rider's feet are on the cart's floor), with the two hilos over the bridge and every life.
    expect(stop).toBe(109);
    expect(e.player).toMatchObject({ x: 2480, y: Y(25) - 8 });
    expect([whereIs(e), e.lives.lives, took(e, 144, 23), took(e, 148, 23)]).toEqual(['cart R4', 7, true, true]);
    expect(ride.every((r) => r.crumbles.every((c) => c.phase === 'idle'))).toBe(true);
  });

  it('GDD-WLD-18 3-3 bridge B on foot, a reach only: K2 frozen, the run across, a stop on a plank, and a glide from Q to the pier', () => {
    // A reach only (L-014): a copy of the level without K2, so nothing wakes on R5; its cart, with no ringtail, is his and stands at 177
    // and 178, so each run here ends before it.
    const noK2: Level = { ...L, enemies: L.enemies.filter((_, i) => i !== 1) };
    const run = play(at(mid(156), Y(25), 0, 0, noK2), 400, () => right, (r) => r.phase !== 'playing' || onP5(r), noK2);
    const e = last(run);
    // From Q's column 156, right held, he runs over both spans and the pier onto P5 in 164 steps with every life; every plank he ran over
    // (all fifteen) started, and each was gone 30 steps (0.5 s) after he landed on it (followed 40 steps more, standing on P5).
    expect([run.length, whereIs(e), e.lives.lives]).toEqual([164, 'P5', 7]);
    expect(tookOf(e, [[167, 23]])).toEqual(['167,23']);
    const after = [...run, ...play(e, 40, () => idle, () => false, noK2)];
    const bridgeB = L.crumbles.flatMap((c, i) => (c.row === 25 && c.col >= 160 ? [i] : []));
    for (const i of bridgeB) {
      const warned = after.findIndex((r) => r.crumbles[i]!.phase === 'warning');
      const gone = after.findIndex((r) => r.crumbles[i]!.phase === 'gone');
      expect(gone - warned, `plank at ${L.crumbles[i]!.col}`).toBe(30);
    }
    expect(bridgeB).toHaveLength(15);
    // Stopping on a plank (at column 163's middle) he falls into the pit: a life, 120 steps after he set off (117 with the pit's bottom at
    // row 29: the fall to row 30's floor line is a tile longer).
    const stop = play(at(mid(156), Y(25), 0, 0, noK2), 400, (r) => (r.player.x < mid(163) ? right : idle), (r) => r.phase !== 'playing', noK2);
    expect([stop.length, last(stop).lives.lives]).toEqual([120, 6]);
    // A held glide from Q over the 3 tiles before its lip (x = 2560), standing and running: where he lands, and the planks set off by then.
    // A level glide carries about 8.5 tiles (GDD-MOV-07); from the lip he comes down at column 167.8 standing, 168.5 running, so the pier is
    // reached without a plank from three take-offs of 32: standing 6.4 and 3.2 px before the lip, running 16 px before it.
    const lip = Y(160);
    const glides: string[] = [];
    for (const vx of [0, 120]) {
      for (const x of apart(lip - 3 * TILE, lip)) {
        expect(standsOnTile(x, 25), `${x}`).toBe(true);
        const f = fly(at(x, Y(25), vx, 0, noK2), 'held', 1, noK2);
        const end = f.landed!;
        const set = L.crumbles.map((c, i) => (end.crumbles[i]!.phase !== 'idle' ? c.col : -1)).filter((c) => c >= 0);
        expect(end.lives.lives).toBe(7);
        glides.push(`${vx === 0 ? 'standing' : 'running'} ${(lip - x).toFixed(1)} ${colOf(f)} ${landedAs(f)}${set.length === 0 ? ', no plank' : ''}`);
      }
    }
    expect(glides.filter((g) => g.endsWith('no plank'))).toEqual(['standing 6.4 167.4 pier, no plank', 'standing 3.2 167.6 pier, no plank', 'running 16.0 167.5 pier, no plank']);
    expect(glides.filter((g) => g.includes(' 0.0 ') || g.includes(' 48.0 '))).toEqual(['standing 48.0 164.8 plank', 'standing 0.0 167.8 pier', 'running 48.0 165.5 plank', 'running 0.0 168.5 plank']);
  });
});

const onP6 = (r: RunState) => r.player.grounded && r.player.y <= Y(9);
/** Reaching the exit in the air: his feet's height over the bank (y = 240) on the step the level is cleared. */
const clearAt = (f: Flight) => (f.landed?.phase === 'clear' ? Math.round((Y(15) - f.landed.player.y) * 10) / 10 : null);

describe('GDD-WLD-18 level 3-3 Ketsu, measured', () => {
  it('GDD-WLD-18 3-3 the plank stairs: right held and a jump on each landing climbs from A to P6', () => {
    // From the third ofrenda on A, right held; on every step he stands, jump is let go for that step and pressed on the next, held while he rises.
    let was = false;
    const climb = play(at(mid(203), Y(17)), 400, (r) => {
      const jump = r.player.grounded ? !was : was && r.player.vy < 0;
      was = jump;
      return { move: 1, jumpHeld: jump };
    }, (r) => r.phase !== 'playing' || onP6(r));
    const e = last(climb);
    const first = climb.findIndex((r) => !r.player.grounded);
    // He lands on each pair in turn and, from the last, in C4 at 212 and 213 on P6, which starts it rolling: 111 steps from the first press
    // (GDD says 111, to P6), every life.
    const landings = climb.filter((r, i) => r.player.grounded && climb[i - 1]?.player.grounded === false).map((r) => `${whereIs(r)} ${r.player.x.toFixed(1)},${r.player.y}`);
    expect(landings).toEqual(['plank 3290.0,240', 'plank 3322.0,208', 'plank 3354.0,176', 'cart R7 3408.0,136']);
    expect(tookOf(e, [[205, 13], [207, 11], [209, 9]])).toEqual(['205,13', '207,11', '209,9']);
    expect([first, climb.length, e.player.x, e.carts[cartOf('R7')]!.phase, e.lives.lives]).toEqual([0, 111, Y(213), 'rolling', 7]);
    // A fall: standing still on the first pair (at their join, x = 3280), both go 30 steps (0.5 s) after he lands; he drops 2 tiles onto
    // A with every life, walks left out from under them, and they are whole again 120 steps (2.0 s) after they went.
    const pair = [204, 205].map((col) => L.crumbles.findIndex((c) => c.col === col && c.row === 15));
    const fall = play(at(Y(205), Y(15)), 400, (r) => (r.player.y === Y(17) && r.player.grounded && r.player.x > Y(204) - 16 ? { move: -1, jumpHeld: false } : idle), (r) => r.crumbles[pair[0]!]!.phase === 'gone' && r.crumbles[pair[0]!]!.steps === 1);
    const back = [...fall, ...play(last(fall), 5, () => idle)];
    for (const i of pair) {
      const gone = back.findIndex((r) => r.crumbles[i]!.phase === 'gone');
      const whole = back.findIndex((r, k) => k > gone && r.crumbles[i]!.phase === 'idle');
      expect([gone, whole - gone], `${L.crumbles[i]!.col}`).toEqual([30, 120]);
    }
    const landed = back.findIndex((r) => r.player.grounded && r.player.y === Y(17));
    expect([landed, whereIs(back[landed]!), last(back).lives.lives]).toEqual([42, 'A', 7]);
  });

  it("GDD-WLD-18 3-3 C4, R7 and the exit glide: a jump held and a plain one from the post to the end and through coyote time", () => {
    const ride = rideOn('R7', 6);
    const leave = ride.findIndex((s) => s.carts[cartOf('R7')]!.phase === 'falling');
    const post = ride.findIndex((s) => middleOf(s, 'R7') >= warningPost(railOf('R7'))!.x);
    // The cart's middle passes the post at column 221 on step 55 of the ride and leaves the rail on step 93 (1.55 s after the landing).
    expect([post, leave]).toEqual([55, 93]);
    // A still rider takes R7's three hilos by the end.
    expect(tookOf(ride[leave]!, [[217, 8], [221, 10], [224, 10]])).toEqual(['217,8', '221,10', '224,10']);
    const flights = ride.slice(1, leave + 6).map((s, i) => ({ k: i + 1 - leave, s, held: fly(s, 'held', 1), plain: fly(s, 'top', 1) }));
    const runs = (as: (f: (typeof flights)[number]) => string) => {
      const out: string[] = [];
      let from = 0;
      for (let i = 1; i <= flights.length; i++) {
        if (i < flights.length && as(flights[i]!) === as(flights[from]!)) continue;
        out.push(`${flights[from]!.k} to ${flights[i - 1]!.k} ${as(flights[from]!)}`);
        from = i;
      }
      return out;
    };
    // k counted from the step the cart leaves the rail, as R3's: every held jump from 1 step into the ride to the last of coyote time flies
    // into the exit; a plain one lands back in the cart until just after the post, is lost from there to 32 px before the end, lands on the
    // bank from there to the end and, from the end on, flies into the exit.
    expect(runs((f) => landedAs(f.held))).toEqual(['-92 to 4 exit', '5 to 5 lost']);
    expect(runs((f) => landedAs(f.plain))).toEqual(['-92 to -35 cart R7', '-34 to -14 lost', '-13 to -1 bank', '0 to 4 exit', '5 to 5 lost']);
    const byK = (k: number) => flights.find((f) => f.k === k)!;
    // Held from the post (k = -38, 94.8 px before the end) his box reaches the exit's side 40.8 px over the bank, before the gable (GDD says
    // he meets the gable 33 px over it); from the end (k = 0) he meets the gable 78 px over the bank (GDD says 78) and slides down it into
    // the exit, reached 47.7 px over the bank.
    expect([post - leave, Math.round((3632 - byK(-38).s.player.x) * 10) / 10, faceOf(byK(-38).held, Y(235), Y(15)), clearAt(byK(-38).held)]).toEqual([-38, 94.8, null, 40.8]);
    expect([faceOf(byK(0).held, Y(235), Y(15)), clearAt(byK(0).held)]).toEqual([78, 47.7]);
    // A reach only, on a copy without the exit: held from the post he meets the gable 33.8 px over the bank (GDD says 33) and lands on it.
    const { exit: _exit, ...noExit } = L;
    const toGable = fly(byK(-38).s, 'held', 1, noExit);
    expect([faceOf(toGable, Y(235), Y(15)), landedAs(toGable), colOf(toGable)]).toEqual([33.8, 'bank', 234.6]);
    // The exit glide's hilos: (229,7) and (232,8) on the held line from 25 steps before the end on, (229,7) alone just before that; (233,13)
    // on the line from k = -73 to -49, long before the post; none from the post (k = -38) to k = -32.
    expect(runs((f) => tookOf(f.held.landed ?? last(f.held.states), [[229, 7], [232, 8], [233, 13]]).join(' ') || 'none')).toEqual([
      '-92 to -77 none', '-76 to -74 229,7', '-73 to -49 233,13', '-48 to -32 none', '-31 to -26 229,7', '-25 to 4 229,7 232,8', '5 to 5 none',
    ]);
    // A plain jump from the post lands back in C4 (GDD says it is lost: the ride then goes on to the end); from the very end (k = 0) it
    // reaches the exit at the bank's height, and one pressed on the leaving step lands on the bank at column 233.6.
    expect([landedAs(byK(-38).plain), landedAs(byK(0).plain), clearAt(byK(0).plain), landedAs(byK(-1).plain), colOf(byK(-1).plain)]).toEqual(['cart R7', 'exit', 0, 'bank', 233.6]);
    // Every landing keeps every life; staying in costs one, in the exit pit, 127 steps after the landing in C4.
    for (const f of flights) for (const g of [f.held, f.plain]) if (!g.lost) expect(g.landed!.lives.lives).toBe(7);
    const stay = play(ride[0]!, 600, () => idle, (r) => r.phase !== 'playing');
    expect([stay.length, last(stay).phase, last(stay).lives.lives]).toEqual([127, 'respawning', 6]);
  });

  it("GDD-WLD-18 3-3 on foot from the shelf's lip at 225: a held jump and a plain one over the 3 tiles before it, standing and running", () => {
    const lip = Y(226);
    const out: string[] = [];
    for (const vx of [0, 120]) {
      for (const x of apart(lip - 3 * TILE, lip)) {
        expect(standsOnTile(x, 12), `${x}`).toBe(true);
        const h = fly(at(x, Y(12), vx), 'held', 1);
        const t = fly(at(x, Y(12), vx), 'top', 1);
        // Every held jump, from the lip and from up to 3 tiles early, flies into the exit with every life; every plain one is lost.
        expect([landedAs(h), h.landed!.lives.lives, landedAs(t)], `${vx} at ${x}`).toEqual(['exit', 7, 'lost']);
        out.push(`${vx} ${x}`);
      }
    }
    expect(out).toHaveLength(32);
  });
});

/**
 * How far his body box was from the veladora's box (12 x 12 in the middle of its tile, `VELADORA.size`) at its nearest over `states`: 0 when
 * they touched, else the larger of the gaps across and up or down, to 0.1 px.
 */
function velaMiss(states: readonly RunState[]): number {
  const [cx, cy] = [mid(L.veladora!.col), Y(L.veladora!.row) + TILE / 2];
  const misses = states.map((r) => {
    const across = Math.abs(r.player.x - cx) - (HITBOX.width + 12) / 2;
    const up = Math.max(cy - 6 - r.player.y, r.player.y - HITBOX.height - (cy + 6));
    return Math.max(0, across, up);
  });
  return Math.round(Math.min(...misses) * 10) / 10;
}

/** The secret's hilos a glided jump to the left from MP0 at start time `t` takes (measured, pinned by the secret's test). */
const secretHilosAt = (t: number) => ((t >= 96 && t <= 114) || (t >= 312 && t <= 336) ? '30,27 27,28' : (t >= 120 && t <= 132) || (t >= 294 && t <= 306) ? '27,28' : 'none');

describe('GDD-WLD-18 level 3-3 the secret, measured', () => {
  it('GDD-WLD-18 3-3 the secret with the glide: from MP0 at every 6th start time, and from P1 back over its lip', () => {
    // From the middle of MP0, at every 6th start time of its 432-step round, a held jump to the left (glided), and then left held 40 steps.
    const mp0 = LEVEL_3_3_PLATFORM.MP0;
    const under: number[] = [];
    const secretHilos: string[] = [];
    let inFlight = 0;
    for (let t = 0; t < 432; t += 6) {
      const y = platformAt(mp0, t).y;
      const f = fly(at(mp0.x0 + mp0.w / 2, y, 0, t), 'held', -1);
      const e = f.landed!;
      const then = last(play(e, 40, () => ({ move: -1, jumpHeld: false })));
      expect(e.lives.lives, `${t}`).toBe(7);
      if (landedAs(f) !== 'hollow') {
        expect(velaTaken(then), `${t}`).toBe(false);
        continue;
      }
      // He comes in under the cap and lands on the hollow's floor; walking left he takes the veladora (in the air already from most).
      expect(velaTaken(then), `${t}`).toBe(true);
      if (velaTaken(e)) inFlight++;
      secretHilos.push(`${t} ${tookOf(then, [[30, 27], [27, 28]]).join(' ') || 'none'}`);
      under.push(y);
    }
    // 35 of the 72 start times come in under the cap (GDD says 35 of 72), the lift's top from y = 496 up to 432 and from 428 down to 496
    // (GDD says between 432 and 500); 30 of them take the veladora before landing. The others land on the cap's top or back on the shelf.
    expect([under.length, inFlight, Math.min(...under), Math.max(...under)]).toEqual([35, 30, 428, 496]);
    // The secret's two hilos (30,27) and (27,28) are on the flights from MP0 low on its round: both from start times 96 to 114 and 312 to
    // 336 (its top from 496 to 484 going up, 476 to 496 coming down), (27,28) alone at 120 to 132 and 294 to 306; none from 138 to 288
    // (and none from P1, below).
    expect(secretHilos).toEqual(secretHilos.map((h) => `${h.split(' ')[0]} ${secretHilosAt(Number(h.split(' ')[0]))}`));
    expect(secretHilos).toHaveLength(35);
    // From P1, a held jump back to the left over its lip (x = 544), standing and running: standing, every take-off from 3.2 px to 3 tiles
    // in from the lip comes in under the cap and takes the veladora, one at the lip lands on the cap's top; running, 0 to 12.8 px in land
    // on the cap, 16 px and more come in (GDD: 1 or 2 tiles before the lip comes in, at the lip the cap's top).
    const p1: string[] = [];
    for (const vx of [0, -120]) {
      for (const x of apart(Y(34), Y(34) + 3 * TILE)) {
        const f = fly(at(x, Y(26), vx), 'held', -1);
        const then = last(play(f.landed!, 40, () => ({ move: -1, jumpHeld: false })));
        expect(f.landed!.lives.lives).toBe(7);
        p1.push(`${vx === 0 ? 'standing' : 'running'} ${(x - Y(34)).toFixed(1)} ${landedAs(f)}${velaTaken(then) ? ' veladora' : ''}`);
        expect(tookOf(then, [[30, 27], [27, 28]])).toEqual([]);
      }
    }
    const kinds = (way: string) => p1.filter((x) => x.startsWith(way)).map((x) => x.split(' ').slice(2).join(' ')).filter((w, i, a) => w !== a[i - 1]);
    expect([kinds('standing'), kinds('running')]).toEqual([['cap', 'hollow veladora'], ['cap', 'hollow veladora']]);
    expect([p1.findIndex((x) => x.startsWith('standing') && x.includes('hollow')), p1.findIndex((x) => x.startsWith('running') && x.includes('hollow')) - 16]).toEqual([1, 5]);
  });

  it('GDD-WLD-18 3-3 the secret without the glide: nothing reaches the veladora', () => {
    const noGlide: Level = { ...L, abilities: {} };
    const best: Record<string, number> = {};
    const note = (from: string, f: Flight) => {
      const m = velaMiss(f.states);
      best[from] = Math.min(best[from] ?? Infinity, m);
      if (f.states.some(velaTaken)) best[`${from} TAKEN`] = 1;
    };
    // From P1, back over its lip.
    for (const vx of [0, -120]) for (const x of apart(Y(34), Y(34) + 3 * TILE)) for (const kind of ['held', 'top'] as const) note('P1', fly(at(x, Y(26), vx, 0, noGlide), kind, -1, noGlide));
    // From MP0, at every 6th start time, from its middle and its left end.
    const mp0 = LEVEL_3_3_PLATFORM.MP0;
    for (let t = 0; t < 432; t += 6) {
      for (const x of [mp0.x0 + 6, mp0.x0 + mp0.w / 2]) for (const kind of ['held', 'top'] as const) note('MP0', fly(at(x, platformAt(mp0, t).y, 0, t, noGlide), kind, -1, noGlide));
    }
    // From the cap's top: off its right end, at a walk, a jump or a hop, turning back left after 0 to 30 steps.
    for (let j = 0; j <= 30; j += 2) {
      for (const jump of [false, true]) {
        const states = play(at(Y(25) + 2, Y(26), 120, 0, noGlide), 120, (r, i) => ({ move: i < j ? 1 : -1, jumpHeld: jump && (i === 0 || r.player.vy < 0) }), (r, i) => i > 2 && r.player.grounded, noGlide);
        note('cap', { x: 0, lost: false, states });
      }
    }
    // From the shelf, toward the hollow, from its foot to 3 tiles right of it; and how far under the hollow's floor (y = 496) his feet were
    // at best while his box was over it.
    let floorShort = Infinity;
    for (const vx of [0, -120]) {
      for (const x of apart(Y(25) + 6, Y(28))) {
        for (const kind of ['held', 'top'] as const) {
          const f = fly(at(x, Y(35), vx, 0, noGlide), kind, -1, noGlide);
          note('shelf', f);
          for (const r of f.states) if (r.player.x - HITBOX.width / 2 <= Y(25) + 1e-6) floorShort = Math.min(floorShort, r.player.y - Y(31));
        }
      }
    }
    // No flight takes it. The nearest each comes, his box to the veladora's: from P1 40 px, from MP0 29.4, off the cap 18, from the shelf 18;
    // from the shelf his feet get at best 7.6 px short of the hollow's floor, against the floor's face (GDD says 7.6).
    expect(best).toEqual({ P1: 40, MP0: 29.4, cap: 18, shelf: 18 });
    expect(Math.round(floorShort * 10) / 10).toBe(7.6);
  });
});

/** Walking left off a lip from (x, y), left held until he stands again, at every `every` steps of the `round` of the lift under it: where he lands, counted. */
function walkOff(x: number, y: number, round: number, every: number): Record<string, number> {
  const out: Record<string, number> = {};
  for (let t = 0; t < round; t += every) {
    let air = false;
    const states = play(at(x, y, 0, t), 400, () => ({ move: -1, jumpHeld: false }), (r) => {
      if (!r.player.grounded) air = true;
      return r.phase !== 'playing' || (air && r.player.grounded);
    });
    const e = last(states);
    // Then 60 steps with nothing held where he landed.
    const after = last(play(e, 60, () => idle));
    expect([e.lives.lives, after.lives.lives], `${x} at ${t}`).toEqual([7, 7]);
    const key = whereIs(e);
    out[key] = (out[key] ?? 0) + 1;
  }
  return out;
}

describe('GDD-WLD-18 level 3-3 long falls, measured', () => {
  it('GDD-WLD-18 3-3 long falls are never pits: off P1, P3 and A to the left at every start time of the lift below, and off each pair of stairs', () => {
    // Off P1 (18 start times of MP0's round): the shelf or MP0. Off P3 (12 of MP1's): MP1 every time. Off A (12 of MP2's): MP2, or twice
    // the back edge of K3's cart at 196 and 197 (x = 3173), beside its ringtail.
    // Every landing, and 60 steps with nothing held after it, keeps every life.
    expect(walkOff(Y(34) + 8, Y(26), 432, 24)).toEqual({ shelf: 11, MP0: 7 });
    expect(walkOff(Y(108) + 8, Y(22), 192, 16)).toEqual({ MP1: 12 });
    expect(walkOff(Y(202) + 8, Y(17), 384, 32)).toEqual({ MP2: 10, 'cart R6': 2 });
    for (const [c, row] of [[204, 15], [206, 13], [208, 11]] as const) {
      let air = false;
      const states = play(at(Y(c + 1), Y(row)), 400, () => idle, (r) => {
        if (!r.player.grounded) air = true;
        return r.phase !== 'playing' || (air && r.player.grounded);
      });
      // Standing still on each pair at its join, it goes 0.5 s on and he lands on A with every life.
      expect([whereIs(last(states)), last(states).lives.lives], `${c}`).toEqual(['A', 7]);
    }
  });
});
