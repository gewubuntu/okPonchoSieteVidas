import { describe, expect, it } from 'vitest';
import { CART } from '../config/tuning';
import { cacomixtleRed } from './cacomixtle';
import type { CartState, Rail } from './cart';
import { enemyBox, freshEnemies, overlaps, type Enemy, type EnemyState, type Ride } from './enemy';
import { hurtbox } from './hazards';
import type { Fireball } from './fireball';
import { spawn, type PlayerInput, type PlayerState } from './movement';
import type { MovingPlatform } from './platform';
import { startRun, stepRun, type Level, type RunState } from './run';
import { parseTiles } from './tilemap';

// GDD-ENM-04: the Cacomixtle, a ringtail on its own cart. The expected numbers are the GDD's and the main session's defaults (the plan,
// `.plans/GDD-ENM-04-cacomixtle-A.md`): a 14 x 14 box on the middle of its cart's floor; it sees his hurtbox's centre ahead of it along its
// rail by more than 0 and up to 200 px, his feet within 64 px of the floor, up or down; it telegraphs 30 steps (0.5 s), flashing 4 on and 4
// off, the cart still, then the cart rolls at 150 px/s on the level and 120 uphill; at the buffer it is parked for good.
const idle: PlayerInput = { move: 0, jumpHeld: false };

/** A level rail rolling left from x = 480 on the ground at y = 192 (20 tiles, a buffer): its cart's middle starts at x = 464, its floor is at y = 184. */
const RAIL: Rail = { x: 480, y: 192, dir: -1, segments: [{ kind: 'level', tiles: 20 }], end: 'buffer' };
const FLOOR = 184;
const MID = 464;
/** The cart's middle at the buffer: 20 tiles (320 px) less half the cart, 16 px: x = 176 (`m` = 304). */
const LAST_M = 304;
/** The ringtail's place at its cart's start (the middle of the cart and its floor's y). */
const RINGTAIL: Enemy = { x: MID, y: FLOOR, kind: 'cacomixtle', rail: 0 };
/** The cart's step across on the level: 150 px/s over 60 steps. */
const LEVEL_PX = 150 / 60;
const WAITING: CartState = { phase: 'waiting', m: CART.width / 2 };
const AT_REST: Ride = { phase: 'waiting', t: 0 };

/** A still one-way platform, 400 px wide with its top at y = 152 (32 px over the cart's floor): from x = 100 to 500. */
const PERCH: MovingPlatform = { x0: 100, y0: 152, x1: 100, y1: 152, w: 400 };
/** Ground from column 26 (x 416) on only, at row 12 (y = 192) and below. */
const UNDER_THE_START = (c: number, r: number): boolean => c >= 26 && r >= 12;

interface Options {
  readonly rails?: readonly Rail[];
  readonly enemies?: readonly Enemy[];
  readonly platforms?: readonly MovingPlatform[];
  /** Which tiles are ground, of 40 x 17: by default row 12 down (y = 192), all along. */
  readonly solid?: (col: number, row: number) => boolean;
  readonly spikes?: Level['spikes'];
}

const levelOf = (o: Options = {}): Level => ({
  world: parseTiles(Array.from({ length: 17 }, (_, r) => Array.from({ length: 40 }, (_c, c) => ((o.solid ?? ((_col, row) => row >= 12))(c, r) ? '#' : '.')).join(''))),
  spawn: { x: 24, y: 192 },
  ofrendas: [],
  spikes: o.spikes ?? [],
  crumbles: [],
  springs: [],
  platforms: o.platforms ?? [],
  tacos: [],
  pinatas: [],
  doors: [],
  keys: [],
  fragiles: [],
  enemies: o.enemies ?? [RINGTAIL],
  rails: o.rails ?? [RAIL],
  abilities: { glide: false, wallCling: false },
});

const standing = (x: number, y: number, facing: 1 | -1 = 1): PlayerState => ({ ...spawn(x, y), facing });
const falling = (x: number, y: number, vy: number): PlayerState => ({ ...spawn(x, y), grounded: false, vy });

/** A run with Poncho put down at `player`, the first ringtail's ride and the carts as given (the others fresh). */
function ready(level: Level, player: PlayerState, o: { ride?: Ride; cart?: CartState; extra?: Partial<RunState> } = {}): RunState {
  const r = startRun(level);
  return {
    ...r,
    player,
    enemies: r.enemies.map((e, i) => (i === 0 && o.ride ? { ...e, ride: o.ride } : e)),
    carts: r.carts.map((c, i) => (i === 0 && o.cart ? o.cart : c)),
    ...o.extra,
  };
}

const play = (level: Level, r: RunState, n: number, input: PlayerInput = idle): RunState => {
  for (let i = 0; i < n; i++) r = stepRun(r, input, level);
  return r;
};
/** The first ringtail's ride. */
const rideOf = (r: RunState): Ride => r.enemies[0]!.ride!;
const cartOf = (r: RunState, i = 0): CartState => r.carts[i]!;
/** A step, then the same run with Poncho put down far behind it, on the ground at x = 600 (the cart rolls the other way). */
const away = (r: RunState): RunState => ({ ...r, player: standing(600, 192), fantasma: 0 });

