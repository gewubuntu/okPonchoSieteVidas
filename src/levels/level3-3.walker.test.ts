import { describe, expect, it } from 'vitest';
import { TILE } from '../config/tuning';
import { startRun, stepRun, type RunState } from '../sim/run';
import { jumpAt, runUntil, span, tally, type Ctl } from './bots';
import {
  apart,
  at,
  bot,
  cartOf,
  clocks,
  colOf,
  fly,
  inCart,
  jumper,
  L,
  landedAs,
  last,
  mp0Up,
  NAMES,
  PIER_COL,
  PIT_JUMP,
  play,
  right,
  outcomeOf,
  SECRET,
  startAt,
  tookOf,
  velaTaken,
  WALKER,
  whereIs,
  Y,
  type Flight,
  type Jump,
  type Played,
} from './level3-3.drive';

// GDD-WLD-18, phase B2b: 3-3's walker (the sentence "No cart is needed") and the secret bot, over the real level with every enemy, lift and cart
// at the start clock they are stood at (`startAt`, L-014). The level is unregistered. Part 1 sweeps the two places the walker's take-off has no
// measured window yet (C1's dip and the first pit, the last stair jump); part 2 plays the whole level.

const R = (n: number) => Math.round(n * 10) / 10;
/** The take-offs of a sweep that ended alike, in order: "x0 to x1 what". */
function windows(xs: readonly number[], tags: readonly string[]): string[] {
  const out: string[] = [];
  let from = 0;
  for (let i = 1; i <= tags.length; i++) {
    if (i < tags.length && tags[i] === tags[from]) continue;
    out.push(`${R(xs[from]!)} to ${R(xs[i - 1]!)} ${tags[from]}`);
    from = i;
  }
  return out;
}
/** How many take-offs ended each way. */
function counts(tags: readonly string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const t of tags) tally(out, t);
  return out;
}

/** How a flight ended: a life lost; the cart `name`'s rail's cart woken (`boards`); or where he came down (`landedAs`), the slope tile by name. */
const endedAs = (f: Flight, rail: 'R1' | 'R7'): string => {
  if (f.lost) return 'lost';
  if (f.landed!.carts[cartOf(rail)]!.phase !== 'waiting') return 'boards';
  const where = landedAs(f);
  return where.startsWith('ground') ? 'slope tile' : where;
};

/** A jump `kind` with right held, from the spawn run to x (a run), as `fly` but with the walk before it; ends where `fly` does, or when C1 is boarded. */
function fromSpawn(x: number, kind: Jump): Flight {
  const jump = jumper(kind, 1);
  let r: RunState = startRun(L);
  let i = -1;
  let air = false;
  const states: RunState[] = [];
  for (let n = 0; n < 400; n++) {
    if (i < 0 && r.player.x >= x && r.player.grounded) i = 0;
    r = stepRun(r, i < 0 ? { move: 1, jumpHeld: false } : jump(r, i++), L);
    states.push(r);
    if (r.phase !== 'playing') return { x, lost: true, states };
    if (!r.player.grounded) air = true;
    else if (air || r.carts[cartOf('R1')]!.phase !== 'waiting') return { x, lost: false, landed: r, states };
  }
  return { x, lost: false, states };
}

/** A stair jump's end: where it ended, with the column he came down at when that is P6. */
const stairTag = (f: Flight) => {
  const e = endedAs(f, 'R7');
  return e === 'P6' ? `P6 ${colOf(f)}` : e;
};

