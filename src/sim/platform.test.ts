import { describe, expect, it } from 'vitest';
import { PLATFORM, RESPAWN, TILE } from '../config/tuning';
import { platformAt, standsOnPlatform, type MovingPlatform } from './platform';
import { spawn, type PlayerInput, type PlayerState } from './movement';
import { startRun, stepRun, type Level, type RunState } from './run';
import { parseTiles } from './tilemap';

const idle: PlayerInput = { move: 0, jumpHeld: false };

// A floor at row 12 (top y = 192) and a pit-less world 20 tiles wide.
const world = parseTiles([...Array.from({ length: 12 }, () => '.'.repeat(20)), '#'.repeat(20)]);
// Horizontal: its top is at y = 128, from x = 100 to x = 196 and back (96 px, 2.4 s one way at 40 px/s), 48 px wide.
const across: MovingPlatform = { x0: 100, y0: 128, x1: 196, y1: 128, w: 48 };
// Vertical: x = 40 to 88, its top goes from y = 128 down to y = 176 (48 px, 1.2 s one way).
const down: MovingPlatform = { x0: 40, y0: 128, x1: 40, y1: 176, w: 48 };
const levelOf = (...platforms: MovingPlatform[]): Level => ({
  world,
  spawn: { x: 16, y: 12 * TILE },
  ofrendas: [],
  spikes: [],
  crumbles: [],
  springs: [],
  platforms,
  tacos: [],
});

/** A 20-wide world with a floor at row 12, and `solid(row)` giving every other row. */
const rows = (solid: (row: number) => string) => parseTiles(Array.from({ length: 13 }, (_, r) => (r === 12 ? '#'.repeat(20) : solid(r))));

/** Plays on, returning every state. */
function play(level: Level, r: RunState, steps: number, input: (i: number) => PlayerInput = () => idle): RunState[] {
  const states: RunState[] = [];
  for (let i = 0; i < steps; i++) {
    r = stepRun(r, input(i), level);
    states.push(r);
  }
  return states;
}
const runAt = (level: Level, player: PlayerState, platformTick = 0): RunState => ({ ...startRun(level), player, platformTick });

describe('GDD-WLD-05 moving platform path', () => {
  it('starts at its first end and moves 40 px a second', () => {
    expect(PLATFORM.speed).toBe(40);
    expect(platformAt(across, 0)).toEqual({ x: 100, y: 128, w: 48 });
    expect(platformAt(across, 60).x).toBeCloseTo(140, 9);
    expect(platformAt(across, 30).x).toBeCloseTo(120, 9);
  });

  it('turns round at the far end and comes back, forever', () => {
    expect(platformAt(across, 144).x).toBeCloseTo(196, 9); // 96 px at 40 px/s is 2.4 s = 144 steps
    expect(platformAt(across, 216).x).toBeCloseTo(148, 9); // 72 steps back: 48 px
    expect(platformAt(across, 288).x).toBeCloseTo(100, 9);
    expect(platformAt(across, 288 + 60).x).toBeCloseTo(140, 9);
  });

  it('works along any direction: a vertical one, and one that does not move', () => {
    expect(platformAt(down, 60)).toMatchObject({ x: 40, y: expect.closeTo(168, 9) });
    expect(platformAt(down, 72).y).toBeCloseTo(176, 9);
    expect(platformAt(down, 144).y).toBeCloseTo(128, 9);
    expect(platformAt({ x0: 5, y0: 6, x1: 5, y1: 6, w: 16 }, 100)).toEqual({ x: 5, y: 6, w: 16 });
  });
});

describe('GDD-WLD-05 moving platform: standing on it', () => {
  const level = levelOf(across);

  it('what counts: grounded, feet on its top, body box over it', () => {
    const at = platformAt(across, 0);
    const on = spawn(120, 128);
    expect(standsOnPlatform(on, at)).toBe(true);
    expect(standsOnPlatform({ ...on, grounded: false }, at)).toBe(false);
    expect(standsOnPlatform({ ...on, y: 129 }, at)).toBe(false);
    expect(standsOnPlatform({ ...on, x: 100 - 6 }, at)).toBe(false); // only touching its left end
    expect(standsOnPlatform({ ...on, x: 100 - 5.99 }, at)).toBe(true);
    expect(standsOnPlatform({ ...on, x: 148 + 6 }, at)).toBe(false);
  });

  it('lands on its top from above and stays on it', () => {
    const states = play(level, runAt(level, { ...spawn(124, 100), grounded: false }), 60);
    const landed = states.find((s) => s.player.grounded)!;
    expect(states.indexOf(landed)).toBeGreaterThan(5); // he falls the 28 px first, he is not pulled onto it
    expect(states[0]!.player.y).toBeLessThan(128);
    expect(landed.player.y).toBeCloseTo(128, 9);
    expect(landed.player.vy).toBe(0);
    expect(states.slice(states.indexOf(landed)).every((s) => s.player.grounded && Math.abs(s.player.y - platformAt(across, s.platformTick).y) < 1e-6)).toBe(true);
  });

  it('is carried sideways with the platform: after 1 s he has moved 40 px, still standing', () => {
    const states = play(level, runAt(level, spawn(120, 128)), 60);
    const last = states[59]!.player;
    expect(last.x).toBeCloseTo(160, 6);
    expect(last.y).toBeCloseTo(128, 6);
    expect(states.every((s) => s.player.grounded)).toBe(true);
  });

  it('is carried up and down with a vertical platform, still standing', () => {
    const v = levelOf(down);
    const states = play(v, runAt(v, spawn(60, 128)), 144); // down for 72 steps and back up for 72
    expect(states[59]!.player.y).toBeCloseTo(168, 6);
    expect(states[71]!.player.y).toBeCloseTo(176, 6);
    expect(states[143]!.player.y).toBeCloseTo(128, 6);
    expect(states.every((s) => s.player.grounded)).toBe(true);
  });

  it('walking off its end drops him to the floor', () => {
    const states = play(level, runAt(level, spawn(120, 128)), 200, () => ({ move: -1, jumpHeld: false }));
    expect(states[199]!.player).toMatchObject({ grounded: true, y: 12 * TILE });
  });

  it('a jump from it takes off at once, 410 px/s', () => {
    const [first] = play(level, runAt(level, spawn(120, 128)), 1, () => ({ move: 0, jumpHeld: true }));
    expect(first!.player).toMatchObject({ grounded: false });
    expect(first!.player.vy).toBeLessThan(-380);
    expect(first!.player.y).toBeLessThan(128);
  });
});

