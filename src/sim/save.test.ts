import { describe, expect, it } from 'vitest';
import { loseLife, startWorld } from './lives';
import { startRun, type Level, type RunState } from './run';
import { DEFAULT_SAVE, mergeLevels, mergeProgress, readSave, recordClear, saveText, type LevelProgress } from './save';
import type { Settings } from './settings';
import { parseTiles } from './tilemap';

const flat = parseTiles([...Array<string>(14).fill('..............................'), ...Array<string>(3).fill('##############################')]);
const bare: Level = { world: flat, spawn: { x: 24, y: 224 }, ofrendas: [], spikes: [], crumbles: [], springs: [], platforms: [], tacos: [], pinatas: [], doors: [], keys: [], fragiles: [], enemies: [] };

const text = (master: unknown, effects: unknown) => JSON.stringify({ version: 1, settings: { master, effects } });
const read = (raw: string | null) => readSave(raw).settings;
const en = (master: number, effects: number): Settings => ({ master, effects, language: 'en' });

describe('GDD-PRG-02 saved settings', () => {
  it('the settings read back as saved', () => {
    expect(read(saveText({ settings: { master: 3, effects: 7, language: 'en' }, tutorialPlayed: false, levels: {} }))).toEqual(en(3, 7));
    expect(saveText({ settings: { master: 3, effects: 7, language: 'en' }, tutorialPlayed: false, levels: {} })).toBe('{"version":1,"settings":{"master":3,"effects":7,"language":"en"},"progress":{"tutorialPlayed":false},"levels":{}}');
    expect(read(saveText({ settings: { master: 0, effects: 0, language: 'en' }, tutorialPlayed: false, levels: {} }))).toEqual(en(0, 0));
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
    expect(readSave(withProgress({ tutorialPlayed: true }))).toEqual({ settings: en(4, 6), tutorialPlayed: true, levels: {} });
  });

  it('GDD-PRG-02 a settings-only save reads as not played and keeps its settings', () => {
    expect(readSave('{"version":1,"settings":{"master":3,"effects":7}}')).toEqual({ settings: en(3, 7), tutorialPlayed: false, levels: {} });
  });

  it('GDD-PRG-02 anything but true in tutorialPlayed reads as not played', () => {
    for (const progress of [{ tutorialPlayed: 'yes' }, { tutorialPlayed: 1 }, { tutorialPlayed: null }, {}, true]) {
      expect(readSave(withProgress(progress)).tutorialPlayed, JSON.stringify(progress)).toBe(false);
    }
  });

  it('GDD-PRG-02 nothing saved or unreadable gives the default save', () => {
    expect(DEFAULT_SAVE).toEqual({ settings: en(10, 10), tutorialPlayed: false, levels: {} });
    expect(readSave(null)).toEqual(DEFAULT_SAVE);
    expect(readSave('{"version":2,"settings":{"master":3,"effects":3},"progress":{"tutorialPlayed":true}}')).toEqual(DEFAULT_SAVE);
  });

  it('GDD-PRG-02 saveText writes the settings and the progress, and reads back the same', () => {
    const data = { settings: en(4, 9), tutorialPlayed: true, levels: {} };
    expect(saveText(data)).toBe('{"version":1,"settings":{"master":4,"effects":9,"language":"en"},"progress":{"tutorialPlayed":true},"levels":{}}');
    expect(readSave(saveText(data))).toEqual(data);
  });
});

const withLanguage = (language: unknown) => JSON.stringify({ version: 1, settings: { master: 4, effects: 6, language } });

describe('GDD-PRG-02 the saved language', () => {
  it('saveText writes the language', () => {
    expect(saveText({ settings: { master: 7, effects: 10, language: 'de' }, tutorialPlayed: false, levels: {} })).toBe(
      '{"version":1,"settings":{"master":7,"effects":10,"language":"de"},"progress":{"tutorialPlayed":false},"levels":{}}',
    );
  });

  it('a saved language reads back', () => {
    for (const language of ['en', 'es', 'de'] as const) {
      const data = { settings: { master: 7, effects: 3, language }, tutorialPlayed: false, levels: {} };
      expect(readSave(saveText(data), 'en'), language).toEqual(data);
    }
    expect(readSave(saveText({ settings: { master: 7, effects: 3, language: 'es' }, tutorialPlayed: false, levels: {} }), 'de').settings.language).toBe('es');
  });

  it('no save gives the fallback language', () => {
    expect(readSave(null, 'es').settings).toEqual({ master: 10, effects: 10, language: 'es' });
    expect(readSave('{', 'de').settings.language).toBe('de');
    expect(readSave('{"version":2,"settings":{"master":3,"effects":3}}', 'de').settings.language).toBe('de');
    expect(readSave('{"version":1,"settings":{"master":4,"effects":6}}', 'es').settings).toEqual({ master: 4, effects: 6, language: 'es' });
    expect(readSave(null).settings.language).toBe('en');
  });

  it('a saved language that is not en, es or de falls back alone', () => {
    for (const language of ['fr', 3, 'EN', null, '']) {
      expect(readSave(withLanguage(language), 'de').settings, JSON.stringify(language)).toEqual({ master: 4, effects: 6, language: 'de' });
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
    const data = { settings: en(4, 6), tutorialPlayed: true, levels: { '0-1': SILVER } };
    expect(saveText(data)).toBe(
      '{"version":1,"settings":{"master":4,"effects":6,"language":"en"},"progress":{"tutorialPlayed":true},"levels":{"0-1":{"hilos":"1010","medal":"silver","bestSteps":8040,"cleared":true}}}',
    );
    expect(readSave(saveText(data), 'en', COUNTS)).toEqual(data);
  });

  it('GDD-PRG-02 an entry with no medal and no time is written as null and reads back as none', () => {
    const data = { settings: en(4, 6), tutorialPlayed: false, levels: { '0-1': NOTHING } };
    expect(saveText(data)).toContain('"0-1":{"hilos":"0000","medal":null,"bestSteps":null,"cleared":false}');
    expect(readSave(saveText(data), 'en', COUNTS)).toEqual(data);
  });

  it('GDD-PRG-02 an old save without levels reads as nothing saved', () => {
    const old = readSave('{"version":1,"settings":{"master":3,"effects":7,"language":"de"},"progress":{"tutorialPlayed":true}}', 'en', COUNTS);
    expect(old).toEqual({ settings: { master: 3, effects: 7, language: 'de' }, tutorialPlayed: true, levels: {} });
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
    const first = readSave(saveText({ settings: en(4, 6), tutorialPlayed: true, levels: { '0-1': SILVER } }), 'en', COUNTS);
    const again = readSave(saveText({ ...first, settings: en(1, 2) }), 'en', COUNTS);
    expect(again).toEqual({ settings: en(1, 2), tutorialPlayed: true, levels: { '0-1': SILVER } });
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
