import { describe, expect, it } from 'vitest';
import { ARMADILLO, HITBOX, TILE } from '../config/tuning';
import { platformAt, standsOnPlatform } from '../sim/platform';
import type { RunState } from '../sim/run';
import { span, tally } from './bots';
import {
  bot,
  CAREFUL,
  clocks,
  E,
  gapTo,
  inCart,
  NAMES,
  outcomeOf,
  PIER_COL,
  RIDER,
  startAt,
  Y,
  type Played,
} from './level3-3.drive';
import { LEVEL_3_3_PLATFORM } from './level3-3';

// GDD-WLD-18, phase B2a: level 3-3 played whole by two bots, from the start with every enemy, lift and cart at the clock `t` it is stood at
// (`startAt`, L-014): the rider, GDD-WLD-18's "expert's line", and the careful bot, its "careful run". Every answer is one GDD-WLD-18 measures
// (`level3-3.test.ts`, `level3-3.enemies.test.ts`), taken at a place inside the measured window; both read the screen (where a cart, a ringtail or the
// Armadillo is), never the clock `t`. The level is unregistered. The other bots (the walker, the first-time player's losses, the piñatas, the
// secret) are phase B2b.


/** What one run left, beyond how it ended. */
interface Run {
  readonly how: string;
  readonly steps: number;
  readonly hilos: number;
  readonly checkpoint: number;
  readonly boarded: string;
  readonly perch: boolean;
  readonly pier: boolean;
  readonly clean: boolean;
}

const onPerch = (r: RunState) => standsOnPlatform(r.player, platformAt(LEVEL_3_3_PLATFORM.perch, r.platformTick));
/** On the stone pier (GDD-WLD-18's column 167): grounded on row 25 with his middle over it. */
const onPier = (r: RunState) => r.player.grounded && r.player.y === Y(25) && r.player.x >= PIER_COL * TILE && r.player.x < (PIER_COL + 1) * TILE;

function describeRun(b: Played): Run {
  // Over all seven rails: his carts are C1, C2, C3 and C4, on R1, R3, R4 and R7; the Cacomixtles' (R2, R5, R6) are not his, and no bot boards one.
  const boarded = NAMES.filter((name) => b.states.some((r) => inCart(r, name)));
  return {
    how: outcomeOf(b),
    steps: b.states.length,
    hilos: b.end.hilosTaken.filter(Boolean).length,
    checkpoint: b.end.checkpointIndex,
    boarded: boarded.join(' '),
    perch: b.states.some(onPerch),
    pier: b.states.some(onPier),
    // No piñata bumped, so no taco or chile carried: the bots here take the hit of nothing (the taco would add one).
    clean: b.end.pinatasOpen.every((open) => !open) && b.end.items.length === 0 && b.end.lives.lives === 7,
  };
}

/** Shares no factor with the bats' period (240), the lifts' rounds (192 and 384 steps) or the Armadillo's (1,058), so the start clocks meet every phase of the bats and MP1, and 249 different phases of MP2 and the Armadillo. */
const STEP = 29;

/** One bot over every start clock driven: how each ended and, for the runs that cleared the level, what they left. */
interface Collected {
  readonly tally: Record<string, number>;
  readonly steps: number[];
  readonly hilos: Set<number>;
  readonly checkpoints: Set<number>;
  readonly boarded: Set<string>;
  readonly perch: Set<boolean>;
  readonly pier: Set<boolean>;
  readonly clean: Set<boolean>;
}
const collected = (): Collected => ({ tally: {}, steps: [], hilos: new Set(), checkpoints: new Set(), boarded: new Set(), perch: new Set(), pier: new Set(), clean: new Set() });

