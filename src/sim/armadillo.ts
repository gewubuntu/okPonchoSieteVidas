// GDD-ENM-04: the Armadillo, World 3's ball. It walks like the Alacrán; a Poncho near it on its level, on either side, startles it: it
// turns to face him, tucks (its telegraph) and rolls the way it faced, never turning to follow him, until a wall stops it and it lies dazed.
// Unlike every walker it rolls off a ledge's end and falls as Poncho falls (GDD-MOV-04). It does not set off crumbling tiles, and it falls
// wherever its ground goes. Pure logic, no Phaser (GDD-TEC-02).
import { ARMADILLO, GRAVITY, STEP, TILE } from '../config/tuning';
import type { Enemy, EnemyState } from './enemy';
import { hurtbox } from './hazards';
import type { PlayerState } from './movement';
import { boxBlocked, groundTop, slopeTile, stepDown, stepUp } from './slope';
import { SLOPE_HEIGHTS, type TileGrid } from './tilemap';
import { turn, walk } from './walker';

/** An Armadillo's shell: walking, tucked (its telegraph), rolling, or dazed on its back after a wall stopped its roll. */
export interface Shell {
  readonly phase: 'walk' | 'tuck' | 'roll' | 'dazed';
  /** Steps in the current phase. */
  readonly age: number;
  /** Its speed down in px/s while it falls; 0 on the ground. */
  readonly vy: number;
  /** Rolling: its speed across in px/s on its last step, which it keeps while it falls. 0 in every other phase. */
  readonly vx: number;
  /** GDD-ENM-04: the claw's swing rang off the rolling ball this step, for its look and sound (a short tick). Left out, it did not. */
  readonly rang?: boolean;
}

/** Walking: how an Armadillo starts, and how it is after a lost life (heading right). */
export const WALKING: Shell = { phase: 'walk', age: 0, vy: 0, vx: 0 };

const EDGE = 1e-6;
const SIZE = { width: ARMADILLO.width, height: ARMADILLO.height } as const;
const HALF = ARMADILLO.width / 2;

/** GDD-ENM-04: is it a rolling ball? Then only a rolling cart defeats it: the claw rings off it, and a stomp or a fireball does nothing to it. */
export const isRolling = (state: EnemyState): boolean => state.shell?.phase === 'roll';

/** GDD-ENM-04: is it lying dazed? Then touching it is no hit. */
export const isDazed = (state: EnemyState): boolean => state.shell?.phase === 'dazed';

/** GDD-ENM-04: the claw's swing rang off the rolling ball (the flag lasts the step; its next step drops it). */
export const ringOff = (state: EnemyState): EnemyState => ({ ...state, shell: { ...state.shell!, rang: true } });

/**
 * GDD-ENM-01, GDD-ENM-04, for the scene: is the tuck flashing red with `left` steps of it left (ARMADILLO.tuckSteps on its first step)?
 * Red for ARMADILLO.flashOn steps, then plain for flashOff, from its first step.
 */
export const tuckRed = (left: number): boolean => (ARMADILLO.tuckSteps - left) % (ARMADILLO.flashOn + ARMADILLO.flashOff) < ARMADILLO.flashOn;

/** The steps of its tuck left, ARMADILLO.tuckSteps on its first step; 0 in every other phase. */
export const tuckLeft = (shell: Shell): number => (shell.phase === 'tuck' ? ARMADILLO.tuckSteps - shell.age : 0);

/** GDD-ENM-04, for the scene: kicking its feet, in the last ARMADILLO.kickSteps of its daze (drawn only). */
export const kick = (shell: Shell): boolean => shell.phase === 'dazed' && shell.age >= ARMADILLO.dazedSteps - ARMADILLO.kickSteps;

/** GDD-MOV-04: its speed after a step of gravity, as Poncho's: falling gravity, halved below GRAVITY.hangSpeed, up to the terminal velocity. */
function fall(vy: number): number {
  const g = Math.abs(vy) < GRAVITY.hangSpeed ? GRAVITY.falling * GRAVITY.hangMultiplier : GRAVITY.falling;
  return Math.min(vy + g * STEP, GRAVITY.terminalVelocity);
}

