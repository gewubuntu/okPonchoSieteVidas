import { describe, expect, it } from 'vitest';
import { loseLife, startWorld } from './lives';
import { startRun, type Level, type RunState } from './run';
import { checkpointRun, DEFAULT_SAVE, mergeLevels, mergeProgress, readSave, recordClear, saveText, type LevelProgress, type SavedRun } from './save';
import type { Settings } from './settings';
import { parseTiles } from './tilemap';

const flat = parseTiles([...Array<string>(14).fill('..............................'), ...Array<string>(3).fill('##############################')]);
const bare: Level = { world: flat, spawn: { x: 24, y: 224 }, ofrendas: [], spikes: [], crumbles: [], springs: [], platforms: [], tacos: [], pinatas: [], doors: [], keys: [], fragiles: [], enemies: [] };

const text = (master: unknown, effects: unknown) => JSON.stringify({ version: 1, settings: { master, effects } });
const read = (raw: string | null) => readSave(raw).settings;
const en = (master: number, effects: number): Settings => ({ master, effects, language: 'en', buttonOpacity: 'medium' });

describe('GDD-PRG-02 saved settings', () => {
  it('the settings read back as saved', () => {
    expect(read(saveText({ settings: { master: 3, effects: 7, language: 'en', buttonOpacity: 'medium' }, tutorialPlayed: false, levels: {}, run: null }))).toEqual(en(3, 7));
    expect(saveText({ settings: { master: 3, effects: 7, language: 'en', buttonOpacity: 'medium' }, tutorialPlayed: false, levels: {}, run: null })).toBe('{"version":1,"settings":{"master":3,"effects":7,"language":"en","buttonOpacity":"medium"},"progress":{"tutorialPlayed":false},"levels":{},"run":null}');
    expect(read(saveText({ settings: { master: 0, effects: 0, language: 'en', buttonOpacity: 'medium' }, tutorialPlayed: false, levels: {}, run: null }))).toEqual(en(0, 0));
  });

  it('nothing saved opens with the defaults', () => {
    expect(read(null)).toEqual(en(10, 10));
  });

  it('something unreadable opens with the defaults', () => {
    for (const raw of ['not json', '42', 'null', '"text"', '[]', '{"version":2,"settings":{"master":3,"effects":3}}', '{"version":1}', '{"version":1,"settings":5}', '{"settings":{"master":3,"effects":3}}', '']) {
      expect(read(raw), raw).toEqual(en(10, 10));
    }
  });

  it('a value that is not a whole number from 0 to 10 falls back to its default alone', () => {
    expect(read(text(11, 4))).toEqual(en(10, 4));
    expect(read(text(-1, 4))).toEqual(en(10, 4));
    expect(read(text(2.5, 4))).toEqual(en(10, 4));
    expect(read(text('3', 4))).toEqual(en(10, 4));
    expect(read(text(6, 12))).toEqual(en(6, 10));
    expect(read(text(6, -2))).toEqual(en(6, 10));
    expect(read(text(6, 'x'))).toEqual(en(6, 10));
    expect(read('{"version":1,"settings":{"master":0}}')).toEqual(en(0, 10));
    expect(read('{"version":1,"settings":{"effects":0}}')).toEqual(en(10, 0));
    expect(read(text(10, 10))).toEqual(en(10, 10));
    expect(read(text(0, 0))).toEqual(en(0, 0));
  });
});

const withProgress = (progress: unknown) => JSON.stringify({ version: 1, settings: { master: 4, effects: 6 }, progress });

