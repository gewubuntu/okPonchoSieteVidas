import { describe, expect, it } from 'vitest';
import { GRAVITY, HITBOX, JUMP, RUN, STEP, TILE } from '../config/tuning';
import { spawn, step, type PlayerInput, type PlayerState, type World } from './movement';
import { parseTiles } from './tilemap';

const idle: PlayerInput = { move: 0, jumpHeld: false };
const right: PlayerInput = { move: 1, jumpHeld: false };

const run = (s: PlayerState, input: PlayerInput | ((i: number) => PlayerInput), steps: number, w: World): PlayerState => {
  for (let i = 0; i < steps; i++) s = step(s, typeof input === 'function' ? input(i) : input, w);
  return s;
};

/** Poncho standing on the top of the first solid row, in the middle of tile column tx. */
const standAt = (tx: number, floorRow: number): PlayerState => spawn(tx * TILE + TILE / 2, floorRow * TILE);

/**
 * Runs right for `runSteps`, then holds jump while still running right, for `airSteps` more.
 * Returns every state visited so a test can ask what happened on the way.
 */
function runAndJump(w: World, start: PlayerState, runSteps: number, airSteps: number): PlayerState[] {
  const states: PlayerState[] = [];
  let s = start;
  for (let i = 0; i < runSteps + airSteps; i++) {
    s = step(s, { move: 1, jumpHeld: i >= runSteps }, w);
    states.push(s);
  }
  return states;
}

describe('GDD-TEC-04 tile grid', () => {
  it('reads # as solid and . as empty', () => {
    const g = parseTiles(['..#', '###']);
    expect([g.solidTile(2, 0), g.solidTile(0, 0), g.solidTile(1, 1)]).toEqual([true, false, true]);
  });

  it('closes the left and right edges, opens the sky and leaves the bottom open', () => {
    const g = parseTiles(['...', '###']);
    expect([g.solidTile(-1, 0), g.solidTile(3, 0), g.solidTile(1, -5), g.solidTile(1, 9)]).toEqual([true, true, false, false]);
  });

  it('rejects ragged or unknown rows', () => {
    expect(() => parseTiles(['..', '...'])).toThrow(/Tile row 1/);
    expect(() => parseTiles(['.x'])).toThrow(/other than/);
  });
});

describe('GDD-MOV-06 floors, walls and ceilings', () => {
  const flat = parseTiles(['..........', '..........', '##########']);

  it('stands on a floor tile and stays grounded', () => {
    const s = run(standAt(2, 2), idle, 120, flat);
    expect(s.grounded).toBe(true);
    expect(s.y).toBe(2 * TILE);
  });

  it('lands on top of a floor after a fall and does not sink in', () => {
    const s = run({ ...standAt(2, 2), y: -80, grounded: false }, idle, 200, flat);
    expect(s).toMatchObject({ grounded: true, y: 2 * TILE, vy: 0 });
  });

  it('is stopped by a wall and stands against its face', () => {
    const w = parseTiles(['.......#..', '.......#..', '##########']);
    const s = run(standAt(1, 2), right, 240, w);
    expect(s.x).toBeCloseTo(7 * TILE - HITBOX.width / 2, 5);
    expect(s.vx).toBe(0);
  });

  it('is stopped by the left edge of the level', () => {
    const s = run(standAt(1, 2), { move: -1, jumpHeld: false }, 240, flat);
    expect(s.x).toBeCloseTo(HITBOX.width / 2, 5);
  });

  it('bumps its head on a ceiling and falls back', () => {
    const w = parseTiles(['..........', '...####...', '..........', '..........', '##########']);
    let s = run(standAt(4, 4), idle, 5, w);
    let highest = s.y;
    for (let i = 0; i < 60; i++) {
      s = step(s, { move: 0, jumpHeld: true }, w);
      highest = Math.min(highest, s.y);
    }
    // The ceiling's underside is at y = 32, so the feet stop at 32 + 14 and the head touches the underside.
    expect(highest).toBeCloseTo(2 * TILE + HITBOX.height, 5);
    expect(s.grounded).toBe(true);
  });

  it('fits through a gap exactly one tile high', () => {
    const w = parseTiles(['....########', '............', '############']);
    const s = run(standAt(1, 2), right, 300, w);
    expect(s.x).toBeCloseTo(12 * TILE - HITBOX.width / 2, 5); // walked the whole slot to the far wall
  });

  it('moves less than one tile per step at the fastest speed, so it cannot skip a tile', () => {
    const fastest = Math.max(JUMP.velocity, GRAVITY.terminalVelocity, RUN.maxSpeed);
    expect(fastest * STEP).toBeLessThan(TILE);
  });

  it('stands on a ledge until the body box fully leaves it, and falls the moment it does', () => {
    const w = parseTiles(['......', '......', '###...']); // floor under x < 48
    const leaving = (x: number) => step({ ...spawn(x, 2 * TILE) }, idle, w);
    expect(leaving(48 + HITBOX.width / 2 - 0.001)).toMatchObject({ grounded: true, y: 2 * TILE }); // overlaps by 0.001
    expect(leaving(48 + HITBOX.width / 2).grounded).toBe(false); // only touching the edge
  });

  it('pressed into a wall and ceiling corner stops flush against both', () => {
    const w = parseTiles(['########', '......#.', '......#.', '########']); // a 2-tile-high room
    let s = standAt(5, 3);
    let highest = s.y;
    for (let i = 0; i < 90; i++) {
      s = step(s, { move: 1, jumpHeld: i >= 5 }, w);
      highest = Math.min(highest, s.y);
    }
    expect(s.x).toBeCloseTo(6 * TILE - HITBOX.width / 2, 5); // flush with the wall
    expect(highest).toBeCloseTo(TILE + HITBOX.height, 5); // head flush with the ceiling's underside (y = 16)
  });

  it('does not stick to a wall it is pressed against: a jump still rises to full height', () => {
    const w = parseTiles(['.......', '.......', '.......', '.....#.', '.....#.', '#######']);
    const seen = runAndJump(w, standAt(1, 5), 60, 80); // runs into the wall first, then jumps while pressing right
    const highest = Math.min(...seen.map((s) => s.y));
    expect(5 * TILE - highest).toBeGreaterThan(54.5); // the same 56 px peak as a jump in the open (GDD-MOV-02)
  });

  it('never passes through a tile at terminal speed', () => {
    const w = parseTiles(['..........', '..........', '##########']);
    const s = run({ ...standAt(2, 2), y: -2000, grounded: false }, idle, 600, w);
    expect(s.y).toBe(2 * TILE);
  });
});

