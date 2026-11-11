import { describe, expect, it } from 'vitest';
import { HITBOX, LIVES_MAX, TILE } from '../config/tuning';
import { LEVELS } from '../levels';
import { bottomRowAt, floorYAt, type Bottom } from './bottoms';
import { fallingBox, type Rail } from './cart';
import type { PlayerInput } from './movement';
import { spawn } from './movement';
import { isInPit, startRun, stepRun, type Level, type RunState } from './run';
import { parseTiles } from './tilemap';

// GDD-WLD-03, GDD-LIFE-02: a raised bottom. A test level 30 rows tall (480 px) and 36 columns wide: ground from row 5 (y 80) down to the
// last row on the left (columns 0 to 5) and on the right (30 to 35), and a shaft open to the level's bottom between them (6 to 29). A raised
// bottom over columns 10 to 29 at row 9, 4 rows under the lips: its floor line is y 160. Columns 6 to 9 are the shaft outside it.
const HEIGHT = 30;
const WIDTH = 36;
const SPAN: Bottom = { fromCol: 10, toCol: 29, row: 9 };
const FLOOR_LINE = 10 * TILE;
const LEVEL_BOTTOM = HEIGHT * TILE;
const idle: PlayerInput = { move: 0, jumpHeld: false };

/** The test level, with `last` solid tiles on the last row too (columns given), and the rails given. */
function levelOf(o: { last?: readonly number[]; rails?: readonly Rail[] } = {}): Level {
  const rows = Array.from({ length: HEIGHT }, (_, row) =>
    Array.from({ length: WIDTH }, (_t, col) => ((row >= 5 && (col <= 5 || col >= 30)) || (row === HEIGHT - 1 && (o.last ?? []).includes(col)) ? '#' : '.')).join(''),
  );
  return {
    world: parseTiles(rows),
    spawn: { x: 24, y: 5 * TILE },
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
    bottoms: [SPAN],
    ...(o.rails ? { rails: o.rails } : {}),
  };
}

/** Every state from Poncho dropped from rest at x, his feet level with the lips, until he is lost (at most 300 steps). */
function drop(level: Level, x: number): RunState[] {
  let r: RunState = { ...startRun(level), player: { ...spawn(x, 5 * TILE), grounded: false } };
  const states = [r];
  for (let i = 0; i < 300 && r.phase === 'playing'; i++) {
    r = stepRun(r, idle, level);
    states.push(r);
  }
  return states;
}

/** The top of his body box. */
const head = (r: RunState): number => r.player.y - HITBOX.height;

/** The step the life is lost, which must come after a step in play. */
function lostAt(states: readonly RunState[]): number {
  const k = states.findIndex((r) => r.phase === 'respawning');
  expect(k).toBeGreaterThan(0);
  expect(states[k]!.lives.lives).toBe(LIVES_MAX - 1);
  return k;
}

