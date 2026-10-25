// GDD-PRG-02: the saved settings, the first slice of the autosave. Pure: the scene reads and writes the browser's local storage.
import { VOLUME } from '../config/tuning';
import { DEFAULT_SETTINGS, type Settings } from './settings';

/** The local storage key of the save. */
export const SAVE_KEY = 'poncho-siete-vidas';

/** A saved volume: a whole number from 0 to `VOLUME.steps`, else the default alone. */
const volume = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= VOLUME.steps ? value : fallback;

/** GDD-PRG-02: the settings in a saved text, or the defaults. Never throws. */
export function readSave(raw: string | null): Settings {
  if (raw === null) return DEFAULT_SETTINGS;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return DEFAULT_SETTINGS;
  }
  if (typeof data !== 'object' || data === null) return DEFAULT_SETTINGS;
  const { version, settings } = data as { version?: unknown; settings?: unknown };
  if (version !== 1 || typeof settings !== 'object' || settings === null) return DEFAULT_SETTINGS;
  const saved = settings as { master?: unknown; effects?: unknown };
  return { master: volume(saved.master, DEFAULT_SETTINGS.master), effects: volume(saved.effects, DEFAULT_SETTINGS.effects) };
}

/** The text to save (version 1). */
export const saveText = (settings: Settings): string => JSON.stringify({ version: 1, settings: { master: settings.master, effects: settings.effects } });
