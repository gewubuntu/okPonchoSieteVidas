import { describe, expect, it } from 'vitest';
import { SANDBOX_LEVEL } from '../levels/sandbox';
import type { LivesState } from './lives';
import type { PlayerInput } from './movement';
import { spawn } from './movement';
import { startRun, stepRun, type Level, type RunState } from './run';
import { parseTiles } from './tilemap';
import { touchesVeladora, veladoraUsed, type Veladora } from './veladora';

const idle: PlayerInput = { move: 0, jumpHeld: false };
const jump: PlayerInput = { move: 0, jumpHeld: true };

// A flat level, 30 x 17 tiles, the floor's top at row 14 (y = 224), with a one-tile pit at column 20 and a veladora at (10, 13): its
// middle is (168, 216), so its 12 x 12 box is x 162 to 174 and y 210 to 222. Poncho's body box is 12 x 32.
const rows = (floor: string) => parseTiles([...Array<string>(14).fill('..............................'), ...Array<string>(3).fill(floor)]);
const flat = rows('####################.#########');
const veladora: Veladora = { col: 10, row: 13 };
const level: Level = { world: flat, spawn: { x: 24, y: 224 }, ofrendas: [], spikes: [], crumbles: [], springs: [], platforms: [], tacos: [], pinatas: [], doors: [], keys: [], fragiles: [], enemies: [], veladora };

const lives = (n: number, used: string[] = []): LivesState => ({ lives: n, used: new Set(used) });
/** A run with `n` lives and Poncho standing at x on the floor. */
const at = (n: number, x: number, l: Level = level): RunState => ({ ...startRun(l), lives: lives(n), player: spawn(x, 224) });
const run = (r: RunState, input: PlayerInput, steps: number, l: Level = level): RunState => {
  for (let i = 0; i < steps; i++) r = stepRun(r, input, l);
  return r;
};
const moveTo = (r: RunState, x: number, y = 224): RunState => ({ ...r, player: { ...spawn(x, y), grounded: y === 224 } });

const touches = (x: number, y: number) => touchesVeladora(spawn(x, y), veladora);

describe('GDD-LIFE-03 the veladora', () => {
  it('GDD-LIFE-03 veladora touch: the body box overlapping its 12 by 12 box', () => {
    expect(touches(168, 224)).toBe(true);
    // Half of 12 and 12 is 12: 11.9 away overlaps, 12 away only shares an edge.
    expect(touches(168 - 11.9, 224)).toBe(true);
    expect(touches(168 - 12, 224)).toBe(false);
    expect(touches(168 + 11.9, 224)).toBe(true);
    expect(touches(168 + 12, 224)).toBe(false);
    // The box's top is y = 210: feet on it do not touch, just below it do.
    expect(touches(168, 210)).toBe(false);
    expect(touches(168, 210.1)).toBe(true);
    // The box's bottom is y = 222: the head (32 above the feet) at it does not touch.
    expect(touches(168, 254)).toBe(false);
    expect(touches(168, 253.9)).toBe(true);
  });

  it('GDD-LIFE-03 a veladora restores a life once', () => {
    const r = run(at(5, 168), idle, 1);
    expect(r.lives.lives).toBe(6);
    expect(veladoraUsed(r.lives, veladora)).toBe(true);
    const away = run(moveTo(r, 300), idle, 1);
    const back = run(moveTo(away, 168), idle, 1);
    expect(back.lives.lives).toBe(6);
  });

  it('GDD-LIFE-03 at seven lives it is used up without a life', () => {
    const r = run(at(7, 168), idle, 1);
    expect(r.lives.lives).toBe(7);
    expect(veladoraUsed(r.lives, veladora)).toBe(true);
  });

  it('GDD-LIFE-03 a lost life does not bring it back', () => {
    const got = run(at(5, 168), idle, 1);
    const fallen = run(moveTo(got, 20 * 16 + 8, 305), idle, 1);
    expect(fallen.phase).toBe('respawning');
    expect(fallen.lives.lives).toBe(5);
    const back = run(fallen, idle, 48);
    expect(back.phase).toBe('playing');
    expect(veladoraUsed(back.lives, veladora)).toBe(true);
    expect(run(moveTo(back, 168), idle, 1).lives.lives).toBe(5);
  });

  it('GDD-LIFE-03 the restart after the last life brings it back', () => {
    const got = run(at(5, 168), idle, 1);
    const last: RunState = { ...got, lives: lives(1, [...got.lives.used]) };
    const spent = run(moveTo(last, 20 * 16 + 8, 305), idle, 1 + 48);
    expect(spent.phase).toBe('gameover');
    expect(veladoraUsed(spent.lives, veladora)).toBe(true);
    const restarted = stepRun(run(spent, idle, 60), jump, level);
    expect(restarted.phase).toBe('respawning');
    expect(restarted.lives.lives).toBe(7);
    expect(veladoraUsed(restarted.lives, veladora)).toBe(false);
  });

  it('GDD-LIFE-03 it counts before a life lost on the same step', () => {
    // A spike under him: 6 + 1 - 1 lives, not 5.
    const spiked: Level = { ...level, spikes: [{ col: 10, row: 13 }] };
    const hit = stepRun(at(6, 168, spiked), idle, spiked);
    expect(hit.phase).toBe('respawning');
    expect(hit.lives.lives).toBe(6);
    expect(veladoraUsed(hit.lives, veladora)).toBe(true);
    // A pit: the veladora in row 17, below the level's bottom (y 272), is still touched when his whole body is below it (y > 304).
    const low: Level = { ...level, veladora: { col: 20, row: 17 } };
    const fell = stepRun(moveTo(at(6, 168, low), 20 * 16 + 8, 305), idle, low);
    expect(fell.phase).toBe('respawning');
    expect(fell.lives.lives).toBe(6);
    expect(veladoraUsed(fell.lives, low.veladora!)).toBe(true);
  });

  it('GDD-LIFE-03 a level without a veladora is unaffected', () => {
    let r = startRun(SANDBOX_LEVEL);
    for (let i = 0; i < 600; i++) {
      r = stepRun(r, { move: 1, jumpHeld: i % 40 < 20 }, SANDBOX_LEVEL);
      expect([...r.lives.used].some((id) => id.startsWith('veladora:'))).toBe(false);
    }
  });
});
