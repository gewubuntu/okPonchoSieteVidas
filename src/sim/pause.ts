// GDD-UI-02: pausing the level. Pure, no Phaser: the scene turns key, pointer, focus and orientation events into
// `PauseEvent`s and stops stepping the simulation while `paused` is true.
import { buttonsDown, type RunState } from './run';
import type { PlayerInput } from './movement';

/** The pause menu's two items (GDD-UI-02). */
export type MenuItem = 'resume' | 'quit';

export interface PauseState {
  readonly paused: boolean;
  /** A phone held upright: the game stays paused until it is turned sideways again. */
  readonly portrait: boolean;
  /** The chosen menu item. Every pause opens on `resume`. */
  readonly choice: MenuItem;
}

/**
 * - `key`: Escape or P. `button`: the touch pause button. Both pause, and resume when paused.
 * - `tap`: a tap or click anywhere off the menu rows. It only resumes; while playing a tap is game input.
 * - `tapQuit`: a tap or click on the Quit to title row. It quits to the title screen. A tap on the Resume row is a plain `tap`,
 *   which resumes whichever item is chosen.
 * - `menuUp` / `menuDown`: Up or W, Down or S choose Resume or Quit to title (no wrap-around). `pick`: Enter, Space or Z picks the chosen item.
 * - `blur`: the tab or window lost focus or was hidden. It pauses and never resumes by itself.
 * - `portrait` / `landscape`: a phone turned upright pauses; turning it back allows a resume but does not resume.
 */
export type PauseEvent = 'key' | 'button' | 'tap' | 'tapQuit' | 'menuUp' | 'menuDown' | 'pick' | 'blur' | 'portrait' | 'landscape';

export const PLAYING: PauseState = { paused: false, portrait: false, choice: 'resume' };

/** One event. `'quit'` when it picks Quit to title. Resuming goes back to `PLAYING`, so the next pause opens on Resume. */
export function pauseEvent(state: PauseState, event: PauseEvent): PauseState | 'quit' {
  // The menu can be chosen from and picked on only while it is shown: paused, and not upright.
  const open = state.paused && !state.portrait;
  switch (event) {
    case 'key':
    case 'button':
      if (!state.paused) return { ...state, paused: true };
      return open ? PLAYING : state;
    case 'tap':
      return open ? PLAYING : state;
    case 'tapQuit':
      return open ? 'quit' : state;
    case 'menuUp':
      return open ? { ...state, choice: 'resume' } : state;
    case 'menuDown':
      return open ? { ...state, choice: 'quit' } : state;
    case 'pick':
      if (!open) return state;
      return state.choice === 'quit' ? 'quit' : PLAYING;
    case 'blur':
      return { ...state, paused: true };
    case 'portrait':
      return { ...state, paused: true, portrait: true };
  }
  // 'landscape'
  return { ...state, portrait: false };
}

/**
 * One frame of pause events, applied in order. After a quit the rest of the frame only tracks the orientation, so a press
 * after the pick does nothing, but a turn upright still shows. `portrait` is the orientation at the end of the frame.
 */
export function pauseFrame(state: PauseState, events: readonly PauseEvent[]): { state: PauseState; quit: boolean; portrait: boolean } {
  let current = state;
  for (let i = 0; i < events.length; i++) {
    const next = pauseEvent(current, events[i]!);
    if (next !== 'quit') {
      current = next;
      continue;
    }
    // A pick needs the menu shown, so the phone is sideways when it comes.
    let portrait = false;
    for (const e of events.slice(i + 1)) {
      if (e === 'portrait') portrait = true;
      else if (e === 'landscape') portrait = false;
    }
    return { state: PLAYING, quit: true, portrait };
  }
  return { state: current, quit: false, portrait: current.portrait };
}

/**
 * A touch device whose screen is upright. The screen's orientation decides, not the window's shape, so a touchscreen laptop
 * in a tall window is not upright (its screen stays landscape). Where the browser has no screen orientation, the window's
 * shape is used.
 */
export const isPortrait = (orientation: string | undefined, width: number, height: number, touch: boolean): boolean =>
  touch && (orientation === undefined ? height > width : orientation.startsWith('portrait'));

/**
 * On resume, every button down now counts as already held, so a press made while paused (the jump button under the tap that
 * resumed, a key pressed while the game stood still) does nothing until it is released and pressed again. A button held
 * since before the pause stays held, as if there had been no pause.
 */
export function resumeHeld(run: RunState, input: PlayerInput): RunState {
  return {
    ...run,
    player: input.jumpHeld ? { ...run.player, jumpWasHeld: true } : run.player,
    claw: input.claw ? { ...run.claw, held: true } : run.claw,
    fuegoHeld: run.fuegoHeld || (input.fuego ?? false),
    buttonsHeld: run.buttonsHeld | buttonsDown(input),
  };
}
