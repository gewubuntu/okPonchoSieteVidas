import { describe, expect, it } from 'vitest';
import { CATORCE } from '../config/tuning';
import { catorceBox, catorceStart, type CatorceMode, type CatorceState } from '../sim/catorce';
import { LEVEL_3_4 } from '../levels/level3-4';
import { CATORCE_LOOKS } from './catorceLooks';
import { catorcePose } from './catorcePose';

// GDD-BOS-04: which frame of her sheet La Catorce is drawn with, and her plume. Her box is 64 x 32 on the floor (y 192 to 224); every expected
// value below is worked from the GDD's words and the plan's cases, not read back from the code: her flashes are 4 steps on and 4 off, so they show
// on the steps where floor(age / 4) is even; the lamps lit are 3 less her hits; in her telegraph her wheels turn a quarter every 2 steps
// (floor(age / 2) % 4); in her charge a quarter every 2 pi px run; she is drawn squashed for 4 steps after a slam; defeated she is white for 4
// steps, plain for 4, then a wreck. Her sheet's order: rest3 0, rest2 1, then for 3, 2 and 1 lamps the spins (spin_0, spinRed_0, spin_1, ...),
// so spin3_0 is 2 and spinRed3_0 3; the left-facing frames are 56 on (7 rows of 8).
const DEF = LEVEL_3_4.catorce!;
/** She at middle `x` facing `dir` in `mode` at `age` with `hits`, armoured or not. */
const she = (o: Partial<CatorceState> & { mode: CatorceMode }): CatorceState => ({ ...catorceStart(DEF, 0), x: 400, dir: -1, armoured: false, ...o });
const lookOf = (o: Partial<CatorceState> & { mode: CatorceMode }) => catorcePose(DEF, she(o)).look;

