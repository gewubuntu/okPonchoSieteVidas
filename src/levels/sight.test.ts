import { describe, expect, it } from 'vitest';
import { TILE } from '../config/tuning';
import { isBossLevel } from '../sim/bossLevel';
import { LEVELS } from './index';
import type { PlayerInput } from '../sim/movement';
import { LAB_3C_LEVEL, LAB_3C_PLATEAU, LAB_3C_RAILS } from './lab3c';
import { boardingAt, describeLoss, flySight, flyTakeoff, inFamily, placeKey, REACT_STEPS, rideEnd, rideRun, rideSaves, sightFamilies, sightSweep, type Loss, type SightFamily, type SightReport } from './sightSweep';

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
    to: 100,
    input: 'held',
    why: "GDD-WLD-16 (The sight sweep, family 3): the first pen's Alacrán by a held jump to the left, at a run or from a standstill, back over the flat and the pen he has just crossed; in view from 0.3 s after the take-off and 1.9 s or more before the hit (117 to 137 steps)",
  },
  {
    level: '3-1',
    cause: 'pit 169-186',
    from: 153,
    to: 153,
    input: 'held',
    why: "GDD-WLD-16 (The sight sweep, family 4): the pit of Ten by a held jump from the lower pen's first rock that stomps the pen's Alacrán and glides on off the gallery's edge; the lip in view 4.2 s before he is lost (253 steps), and the pit is the one the ledges L3 and L4 cross",
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
};

/** GDD-WLD-03: what a player does when he sees it, the flight's direction being `dir`; one of them must save the flight. */
const REACTIONS: readonly { name: string; input: (dir: 1 | -1) => PlayerInput }[] = [
  { name: 'lets go of jump', input: (dir) => ({ move: dir, jumpHeld: false }) },
  { name: 'lets go of everything', input: () => ({ move: 0, jumpHeld: false }) },
  { name: 'lets go of jump and steers back', input: (dir) => ({ move: -dir, jumpHeld: false }) },
  { name: 'holds jump and steers back', input: (dir) => ({ move: -dir, jumpHeld: true }) },
];

/** Whether the blind loss's flight loses no life when he holds `input` from REACT_STEPS after its cause first came on screen. */
function savedBy(level: Parameters<typeof sightSweep>[0], l: Loss, input: PlayerInput): boolean {
  if (l.seenBefore === null) return false;
  return flyTakeoff(level, l.takeoff, { at: l.lossStep - l.seenBefore + REACT_STEPS, input }).loss === null;
}

/** Measured: per accepted family, its blind flights (or its flights that stay in a ride) and how many each reaction saves. */
const SAVES: Record<string, Record<string, number>> = {
  '3-1 murcielago at 225, columns 207 to 210, held': { flights: 13, 'lets go of jump': 6, 'lets go of everything': 5, 'lets go of jump and steers back': 8, 'holds jump and steers back': 7 },
  '3-1 murcielago at 225, columns 210 to 210, again': { flights: 5, 'lets go of jump': 5, 'lets go of everything': 4, 'lets go of jump and steers back': 1, 'holds jump and steers back': 5 },
  '3-1 alacran at 82, columns 99 to 100, held': { flights: 6, 'lets go of everything': 2, 'lets go of jump and steers back': 6, 'holds jump and steers back': 6 },
  '3-1 pit 169-186, columns 153 to 153, held': { flights: 1, 'lets go of jump': 1, 'lets go of everything': 1, 'lets go of jump and steers back': 1, 'holds jump and steers back': 1 },
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
      const counts = (losses: readonly Loss[]) => sightFamilies(losses).map((f) => `${family(f)}: ${losses.filter((l) => inFamily(l, f)).length}`);
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
    // Each is saved by a jump out of the cart before the pit.
    const first = lab.rideLosses.filter((l) => l.takeoff.start === 0 && l.takeoff.ride!.move === 0);
    expect(first.map((l) => rideSaves(LAB_3C_LEVEL, l))).toEqual(first.map(() => ['a held jump, its way held', 'a held jump, nothing held', 'a tapped jump']));
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