/** Is there ground under it at (x, y): a level tile or a slope under the middle of its feet, or a level tile under its box (as the Chapulín)? */
const onGround = (world: TileGrid, x: number, y: number): boolean => groundTop(world, x, y + 1) !== null || boxBlocked(world, x, y + 1, ARMADILLO.width, ARMADILLO.height);

/** Where its box meets a wall moving the way `dir` faces to `x`: flush against the tile's face, as a walker turns (`walker.ts`). */
const flush = (x: number, dir: 1 | -1): number => (dir > 0 ? Math.floor((x + HALF - EDGE) / TILE) * TILE - HALF : (Math.floor((x - HALF) / TILE) + 1) * TILE + HALF);

/**
 * Its speed across in px/s rolling the way `dir` faces from the ground under the middle of its feet at (x, y), as a cart's is set by where
 * its middle is (GDD-WLD-15): ARMADILLO.rollSpeed along level ground, rollUp along a slope that rises that way and rollDown along one that
 * falls, each measured along the ground, so across it is the speed along over the slope's length per px across.
 */
export function rollAcross(world: TileGrid, x: number, y: number, dir: 1 | -1): number {
  const at = slopeTile(world, x, y);
  const rise = at === null ? 0 : (dir * (SLOPE_HEIGHTS[at.slope].right - SLOPE_HEIGHTS[at.slope].left)) / TILE;
  const along = rise > 0 ? ARMADILLO.rollUp : rise < 0 ? ARMADILLO.rollDown : ARMADILLO.rollSpeed;
  return along / Math.hypot(1, rise);
}

/** Where its body is after a step, and whether a wall stopped it across. */
interface Moved {
  readonly x: number;
  readonly y: number;
  readonly vy: number;
  readonly vx: number;
  readonly walled: boolean;
}

/**
 * A step down under gravity from (x, y) at `vy`, moving by the average of the old and new speed as Poncho does: it lands on the ground its
 * box or the middle of its feet comes into (a level tile's top or a slope's surface), with no speed down.
 */
function drop(world: TileGrid, x: number, y: number, vy0: number): { y: number; vy: number } {
  const vy = fall(vy0);
  const y1 = y + ((vy0 + vy) / 2) * STEP;
  if (boxBlocked(world, x, y1, ARMADILLO.width, ARMADILLO.height)) return { y: Math.floor((y1 - EDGE) / TILE) * TILE, vy: 0 };
  const top = groundTop(world, x, y1);
  return top !== null ? { y: top, vy: 0 } : { y: y1, vy };
}

/**
 * A rolling step the way `dir` faces from (x, y). On the ground it rolls at `rollAcross` and follows the ground up and down by up to
 * SLOPE.stepPx a step, as a walker does; it does not turn at a ledge's end but rolls on while its box is over a level tile or the middle of
 * its feet over ground, and from the step it is not it falls, keeping its speed across (`vx`). A wall stops it: a rise of more than
 * SLOPE.stepPx in a step (`stepUp`'s wall, the high side of a slope too) or a level tile its box would move into (flush against it).
 */
function rollStep(world: TileGrid, x: number, y: number, dir: 1 | -1, vy: number, vx: number): Moved {
  const grounded = vy === 0 && onGround(world, x, y);
  const across = grounded ? rollAcross(world, x, y, dir) : vx;
  const x1 = x + dir * across * STEP;
  const up = grounded ? stepUp(world, x1, y) : null;
  if (up === 'wall') return { x, y, vy: 0, vx: 0, walled: true };
  const y1 = grounded ? (up ?? stepDown(world, x1, y) ?? y) : y;
  if (boxBlocked(world, x1, y1, ARMADILLO.width, ARMADILLO.height)) {
    const d = grounded ? { y, vy: 0 } : drop(world, flush(x1, dir), y, vy);
    return { x: flush(x1, dir), y: d.y, vy: d.vy, vx: 0, walled: true };
  }
  if (onGround(world, x1, y1)) return { x: x1, y: y1, vy: 0, vx: across, walled: false };
  const d = drop(world, x1, y1, vy);
  return { x: x1, y: d.y, vy: d.vy, vx: across, walled: false };
}