describe('GDD-WLD-05 moving platform: one way', () => {
  const level = levelOf(across);

  it('is not a floor from below: Poncho rises through it and lands on top when he comes back down', () => {
    // Thrown up from the floor under it at 480 px/s (about 77 px), so his feet go from 192 up to about 115, above its top at 128.
    const states = play(level, runAt(level, { ...spawn(124, 192), vy: -480, grounded: false }), 200);
    expect(Math.min(...states.map((s) => s.player.y))).toBeLessThan(120); // he went through it
    expect(states[199]!.player.grounded).toBe(true);
    expect(states[199]!.player.y).toBeCloseTo(platformAt(across, states[199]!.platformTick).y, 6); // and stands on it
  });

  it('does not stop him beneath it: standing on the floor under it, he is not lifted or blocked', () => {
    const states = play(level, runAt(level, spawn(124, 192)), 120);
    expect(states[119]!.player).toMatchObject({ x: 124, y: 192, grounded: true });
  });

  it('its slab is not a wall: Poncho walks through it at its height', () => {
    // A floor 16 px lower than the platform's top (y = 144), so his body is level with the 8 px slab (y 128 to 136) as he walks into it.
    const high = parseTiles([...Array.from({ length: 8 }, () => '.'.repeat(20)), '######..............', ...Array.from({ length: 4 }, () => '#'.repeat(20))]);
    const l: Level = { ...levelOf({ x0: 120, y0: 128, x1: 120, y1: 128, w: 48 }), world: high };
    const states = play(l, runAt(l, spawn(80, 128)), 60, () => ({ move: 1, jumpHeld: false })); // the platform is a 128-high strip ahead
    expect(states[59]!.player.x).toBeGreaterThan(120);
  });
});

describe('GDD-WLD-05 moving platform: never carries Poncho into a tile', () => {

  it('a wall in the way: he stops against its face and does not pass through it', () => {
    // A wall at tile column 10 (x 160 to 176), rows 6 and 7 (y 96 to 128): level with his body as he stands on the platform.
    const l: Level = { ...levelOf(across), world: rows((r) => (r === 6 || r === 7 ? '.'.repeat(10) + '#' + '.'.repeat(9) : '.'.repeat(20))) };
    const states = play(l, runAt(l, spawn(120, 128)), 200);
    const xs = states.map((s) => s.player.x);
    expect(Math.max(...xs)).toBeLessThanOrEqual(154 + 1e-6); // the wall face at 160 less half his 12 px width
    expect(Math.max(...xs)).toBeGreaterThan(153); // he did get all the way to it
    for (let i = 1; i < xs.length; i++) expect(Math.abs(xs[i]! - xs[i - 1]!)).toBeLessThan(1); // no jump through the wall
    // The platform slides on under him and later back; he is not crushed and not pushed anywhere odd.
    expect(states.every((s) => s.phase === 'playing')).toBe(true);
  });

  it('a ceiling in the way: his head stops under it and he is not moved sideways', () => {
    // A ceiling at tile row 6 (y 96 to 112) over x 32 to 80, with a vertical platform rising from y = 176 to y = 100 under it.
    const up: MovingPlatform = { x0: 40, y0: 176, x1: 40, y1: 100, w: 48 };
    const l: Level = { ...levelOf(up), world: rows((r) => (r === 6 ? '..###' + '.'.repeat(15) : '.'.repeat(20))) };
    const states = play(l, runAt(l, spawn(60, 176)), 160);
    const ys = states.map((s) => s.player.y);
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(126 - 1e-6); // the ceiling's underside at 112 plus his 14 px height
    expect(Math.min(...ys)).toBeLessThan(127); // he did rise right up to it
    expect(states.every((s) => Math.abs(s.player.x - 60) < 1e-9)).toBe(true);
  });
});

describe('GDD-WLD-05 moving platform: in a run', () => {
  const level = levelOf(across);

  it('counts steps while playing', () => {
    expect(startRun(level).platformTick).toBe(0);
    expect(play(level, startRun(level), 30)[29]!.platformTick).toBe(30);
  });

  it('goes back to its start when Poncho loses a life and respawns', () => {
    let r: RunState = { ...runAt(level, { ...spawn(124, 192), y: 12 * TILE + 400, grounded: false }, 100) };
    r = play(level, r, 1)[0]!;
    expect(r.phase).toBe('respawning');
    r = play(level, r, RESPAWN.delaySteps)[RESPAWN.delaySteps - 1]!;
    expect(r.phase).toBe('playing');
    expect(r.platformTick).toBe(0);
  });
});
