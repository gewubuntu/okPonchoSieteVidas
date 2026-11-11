// GDD-WLD-15: vagonetas (mine carts). A rail is fixed in the level and is scenery to Poncho; a cart stands at its start until he lands in
// it, then rolls along it, away from its start, and stops at its buffer. Its floor is a one-way floor like a moving platform's (GDD-WLD-05),
// and a jump from a rolling cart keeps the cart's speed across (the carry rule, `movement.ts`). Where it is depends only on the steps since
// he landed in it. Pure logic, no Phaser (GDD-TEC-02).
import { CART, RUN, STEP, TILE } from '../config/tuning';
import { carryOn, landOn, standsOnPlatform, type PlatformPos } from './platform';
import type { PlayerState, World } from './movement';

/** How a stretch of rail's ground moves, in px down per px across in the way the cart rolls: level, a climb or a descent. */
const RISE = { level: 0, climb: -1, descent: 1 } as const;

/**
 * A stretch of rail `tiles` tile columns across: level, or a climb or a descent of 1 px per px across in the way the cart rolls.
 */
export interface RailSegment {
  readonly kind: keyof typeof RISE;
  readonly tiles: number;
}

/**
 * A rail: `x` is the px x of its start edge, `y` the y of its ground there (a floor's top). `dir` 1 rolls right, -1 left (every rule
 * mirrored). It ends in a buffer, or broken over a drop.
 */
export interface Rail {
  readonly x: number;
  readonly y: number;
  readonly dir: 1 | -1;
  readonly segments: readonly RailSegment[];
  readonly end: 'buffer' | 'broken';
}

/** A cart: standing at its start, rolling, or stopped at its buffer. `m` is the px across from the rail's start to the cart's middle. */
export interface CartState {
  readonly phase: 'waiting' | 'rolling' | 'stopped';
  readonly m: number;
}

const HALF = CART.width / 2;
/** Its speed across on each kind of segment: a slope rises or falls 1 px per px across, so across is the speed along it over sqrt(2). */
const ACROSS = { level: CART.speedLevel, climb: CART.speedUp / Math.SQRT2, descent: CART.speedDown / Math.SQRT2 } as const;

/** Every cart standing at its start, its back edge on the rail's start: at the level start and after a lost life (GDD-LIFE-02). */
export const freshCarts = (rails: readonly Rail[]): CartState[] => rails.map(() => ({ phase: 'waiting', m: HALF }));

/** How far across the rail runs from its start, in px. */
export const railLength = (rail: Rail): number => TILE * rail.segments.reduce((n, s) => n + s.tiles, 0);

/** The segment `m` px across from the rail's start lies in, and where it starts: a join belongs to the segment after it. */
function segmentAt(rail: Rail, m: number): { segment: RailSegment; start: number; y: number } {
  let start = 0;
  let y = rail.y;
  for (const segment of rail.segments.slice(0, -1)) {
    const end = start + segment.tiles * TILE;
    if (m < end) return { segment, start, y };
    y += RISE[segment.kind] * segment.tiles * TILE;
    start = end;
  }
  return { segment: rail.segments[rail.segments.length - 1]!, start, y };
}

/** The y of the rail's ground `m` px across from its start. */
export function railGround(rail: Rail, m: number): number {
  const { segment, start, y } = segmentAt(rail, m);
  return y + RISE[segment.kind] * (m - start);
}

/** The cart's speed across, in px/s along the way it rolls, for the segment its middle is in at `m`. */
export const cartSpeed = (rail: Rail, m: number): number => ACROSS[segmentAt(rail, m).segment.kind];

/** The cart's floor, the one-way surface he stands on: as wide as the cart, CART.floorPx over the rail's ground under its middle, flat on a slope too. */
export function cartFloor(rail: Rail, cart: CartState): PlatformPos {
  return { x: rail.x + rail.dir * cart.m - HALF, y: railGround(rail, cart.m) - CART.floorPx, w: CART.width };
}