describe('GDD-PRG-02 save', () => {
  it('GDD-PRG-02 a save with progress.tutorialPlayed true reads as played', () => {
    expect(readSave(withProgress({ tutorialPlayed: true }))).toEqual({ settings: en(4, 6), tutorialPlayed: true, levels: {}, run: null });
  });

  it('GDD-PRG-02 a settings-only save reads as not played and keeps its settings', () => {
    expect(readSave('{"version":1,"settings":{"master":3,"effects":7}}')).toEqual({ settings: en(3, 7), tutorialPlayed: false, levels: {}, run: null });
  });

  it('GDD-PRG-02 anything but true in tutorialPlayed reads as not played', () => {
    for (const progress of [{ tutorialPlayed: 'yes' }, { tutorialPlayed: 1 }, { tutorialPlayed: null }, {}, true]) {
      expect(readSave(withProgress(progress)).tutorialPlayed, JSON.stringify(progress)).toBe(false);
    }
  });

  it('GDD-PRG-02 nothing saved or unreadable gives the default save', () => {
    expect(DEFAULT_SAVE).toEqual({ settings: en(10, 10), tutorialPlayed: false, levels: {}, run: null });
    expect(readSave(null)).toEqual(DEFAULT_SAVE);
    expect(readSave('{"version":2,"settings":{"master":3,"effects":3},"progress":{"tutorialPlayed":true}}')).toEqual(DEFAULT_SAVE);
  });

  it('GDD-PRG-02 saveText writes the settings and the progress, and reads back the same', () => {
    const data = { settings: en(4, 9), tutorialPlayed: true, levels: {}, run: null };
    expect(saveText(data)).toBe('{"version":1,"settings":{"master":4,"effects":9,"language":"en","buttonOpacity":"medium"},"progress":{"tutorialPlayed":true},"levels":{},"run":null}');
    expect(readSave(saveText(data))).toEqual(data);
  });
});

const withOpacity = (buttonOpacity: unknown) => JSON.stringify({ version: 1, settings: { master: 3, effects: 7, buttonOpacity } });

describe('GDD-PRG-02 Button opacity is saved', () => {
  it('it is written and read back', () => {
    for (const buttonOpacity of ['low', 'medium', 'high'] as const) {
      const data = { settings: { master: 3, effects: 7, language: 'es' as const, buttonOpacity }, tutorialPlayed: false, levels: {}, run: null };
      expect(JSON.parse(saveText(data)).settings, buttonOpacity).toMatchObject({ buttonOpacity });
      expect(readSave(saveText(data), 'en').settings, buttonOpacity).toEqual(data.settings);
    }
  });

  it('an unknown value falls back to medium alone', () => {
    for (const buttonOpacity of ['max', 'High', 3, null, '']) {
      expect(readSave(withOpacity(buttonOpacity), 'de').settings, JSON.stringify(buttonOpacity)).toEqual({ master: 3, effects: 7, language: 'de', buttonOpacity: 'medium' });
    }
  });

  it('a save without it reads medium', () => {
    expect(readSave('{"version":1,"settings":{"master":4,"effects":6,"language":"es"}}', 'en').settings).toEqual({ master: 4, effects: 6, language: 'es', buttonOpacity: 'medium' });
    expect(readSave(null).settings.buttonOpacity).toBe('medium');
  });
});

const withLanguage = (language: unknown) => JSON.stringify({ version: 1, settings: { master: 4, effects: 6, language } });

