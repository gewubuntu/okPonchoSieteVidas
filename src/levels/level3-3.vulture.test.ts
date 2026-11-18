import { describe, expect, it } from 'vitest';
import { platformAt } from '../sim/platform';
import type { PlayerInput } from '../sim/movement';
import type { RunState } from '../sim/run';
import {
  clocks,
  drive,
  type Drive,
  E,
  idle,
  inCart,
  K3_ANSWERS,
  L,
  last,
  noZopilote,
  onA,
  onGroundAt,
  onP5,
  right,
  tag,
  telegraphed,
  waitAt,
  waited,
  withParked,
  Y,
  zopilote,
} from './level3-3.drive';
import { LEVEL_3_3_PLATFORM } from './level3-3';

// GDD-WLD-18, phase V2: the Zopilote 108 px over P5 at its lowest, centred on x = 3024 (its sight x 2880 to 3168), the heavy sweeps over its clocks. The
// exact pins (its reach, the least gaps, the held jump at x 3024) are in `level3-3.enemies.test.ts` at every 6th clock; these sweeps take every `step`th
// clock, named in each test, so that this file runs in at most 300 s alone (vitest runs the 3-3 files in parallel). The take-offs stay 0.2 tile apart
// (L-014): the clocks are coarsened, never the take-offs. Every expected number is what the real `stepRun` gives on the real level (L-003).

const CLAW_STEP = 48;
/** Nothing held but the claw, pressed on step `n` of a drive (and let go on the next, L-048). */
const press = (n: number) => (_r: RunState, i: number): PlayerInput => ({ move: 0, jumpHeld: false, claw: i === n });

describe('GDD-WLD-18 level 3-3 the claw on the vulture, over the clocks of the Zopilote', () => {
  it('GDD-WLD-18 3-3 the claw meets only a vulture set off by a jump: a standing swing has no dive to meet, a jump-claw telegraphs it and cannot reach it, K3 parked, at the stretch edge, step 48', () => {
    // K3 is left out (parked at its buffer, x = 2928) so the claw's own reach is what is driven; he waits at x = 2992 facing right, under the vulture's
    // line (x 2976 to 3072), at every 48th clock (150 of the 1,200). Its lowest point is 108 px over P5's top (y 268 to 292, its box to 297): a standing
    // Poncho is never seen, so it never dives on him and the standing swing (20 px long in front of his body, his feet to 32 px up, y 368 to 400) has
    // nothing to meet; the jump-claw (his feet 56 px up at the top of a jump, the swing y 312 to 344) sets it off, as any jump does, and cannot reach it:
    // its box is over the swing. Each clock: a swing pressed on each of the first 16 steps of his wait, and a jump and swing (the swing at the top of
    // the jump) pressed on each of them. Measured, GDD-WLD-18 "or the vulture is clawed first" (V1, the vulture 48 px over P5: the standing swing
    // defeated it from 3 to 13 of the 16 steps before its dive, at every clock): waiting costs nothing at any clock; of 2,400 standing swings none sets
    // it off and none defeats it; of 2,400 jump-claws all 2,400 set it off (at every clock), none defeats it, and all 2,400 lose the life in the 120
    // steps (he lands and stands where it dives).
    const swing = { runs: 0, telegraph: 0, lost: 0, defeated: 0 };
    const jumping = { runs: 0, telegraph: 0, lost: 0, defeated: 0, clocksTelegraphed: 0 };
    let waitLost = 0;
    for (const t of clocks(7200, CLAW_STEP)) {
      const waits = waited(withParked(onP5(2992, Y(25), t), 'K2', 'K3'), 400);
      if (waits.length <= 400) waitLost++;
      let telegraphed_ = false;
      for (let j = 0; j < 16; j++) {
        const s = drive(waits[j]!, 120, press(0), (r, i) => !zopilote(r).alive || i >= 100);
        swing.runs++;
        if (telegraphed(s.states)) swing.telegraph++;
        if (s.lost) swing.lost++;
        if (!s.lost && !zopilote(last(s.states)).alive) swing.defeated++;
        let top = -1;
        const d = drive(waits[j]!, 120, (r, i) => {
          if (top < 0 && i > 0 && r.player.vy >= 0) top = i;
          return { move: 0, jumpHeld: top < 0, claw: top >= 0 && i === top };
        }, (r, i) => !zopilote(r).alive || i >= 100);
        jumping.runs++;
        if (telegraphed(d.states)) {
          jumping.telegraph++;
          telegraphed_ = true;
        }
        if (d.lost) jumping.lost++;
        if (!d.lost && !zopilote(last(d.states)).alive) jumping.defeated++;
      }
      if (telegraphed_) jumping.clocksTelegraphed++;
    }
    expect({ waitLost, swing, jumping }).toEqual({
      waitLost: 0,
      swing: { runs: 2400, telegraph: 0, lost: 0, defeated: 0 },
      jumping: { runs: 2400, telegraph: 2400, lost: 2400, defeated: 0, clocksTelegraphed: 150 },
    });
  }, 25_000);
});

interface GroundTally {
  runs: number;
  seen: number;
  lost: number;
}
const noOne = (runs: number): GroundTally => ({ runs, seen: 0, lost: 0 });

/**
 * K3's emptied cart, driven for real: waiting where K3 wakes (`waitAt`), the first stomp that lives at this clock (the plain jump, else the held one, at
 * the steps of its window found on the copy without the vulture), then left held to the cart's edge (x = 2956, the cart parked at its buffer, x 2912 to
 * 2944, its floor 8 px over P5), a wait there until the vulture's middle is 112 px or more to his right (the hop up into the cart is itself a jump, and
 * a jump under it is seen within 96 px; its line ends at x 3072, 116 px from the edge), a tap of jump with left held until he stands in the cart, then
 * 400 steps standing there. Null when no stomp lives at this clock.
 */
