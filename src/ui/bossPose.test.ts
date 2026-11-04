import { describe, expect, it } from 'vitest';
import { BOSS } from '../config/tuning';
import { bossStart, type BossMode, type BossState } from '../sim/boss';
import { bossFrame, bossFrameInfo, bossPipBoxes, bossPips, bossPose } from './bossPose';

const DEF = { x: 240, y: 72, floor: 224 };
const inMode = (mode: BossMode, age: number, hits = 0): BossState => ({ ...bossStart(DEF, hits), mode, age });
const pose = (b: BossState) => bossPose(b, DEF.floor);
/** He in `mode` at age 8 (the flap down), his box's bottom `bottom` px above the floor. */
/** He defeated at `age` with his box's bottom `bottom` px above the floor, all three hits taken. */
const fallen = (age: number, bottom: number): BossState => ({ ...inMode('defeated', age, 3), y: DEF.floor - bottom - BOSS.height / 2 });
const at = (mode: BossMode, bottom: number): BossState => ({ ...inMode(mode, 8), y: DEF.floor - bottom - BOSS.height / 2 });

describe('GDD-BOS-02 how Don Zopilote is drawn', () => {
  it('GDD-BOS-02 in his telegraph his wings are up and his body flashes red every other 4 steps', () => {
    const poses = [0, 3, 4, 7, 8, 29].map((a) => pose(inMode('telegraph', a)));
    expect(poses.map((p) => p.wings)).toEqual(Array(6).fill('raised'));
    expect(poses.map((p) => p.flash)).toEqual(['red', 'red', null, null, 'red', null]);
    expect(poses.map((p) => p.look)).toEqual(['telegraphRed', 'telegraphRed', 'telegraph', 'telegraph', 'telegraphRed', 'telegraph']);
    expect(poses.map((p) => p.dazed)).toEqual(Array(6).fill(false));
  });

  it('GDD-BOS-02 he flaps up for 8 steps and down for 8 while he laps, drops or climbs', () => {
    const looks = { lap: ['flapUp', 'flapDown'], drop: ['flapUp', 'flapDown'], climb: ['climbUp', 'climbDown'] } as const;
    for (const mode of ['lap', 'drop', 'climb'] as const) {
      const poses = [0, 7, 8, 15, 16].map((a) => pose(inMode(mode, a)));
      const [up, down] = looks[mode];
      expect(poses.map((p) => p.wings), mode).toEqual(['raised', 'raised', 'lowered', 'lowered', 'raised']);
      expect(poses.map((p) => p.look), mode).toEqual([up, up, down, down, up]);
      expect(poses.map((p) => p.flash), mode).toEqual(Array(5).fill(null));
    }
  });

  it('GDD-BOS-02 diving and sweeping his wings are tucked and do not flap', () => {
    for (const [mode, look] of [['dive', 'dive'], ['sweep', 'sweep']] as const) {
      for (const age of [0, 8]) expect(pose(inMode(mode, age)), `${mode} ${age}`).toMatchObject({ wings: 'tucked', look, flash: null, dazed: false });
    }
  });

  it('GDD-BOS-02 stuck his wings are down and he is dazed (lying defeated, below, too)', () => {
    for (const age of [0, 59]) expect(pose(inMode('stuck', age))).toMatchObject({ wings: 'lowered', dazed: true, look: 'stuck', flash: null });
    for (const mode of ['lap', 'telegraph', 'dive', 'drop', 'sweep', 'climb', 'hurt', 'defeated'] as const) expect(pose(inMode(mode, 0)).dazed, mode).toBe(false);
  });

  it('GDD-BOS-02 hurt or defeated his body flashes white every other 4 steps', () => {
    // Defeated at age 0 to 8 up in the air (room 100 px): he tumbles, A in the first 6 steps.
    for (const [mode, white, plain] of [['hurt', 'hurtWhite', 'hurt'], ['defeated', 'tumbleAWhite', 'tumbleA']] as const) {
      const poses = [0, 3, 4, 5, 8].map((a) => pose(inMode(mode, a)));
      expect(poses.map((p) => p.flash), mode).toEqual(['white', 'white', null, null, 'white']);
      expect(poses.map((p) => p.wings), mode).toEqual(Array(5).fill('tucked'));
      expect(poses.map((p) => p.look), mode).toEqual([white, white, plain, plain, mode === 'hurt' ? white : 'tumbleBWhite']);
    }
  });

  it('GDD-BOS-02 defeated with room he tumbles: A for 6 steps, B for 6, A again, with the white flash on the blink', () => {
    // Ages 0 to 5 are A, 6 to 11 B, 12 A; the flash is on for ages 0 to 3, off 4 to 7, on 8 to 11, off 12 to 15, on 16 to 19.
    expect([0, 3, 4, 5, 6, 7, 8, 11, 12, 15, 18].map((a) => pose(fallen(a, 100)).look)).toEqual(['tumbleAWhite', 'tumbleAWhite', 'tumbleA', 'tumbleA', 'tumbleB', 'tumbleB', 'tumbleBWhite', 'tumbleBWhite', 'tumbleA', 'tumbleA', 'tumbleBWhite']);
  });

  it('GDD-BOS-02 a tumble frame shows only while it fits: B needs 12 px above the floor, A needs 7, else he lies', () => {
    // Age 6 is the first B step and off the flash (floor(6 / 4) is 1), so the plain looks show; age 4 is off it too.
    expect(pose(fallen(6, 12)).look).toBe('tumbleB');
    expect(pose(fallen(6, 11)).look).toBe('tumbleA');
    expect(pose(fallen(6, 7)).look).toBe('tumbleA');
    expect(pose(fallen(6, 6)).look).toBe('defeat');
    expect(pose(fallen(6, 0)).look).toBe('defeat');
    // A in its turn needs 7 too.
    expect(pose(fallen(4, 7)).look).toBe('tumbleA');
    expect(pose(fallen(4, 6)).look).toBe('defeat');
    expect(pose(fallen(4, 0)).look).toBe('defeat');
    // The same on the flash: age 8 is B (on), 0 is A (on).
    expect(pose(fallen(8, 12)).look).toBe('tumbleBWhite');
    expect(pose(fallen(8, 11)).look).toBe('tumbleAWhite');
    expect(pose(fallen(8, 6)).look).toBe('defeatWhite');
    expect(pose(fallen(0, 6)).look).toBe('defeatWhite');
  });

  it('GDD-BOS-02 only lying defeated is he dazed, with the three dots; the tumbles are not', () => {
    expect([pose(fallen(4, 0)), pose(fallen(0, 0))].map((q) => [q.look, q.dazed])).toEqual([['defeat', true], ['defeatWhite', true]]);
    expect([pose(fallen(4, 50)), pose(fallen(6, 50)), pose(fallen(0, 50)), pose(fallen(8, 50)), pose(fallen(4, 8))].map((q) => [q.look, q.dazed])).toEqual([['tumbleA', false], ['tumbleB', false], ['tumbleAWhite', false], ['tumbleBWhite', false], ['tumbleA', false]]);
    // His wings are tucked in all of them, and none has a crown.
    for (const [age, bottom] of [[4, 0], [0, 0], [4, 50], [6, 50], [8, 50], [0, 50]] as const) expect(pose(fallen(age, bottom)), `${age} ${bottom}`).toMatchObject({ wings: 'tucked', crown: 0 });
  });

  it('GDD-BOS-02 flapping, his wings stay raised while lowered ones would reach into the floor', () => {
    // His box's bottom 14 px above the floor leaves room for the lowered wings (BOSS_ART.wingsBelow); 13 px does not.
    for (const mode of ['lap', 'drop', 'climb'] as const) {
      expect(pose(at(mode, 14)).wings, `${mode} 14`).toBe('lowered');
      expect(pose(at(mode, 13)).wings, `${mode} 13`).toBe('raised');
      expect(pose(at(mode, 0)).wings, `${mode} 0`).toBe('raised');
    }
    expect(pose(at('climb', 13)).look).toBe('climbUp');
    expect(pose(at('drop', 13)).look).toBe('flapUp');
  });

  it('GDD-BOS-02 his crown has a point for each hit he has left, none when defeated', () => {
    expect([0, 1, 2].map((hits) => pose(inMode('lap', 0, hits)).crown)).toEqual([3, 2, 1]);
    expect(pose(inMode('hurt', 0, 1)).crown).toBe(2);
    expect(pose(inMode('defeated', 0, 3)).crown).toBe(0);
  });

  it('GDD-BOS-02 each look and crown has its frame in the sheet\'s order', () => {
    expect(bossFrame({ look: 'flapUp', crown: 3 })).toBe(0);
    expect(bossFrame({ look: 'hurtWhite', crown: 3 })).toBe(10);
    expect(bossFrame({ look: 'flapUp', crown: 2 })).toBe(11);
    expect(bossFrame({ look: 'stuck', crown: 1 })).toBe(29);
    const defeat = ['tumbleA', 'tumbleAWhite', 'tumbleB', 'tumbleBWhite', 'defeat', 'defeatWhite'] as const;
    defeat.forEach((look, i) => expect(bossFrame({ look, crown: 0 }), look).toBe(33 + i));
  });

  it('GDD-BOS-02 every frame reads back as the look and crown it was drawn for', () => {
    for (let f = 0; f <= 38; f++) expect(bossFrame(bossFrameInfo(f)), `frame ${f}`).toBe(f);
    expect(bossFrameInfo(5)).toEqual({ look: 'telegraphRed', crown: 3, wings: 'raised', flash: 'red', dots: 0 });
    expect(bossFrameInfo(2)).toEqual({ look: 'climbUp', crown: 3, wings: 'raised', flash: null, dots: 0 });
    expect(bossFrameInfo(3)).toEqual({ look: 'climbDown', crown: 3, wings: 'lowered', flash: null, dots: 0 });
    expect(bossFrameInfo(6)).toEqual({ look: 'dive', crown: 3, wings: 'tucked', flash: null, dots: 0 });
    expect(bossFrameInfo(10)).toEqual({ look: 'hurtWhite', crown: 3, wings: 'tucked', flash: 'white', dots: 0 });
    expect(bossFrameInfo(18)).toEqual({ look: 'stuck', crown: 2, wings: 'lowered', flash: null, dots: 3 });
    expect(bossFrameInfo(30)).toEqual({ look: 'sweep', crown: 1, wings: 'tucked', flash: null, dots: 0 });
    expect(bossFrameInfo(33)).toEqual({ look: 'tumbleA', crown: 0, wings: 'tucked', flash: null, dots: 0 });
    expect(bossFrameInfo(34)).toEqual({ look: 'tumbleAWhite', crown: 0, wings: 'tucked', flash: 'white', dots: 0 });
    expect(bossFrameInfo(35)).toEqual({ look: 'tumbleB', crown: 0, wings: 'tucked', flash: null, dots: 0 });
    expect(bossFrameInfo(36)).toEqual({ look: 'tumbleBWhite', crown: 0, wings: 'tucked', flash: 'white', dots: 0 });
    expect(bossFrameInfo(37)).toEqual({ look: 'defeat', crown: 0, wings: 'tucked', flash: null, dots: 3 });
    expect(bossFrameInfo(38)).toEqual({ look: 'defeatWhite', crown: 0, wings: 'tucked', flash: 'white', dots: 3 });
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
