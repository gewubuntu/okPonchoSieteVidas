import { describe, expect, it } from 'vitest';
import { BASE_WIDTH, TILE } from '../config/tuning';
import type { Boss } from '../sim/boss';
import type { Bottom } from '../sim/bottoms';
import type { Enemy } from '../sim/enemy';
import type { MovingPlatform } from '../sim/platform';
import type { Estrella } from '../sim/estrella';
import type { Rail, RailSegment } from '../sim/cart';
import type { Level, Ofrenda, Point } from '../sim/run';
import { parseTiles } from '../sim/tilemap';
import type { LevelEntry } from './index';
import { LAB_3K_LEVEL, LAB_3K_PERCH } from './lab3k';
import { gaps, openGaps, validateLevel } from './validate';

const HEIGHT = 17;
const FLOOR_ROWS = 3;
const SCREEN = BASE_WIDTH / TILE; // 30 tiles

interface Options {
  width?: number;
  /** Rows tall, 17 unless said: the floor is the last three rows, and the spawn, the ofrendas and the exit stand on it. */
  height?: number;
  /** Columns with the three floor rows cleared. */
  pits?: readonly number[];
  /** Extra solid tiles as [col, row]. */
  solid?: readonly (readonly [number, number])[];
  ofrendas?: readonly number[];
  exit?: Point | null;
  enemies?: readonly Enemy[];
  world?: number;
  test?: boolean;
  /** GDD-MOV-09: a slope character put at [col, row] after the floor, pits and solid tiles. */
  slopes?: readonly (readonly [number, number, string])[];
  /** Merged into the level last. */
  level?: Partial<Level>;
  /** GDD-BOS-01: a boss, which makes it a boss level. */
  boss?: Boss;
}

const onFloor = (col: number): Point => ({ x: col * TILE + TILE / 2, y: 14 * TILE });

/** A level that follows every rule, with overrides. */
function entry(o: Options = {}): LevelEntry {
  const width = o.width ?? 3 * SCREEN;
  const height = o.height ?? HEIGHT;
  const pits = new Set(o.pits ?? []);
  const solid = new Set((o.solid ?? []).map(([c, r]) => `${c},${r}`));
  const rows: string[] = [];
  for (let r = 0; r < height; r++) {
    let row = '';
    for (let c = 0; c < width; c++) row += (r >= height - FLOOR_ROWS && !pits.has(c)) || solid.has(`${c},${r}`) ? '#' : '.';
    rows.push(row);
  }
  for (const [c, r, ch] of o.slopes ?? []) rows[r] = rows[r]!.slice(0, c) + ch + rows[r]!.slice(c + 1);
  const floor = (col: number): Point => ({ ...onFloor(col), y: (height - FLOOR_ROWS) * TILE });
  const ofrendas: Ofrenda[] = (o.ofrendas ?? [30, 50, 75]).map((col, i) => ({ id: `o${i}`, ...floor(col) }));
  const exit = o.exit === null ? undefined : (o.exit ?? floor(85));
  const level: Level = {
    world: parseTiles(rows),
    spawn: { x: 3 * TILE + 8, y: (height - FLOOR_ROWS) * TILE },
    ofrendas,
    spikes: [],
    crumbles: [],
    springs: [],
    platforms: [],
    tacos: [],
    pinatas: [],
    doors: [],
    keys: [],
    fragiles: [],
    enemies: o.enemies ?? [],
    ...(exit ? { exit } : {}),
    ...o.level,
    ...(o.boss ? { boss: o.boss } : {}),
  };
  return { id: 'synthetic', world: o.world ?? 1, test: o.test ?? false, level };
}

/** The columns from `from` to `to`, both included. */
const cols = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

const spawnAt = entry().level.spawn;

describe('GDD-TEC-04 level validator', () => {
  it('passes a level that follows every rule', () => {
    expect(validateLevel(entry())).toEqual([]);
  });

  it('wants exactly 3 ofrendas', () => {
    expect(validateLevel(entry({ ofrendas: [30, 50] }))).toEqual(['2 ofrendas, expected 3']);
    expect(validateLevel(entry({ ofrendas: [30, 50, 75, 80] }))).toEqual(['4 ofrendas, expected 3']);
  });

  it('wants an exit', () => {
    expect(validateLevel(entry({ exit: null }))).toEqual(['no exit']);
  });

  it('lets a test level go without an exit', () => {
    expect(validateLevel(entry({ exit: null, test: true }))).toEqual([]);
  });

  it('still checks the ofrendas, gaps and enemies of a test level', () => {
    expect(validateLevel(entry({ test: true, exit: null, ofrendas: [30], pits: cols(10, 13), enemies: [{ x: spawnAt.x + 20, y: spawnAt.y }] }))).toEqual([
      '1 ofrendas, expected 3',
      'gap of 4 tiles at columns 10 to 13, World 1 allows 3',
      'alacran at 76,224 is 20 px from the respawn at 56,224, under 48',
    ]);
  });
});

describe('GDD-TEC-04 and GDD-WLD-03 level length', () => {
  it('accepts 3 to 6 screens, 90 to 180 tiles', () => {
    expect(validateLevel(entry({ width: 90 }))).toEqual([]);
    expect(validateLevel(entry({ width: 180 }))).toEqual([]);
  });

  it('rejects 89 and 181 tiles', () => {
    expect(validateLevel(entry({ width: 89 }))).toEqual(['89 tiles wide, expected 90 to 180 (3 to 6 screens)']);
    expect(validateLevel(entry({ width: 181 }))).toEqual(['181 tiles wide, expected 90 to 180 (3 to 6 screens)']);
  });

  it('accepts up to 8 screens, 240 tiles, from World 2 on, and rejects 241 there (user, 2026-11-04)', () => {
    expect(validateLevel(entry({ width: 240, world: 2 }))).toEqual([]);
    expect(validateLevel(entry({ width: 241, world: 2 }))).toEqual(['241 tiles wide, expected 90 to 240 (3 to 8 screens)']);
    expect(validateLevel(entry({ width: 89, world: 2 }))).toEqual(['89 tiles wide, expected 90 to 240 (3 to 8 screens)']);
  });

  it('keeps Worlds 0 and 1 at 6 screens: 181 tiles is too long there', () => {
    expect(validateLevel(entry({ width: 181, world: 0 }))).toEqual(['181 tiles wide, expected 90 to 180 (3 to 6 screens)']);
    expect(validateLevel(entry({ width: 181, world: 1 }))).toEqual(['181 tiles wide, expected 90 to 180 (3 to 6 screens)']);
  });

  it('lets a test level be one screen', () => {
    expect(validateLevel(entry({ width: 30, ofrendas: [7, 19, 25], exit: null, test: true }))).toEqual([]);
  });
});

describe('GDD-TEC-04 and GDD-WLD-03 gaps', () => {
  it('measures runs of columns whose bottom row is empty', () => {
    expect(gaps(entry({ pits: [...cols(10, 12), 40] }).level.world)).toEqual([
      { col: 10, width: 3 },
      { col: 40, width: 1 },
    ]);
  });

  it('reads only the bottom row: a hole there counts, a hole above solid bottom does not', () => {
    const rows = Array.from({ length: HEIGHT }, (_, r) => {
      if (r === HEIGHT - 1) return '#'.repeat(10) + '.' + '#'.repeat(19); // column 10: only the bottom row is empty
      if (r >= HEIGHT - FLOOR_ROWS) return '#'.repeat(20) + '.' + '#'.repeat(9); // column 20: empty above a solid bottom row
      return '.'.repeat(30);
    });
    expect(gaps(parseTiles(rows))).toEqual([{ col: 10, width: 1 }]);
  });

  it('a floating tile over a pit does not fill it', () => {
    expect(gaps(entry({ pits: cols(10, 12), solid: [[11, 5]] }).level.world)).toEqual([{ col: 10, width: 3 }]);
  });

  it('a pit that reaches the level\'s right edge is a gap', () => {
    expect(gaps(entry({ pits: cols(87, 89) }).level.world)).toEqual([{ col: 87, width: 3 }]);
  });

  it('World 1 allows a gap of 3 tiles', () => {
    expect(validateLevel(entry({ pits: cols(10, 12) }))).toEqual([]);
  });

  it('World 1 rejects a gap of 4 tiles', () => {
    expect(validateLevel(entry({ pits: cols(10, 13) }))).toEqual(['gap of 4 tiles at columns 10 to 13, World 1 allows 3']);
  });

  it('World 2 allows a gap of 4 tiles', () => {
    expect(validateLevel(entry({ world: 2, pits: cols(10, 13) }))).toEqual([]);
  });

  it('World 2 rejects a gap of 5 tiles', () => {
    expect(validateLevel(entry({ world: 2, pits: cols(10, 14) }))).toEqual(['gap of 5 tiles at columns 10 to 14, World 2 allows 4']);
  });

  it('GDD-WLD-03 World 3 has a gap limit of 6 tiles at the same height', () => {
    expect(validateLevel(entry({ world: 3, pits: cols(10, 15) }))).toEqual([]);
    expect(validateLevel(entry({ world: 3, pits: cols(10, 16) }))).toEqual(['gap of 7 tiles at columns 10 to 16, World 3 allows 6']);
  });

  it('GDD-WLD-03 a World 3 level is at most 8 screens wide', () => {
    expect(validateLevel(entry({ width: 240, world: 3 }))).toEqual([]);
    expect(validateLevel(entry({ width: 270, world: 3 }))).toEqual(['270 tiles wide, expected 90 to 240 (3 to 8 screens)']);
  });

  it('a world with no gap limit and no length limit is a problem, once for each', () => {
    expect(validateLevel(entry({ world: 4 }))).toEqual(['no length limit for World 4', 'no gap limit for World 4']);
  });
});

describe('GDD-ART-06 a level place in the validator', () => {
  it('GDD-ART-06 a World 3 level may choose its place, a level of any other world may not', () => {
    for (const place of ['barranca', 'mina'] as const) {
      expect(validateLevel({ ...entry({ world: 3 }), place }), place).toEqual([]);
      for (const world of [0, 1, 2]) expect(validateLevel({ ...entry({ world }), place }), `World ${world} ${place}`).toEqual([`a place (${place}), only a World 3 level chooses one`]);
    }
    // A test level too.
    expect(validateLevel({ ...entry({ world: 2, test: true, exit: null }), place: 'mina' })).toEqual(['a place (mina), only a World 3 level chooses one']);
  });
});

/** GDD-WLD-17: a back wall over columns `col0` to `col1` and rows `row0` to `row1`. */
const wall = (col0: number, col1: number, row0: number, row1: number) => ({ col0, col1, row0, row1 });

/** A level of `world` (World 3 unless said) with the back walls `walls`. */
const walled = (walls: ReturnType<typeof wall>[], world = 3) => entry({ world, level: { backWalls: walls } });

describe('GDD-WLD-17 back walls in the validator', () => {
  it('GDD-WLD-17 a World 3 level may have back walls inside it, apart, each its corners in order', () => {
    // The level is 90 x 17: columns 0 to 89, rows 0 to 16. Two walls that touch but share no tile pass, and so does one tile.
    expect(validateLevel(walled([wall(0, 89, 0, 16)]))).toEqual([]);
    expect(validateLevel(walled([wall(10, 20, 5, 9), wall(21, 30, 5, 9), wall(10, 20, 10, 12), wall(40, 40, 3, 3)]))).toEqual([]);
  });

  it('GDD-WLD-17 a back wall outside the level, with its corners out of order, or overlapping another is refused', () => {
    expect(validateLevel(walled([wall(-1, 5, 0, 3)]))).toEqual(['back wall at columns -1 to 5, rows 0 to 3 reaches outside the level']);
    expect(validateLevel(walled([wall(80, 90, 0, 3)]))).toEqual(['back wall at columns 80 to 90, rows 0 to 3 reaches outside the level']);
    expect(validateLevel(walled([wall(5, 8, -1, 3)]))).toEqual(['back wall at columns 5 to 8, rows -1 to 3 reaches outside the level']);
    expect(validateLevel(walled([wall(5, 8, 10, 17)]))).toEqual(['back wall at columns 5 to 8, rows 10 to 17 reaches outside the level']);
    expect(validateLevel(walled([wall(8, 5, 0, 3)]))).toEqual(['back wall at columns 8 to 5, rows 0 to 3 has its corners out of order']);
    expect(validateLevel(walled([wall(5, 8, 3, 0)]))).toEqual(['back wall at columns 5 to 8, rows 3 to 0 has its corners out of order']);
    // Sharing a single tile is an overlap.
    expect(validateLevel(walled([wall(10, 20, 5, 9), wall(20, 30, 9, 12)]))).toEqual(['back walls at columns 10 to 20, rows 5 to 9 and columns 20 to 30, rows 9 to 12 overlap']);
  });

  it('GDD-WLD-17 only a World 3 level has back walls', () => {
    for (const world of [0, 1, 2]) expect(validateLevel(walled([wall(10, 20, 5, 9)], world)), `World ${world}`).toEqual(['back walls, only World 3 has them']);
    // An empty list is none.
    expect(validateLevel(walled([], 2))).toEqual([]);
  });
});

/**
 * GDD-WLD-03: a World 3 level with a pit at columns 10 to 9 + `width` (the floor's top row 14). A positive `drop` raises the left bank
 * (column 9) by that many tiles, a negative one raises the right bank (the column after the pit) by as many: a rise.
 */
const dropGap = (width: number, drop: number, o: Options = {}) => {
  const bank = drop >= 0 ? 9 : 10 + width;
  const raised = Array.from({ length: Math.abs(drop) }, (_, i) => [bank, 13 - i] as const);
  return entry({ world: 3, pits: cols(10, 9 + width), ...o, solid: [...raised, ...(o.solid ?? [])] });
};
/** Crumbling tiles at the floor's top row 14 in the columns given. */
const ledges = (columns: readonly number[]) => columns.map((col) => ({ col, row: 14 }));
/** A roof: solid tiles at `row` over columns `from` to `to`. */
const roof = (row: number, from = 9, to = 24) => cols(from, to).map((c) => [c, row] as const);

