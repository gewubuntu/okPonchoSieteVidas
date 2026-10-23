import { describe, expect, it } from 'vitest';
import { LEVELS } from './index';
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
