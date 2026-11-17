import { describe, expect, it } from 'vitest';
import { spawn } from '../sim/movement';
import { glowColour, glowFx, glowLook, glowMotion, glowOffsets, GLOW_FX_MAX, GLOW_PX } from './fantasmaGlow';

const looks = (fx: ReturnType<typeof glowFx>) => fx.map((f) => f.look);
const sparkles = (fx: ReturnType<typeof glowFx>) => fx.filter((f) => f.look === 'sparkleStar' || f.look === 'sparklePlus');

describe('GDD-PWR-04 the glow', () => {
  it('GDD-PWR-04 the look is none at 0, dim for the last 120 steps (2 s) and bright above', () => {
    expect([0, 1, 120, 121, 479, 480].map(glowLook)).toEqual([null, 'dim', 'dim', 'bright', 'bright', 'bright']);
  });

  it('GDD-PWR-04 the bright glow is the gold #F9D24C and the dim one the pale gold measured on the reference, #D3C193', () => {
    expect(glowColour('bright')).toBe('#F9D24C');
    expect(glowColour('dim')).toBe('#D3C193');
  });

  it('GDD-PWR-04 the four copies sit one drawing pixel of his sprite (half a game pixel) left, right, up and down', () => {
    // His frame is 48 game px, 96 drawing px (GDD-ART-04): a drawing pixel is half a game pixel.
    expect(GLOW_PX).toBe(0.5);
    expect(glowOffsets()).toEqual([
      { x: -0.5, y: 0 },
      { x: 0.5, y: 0 },
      { x: 0, y: -0.5 },
      { x: 0, y: 0.5 },
    ]);
  });

  it('GDD-PWR-04 motion: in the air, running on the ground (any speed) and otherwise standing', () => {
    expect(glowMotion({ ...spawn(0, 0), grounded: false })).toBe('air');
    expect(glowMotion({ ...spawn(0, 0), grounded: false, vx: 100 })).toBe('air');
    expect(glowMotion({ ...spawn(0, 0), vx: 1 })).toBe('run');
    expect(glowMotion({ ...spawn(0, 0), vx: -80 })).toBe('run');
    expect(glowMotion({ ...spawn(0, 0), vx: 0 })).toBe('stand');
  });

  describe('what is drawn around him', () => {
    it('GDD-PWR-04 standing, bright: three sparkles and one flame flicker', () => {
      const fx = glowFx(0, 'bright', 'stand', 1);
      expect(sparkles(fx)).toHaveLength(3);
      expect(looks(fx).filter((l) => l === 'flame')).toHaveLength(1);
      expect(looks(fx).filter((l) => l === 'streak')).toHaveLength(0);
    });

    it('GDD-PWR-04 running, bright: two streaks and sparkles, no flame', () => {
      const fx = glowFx(0, 'bright', 'run', 1);
      expect(looks(fx).filter((l) => l === 'streak')).toHaveLength(2);
      expect(looks(fx)).not.toContain('flame');
      expect(sparkles(fx).length).toBeGreaterThanOrEqual(2);
    });

    it('GDD-PWR-04 in the air, bright: sparkles only', () => {
      const fx = glowFx(0, 'bright', 'air', 1);
      expect(sparkles(fx)).toHaveLength(3);
      expect(fx).toHaveLength(3);
    });

    it('GDD-PWR-04 the streaks are behind him for both facings, drawn trailing the way he runs', () => {
      const right = glowFx(0, 'bright', 'run', 1).filter((f) => f.look === 'streak');
      const left = glowFx(0, 'bright', 'run', -1).filter((f) => f.look === 'streak');
      for (const s of right) {
        expect(s.x).toBeLessThan(0); // behind a Poncho facing right is to his left
        expect(s.flip).toBe(false);
      }
      for (const s of left) {
        expect(s.x).toBeGreaterThan(0);
        expect(s.flip).toBe(true);
      }
    });

    it('GDD-PWR-04 dim and none draw nothing round him: the dimmed glow has no sparkles or flames', () => {
      for (const motion of ['stand', 'run', 'air'] as const) {
        expect(glowFx(0, 'dim', motion, 1), motion).toEqual([]);
        expect(glowFx(0, null, motion, 1), motion).toEqual([]);
      }
    });

    it('GDD-PWR-04 no more is drawn at once than the scene has images for', () => {
      expect(GLOW_FX_MAX).toBe(4);
      for (const motion of ['stand', 'run', 'air'] as const) for (const clock of [0, 12, 30, 61]) expect(glowFx(clock, 'bright', motion, 1).length, `${motion} ${clock}`).toBeLessThanOrEqual(GLOW_FX_MAX);
    });

    it('GDD-PWR-04 the sparkles cycle with the clock, the same every time (no randomness)', () => {
      const frames = [0, 12, 24, 36, 48, 60].map((c) => JSON.stringify(sparkles(glowFx(c, 'bright', 'stand', 1))));
      expect(new Set(frames).size).toBeGreaterThan(2);
      expect(glowFx(37, 'bright', 'air', 1)).toEqual(glowFx(37, 'bright', 'air', 1));
      expect(glowFx(0, 'bright', 'stand', 1)).toEqual(glowFx(60 * 5, 'bright', 'stand', 1)); // and the cycle comes round
    });

    it('GDD-PWR-04 everything stays near him: within 28 px across and 32 px up or down of his middle', () => {
      for (const motion of ['stand', 'run', 'air'] as const) for (const clock of [0, 7, 33, 150]) for (const f of glowFx(clock, 'bright', motion, -1)) {
        expect(Math.abs(f.x), `${motion} ${f.look}`).toBeLessThanOrEqual(28);
        expect(Math.abs(f.y), `${motion} ${f.look}`).toBeLessThanOrEqual(32);
      }
    });
  });
});