describe('GDD-PRG-02 the saved language', () => {
  it('saveText writes the language', () => {
    expect(saveText({ settings: { master: 7, effects: 10, language: 'de', buttonOpacity: 'medium' }, tutorialPlayed: false, levels: {}, run: null })).toBe(
      '{"version":1,"settings":{"master":7,"effects":10,"language":"de","buttonOpacity":"medium"},"progress":{"tutorialPlayed":false},"levels":{},"run":null}',
    );
  });

  it('a saved language reads back', () => {
    for (const language of ['en', 'es', 'de'] as const) {
      const data = { settings: { master: 7, effects: 3, language, buttonOpacity: 'medium' as const }, tutorialPlayed: false, levels: {}, run: null };
      expect(readSave(saveText(data), 'en'), language).toEqual(data);
    }
    expect(readSave(saveText({ settings: { master: 7, effects: 3, language: 'es', buttonOpacity: 'medium' }, tutorialPlayed: false, levels: {}, run: null }), 'de').settings.language).toBe('es');
  });

  it('no save gives the fallback language', () => {
    expect(readSave(null, 'es').settings).toEqual({ master: 10, effects: 10, language: 'es', buttonOpacity: 'medium' });
    expect(readSave('{', 'de').settings.language).toBe('de');
    expect(readSave('{"version":2,"settings":{"master":3,"effects":3}}', 'de').settings.language).toBe('de');
    expect(readSave('{"version":1,"settings":{"master":4,"effects":6}}', 'es').settings).toEqual({ master: 4, effects: 6, language: 'es', buttonOpacity: 'medium' });
    expect(readSave(null).settings.language).toBe('en');
  });

  it('a saved language that is not en, es or de falls back alone', () => {
    for (const language of ['fr', 3, 'EN', null, '']) {
      expect(readSave(withLanguage(language), 'de').settings, JSON.stringify(language)).toEqual({ master: 4, effects: 6, language: 'de', buttonOpacity: 'medium' });
    }
  });
});

// GDD-PRG-02 progress: the levels part of the save.
const COUNTS = { '0-1': 4 };
const saved = (levels: unknown) => JSON.stringify({ version: 1, settings: { master: 4, effects: 6 }, progress: { tutorialPlayed: true }, levels });
const entry = (over: Record<string, unknown> = {}) => ({ hilos: '1010', medal: 'silver', bestSteps: 8040, cleared: true, ...over });
const SILVER: LevelProgress = { hilos: [true, false, true, false], medal: 'silver', bestSteps: 8040, cleared: true };
const NOTHING: LevelProgress = { hilos: [false, false, false, false], medal: null, bestSteps: null, cleared: false };
const readLevel = (levels: unknown) => readSave(saved(levels), 'en', COUNTS).levels['0-1'];

