// GDD-WLD-15: vagonetas (mine carts). A rail is fixed in the level and is scenery to Poncho; a cart stands at its start until he lands in
// it, then rolls along it, away from its start, and stops at its buffer. Its floor is a one-way floor like a moving platform's (GDD-WLD-05)
// that follows the rail: under each point of the cart it is CART.floorPx over the rail's ground there, so a rider anywhere in it, on a
// slope or across a join, stands 8 px over the rail under his own feet. A jump from a rolling cart keeps the cart's speed across (the carry rule, `movement.ts`). Where it is depends only on the steps since
// he landed in it. Pure logic, no Phaser (GDD-TEC-02).
import { CART, HITBOX, RUN, STEP, TILE } from '../config/tuning';
import { carryOn, landOn, standsOnPlatform, type PlatformPos } from './platform';
import { blocked, type PlayerState, type World } from './movement';

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

/** The cart's floor under its middle: as wide as the cart, its top CART.floorPx over the rail's ground under the middle. */
export function cartFloor(rail: Rail, cart: CartState): PlatformPos {
  return floorUnder(rail, cart, rail.x + rail.dir * cart.m);
}

/**
 * The cart's floor under the point `x`: as wide as the cart, its top CART.floorPx over the rail's ground under `x` (read at the rail's
 * nearer end past either end), so the floor follows the rail. This is the surface a Poncho whose feet's middle is at `x` stands on.
 */
export function floorUnder(rail: Rail, cart: CartState, x: number): PlatformPos {
  const across = Math.min(railLength(rail), Math.max(0, rail.dir * (x - rail.x)));
  return { x: rail.x + rail.dir * cart.m - HALF, y: railGround(rail, across) - CART.floorPx, w: CART.width };
}

/** Is Poncho standing in the cart: grounded, feet on its floor under them, body box over it? */
const standsIn = (player: PlayerState, rail: Rail, cart: CartState): boolean => standsOnPlatform(player, floorUnder(rail, cart, player.x));

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

/**
 * Poncho before a step: if he stands in a cart, it carries him to where it is after this step (`carryOn`, GDD-WLD-05's rule): across by its
 * move, and up or down from the floor under his feet to the floor under them after that move. Across first can catch the corner of his box
 * on the ground at a climb's top and leave him behind; the cart's walls put him back in it in the same step (`holdInCarts`, L-025).
 */
export function carryOnCarts(player: PlayerState, rails: readonly Rail[], from: readonly CartState[], to: readonly CartState[], world: World): PlayerState {
  for (let i = 0; i < rails.length; i++) {
    const rail = rails[i]!;
    const moved = player.x + rail.dir * (to[i]!.m - from[i]!.m);
    // The floor under him after the move: his y is set again in the same step by `landOn` or `stayOn`, which read it there (L-025).
    const carried = carryOn(player, floorUnder(rail, from[i]!, player.x), floorUnder(rail, to[i]!, moved), world);
    if (carried) return carried;
  }
  return player;
}

/** The cart, by its place in the level's list, whose floor Poncho stands on, or -1. */
const standingIn = (player: PlayerState, rails: readonly Rail[], carts: readonly CartState[]): number => rails.findIndex((r, i) => standsIn(player, r, carts[i]!));

/**
 * Poncho after a step, over the carts that moved from `from` to `to` in it: he lands in one he came down onto (`landOn`, GDD-WLD-05's
 * rule), on the floor under the x he comes down at. One he stood in at the step's start (`before`) keeps him on its floor under his feet
 * while he does not rise and his body box is still over it, so walking in it where the floor falls away (on a descent) does not lift him
 * off it. In the air his `vx` is his speed in the world, so landing in a rolling cart he was not standing in makes it his speed in the cart
 * again: less the cart's speed across on this step.
 */
export function landInCarts(before: PlayerState, carried: PlayerState, stepped: PlayerState, rails: readonly Rail[], from: readonly CartState[], to: readonly CartState[], world: World): PlayerState {
  const was = standingIn(before, rails, from);
  for (let i = 0; i < rails.length; i++) {
    const rail = rails[i]!;
    const under = floorUnder(rail, to[i]!, stepped.x);
    const landed = landOn(carried, stepped, floorUnder(rail, from[i]!, carried.x), under, world) ?? (i === was ? stayOn(stepped, under, world) : null);
    if (!landed) continue;
    return i !== was && from[i]!.phase === 'rolling' ? { ...landed, vx: landed.vx - rail.dir * cartSpeed(rail, from[i]!.m) } : landed;
  }
  return stepped;
}

/**
 * A rider who stood on the floor and does not rise stays on it under his feet, also where it has fallen away under them, if his body box
 * is over it and nothing solid is in the way. (A floor at or over his feet is `landOn`'s, which comes first, so no test of which side of
 * his feet the floor is on is needed here, L-025.)
 */
function stayOn(stepped: PlayerState, floor: PlatformPos, world: World): PlayerState | null {
  const over = stepped.x + HITBOX.width / 2 > floor.x && stepped.x - HITBOX.width / 2 < floor.x + floor.w;
  if (stepped.vy < 0 || !over || blocked(world, stepped.x, floor.y)) return null;
  return { ...stepped, y: floor.y, vy: 0, grounded: true };
}

/** How far from a cart's middle its walls hold a rider: his body box inside its box. */
const HOLD = CART.width / 2 - HITBOX.width / 2;

/**
 * A rolling cart's walls hold its rider: standing on its floor at the end of a step (he did not jump), he is at most HOLD px from its middle
 * either way. A step that left him further out (walking, sliding, or landing with his box partly over it) puts him at that limit, on the
 * floor under his new x, with his speed in the cart 0; but not if a solid tile is in the way there (a low beam still takes him out). A
 * waiting cart he stands in starts rolling at this step's end, so it holds him from the landing step; a stopped one holds nobody. `carts`
 * are the carts after this step's roll.
 */
export function holdInCarts(player: PlayerState, rails: readonly Rail[], carts: readonly CartState[], world: World): PlayerState {
  const i = standingIn(player, rails, carts);
  if (i < 0 || carts[i]!.phase === 'stopped') return player;
  const rail = rails[i]!;
  const middle = rail.x + rail.dir * carts[i]!.m;
  const off = player.x - middle;
  if (Math.abs(off) <= HOLD) return player;
  const x = middle + Math.sign(off) * HOLD;
  const y = floorUnder(rail, carts[i]!, x).y;
  return blocked(world, x, y) ? player : { ...player, x, y, vx: 0 };
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
  return carts.map((c, i) => (c.phase === 'waiting' && standsIn(player, rails[i]!, c) ? { ...c, phase: 'rolling' } : c));
}
