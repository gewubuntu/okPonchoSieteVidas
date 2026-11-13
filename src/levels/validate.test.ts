import { describe, expect, it } from 'vitest';
import { BASE_WIDTH, TILE } from '../config/tuning';
import type { Boss } from '../sim/boss';
import type { Bottom } from '../sim/bottoms';
import type { Enemy } from '../sim/enemy';
import type { Estrella } from '../sim/estrella';
import type { Rail } from '../sim/cart';
import type { Level, Ofrenda, Point } from '../sim/run';
import { parseTiles } from '../sim/tilemap';
import type { LevelEntry } from './index';
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
