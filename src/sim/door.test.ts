import { describe, expect, it } from 'vitest';
import { KEY, RESPAWN, TILE } from '../config/tuning';
import { touchesDoor, touchesKey, withDoors, type Door, type Key } from './door';
import type { Item } from './item';
import { spawn, type PlayerInput, type PlayerState } from './movement';
import { startRun, stepRun, type Level, type RunState } from './run';
import { parseTiles } from './tilemap';

const idle: PlayerInput = { move: 0, jumpHeld: false };
const right: PlayerInput = { move: 1, jumpHeld: false };

// Floor top at y = 64 (row 4). A door in column 6, rows 2 and 3 (x 96 to 112, y 32 to 64), and a key in column 2, row 3
// (box x 34 to 46, y 50 to 62).
const world = parseTiles(['..........', '..........', '..........', '..........', '##########', '..........']);
const door: Door = { col: 6, row: 2, height: 2 };
const key: Key = { col: 2, row: 3 };
const level: Level = {
  world,
  spawn: { x: 24, y: 4 * TILE },
  ofrendas: [],
  spikes: [],
  crumbles: [],
  springs: [],
  platforms: [],
  tacos: [],
  pinatas: [],
  doors: [door],
  keys: [key],
  fragiles: [],
  enemies: [],
};
const at = (x: number, y: number): PlayerState => spawn(x, y);
const run = (r: RunState, input: PlayerInput, steps: number): RunState => {
  for (let i = 0; i < steps; i++) r = stepRun(r, input, level);
  return r;
};
const withKeys = (n: number, extra: Partial<RunState> = {}): RunState => ({ ...startRun(level), keysHeld: n, keysTaken: [true], ...extra });

describe('WLD-05 a door is solid until opened', () => {
  it('blocks every tile of its height, and no more', () => {
    const solid = withDoors(parseTiles(['..........', '..........', '..........', '..........', '..........', '..........']), [door], [false]);
    expect(solid.solidTile(6, 4)).toBe(false); // the tile under the last one
    expect(solid.solidTile(6, 2)).toBe(true);
    expect(solid.solidTile(6, 3)).toBe(true);
    expect(solid.solidTile(6, 1)).toBe(false);
    expect(solid.solidTile(5, 2)).toBe(false);
    expect(solid.solidTile(7, 3)).toBe(false);
  });
  it('is gone once open', () => {
    expect(withDoors(world, [door], [true]).solidTile(6, 2)).toBe(false);
  });
  it('stops Poncho without a key', () => {
    const noKey: Level = { ...level, keys: [] };
    let r = startRun(noKey);
    for (let i = 0; i < 120; i++) r = stepRun(r, right, noKey);
    expect(r.player.x).toBe(96 - 6);
    expect(r.doorsOpen).toEqual([false]);
  });
});

describe('WLD-05 picking up a key', () => {
  it('is a 12 x 12 box in the middle of its tile, touched by the body box', () => {
    // Key box x 34 to 46, y 50 to 62. The body is x - 6 to x + 6 and y - 14 to y.
    expect(touchesKey(at(27.99, 56), key)).toBe(false);
    expect(touchesKey(at(28, 56), key)).toBe(false); // only touching its left edge
    expect(touchesKey(at(28.01, 56), key)).toBe(true);
    expect(touchesKey(at(51.99, 56), key)).toBe(true);
    expect(touchesKey(at(52, 56), key)).toBe(false); // only touching its right edge
    expect(touchesKey(at(52.01, 56), key)).toBe(false);
    expect(touchesKey(at(40, 50), key)).toBe(false); // feet at the key's top edge
    expect(touchesKey(at(40, 50.01), key)).toBe(true);
    expect(touchesKey(at(40, 75.99), key)).toBe(true);
    expect(touchesKey(at(40, 76), key)).toBe(false); // body top at the key's bottom edge
    expect(KEY.size).toBe(12);
  });
  it('walking over it takes it: one key held, and it is gone from the floor', () => {
    let r = startRun(level);
    for (let i = 0; i < 60 && r.keysHeld === 0; i++) r = stepRun(r, right, level);
    expect(r).toMatchObject({ keysHeld: 1, keysTaken: [true] });
  });
  it('is taken once: standing on its place again gives nothing', () => {
    const r = run({ ...startRun(level), keysTaken: [true], player: at(40, 64) }, idle, 5);
    expect(r.keysHeld).toBe(0);
  });
});

/** Poncho standing on the floor at x, beside the door. */
const doorSide = (x: number, y = 64): PlayerState => at(x, y);

/** Holding a key and running right at full speed (2 px a step) from x. */
const running = (x: number): RunState => withKeys(1, { player: { ...at(x, 64), vx: 120 } });

