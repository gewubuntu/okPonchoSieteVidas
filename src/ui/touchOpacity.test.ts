import { describe, expect, it } from 'vitest';
import type { ButtonOpacity } from '../sim/settings';
import { touchAlpha } from './touchOpacity';

describe('GDD-CTL-03 button opacity', () => {
  it('medium keeps every alpha as it was', () => {
    expect(touchAlpha(0.35, 'medium')).toBe(0.35);
    expect(touchAlpha(0.75, 'medium')).toBe(0.75);
  });

  it('low halves it', () => {
    expect(touchAlpha(0.35, 'low')).toBe(0.175);
  });

  it('high is one and a half times it', () => {
    expect(touchAlpha(0.35, 'high')).toBeCloseTo(0.525, 10);
  });

  it('high is capped at 1', () => {
    expect(touchAlpha(0.75, 'high')).toBe(1);
  });

  it('a pressed button stays brighter than an idle one on every step', () => {
    for (const step of ['low', 'medium', 'high'] as const satisfies readonly ButtonOpacity[]) {
      expect(touchAlpha(0.75, step), step).toBeGreaterThan(touchAlpha(0.35, step));
    }
  });
});