/** The climbing rail's ground m px across from its start, from the segments (6 tiles level, 2 climbing 32 px, then level). */
const climbGround = (m: number): number => (m < 96 ? 192 : m < 128 ? 192 - (m - 96) : 160);
/** The step's move across at the speed of the segment the middle was in at its start: 150 px/s level, 120 px/s along the climb (a 45 degree slope: over sqrt 2). */
const climbSpeed = (m: number): number => (m >= 96 && m < 128 ? 120 / Math.SQRT2 / 60 : 150 / 60);

/** A ringtail's state at its start with the ride given. */
const rideAt = (t: number, phase: Ride['phase'] = 'telegraph'): EnemyState => ({ x: MID, dir: 1, alive: true, ride: { phase, t } });

/** Poncho on `PERCH` at x, 32 px over the cart's floor; the cart's middle starts at x = 464, so he is 464 - x ahead of it. */
const onPerch = (x: number): PlayerState => standing(x, 152);

/** Poncho on a still platform at feet y `top` (the floor is at y = 184); does the ringtail ever start in 120 steps? */
const wakes = (top: number): boolean => {
  const level = levelOf({ solid: UNDER_THE_START, platforms: [{ x0: 364, y0: top, x1: 364, y1: top, w: 32 }] });
  let r = ready(level, standing(380, top));
  let ever = false;
  for (let i = 0; i < 120; i++) {
    r = stepRun(r, idle, level);
    ever ||= rideOf(r).phase !== 'waiting';
    expect(r.lives.lives).toBe(7);
    expect(r.player.y).toBe(top);
  }
  return ever;
};

