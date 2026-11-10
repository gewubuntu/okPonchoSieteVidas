// GDD-PRG-02: the save (the settings, whether the tutorial has been started and the progress per level). Pure: the scene reads and writes the browser's local storage.
import { LIVES_MAX, VOLUME } from '../config/tuning';
import { betterMedal, medal, type Medal } from './results';
import type { Level, RunState } from './run';
import { BUTTON_OPACITIES, DEFAULT_SETTINGS, LANGUAGES, SCREEN_SHAKES, TOUCH_LAYOUTS, type ButtonOpacity, type Language, type ScreenShake, type Settings, type TouchLayout } from './settings';

/** The local storage key of the save. */
export const SAVE_KEY = 'poncho-siete-vidas';

/** GDD-PRG-02: what the save keeps of one level: the hilos saved (one flag per hilo, in the level's order), the best medal and best time (steps), and whether it was cleared. */
export interface LevelProgress {
  readonly hilos: readonly boolean[];
  readonly medal: Medal | null;
  readonly bestSteps: number | null;
  readonly cleared: boolean;
}

/**
 * GDD-PRG-02: the saved run, written when the checkpoint moves to a later ofrenda: the level, the position of that ofrenda in the level's order,
 * the lives after its touch, the lives the run started with (GDD-PRG-03), every ofrenda and veladora used so far (as `LivesState.used` holds them), the run's hilos (one flag per hilo, the
 * ones saved for good included) and the clock in steps.
 */
export interface SavedRun {
  readonly level: string;
  readonly checkpoint: number;
  readonly lives: number;
  readonly livesIn: number;
  readonly used: readonly string[];
  readonly hilos: readonly boolean[];
  readonly clock: number;
}

/**
 * GDD-PRG-02: everything the save holds: the settings, whether the tutorial 0-1 has been started (GDD-UI-02), the lives kept per
 * world (GDD-LIFE-05: by the world's number as text, World 1's under "1"; none kept reads as seven), the level each world's run has reached
 * (`worldAt`, GDD-UI-02, GDD-PRG-02: the same keys, a level id; none kept reads as the older rule), the progress per level id and the saved
 * run, if any.
 */
export interface SaveData {
  readonly settings: Settings;
  readonly tutorialPlayed: boolean;
  readonly worldLives: Readonly<Record<string, number>>;
  readonly worldAt: Readonly<Record<string, string>>;
  readonly levels: Readonly<Record<string, LevelProgress>>;
  readonly run: SavedRun | null;
}

export const DEFAULT_SAVE: SaveData = { settings: DEFAULT_SETTINGS, tutorialPlayed: false, worldLives: {}, worldAt: {}, levels: {}, run: null };

const MEDALS: readonly Medal[] = ['bronze', 'silver', 'gold'];

/** A saved volume: a whole number from 0 to `VOLUME.steps`, else the default alone. */
const volume = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= VOLUME.steps ? value : fallback;

/** A saved language: exactly `en`, `es` or `de`, else the fallback (the browser's, GDD-UI-02) alone. */
const language = (value: unknown, fallback: Language): Language => LANGUAGES.find((l) => l === value) ?? fallback;

/** GDD-CTL-03: a saved Button opacity: exactly `low`, `medium` or `high`, else medium alone. */
const buttonOpacity = (value: unknown): ButtonOpacity => BUTTON_OPACITIES.find((o) => o === value) ?? 'medium';

/** GDD-CTL-03: a saved Layout: exactly `standard` or `mirrored`, else standard alone. */
const layout = (value: unknown): TouchLayout => TOUCH_LAYOUTS.find((l) => l === value) ?? 'standard';

/** GDD-UI-02, GDD-PRG-02: a saved Screen shake: exactly `on` or `off`, else on alone. */
const shake = (value: unknown): ScreenShake => SCREEN_SHAKES.find((s) => s === value) ?? 'on';

/** One saved level, or undefined when it is not an object. A part that does not read as the GDD says reads as none. */
function levelProgress(value: unknown, hiloCount: number): LevelProgress | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const { hilos, medal: m, bestSteps, cleared } = value as { hilos?: unknown; medal?: unknown; bestSteps?: unknown; cleared?: unknown };
  const flags = typeof hilos === 'string' && hilos.length === hiloCount && /^[01]*$/.test(hilos) ? Array.from(hilos, (c) => c === '1') : Array<boolean>(hiloCount).fill(false);
  return {
    hilos: flags,
    medal: MEDALS.find((name) => name === m) ?? null,
    bestSteps: typeof bestSteps === 'number' && Number.isInteger(bestSteps) && bestSteps > 0 ? bestSteps : null,
    cleared: cleared === true,
  };
}

/** A whole number from `min` to `max`, else undefined. */
const whole = (value: unknown, min: number, max = Infinity): number | undefined =>
  typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max ? value : undefined;

