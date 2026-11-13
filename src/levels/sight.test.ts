import { describe, expect, it } from 'vitest';
import { TILE } from '../config/tuning';
import { isBossLevel } from '../sim/bossLevel';
import { LEVELS } from './index';
import type { PlayerInput } from '../sim/movement';
import { LAB_3C_LEVEL, LAB_3C_PLATEAU, LAB_3C_RAILS } from './lab3c';
import { LEVEL_3_2, LEVEL_3_2_RAIL } from './level3-2';
import { boardingAt, describeLoss, flySight, flyTakeoff, idlePeriods, inFamily, placeKey, REACT_STEPS, rideEnd, rideRun, rideSaves, sightFamilies, sightStarts, sightSweep, type Loss, type SightFamily, type SightReport } from './sightSweep';

// GDD-WLD-03's sight rule over the real levels of World 3 (L-014): no flight a level invites loses a life to something that was off screen
// at its take-off, but for the families the GDD names; GDD-WLD-15: no life lost staying in a ride, but for the families the GDD names, each
// saved by a rider's reaction. Its own run, `npm run test:sight` (`vitest.sight.config.ts`), since one sweep of 3-1 takes a minute or more.

/**
 * A family of blind losses (or, with input `ride` and its rail, of lives lost staying in a ride) in a level that the GDD names, with the words
 * that name it; `why: 'unreviewed'` is one it does not name yet.
 */
export interface Accepted extends SightFamily {
  readonly level: string;
  readonly why: string;
}