describe('GDD-ENM-04 cacomixtle', () => {
  it('GDD-ENM-04 cacomixtle waits while he is behind it', () => {
    // Poncho stands on the ground 20 px behind the ringtail (it rolls left; he is at x = 484, ahead = -20).
    const level = levelOf();
    const r = play(level, ready(level, standing(484, 192)), 600);
    expect(r.lives.lives).toBe(7);
    expect(cartOf(r)).toEqual({ phase: 'waiting', m: 16 });
    expect(rideOf(r)).toEqual({ phase: 'waiting', t: 0 });
    expect(r.enemies[0]).toMatchObject({ alive: true, x: MID, y: FLOOR });
    // It starts with the ringtail in its cart at its place, alive, waiting.
    expect(freshEnemies([RINGTAIL])).toEqual([{ x: 464, dir: 1, alive: true, ride: { phase: 'waiting', t: 0 } }]);
    expect(enemyBox(RINGTAIL, freshEnemies([RINGTAIL])[0]!)).toEqual({ x0: 457, x1: 471, y0: 170, y1: 184 });
  });

  it('GDD-ENM-04 cacomixtle sight ahead edges: 200 px starts it, 201 px and 0 px never do, 1 px does', () => {
    const level = levelOf({ platforms: [PERCH] });
    /** Does standing on the perch with his hurtbox's centre `ahead` px ahead of the ringtail start the telegraph on the first step, or ever in 120? */
    const start = (ahead: number): { first: boolean; ever: boolean } => {
      let r = ready(level, onPerch(MID - ahead));
      let first = false;
      let ever = false;
      for (let i = 0; i < 120; i++) {
        r = stepRun(r, idle, level);
        if (i === 0) first = rideOf(r).phase === 'telegraph' && rideOf(r).t === 1;
        ever ||= rideOf(r).phase !== 'waiting';
        expect(r.lives.lives).toBe(7);
        expect(r.player.y).toBe(152);
      }
      return { first, ever };
    };
    expect(start(200)).toEqual({ first: true, ever: true });
    expect(start(201)).toEqual({ first: false, ever: false });
    expect(start(0)).toEqual({ first: false, ever: false });
    expect(start(1)).toEqual({ first: true, ever: true });
    // Behind it by 1 px: never.
    expect(start(-1)).toEqual({ first: false, ever: false });
  });

  it('GDD-ENM-04 cacomixtle sight height edges: his feet 64 px over or under the floor start it, 65 px never do', () => {
    // Ground only under the rail's start (`UNDER_THE_START`) so a perch can stand low as well as high, 84 px ahead of it (x 364 to 396).
    expect([wakes(120), wakes(119)]).toEqual([true, false]);
    expect([wakes(248), wakes(249)]).toEqual([true, false]);
  });

  it('GDD-ENM-04 cacomixtle telegraph lasts 30 steps with the cart still, then the cart rolls from the step after', () => {
    // Poncho on the perch, exactly 200 px ahead: the first step starts it.
    const level = levelOf({ platforms: [PERCH] });
    let r = ready(level, onPerch(MID - 200));
    for (let n = 1; n <= 30; n++) {
      r = stepRun(r, idle, level);
      expect(rideOf(r)).toEqual({ phase: 'telegraph', t: n });
      expect(cartOf(r).m).toBe(16);
      // The cart rolls at the end of step 30, not before.
      expect(cartOf(r).phase).toBe(n < 30 ? 'waiting' : 'rolling');
    }
    // Step 31 is the first it moves: 150 px/s is 2.5 px a step.
    r = stepRun(r, idle, level);
    expect(rideOf(r)).toEqual({ phase: 'riding', t: 0 });
    expect(cartOf(r)).toEqual({ phase: 'rolling', m: 16 + LEVEL_PX });
    r = stepRun(r, idle, level);
    expect(cartOf(r).m).toBeCloseTo(16 + 2 * LEVEL_PX, 9);
    expect(r.lives.lives).toBe(7);
  });

  it('GDD-ENM-04 cacomixtle telegraph flashes 4 on and 4 off', () => {
    for (const t of [1, 2, 3, 4, 9, 10, 11, 12, 17, 18, 19, 20, 25, 26, 27, 28]) expect(cacomixtleRed(rideAt(t)), `t = ${t}`).toBe(true);
    for (const t of [5, 6, 7, 8, 13, 14, 15, 16, 21, 22, 23, 24, 29, 30]) expect(cacomixtleRed(rideAt(t)), `t = ${t}`).toBe(false);
    // Only a telegraphing one flashes.
    expect([cacomixtleRed(rideAt(0, 'waiting')), cacomixtleRed(rideAt(0, 'riding')), cacomixtleRed(rideAt(0, 'parked'))]).toEqual([false, false, false]);
  });

  it('GDD-ENM-04 cacomixtle telegraph runs on after he leaves the sight', () => {
    const level = levelOf({ platforms: [PERCH] });
    let r = ready(level, onPerch(MID - 100));
    r = play(level, r, 2);
    expect(rideOf(r)).toEqual({ phase: 'telegraph', t: 2 });
    // He is now 26 px behind it, on the ground: out of its sight for good.
    r = away({ ...r, player: standing(490, 192) });
    for (let n = 3; n <= 30; n++) {
      r = stepRun(r, idle, level);
      expect(rideOf(r)).toEqual({ phase: 'telegraph', t: n });
    }
    expect(cartOf(r)).toEqual({ phase: 'rolling', m: 16 });
    r = play(level, r, 10);
    expect(cartOf(r).phase).toBe('rolling');
    expect(cartOf(r).m).toBeCloseTo(16 + 10 * LEVEL_PX, 9);
    expect(r.lives.lives).toBe(7);
  });

  it('GDD-ENM-04 cacomixtle rides at the cart middle on its floor, over a level, a climb and a level', () => {
    // A rail rolling left: 6 tiles level (m 0 to 96), a climb of 2 tiles (m 96 to 128, rising 32 px), 8 tiles level: 16 tiles, the last middle at m = 240.
    const climbing: Rail = { x: 480, y: 192, dir: -1, segments: [{ kind: 'level', tiles: 6 }, { kind: 'climb', tiles: 2 }, { kind: 'level', tiles: 8 }], end: 'buffer' };
    const level = levelOf({ rails: [climbing], solid: (c, r) => c >= 30 && r >= 12 });
    // 29 telegraph steps are done: the next one starts the cart. He is far behind it.
    let r = ready(level, standing(600, 192), { ride: { phase: 'telegraph', t: 29 } });
    let climbSteps = 0;
    let checked = 0;
    for (let i = 0; i < 400 && cartOf(r).phase !== 'stopped'; i++) {
      const before = cartOf(r);
      r = stepRun(r, idle, level);
      const cart = cartOf(r);
      const box = enemyBox(level.enemies[0]!, r.enemies[0]!);
      // Centred on the cart's middle (x = 480 - m), 14 x 14, its feet 8 px over the rail's ground under the middle.
      expect((box.x0 + box.x1) / 2).toBeCloseTo(480 - cart.m, 9);
      expect(box.x1 - box.x0).toBeCloseTo(14, 9);
      expect(box.y1).toBeCloseTo(climbGround(cart.m) - 8, 9);
      expect(box.y1 - box.y0).toBeCloseTo(14, 9);
      if (cart.phase === 'rolling') {
        // 30 steps with the cart still, the 31st the first it moves; from then each step's move is its segment's speed.
        if (before.phase === 'rolling') expect(cart.m - before.m).toBeCloseTo(Math.min(climbSpeed(before.m), 240 - before.m), 9);
        else expect(cart.m).toBe(before.m);
        expect(rideOf(r).phase).toBe(before.phase === 'rolling' ? 'riding' : 'telegraph');
        if (before.m >= 96 && before.m < 128) climbSteps++;
      }
      checked++;
      expect(r.lives.lives).toBe(7);
    }
    expect(cartOf(r)).toEqual({ phase: 'stopped', m: 240 });
    // On the step the cart stops it is parked, on the middle of the cart at the buffer.
    expect(rideOf(r)).toEqual({ phase: 'parked', t: 0 });
    expect(enemyBox(level.enemies[0]!, r.enemies[0]!).y1).toBe(160 - 8);
    // The climb is 32 px across at 84.85 px/s: 23 steps; the ride is 224 px in all.
    expect(climbSteps).toBeGreaterThanOrEqual(22);
    expect(checked).toBeGreaterThan(80);
  });

  it('GDD-ENM-04 cacomixtle parks at the buffer for good', () => {
    const level = levelOf({ platforms: [PERCH] });
    let r = ready(level, standing(600, 192), { ride: { phase: 'telegraph', t: 29 } });
    r = play(level, r, 400);
    expect(cartOf(r)).toEqual({ phase: 'stopped', m: LAST_M });
    expect(rideOf(r)).toEqual({ phase: 'parked', t: 0 });
    // He comes now, on the perch 26 px ahead of it (x = 176 - 26 = 150), within its sight: it never starts again, nor does the cart return.
    r = { ...r, player: onPerch(150) };
    for (let i = 0; i < 600; i++) {
      r = stepRun(r, idle, level);
      expect(cartOf(r)).toEqual({ phase: 'stopped', m: LAST_M });
      expect(rideOf(r)).toEqual({ phase: 'parked', t: 0 });
    }
    expect(r.lives.lives).toBe(7);
    expect(r.enemies[0]!.alive).toBe(true);
  });
});

