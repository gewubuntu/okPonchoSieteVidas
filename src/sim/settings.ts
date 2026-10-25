// GDD-UI-02: the settings screen. Pure, no Phaser: the scene hands over the pause events since the last frame and draws the result.
import { VOLUME } from '../config/tuning';
import type { PauseEvent } from './pause';

/** The two volumes, each a whole number of shares from 0 to `VOLUME.steps` (GDD-UI-02, GDD-AUD-01). */
export interface Settings {
  readonly master: number;
  readonly effects: number;
}

export const DEFAULT_SETTINGS: Settings = { master: VOLUME.default, effects: VOLUME.default };

export type SettingsRow = 'master' | 'effects' | 'back';
export const SETTINGS_ROWS: readonly SettingsRow[] = ['master', 'effects', 'back'];

const clamp = (v: number): number => Math.max(0, Math.min(VOLUME.steps, v));

/** One volume row moved by `delta` shares; any other row changes nothing. */
function nudge(settings: Settings, row: SettingsRow, delta: number): Settings {
  if (row === 'back') return settings;
  return { ...settings, [row]: clamp(settings[row] + delta) };
}

/**
 * One event on the open settings screen, which only the sideways screen takes (callers handle orientation). Up and Down choose
 * a row (no wrap-around), Left and Right move the chosen volume, Enter, Space or Z picks Back, Escape, P and the pause button
 * leave. A tap on a volume row chooses it and moves it by its half; a tap on Back leaves; any other tap does nothing.
 * `'back'` when the event leaves the screen.
 */
export function settingsEvent(row: SettingsRow, settings: Settings, event: PauseEvent): { row: SettingsRow; settings: Settings } | 'back' {
  const index = SETTINGS_ROWS.indexOf(row);
  if (typeof event === 'object') {
    const tap = event.settings;
    if (tap === null) return { row, settings };
    if (tap.row === 'back') return 'back';
    return { row: tap.row, settings: nudge(settings, tap.row, tap.side === 'left' ? -1 : 1) };
  }
  switch (event) {
    case 'menuUp':
      return { row: SETTINGS_ROWS[Math.max(0, index - 1)]!, settings };
    case 'menuDown':
      return { row: SETTINGS_ROWS[Math.min(SETTINGS_ROWS.length - 1, index + 1)]!, settings };
    case 'menuLeft':
      return { row, settings: nudge(settings, row, -1) };
    case 'menuRight':
      return { row, settings: nudge(settings, row, 1) };
    case 'pick':
      return row === 'back' ? 'back' : { row, settings };
    case 'key':
    case 'button':
      return 'back';
    default: // blur, portrait, landscape
      return { row, settings };
  }
}

/** GDD-UI-02, GDD-AUD-01: every sound effect plays at Master times Effects, each a share of `VOLUME.steps`. */
export const sfxVolume = (s: Settings): number => (s.master / VOLUME.steps) * (s.effects / VOLUME.steps);
