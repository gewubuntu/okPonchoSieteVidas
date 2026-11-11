import { describe, expect, it } from 'vitest';
import { CART, TILE } from '../config/tuning';
import { cartFloor, railLength } from '../sim/cart';
import { spawn, type PlayerInput } from '../sim/movement';
import { standsOnPlatform } from '../sim/platform';
import { startRun, stepRun, type RunState } from '../sim/run';
import { levelById } from './index';
import { LAB_3C_FLOOR_Y, LAB_3C_ID, LAB_3C_LEVEL, LAB_3C_OFRENDAS, LAB_3C_PLATEAU, LAB_3C_RAILS } from './lab3c';
import { validateLevel } from './validate';

// GDD-WLD-15, GDD-TEC-04: lab-3c, over the real level data (L-014). Positions are read from `src/levels/lab3c.ts`.
const level = LAB_3C_LEVEL;
const idle: PlayerInput = { move: 0, jumpHeld: false };
const PLATEAU_Y = LAB_3C_PLATEAU.row * TILE;

const floorOf = (r: RunState, i: number) => cartFloor(LAB_3C_RAILS[i]!, r.carts[i]!);
const middleOf = (r: RunState, i: number) => floorOf(r, i).x + CART.width / 2;
const inCart = (r: RunState, i: number) => standsOnPlatform(r.player, floorOf(r, i));
/** A run with Poncho standing at (x, y). */
const at = (x: number, y: number): RunState => ({ ...startRun(level), player: spawn(x, y) });

/**
 * A bot that rides cart `i`: on the ground it walks towards the cart's middle and, 20 to 60 px from it, jumps (held while rising) and
 * steers over the middle; once the cart rolls it stands still, and once it has stopped it walks off its front. It lets go of jump for at
 * least a step before pressing it again (L-048). The states of every step, until he stands on the ground past the cart's front, at most `max`.
 */
function ride(r: RunState, i: number, max = 600): RunState[] {
  const rail = LAB_3C_RAILS[i]!;
  const states: RunState[] = [];
  let jumpWas = false;
  for (let n = 0; n < max; n++) {
    const p = r.player;
    const cart = r.carts[i]!;
    let input = idle;
    if (cart.phase === 'waiting') {
      const gap = middleOf(r, i) - p.x;
      const move = Math.abs(gap) > 4 ? Math.sign(gap) : 0;
      const jump = p.grounded ? !jumpWas && Math.abs(gap) >= 20 && Math.abs(gap) <= 60 : jumpWas && p.vy < 0;
      input = { move, jumpHeld: jump };
    } else if (cart.phase === 'stopped') {
      const front = floorOf(r, i).x + (rail.dir > 0 ? CART.width : 0);
      if (p.grounded && !inCart(r, i) && (p.x - front) * rail.dir > 6) return states;
      input = { move: rail.dir, jumpHeld: false };
    }
    jumpWas = input.jumpHeld;
    r = stepRun(r, input, level);
    states.push(r);
  }
  return states;
}

