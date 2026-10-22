// GDD-ENM-02, GDD-CMB-01: the Alacrán (scorpion) patrols a platform and turns at walls and at ledge edges; stomp, claw or
// fireball defeat it. The Zopilote (vulture) cruises, telegraphs and dives; the cactus buddy just stands there. Neither can be stomped. Touching either otherwise
// is a hit (GDD-CMB-03). Pure logic, no Phaser (GDD-TEC-02).
import { CACTUS, ENEMY, STEP, STOMP, TILE, ZOPILOTE } from '../config/tuning';
import { hurtbox } from './hazards';
import type { PlayerState } from './movement';
import type { TileGrid } from './tilemap';

export type EnemyKind = 'alacran' | 'zopilote' | 'cactus';

/**
 * Where an enemy starts, heading right. An Alacrán (the default kind) gives the middle of it and the y of its feet, like
 * Poncho's own position, and so does a cactus buddy; a Zopilote gives the middle of it and the y of its cruise line.
 */
export interface Enemy {
  readonly x: number;
  readonly y: number;
  readonly kind?: EnemyKind;
}

export const kindOf = (def: Enemy): EnemyKind => def.kind ?? 'alacran';

/** A Zopilote's flight (GDD-ENM-02): cruising, frozen for its telegraph, diving to the aim point, then climbing back. */
export interface Flight {
  readonly y: number;
  readonly phase: 'cruise' | 'telegraph' | 'dive' | 'return';
  /** Steps in the current phase; while cruising, the steps cruised so far, which set where it is in its bob. */
  readonly age: number;
  /** Where Poncho was when the telegraph ended; only read while diving. */
  readonly aimX: number;
  readonly aimY: number;
}

export interface EnemyState {
  readonly x: number;
  readonly dir: 1 | -1;
  /** False once it has been defeated, until a life is lost (GDD-LIFE-02). */
  readonly alive: boolean;
  /** Only a Zopilote has one. */
  readonly flight?: Flight;
}

export interface Box {
  readonly x0: number;
  readonly x1: number;
  readonly y0: number;
  readonly y1: number;
}

const HALF = ENEMY.width / 2;
const EDGE = 1e-6;

/** Every enemy alive at its start, as at the start of the level and after a life is lost. */
export const freshEnemies = (enemies: readonly Enemy[]): readonly EnemyState[] =>
  enemies.map((e) => (kindOf(e) === 'zopilote' ? { x: e.x, dir: 1, alive: true, flight: { y: e.y, phase: 'cruise', age: 0, aimX: 0, aimY: 0 } } : { x: e.x, dir: 1, alive: true }));

/** Does the enemy's box, centred on x with its feet at y, overlap a solid tile? */
function blockedAt(world: TileGrid, x: number, y: number): boolean {
  for (let ty = Math.floor((y - ENEMY.height) / TILE); ty <= Math.floor((y - EDGE) / TILE); ty++) {
    for (let tx = Math.floor((x - HALF) / TILE); tx <= Math.floor((x + HALF - EDGE) / TILE); tx++) if (world.solidTile(tx, ty)) return true;
  }
  return false;
}

const turn = (dir: 1 | -1): 1 | -1 => (dir > 0 ? -1 : 1);

const centre = (player: PlayerState): { x: number; y: number } => {
  const h = hurtbox(player);
  return { x: h.x + h.w / 2, y: h.y + h.h / 2 };
};

/** Moves from (x, y) towards (tx, ty) by at most `dist`, stopping on it. */
function approach(x: number, y: number, tx: number, ty: number, dist: number): { x: number; y: number; arrived: boolean } {
  const d = Math.hypot(tx - x, ty - y);
  return d <= dist ? { x: tx, y: ty, arrived: true } : { x: x + ((tx - x) / d) * dist, y: y + ((ty - y) / d) * dist, arrived: false };
}

/**
 * A Zopilote's step (GDD-ENM-02). Cruising it flies at ZOPILOTE.speed between `range` either side of its start, turning at
 * the ends, bobbing on a sine. It ignores tiles. When Poncho is within `triggerX` to either side and 0 to `triggerY` below
 * it, it freezes for the telegraph, then dives straight at the spot he was at when it ended, and climbs back to its
 * cruise line.
 */
