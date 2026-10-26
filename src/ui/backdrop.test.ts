import { describe, expect, it } from 'vitest';
import { BACKDROP } from '../config/tuning';
import { parallaxOffset } from './backdrop';

// GDD-ART-06 (with GDD-UI-04): a far layer is drawn at a share of the camera's scroll, rounded to a whole art pixel (a quarter of a game pixel).
describe('GDD-ART-06 parallax', () => {
  it('GDD-ART-06 parallax is the scroll times the layer\'s share', () => {
    expect(parallaxOffset(0, 0.3)).toBe(0);
    expect(parallaxOffset(100, 0.3)).toBe(30);
    expect(parallaxOffset(100, 0.1)).toBe(10);
    expect(parallaxOffset(960, 0.3)).toBe(288);
  });

  it('GDD-ART-06 parallax is rounded to a whole art pixel', () => {
    expect(parallaxOffset(3.3, 0.3)).toBe(1); // 0.99 game px = 3.96 art px, rounds to 4 art px
    expect(parallaxOffset(1, 0.1)).toBe(0); // 0.4 art px rounds to 0
    expect(parallaxOffset(1.25, 0.3)).toBe(0.5); // 0.375 game px = 1.5 art px, rounds to 2 art px
    for (const factor of [0.1, 0.3]) {
      for (let scroll = 0; scroll <= 1440; scroll += 0.25) {
        expect(Number.isInteger(parallaxOffset(scroll, factor) * 4), `${scroll} x ${factor}`).toBe(true);
      }
    }
  });

  it('GDD-ART-06 parallax shares are 0.1 for the clouds and 0.3 for the mountains', () => {
    expect(BACKDROP.cloudFactor).toBe(0.1);
    expect(BACKDROP.mountainFactor).toBe(0.3);
  });
});
