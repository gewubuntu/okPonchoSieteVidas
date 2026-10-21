// GDD-PWR-03: the salsa fireball Poncho spits in the Fuego state. Pure logic, no Phaser (GDD-TEC-02).
import { FIREBALL, HITBOX, STEP, TILE } from '../config/tuning';
import { squareBlocked } from './item';
import type { PlayerState } from './movement';
import type { TileGrid } from './tilemap';

export interface Fireball {
  /** Middle of the fireball, and the y of the bottom of its square box, like Poncho's own position. */
  readonly x: number;
  readonly y: number;
  readonly vx: number;
  readonly vy: number;
  /** Steps it has lived. */
  readonly age: number;
}

const EDGE = 1e-6;
/** The speed that carries a fireball up `FIREBALL.bounceHeight` px against its gravity. */
export const BOUNCE_SPEED = Math.sqrt(2 * FIREBALL.gravity * FIREBALL.bounceHeight);

/** A new fireball at Poncho's front edge, level with the middle of his body, heading the way he faces and not yet falling. */
export function spawnFireball(player: PlayerState): Fireball {
  return {
    x: player.x + player.facing * (HITBOX.width / 2 + FIREBALL.size / 2),
    y: player.y - HITBOX.height / 2 + FIREBALL.size / 2,
    vx: player.facing * FIREBALL.speed,
    vy: 0,
    age: 0,
  };
}

/**
 * Advances one fixed step, or returns null when it has vanished: it met a wall or a ceiling, fell out of the bottom of the
 * level, or has lived 3 s. On the ground it bounces back up (GDD-PWR-03).
 */
export function stepFireball(fb: Fireball, world: TileGrid): Fireball | null {
  const age = fb.age + 1;
  if (age > FIREBALL.lifeSteps) return null;
  const x = fb.x + fb.vx * STEP;
  if (squareBlocked(world, x, fb.y, FIREBALL.size)) return null;
  const vy1 = fb.vy + FIREBALL.gravity * STEP;
  let y = fb.y + ((fb.vy + vy1) / 2) * STEP;
  let vy = vy1;
  if (squareBlocked(world, x, y, FIREBALL.size)) {
    if (vy1 <= 0) return null; // moving up into a ceiling
    y = Math.floor((y - EDGE) / TILE) * TILE; // on top of the tile it landed on
    vy = -BOUNCE_SPEED;
  }
  if (y - FIREBALL.size > world.height * TILE) return null;
  return { x, y, vx: fb.vx, vy, age };
}
