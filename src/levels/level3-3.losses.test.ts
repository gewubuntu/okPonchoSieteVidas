import { describe, expect, it } from 'vitest';
import { HIT, TILE } from '../config/tuning';
import { stepRun, type RunState } from '../sim/run';
import { runBot, runUntil, span, tally, type Ctl } from './bots';
import {
  at as freshAt,
  bot,
  bumpUnder,
  cartOf,
  causeOf,
  clocks,
  E,
  idle,
  inCart,
  jumper,
  gapTo,
  K2_BURN_GAP,
  L,
  last,
  LOSS_K2_RUN,
  LOSS_K3_WALK,
  LOSS_PLANK_STOP,
  LOSS_R3_PLAIN,
  LOSS_R3_STAY,
  LOSS_VULTURE_STAND,
  middleOf,
  outcomeOf,
  PIER_COL,
  runStopAt,
  playLoss,
  POWER,
  POWER_TO_CHILE,
  POWER_TO_P4_WALL,
  RIDE_TEN,
  right,
  startAt,
  telegraphed,
  Y,
  zopilote,
  untilLost,
  type LossRun,
} from './level3-3.drive';
import { LEVEL_3_3_PITS } from './level3-3';

// GDD-WLD-18, phase B2c: 3-3's first-time losses (the GDD's "Where a first-time player loses a life") and the power run (the taco, the chile, K2 burned
// from the pier, K3's hit taken by the power), over the real level from the start with every enemy, lift and cart at the start clock they are stood at
// (`startAt`, L-014). The level is registered after 3-2 (`src/levels/index.ts`). A loss bot plays the careful route up to the place, makes the mistake until a life is lost, then plays the
// careful route from the ofrenda he respawns at to the exit; every enemy, cart, plank and lift is at its start after the respawn (GDD-WLD-18: "A lost life puts
// carts, planks and enemies back"), so the run after it is the same at every start clock and the sweeps pin that.

/**
 * Shares no factor with the bats' period (240), the lifts' rounds (MP0 432, MP1 192, MP2 384), the Armadillo's walk (1,058) or the Zopilote's (7,200): the 75
 * start clocks meet 75 different phases of each, not every phase of each (L-092; 249 clocks, step 29, would take three times as long).
 */
const STEP = 97;
const COUNT = clocks(7200, STEP).length;

/** Where the first life was lost and how he went on, as the tests tally it. */
const lossKey = (l: LossRun): string => {
  const b = l.bot;
  const lost = l.losses.map((x) => `${x.cause} at ${x.column}`).join(', ') || 'none';
  const back = l.respawn === null ? 'no respawn' : `respawn at ofrenda ${l.respawn.checkpoint + 1} (x ${l.respawn.x})`;
  const restored = l.restored === null ? 'no life restored' : `life restored at ofrenda ${l.restored.checkpoint + 1}`;
  return `${l.losses.length} lost (${lost}), ${back}, ${restored}, ${b.end.phase === 'clear' ? 'clear' : `no exit (${b.end.phase})`} with ${b.end.lives.lives} lives`;
};

/** What a bot that loses its one life as `lostTo` says at every one of the clocks is tallied as (test 1). */
const lostTo = (cause: string, column: number, ofrenda: number, x: number, after: number, steps: string) => ({
  tally: { [`1 lost (${cause} at ${column}), respawn at ofrenda ${ofrenda} (x ${x}), life restored at ofrenda ${ofrenda + 1}, clear with 7 lives`]: COUNT },
  after: [after],
  steps,
});

const within = (col: number, pit: { col0: number; col1: number }) => col >= pit.col0 && col <= pit.col1;

const LOSS_BOTS = {
  'R3 staying in': LOSS_R3_STAY,
  'R3 a plain jump from the post': LOSS_R3_PLAIN,
  'bridge B stopped on a plank': LOSS_PLANK_STOP,
  'bridge B run, K2 on the second span': LOSS_K2_RUN,
  "K3's cart met with no jump": LOSS_K3_WALK,
  'the vulture, standing after a plain jump under it': LOSS_VULTURE_STAND,
} as const;

