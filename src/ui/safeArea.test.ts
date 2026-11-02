import { describe, expect, it } from 'vitest';
import { canvasInsets, NO_INSETS } from './safeArea';

/** An 844 x 390 landscape phone, as Chromium lays the 480 x 270 canvas out: 693.33 x 390 CSS px at x 75. */
const PHONE_CANVAS = { left: 75, right: 768.328125, top: 0, bottom: 390, width: 693.328125 };

describe('GDD-CTL-03 safe-area insets in the canvas', () => {
  it('GDD-CTL-03 a safe area round the whole canvas gives no insets', () => {
    expect(canvasInsets({ left: 0, right: 844, top: 0, bottom: 390 }, PHONE_CANVAS)).toEqual(NO_INSETS);
    // the side insets (47 CSS px) lie inside the letterbox bars (75 CSS px)
    expect(canvasInsets({ left: 47, right: 797, top: 0, bottom: 390 }, PHONE_CANVAS)).toEqual(NO_INSETS);
  });

  it('GDD-CTL-03 the home indicator inset reaches into a full-height canvas, rounded up to whole game px', () => {
    // 21 CSS px * 480 / 693.328125 = 14.54 game px, up to 15
    expect(canvasInsets({ left: 47, right: 797, top: 0, bottom: 369 }, PHONE_CANVAS)).toEqual({ left: 0, right: 0, top: 0, bottom: 15 });
  });

  it('GDD-CTL-03 a side inset counts only past the letterbox bar on its side', () => {
    // 15 CSS px past the left bar: 10.38 up to 11; 4.33 CSS px past the right bar: 2.996 up to 3
    expect(canvasInsets({ left: 90, right: 764, top: 0, bottom: 390 }, PHONE_CANVAS)).toEqual({ left: 11, right: 3, top: 0, bottom: 0 });
  });

  it('GDD-CTL-03 a top inset on a canvas with bars above and below', () => {
    // 4 CSS px * 480 / 1024 = 1.875 game px, up to 2
    expect(canvasInsets({ left: 0, right: 1024, top: 100, bottom: 748 }, { left: 0, right: 1024, top: 96, bottom: 672, width: 1024 })).toEqual({
      left: 0,
      right: 0,
      top: 2,
      bottom: 0,
    });
  });

  it('GDD-CTL-03 an inset of a whole number of game px is not rounded past it', () => {
    // 40 CSS px * 480 / 800 = 24 game px exactly
    expect(canvasInsets({ left: 40, right: 800, top: 0, bottom: 450 }, { left: 0, right: 800, top: 0, bottom: 450, width: 800 })).toEqual({
      left: 24,
      right: 0,
      top: 0,
      bottom: 0,
    });
  });
});