describe('GDD-WLD-18 level 3-3 the bots, whole', () => {
  it(`GDD-WLD-18 3-3 the bots: the rider and the careful one, from the start at every ${STEP}th clock (step ${STEP}, ${clocks(7200, STEP).length} clocks)`, () => {
    // Every start clock t in [0, 7200): the longest idle period is the Zopilote's (7,200 steps), the bats' is 240 and the Armadillo's 1,058. Each bot is run
    // with `stopAtLoss`: a life lost ends the run, and its cause is `causeOf` on the losing step.
    const result: Record<string, Collected> = { rider: collected(), careful: collected() };
    // The careful bot's wait on L1 for its read of the Armadillo: from standing on L1 (its route's 9th task done) to the read (the 10th).
    const readWaits: number[] = [];
    for (const [name, make] of Object.entries({ rider: RIDER, careful: CAREFUL })) {
      const out = result[name]!;
      for (const t of clocks(7200, STEP)) {
        const b = bot(make(), startAt(t), 8000, true);
        const run = describeRun(b);
        if (name === 'careful' && run.how === 'exit, 0 lost') readWaits.push(b.marks[9]! - b.marks[8]!);
        tally(out.tally, run.how);
        if (run.how !== 'exit, 0 lost') continue;
        out.steps.push(run.steps);
        out.hilos.add(run.hilos);
        out.checkpoints.add(run.checkpoint);
        out.boarded.add(run.boarded);
        out.perch.add(run.perch);
        out.pier.add(run.pier);
        out.clean.add(run.clean);
      }
    }
    const summary = Object.fromEntries(
      Object.entries(result).map(([name, o]) => [
        name,
        { tally: o.tally, steps: span(o.steps), seconds: `${(Math.min(...o.steps) / 60).toFixed(1)} to ${(Math.max(...o.steps) / 60).toFixed(1)}`, hilos: [...o.hilos], checkpoints: [...o.checkpoints], boarded: [...o.boarded], perch: [...o.perch], pier: [...o.pier], clean: [...o.clean] },
      ]),
    );
    // The careful bot exits with every life at every clock driven (the stop condition of the plan: a clock that loses one is reported, never pinned).
    expect(summary.careful!.tally).toEqual({ 'exit, 0 lost': 249 });
    // Measured over 249 start clocks, GDD-WLD-18's "Played through" (it replaced a hand count of about 35 and 43 s): the rider clears the
    // level in 2,392 to 2,771 steps (39.9 to 46.2 s) at the 146 clocks it keeps every life, the careful bot in 2,721 to 3,886 (45.4 to 64.8 s), its waits (the
    // Armadillo, K1's cart, the lift MP2) all over the lifts' and the enemies' clocks. Each takes 27 (rider) or 29 (careful, the perch's two) of the 50 hilos: neither
    // breaks a piñata nor goes for the secret. Both reach all three ofrendas (checkpoint 2), ride all four of his carts and stop on the pier; the careful bot stands on
    // the perch at every clock. The rider loses its life at 103 clocks, all of them at P3: the Armadillo's ball on the walk onto P3 at 77, where the lift brings him to
    // the face as it rolls (columns 107 and 108; GDD-WLD-18 answers it by waiting on L1, which only the careful bot does), and the first bat at 26, 1 to 4 steps into
    // the rider's own held jump over the ball, taken under the bat (column 111). Whether these are GDD-WLD-18's "26 have no answer" is not checked here.
    // The careful read waits at most this many steps on L1 (GDD-WLD-18's P3 bullet).
    expect(Math.max(...readWaits)).toBe(817);
    expect(summary).toEqual({
      rider: {
        tally: { 'exit, 0 lost': 146, 'no exit, 1 lost (Armadillo at 107)': 44, 'no exit, 1 lost (Armadillo at 108)': 33, 'no exit, 1 lost (bat 1 at 111)': 26 },
        steps: '2392 to 2771',
        seconds: '39.9 to 46.2',
        hilos: [27],
        checkpoints: [2],
        boarded: ['R1 R3 R4 R7'],
        perch: [false],
        pier: [true],
        clean: [true],
      },
      careful: {
        tally: { 'exit, 0 lost': 249 },
        steps: '2721 to 3886',
        seconds: '45.4 to 64.8',
        hilos: [29],
        checkpoints: [2],
        boarded: ['R1 R3 R4 R7'],
        perch: [true],
        pier: [true],
        clean: [true],
      },
    });
  }, 300_000);
});

/** Task names of each route, in order: `marks[i]` is the step `ROUTE[i]` was done on (the last task ends with the level's clear). */
const RIDER_ROUTE = [
  'in C1', 'C1 at its buffer', 'on P1', 'K1: held jump at a walk from x 800', "over T1's wall", 'the first ofrenda',
  'in C2', "R3's post: held jump, on L1", 'the spring and MP1, on P3', 'the Armadillo jumped', 'the glide on foot, on P4', "over P4's wall",
  'in C3', 'C3 at its buffer on Q', 'stopped on the pier', "K2's cart jumped", 'on P5',
  "K3's cart jumped", "at MP2's foot", 'on A', 'the stairs, in C4', "R7's post: held jump into the exit",
];
const CAREFUL_ROUTE = [
  'in C1', 'C1 at its buffer', 'on P1', 'K1 woken, the jump back onto the perch', "K1's cart stopped at its buffer", "over T1's wall", 'the first ofrenda',
  'in C2', "R3's post: held jump, on L1", "the Armadillo read (heading right, between 1776 and 1856)", 'the spring and MP1, on P3', 'the Armadillo jumped', 'the glide on foot, on P4', "over P4's wall",
  'in C3', 'C3 at its buffer on Q', 'stopped on the pier', "K2's cart jumped", 'on P5',
  'K3 woken', "K3's cart jumped", "stopped short of MP2's lift", "the lift at its foot, stepped on", 'on A', 'the stairs, in C4', "R7's post: held jump into the exit",
];

