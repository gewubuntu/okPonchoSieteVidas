import { describe, expect, it } from 'vitest';
import { startAnim, stepAnim, type PonchoAnim } from './ponchoAnim';

interface Body {
  x: number;
  vx: number;
  grounded: boolean;
}
const run = (x: number): Body => ({ x, vx: 120, grounded: true });

/** Steps from `anim` through each body in turn, `playing` unless stated. */
const walk = (anim: PonchoAnim, bodies: Body[], playing = true): PonchoAnim => bodies.reduce((a, b) => stepAnim(a, b, playing), anim);
/** The frame after running right from x = 0 in 2 px steps until `px` px have been covered since the first running step. */
const frameAfter = (px: number): number => {
  const xs = Array.from({ length: px / 2 + 1 }, (_, i) => run(2 + i * 2));
  return walk(startAnim(0), xs).frame;
};

/** The same, running left from x = 100 at -120 px/s. */
const frameAfterLeft = (px: number): number => {
  const bodies = Array.from({ length: px / 2 + 1 }, (_, i) => ({ x: 100 - 2 - i * 2, vx: -120, grounded: true }));
  return walk(startAnim(100), bodies).frame;
};

describe('GDD-ART-04 run frames', () => {
  it('GDD-ART-04 standing still on the ground shows frame 0', () => {
    expect(stepAnim(startAnim(0), { x: 0, vx: 0, grounded: true }, true).frame).toBe(0);
  });

  it('GDD-ART-04 the first running step shows run frame 1', () => {
    expect(stepAnim(startAnim(0), run(2), true).frame).toBe(1);
  });

  it('GDD-ART-04 one frame for every 8 px run, wrapping after 4 frames', () => {
    expect(frameAfter(0)).toBe(1);
    expect(frameAfter(8)).toBe(2);
    expect(frameAfter(16)).toBe(3);
    expect(frameAfter(24)).toBe(4);
    expect(frameAfter(32)).toBe(1);
  });

  it('GDD-ART-04 7.9 px of running is still frame 1', () => {
    expect(walk(startAnim(0), [run(2), { x: 9.9, vx: 120, grounded: true }]).frame).toBe(1);
  });

  it('GDD-ART-04 the run frames need 10 px/s on the ground', () => {
    expect(stepAnim(startAnim(0), { x: 0.1, vx: 9.9, grounded: true }, true).frame).toBe(0);
    expect(stepAnim(startAnim(0), { x: 0.1, vx: 10, grounded: true }, true).frame).toBe(1);
  });

  it('GDD-ART-04 in the air he shows frame 0, and landing restarts the cycle', () => {
    const cycling = walk(startAnim(0), [run(2), run(4), run(6), run(8), run(10)]);
    expect(cycling.frame).toBe(2);
    const air = stepAnim(cycling, { x: 12, vx: 120, grounded: false }, true);
    expect(air.frame).toBe(0);
    const airborne = stepAnim(air, { x: 14, vx: 120, grounded: false }, true);
    expect(airborne.frame).toBe(0);
    expect(stepAnim(airborne, run(16), true).frame).toBe(1);
  });

  it('GDD-ART-04 stopping mid-cycle and running again starts at frame 1', () => {
    const third = walk(startAnim(0), [run(2), run(4), run(6), run(8), run(10), run(12), run(14), run(16), run(18)]);
    expect(third.frame).toBe(3);
    const stopped = stepAnim(third, { x: 18, vx: 0, grounded: true }, true);
    expect(stopped.frame).toBe(0);
    expect(stepAnim(stopped, run(20), true).frame).toBe(1);
    // The first running step is frame 1 whatever the distance it covers (here 12 px, as when carried): the cycle counts from it.
    expect(stepAnim(stopped, run(30), true).frame).toBe(1);
  });

  it('GDD-ART-04 running left plays the same frames as running right', () => {
    for (const px of [0, 8, 16, 24, 32]) expect(frameAfterLeft(px)).toBe(frameAfter(px));
  });

  it('GDD-ART-04 when not playing he shows frame 0, even running on the ground', () => {
    expect(stepAnim(startAnim(0), run(2), false).frame).toBe(0);
    const cycling = walk(startAnim(0), [run(2), run(4)]);
    expect(stepAnim(cycling, run(6), false).frame).toBe(0);
  });
});
