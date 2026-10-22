// GDD-UI-02: pausing the level. Pure, no Phaser: the scene turns key, pointer, focus and orientation events into
// `PauseEvent`s and stops stepping the simulation while `paused` is true.
import { buttonsDown, type RunState } from './run';
import type { PlayerInput } from './movement';

export interface PauseState {
  readonly paused: boolean;
  /** A phone held upright: the game stays paused until it is turned sideways again. */
  readonly portrait: boolean;
}

/**
 * - `key`: Escape or P. `button`: the touch pause button. Both pause, and resume when paused.
 * - `tap`: a tap or click anywhere. It only resumes; while playing a tap is game input.
 * - `blur`: the tab or window lost focus or was hidden. It pauses and never resumes by itself.
 * - `portrait` / `landscape`: a phone turned upright pauses; turning it back allows a resume but does not resume.
 */
export type PauseEvent = 'key' | 'button' | 'tap' | 'blur' | 'portrait' | 'landscape';

export const PLAYING: PauseState = { paused: false, portrait: false };

export function pauseEvent(state: PauseState, event: PauseEvent): PauseState {
  switch (event) {
    case 'key':
    case 'button':
      if (!state.paused) return { ...state, paused: true };
      return state.portrait ? state : { ...state, paused: false };
    case 'tap':
      return state.paused && !state.portrait ? { ...state, paused: false } : state;
    case 'blur':
      return { ...state, paused: true };
    case 'portrait':
      return { paused: true, portrait: true };
  }
  // 'landscape'
  return { ...state, portrait: false };
}

/** Only on a touch device: a desktop window made taller than wide is not a phone turned upright. */
export const isPortrait = (width: number, height: number, touch: boolean): boolean => touch && height > width;

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