/**
 * Each state of its ride with a cart to match, and where the ringtail's middle is on the first step from it (after that step's roll):
 * waiting and telegraphing at its start; riding at m = 100 on the way; parked at the buffer.
 */
const STATES = {
  waiting: { ride: AT_REST, cart: WAITING, x: MID },
  telegraph: { ride: { phase: 'telegraph', t: 10 }, cart: WAITING, x: MID },
  riding: { ride: { phase: 'riding', t: 0 }, cart: { phase: 'rolling', m: 100 }, x: 480 - (100 + LEVEL_PX) },
  parked: { ride: { phase: 'parked', t: 0 }, cart: { phase: 'stopped', m: LAST_M }, x: 480 - LAST_M },
} as const satisfies Record<string, { ride: Ride; cart: CartState; x: number }>;
type StateName = keyof typeof STATES;
const NAMES: readonly StateName[] = ['waiting', 'telegraph', 'riding', 'parked'];

/** A run in the state `name`, with Poncho at `player`. */
const inState = (level: Level, name: StateName, player: PlayerState, extra: Partial<RunState> = {}): RunState => ready(level, player, { ride: STATES[name].ride, cart: STATES[name].cart, extra });

describe('GDD-ENM-04 cacomixtle is a hit to touch', () => {
  for (const name of NAMES) {
    it(`GDD-ENM-04 cacomixtle touching it is a hit while ${name}`, () => {
      const level = levelOf();
      // On the ground at its middle: his hurtbox overlaps its box. Base: the hit costs a life.
      const r = stepRun(inState(level, name, standing(STATES[name].x, 192)), idle, level);
      expect(r.lives.lives).toBe(6);
      expect(r.phase).toBe('respawning');
      expect(r.enemies[0]!.alive).toBe(true);
    });
  }

  it('GDD-ENM-04 cacomixtle touching it from beneath is a hit, not harmless', () => {
    // The rail over air (ground at y = 256): he jumps up under it, through its one-way floor, and his head meets the ringtail's box.
    const level = levelOf({ solid: (_c, r) => r >= 16 });
    let r = ready(level, standing(MID, 256));
    let hit = -1;
    let touched = -1;
    for (let i = 0; i < 40 && hit < 0; i++) {
      r = stepRun(r, { move: 0, jumpHeld: true }, level);
      if (touched < 0 && overlaps({ x0: hurtbox(r.player).x, x1: hurtbox(r.player).x + hurtbox(r.player).w, y0: hurtbox(r.player).y, y1: hurtbox(r.player).y + hurtbox(r.player).h }, enemyBox(RINGTAIL, r.enemies[0]!))) touched = i;
      if (r.lives.lives < 7) hit = i;
    }
    // The first step his hurtbox (31 px over his feet) is in its box, rising from beneath, is the hit: it is not harmless.
    expect(touched).toBeGreaterThan(0);
    expect(hit).toBe(touched);
    expect(r.lives.lives).toBe(6);
    expect(r.player.y).toBeLessThan(256);
  });
});

const WAYS = ['stomp', 'claw', 'fireball', 'fantasma'] as const;