/**
 * One step of every cart: a rolling one moves across by its speed for the segment its middle is in at the step's start. One whose middle
 * would reach `railLength - HALF` (its front edge at the rail's end) is put there and stops, at its buffer.
 */
export function rollCarts(rails: readonly Rail[], carts: readonly CartState[]): CartState[] {
  return carts.map((c, i) => {
    if (c.phase !== 'rolling') return c;
    const rail = rails[i]!;
    const m = c.m + cartSpeed(rail, c.m) * STEP;
    const last = railLength(rail) - HALF;
    return m >= last ? { phase: 'stopped', m: last } : { ...c, m };
  });
}

/** Poncho before a step: if he stands in a cart, it carries him to where it is after this step (`carryOn`, GDD-WLD-05's rule). */
export function carryOnCarts(player: PlayerState, rails: readonly Rail[], from: readonly CartState[], to: readonly CartState[], world: World): PlayerState {
  for (let i = 0; i < rails.length; i++) {
    const carried = carryOn(player, cartFloor(rails[i]!, from[i]!), cartFloor(rails[i]!, to[i]!), world);
    if (carried) return carried;
  }
  return player;
}

/** The cart, by its place in the level's list, whose floor Poncho stands on, or -1. */
const standingIn = (player: PlayerState, rails: readonly Rail[], carts: readonly CartState[]): number =>
  rails.findIndex((r, i) => standsOnPlatform(player, cartFloor(r, carts[i]!)));

/**
 * Poncho after a step, over the carts that moved from `from` to `to` in it: he lands in one he came down onto (`landOn`, GDD-WLD-05's
 * rule). In the air his `vx` is his speed in the world, so landing in a rolling cart he was not standing in at the step's start (`before`)
 * makes it his speed in the cart again: less the cart's speed across on this step.
 */
export function landInCarts(before: PlayerState, carried: PlayerState, stepped: PlayerState, rails: readonly Rail[], from: readonly CartState[], to: readonly CartState[], world: World): PlayerState {
  const was = standingIn(before, rails, from);
  for (let i = 0; i < rails.length; i++) {
    const landed = landOn(carried, stepped, cartFloor(rails[i]!, from[i]!), cartFloor(rails[i]!, to[i]!), world);
    if (!landed) continue;
    return i !== was && from[i]!.phase === 'rolling' ? { ...landed, vx: landed.vx - rails[i]!.dir * cartSpeed(rails[i]!, from[i]!.m) } : landed;
  }
  return stepped;
}

/**
 * The carry rule: on a step that started with Poncho standing in a rolling cart (`before`) and ends with him off the ground (`after`), he
 * keeps the cart's speed across on that step as `carry`, and his `vx` becomes his speed in the world: the cart's plus his own, which is
 * never above the cart's and at most RUN.maxSpeed under it.
 */
export function keepCarry(before: PlayerState, after: PlayerState, rails: readonly Rail[], carts: readonly CartState[]): PlayerState {
  const was = standingIn(before, rails, carts);
  if (was < 0 || carts[was]!.phase !== 'rolling' || after.grounded) return after;
  const rail = rails[was]!;
  const carry = rail.dir * cartSpeed(rail, carts[was]!.m);
  const own = rail.dir > 0 ? Math.min(0, Math.max(-RUN.maxSpeed, after.vx)) : Math.max(0, Math.min(RUN.maxSpeed, after.vx));
  return { ...after, vx: carry + own, carry };
}

/** A waiting cart on whose floor Poncho stands at the end of a step starts rolling: it first moves on the next step. */
export function boardCarts(rails: readonly Rail[], carts: readonly CartState[], player: PlayerState): CartState[] {
  return carts.map((c, i) => (c.phase === 'waiting' && standsOnPlatform(player, cartFloor(rails[i]!, c)) ? { ...c, phase: 'rolling' } : c));
}
