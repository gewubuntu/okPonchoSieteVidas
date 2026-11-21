import { describe, expect, it } from 'vitest';
import { catorceBox, catorceStart, type CatorceMode, type CatorceState } from '../sim/catorce';
import { LEVEL_3_4 } from '../levels/level3-4';
import { catorcePose } from './catorcePose';

// GDD-BOS-04: how La Catorce's stand-in is drawn from her state. Her box is 64 x 32 on the floor (y 192 to 224); every expected value below is
// worked from the GDD's words and the plan's cases, not read back from the code: the flash is 4 steps on and 4 off, so it shows on the steps
// where floor(age / 4) is even; her three lamps count her hits (three, two, one, none).
const DEF = LEVEL_3_4.catorce!;
/** She at middle `x` facing `dir` in `mode` at `age` with `hits`, armoured or not. */
const she = (o: Partial<CatorceState> & { mode: CatorceMode }): CatorceState => ({ ...catorceStart(DEF, 0), x: 400, dir: -1, armoured: false, ...o });
const flashAt = (mode: CatorceMode, age: number) => catorcePose(DEF, she({ mode, age })).flash;

describe('GDD-BOS-04 La Catorce\'s pose', () => {
  it('GDD-BOS-04 pose flash: red in her telegraph 4 steps on and 4 off, white in her hurt time the same, never otherwise', () => {
    // Telegraph: age 0 to 3 red, 4 to 7 none, 8 to 11 red, 12 to 15 none.
    const red = [0, 1, 2, 3, 8, 9, 10, 11, 16, 24];
    const none = [4, 5, 6, 7, 12, 13, 14, 15, 20, 29];
    for (const age of red) expect(flashAt('telegraph', age), `telegraph age ${age}`).toBe('red');
    for (const age of none) expect(flashAt('telegraph', age), `telegraph age ${age}`).toBeNull();
    // Hurt: age 0 to 3 white (the frame the hit-stop holds is white), 4 to 7 none, 8 to 11 white.
    for (const age of [0, 3, 8, 9, 11, 56]) expect(flashAt('hurt', age), `hurt age ${age}`).toBe('white');
    for (const age of [4, 5, 7, 12, 15, 55]) expect(flashAt('hurt', age), `hurt age ${age}`).toBeNull();
    // Resting, charging and defeated show no flash at any age, ages that are even multiples of 4 included.
    for (const mode of ['rest', 'charge', 'defeated'] as const) for (const age of [0, 1, 4, 8, 16, 100]) expect(flashAt(mode, age), `${mode} age ${age}`).toBeNull();
  });

  it('GDD-BOS-04 pose body: her box on the floor, 64 by 32 px', () => {
    for (const x of [32, 80, 240, 448]) {
      const pose = catorcePose(DEF, she({ mode: 'charge', x }));
      expect(pose.body).toEqual({ x0: x - 32, x1: x + 32, y0: 192, y1: 224 });
      expect(pose.body).toEqual(catorceBox(DEF, she({ mode: 'charge', x })));
    }
  });

  it('GDD-BOS-04 pose stack: 10 by 8 px on her roof at her front, 6 px in from her front edge', () => {
    // At x 400 facing left her box is 368 to 432: the stack's left end 6 px in from 368, its top 8 px over the roof (192).
    expect(catorcePose(DEF, she({ mode: 'charge', x: 400, dir: -1 })).stack).toEqual({ x0: 374, x1: 384, y0: 184, y1: 192 });
    // At x 80 facing right her box is 48 to 112: the stack's right end 6 px in from 112.
    expect(catorcePose(DEF, she({ mode: 'charge', x: 80, dir: 1 })).stack).toEqual({ x0: 96, x1: 106, y0: 184, y1: 192 });
  });

  it('GDD-BOS-04 pose plume: 6 by 10 px over her roof\'s middle while armoured, not once hurt or defeated, and not unarmoured', () => {
    const armoured = catorcePose(DEF, she({ mode: 'charge', x: 400, armoured: true }));
    expect(armoured.plume).toEqual({ x0: 397, x1: 403, y0: 182, y1: 192 });
    expect(catorcePose(DEF, she({ mode: 'charge', x: 400, armoured: false })).plume).toBeNull();
    // The plume is the armour's: she is never armoured and hurt in the fight, but a hurt or defeated pose has none whatever the flag says.
    expect(catorcePose(DEF, she({ mode: 'hurt', x: 400, armoured: true })).plume).toBeNull();
    expect(catorcePose(DEF, she({ mode: 'defeated', x: 400, armoured: true, hits: 3 })).plume).toBeNull();
  });

  it('GDD-BOS-04 pose lamps: three, two, one, none lit as she takes her hits, none when defeated', () => {
    expect([0, 1, 2].map((hits) => catorcePose(DEF, she({ mode: 'charge', hits })).lampsLit)).toEqual([3, 2, 1]);
    expect(catorcePose(DEF, she({ mode: 'defeated', hits: 3 })).lampsLit).toBe(0);
    // Hurt after her first hit: two lamps, after the second: one.
    expect(catorcePose(DEF, she({ mode: 'hurt', hits: 1 })).lampsLit).toBe(2);
    expect(catorcePose(DEF, she({ mode: 'hurt', hits: 2 })).lampsLit).toBe(1);
  });

  it('GDD-BOS-04 pose flip: mirrored when she faces left', () => {
    expect(catorcePose(DEF, she({ mode: 'charge', dir: -1 })).flipX).toBe(true);
    expect(catorcePose(DEF, she({ mode: 'charge', dir: 1 })).flipX).toBe(false);
  });
});