export const SIGHT_ACCEPTED: readonly Accepted[] = [
  {
    level: '3-1',
    cause: 'murcielago at 225',
    from: 207,
    to: 210,
    input: 'held',
    why: "GDD-WLD-16 (Where a first-time player loses a life): a held jump taken from columns 207 to 211, where the glide from the crumbling ledge lands, flies over the patrol bat and the lip into that second bat, which is past the screen's edge at such a take-off and in view for 1.5 to 2 s before he reaches it (Open Question 41 i)",
  },
  {
    level: '3-1',
    cause: 'murcielago at 225',
    from: 210,
    to: 210,
    input: 'again',
    why: 'GDD-WLD-16 (The sight sweep, family 2): the same bat by a jump from column 210 let go at its top and pressed again, in view 1.8 s before (109 to 112 steps)',
  },
  {
    level: '3-1',
    cause: 'alacran at 82',
    from: 99,
    to: 101,
    input: 'held',
    why: "GDD-WLD-16 (The sight sweep, family 3): the first pen's Alacrán by a held jump to the left, at a run or from a standstill, back over the flat and the pen he has just crossed, from columns 99 to 101; in view 1.55 s or more before the hit (93 to 131 steps)",
  },
  {
    level: '3-1',
    cause: 'pit 169-186',
    from: 153,
    to: 153,
    input: 'held',
    why: "GDD-WLD-16 (The sight sweep, family 4): the pit of Ten by a held jump from the lower pen's first rock that stomps the pen's Alacrán and glides on off the gallery's edge; the lip in view 4.2 s before he is lost (253 steps), and the pit is the one the ledges L3 and L4 cross",
  },
  {
    level: '3-2',
    cause: 'armadillo at 153',
    from: 139,
    to: 140,
    input: 'walk-glide',
    why: "GDD-WLD-17 (As built, The sight sweep): walking right off the island through standing cart F with jump held glides over pit F and the gallery's first Alacrán (a stomp's bounce carries him on) and comes down on the gallery by its Armadillo, off screen at the take-off, which tucks and rolls into him; in view 2.8 s or more (170 to 176 steps) before",
  },
  {
    level: '3-2',
    cause: 'armadillo at 153',
    from: 143,
    to: 143,
    input: 'held',
    why: "GDD-WLD-17 (As built, The sight sweep): a glide to the right from the island's edge along the gallery, bounced on by a stomp on its first Alacrán, comes down on rail F's ramp by the Armadillo walking up it, off screen at the take-off; it tucks and rolls down into him; in view 2.45 s (147 steps) before",
  },
  {
    level: '3-2',
    cause: 'alacran at 149',
    from: 156,
    to: 159,
    input: 'held',
    why: "GDD-WLD-17 (As built, The sight sweep): a glide to the right from the gallery's middle over its end and down into rail F's cutting comes down by the gallery's first Alacrán walking there, off screen at the take-off; in view 1.75 s or more (105 to 118 steps) before",
  },
  {
    level: '3-2',
    cause: 'armadillo at 153',
    from: 149,
    to: 150,
    input: 'held',
    why: "GDD-WLD-17 (As built, The sight sweep): a glide to the right from the gallery's left part, bounced on by a stomp on its first Alacrán, comes down on rail F's ramp by the Armadillo walking up it, off screen at the take-off; it tucks and rolls down into him; in view 2.3 s or more (140 to 148 steps) before",
  },
  {
    level: '3-2',
    cause: 'alacran at 157',
    from: 150,
    to: 150,
    input: 'walk',
    why: "GDD-WLD-17 (As built, The sight sweep): walking right along the gallery into its second Alacrán walking toward him, off screen at the take-off; in view 1.45 s (87 steps) before",
  },
  {
    level: '3-2',
    cause: 'alacran at 157',
    from: 150,
    to: 150,
    input: 'walk-glide',
    why: "GDD-WLD-17 (As built, The sight sweep): the same walk along the gallery with jump held (he never leaves the ground); in view 1.45 s (87 steps) before",
  },
  {
    level: '3-2',
    cause: 'armadillo at 153',
    from: 153,
    to: 154,
    input: 'again',
    why: "GDD-WLD-17 (As built, The sight sweep): a jump to the right from the gallery's middle, let go at its top and pressed again, glides down onto rail F's ramp by the Armadillo walking up it, off screen at the take-off; it tucks and rolls down into him; in view 2.3 s or more (140 to 148 steps) before",
  },
  {
    level: '3-2',
    cause: 'pit 144-146',
    from: 161,
    to: 162,
    input: 'held',
    why: "GDD-WLD-17 (As built, The sight sweep): the stomp's high bounce off the tucked gallery Armadillo carries a held glide back over pit F; letting go after the stomp saves every flight; the pit's lip is in view 3.8 s or more (230 to 242 steps) before he is lost",
  },
  {
    level: '3-2',
    cause: 'alacran at 149',
    from: 163,
    to: 164,
    input: 'held',
    why: "GDD-WLD-17 (As built, The sight sweep): a glide to the left from the gallery's right end comes down on its floor in the way of its first Alacrán, off screen at the take-off, which walks into him; in view 2.6 s or more (157 to 201 steps) before",
  },
  {
    level: '3-2',
    cause: 'alacran at 149',
    from: 165,
    to: 165,
    input: 'again',
    why: "GDD-WLD-17 (As built, The sight sweep): the same glide to the left from the top of rail F's ramp, by a jump let go at its top and pressed again; in view 2.75 s (165 steps) before",
  },
  {
    level: '3-2',
    cause: 'armadillo at 153',
    from: 170,
    to: 172,
    input: 'walk-glide',
    why: "GDD-WLD-17 (As built, The sight sweep): walking back off rail F's ledge to the left with jump held glides onto the gallery by its Armadillo, off screen at the take-off, which tucks and rolls into him; in view 2.9 s or more (176 to 179 steps) before",
  },
  {
    level: '3-2',
    cause: 'alacran at 157',
    from: 171,
    to: 172,
    input: 'walk',
    why: "GDD-WLD-17 (As built, The sight sweep): walking back to the left out of rail F's cutting and up its ramp meets the gallery's second Alacrán coming down it; in view 1.45 s (87 to 88 steps) before",
  },
  {
    level: '3-2',
    cause: 'alacran at 157',
    from: 171,
    to: 172,
    input: 'walk-glide',
    why: "GDD-WLD-17 (As built, The sight sweep): the same walk back up rail F's ramp with jump held (he never leaves the ground); in view 1.45 s (87 to 88 steps) before",
  },
  {
    level: '3-2',
    cause: 'pit 80-84',
    from: 69,
    to: 69,
    input: 'ride',
    rail: 3,
    why: "GDD-WLD-17 (Where a first-time player loses a life): rail D's broken end (he has just made the same jump at rail C, tile for tile, where staying in cost nothing; the post gives 0.64 s, the hilos draw the jump, the gap is 3 tiles where the jump carries 5.4, and the ofrenda is 3 tiles before the cart)",
  },
  {
    level: '3-2',
    cause: 'spike 177,15',
    from: 141,
    to: 141,
    input: 'ride',
    rail: 5,
    why: "GDD-WLD-17 (Where a first-time player loses a life): the spike hollow at rail F's end (the third lit post, on screen 0.9 s before the ramp; the hilos arc up to a ledge in plain sight; holding the jump works for 0.86 s of rail; it costs one life or the piñata's taco)",
  },
  {
    level: '3-2',
    cause: 'pit 196-200',
    from: 185,
    to: 185,
    input: 'ride',
    rail: 6,
    why: "GDD-WLD-17 (Where a first-time player loses a life): staying in K1 past its lit post he falls into the pit 196 to 200; a jump from its last tiles lands in cart K2, 3 tiles on (GDD-WLD-17, Ketsu)",
  },
  {
    level: '3-2',
    cause: 'pit 216-221',
    from: 202,
    to: 202,
    input: 'ride',
    rail: 7,
    why: "GDD-WLD-17 (Where a first-time player loses a life): K2's 4-tile jump to K3 straight after the beam hop (both pieces were done alone on safe ground, and a miss of the beam is harmless)",
  },
];

