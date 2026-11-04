import { describe, expect, it } from 'vitest';
import { TILE } from '../config/tuning';
import type { Awning } from './awning';
import type { PlayerInput } from './movement';
import type { Cordel } from './papel';
import { startRun, stepRun, type Level, type RunState } from './run';
import { parseTiles } from './tilemap';

// The run hands the World 2 enemies the awnings and cordeles of the level (GDD-ENM-03, GDD-WLD-10, GDD-WLD-11).

const idle: PlayerInput = { move: 0, jumpHeld: false };
const base = { ofrendas: [], spikes: [], crumbles: [], springs: [], platforms: [], tacos: [], pinatas: [], doors: [], keys: [], fragiles: [] } as const;
// 40 tiles wide, 17 tall, the floor's top at row 14 (y = 224), walls in the first and last columns.
const world = parseTiles(Array.from({ length: 17 }, (_row, r) => Array.from({ length: 40 }, (_, c) => (r >= 14 || c === 0 || c === 39 ? '#' : '.')).join('')));
const FLOOR = 14 * TILE;
// Two torn awnings 48 px above the floor; Poncho stands far to the left.
const T1: Awning = { x: 96, y: 176, w: 64, torn: true };
const T2: Awning = { x: 400, y: 176, w: 64, torn: true };

function play(level: Level, r: RunState, steps: number): RunState {
  let s = r;
  for (let i = 0; i < steps; i++) s = stepRun(s, idle, level);
  return s;
}

describe('GDD-ENM-03 the run hands the Chapulín the awnings (GDD-WLD-10)', () => {
  const level: Level = { ...base, world, spawn: { x: 24, y: FLOOR }, awnings: [T1, T2], enemies: [{ x: 432, y: 160, kind: 'chapulin' }] };

  it('a Chapulín dropping onto a torn awning tears it, the other one stays', () => {
    const after = play(level, startRun(level), 40);
    expect(after.awningsGone).toEqual([false, true]);
  });

  it('it bounces off the awning: it rises above the awning top after landing on it', () => {
    let s = startRun(level);
    let highest = Infinity;
    let landed = false;
    for (let i = 0; i < 40; i++) {
      s = stepRun(s, idle, level);
      const y = s.enemies[0]!.y!;
      if (y >= T2.y) landed = true;
      if (landed) highest = Math.min(highest, y);
    }
    expect(landed).toBe(true);
    // A tier 1 throw (480 px/s) lifts its feet far above the awning's top.
    expect(highest).toBeLessThan(T2.y - 48);
  });

  it('the awning it tears is counted among the awnings still there: with T1 gone, its bounce tears T2', () => {
    const r = { ...startRun(level), awningsGone: [true, false] };
    expect(play(level, r, 40).awningsGone).toEqual([true, true]);
  });

  it('a whole awning stays whole under its bounces', () => {
    const whole: Level = { ...level, awnings: [T1, { ...T2, torn: false }] };
    expect(play(whole, startRun(whole), 120).awningsGone).toEqual([false, false]);
  });
});

describe('GDD-ENM-03 the run hands the Paloma the cordeles (GDD-WLD-11)', () => {
  // A cordel high over the floor, columns 20 to 25 (x 320 to 416); the Paloma starts on it, far from Poncho.
  const C: Cordel = { x: 320, y: 96, w: 96 };
  const level: Level = { ...base, world, spawn: { x: 24, y: FLOOR }, cordeles: [C], enemies: [{ x: 352, y: 96, kind: 'paloma' }] };

  it('it walks along the cordel and turns at its ends, never leaving it', () => {
    let s = startRun(level);
    const xs: number[] = [];
    for (let i = 0; i < 600; i++) {
      s = stepRun(s, idle, level);
      xs.push(s.enemies[0]!.x);
      expect(s.enemies[0]!.y).toBe(C.y);
    }
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(C.x);
    expect(Math.max(...xs)).toBeLessThanOrEqual(C.x + C.w);
    // It walked the cordel both ways.
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(C.w / 2);
  });
});