describe('GDD-WLD-03 a raised bottom', () => {
  it("GDD-WLD-03 a column's bottom row is its span's row, else the level's last row", () => {
    const level = { ...levelOf(), bottoms: [SPAN, { fromCol: 32, toCol: 33, row: 12 }] };
    // Inside, and on each end column.
    for (const col of [10, 20, 29]) expect(bottomRowAt(level, col), `column ${col}`).toBe(9);
    for (const col of [32, 33]) expect(bottomRowAt(level, col), `column ${col}`).toBe(12);
    // One column outside each end.
    for (const col of [9, 30, 31, 34]) expect(bottomRowAt(level, col), `column ${col}`).toBe(HEIGHT - 1);
    // Left out: the last row everywhere.
    expect(bottomRowAt({ world: level.world }, 20)).toBe(HEIGHT - 1);
    // The floor line is the bottom edge of the bottom row, under the column a level x is in.
    expect(floorYAt(level, 10 * TILE)).toBe(FLOOR_LINE);
    expect(floorYAt(level, 10 * TILE - 0.01)).toBe(LEVEL_BOTTOM);
    expect(floorYAt(level, 30 * TILE - 0.01)).toBe(FLOOR_LINE);
    expect(floorYAt(level, 30 * TILE)).toBe(LEVEL_BOTTOM);
  });

  it('GDD-LIFE-02, GDD-WLD-03 he falls out at a raised bottom: the life is lost on the step his whole box is below its floor line', () => {
    const level = levelOf();
    // His box's top on the line, or 1 px above it: still in play; a hundredth of a px below it: lost.
    expect(isInPit(spawn(20 * TILE, FLOOR_LINE + HITBOX.height), level.world, level.bottoms)).toBe(false);
    expect(isInPit(spawn(20 * TILE, FLOOR_LINE + HITBOX.height - 1), level.world, level.bottoms)).toBe(false);
    expect(isInPit(spawn(20 * TILE, FLOOR_LINE + HITBOX.height + 0.01), level.world, level.bottoms)).toBe(true);
    // Dropped in the middle of the span: lost on the first step his box's top is below the line, far above the level's bottom.
    const states = drop(level, 20 * TILE + TILE / 2);
    const k = lostAt(states);
    expect(head(states[k]!)).toBeGreaterThan(FLOOR_LINE);
    expect(states[k]!.player.y).toBeLessThan(LEVEL_BOTTOM);
    // The step before he was in play with part of his box above the line and his feet already below it.
    expect(states[k - 1]!.phase).toBe('playing');
    expect(head(states[k - 1]!)).toBeLessThanOrEqual(FLOOR_LINE);
    expect(states[k - 1]!.player.y).toBeGreaterThan(FLOOR_LINE);
  });

  it('GDD-WLD-03 at the same height outside the span he is not lost', () => {
    // Dropped in the shaft next to the span (column 8): past the span's floor line he falls on, and is lost at the level's bottom.
    const states = drop(levelOf(), 8 * TILE + TILE / 2);
    const k = lostAt(states);
    expect(states.slice(0, k).some((r) => head(r) > FLOOR_LINE + TILE)).toBe(true);
    expect(head(states[k - 1]!)).toBeLessThanOrEqual(LEVEL_BOTTOM);
    expect(head(states[k]!)).toBeGreaterThan(LEVEL_BOTTOM);
  });

  it('GDD-WLD-03 the column his middle is in decides', () => {
    const level = levelOf();
    // Falling along the span's left edge (x 160) with his box over both columns 9 and 10: his middle 1 px inside the span, he is lost at its
    // floor line; 1 px outside it, at the level's bottom.
    const inside = drop(level, 10 * TILE + 1);
    expect(inside[0]!.player.x - HITBOX.width / 2).toBeLessThan(10 * TILE);
    const k = lostAt(inside);
    expect(head(inside[k]!)).toBeGreaterThan(FLOOR_LINE);
    expect(head(inside[k]!)).toBeLessThan(LEVEL_BOTTOM);
    const outside = drop(level, 10 * TILE - 1);
    expect(outside[0]!.player.x + HITBOX.width / 2).toBeGreaterThan(10 * TILE);
    expect(head(outside[lostAt(outside)]!)).toBeGreaterThan(LEVEL_BOTTOM);
    // His middle stayed where it was on the way down.
    expect(new Set([...inside, ...outside].map((r) => Math.floor(r.player.x / TILE)))).toEqual(new Set([9, 10]));
  });

  it('GDD-WLD-03 a level without bottoms is unchanged', () => {
    // Every level but the tall lab has none: its floor line is the level's bottom under every column.
    for (const e of LEVELS.filter((l) => l.id !== 'lab-3t')) {
      expect(e.level.bottoms, e.id).toBeUndefined();
      for (let col = 0; col < e.level.world.width; col++) expect(floorYAt(e.level, col * TILE + TILE / 2), `${e.id} column ${col}`).toBe(e.level.world.height * TILE);
    }
  });
});