describe('GDD-WLD-15 lab-3c', () => {
  it('GDD-TEC-04 lab-3c passes the validator', () => {
    const entry = levelById(LAB_3C_ID)!;
    expect(entry).toMatchObject({ world: 3, test: true });
    expect(validateLevel(entry)).toEqual([]);
  });

  it('GDD-WLD-15 lab-3c has four rails', () => {
    expect(LAB_3C_RAILS.map((r) => ({ dir: r.dir, end: r.end, segments: r.segments.map((s) => `${s.kind} ${s.tiles}`) }))).toEqual([
      { dir: 1, end: 'buffer', segments: ['level 20'] },
      { dir: 1, end: 'buffer', segments: ['level 4', 'climb 4', 'level 4'] },
      { dir: 1, end: 'buffer', segments: ['level 2', 'descent 4', 'level 3'] },
      { dir: -1, end: 'buffer', segments: ['level 8'] },
    ]);
    // R1, R2 and R4 start on the floor, R3 on the plateau's top; R2 ends on it (4 tiles up) and R3 on the floor (4 tiles down).
    expect(LAB_3C_RAILS.map((r) => r.y)).toEqual([LAB_3C_FLOOR_Y, LAB_3C_FLOOR_Y, PLATEAU_Y, LAB_3C_FLOOR_Y]);
    expect(LAB_3C_FLOOR_Y - PLATEAU_Y).toBe(64);
    expect(LAB_3C_RAILS[1]!.x + 8 * TILE).toBe(LAB_3C_PLATEAU.col0 * TILE); // R2's climb ends at the plateau's left edge
    expect(LAB_3C_RAILS[2]!.x + 2 * TILE).toBe((LAB_3C_PLATEAU.col1 + 1) * TILE); // R3's descent starts at its right edge
    expect(startRun(level).carts).toEqual(LAB_3C_RAILS.map(() => ({ phase: 'waiting', m: 16 })));
  });

  it('GDD-WLD-15 lab-3c R1: a bot hops in and rides 20 tiles to the buffer', () => {
    const states = ride(startRun(level), 0);
    const boarded = states.findIndex((s) => s.carts[0]!.phase === 'rolling');
    const stopped = states.findIndex((s) => s.carts[0]!.phase === 'stopped');
    expect(boarded).toBeGreaterThan(0);
    // 20 tiles less the cart's 2: 18 tiles (288 px) at 150 px/s, 2.5 px a step: 115.2 steps, so it stops on the 116th after the landing.
    expect(stopped - boarded).toBe(116);
    expect(states[stopped]!.carts[0]!.m).toBe(20 * TILE - 16);
    expect(states.slice(boarded, stopped + 1).every((s) => inCart(s, 0))).toBe(true);
    expect(states[states.length - 1]!.player).toMatchObject({ grounded: true, y: LAB_3C_FLOOR_Y });
  });

  it('GDD-WLD-15 lab-3c R2 carries him up the plateau no jump reaches', () => {
    // Without the cart: a running full jump at the plateau's 64 px wall from the floor before it lands back on the floor.
    let r = at(LAB_3C_RAILS[1]!.x + 4 * TILE, LAB_3C_FLOOR_Y);
    let top = Infinity;
    for (let n = 0; n < 120; n++) {
      r = stepRun(r, { move: 1, jumpHeld: n >= 20 && n < 60 }, level);
      if (r.player.grounded) top = Math.min(top, r.player.y);
    }
    expect(top).toBe(LAB_3C_FLOOR_Y);
    expect(r.player.x).toBeLessThan(LAB_3C_PLATEAU.col0 * TILE);
    // Riding R2 from the ofrenda before it, he ends standing on the plateau.
    const states = ride(at(LAB_3C_OFRENDAS[0]!.x, LAB_3C_OFRENDAS[0]!.y), 1);
    expect(states.some((s) => s.carts[1]!.phase === 'stopped')).toBe(true);
    expect(states[states.length - 1]!.player).toMatchObject({ grounded: true, y: PLATEAU_Y });
  });

  it('GDD-WLD-15 lab-3c R3 takes him back down', () => {
    const states = ride(at(LAB_3C_OFRENDAS[1]!.x, LAB_3C_OFRENDAS[1]!.y), 2);
    const last = states[states.length - 1]!;
    expect(last.carts[2]).toEqual({ phase: 'stopped', m: railLength(LAB_3C_RAILS[2]!) - 16 });
    expect(last.player).toMatchObject({ grounded: true, y: LAB_3C_FLOOR_Y });
  });

  it('GDD-WLD-15 lab-3c R4 rolls left to its buffer', () => {
    const r4 = LAB_3C_RAILS[3]!;
    const r = at(LAB_3C_OFRENDAS[2]!.x, LAB_3C_OFRENDAS[2]!.y);
    const start = middleOf(r, 3);
    const states = ride(r, 3);
    const stopped = states.find((s) => s.carts[3]!.phase === 'stopped')!;
    expect(stopped).toBeDefined();
    expect(middleOf(stopped, 3)).toBe(start - (railLength(r4) - CART.width));
    expect(floorOf(stopped, 3).x).toBe(r4.x - railLength(r4)); // its left edge at the rail's end
    expect(states[states.length - 1]!.player).toMatchObject({ grounded: true, y: LAB_3C_FLOOR_Y });
    expect(states[states.length - 1]!.player.x).toBeLessThan(floorOf(stopped, 3).x);
  });

  it('GDD-WLD-15 lab-3c a full jump from R1\'s cart lands back in it', () => {
    let r = ride(startRun(level), 0).find((s) => s.carts[0]!.phase === 'rolling')!;
    expect(r).toBeDefined();
    // Jump let go, and his speed in the cart down to 0 after the hop's landing.
    for (let n = 0; n < 30 && (n < 3 || r.player.vx !== 0); n++) r = stepRun(r, idle, level);
    expect(r.player.vx).toBe(0);
    const offset = r.player.x - middleOf(r, 0);
    r = stepRun(r, { move: 0, jumpHeld: true }, level);
    expect(r.player.grounded).toBe(false);
    for (let n = 0; n < 100 && !r.player.grounded; n++) r = stepRun(r, { move: 0, jumpHeld: true }, level);
    expect(inCart(r, 0)).toBe(true);
    expect(r.carts[0]!.phase).toBe('rolling');
    expect(r.player.x - middleOf(r, 0)).toBeCloseTo(offset, 6);
  });
});
