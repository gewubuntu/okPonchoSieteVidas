// GDD-ENM-03, GDD-CMB-02: the Trompo (spinning top), the first heavy enemy. It spins along the ground and cannot be stomped while it spins;
// a claw swipe or a fireball stuns it (it topples onto its side), and a stomp then defeats it. Pure logic, no Phaser (GDD-TEC-02).
import { TROMPO } from '../config/tuning';
import type { Enemy, EnemyState } from './enemy';
import type { TileGrid } from './tilemap';
import { walk } from './walker';

/** A Trompo's spin: spinning along, or lying stunned. */
export interface Spin {
  readonly phase: 'spin' | 'stunned';
  /** Steps in the current phase. */
  readonly age: number;
}

/** Spinning: how a Trompo starts, how it is after a lost life, and how it gets up after its stun. */
export const SPINNING: Spin = { phase: 'spin', age: 0 };

/** GDD-CMB-02: a claw swipe or a fireball topples it: it lies stunned from this step. */
export const stun = (state: EnemyState): EnemyState => ({ ...state, spin: { phase: 'stunned', age: 0 } });

/**
 * A Trompo's step (GDD-ENM-03). Spinning, it moves at TROMPO.speed and turns at walls and at ledge ends, like the Alacrán. Stunned, it lies
 * still for TROMPO.stunSteps, then gets up spinning the way it faced.
 */
export function stepTrompo(def: Enemy, state: EnemyState, world: TileGrid): EnemyState {
  const s = state.spin!;
  const age = s.age + 1;
  if (s.phase === 'stunned') return { ...state, spin: age < TROMPO.stunSteps ? { ...s, age } : SPINNING };
  const moved = walk(world, state.x, state.y ?? def.y, state.dir, TROMPO, TROMPO.speed);
  return { ...state, x: moved.x, y: moved.y, dir: moved.dir, spin: { ...s, age } };
}