describe('GDD-ENM-04 cacomixtle stomp, claw, fireball and the Fantasma defeat it', () => {
  const ways: Record<(typeof WAYS)[number], (level: Level, name: StateName) => RunState> = {
    // He lands on it: his feet 2 px over its top (y = 170), falling at 300 px/s.
    stomp: (level: Level, name: StateName) => play(level, inState(level, name, falling(STATES[name].x, 168, 300)), 1),
    // He swings the claw from the ground behind it, facing it, 14 px from its middle, and waits for the swing (2 steps of wind-up, then 3).
    claw: (level: Level, name: StateName) => {
      let r = inState(level, name, standing(STATES[name].x + 14, 192, -1));
      for (let i = 0; i < 12 && r.enemies[0]!.alive; i++) r = stepRun(r, { move: 0, jumpHeld: false, claw: i === 0 }, level);
      return r;
    },
    // A fireball already on it, with Poncho far away.
    fireball: (level: Level, name: StateName) => {
      const f: Fireball = { x: STATES[name].x, y: 180, vx: 0, vy: 0, age: 0 };
      return play(level, inState(level, name, standing(600, 192), { fireballs: [f] }), 1);
    },
    // The Chile Fantasma: he touches it on the ground and takes no hit.
    fantasma: (level: Level, name: StateName) => play(level, inState(level, name, standing(STATES[name].x, 192), { fantasma: 100 }), 1),
  };

  for (const name of NAMES) {
    for (const way of WAYS) {
      it(`GDD-ENM-04 cacomixtle the ${way} defeats it while ${name}`, () => {
        const level = levelOf();
        const r = ways[way](level, name);
        expect(r.enemies[0]!.alive).toBe(false);
        expect(r.lives.lives).toBe(7);
        if (way === 'stomp') {
          // He bounces as usual: up at 260 px/s, 410 with jump held.
          expect(r.stomped).toBe(true);
          expect(r.player.vy).toBe(-260);
          expect(stepRun(r, idle, level).player.vy).toBeLessThan(0);
        }
        // A fireball is used up by it.
        if (way === 'fireball') expect(r.fireballs).toEqual([]);
        // A defeat while it waits or telegraphs leaves the cart standing still and empty, waiting; riding, the cart rolls on; parked, it stays stopped.
        const after = cartOf(stepRun(r, idle, level));
        if (name === 'waiting' || name === 'telegraph') expect(after).toEqual({ phase: 'waiting', m: 16 });
        else if (name === 'riding') expect(after.phase).toBe('rolling');
        else expect(after).toEqual({ phase: 'stopped', m: LAST_M });
      });
    }
  }
});

/** A ringtail defeated (the Chile Fantasma's touch on the ground at its middle), then Poncho put down far behind it. */
const emptied = (level: Level, name: StateName): RunState => {
  const r = stepRun(inState(level, name, standing(STATES[name].x, 192), { fantasma: 100 }), idle, level);
  expect(r.enemies[0]!.alive).toBe(false);
  return away(r);
};

describe('GDD-ENM-04 cacomixtle an emptied cart', () => {
  it('GDD-ENM-04 cacomixtle an emptied cart rolls on to the buffer and does not return', () => {
    const level = levelOf();
    let r = emptied(level, 'riding');
    const m0 = cartOf(r).m;
    for (let i = 0; i < 300 && cartOf(r).phase === 'rolling'; i++) {
      const before = cartOf(r).m;
      r = stepRun(r, idle, level);
      if (cartOf(r).phase === 'rolling') expect(cartOf(r).m - before).toBeCloseTo(LEVEL_PX, 9);
    }
    expect(cartOf(r)).toEqual({ phase: 'stopped', m: LAST_M });
    expect(m0).toBeLessThan(LAST_M);
    // The dead ringtail stays where it fell (x = 377.5 on the cart's floor at m = 102.5, the step it was defeated), not riding on.
    expect(enemyBox(RINGTAIL, r.enemies[0]!)).toEqual({ x0: 480 - 102.5 - 7, x1: 480 - 102.5 + 7, y0: 170, y1: 184 });
    // His own cart is back at its start 120 steps after it stopped; this one is where it stopped 600 steps on, and for good.
    for (let i = 0; i < 600; i++) {
      r = stepRun(r, idle, level);
      expect(cartOf(r)).toEqual({ phase: 'stopped', m: LAST_M });
    }
    expect(r.lives.lives).toBe(7);
  });

  it('GDD-ENM-04 cacomixtle a cart he stands in starts on the step its ringtail is defeated, and anchors him on the next', () => {
    // He stands on the floor 14 px behind it (x = 478, out of its sight), facing it, and swings the claw: the step it is defeated he is in an
    // empty waiting cart, which starts at the end of that step; he is anchored at its middle from the step after (the anchor reads the step's start).
    const level = levelOf();
    let r = ready(level, falling(478, 180, 100));
    r = { ...r, player: { ...r.player, facing: -1 } };
    let swung = false;
    let died = -1;
    for (let i = 0; i < 40 && died < 0; i++) {
      const before = r;
      r = stepRun(r, { move: 0, jumpHeld: false, claw: r.player.grounded && !swung }, level);
      swung ||= r.claw.phase !== 'idle';
      if (!r.enemies[0]!.alive) {
        died = i;
        expect(cartOf(before)).toEqual({ phase: 'waiting', m: 16 });
        expect(cartOf(r)).toEqual({ phase: 'rolling', m: 16 });
        expect(r.player.x).toBe(478);
      }
    }
    expect(died).toBeGreaterThan(0);
    r = stepRun(r, idle, level);
    expect(r.player.x).toBeCloseTo(MID - LEVEL_PX, 9);
    expect(r.lives.lives).toBe(7);
  });

  it('GDD-ENM-04 cacomixtle an emptied waiting cart is his to ride: he lands in it, it rolls, it stops, and it does not return', () => {
    const level = levelOf();
    let r = emptied(level, 'waiting');
    r = play(level, r, 120);
    // It stood still while empty and nobody was in it.
    expect(cartOf(r)).toEqual({ phase: 'waiting', m: 16 });
    // He drops onto its floor 8 px behind its middle (x = 456): on the landing step the cart starts and he is at its middle, on its floor.
    r = { ...r, player: falling(456, 180, 100) };
    let landing = -1;
    for (let i = 0; i < 10 && landing < 0; i++) {
      r = stepRun(r, idle, level);
      if (r.player.grounded) landing = i;
    }
    expect(landing).toBeGreaterThanOrEqual(0);
    expect(cartOf(r)).toEqual({ phase: 'rolling', m: 16 });
    expect(r.player).toMatchObject({ x: MID, y: FLOOR, grounded: true });
    // It first moves on the next step, and carries him at its middle.
    r = stepRun(r, idle, level);
    expect(cartOf(r).m).toBeCloseTo(16 + LEVEL_PX, 9);
    expect(r.player.x).toBeCloseTo(MID - LEVEL_PX, 9);
    expect(r.player.y).toBe(FLOOR);
    for (let i = 0; i < 300 && cartOf(r).phase === 'rolling'; i++) r = stepRun(r, idle, level);
    expect(cartOf(r)).toEqual({ phase: 'stopped', m: LAST_M });
    // He walks off it at the buffer, to the ground, and the cart stays: 600 steps on it is where it stopped.
    r = play(level, r, 40, { move: -1, jumpHeld: false });
    expect(r.player.y).toBe(192);
    expect(r.player.x).toBeLessThan(176 - 16);
    r = play(level, r, 600);
    expect(cartOf(r)).toEqual({ phase: 'stopped', m: LAST_M });
    expect(r.lives.lives).toBe(7);
  });
});