describe('GDD-WLD-18 level 3-3 the walker, the two sweeps', () => {
  it("GDD-WLD-18 3-3 the walker past C1's dip and over the first pit: the take-offs that board nothing", () => {
    // From the spawn (x = 40) right held to G0's lip (x = 80): a plain jump and a held one from each take-off 0.2 tile apart, at a run (the walk from
    // the spawn) and standing (`at`). `boards` is C1 rolling when he lands (the dip, columns 5 and 6, is C1's floor); `slope tile` is column 7's.
    const takeoffs = apart(40, 80);
    const dip = (way: 'running' | 'standing', kind: Jump) => takeoffs.map((x) => endedAs(way === 'running' ? fromSpawn(x, kind) : fly(at(x, Y(34), 0), kind, 1), 'R1'));
    const sweep = { running: { plain: dip('running', 'top'), held: dip('running', 'held') }, standing: { plain: dip('standing', 'top'), held: dip('standing', 'held') } };
    // A plain hop at a run lands on G0b without boarding C1 from 59.2 to 78.4 (7 of 13 take-offs), one standing from 72 (3); the take-offs before it board C1 or land on
    // the slope tile. A held jump never lands on G0b but at the spawn itself (standing, x = 40: it comes down at x = 164.6, 1.4 px on G0b's far edge): from 56 at a
    // run and from 65.6 standing it flies the dip and the pit in one flight onto the shelf, and the ones before are lost in the pit.
    expect(Object.fromEntries(Object.entries(sweep).map(([way, k]) => [way, { plain: windows(takeoffs, k.plain), held: windows(takeoffs, k.held) }]))).toEqual({
      running: { plain: ['40 to 46.4 boards', '49.6 to 56 slope tile', '59.2 to 78.4 G0b'], held: ['40 to 40 G0b', '43.2 to 52.8 lost', '56 to 78.4 shelf'] },
      standing: { plain: ['40 to 59.2 boards', '62.4 to 68.8 slope tile', '72 to 78.4 G0b'], held: ['40 to 40 G0b', '43.2 to 62.4 lost', '65.6 to 78.4 shelf'] },
    });
    expect(Object.fromEntries(Object.entries(sweep).map(([way, k]) => [way, { plain: counts(k.plain), held: counts(k.held) }]))).toEqual({
      running: { plain: { boards: 3, 'slope tile': 3, G0b: 7 }, held: { G0b: 1, lost: 4, shelf: 8 } },
      standing: { plain: { boards: 7, 'slope tile': 3, G0b: 3 }, held: { G0b: 1, lost: 7, shelf: 5 } },
    });
    // The pit, columns 10 to 13 (x 160 to 224), 1 tile down: the same jumps from G0b (x = 128 to its lip at 160). A held one reaches the shelf from every take-off; a
    // plain one at a run from 147.2 on (5 of 11), standing only from the lip itself.
    const pit = apart(128, 160);
    const jumpPit = (vx: number, kind: Jump) => pit.map((x) => endedAs(fly(at(x, Y(34), vx), kind, 1), 'R1'));
    const jumps = { standing: { plain: jumpPit(0, 'top'), held: jumpPit(0, 'held') }, running: { plain: jumpPit(120, 'top'), held: jumpPit(120, 'held') } };
    expect(Object.fromEntries(Object.entries(jumps).map(([way, k]) => [way, { plain: windows(pit, k.plain), held: windows(pit, k.held) }]))).toEqual({
      standing: { plain: ['128 to 156.8 lost', '160 to 160 shelf'], held: ['128 to 160 shelf'] },
      running: { plain: ['128 to 144 lost', '147.2 to 160 shelf'], held: ['128 to 160 shelf'] },
    });
    expect(Object.fromEntries(Object.entries(jumps).map(([way, k]) => [way, { plain: counts(k.plain), held: counts(k.held) }]))).toEqual({
      standing: { plain: { lost: 10, shelf: 1 }, held: { shelf: 11 } },
      running: { plain: { lost: 6, shelf: 5 }, held: { shelf: 11 } },
    });
  });

  it("GDD-WLD-18 3-3 the walker's last stair jump onto P6 outside C4", () => {
    // From the third pair of planks (columns 208 and 209, x 3328 to 3360, row 11), take-offs 0.2 tile apart, standing and at a run (120 px/s), a plain jump and a held
    // one, right held or let go. `boards` is C4 rolling when he lands (it stands at 212 and 213, on P6, row 9); `plank` is back on the stairs.
    const takeoffs = apart(3328, 3360);
    const sweep: Record<string, string[]> = {};
    for (const [way, vx] of [['standing', 0], ['running', 120]] as const) {
      for (const move of [1, 0] as const) {
        for (const kind of ['top', 'held'] as const) sweep[`${way} right ${move === 1 ? 'held' : 'let go'} ${kind === 'top' ? 'plain' : 'held'}`] = takeoffs.map((x) => stairTag(fly(at(x, Y(11), vx), kind, move)));
      }
    }
    // Right held, only the first take-offs land on P6 (standing 3328 to 3340.8, a plain jump, at columns 210.8 to 211.6; at a run 3328 and 3331.2): the rest
    // land in C4 (columns 213), which rolls. Right let go, standing he comes back down on the planks; at a run a plain or held jump from 3350.4 to 3360 lands on P6
    // (on P6's left edge: his middle is at columns 210.6 to 211.2 and his box is over its first tile from the first), from 3347.2 on A, and before that on the planks.
    expect(Object.fromEntries(Object.entries(sweep).map(([k, tags]) => [k, windows(takeoffs, tags)]))).toEqual({
      'standing right held plain': ['3328 to 3328 P6 210.8', '3331.2 to 3331.2 P6 211', '3334.4 to 3334.4 P6 211.2', '3337.6 to 3337.6 P6 211.4', '3340.8 to 3340.8 P6 211.6', '3344 to 3360 boards'],
      // The odd one: held from 3328 comes down on P6's ground (y = 144) at column 212.4, inside C4's columns and under its floor (y = 136), and starts nothing.
      'standing right held held': ['3328 to 3328 P6 212.4', '3331.2 to 3360 boards'],
      'standing right let go plain': ['3328 to 3360 plank'],
      'standing right let go held': ['3328 to 3360 plank'],
      'running right held plain': ['3328 to 3328 P6 211.5', '3331.2 to 3331.2 P6 211.7', '3334.4 to 3360 boards'],
      'running right held held': ['3328 to 3360 boards'],
      'running right let go plain': ['3328 to 3344 plank', '3347.2 to 3347.2 A', '3350.4 to 3350.4 P6 210.6', '3353.6 to 3353.6 P6 210.8', '3356.8 to 3356.8 P6 211', '3360 to 3360 P6 211.2'],
      'running right let go held': ['3328 to 3344 plank', '3347.2 to 3347.2 A', '3350.4 to 3350.4 P6 210.6', '3353.6 to 3353.6 P6 210.8', '3356.8 to 3356.8 P6 211', '3360 to 3360 P6 211.2'],
    });
    const onP6 = (k: string) => sweep[k]!.filter((t) => t.startsWith('P6')).length;
    expect(Object.keys(sweep).map(onP6)).toEqual([5, 1, 0, 0, 2, 0, 4, 4]);
  });
});

