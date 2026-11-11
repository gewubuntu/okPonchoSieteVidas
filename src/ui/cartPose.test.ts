import { describe, expect, it } from 'vitest';
import { floorUnder, railGround, railLength, type CartState, type Rail, type RailSegment } from '../sim/cart';
import { cartPose, WHEEL_OFFSET } from './cartPose';

// GDD-WLD-15, GDD-ART-06: the cart is drawn as a rigid tub on its two wheels, whose middles are 9 px behind and ahead of its middle (slice
// A's wheels: 4 px wide, 5 px in from each end of the 32 px tub). The expected angles come from the rail's shape.
const rail = (segments: readonly RailSegment[], dir: 1 | -1 = 1): Rail => ({ x: 400, y: 200, dir, segments, end: 'buffer' });
const at = (m: number): CartState => ({ phase: 'rolling', m });

/** GDD-WLD-15, GDD-ART-06: the most a wheel's bottom middle is off the rail's ground under it, for every quarter px its middle passes along `segments`. */
const worst = (segments: readonly RailSegment[]) => {
  const r = rail(segments);
  let most = 0;
  for (let m = 16; m <= railLength(r) - 16; m += 0.25) {
    const p = cartPose(r, at(m));
    for (const side of [-1, 1]) {
      const [lx, ly] = [side * WHEEL_OFFSET, p.bottom];
      const x = p.x + lx * Math.cos(p.angle) - ly * Math.sin(p.angle);
      const y = p.y + lx * Math.sin(p.angle) + ly * Math.cos(p.angle);
      most = Math.max(most, Math.abs(y - railGround(r, Math.min(railLength(r), Math.max(0, x - r.x)))));
    }
  }
  return most;
};

