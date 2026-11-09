import { HIT_STOP } from '../config/tuning';
import type { RunState } from './run';

/**
 * GDD-BOS-01: the steps the scene's loop holds still after the step `before` to `after`: `HIT_STOP.defeatSteps` when a hit on a boss
 * (Don Zopilote or La Estrella) defeated him, `HIT_STOP.hurtSteps` when it left him hurt, else 0. A hit is one more `hits` on the boss;
 * a level has one boss or the other. No step runs during the hold, so `stepRun` and the run's state know nothing of it.
 */
export function hitStopSteps(before: RunState, after: RunState): number {
  if (before.boss && after.boss && after.boss.hits > before.boss.hits) return after.boss.mode === 'defeated' ? HIT_STOP.defeatSteps : HIT_STOP.hurtSteps;
  if (before.estrella && after.estrella && after.estrella.hits > before.estrella.hits) return after.estrella.mode === 'defeated' ? HIT_STOP.defeatSteps : HIT_STOP.hurtSteps;
  return 0;
}
