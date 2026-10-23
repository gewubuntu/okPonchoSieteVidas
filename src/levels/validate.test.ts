import { describe, expect, it } from 'vitest';
import { BASE_WIDTH, TILE } from '../config/tuning';
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

  it('a world with no gap limit is a problem', () => {
    expect(validateLevel(entry({ world: 2 }))).toEqual(['no gap limit for World 2']);
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

  it('ofrendas count as respawns', () => {
    expect(validateLevel(entry({ enemies: [{ x: 468, y: 224, kind: 'zopilote' }] }))).toEqual([
      'zopilote at 468,224 is 20 px from the respawn at 488,224, under 48',
    ]);
  });
});