describe('GDD-WLD-18 level 3-3 the first-time losses', () => {
  it(`GDD-WLD-18 3-3 the first-time losses: one life lost where the GDD names, the respawn and on to the exit, from the start at every ${STEP}th clock (step ${STEP}, ${COUNT} clocks)`, () => {
    const out: Record<string, { tally: Record<string, number>; after: number[]; steps: string; telegraphed?: Record<string, number> }> = {};
    for (const [name, make] of Object.entries(LOSS_BOTS)) {
      const o = { tally: {} as Record<string, number>, after: [] as number[], steps: '', telegraphed: {} as Record<string, number> };
      const steps: number[] = [];
      for (const t of clocks(7200, STEP)) {
        const l = playLoss(make(), startAt(t));
        tally(o.tally, lossKey(l));
        if (l.respawn !== null && !o.after.includes(l.bot.states.length - l.respawn.step)) o.after.push(l.bot.states.length - l.respawn.step);
        steps.push(l.bot.states.length);
        if (make === LOSS_VULTURE_STAND) {
          // The vulture's own take: did it telegraph while he stood under it (from K3's cart jumped to the loss, or to the end of the stand)?
          const from = l.bot.marks[20]!;
          const to = l.losses[0]?.step ?? l.bot.states.length;
          tally(o.telegraphed, `${l.losses.length === 0 ? 'kept' : 'lost'}, vulture ${telegraphed(l.bot.states.slice(from, to + 1)) ? 'telegraphed' : 'did not telegraph'}`);
        }
      }
      o.steps = span(steps);
      if (make !== LOSS_VULTURE_STAND) delete (o as { telegraphed?: unknown }).telegraphed;
      out[name] = o;
    }
    // GDD-WLD-18's "Where a first-time player loses a life", each bot over every start clock driven: R3's end by staying in or by a jump not held takes one life to the
    // chasm (no enemy; the chasm is columns 89 to 98) and the retry is from the first ofrenda; bridge B by stopping on a plank (column 161, no enemy: the plank
    // falls under him) or by running across (K2, on the second span, columns 168 to 175) and K3's cart without a jump (at x = 3069, column 191) take one
    // from the second ofrenda's. Every one of them clears the level with 7 lives: the life comes back at the next ofrenda reached for the first time (GDD-LIFE-03:
    // at the second for the R3 bots, at the third for the others), and the steps from the respawn to the clear are one number for each bot at every clock, so a
    // respawn puts everything back.
    expect(out).toEqual({
      'R3 staying in': lostTo('no enemy', 95, 1, 1048, 2751, '3684 to 3684'),
      'R3 a plain jump from the post': lostTo('no enemy', 95, 1, 1048, 2751, '3684 to 3684'),
      'bridge B stopped on a plank': lostTo('no enemy', 161, 2, 2088, 1599, '3300 to 4281'),
      'bridge B run, K2 on the second span': lostTo('K2', 172, 2, 2088, 1599, '3340 to 4321'),
      "K3's cart met with no jump": lostTo('K3', 191, 2, 2088, 1599, '3622 to 4603'),
      // The vulture is a tally, not "every": the GDD's figure is over other take-offs and clocks. Here it took the life at 23 of the 75 clocks, at each of them having
      // telegraphed during the plain jump he stood under, and at the other 52 never did; the 52 walk on to MP2 with every life.
      'the vulture, standing after a plain jump under it': {
        tally: {
          '0 lost (none), no respawn, no life restored, clear with 7 lives': 52,
          '1 lost (Zopilote at 190), respawn at ofrenda 2 (x 2088), life restored at ofrenda 3, clear with 7 lives': 23,
        },
        after: [1599],
        steps: '3304 to 4826',
        telegraphed: { 'kept, vulture did not telegraph': 52, 'lost, vulture telegraphed': 23 },
      },
    });
  }, 300_000);
});

const px = (n: number) => Math.round(n * 10) / 10;
/** K2 awake: its ringtail has seen him (its first flash). */
const wake = (r: RunState) => r.enemies[E.K2]!.ride!.phase !== 'waiting';
/** On the stone pier (GDD-WLD-18's column 167): grounded on row 25 with his middle over it. */
const onPier = (r: RunState) => r.player.grounded && r.player.y === Y(25) && r.player.x >= PIER_COL * TILE && r.player.x < (PIER_COL + 1) * TILE;
/** The first index of `states` at or after `from` where `when` holds, or -1. */
const firstAt = (states: readonly RunState[], when: (r: RunState, i: number) => boolean, from = 0) => states.findIndex((r, i) => i >= from && when(r, i));
/** The sweep's presses (every `step`th from `k0`) that ended alike, in order: "k0 to k1 what". */
function windowsOf(ks: readonly number[], tags: readonly string[]): string[] {
  const out: string[] = [];
  let from = 0;
  for (let i = 1; i <= tags.length; i++) {
    if (i < tags.length && tags[i] === tags[from]) continue;
    out.push(`${ks[from]} to ${ks[i - 1]} ${tags[from]}`);
    from = i;
  }
  return out;
}

/** K2's cart in run `r`. */
const cart = (r: RunState) => r.carts[cartOf('R5')]!;

/** The power run's state at Q: the taco and the chile taken, C3 stopped at its buffer, Poncho in it in Fuego (the start of the sweep of the presses). */
const atQ = (t: number): RunState => bot([...POWER_TO_CHILE(), ...RIDE_TEN().slice(0, 2)], startAt(t), 8000, false).end;

