import { describe, expect, it } from 'vitest';
import { FANTASMA } from './tuning';

describe('GDD-PWR-04 the Chile Fantasma numbers', () => {
  it('GDD-PWR-04 FANTASMA is 480 steps, warns for 120, runs at 180', () => {
    // The GDD: 8 s, the last 2 s warn, 180 px/s, at 60 steps a second.
    expect(FANTASMA).toEqual({ steps: 480, warnSteps: 120, runSpeed: 180 });
  });
});