/** The World 3 levels the sweep flies: every registered one that is not a test level or a boss level. */
const SWEPT = LEVELS.filter((e) => e.world === 3 && !e.test && !isBossLevel(e.level));

/** Each level's sweep, worked out once for the tests that read it, with its run time in seconds. */
const sweeps = new Map<string, { report: SightReport; seconds: number }>();
function sweep(id: string): SightReport {
  const done = sweeps.get(id);
  if (done) return done.report;
  const t = performance.now();
  const report = sightSweep(SWEPT.find((e) => e.id === id)!.level);
  sweeps.set(id, { report, seconds: (performance.now() - t) / 1000 });
  return report;
}

const family = (f: SightFamily) => `${f.cause}, columns ${f.from} to ${f.to}, ${f.input}${f.rail !== undefined ? `, rail ${f.rail}` : ''}`;

/**
 * Each swept level's sweep as reviewed: its places, flights and rides. A level added to World 3 fails here until its sweep is reviewed and
 * its counts written in.
 */
const EXPECTED: Readonly<Record<string, { places: number; flights: number; rides: number }>> = {
  '3-1': { places: 249, flights: 116880, rides: 0 },
  '3-2': { places: 229, flights: 138612, rides: 9 },
};

/** GDD-WLD-03: what a player does when he sees it, the flight's direction being `dir`; one of them must save the flight. */
const REACTIONS: readonly { name: string; input: (dir: 1 | -1) => PlayerInput }[] = [
  { name: 'lets go of jump', input: (dir) => ({ move: dir, jumpHeld: false }) },
  { name: 'lets go of everything', input: () => ({ move: 0, jumpHeld: false }) },
  { name: 'lets go of jump and steers back', input: (dir) => ({ move: -dir, jumpHeld: false }) },
  { name: 'holds jump and steers back', input: (dir) => ({ move: -dir, jumpHeld: true }) },
];

/**
 * GDD-WLD-03 (the main session's rule, Proposed): whether the blind loss's flight loses no life when he holds `input` from some step at
 * least REACT_STEPS after its cause first came on screen up to the loss, as a rider's reactions are judged (`rideSaves`): each such step is
 * tried in turn, and the first that saves him decides.
 */
function savedBy(level: Parameters<typeof sightSweep>[0], l: Loss, input: PlayerInput): boolean {
  if (l.seenBefore === null) return false;
  for (let at = l.lossStep - l.seenBefore + REACT_STEPS; at < l.lossStep; at++) if (flyTakeoff(level, l.takeoff, { at, input }).loss === null) return true;
  return false;
}