describe("GDD-BOS-04 La Catorce's pose", () => {
  it('GDD-BOS-04 pose body: her box on the floor, 64 by 32 px', () => {
    for (const x of [32, 80, 240, 448]) {
      const pose = catorcePose(DEF, she({ mode: 'charge', x }));
      expect(pose.body).toEqual({ x0: x - 32, x1: x + 32, y0: 192, y1: 224 });
      expect(pose.body).toEqual(catorceBox(DEF, she({ mode: 'charge', x })));
    }
    expect(catorcePose(DEF, catorceStart(DEF, 0)).body).toEqual({ x0: 368, x1: 432, y0: 192, y1: 224 });
  });

  it('GDD-BOS-04 pose rest: parked with her lamps lit, three in phase 1, two in phase 2, once her squash is over', () => {
    for (const age of [4, 5, 8, 100, 179]) expect(lookOf({ mode: 'rest', hits: 0, x: 80, age }), `hits 0 age ${age}`).toBe('rest3');
    for (const age of [4, 7, 59]) expect(lookOf({ mode: 'rest', hits: 1, x: 400, age }), `hits 1 age ${age}`).toBe('rest2');
  });

  it('GDD-BOS-04 pose telegraph: wheels a quarter turn every 2 steps, red 4 steps on and 4 off', () => {
    // Her phase 1 start: armoured, so no slam came before it.
    const want: Record<number, string> = { 0: 'spinRed3_0', 1: 'spinRed3_0', 2: 'spinRed3_1', 3: 'spinRed3_1', 4: 'spin3_2', 5: 'spin3_2', 6: 'spin3_3', 7: 'spin3_3', 8: 'spinRed3_0', 9: 'spinRed3_0', 10: 'spinRed3_1', 12: 'spin3_2', 29: 'spin3_2' };
    for (const [age, look] of Object.entries(want)) expect(lookOf({ mode: 'telegraph', hits: 0, armoured: true, age: Number(age) }), `age ${age}`).toBe(look);
    // Age 5: the flash is off (floor(5 / 4) = 1) and the turn is floor(5 / 2) % 4 = 2. Not red.
    expect(lookOf({ mode: 'telegraph', hits: 0, age: 5 })).toBe('spin3_2');
    // Two lamps in phase 2, one in phase 3.
    expect(lookOf({ mode: 'telegraph', hits: 1, armoured: true, age: 0 })).toBe('spinRed2_0');
    expect(lookOf({ mode: 'telegraph', hits: 1, armoured: true, age: 6 })).toBe('spin2_3');
    expect(lookOf({ mode: 'telegraph', hits: 2, armoured: true, age: 13 })).toBe('spin1_2');
  });

  it('GDD-BOS-04 pose slam: squashed for 4 steps after a slam, in her rest and in phase 3 in her telegraph', () => {
    // Phase 1 and 2: her slam starts her rest.
    for (const age of [0, 3]) expect(lookOf({ mode: 'rest', hits: 0, x: 80, age }), `hits 0 age ${age}`).toBe('slam3');
    expect(lookOf({ mode: 'rest', hits: 0, x: 80, age: 4 })).toBe('rest3');
    for (const age of [0, 3]) expect(lookOf({ mode: 'rest', hits: 1, x: 80, age }), `hits 1 age ${age}`).toBe('slam2');
    expect(lookOf({ mode: 'rest', hits: 1, x: 80, age: 4 })).toBe('rest2');
    // Phase 3 has no rest: her slam starts a telegraph, unarmoured (the slam ended her armour), its red flash on.
    for (const age of [0, 2, 3]) expect(lookOf({ mode: 'telegraph', hits: 2, x: 32, armoured: false, age }), `phase 3 age ${age}`).toBe('slamRed1');
    expect(lookOf({ mode: 'telegraph', hits: 2, x: 32, armoured: false, age: 4 })).toBe('spin1_2');
    // Phase 3's first telegraph is armoured: no slam came before it.
    expect(lookOf({ mode: 'telegraph', hits: 2, armoured: true, age: 2 })).toBe('spinRed1_1');
    // In phases 1 and 2 an unarmoured telegraph follows her rest, not a slam.
    expect(lookOf({ mode: 'telegraph', hits: 0, x: 80, armoured: false, age: 2 })).toBe('spinRed3_1');
    expect(lookOf({ mode: 'telegraph', hits: 1, x: 80, armoured: false, age: 2 })).toBe('spinRed2_1');
  });

  it('GDD-BOS-04 pose charge: her wheels a quarter turn every 2 pi px, rolling the way she runs', () => {
    // x 200: q = floor(200 / 6.2832) = 31. Facing right the turn is 31 % 4 = 3; facing left it runs backwards, ((-31 % 4) + 4) % 4 = 1.
    expect(catorcePose(DEF, she({ mode: 'charge', hits: 1, x: 200, dir: 1 }))).toMatchObject({ look: 'run2_3', left: false });
    expect(catorcePose(DEF, she({ mode: 'charge', hits: 1, x: 200, dir: -1 }))).toMatchObject({ look: 'run2_1', left: true });
    // x 210: q 33, turn 1 facing right.
    expect(lookOf({ mode: 'charge', hits: 1, x: 210, dir: 1 })).toBe('run2_1');
    // Three lamps and one: x 6.3 is q 1.
    expect(lookOf({ mode: 'charge', hits: 0, x: 0, dir: 1 })).toBe('run3_0');
    expect(lookOf({ mode: 'charge', hits: 0, x: 6.3, dir: 1 })).toBe('run3_1');
    expect(lookOf({ mode: 'charge', hits: 2, x: 6.3, dir: -1 })).toBe('run1_3');
  });

  it('GDD-BOS-04 pose hurt: the lamps left after the hit, white 4 steps on and 4 off', () => {
    expect([0, 3, 4, 7, 8, 12, 59].map((age) => lookOf({ mode: 'hurt', hits: 1, age }))).toEqual(['hurtWhite2', 'hurtWhite2', 'hurt2', 'hurt2', 'hurtWhite2', 'hurt2', 'hurtWhite2']);
    expect([0, 4].map((age) => lookOf({ mode: 'hurt', hits: 2, age }))).toEqual(['hurtWhite1', 'hurt1']);
  });

  it('GDD-BOS-04 pose defeated: white for 4 steps, plain for 4, then the wreck', () => {
    expect([0, 3, 4, 7, 8, 59, 60].map((age) => lookOf({ mode: 'defeated', hits: 3, age }))).toEqual(['defeatedWhite', 'defeatedWhite', 'defeated', 'defeated', 'wreck', 'wreck', 'wreck']);
  });

  it('GDD-BOS-04 pose facing: drawn facing the way she runs', () => {
    expect(catorcePose(DEF, catorceStart(DEF, 0)).left).toBe(true);
    for (const mode of ['rest', 'telegraph', 'charge', 'hurt'] as const) {
      expect(catorcePose(DEF, she({ mode, hits: 1, dir: -1 })).left, `${mode} left`).toBe(true);
      expect(catorcePose(DEF, she({ mode, hits: 1, dir: 1 })).left, `${mode} right`).toBe(false);
    }
    expect(catorcePose(DEF, she({ mode: 'defeated', hits: 3, dir: 1 })).left).toBe(false);
  });

  it('GDD-BOS-04 pose plume: 6 by 10 px over her middle stud while armoured, its foot 4 px under her top, a frame every 8 steps', () => {
    // Her start: x 400 facing left, so the stud is 1.25 px left of her middle (398.75); her box's top 192, the plume's foot at 196, the stud's top.
    expect(catorcePose(DEF, catorceStart(DEF, 0)).plume).toEqual({ box: { x0: 395.75, x1: 401.75, y0: 186, y1: 196 }, frame: 0 });
    // At x 80 facing right, 1.25 px right of her middle.
    expect(catorcePose(DEF, she({ mode: 'charge', x: 80, dir: 1, armoured: true })).plume!.box).toEqual({ x0: 78.25, x1: 84.25, y0: 186, y1: 196 });
    expect([0, 4, 7, 8, 15, 16].map((age) => catorcePose(DEF, she({ mode: 'telegraph', armoured: true, age })).plume!.frame)).toEqual([0, 0, 0, 1, 1, 0]);
    expect(catorcePose(DEF, she({ mode: 'charge', armoured: false })).plume).toBeNull();
    // The plume is the armour's: she is never armoured and hurt in the fight, but a hurt or defeated pose has none whatever the flag says.
    expect(catorcePose(DEF, she({ mode: 'hurt', hits: 1, armoured: true })).plume).toBeNull();
    expect(catorcePose(DEF, she({ mode: 'defeated', hits: 3, armoured: true })).plume).toBeNull();
  });

  it('GDD-BOS-04 pose looks: 36 of her 49 looks are ever posed, 13 never with these numbers', () => {
    // Every state the fight can hold: in phase p (hits p, lamps 3 - p) her rest (none in phase 3), her telegraph armoured or not, her charge
    // at every whole x between the phase's stops either way, armoured or not; hurt after hits 1 and 2; defeated after the third.
    const posed = new Set<string>();
    const pose = (o: Partial<CatorceState> & { mode: CatorceMode }) => posed.add(lookOf(o));
    for (const hits of [0, 1, 2]) {
      for (let age = 0; age < CATORCE.restSteps[hits]!; age++) pose({ mode: 'rest', hits, age });
      for (let age = 0; age < CATORCE.telegraphSteps; age++) for (const armoured of [true, false]) pose({ mode: 'telegraph', hits, age, armoured });
      const [from, to] = CATORCE.stops[hits]!;
      for (let x = from; x <= to; x++) for (const dir of [1, -1] as const) for (const armoured of [true, false]) pose({ mode: 'charge', hits, x, dir, armoured });
    }
    for (const hits of [1, 2]) for (let age = 0; age < CATORCE.hurtSteps; age++) pose({ mode: 'hurt', hits, age });
    for (let age = 0; age < CATORCE.defeatSteps; age++) pose({ mode: 'defeated', hits: 3, age });
    // Her red flash (ages 0 to 3 of every 8) meets the wheel quarters 0 and 1 only (floor(age / 2) % 4), plain meets 2 and 3 only: 12 spins
    // never posed. Phase 3's slam is in a telegraph at ages 0 to 3, always red: slamRed1, never slam1. 12 + 1 = 13; 49 - 13 = 36.
    const never = CATORCE_LOOKS.filter((look) => !posed.has(look));
    expect(never).toEqual(['spin3_0', 'spin3_1', 'spinRed3_2', 'spinRed3_3', 'spin2_0', 'spin2_1', 'spinRed2_2', 'spinRed2_3', 'spin1_0', 'spin1_1', 'spinRed1_2', 'spinRed1_3', 'slam1']);
    expect([CATORCE_LOOKS.length, posed.size]).toEqual([49, 36]);
  });

  it('GDD-BOS-04 pose frame: her look\'s place in her sheet, 56 on facing left', () => {
    // The start: spinRed3_0 (3), facing left: 59; the same facing right: 3.
    expect(catorcePose(DEF, catorceStart(DEF, 0)).frame).toBe(59);
    expect(catorcePose(DEF, { ...catorceStart(DEF, 0), dir: 1 }).frame).toBe(3);
    // rest3 is the first frame, the wreck the 49th (48), each 56 on facing left.
    expect(catorcePose(DEF, she({ mode: 'rest', hits: 0, age: 10, dir: 1 })).frame).toBe(0);
    expect(catorcePose(DEF, she({ mode: 'rest', hits: 0, age: 10, dir: -1 })).frame).toBe(56);
    expect(catorcePose(DEF, she({ mode: 'defeated', hits: 3, age: 20, dir: 1 })).frame).toBe(48);
    expect(catorcePose(DEF, she({ mode: 'defeated', hits: 3, age: 20, dir: -1 })).frame).toBe(104);
  });
});
