// GDD-WLD-05: moving platforms. A platform is a one-way floor that travels back and forth between two ends: Poncho
// lands on its top from above, is carried along while he stands on it, and passes through it from below and the sides.
// Where it is depends only on the step count, so it is the same on every run. Pure logic, no Phaser (GDD-TEC-02).
import { HITBOX, PLATFORM, TICK_HZ } from '../config/tuning';
import { blocked, type PlayerState, type World } from './movement';

/** A platform's two ends, as the top-left corner of its top surface, and how wide it is. */
export interface MovingPlatform {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
  readonly w: number;
}

export interface PlatformPos {
  readonly x: number;
  readonly y: number;
  readonly w: number;
}

/** Keeps floating point noise from deciding whether feet are on a surface. */
const EPS = 1e-6;
const HALF = HITBOX.width / 2;

/**
 * Where something is after `tick` steps along the straight path from (x0, y0) to (x1, y1) at `speed` px/s: it starts at the
 * first end and turns round at each end without stopping. Shared by the moving platforms and the moving blocks (GDD-WLD-05).
 */
export function along(x0: number, y0: number, x1: number, y1: number, speed: number, tick: number): { x: number; y: number } {
  const length = Math.hypot(x1 - x0, y1 - y0);
  if (length === 0) return { x: x0, y: y0 };
  let d = ((speed * tick) / TICK_HZ) % (2 * length);
  if (d > length) d = 2 * length - d;
  const f = d / length;
  return { x: x0 + (x1 - x0) * f, y: y0 + (y1 - y0) * f };
}

/** Where the platform is after `tick` steps: it starts at its first end and turns round at each end without stopping. */
export function platformAt(p: MovingPlatform, tick: number): PlatformPos {
  return { ...along(p.x0, p.y0, p.x1, p.y1, PLATFORM.speed, tick), w: p.w };
}

const overlapsX = (player: PlayerState, at: PlatformPos): boolean => player.x + HALF > at.x && player.x - HALF < at.x + at.w;

/** Is Poncho standing on the platform: grounded, feet on its top, body box over it? */
export function standsOnPlatform(player: PlayerState, at: PlatformPos): boolean {
  return player.grounded && Math.abs(player.y - at.y) < EPS && overlapsX(player, at);
}

/**
 * Poncho before a step, on a one-way floor that moves from `from` to `to` in the step (GDD-WLD-05, shared by the platforms and the carts,
 * GDD-WLD-15): if he stands on it, he moves with it, one axis at a time and never into a solid tile: if it would push him into a wall or
 * a ceiling he stays against it and the floor slides on under his feet, so it never crushes him or pushes him through a tile. Null when
 * he does not stand on it.
 */
export function carryOn(player: PlayerState, from: PlatformPos, to: PlatformPos, world: World): PlayerState | null {
  if (!standsOnPlatform(player, from)) return null;
  const x = blocked(world, player.x + (to.x - from.x), player.y) ? player.x : player.x + (to.x - from.x);
  const y = blocked(world, x, player.y + (to.y - from.y)) ? player.y : player.y + (to.y - from.y);
  return { ...player, x, y };
}

/**
 * Poncho after a step, over a one-way floor that moved from `from` to `to` in it: if he came down onto its top (his feet were at or above
 * its top before the step, where it was or where it is now, whichever is lower, and are at or below it now), he stands on it, so a floor
 * rising into his falling feet catches him too. Not if standing there would put his body box into a tile: a floor never carries him into
 * one (`carryOn`). Rising through it from below, jumping off it, or being below it does nothing: null. `carried` is Poncho before the step
 * but after being carried. Landing ends a carried speed (GDD-WLD-15).
 */
export function landOn(carried: PlayerState, stepped: PlayerState, from: PlatformPos, to: PlatformPos, world: World): PlayerState | null {
  if (!(overlapsX(stepped, to) && carried.y <= Math.max(from.y, to.y) + EPS && stepped.y >= to.y - EPS && !blocked(world, stepped.x, to.y))) return null;
  const landed: PlayerState = { ...stepped, y: to.y, vy: 0, grounded: true, bounced: false, gliding: false, clinging: false };
  delete landed.carry;
  return landed;
}

/** Poncho before a step: if he stands on a platform, he moves with it to where it will be after this step (`carryOn`). */
export function carry(player: PlayerState, platforms: readonly MovingPlatform[], tick: number, world: World): PlayerState {
  for (const p of platforms) {
    const carried = carryOn(player, platformAt(p, tick), platformAt(p, tick + 1), world);
    if (carried) return carried;
  }
  return player;
}

/**
 * Poncho after a step: if he came down onto a platform's top, he stands on it (`landOn`). `tick` is the step count before this step,
 * `world` the run's combined solid world (doors, fragile walls and piñatas count).
 */
export function landOnPlatforms(carried: PlayerState, stepped: PlayerState, platforms: readonly MovingPlatform[], tick: number, world: World): PlayerState {
  for (const p of platforms) {
    const landed = landOn(carried, stepped, platformAt(p, tick), platformAt(p, tick + 1), world);
    if (landed) return landed;
  }
  return stepped;
}