describe('GDD-TEC-04 and GDD-WLD-03 World 3 gaps', () => {
  it('GDD-WLD-03 World 3 gaps the limit by drop: for each drop in the table a gap at the limit passes and one tile wider fails', () => {
    // The GDD's row "World 3's limit", by the drop to the far side (negative: a rise).
    const table: (readonly [number, number])[] = [[-3, 2], [-2, 3], [-1, 4], [0, 6], [1, 7], [2, 8], [3, 9], [4, 10], [6, 12], [8, 14]];
    for (const [drop, limit] of table) {
      expect(validateLevel(dropGap(limit, drop)), `drop ${drop}`).toEqual([]);
      const unit = Math.abs(drop) === 1 ? 'tile' : 'tiles';
      const slope = drop > 0 ? ` with a drop of ${drop} ${unit}` : drop < 0 ? ` with a rise of ${-drop} ${unit}` : '';
      expect(validateLevel(dropGap(limit + 1, drop)), `drop ${drop}`).toEqual([`gap of ${limit + 1} tiles at columns 10 to ${10 + limit}${slope}, World 3 allows ${limit}`]);
    }
  });

  it('GDD-WLD-03 World 3 gaps a drop of more than 8 tiles counts as 8', () => {
    for (const drop of [9, 12]) {
      expect(validateLevel(dropGap(14, drop)), `drop ${drop}`).toEqual([]);
      expect(validateLevel(dropGap(15, drop)), `drop ${drop}`).toEqual([`gap of 15 tiles at columns 10 to 24 with a drop of ${drop} tiles, World 3 allows 14`]);
    }
  });

  it('GDD-WLD-03 World 3 gaps a rise of more than 3 tiles over a pit fails at any width', () => {
    expect(validateLevel(dropGap(1, -4))).toEqual(['gap at columns 10 to 10 rises 4 tiles over a pit, World 3 allows 3']);
  });

  it('GDD-WLD-03 World 3 gaps the same data as World 2 keeps the flat 4 tiles', () => {
    // L-028: the rule is by world, both ways.
    expect(validateLevel(dropGap(5, 3, { world: 2 }))).toEqual(['gap of 5 tiles at columns 10 to 14, World 2 allows 4']);
    expect(validateLevel(dropGap(5, 3))).toEqual([]);
    expect(validateLevel(dropGap(4, -2, { world: 2 }))).toEqual([]);
    expect(validateLevel(dropGap(4, -2))).toEqual(['gap of 4 tiles at columns 10 to 13 with a rise of 2 tiles, World 3 allows 3']);
  });

  it('GDD-WLD-03 World 3 gaps a roof takes 2 tiles off for each tile of headroom under 6', () => {
    // The left bank's top is row 14 at the same height: a roof at row 8 leaves 5 empty tiles over it, at row 9 4.
    expect(validateLevel(dropGap(4, 0, { solid: roof(8) }))).toEqual([]);
    expect(validateLevel(dropGap(5, 0, { solid: roof(8) }))).toEqual(['gap of 5 tiles at columns 10 to 14 under a roof 5 tiles over its left bank, World 3 allows 4']);
    expect(validateLevel(dropGap(2, 0, { solid: roof(9) }))).toEqual([]);
    expect(validateLevel(dropGap(3, 0, { solid: roof(9) }))).toEqual(['gap of 3 tiles at columns 10 to 12 under a roof 4 tiles over its left bank, World 3 allows 2']);
    // A drop of 4 (the left bank's top row 10) under a roof at row 4: headroom 5.
    expect(validateLevel(dropGap(8, 4, { solid: roof(4) }))).toEqual([]);
    expect(validateLevel(dropGap(9, 4, { solid: roof(4) }))).toEqual(['gap of 9 tiles at columns 10 to 18 with a drop of 4 tiles under a roof 5 tiles over its left bank, World 3 allows 8']);
    // A drop of 2 (the left bank's top row 12) under a roof at row 8: headroom 3.
    expect(validateLevel(dropGap(2, 2, { solid: roof(8) }))).toEqual([]);
    expect(validateLevel(dropGap(3, 2, { solid: roof(8) }))).toEqual(['gap of 3 tiles at columns 10 to 12 with a drop of 2 tiles under a roof 3 tiles over its left bank, World 3 allows 2']);
  });

  it('GDD-WLD-03 World 3 gaps a headroom of 3 with no drop fails at any width', () => {
    // A roof at row 10 over the left bank's top row 14: 3 empty tiles.
    expect(validateLevel(dropGap(1, 0, { solid: roof(10) }))).toEqual(['gap at columns 10 to 10 has 3 tiles of headroom over its left bank, World 3 needs 4 where it does not drop']);
    // With a rise too (the right bank, column 11, a tile up).
    expect(validateLevel(dropGap(1, -1, { solid: roof(10, 9, 10) }))).toEqual(['gap at columns 10 to 10 has 3 tiles of headroom over its left bank, World 3 needs 4 where it does not drop']);
    // With a drop of 1 (the left bank's top row 13) and a roof at row 10, headroom 2: 7 - 8 tiles is -1, never under 1.
    expect(validateLevel(dropGap(1, 1, { solid: roof(10) }))).toEqual([]);
    expect(validateLevel(dropGap(2, 1, { solid: roof(10) }))).toEqual(['gap of 2 tiles at columns 10 to 11 with a drop of 1 tile under a roof 2 tiles over its left bank, World 3 allows 1']);
  });

  it('GDD-WLD-03 World 3 gaps the roof is measured over the left bank and the whole gap', () => {
    // A 6-tile gap at columns 10 to 15 at the same height, its banks at columns 9 and 16. One roof tile at row 8, 5 empty tiles over the
    // left bank's top, cuts the limit to 4 over the gap's last column or over the left bank, and not over the right bank (a rise is no roof)
    // or past it.
    const fails = ['gap of 6 tiles at columns 10 to 15 under a roof 5 tiles over its left bank, World 3 allows 4'];
    expect(validateLevel(dropGap(6, 0, { solid: [[15, 8]] }))).toEqual(fails);
    expect(validateLevel(dropGap(6, 0, { solid: [[9, 8]] }))).toEqual(fails);
    expect(validateLevel(dropGap(6, 0, { solid: [[16, 8]] }))).toEqual([]);
    expect(validateLevel(dropGap(6, 0, { solid: [[17, 8]] }))).toEqual([]);
  });

  it('GDD-WLD-03 World 3 gaps a ledge that comes back is a bank', () => {
    // An 18-tile pit at columns 10 to 27 with ledges at its columns 3 to 5 and 9 to 12 (13 to 15 and 19 to 22), at the floor's height: gaps
    // of 3, 3 and 5, as 3-1's.
    const pit = cols(10, 27);
    const both = ledges([...cols(13, 15), ...cols(19, 22)]);
    expect(validateLevel(entry({ world: 3, pits: pit, level: { crumbles: both, crumblesReturn: true } }))).toEqual([]);
    expect(validateLevel(entry({ world: 3, pits: pit, level: { crumbles: both } }))).toEqual(['gap of 18 tiles at columns 10 to 27, World 3 allows 6', "crumbling tiles that do not come back, World 3's do"]);
    // L-028: the flag exempts only the columns that hold a ledge.
    expect(validateLevel(entry({ world: 3, pits: pit, level: { crumbles: ledges(cols(13, 15)), crumblesReturn: true } }))).toEqual(['gap of 12 tiles at columns 16 to 27, World 3 allows 6']);
  });

  it("GDD-WLD-03 World 3 gaps a ledge bank's height is its own row", () => {
    // The left bank's top at row 10, a pit at columns 10 to 20 and a ledge 7 columns on (column 17): at row 12 the drop is 2 (limit 8), at
    // row 10 none (limit 6).
    expect(validateLevel(dropGap(11, 4, { level: { crumbles: [{ col: 17, row: 12 }], crumblesReturn: true } }))).toEqual([]);
    expect(validateLevel(dropGap(11, 4, { level: { crumbles: [{ col: 17, row: 10 }], crumblesReturn: true } }))).toEqual(['gap of 7 tiles at columns 10 to 16, World 3 allows 6']);
    // With crumbling tiles at rows 12 and 10 in the column, in either order, the highest one's row counts.
    for (const rows of [[12, 10], [10, 12]]) {
      expect(validateLevel(dropGap(11, 4, { level: { crumbles: rows.map((row) => ({ col: 17, row })), crumblesReturn: true } })), `rows ${rows.join(', ')}`).toEqual(['gap of 7 tiles at columns 10 to 16, World 3 allows 6']);
    }
  });

  it("GDD-WLD-03 World 3 gaps a gap at the level's edge has the same-height limit", () => {
    // A bank on one side only: 6 tiles, with no roof reading.
    expect(validateLevel(entry({ world: 3, pits: cols(0, 5) }))).toEqual([]);
    expect(validateLevel(entry({ world: 3, pits: cols(0, 6) }))).toEqual(['gap of 7 tiles at columns 0 to 6, World 3 allows 6']);
    const right = (from: number, o: Options = {}) => entry({ world: 3, pits: cols(from, 89), exit: onFloor(80), ...o });
    expect(validateLevel(right(84))).toEqual([]);
    // A roof 3 empty tiles over its left bank's top (column 83, row 14).
    expect(validateLevel(right(84, { solid: roof(10, 83, 89) }))).toEqual([]);
    expect(validateLevel(right(83))).toEqual(['gap of 7 tiles at columns 83 to 89, World 3 allows 6']);
  });
});

describe('GDD-TEC-04 and GDD-ENM-01 enemies start 3 tiles from a respawn', () => {
  it('an enemy exactly 48 px from the spawn passes', () => {
    expect(validateLevel(entry({ enemies: [{ x: spawnAt.x + 48, y: spawnAt.y }] }))).toEqual([]);
  });

  it('an enemy 47 px from the spawn fails', () => {
    expect(validateLevel(entry({ enemies: [{ x: spawnAt.x + 47, y: spawnAt.y }] }))).toEqual([
      'alacran at 103,224 is 47 px from the respawn at 56,224, under 48',
    ]);
  });

  it('measures the straight-line distance: 30 across and 40 up is 50 px and passes', () => {
    expect(validateLevel(entry({ enemies: [{ x: spawnAt.x + 30, y: spawnAt.y - 40 }] }))).toEqual([]);
  });

  it('never reports an enemy under 48 px as 48: 36 across and 31 up is 47.5 px', () => {
    expect(validateLevel(entry({ enemies: [{ x: spawnAt.x + 36, y: spawnAt.y - 31 }] }))).toEqual([
      'alacran at 92,193 is 47 px from the respawn at 56,224, under 48',
    ]);
  });

  it('GDD-ENM-03 it holds for World 2\'s Paloma, Chapulín and Trompo too', () => {
    for (const kind of ['paloma', 'chapulin', 'trompo'] as const) {
      expect(validateLevel(entry({ enemies: [{ x: spawnAt.x + 47, y: spawnAt.y, kind }] })), kind).toEqual([`${kind} at 103,224 is 47 px from the respawn at 56,224, under 48`]);
      expect(validateLevel(entry({ enemies: [{ x: spawnAt.x + 48, y: spawnAt.y, kind }] })), kind).toEqual([]);
    }
  });

  it('ofrendas count as respawns', () => {
    expect(validateLevel(entry({ enemies: [{ x: 468, y: 224, kind: 'zopilote' }] }))).toEqual([
      'zopilote at 468,224 is 20 px from the respawn at 488,224, under 48',
    ]);
  });
});

describe('GDD-MOV-09 sand slopes in the validator', () => {
  it('GDD-MOV-09 a slope tile with no level tile under it is a problem', () => {
    expect(validateLevel(entry({ slopes: [[40, 12, '/']] }))).toContain('slope at 40,12 has no level tile under it');
    expect(validateLevel(entry({ slopes: [[40, 13, '/']] }))).toEqual([]); // row 14 is floor
  });

  it('GDD-MOV-09 a slope in the bottom row is a problem', () => {
    expect(validateLevel(entry({ slopes: [[40, 16, '/']] }))).toContain('slope at 40,16 has no level tile under it'); // below the level is open
  });

  it('GDD-MOV-09 a slope tile that holds a spike, spring, crumbling tile, door, fragile wall or piñata is a problem', () => {
    const at = { col: 40, row: 13 };
    const cases: [string, Partial<Level>][] = [
      ['spike', { spikes: [at] }],
      ['spring', { springs: [at] }],
      ['crumbling tile', { crumbles: [at] }],
      ['piñata', { pinatas: [at] }],
      ['fragile wall', { fragiles: [at] }],
      ['door', { doors: [{ col: 40, row: 12, height: 2 }] }],
    ];
    for (const [name, level] of cases) {
      expect(validateLevel(entry({ slopes: [[40, 13, '/']], level })), name).toContain(`${name} at 40,13 stands in a slope tile`);
    }
  });

  it('GDD-MOV-09 test levels get the slope checks too', () => {
    expect(validateLevel(entry({ slopes: [[40, 12, '/']], test: true }))).toContain('slope at 40,12 has no level tile under it');
    expect(validateLevel(entry({ slopes: [[40, 13, '/']], test: true, level: { spikes: [{ col: 40, row: 13 }] } }))).toContain('spike at 40,13 stands in a slope tile');
  });

  it('GDD-MOV-09 a gap between two slopes is as wide as its empty bottom columns', () => {
    const level = entry({ pits: [41, 42, 43], slopes: [[40, 13, '\\'], [44, 13, '/']] });
    expect(gaps(level.level.world)).toContainEqual({ col: 41, width: 3 });
    expect(validateLevel(level)).toEqual([]);
  });
});

describe('GDD-TEC-04 and GDD-BOS-01 a boss level', () => {
  // The spawn is at (56, 224); a boss whose lap's middle is (240, 72) starts at its right end, (392, 72), far from it.
  const BOSS: Boss = { x: 240, y: 72, floor: 224 };
  const arena = (o: Options = {}) => entry({ width: 30, ofrendas: [], exit: null, boss: BOSS, ...o });

  it('GDD-BOS-01 a boss level of one screen with no ofrendas and no exit passes', () => {
    expect(validateLevel(arena())).toEqual([]);
  });

  it('GDD-BOS-01 a boss level has no ofrendas', () => {
    expect(validateLevel(arena({ ofrendas: [7] }))).toEqual(['1 ofrendas, a boss level has none']);
    expect(validateLevel(arena({ ofrendas: [7, 15, 25] }))).toEqual(['3 ofrendas, a boss level has none']);
  });

  it('GDD-BOS-01 a boss level has no exit', () => {
    expect(validateLevel(arena({ exit: onFloor(25) }))).toEqual(['an exit, a boss level has none']);
  });

  it('GDD-BOS-01 a boss level is one screen wide', () => {
    expect(validateLevel(arena({ width: 29 }))).toEqual(['29 tiles wide, a boss level is one screen (30)']);
    expect(validateLevel(arena({ width: 31 }))).toEqual(['31 tiles wide, a boss level is one screen (30)']);
    expect(validateLevel(arena({ width: 90 }))).toEqual(['90 tiles wide, a boss level is one screen (30)']);
  });

  it('GDD-BOS-01 still checks the gaps, the enemies and his start in a boss level', () => {
    // His lap's middle 152 px left of (76, 224), so he starts at (76, 224), 20 px from the spawn; the middle itself is 132 px away.
    expect(validateLevel(arena({ pits: cols(10, 13), enemies: [{ x: spawnAt.x + 20, y: spawnAt.y }], boss: { x: -76, y: 224, floor: 224 } }))).toEqual([
      'gap of 4 tiles at columns 10 to 13, World 1 allows 3',
      'alacran at 76,224 is 20 px from the respawn at 56,224, under 48',
      'the boss starts 20 px from the spawn, under 48',
    ]);
  });

  it('GDD-BOS-01 his start exactly 48 px from the spawn passes, 47 px fails', () => {
    expect(validateLevel(arena({ boss: { x: 56 + 48 - 152, y: 224, floor: 224 } }))).toEqual([]);
    expect(validateLevel(arena({ boss: { x: 56 + 47 - 152, y: 224, floor: 224 } }))).toEqual(['the boss starts 47 px from the spawn, under 48']);
  });
});