/** Standing on the ground of row `row` (its top). */
const onRow = (row: number) => (r: RunState) => r.player.grounded && r.player.y === Y(row);

/** From where he landed: in the cart, right held to P1; on G0b, the pit jumped and the shelf walked to MP0; elsewhere (shelf, cap, hollow, MP0), off onto the shelf and MP0 up. */
const onward = (landing: string): Ctl[] =>
  landing.startsWith('cart') ? [runUntil(1, onRow(26))] : landing === 'G0b' ? [jumpAt(PIT_JUMP, Infinity), ...mp0Up()] : [runUntil(1, onRow(35)), ...mp0Up()];

describe('GDD-WLD-18 level 3-3 the shelf under pier V and the fall out of C1', () => {
  it('GDD-WLD-18 3-3 the shelf runs under pier V: from its left part he walks to MP0', () => {
    // User, 2026-11-18, "Tunnel under the pier": pier V's wall (column 22) and floor (23 and 24) stop at row 31, so the shelf (row 35) runs under the hollow, x = 352 to 400, to MP0 (columns 32
    // and 33). Right held from x = 240, 300 and 340 on the shelf's left part, at each of 6 start times of MP0's round (72 steps apart): he passes x = 352 (after 60, 30 and 10 steps)
    // and ends, with every life, against P1's face at x = 538 on MP0's foot (6 of 18 runs, the lift above him) or on the lift as it carries him up (9), or on P1 at x = 611 (3: right held steps
    // off the lift's top onto P1).
    const ends: Record<string, number> = {};
    const passed: Record<number, Set<number>> = {};
    for (const x0 of [240, 300, 340]) {
      for (let t = 0; t < 432; t += 72) {
        const states = play(at(x0, Y(35), 0, t), 400, () => right, (r) => r.phase !== 'playing');
        const e = last(states);
        (passed[x0] ??= new Set()).add(states.findIndex((r) => r.player.x > 352));
        tally(ends, `${R(e.player.x)} ${whereIs(e).replace(/^MP0$/, 'on the lift')} ${e.lives.lives}`);
      }
    }
    expect(Object.fromEntries(Object.entries(passed).map(([x0, steps]) => [x0, [...steps]]))).toEqual({ 240: [60], 300: [30], 340: [10] });
    expect(ends).toEqual({ '538 mp0Foot 7': 6, '538 on the lift 7': 9, '611 P1 7': 3 });
  });

  it('GDD-WLD-18 3-3 the fall out of C1: a hop out at every 4th step of the ride over the trestle, and from where he lands on to P1', () => {
    // C1 boarded by the walk from the spawn, right held to its buffer; every 4th step of the ride from the landing in C1 (33) while his middle is over columns 10 to 33 (x 160 to 544): a jump
    // out with right held, nothing held or left held, plain and held (the glide). `over the pit` is columns 10 to 13 (x 160 to 224), under which the first pit is open.
    const ride = play(startRun(L), 600, () => right, (r) => r.carts[cartOf('R1')]!.phase === 'stopped' || r.phase !== 'playing');
    const boarded = ride.findIndex((r) => r.carts[cartOf('R1')]!.phase !== 'waiting');
    const hops = ride.map((_, i) => i).filter((i) => i >= boarded && (i - boarded) % 4 === 0 && ride[i]!.player.x >= 160 && ride[i]!.player.x < 544);
    expect([boarded, hops.length, hops[0]! - boarded, last(hops) - boarded]).toEqual([33, 48, 32, 220]);
    const sweep: Record<string, Record<string, number>> = {};
    for (const kind of ['top', 'held'] as const) {
      for (const move of [-1, 0, 1] as const) {
        const out: Record<string, number> = {};
        for (const i of hops) {
          const f = fly(ride[i]!, kind, move);
          const landing = landedAs(f);
          const band = ride[i]!.player.x < 224 ? 'over the pit' : 'over the trestle';
          if (f.lost) tally(out, `${band}: lost`);
          else {
            // On P1 already (the glide), nothing is left to do; otherwise the onward walk must end on P1 with every life.
            const end = landing === 'P1' ? f.landed! : bot(onward(landing), f.landed!, 3000, true).end;
            tally(out, `${band}: ${landing} > ${onRow(26)(end) && end.player.x >= 544 && end.lives.lives === 7 ? 'P1' : `not on P1 (${end.lives.lives} lives)`}`);
          }
        }
        sweep[`${kind === 'top' ? 'plain' : 'held'} ${['left', 'nothing', 'right'][move + 1]}`] = out;
      }
    }
    // Measured (48 take-offs per jump). Right held or nothing held (the cart's own direction): he comes down back in the cart (the plain one almost always), and on the cap, the shelf or P1
    // from the others; every one goes on to P1. A hop to the left comes down on the shelf, the cap, MP0, P1 or (the held one from the pit's columns) G0b, and from each the walk to MP0
    // (or the pit jump, then MP0) brings him onto P1 with every life, but for two kinds. LOST, a life: the plain left hop from ride steps 40 to 72 (x 181 to 226) and the held
    // one from 68 to 116 (x 220 to 237 and 274 to 302; between them he lands on the shelf) come down in the first pit (x 166 to 207), 9 and 10 of the 48. And one plain left hop (from step 76) lands on the shelf's left edge, 0.07 px
    // over it, and slides off into the pit as he walks on right (6 lives).
    expect(sweep).toEqual({
      'plain left': {
        'over the pit: cart R1 > P1': 2,
        'over the pit: lost': 8,
        'over the trestle: lost': 1,
        'over the trestle: shelf > not on P1 (6 lives)': 1,
        'over the trestle: shelf > P1': 22,
        'over the trestle: cart R1 > P1': 1,
        'over the trestle: cap > P1': 6,
        'over the trestle: MP0 > P1': 4,
        'over the trestle: P1 > P1': 3,
      },
      'plain nothing': { 'over the pit: cart R1 > P1': 9, 'over the pit: shelf > P1': 1, 'over the trestle: cart R1 > P1': 35, 'over the trestle: shelf > P1': 1, 'over the trestle: cap > P1': 2 },
      'plain right': { 'over the pit: cart R1 > P1': 9, 'over the pit: shelf > P1': 1, 'over the trestle: cart R1 > P1': 35, 'over the trestle: shelf > P1': 1, 'over the trestle: cap > P1': 2 },
      'held left': {
        'over the pit: shelf > P1': 2,
        'over the pit: G0b > P1': 7,
        'over the pit: lost': 1,
        'over the trestle: lost': 9,
        'over the trestle: shelf > P1': 16,
        'over the trestle: cap > P1': 4,
        'over the trestle: mp0Foot > P1': 1,
        'over the trestle: MP0 > P1': 3,
        'over the trestle: P1 > P1': 5,
      },
      'held nothing': { 'over the pit: cart R1 > P1': 9, 'over the pit: shelf > P1': 1, 'over the trestle: cart R1 > P1': 24, 'over the trestle: shelf > P1': 1, 'over the trestle: cap > P1': 4, 'over the trestle: mp0Foot > P1': 1, 'over the trestle: P1 > P1': 8 },
      'held right': { 'over the pit: cart R1 > P1': 9, 'over the pit: shelf > P1': 1, 'over the trestle: cart R1 > P1': 24, 'over the trestle: shelf > P1': 1, 'over the trestle: cap > P1': 4, 'over the trestle: mp0Foot > P1': 1, 'over the trestle: P1 > P1': 8 },
    });
  });
});