/** Its box has fallen wholly below the level's last row (GDD-WLD-03: an enemy falls to the level's last row, under a raised bottom too). */
const outOfLevel = (world: TileGrid, y: number): boolean => y - ARMADILLO.height > world.height * TILE;

/**
 * GDD-ENM-04, GDD-TEC-04: a ball rolling the way `dir` faces from (x, y), its feet on the ground, played out with no Poncho for at most
 * `steps` steps: where it is after each step, until a wall stops it (`end` 'dazed'), it falls out of the level ('gone'), or the steps run
 * out ('rolling'). The validator reads it.
 */
export function rollPath(world: TileGrid, x: number, y: number, dir: 1 | -1, steps: number): { at: { x: number; y: number }[]; end: 'dazed' | 'gone' | 'rolling' } {
  const at: { x: number; y: number }[] = [];
  let m: Moved = { x, y, vy: 0, vx: 0, walled: false };
  for (let i = 0; i < steps; i++) {
    m = rollStep(world, m.x, m.y, dir, m.vy, m.vx);
    if (outOfLevel(world, m.y)) return { at, end: 'gone' };
    at.push({ x: m.x, y: m.y });
    if (m.walled) return { at, end: 'dazed' };
  }
  return { at, end: 'rolling' };
}

/**
 * An Armadillo's step (GDD-ENM-04). With no ground under it, in any phase, it falls as Poncho falls, keeping its speed across only while it
 * rolls; it is gone (defeated, until a life is lost) once its box is below the level's last row. A phase that ends hands the step to the
 * next one. Walking, it walks at ARMADILLO.walkSpeed like the Alacrán (`walker.ts`); when Poncho's hurtbox centre is then within
 * ARMADILLO.sightX of its middle across and his feet within sightY of its own, it turns to face him (keeping its facing with him right at
 * its middle) and tucks for ARMADILLO.tuckSteps, still. Then it rolls the way it faced (`rollStep`) until a wall stops it, and lies dazed
 * there for ARMADILLO.dazedSteps; then it walks away from the wall, and may be startled again at once.
 */
export function stepArmadillo(def: Enemy, state: EnemyState, world: TileGrid, player: PlayerState): EnemyState {
  const s = state.shell!;
  const x = state.x;
  const y = state.y ?? def.y;
  const age = s.age + 1;
  let phase = s.phase;
  let dir = state.dir;
  if (phase === 'tuck' && age >= ARMADILLO.tuckSteps) phase = 'roll';
  if (phase === 'dazed' && age >= ARMADILLO.dazedSteps) {
    phase = 'walk';
    dir = turn(dir);
  }
  const fresh = phase !== s.phase;
  const next = (m: { x: number; y: number }, shell: Shell, facing: 1 | -1 = dir): EnemyState =>
    outOfLevel(world, m.y) ? { ...state, x: m.x, y: m.y, dir: facing, alive: false, shell } : { ...state, x: m.x, y: m.y, dir: facing, shell };
  if (phase === 'roll') {
    const m = rollStep(world, x, y, dir, s.vy, s.vx);
    return next(m, m.walled ? { phase: 'dazed', age: 0, vy: m.vy, vx: 0 } : { phase, age: fresh ? 0 : age, vy: m.vy, vx: m.vx });
  }
  if (s.vy > 0 || !onGround(world, x, y)) {
    const d = drop(world, x, y, s.vy);
    return next({ x, y: d.y }, { phase, age: fresh ? 0 : age, vy: d.vy, vx: 0 });
  }
  if (phase !== 'walk') return next({ x, y }, { phase, age, vy: 0, vx: 0 });
  const moved = walk(world, x, y, dir, SIZE, ARMADILLO.walkSpeed);
  const h = hurtbox(player);
  const across = h.x + h.w / 2 - moved.x;
  const startled = Math.abs(across) <= ARMADILLO.sightX && Math.abs(player.y - moved.y) <= ARMADILLO.sightY;
  const facing = !startled || across === 0 ? moved.dir : across > 0 ? 1 : -1;
  return next(moved, startled ? { phase: 'tuck', age: 0, vy: 0, vx: 0 } : { phase: 'walk', age: fresh ? 0 : age, vy: 0, vx: 0 }, facing);
}
