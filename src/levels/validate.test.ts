import { describe, expect, it } from 'vitest';
import { BASE_WIDTH, TILE } from '../config/tuning';
import type { Boss } from '../sim/boss';
import type { Enemy } from '../sim/enemy';
import type { Level, Ofrenda, Point } from '../sim/run';
import { parseTiles } from '../sim/tilemap';
import type { LevelEntry } from './index';
import { gaps, validateLevel } from './validate';

const HEIGHT = 17;
const FLOOR_ROWS = 3;
const SCREEN = BASE_WIDTH / TILE; // 30 tiles

interface Options {
  width?: number;
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
  const pits = new Set(o.pits ?? []);
  const solid = new Set((o.solid ?? []).map(([c, r]) => `${c},${r}`));
  const rows: string[] = [];
  for (let r = 0; r < HEIGHT; r++) {
    let row = '';
    for (let c = 0; c < width; c++) row += (r >= HEIGHT - FLOOR_ROWS && !pits.has(c)) || solid.has(`${c},${r}`) ? '#' : '.';
    rows.push(row);
  }
  for (const [c, r, ch] of o.slopes ?? []) rows[r] = rows[r]!.slice(0, c) + ch + rows[r]!.slice(c + 1);
  const ofrendas: Ofrenda[] = (o.ofrendas ?? [30, 50, 75]).map((col, i) => ({ id: `o${i}`, ...onFloor(col) }));
  const exit = o.exit === null ? undefined : (o.exit ?? onFloor(85));
  const level: Level = {
    world: parseTiles(rows),
    spawn: { x: 3 * TILE + 8, y: 14 * TILE },
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

  it('a world with no gap limit is a problem', () => {
    expect(validateLevel(entry({ world: 3 }))).toEqual(['no gap limit for World 3']);
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