/**
 * The pier with a press of the Fuego button `k` steps after K2's first flash (age 0 is the first state in which its ringtail is awake): right held from Q to the
 * pier and stand, no jump, nothing else. The press is added to whatever he is doing on that step (running over the planks, or standing on the pier).
 */
function burnAt(k: number): Ctl[] {
  let flash = -1;
  const press = (task: Ctl): Ctl => (r) => {
    if (flash < 0 && wake(r)) flash = r.clock;
    const out = task(r);
    return !out.done && flash >= 0 && r.clock - flash === k ? { input: { ...out.input, fuego: true }, done: false } : out;
  };
  return [press(runStopAt(PIER_COL * TILE)), press(() => ({ input: idle, done: false }))];
}

describe('GDD-WLD-18 level 3-3 the fireball from the pier', () => {
  it('GDD-WLD-18 3-3 the fireball from the pier: the presses that burn K2', () => {
    // GDD-WLD-18: "burns it from afar with the chile". From Q (the chile taken, Fuego) he runs onto the pier and stands, and presses Fuego once, k steps after K2's
    // first flash (every 4th k from 0 to 100), at three start clocks. A press that defeats the ringtail does it by the fireball: he stands on the pier (or runs over
    // the planks before it), never stomps (`stomped` false on the step, grounded) and no claw swings. A press too late finds K2 on him: the hit is the power's.
    const sweeps: Record<number, string[]> = {};
    const defeats: Record<number, number[]> = {};
    for (const t of [0, 1801, 4003]) {
      const q = atQ(t);
      const ks = Array.from({ length: 26 }, (_, i) => i * 4);
      const tags: string[] = [];
      const offsets: number[] = [];
      for (const k of ks) {
        const b = runBot(burnAt(k), q, L, 260, false);
        const w = firstAt(b.states, wake);
        const d = firstAt(b.states, (r) => !r.enemies[E.K2]!.alive);
        const hit = firstAt(b.states, (r, i) => i > 0 && r.power !== b.states[i - 1]!.power);
        // The step the press was made on is the one from the state at age k: its fireball is in the state after (or used at once, on a ringtail at his front).
        const from = onPier(b.states[w + k]!) ? 'from the pier' : 'from the planks';
        expect(b.states.some((r) => r.lives.lives < 7)).toBe(false);
        if (d >= 0) {
          const at = b.states[d]!;
          expect([d > w + k, at.stomped, at.claw.phase, at.player.grounded, b.states.every((r) => r.power === 'fuego')]).toEqual([true, false, 'idle', true, true]);
          tags.push(`defeated ${from}`);
          offsets.push(d - w);
        } else tags.push(`alive ${from}, the power took the hit (${b.states[hit]!.power}) ${hit - w} steps after the flash`);
      }
      sweeps[t] = windowsOf(ks, tags);
      defeats[t] = offsets;
    }
    // GDD-WLD-18: "its cart then rolls on to Q and stays there". Burned (the press at k = 40), the ringtail's empty cart still rolls left at him: it goes through
    // him as he stands on the pier (a rolling cart is a one-way floor, with nobody in it it hurts him no more than a floor does), he never boards it, loses no life
    // and keeps the power, and it parks at its buffer on Q.
    const q = atQ(0);
    const after = runBot(burnAt(40), q, L, 420, false);
    const w = firstAt(after.states, wake);
    const stopped = firstAt(after.states, (r) => cart(r).phase === 'stopped');
    const him = after.states[w]!.player.x;
    const empty = {
      lives: after.states.map((r) => r.lives.lives).filter((n, i, all) => all.indexOf(n) === i),
      powers: after.states.map((r) => r.power).filter((n, i, all) => all.indexOf(n) === i),
      boarded: after.states.some((r) => inCart(r, 'R5')),
      still: after.states.slice(w + 90).every((r) => r.player.x === after.states[w + 90]!.player.x && r.player.y === Y(25)),
      throughHim: after.states.some((r, i) => i > 0 && middleOf(after.states[i - 1]!, 'R5') > him && middleOf(r, 'R5') <= him),
      endsAs: cart(last(after.states)).phase,
      phases: after.states.map((r) => cart(r).phase).filter((n, i, all) => all.indexOf(n) === i),
      stoppedAfterFlash: stopped - w,
      parkedAt: px(middleOf(after.states[stopped]!, 'R5')),
    };
    // Measured at every one of the three start clocks alike (K2 and the pier are the same at every clock): a press from the first flash to 8 steps after it is spat
    // from the planks he is still running over, one from 12 to 88 from the pier, and each defeats the ringtail, at the step the fireball reaches it (46 to 89 steps
    // after the flash); K2 is at his front (the cart's front at 0 px, 88 steps after the flash) at the last of them, which defeats it at once; from 92 on K2 is on
    // him first and the hit is the power's (Fuego to Taco), 92 steps after the flash. So the chile burns it from afar, from its first flash on to a ringtail at his front.
    const window = ['0 to 8 defeated from the planks', '12 to 88 defeated from the pier', '92 to 100 alive from the pier, the power took the hit (taco) 92 steps after the flash'];
    expect(sweeps).toEqual({ 0: window, 1801: window, 4003: window });
    const offsets = [46, 47, 48, 49, 50, 52, 54, 58, 59, 61, 63, 65, 67, 70, 72, 74, 76, 78, 82, 83, 85, 87, 89];
    expect(defeats).toEqual({ 0: offsets, 1801: offsets, 4003: offsets });
    expect(empty).toEqual({ lives: [7], powers: ['fuego'], boarded: false, still: true, throughHim: true, endsAs: 'stopped', phases: ['waiting', 'rolling', 'stopped'], stoppedAfterFlash: 151, parkedAt: 2544 });
  }, 60_000);
});

