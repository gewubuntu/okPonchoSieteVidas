// GDD-ENM-02, GDD-CMB-01: the Alacrán (scorpion). It patrols a platform and turns at walls and at ledge edges. Stomp, claw or
// fireball defeat it; touching it otherwise is a hit (GDD-CMB-03). Pure logic, no Phaser (GDD-TEC-02).
import { ENEMY, STEP, STOMP, TILE } from '../config/tuning';
import { hurtbox } from './hazards';
import type { PlayerState } from './movement';
import type { TileGrid } from './tilemap';

/** Where an Alacrán starts: the middle of it, and the y of its feet, like Poncho's own position. It starts heading right. */
export interface Enemy {
  readonly x: number;
  readonly y: number;
}

export interface EnemyState {
  readonly x: number;
  readonly dir: 1 | -1;
  /** False once it has been defeated, until a life is lost (GDD-LIFE-02). */
  readonly alive: boolean;
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
export const freshEnemies = (enemies: readonly Enemy[]): readonly EnemyState[] => enemies.map((e) => ({ x: e.x, dir: 1, alive: true }));

/** Does the enemy's box, centred on x with its feet at y, overlap a solid tile? */
function blockedAt(world: TileGrid, x: number, y: number): boolean {
  for (let ty = Math.floor((y - ENEMY.height) / TILE); ty <= Math.floor((y - EDGE) / TILE); ty++) {
    for (let tx = Math.floor((x - HALF) / TILE); tx <= Math.floor((x + HALF - EDGE) / TILE); tx++) if (world.solidTile(tx, ty)) return true;
  }
  return false;
}

/**
 * Advances one step. It walks at ENEMY.speed. It turns round when its box meets a wall (flush against it), and when the
 * ground under its leading edge ends, so it never walks off a ledge (GDD-ENM-02). A defeated enemy stays put.
 */
export function stepEnemy(def: Enemy, state: EnemyState, world: TileGrid): EnemyState {
  if (!state.alive) return state;
  const x = state.x + state.dir * ENEMY.speed * STEP;
  if (blockedAt(world, x, def.y)) {
    const flush = state.dir > 0 ? Math.floor((x + HALF - EDGE) / TILE) * TILE - HALF : (Math.floor((x - HALF) / TILE) + 1) * TILE + HALF;
    return { ...state, x: flush, dir: state.dir > 0 ? -1 : 1 };
  }
  const ground = world.solidTile(Math.floor((x + state.dir * (HALF - EDGE)) / TILE), Math.floor(def.y / TILE));
  return ground ? { ...state, x } : { ...state, dir: state.dir > 0 ? -1 : 1 };
}

/** The enemy's box: ENEMY.width wide and ENEMY.height tall, standing on y. */
export const enemyBox = (def: Enemy, state: EnemyState): Box => ({ x0: state.x - HALF, x1: state.x + HALF, y0: def.y - ENEMY.height, y1: def.y });

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
  return after.vy > 0 && before.y <= def.y - ENEMY.height + STOMP.tolerance && touchesEnemy(after, def, state);
}

/** The speed a stomp throws Poncho up at: the jump velocity if jump is held or was pressed in the buffer window (GDD-MOV-03). */
export const stompBounce = (jumpHeld: boolean, jumpBuffer: number): number => (jumpHeld || jumpBuffer > 0 ? STOMP.boostBounce : STOMP.bounce);