/** GDD-BOS-03: a one-screen level with La Estrella and the spawn given. Her box's middle starts each phase at y = 24, over its first spot. */
const star = (spots: Estrella['spots'], spawn: Point, o: Options = {}) => entry({ width: 30, ofrendas: [], exit: null, ...o, level: { spawn, estrella: { floor: 224, spots, tear: { x: 240, y: 176, awning: 1 } }, ...o.level } });

describe('GDD-TEC-04 and GDD-BOS-03 La Estrella level', () => {

  it('GDD-BOS-03 a level with La Estrella is a boss level: one screen, no ofrendas, no exit', () => {
    expect(validateLevel(star([[400, 80], [320, 160], [400]], { x: 240, y: 224 }))).toEqual([]);
    expect(validateLevel(star([[400, 80], [320, 160], [400]], { x: 240, y: 224 }, { ofrendas: [7], exit: onFloor(25), width: 31 }))).toEqual([
      '1 ofrendas, a boss level has none',
      'an exit, a boss level has none',
      '31 tiles wide, a boss level is one screen (30)',
    ]);
  });

  it('GDD-BOS-03 her start in each phase is at least 3 tiles from the spawn, by her box middle', () => {
    expect(validateLevel(star([[400, 80], [440, 160], [352]], { x: 400, y: 40 }))).toEqual([
      'La Estrella starts phase 1 16 px from the spawn, under 48',
      'La Estrella starts phase 2 43 px from the spawn, under 48',
    ]);
    expect(validateLevel(star([[400], [400], [400]], { x: 448, y: 24 }))).toEqual([]);
    expect(validateLevel(star([[400], [400], [400]], { x: 447, y: 24 }))).toEqual([1, 2, 3].map((p) => `La Estrella starts phase ${p} 47 px from the spawn, under 48`));
  });
});

/** A cover over columns 11 to 13, its top at y. */
const over = (y: number) => ({ x: 176, y, w: 48 });

describe('GDD-TEC-04 GDD-WLD-10 GDD-WLD-11 covered pits', () => {
  // A 5-tile pit at columns 10 to 14 (x 160 to 240) in World 1 (limit 3); the floor's top is y = 224 on both edges.
  const pit = cols(10, 14);
  const fails = ['gap of 5 tiles at columns 10 to 14, World 1 allows 3'];

  it('a whole awning over pit columns, its top 3 tiles above the edge ground, leaves only the uncovered runs as gaps', () => {
    expect(validateLevel(entry({ pits: pit }))).toEqual(fails);
    expect(validateLevel(entry({ pits: pit, level: { awnings: [over(176)] } }))).toEqual([]);
  });

  it('a torn awning does not cover', () => {
    expect(validateLevel(entry({ pits: pit, level: { awnings: [{ ...over(176), torn: true }] } }))).toEqual(fails);
  });

  it('a cordel covers, and so does a rollo, rolled up or not', () => {
    expect(validateLevel(entry({ pits: pit, level: { cordeles: [over(176)] } }))).toEqual([]);
    expect(validateLevel(entry({ pits: pit, level: { rollos: [{ ...over(176), post: 'left' }] } }))).toEqual([]);
  });

  it('more than 3 tiles above the ground, or below it, does not cover', () => {
    expect(validateLevel(entry({ pits: pit, level: { cordeles: [over(175)] } }))).toEqual(fails);
    expect(validateLevel(entry({ pits: pit, level: { cordeles: [over(224)] } }))).toEqual([]);
    expect(validateLevel(entry({ pits: pit, level: { cordeles: [over(232)] } }))).toEqual(fails);
  });

  it('the ground that counts is the nearer edge', () => {
    // The left edge (column 9) raised to y = 176, the right edge (column 15) at 224.
    const raised = [[9, 11], [9, 12], [9, 13]] as const;
    // Over columns 10 and 11, level with the right edge's ground but 48 px below the left's: the left is nearer.
    expect(validateLevel(entry({ pits: pit, solid: raised, level: { cordeles: [{ x: 160, y: 224, w: 32 }] } }))).toEqual(fails);
    expect(validateLevel(entry({ pits: pit, solid: raised, level: { cordeles: [{ x: 160, y: 176, w: 32 }] } }))).toEqual([]);
    // Over columns 13 and 14, 56 px above the right edge's ground (nearer) but 8 px above the left's.
    expect(validateLevel(entry({ pits: pit, solid: raised, level: { cordeles: [{ x: 208, y: 168, w: 32 }] } }))).toEqual(fails);
    // Over column 12, as near to both: the left edge counts.
    expect(validateLevel(entry({ pits: pit, solid: raised, level: { cordeles: [{ x: 192, y: 168, w: 16 }] } }))).toEqual([]);
  });

  it('a pit at the level\'s left end has only its right edge, and one at its right end only its left edge', () => {
    // Columns 0 to 4, the right edge (column 5) raised to y = 176, a cordel level with it over columns 0 to 2.
    const atLeft = entry({ pits: cols(0, 4), solid: [[5, 11], [5, 12], [5, 13]], level: { cordeles: [{ x: 0, y: 176, w: 48 }] } });
    expect(validateLevel(atLeft)).toEqual([]);
    // Columns 86 to 89, the left edge (column 85) raised to y = 176, a cordel level with it over columns 88 and 89.
    const atRight = entry({ pits: cols(86, 89), solid: [[85, 11], [85, 12], [85, 13]], exit: onFloor(80), level: { cordeles: [{ x: 1408, y: 176, w: 32 }] } });
    expect(validateLevel(atRight)).toEqual([]);
  });

  it('a cover has to span the whole column', () => {
    const four = cols(10, 13);
    expect(validateLevel(entry({ pits: four, level: { cordeles: [{ x: 170, y: 208, w: 6 }] } }))).toEqual(['gap of 4 tiles at columns 10 to 13, World 1 allows 3']);
    expect(validateLevel(entry({ pits: four, level: { cordeles: [{ x: 160, y: 208, w: 16 }] } }))).toEqual([]);
  });
});

describe('GDD-TEC-04 GDD-WLD-10 GDD-WLD-11 awnings and cordeles in the validator', () => {
  it('an awning top at y = 160 passes; above it fails', () => {
    expect(validateLevel(entry({ level: { awnings: [{ x: 32, y: 160, w: 32 }] } }))).toEqual([]);
    expect(validateLevel(entry({ level: { awnings: [{ x: 32, y: 152, w: 32 }] } }))).toEqual(['awning at 32,152 has its top above y = 160']);
  });

  it('an awning, 8 px thick, may not overlap a solid tile', () => {
    expect(validateLevel(entry({ level: { awnings: [{ x: 32, y: 216, w: 32 }] } }))).toEqual([]);
    expect(validateLevel(entry({ level: { awnings: [{ x: 32, y: 217, w: 32 }] } }))).toEqual(['awning at 32,217 overlaps a solid tile']);
    // A tile at row 11 just right of its right end (column 4), and one under it (column 3).
    expect(validateLevel(entry({ solid: [[4, 11]], level: { awnings: [{ x: 32, y: 176, w: 32 }] } }))).toEqual([]);
    expect(validateLevel(entry({ solid: [[3, 11]], level: { awnings: [{ x: 32, y: 176, w: 32 }] } }))).toEqual(['awning at 32,176 overlaps a solid tile']);
  });

  it('a cordel 2 px line and a rollo line may not overlap a solid tile', () => {
    expect(validateLevel(entry({ level: { cordeles: [{ x: 32, y: 222, w: 32 }] } }))).toEqual([]);
    expect(validateLevel(entry({ level: { cordeles: [{ x: 32, y: 223, w: 32 }] } }))).toEqual(['cordel at 32,223 overlaps a solid tile']);
    expect(validateLevel(entry({ level: { rollos: [{ x: 32, y: 222, w: 32, post: 'left' }] } }))).toEqual([]);
    expect(validateLevel(entry({ level: { rollos: [{ x: 32, y: 223, w: 32, post: 'right' }] } }))).toEqual(['rollo at 32,223 overlaps a solid tile']);
  });
});

/** GDD-WLD-15: a World 3 level with the rails given. */
const railed = (rails: readonly Rail[], o: Options = {}) => entry({ world: 3, ...o, level: { rails, ...o.level } });
/** A rail from x 160 on the floor (y 224) unless said, rolling right. */
const R = (segments: Rail['segments'], end: Rail['end'], o: Partial<Rail> = {}): Rail => ({ x: 160, y: 224, dir: 1, segments, end, ...o });
const lvl = (tiles: number) => ({ kind: 'level', tiles }) as const;
/** GDD-BOS-04: a one-screen boss level with the rails given. */
const railedArena = (rails: readonly Rail[], o: Options = {}) => railed(rails, { width: 30, ofrendas: [], exit: null, boss: { x: 240, y: 72, floor: 224 }, ...o });

describe('GDD-TEC-04 and GDD-WLD-15 rails in the validator', () => {
  it('GDD-WLD-15 a broken end needs 6 tiles of level rail before it', () => {
    expect(validateLevel(railed([R([{ kind: 'climb', tiles: 6 }, lvl(6)], 'broken')]))).toEqual([]);
    expect(validateLevel(railed([R([{ kind: 'climb', tiles: 7 }, lvl(5)], 'broken')]))).toEqual(['broken rail at 160,224 ends after 5 tiles of level rail, expected at least 6']);
    // Its last stretch a climb: no level rail before the end.
    expect(validateLevel(railed([R([lvl(12), { kind: 'climb', tiles: 6 }], 'broken')]))).toEqual(['broken rail at 160,224 ends after 0 tiles of level rail, expected at least 6']);
  });

  it('GDD-WLD-15 a broken rail is at least 12 tiles long', () => {
    expect(validateLevel(railed([R([lvl(12)], 'broken')]))).toEqual([]);
    expect(validateLevel(railed([R([lvl(11)], 'broken')]))).toEqual(['broken rail at 160,224 is 11 tiles long, expected at least 12']);
    expect(validateLevel(railed([R([{ kind: 'descent', tiles: 5 }, lvl(6)], 'broken', { y: 144 })]))).toEqual(['broken rail at 160,144 is 11 tiles long, expected at least 12']);
  });

  it('GDD-WLD-15 two rails may not share a stretch', () => {
    // From x 160, 10 level tiles to x 320; a second from x 320 meets it there and shares nothing (it starts too near the first's end, a rule
    // of its own); one from x 288 shares two tiles.
    expect(validateLevel(railed([R([lvl(10)], 'buffer'), R([lvl(10)], 'buffer', { x: 320 })]))).toEqual(['rail at 320,224 starts 0 px from the end of the rail at 160,224, under 32']);
    expect(validateLevel(railed([R([lvl(10)], 'buffer'), R([lvl(10)], 'buffer', { x: 288 })]))).toEqual(['rails at 160,224 and 288,224 share a stretch']);
    // The same columns at another height share none.
    expect(validateLevel(railed([R([lvl(10)], 'buffer'), R([lvl(10)], 'buffer', { y: 160 })]))).toEqual([]);
    // Rolling left from x 400 to x 240, over the first one's columns: they share.
    expect(validateLevel(railed([R([lvl(10)], 'buffer'), R([lvl(10)], 'buffer', { x: 400, dir: -1 })]))).toEqual(['rails at 160,224 and 400,224 share a stretch']);
    // A level stretch after a climb is at the climb's top: a rail there shares it, one on the floor under it does not.
    const up = R([{ kind: 'climb', tiles: 4 }, lvl(6)], 'buffer');
    expect(validateLevel(railed([up, R([lvl(4)], 'buffer', { x: 240, y: 160 })]))).toEqual(['rails at 160,224 and 240,160 share a stretch']);
    expect(validateLevel(railed([up, R([lvl(4)], 'buffer', { x: 240 })]))).toEqual([]);
  });

  it('GDD-BOS-04 a boss level\'s rails are exempt', () => {
    // From the 6 tiles of level rail before a broken end and the 12 tiles (and the post, which is drawn, not checked) only.
    expect(validateLevel(railedArena([R([lvl(3)], 'broken')]))).toEqual([]);
    expect(validateLevel(railedArena([R([lvl(6), { kind: 'climb', tiles: 2 }], 'broken'), R([lvl(4)], 'buffer', { x: 288 })]))).toEqual([]);
    // Its other rules stand: a gap of 7 tiles is still too wide in World 3.
    expect(validateLevel(railedArena([R([lvl(3)], 'broken')], { pits: cols(20, 26) }))).toEqual(['gap of 7 tiles at columns 20 to 26, World 3 allows 6']);
  });

  it('GDD-WLD-15 in a boss level two rails may still not share a stretch', () => {
    // The first ends at x 208; the second starts 32 px before it, so only the shared stretch is a problem.
    expect(validateLevel(railedArena([R([lvl(3)], 'broken'), R([lvl(4)], 'buffer', { x: 176 })]))).toEqual(['rails at 160,224 and 176,224 share a stretch']);
  });

  it('GDD-WLD-15 no rail starts within a cart\'s width of another rail\'s end at the same height', () => {
    // The first, from x 160, ends at x 320 on the floor (y 224). A second starting 0, 16 or 31 px past that end, on the floor, is too near: he
    // would walk off the first's stopped cart onto the second's floor. 32 px is a cart's width, and he drops to the ground between them.
    const first = R([lvl(10)], 'buffer');
    for (const d of [0, 16, 31]) {
      expect(validateLevel(railed([first, R([lvl(10)], 'buffer', { x: 320 + d })])), `${d} px`).toEqual([`rail at ${320 + d},224 starts ${d} px from the end of the rail at 160,224, under 32`]);
    }
    expect(validateLevel(railed([first, R([lvl(10)], 'buffer', { x: 352 })]))).toEqual([]);
    // At another height: one tile up or down from the end, 0 and 16 px past it, passes.
    for (const y of [208, 240]) {
      for (const d of [0, 16]) expect(validateLevel(railed([first, R([lvl(10)], 'buffer', { x: 320 + d, y })])), `${y}, ${d} px`).toEqual([]);
    }
    // The end's height is where the rail ends, not where it starts: a climb of 2 tiles ends at y 192, and a rail starting there 16 px on is
    // too near; one on the floor (the first's start height) is not.
    const up = R([lvl(8), { kind: 'climb', tiles: 2 }], 'buffer');
    expect(validateLevel(railed([up, R([lvl(10)], 'buffer', { x: 336, y: 192 })]))).toEqual(['rail at 336,192 starts 16 px from the end of the rail at 160,224, under 32']);
    expect(validateLevel(railed([up, R([lvl(10)], 'buffer', { x: 336 })]))).toEqual([]);
    // A rail rolling left ends on the left: a second starting 16 px left of that end is too near, listed before it too; 32 px left passes.
    const back = R([lvl(10)], 'buffer', { x: 480, dir: -1 }); // from x 480 to x 320
    expect(validateLevel(railed([R([lvl(4)], 'buffer', { x: 304, dir: -1 }), back]))).toEqual(['rail at 304,224 starts 16 px from the end of the rail at 480,224, under 32']);
    expect(validateLevel(railed([R([lvl(4)], 'buffer', { x: 288, dir: -1 }), back]))).toEqual([]);
  });

  it('GDD-WLD-15 in a boss level no rail starts within a cart\'s width of another rail\'s end either', () => {
    // L-028: the boss level's exemption is from the level run and the 12 tiles only. Two short rails, the second 16 px past the first's end.
    expect(validateLevel(railedArena([R([lvl(3)], 'buffer'), R([lvl(3)], 'buffer', { x: 224 })]))).toEqual(['rail at 224,224 starts 16 px from the end of the rail at 160,224, under 32']);
    expect(validateLevel(railedArena([R([lvl(3)], 'buffer'), R([lvl(3)], 'buffer', { x: 240 })]))).toEqual([]);
  });

  it('GDD-WLD-15 the level run before a broken end counts level stretches in a row', () => {
    // Level 3 then level 3 at its end: 6 tiles of level rail; a climb between them leaves 3.
    expect(validateLevel(railed([R([{ kind: 'climb', tiles: 6 }, lvl(3), lvl(3)], 'broken')]))).toEqual([]);
    expect(validateLevel(railed([R([lvl(3), { kind: 'climb', tiles: 6 }, lvl(3)], 'broken')]))).toEqual(['broken rail at 160,224 ends after 3 tiles of level rail, expected at least 6']);
  });

  it('GDD-WLD-15 two rails may not share a sloped stretch', () => {
    // A climb from x 160 (y 224) 4 tiles to x 224 (y 160); a second climb on the same line from x 192 (y 192) shares it; one a tile higher
    // does not; a level rail crossing the climb at y 192 only crosses it.
    const up = R([{ kind: 'climb', tiles: 4 }], 'buffer');
    expect(validateLevel(railed([up, R([{ kind: 'climb', tiles: 4 }], 'buffer', { x: 192, y: 192 })]))).toEqual(['rails at 160,224 and 192,192 share a stretch']);
    expect(validateLevel(railed([up, R([{ kind: 'climb', tiles: 4 }], 'buffer', { x: 192, y: 176 })]))).toEqual([]);
    expect(validateLevel(railed([up, R([lvl(4)], 'buffer', { x: 176, y: 192 })]))).toEqual([]);
    // Rolling left down the same line from x 256 (y 128): the same columns at the same heights.
    expect(validateLevel(railed([up, R([{ kind: 'descent', tiles: 4 }], 'buffer', { x: 256, y: 128, dir: -1 })]))).toEqual(['rails at 160,224 and 256,128 share a stretch']);
  });

  it('GDD-WLD-15 a buffer rail needs neither', () => {
    expect(validateLevel(railed([R([lvl(3)], 'buffer')]))).toEqual([]);
    expect(validateLevel(railed([R([lvl(6), { kind: 'climb', tiles: 4 }], 'buffer')]))).toEqual([]);
  });
});

