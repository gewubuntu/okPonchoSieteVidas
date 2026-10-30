// GDD-PRG-02: the save (the settings and whether the tutorial has been started), the first slice of the autosave. Pure: the scene reads and writes the browser's local storage.
import { VOLUME } from '../config/tuning';
import { DEFAULT_SETTINGS, LANGUAGES, type Language, type Settings } from './settings';

/** The local storage key of the save. */
export const SAVE_KEY = 'poncho-siete-vidas';

/** GDD-PRG-02: everything the save holds: the settings, and whether the tutorial 0-1 has been started (GDD-UI-02). */
export interface SaveData {
  readonly settings: Settings;
  readonly tutorialPlayed: boolean;
}

export const DEFAULT_SAVE: SaveData = { settings: DEFAULT_SETTINGS, tutorialPlayed: false };

/** A saved volume: a whole number from 0 to `VOLUME.steps`, else the default alone. */
const volume = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= VOLUME.steps ? value : fallback;

/** A saved language: exactly `en`, `es` or `de`, else the fallback (the browser's, GDD-UI-02) alone. */
const language = (value: unknown, fallback: Language): Language => LANGUAGES.find((l) => l === value) ?? fallback;

/**
 * GDD-PRG-02: the save in a saved text, or the defaults with `fallback` as the language (GDD-UI-02, the first language). Never
 * throws. Only `progress.tutorialPlayed` being exactly true reads as played.
 */
export function readSave(raw: string | null, fallback: Language = 'en'): SaveData {
  const defaults: SaveData = { settings: { ...DEFAULT_SETTINGS, language: fallback }, tutorialPlayed: false };
  if (raw === null) return defaults;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return defaults;
  }
  if (typeof data !== 'object' || data === null) return defaults;
  const { version, settings, progress } = data as { version?: unknown; settings?: unknown; progress?: unknown };
  if (version !== 1 || typeof settings !== 'object' || settings === null) return defaults;
  const saved = settings as { master?: unknown; effects?: unknown; language?: unknown };
  const tutorialPlayed = typeof progress === 'object' && progress !== null && (progress as { tutorialPlayed?: unknown }).tutorialPlayed === true;
  return {
    settings: { master: volume(saved.master, DEFAULT_SETTINGS.master), effects: volume(saved.effects, DEFAULT_SETTINGS.effects), language: language(saved.language, fallback) },
    tutorialPlayed,
  };
}

/** The text to save (version 1). */
export const saveText = (data: SaveData): string =>
  JSON.stringify({
    version: 1,
    settings: { master: data.settings.master, effects: data.settings.effects, language: data.settings.language },
    progress: { tutorialPlayed: data.tutorialPlayed },
  });
