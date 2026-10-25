import { describe, expect, it } from 'vitest';
import { FORGIVENESS, HITBOX, TILE } from '../config/tuning';
import { spawn, step, type PlayerInput, type PlayerState } from './movement';
import { parseTiles } from './tilemap';

/** Holding jump keeps the jump from being cut short while rising. */
const hold: PlayerInput = { move: 0, jumpHeld: true };

// One block, column 5 row 3 (x 80 to 96, y 48 to 64), a floor at row 8 (y = 128), and a wide ceiling at row 3 on the right.
const world = parseTiles([
  '............',
  '............',
  '............',
  '.....#..####',
  '............',
  '............',
  '............',
  '............',
  '############',
  '############',
]);
const BLOCK = { left: 5 * TILE, right: 6 * TILE, bottom: 4 * TILE };

/** Rising towards the block with the head about to enter it: feet at 96.5, so the head (32 px up) is at 64.5 and moves up 4.9 px. */
const rising = (x: number): PlayerState => ({ ...spawn(x, 96.5), vy: -300, grounded: false, jumpWasHeld: true });

describe('GDD-MOV-03 corner correction', () => {
  it('is 4 px', () => {
    expect(FORGIVENESS.cornerPx).toBe(4);
  });

  it('nudges Poncho left around a block corner that clips his right side by 3 px, and he keeps rising', () => {
    const before = rising(BLOCK.left - HITBOX.width / 2 + 3); // his right edge is 3 px inside the block
    const after = step(before, hold, world);
    expect(after.x).toBeCloseTo(BLOCK.left - HITBOX.width / 2, 6); // right edge now at the block's left edge
    expect(after.vy).toBeLessThan(0); // the jump is not cut off
    expect(after.y).toBeLessThan(before.y); // and he moved up
  });

  it('nudges Poncho right around a corner that clips his left side by 3 px', () => {
    const before = rising(BLOCK.right + HITBOX.width / 2 - 3);
    const after = step(before, hold, world);
    expect(after.x).toBeCloseTo(BLOCK.right + HITBOX.width / 2, 6);
    expect(after.vy).toBeLessThan(0);
  });

  it('nudges by exactly the overlap, whatever it is up to 4 px', () => {
    for (const overlap of [0.5, 1, 2, 4]) {
      const after = step(rising(BLOCK.left - HITBOX.width / 2 + overlap), hold, world);
      expect(after.x).toBeCloseTo(BLOCK.left - HITBOX.width / 2, 6);
      expect(after.vy).toBeLessThan(0);
    }
  });

  it('does not nudge when he clips the corner by more than 4 px: he bumps his head', () => {
    const before = rising(BLOCK.left - HITBOX.width / 2 + 4.5);
    const after = step(before, hold, world);
    expect(after.x).toBe(before.x);
    expect(after.vy).toBe(0);
    expect(after.y).toBe(BLOCK.bottom + HITBOX.height); // stopped under the block
    const right = step(rising(BLOCK.right + HITBOX.width / 2 - 4.5), hold, world);
    expect(right.vy).toBe(0);
  });

  it('does not nudge when both sides are under blocks: a real ceiling', () => {
    // Under the wide ceiling on the right (x 128 to 192), spanning two of its tiles with his left edge 4 px short of
    // the end of the first (x 140 to 152). Shifting 4 px would clear the first tile, but he would still be under the next.
    const before = rising(9 * TILE - 4 + HITBOX.width / 2);
    const after = step(before, hold, world);
    expect(after.vy).toBe(0);
    expect(after.x).toBe(before.x);
    expect(after.y).toBe(BLOCK.bottom + HITBOX.height);
  });

  it('does not nudge when he is right under the middle of one block', () => {
    const before = rising(BLOCK.left + TILE / 2);
    const after = step(before, hold, world);
    expect(after.vy).toBe(0);
    expect(after.x).toBe(before.x);
  });

  it('only applies while rising: falling onto the corner of a block top lands, it is not nudged', () => {
    // Just above the block top (y 48), his right edge 3 px over its left end.
    const x = BLOCK.left - HITBOX.width / 2 + 3;
    const falling: PlayerState = { ...spawn(x, 46.5), vy: 100, grounded: false };
    expect(step(falling, hold, world)).toMatchObject({ x, y: 48, vy: 0, grounded: true });
  });

  it('lets a real jump go past a block corner it clips by 3 px', () => {
    // Stand on the floor 3 px to the left of the block's left edge and jump straight up: without the nudge his head
    // hits the block at feet y = 96 and he falls; with it he slides left around the corner and rises the full jump.
    let s = spawn(BLOCK.left - HITBOX.width / 2 + 3, 8 * TILE);
    let top = s.y;
    for (let i = 0; i < 60; i++) {
      s = step(s, { move: 0, jumpHeld: i < 40 }, world);
      top = Math.min(top, s.y);
    }
    expect(top).toBeLessThan(8 * TILE - 50); // a full jump is about 56 px, a bump at the block would stop at 32
  });
});