/**
 * GDD-WLD-03, GDD-TEC-04: a World 3 level 30 rows tall (the floor rows 27 to 29, its top y 432, where the spawn at column 3, the ofrendas
 * at 30, 50 and 75 and the exit at 85 stand), with the raised bottoms given.
 */
const tall = (bottoms: readonly Bottom[], o: Options = {}) => entry({ world: 3, height: 30, ...o, level: { bottoms, ...o.level } });
/** A shelf over columns 56 to 71: solid in rows 10 to 13 only, the floor under it gone, but in the pit's columns given, empty all the way. */
const shelf = (pit: readonly number[], o: Options = {}) =>
  tall([{ fromCol: 56, toCol: 71, row: 13 }], { pits: cols(56, 71), solid: cols(56, 71).filter((c) => !pit.includes(c)).flatMap((c) => [10, 11, 12, 13].map((r) => [c, r] as const)), ...o });

/** A pillar at column 14 from row 20 down to the floor (rows 20 to 26), but the rows in `skip`. */
const pillar = (skip: readonly number[] = []) => Array.from({ length: 7 }, (_, i) => 20 + i).filter((r) => !skip.includes(r)).map((r) => [14, r] as const);
/** The problem of column `col` under a raised bottom at row 20. */
const fails = (col: number) => [`column ${col} under the raised bottom at row 20 is neither solid nor empty all the way down`];
/** Row 26 made solid in columns `from` to `to`, on the floor (rows 27 to 29). */
const row26 = (from: number, to: number) => cols(from, to).map((c) => [c, 26] as const);
/** A cordel over column 63, its top at y. */
const cordel = (y: number) => ({ cordeles: [{ x: 63 * TILE, y, w: TILE }] });
/** A raised bottom at `row` over a pit at columns 10 to 13, empty all the way down. */
const at = (row: number) => tall([{ fromCol: 10, toCol: 13, row }], { pits: cols(10, 13) });
/** A raised bottom at row 28 over the floor, from `fromCol` to `toCol`. */
const over28 = (fromCol: number, toCol: number) => tall([{ fromCol, toCol, row: 28 }]);
/** A raised bottom at row 27 over a pit at columns 10 to 13, and `second`. */
const two = (second: Bottom) => tall([{ fromCol: 10, toCol: 13, row: 27 }, second], { pits: cols(10, 13) });
/** GDD-BOS-01: a one-screen boss level `height` rows tall. */
const tallArena = (height: number) => entry({ width: 30, ofrendas: [], exit: null, boss: { x: 240, y: 72, floor: 224 }, height });

describe('GDD-TEC-04 and GDD-WLD-03 raised bottoms in the validator', () => {
  it('GDD-WLD-03 a pit column under a raised bottom is one whose own bottom row is empty', () => {
    // The shelf's ground ends at its row 13, the span's bottom row: only the pit's columns are empty there. Read on the last row, every
    // column of the shelf would be a pit. (The shelf breaks the rule that a column under a raised bottom is solid all the way down, so in a
    // level that passes the validator both readings agree: the gaps are read off the tiles here, as `openGaps` reads them.)
    expect(gaps(shelf(cols(60, 65)).level.world, shelf(cols(60, 65)).level.bottoms)).toEqual([{ col: 60, width: 6 }]);
    expect(gaps(shelf(cols(60, 65)).level.world)).toEqual([{ col: 56, width: 16 }]);
    expect(openGaps(shelf(cols(60, 66)).level)).toEqual([{ col: 60, width: 7 }]);
  });

  it('GDD-WLD-03 under a raised bottom the bank is found from the span row', () => {
    // A cordel over column 63 of a 7-tile pit covers it when its top is at most 48 px over the shelf's top (y 160): the bank found by
    // walking up from the span's row 13. From the last row there is no ground at all.
    expect(openGaps(shelf(cols(60, 66), { level: cordel(112) }).level)).toEqual([{ col: 60, width: 3 }, { col: 64, width: 3 }]);
    expect(openGaps(shelf(cols(60, 66), { level: cordel(111) }).level)).toEqual([{ col: 60, width: 7 }]);
  });

  it('GDD-TEC-04 a raised bottom row is inside the level', () => {
    // Over a pit at columns 10 to 13, empty all the way down.
    expect(validateLevel(at(-1))).toEqual(['raised bottom at columns 10 to 13 has its row -1 outside the level']);
    expect(validateLevel(at(30))).toEqual(['raised bottom at columns 10 to 13 has its row 30 outside the level']);
    expect(validateLevel(at(0))).toEqual([]);
    expect(validateLevel(at(28))).toEqual([]);
  });

  it("GDD-TEC-04 a raised bottom on the level's last row is a problem", () => {
    expect(validateLevel(at(29))).toEqual(["raised bottom at columns 10 to 13 is on the level's last row (29)"]);
    expect(validateLevel(at(28))).toEqual([]);
  });

  it('GDD-TEC-04 a raised bottom runs from its first column to its last', () => {
    expect(validateLevel(tall([{ fromCol: 13, toCol: 10, row: 20 }], { pits: cols(10, 13) }))).toEqual(['raised bottom at columns 13 to 10 runs backwards']);
    expect(validateLevel(tall([{ fromCol: 10, toCol: 10, row: 20 }], { pits: cols(10, 13) }))).toEqual([]);
  });

  it('GDD-TEC-04 a raised bottom columns are inside the level', () => {
    // Over the floor, its row 28 solid, 29 solid under it.
    expect(validateLevel(over28(-1, 3))).toEqual(['raised bottom at columns -1 to 3 reaches outside the level']);
    expect(validateLevel(over28(86, 90))).toEqual(['raised bottom at columns 86 to 90 reaches outside the level']);
    expect(validateLevel(over28(0, 3))).toEqual([]);
    expect(validateLevel(over28(86, 89))).toEqual([]);
  });

  it('GDD-TEC-04 two raised bottoms may not overlap', () => {
    expect(validateLevel(two({ fromCol: 13, toCol: 15, row: 27 }))).toEqual(['raised bottoms at columns 10 to 13 and 13 to 15 overlap']);
    expect(validateLevel(two({ fromCol: 14, toCol: 15, row: 27 }))).toEqual([]);
  });

  it('GDD-TEC-04 under a raised bottom every column is solid or empty all the way down', () => {
    // A span at row 20 over a pit (columns 10 to 13, empty from row 0 to the last, 29) and over a pillar at column 14 (solid from row 20 to
    // the last): it passes. Each case below differs from it in one tile, or in the review's case in the pit column's ground. Registered as
    // World 2 (raised bottoms are checked in every world): the pillar rises 7 tiles over the pit, which World 3's gap rule does not allow.
    const span = [{ fromCol: 10, toCol: 14, row: 20 }];
    expect(validateLevel(tall(span, { world: 2, pits: cols(10, 13), solid: pillar() }))).toEqual([]);
    // A pit column with a tile right under its bottom row, or one in the level's last row.
    expect(validateLevel(tall(span, { world: 2, pits: cols(10, 13), solid: [...pillar(), [11, 21]] }))).toEqual(fails(11));
    expect(validateLevel(tall(span, { world: 2, pits: cols(10, 13), solid: [...pillar(), [11, 29]] }))).toEqual(fails(11));
    // A solid column with air right under its bottom row, or in the level's last row (column 14 out of the floor, its rows 20 to 28 solid).
    expect(validateLevel(tall(span, { world: 2, pits: cols(10, 13), solid: pillar([21]) }))).toEqual(fails(14));
    expect(validateLevel(tall(span, { world: 2, pits: [...cols(10, 14)], solid: [...pillar(), [14, 27], [14, 28]] }))).toEqual(fails(14));
    // The review's case: a pit column empty on its bottom row with ground right under it, solid down to the last row: he would land on the
    // floor line and stand below the picture, never lost.
    expect(validateLevel(tall(span, { world: 2, pits: cols(10, 13), solid: [...pillar(), ...Array.from({ length: 9 }, (_, i) => [11, 21 + i] as const)] }))).toEqual(fails(11));
    // A tile hung in the pit is a ledge nobody sees.
    expect(validateLevel(tall(span, { world: 2, pits: cols(10, 13), solid: [...pillar(), [11, 24]] }))).toEqual(fails(11));
    // Over the floor (its top row 27): from row 27 down it is solid all the way; from row 26, air with solid under it.
    expect(validateLevel(tall([{ fromCol: 15, toCol: 17, row: 27 }]))).toEqual([]);
    expect(validateLevel(tall([{ fromCol: 15, toCol: 15, row: 26 }]))).toEqual(['column 15 under the raised bottom at row 26 is neither solid nor empty all the way down']);
  });

  it("GDD-TEC-04 the spawn stands above its column's bottom row", () => {
    // The spawn stands on the floor's top row 27 (y 432): on it as the bottom row passes, one row higher fails (the columns made solid from
    // that row down, so only this check fails).
    expect(validateLevel(tall([{ fromCol: 2, toCol: 4, row: 27 }]))).toEqual([]);
    expect(validateLevel(tall([{ fromCol: 2, toCol: 4, row: 26 }], { solid: row26(2, 4) }))).toEqual(["the spawn at 56,432 is below its column's bottom row (26)"]);
  });

  it("GDD-TEC-04 every ofrenda stands above its column's bottom row", () => {
    expect(validateLevel(tall([{ fromCol: 29, toCol: 31, row: 27 }]))).toEqual([]);
    expect(validateLevel(tall([{ fromCol: 29, toCol: 31, row: 26 }], { solid: row26(29, 31) }))).toEqual(["ofrenda o0 at 488,432 is below its column's bottom row (26)"]);
  });

  it("GDD-TEC-04 the exit stands above its column's bottom row", () => {
    expect(validateLevel(tall([{ fromCol: 84, toCol: 86, row: 27 }]))).toEqual([]);
    expect(validateLevel(tall([{ fromCol: 84, toCol: 86, row: 26 }], { solid: row26(84, 86) }))).toEqual(["the exit at 1368,432 is below its column's bottom row (26)"]);
  });

  it('GDD-WLD-03 a level is 17 to 51 rows tall: 16 fails, 17 passes, 51 passes, 52 fails', () => {
    expect(validateLevel(entry({ height: 16 }))).toEqual(['16 rows tall, expected 17 to 51']);
    expect(validateLevel(entry({ height: 17 }))).toEqual([]);
    expect(validateLevel(entry({ height: 51 }))).toEqual([]);
    expect(validateLevel(entry({ height: 52 }))).toEqual(['52 rows tall, expected 17 to 51']);
  });

  it('GDD-BOS-01 a boss level is exactly 17 rows tall: 18 fails', () => {
    expect(validateLevel(tallArena(17))).toEqual([]);
    expect(validateLevel(tallArena(18))).toEqual(['18 rows tall, a boss level is 17']);
  });

  it('GDD-TEC-04 a test level is held to the row limits and the span checks too', () => {
    // 52 rows (the floor rows 49 to 51, its top y 784), no exit, and a raised bottom that breaks each check.
    const broken: Bottom[] = [
      { fromCol: 10, toCol: 13, row: -1 },
      { fromCol: 20, toCol: 21, row: 51 },
      { fromCol: 25, toCol: 24, row: 40 },
      { fromCol: 88, toCol: 90, row: 50 },
      { fromCol: 40, toCol: 42, row: 50 },
      { fromCol: 42, toCol: 43, row: 50 },
      { fromCol: 60, toCol: 60, row: 40 },
      { fromCol: 2, toCol: 4, row: 48 },
      { fromCol: 29, toCol: 31, row: 48 },
    ];
    // Row 48 solid under the last two, so they break only the standing check.
    const solid = [...cols(2, 4), ...cols(29, 31)].map((c) => [c, 48] as const);
    expect(validateLevel(entry({ world: 3, height: 52, test: true, exit: null, pits: cols(10, 13), solid, level: { bottoms: broken } }))).toEqual([
      '52 rows tall, expected 17 to 51',
      'raised bottom at columns 10 to 13 has its row -1 outside the level',
      "raised bottom at columns 20 to 21 is on the level's last row (51)",
      'raised bottom at columns 25 to 24 runs backwards',
      'raised bottom at columns 88 to 90 reaches outside the level',
      'raised bottoms at columns 40 to 42 and 42 to 43 overlap',
      'column 60 under the raised bottom at row 40 is neither solid nor empty all the way down',
      "the spawn at 56,784 is below its column's bottom row (48)",
      "ofrenda o0 at 488,784 is below its column's bottom row (48)",
    ]);
  });
});