/** One bot over every start clock driven: how each ended and, for the runs that cleared the level, what they left. */
interface Collected {
  readonly tally: Record<string, number>;
  readonly steps: number[];
  readonly hilos: Set<number>;
  readonly checkpoints: Set<number>;
  readonly moved: Set<string>;
  readonly veladora: Set<boolean>;
  readonly lives: Set<number>;
  readonly secretHilos: Set<string>;
  /** No piñata opened and no item out at the clear, and never in a Cacomixtle's cart (R2, R5, R6). */
  readonly clean: Set<boolean>;
  readonly ringtailCart: Set<boolean>;
  /** Stood still on the stone pier at some step (GDD-WLD-18's "stops on the pier for K2"). */
  readonly pier: Set<boolean>;
  /** The steps, summed over the runs, on which one of his carts (C1, C2, C3, C4) was other than waiting. */
  hisBoarded: number;
}
const collected = (): Collected => ({ tally: {}, steps: [], hilos: new Set(), checkpoints: new Set(), moved: new Set(), veladora: new Set(), lives: new Set(), secretHilos: new Set(), clean: new Set(), ringtailCart: new Set(), pier: new Set(), hisBoarded: 0 });

/** Shares no factor with the bats' period (240), the lifts' rounds (432, 192 and 384 steps) or the Armadillo's (1,058): 249 start clocks meet every phase of the bats and MP1, and 249 different ones of MP0, MP2 and the Armadillo. */
const STEP = 29;
/** His carts, which the walker leaves alone: C1 on R1, C2 on R3, C3 on R4 and C4 on R7. */
const WALKED = ['R1', 'R3', 'R4', 'R7'] as const;
const waiting = (r: RunState, name: (typeof NAMES)[number]) => r.carts[cartOf(name)]!.phase === 'waiting';
/** Standing still on the stone pier (GDD-WLD-18's column 167): grounded on row 25, not moving, with his middle over it (a run across is not a stop). */
const onPier = (r: RunState) => r.player.grounded && r.player.vx === 0 && r.player.y === Y(25) && r.player.x >= PIER_COL * TILE && r.player.x < (PIER_COL + 1) * TILE;

