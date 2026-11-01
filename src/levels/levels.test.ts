import { describe, expect, it } from 'vitest';
import { LEVELS, levelById, SAVED_LEVELS, SAVED_OFRENDAS, startLevel } from './index';
import { SANDBOX_LEVEL } from './sandbox';
import { gaps, validateLevel } from './validate';

describe('GDD-TEC-04 every level passes the validator', () => {
  for (const entry of LEVELS) {
    it(entry.id, () => {
      expect(validateLevel(entry), entry.id).toEqual([]);
    });
  }

  it('the sandbox is a World 1 test level', () => {
    const sandbox = LEVELS.find((e) => e.id === 'sandbox');
    expect(sandbox).toBeDefined();
    expect(sandbox!.world).toBe(1);
    expect(sandbox!.test).toBe(true);
    expect(sandbox!.level).toBe(SANDBOX_LEVEL);
  });
});

describe('GDD-WLD-03 the sandbox pit', () => {
  it('is one gap, columns 14 to 16, 3 tiles wide (the spring slot in column 12 has a floor under it)', () => {
    expect(gaps(SANDBOX_LEVEL.world)).toEqual([{ col: 14, width: 3 }]);
  });
});

describe('GDD-UI-02 which level', () => {
  it('GDD-UI-02 which level: no address gives 0-1 before the tutorial has started and 1-1 after', () => {
    expect(startLevel('', false).id).toBe('0-1');
    expect(startLevel('', true).id).toBe('1-1');
  });

  it('GDD-UI-02 which level: an address wins over the save', () => {
    for (const played of [false, true]) expect(startLevel('?level=sandbox', played).id, `sandbox ${played}`).toBe('sandbox');
    expect(startLevel('?level=1-1', false).id).toBe('1-1');
    expect(startLevel('?level=0-1', true).id).toBe('0-1');
    expect(startLevel('?x=1&level=1-1', false).id).toBe('1-1');
    expect(startLevel('?x=1&level=sandbox', true).id).toBe('sandbox');
  });

  it('GDD-UI-02 which level: any other address gives the rule', () => {
    for (const search of ['?level=nope', '?level=', '?level=1-2']) {
      expect(startLevel(search, false).id, search).toBe('0-1');
      expect(startLevel(search, true).id, search).toBe('1-1');
    }
  });

  it('GDD-UI-02 the level after 0-1 is 1-1, and none comes after 1-1 or the sandbox', () => {
    expect(levelById('0-1')!.next).toBe('1-1');
    expect(levelById('1-1')!.next).toBeUndefined();
    expect(levelById('sandbox')!.next).toBeUndefined();
    expect(levelById('nope')).toBeUndefined();
  });
});

describe('GDD-TEC-04 level 0-1', () => {
  it('GDD-TEC-04 0-1 is a tutorial level held to the exit rule', () => {
    const entry = LEVELS.find((e) => e.id === '0-1')!;
    expect(entry.test).toBe(false);
    const { exit: _exit, ...withoutExit } = entry.level;
    expect(validateLevel({ ...entry, level: withoutExit })).toContain('no exit');
  });
});

describe('GDD-PRG-02 which levels are saved', () => {
  it('GDD-PRG-02 0-1 and 1-1 are saved, with their hilo counts, and the sandbox is not', () => {
    // Real levels keep 50 hilos (GDD-WLD-04); the sandbox, a test level, is never saved.
    expect(SAVED_LEVELS).toEqual({ '0-1': 50, '1-1': 50 });
  });
});

describe('GDD-PRG-02 saved run: the ofrendas of the saved levels', () => {
  it('GDD-PRG-02 0-1 and 1-1 have three ofrendas each, and the sandbox is not saved', () => {
    expect(SAVED_OFRENDAS).toEqual({ '0-1': 3, '1-1': 3 });
  });
});
