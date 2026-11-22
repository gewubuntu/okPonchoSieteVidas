import { describe, expect, it } from 'vitest';
import { fnv1a64 } from './fnv';

describe('GDD-TEC-09 FNV-1a 64', () => {
  it('GDD-TEC-09 fnv1a64 gives the published values', () => {
    // The FNV reference vectors for FNV-1a, 64 bits.
    expect(fnv1a64('')).toBe('cbf29ce484222325');
    expect(fnv1a64('a')).toBe('af63dc4c8601ec8c');
    expect(fnv1a64('foobar')).toBe('85944171f73967e8');
  });
});
