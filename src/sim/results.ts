// GDD-UI-02, GDD-PRG-03: what the level clear screen says: the clear time, the medal and how many lines have appeared. Pure logic,
// no Phaser (GDD-TEC-02). The scene draws it.
import { BASE_WIDTH, MEDAL, RESULTS, TICK_HZ } from '../config/tuning';
import { hilosCollected } from './hilo';
import type { Level, RunState } from './run';

export type Medal = 'bronze' | 'silver' | 'gold';

/** The longest time shown, 99:59, in whole seconds. */
const MAX_SECONDS = 99 * 60 + 59;

/** GDD-UI-02: the clear time as "Time 2:14", `word` in the language in use, from the steps counted: minutes and whole seconds, rounded down, 99:59 at most. */
export function clearTime(steps: number, word: string): string {
  const seconds = Math.min(MAX_SECONDS, Math.floor(steps / TICK_HZ));
  return `${word} ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/** GDD-PRG-03: gold for every hilo and `goldLives` lives or more left at the exit, silver for every hilo, bronze otherwise. */
export function medal(run: RunState, level: Level): Medal {
  const all = hilosCollected(run.hilosTaken) === (level.hilos?.length ?? 0);
  if (all && run.lives.lives >= MEDAL.goldLives) return 'gold';
  return all ? 'silver' : 'bronze';
}

/** GDD-UI-02: how many of the hilo, time and medal lines are shown, 0 to 3. A press that skipped the reveal shows all three. */
export function revealedLines(run: RunState): number {
  if (run.revealAll) return RESULTS.revealSteps.length;
  return RESULTS.revealSteps.filter((s) => s <= run.wait).length;
}

/** GDD-UI-02: the medal line's disc (its middle) and its text (its left edge), `MEDAL.gapPx` apart, centred together on the screen. */
export function medalLine(textWidth: number): { discX: number; textX: number } {
  const left = BASE_WIDTH / 2 - (MEDAL.discPx + MEDAL.gapPx + textWidth) / 2;
  return { discX: left + MEDAL.discPx / 2, textX: left + MEDAL.discPx + MEDAL.gapPx };
}