describe('GDD-TEC-04 and GDD-WLD-05 crumbled ledges that come back', () => {
  const ledge = { crumbles: [{ col: 40, row: 10 }] };

  it('GDD-WLD-05 only a World 3 level may have ledges that come back, and a World 3 level with crumbling tiles must', () => {
    expect(validateLevel(entry({ world: 2, level: { ...ledge, crumblesReturn: true } }))).toEqual(['crumbling tiles that come back, only World 3 has them']);
    expect(validateLevel(entry({ world: 1, level: { crumblesReturn: true } }))).toEqual(['crumbling tiles that come back, only World 3 has them']);
    expect(validateLevel(entry({ world: 3, level: ledge }))).toEqual(["crumbling tiles that do not come back, World 3's do"]);
    expect(validateLevel(entry({ world: 3, test: true, exit: null, level: ledge }))).toEqual(["crumbling tiles that do not come back, World 3's do"]);
    expect(validateLevel(entry({ world: 3, level: { ...ledge, crumblesReturn: true } }))).toEqual([]);
    expect(validateLevel(entry({ world: 3 }))).toEqual([]);
    // L-028: the other worlds keep their tiles that stay gone.
    expect(validateLevel(entry({ world: 2, level: ledge }))).toEqual([]);
  });
});

/** GDD-ENM-04: a Murciélago with the loop given, its middle at (x, y). */
const bat = (x: number, y: number, o: Partial<Enemy> = {}): Enemy => ({ x, y, kind: 'murcielago', ...o });
/** The problems of the level with one Murciélago whose loop's middle is (800, 100), high over the floor and far from every respawn. */
const looping = (o: Partial<Enemy>) => validateLevel(entry({ enemies: [bat(800, 100, o)] }));

describe('GDD-TEC-04 and GDD-ENM-04 Murciélagos in the validator', () => {
  it("GDD-ENM-04 a Murciélago's loop is within 48 px across and 24 px up and down, its phase a whole step of the loop", () => {
    expect(looping({ rx: 48, ry: 24, phase: 239 })).toEqual([]);
    expect(looping({ rx: 0, ry: 0, phase: 0 })).toEqual([]);
    expect(looping({ rx: 49 })).toEqual(['murciélago at 800,100 has rx 49, expected 0 to 48']);
    expect(looping({ rx: -1 })).toEqual(['murciélago at 800,100 has rx -1, expected 0 to 48']);
    expect(looping({ ry: 25 })).toEqual(['murciélago at 800,100 has ry 25, expected 0 to 24']);
    expect(looping({ ry: -1 })).toEqual(['murciélago at 800,100 has ry -1, expected 0 to 24']);
    for (const phase of [240, 1.5, -1]) expect(looping({ phase }), `phase ${phase}`).toEqual([`murciélago at 800,100 has phase ${phase}, expected a whole step from 0 to 239`]);
  });

  it("GDD-ENM-04 a Murciélago's box touches no solid tile, spike or crumbling tile anywhere on its loop", () => {
    // A loop 48 px across and 24 px up and down that starts at its top (phase 180). From (792, 99) its far right end puts its box's right
    // edge at x 848, the left edge of column 53, and its lowest point puts its box's bottom at y 128, the top of row 8, over column 49 (its
    // box x 784 to 800 there). A tile at column 53, row 6 (y 96 to 112) is beside its right end.
    const loop = { rx: 48, ry: 24, phase: 180 };
    const flying = (x: number, y: number, o: Options = {}) => validateLevel(entry({ ...o, enemies: [bat(x, y, loop)] }));
    expect(flying(792, 99)).toEqual([]);
    // Moved 1 px right, only its far right end reaches into column 53; moved 1 px down, only its lowest point reaches into row 8.
    expect(flying(793, 99, { solid: [[53, 6]] })).toEqual(['murciélago at 793,99 touches a tile on its loop']);
    expect(flying(792, 100, { solid: [[49, 8]] })).toEqual(['murciélago at 792,100 touches a tile on its loop']);
    // A crumbling tile or a spike's tile there is the same.
    expect(flying(793, 99, { level: { crumbles: [{ col: 53, row: 6 }] } })).toEqual(['murciélago at 793,99 touches a tile on its loop']);
    expect(flying(793, 99, { level: { spikes: [{ col: 53, row: 6 }] } })).toEqual(['murciélago at 793,99 touches a tile on its loop']);
    expect(flying(792, 100, { level: { crumbles: [{ col: 49, row: 8 }] } })).toEqual(['murciélago at 792,100 touches a tile on its loop']);
    // Where its box only shares an edge with the tile: at (792, 99) its right edge meets column 53 and its bottom meets row 8.
    expect(flying(792, 99, { solid: [[53, 6], [49, 8]] })).toEqual([]);
    expect(flying(792, 99, { level: { crumbles: [{ col: 53, row: 6 }, { col: 49, row: 8 }], spikes: [{ col: 53, row: 6 }] } })).toEqual([]);
  });

  it('GDD-ENM-01 a Murciélago keeps 3 tiles from every respawn along its whole loop', () => {
    // The first ofrenda stands on a pillar at column 30 (its top y 160) at (488, 160); the bat's loop's middle is 80 px to its right, at the
    // same height, and a loop 40 px across brings it to x 528, 40 px from the ofrenda. With rx 0 it hovers 80 px away.
    const stand = [10, 11, 12, 13].map((r) => [30, r] as const);
    const ofrendas = [{ id: 'o0', x: 488, y: 160 }, { id: 'o1', x: 808, y: 224 }, { id: 'o2', x: 1208, y: 224 }];
    const fromOfrenda = (rx: number) => validateLevel(entry({ solid: stand, level: { ofrendas }, enemies: [bat(568, 160, { rx })] }));
    expect(fromOfrenda(40)).toEqual(['murcielago at 568,160 is 40 px from the respawn at 488,160, under 48']);
    expect(fromOfrenda(0)).toEqual([]);
  });
});

/** GDD-ENM-04: an Armadillo, its feet at (x, y). */
const armadillo = (x: number, y: number): Enemy => ({ x, y, kind: 'armadillo' });
/** A wall 2 tiles tall standing on the floor (rows 12 and 13) in column `col`. */
const wallAt = (col: number) => [[col, 12], [col, 13]] as const;
/** A level rail on the floor (y = 224) from column `col`, 4 tiles, ending in a buffer: its cart stands at x col * 16 to col * 16 + 32. */
const railAt = (col: number): Rail => ({ x: col * TILE, y: 224, dir: 1, segments: [{ kind: 'level', tiles: 4 }], end: 'buffer' });
/** World 3, the ofrendas far right, with the tiles, rails and Armadillos given. */
const mine = (solid: readonly (readonly [number, number])[], rails: readonly Rail[], enemies: readonly Enemy[], o: Options = {}) =>
  validateLevel(entry({ world: 3, ofrendas: [60, 70, 80], solid, enemies, level: { rails }, ...o }));

describe('GDD-TEC-04 and GDD-ENM-04 Armadillos in the validator', () => {
  it('GDD-ENM-04 an Armadillo starts on the ground: on a tile top or a slope surface, not in the air', () => {
    expect(mine([], [], [armadillo(408, 224)])).toEqual([]);
    expect(mine([], [], [armadillo(408, 223)])).toEqual(['armadillo at column 25 does not stand on the ground']);
    expect(mine([], [], [armadillo(408, 200)])).toEqual(['armadillo at column 25 does not stand on the ground']);
    // Nor sunk 1 px into the floor.
    expect(mine([], [], [armadillo(408, 225)])).toEqual(['armadillo at column 25 does not stand on the ground']);
    // A 45 degree slope rising right in column 40 (x 640 to 656) on the floor: its surface y = 224 - (x - 640); at x = 648 it is 216.
    const slope: Options = { slopes: [[40, 13, '/']] };
    expect(mine([], [], [armadillo(648, 216)], slope)).toEqual([]);
    expect(mine([], [], [armadillo(648, 215)], slope)).toEqual(['armadillo at column 40 does not stand on the ground']);
    expect(mine([], [], [armadillo(648, 217)], slope)).toEqual(['armadillo at column 40 does not stand on the ground']);
  });

  it('GDD-ENM-04 an Armadillo is allowed in World 3 only', () => {
    expect(validateLevel(entry({ world: 2, enemies: [armadillo(408, 224)] }))).toEqual(['armadillo at column 25 in World 2, only World 3 has them']);
    expect(validateLevel(entry({ world: 1, enemies: [armadillo(408, 224)] }))).toEqual(['armadillo at column 25 in World 1, only World 3 has them']);
    expect(validateLevel(entry({ world: 3, enemies: [armadillo(408, 224)] }))).toEqual([]);
  });

  it('GDD-ENM-04 an Armadillo walk range may not cross a standing cart start', { timeout: 30000 }, () => {
    // A pen between walls in columns 20 and 40; a rail in it from column 35 (its cart at x 560 to 592), which its walk crosses.
    const pen = [...wallAt(20), ...wallAt(40)];
    expect(mine(pen, [railAt(35)], [armadillo(408, 224)])).toEqual(['armadillo at column 25 walks into the start of the cart at column 35']);
    // The rail outside the pen, past its right wall: no problem.
    expect(mine(pen, [railAt(42)], [armadillo(408, 224)])).toEqual([]);
  });

  it('GDD-ENM-04 an Armadillo roll may not reach a cart start, also after rolling off a ledge onto the cart floor', { timeout: 30000 }, () => {
    // L-028: its walk stays on a block 3 tiles over the floor (columns 20 to 29, rows 11 to 13, its top y = 176), so the walk alone never
    // reaches the cart standing on the floor at column 36 (x 576 to 608); a roll right falls off the block's end, lands on the floor about
    // 33 px on and rolls into it. Walls in columns 14 and 44 close the stretch.
    const block = [20, 21, 22, 23, 24, 25, 26, 27, 28, 29].flatMap((c) => [[c, 11], [c, 12], [c, 13]] as const);
    const stretch = [...block, ...wallAt(14), ...wallAt(44)];
    expect(mine(stretch, [railAt(36)], [armadillo(408, 176)])).toEqual(['armadillo at column 25 rolls into the start of the cart at column 36']);
    // The same with a wall between the block and the cart (column 34, x 544 to 560): no problem.
    expect(mine([...stretch, ...wallAt(34)], [railAt(36)], [armadillo(408, 176)])).toEqual([]);
  });

  it('GDD-ENM-04 an Armadillo roll to the left may not reach a cart start either', { timeout: 30000 }, () => {
    // The mirror of the fixture above: its walk stays on a block (columns 30 to 39, top y = 176); the cart stands on the floor to its left
    // at column 22 (x 352 to 384). A roll left falls off the block's left end (x = 480), lands on the floor and rolls into it.
    const block = [30, 31, 32, 33, 34, 35, 36, 37, 38, 39].flatMap((c) => [[c, 11], [c, 12], [c, 13]] as const);
    const stretch = [...block, ...wallAt(14), ...wallAt(44)];
    expect(mine(stretch, [railAt(22)], [armadillo(568, 176)])).toEqual(['armadillo at column 35 rolls into the start of the cart at column 22']);
    // The same with a wall between the cart and where it lands (column 25, x 400 to 416): no problem.
    expect(mine([...stretch, ...wallAt(25)], [railAt(22)], [armadillo(568, 176)])).toEqual([]);
  });

  it('GDD-ENM-04 an Armadillo roll that ends in a pit before the cart is no problem', { timeout: 30000 }, () => {
    // On the floor between a wall in column 20 and a pit in columns 33 to 35 (open to the level's bottom); the cart beyond it at column 37.
    // Its walk turns at the pit's edge; a roll right falls in and out of the level.
    expect(mine([...wallAt(20), ...wallAt(44)], [railAt(37)], [armadillo(408, 224)], { pits: [33, 34, 35] })).toEqual([]);
    // With the pit filled its walk reaches the cart.
    expect(mine([...wallAt(20), ...wallAt(44)], [railAt(37)], [armadillo(408, 224)])).toEqual(['armadillo at column 25 walks into the start of the cart at column 37']);
  });
});

/** GDD-ENM-04: a Cacomixtle riding rail `rail`, its place given (x, y). `o` adds the fields a test sets (`sightException`). */
const cacomixtle = (x: number, y: number, rail = 0, o: Partial<Enemy> = {}): Enemy => ({ x, y, kind: 'cacomixtle', rail, ...o });
/** A rail rolling left on the floor from x = 800 (y = 224, a level 20 tiles, a buffer), or of these segments and end: its cart's middle starts at x = 784 and its floor is at y = 216. */
const ka = (segments: Rail['segments'] = [{ kind: 'level', tiles: 20 }], end: Rail['end'] = 'buffer', y = 224): Rail => ({ x: 800, y, dir: -1, segments, end });
/** The Cacomixtle at that rail's cart's start. */
const KA = cacomixtle(784, 216);
/** World 3 (or `world`), the ofrendas far right, with the rails, the Cacomixtles and the tiles given as in `mine`: every problem. */
const ringtailAll = (rails: readonly Rail[], enemies: readonly Enemy[], o: Options = {}) => mine(o.solid ?? [], rails, enemies, o);
/**
 * The same without rule (h), the cart clear of the phone's buttons: these fixtures stand on the 17-row floor (y = 224), where the camera
 * cannot move and every cart's box is on screen at y 208 to 224, over the Jump button's top (208) and the mode switch's bottom (220).
 * (h) is not what they test; its own describe below does, with `ringtailAll`.
 */
