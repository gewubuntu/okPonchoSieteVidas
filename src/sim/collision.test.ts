import { describe, expect, it } from 'vitest';
import { HITBOX, TILE } from '../config/tuning';
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

  it('a running jump crosses a gap 3 tiles wide, the limit for World 1', () => {
    expect(crossesGap(3)).toBe(true);
  });

  it('a running jump cannot cross a gap 6 tiles wide', () => {
    expect(crossesGap(6)).toBe(false);
  });
});