/**
 * The saved run, or null when it does not read as the GDD says: the level is one of the saved levels (`hiloCounts` and `ofrendaCounts`
 * name them), the checkpoint one of its ofrendas, the lives a whole number from 1 to LIVES_MAX, `hilos` one 0 or 1 per hilo and the clock a
 * whole number of 0 or more. `used` keeps only its texts.
 */
function savedRun(value: unknown, hiloCounts: Readonly<Record<string, number>>, ofrendaCounts: Readonly<Record<string, number>>): SavedRun | null {
  if (typeof value !== 'object' || value === null) return null;
  const { level, checkpoint, lives, livesIn, used, hilos, clock } = value as { level?: unknown; checkpoint?: unknown; lives?: unknown; livesIn?: unknown; used?: unknown; hilos?: unknown; clock?: unknown };
  if (typeof level !== 'string') return null;
  // A level that is not saved has no counts: undefined fails the length test of `hilos` and makes the checkpoint's upper bound NaN,
  // so the level needs no check of its own (the length and bound checks cover it).
  const hiloCount = hiloCounts[level];
  const at = whole(checkpoint, 0, ofrendaCounts[level]! - 1);
  const alive = whole(lives, 1, LIVES_MAX);
  const steps = whole(clock, 0);
  if (at === undefined || alive === undefined || steps === undefined) return null;
  if (typeof hilos !== 'string' || hilos.length !== hiloCount || !/^[01]*$/.test(hilos)) return null;
  // GDD-PRG-03: a run saved before the lives were carried started with seven, so `livesIn` that does not read is seven.
  return { level, checkpoint: at, lives: alive, livesIn: whole(livesIn, 1, LIVES_MAX) ?? LIVES_MAX, used: Array.isArray(used) ? used.filter((id): id is string => typeof id === 'string') : [], hilos: Array.from(hilos, (c) => c === '1'), clock: steps };
}

/**
 * GDD-PRG-02: the save in a saved text, or the defaults with `fallback` as the language (GDD-UI-02, the first language). Never
 * throws. Only `progress.tutorialPlayed` being exactly true reads as played. `hiloCounts` is the hilo count of each level that is saved
 * (the real levels, by id): the entries of `levels` for any other id are dropped. `ofrendaCounts` is their ofrenda counts, which the
 * saved run's checkpoint is read against: without them the run reads as none. `worlds` are the worlds whose lives the save keeps (GDD-LIFE-05;
 * the levels' `SAVED_WORLDS`): any other world's entry is dropped, and without them none is read. `worldLevelIds` are the ids of the saved
 * levels of each of them, by the world's number as text (the levels' `SAVED_WORLD_LEVELS`): a `worldAt` entry naming any other level is dropped.
 */
export function readSave(raw: string | null, fallback: Language = 'en', hiloCounts: Readonly<Record<string, number>> = {}, ofrendaCounts: Readonly<Record<string, number>> = {}, worlds: readonly number[] = [], worldLevelIds: Readonly<Record<string, readonly string[]>> = {}): SaveData {
  const defaults: SaveData = { settings: { ...DEFAULT_SETTINGS, language: fallback }, tutorialPlayed: false, worldLives: {}, worldAt: {}, levels: {}, run: null };
  if (raw === null) return defaults;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return defaults;
  }
  if (typeof data !== 'object' || data === null) return defaults;
  const { version, settings, progress, levels, run } = data as { version?: unknown; settings?: unknown; progress?: unknown; levels?: unknown; run?: unknown };
  if (version !== 1 || typeof settings !== 'object' || settings === null) return defaults;
  const saved = settings as { master?: unknown; effects?: unknown; language?: unknown; buttonOpacity?: unknown; layout?: unknown; shake?: unknown };
  const tutorialPlayed = typeof progress === 'object' && progress !== null && (progress as { tutorialPlayed?: unknown }).tutorialPlayed === true;
  // GDD-LIFE-05: the lives of each world in `worlds`, a whole number from 0 to LIVES_MAX; anything else is left out (none kept).
  const kept = typeof progress === 'object' && progress !== null ? (progress as { worldLives?: unknown }).worldLives : undefined;
  const livesTable = typeof kept === 'object' && kept !== null ? new Map<string, unknown>(Object.entries(kept)) : new Map<string, unknown>();
  const worldLives: Record<string, number> = {};
  for (const w of worlds) {
    const n = whole(livesTable.get(String(w)), 0, LIVES_MAX);
    if (n !== undefined) worldLives[String(w)] = n;
  }
  // GDD-UI-02, GDD-PRG-02: the level of each world's run, one of that world's saved levels; anything else is left out (none kept).
  const reached = typeof progress === 'object' && progress !== null ? (progress as { worldAt?: unknown }).worldAt : undefined;
  const reachedTable = typeof reached === 'object' && reached !== null ? new Map<string, unknown>(Object.entries(reached)) : new Map<string, unknown>();
  const worldAt: Record<string, string> = {};
  for (const w of worlds) {
    const at = reachedTable.get(String(w));
    if (typeof at === 'string' && worldLevelIds[String(w)]?.includes(at)) worldAt[String(w)] = at;
  }
  // An array, like any non-object, has no level id among its keys: the counts drop them.
  const table = typeof levels === 'object' && levels !== null ? new Map<string, unknown>(Object.entries(levels)) : new Map<string, unknown>();
  const read: Record<string, LevelProgress> = {};
  for (const [id, count] of Object.entries(hiloCounts)) {
    const one = levelProgress(table.get(id), count);
    if (one) read[id] = one;
  }
  return {
    settings: { master: volume(saved.master, DEFAULT_SETTINGS.master), effects: volume(saved.effects, DEFAULT_SETTINGS.effects), language: language(saved.language, fallback), buttonOpacity: buttonOpacity(saved.buttonOpacity), layout: layout(saved.layout), shake: shake(saved.shake) },
    tutorialPlayed,
    worldLives,
    worldAt,
    levels: read,
    run: savedRun(run, hiloCounts, ofrendaCounts),
  };
}

