import { describe, expect, it } from 'vitest';
import { CATORCE } from '../config/tuning';
import { LEVEL_3_4 } from '../levels/level3-4';
import { catorceActive, catorceBox, catorceCleared, catorcePhaseIndex, catorceStart, hitCatorce, moveCatorce, stepCatorce, type CatorceInput, type CatorceMode, type CatorceState, type FallingCart } from './catorce';
import type { Box } from './enemy';
import { spawn, type PlayerState } from './movement';

// GDD-BOS-04: La Catorce's fight, pure. The expected numbers are the GDD's and the plan's worked cases: her three phases' stops (80 and 400,
// 80 and 400, 32 and 448), speeds (80, 110, 150 px/s), rests (180, 60, 0 steps), a 30-step telegraph, and a leg from slam to slam of 450, 265
// and 197 steps (the first step of each phase's first leg is her start: she telegraphs at the right stop at step 0).
const DEF = LEVEL_3_4.catorce!;
/** Poncho far away on the floor, at the middle of the arena. */
const FAR: PlayerState = spawn(240, 224);
/** Poncho standing on home, across the join of its two tiles. */
const HOME: PlayerState = spawn(240, 160);

/** Her states after 0 (the start) to `n` steps of `moveCatorce`, with the steps that slammed. */
function drive(start: CatorceState, n: number, player: PlayerState = FAR): { states: CatorceState[]; slams: number[] } {
  const states = [start];
  const slams: number[] = [];
  for (let i = 1; i <= n; i++) {
    const { catorce, slam } = moveCatorce(DEF, states[i - 1]!, player);
    states.push(catorce);
    if (slam) slams.push(i);
  }
  return { states, slams };
}

/** She at x in `mode`, not armoured, `hits` taken, at the start of that mode. */
const posed = (mode: CatorceMode, x: number, hits: number, o: Partial<CatorceState> = {}): CatorceState => ({ ...catorceStart(DEF, hits), mode, x, armoured: false, dir: 1, ...o });
/** Phase 2, a step from her slam at the left stop (x 81, 1 px to run), with these home tiles. */
const arriving = (home: CatorceState['home']): CatorceState => ({ ...posed('charge', 81, 1, { dir: -1 }), home });
const step = (c: CatorceState, o: Partial<CatorceInput> = {}) => stepCatorce(DEF, c, { player: FAR, carts: [], fireballs: [], ...o });
/** A cart's box over her roof: 32 x 16, its middle at x, its bottom 3.1 px over her top. */
const cartAt = (x: number, ridden = false): FallingCart => ({ box: { x0: x - 16, x1: x + 16, y0: 179.1, y1: 195.1 }, ridden });
const cartBox: Box = cartAt(54.5).box;

