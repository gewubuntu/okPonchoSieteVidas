// GDD-UI-02: the title screen. Pure, no Phaser: each frame the scene hands over the pause events since the last frame (a
// tap, the pause button, Escape or P, focus and orientation), Enter as 'confirm', and the game buttons down now.
import type { PauseEvent } from './pause';

export interface TitleState {
  readonly shown: boolean;
  /** A phone held upright: nothing starts until it is turned sideways. */
  readonly portrait: boolean;
  /** The game buttons down on the last frame, as `buttonsDown` bits; only a new press starts. */
  readonly buttonsHeld: number;
}

/** A pause event, or `confirm`: Enter. */
export type TitleEvent = PauseEvent | 'confirm';

export const TITLE: TitleState = { shown: true, portrait: false, buttonsHeld: 0 };

/**
 * One frame of the title screen. Enter, a tap or click anywhere (the pause button too) or a new press of any game button
 * starts the level, unless the phone is upright. Escape, P and losing focus do nothing.
 */
export function titleFrame(state: TitleState, events: readonly TitleEvent[], down: number): TitleState {
  if (!state.shown) return state;
  let { portrait } = state;
  let start = false;
  for (const e of events) {
    if (e === 'portrait') portrait = true;
    else if (e === 'landscape') portrait = false;
    else if (e === 'confirm' || e === 'tap' || e === 'button') start ||= !portrait;
  }
  if ((down & ~state.buttonsHeld) !== 0 && !portrait) start = true;
  return { shown: !start, portrait, buttonsHeld: down };
}

/** The prompt line: upright, it asks to turn the device sideways, set larger since the whole level is drawn small. */
export function titlePrompt(portrait: boolean, touch: boolean): { text: string; size: number } {
  if (portrait) return { text: 'Turn your device sideways', size: 12 };
  return { text: touch ? 'Tap to start' : 'Press any button to start', size: 8 };
}