const px = (n: number) => Math.round(n * 10) / 10;
/** The step each task of a route was done on, by name; the last task ends with the clear, on the run's last step. */
const route = (b: Played, names: readonly string[]) => Object.fromEntries(names.map((n, i) => [n, i < b.marks.length ? b.marks[i]! : b.states.length]));

/** The index of the first state at or after `from` in which he is in the air. */
const firstAirborne = (states: readonly RunState[], from: number): number => states.findIndex((r, k) => k >= from && !r.player.grounded);
/** The state just before the first take-off at or after state `from`. */
const beforeJump = (states: readonly RunState[], from: number): RunState => states[firstAirborne(states, from) - 1]!;
/** The gap in px from the Armadillo's ball (its front) to his front. */
const ballGap = (r: RunState) => r.enemies[E.ARMADILLO]!.x - ARMADILLO.width / 2 - (r.player.x + HITBOX.width / 2);

/**
 * Where each jump of a bot was taken, by the task it follows (the first take-off after that task was done): K1's take-off x (the rider's), the gap in px from
 * K2's and K3's cart front to his front, and from the Armadillo's ball.
 */
const flash = (b: Played) => b.states.findIndex((r) => r.enemies[E.K2]!.ride!.phase !== 'waiting');
function takeoffs(b: Played, names: readonly string[], after: { k1?: string; k2: string; k3: string; ball: string }) {
  const from = (task: string) => b.marks[names.indexOf(task)]!;
  return {
    k1: after.k1 === undefined ? null : px(beforeJump(b.states, from(after.k1)).player.x),
    k2: px(gapTo(beforeJump(b.states, from(after.k2)), 'R5')),
    // K2's first flash is the first state with its ringtail awake; `level3-3.enemies.test.ts` counts from it: the rest on the pier "rest 20 after the first flash, x 2680.2" and,
    // at that arrival, a held jump over its cart from "52-89 (38)" steps after it. These are the bot's: the steps from the flash to its rest, its x there, and to its take-off.
    k2Rest: from(after.k2) - flash(b),
    k2RestX: px(b.states[from(after.k2) - 1]!.player.x),
    k2Step: firstAirborne(b.states, from(after.k2)) - flash(b),
    k3: px(gapTo(beforeJump(b.states, from(after.k3)), 'R6')),
    ball: px(ballGap(beforeJump(b.states, from(after.ball)))),
    // The last jump, from C4's post: the steps from C4 rolling (the stairs done) to the take-off, and how far over the bank (y = 240) he reaches the exit (GDD-WLD-18's
    // measured 40.8 px for a held jump from the post). The task of that jump is never done, the level being cleared, so it has no mark of its own.
    post7: b.states.findIndex((r, k) => k >= from('the stairs, in C4') && !r.player.grounded) - from('the stairs, in C4'),
    exit: px(Y(15) - b.end.player.y),
  };
}

