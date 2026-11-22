import { describe, expect, it } from 'vitest';
import { CATORCE_LOOKS, lookInfo } from './catorceLooks';

// GDD-BOS-04: what a frame of La Catorce's sheet shows, the inverse of the frame `catorcePose` picks. Her sheet's order (scripts/art/catorce.mjs):
// rest3 0, rest2 1, the spins of 3 lamps from 2 (spinRed3_0 3), ..., slamRed1 41, hurtWhite2 43, defeated 46, defeatedWhite 47, the wreck 48;
// the same looks facing left from 56 (7 rows of 8).
describe("GDD-BOS-04 La Catorce's looks", () => {
  it('GDD-BOS-04 looks info: the look, its facing, the lamps lit and the flash of a frame', () => {
    expect(CATORCE_LOOKS).toHaveLength(49);
    expect(lookInfo(0)).toEqual({ look: 'rest3', left: false, lamps: 3, flash: null });
    expect(lookInfo(59)).toEqual({ look: 'spinRed3_0', left: true, lamps: 3, flash: 'red' });
    expect(lookInfo(3)).toEqual({ look: 'spinRed3_0', left: false, lamps: 3, flash: 'red' });
    expect(lookInfo(1)).toEqual({ look: 'rest2', left: false, lamps: 2, flash: null });
    expect(lookInfo(41 + 56)).toEqual({ look: 'slamRed1', left: true, lamps: 1, flash: 'red' });
    expect(lookInfo(43)).toEqual({ look: 'hurtWhite2', left: false, lamps: 2, flash: 'white' });
    expect(lookInfo(46)).toEqual({ look: 'defeated', left: false, lamps: 0, flash: null });
    expect(lookInfo(47 + 56)).toEqual({ look: 'defeatedWhite', left: true, lamps: 0, flash: 'white' });
    expect(lookInfo(48)).toEqual({ look: 'wreck', left: false, lamps: 0, flash: null });
    expect(lookInfo(48 + 56)).toEqual({ look: 'wreck', left: true, lamps: 0, flash: null });
    // Frames 49 to 55 are the empty rest of the last right-facing row: the left-facing ones start at 56.
    expect(lookInfo(56)).toEqual({ look: 'rest3', left: true, lamps: 3, flash: null });
  });
});