/** `n` steps from `from` with `move` held and no jump, every state kept. */
const steps = (from: RunState, move: 0 | 1, n: number) => {
  const out = [from];
  for (let i = 0; i < n; i++) out.push(stepRun(out[out.length - 1]!, { move, jumpHeld: false }, L));
  return out;
};

describe('GDD-WLD-18 level 3-3 the walker and the secret bot, whole', () => {
  it('GDD-WLD-18 3-3 the pier check counts a stand on the pier, not a run across it', () => {
    // Right held over the pier at a run (from 24 px short of it, at 120 px/s) never counts; standing on its middle does.
    const run = steps(at(PIER_COL * TILE - 24, Y(25), 120), 1, 20);
    expect([run.some((r) => r.player.x >= PIER_COL * TILE && r.player.x < (PIER_COL + 1) * TILE && r.player.grounded), run.some(onPier), steps(at(PIER_COL * TILE + 8, Y(25)), 0, 2).every(onPier)]).toEqual([true, false, true]);
  });

  it(`GDD-WLD-18 3-3 the walker and the secret bot, from the start at every ${STEP}th clock (step ${STEP}, ${clocks(7200, STEP).length} clocks)`, () => {
    const result: Record<string, Collected> = { walker: collected(), secret: collected() };
    const lostAt: string[] = [];
    for (const [name, make] of Object.entries({ walker: WALKER, secret: SECRET })) {
      const out = result[name]!;
      for (const t of clocks(7200, STEP)) {
        const b = bot(make(), startAt(t), 8000, true);
        const how = outcomeOf(b);
        tally(out.tally, how);
        if (how !== 'exit, 0 lost') {
          lostAt.push(`${name} ${t} ${how}`);
          continue;
        }
        out.steps.push(b.states.length);
        out.hilos.add(b.end.hilosTaken.filter(Boolean).length);
        out.checkpoints.add(b.end.checkpointIndex);
        out.moved.add(NAMES.filter((n) => b.states.some((r) => !waiting(r, n))).join(' '));
        out.veladora.add(velaTaken(b.end));
        out.lives.add(b.end.lives.lives);
        out.secretHilos.add(tookOf(b.end, [[30, 27], [27, 28]]).join(' ') || 'none');
        out.clean.add(b.end.pinatasOpen.every((open) => !open) && b.end.items.length === 0);
        out.ringtailCart.add(b.states.some((r) => (['R2', 'R5', 'R6'] as const).some((n) => inCart(r, n))));
        out.pier.add(b.states.some(onPier));
        if (name === 'walker') out.hisBoarded += b.states.filter((r) => WALKED.some((n) => !waiting(r, n))).length;
      }
    }
    // The plan's stop condition: both bots exit with every life at every clock driven; a clock that loses one is reported with its clock and its cause, not pinned.
    expect(lostAt).toEqual([]);
    const summary = Object.fromEntries(
      Object.entries(result).map(([name, o]) => [
        name,
        { tally: o.tally, steps: span(o.steps), seconds: `${(Math.min(...o.steps) / 60).toFixed(1)} to ${(Math.max(...o.steps) / 60).toFixed(1)}`, hilos: [...o.hilos], checkpoints: [...o.checkpoints], moved: [...o.moved], veladora: [...o.veladora], lives: [...o.lives], secretHilos: [...o.secretHilos], clean: [...o.clean], ringtailCart: [...o.ringtailCart], pier: [...o.pier] },
      ]),
    );
    // The walker's four carts (C1 to C4, R1, R3, R4, R7) stay waiting on every step of every run (the check of "No cart is needed"); the carts that moved are
    // the Cacomixtles' (R2, R5, R6). The secret bot rides all four of his, as the careful bot, and takes the veladora at every clock with
    // every life (it restores nothing at 7 and is used up, GDD-LIFE-03); neither bot takes the secret's two hilos (30,27) and (27,28): the jump back
    // from P1 takes none (`level3-3.test.ts`). The walker takes 30 of the 50 hilos and the secret bot 29. Neither opens a piñata or carries an item, and neither ever stands in a Cacomixtle's cart; both stand still on the pier for K2 at every clock (GDD-WLD-18's "Played through").
    expect(result.walker!.hisBoarded).toBe(0);
    expect(summary).toEqual({
      walker: { tally: { 'exit, 0 lost': 249 }, steps: '3131 to 4475', seconds: '52.2 to 74.6', hilos: [30], checkpoints: [2], moved: ['R2 R5 R6'], veladora: [false], lives: [7], secretHilos: ['none'], clean: [true], ringtailCart: [false], pier: [true] },
      secret: { tally: { 'exit, 0 lost': 249 }, steps: '3391 to 4735', seconds: '56.5 to 78.9', hilos: [29], checkpoints: [2], moved: ['R1 R2 R3 R4 R5 R6 R7'], veladora: [true], lives: [7], secretHilos: ['none'], clean: [true], ringtailCart: [false], pier: [true] },
    });
  }, 300_000);
});

