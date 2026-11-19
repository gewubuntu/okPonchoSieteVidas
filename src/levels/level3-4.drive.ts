// GDD-BOS-04: the shared drivers of 3-4's tests (`level3-4.moves.test.ts`, `level3-4.bot.test.ts`): the run Poncho starts from, the two sides of the
// arena by name, where he stands, and the floor-free bot's tasks (`bots.ts`). Pure, no Phaser; test support only, as `level3-3.drive.ts` is for 3-3.
import type { PlayerInput, PlayerState } from '../sim/movement';
import { startRun, type RunState } from '../sim/run';
import { waitFor, type Ctl } from './bots';
import { LEVEL_3_4 } from './level3-4';

/** A fresh run of 3-4 with Poncho on home and no protection. */
export const base = (): RunState => startRun(LEVEL_3_4);
/** The same, protected by the Chile Fantasma for far longer than any test: a move measured with nothing ending it, which a test names "unhurt". */
export const unhurt = (): RunState => ({ ...base(), fantasma: 1e9 });

/** One side of the arena: the rail's place in the level's list (and its cart's in a run's `carts`), and the way the cart rolls. Right is left mirrored about x = 240. */
export interface Side {
  readonly name: 'left' | 'right';
  readonly rail: 0 | 1;
  readonly dir: -1 | 1;
  /** The way home lies from this side's wall: the cart's way reversed. */
  readonly toHome: -1 | 1;
}
export const SIDES: readonly [Side, Side] = [
  { name: 'left', rail: 0, dir: -1, toHome: 1 },
  { name: 'right', rail: 1, dir: 1, toHome: -1 },
];
/** The x of the left side's `x` on `side`: mirrored about x = 240. */
export const onSide = (side: Side, x: number): number => (side.rail === 0 ? x : 480 - x);
/** The mirror image of `x`, rounded to a millionth of a pixel (the two sides' float sums differ below that). */
export const round6 = (x: number): number => Math.round(x * 1e6) / 1e6;

/** Poncho standing in `side`'s cart at its middle, the cart rolling at m 16: how `boardCarts` leaves a cart he landed in. */
export function inCartRun(from: RunState, side: Side): RunState {
  const x = onSide(side, 192);
  return { ...from, player: { ...from.player, x, y: 120, vx: 0, vy: 0, grounded: true }, carts: from.carts.map((c, i) => (i === side.rail ? { phase: 'rolling' as const, m: 16 } : c)) };
}

/** Where he stands, by the floor's height: the perch (96), the cart's floor (120), home (160), the floor (224); undefined in the air. */
export function ground(p: PlayerState): 'perch' | 'cart' | 'home' | 'floor' | undefined {
  if (!p.grounded) return undefined;
  switch (p.y) {
    case 96:
      return 'perch';
    case 120:
      return 'cart';
    case 160:
      return 'home';
    case 224:
      return 'floor';
  }
  return undefined;
}

const idle: PlayerInput = { move: 0, jumpHeld: false };

/**
 * The step on which the left cart's landing opens, worked from the measured windows of `level3-4.windows.test.ts` and the jump's 27 steps (`level3-4.moves.test.ts`,
 * the jump from home lands in the cart on its step 27): a hit needs the cart boarded from 71 before her slam to 171 after (phase 1), 67 before to 47 after (2) and
 * 83 before to 3 after (3), so the press may come from 98 before to 144 after (phase 1), from 94 before to 20 after (2) and from 110 before to 24 before (3).
 * - Phase 1 (hits 0): she rests at the left stop, not armoured: the rest's step `age` counts from her slam, so the press is good from age 0 to 144; age 140 is
 *   taken (the plan's figure, 4 steps of margin on the 144).
 * - Phase 2 (hits 1): she charges left and is not armoured (she came from the right stop's slam): she passes x = 240 at 88 steps before her slam (160 px at 110 px/s,
 *   1.8333 px a step), so a press then lands 61 before, inside the 67; the press is good until her slam and 20 steps after, so any x from 240 down to her stop is in.
 * - Phase 3 (hits 2): the same charge left at 150 px/s (2.5 px a step): she passes x = 240 at 84 steps before her slam (208 px) and lands 57 before (inside the
 *   83); at x = 100 she is (100 - 32) / 2.5 = 27.2 steps from the slam, and the landing 27 after the press is at the slam, inside the 3 after. Under x = 100 the
 *   landing falls after the window (x = 60: 11 steps before the slam, 16 after: outside, the window ends 3 after), so the condition stops at 100.
 * The cart must also stand (`waiting`): a cart still on its way back is no landing. A left cart only (the plan's bot plays one side).
 */
