import { describe, expect, it } from 'vitest';
import { ROLLO, RUN, TILE } from '../config/tuning';
import { spawn, type PlayerInput, type PlayerState } from './movement';
import { bundleBox, freshRollos, rolloLength, stringTops, strungPart, type Cordel, type Rollo } from './papel';
import { startRun, stepRun, type Level, type RunState } from './run';
import { parseTiles } from './tilemap';

const idle: PlayerInput = { move: 0, jumpHeld: false };
const base = { ofrendas: [], spikes: [], crumbles: [], springs: [], platforms: [], tacos: [], pinatas: [], doors: [], keys: [], fragiles: [], enemies: [] } as const;

// 40 tiles wide, the floor's top at row 14 (y = 224), a pit 6 tiles wide at columns 10 to 15 (x = 160 to 256).
const world = parseTiles(Array.from({ length: 17 }, (_row, r) => Array.from({ length: 40 }, (_, c) => (r >= 14 && (c < 10 || c > 15) ? '#' : '.')).join('')));
const FLOOR = 14 * TILE;
// A cordel 48 px over the floor at columns 2 to 5; a rollo across the pit 8 px over the floor, tied at its left post.
const C: Cordel = { x: 32, y: 176, w: 64 };
const R: Rollo = { x: 160, y: 216, w: 96, post: 'left' };
const level: Level = { ...base, world, spawn: { x: 40, y: FLOOR }, cordeles: [C], rollos: [R] };

function play(lv: Level, r: RunState, steps: number, input: (i: number) => PlayerInput = () => idle): RunState[] {
  const states: RunState[] = [];
  for (let i = 0; i < steps; i++) {
    r = stepRun(r, input(i), lv);
    states.push(r);
  }
  return states;
}
const at = (player: PlayerState, lv: Level = level): RunState => ({ ...startRun(lv), player });
/** Claws on the first step, holds right all along, and holds jump from the 4th step to the 20th. */
const clawThenRun = (i: number): PlayerInput => ({ move: 1, jumpHeld: i >= 3 && i < 20, claw: i === 0 });

describe('GDD-WLD-11 cordel: a one-way floor that never moves or bounces', () => {
  it('he lands on it from above and stands on it, even with jump held: it never bounces', () => {
    const states = play(level, at({ ...spawn(64, C.y - 64), grounded: false }), 60, () => ({ move: 0, jumpHeld: true }));
    const land = states.findIndex((s) => s.player.y === C.y);
    expect(states[land]!.player).toMatchObject({ grounded: true, vy: 0 });
    expect(states.slice(land).every((s) => s.player.y === C.y && s.player.grounded)).toBe(true);
  });

  it('he jumps up through it from below and lands on it', () => {
    const states = play(level, at(spawn(64, FLOOR)), 60, (i) => ({ move: 0, jumpHeld: i < 30 }));
    expect(states.some((s) => s.player.y < C.y && s.player.vy < 0)).toBe(true);
    expect(states.at(-1)!.player).toMatchObject({ y: C.y, grounded: true });
  });

  it('he walks off its end and falls', () => {
    const states = play(level, at(spawn(90, C.y)), 25, () => ({ move: 1, jumpHeld: false }));
    expect(states.at(-1)!.player).toMatchObject({ y: FLOOR, grounded: true });
  });

  it('a claw swipe on it changes nothing', () => {
    const states = play(level, at(spawn(64, C.y)), 20, (i) => ({ move: 0, jumpHeld: false, claw: i === 0 }));
    expect(states.every((s) => s.player.y === C.y && s.player.grounded)).toBe(true);
    expect(states.at(-1)!.rollos).toEqual([{ steps: null }]);
  });
});