/** The steps on which his power went from `from` to `to`. */
const changes = (states: readonly RunState[], from: RunState['power'], to: RunState['power']) =>
  states.flatMap((r, i) => (i > 0 && states[i - 1]!.power === from && r.power === to ? [i] : []));
/** The powers he was in, in order, each once. */
const powersOf = (states: readonly RunState[]) => states.map((r) => r.power).filter((p, i, all) => i === 0 || p !== all[i - 1]);

describe('GDD-WLD-18 level 3-3 the power run', () => {
  it(`GDD-WLD-18 3-3 the power run: the taco, the chile, K2 burned and K3's hit taken by the power, from the start at every ${STEP}th clock`, () => {
    const out: Record<string, number> = {};
    const seen = { powers: new Set<string>(), lives: new Set<number>(), open: new Set<string>(), k2: new Set<string>(), hit: new Set<string>(), steps: [] as number[], checkpoints: new Set<number>(), };
    for (const t of clocks(7200, STEP)) {
      const b = bot(POWER(), startAt(t), 8000, false);
      tally(out, outcomeOf(b));
      seen.powers.add(powersOf(b.states).join(' > '));
      seen.lives.add(b.states.every((r) => r.lives.lives === 7 && r.phase !== 'respawning') ? 7 : 0);
      seen.open.add(b.end.pinatasOpen.join(' '));
      const d = firstAt(b.states, (r) => !r.enemies[E.K2]!.alive);
      seen.k2.add(`${b.end.enemies[E.K2]!.alive ? 'alive' : 'defeated'}, ${d >= 0 && !b.states[d]!.stomped && b.states[d]!.player.grounded && b.states[d]!.claw.phase === 'idle' ? 'by a fireball' : 'otherwise'}`);
      const hit = changes(b.states, 'fuego', 'taco');
      seen.hit.add(hit.length === 1 ? `once, at column ${Math.floor(b.states[hit[0]!]!.player.x / TILE)}, ${b.states[hit[0]!]!.invulnerable} steps invulnerable` : `${hit.length} times`);
      seen.checkpoints.add(b.end.checkpointIndex);
      seen.steps.push(b.states.length);
    }
    // The plan's stop conditions: every clock clears with every life, which is what the taco's and the chile's reach, the burn and the walk on past K3 and the
    // vulture during the hit's 120 steps of invulnerability come to. Over the 75 clocks, each run has the same shape: the power goes Base, Taco (the first piñata),
    // Fuego (the second), Taco (K3's cart, the one hit of the run, at column 191 with 120 steps of invulnerability after it, and never a life), both piñatas are open,
    // K2's ringtail is defeated, by a fireball (on the ground, no stomp, no claw), and he reaches all three ofrendas.
    expect(out).toEqual({ 'exit, 0 lost': COUNT });
    expect({ ...seen, steps: span(seen.steps), powers: [...seen.powers], open: [...seen.open], lives: [...seen.lives], k2: [...seen.k2], hit: [...seen.hit], checkpoints: [...seen.checkpoints] }).toEqual({
      powers: ['base > taco > fuego > taco'],
      lives: [7],
      open: ['true true'],
      k2: ['defeated, by a fireball'],
      hit: ['once, at column 191, 120 steps invulnerable'],
      steps: '2750 to 3878',
      checkpoints: [2],
    });
  }, 300_000);
});

/** One loss bot's run, as test 4 pins it: its losing step and column, where it respawned, its clear and its marks. */
function describeLoss(l: LossRun) {
  const b = l.bot;
  return {
    lost: l.losses.map((x) => `step ${x.step}: ${x.cause} at column ${x.column}, x ${px(b.states[x.step - 1]!.player.x)}`),
    respawn: l.respawn ? `step ${l.respawn.step}, x ${l.respawn.x}, ofrenda ${l.respawn.checkpoint + 1}` : 'none',
    restored: l.restored ? `step ${l.restored.step}, at ofrenda ${l.restored.checkpoint + 1}` : 'none',
    steps: b.states.length,
    after: l.respawn ? b.states.length - l.respawn.step : null,
    lives: b.end.lives.lives,
    marks: b.marks.join(','),
  };
}

