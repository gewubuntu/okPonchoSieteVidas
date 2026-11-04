import { describe, expect, it } from 'vitest';
import { bossStart, type BossMode, type BossState } from '../sim/boss';
import { bossFrame, bossFrameInfo, bossPipBoxes, bossPips, bossPose } from './bossPose';

const DEF = { x: 240, y: 72, floor: 224 };
const inMode = (mode: BossMode, age: number, hits = 0): BossState => ({ ...bossStart(DEF, hits), mode, age });

describe('GDD-BOS-02 how Don Zopilote is drawn', () => {
  it('GDD-BOS-02 in his telegraph his wings are up and his body flashes red every other 4 steps', () => {
    const poses = [0, 3, 4, 7, 8, 29].map((a) => bossPose(inMode('telegraph', a)));
    expect(poses.map((p) => p.wings)).toEqual(Array(6).fill('raised'));
    expect(poses.map((p) => p.flash)).toEqual(['red', 'red', null, null, 'red', null]);
    expect(poses.map((p) => p.look)).toEqual(['telegraphRed', 'telegraphRed', 'telegraph', 'telegraph', 'telegraphRed', 'telegraph']);
    expect(poses.map((p) => p.dazed)).toEqual(Array(6).fill(false));
  });

  it('GDD-BOS-02 he flaps up for 8 steps and down for 8 while he laps, drops or climbs', () => {
    const looks = { lap: ['flapUp', 'flapDown'], drop: ['flapUp', 'flapDown'], climb: ['climbUp', 'climbDown'] } as const;
    for (const mode of ['lap', 'drop', 'climb'] as const) {
      const poses = [0, 7, 8, 15, 16].map((a) => bossPose(inMode(mode, a)));
      const [up, down] = looks[mode];
      expect(poses.map((p) => p.wings), mode).toEqual(['raised', 'raised', 'lowered', 'lowered', 'raised']);
      expect(poses.map((p) => p.look), mode).toEqual([up, up, down, down, up]);
      expect(poses.map((p) => p.flash), mode).toEqual(Array(5).fill(null));
    }
  });

  it('GDD-BOS-02 diving and sweeping his wings are tucked and do not flap', () => {
    for (const [mode, look] of [['dive', 'dive'], ['sweep', 'sweep']] as const) {
      for (const age of [0, 8]) expect(bossPose(inMode(mode, age)), `${mode} ${age}`).toMatchObject({ wings: 'tucked', look, flash: null, dazed: false });
    }
  });

  it('GDD-BOS-02 stuck his wings are down and only stuck is he dazed', () => {
    for (const age of [0, 59]) expect(bossPose(inMode('stuck', age))).toMatchObject({ wings: 'lowered', dazed: true, look: 'stuck', flash: null });
    for (const mode of ['lap', 'telegraph', 'dive', 'drop', 'sweep', 'climb', 'hurt', 'defeated'] as const) expect(bossPose(inMode(mode, 0)).dazed, mode).toBe(false);
  });

  it('GDD-BOS-02 hurt or defeated his body flashes white every other 4 steps', () => {
    for (const [mode, white, plain] of [['hurt', 'hurtWhite', 'hurt'], ['defeated', 'defeatWhite', 'defeat']] as const) {
      const poses = [0, 3, 4, 8].map((a) => bossPose(inMode(mode, a)));
      expect(poses.map((p) => p.flash), mode).toEqual(['white', 'white', null, 'white']);
      expect(poses.map((p) => p.wings), mode).toEqual(Array(4).fill('tucked'));
      expect(poses.map((p) => p.look), mode).toEqual([white, white, plain, white]);
    }
  });

  it('GDD-BOS-02 his crown has a point for each hit he has left, none when defeated', () => {
    expect([0, 1, 2].map((hits) => bossPose(inMode('lap', 0, hits)).crown)).toEqual([3, 2, 1]);
    expect(bossPose(inMode('hurt', 0, 1)).crown).toBe(2);
    expect(bossPose(inMode('defeated', 0, 3)).crown).toBe(0);
  });

  it('GDD-BOS-02 each look and crown has its frame in the sheet\'s order', () => {
    expect(bossFrame({ look: 'flapUp', crown: 3 })).toBe(0);
    expect(bossFrame({ look: 'hurtWhite', crown: 3 })).toBe(10);
    expect(bossFrame({ look: 'flapUp', crown: 2 })).toBe(11);
    expect(bossFrame({ look: 'stuck', crown: 1 })).toBe(29);
    expect(bossFrame({ look: 'defeat', crown: 0 })).toBe(33);
    expect(bossFrame({ look: 'defeatWhite', crown: 0 })).toBe(34);
  });

  it('GDD-BOS-02 every frame reads back as the look and crown it was drawn for', () => {
    for (let f = 0; f <= 34; f++) expect(bossFrame(bossFrameInfo(f)), `frame ${f}`).toBe(f);
    expect(bossFrameInfo(5)).toEqual({ look: 'telegraphRed', crown: 3, wings: 'raised', flash: 'red', dots: 0 });
    expect(bossFrameInfo(2)).toEqual({ look: 'climbUp', crown: 3, wings: 'raised', flash: null, dots: 0 });
    expect(bossFrameInfo(3)).toEqual({ look: 'climbDown', crown: 3, wings: 'lowered', flash: null, dots: 0 });
    expect(bossFrameInfo(6)).toEqual({ look: 'dive', crown: 3, wings: 'tucked', flash: null, dots: 0 });
    expect(bossFrameInfo(10)).toEqual({ look: 'hurtWhite', crown: 3, wings: 'tucked', flash: 'white', dots: 0 });
    expect(bossFrameInfo(18)).toEqual({ look: 'stuck', crown: 2, wings: 'lowered', flash: null, dots: 3 });
    expect(bossFrameInfo(30)).toEqual({ look: 'sweep', crown: 1, wings: 'tucked', flash: null, dots: 0 });
    expect(bossFrameInfo(34)).toEqual({ look: 'defeatWhite', crown: 0, wings: 'tucked', flash: 'white', dots: 0 });
  });
});

describe('GDD-UI-01 the boss bar', () => {
  it('GDD-UI-01 one pip filled for each hit he has left', () => {
    expect([0, 1, 2, 3].map((hits) => bossPips(inMode('lap', 0, hits)))).toEqual([3, 2, 1, 0]);
  });

  it('GDD-UI-01 three pips 6 px square, 4 px apart, centred at the top middle', () => {
    expect(bossPipBoxes()).toEqual([
      { x: 227, y: 18, w: 6, h: 6 },
      { x: 237, y: 18, w: 6, h: 6 },
      { x: 247, y: 18, w: 6, h: 6 },
    ]);
  });
});