function stepZopilote(def: Enemy, state: EnemyState, player: PlayerState): EnemyState {
  const f = state.flight!;
  if (f.phase === 'telegraph') {
    if (f.age + 1 < ZOPILOTE.telegraphSteps) return { ...state, flight: { ...f, age: f.age + 1 } };
    const aim = centre(player);
    return { ...state, flight: { ...f, phase: 'dive', age: 0, aimX: aim.x, aimY: aim.y } };
  }
  if (f.phase === 'dive') {
    const at = approach(state.x, f.y, f.aimX, f.aimY, ZOPILOTE.diveSpeed * STEP);
    return { ...state, x: at.x, flight: { ...f, y: at.y, phase: at.arrived ? 'return' : 'dive', age: f.age + 1 } };
  }
  if (f.phase === 'return') {
    const at = approach(state.x, f.y, state.x, def.y, ZOPILOTE.returnSpeed * STEP);
    return { ...state, flight: { ...f, y: at.y, phase: at.arrived ? 'cruise' : 'return', age: at.arrived ? 0 : f.age + 1 } };
  }
  const moved = state.x + state.dir * ZOPILOTE.speed * STEP;
  const past = Math.abs(moved - def.x) >= ZOPILOTE.range - EDGE; // EDGE: 40 / 60 px a step adds up to just under 48
  const x = past ? def.x + state.dir * ZOPILOTE.range : moved;
  const dir = past ? turn(state.dir) : state.dir;
  const age = f.age + 1;
  const y = def.y + ZOPILOTE.amplitude * Math.sin((2 * Math.PI * age) / ZOPILOTE.periodSteps);
  const p = centre(player);
  const spotted = Math.abs(p.x - x) <= ZOPILOTE.triggerX && p.y > y && p.y - y <= ZOPILOTE.triggerY;
  return { ...state, x, dir, flight: { ...f, y, age: spotted ? 0 : age, phase: spotted ? 'telegraph' : 'cruise' } };
}

/**
 * Advances one step. An Alacrán walks at ENEMY.speed. It turns round when its box meets a wall (flush against it), and when the
 * ground under its leading edge ends, so it never walks off a ledge (GDD-ENM-02). A defeated enemy stays put.
 */
export function stepEnemy(def: Enemy, state: EnemyState, world: TileGrid, player: PlayerState): EnemyState {
  if (!state.alive) return state;
  if (kindOf(def) === 'zopilote') return stepZopilote(def, state, player);
  if (kindOf(def) === 'cactus') return state; // static (GDD-ENM-02)
  const x = state.x + state.dir * ENEMY.speed * STEP;
  if (blockedAt(world, x, def.y)) {
    const flush = state.dir > 0 ? Math.floor((x + HALF - EDGE) / TILE) * TILE - HALF : (Math.floor((x - HALF) / TILE) + 1) * TILE + HALF;
    return { ...state, x: flush, dir: turn(state.dir) };
  }
  const ground = world.solidTile(Math.floor((x + state.dir * (HALF - EDGE)) / TILE), Math.floor(def.y / TILE));
  return ground ? { ...state, x } : { ...state, dir: turn(state.dir) };
}

/** The enemy's box: an Alacrán's is ENEMY.width x ENEMY.height standing on y, a Zopilote's ZOPILOTE.width x ZOPILOTE.height centred on its flight y. */
export function enemyBox(def: Enemy, state: EnemyState): Box {
  if (kindOf(def) === 'zopilote') {
    const y = state.flight!.y;
    return { x0: state.x - ZOPILOTE.width / 2, x1: state.x + ZOPILOTE.width / 2, y0: y - ZOPILOTE.height / 2, y1: y + ZOPILOTE.height / 2 };
  }
  const size = kindOf(def) === 'cactus' ? CACTUS : ENEMY;
  return { x0: state.x - size.width / 2, x1: state.x + size.width / 2, y0: def.y - size.height, y1: def.y };
}

/** Can the claw, a fireball or a stomp defeat it? The cactus buddy cannot be defeated at all, only avoided (GDD-ENM-02). */
export const defeatable = (def: Enemy): boolean => kindOf(def) !== 'cactus';

/**
 * Is a contact harmless (GDD-ENM-02)? Only with a cactus buddy, and only while Poncho is rising into it from beneath: moving
 * up, with his head below its underside a step before.
 */
export function harmlessFromBelow(before: PlayerState, after: PlayerState, def: Enemy, state: EnemyState): boolean {
  return kindOf(def) === 'cactus' && after.vy < 0 && hurtbox(before).y >= enemyBox(def, state).y1;
}

const overlaps = (a: Box, b: Box): boolean => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;

/** Does a box (the claw, a fireball) overlap a live enemy? Boxes that only share an edge do not touch. */
export const boxHitsEnemy = (box: Box, def: Enemy, state: EnemyState): boolean => state.alive && overlaps(box, enemyBox(def, state));

/** Does Poncho's hurtbox (GDD-MOV-06) overlap a live enemy? */
export function touchesEnemy(player: PlayerState, def: Enemy, state: EnemyState): boolean {
  const h = hurtbox(player);
  return boxHitsEnemy({ x0: h.x, x1: h.x + h.w, y0: h.y, y1: h.y + h.h }, def, state);
}

/**
 * Did Poncho just land on top of it (GDD-CMB-01)? He is falling, his hurtbox overlaps it, and on the step before his
 * feet were no more than STOMP.tolerance px below its top.
 */
export function isStomp(before: PlayerState, after: PlayerState, def: Enemy, state: EnemyState): boolean {
  if (kindOf(def) !== 'alacran') return false; // the Zopilote cannot be stomped (GDD-CMB-01)
  return after.vy > 0 && before.y <= def.y - ENEMY.height + STOMP.tolerance && touchesEnemy(after, def, state);
}

/** The speed a stomp throws Poncho up at: the jump velocity if jump is held or was pressed in the buffer window (GDD-MOV-03). */
export const stompBounce = (jumpHeld: boolean, jumpBuffer: number): number => (jumpHeld || jumpBuffer > 0 ? STOMP.boostBounce : STOMP.bounce);
