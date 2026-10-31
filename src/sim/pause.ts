// GDD-UI-02: pausing the level. Pure, no Phaser: the scene turns key, pointer, focus and orientation events into
// `PauseEvent`s and stops stepping the simulation while `paused` is true.
import { buttonsDown, type RunState } from './run';
import type { PlayerInput } from './movement';
import { DEFAULT_SETTINGS, settingsEvent, type Settings, type SettingsRow } from './settings';
import type { ResultsItem } from './results';
import type { TitleItem } from './title';

/** The pause menu's three items (GDD-UI-02). */
export type MenuItem = 'resume' | 'settings' | 'quit';
const MENU_ITEMS: readonly MenuItem[] = ['resume', 'settings', 'quit'];

export interface PauseState {
  readonly paused: boolean;
  /** A phone held upright: the game stays paused until it is turned sideways again. */
  readonly portrait: boolean;
  /** The chosen menu item. Every pause opens on `resume`. */
  readonly choice: MenuItem;
  /** The chosen row of the settings screen, or null while it is closed. It opens on `master`, every time. */
  readonly settings: SettingsRow | null;
}

/**
 * Where a tap or click went down, on every menu at once. The scene classifies it by place, never by state; the state it
 * reaches decides which menu reads it, so an Escape and a tap in one frame apply in order.
 */
export interface Tap {
  readonly pause: MenuItem | null;
  readonly title: TitleItem | null;
  readonly results: ResultsItem | null;
  readonly settings: { readonly row: SettingsRow; readonly side: 'left' | 'right' } | null;
}

/** A tap off every row. */
export const TAP_OFF: Tap = { pause: null, title: null, results: null, settings: null };

/**
 * - `key`: Escape or P. `button`: the touch pause button. Both pause, and resume when paused (leave the settings screen when it is open).
 * - `start`: the gamepad's start button: like `key`, and it starts the level on the title (GDD-CTL-02).
 * - A `Tap`: a tap or click, by place. While playing it is game input. On the pause menu it resumes, except on the Settings row
 *   (opens settings) and the Quit to title row (quits); on the settings screen see `settingsEvent`.
 * - `menuUp` / `menuDown`: Up or W, Down or S choose the item above or below (no wrap-around). `menuLeft` / `menuRight`: Left or A,
 *   Right or D, which change a volume on the settings screen. `pick`: Enter, Space or Z picks the chosen item.
 * - `blur`: the tab or window lost focus or was hidden. It pauses and never resumes by itself.
 * - `portrait` / `landscape`: a phone turned upright pauses; turning it back allows a resume but does not resume.
 */
export type PauseEvent = 'key' | 'button' | 'start' | 'menuUp' | 'menuDown' | 'menuLeft' | 'menuRight' | 'pick' | 'blur' | 'portrait' | 'landscape' | Tap;

export const PLAYING: PauseState = { paused: false, portrait: false, choice: 'resume', settings: null };

/** The settings screen opens on Master volume, every time. */
const openSettings = (state: PauseState): PauseState => ({ ...state, settings: 'master' });

/**
 * One event, with the settings values it may change. `'quit'` when it picks Quit to title. Resuming goes back to `PLAYING`, so
 * the next pause opens on Resume with the settings screen closed.
 */
export function pauseEvent(state: PauseState, event: PauseEvent, settings: Settings = DEFAULT_SETTINGS): { state: PauseState; settings: Settings } | 'quit' {
  const same = { state, settings };
  if (event === 'blur') return { state: { ...state, paused: true }, settings };
  if (event === 'portrait') return { state: { ...state, paused: true, portrait: true }, settings };
  if (event === 'landscape') return { state: { ...state, portrait: false }, settings };
  if (!state.paused) return event === 'key' || event === 'button' || event === 'start' ? { state: { ...state, paused: true }, settings } : same;
  // The menus can be chosen from and picked on only while shown: paused, and not upright.
  if (state.portrait) return same;
  if (state.settings !== null) {
    const result = settingsEvent(state.settings, settings, event);
    if (result === 'back') return { state: { ...state, settings: null, choice: 'settings' }, settings };
    return { state: { ...state, settings: result.row }, settings: result.settings };
  }
  if (typeof event === 'object') {
    if (event.pause === 'settings') return { state: openSettings(state), settings };
    return event.pause === 'quit' ? 'quit' : { state: PLAYING, settings };
  }
  switch (event) {
    case 'key':
    case 'button':
    case 'start':
      return { state: PLAYING, settings };
    case 'menuUp':
      return { state: { ...state, choice: MENU_ITEMS[Math.max(0, MENU_ITEMS.indexOf(state.choice) - 1)]! }, settings };
    case 'menuDown':
      return { state: { ...state, choice: MENU_ITEMS[Math.min(MENU_ITEMS.length - 1, MENU_ITEMS.indexOf(state.choice) + 1)]! }, settings };
    case 'pick':
      if (state.choice === 'quit') return 'quit';
      return { state: state.choice === 'settings' ? openSettings(state) : PLAYING, settings };
  }
  return same; // menuLeft, menuRight
}

/**
 * One frame of pause events, applied in order, threading the settings values. After a quit the rest of the frame only tracks the
 * orientation, so a press after the pick does nothing, but a turn upright still shows. `portrait` is the orientation at the end
 * of the frame.
 */
export function pauseFrame(
  state: PauseState,
  events: readonly PauseEvent[],
  settings: Settings = DEFAULT_SETTINGS,
): { state: PauseState; quit: boolean; portrait: boolean; settings: Settings } {
  let current = state;
  let values = settings;
  for (let i = 0; i < events.length; i++) {
    const next = pauseEvent(current, events[i]!, values);
    if (next !== 'quit') {
      current = next.state;
      values = next.settings;
      continue;
    }
    // A pick needs the menu shown, so the phone is sideways when it comes.
    let portrait = false;
    for (const e of events.slice(i + 1)) {
      if (e === 'portrait') portrait = true;
      else if (e === 'landscape') portrait = false;
    }
    return { state: PLAYING, quit: true, portrait, settings: values };
  }
  return { state: current, quit: false, portrait: current.portrait, settings: values };
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