// Task names of each route, in order: `marks[i]` is the step `ROUTE[i]` was done on (the last task ends with the level's clear).
const WALKER_ROUTE = [
  "C1's dip hopped, on G0b", 'the first pit jumped, on the shelf', "stopped short of MP0's lift", 'MP0 at its foot, stepped on', 'on P1',
  'K1 woken, the jump back onto the perch', "K1's cart stopped at its buffer", "over T1's wall", 'the first ofrenda',
  'through C2 and up the slope, on P2', "P2's lip: held jump, on L1", 'the Armadillo read (heading right, between 1776 and 1856)', 'the spring and MP1, on P3', 'the Armadillo jumped', 'the glide on foot, on P4', "over P4's wall",
  'through C3 and over bridge A, on Q', 'stopped on the pier', "K2's cart jumped", 'on P5',
  'K3 woken', "K3's cart jumped", "stopped short of MP2's lift", "the lift at its foot, stepped on", 'on A', 'the stairs, on P6', 'through C4 and down the slope, on the shelf', "the shelf's lip: held jump into the exit",
];
const SECRET_ROUTE = [
  'in C1', 'C1 at its buffer', 'on P1', "P1's lip: held jump back, in the hollow", 'off the hollow, on the shelf', "stopped short of MP0's lift", 'MP0 at its foot, stepped on', 'on P1 again',
  'K1 woken, the jump back onto the perch', "K1's cart stopped at its buffer", "over T1's wall", 'the first ofrenda',
  'in C2', "R3's post: held jump, on L1", 'the Armadillo read (heading right, between 1776 and 1856)', 'the spring and MP1, on P3', 'the Armadillo jumped', 'the glide on foot, on P4', "over P4's wall",
  'in C3', 'C3 at its buffer on Q', 'stopped on the pier', "K2's cart jumped", 'on P5',
  'K3 woken', "K3's cart jumped", "stopped short of MP2's lift", "the lift at its foot, stepped on", 'on A', 'the stairs, in C4', "R7's post: held jump into the exit",
];
const px = (n: number) => Math.round(n * 10) / 10;
/** The step each task of a route was done on, by name; the last task ends with the clear, on the run's last step. */
const route = (b: Played, names: readonly string[]) => Object.fromEntries(names.map((n, i) => [n, i < b.marks.length ? b.marks[i]! : b.states.length]));
/** His x on the step he takes off (the state before the first airborne one) from state `from` on, and his x where he came down (the next grounded state; null: the level cleared in the air). */
function jumpsFrom(b: Played, from: number): { off: number; down: number | null }[] {
  const out: { off: number; down: number | null }[] = [];
  for (let k = Math.max(from, 1); k < b.states.length; k++) {
    if (b.states[k]!.player.grounded || !b.states[k - 1]!.player.grounded) continue;
    const land = b.states.findIndex((r, j) => j > k && r.player.grounded);
    out.push({ off: px(b.states[k - 1]!.player.x), down: land < 0 ? null : px(b.states[land]!.player.x) });
  }
  return out;
}
/** The place of a task in a route, to count the steps from. */
const markOf = (b: Played, names: readonly string[], task: string) => b.marks[names.indexOf(task)]!;

