import { describe, expect, it } from 'vitest';
import { floorUnder, railGround, type CartState, type Rail, type RailSegment } from '../sim/cart';
import { cartPose } from './cartPose';

// GDD-WLD-15, GDD-ART-06: the cart is drawn as a rigid tub on its two wheels, whose middles are 9 px behind and ahead of its middle (slice
// A's wheels: 4 px wide, 5 px in from each end of the 32 px tub). The expected angles come from the rail's shape.
const rail = (segments: readonly RailSegment[], dir: 1 | -1 = 1): Rail => ({ x: 400, y: 200, dir, segments, end: 'buffer' });
const at = (m: number): CartState => ({ phase: 'rolling', m });

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

  it('GDD-WLD-15, GDD-ART-06 a rider at either wall is drawn inside the tilted tub', () => {
    // The simulation puts his feet 8 px over the rail under his own x, at most 7.07 px from the middle on a slope. Taken into the tub's own
    // frame (about its pose's point, turned back by its angle), that point lies on its floor line and within 10 px of its middle along it,
    // inside its 16 px half-length; the rail's ground under him lies on its bottom.
    for (const [kind, dir] of [['climb', 1], ['descent', 1], ['climb', -1], ['descent', -1]] as const) {
      const r = rail([{ kind, tiles: 12 }], dir);
      const cart = at(80);
      const pose = cartPose(r, cart);
      const local = (x: number, y: number) => {
        const [dx, dy, a] = [x - pose.x, y - pose.y, -pose.angle];
        return { along: dx * Math.cos(a) - dy * Math.sin(a), up: dx * Math.sin(a) + dy * Math.cos(a) };
      };
      for (const d of [-7.0710678, 0, 7.0710678]) {
        const x = pose.x + d;
        const feet = local(x, floorUnder(r, cart, x).y);
        expect(Math.abs(feet.up), `${kind} ${dir} at ${d}`).toBeLessThan(0.01);
        expect(Math.abs(feet.along), `${kind} ${dir} at ${d}`).toBeLessThanOrEqual(10 + 0.01);
        expect(local(x, railGround(r, dir * (x - r.x))).up, `${kind} ${dir} at ${d}`).toBeCloseTo(pose.bottom, 6);
      }
    }
  });
});