describe('GDD-WLD-03 only Poncho is lost at a raised bottom', () => {
  // The last row solid under the span, so what falls past its floor line lands there (a fixture the validator would refuse: under a raised
  // bottom a column is solid or empty all the way down). Poncho stands on the left ground the whole time.
  const floored = levelOf({ last: Array.from({ length: 20 }, (_, i) => 10 + i) });
  const LAST_TOP = (HEIGHT - 1) * TILE;

  it("GDD-WLD-03 only Poncho is lost at a raised bottom: an enemy falls on to the level's last row", () => {
    const level: Level = { ...floored, enemies: [{ x: 20 * TILE + TILE / 2, y: 5 * TILE, kind: 'chapulin' }] };
    let r = startRun(level);
    let lowest = 0;
    for (let i = 0; i < 120; i++) {
      r = stepRun(r, idle, level);
      expect(r.phase, `step ${i}`).toBe('playing');
      lowest = Math.max(lowest, r.enemies[0]!.y ?? 0);
    }
    // It fell past the floor line (its feet 304 px below it) and landed on the last row, and hops on there, alive.
    expect(lowest).toBe(LAST_TOP);
    expect(r.enemies[0]!.alive).toBe(true);
    expect(r.lives.lives).toBe(LIVES_MAX);
  });

  it("GDD-WLD-03 only Poncho is lost at a raised bottom: a taco falls on to the level's last row", () => {
    let r: RunState = { ...startRun(floored), items: [{ x: 20 * TILE + TILE / 2, y: 5 * TILE, vx: 0, vy: 0, kind: 'taco' }] };
    for (let i = 0; i < 120; i++) r = stepRun(r, idle, floored);
    expect(r.phase).toBe('playing');
    expect(r.items).toHaveLength(1);
    expect(r.items[0]).toMatchObject({ y: LAST_TOP, vy: 0 });
  });

  it("GDD-WLD-03 only Poncho is lost at a raised bottom: a falling cart is gone only below the level's bottom", () => {
    // A rail on the left ground from x 48, 7 level tiles to a broken end at x 160, over the span; the shaft open under it. The cart rolls
    // empty from its start.
    const rail: Rail = { x: 48, y: 5 * TILE, dir: 1, segments: [{ kind: 'level', tiles: 7 }], end: 'broken' };
    const level = levelOf({ rails: [rail] });
    let r: RunState = { ...startRun(level), carts: [{ phase: 'rolling', m: 16 }] };
    const boxes: ({ x: number; y: number } | null)[] = [];
    const phases: string[] = [];
    for (let i = 0; i < 140; i++) {
      r = stepRun(r, idle, level);
      expect(r.phase, `step ${i}`).toBe('playing');
      phases.push(r.carts[0]!.phase);
      boxes.push(fallingBox(rail, r.carts[0]!));
    }
    // Wholly below the span's floor line and still falling; gone on the step its box is wholly below the level's bottom.
    const below = boxes.findIndex((b) => b !== null && b.y > FLOOR_LINE);
    expect(below).toBeGreaterThan(0);
    expect(boxes[below]!.x + 16).toBeGreaterThan(10 * TILE);
    const gone = phases.indexOf('gone');
    expect(gone).toBeGreaterThan(below);
    expect(phases.slice(below, gone).every((p) => p === 'falling')).toBe(true);
    // (Not broken on a wall on the way: a step before, it was within a step's fall at 360 px/s of the level's bottom.)
    expect(boxes[gone - 1]!.y).toBeLessThanOrEqual(LEVEL_BOTTOM);
    expect(boxes[gone - 1]!.y).toBeGreaterThan(LEVEL_BOTTOM - 6);
    // Its middle stayed over the span all the way.
    expect(boxes.slice(below, gone).every((b) => b!.x + 16 >= 10 * TILE && b!.x + 16 < 30 * TILE)).toBe(true);
  });
});