/** Measured: per accepted family, its blind flights (or its flights that stay in a ride) and how many each reaction saves. */
const SAVES: Record<string, Record<string, number>> = {
  '3-1 murcielago at 225, columns 207 to 210, held': { flights: 19, 'lets go of jump': 19, 'lets go of everything': 19, 'lets go of jump and steers back': 19, 'holds jump and steers back': 19 },
  '3-1 murcielago at 225, columns 210 to 210, again': { flights: 2, 'lets go of jump': 2, 'lets go of everything': 2, 'lets go of jump and steers back': 2, 'holds jump and steers back': 2 },
  '3-1 alacran at 82, columns 99 to 101, held': { flights: 8, 'lets go of jump': 8, 'lets go of everything': 8, 'lets go of jump and steers back': 8, 'holds jump and steers back': 8 },
  '3-1 pit 169-186, columns 153 to 153, held': { flights: 1, 'lets go of jump': 1, 'lets go of everything': 1, 'lets go of jump and steers back': 1, 'holds jump and steers back': 1 },
  '3-2 armadillo at 153, columns 170 to 172, walk-glide': { flights: 11, 'lets go of jump': 11, 'lets go of everything': 11, 'lets go of jump and steers back': 11, 'holds jump and steers back': 11 },
  '3-2 alacran at 149, columns 163 to 164, held': { flights: 10, 'lets go of jump': 10, 'lets go of everything': 10, 'lets go of jump and steers back': 10, 'holds jump and steers back': 10 },
  '3-2 alacran at 149, columns 156 to 159, held': { flights: 16, 'lets go of jump': 16, 'lets go of everything': 16, 'lets go of jump and steers back': 16, 'holds jump and steers back': 16 },
  '3-2 alacran at 149, columns 165 to 165, again': { flights: 2, 'lets go of jump': 2, 'lets go of everything': 2, 'lets go of jump and steers back': 2, 'holds jump and steers back': 2 },
  '3-2 armadillo at 153, columns 153 to 154, again': { flights: 6, 'lets go of jump': 6, 'lets go of everything': 6, 'lets go of jump and steers back': 6, 'holds jump and steers back': 6 },
  '3-2 pit 144-146, columns 161 to 162, held': { flights: 12, 'lets go of jump': 12, 'lets go of everything': 12, 'lets go of jump and steers back': 12, 'holds jump and steers back': 12 },
  '3-2 alacran at 157, columns 171 to 172, walk': { flights: 2, 'lets go of everything': 2, 'lets go of jump and steers back': 2, 'holds jump and steers back': 2 },
  '3-2 alacran at 157, columns 171 to 172, walk-glide': { flights: 2, 'lets go of everything': 2, 'lets go of jump and steers back': 2, 'holds jump and steers back': 2 },
  '3-2 armadillo at 153, columns 149 to 150, held': { flights: 9, 'lets go of jump': 9, 'lets go of everything': 9, 'lets go of jump and steers back': 9, 'holds jump and steers back': 9 },
  '3-2 alacran at 157, columns 150 to 150, walk': { flights: 1, 'lets go of everything': 1, 'lets go of jump and steers back': 1, 'holds jump and steers back': 1 },
  '3-2 alacran at 157, columns 150 to 150, walk-glide': { flights: 1, 'lets go of everything': 1, 'lets go of jump and steers back': 1, 'holds jump and steers back': 1 },
  '3-2 armadillo at 153, columns 143 to 143, held': { flights: 1, 'lets go of jump': 1, 'lets go of everything': 1, 'lets go of jump and steers back': 1, 'holds jump and steers back': 1 },
  '3-2 armadillo at 153, columns 139 to 140, walk-glide': { flights: 15, 'lets go of jump': 15, 'lets go of everything': 15, 'lets go of jump and steers back': 15, 'holds jump and steers back': 15 },
  '3-2 pit 80-84, columns 69 to 69, ride, rail 3': { flights: 12, 'a held jump, its way held': 12, 'a held jump, nothing held': 12, 'a tapped jump': 12 },
  '3-2 pit 196-200, columns 185 to 185, ride, rail 6': { flights: 12, 'a held jump, its way held': 12, 'a held jump, nothing held': 12, 'a tapped jump': 12 },
  '3-2 spike 177,15, columns 141 to 141, ride, rail 5': { flights: 12, 'a held jump, its way held': 12, 'a held jump, nothing held': 12, 'a tapped jump': 12 },
  '3-2 pit 216-221, columns 202 to 202, ride, rail 7': { flights: 156, 'a held jump, its way held': 156, 'a held jump, nothing held': 156, 'a tapped jump': 156 },
};