describe('GDD-PRG-02 progress', () => {
  it('GDD-PRG-02 levels round-trip', () => {
    const data = { settings: en(4, 6), tutorialPlayed: true, levels: { '0-1': SILVER }, run: null };
    expect(saveText(data)).toBe(
      '{"version":1,"settings":{"master":4,"effects":6,"language":"en","buttonOpacity":"medium"},"progress":{"tutorialPlayed":true},"levels":{"0-1":{"hilos":"1010","medal":"silver","bestSteps":8040,"cleared":true}},"run":null}',
    );
    expect(readSave(saveText(data), 'en', COUNTS)).toEqual(data);
  });

  it('GDD-PRG-02 an entry with no medal and no time is written as null and reads back as none', () => {
    const data = { settings: en(4, 6), tutorialPlayed: false, levels: { '0-1': NOTHING }, run: null };
    expect(saveText(data)).toContain('"0-1":{"hilos":"0000","medal":null,"bestSteps":null,"cleared":false}');
    expect(readSave(saveText(data), 'en', COUNTS)).toEqual(data);
  });

  it('GDD-PRG-02 an old save without levels reads as nothing saved', () => {
    const old = readSave('{"version":1,"settings":{"master":3,"effects":7,"language":"de"},"progress":{"tutorialPlayed":true}}', 'en', COUNTS);
    expect(old).toEqual({ settings: { master: 3, effects: 7, language: 'de', buttonOpacity: 'medium' }, tutorialPlayed: true, levels: {}, run: null });
    expect(readSave(null, 'en', COUNTS).levels).toEqual({});
    expect(DEFAULT_SAVE.levels).toEqual({});
  });

  it('GDD-PRG-02 levels that are not an object read as nothing saved, and an entry that is not an object is left out', () => {
    for (const levels of [5, 'x', null, true, []]) expect(readSave(saved(levels), 'en', COUNTS).levels, JSON.stringify(levels)).toEqual({});
    for (const one of [5, 'x', null, true]) expect(readSave(saved({ '0-1': one }), 'en', COUNTS).levels, JSON.stringify(one)).toEqual({});
    expect(readSave(saved({ '0-1': entry() }), 'en', COUNTS).tutorialPlayed).toBe(true);
  });

  it('GDD-PRG-02 a hilos text of the wrong length, or with another character, reads as no hilo', () => {
    for (const hilos of ['101', '10100', '', '10x0', '1O10', 'true', 1010, null]) {
      expect(readLevel({ '0-1': entry({ hilos }) }), JSON.stringify(hilos)).toEqual({ ...SILVER, hilos: [false, false, false, false] });
    }
  });

  it('GDD-PRG-02 an unknown medal reads as none', () => {
    for (const medal of ['platinum', 'Gold', 3, null, true]) expect(readLevel({ '0-1': entry({ medal }) })?.medal, JSON.stringify(medal)).toBeNull();
    for (const medal of ['bronze', 'silver', 'gold']) expect(readLevel({ '0-1': entry({ medal }) })?.medal).toBe(medal);
  });

  it('GDD-PRG-02 a bestSteps that is not a whole number above 0 reads as none', () => {
    for (const bestSteps of [0, -5, 1.5, '8040', null, true]) expect(readLevel({ '0-1': entry({ bestSteps }) })?.bestSteps, JSON.stringify(bestSteps)).toBeNull();
    expect(readLevel({ '0-1': entry({ bestSteps: 1 }) })?.bestSteps).toBe(1);
  });

  it('GDD-PRG-02 cleared reads as true only when it is exactly true', () => {
    for (const cleared of ['true', 1, null, 'yes', {}]) expect(readLevel({ '0-1': entry({ cleared }) })?.cleared, JSON.stringify(cleared)).toBe(false);
    expect(readLevel({ '0-1': entry({ cleared: true }) })?.cleared).toBe(true);
    expect(readLevel({ '0-1': entry({ cleared: false }) })?.cleared).toBe(false);
  });

  it('GDD-PRG-02 a level not in the counts (the sandbox, an unknown id) is dropped', () => {
    const levels = readSave(saved({ '0-1': entry(), sandbox: entry(), '9-9': entry() }), 'en', COUNTS).levels;
    expect(Object.keys(levels)).toEqual(['0-1']);
    expect(readSave(saved({ '0-1': entry() }), 'en').levels).toEqual({});
  });

  it('GDD-PRG-02 a level of no hilos reads an empty hilos text', () => {
    const none = readSave(saved({ '1-1': entry({ hilos: '' }) }), 'en', { '1-1': 0 }).levels['1-1'];
    expect(none).toEqual({ ...SILVER, hilos: [] });
  });

  it('GDD-PRG-02 saving the settings keeps the levels', () => {
    const first = readSave(saveText({ settings: en(4, 6), tutorialPlayed: true, levels: { '0-1': SILVER }, run: null }), 'en', COUNTS);
    const again = readSave(saveText({ ...first, settings: en(1, 2) }), 'en', COUNTS);
    expect(again).toEqual({ settings: en(1, 2), tutorialPlayed: true, levels: { '0-1': SILVER }, run: null });
  });
});

// A level of four hilos; the run's state is set by hand, recordClear reads only the hilos, the lives and the clock.
const four = { ...bare, hilos: [0, 1, 2, 3].map((col) => ({ col, row: 3 })) };
const clearRun = (taken: boolean[], lives: number, clock: number): RunState => {
  let lost = startWorld();
  for (let i = startWorld().lives; i > lives; i--) lost = loseLife(lost);
  return { ...startRun(four), hilosTaken: taken, lives: lost, clock };
};
const progress = (over: Partial<LevelProgress> = {}): LevelProgress => ({ ...NOTHING, ...over });