const ringtail = (rails: readonly Rail[], enemies: readonly Enemy[], o: Options = {}) => withoutButtons(ringtailAll(rails, enemies, o));
/** Problems but rule (h)'s, for a fixture on the 17-row floor (see `ringtail`). */
const withoutButtons = (problems: readonly string[]) => problems.filter((p) => !p.includes("px over the phone's "));
/** A 1-tile ledge in column `col` at row `row` (its top y = 16 row). */
const ledge = (col: number, row: number) => [[col, row]] as const;

/** A rail of `before` tiles level, a tile of descent, `after` tiles level. */
const down = (before: number, after: number): Rail => {
  const segments: RailSegment[] = [{ kind: 'level', tiles: before }, { kind: 'descent', tiles: 1 }, { kind: 'level', tiles: after }];
  return ka(segments.filter((seg) => seg.tiles > 0));
};

/** A rail from x = 400 rolling right on the floor: its cart's middle at x = 416, its floor at y = 216, the sight stretch from x = 416 to 616 (columns 26 to 38). */
const kaRight = (segments: Rail['segments'] = [{ kind: 'level', tiles: 20 }]): Rail => ({ x: 400, y: 224, dir: 1, segments, end: 'buffer' });
const found = (col: number) => [`cacomixtle at 416,216 has ground at column ${col}, row 12, 24 px from its cart's floor in its sight stretch, expected within 8 or over 120`];
const downRight = (before: number, after: number): Rail => kaRight([{ kind: 'level', tiles: before }, { kind: 'descent', tiles: 1 }, { kind: 'level', tiles: after }]);

// A one-way platform is ground in its stretch too (GDD-WLD-05). The 20 tile rail of `ka()` from x = 800 rolling left: the floor at y = 216, the
// stretch from x = 784 to 584, which covers columns 36 to 48 (x 576 to 784). Worked by hand (L-077): a still platform 24 px over the floor
// (y = 192, x 640 to 672) is 24 px from it, in (8, 120], a problem; one at y = 80 is 136 px, not. A moving one from y = 100 to y = 200 is
// 116 to 16 px from it, which meets (8, 120], a problem; one from y = 50 to y = 90 is 166 to 126 px, not.
const withPlatform = (p: Partial<MovingPlatform>, enemy: Enemy = KA, rail: Rail = ka()) =>
  ringtail([rail], [enemy], { level: { rails: [rail], platforms: [{ x0: 640, y0: 192, x1: 640, y1: 192, w: 32, ...p }] } });
const PLATFORM = 'cacomixtle at 784,216 has a platform';
const TAIL = "from its cart's floor in its sight stretch, expected within 8 or over 120";

describe('GDD-TEC-04 and GDD-ENM-04 cacomixtle validator', () => {
  it('GDD-ENM-04 cacomixtle validator: a Cacomixtle on a level rail with a buffer and flat ground reports nothing', () => {
    // Its floor is 8 px over the rail's ground (y = 216), and the ground tops in its stretch are at y = 224, 8 px under it: the limit.
    expect(ringtail([ka()], [KA])).toEqual([]);
    // A climb in its stretch is uphill for it: nothing.
    expect(ringtail([ka([{ kind: 'level', tiles: 4 }, { kind: 'climb', tiles: 2 }, { kind: 'level', tiles: 14 }])], [KA])).toEqual([]);
  });

  it('GDD-ENM-04 cacomixtle validator rule a: its rail is a whole number that is a place in the level\'s rails', () => {
    expect(ringtail([ka()], [cacomixtle(784, 216, -1)])).toEqual(['cacomixtle at 784,216 has rail -1, expected a whole number from 0 to 0']);
    expect(ringtail([ka()], [cacomixtle(784, 216, 1.5)])).toEqual(['cacomixtle at 784,216 has rail 1.5, expected a whole number from 0 to 0']);
    expect(ringtail([ka()], [cacomixtle(784, 216, 1)])).toEqual(['cacomixtle at 784,216 has rail 1, expected a whole number from 0 to 0']);
    expect(ringtail([ka()], [{ x: 784, y: 216, kind: 'cacomixtle' }])).toEqual(['cacomixtle at 784,216 has rail undefined, expected a whole number from 0 to 0']);
  });

  it('GDD-ENM-04 cacomixtle validator rule b: its rail ends at a buffer', () => {
    expect(ringtail([ka(undefined, 'broken')], [KA])).toEqual(['cacomixtle at 784,216 rides a rail that ends broken, expected a buffer']);
  });

  it('GDD-ENM-04 cacomixtle validator rule c: at most one Cacomixtle rides a rail', () => {
    expect(ringtail([ka()], [KA, KA])).toEqual(['cacomixtle at 784,216 rides rail 0, which another cacomixtle rides']);
    // Two rails with one each: nothing (the second on the floor 400 px further left, its Cacomixtle at its cart's start).
    const second: Rail = { ...ka(), x: 400 };
    expect(ringtail([ka(), second], [KA, cacomixtle(384, 216, 1)])).toEqual([]);
  });

  it('GDD-ENM-04 cacomixtle validator rule d: x and y are its place at its cart\'s start, each field alone', () => {
    expect(ringtail([ka()], [cacomixtle(785, 216)])).toEqual(['cacomixtle at 785,216 is not at its cart\'s start, expected 784,216']);
    expect(ringtail([ka()], [cacomixtle(783, 216)])).toEqual(['cacomixtle at 783,216 is not at its cart\'s start, expected 784,216']);
    expect(ringtail([ka()], [cacomixtle(784, 217)])).toEqual(['cacomixtle at 784,217 is not at its cart\'s start, expected 784,216']);
    expect(ringtail([ka()], [cacomixtle(784, 215)])).toEqual(['cacomixtle at 784,215 is not at its cart\'s start, expected 784,216']);
    // Rolling right the middle is 16 px right of the rail's start.
    const right: Rail = { x: 800, y: 224, dir: 1, segments: [{ kind: 'level', tiles: 20 }], end: 'buffer' };
    expect(ringtail([right], [cacomixtle(816, 216)])).toEqual([]);
    expect(ringtail([right], [cacomixtle(784, 216)])).toEqual(['cacomixtle at 784,216 is not at its cart\'s start, expected 816,216']);
  });

  it('GDD-ENM-04 cacomixtle validator rule e: no descent in its sight stretch, 200 px from its middle or the buffer\'s middle-stop', () => {
    // The stretch is 200 px across from the middle: m from 16 to 216. A descent at tile 12 (m 192 to 208) or 13 (208 to 224) is in it; at tile 14 (224 to 240) it is just past.
    expect(ringtail([down(12, 7)], [KA])).toEqual(['cacomixtle at 784,216 has a descent in its sight stretch, 192 to 208 px across']);
    expect(ringtail([down(13, 6)], [KA])).toEqual(['cacomixtle at 784,216 has a descent in its sight stretch, 208 to 224 px across']);
    expect(ringtail([down(14, 5)], [KA])).toEqual([]);
    // Where the buffer is nearer: 14 tiles, the buffer's middle-stop at m = 208. A descent at tile 12 is in the stretch; at tile 13, from m = 208 on, it is not.
    expect(ringtail([down(12, 1)], [KA])).toEqual(['cacomixtle at 784,216 has a descent in its sight stretch, 192 to 208 px across']);
    expect(ringtail([down(13, 0)], [KA])).toEqual([]);
    // 15 tiles: the stretch ends at 216, so a descent at tile 13 (208 to 224) is in it.
    expect(ringtail([down(13, 1)], [KA])).toEqual(['cacomixtle at 784,216 has a descent in its sight stretch, 208 to 224 px across']);
    // A descent under the cart's back half only (the first tile, m 0 to 16) is before its middle: no problem. The rail starts 16 px up so its floor at the middle is the same.
    const first: Rail = { x: 800, y: 208, dir: -1, segments: [{ kind: 'descent', tiles: 1 }, { kind: 'level', tiles: 14 }], end: 'buffer' };
    expect(ringtail([first], [KA])).toEqual([]);
  });

  it('GDD-ENM-04 cacomixtle validator rule f: every ground in its stretch is within 8 px of its cart\'s floor, or over 120 px from it', () => {
    // The stretch of the 20 tile rail runs from x = 784 to 584 (columns 36 to 48). The floor is at y = 216 (the rail at 224).
    const withLedge = (col: number, row: number, rail = ka()) => ringtail([rail], [KA], { solid: ledge(col, row) });
    // A ledge 24 px over the floor (row 12, top y = 192) fails; one 136 px over (row 5, y = 80) passes; one exactly 120 over (row 6, y = 96) fails; one exactly 8 over (row 13, y = 208) passes.
    expect(withLedge(42, 12)).toEqual(['cacomixtle at 784,216 has ground at column 42, row 12, 24 px from its cart\'s floor in its sight stretch, expected within 8 or over 120']);
    expect(withLedge(42, 5)).toEqual([]);
    expect(withLedge(42, 6)).toEqual(['cacomixtle at 784,216 has ground at column 42, row 6, 120 px from its cart\'s floor in its sight stretch, expected within 8 or over 120']);
    expect(withLedge(42, 13)).toEqual([]);
    // With the rail 1 px lower (the floor at y = 217, the ground 7 px under it): a ledge at row 13 is 9 px over it and fails, and one at row 6 is 121 over it and passes.
    const low = ka(undefined, 'buffer', 225);
    const lowKa = cacomixtle(784, 217);
    const atLow = (col: number, row: number) => ringtail([low], [lowKa], { solid: ledge(col, row) });
    expect(ringtail([low], [lowKa])).toEqual([]);
    expect(atLow(42, 13)).toEqual(['cacomixtle at 784,217 has ground at column 42, row 13, 9 px from its cart\'s floor in its sight stretch, expected within 8 or over 120']);
    expect(atLow(42, 6)).toEqual([]);
    // A ledge in the column just past the stretch's end (x 584; column 35 is x 560 to 576) is not in it; column 36 (576 to 592) is.
    expect(withLedge(35, 12)).toEqual([]);
    expect(withLedge(36, 12)).toEqual(['cacomixtle at 784,216 has ground at column 36, row 12, 24 px from its cart\'s floor in its sight stretch, expected within 8 or over 120']);
    // The same at the near end: the stretch starts at the middle (x 784, column 49 is 784 to 800): column 49 is outside it, 48 inside.
    expect(withLedge(49, 12)).toEqual([]);
    expect(withLedge(48, 12)).toEqual(['cacomixtle at 784,216 has ground at column 48, row 12, 24 px from its cart\'s floor in its sight stretch, expected within 8 or over 120']);
    // Where the buffer is nearer (14 tiles: the stretch ends at x = 592, column 36 is 576 to 592, outside it; column 37 inside).
    const short = ka([{ kind: 'level', tiles: 14 }]);
    expect(withLedge(36, 12, short)).toEqual([]);
    expect(withLedge(37, 12, short)).toEqual(['cacomixtle at 784,216 has ground at column 37, row 12, 24 px from its cart\'s floor in its sight stretch, expected within 8 or over 120']);
    // A crumbling tile's top counts too (World 3's crumbled ledges come back).
    expect(ringtail([ka()], [KA], { level: { rails: [ka()], crumbles: [{ col: 42, row: 12 }], crumblesReturn: true } })).toEqual([
      'cacomixtle at 784,216 has ground at column 42, row 12, 24 px from its cart\'s floor in its sight stretch, expected within 8 or over 120',
    ]);
  });

  it('GDD-ENM-04 cacomixtle validator platforms are ground: a still platform is checked at its top, within 8 px or over 120', () => {
    expect(withPlatform({})).toEqual([`${PLATFORM} at 640,192, 24 px ${TAIL}`]);
    expect(withPlatform({ y0: 80, y1: 80 })).toEqual([]);
    // The band's edges: 120 px is a problem, 121 is not; 8 is not, 9 is.
    expect(withPlatform({ y0: 96, y1: 96 })).toEqual([`${PLATFORM} at 640,96, 120 px ${TAIL}`]);
    expect(withPlatform({ y0: 95, y1: 95 })).toEqual([]);
    expect(withPlatform({ y0: 208, y1: 208 })).toEqual([]);
    expect(withPlatform({ y0: 207, y1: 207 })).toEqual([`${PLATFORM} at 640,207, 9 px ${TAIL}`]);
    // Under the floor as well as over it.
    expect(withPlatform({ y0: 240, y1: 240 })).toEqual([`${PLATFORM} at 640,240, 24 px ${TAIL}`]);
  });

  it('GDD-ENM-04 cacomixtle validator platforms are ground: a moving platform is checked over the range of its path', () => {
    expect(withPlatform({ y0: 100, y1: 200 })).toEqual([`${PLATFORM} moving from 640,100 to 640,200, 16 to 116 px ${TAIL}`]);
    expect(withPlatform({ y0: 50, y1: 90 })).toEqual([]);
    // Over the floor's own height the path's near end is 0: a path from y = 50 to y = 400 crosses the whole band though its ends are 166 and 184 px away.
    expect(withPlatform({ y0: 50, y1: 400 })).toEqual([`${PLATFORM} moving from 640,50 to 640,400, 0 to 184 px ${TAIL}`]);
    // Entirely within 8 px of the floor (y 208 to 222, 8 and 6 px): fine; one px further (y 207 to 210, 9 px at the far end): a problem.
    expect(withPlatform({ y0: 208, y1: 222 })).toEqual([]);
    expect(withPlatform({ y0: 207, y1: 210 })).toEqual([`${PLATFORM} moving from 640,207 to 640,210, 6 to 9 px ${TAIL}`]);
    // The far end of its path 121 px and the near end 119: it reaches the band; both ends 121 and 122: it does not.
    expect(withPlatform({ y0: 95, y1: 97 })).toEqual([`${PLATFORM} moving from 640,95 to 640,97, 119 to 121 px ${TAIL}`]);
    expect(withPlatform({ y0: 94, y1: 95 })).toEqual([]);
  });

  it('GDD-ENM-04 cacomixtle validator platforms are ground only over the stretch\'s columns, the whole path of a moving one', () => {
    // Still: x 500 to 564 ends before column 36 (x 576); x 520 to 584 reaches it. At the near end the stretch's columns end at x = 784: x 784 is clear, 783 not.
    expect(withPlatform({ x0: 500, x1: 500, w: 64 })).toEqual([]);
    expect(withPlatform({ x0: 512, x1: 512, w: 64 })).toEqual([]);
    expect(withPlatform({ x0: 520, x1: 520, w: 64 })).toEqual([`${PLATFORM} at 520,192, 24 px ${TAIL}`]);
    expect(withPlatform({ x0: 784, x1: 784 })).toEqual([]);
    expect(withPlatform({ x0: 783, x1: 783 })).toEqual([`${PLATFORM} at 783,192, 24 px ${TAIL}`]);
    // Moving along x: a path from x = 400 to 500 (to x 532 with its width) never reaches it; one from 400 to 600 does, though its start does not; one from
    // 900 to 700 does, though its start does not.
    expect(withPlatform({ x0: 400, x1: 500, w: 32 })).toEqual([]);
    expect(withPlatform({ x0: 400, x1: 600, w: 32 })).toEqual([`${PLATFORM} moving from 400,192 to 600,192, 24 to 24 px ${TAIL}`]);
    expect(withPlatform({ x0: 900, x1: 700, w: 32 })).toEqual([`${PLATFORM} moving from 900,192 to 700,192, 24 to 24 px ${TAIL}`]);
  });

  it('GDD-ENM-04 cacomixtle validator on a rail rolling right: the sight stretch runs to the right of the middle', () => {
    // The rail from x = 400 rolling right: the middle at x = 416, the floor at y = 216, the stretch from x = 416 to 616 (columns 26 to 38).
    const right = cacomixtle(416, 216);
    const withLedge = (col: number, row: number) => ringtail([kaRight()], [right], { solid: ledge(col, row) });
    expect(ringtail([kaRight()], [right])).toEqual([]);
    expect(withLedge(26, 12)).toEqual(found(26));
    expect(withLedge(25, 12)).toEqual([]);
    expect(withLedge(38, 12)).toEqual(found(38));
    expect(withLedge(39, 12)).toEqual([]);
    // A descent in the stretch is reported (the first 200 px across from the middle), one just past it is not.
    expect(ringtail([downRight(12, 7)], [right])).toEqual(['cacomixtle at 416,216 has a descent in its sight stretch, 192 to 208 px across']);
    expect(ringtail([downRight(14, 5)], [right])).toEqual([]);
  });

  it('GDD-ENM-04 cacomixtle validator rule g: only World 3 has Cacomixtles', () => {
    expect(withoutButtons(validateLevel(entry({ world: 1, ofrendas: [60, 70, 80], enemies: [KA], level: { rails: [ka()] } })))).toEqual(['cacomixtle at 784,216 in World 1, only World 3 has them']);
    expect(withoutButtons(validateLevel(entry({ world: 2, ofrendas: [60, 70, 80], enemies: [KA], level: { rails: [ka()] } })))).toEqual(['cacomixtle at 784,216 in World 2, only World 3 has them']);
    expect(withoutButtons(validateLevel(entry({ world: 3, ofrendas: [60, 70, 80], enemies: [KA], level: { rails: [ka()] } })))).toEqual([]);
  });

  it('GDD-ENM-04 cacomixtle validator keeps 3 tiles from every respawn', () => {
    // The first ofrenda 40 px from it (x 744, on the floor at y = 224): the usual rule for every enemy.
    const ofrendas = [{ id: 'o0', x: 744, y: 224 }, { id: 'o1', x: 1128, y: 224 }, { id: 'o2', x: 1288, y: 224 }];
    expect(ringtail([ka()], [KA], { level: { rails: [ka()], ofrendas } })).toEqual(['cacomixtle at 784,216 is 40 px from the respawn at 744,224, under 48']);
  });

  it('GDD-ENM-04 cacomixtle sight exception skips only the ground band', () => {
    // L-028: a Cacomixtle that breaks every rule: a broken end (b), 1 px off its place (d), a descent in its stretch (e) and a ledge 24 px over its floor (f).
    const bad = ka([{ kind: 'level', tiles: 12 }, { kind: 'descent', tiles: 1 }, { kind: 'level', tiles: 7 }], 'broken');
    const place = (o: Partial<Enemy>) => cacomixtle(785, 216, 0, o);
    const all = (o: Partial<Enemy>) => ringtail([bad], [place(o)], { solid: ledge(42, 12), level: { rails: [bad], platforms: [{ x0: 640, y0: 192, x1: 640, y1: 192, w: 32 }] } });
    const b = 'cacomixtle at 785,216 rides a rail that ends broken, expected a buffer';
    const d = "cacomixtle at 785,216 is not at its cart's start, expected 784,216";
    const e = 'cacomixtle at 785,216 has a descent in its sight stretch, 192 to 208 px across';
    const f = "cacomixtle at 785,216 has ground at column 42, row 12, 24 px from its cart's floor in its sight stretch, expected within 8 or over 120";
    // (and a platform 24 px over its floor, which is the ground band's too)
    const g = "cacomixtle at 785,216 has a platform at 640,192, 24 px from its cart's floor in its sight stretch, expected within 8 or over 120";
    expect(all({})).toEqual([b, d, e, f, g]);
    expect(all({ sightException: 'GDD-WLD-18: K1 meets him uphill, 40 px inside its sight' })).toEqual([b, d, e]);
    // An empty sentence is no exception: it is reported, and the ground band is still checked.
    expect(all({ sightException: '' })).toEqual([b, d, e, 'cacomixtle at 785,216 has an empty sight exception, expected the GDD sentence that names it', f, g]);
    // Alone, on a Cacomixtle with nothing else wrong.
    expect(ringtail([ka()], [cacomixtle(784, 216, 0, { sightException: '' })])).toEqual(['cacomixtle at 784,216 has an empty sight exception, expected the GDD sentence that names it']);
    expect(ringtail([ka()], [cacomixtle(784, 216, 0, { sightException: 'GDD-WLD-18: K1 meets him uphill, 40 px inside its sight' })], { solid: ledge(42, 12) })).toEqual([]);
  });
});


