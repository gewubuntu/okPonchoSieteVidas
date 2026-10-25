import { describe, expect, it } from 'vitest';
import { readSave, saveText } from './save';

const text = (master: unknown, effects: unknown) => JSON.stringify({ version: 1, settings: { master, effects } });

describe('GDD-PRG-02 saved settings', () => {
  it('the settings read back as saved', () => {
    expect(readSave(saveText({ master: 3, effects: 7 }))).toEqual({ master: 3, effects: 7 });
    expect(saveText({ master: 3, effects: 7 })).toBe('{"version":1,"settings":{"master":3,"effects":7}}');
    expect(readSave(saveText({ master: 0, effects: 0 }))).toEqual({ master: 0, effects: 0 });
  });

  it('nothing saved opens with the defaults', () => {
    expect(readSave(null)).toEqual({ master: 10, effects: 10 });
  });

  it('something unreadable opens with the defaults', () => {
    for (const raw of ['not json', '42', 'null', '"text"', '[]', '{"version":2,"settings":{"master":3,"effects":3}}', '{"version":1}', '{"version":1,"settings":5}', '{"settings":{"master":3,"effects":3}}', '']) {
      expect(readSave(raw), raw).toEqual({ master: 10, effects: 10 });
    }
  });

  it('a value that is not a whole number from 0 to 10 falls back to its default alone', () => {
    expect(readSave(text(11, 4))).toEqual({ master: 10, effects: 4 });
    expect(readSave(text(-1, 4))).toEqual({ master: 10, effects: 4 });
    expect(readSave(text(2.5, 4))).toEqual({ master: 10, effects: 4 });
    expect(readSave(text('3', 4))).toEqual({ master: 10, effects: 4 });
    expect(readSave(text(6, 12))).toEqual({ master: 6, effects: 10 });
    expect(readSave(text(6, -2))).toEqual({ master: 6, effects: 10 });
    expect(readSave(text(6, 'x'))).toEqual({ master: 6, effects: 10 });
    expect(readSave('{"version":1,"settings":{"master":0}}')).toEqual({ master: 0, effects: 10 });
    expect(readSave('{"version":1,"settings":{"effects":0}}')).toEqual({ master: 10, effects: 0 });
    expect(readSave(text(10, 10))).toEqual({ master: 10, effects: 10 });
    expect(readSave(text(0, 0))).toEqual({ master: 0, effects: 0 });
  });
});
