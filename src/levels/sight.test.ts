import { describe, expect, it } from 'vitest';
import { TILE } from '../config/tuning';
import { isBossLevel } from '../sim/bossLevel';
import { LEVELS } from './index';
import type { PlayerInput } from '../sim/movement';
import { describeLoss, flySight, placeKey, sightFamilies, sightSweep, type Loss, type SightFamily, type SightReport } from './sightSweep';

// GDD-WLD-03's sight rule over the real levels of World 3 (L-014): no flight a level invites loses a life to something that was off screen
// at its take-off, but for the families the GDD names. Its own run, `npm run test:sight` (`vitest.sight.config.ts`), since one sweep of
// 3-1 takes a minute or more.

/** A family of blind losses in a level that the GDD names, with the words that name it; `why: 'unreviewed'` is one it does not name yet. */
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
    why: "GDD-WLD-16 (The sight sweep, family 3): the first pen's Alacrán by a held jump to the left at a run, back over the flat and the pen he has just crossed; in view from 0.3 s after the take-off and 1.9 s or more before the hit (117 to 137 steps)",
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

const family = (f: SightFamily) => `${f.cause}, columns ${f.from} to ${f.to}, ${f.input}`;

/** GDD-WLD-03: how long after what takes the life first shows he reacts: 0.2 s. */
const REACT_STEPS = 12;

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
  return flySight(level, l.takeoff, undefined, { at: l.lossStep - l.seenBefore + REACT_STEPS, input }).loss === null;
}

/** Measured: per accepted family, its blind flights and how many each reaction saves. */
const SAVES: Record<string, Record<string, number>> = {
  '3-1 murcielago at 225, columns 207 to 210, held': { flights: 13, 'lets go of jump': 6, 'lets go of everything': 5, 'lets go of jump and steers back': 8, 'holds jump and steers back': 7 },
  '3-1 murcielago at 225, columns 210 to 210, again': { flights: 5, 'lets go of jump': 5, 'lets go of everything': 4, 'lets go of jump and steers back': 1, 'holds jump and steers back': 5 },
  '3-1 alacran at 82, columns 99 to 100, held': { flights: 6, 'lets go of everything': 2, 'lets go of jump and steers back': 6, 'holds jump and steers back': 6 },
  '3-1 pit 169-186, columns 153 to 153, held': { flights: 1, 'lets go of jump': 1, 'lets go of everything': 1, 'lets go of jump and steers back': 1, 'holds jump and steers back': 1 },
};

describe('GDD-WLD-03 the sight sweep of World 3', () => {
  it('GDD-WLD-03 no flight a World 3 level invites loses a life to something off screen at its take-off', { timeout: 600000 }, () => {
    expect(SWEPT.map((e) => e.id)).toEqual(['3-1']);
    for (const { id } of SWEPT) {
      const report = sweep(id);
      const accepted = SIGHT_ACCEPTED.filter((a) => a.level === id);
      const known = report.blind.filter((l) => accepted.some((a) => a.cause === l.cause && a.input === l.takeoff.input && l.takeoff.place.col >= a.from && l.takeoff.place.col <= a.to));
      const counts = (blind: typeof report.blind) => sightFamilies(blind).map((f) => `${family(f)}: ${blind.filter((l) => l.cause === f.cause && l.takeoff.input === f.input && l.takeoff.place.col >= f.from && l.takeoff.place.col <= f.to).length}`);
      process.stdout.write(
        [
          `sight sweep of ${id}: ${sweeps.get(id)!.seconds.toFixed(1)} s, ${report.places.length} places, ${report.flights} flights`,
          `losses in sight per cause: ${JSON.stringify(report.inSight)}`,
          `blind losses per family: ${JSON.stringify(counts(report.blind))}`,
          `standable tops never reached: ${JSON.stringify(report.unreached)}`,
          '',
        ].join('\n'),
      );
      // Every blind loss is in a family the GDD names; one that is not fails with its record.
      expect(report.blind.filter((l) => !known.includes(l)).map(describeLoss), id).toEqual([]);
      // And every named family is still there, as it was found.
      expect(new Set(sightFamilies(report.blind).map(family)), id).toEqual(new Set(accepted.map(family)));
    }
  });

  it('GDD-WLD-03 every accepted family of blind losses is one the GDD names, none unreviewed', () => {
    expect(SIGHT_ACCEPTED.filter((a) => a.why === 'unreviewed').map((a) => `${a.level} ${family(a)}`)).toEqual([]);
  });

  it('GDD-WLD-03 every accepted blind loss can still be avoided 0.2 s after what takes the life comes on screen', { timeout: 600000 }, () => {
    const saves: Record<string, Record<string, number>> = {};
    const lost: string[] = [];
    for (const { id, level } of SWEPT) {
      for (const l of sweep(id).blind) {
        const fam = SIGHT_ACCEPTED.find((a) => a.level === id && a.cause === l.cause && a.input === l.takeoff.input && l.takeoff.place.col >= a.from && l.takeoff.place.col <= a.to);
        const key = fam ? `${id} ${family(fam)}` : `${id} ${describeLoss(l)}`;
        const saved = REACTIONS.filter((r) => savedBy(level, l, r.input(l.takeoff.dir)));
        const tally = (saves[key] ??= { flights: 0 });
        tally['flights']!++;
        for (const r of saved) tally[r.name] = (tally[r.name] ?? 0) + 1;
        if (saved.length === 0) lost.push(describeLoss(l));
      }
    }
    process.stdout.write(`blind losses saved per reaction: ${JSON.stringify(saves)}\n`);
    expect(lost).toEqual([]);
    expect(saves).toEqual(SAVES);
  });

  it("GDD-WLD-16 3-1 no flight reaches the buttress's top", { timeout: 600000 }, () => {
    // Columns 161 to 164, row 17: standable, and no flight the level invites stands on it.
    const report = sweep('3-1');
    const tops = [161, 162, 163, 164].map((col) => placeKey({ col, y: 17 * TILE }));
    expect(tops.flatMap((k) => (report.reachedBy.has(k) ? [`${k} by ${JSON.stringify(report.reachedBy.get(k))}`] : []))).toEqual([]);
    expect(report.unreached).toContainEqual({ row: 17, from: 161, to: 164 });
  });
});