describe('GDD-WLD-18 level 3-3 the loss bots and the power run at the start clock 0', () => {
  it('GDD-WLD-18 3-3 the loss bots and the power run at the start clock 0, step by step', () => {
    const runs: Record<string, LossRun> = {};
    for (const [name, make] of Object.entries(LOSS_BOTS)) runs[name] = playLoss(make(), startAt(0));
    const row = (name: keyof typeof LOSS_BOTS) => describeLoss(runs[name]!);
    const columnOf = (name: keyof typeof LOSS_BOTS) => runs[name]!.losses[0]!.column;
    // GDD-WLD-18's places, from the level's data: R3's end is over the chasm (89 to 98), the stopped-on plank is on bridge B's first span (160 to 166) and K2 meets
    // him on the second (168 to 175).
    expect([
      within(columnOf('R3 staying in'), LEVEL_3_3_PITS.chasm),
      within(columnOf('R3 a plain jump from the post'), LEVEL_3_3_PITS.chasm),
      within(columnOf('bridge B stopped on a plank'), LEVEL_3_3_PITS.bridgeB1),
      within(columnOf('bridge B run, K2 on the second span'), LEVEL_3_3_PITS.bridgeB2),
    ]).toEqual([true, true, true, true]);
    // The loss bots at clock 0, each clearing with 7 lives: the step the life went and what took it (GDD-WLD-18's "Where a first-time player loses a life"), the
    // respawn 48 steps later (RESPAWN's 0.8 s) at the ofrenda the careful route had reached (x 1048 is the first, column 65; x 2088 the second, column 130), the
    // life back at the next ofrenda reached for the first time (GDD-LIFE-03), and the steps from the respawn to the clear, one number for all clocks (test 1).
    // R3's end (columns 89 to 98 are the chasm): at x = 1528, column 95. Bridge B: on its second plank, column 161, the K2 run at x = 2765 on the second span (168
    // to 175), K3's cart at x = 3069 (GDD-WLD-18: "at x = 3069").
    const r3 = 'step 885: no enemy at column 95, x 1528.2';
    const r3Run = { respawn: 'step 933, x 1048, ofrenda 1', restored: 'step 2279, at ofrenda 2', steps: 3684, after: 2751, lives: 7, marks: '34,283,305,383,479,653,664,701,934,967,1208,1824,2000,2122,2309,2344,2394,2503,2612,2733,2809,2875,3027,3139,3220,3437,3548' };
    expect(row('R3 staying in')).toEqual({ lost: [r3], ...r3Run });
    expect(row('R3 a plain jump from the post')).toEqual({ lost: [r3], ...r3Run });
    expect(row('bridge B stopped on a plank')).toEqual({
      lost: ['step 1676: no enemy at column 161, x 2584.2'],
      respawn: 'step 1724, x 2088, ofrenda 2',
      restored: 'step 3080, at ofrenda 3',
      steps: 3323,
      after: 1599,
      lives: 7,
      marks: '34,283,305,383,479,653,664,701,942,942,1066,1188,1375,1410,1460,1569,1725,1764,1814,1923,2032,2153,2229,2295,2447,2559,2859,3076,3187',
    });
    expect(row('bridge B run, K2 on the second span')).toEqual({
      lost: ['step 1716: K2 at column 172, x 2765'],
      respawn: 'step 1764, x 2088, ofrenda 2',
      restored: 'step 3120, at ofrenda 3',
      steps: 3363,
      after: 1599,
      lives: 7,
      marks: '34,283,305,383,479,653,664,701,942,942,1066,1188,1375,1410,1460,1569,1765,1804,1854,1963,2072,2193,2269,2335,2487,2599,2899,3116,3227',
    });
    expect(row("K3's cart met with no jump")).toEqual({
      lost: ["step 1998: K3 at column 191, x 3069.2"],
      respawn: 'step 2046, x 2088, ofrenda 2',
      restored: 'step 3402, at ofrenda 3',
      steps: 3645,
      after: 1599,
      lives: 7,
      marks: '34,283,305,383,479,653,664,701,942,942,1066,1188,1375,1410,1460,1569,1678,1799,1875,2047,2086,2136,2245,2354,2475,2551,2617,2769,2881,3181,3398,3509',
    });
    // R3: staying in and a plain jump from the post end alike, in the cart's fall at the same step; the plain jump is taken (in the air 111 steps after the hop, back
    // in the cart 144 steps after it: "A jump not held from the post comes back down in the cart"), staying in never leaves the cart before its fall (148).
    const rode = (l: LossRun) => {
      const st = l.bot.states.slice(l.bot.marks[7], l.losses[0]!.step);
      const air = firstAt(st, (r) => !r.player.grounded);
      return { airborneAfter: air, backInCartAfter: firstAt(st, (r, i) => i > air && r.player.grounded && inCart(r, 'R3')) };
    };
    expect([rode(runs['R3 staying in']!), rode(runs['R3 a plain jump from the post']!)]).toEqual([
      { airborneAfter: 148, backInCartAfter: -1 },
      { airborneAfter: 111, backInCartAfter: 144 },
    ]);
    // Bridge B, stopped on a plank: right held to x = 2576 (column 161's left edge) and nothing after, he comes to rest at x = 2584.2 on the second plank at step 1629,
    // and that plank is warned at 1618 (the step he lands on it) and gone at 1648 (GDD-WLD-05: 30 steps after he lands), the loss 28 steps later.
    const plank = L.crumbles.findIndex((c) => c.col === 161 && c.row === 25);
    const pb = runs['bridge B stopped on a plank']!.bot;
    const rest = firstAt(pb.states, (r) => r.player.grounded && r.player.vx === 0 && r.player.x > 2570, pb.marks[15]);
    expect({
      rest: [rest, px(pb.states[rest]!.player.x), Math.floor(pb.states[rest]!.player.x / TILE)],
      warning: firstAt(pb.states, (r) => r.crumbles[plank]!.phase === 'warning'),
      gone: firstAt(pb.states, (r) => r.crumbles[plank]!.phase === 'gone'),
    }).toEqual({ rest: [1629, 2584.2, 161], warning: 1618, gone: 1648 });
    // The vulture: K3's cart jumped (done at step 2093 at clock 0), the walk to under its middle, a plain jump with right let go (in the air at 2129, down at 2162 at
    // x = 3045.1, under its line 2976 to 3072), standing 600 steps; at clock 0 the vulture never telegraphs and he walks on with every life; at clock 194 it
    // telegraphs 27 steps into the jump (3114) and takes the life at step 3179, a second after he lands, at column 190 (x 3045.1).
    const vulture = (t: number) => {
      const l = playLoss(LOSS_VULTURE_STAND(), startAt(t));
      const v = l.bot.states;
      const from = l.bot.marks[20]!;
      const up = firstAt(v, (r) => !r.player.grounded, from);
      const down = firstAt(v, (r, i) => i > up && r.player.grounded);
      // He stands from the landing until the walk on starts (right held: his speed over 0 after he was at rest).
      const still = firstAt(v, (r) => r.player.grounded && r.player.vx === 0, down);
      const walks = firstAt(v, (r) => r.player.vx > 0, still);
      return { ...describeLoss(l), from, up, down, landedAt: px(v[down]!.player.x), standsFor: l.losses.length > 0 ? null : walks - still, telegraph: firstAt(v, (r) => zopilote(r).flight!.phase === 'telegraph', from) };
    };
    expect(vulture(0)).toEqual({
      lost: [],
      respawn: 'none',
      restored: 'none',
      steps: 3518,
      after: null,
      lives: 7,
      marks: '34,283,305,383,479,653,664,701,942,942,1066,1188,1375,1410,1460,1569,1678,1799,1875,1941,2093',
      from: 2093,
      up: 2129,
      down: 2162,
      landedAt: 3045.1,
      standsFor: 601,
      telegraph: -1,
    });
    expect(vulture(194)).toEqual({
      lost: ['step 3179: Zopilote at column 190, x 3045.1'],
      respawn: 'step 3227, x 2088, ofrenda 2',
      restored: 'step 4583, at ofrenda 3',
      steps: 4826,
      after: 1599,
      lives: 7,
      marks: '34,283,305,383,479,653,664,701,942,1754,2024,2165,2333,2368,2418,2527,2636,2757,2833,2899,3051',
      from: 3051,
      up: 3087,
      down: 3120,
      landedAt: 3045.1,
      standsFor: null,
      telegraph: 3114,
    });
    // The cause is read on the step's own input: right held from x = 3133, 3 px short of K3's waiting cart (it telegraphs for 30 steps first), puts him into it on
    // the step after he is at x = 3138.44, which is K3's; with nothing held on that step he would not touch it, and `causeOf` would name every enemy still alive.
    const walkIn = playLoss([untilLost(runUntil(1, () => false))], freshAt(3133, Y(25), 0), 300);
    expect(walkIn.losses).toEqual([{ step: 7, cause: 'K3', column: 196 }]);
    // The power run at clock 0. The taco: the first piñata (column 64) opened by a plain jump on step 663 with his head at its underside (y = 432, his feet), the
    // taco on its top at (1032, 384); it walks off the edge onto T1 and he takes it on step 694 as it falls past his front, at (1052, 415) over his x = 1060.9
    // (power Taco). The chile: the second piñata (column 134) opened on step 1420, the chile at (2152, 336) on its top, taken on step 1621 in the air at the top of a
    // plain jump from the wall's top, over the piñata (his feet at y = 327.5). K2: its first flash on step 1841; Fuego pressed 40 steps after it from the pier (the
    // fireball is in the air on step 1881, he is on the pier at (2680.2, 400)), K2 defeated on step 1904, 63 steps after the flash, by that fireball (he is on
    // the ground, no stomp). K3: the hit on step 2181 at x = 3071.2, in Fuego: the power goes to Taco, 120 steps of invulnerability, and with the power off (the same
    // step on a Base copy) it is K3 that takes the life. He walks on, and the 120 steps end at x = 3190.4, past the vulture's sight (to 3168), where it only cruised.
    const pw = bot(POWER(), startAt(0), 8000, false);
    const ps = pw.states;
    const at = (i: number) => ({ step: i, x: px(ps[i]!.player.x), y: px(ps[i]!.player.y), grounded: ps[i]!.player.grounded });
    const item = (i: number) => (ps[i]!.items[0] ? { x: px(ps[i]!.items[0].x), y: px(ps[i]!.items[0].y), kind: ps[i]!.items[0].kind } : null);
    const open1 = firstAt(ps, (r) => r.pinatasOpen[0]!);
    const open2 = firstAt(ps, (r) => r.pinatasOpen[1]!);
    const tacoAt = firstAt(ps, (r) => r.power === 'taco');
    const chileAt = firstAt(ps, (r) => r.power === 'fuego');
    const spat = firstAt(ps, (r) => r.fireballs.length > 0);
    const k2At = firstAt(ps, (r) => !r.enemies[E.K2]!.alive);
    const hitAt = changes(ps, 'fuego', 'taco')[0]!;
    expect({
      outcome: outcomeOf(pw),
      steps: ps.length,
      taco: { opened: at(open1), released: item(open1), taken: at(tacoAt), itemBefore: item(tacoAt - 1) },
      chile: { opened: at(open2), released: item(open2), taken: at(chileAt), itemBefore: item(chileAt - 1) },
      fireball: { spat: at(spat - 1), onPier: onPier(ps[spat - 1]!), gap: px(gapTo(ps[spat - 1]!, 'R5')), k2Defeated: { ...at(k2At), stomped: ps[k2At]!.stomped, fireballBefore: ps[k2At - 1]!.fireballs.length }, flash: firstAt(ps, wake) },
      hit: { ...at(hitAt), invulnerable: ps[hitAt]!.invulnerable, hitBase: causeOf({ ...ps[hitAt - 1]!, power: 'base' }, right), power: ps[hitAt]!.power },
      walkOn: {
        invulnerableEnds: at(hitAt + HIT.invulnerableSteps),
        telegraphed: telegraphed(ps.slice(hitAt)),
        lives: [...new Set(ps.map((r) => r.lives.lives))],
        phases: [...new Set(ps.slice(hitAt).map((r) => zopilote(r).flight!.phase))],
      },
      marks: pw.marks.join(','),
    }).toEqual({
      outcome: 'exit, 0 lost',
      steps: 2750,
      taco: { opened: { step: 663, x: 1035.7, y: 432, grounded: false }, released: { x: 1032, y: 384, kind: 'taco' }, taken: { step: 694, x: 1060.9, y: 448, grounded: true }, itemBefore: { x: 1052, y: 415.1, kind: 'taco' } },
      chile: { opened: { step: 1420, x: 2155.7, y: 384, grounded: false }, released: { x: 2152, y: 336, kind: 'chile' }, taken: { step: 1621, x: 2154.1, y: 327.5, grounded: false }, itemBefore: { x: 2152, y: 336, kind: 'chile' } },
      fireball: { spat: { step: 1881, x: 2680.2, y: 400, grounded: true }, onPier: true, gap: 118.3, k2Defeated: { step: 1904, x: 2680.2, y: 400, grounded: true, stomped: false, fireballBefore: 1 }, flash: 1841 },
      hit: { step: 2181, x: 3071.2, y: 400, grounded: true, invulnerable: 120, hitBase: 'K3', power: 'taco' },
      walkOn: { invulnerableEnds: { step: 2301, x: 3190.4, y: 400, grounded: true }, telegraphed: false, lives: [7], phases: ['cruise'] },
      marks: '34,283,305,383,479,653,673,673,695,695,727,968,968,1066,1188,1375,1410,1430,1461,1495,1520,1528,1577,1596,1624,1643,1752,1861,1883,1982,2058,2243,2286,2503,2614',
    });
    // The press is made once K2's cart rolls within the burn's gap (the cart's front to his, in px).
    expect(gapTo(ps[spat - 1]!, 'R5')).toBeLessThanOrEqual(K2_BURN_GAP);
  });
});