describe('GDD-ENM-04 cacomixtle its cart is a cart, a floor beside it', () => {
  it('GDD-ENM-04 cacomixtle landing beside a live ringtail behind it is a landing, not a hit, and does not start it', () => {
    // 9 px of floor each side: he lands at x = 478 (body 472 to 484, 8 px on the floor 448 to 480), his hurtbox 473 to 483, clear of its 457 to 471.
    // That side is behind it (it rolls left), so it never sees him.
    const level = levelOf();
    let r = ready(level, falling(478, 180, 100));
    let landed = -1;
    for (let i = 0; i < 10 && landed < 0; i++) {
      r = stepRun(r, idle, level);
      if (r.player.grounded) landed = i;
    }
    expect(landed).toBeGreaterThanOrEqual(0);
    expect(r.player).toMatchObject({ x: 478, y: FLOOR, grounded: true });
    r = play(level, r, 300);
    expect(r.lives.lives).toBe(7);
    // He stands where he landed: not moved to the cart's middle, and the cart does not start.
    expect(r.player).toMatchObject({ x: 478, y: FLOOR, grounded: true });
    expect(cartOf(r)).toEqual({ phase: 'waiting', m: 16 });
    expect(rideOf(r)).toEqual({ phase: 'waiting', t: 0 });
  });

  it('GDD-ENM-04 cacomixtle landing beside a live ringtail ahead of it starts it, and the cart carries him with it', () => {
    // The other side, x = 450 (body 444 to 456, 8 px on the floor 448 to 480; hurtbox 445 to 455): 14 px ahead of it, in its sight.
    const level = levelOf();
    let r = ready(level, falling(450, 180, 100));
    // He is in its sight in the air already: the telegraph's 30 steps are counted from the first.
    let telegraph = 0;
    let carried = 0;
    let landedAt = -1;
    for (let i = 0; i < 400 && cartOf(r).phase !== 'stopped'; i++) {
      const before = r;
      r = stepRun(r, idle, level);
      if (landedAt < 0 && r.player.grounded) {
        landedAt = i;
        expect(r.player).toMatchObject({ x: 450, y: FLOOR });
      }
      if (rideOf(r).phase === 'telegraph') {
        telegraph++;
        expect(cartOf(r).m).toBe(16);
        if (landedAt >= 0) expect(r.player).toMatchObject({ x: 450, y: FLOOR });
      }
      // Rolling: his x changes by the cart's move each step; he is not anchored at its middle, nor does his place in it change.
      if (before.carts[0]!.phase === 'rolling' && cartOf(r).phase === 'rolling') {
        carried++;
        expect(r.player.x - before.player.x).toBeCloseTo(-LEVEL_PX, 9);
        expect(r.player.y).toBe(FLOOR);
      }
      expect(r.lives.lives).toBe(7);
    }
    expect(landedAt).toBeGreaterThanOrEqual(0);
    expect(landedAt).toBeLessThan(30);
    expect(telegraph).toBe(30);
    expect(carried).toBeGreaterThan(80);
    // At the buffer: the cart is stopped 288 px on and he stands on it where he has ridden, 14 px ahead of the parked ringtail.
    expect(cartOf(r)).toEqual({ phase: 'stopped', m: LAST_M });
    expect(r.player.x).toBeCloseTo(450 - (LAST_M - 16), 6);
    expect(r.player.y).toBe(FLOOR);
    expect(rideOf(r)).toEqual({ phase: 'parked', t: 0 });
    expect(r.lives.lives).toBe(7);
  });

  it('GDD-ENM-04 cacomixtle its own cart does not run it over', () => {
    // The whole ride with nobody near: it stays alive, from the first step the cart rolls to long after it has parked.
    const level = levelOf();
    let r = ready(level, standing(600, 192), { ride: { phase: 'telegraph', t: 29 } });
    let rolling = 0;
    for (let i = 0; i < 300; i++) {
      r = stepRun(r, idle, level);
      expect(r.enemies[0]!.alive).toBe(true);
      if (cartOf(r).phase === 'rolling') rolling++;
    }
    expect(rolling).toBeGreaterThan(80);
    expect(rideOf(r).phase).toBe('parked');
  });
});

