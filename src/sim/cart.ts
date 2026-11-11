// GDD-WLD-15: vagonetas (mine carts). A rail is fixed in the level and is scenery to Poncho; a cart stands at its start until he lands in
// it, then rolls along it, away from its start, and stops at its buffer, or leaves a broken end and falls until it breaks; an empty one is
// back at its start 2.0 s after it reached its rail's end. Its floor is a one-way floor like a moving platform's (GDD-WLD-05)
// that follows the rail: under each point of the cart it is CART.floorPx over the rail's ground there, so a rider anywhere in it, on a
// slope or across a join, stands 8 px over the rail under his own feet. A jump from a rolling cart keeps the cart's speed across (the carry rule, `movement.ts`). Where it is depends only on the steps since
// he landed in it. Pure logic, no Phaser (GDD-TEC-02).
import { CART, GRAVITY, HITBOX, RUN, SPIKE, STEP, TILE } from '../config/tuning';
import type { Spike } from './hazards';
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

/**
 * A cart: standing at its start, rolling, stopped at its buffer, falling from a broken end, or gone (broken, or out of the level). `m` is the
 * px across from the rail's start to the cart's middle, also past a broken end while it falls.
 */
export interface CartState {
  readonly phase: 'waiting' | 'rolling' | 'stopped' | 'falling' | 'gone';
  readonly m: number;
  /** Falling: the y of its box's bottom, and its speeds down and across (px/s; across along the way it rolls). Left out otherwise. */
  readonly fall?: { readonly y: number; readonly vy: number; readonly vx: number };
  /** Stopped, falling or gone: the steps counted towards its return to its start (CART.returnSteps). Left out means 0. */
  readonly empty?: number;
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

/** The cart's floor under `x` (`floorUnder`) while it is on its rail; one that has left it (falling or gone) is no floor. */
const floorOf = (rail: Rail, cart: CartState, x: number): PlatformPos | null => (cart.phase === 'falling' || cart.phase === 'gone' ? null : floorUnder(rail, cart, x));

/** Is Poncho standing in the cart: grounded, feet on its floor under them, body box over it? */
function standsIn(player: PlayerState, rail: Rail, cart: CartState): boolean {
  const floor = floorOf(rail, cart, player.x);
  return floor !== null && standsOnPlatform(player, floor);
}

/** A falling cart's box, CART.width x CART.height: its left edge and top. Null for a cart that is not falling. */
export function fallingBox(rail: Rail, cart: CartState): { x: number; y: number; w: number; h: number } | null {
  if (cart.phase !== 'falling' || !cart.fall) return null;
  return { x: rail.x + rail.dir * cart.m - HALF, y: cart.fall.y - CART.height, w: CART.width, h: CART.height };
}

/**
 * GDD-WLD-15: a broken end's warning post, derived from the rail: CART.postTiles tiles across before its end, on the rail's ground there.
 * A buffer has none.
 */
export function warningPost(rail: Rail): { x: number; y: number } | null {
  if (rail.end !== 'broken') return null;
  const across = railLength(rail) - CART.postTiles * TILE;
  return { x: rail.x + rail.dir * across, y: railGround(rail, across) };
}

/**
 * One step of every cart: a rolling one moves across by its speed for the segment its middle is in at the step's start. One whose middle
 * would reach `railLength - HALF` (its front edge at the rail's end) is put there and stops, at its buffer; at a broken end, one whose
 * middle would reach the rail's end leaves it there, keeping that speed across: no floor from that step, it first rolls off the end level,
 * its box's bottom where the rail's ground would be, so it does not catch the ground it rolled on, and falls from the first step that
 * begins with its back edge at or past the end (its middle HALF past it). Falling, it keeps its speed across and falls at GRAVITY.falling
 * up to GRAVITY.terminalVelocity, moving by the average of its speed before and after the step, as Poncho does (GDD-MOV-04).
 */
export function rollCarts(rails: readonly Rail[], carts: readonly CartState[]): CartState[] {
  return carts.map((c, i) => {
    if (c.phase === 'falling' && c.fall) {
      const m = c.m + c.fall.vx * STEP;
      // It rolls off the end level, its box's bottom on the rail's ground, until a step begins with its back edge at or past the end.
      if (c.m - HALF < railLength(rails[i]!)) return { ...c, m };
      const vy = Math.min(c.fall.vy + GRAVITY.falling * STEP, GRAVITY.terminalVelocity);
      return { ...c, m, fall: { ...c.fall, y: c.fall.y + ((c.fall.vy + vy) / 2) * STEP, vy } };
    }
    if (c.phase !== 'rolling') return c;
    const rail = rails[i]!;
    const vx = cartSpeed(rail, c.m);
    const m = c.m + vx * STEP;
    if (rail.end === 'broken') return m >= railLength(rail) ? { phase: 'falling', m, fall: { y: railGround(rail, m), vy: 0, vx } } : { ...c, m };
    const last = railLength(rail) - HALF;
    return m >= last ? { phase: 'stopped', m: last } : { ...c, m };
  });
}

/** Keeps a box that only touches an edge from counting as inside it. */
const EDGE = 1e-6;

/**
 * A falling cart breaks, and is gone, on the step its box overlaps a solid tile or a spike's hurting part, or is wholly below the level's
 * bottom (`bottom`, its y). Boxes that only share an edge do not touch.
 */
export function breakCarts(rails: readonly Rail[], carts: readonly CartState[], world: World, spikes: readonly Spike[], bottom: number): CartState[] {
  return carts.map((c, i) => {
    const box = fallingBox(rails[i]!, c);
    if (!box) return c;
    let hit = false;
    for (let ty = Math.floor(box.y / TILE); ty <= Math.floor((box.y + box.h - EDGE) / TILE); ty++) {
      for (let tx = Math.floor(box.x / TILE); tx <= Math.floor((box.x + box.w - EDGE) / TILE); tx++) hit ||= world.solidTile(tx, ty);
    }
    hit ||= spikes.some((s) => box.x < (s.col + 1) * TILE && box.x + box.w > s.col * TILE && box.y < (s.row + 1) * TILE && box.y + box.h > (s.row + 1) * TILE - SPIKE.height);
    hit ||= box.y > bottom;
    return hit ? { phase: 'gone', m: c.m, ...(c.empty !== undefined ? { empty: c.empty } : {}) } : c;
  });
}

/**
 * An empty cart comes back: at a step's start, a cart stopped at its buffer counts the step if Poncho does not stand on its floor (`player`,
 * as the last step ended him) and holds its count at 0 while he does; a cart that has left a broken end counts every step from the one it
 * left. On the step the count reaches CART.returnSteps it is back at its start, standing. Not in a boss level (`boss`): there a cart stays
 * at its rail's end until a life is lost (GDD-BOS-04).
 */
export function returnCarts(rails: readonly Rail[], carts: readonly CartState[], player: PlayerState, boss: boolean): CartState[] {
  if (boss) return [...carts];
  return carts.map((c, i) => {
    if (c.phase !== 'stopped' && c.phase !== 'falling' && c.phase !== 'gone') return c;
    if (c.phase === 'stopped' && standsIn(player, rails[i]!, c)) return { phase: c.phase, m: c.m };
    const empty = (c.empty ?? 0) + 1;
    return empty >= CART.returnSteps ? { phase: 'waiting', m: HALF } : { ...c, empty };
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
    // The floor under him after the move: his y is set again in the same step by `landOn` or `stayOn`, which read it there (L-025). A cart
    // that leaves a broken end in this step is no floor from it, so it carries nobody.
    const was = floorOf(rail, from[i]!, player.x);
    const is = floorOf(rail, to[i]!, moved);
    const carried = was && is ? carryOn(player, was, is, world) : null;
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
    // A cart off its rail is no floor: nobody lands on it or stays on it.
    const under = floorOf(rail, to[i]!, stepped.x);
    if (!under) continue;
    const landed = landOn(carried, stepped, floorOf(rail, from[i]!, carried.x) ?? under, under, world) ?? (i === was ? stayOn(stepped, under, world) : null);
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
  // GDD-MOV-07, GDD-MOV-08: standing on it ends a glide and a wall slide, as a landing does (`landOn`).
  return { ...stepped, y: floor.y, vy: 0, grounded: true, gliding: false, clinging: false };
}

/** How far from a cart's middle its walls hold a rider on level rail: his body box inside its box. */
const HOLD = CART.width / 2 - HITBOX.width / 2;

/**
 * A rolling cart's walls hold its rider: standing on its floor at the end of a step (he did not jump), he is at most HOLD px from its middle
 * either way on level rail, HOLD * cos(slope) on a climb or a descent, where the tub drawn tilted is shorter across. A step that left him
 * further out (walking, sliding, or landing with his box partly over it) puts him at that limit, on the floor under his new x, with his
 * speed in the cart 0; but not if a solid tile is in the way there (a low beam still takes him out). A waiting cart he stands in starts
 * rolling at this step's end, so it holds him from the landing step; a stopped one holds nobody. `carts` are the carts after this step's
 * roll.
 */
export function holdInCarts(player: PlayerState, rails: readonly Rail[], carts: readonly CartState[], world: World): PlayerState {
  const i = standingIn(player, rails, carts);
  if (i < 0 || carts[i]!.phase === 'stopped') return player;
  const rail = rails[i]!;
  const middle = rail.x + rail.dir * carts[i]!.m;
  // Tilted on a slope the tub is shorter across: HOLD * cos(slope) of the segment under its middle, 7.07 px on a climb or a descent.
  const hold = HOLD * Math.cos(Math.atan(Math.abs(RISE[segmentAt(rail, carts[i]!.m).segment.kind])));
  const off = player.x - middle;
  if (Math.abs(off) <= hold) return player;
  const x = middle + Math.sign(off) * hold;
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