/** A flat floor with one wall `height` tiles high at column 8. */
const wallWorld = (height: number): World =>
  parseTiles([
    ...Array.from({ length: 7 - height }, () => '.'.repeat(14)),
    ...Array.from({ length: height }, () => `........#.....`.slice(0, 14)),
    '#'.repeat(14),
  ]);

/** A floor with a pit `gap` tiles wide starting at column 8. Returns whether a run-up and jump lands on the far side. */
const crossesGap = (gap: number): boolean => {
  const width = 8 + gap + 8;
  const floor = '#'.repeat(8) + '.'.repeat(gap) + '#'.repeat(8);
  const w = parseTiles([...Array.from({ length: 8 }, () => '.'.repeat(width)), floor]);
  const farEdge = (8 + gap) * TILE;
  for (let runSteps = 0; runSteps <= 70; runSteps++) {
    const states = runAndJump(w, standAt(1, 8), runSteps, 80);
    if (states.some((s) => s.grounded && s.y === 8 * TILE && s.x > farEdge)) return true;
  }
  return false;
};

/** Can any run-up and jump put Poncho on top of the wall? */
const canMantle = (height: number): boolean => {
  const w = wallWorld(height);
  const topY = (7 - height) * TILE;
  for (let runSteps = 0; runSteps <= 70; runSteps++) {
    const states = runAndJump(w, standAt(1, 7), runSteps, 80);
    if (states.some((s) => s.grounded && s.y === topY && s.x > 8 * TILE - HITBOX.width / 2)) return true;
  }
  return false;
};

describe('GDD-MOV-02 and GDD-WLD-03 against real tiles', () => {
  it('a full jump can reach the top of a wall 3 tiles high (48 px, peak is about 56 px)', () => {
    expect(canMantle(3)).toBe(true);
  });

  it('a full jump cannot reach the top of a wall 4 tiles high (64 px)', () => {
    expect(canMantle(4)).toBe(false);
  });

  it('a running jump crosses a gap 3 tiles wide, the limit for World 1, and up to 5 tiles', () => {
    expect([3, 4, 5].map(crossesGap)).toEqual([true, true, true]);
  });

  it('a running jump cannot cross a gap 6 tiles wide', () => {
    expect(crossesGap(6)).toBe(false);
  });
});