describe('GDD-ENM-04 cacomixtle on a rail rolling right', () => {
  // The mirror of everything above: the rail starts at x = 100 and rolls right, the cart's middle at x = 116 and its floor at y = 184; ahead is
  // to the right of the ringtail, and its middle is at x = 100 + m.
  const RIGHT: Rail = { x: 100, y: 192, dir: 1, segments: [{ kind: 'level', tiles: 20 }], end: 'buffer' };
  const RINGTAIL_RIGHT: Enemy = { x: 116, y: FLOOR, kind: 'cacomixtle', rail: 0 };

  it('GDD-ENM-04 cacomixtle sees him ahead on its right and not behind it on its left, and rides right', () => {
    const level = levelOf({ rails: [RIGHT], enemies: [RINGTAIL_RIGHT], platforms: [PERCH] });
    /** Does standing on the perch with his hurtbox's centre at x start it on the first step, and ever in 120 steps? */
    const start = (x: number): { first: boolean; ever: boolean } => {
      let r = ready(level, onPerch(x));
      let first = false;
      let ever = false;
      for (let i = 0; i < 120; i++) {
        r = stepRun(r, idle, level);
        if (i === 0) first = rideOf(r).phase === 'telegraph' && rideOf(r).t === 1;
        ever ||= rideOf(r).phase !== 'waiting';
        expect(r.lives.lives).toBe(7);
      }
      return { first, ever };
    };
    // 200 px ahead of its middle (x 116) is x = 316: it starts; 201 does not; 12 px behind it (x = 104) and 1 px ahead (117) are either side of 0.
    expect(start(316)).toEqual({ first: true, ever: true });
    expect(start(317)).toEqual({ first: false, ever: false });
    expect(start(117)).toEqual({ first: true, ever: true });
    expect(start(104)).toEqual({ first: false, ever: false });
    // The ride: the ringtail's middle is the cart's, x = 100 + m, its feet on the floor, and it parks at m = 304 (x = 404).
    let r = ready(level, standing(30, 192), { ride: { phase: 'telegraph', t: 29 } });
    let rolling = 0;
    for (let i = 0; i < 400 && cartOf(r).phase !== 'stopped'; i++) {
      r = stepRun(r, idle, level);
      const box = enemyBox(level.enemies[0]!, r.enemies[0]!);
      expect((box.x0 + box.x1) / 2).toBeCloseTo(100 + cartOf(r).m, 9);
      expect(box.y1).toBe(FLOOR);
      if (cartOf(r).phase === 'rolling') rolling++;
    }
    expect(rolling).toBeGreaterThan(100);
    expect(cartOf(r)).toEqual({ phase: 'stopped', m: LAST_M });
    expect((enemyBox(level.enemies[0]!, r.enemies[0]!).x0 + 7)).toBeCloseTo(404, 9);
    expect(rideOf(r)).toEqual({ phase: 'parked', t: 0 });
    expect(r.lives.lives).toBe(7);
  });
});

describe('GDD-ENM-04 cacomixtle and the other enemies', () => {
  it('GDD-ENM-04 cacomixtle leaves the other enemies of the level as they are', () => {
    // An Alacrán on the ground at x = 100 walks at 30 px/s (GDD-ENM-02) next to a ringtail on its rail: each does its own.
    const alacran: Enemy = { x: 100, y: 192 };
    const level = levelOf({ enemies: [RINGTAIL, alacran] });
    const r = play(level, ready(level, standing(600, 192)), 60);
    expect(r.enemies[1]).toMatchObject({ alive: true, x: 100 + 30 });
    expect(r.enemies[1]!.ride).toBeUndefined();
    expect(rideOf(r)).toEqual({ phase: 'waiting', t: 0 });
  });
});

