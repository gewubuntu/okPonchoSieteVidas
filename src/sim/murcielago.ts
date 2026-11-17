// GDD-ENM-04: the Murciélago (bat), World 3's basic enemy. It flies a fixed loop round the middle the level gives, where its own steps say,
// and never reacts to Poncho; it ignores tiles, awnings, cordeles and rails. It has no telegraph and one state, flying. Its sound and a row
// of bats (3-3) are not built yet. Pure logic, no Phaser (GDD-TEC-02).
import { MURCIELAGO } from '../config/tuning';
import type { Enemy, EnemyState } from './enemy';

/** A Murciélago's loop: the steps it has flown since the level start or the last respawn, and the y of its middle. */
export interface Loop {
  readonly steps: number;
  readonly y: number;
}

/**
 * Where its middle is after `steps` steps: the loop's middle plus (`rx` cos a, `ry` sin a), a = 2π (steps + phase) / MURCIELAGO.periodSteps.
 * Screen y grows downward, so a quarter loop after a = 0 it is at its lowest. Each of `rx`, `ry` and `phase` left out is 0.
 */
export function murcielagoAt(def: Enemy, steps: number): { x: number; y: number } {
  const a = (2 * Math.PI * ((steps + (def.phase ?? 0)) % MURCIELAGO.periodSteps)) / MURCIELAGO.periodSteps;
  return { x: def.x + (def.rx ?? 0) * Math.cos(a), y: def.y + (def.ry ?? 0) * Math.sin(a) };
}

/** How a Murciélago starts, and how it is after a lost life: at its `phase`, its steps counted from 0, heading right. */
export function freshMurcielago(def: Enemy): EnemyState {
  const at = murcielagoAt(def, 0);
  return { x: at.x, dir: 1, alive: true, loop: { steps: 0, y: at.y } };
}

/** A Murciélago's step (GDD-ENM-04): one step further round its loop. It faces the way it moves across, and keeps its facing on a step it does not. */
export function stepMurcielago(def: Enemy, state: EnemyState): EnemyState {
  const steps = state.loop!.steps + 1;
  const at = murcielagoAt(def, steps);
  const dir = at.x > state.x ? 1 : at.x < state.x ? -1 : state.dir;
  return { ...state, x: at.x, dir, loop: { steps, y: at.y } };
}