describe('GDD-PRG-02 recording a clear', () => {
  it("GDD-PRG-02 recordClear adds the run's hilos and never removes", () => {
    const result = recordClear(progress({ hilos: [true, false, false, false] }), clearRun([false, true, false, false], 7, 100), four);
    expect(result.hilos).toEqual([true, true, false, false]);
    expect(recordClear(undefined, clearRun([false, true, false, true], 7, 100), four).hilos).toEqual([false, true, false, true]);
  });

  it('GDD-PRG-02 recordClear keeps the better medal', () => {
    const all = [true, true, true, true];
    // silver: every hilo with 3 lives; gold: every hilo with 4 or more (GDD-PRG-03); bronze: one hilo short.
    expect(recordClear(progress({ medal: 'gold' }), clearRun(all, 3, 100), four).medal).toBe('gold');
    expect(recordClear(progress({ medal: 'bronze' }), clearRun(all, 3, 100), four).medal).toBe('silver');
    expect(recordClear(progress({ medal: 'silver' }), clearRun([true, true, true, false], 3, 100), four).medal).toBe('silver');
    expect(recordClear(progress({ medal: 'silver' }), clearRun(all, 7, 100), four).medal).toBe('gold');
    expect(recordClear(undefined, clearRun([false, false, false, false], 3, 100), four).medal).toBe('bronze');
    expect(recordClear(progress({ medal: null }), clearRun([false, false, false, false], 3, 100), four).medal).toBe('bronze');
  });

  it('GDD-PRG-02 recordClear keeps the shorter time', () => {
    const slow = clearRun([false, false, false, false], 7, 9000);
    const fast = clearRun([false, false, false, false], 7, 7000);
    expect(recordClear(progress({ bestSteps: 8040 }), slow, four).bestSteps).toBe(8040);
    expect(recordClear(progress({ bestSteps: 8040 }), fast, four).bestSteps).toBe(7000);
    expect(recordClear(progress({ bestSteps: null }), slow, four).bestSteps).toBe(9000);
    expect(recordClear(undefined, slow, four).bestSteps).toBe(9000);
  });

  it('GDD-PRG-02 recordClear sets cleared', () => {
    expect(recordClear(undefined, clearRun([false, false, false, false], 7, 5), four).cleared).toBe(true);
    expect(recordClear(progress({ cleared: false }), clearRun([false, false, false, false], 7, 5), four).cleared).toBe(true);
  });

  it('GDD-PRG-02 mergeProgress ORs the hilos', () => {
    const merged = mergeProgress(progress({ hilos: [true, false, false, true] }), progress({ hilos: [false, false, true, true] }));
    expect(merged.hilos).toEqual([true, false, true, true]);
  });

  it('GDD-PRG-02 mergeProgress keeps the better medal', () => {
    expect(mergeProgress(progress({ medal: 'silver' }), progress({ medal: 'gold' })).medal).toBe('gold');
    expect(mergeProgress(progress({ medal: 'gold' }), progress({ medal: 'bronze' })).medal).toBe('gold');
    expect(mergeProgress(progress({ medal: null }), progress({ medal: 'bronze' })).medal).toBe('bronze');
    expect(mergeProgress(progress({ medal: 'bronze' }), progress({ medal: null })).medal).toBe('bronze');
    expect(mergeProgress(progress(), progress()).medal).toBeNull();
  });

  it('GDD-PRG-02 mergeProgress keeps the smaller time', () => {
    expect(mergeProgress(progress({ bestSteps: 8040 }), progress({ bestSteps: 7000 })).bestSteps).toBe(7000);
    expect(mergeProgress(progress({ bestSteps: 7000 }), progress({ bestSteps: 8040 })).bestSteps).toBe(7000);
    expect(mergeProgress(progress({ bestSteps: null }), progress({ bestSteps: 8040 })).bestSteps).toBe(8040);
    expect(mergeProgress(progress({ bestSteps: 8040 }), progress({ bestSteps: null })).bestSteps).toBe(8040);
    expect(mergeProgress(progress(), progress()).bestSteps).toBeNull();
  });

  it('GDD-PRG-02 mergeProgress ORs cleared', () => {
    expect(mergeProgress(progress({ cleared: true }), progress()).cleared).toBe(true);
    expect(mergeProgress(progress(), progress({ cleared: true })).cleared).toBe(true);
    expect(mergeProgress(progress(), progress()).cleared).toBe(false);
  });

  it('GDD-PRG-02 mergeLevels merges the levels in both and keeps those in one', () => {
    const a = { '0-1': progress({ hilos: [true, false, false, false] }), '1-1': progress({ cleared: true }) };
    const b = { '0-1': progress({ hilos: [false, true, false, false] }), '2-1': progress({ medal: 'gold' }) };
    const merged = mergeLevels(a, b);
    expect(new Set(Object.keys(merged))).toEqual(new Set(['0-1', '1-1', '2-1']));
    expect(merged['0-1']!.hilos).toEqual([true, true, false, false]);
    expect(merged['1-1']).toEqual(a['1-1']);
    expect(merged['2-1']).toEqual(b['2-1']);
  });
});