describe('GDD-BOS-04 La Catorce', () => {
  it('GDD-BOS-04 catorce start: each phase at its right stop, telegraphing, armoured, facing left', () => {
    expect([0, 1, 2].map((h) => catorceStart(DEF, h).x)).toEqual([400, 400, 448]);
    for (const h of [0, 1, 2]) {
      expect(catorceStart(DEF, h), `hits ${h}`).toMatchObject({ hits: h, mode: 'telegraph', age: 0, dir: -1, armoured: true, home: [{ phase: 'idle' }, { phase: 'idle' }] });
    }
    expect([0, 1, 2, 3].map(catorcePhaseIndex)).toEqual([0, 1, 2, 2]);
  });

  it('GDD-BOS-04 catorce legs: slam to slam 450, 265 and 197 steps', () => {
    // [stop0, stop1, steps to run, slam steps, x at each slam] per phase.
    const phases = [
      { h: 0, stops: [80, 400], slams: [270, 720, 1170], at: [80, 400, 80] },
      { h: 1, stops: [80, 400], slams: [205, 470, 735], at: [80, 400, 80] },
      { h: 2, stops: [32, 448], slams: [197, 394, 591], at: [32, 448, 32] },
    ];
    for (const p of phases) {
      const { states, slams } = drive(catorceStart(DEF, p.h), p.slams[2]! + 5);
      expect(slams, `phase ${p.h + 1}`).toEqual(p.slams);
      p.slams.forEach((s, i) => expect(states[s]!.x, `phase ${p.h + 1} slam ${i}`).toBe(p.at[i]));
      expect(states.every((s) => s.x >= p.stops[0]! && s.x <= p.stops[1]!), `phase ${p.h + 1} stays between its stops`).toBe(true);
    }
  });

  it('GDD-BOS-04 catorce cycle: rest, telegraph, charge in that order and length', () => {
    const one = drive(catorceStart(DEF, 0), 500).states;
    for (let i = 270; i <= 449; i++) expect(one[i]!.mode, `step ${i}`).toBe('rest');
    for (let i = 450; i <= 479; i++) expect(one[i]!.mode, `step ${i}`).toBe('telegraph');
    expect(one[480]).toMatchObject({ mode: 'charge', age: 0, x: 80 });
    expect(one[481]!.mode).toBe('charge');
    expect(one[481]!.x).toBeCloseTo(80 + 4 / 3, 9);
    // Phase 3 never rests: she telegraphs from the step of her slam.
    const three = drive(catorceStart(DEF, 2), 450).states;
    for (let i = 197; i <= 226; i++) expect(three[i]!.mode, `step ${i}`).toBe('telegraph');
    expect(three[227]).toMatchObject({ mode: 'charge', age: 0, x: 32 });
    expect(three.some((s) => s.mode === 'rest')).toBe(false);
  });

  it('GDD-BOS-04 catorce armour ends on the step of her first slam', () => {
    const one = drive(catorceStart(DEF, 0), 800).states;
    for (let i = 0; i < 270; i++) expect(one[i]!.armoured, `step ${i}`).toBe(true);
    for (let i = 270; i <= 800; i++) expect(one[i]!.armoured, `step ${i}`).toBe(false);
    const three = drive(catorceStart(DEF, 2), 300).states;
    for (let i = 0; i < 197; i++) expect(three[i]!.armoured, `step ${i}`).toBe(true);
    for (let i = 197; i <= 300; i++) expect(three[i]!.armoured, `step ${i}`).toBe(false);
  });

  it('GDD-BOS-04 catorce dir flips at each slam and she faces her run', () => {
    const one = drive(catorceStart(DEF, 0), 800).states;
    for (let i = 0; i < 270; i++) expect(one[i]!.dir, `step ${i}`).toBe(-1);
    for (let i = 270; i < 720; i++) expect(one[i]!.dir, `step ${i}`).toBe(1);
    for (let i = 720; i <= 800; i++) expect(one[i]!.dir, `step ${i}`).toBe(-1);
  });

  it('GDD-BOS-04 catorce home tiles: her slam starts the tile on her side from phase 2, never his weight', () => {
    // Phase 2 with Poncho standing on home throughout (his weight must start nothing).
    const two = drive(catorceStart(DEF, 1), 2000, HOME).states;
    const phaseOf = (tile: 0 | 1) => (i: number) => two[i]!.home[tile]!.phase;
    for (let i = 0; i < 205; i++) expect(two[i]!.home, `step ${i}`).toEqual([{ phase: 'idle', steps: 0 }, { phase: 'idle', steps: 0 }]);
    expect(two[205]!.home[0]).toEqual({ phase: 'warning', steps: 30 });
    expect(two[206]!.home[0]).toEqual({ phase: 'warning', steps: 29 });
    expect(two[234]!.home[0]).toEqual({ phase: 'warning', steps: 1 });
    for (let i = 205; i <= 234; i++) expect(phaseOf(0)(i), `step ${i}`).toBe('warning');
    for (let i = 235; i <= 354; i++) expect(phaseOf(0)(i), `step ${i}`).toBe('gone');
    expect(two[235]!.home[0]).toEqual({ phase: 'gone', steps: 120 });
    expect(phaseOf(0)(355)).toBe('idle');
    for (let i = 470; i <= 499; i++) expect(phaseOf(1)(i), `step ${i}`).toBe('warning');
    for (let i = 500; i <= 619; i++) expect(phaseOf(1)(i), `step ${i}`).toBe('gone');
    expect(phaseOf(1)(620)).toBe('idle');
    expect(phaseOf(1)(469)).toBe('idle');
    expect(two.some((s) => s.home.every((t) => t.phase === 'gone'))).toBe(false);
    // Phase 1 has no cave-in: both tiles stay whole over 2000 steps with him standing on them.
    const one = drive(catorceStart(DEF, 0), 2000, HOME).states;
    expect(one.every((s) => s.home.every((t) => t.phase === 'idle'))).toBe(true);
    // Phase 3: her first slam, at x 32 (left of home's join at x 240), starts the left tile.
    const three = drive(catorceStart(DEF, 2), 400, HOME).states;
    expect(three[196]!.home[0]!.phase).toBe('idle');
    expect(three[197]!.home).toEqual([{ phase: 'warning', steps: 30 }, { phase: 'idle', steps: 0 }]);
    expect(three[394]!.home[1]).toEqual({ phase: 'warning', steps: 30 });
  });

  it('GDD-BOS-04 catorce home tile waits while Poncho is in it', () => {
    // A gone tile on its last step of return, Poncho's body box (x 226 to 238, y 138 to 170) across the left tile (x 224 to 240, y 160 to 176).
    const inside: PlayerState = { ...spawn(232, 170), grounded: false };
    const c = { ...posed('rest', 80, 1, { age: 0 }), home: [{ phase: 'gone' as const, steps: 1 }, { phase: 'idle' as const, steps: 0 }] };
    let s = moveCatorce(DEF, c, inside).catorce;
    expect(s.home[0]).toEqual({ phase: 'gone', steps: 0 });
    for (let i = 0; i < 20; i++) s = moveCatorce(DEF, s, inside).catorce;
    expect(s.home[0]!.phase).toBe('gone');
    // The first step he is clear, it is whole.
    expect(moveCatorce(DEF, s, FAR).catorce.home[0]!.phase).toBe('idle');
    // A box only sharing the tile's underside (his top at y 176) is clear.
    const under: PlayerState = { ...spawn(232, 208), grounded: false };
    expect(moveCatorce(DEF, c, under).catorce.home[0]!.phase).toBe('idle');
  });

  it('GDD-BOS-04 catorce home tile not idle: a slam starts nothing on a tile already warning or gone', () => {
    // Phase 2, a step from her slam at the left stop (x 81, 1 px to run): the left tile is already counting down and keeps its count.
    const warning = moveCatorce(DEF, arriving([{ phase: 'warning', steps: 10 }, { phase: 'idle', steps: 0 }]), FAR);
    expect(warning.slam).toBe(true);
    expect(warning.catorce.home).toEqual([{ phase: 'warning', steps: 9 }, { phase: 'idle', steps: 0 }]);
    const gone = moveCatorce(DEF, arriving([{ phase: 'gone', steps: 50 }, { phase: 'idle', steps: 0 }]), FAR);
    expect(gone.catorce.home).toEqual([{ phase: 'gone', steps: 49 }, { phase: 'idle', steps: 0 }]);
  });

  it('GDD-BOS-04 catorce hit: a falling cart not ridden off on her unarmoured is a hit', () => {
    const r = step(posed('rest', 80, 0), { carts: [{ box: cartBox, ridden: false }] });
    expect(r.hit).toBe(true);
    expect(r.catorce).toMatchObject({ mode: 'hurt', hits: 1, age: 0 });
    expect(r.broken).toEqual([true]);
  });

  it('GDD-BOS-04 catorce no hit: armoured, hurt, defeated or ridden off, and the cart still breaks on her', () => {
    const cases: [string, CatorceState, boolean][] = [
      ['armoured', posed('rest', 80, 0, { armoured: true }), false],
      ['hurt', posed('hurt', 80, 1), false],
      ['defeated', posed('defeated', 80, 3), false],
      ['ridden off', posed('rest', 80, 0), true],
    ];
    for (const [name, c, ridden] of cases) {
      const r = step(c, { carts: [{ box: cartBox, ridden }] });
      expect(r.hit, name).toBe(false);
      expect(r.catorce.hits, name).toBe(c.hits);
      expect(r.broken, name).toEqual([true]);
    }
  });

  it('GDD-BOS-04 catorce a cart sharing only an edge does not touch her', () => {
    const side = step(posed('rest', 80, 0), { carts: [{ box: { x0: 112, x1: 144, y0: 179.1, y1: 195.1 }, ridden: false }] });
    expect(side).toMatchObject({ hit: false, broken: [false] });
    const roof = step(posed('rest', 80, 0), { carts: [{ box: { x0: 40, x1: 72, y0: 176, y1: 192 }, ridden: false }] });
    expect(roof).toMatchObject({ hit: false, broken: [false] });
    // And a rail's cart that is not falling is null: nothing breaks.
    expect(step(posed('rest', 80, 0), { carts: [null, null] }).broken).toEqual([false, false]);
  });

  it('GDD-BOS-04 catorce two scoring carts on one step are one hit', () => {
    const r = step(posed('rest', 80, 0), { carts: [{ box: cartBox, ridden: false }, cartAt(100)] });
    expect(r.catorce.hits).toBe(1);
    expect(r.broken).toEqual([true, true]);
  });

  it('GDD-BOS-04 catorce hurt 60 steps, then the next phase where she stands, telegraphing, armoured, toward the farther stop', () => {
    const after = (hits: number, x: number): CatorceState[] => drive(hitCatorce(posed('charge', x, hits - 1)), 60).states;
    const left = after(1, 80);
    expect(left[0]).toMatchObject({ mode: 'hurt', hits: 1, age: 0 });
    for (let i = 1; i <= 59; i++) {
      expect(left[i], `step ${i}`).toMatchObject({ mode: 'hurt', x: 80 });
      expect(catorceActive(left[i]!)).toBe(false);
    }
    expect(left[60]).toMatchObject({ mode: 'telegraph', age: 0, armoured: true, dir: 1, x: 80 });
    expect(after(1, 400)[60]).toMatchObject({ mode: 'telegraph', armoured: true, dir: -1, x: 400 });
    expect(after(2, 80)[60]).toMatchObject({ mode: 'telegraph', armoured: true, dir: 1, x: 80, hits: 2 });
    // Her home tiles keep their states.
    const keeps = drive({ ...hitCatorce(posed('charge', 80, 0)), home: [{ phase: 'gone', steps: 70 }, { phase: 'idle', steps: 0 }] }, 59, HOME).states[59]!;
    expect(keeps.home[0]).toEqual({ phase: 'gone', steps: 11 });
  });

  it('GDD-BOS-04 catorce defeat: the third hit, cleared 60 steps later', () => {
    // The second hit only leaves her hurt; the third defeats her.
    expect(step(posed('rest', 80, 1), { carts: [{ box: cartBox, ridden: false }] }).catorce).toMatchObject({ mode: 'hurt', hits: 2 });
    const r = step(posed('rest', 80, 2), { carts: [{ box: cartBox, ridden: false }] });
    expect(r.hit).toBe(true);
    expect(r.catorce).toMatchObject({ mode: 'defeated', hits: 3, age: 0 });
    const { states } = drive(r.catorce, 60);
    expect(catorceCleared(states[0]!)).toBe(false);
    expect(catorceCleared(states[59]!)).toBe(false);
    expect(catorceCleared(states[60]!)).toBe(true);
    expect(states[60]!.age).toBe(CATORCE.defeatSteps);
    // Her touch is none while she is defeated or hurt, Poncho's hurtbox on her.
    const on: PlayerState = spawn(80, 224);
    expect(step(states[30]!, { player: on }).touch).toBeUndefined();
    expect(step(posed('hurt', 80, 1), { player: on }).touch).toBeUndefined();
  });

  it("GDD-BOS-04 catorce touch: Poncho's box on hers is a touch, a shared edge is not", () => {
    // Her box is x 48 to 112; his hurtbox is 10 px wide, so at x 43 it ends at 48.
    expect(step(posed('rest', 80, 0), { player: spawn(43, 224) }).touch).toBeUndefined();
    expect(step(posed('rest', 80, 0), { player: spawn(44, 224) }).touch).toBe(80);
    // Armoured or not, she is a touch. His hurtbox ends 1 px over his feet, so with his feet at y 193 it shares her roof's edge (y 192).
    expect(step(posed('rest', 80, 0, { armoured: true }), { player: spawn(80, 194) }).touch).toBe(80);
    expect(step(posed('rest', 80, 0), { player: spawn(80, 193) }).touch).toBeUndefined();
    expect(catorceBox(DEF, posed('rest', 80, 0))).toEqual({ x0: 48, x1: 112, y0: 192, y1: 224 });
  });

  it('GDD-BOS-04 catorce fireball used up on her, nothing else', () => {
    const fireball: Box = { x0: 100, x1: 108, y0: 200, y1: 208 };
    const near: Box = { x0: 112, x1: 120, y0: 200, y1: 208 };
    const r = step(posed('rest', 80, 0), { fireballs: [fireball, near] });
    expect(r.spent).toEqual([true, false]);
    expect(r.catorce.hits).toBe(0);
    expect(r.hit).toBe(false);
    expect(step(posed('defeated', 80, 3), { fireballs: [fireball] }).spent).toEqual([false]);
  });
});