/** One flight from `from`: the jump `kind` with `move` held (`jumper`) or, a number, jump held for that many steps; the step the chile was taken on (power Fuego) and where he came down. */
function chileFlight(from: RunState, move: -1 | 0 | 1, kind: 'top' | 'held' | number) {
  const jump = jumper(typeof kind === 'number' ? 'top' : kind, move);
  let r = from;
  let air = false;
  let taken = -1;
  for (let i = 0; i < 120; i++) {
    const press = jump(r, i);
    r = stepRun(r, typeof kind === 'number' && i >= kind ? { ...press, jumpHeld: false } : press, L);
    if (taken < 0 && r.power === 'fuego') taken = i;
    if (!r.player.grounded) air = true;
    else if (air) break;
  }
  return { taken, x: px(r.player.x), y: r.player.y };
}

describe('GDD-WLD-18 level 3-3 the chile reach', () => {
  it("GDD-WLD-18 3-3 the chile reach: from the second piñata's wall top, and not from P4's ground", () => {
    const wall = bot(POWER_TO_CHILE().slice(0, -1), startAt(0), 8000, false).end;
    const ground = bot([...POWER_TO_P4_WALL(), bumpUnder(1)], startAt(0), 8000, false).end;
    const out: Record<string, unknown> = {};
    out['setup'] = { wall: [px(wall.player.x), wall.player.y, wall.items.map((i) => i.kind)], ground: [px(ground.player.x), ground.player.y, ground.items.map((i) => i.kind)] };
    // From the wall's top (row 23's top, y = 368), standing, a plain jump with right held, from every 2 px of the wall.
    const xs = Array.from({ length: 15 }, (_, i) => 2106 + i * 2);
    const top = xs.map((x) => chileFlight({ ...wall, player: { ...wall.player, x, y: 368, vx: 0 } }, 1, 'top'));
    out['wall top'] = windowsOf(xs, top.map((f) => (f.taken >= 0 ? 'takes the chile' : `misses, lands at (${f.x}, ${f.y})`)));
    // From P4's ground (y = 400), the chile 64 px over it: a plain and a held jump, any way held, from every 4 px under and beside the piñata.
    const gs = Array.from({ length: 21 }, (_, i) => 2096 + i * 4);
    const ways = ([-1, 0, 1] as const).flatMap((m) => (['top', 'held'] as const).map((k) => [m, k] as const));
    out['ground'] = ways.map(([m, k]) => gs.filter((x) => chileFlight({ ...ground, player: { ...ground.player, x, y: 400, vx: 0 } }, m, k).taken >= 0).length);
    // Up onto the wall from its right (his middle 6 px off the face, x = 2134): a plain jump left held overshoots it; one let go after n steps lands on it for a few n.
    const face = { ...ground, player: { ...ground.player, x: 2134, y: 400, vx: 0 } };
    out['from the right'] = { plain: chileFlight(face, -1, 'top'), cut: windowsOf(Array.from({ length: 21 }, (_, n) => n + 4), Array.from({ length: 21 }, (_, n) => { const f = chileFlight(face, -1, n + 4); return f.y === 368 ? `on the wall` : `lands at (${f.x}, ${f.y})`; })) };
    // Measured. The chile stands on the second piñata's top (y = 336) and the piñata is solid, so he reaches it only from above it: from the wall's top (y = 368) a
    // plain jump with right held from a stand takes it from every take-off from 2106 (the wall's left edge, his box 6 px over it) to 2122, and one from 2124 on flies
    // over it and comes down in C3's cart (2208, 392). From P4's ground (the chile 64 px up) no jump of 21 take-offs in 4 px steps, plain or held, left, right or
    // nothing held, takes it. A plain jump from the right of the wall (x = 2134) overshoots the wall and comes down on P4 at x = 2090; only one let go after 5 to 12
    // steps lands on the wall top (the route does not use it: it goes back over the wall and climbs it from the left at a run).
    expect(out).toEqual({
      setup: { wall: [2113.5, 368, ['chile']], ground: [2173.7, 400, ['chile']] },
      'wall top': ['2106 to 2122 takes the chile', '2124 to 2134 misses, lands at (2208, 392)'],
      ground: [0, 0, 0, 0, 0, 0],
      'from the right': {
        plain: { taken: -1, x: 2090, y: 400 },
        cut: ['4 to 4 lands at (2134, 400)', '5 to 12 on the wall', '13 to 13 lands at (2096, 400)', '14 to 15 lands at (2094, 400)', '16 to 17 lands at (2092, 400)', '18 to 24 lands at (2090, 400)'],
      },
    });
  });
});

