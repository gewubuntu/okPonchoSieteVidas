import { BOSS, SHAKE } from '../config/tuning';
import type { Level, RunState } from './run';

/** GDD-BOS-01: what starts a shake: its size in px, how many steps it lasts, and whether it dies away over them. */
export interface ShakeDef {
  readonly px: number;
  readonly steps: number;
  readonly dying: boolean;
}

/** A shake running: its definition and how many steps it has run (0 on the step it starts). */
export interface Shake extends ShakeDef {
  readonly age: number;
}

/**
 * GDD-BOS-01: the shake the step `before` to `after` starts in `level`, or null. La Estrella: a drop that ends on an awning (drop to
 * bounce) or on the floor (drop to rest), the tear (`tore` turning true), her defeated pot reaching the floor (her bottom, `y`, at
 * `floor`). Don Zopilote: a dive that sticks (dive to stuck), his defeated body reaching the floor (his middle, `y`, at `floor` less half
 * his height). A hit on a boss starts none. A step that starts two (no real arena can) starts the bigger. Drawn only: the simulation never
 * reads a shake.
 */
export function shakeStarts(before: RunState, after: RunState, level: Level): ShakeDef | null {
  const found: ShakeDef[] = [];
  const e0 = before.estrella;
  const e1 = after.estrella;
  if (e0 && e1 && level.estrella) {
    if (e0.mode === 'drop' && e1.mode === 'bounce') found.push(SHAKE.estrellaAwning);
    if (e0.mode === 'drop' && e1.mode === 'rest') found.push(SHAKE.estrellaFloor);
    if (!e0.tore && e1.tore) found.push(SHAKE.estrellaTear);
    if (e0.mode === 'defeated' && e1.mode === 'defeated' && e0.y < level.estrella.floor && e1.y >= level.estrella.floor) found.push(SHAKE.estrellaDefeat);
  }
  const b0 = before.boss;
  const b1 = after.boss;
  if (b0 && b1 && level.boss) {
    if (b0.mode === 'dive' && b1.mode === 'stuck') found.push(SHAKE.bossStuck);
    const lying = level.boss.floor - BOSS.height / 2;
    if (b0.mode === 'defeated' && b1.mode === 'defeated' && b0.y < lying && b1.y >= lying) found.push(SHAKE.bossDefeat);
  }
  return found.reduce<ShakeDef | null>((best, s) => (best === null || s.px > best.px ? s : best), null);
}

/** The size in px of a shake now: all of `px` for one that holds, `px * (1 - age / steps)` rounded up for one that dies away. */
export const shakeSize = (s: Shake): number => (s.dying ? Math.ceil(s.px * (1 - s.age / s.steps)) : s.px);

/**
 * One step of the running shake (age + 1, gone once it has run its steps), then the shake `start` that this step starts: it replaces what is
 * left when it is at least as big as the running shake's size now, else it is dropped. A new shake starts at age 0, so it is drawn on the
 * frame of the step that started it.
 */
export function nextShake(running: Shake | null, start: ShakeDef | null): Shake | null {
  const aged = running === null || running.age + 1 >= running.steps ? null : { ...running, age: running.age + 1 };
  if (start !== null && (aged === null || start.px >= shakeSize(aged))) return { ...start, age: 0 };
  return aged;
}

/** How far down the world is drawn, in px (negative: up): down for `SHAKE.flipSteps` steps, then up for as many, and so on. 0 with the Screen shake row Off (`on` false). */
export function shakeOffset(s: Shake | null, on: boolean): number {
  if (s === null || !on) return 0;
  return shakeSize(s) * (Math.floor(s.age / SHAKE.flipSteps) % 2 === 0 ? 1 : -1);
}
