import { describe, expect, it } from 'vitest';
import { CRUMBLE, FORGIVENESS, RESPAWN, TILE } from '../config/tuning';
import { freshCrumbles, standsOn, stepCrumbles, withCrumbles, type Crumble } from './crumble';
import { spawn, type PlayerInput, type PlayerState } from './movement';
import { startRun, stepRun, type Level, type RunState } from './run';
import { parseTiles } from './tilemap';

const idle: PlayerInput = { move: 0, jumpHeld: false };
const right: PlayerInput = { move: 1, jumpHeld: false };

// A floor at row 8 (top y = 128) with a pit in column 8, and two crumbling tiles in columns 2 and 3 of row 5 (top y = 80).
const world = parseTiles([...Array.from({ length: 8 }, () => '..........'), '########.#']);
const crumbles: Crumble[] = [
  { col: 2, row: 5 },
  { col: 3, row: 5 },
];
const level: Level = { world, spawn: { x: 24, y: 8 * TILE }, ofrendas: [], spikes: [], crumbles, springs: [], platforms: [], tacos: [] };
/** Poncho standing on the crumbling tiles, in the middle of column `col`. */
const onTile = (col: number): PlayerState => spawn(col * TILE + TILE / 2, 5 * TILE);
const standingRun = (col: number): RunState => ({ ...startRun(level), player: onTile(col) });
const run = (r: RunState, input: PlayerInput, steps: number): RunState => {
  for (let i = 0; i < steps; i++) r = stepRun(r, input, level);
  return r;
};
const solid = (s: RunState) => withCrumbles(world, crumbles, s.crumbles).solidTile(2, 5);
/** The step the first tile goes, with Poncho still standing on it. */
const goneAt = (): RunState => run({ ...standingRun(2), crumbles: [{ phase: 'warning', steps: 1 }, { phase: 'idle', steps: 0 }] }, idle, 1);
const phases = (r: RunState) => r.crumbles.map((c) => c.phase);

describe('GDD-WLD-05 crumbling tile: what counts as standing on it', () => {
  const c = crumbles[0]!; // column 2: x 32 to 48, top y = 80
  it('feet on its top and the body box over its column', () => {
    expect(standsOn(onTile(2), c)).toBe(true);
    expect(standsOn({ ...onTile(2), x: 32 - 6 + 0.01 }, c)).toBe(true); // body box overlaps the tile by 0.01 px
    expect(standsOn({ ...onTile(2), x: 32 - 6 }, c)).toBe(false); // only touching its side
    expect(standsOn({ ...onTile(2), x: 48 + 6 - 0.01 }, c)).toBe(true);
    expect(standsOn({ ...onTile(2), x: 48 + 6 }, c)).toBe(false);
  });

  it('not while in the air, and not from any other height', () => {
    expect(standsOn({ ...onTile(2), grounded: false }, c)).toBe(false);
    expect(standsOn({ ...onTile(2), y: 5 * TILE - 1 }, c)).toBe(false);
    expect(standsOn({ ...onTile(2), y: 6 * TILE }, c)).toBe(false); // standing on a floor below it
  });
});