describe('WLD-05 opening a door', () => {
  it('touching its side with a key opens it for good and uses the key up', () => {
    const r = stepRun(withKeys(1, { player: doorSide(90) }), idle, level);
    expect(r).toMatchObject({ doorsOpen: [true], keysHeld: 0 });
    expect(run(r, idle, 10).doorsOpen).toEqual([true]);
  });
  it('works from either side', () => {
    expect(stepRun(withKeys(1, { player: doorSide(118) }), idle, level).doorsOpen).toEqual([true]);
  });
  it('without a key it stays shut', () => {
    expect(stepRun(withKeys(0, { player: doorSide(90) }), idle, level).doorsOpen).toEqual([false]);
  });
  it('reach is 1 px: a body closer than 1 px to the door touches it, 1 px or more away does not', () => {
    expect(touchesDoor(doorSide(89.01), door)).toBe(true); // body right edge 95.01, the door starts at 96
    expect(touchesDoor(doorSide(89), door)).toBe(false);
    expect(touchesDoor(doorSide(118.99), door)).toBe(true);
    expect(touchesDoor(doorSide(119), door)).toBe(false);
  });
  it('standing on top of it or bumping it from below does not open it', () => {
    expect(touchesDoor(at(104, 32), door)).toBe(false); // feet on the door's top
    expect(touchesDoor(at(104, 32.01), door)).toBe(true);
    expect(touchesDoor(at(104, 77.99), door)).toBe(true);
    expect(touchesDoor(at(104, 78), door)).toBe(false); // head at the door's bottom (y 64)
  });
  it('one key opens one door: a second door stays shut', () => {
    const two: Level = { ...level, doors: [door, { col: 7, row: 2, height: 2 }] };
    const r = stepRun({ ...startRun(two), keysHeld: 1, keysTaken: [true], player: at(104, 64) }, idle, two);
    expect(r.doorsOpen.filter(Boolean)).toHaveLength(1);
    expect(r.keysHeld).toBe(0);
  });
  it('a key picked up the same step a door is touched opens it', () => {
    const both: Level = { ...level, keys: [{ col: 5, row: 3 }] };
    const r = stepRun({ ...startRun(both), player: at(89.5, 64) }, idle, both); // touches the key box (x 82 to 94) and the door
    expect(r).toMatchObject({ doorsOpen: [true], keysHeld: 0, keysTaken: [true] });
  });
  it('the touch is made by this step\'s own movement: the door opens on the step he reaches it, not one later', () => {
    // Running right at full speed (2 px a step), a gap of 3 px from the door: the step brings him within reach.
    const r = stepRun(running(87.5), right, level);
    expect(r).toMatchObject({ doorsOpen: [true], keysHeld: 0 });
    expect(stepRun(running(85), right, level).doorsOpen).toEqual([false]); // still too far after one step
  });
  it('a key and a door reached by the same step: both happen that step', () => {
    const both: Level = { ...level, keys: [{ col: 5, row: 3 }] };
    const r = stepRun({ ...startRun(both), player: { ...at(87.5, 64), vx: 120 } }, right, both);
    expect(r).toMatchObject({ doorsOpen: [true], keysHeld: 0, keysTaken: [true] });
  });
  it('a key is picked up on the step he reaches it, not one later', () => {
    // The key box starts at x = 34; a body 0.5 px short of it reaches it after one step at 2 px a step.
    const r = stepRun({ ...startRun(level), player: { ...at(27.5, 64), vx: 120 } }, right, level);
    expect(r).toMatchObject({ keysHeld: 1, keysTaken: [true] });
  });
  it('Poncho walks through the open door', () => {
    let r = startRun(level);
    for (let i = 0; i < 200; i++) r = stepRun(r, right, level);
    expect(r.doorsOpen).toEqual([true]);
    expect(r.player.x).toBeGreaterThan(112);
  });
});

describe('WLD-05 a shut door is a wall for a walking taco', () => {
  it('turns it round with its box flush against the door, and walks through once the door is open', () => {
    const walker: Item = { x: 80, y: 64, vx: 40, vy: 0, kind: 'taco' };
    let r: RunState = { ...startRun(level), keysTaken: [true], player: at(24, 64), items: [walker] };
    for (let i = 0; i < 60 && r.items[0]!.vx > 0; i++) r = stepRun(r, idle, level);
    expect(r.items[0]).toMatchObject({ x: 90, vx: -40 }); // the door starts at x = 96
    const open: RunState = { ...startRun(level), keysTaken: [true], doorsOpen: [true], player: at(24, 64), items: [walker] };
    expect(run(open, idle, 60).items[0]!.x).toBeGreaterThan(112);
  });
});

describe('WLD-05 losing a life puts keys and doors back', () => {
  it('after a pit: no keys held, the key is back on the floor and the door is shut again', () => {
    const pit: Level = { ...level, world: parseTiles(['...', '...']) };
    let r: RunState = { ...startRun(pit), keysHeld: 1, keysTaken: [true], doorsOpen: [true], player: at(24, 200) };
    for (let i = 0; i < 1 + RESPAWN.delaySteps; i++) r = stepRun(r, idle, pit);
    expect(r).toMatchObject({ phase: 'playing', keysHeld: 0, keysTaken: [false], doorsOpen: [false] });
  });
});