/** The text to save (version 1). */
export const saveText = (data: SaveData): string =>
  JSON.stringify({
    version: 1,
    settings: { master: data.settings.master, effects: data.settings.effects, language: data.settings.language, buttonOpacity: data.settings.buttonOpacity, layout: data.settings.layout, shake: data.settings.shake },
    progress: { tutorialPlayed: data.tutorialPlayed, worldLives: data.worldLives, worldAt: data.worldAt },
    levels: Object.fromEntries(
      Object.entries(data.levels).map(([id, p]) => [id, { hilos: p.hilos.map((h) => (h ? '1' : '0')).join(''), medal: p.medal, bestSteps: p.bestSteps, cleared: p.cleared }]),
    ),
    run: data.run && { level: data.run.level, checkpoint: data.run.checkpoint, lives: data.run.lives, livesIn: data.run.livesIn, used: data.run.used, hilos: data.run.hilos.map((h) => (h ? '1' : '0')).join(''), clock: data.run.clock },
  });

/** GDD-PRG-02: the run as saved at a checkpoint: the checkpoint reached, the lives after its touch and those the run started with, the used ofrendas and veladora, the hilos and the clock. */
export const checkpointRun = (run: RunState, levelId: string): SavedRun => ({
  level: levelId,
  checkpoint: run.checkpointIndex,
  lives: run.lives.lives,
  livesIn: run.livesIn,
  used: [...run.lives.used],
  hilos: [...run.hilosTaken],
  clock: run.clock,
});

/** GDD-PRG-02: the progress after a level clear: the run's hilos added to the saved ones, the better medal, the shorter time, cleared. */
export const recordClear = (saved: LevelProgress | undefined, run: RunState, level: Level): LevelProgress => ({
  hilos: run.hilosTaken.map((taken, i) => taken || (saved?.hilos[i] ?? false)),
  medal: betterMedal(saved?.medal ?? null, medal(run, level)),
  bestSteps: Math.min(saved?.bestSteps ?? run.clock, run.clock),
  cleared: true,
});

/**
 * GDD-PRG-02, GDD-LIFE-05: the progress on the step the Siete vidas gastadas screen comes up: the run's hilos added to the saved ones
 * (never removed); the medal, the time and `cleared` as saved, or none and not cleared for a level with nothing saved.
 */
export const recordHilos = (saved: LevelProgress | undefined, run: RunState): LevelProgress => ({
  hilos: run.hilosTaken.map((taken, i) => taken || (saved?.hilos[i] ?? false)),
  medal: saved?.medal ?? null,
  bestSteps: saved?.bestSteps ?? null,
  cleared: saved?.cleared ?? false,
});

/** GDD-PRG-02: two records of one level as one: every hilo of either, the better medal, the shorter time, cleared if either is. */
export const mergeProgress = (a: LevelProgress, b: LevelProgress): LevelProgress => ({
  hilos: a.hilos.map((h, i) => h || (b.hilos[i] ?? false)),
  medal: betterMedal(a.medal, b.medal),
  bestSteps: a.bestSteps === null ? b.bestSteps : b.bestSteps === null ? a.bestSteps : Math.min(a.bestSteps, b.bestSteps),
  cleared: a.cleared || b.cleared,
});

/** GDD-PRG-02: the progress of every level in `a` or `b`, a level in both merged (`mergeProgress`). */
export function mergeLevels(a: Readonly<Record<string, LevelProgress>>, b: Readonly<Record<string, LevelProgress>>): Record<string, LevelProgress> {
  const merged: Record<string, LevelProgress> = { ...a };
  for (const [id, p] of Object.entries(b)) merged[id] = a[id] ? mergeProgress(a[id], p) : p;
  return merged;
}
