import { describe, expect, it } from 'vitest';
import { followCamera } from './camera';

// The screen is 480 px wide, so the dead zone, 32 px in the middle, is 224 to 256 px from the screen's left edge. The level is
// 1440 px wide unless stated, so the camera's scroll goes from 0 to 960.
const WIDTH = 1440;

describe('GDD-UI-04 the camera', () => {
  it('GDD-UI-04 camera stays still while Poncho is in the dead zone', () => {
    expect(followCamera(100, 330, WIDTH)).toBe(100); // screen x 230
    expect(followCamera(100, 324, WIDTH)).toBe(100); // 224, the zone's left edge
    expect(followCamera(100, 356, WIDTH)).toBe(100); // 256, the zone's right edge
  });

  it('GDD-UI-04 camera follows past the right edge of the dead zone', () => {
    expect(followCamera(0, 300, WIDTH)).toBe(44); // he stays on the zone's right edge, 256
    expect(followCamera(100, 357, WIDTH)).toBe(101);
  });

  it('GDD-UI-04 camera follows past the left edge of the dead zone', () => {
    expect(followCamera(100, 300, WIDTH)).toBe(76); // screen x 200, he stays on the zone's left edge, 224
    expect(followCamera(100, 323, WIDTH)).toBe(99);
  });

  it('GDD-UI-04 camera stops at the level edges', () => {
    expect(followCamera(0, 56, WIDTH)).toBe(0);
    expect(followCamera(500, 100, WIDTH)).toBe(0);
    expect(followCamera(900, 1430, WIDTH)).toBe(960);
    expect(followCamera(960, 1439, WIDTH)).toBe(960);
  });

  it('GDD-UI-04 a one-screen level never scrolls', () => {
    for (const target of [0, 300, 470]) expect(followCamera(0, target, 480), `${target}`).toBe(0);
    // A level narrower than the screen has a negative end to scroll to, which is no end at all.
    for (const target of [0, 300, 470]) expect(followCamera(0, target, 320), `${target}`).toBe(0);
  });

  it('GDD-UI-04 camera stands at whole art pixels', () => {
    expect(followCamera(0, 300.1, WIDTH)).toBe(44); // 44.1 rounds to a quarter-pixel step below
    expect(followCamera(0, 300.2, WIDTH)).toBe(44.25);
  });

  it('GDD-UI-04 camera stands still while Poncho is hidden', () => {
    expect(followCamera(300, null, WIDTH)).toBe(300);
  });
});
