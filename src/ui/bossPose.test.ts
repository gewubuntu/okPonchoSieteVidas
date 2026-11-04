import { describe, expect, it } from 'vitest';
import { bossStart, type BossMode, type BossState } from '../sim/boss';
import { bossPipBoxes, bossPips, bossPose } from './bossPose';

const DEF = { x: 240, y: 72, floor: 224 };
const inMode = (mode: BossMode, age: number, hits = 0): BossState => ({ ...bossStart(DEF, hits), mode, age });

describe('GDD-BOS-02 how Don Zopilote is drawn', () => {
  it('GDD-BOS-02 in his telegraph his wings are up and his body flashes red every other 4 steps', () => {
    expect([0, 3, 4, 7, 8, 29].map((a) => bossPose(inMode('telegraph', a)))).toEqual([
      { wings: 'raised', flash: 'red', dazed: false },
      { wings: 'raised', flash: 'red', dazed: false },
      { wings: 'raised', flash: null, dazed: false },
      { wings: 'raised', flash: null, dazed: false },
      { wings: 'raised', flash: 'red', dazed: false },
      { wings: 'raised', flash: null, dazed: false },
    ]);
  });

  it('GDD-BOS-02 he flaps up for 8 steps and down for 8 while he laps, climbs, drops or sweeps', () => {
    for (const mode of ['lap', 'climb', 'drop', 'sweep'] as const) {
      expect([0, 7, 8, 15, 16].map((a) => bossPose(inMode(mode, a)).wings), mode).toEqual(['raised', 'raised', 'lowered', 'lowered', 'raised']);
      expect(bossPose(inMode(mode, 0)).flash, mode).toBeNull();
    }
  });

  it('GDD-BOS-02 diving and stuck his wings are down, and only stuck is he dazed', () => {
    expect(bossPose(inMode('dive', 0))).toEqual({ wings: 'lowered', flash: null, dazed: false });
    expect(bossPose(inMode('stuck', 0))).toEqual({ wings: 'lowered', flash: null, dazed: true });
    expect(bossPose(inMode('stuck', 59)).dazed).toBe(true);
    for (const mode of ['lap', 'telegraph', 'dive', 'drop', 'sweep', 'climb', 'hurt', 'defeated'] as const) expect(bossPose(inMode(mode, 0)).dazed, mode).toBe(false);
  });

  it('GDD-BOS-02 hurt or defeated his body flashes white every other 4 steps', () => {
    for (const mode of ['hurt', 'defeated'] as const) {
      expect([0, 3, 4, 8].map((a) => bossPose(inMode(mode, a)).flash), mode).toEqual(['white', 'white', null, 'white']);
      expect(bossPose(inMode(mode, 0)).wings, mode).toBe('lowered');
    }
  });
});

describe('GDD-UI-01 the boss bar', () => {
  it('GDD-UI-01 one pip filled for each hit he has left', () => {
    expect([0, 1, 2, 3].map((hits) => bossPips(inMode('lap', 0, hits)))).toEqual([3, 2, 1, 0]);
  });

  it('GDD-UI-01 three pips 6 px square, 4 px apart, centred at the top middle', () => {
    expect(bossPipBoxes(3)).toEqual([
      { x: 227, y: 18, w: 6, h: 6 },
      { x: 237, y: 18, w: 6, h: 6 },
      { x: 247, y: 18, w: 6, h: 6 },
    ]);
  });

  it('GDD-UI-01 a boss beaten by more hits gets a pip for each, still centred', () => {
    // Five pips: 5 x 6 + 4 x 4 = 46 px wide, from 240 - 23 = 217.
    expect(bossPipBoxes(5).map((p) => p.x)).toEqual([217, 227, 237, 247, 257]);
  });
});
