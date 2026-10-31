// GDD-UI-02, GDD-PRG-03: what the level clear screen says: the clear time, the medal, how many lines have appeared and the results
// menu. Pure logic, no Phaser (GDD-TEC-02). The scene draws it.
import { BASE_WIDTH, GAME_OVER, MEDAL, RESULTS, TICK_HZ } from '../config/tuning';
import { hilosCollected } from './hilo';
import { pauseEvent, PLAYING, type PauseEvent, type PauseState } from './pause';
import type { Level, RunState } from './run';
import type { Settings } from './settings';

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

export type ResultsItem = 'next' | 'retry' | 'quit';
const ITEMS: readonly ResultsItem[] = ['next', 'retry', 'quit'];

export interface ResultsMenu {
  readonly choice: ResultsItem;
}

/** GDD-UI-02: the menu opens on "Next level", or on "Retry" where the level names no next level (that row is greyed out). */
export const openResults = (hasNext: boolean): ResultsMenu => ({ choice: hasNext ? 'next' : 'retry' });

/** GDD-UI-02: whether the results menu is up: on the level clear screen from its first 1.0 s on. */
export const resultsShown = (run: RunState): boolean => run.phase === 'clear' && run.wait >= GAME_OVER.lockoutSteps;

/**
 * GDD-UI-02: one frame of events on the level clear screen while the results menu is up, in order, threaded through the pause
 * (`pauseEvent`). While not paused: menuUp and menuDown choose (no wrap-around; "Next level" cannot be chosen when `hasNext` is
 * false), `pick` picks the chosen row, a Tap on a row picks it at once (a tap on a greyed "Next level" does nothing); Escape, P, the
 * pause button, the gamepad's start, blur and a phone turned upright pause. While paused every event goes to the pause (resume, its
 * menu, its settings screen, Quit to title). After a pick or a quit the rest of the frame only tracks the orientation, like `pauseFrame`.
 */
export function resultsFrame(
  pause: PauseState,
  menu: ResultsMenu,
  events: readonly PauseEvent[],
  hasNext: boolean,
  settings: Settings,
): { pause: PauseState; menu: ResultsMenu; settings: Settings; pick: ResultsItem | null; quit: boolean; portrait: boolean } {
  const first = hasNext ? 0 : 1;
  let state = pause;
  let current = menu;
  let values = settings;
  for (let i = 0; i < events.length; i++) {
    const event = events[i]!;
    if (!state.paused) {
      const at = ITEMS.indexOf(current.choice);
      if (event === 'menuUp' || event === 'menuDown') {
        current = { choice: ITEMS[event === 'menuUp' ? Math.max(first, at - 1) : Math.min(ITEMS.length - 1, at + 1)]! };
        continue;
      }
      const row = event === 'pick' ? current.choice : typeof event === 'object' ? event.results : null;
      if (row !== null && (hasNext || row !== 'next')) return { pause: state, menu: current, settings: values, pick: row, quit: false, portrait: orientationAfter(events, i) };
    }
    const result = pauseEvent(state, event, values);
    if (result === 'quit') return { pause: PLAYING, menu: current, settings: values, pick: null, quit: true, portrait: orientationAfter(events, i) };
    state = result.state;
    values = result.settings;
  }
  return { pause: state, menu: current, settings: values, pick: null, quit: false, portrait: state.portrait };
}

/** Whether the phone is upright at the end of the frame, from the events after `i`: a pick needs the menu shown, so it was sideways when it came. */
function orientationAfter(events: readonly PauseEvent[], i: number): boolean {
  let portrait = false;
  for (const e of events.slice(i + 1)) {
    if (e === 'portrait') portrait = true;
    else if (e === 'landscape') portrait = false;
  }
  return portrait;
}