describe('GDD-WLD-18 level 3-3 the walker and the secret bot at the start clock 0', () => {
  it('GDD-WLD-18 3-3 the walker and the secret bot at the start clock 0, step by step', () => {
    const walker = bot(WALKER(), startAt(0), 8000, true);
    const secret = bot(SECRET(), startAt(0), 8000, true);
    // Both clear the level with every life first; a bot that has not has no take-offs to read.
    expect([outcomeOf(walker), outcomeOf(secret)]).toEqual(['exit, 0 lost', 'exit, 0 lost']);
    expect([walker.states.every((r) => r.lives.lives === 7 && r.phase !== 'respawning'), secret.states.every((r) => r.lives.lives === 7 && r.phase !== 'respawning')]).toEqual([true, true]);
    // The walker's four carts (R1, R3, R4, R7) stay waiting on every step (GDD-WLD-15's "Walking through a standing cart at the ground's height neither boards
    // nor starts it"). Only the Cacomixtles' carts (R2, R5, R6) roll.
    expect(WALKED.map((n) => walker.states.every((r) => waiting(r, n)))).toEqual([true, true, true, true]);
    expect(NAMES.filter((n) => walker.states.some((r) => !waiting(r, n)))).toEqual(['R2', 'R5', 'R6']);
    // Bridge A, twelve planks (columns 141 to 152): each falls 30 steps after he lands on it (GDD-WLD-18: 0.5 s), and he is already past it, running with right held.
    const bridge = L.crumbles.flatMap((c, i) => (c.row === 25 && c.col >= 141 && c.col <= 152 ? [{ i, col: c.col }] : []));
    expect(bridge).toHaveLength(12);
    const fell = bridge.map(({ i, col }) => {
      const warned = walker.states.findIndex((r) => r.crumbles[i]!.phase === 'warning');
      const gone = walker.states.findIndex((r) => r.crumbles[i]!.phase === 'gone');
      return [gone - warned, walker.states[gone]!.player.x - 6 >= (col + 1) * TILE];
    });
    expect(fell).toEqual(bridge.map(() => [30, true]));
    // The take-offs: the dip hop and the pit jump (from the sweeps' windows: a plain hop at a run lands on G0b from 59.2 to 78.4, a held jump on G0b reaches the shelf from
    // every take-off), the walker's from P2's lip (x = 1424, column 89; GDD-WLD-18 "a held jump lands at column 104.4 at a run" from the lip itself), the stairs' four and the
    // shelf's lip (x = 3616, column 226); the secret bot's from P1.
    const ki = jumpsFrom(walker, 0);
    const walked = jumpsFrom(walker, markOf(walker, WALKER_ROUTE, 'through C2 and up the slope, on P2'));
    const stairs = jumpsFrom(walker, markOf(walker, WALKER_ROUTE, 'on A'));
    // P2's lip: taken at x = 1425.7 at a run (1.7 px past the lip, still over P2's last tile), inside the measured window of 3 tiles before it to the lip; he lands on L1 at
    // x = 1671.7 (column 104.5; the lip itself gives 104.4). The stairs: A onto the first pair (3289), onto the second (3322), onto the third (3354), and from the third, taken at
    // x = 3354.0 with right let go (inside the sweep's window, 3350.4 to 3360 at a run), he lands on P6's left edge at x = 3373.7 (his box 3.7 px over P6's first tile at
    // 3376, accepted: P6 holds him; short of C4's floor, which stands at 3392 to 3424, and C4 stays waiting); the jump from the shelf's lip is taken at x = 3616.7 (0.7 px past it) and carries him into the exit.
    expect({ dip: ki[0], pit: ki[1], p2: walked[0], stairs, last: last(stairs), onP6: whereIs(walker.states[markOf(walker, WALKER_ROUTE, 'the stairs, on P6') - 1]!) }).toEqual({
      dip: { off: 71, down: 139 },
      pit: { off: 153, down: 317 },
      p2: { off: 1425.7, down: 1671.7 },
      stairs: [{ off: 3233.1, down: 3289 }, { off: 3289, down: 3322 }, { off: 3322, down: 3354 }, { off: 3354, down: 3373.7 }, { off: 3616.7, down: null }],
      last: { off: 3616.7, down: null },
      onP6: 'P6',
    });
    expect(route(walker, WALKER_ROUTE)).toEqual({
      "C1's dip hopped, on G0b": 54,
      'the first pit jumped, on the shelf': 143,
      "stopped short of MP0's lift": 237,
      'MP0 at its foot, stepped on': 414,
      'on P1': 655,
      'K1 woken, the jump back onto the perch': 782,
      "K1's cart stopped at its buffer": 878,
      "over T1's wall": 1052,
      'the first ofrenda': 1063,
      'through C2 and up the slope, on P2': 1146,
      "P2's lip: held jump, on L1": 1381,
      'the Armadillo read (heading right, between 1776 and 1856)': 1948,
      'the spring and MP1, on P3': 2218,
      'the Armadillo jumped': 2359,
      'the glide on foot, on P4': 2527,
      "over P4's wall": 2562,
      'through C3 and over bridge A, on Q': 2720,
      'stopped on the pier': 2840,
      "K2's cart jumped": 2961,
      'on P5': 3037,
      'K3 woken': 3103,
      "K3's cart jumped": 3254,
      "stopped short of MP2's lift": 3365,
      'the lift at its foot, stepped on': 3438,
      'on A': 3655,
      'the stairs, on P6': 3767,
      'through C4 and down the slope, on the shelf': 3837,
      "the shelf's lip: held jump into the exit": 3961,
    });
    // The secret bot: the held jump back is taken at x = 566.6 (22.6 px in from P1's lip at 544, inside the measured window of 16 px to 3 tiles at a run) and lands on the hollow's
    // floor at x = 380; the veladora is taken on step 487, 4 steps before, in the air at (386, 493), and uses itself up: the lives stay 7 on every step (GDD-LIFE-03).
    const velaAt = secret.states.findIndex(velaTaken);
    const hollow = jumpsFrom(secret, markOf(secret, SECRET_ROUTE, 'on P1'))[0]!;
    expect([hollow, velaAt, secret.states[velaAt]!.player.grounded, px(secret.states[velaAt]!.player.x), px(secret.states[velaAt]!.player.y), whereIs(secret.states[markOf(secret, SECRET_ROUTE, "P1's lip: held jump back, in the hollow") - 1]!)]).toEqual([
      { off: 566.6, down: 380 },
      487,
      false,
      386,
      493,
      'hollow',
    ]);
    expect([secret.end.lives.lives, secret.states.slice(0, velaAt).some(velaTaken)]).toEqual([7, false]);
    expect(route(secret, SECRET_ROUTE)).toEqual({
      'in C1': 34,
      'C1 at its buffer': 283,
      'on P1': 305,
      "P1's lip: held jump back, in the hollow": 491,
      'off the hollow, on the shelf': 531,
      "stopped short of MP0's lift": 564,
      'MP0 at its foot, stepped on': 846,
      'on P1 again': 1087,
      'K1 woken, the jump back onto the perch': 1214,
      "K1's cart stopped at its buffer": 1310,
      "over T1's wall": 1484,
      'the first ofrenda': 1495,
      'in C2': 1532,
      "R3's post: held jump, on L1": 1773,
      'the Armadillo read (heading right, between 1776 and 1856)': 1948,
      'the spring and MP1, on P3': 2218,
      'the Armadillo jumped': 2359,
      'the glide on foot, on P4': 2527,
      "over P4's wall": 2562,
      'in C3': 2612,
      'C3 at its buffer on Q': 2721,
      'stopped on the pier': 2830,
      "K2's cart jumped": 2951,
      'on P5': 3027,
      'K3 woken': 3093,
      "K3's cart jumped": 3245,
      "stopped short of MP2's lift": 3357,
      'the lift at its foot, stepped on': 3438,
      'on A': 3655,
      'the stairs, in C4': 3766,
      "R7's post: held jump into the exit": 3902,
    });
    expect([walker.states.length, secret.states.length]).toEqual([3961, 3902]);
  });
});
