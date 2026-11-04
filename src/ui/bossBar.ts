// GDD-UI-01: the boss bar of a boss level: the boss's name over one pip per hit that beats him, filled for each hit he has left.
// Pure, no Phaser: the scene draws what this says. A new boss adds its name here and its case in `bossBar`.
import { BOSS, ESTRELLA } from '../config/tuning';
import { levelBoss, type BossId } from '../sim/bossLevel';
import type { Level, RunState } from '../sim/run';
import { bossPips } from './bossPose';
import type { UiText } from './text';

/** GDD-UI-02: the key of each boss's name in `TEXT`. */
export const BOSS_NAMES: Readonly<Record<BossId, keyof UiText>> = { zopilote: 'zopilote', estrella: 'estrella' };

export interface BossBar {
  /** The key of the boss's name in `TEXT`. */
  readonly name: keyof UiText;
  /** The pips drawn: one per hit that beats him. */
  readonly pips: number;
  /** The pips drawn filled: the hits he has left. */
  readonly left: number;
}

/** GDD-UI-01: the boss bar of `run` in `level`, or null where the level has no boss. */
export function bossBar(level: Level, run: RunState): BossBar | null {
  const boss = levelBoss(level);
  if (boss === 'zopilote' && run.boss) return { name: BOSS_NAMES.zopilote, pips: BOSS.hits, left: bossPips(run.boss) };
  // GDD-BOS-03: La Estrella's three pips, one emptied by each hit.
  if (boss === 'estrella' && run.estrella) return { name: BOSS_NAMES.estrella, pips: ESTRELLA.hits, left: ESTRELLA.hits - run.estrella.hits };
  return null;
}