describe('GDD-ENM-04 cacomixtle another cart defeats it', () => {
  /** A second rail on the same ground rolling right from x = 301 (its cart's middle at 317), his own cart: its front edge is at 333 + 2.5 k after k steps rolling. */
  const OWN: Rail = { x: 301, y: 192, dir: 1, segments: [{ kind: 'level', tiles: 20 }], end: 'buffer' };

  it('GDD-ENM-04 cacomixtle a cart he sent rolling defeats a waiting ringtail on the first step their boxes overlap', () => {
    const level = levelOf({ rails: [RAIL, OWN] });
    // His cart rolls already, 16 px of its middle from its rail's start. The ringtail's box starts at x = 457; the cart's front edge reaches it
    // when 333 + 2.5 k > 457, k = 50 (k = 49 is 455.5).
    let r = ready(level, standing(600, 192), { extra: { carts: [WAITING, { phase: 'rolling', m: 16 }] } });
    let dead = -1;
    for (let k = 1; k <= 80 && dead < 0; k++) {
      r = stepRun(r, idle, level);
      if (!r.enemies[0]!.alive) dead = k;
    }
    expect(dead).toBe(50);
    expect(cartOf(r)).toEqual({ phase: 'waiting', m: 16 });
  });

  it('GDD-ENM-04 cacomixtle a cart he sent rolling defeats a riding ringtail where it is after its own cart has rolled', () => {
    const level = levelOf({ rails: [RAIL, OWN] });
    // Head on: both carts roll from m = 16 on the same step; after k steps the ringtail's left edge is at 457 - 2.5 k and his cart's front at
    // 333 + 2.5 k. They overlap when 5 k > 124, k = 25 (k = 24: 393 against 397).
    let r = ready(level, standing(600, 192), { ride: { phase: 'riding', t: 0 }, extra: { carts: [{ phase: 'rolling', m: 16 }, { phase: 'rolling', m: 16 }] } });
    let dead = -1;
    for (let k = 1; k <= 60 && dead < 0; k++) {
      r = stepRun(r, idle, level);
      if (!r.enemies[0]!.alive) dead = k;
    }
    expect(dead).toBe(25);
  });
});

describe('GDD-ENM-04 cacomixtle and a lost life', () => {
  it('GDD-ENM-04 cacomixtle a lost life puts the cart back at its start with the ringtail in it, waiting', () => {
    const level = levelOf({ spikes: [{ col: 5, row: 11 }] });
    let r = ready(level, standing(600, 192), { ride: { phase: 'telegraph', t: 29 } });
    r = play(level, r, 400);
    expect(cartOf(r)).toEqual({ phase: 'stopped', m: LAST_M });
    expect(rideOf(r).phase).toBe('parked');
    // Poncho stands on the spike in column 5: a life is lost.
    r = stepRun({ ...r, player: standing(5 * 16 + 8, 192) }, idle, level);
    expect(r.phase).toBe('respawning');
    expect(r.lives.lives).toBe(6);
    for (let i = 0; i < 300 && r.phase !== 'playing'; i++) r = stepRun(r, idle, level);
    expect(r.phase).toBe('playing');
    expect(r.enemies[0]).toMatchObject({ alive: true, ride: { phase: 'waiting', t: 0 } });
    expect(cartOf(r)).toEqual({ phase: 'waiting', m: 16 });
    expect(enemyBox(level.enemies[0]!, r.enemies[0]!)).toEqual({ x0: 457, x1: 471, y0: 170, y1: 184 });
    // A defeated one is back too, and waits.
    let d = ready(level, standing(MID, 192), { extra: { fantasma: 100 } });
    d = stepRun(d, idle, level);
    expect(d.enemies[0]!.alive).toBe(false);
    d = stepRun({ ...d, player: standing(5 * 16 + 8, 192), fantasma: 0 }, idle, level);
    for (let i = 0; i < 300 && d.phase !== 'playing'; i++) d = stepRun(d, idle, level);
    expect(d.enemies[0]).toMatchObject({ alive: true, ride: { phase: 'waiting', t: 0 } });
  });
});

/**
 * Poncho stands on the ground at x = 300; a ringtail rolls at him from x = 464 (its cart rolling from m = 16), its left edge reaching his hurtbox
 * (x 295 to 305) in about 61 steps. He waits `k` steps, then takes a full jump with jump held to his landing, and lets go of it (L-048).
 * What came of it after the ringtail has passed.
 */
function jump(k: number): { hit: boolean; defeated: boolean; grounded: boolean; y: number } {
  const level = levelOf();
  let r = ready(level, standing(300, 192), { ride: { phase: 'riding', t: 0 }, cart: { phase: 'rolling', m: 16 } });
  let left = false;
  let landed = false;
  for (let i = 0; i < 260; i++) {
    const press = i >= k && !landed;
    r = stepRun(r, { move: 0, jumpHeld: press }, level);
    if (!r.player.grounded) left = true;
    else if (left && i >= k) landed = true;
    if (r.lives.lives < 7 || r.phase !== 'playing') break;
  }
  return { hit: r.lives.lives < 7, defeated: !r.enemies[0]!.alive, grounded: r.player.grounded, y: r.player.y };
}

describe('GDD-ENM-04 cacomixtle jumping over it', () => {
  it('GDD-ENM-04 cacomixtle a standing Poncho can jump over the ringtail rolling at him, and the window is at least one step', () => {
    const outcomes = Array.from({ length: 80 }, (_, k) => jump(k));
    // A take-off passes it when no life is lost, it is not stomped and he stands again on the ground (y = 192).
    const passes = outcomes.flatMap((o, k) => (!o.hit && !o.defeated && o.grounded && o.y === 192 ? [k] : []));
    expect(passes.length).toBeGreaterThanOrEqual(1);
    // Too early: he lands in front of it, and it hits him; too late: it is on him before he leaves the ground. Both ends of the take-offs lose.
    expect(outcomes[0]!.hit || outcomes[0]!.defeated).toBe(true);
    expect(outcomes[79]!.hit).toBe(true);
  });
});