// GDD-PRG-02 saved run: the run part of the save. 0-1 has four hilos and three ofrendas here.
const OFRENDA_COUNTS = { '0-1': 3 };
const RUN: SavedRun = { level: '0-1', checkpoint: 1, lives: 5, used: ['ofrenda:0-1-1', 'ofrenda:0-1-2'], hilos: [true, false, true, true], clock: 4210 };
const runFields = (over: Record<string, unknown> = {}) => ({ level: '0-1', checkpoint: 1, lives: 5, used: ['ofrenda:0-1-1', 'ofrenda:0-1-2'], hilos: '1011', clock: 4210, ...over });
const withRun = (run: unknown) => JSON.stringify({ version: 1, settings: { master: 4, effects: 6 }, progress: { tutorialPlayed: true }, levels: {}, run });
const readRun = (run: unknown) => readSave(withRun(run), 'en', COUNTS, OFRENDA_COUNTS).run;

describe('GDD-PRG-02 saved run', () => {
  it('GDD-PRG-02 saved run round-trips', () => {
    const data = { settings: en(4, 6), tutorialPlayed: true, levels: {}, run: RUN };
    expect(saveText(data)).toBe(
      '{"version":1,"settings":{"master":4,"effects":6,"language":"en","buttonOpacity":"medium"},"progress":{"tutorialPlayed":true},"levels":{},"run":{"level":"0-1","checkpoint":1,"lives":5,"used":["ofrenda:0-1-1","ofrenda:0-1-2"],"hilos":"1011","clock":4210}}',
    );
    expect(readSave(saveText(data), 'en', COUNTS, OFRENDA_COUNTS)).toEqual(data);
  });

  it('GDD-PRG-02 saved run: an old save without run reads as none and keeps the rest', () => {
    const old = '{"version":1,"settings":{"master":3,"effects":7,"language":"de"},"progress":{"tutorialPlayed":true},"levels":{"0-1":{"hilos":"1010","medal":"silver","bestSteps":8040,"cleared":true}}}';
    expect(readSave(old, 'en', COUNTS, OFRENDA_COUNTS)).toEqual({ settings: { master: 3, effects: 7, language: 'de', buttonOpacity: 'medium' }, tutorialPlayed: true, levels: { '0-1': SILVER }, run: null });
    expect(DEFAULT_SAVE.run).toBeNull();
    expect(readSave(null, 'en', COUNTS, OFRENDA_COUNTS).run).toBeNull();
    for (const run of [null, 5, 'x', true, []]) expect(readRun(run), JSON.stringify(run)).toBeNull();
  });

  it('GDD-PRG-02 saved run: a level that is not a real level reads as none', () => {
    expect(readRun(runFields())).toEqual(RUN);
    for (const level of ['sandbox', 'x', '', 'constructor', 5, null]) expect(readRun(runFields({ level })), JSON.stringify(level)).toBeNull();
    // A level with an ofrenda count but no hilo count is no saved level either.
    expect(readSave(withRun(runFields({ level: '1-1', hilos: '' })), 'en', COUNTS, { ...OFRENDA_COUNTS, '1-1': 3 }).run).toBeNull();
  });

  it('GDD-PRG-02 saved run: a checkpoint must be a whole number from 0 to the ofrendas less one', () => {
    for (const checkpoint of [0, 1, 2]) expect(readRun(runFields({ checkpoint }))?.checkpoint, String(checkpoint)).toBe(checkpoint);
    for (const checkpoint of [-1, 3, 1.5, '1', null, 2.9999]) expect(readRun(runFields({ checkpoint })), JSON.stringify(checkpoint)).toBeNull();
  });

  it('GDD-PRG-02 saved run: lives must be a whole number from 1 to 7', () => {
    for (const lives of [1, 7]) expect(readRun(runFields({ lives }))?.lives, String(lives)).toBe(lives);
    for (const lives of [0, 8, 2.5, '5', null, -3]) expect(readRun(runFields({ lives })), JSON.stringify(lives)).toBeNull();
  });

  it('GDD-PRG-02 saved run: hilos of the wrong length or with another character read as none', () => {
    expect(readRun(runFields({ hilos: '0000' }))?.hilos).toEqual([false, false, false, false]);
    for (const hilos of ['101', '10111', '', '10x1', '1O11', 1011, null, ['1', '0', '1', '1']]) expect(readRun(runFields({ hilos })), JSON.stringify(hilos)).toBeNull();
  });

  it('GDD-PRG-02 saved run: the clock must be a whole number of 0 or more', () => {
    for (const clock of [0, 1, 99999]) expect(readRun(runFields({ clock }))?.clock, String(clock)).toBe(clock);
    for (const clock of [-1, 2.5, '4210', null]) expect(readRun(runFields({ clock })), JSON.stringify(clock)).toBeNull();
  });

  it('GDD-PRG-02 saved run: used keeps only the texts, and a used that is not a list reads as none used', () => {
    expect(readRun(runFields({ used: ['ofrenda:a', 7, null, 'veladora:v', {}, ['x']] }))?.used).toEqual(['ofrenda:a', 'veladora:v']);
    for (const used of [5, 'ofrenda:a', null, {}]) expect(readRun(runFields({ used }))?.used, JSON.stringify(used)).toEqual([]);
    expect(readRun({ level: '0-1', checkpoint: 1, lives: 5, hilos: '1011', clock: 4210 })?.used).toEqual([]);
  });

  it('GDD-PRG-02 saved run: checkpointRun takes the checkpoint, lives, used, hilos and clock of the run state', () => {
    const lives = { lives: 4, used: new Set(['ofrenda:a', 'veladora:v']) };
    const state: RunState = { ...startRun(four), checkpointIndex: 2, lives, hilosTaken: [true, false, true, false], clock: 321 };
    const snapshot = checkpointRun(state, '1-1');
    expect(snapshot).toEqual({ level: '1-1', checkpoint: 2, lives: 4, used: ['ofrenda:a', 'veladora:v'], hilos: [true, false, true, false], clock: 321 });
  });

  it('GDD-PRG-02 saved run: saving the settings or the progress keeps the run', () => {
    const first = readSave(saveText({ settings: en(4, 6), tutorialPlayed: true, levels: { '0-1': SILVER }, run: RUN }), 'en', COUNTS, OFRENDA_COUNTS);
    const again = readSave(saveText({ ...first, settings: en(1, 2) }), 'en', COUNTS, OFRENDA_COUNTS);
    expect(again).toEqual({ settings: en(1, 2), tutorialPlayed: true, levels: { '0-1': SILVER }, run: RUN });
    expect(readSave(saveText({ ...first, run: null }), 'en', COUNTS, OFRENDA_COUNTS).run).toBeNull();
  });
});