// GDD-ENM-04 (h), GDD-UI-04 "A Cacomixtle's cart and the phone's buttons" (user, 2026-11-15: "Layout rule"; 2026-11-17: "Every button"): when he
// first sees a Cacomixtle, its cart's box is clear of every touch button, in both layouts and both touch modes, the Fuego button shown. Worked
// by hand (L-077). He stands 200 px ahead of the cart's middle (the sight's edge), the cart rolling left (`ka()`: its middle at x = 784) so he
// stands at x = 584 in column 36, facing right: the camera holds him 256 px from its left edge, the scroll 584 - 256 = 328, and the cart's box
// (x 768 to 800) is on screen from 440 to 472. The buttons at scale 2, where none grows (x, then y): standard left 6-46 x 224-264, right
// 50-90 x 224-264, stick 6-90 x 224-264, mode 6-46 x 180-220, claw 374-414 x 224-264, fuego 374-414 x 180-220, jump 418-474 x 208-264,
// pause 450-474 x 6-30; mirrored left 390-430, right 434-474 (both x 224-264), stick 390-474 x 224-264, mode 434-474 x 180-220, claw 66-106
// x 224-264, fuego 66-106 x 180-220, jump 6-62 x 208-264, pause the same. Up and down, his feet at rest on the line 162 px down (60% of the
// screen), within the limits of his column: in a 40-row level (640 px) 0 to 640 - 2 - 270 = 368, in a 17-row one 0 to 0. The cart's bottom
// is its rail's ground, so on screen it is that less the camera's y. A button the stick mode shares with the buttons mode is reported once,
// from the buttons mode.
const EDGE_EXCEPTION = 'GDD-WLD-18: a test fixture, the ground band is not what these are about';
/** A rail rolling left from x = 800 whose ground is at y = `y`, level for 20 tiles to a buffer; its cart's middle is at x = 784. */
const edgeRail = (y: number): Rail => ka(undefined, 'buffer', y);
/** The Cacomixtle at that rail's cart's start, with the exception, so that only (h) can speak (L-028). */
const edgeRider = (y: number, o: Partial<Enemy> = { sightException: EDGE_EXCEPTION }) => cacomixtle(784, y - 8, 0, o);
/** Ground tiles from column `from` to `to` in row `row`. */
const strip = (from: number, to: number, row: number) => cols(from, to).map((c) => [c, row] as const);
/** A level 40 rows tall with the tiles given (its 3 floor rows are 37 to 39, y = 592), the rail's ground at `y`, and its Cacomixtle; `level` merged in. */
const tallH = (solid: readonly (readonly [number, number])[], y: number, o: Partial<Enemy> = { sightException: EDGE_EXCEPTION }, level: Partial<Level> = {}) =>
  ringtailAll([edgeRail(y)], [edgeRider(y, o)], { height: 40, solid, level: { rails: [edgeRail(y)], ...level } });
/** (h)'s problem: the overlap `w` x `h` with button `id` of that layout and touch mode, his feet at column `col`, y `y`. */
const onButton = (who: string, w: number, h: number, id: string, layout: 'standard' | 'mirrored', mode: 'buttons' | 'stick', col: number, y: number) =>
  `${who} has its cart's box ${w} x ${h} px over the phone's ${id} button (${layout} layout, ${mode} mode) where it first sees him, standing at column ${col}, y ${y}`;
/** Lab-3k with its rails and enemies as given. */
const labWith = (rails: readonly Rail[], enemies: readonly Enemy[]): LevelEntry => ({ id: 'lab-3k', world: 3, test: true, level: { ...LAB_3K_LEVEL, rails, enemies }, place: 'mina' });
/** A rail on the default floor (y = 224) rolling left from x = `x`. */
const railAtX = (x: number): Rail => ({ ...ka(undefined, 'buffer', 224), x });

/**
 * A cart's box at screen y 218 to 234 (to his right): the standard Jump button 32 x 16, the mirrored right button 32 x 10, the mirrored
 * mode switch 32 x 2 and the mirrored stick 32 x 10. Its rail's ground at 480, his feet at `y`.
 */
const at234 = (y: number) => {
  const who = 'cacomixtle at 784,472';
  return [
    onButton(who, 32, 16, 'jump', 'standard', 'buttons', 36, y),
    onButton(who, 32, 10, 'right', 'mirrored', 'buttons', 36, y),
    onButton(who, 32, 2, 'mode', 'mirrored', 'buttons', 36, y),
    onButton(who, 32, 10, 'stick', 'mirrored', 'stick', 36, y),
  ];
};
/** A still platform 32 px wide, its left edge at `x0` and its top at `y`. */
const stillAt = (x0: number, y: number) => [{ x0, y0: y, x1: x0, y1: y, w: 32 }];

