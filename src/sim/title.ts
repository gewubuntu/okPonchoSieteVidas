// GDD-UI-02: the title screen. Pure, no Phaser: each frame the scene hands over the pause events since the last frame (a tap,
// the pause button, Escape or P, the menu keys, focus and orientation) and the game buttons down now.
import { TAP_OFF, type PauseEvent } from './pause';
import { DEFAULT_SETTINGS, settingsEvent, type Settings, type SettingsRow } from './settings';

/** The title menu's three items, in order (GDD-UI-02). */
export type TitleItem = 'start' | 'tutorial' | 'settings';

/** The items in menu order: Up chooses the one before, Down the one after. */
const ITEMS: readonly TitleItem[] = ['start', 'tutorial', 'settings'];

/** What starts the game from the title (GDD-UI-02): "Start" plays what it plays, "Tutorial" always plays 0-1. */
export type TitleStart = 'start' | 'tutorial';

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
 * One frame of the title screen, the events in order. Up and Down choose the item above or below (Start, Tutorial, Settings; no
 * wrap-around); Enter, Space or Z picks. Picking Tutorial or a tap on its row starts with the tutorial; picking Start, a tap or
 * click anywhere off the Tutorial and Settings rows, the pause button's place too, or a new press of claw, Fuego, Left or Right
 * starts with Start, if the frame ends sideways with the settings screen closed. When several start events land in one frame the
 * last one decides; a new game-button press counts as Start only when no start event came. Picking Settings or a tap on its row
 * opens the settings screen (see `settingsEvent`). Start on a gamepad starts too, but on the settings screen it leaves it (GDD-CTL-02).
 * Escape, P and losing focus do nothing on the menu. `start` is null while the title stays up.
 */
export function titleFrame(
  state: TitleState,
  events: readonly PauseEvent[],
  down: number,
  settings: Settings = DEFAULT_SETTINGS,
): { state: TitleState; settings: Settings; start: TitleStart | null } {
  if (!state.shown) return { state, settings, start: null };
  let { portrait, choice } = state;
  let row = state.settings;
  let values = settings;
  let pressed: TitleStart | null = null;
  // Whether the settings screen was open at any time in the frame: a game button pressed while it was open is no start.
  let opened = row !== null;
  for (const e of events) {
    if (e === 'portrait') portrait = true;
    else if (e === 'landscape') portrait = false;
    else if (portrait) {
      // Upright nothing is chosen, picked or opened, but a tap or the pause button's place still counts as a start press.
      if (typeof e === 'object' || e === 'button' || e === 'start') pressed = 'start';
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
    } else if (e === 'menuUp') choice = ITEMS[Math.max(ITEMS.indexOf(choice) - 1, 0)]!;
    else if (e === 'menuDown') choice = ITEMS[Math.min(ITEMS.indexOf(choice) + 1, ITEMS.length - 1)]!;
    else if (e === 'pick') {
      if (choice === 'settings') row = 'master';
      else pressed = choice;
      opened ||= row !== null;
    } else if (typeof e === 'object') {
      if (e.title === 'settings') row = 'master';
      else pressed = e.title === 'tutorial' ? 'tutorial' : 'start';
      opened ||= row !== null;
    } else if (e === 'button' || e === 'start') pressed = 'start';
  }
  // A start counts only in a frame that ends sideways with the settings screen closed, so a tap and a turn upright in one
  // frame do not start the level, and a game button held through the settings screen, or pressed while it was open in this frame,
  // is no new press after it.
  const newPress = !opened && (down & ~state.buttonsHeld & START_BITS) !== 0;
  const start = portrait || row !== null ? null : (pressed ?? (newPress ? 'start' : null));
  return { state: { shown: start === null, portrait, buttonsHeld: down, choice, settings: row }, settings: values, start };
}

/**
 * Quitting to the title from the pause menu (GDD-UI-02): shown again, on Start, waiting for a press. The buttons down now count as
 * held, so the one that picked does not start the level.
 */
export function titleAfterQuit(portrait: boolean, down: number): TitleState {
  return { shown: true, portrait, buttonsHeld: down, choice: 'start', settings: null };
}

/**
 * The prompt line: upright, it asks to turn the device sideways (`sideways`, in the language chosen, GDD-UI-02), set larger since the
 * whole level is drawn small. Sideways it is empty.
 */
export function titlePrompt(portrait: boolean, sideways: string): { text: string; size: number } {
  return { text: portrait ? sideways : '', size: 12 };
}
