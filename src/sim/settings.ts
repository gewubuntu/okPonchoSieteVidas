// GDD-UI-02: the settings screen. Pure, no Phaser: the scene hands over the pause events since the last frame and draws the result.
import { VOLUME } from '../config/tuning';
import type { PauseEvent } from './pause';

/** The languages of the game, in the order the Language row goes through them (GDD-UI-02). */
export type Language = 'en' | 'es' | 'de';
export const LANGUAGES: readonly Language[] = ['en', 'es', 'de'];

/** The steps of the Button opacity row, in the order it goes through them (GDD-CTL-03, GDD-UI-02). */
export type ButtonOpacity = 'low' | 'medium' | 'high';
export const BUTTON_OPACITIES: readonly ButtonOpacity[] = ['low', 'medium', 'high'];

/** The steps of the Layout row, in the order it goes through them (GDD-CTL-03, GDD-UI-02). */
export type TouchLayout = 'standard' | 'mirrored';
export const TOUCH_LAYOUTS: readonly TouchLayout[] = ['standard', 'mirrored'];

/** The two volumes, each a whole number of shares from 0 to `VOLUME.steps`, the language, the touch buttons' opacity and the touch layout (GDD-UI-02, GDD-AUD-01, GDD-CTL-03). */
export interface Settings {
  readonly master: number;
  readonly effects: number;
  readonly language: Language;
  readonly buttonOpacity: ButtonOpacity;
  readonly layout: TouchLayout;
}

export const DEFAULT_SETTINGS: Settings = { master: VOLUME.default, effects: VOLUME.default, language: 'en', buttonOpacity: 'medium', layout: 'standard' };

export type SettingsRow = 'master' | 'effects' | 'language' | 'buttonOpacity' | 'layout' | 'back';
export const SETTINGS_ROWS: readonly SettingsRow[] = ['master', 'effects', 'language', 'buttonOpacity', 'layout', 'back'];

const clamp = (v: number): number => Math.max(0, Math.min(VOLUME.steps, v));

/** One volume row moved by `delta` shares, or the language, Button opacity or Layout row by `delta` places (no wrap-around); Back changes nothing. */
function nudge(settings: Settings, row: SettingsRow, delta: number): Settings {
  if (row === 'back') return settings;
  if (row === 'language') {
    const i = Math.max(0, Math.min(LANGUAGES.length - 1, LANGUAGES.indexOf(settings.language) + delta));
    return { ...settings, language: LANGUAGES[i]! };
  }
  if (row === 'buttonOpacity') {
    const i = Math.max(0, Math.min(BUTTON_OPACITIES.length - 1, BUTTON_OPACITIES.indexOf(settings.buttonOpacity) + delta));
    return { ...settings, buttonOpacity: BUTTON_OPACITIES[i]! };
  }
  if (row === 'layout') {
    const i = Math.max(0, Math.min(TOUCH_LAYOUTS.length - 1, TOUCH_LAYOUTS.indexOf(settings.layout) + delta));
    return { ...settings, layout: TOUCH_LAYOUTS[i]! };
  }
  return { ...settings, [row]: clamp(settings[row] + delta) };
}

/**
 * GDD-UI-02, the first language: the first of the browser's languages whose main part (before any "-", in any case) is en, es or
 * de decides; none gives English.
 */
export function browserLanguage(languages: readonly string[]): Language {
  for (const tag of languages) {
    const main = tag.split('-')[0]!.toLowerCase();
    const found = LANGUAGES.find((l) => l === main);
    if (found !== undefined) return found;
  }
  return 'en';
}

/**
 * One event on the open settings screen, which only the sideways screen takes (callers handle orientation). Up and Down choose
 * a row (no wrap-around), Left and Right move the chosen volume, the language, the Button opacity or the Layout, Enter, Space or Z picks Back, Escape, P, the pause button
 * and the gamepad's start leave. A tap on a volume, the language, the Button opacity or the Layout row chooses it and moves it by its half; a tap on Back leaves; any other tap does nothing.
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
    case 'start':
      return 'back';
    default: // blur, portrait, landscape
      return { row, settings };
  }
}

/** GDD-UI-02, GDD-AUD-01: every sound effect plays at Master times Effects, each a share of `VOLUME.steps`. */
export const sfxVolume = (s: Settings): number => (s.master / VOLUME.steps) * (s.effects / VOLUME.steps);
