// GDD-ENM-03: the Chapulín (grasshopper), the arc reader. It crouches, then hops in a fixed arc the way it faces, and turns round instead
// of hopping where the hop would meet a wall or end lower than it is (a pit, a ledge's end), so it never falls. An awning's top it falls
// onto throws it up high (GDD-WLD-10). Pure logic, no Phaser (GDD-TEC-02).
import { CHAPULIN, GRAVITY, STEP, TILE } from '../config/tuning';
import type { Enemy, EnemyState } from './enemy';
import type { PlatformPos } from './platform';
import { boxBlocked, groundTop } from './slope';
import type { TileGrid } from './tilemap';
import { turn } from './walker';

/** A Chapulín's hop: crouched on the ground, or in the air at `vy` px/s (down is positive). */
export interface Hop {
  readonly phase: 'crouch' | 'air';
  /** Steps in the current phase. */
  readonly age: number;
  readonly vy: number;
  /** GDD-WLD-10: on the step an awning throws it up, the position of that awning in the tops it was given (a torn one tears). */
  readonly on?: number;
}

/** How a Chapulín starts (and is after a lost life): crouched, at the start of its crouch. */
export const CROUCHING: Hop = { phase: 'crouch', age: 0, vy: 0 };

const EDGE = 1e-6;
const HALF = CHAPULIN.width / 2;

/** GDD-MOV-04: its speed after a step of gravity, as Poncho's: rising and falling gravity, halved below GRAVITY.hangSpeed, the terminal velocity. */
function fall(vy: number): number {
  let g = vy < 0 ? GRAVITY.rising : GRAVITY.falling;
  if (Math.abs(vy) < GRAVITY.hangSpeed) g *= GRAVITY.hangMultiplier;
  return Math.min(vy + g * STEP, GRAVITY.terminalVelocity);
}

interface Air {
  readonly x: number;
  readonly y: number;
  readonly dir: 1 | -1;
  readonly vy: number;
  /** Where the step ended it: still in the air, on the ground (its feet on its top), or thrown up by the awning at position `on`. */
  readonly end: 'air' | 'ground' | 'awning';
  readonly on?: number;
}

/**
 * A step in the air: CHAPULIN.hopAcross px/s the way it faces (a wall turns it round where it is), and up or down under gravity, moving by
 * the average of the old and new speed as Poncho does (a ceiling stops its rise). Falling, it lands on the ground its box or the middle of
 * its feet comes into (a level tile's top or a slope's surface); else, if its feet crossed the top of an awning its box is over, it is
 * thrown up from that top at CHAPULIN.awningUp. A tile wins over an awning in the same step.
 */
function air(world: TileGrid, x0: number, y0: number, dir0: 1 | -1, vy0: number, awnings: readonly PlatformPos[]): Air {
  let x = x0 + dir0 * CHAPULIN.hopAcross * STEP;
  let dir = dir0;
  if (boxBlocked(world, x, y0, CHAPULIN.width, CHAPULIN.height)) {
    x = x0;
    dir = turn(dir0);
  }
  let vy = fall(vy0);
  let y = y0 + ((vy0 + vy) / 2) * STEP;
  if (vy < 0) {
    if (boxBlocked(world, x, y, CHAPULIN.width, CHAPULIN.height)) return { x, y: y0, dir, vy: 0, end: 'air' };
    return { x, y, dir, vy, end: 'air' };
  }
  if (boxBlocked(world, x, y, CHAPULIN.width, CHAPULIN.height)) return { x, y: Math.floor((y - EDGE) / TILE) * TILE, dir, vy: 0, end: 'ground' };
  const top = groundTop(world, x, y);
  if (top !== null) return { x, y: top, dir, vy: 0, end: 'ground' };
  const on = awnings.findIndex((a) => y0 <= a.y + EDGE && y >= a.y && x + HALF > a.x && x - HALF < a.x + a.w);
  if (on >= 0) return { x, y: awnings[on]!.y, dir, vy: -CHAPULIN.awningUp, end: 'awning', on };
  return { x, y, dir, vy, end: 'air' };
}

/** Is there ground under its feet at (x, y): a level tile or a slope under the middle of its feet, or a level tile under its box? */
const onGround = (world: TileGrid, x: number, y: number): boolean => groundTop(world, x, y + 1) !== null || boxBlocked(world, x, y + 1, CHAPULIN.width, CHAPULIN.height);

/**
 * Would a hop from (x, y) the way `dir` faces end on the ground no lower than y, or on an awning, without meeting a wall? Its arc is played
 * out step by step, as it would fly; a hop that falls past the bottom of the level ends nowhere (the level's bottom, below a raised bottom
 * too: only Poncho is lost at one, GDD-WLD-03).
 */
export function hopLands(world: TileGrid, x: number, y: number, dir: 1 | -1, awnings: readonly PlatformPos[]): boolean {
  let at: Air = { x, y, dir, vy: -CHAPULIN.hopUp, end: 'air' };
  while (at.y - CHAPULIN.height <= world.height * TILE) {
    at = air(world, at.x, at.y, at.dir, at.vy, awnings);
    if (at.dir !== dir) return false;
    if (at.end === 'awning') return true;
    if (at.end === 'ground') return at.y <= y + EDGE;
  }
  return false;
}

/**
 * A Chapulín's step (GDD-ENM-03). Crouched on the ground, it stays still for CHAPULIN.crouchSteps (its telegraph, GDD-ENM-01), then hops at
 * CHAPULIN.hopUp up and CHAPULIN.hopAcross across the way it faces, from that same step; if that hop would not land (see `hopLands`), it
 * turns round instead and crouches again. Crouched over no ground, it falls. In the air it flies (see `air`): landing on the ground it
 * crouches; an awning in `awnings` throws it up again with no crouch.
 */
export function stepChapulin(def: Enemy, state: EnemyState, world: TileGrid, awnings: readonly PlatformPos[]): EnemyState {
  const h = state.hop!;
  const y = state.y ?? def.y;
  const grounded = h.phase === 'crouch' && onGround(world, state.x, y);
  if (grounded) {
    if (h.age + 1 < CHAPULIN.crouchSteps) return { ...state, hop: { ...h, age: h.age + 1 } };
    if (!hopLands(world, state.x, y, state.dir, awnings)) return { ...state, dir: turn(state.dir), hop: CROUCHING };
  }
  // A crouch with no ground under it (placed over an awning, GDD-WLD-10) falls from rest.
  const vy = grounded ? -CHAPULIN.hopUp : h.vy;
  const at = air(world, state.x, y, state.dir, vy, awnings);
  const hop: Hop = at.end === 'ground' ? CROUCHING : at.end === 'awning' ? { phase: 'air', age: 0, vy: at.vy, on: at.on! } : { phase: 'air', age: h.phase === 'air' ? h.age + 1 : 0, vy: at.vy };
  return { ...state, x: at.x, y: at.y, dir: at.dir, hop };
}