describe('GDD-WLD-03 the sight sweep of World 3', () => {
  it('GDD-WLD-03 every swept World 3 level has its sweep reviewed: its places, flights and rides as written', { timeout: 1800000 }, () => {
    expect(
      SWEPT.filter((e) => !EXPECTED[e.id]).map((e) => `${e.id}: no reviewed sweep; add its places, flights and rides to EXPECTED once its sweep is reviewed`),
    ).toEqual([]);
    for (const { id } of SWEPT) {
      const report = sweep(id);
      expect({ places: report.places.length, flights: report.flights, rides: report.rides.size }, id).toEqual(EXPECTED[id]);
    }
  });

  it('GDD-WLD-03 no flight a World 3 level invites loses a life to something off screen at its take-off', { timeout: 1800000 }, () => {
    for (const { id } of SWEPT) {
      const report = sweep(id);
      const accepted = SIGHT_ACCEPTED.filter((a) => a.level === id);
      const known = (losses: readonly Loss[]) => losses.filter((l) => accepted.some((a) => inFamily(l, a)));
      const counts = (losses: readonly Loss[]) =>
        sightFamilies(losses).map((f) => {
          const ls = losses.filter((l) => inFamily(l, f));
          const seen = ls.map((l) => l.seenBefore ?? -1);
          return `${family(f)}: ${ls.length}, in view ${Math.min(...seen)} to ${Math.max(...seen)} steps before`;
        });
      process.stdout.write(
        [
          `sight sweep of ${id}: ${sweeps.get(id)!.seconds.toFixed(1)} s, ${report.places.length} places, ${report.flights} flights, ${report.reflown.length} take-offs flown again with enemies, rides ${JSON.stringify([...report.rides.keys()])}`,
          `losses in sight per cause: ${JSON.stringify(report.inSight)}`,
          `blind losses per family: ${JSON.stringify(counts(report.blind))}`,
          `lives lost staying in a ride, per family: ${JSON.stringify(counts(report.rideLosses))}`,
          `standable tops never reached: ${JSON.stringify(report.unreached)}`,
          '',
        ].join('\n'),
      );
      // Every blind loss, and every life lost staying in a ride, is in a family the GDD names; one that is not fails with its record.
      const blind = known(report.blind);
      const rides = known(report.rideLosses);
      expect(report.blind.filter((l) => !blind.includes(l)).map(describeLoss), id).toEqual([]);
      expect(report.rideLosses.filter((l) => !rides.includes(l)).map(describeLoss), id).toEqual([]);
      // And every named family is still there, as it was found.
      expect(new Set([...sightFamilies(report.blind), ...sightFamilies(report.rideLosses)].map(family)), id).toEqual(new Set(accepted.map(family)));
    }
  });

  it("GDD-WLD-03 each level's start times spread six over its enemies' longest idle period", () => {
    // Each enemy's idle period (its box, phase and heading come round), and the start times: six, evenly over the longest.
    const got = Object.fromEntries(SWEPT.map((e) => [e.id, { periods: idlePeriods(e.level), starts: sightStarts(e.level) }]));
    // Measured: 3-1's longest is the lower pen's Alacrán's (394 steps; the bats' loops 120 and 240), 3-2's the gallery Armadillo's (2,690).
    expect(got).toEqual({
      '3-1': { periods: [330, 120, 120, 394, 240, 120, 120], starts: [0, 65, 131, 197, 262, 328] },
      '3-2': { periods: [962, 1802, 2690, 1802, 266], starts: [0, 448, 896, 1345, 1793, 2241] },
    });
  });

  it('GDD-WLD-03 every accepted family of blind losses is one the GDD names, none unreviewed', () => {
    expect(SIGHT_ACCEPTED.filter((a) => a.why === 'unreviewed').map((a) => `${a.level} ${family(a)}`)).toEqual([]);
  });

  it('GDD-WLD-03 every accepted blind loss and ride loss can still be avoided 0.2 s after what takes the life comes on screen', { timeout: 1800000 }, () => {
    const saves: Record<string, Record<string, number>> = {};
    const lost: string[] = [];
    for (const { id, level } of SWEPT) {
      // GDD-WLD-15: a life lost staying in a ride is judged by the rider's reactions alone (`rideSaves`): a rider commits to nothing by standing.
      const report = sweep(id);
      for (const l of [...report.blind, ...report.rideLosses]) {
        const fam = SIGHT_ACCEPTED.find((a) => a.level === id && inFamily(l, a));
        const key = fam ? `${id} ${family(fam)}` : `${id} ${describeLoss(l)}`;
        const saved = l.takeoff.input === 'ride' ? rideSaves(level, l) : REACTIONS.filter((r) => savedBy(level, l, r.input(l.takeoff.dir))).map((r) => r.name);
        const tally = (saves[key] ??= { flights: 0 });
        tally['flights']!++;
        for (const name of saved) tally[name] = (tally[name] ?? 0) + 1;
        if (saved.length === 0) lost.push(describeLoss(l));
      }
    }
    process.stdout.write(`blind losses and ride losses saved per reaction: ${JSON.stringify(saves)}\n`);
    expect(lost).toEqual([]);
    expect(saves).toEqual(SAVES);
  });

  it("GDD-WLD-16 3-1 no flight reaches the buttress's top", { timeout: 1800000 }, () => {
    // Columns 161 to 164, row 17: standable, and no flight the level invites stands on it.
    const report = sweep('3-1');
    const tops = [161, 162, 163, 164].map((col) => placeKey({ col, y: 17 * TILE }));
    expect(tops.flatMap((k) => (report.reachedBy.has(k) ? [`${k} by ${JSON.stringify(report.reachedBy.get(k))}`] : []))).toEqual([]);
    expect(report.unreached).toContainEqual({ row: 17, from: 161, to: 164 });
  });
});