describe('GDD-WLD-15, GDD-ART-06 the cart\'s pose', () => {
  it('GDD-WLD-15, GDD-ART-06 the cart is drawn level on level rail', () => {
    // About the floor under its middle, 8 px over the rail's ground, its bottom 8 px under that.
    expect(cartPose(rail([{ kind: 'level', tiles: 10 }]), at(40))).toEqual({ x: 440, y: 192, angle: 0, bottom: 8 });
    expect(cartPose(rail([{ kind: 'level', tiles: 10 }]), { phase: 'waiting', m: 16 })).toEqual({ x: 416, y: 192, angle: 0, bottom: 8 });
  });

  it('GDD-WLD-15, GDD-ART-06 the cart is drawn tilted 45 degrees up on a climb and down on a descent', () => {
    // Rolling right: up the climb its right (front) side is higher, a turn of -45 degrees; down a descent +45.
    const up = cartPose(rail([{ kind: 'climb', tiles: 10 }]), at(40));
    expect(up.angle).toBeCloseTo(-Math.PI / 4, 12);
    expect([up.x, up.y]).toEqual([440, 200 - 40 - 8]); // the floor under its middle
    expect(up.bottom).toBeCloseTo(8 / Math.SQRT2, 12); // 5.66 px across its own frame
    const down = cartPose(rail([{ kind: 'descent', tiles: 10 }]), at(40));
    expect(down.angle).toBeCloseTo(Math.PI / 4, 12);
    expect([down.x, down.y]).toEqual([440, 200 + 40 - 8]);
  });

  it('GDD-WLD-15, GDD-ART-06 the cart turns as its wheels pass a join: front wheel on the slope, back wheel on the level gives half the angle\'s tangent', () => {
    // Level for 4 tiles (the join at 64 px), then a climb. Its middle at 64: the back wheel at 55 on the level (ground 200), the front at 73,
    // 9 px up the climb (ground 191): tan = -9 / 18.
    const r = rail([{ kind: 'level', tiles: 4 }, { kind: 'climb', tiles: 6 }]);
    expect(Math.tan(cartPose(r, at(64)).angle)).toBeCloseTo(-0.5, 12);
    // Its middle still on the level at 59, the front wheel 4 px up: tan = -4 / 18; level until the front wheel reaches the join (middle 55).
    expect(Math.tan(cartPose(r, at(59)).angle)).toBeCloseTo(-4 / 18, 12);
    expect(cartPose(r, at(55)).angle).toBe(0);
    // Both wheels on the climb from middle 73: 45 degrees.
    expect(cartPose(r, at(73)).angle).toBeCloseTo(-Math.PI / 4, 12);
    expect(cartPose(r, at(70)).angle).toBeGreaterThan(-Math.PI / 4);
  });

  it('GDD-WLD-15, GDD-ART-06 the cart is drawn mirrored for a cart that rolls left', () => {
    // Rolling left up a climb its left (front) side is higher: +45 degrees; at the join, the mirror of the right-rolling cart's turn.
    const up = cartPose(rail([{ kind: 'climb', tiles: 10 }], -1), at(40));
    expect(up.angle).toBeCloseTo(Math.PI / 4, 12);
    expect([up.x, up.y]).toEqual([360, 160 - 8]);
    const join = rail([{ kind: 'level', tiles: 4 }, { kind: 'climb', tiles: 6 }], -1);
    expect(Math.tan(cartPose(join, at(64)).angle)).toBeCloseTo(0.5, 12);
  });

  it('GDD-WLD-15, GDD-ART-06 a rider at the middle is drawn inside the tilted tub', () => {
    // A rider is anchored at the cart's middle, his feet 8 px over the rail there. Taken into the tub's own frame (about its pose's point,
    // turned back by its angle), that point lies on its floor line at its middle; the rail's ground under him lies on its bottom.
    for (const [kind, dir] of [['climb', 1], ['descent', 1], ['climb', -1], ['descent', -1]] as const) {
      const r = rail([{ kind, tiles: 12 }], dir);
      const cart = at(80);
      const pose = cartPose(r, cart);
      const local = (x: number, y: number) => {
        const [dx, dy, a] = [x - pose.x, y - pose.y, -pose.angle];
        return { along: dx * Math.cos(a) - dy * Math.sin(a), up: dx * Math.sin(a) + dy * Math.cos(a) };
      };
      const feet = local(pose.x, floorUnder(r, cart, pose.x).y);
      expect(Math.abs(feet.up), `${kind} ${dir}`).toBeLessThan(0.01);
      expect(Math.abs(feet.along), `${kind} ${dir}`).toBeLessThan(0.01);
      expect(local(pose.x, railGround(r, dir * (pose.x - r.x))).up, `${kind} ${dir}`).toBeCloseTo(pose.bottom, 6);
    }
    // At a join and at a peak too, where the wheels' contacts are not on one straight line with the floor under the middle: his feet are on
    // the floor line drawn, at its middle.
    for (const segments of [[{ kind: 'level', tiles: 4 }, { kind: 'climb', tiles: 4 }], [{ kind: 'climb', tiles: 4 }, { kind: 'descent', tiles: 4 }]] as const) {
      for (const m of [58, 64, 70]) {
        const r = rail(segments);
        const pose = cartPose(r, at(m));
        const [dx, dy, a] = [0, floorUnder(r, at(m), pose.x).y - pose.y, -pose.angle];
        expect(Math.abs(dx * Math.sin(a) + dy * Math.cos(a)), `${segments[1].kind} at ${m}`).toBeLessThan(0.01);
      }
    }
  });

  it('GDD-WLD-15, GDD-ART-06 the wheels\' distance from the rail at a join and at a peak', () => {
    // Each wheel's bottom middle, WHEEL_OFFSET from the tub's middle on its bottom, against the rail's ground under it, for every quarter px
    // the cart's middle passes along the rail. Measured: 0 on a straight slope; up to 5.625 px (to 0.001) where a slope meets a level stretch; 9 px at
    // a peak or a dip.
    expect(worst([{ kind: 'climb', tiles: 8 }])).toBeCloseTo(0, 9);
    expect(worst([{ kind: 'level', tiles: 4 }, { kind: 'climb', tiles: 4 }, { kind: 'level', tiles: 4 }])).toBeCloseTo(5.625, 3);
    expect(worst([{ kind: 'level', tiles: 2 }, { kind: 'climb', tiles: 4 }, { kind: 'descent', tiles: 4 }, { kind: 'level', tiles: 2 }])).toBeCloseTo(9, 6);
    expect(worst([{ kind: 'level', tiles: 2 }, { kind: 'descent', tiles: 4 }, { kind: 'climb', tiles: 4 }, { kind: 'level', tiles: 2 }])).toBeCloseTo(9, 6);
  });
});