describe('GDD-WLD-18 level 3-3 the bots at the start clock 0', () => {
  it('GDD-WLD-18 3-3 the bots at the start clock 0: the rider and the careful one, step by step', () => {
    const rider = bot(RIDER(), startAt(0), 8000, true);
    const careful = bot(CAREFUL(), startAt(0), 8000, true);
    // Both clear the level with every life first; a bot that has not has no take-offs to read.
    expect([outcomeOf(rider), outcomeOf(careful)]).toEqual(['exit, 0 lost', 'exit, 0 lost']);
    const jumps = { rider: takeoffs(rider, RIDER_ROUTE, { k1: 'on P1', k2: 'stopped on the pier', k3: 'on P5', ball: 'the spring and MP1, on P3' }), careful: takeoffs(careful, CAREFUL_ROUTE, { k2: 'stopped on the pier', k3: 'K3 woken', ball: 'the spring and MP1, on P3' }) };
    // The windows are GDD-WLD-18's and B1's, not the bots' numbers: K1 a held jump at a walk from the wake line (x 728) to 840; K2 at the arrival `level3-3.enemies.test.ts`
    // measures ("rest 20 after the first flash, x 2680.2 ... held ... pier 52-89 (38)"): at rest 20 steps after the first flash, at x 2680.2, taking off 52 to 89 steps
    // after it; K3 a held jump once its cart is 32 px or less from his front and not 0 px ("at 0 px K3 takes it").
    expect(jumps.rider.k1! >= 728 && jumps.rider.k1! <= 840).toBe(true);
    for (const j of Object.values(jumps)) {
      expect([j.k2Rest, j.k2RestX, j.k2Step >= 52 && j.k2Step <= 89]).toEqual([20, 2680.2, true]);
      expect(j.k3 > 0 && j.k3 <= 32).toBe(true);
    }
    // Measured, GDD-WLD-18's "Played through": from the start clock 0 the rider clears the level in
    // 2,750 steps (45.8 s) and the careful bot in 2,750 too. The careful read (the Armadillo walking right between x 1776 and 1856) is met at once at this clock, and
    // both ride the same ascent of the lift MP2 (on A at 2503): the rider is at its foot at 2057 and waits there, the careful bot stops short of it at 2205 and steps
    // on at 2286. The take-offs are inside what GDD-WLD-18 measures: K1's at x 801 (a held jump at a walk from 728 to 840 keeps the life, 843.2 and on loses it), K2's
    // cart 38.3 px short of his front (taken 73 steps after K2's first flash; its window at this arrival is 52 to 89), K3's 31.3 and 30.1 px (32 px or less, never 0), the ball 30.8 px; and the last jump from C4's post 55 steps into its ride (the layout test's step 55)
    // and reaching the exit 40.8 px over the bank, as `level3-3.test.ts` measures for a held jump from the post.
    expect({
      rider: { how: outcomeOf(rider), steps: rider.states.length, takeoffs: jumps.rider, route: route(rider, RIDER_ROUTE) },
      careful: { how: outcomeOf(careful), steps: careful.states.length, takeoffs: jumps.careful, route: route(careful, CAREFUL_ROUTE) },
    }).toEqual({
      rider: {
        how: 'exit, 0 lost',
        steps: 2750,
        takeoffs: { k1: 801, k2: 38.3, k2Rest: 20, k2RestX: 2680.2, k2Step: 73, k3: 31.3, ball: 30.8, post7: 55, exit: 40.8 },
        route: {
          'in C1': 34,
          'C1 at its buffer': 283,
          'on P1': 305,
          'K1: held jump at a walk from x 800': 480,
          "over T1's wall": 515,
          'the first ofrenda': 526,
          'in C2': 563,
          "R3's post: held jump, on L1": 804,
          'the spring and MP1, on P3': 1066,
          'the Armadillo jumped': 1188,
          'the glide on foot, on P4': 1375,
          "over P4's wall": 1410,
          'in C3': 1460,
          'C3 at its buffer on Q': 1569,
          'stopped on the pier': 1678,
          "K2's cart jumped": 1799,
          'on P5': 1875,
          "K3's cart jumped": 2057,
          "at MP2's foot": 2057,
          'on A': 2503,
          'the stairs, in C4': 2614,
          "R7's post: held jump into the exit": 2750,
        },
      },
      careful: {
        how: 'exit, 0 lost',
        steps: 2750,
        takeoffs: { k1: null, k2: 38.3, k2Rest: 20, k2RestX: 2680.2, k2Step: 73, k3: 30.1, ball: 30.8, post7: 55, exit: 40.8 },
        route: {
          'in C1': 34,
          'C1 at its buffer': 283,
          'on P1': 305,
          'K1 woken, the jump back onto the perch': 383,
          "K1's cart stopped at its buffer": 479,
          "over T1's wall": 653,
          'the first ofrenda': 664,
          'in C2': 701,
          "R3's post: held jump, on L1": 942,
          'the Armadillo read (heading right, between 1776 and 1856)': 942,
          'the spring and MP1, on P3': 1066,
          'the Armadillo jumped': 1188,
          'the glide on foot, on P4': 1375,
          "over P4's wall": 1410,
          'in C3': 1460,
          'C3 at its buffer on Q': 1569,
          'stopped on the pier': 1678,
          "K2's cart jumped": 1799,
          'on P5': 1875,
          'K3 woken': 1941,
          "K3's cart jumped": 2093,
          "stopped short of MP2's lift": 2205,
          'the lift at its foot, stepped on': 2286,
          'on A': 2503,
          'the stairs, in C4': 2614,
          "R7's post: held jump into the exit": 2750,
        },
      },
    });
  });
});