describe('GDD-WLD-15 the sight sweep judges a ride from its boarding', () => {
  it("GDD-WLD-15 a ride that goes on from a landing back in its cart is judged from its boarding: 3-2's K2 after a glide over its beam", () => {
    // 3-2's rail K2 (rail 7): a held jump over its hanging beam on the ride's step 28 lands back in the cart on step 95, 8 steps before the
    // cart leaves its broken end; staying in from there he is lost in the pit 216 to 221 on step 130. Its lip was on screen from the ride's
    // first steps: the reaction is judged from then, and taken from his landing back in the cart, a jump from the cart.
    const rail = Object.keys(LEVEL_3_2_RAIL).indexOf('K2');
    const { place, x } = boardingAt(LEVEL_3_2, rail);
    const t = { place, x, dir: 1 as const, speed: 'stand' as const, input: 'ride' as const, start: 0, ride: { rail, move: 0 as const, via: [{ step: 28, input: 'held' as const, move: 0 as const, landed: 95 }] } };
    const loss = flyTakeoff(LEVEL_3_2, t).loss!;
    expect({ cause: loss.cause, takeoffStep: loss.takeoffStep, lossStep: loss.lossStep }).toEqual({ cause: 'pit 216-221', takeoffStep: 96, lossStep: 130 });
    // Seen before the ride went on from the landing: from the boarding's steps.
    expect(loss.seenBefore).toBeGreaterThan(loss.lossStep - loss.takeoffStep);
    expect(rideSaves(LEVEL_3_2, loss)).toEqual(['a held jump, its way held', 'a held jump, nothing held', 'a tapped jump']);
    // The presses from the cart that save him, held with its way held: from the step after the landing back in it to a few steps on.
    const stay = flyTakeoff(LEVEL_3_2, t);
    const saving: number[] = [];
    for (let k = 96; k < loss.lossStep; k++) {
      const jump = { ...t, input: 'held' as const, ride: { ...t.ride, move: 1 as const, step: k } };
      if (flySight(LEVEL_3_2, jump, stay.from, undefined, { prefix: stay.states.slice(0, k), rideOn: true }).loss === null) saving.push(k);
    }
    // Measured: from step 97 to 107 (11 presses): the last is 12 steps (0.2 s) after the landing back in the cart. A held jump over the beam
    // taken later (steps 30 to 34 of the ride) lands back in it on steps 97 to 101, 10 to 6 steps before the last press that saves.
    expect({ first: saving[0], last: saving.at(-1), count: saving.length }).toEqual({ first: 97, last: 107, count: 11 });
  }, 60_000);
});

