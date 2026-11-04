// GDD-ENM-03: the Paloma (pigeon), World 2's basic enemy. It walks on tiles and along cordeles (GDD-WLD-11); a Poncho who comes close on
// its level startles it: it telegraphs, flies straight up, hovers and comes back down to where it was. Pure logic, no Phaser (GDD-TEC-02).
import { PALOMA, STEP } from '../config/tuning';
import type { Enemy, EnemyState } from './enemy';
import { hurtbox } from './hazards';
import type { PlayerState } from './movement';
import type { PlatformPos } from './platform';
import type { TileGrid } from './tilemap';
import { walk } from './walker';

/** A Paloma's wing: walking, frozen for its telegraph, rising, hovering or coming back down. */
export interface Wing {
  readonly phase: 'walk' | 'telegraph' | 'rise' | 'hover' | 'descend';
  /** Steps in the current phase. */
  readonly age: number;
  /** How far above its feet on the ground it has flown, in px. */
  readonly lift: number;
}

/** On the ground, walking: how a Paloma starts, and how it is after a lost life. */
export const GROUNDED: Wing = { phase: 'walk', age: 0, lift: 0 };

const EDGE = 1e-6;

/** Rises PALOMA.riseSpeed px a second, hovering once it is PALOMA.riseHeight up. */
const rise = (lift: number): Wing => {
  const up = Math.min(PALOMA.riseHeight, lift + PALOMA.riseSpeed * STEP);
  return up >= PALOMA.riseHeight - EDGE ? { phase: 'hover', age: 0, lift: PALOMA.riseHeight } : { phase: 'rise', age: 0, lift: up };
};

/** Comes down PALOMA.descendSpeed px a second, walking again once it is on the ground. */
const descend = (lift: number, age: number): Wing => {
  const down = lift - PALOMA.descendSpeed * STEP;
  return down <= EDGE ? GROUNDED : { phase: 'descend', age, lift: down };
};

/**
 * A Paloma's step (GDD-ENM-03). It walks at PALOMA.speed like the Alacrán, on tiles and along the cordeles in `cordeles`, turning at
 * walls and at the ends of its ground. When Poncho's hurtbox centre is within PALOMA.sightX of it across, on either side, and his feet
 * within PALOMA.sightY of its own, it stops and freezes for its telegraph (GDD-ENM-01). From the step after, it flies straight up
 * PALOMA.riseHeight, hovers PALOMA.hoverSteps there, and comes back straight down to where it was, then walks on; it may be startled
 * again at once.
 */
export function stepPaloma(def: Enemy, state: EnemyState, world: TileGrid, player: PlayerState, cordeles: readonly PlatformPos[]): EnemyState {
  const w = state.wing!;
  const age = w.age + 1;
  if (w.phase === 'telegraph') return { ...state, wing: age < PALOMA.telegraphSteps ? { ...w, age } : rise(0) };
  if (w.phase === 'rise') {
    const up = rise(w.lift);
    return { ...state, wing: up.phase === 'rise' ? { ...up, age } : up };
  }
  if (w.phase === 'hover') return { ...state, wing: age < PALOMA.hoverSteps ? { ...w, age } : descend(w.lift, 0) };
  if (w.phase === 'descend') return { ...state, wing: descend(w.lift, age) };
  const moved = walk(world, state.x, state.y ?? def.y, state.dir, PALOMA, PALOMA.speed, cordeles);
  const h = hurtbox(player);
  const spotted = Math.abs(h.x + h.w / 2 - moved.x) <= PALOMA.sightX && Math.abs(player.y - moved.y) <= PALOMA.sightY;
  return { ...state, x: moved.x, y: moved.y, dir: moved.dir, wing: spotted ? { phase: 'telegraph', age: 0, lift: 0 } : { ...w, age } };
}
