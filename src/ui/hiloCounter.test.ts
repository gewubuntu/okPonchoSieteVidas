import { describe, expect, it } from 'vitest';
import { HILO_COLOURS, HILO_HUD, hiloColour, hiloCounterRight, hiloCounterText } from './hiloCounter';

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
});