export function windowOpen(r: RunState): boolean {
  const c = r.catorce;
  if (!c || r.carts[0]!.phase !== 'waiting' || c.armoured) return false;
  switch (c.hits) {
    case 0:
      return c.mode === 'rest' && c.x === 80 && c.age <= 140;
    case 1:
      return c.mode === 'charge' && c.dir === -1 && c.x <= 240;
    case 2:
      return c.mode === 'charge' && c.dir === -1 && c.x >= 100 && c.x <= 240;
  }
  return false;
}

/**
 * Task 1: waits on home, holding nothing, until `windowOpen` and he stands on it with jump up (L-048). If the tile under him is in warning or gone and the other
 * is idle, he walks onto the other's middle (x = 232 for tile 0, 248 for tile 1): the two are never gone together.
 */
export function waitOnHome(): Ctl {
  return (r) => {
    const p = r.player;
    if (p.grounded && p.y === 160 && !p.jumpWasHeld && windowOpen(r)) return { input: idle, done: true };
    const home = r.catorce!.home;
    const under = p.x < 240 ? 0 : 1;
    if (home[under]!.phase !== 'idle' && home[1 - under]!.phase === 'idle') {
      const to = under === 0 ? 248 : 232;
      return { input: { move: Math.abs(to - p.x) > 2 ? Math.sign(to - p.x) : 0, jumpHeld: false }, done: false };
    }
    return { input: idle, done: false };
  };
}

/** Task 2: jump pressed and held while rising, moving left from the press until he lands (in the cart: it boards). */
export function jumpIntoCart(): Ctl {
  let pressed = false;
  let air = false;
  return (r) => {
    const p = r.player;
    if (!pressed) {
      pressed = true;
      return { input: { move: -1, jumpHeld: true }, done: false };
    }
    if (!p.grounded) air = true;
    return { input: { move: -1, jumpHeld: p.vy < 0 }, done: air && p.grounded };
  };
}

/**
 * Task 3: rides with no input until the cart's `m` is 16 + 2.5 x 23 = 73.5, so the press is ride step 24 (inside the plain jump's takeoffs that land on the
 * perch, steps 20 to 31 of the ride, `level3-4.moves.test.ts`), then the plain jump out: pressed, held while rising, moving left until he stands on the perch.
 */
export const RIDE_UNTIL = 73.5;
export function rideAndJumpOut(): Ctl {
  let pressed = false;
  let air = false;
  return (r) => {
    const p = r.player;
    if (!pressed) {
      if (r.carts[0]!.m < RIDE_UNTIL) return { input: idle, done: false };
      pressed = true;
      return { input: { move: -1, jumpHeld: true }, done: false };
    }
    if (!p.grounded) air = true;
    return { input: { move: -1, jumpHeld: p.vy < 0 }, done: air && p.grounded };
  };
}

/**
 * Task 4: as soon as he stands still on the perch (the tile warns 0.5 s), jump held and moving right; jump let go when his middle passes x = 200, moving on until his middle is at
 * least x = 236, then still; done when he stands again, on home.
 */
export function glideHome(): Ctl {
  let pressed = false;
  let air = false;
  let released = false;
  return (r) => {
    const p = r.player;
    if (!pressed) {
      // He lands from the ride with the cart's carried speed (-150 px/s) and slides to a stop (59.4 to 48.1, 9 steps, `level3-4.bot.test.ts`); a jump from the slide
      // would start leftwards, so he stands first (the tile has 30 steps of warning).
      if (!p.grounded || p.jumpWasHeld || p.vx !== 0) return { input: idle, done: false };
      pressed = true;
      return { input: { move: 1, jumpHeld: true }, done: false };
    }
    if (!p.grounded) air = true;
    if (air && p.grounded) return { input: idle, done: true };
    if (p.x >= 200) released = true;
    return { input: { move: p.x >= 236 ? 0 : 1, jumpHeld: !released }, done: false };
  };
}

/** The tasks for `hits` hits: wait, go, ride, glide home, each in turn, then wait for the level's clear. */
export function fightTasks(hits = 3): Ctl[] {
  const tasks: Ctl[] = [];
  for (let i = 0; i < hits; i++) tasks.push(waitOnHome(), jumpIntoCart(), rideAndJumpOut(), glideHome());
  tasks.push(waitFor(() => false));
  return tasks;
}

/** The fight started after `w` idle steps on home. */
export const fightFrom = (w: number): Ctl[] => {
  let n = 0;
  return [waitFor(() => n++ >= w), ...fightTasks()];
};