/** The losses of each of lab-3c's rails' flights, as lines. */
const perRail = (losses: readonly Loss[]) => LAB_3C_RAILS.map((_, i) => losses.filter((l) => l.takeoff.ride?.rail === i).map(describeLoss));

describe('GDD-WLD-03 GDD-WLD-15 the sight sweep of the cart lab', () => {
  it('GDD-WLD-03 GDD-WLD-15 sight sweep of lab-3c: its six rides, the lives lost staying in R5 after hopping its beam, no blind loss, and every standable top reached', { timeout: 1800000 }, () => {
    // Staying in from the boarding, he rides each rail to its end but R5 (rail 4), whose hanging beam takes him out of the cart (GDD-WLD-15).
    const calm = { ...LAB_3C_LEVEL, enemies: [] };
    const toEnd = LAB_3C_RAILS.flatMap((r, i) =>
      ([0, r.dir] as const).map((move) => {
        const { place, x } = boardingAt(LAB_3C_LEVEL, i);
        const stay = flySight(calm, { place, x, dir: r.dir, speed: 'stand', input: 'ride', start: 0, ride: { rail: i, move } }, { ...rideRun(LAB_3C_LEVEL, i, 0), enemies: [] });
        return stay.boarded === undefined && stay.loss === null && stay.states.length > rideEnd(LAB_3C_LEVEL, i);
      }),
    );
    expect(toEnd).toEqual([true, true, true, true, true, true, true, true, false, false, true, true]);
    // Two start times, to keep it fast. Measured: every rail is ridden (R5's before R4's: R4 rolls left, from the third ofrenda, which a
    // flight reaches before it hops into R4).
    const lab = sightSweep(LAB_3C_LEVEL, [0, 120]);
    expect([...lab.rides.keys()]).toEqual([0, 1, 2, 4, 3, 5]);
    // R5 rides on from where a held jump over the beam lands back in its cart (steps 47 to 53 of the ride): staying in from there he is lost
    // in its pit 20 steps after the cart leaves the rail (on step 121, GDD-WLD-15), with nothing held and with right held, at each start time.
    expect(perRail(lab.rideLosses).map((ls) => ls.length)).toEqual([0, 0, 0, 0, 20, 0]);
    expect(new Set(lab.rideLosses.map((l) => `${l.cause}, lost on step ${l.lossStep}`))).toEqual(new Set(['pit 82-84, lost on step 141']));
    expect(new Set(lab.rideLosses.map((l) => l.takeoff.ride!.via!.at(-1)!.landed))).toEqual(new Set([47, 49, 51, 52, 53]));
    // Each of the 20 is saved by every jump out of the cart before the pit.
    expect(lab.rideLosses.map((l) => rideSaves(LAB_3C_LEVEL, l))).toEqual(lab.rideLosses.map(() => ['a held jump, its way held', 'a held jump, nothing held', 'a tapped jump']));
    expect(perRail(lab.blind)).toEqual([[], [], [], [], [], []]);
    expect(lab.blind).toEqual([]);
    expect(lab.unreached).toEqual([]);
    // The plateau's top (its ofrenda is a respawn) is reached.
    const reached = new Set(lab.places.map((p) => `${p.col},${p.y / TILE}`));
    const plateau = Array.from({ length: LAB_3C_PLATEAU.col1 - LAB_3C_PLATEAU.col0 + 1 }, (_, i) => `${LAB_3C_PLATEAU.col0 + i},${LAB_3C_PLATEAU.row}`);
    expect(plateau.filter((k) => !reached.has(k))).toEqual([]);
    expect([lab.places.length, lab.flights]).toEqual([118, 23788]);
  });
});
