import { describe, expect, it } from 'vitest';
import { DEFAULT_SAVE, readSave, saveText } from './save';
import type { Settings } from './settings';

const text = (master: unknown, effects: unknown) => JSON.stringify({ version: 1, settings: { master, effects } });
const read = (raw: string | null) => readSave(raw).settings;
const en = (master: number, effects: number): Settings => ({ master, effects, language: 'en' });

describe('GDD-PRG-02 saved settings', () => {
  it('the settings read back as saved', () => {
    expect(read(saveText({ settings: { master: 3, effects: 7, language: 'en' }, tutorialPlayed: false }))).toEqual(en(3, 7));
    expect(saveText({ settings: { master: 3, effects: 7, language: 'en' }, tutorialPlayed: false })).toBe('{"version":1,"settings":{"master":3,"effects":7,"language":"en"},"progress":{"tutorialPlayed":false}}');
    expect(read(saveText({ settings: { master: 0, effects: 0, language: 'en' }, tutorialPlayed: false }))).toEqual(en(0, 0));
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
    expect(readSave(withProgress({ tutorialPlayed: true }))).toEqual({ settings: en(4, 6), tutorialPlayed: true });
  });

  it('GDD-PRG-02 a settings-only save reads as not played and keeps its settings', () => {
    expect(readSave('{"version":1,"settings":{"master":3,"effects":7}}')).toEqual({ settings: en(3, 7), tutorialPlayed: false });
  });

  it('GDD-PRG-02 anything but true in tutorialPlayed reads as not played', () => {
    for (const progress of [{ tutorialPlayed: 'yes' }, { tutorialPlayed: 1 }, { tutorialPlayed: null }, {}, true]) {
      expect(readSave(withProgress(progress)).tutorialPlayed, JSON.stringify(progress)).toBe(false);
    }
  });

  it('GDD-PRG-02 nothing saved or unreadable gives the default save', () => {
    expect(DEFAULT_SAVE).toEqual({ settings: en(10, 10), tutorialPlayed: false });
    expect(readSave(null)).toEqual(DEFAULT_SAVE);
    expect(readSave('{"version":2,"settings":{"master":3,"effects":3},"progress":{"tutorialPlayed":true}}')).toEqual(DEFAULT_SAVE);
  });

  it('GDD-PRG-02 saveText writes the settings and the progress, and reads back the same', () => {
    const data = { settings: en(4, 9), tutorialPlayed: true };
    expect(saveText(data)).toBe('{"version":1,"settings":{"master":4,"effects":9,"language":"en"},"progress":{"tutorialPlayed":true}}');
    expect(readSave(saveText(data))).toEqual(data);
  });
});

const withLanguage = (language: unknown) => JSON.stringify({ version: 1, settings: { master: 4, effects: 6, language } });

describe('GDD-PRG-02 the saved language', () => {
  it('saveText writes the language', () => {
    expect(saveText({ settings: { master: 7, effects: 10, language: 'de' }, tutorialPlayed: false })).toBe(
      '{"version":1,"settings":{"master":7,"effects":10,"language":"de"},"progress":{"tutorialPlayed":false}}',
    );
  });

  it('a saved language reads back', () => {
    for (const language of ['en', 'es', 'de'] as const) {
      const data = { settings: { master: 7, effects: 3, language }, tutorialPlayed: false };
      expect(readSave(saveText(data), 'en'), language).toEqual(data);
    }
    expect(readSave(saveText({ settings: { master: 7, effects: 3, language: 'es' }, tutorialPlayed: false }), 'de').settings.language).toBe('es');
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
