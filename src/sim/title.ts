// GDD-UI-02: the title screen. Pure, no Phaser: each frame the scene hands over the pause events since the last frame (a tap,
// the pause button, Escape or P, the menu keys, focus and orientation) and the game buttons down now.
import { TAP_OFF, type PauseEvent } from './pause';
import { DEFAULT_SETTINGS, settingsEvent, type Settings, type SettingsRow } from './settings';

/** The title menu's two items (GDD-UI-02). */
export type TitleItem = 'start' | 'settings';

export interface TitleState {
  readonly shown: boolean;
  /** A phone held upright: nothing starts until it is turned sideways. */
  readonly portrait: boolean;
  /** The game buttons down on the last frame, as `buttonsDown` bits; only a new press starts. */
  readonly buttonsHeld: number;
  /** The chosen menu item. The title opens on `start`. */
  readonly choice: TitleItem;
  /** The chosen row of the settings screen, or null while it is closed. It opens on `master`, every time. */
  readonly settings: SettingsRow | null;
}

export const TITLE: TitleState = { shown: true, portrait: false, buttonsHeld: 0, choice: 'start', settings: null };

/**
 * The game buttons whose new press starts the level (GDD-UI-02), as `buttonsDown` bits: left 2, right 4, claw 8, Fuego 16. Not
 * jump (bit 1): Space and Z pick, Up and W choose.
 */
const START_BITS = 2 | 4 | 8 | 16;

/**
 * One frame of the title screen, the events in order. Up and Down choose Start or Settings (no wrap-around); Enter, Space or Z
 * picks. Picking Start, a tap or click anywhere off the Settings row, the pause button's place too, or a new press of claw, Fuego,
 * Left or Right starts the level, if the frame ends sideways with the settings screen closed. Picking Settings or a tap on its row
 * opens the settings screen (see `settingsEvent`). Escape, P and losing focus do nothing on the menu.
 */
export function titleFrame(state: TitleState, events: readonly PauseEvent[], down: number, settings: Settings = DEFAULT_SETTINGS): { state: TitleState; settings: Settings } {
  if (!state.shown) return { state, settings };
  let { portrait, choice } = state;
  let row = state.settings;
  let values = settings;
  let pressed = false;
  // Whether the settings screen was open at any time in the frame: a game button pressed while it was open is no start.
  let opened = row !== null;
  for (const e of events) {
    if (e === 'portrait') portrait = true;
    else if (e === 'landscape') portrait = false;
    else if (portrait) {
      // Upright nothing is chosen, picked or opened, but a tap or the pause button's place still counts as a start press.
      if (typeof e === 'object' || e === 'button') pressed = true;
    } else if (row !== null) {
      // The pause button is hidden on the title, so its place is a plain spot on the settings screen.
      const result = settingsEvent(row, values, e === 'button' ? TAP_OFF : e);
      if (result === 'back') {
        row = null;
        choice = 'settings';
      } else {
        row = result.row;
        values = result.settings;
      }
    } else if (e === 'menuUp') choice = 'start';
    else if (e === 'menuDown') choice = 'settings';
    else if (e === 'pick') {
      if (choice === 'settings') row = 'master';
      else pressed = true;
      opened ||= row !== null;
    } else if (typeof e === 'object') {
      if (e.title === 'settings') row = 'master';
      else pressed = true;
      opened ||= row !== null;
    } else if (e === 'button') pressed = true;
  }
  // A start counts only in a frame that ends sideways with the settings screen closed, so a tap and a turn upright in one
  // frame do not start the level, and a game button held through the settings screen, or pressed while it was open in this frame,
  // is no new press after it.
  const newPress = !opened && (down & ~state.buttonsHeld & START_BITS) !== 0;
  const start = !portrait && row === null && (pressed || newPress);
  return { state: { shown: !start, portrait, buttonsHeld: down, choice, settings: row }, settings: values };
}

/**
 * Quitting to the title from the pause menu (GDD-UI-02): shown again, on Start, waiting for a press. The buttons down now count as
 * held, so the one that picked does not start the level.
 */
export function titleAfterQuit(portrait: boolean, down: number): TitleState {
  return { shown: true, portrait, buttonsHeld: down, choice: 'start', settings: null };
}

/** The prompt line: upright, it asks to turn the device sideways, set larger since the whole level is drawn small. Sideways it is empty. */
export function titlePrompt(portrait: boolean): { text: string; size: number } {
  return { text: portrait ? 'Turn your device sideways' : '', size: 12 };
}
