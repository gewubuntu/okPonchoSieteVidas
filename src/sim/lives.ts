// GDD-LIFE-01 to GDD-LIFE-05: the seven-lives rules as pure state. No Phaser (GDD-TEC-02).
// Respawn timing, invulnerability and the HUD are separate GDD items and are not handled here.
import { LIVES_MAX } from '../config/tuning';

export interface LivesState {
  /** 0 to LIVES_MAX (GDD-LIFE-01). */
  readonly lives: number;
  /** Ofrendas and veladoras already used in this world. Each gives at most one life (GDD-LIFE-03). */
  readonly used: ReadonlySet<string>;
}

/** GDD-LIFE-01 and GDD-LIFE-05: a world starts with all seven lives. Lives carry across its levels and boss. */
export function startWorld(): LivesState {
  return { lives: LIVES_MAX, used: new Set() };
}

/** GDD-LIFE-02: losing a life never goes below zero. */
export function loseLife(s: LivesState): LivesState {
  return { ...s, lives: Math.max(0, s.lives - 1) };
}

function restoreOnce(s: LivesState, id: string): LivesState {
  if (s.used.has(id)) return s;
  return { lives: Math.min(LIVES_MAX, s.lives + 1), used: new Set(s.used).add(id) };
}

/** GDD-LIFE-03: the first activation of an ofrenda restores 1 life if fewer than 7. It is used up either way. */
export const activateOfrenda = (s: LivesState, ofrendaId: string): LivesState => restoreOnce(s, `ofrenda:${ofrendaId}`);

/** GDD-LIFE-03: a veladora restores 1 life if fewer than 7. It is used up either way. */
export const collectVeladora = (s: LivesState, veladoraId: string): LivesState => restoreOnce(s, `veladora:${veladoraId}`);

/** GDD-LIFE-04: exactly one life left. */
export const isLastLife = (s: LivesState): boolean => s.lives === 1;

/** GDD-LIFE-05: all seven spent. The world restarts with `startWorld()`. */
export const isOutOfLives = (s: LivesState): boolean => s.lives === 0;
