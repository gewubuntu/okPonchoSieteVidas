import { describe, expect, it } from 'vitest';
import { catorceStart } from '../sim/catorce';
import { fallingBox, rollCarts } from '../sim/cart';
import type { PlayerInput } from '../sim/movement';
import { startRun, stepRun, type RunState } from '../sim/run';
import { LEVEL_3_4, LEVEL_3_4_RAILS } from './level3-4';

// GDD-BOS-04: the measured cart windows over the real arena (L-003). For each phase and each side the cart is boarded (set rolling at m 16, as
// `boardCarts` leaves a cart he landed in) on every step from 300 before her second slam at that side to 300 after, in a run where Poncho
// stands on home unhurt, and played on until it is gone: a hit is her `hits` going up. Every offset is tried (no sampling, so no period is
// missed, L-092). These replace the GDD's hand estimates of the window of each phase ("78 before to 192 after" and the others).
const DEF = LEVEL_3_4.catorce!;
const STILL: PlayerInput = { move: 0, jumpHeld: false };
const RANGE = 300;
/** Steps from boarding to her roof: 32 of ride (m 16 to the end at 96, at 2.5 px/step) and 23 of fall (the plan's scratch run of `rollCarts`). */
const ROOF = 55;
/** The step of her second slam at each side: [left, right] per phase (her slams at the left and right stops, from test 'legs' in catorce.test.ts). */
const SECOND_SLAM = [[1170, 1620], [735, 1000], [591, 788]] as const;
const SIDE = ['left', 'right'] as const;
/**
 * The window of boarding offsets from her second slam at that end that hit her, per phase, as the run gives them (first, last): 243, 115 and 87
 * steps long (the GDD's hand estimates were 271, 135 and 101). None of them is a hit at her side: a cart falls outwards at 150 px/s, as fast as
 * her fastest charge (150 px/s in phase 3) and faster than the others, so she never runs into a falling cart; every hit lands on her roof.
 */
const WINDOWS = [[-71, 171], [-67, 47], [-83, 3]] as const;

interface Measure {
  /** Offsets from her second slam at this side whose boarding step hit her. */
  readonly hits: number[];
  /** Of those, the offsets where the cart hit her roof (her box was under it at the step its box's bottom first passed her top) and the others, hit at her side as she charged into it. */
  readonly roof: number[];
  readonly side: number[];
  /** A boarding that missed: the step its box's bottom first passed her top, from boarding, and its middle's x then. */
  readonly miss: { readonly at: number; readonly x: number } | null;
}

function measure(h: number, s: 0 | 1): Measure {
  const S = SECOND_SLAM[h]![s];
  const start: RunState = { ...startRun(LEVEL_3_4), fantasma: 1e6, catorce: catorceStart(DEF, h) };
  const states: RunState[] = [start];
  for (let i = 1; i <= S + RANGE; i++) states.push(stepRun(states[i - 1]!, STILL, LEVEL_3_4));
  const hits: number[] = [];
  const roof: number[] = [];
  const side: number[] = [];
  let miss: Measure['miss'] = null;
  for (let o = -RANGE; o <= RANGE; o++) {
    const from = states[S + o]!;
    let r: RunState = { ...from, carts: from.carts.map((c, i) => (i === s ? { phase: 'rolling' as const, m: 16 } : c)) };
    const hitsBefore = r.catorce!.hits;
    let k = 0;
    let first: { at: number; x: number } | null = null;
    for (; k < 120 && r.carts[s]!.phase !== 'gone'; ) {
      const before = r;
      r = stepRun(r, STILL, LEVEL_3_4);
      k++;
      // The step its box's bottom first passes her top (y = 192), read where it falls without breaking, or from the roll that ended in a break.
      const box = fallingBox(LEVEL_3_4_RAILS[s]!, rollCarts(LEVEL_3_4_RAILS, before.carts)[s]!);
      if (!first && box && box.y + box.h > 192) first = { at: k, x: box.x + box.w / 2 };
    }
    expect(r.carts[s]!.phase, `phase ${h + 1} ${SIDE[s]} offset ${o}: the cart is gone`).toBe('gone');
    if (r.catorce!.hits > hitsBefore) {
      hits.push(o);
      (k === ROOF ? roof : side).push(o);
    } else if (!miss && first) miss = first;
  }
  return { hits, roof, side, miss };
}

/** Whether `a` is one unbroken run of consecutive integers. */
const unbroken = (a: readonly number[]): boolean => a.every((v, i) => i === 0 || v === a[i - 1]! + 1);

describe('GDD-BOS-04 3-4 measured windows', () => {
  it('GDD-BOS-04 3-4 windows measured: the cart\'s fall, boarding to her roof, and the window of each phase at each end', { timeout: 120_000 }, () => {
    const out: Measure[][] = [0, 1, 2].map((h) => [measure(h, 0), measure(h, 1)]);
    for (const [h, sides] of out.entries()) {
      for (const [s, m] of sides.entries()) {
        process.stdout.write(`GDD-BOS-04 window phase ${h + 1} ${SIDE[s]}: hits ${m.hits[0]}..${m.hits[m.hits.length - 1]} (${m.hits.length}), roof ${m.roof.length}, side ${m.side.length} (${m.side[0]}..${m.side[m.side.length - 1]}), miss ${JSON.stringify(m.miss)}\n`);
        expect(m.hits.length, `phase ${h + 1} ${SIDE[s]}`).toBeGreaterThan(0);
        expect(unbroken(m.hits), `phase ${h + 1} ${SIDE[s]} is one unbroken run`).toBe(true);
        expect([m.hits[0], m.hits[m.hits.length - 1]], `phase ${h + 1} ${SIDE[s]} window`).toEqual(WINDOWS[h]);
        expect(m.side, `phase ${h + 1} ${SIDE[s]} side hits`).toEqual([]);
        expect(m.roof, `phase ${h + 1} ${SIDE[s]} roof hits`).toEqual(m.hits);
        expect(m.miss, `phase ${h + 1} ${SIDE[s]} has a miss`).not.toBeNull();
        expect(m.miss!.at, `phase ${h + 1} ${SIDE[s]} roof step`).toBe(ROOF);
        expect(m.miss!.x, `phase ${h + 1} ${SIDE[s]} middle at the roof`).toBe(s === 0 ? 54.5 : 425.5);
      }
      expect(sides[0]!.hits, `phase ${h + 1} mirrored`).toEqual(sides[1]!.hits);
      expect(sides[0]!.side, `phase ${h + 1} mirrored (side hits)`).toEqual(sides[1]!.side);
    }
  });
});