describe('GDD-WLD-05 crumbling tile: warning and falling away', () => {
  it('is solid, and untouched, until someone stands on it', () => {
    const r = run(startRun(level), idle, 60);
    expect(phases(r)).toEqual(['idle', 'idle']);
    expect(withCrumbles(world, crumbles, r.crumbles).solidTile(2, 5)).toBe(true);
  });

  it('starts a 0.5 s warning the step Poncho lands, and is gone exactly 30 steps later', () => {
    let r = standingRun(2);
    r = stepRun(r, idle, level);
    expect(r.crumbles[0]).toEqual({ phase: 'warning', steps: CRUMBLE.warningSteps });
    expect(CRUMBLE.warningSteps).toBe(30); // 0.5 s at 60 steps a second
    for (let i = 1; i < 30; i++) {
      r = { ...stepRun(r, idle, level), player: onTile(2) }; // keep him there: this checks the tile, not the fall
      expect(r.crumbles[0]!.phase).toBe('warning');
      expect(solid(r)).toBe(true);
    }
    r = stepRun({ ...r, player: onTile(2) }, idle, level);
    expect(r.crumbles[0]).toMatchObject({ phase: 'gone' });
    expect(solid(r)).toBe(false);
  });

  it('keeps counting down when Poncho leaves, and cannot be stopped', () => {
    let r = stepRun(standingRun(2), idle, level);
    r = { ...r, player: spawn(24, 8 * TILE) }; // back on the ground floor
    r = run(r, idle, 30);
    expect(r.crumbles[0]!.phase).toBe('gone');
  });

  it('stays gone', () => {
    const r = run({ ...startRun(level), crumbles: [{ phase: 'gone', steps: 0 }, { phase: 'idle', steps: 0 }] }, idle, 120);
    expect(phases(r)).toEqual(['gone', 'idle']);
  });

  it('each tile has its own timer: standing in the middle of one starts only that one', () => {
    const r = stepRun(standingRun(2), idle, level);
    expect(phases(r)).toEqual(['warning', 'idle']);
  });

  it('standing on the join of two tiles starts both', () => {
    const r = stepRun({ ...startRun(level), player: spawn(3 * TILE, 5 * TILE) }, idle, level);
    expect(phases(r)).toEqual(['warning', 'warning']);
  });

  it('a jump up from below, or walking past at the side, does not start it', () => {
    const below = stepCrumbles(crumbles, freshCrumbles(crumbles), { ...spawn(40, 7 * TILE), grounded: false, vy: -300 });
    expect(below.map((s) => s.phase)).toEqual(['idle', 'idle']);
    const side = stepCrumbles(crumbles, freshCrumbles(crumbles), spawn(16, 5 * TILE)); // beside the first tile, same height
    expect(side.map((s) => s.phase)).toEqual(['idle', 'idle']);
  });

  it('Poncho falls when the tile goes and lands on the floor below', () => {
    let r = stepRun(standingRun(2), idle, level);
    r = run({ ...r, player: onTile(2), crumbles: [{ phase: 'warning', steps: 1 }, r.crumbles[1]!] }, idle, 1);
    expect(r.crumbles[0]!.phase).toBe('gone');
    r = run(r, idle, 2);
    expect(r.player.grounded).toBe(false);
    expect(r.player.y).toBeGreaterThan(5 * TILE);
    r = run(r, idle, 200);
    expect(r.player).toMatchObject({ grounded: true, y: 8 * TILE }); // lands on the floor below
  });

  it('a jump pressed up to 5 steps after the tile goes still works (0.1 s of coyote time), and not 6', () => {
    const jumpAfter = (k: number): number => stepRun(run(goneAt(), idle, k), { move: 0, jumpHeld: true }, level).player.vy;
    expect(goneAt().crumbles[0]!.phase).toBe('gone');
    expect(FORGIVENESS.coyoteSteps).toBe(6);
    expect(jumpAfter(5)).toBeLessThan(0); // rising
    expect(jumpAfter(6)).toBeGreaterThan(0); // already falling
  });
});

describe('GDD-WLD-05 crumbled tiles come back when a life is lost', () => {
  it('after a pit fall and the respawn, every tile is whole again', () => {
    let r: RunState = { ...startRun(level), crumbles: [{ phase: 'gone', steps: 0 }, { phase: 'warning', steps: 900 }] };
    r = { ...r, player: { ...spawn(8 * TILE + 8, 8 * TILE), grounded: false, y: 8 * TILE + 5 } };
    for (let i = 0; i < 300 && r.phase === 'playing'; i++) r = stepRun(r, idle, level);
    expect(r.phase).toBe('respawning');
    expect(phases(r)).toEqual(['gone', 'warning']); // still as they were during the wait
    r = run(r, idle, RESPAWN.delaySteps);
    expect(r.phase).toBe('playing');
    expect(r.crumbles).toEqual(freshCrumbles(crumbles));
  });

  it('walking left to right across the floor leaves them alone', () => {
    const r = run(startRun(level), right, 20);
    expect(phases(r)).toEqual(['idle', 'idle']);
  });
});
