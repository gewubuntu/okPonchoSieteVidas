import { describe, expect, it } from 'vitest';
import { HILO_COLOURS, HILO_HUD, hiloColour, hiloCounterRight, hiloCounterText, hiloStroke, hiloTextPlace } from './hiloCounter';
import { LIVES_HUD } from './livesLayout';

describe('GDD-UI-01 hilo counter', () => {
  it('reads collected/total', () => {
    expect(hiloCounterText(0, 20)).toBe('0/20');
    expect(hiloCounterText(12, 20)).toBe('12/20');
  });

  it('ends 8 px from the right edge, or 6 px left of the pause button on touch, level with the lives', () => {
    expect(hiloCounterRight(undefined)).toBe(472);
    expect(hiloCounterRight({ x: 446 })).toBe(440);
    expect(HILO_HUD.top).toBe(8);
  });

  it('takes the serape colours in turn: red, yellow, green, blue, pink, then red again', () => {
    const colours = [0, 1, 2, 3, 4, 5].map(hiloColour);
    expect(colours).toEqual([0xb94842, 0xe8b83a, 0x4e9a4a, 0x6f8fd8, 0xe07aa8, 0xb94842]);
    expect(HILO_COLOURS).toHaveLength(5);
  });

  it('GDD-UI-01 the hilo counter has the lives\' dark outline', () => {
    expect(HILO_HUD.outline).toEqual(LIVES_HUD.outline);
    expect(HILO_HUD.outline).toEqual({ colour: 0x2a1f2e, px: 1 });
    // A stroke lies half outside the glyph's edge: 2 px of stroke for a 1 px outline.
    expect(hiloStroke(1)).toBe(2);
    // Phaser pads the text's box by the stroke, so the box goes 1 px right of and 1 px above where the glyphs sit: at 472 and 8 with no
    // pause button, and 440 left of a pause button at 446.
    expect(hiloTextPlace(hiloCounterRight(undefined), hiloStroke(1))).toEqual({ x: 473, y: 7 });
    expect(hiloTextPlace(hiloCounterRight({ x: 446 }), hiloStroke(1))).toEqual({ x: 441, y: 7 });
    expect(hiloTextPlace(472, 0)).toEqual({ x: 472, y: 8 });
  });
});
