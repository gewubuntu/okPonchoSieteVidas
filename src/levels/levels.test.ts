import { describe, expect, it } from 'vitest';
import { LEVELS, levelById, levelFor } from './index';
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
  it('GDD-UI-02 which level: no level parameter gives 0-1', () => {
    expect(levelFor('').id).toBe('0-1');
  });

  it('GDD-UI-02 which level: level=sandbox gives the sandbox', () => {
    expect(levelFor('?level=sandbox').id).toBe('sandbox');
    expect(levelFor('?x=1&level=sandbox').id).toBe('sandbox');
  });

  it('GDD-UI-02 which level: level=1-1 gives 1-1', () => {
    expect(levelFor('?level=1-1').id).toBe('1-1');
    expect(levelFor('?x=1&level=1-1').id).toBe('1-1');
  });

  it('GDD-UI-02 which level: any other level gives 0-1', () => {
    for (const search of ['?level=0-1', '?level=1-2', '?level=nope', '?level=']) expect(levelFor(search).id, search).toBe('0-1');
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