describe('GDD-ENM-04 a cacomixtle cart clear of the phone\'s buttons', () => {
  /** His ground in a 40-row level: row 30 (y = 480), a strip of tiles over the floor. */
  const ground = strip(30, 43, 30);

  it('GDD-ENM-04 phone buttons: a cart at his height has its bottom at 162 on screen and passes', () => {
    // His feet at 480 put the camera's y at 480 - 162 = 318 (inside 0 to 368); the cart's bottom, on the same ground (y = 480), is at 162.
    expect(tallH([...ground, ...strip(44, 52, 30)], 480)).toEqual([]);
  });

  it('GDD-ENM-04 phone buttons: the K1 shape fails on the mirrored mode switch, a cart 2 tiles below his ground', () => {
    // The rail's ground at y = 512: its bottom on screen is 512 - 318 = 194 (162 + 32), its box y 178 to 194, 14 px into the mirrored mode
    // switch (180 to 220), x 440 to 472 inside its 434 to 474; the standard Jump button's top (208) is clear.
    expect(tallH([...ground, ...strip(44, 52, 32)], 512)).toEqual([onButton('cacomixtle at 784,504', 32, 14, 'mode', 'mirrored', 'buttons', 36, 480)]);
  });

  it('GDD-ENM-04 phone buttons: a cart 1 tile below his ground passes', () => {
    // The rail's ground at y = 496: the box at 162 to 178, clear of the mode switch's 180.
    expect(tallH([...ground, ...strip(44, 52, 31)], 496)).toEqual([]);
  });

  it('GDD-ENM-04 phone buttons: shared edge at 180 passes, 181 overlaps by 1 px', () => {
    // The rail's ground off the tile grid at y = 498: the box at 164 to 180 shares the mode switch's top edge, no overlap. At 499 it is 165 to
    // 181: 32 x 1.
    expect(tallH([...ground, ...strip(44, 52, 32)], 498)).toEqual([]);
    expect(tallH([...ground, ...strip(44, 52, 32)], 499)).toEqual([onButton('cacomixtle at 784,491', 32, 1, 'mode', 'mirrored', 'buttons', 36, 480)]);
  });

  it('GDD-ENM-04 phone buttons: a cart 4 tiles below his ground overlaps four buttons, with the exception on', () => {
    // The rail's ground at y = 544: the cart's bottom is on screen at 544 - 318 = 226, its box y 210 to 226: the standard Jump button (208 to
    // 264) 32 x 16; the mirrored right button and stick (224 to 264) 32 x 2, the mirrored mode switch (180 to 220) 32 x 10. (The floor's top
    // at row 37, y = 592, is in his reach of its floor, y = 536, but his feet there put the camera at the limit 368 and the cart at 160 to
    // 176: no overlap.) With the feet line `bandBottom`, 156, the camera is at 324 and the box at 204 to 220: other overlaps.
    const who = 'cacomixtle at 784,536';
    const bad = tallH([...ground, ...strip(44, 52, 34)], 544);
    expect(bad).toEqual([
      onButton(who, 32, 16, 'jump', 'standard', 'buttons', 36, 480),
      onButton(who, 32, 2, 'right', 'mirrored', 'buttons', 36, 480),
      onButton(who, 32, 10, 'mode', 'mirrored', 'buttons', 36, 480),
      onButton(who, 32, 2, 'stick', 'mirrored', 'stick', 36, 480),
    ]);
    // The exception skips the ground band (f) alone: without it the ledge 56 px over its floor in its stretch is a problem too, and (h) stays.
    const bare = tallH([...ground, ...strip(44, 52, 34)], 544, {});
    expect(bare.filter((p) => p.includes("px over the phone's "))).toEqual(bad);
    expect(bare.length).toBeGreaterThan(bad.length);
  });

  it('GDD-ENM-04 phone buttons: a crumbling ledge is ground he stands on too', () => {
    // L-080: the same 4-tile-lower cart as above, his only ground in column 36 a crumbling ledge at row 30 (y = 480): the same overlaps.
    const rail = edgeRail(544);
    const solid = strip(44, 52, 34);
    const level = { rails: [rail], crumbles: [{ col: 36, row: 30 }], crumblesReturn: true };
    const who = 'cacomixtle at 784,536';
    expect(ringtailAll([rail], [edgeRider(544)], { height: 40, solid, level })).toEqual([
      onButton(who, 32, 16, 'jump', 'standard', 'buttons', 36, 480),
      onButton(who, 32, 2, 'right', 'mirrored', 'buttons', 36, 480),
      onButton(who, 32, 10, 'mode', 'mirrored', 'buttons', 36, 480),
      onButton(who, 32, 2, 'stick', 'mirrored', 'stick', 36, 480),
    ]);
  });

  it('GDD-ENM-04 phone buttons: ground out of the ringtail\'s sight is not where he stands', () => {
    // A tile in column 36 at row 25 (y = 400) is 72 px over its floor (y = 472), beyond the 64 px it sees him within: his feet there would put the
    // camera at 238 and the cart's bottom at 242 on screen, over the buttons, but he never wakes the ringtail from there.
    expect(tallH([...ground, ...strip(44, 52, 30), [36, 25]], 480)).toEqual([]);
  });

  it('GDD-ENM-04 phone buttons: band edge at 64 px counts and fails, 65 px is ignored', () => {
    // The cart's floor F = 472 (its rail's ground 480, his ground too). A still platform over column 36 (x 576 to 608) with its top at F - 64 =
    // 408: `sees` wakes it at 64 px, so he stands there. The camera at 408 - 162 = 246, the cart's bottom at 480 - 246 = 234, its box 218 to
    // 234. At F - 65 = 407 it is out of the band; his ground at 480 has the box at 146 to 162: nothing.
    const solid = [...ground, ...strip(44, 52, 30)];
    expect(tallH(solid, 480, undefined, { platforms: stillAt(576, 408) })).toEqual(at234(408));
    expect(tallH(solid, 480, undefined, { platforms: stillAt(576, 407) })).toEqual([]);
  });

  it('GDD-ENM-04 phone buttons: the perch, a still platform 40 px over his ground, fails on the mirrored mode switch', () => {
    // His ground 480, the cart at his height (floor 472), the perch's top at 440 over column 36 (32 px over the cart's floor). From his ground
    // the box is at 146 to 162 and passes; from the perch the camera is at 440 - 162 = 278, the cart's bottom at 480 - 278 = 202, its box 186 to
    // 202: inside the mirrored mode switch, 32 x 16.
    const solid = [...ground, ...strip(44, 52, 30)];
    const onPerch = [onButton('cacomixtle at 784,472', 32, 16, 'mode', 'mirrored', 'buttons', 36, 440)];
    expect(tallH(solid, 480, undefined, { platforms: stillAt(576, 440) })).toEqual(onPerch);
    // It covers his place (x = 584) from its left edge to its right, both counted: from x0 = 552 (to 584) to x0 = 584; at 551 and 585 it
    // is beside him and nothing is reported.
    expect(tallH(solid, 480, undefined, { platforms: stillAt(552, 440) })).toEqual(onPerch);
    expect(tallH(solid, 480, undefined, { platforms: stillAt(584, 440) })).toEqual(onPerch);
    expect(tallH(solid, 480, undefined, { platforms: stillAt(551, 440) })).toEqual([]);
    expect(tallH(solid, 480, undefined, { platforms: stillAt(585, 440) })).toEqual([]);
  });

  it('GDD-ENM-04 phone buttons: a moving platform is read at the highest point of its path in the band while it covers his place', () => {
    // A lift over column 36 from y 480 up to 300: its first point (480) passes, its path's highest point (300) is out of the band (F = 472, the
    // band 408 to 536), and the highest point of its path in the band, 408, fails as the still one at 408 does.
    const solid = [...ground, ...strip(44, 52, 30)];
    expect(tallH(solid, 480, undefined, { platforms: [{ x0: 576, y0: 480, x1: 576, y1: 300, w: 32 }] })).toEqual(at234(408));
    // A diagonal path from (576, 480) to (776, 280), 32 wide: its left edge is at 576 + 200 f, so it covers x = 584 for f from 0 to 0.04, where
    // its top runs from 480 to 472. The highest there, 472, puts the box at 154 to 170: it passes, though its path reaches the band's top.
    expect(tallH(solid, 480, undefined, { platforms: [{ x0: 576, y0: 480, x1: 776, y1: 280, w: 32 }] })).toEqual([]);
    // One that moves across at 408 from x 400 to 500 (its right edge at 532 at most) never covers him: nothing.
    expect(tallH(solid, 480, undefined, { platforms: [{ x0: 400, y0: 408, x1: 500, y1: 408, w: 32 }] })).toEqual([]);
    // The same path to 560 does cover him (its right edge reaches 592) at its height: it fails as the still one at 408.
    expect(tallH(solid, 480, undefined, { platforms: [{ x0: 400, y0: 408, x1: 560, y1: 408, w: 32 }] })).toEqual(at234(408));
  });

  it('GDD-ENM-04 phone buttons: a path descending from over his place is read only where it is, its fraction clamped at 0', () => {
    // From (576, 440) down to (776, 640), 32 wide: it covers x = 584 for f from 0 to 0.04, its top 440 to 448, so the highest is 440 (not the 416
    // an unclamped f of -0.12 would give). His feet at 440: the camera at 278, the cart's bottom at 480 - 278 = 202, its box 186 to 202: the
    // mirrored mode switch 32 x 16 and nothing else.
    const solid = [...ground, ...strip(44, 52, 30)];
    expect(tallH(solid, 480, undefined, { platforms: [{ x0: 576, y0: 440, x1: 776, y1: 640, w: 32 }] })).toEqual([
      onButton('cacomixtle at 784,472', 32, 16, 'mode', 'mirrored', 'buttons', 36, 440),
    ]);
  });

  it('GDD-ENM-04 phone buttons: the claw button alone and the pause button alone are each checked', () => {
    // Claw: a 17-row level (the camera at 0), the rail's ground at 240 in a pit (columns 18 to 30), its cart's middle at 374 (box x 358 to 390,
    // y 224 to 240); he stands at x 174, column 10, on the floor (y 224, 8 px over its floor 232); the scroll is 0. The standard claw button,
    // 374 to 414 x 224 to 264, is the only one it overlaps: 16 x 16 (the mirrored left button starts at 390, an edge).
    const clawRail = { ...ka(undefined, 'buffer', 240), x: 390 };
    expect(ringtailAll([clawRail], [cacomixtle(374, 232, 0, { sightException: EDGE_EXCEPTION })], { pits: cols(18, 30) }).filter((p) => p.includes('phone'))).toEqual([
      onButton('cacomixtle at 374,232', 16, 16, 'claw', 'standard', 'buttons', 10, 224),
    ]);
    // Pause: a 40-row level, his ground at row 4 (y 64), the rail's ground at 40 (its floor 32, 32 px under his feet): the camera clamped at 0,
    // the box at x 440 to 472, y 24 to 40, under the pause button (450 to 474 x 6 to 30, in both layouts): 22 x 6 each.
    expect(tallH([...strip(30, 43, 4)], 40)).toEqual([
      onButton('cacomixtle at 784,32', 22, 6, 'pause', 'standard', 'buttons', 36, 64),
      onButton('cacomixtle at 784,32', 22, 6, 'pause', 'mirrored', 'buttons', 36, 64),
    ]);
  });

  it('GDD-ENM-04 phone buttons: piñata, door and fragile wall tops are ground, a spring is not', () => {
    // A tile in column 36 at row 27 (top y = 432), 40 px over the cart's floor (472): the camera at 270, the cart's bottom at 210, its box 194
    // to 210: the standard Jump button 32 x 2 and the mirrored mode switch 32 x 16. A spring there throws him, so he never stands on it.
    const solid = [...ground, ...strip(44, 52, 30)];
    const who = 'cacomixtle at 784,472';
    const onTop = [onButton(who, 32, 2, 'jump', 'standard', 'buttons', 36, 432), onButton(who, 32, 16, 'mode', 'mirrored', 'buttons', 36, 432)];
    expect(tallH(solid, 480, undefined, { pinatas: [{ col: 36, row: 27 }] })).toEqual(onTop);
    expect(tallH(solid, 480, undefined, { doors: [{ col: 36, row: 27, height: 1 }] })).toEqual(onTop);
    expect(tallH(solid, 480, undefined, { fragiles: [{ col: 36, row: 27 }] })).toEqual(onTop);
    expect(tallH(solid, 480, undefined, { springs: [{ col: 36, row: 27 }] })).toEqual([]);
  });

  it('GDD-ENM-04 phone buttons: a slope surface is ground at his place, not the tile under it', () => {
    // A 45 degree slope rising right in column 36 at row 29 on his ground: its surface at x = 584 is 480 - 8 = 472. The rail's ground at 496
    // (floor 488, 16 px under his feet): the camera at 310, the cart's bottom at 186, its box 170 to 186: the mirrored mode switch 32 x 6. On
    // the tile's top (480) it would be at 162 to 178 and pass.
    expect(tallH([...ground, ...strip(44, 52, 31)], 496)).toEqual([]);
    expect(ringtailAll([edgeRail(496)], [edgeRider(496)], { height: 40, solid: [...ground, ...strip(44, 52, 31)], slopes: [[36, 29, '/']], level: { rails: [edgeRail(496)] } })).toEqual([
      onButton('cacomixtle at 784,488', 32, 6, 'mode', 'mirrored', 'buttons', 36, 472),
    ]);
  });

  it('GDD-ENM-04 phone buttons: a camera at its top limit keeps the cart high on the screen', () => {
    // A 40-row level, his ground at y 96 (row 6), the rail's ground at 160 (floor 152, 56 px under his feet). The camera at max(0, 96 - 162)
    // = 0: the box at 144 to 160, clear of every button (none lies between 30 and 180 at x 440 to 472). Unclamped it would be at -66 and the
    // box at 210 to 226.
    expect(tallH([...strip(30, 43, 6), ...strip(44, 52, 10)], 160)).toEqual([]);
  });

  it('GDD-ENM-04 phone buttons: a camera held at its bottom limit, in a level 17 rows tall', () => {
    // The default floor's top is row 14 (y = 224), the camera cannot move (limits 0 to 0): the cart's box is on screen at 208 to 224, the
    // standard Jump button 32 x 16 and the mirrored mode switch 32 x 12; its feet put the unclamped camera at 224 - 162 = 62, which would
    // have it at 146 to 162 and pass.
    const problems = ringtailAll([ka()], [edgeRider(224)]);
    const who = 'cacomixtle at 784,216';
    expect(problems).toEqual([onButton(who, 32, 16, 'jump', 'standard', 'buttons', 36, 224), onButton(who, 32, 12, 'mode', 'mirrored', 'buttons', 36, 224)]);
    // The 17-row fixtures' filter drops exactly these.
    expect(withoutButtons(problems)).toEqual([]);
  });

  it('GDD-ENM-04 phone buttons: lab-3k as it is passes, its carts 4 px over the mode switch, and 5 px lower overlaps by 1 px', () => {
    // Lab-3k is 17 rows, the camera rests at y 0 and Ka's and Kb's carts' bottoms are at their rail's ground, the floor's top, y = 176: the
    // box at 160 to 176, 4 px over the mirrored mode switch (180).
    const rails = LAB_3K_LEVEL.rails!;
    const [kaDef, kbDef, closet] = LAB_3K_LEVEL.enemies;
    expect(rails[0]!.y).toBe(176);
    expect(validateLevel(labWith(rails, LAB_3K_LEVEL.enemies))).toEqual([]);
    // Ka's rail 5 px lower (and its Cacomixtle with it): its box at 165 to 181, 32 x 1, from both grounds he stands on at the wake line (the
    // perch's first column): the floor (176, 3 px under the cart's floor at 173) and the perch (y 136, 37 px over it), tiles first.
    const who = `cacomixtle at ${kaDef!.x},${kaDef!.y + 5}`;
    const col = LAB_3K_PERCH.x0 / TILE;
    expect(validateLevel(labWith([{ ...rails[0]!, y: rails[0]!.y + 5 }, rails[1]!], [{ ...kaDef!, y: kaDef!.y + 5 }, kbDef!, closet!]))).toEqual([
      onButton(who, 32, 1, 'mode', 'mirrored', 'buttons', col, rails[0]!.y),
      onButton(who, 32, 1, 'mode', 'mirrored', 'buttons', col, LAB_3K_PERCH.y0),
    ]);
  });

  it('GDD-ENM-04 phone buttons: a cart to his left near the screen\'s left edge', () => {
    // A rail from x = 400 rolling right (`kaRight`): the cart's middle at 416, he stands at 616 in column 38 facing left, the camera holds him 224 px
    // from its left edge (scroll 392), and the cart's box is on screen from 8 to 40, y 208 to 224: the standard mode switch (6 to 46, 180 to
    // 220) 32 x 12 and the mirrored Jump button (6 to 62, 208 to 264) 32 x 16; the standard left button and stick only share its bottom edge.
    const right = cacomixtle(416, 216, 0, { sightException: EDGE_EXCEPTION });
    const who = 'cacomixtle at 416,216';
    expect(ringtailAll([kaRight()], [right])).toEqual([onButton(who, 32, 12, 'mode', 'standard', 'buttons', 38, 224), onButton(who, 32, 16, 'jump', 'mirrored', 'buttons', 38, 224)]);
  });

  it('GDD-ENM-04 phone buttons: the box and a button share an edge across at the level\'s left edge and overlap by 1 px a pixel on', () => {
    // A rail from x = 418 rolling left, its cart's middle at 402: he stands at x = 202 (column 12) and the camera is at the level's edge (scroll
    // 0), so the cart's box is on screen from 386 to 418, y 208 to 224: it shares the Jump button's left edge (418), and the Fuego button's
    // (374 to 414, 180 to 220) overlaps it 28 x 12. A pixel on (box 387 to 419) it is 27 x 12 and the Jump button 1 x 16.
    expect(ringtailAll([railAtX(418)], [cacomixtle(402, 216)])).toEqual([onButton('cacomixtle at 402,216', 28, 12, 'fuego', 'standard', 'buttons', 12, 224)]);
    expect(ringtailAll([railAtX(419)], [cacomixtle(403, 216)])).toEqual([
      onButton('cacomixtle at 403,216', 27, 12, 'fuego', 'standard', 'buttons', 12, 224),
      onButton('cacomixtle at 403,216', 1, 16, 'jump', 'standard', 'buttons', 12, 224),
    ]);
    // The Fuego button's right edge alone: from x = 374 (he at 158, column 9) the box is at 342 to 374 and only shares it; a pixel on, 1 x 12.
    expect(ringtailAll([railAtX(374)], [cacomixtle(358, 216)])).toEqual([]);
    expect(ringtailAll([railAtX(375)], [cacomixtle(359, 216)])).toEqual([onButton('cacomixtle at 359,216', 1, 12, 'fuego', 'standard', 'buttons', 9, 224)]);
  });
});
