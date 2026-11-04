import { describe, expect, it } from 'vitest';
import { estrellaStart, type Estrella, type EstrellaMode, type EstrellaState } from '../sim/estrella';
import { estrellaPose, tejocoteBoxes } from './estrellaPose';

const DEF: Estrella = { floor: 224, spots: [[400, 80], [320, 160], [400]] };
/** Her in `mode` at age `age` with `hits` taken, her middle across at x and her box's bottom at y. */
const posed = (mode: EstrellaMode, age = 0, hits = 0, x = 240, y = 112): EstrellaState => ({ ...estrellaStart(DEF, hits), mode, age, x, y, tx: x, ty: y });

describe('GDD-BOS-03 how La Estrella is drawn', () => {
  it('GDD-BOS-03 she is drawn about her box middle', () => {
    expect(estrellaPose(posed('hang'))).toMatchObject({ x: 240, y: 96 });
  });

  it('GDD-BOS-03 her cones: 7, then 5, 3 and none after each hit, the bottom ones torn first', () => {
    expect([0, 1, 2, 3].map((hits) => estrellaPose(posed('hang', 0, hits)).cones.map((c) => c.index))).toEqual([[0, 1, 2, 3, 4, 5, 6], [0, 1, 2, 5, 6], [0, 1, 6], []]);
  });

  it('GDD-BOS-03 her three top cones have pale tips', () => {
    expect(estrellaPose(posed('hang')).cones.filter((c) => c.pale).map((c) => c.index)).toEqual([0, 1, 6]);
  });

  it('GDD-BOS-03 her star is about 56 px across: each tip 28 px from her middle, the first straight up, the rest clockwise', () => {
    const cones = estrellaPose(posed('hang')).cones;
    expect(cones[0]).toMatchObject({ tipX: 240, tipY: 68 });
    for (const c of cones) expect(Math.hypot(c.tipX - 240, c.tipY - 96), `cone ${c.index}`).toBeCloseTo(28, 6);
    expect(cones[1]!.tipX).toBeGreaterThan(240);
    expect(cones[6]!.tipX).toBeLessThan(240);
    expect(cones[3]!.tipY).toBeGreaterThan(96);
  });

  it('GDD-BOS-03 in her telegraph her body flashes red every other 4 steps', () => {
    expect([0, 3, 4, 7, 8, 29].map((a) => estrellaPose(posed('telegraph', a)).flash)).toEqual(['red', 'red', null, null, 'red', null]);
  });

  it('GDD-BOS-03 hurt or defeated her body flashes white every other 4 steps', () => {
    for (const mode of ['hurt', 'defeated'] as const) expect([0, 3, 4, 8].map((a) => estrellaPose(posed(mode, a)).flash), mode).toEqual(['white', 'white', null, 'white']);
  });

  it('GDD-BOS-03 otherwise her body does not flash', () => {
    for (const mode of ['glide', 'drop', 'bounce', 'rest', 'rise', 'hang', 'yank'] as const) expect(estrellaPose(posed(mode)).flash, mode).toBeNull();
  });

  it('GDD-BOS-03 her rope hangs straight from the cable at y 8 to her top', () => {
    expect(estrellaPose(posed('hang')).rope).toEqual([
      { x: 240, y: 8 },
      { x: 240, y: 80 },
    ]);
  });

  it('GDD-BOS-03 in her telegraph her rope shakes in a zigzag 2 px to either side every 4 px, flipping every 4 steps', () => {
    expect(estrellaPose(posed('telegraph', 0, 0, 240, 60)).rope).toEqual([
      { x: 240, y: 8 },
      { x: 242, y: 12 },
      { x: 238, y: 16 },
      { x: 242, y: 20 },
      { x: 238, y: 24 },
      { x: 240, y: 28 },
    ]);
    expect(estrellaPose(posed('telegraph', 4, 0, 240, 60)).rope!.map((p) => p.x)).toEqual([240, 238, 242, 238, 242, 240]);
  });

  it('GDD-BOS-03 defeated, her rope has snapped', () => {
    expect(estrellaPose(posed('defeated', 0, 3)).rope).toBeNull();
  });

  it('GDD-BOS-03 her tejocotes are drawn as 8 px squares, only once out of her', () => {
    expect(
      tejocoteBoxes([
        { x: 100, y: 224, dir: 1, wait: 0 },
        { x: 160, y: 224, dir: -1, wait: 24 },
      ]),
    ).toEqual([{ x: 96, y: 216, w: 8, h: 8 }]);
  });
});
