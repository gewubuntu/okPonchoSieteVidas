import { describe, expect, it } from 'vitest';
import { countChangedLines, LIMIT } from './pr-size.mjs';

describe('pr-size', () => {
  it('sums added and deleted lines', () => {
    expect(countChangedLines('10\t2\tsrc/a.ts\n5\t0\tsrc/b.ts\n')).toBe(17);
  });

  it('ignores lockfiles and binary files', () => {
    expect(countChangedLines('900\t100\tpackage-lock.json\n-\t-\tassets/a.png\n3\t1\tsrc/a.ts\n')).toBe(4);
  });

  it('handles an empty diff', () => {
    expect(countChangedLines('')).toBe(0);
  });

  it('keeps the guideline at about 300 lines', () => {
    expect(LIMIT).toBe(300);
  });
});