const CART_EDGE = 2956;
const HOP_CLEAR = 112;
function inEmptiedCart(t: number, windows: readonly (readonly number[])[]): Drive | null {
  const w = waitAt(t, 'wake');
  if (w.lost) return null;
  const waits = waited(w.rest, 100);
  for (const [i, [, run, label]] of [K3_ANSWERS[3]!, K3_ANSWERS[2]!].entries()) {
    for (const k of windows[i]!) {
      const stomp = k < waits.length ? run(waits[k]!, L) : undefined;
      if (!stomp || stomp.lost || tag(stomp, E.K3) !== label) continue;
      let inSince = -1;
      let hopped = -1;
      return drive(last(stomp.states), 1500, (r, j) => {
        if (inSince < 0 && inCart(r, 'R6')) inSince = j;
        if (inSince >= 0) return idle;
        if (r.player.x > CART_EDGE) return { move: -1, jumpHeld: false };
        if (hopped < 0 && (zopilote(r).x - r.player.x < HOP_CLEAR || !r.player.grounded)) return idle;
        hopped = hopped < 0 ? j : hopped;
        return { move: -1, jumpHeld: j === hopped };
      }, (_r, j) => inSince >= 0 && j >= inSince + 400);
    }
  }
  return null;
}

const GROUND_STEP = 48;
describe('GDD-WLD-18 level 3-3 the vulture over the ground', () => {
  it('GDD-WLD-18 3-3 the vulture: a Poncho on the ground is never seen, on every ground under its reach, at every 48th clock (step 48, 150 clocks)', () => {
    // Every ground stepRun stands him on within the vulture's reach, x 2880 to 3168, and on the lift MP2 (x 3184 to 3232; a rider's least centre x is
    // 3179, outside its reach), over every 48th clock (150 of the 1,200): no telegraph and no life lost. No slope, platform or piñata is under its reach.
    // P5 standing 400 steps at every 16 px from x 2880 to 3168: K3 parked at its buffer covers P5's x 2912 to 2944 (the cart, the ringtail on it:
    // standing there is in K3's box), so the x short of K3's wake (2952, to 3152) stand with K3 waiting, asleep in its cart at x 3152; from 2952 K3 is
    // parked. The walk starts at each x from 2952 on, K3 parked, right held until x = 3184, the lift's foot. K3's emptied cart: `inEmptiedCart`, at the
    // clocks where a stomp lives (145 of the 150); the hop in is itself a jump, so it waits for the vulture to be away. MP2's whole top, from its foot
    // (feet 400) to 272: at x 3179, 3182 ... 3200, standing 800 steps and walking right on to A, both on the lift where it is at this clock (ridden up) and
    // from the foot on P5 (the lift comes down on to him or not). Each tally is runs, runs with a telegraph, runs losing the life.
    const tally: Record<string, GroundTally> = {};
    const count = (ground: string, d: Drive) => {
      const g = (tally[ground] ??= { runs: 0, seen: 0, lost: 0 });
      g.runs++;
      if (telegraphed(d.states)) g.seen++;
      if (d.lost) g.lost++;
      // The first sighting fails the test at once (the tally below then says how many).
      expect([g.seen, g.lost], `${ground}, run ${g.runs}`).toEqual([0, 0]);
    };
    let inTheCart = 0;
    const alone = waited(waitAt(0, 'wake', noZopilote).rest, 100, noZopilote);
    const windows = [K3_ANSWERS[3]!, K3_ANSWERS[2]!].map(([, run, label]) => alone.flatMap((w, k) => (tag(run(w, noZopilote), E.K3) === label ? [k] : [])));
    for (const t of clocks(7200, GROUND_STEP)) {
      for (let x = 2880; x <= 3168; x += 16) {
        count('P5 standing', drive(onGroundAt(x, Y(25), t, 0, ...(x < 2952 ? [] : (['K3'] as const))), 400, () => idle));
        if (x >= 2952) count('P5 walking', drive(onGroundAt(x, Y(25), t, 0, 'K3'), 600, () => right, (r) => r.player.x >= 3184));
      }
      const cart = inEmptiedCart(t, windows);
      if (cart) {
        count('K3 emptied cart', cart);
        if (inCart(last(cart.states), 'R6')) inTheCart++;
      }
      for (let x = 3179; x <= 3200; x += 3) {
        const ridden = onGroundAt(x, platformAt(LEVEL_3_3_PLATFORM.MP2, t).y, t, 0, 'K3');
        const foot = onGroundAt(x, Y(25), t, 0, 'K3');
        count('MP2 standing, on the lift where it is', drive(ridden, 800, () => idle));
        count('MP2 walking, on the lift where it is', drive(ridden, 800, () => right, onA));
        count('MP2 standing from the foot', drive(foot, 800, () => idle));
        count('MP2 walking from the foot', drive(foot, 800, () => right, onA));
      }
    }
    expect(inTheCart).toBe(145);
    expect(tally).toEqual({
      'P5 standing': noOne(2850),
      'P5 walking': noOne(2100),
      'K3 emptied cart': noOne(145),
      'MP2 standing, on the lift where it is': noOne(1200),
      'MP2 walking, on the lift where it is': noOne(1200),
      'MP2 standing from the foot': noOne(1200),
      'MP2 walking from the foot': noOne(1200),
    });
  }, 215_000);
});