describe('GDD-WLD-11 rollo: a bundle the claw or a fireball unrolls', () => {
  it('rolled up, there is nothing to stand on: he falls through where its line will be', () => {
    // Over the line's first tile, by the post.
    const states = play(level, at({ ...spawn(170, R.y - 20), grounded: false }), 60);
    expect(states.every((s) => s.rollos[0]!.steps === null)).toBe(true);
    expect(states.some((s) => s.player.y === R.y)).toBe(false);
    expect(states.at(-1)!.phase).toBe('respawning');
  });

  it('its bundle is a 12 px square hanging from the line by its post', () => {
    expect(ROLLO.size).toBe(12);
    expect(bundleBox(R)).toEqual({ x0: 160, x1: 172, y0: 216, y1: 228 });
    expect(bundleBox({ ...R, post: 'right' })).toEqual({ x0: 244, x1: 256, y0: 216, y1: 228 });
  });

  it('a claw swipe that touches the bundle unrolls it, on the swipe\'s first step', () => {
    // Standing on the floor at x = 150 facing right: the claw box (156 to 176 across, 192 to 224 down) overlaps the bundle.
    const states = play(level, at(spawn(150, FLOOR)), 10, (i) => ({ move: 0, jumpHeld: false, claw: i === 0 }));
    const swing = states.findIndex((s) => s.claw.phase === 'swing');
    expect(states[swing - 1]!.rollos).toEqual([{ steps: null }]);
    expect(states[swing]!.rollos).toEqual([{ steps: 0 }]);
  });

  it('a claw swipe that does not reach the bundle leaves it rolled', () => {
    // Facing left, away from it.
    const states = play(level, at({ ...spawn(150, FLOOR), facing: -1 }), 10, (i) => ({ move: 0, jumpHeld: false, claw: i === 0 }));
    expect(states.at(-1)!.rollos).toEqual([{ steps: null }]);
    // Too far: x = 130, the claw box ends at 156, short of the bundle at 160.
    const far = play(level, at(spawn(130, FLOOR)), 10, (i) => ({ move: 0, jumpHeld: false, claw: i === 0 }));
    expect(far.at(-1)!.rollos).toEqual([{ steps: null }]);
  });

  it('a claw swipe at the post of one unrolling or strung changes nothing: it goes on growing', () => {
    const r: RunState = { ...at(spawn(150, FLOOR)), rollos: [{ steps: 3 }] };
    const states = play(level, r, 6, (i) => ({ move: 0, jumpHeld: false, claw: i === 0 }));
    expect(states.map((s) => s.rollos[0]!.steps)).toEqual([4, 5, 6, 7, 8, 9]);
  });

  it('a fireball that touches the bundle unrolls it and is used up', () => {
    // A fireball on the floor at x = 150 heading right at 180 px/s: in three steps its box (6 px) reaches the bundle at x = 160.
    const r: RunState = { ...at(spawn(40, FLOOR)), fireballs: [{ x: 150, y: FLOOR, vx: 180, vy: 0, age: 0 }] };
    const states = play(level, r, 10);
    const hit = states.findIndex((s) => s.rollos[0]!.steps !== null);
    expect(hit).toBeGreaterThan(0);
    expect(states[hit - 1]!.fireballs).toHaveLength(1);
    expect(states[hit]!.fireballs).toHaveLength(0);
    expect(states[hit]!.rollos).toEqual([{ steps: 0 }]);
  });

  it('a fireball passes a cordel and a strung rollo', () => {
    // On the floor at x = 150 heading right, through where the bundle hung (x 160 to 172), and on through a cordel.
    const strung: RunState = { ...at(spawn(40, FLOOR)), rollos: [{ steps: 100 }], fireballs: [{ x: 150, y: FLOOR, vx: 180, vy: 0, age: 0 }] };
    expect(play(level, strung, 8).every((s) => s.fireballs.length === 1)).toBe(true);
    const cordel: RunState = { ...at(spawn(300, FLOOR)), fireballs: [{ x: 20, y: C.y + 4, vx: 180, vy: -100, age: 0 }] };
    expect(play(level, cordel, 8).every((s) => s.fireballs.length === 1)).toBe(true);
  });

  it('it grows from its post at 160 px/s, a 6-tile cordel in 0.6 s, and stays', () => {
    expect(ROLLO.unrollSpeed).toBe(160);
    expect(rolloLength(R, { steps: null })).toBe(0);
    expect(rolloLength(R, { steps: 0 })).toBe(0);
    expect(rolloLength(R, { steps: 1 })).toBeCloseTo(160 / 60, 9);
    expect(rolloLength(R, { steps: 30 })).toBeCloseTo(80, 9);
    expect(rolloLength(R, { steps: 36 })).toBeCloseTo(96, 9);
    expect(rolloLength(R, { steps: 600 })).toBe(96);
    expect(strungPart(R, { steps: 30 })).toEqual({ x: 160, y: 216, w: expect.closeTo(80, 9) });
    expect(strungPart(R, { steps: 0 })).toBeNull();
  });

  it('tied at the right post, it grows leftwards', () => {
    expect(strungPart({ ...R, post: 'right' }, { steps: 30 })).toEqual({ x: expect.closeTo(176, 9), y: 216, w: expect.closeTo(80, 9) });
  });

  it('in a run it grows a step at a time from the swipe, and only the strung part holds him', () => {
    const r: RunState = { ...at({ ...spawn(240, R.y - 1), grounded: false, vy: 300 }), rollos: [{ steps: 0 }] };
    // His body (234 to 246) is beyond the strung part for the first steps: he falls through.
    const states = play(level, r, 3);
    expect(states.map((s) => s.rollos[0]!.steps)).toEqual([1, 2, 3]);
    expect(states[0]!.player.y).toBeGreaterThan(R.y);
  });

  it('a Poncho who claws it and runs on, jumping onto it, is always behind its front and crosses the pit on it', () => {
    expect(ROLLO.unrollSpeed).toBeGreaterThan(RUN.maxSpeed);
    const states = play(level, at(spawn(150, FLOOR)), 150, clawThenRun);
    const start = states.findIndex((s) => s.rollos[0]!.steps !== null);
    for (const s of states.slice(start)) {
      const front = R.x + rolloLength(R, s.rollos[0]!);
      if (front < R.x + R.w) expect(s.player.x).toBeLessThan(front);
    }
    expect(states.some((s) => s.player.y === R.y && s.player.grounded)).toBe(true);
    expect(states.every((s) => s.phase === 'playing')).toBe(true);
    expect(states.at(-1)!.player.x).toBeGreaterThan(R.x + R.w);
  });

  it('it is rolled up again when a life is lost', () => {
    const r: RunState = { ...at({ ...spawn(100, 400), grounded: false }), rollos: [{ steps: 100 }] };
    const back = play(level, r, 60).find((s) => s.phase === 'playing')!;
    expect(back.rollos).toEqual(freshRollos([R]));
    expect(back.rollos).toEqual([{ steps: null }]);
  });
});

describe('GDD-WLD-11 cordel tops for other things that walk or stand on them', () => {
  it('lists every cordel and the strung part of each rollo', () => {
    expect(stringTops([C], [R, { ...R, x: 400 }], [{ steps: 30 }, { steps: null }])).toEqual([
      { x: 32, y: 176, w: 64 },
      { x: 160, y: 216, w: expect.closeTo(80, 9) },
    ]);
  });
});
