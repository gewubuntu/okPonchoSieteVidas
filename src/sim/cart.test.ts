import { describe, expect, it } from 'vitest';
import { CART, FANTASMA, HIT, RESPAWN, TILE } from '../config/tuning';
import { LEVEL_1_4 } from '../levels/level1-4';
import { bossStart } from './boss';
import { cartFloor, floorUnder, railLength, rollCarts, type CartState, type Rail, type RailSegment } from './cart';
import { clawBox } from './claw';
import { spawnFireball } from './fireball';
import { hitStopSteps } from './hitStop';
import { spawn, step, type Abilities, type PlayerInput, type PlayerState } from './movement';
import { standsOnPlatform, type MovingPlatform } from './platform';
import { startRun, stepRun, type Level, type RunState } from './run';
import { parseTiles } from './tilemap';

// GDD-WLD-15: vagonetas. The expected numbers are the GDD's: 150 px/s on the level, 120 uphill and 180 downhill along the rail (84.85 and
// 127.28 px/s across), a 32 px cart whose floor rides 8 px over the rail's ground, and the carry rule's measured jumps.
const idle: PlayerInput = { move: 0, jumpHeld: false };
const right: PlayerInput = { move: 1, jumpHeld: false };
const left: PlayerInput = { move: -1, jumpHeld: false };
const hold: PlayerInput = { move: 0, jumpHeld: true };

const COLS = 100;
/** The floor's top, row 12, and the ground every rail below starts on unless it says otherwise. */
const FLOOR = 12 * TILE;
const SQRT2 = Math.sqrt(2);

/** A world `COLS` wide with a floor at row 12 and `solid(row)` giving every other row. */
const rows = (solid: (row: number) => string = () => '.'.repeat(COLS)) => parseTiles(Array.from({ length: 13 }, (_, r) => (r === 12 ? '#'.repeat(COLS) : solid(r))));
/** The same with tiles at the [col, row] pairs given. */
const withTiles = (tiles: readonly (readonly [number, number])[]) =>
  rows((r) => Array.from({ length: COLS }, (_, c) => (tiles.some(([tc, tr]) => tc === c && tr === r) ? '#' : '.')).join(''));

/** A level with only rails. The glide is off unless asked for, so a held jump lands where the GDD measured it (the all-abilities run, L-024). */
const levelOf = (rails: readonly Rail[], o: { world?: ReturnType<typeof rows>; abilities?: Abilities; spikes?: Level['spikes']; platforms?: readonly MovingPlatform[] } = {}): Level => ({
  world: o.world ?? rows(),
  spawn: { x: 24, y: FLOOR },
  ofrendas: [],
  spikes: o.spikes ?? [],
  crumbles: [],
  springs: [],
  platforms: o.platforms ?? [],
  tacos: [], pinatas: [], doors: [], keys: [], fragiles: [], enemies: [],
  abilities: o.abilities ?? { glide: false },
  rails,
});
const rail = (x: number, segments: readonly RailSegment[], o: { y?: number; dir?: 1 | -1 } = {}): Rail => ({ x, y: o.y ?? FLOOR, dir: o.dir ?? 1, segments, end: 'buffer' });
const level = (tiles: number): RailSegment[] => [{ kind: 'level', tiles }];

/** A run with Poncho as given and the carts as given (the rest as at the level start). */
const runWith = (lvl: Level, player: PlayerState, carts?: readonly CartState[]): RunState => ({ ...startRun(lvl), player, ...(carts ? { carts } : {}) });
/** Poncho standing in cart 0, `dx` from its middle, the cart `phase` at `m`. */
function riding(lvl: Level, m: number, o: { dx?: number; vx?: number; phase?: CartState['phase'] } = {}): RunState {
  const cart: CartState = { phase: o.phase ?? 'rolling', m };
  const floor = cartFloor(lvl.rails![0]!, cart);
  const x = floor.x + floor.w / 2 + (o.dx ?? 0);
  const carts = lvl.rails!.map((_, i) => (i === 0 ? cart : { phase: 'waiting' as const, m: CART.width / 2 }));
  return runWith(lvl, { ...spawn(x, floorUnder(lvl.rails![0]!, cart, x).y), vx: o.vx ?? 0 }, carts);
}
/** Plays on, returning every state. */
function play(lvl: Level, r: RunState, steps: number, input: (i: number, r: RunState) => PlayerInput = () => idle): RunState[] {
  const states: RunState[] = [];
  for (let i = 0; i < steps; i++) {
    r = stepRun(r, input(i, r), lvl);
    states.push(r);
  }
  return states;
}
/** The x of cart `i`'s middle. */
const middle = (lvl: Level, r: RunState, i = 0): number => {
  const f = cartFloor(lvl.rails![i]!, r.carts[i]!);
  return f.x + f.w / 2;
};
/** Standing in cart `i`: on its floor under his feet (GDD-WLD-15: the floor follows the rail). */
const inCart = (lvl: Level, r: RunState, i = 0): boolean => standsOnPlatform(r.player, floorUnder(lvl.rails![i]!, r.carts[i]!, r.player.x));

/**
 * A jump from the cart Poncho stands in: the states from the takeoff step (index 0) until the first step he is grounded again, at most
 * 300. `input(i)` is the input of step i after the takeoff (the takeoff's own is `first`).
 */
function jumpFrom(lvl: Level, r: RunState, input: (i: number) => PlayerInput = () => hold, first: PlayerInput = hold): RunState[] {
  const states = [stepRun(r, first, lvl)];
  for (let i = 1; i < 300 && !states[states.length - 1]!.player.grounded; i++) states.push(stepRun(states[states.length - 1]!, input(i), lvl));
  return states;
}

/** The cart's `m` after each of `n` steps of rolling from `m`. */
const rolls = (r: Rail, m: number, n: number): number[] => {
  let carts: CartState[] = [{ phase: 'rolling', m }];
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    carts = rollCarts([r], carts);
    out.push(carts[0]!.m);
  }
  return out;
};
/** The rail's ground under a cart at `m`: its floor's y and the 8 px back down. */
const groundOf = (r: Rail, m: number) => cartFloor(r, { phase: 'rolling', m }).y + 8;
/** Level for 4 tiles on the floor, up 4 tiles to y 128, then level: the ground under the middle at `m`, from the GDD's shape. */
const climbGround = (m: number) => (m < 64 ? FLOOR : m < 128 ? FLOOR - (m - 64) : FLOOR - 64);
/**
 * A world whose ground follows a rail that rolls right: under each level tile solid tiles from the rail's ground down to the floor, under each
 * tile of a climb a '/' slope and under each tile of a descent a '\\' slope, each on solid tiles (GDD-MOV-09), so the rail lies on the ground.
 */
function trackWorld(r: Rail) {
  const grid = Array.from({ length: 13 }, (_, row) => Array.from({ length: COLS }, (): string => (row === 12 ? '#' : '.')));
  let col = r.x / TILE;
  let top = r.y / TILE;
  for (const seg of r.segments) {
    for (let k = 0; k < seg.tiles; k++, col++) {
      const slope = seg.kind === 'climb' ? top - 1 : seg.kind === 'descent' ? top : -1;
      if (slope >= 0) grid[slope]![col] = seg.kind === 'climb' ? '/' : '\\';
      for (let row = seg.kind === 'descent' ? top + 1 : top; row < 12; row++) grid[row]![col] = '#';
      if (seg.kind === 'climb') top--;
      if (seg.kind === 'descent') top++;
    }
  }
  return parseTiles(grid.map((row) => row.join('')));
}
/** The ground of a rail rolling right from x 160, 4 level tiles, 4 tiles of `kind` from `y0`, then 6 level tiles: from the GDD's shape. */
const joinGround = (kind: 'climb' | 'descent', y0: number) => (x: number): number => {
  const a = Math.min(14 * TILE, Math.max(0, x - 160));
  const k = kind === 'climb' ? -1 : 1;
  return a < 64 ? y0 : a < 128 ? y0 + k * (a - 64) : y0 + k * 64;
};

/** The distance across from his takeoff point to his landing, and the steps in the air (the landing step counted, the takeoff not). */
const measure = (states: RunState[], from: RunState) => ({ steps: states.length - 1, across: states[states.length - 1]!.player.x - from.player.x });

describe('GDD-WLD-15 the cart', () => {
  const R = rail(160, level(20));
  const lvl = levelOf([R]);

  it('GDD-WLD-15 a waiting cart stands still until Poncho lands in it', () => {
    const states = play(lvl, runWith(lvl, spawn(100, FLOOR)), 120);
    expect(states.every((s) => s.carts[0]!.phase === 'waiting' && s.carts[0]!.m === 16)).toBe(true);
  });

  it('GDD-WLD-15 landing on the floor boards it: it rolls from the next step', () => {
    // Dropped from 40 px over the floor above its middle (x 176): the landing step boards it, and it first moves on the next.
    const states = play(lvl, runWith(lvl, { ...spawn(176, FLOOR - 40), grounded: false }), 60);
    const at = states.findIndex((s) => s.player.grounded);
    expect(at).toBeGreaterThan(0);
    expect(states[at - 1]!.carts[0]).toEqual({ phase: 'waiting', m: 16 });
    expect(states[at]!.carts[0]).toEqual({ phase: 'rolling', m: 16 });
    expect(states[at]!.player.vx).toBe(0); // a standing cart takes nothing off his speed
    expect(states[at + 1]!.carts[0]!.m).toBeCloseTo(16 + 150 / 60, 9);
  });

  it('GDD-WLD-15 a walk off a step one tile up lands in it', () => {
    // A ledge tile beside the cart's back (column 9, x 144 to 160, top y 176, 16 px over the rail's ground): walking off it drops 8 px.
    const l = levelOf([R], { world: withTiles([[9, 11]]) });
    const states = play(l, runWith(l, spawn(150, FLOOR - TILE)), 60, (_i, r) => (r.carts[0]!.phase === 'waiting' ? right : idle));
    const at = states.findIndex((s) => s.carts[0]!.phase === 'rolling');
    expect(at).toBeGreaterThan(0);
    expect(states[at]!.player).toMatchObject({ grounded: true, y: FLOOR - 8 });
    expect(Math.max(...states.slice(0, at + 1).map((s) => s.player.y))).toBeCloseTo(FLOOR - 8, 9); // never lower than the floor's 8 px
  });

  it('GDD-WLD-15 walking through a standing cart at the ground\'s height neither boards nor starts it', () => {
    const states = play(lvl, runWith(lvl, spawn(100, FLOOR)), 120, () => right);
    expect(states[119]!.player.x).toBeGreaterThan(160 + 32 + 6); // he walked all the way through it
    expect(states.every((s) => s.carts[0]!.phase === 'waiting' && s.carts[0]!.m === 16)).toBe(true);
    expect(states.every((s) => s.player.y === FLOOR)).toBe(true);
  });

  it('GDD-WLD-15 walking up a slope through a standing cart at the ground\'s height neither boards nor starts it', () => {
    // A climb from x 160 over slope tiles, its cart waiting 40 px across: he walks up the sand slope under its floor, 8 px under it all the
    // way, also where its middle is lower on the slope than his feet.
    const r = rail(160, [{ kind: 'climb', tiles: 6 }, { kind: 'level', tiles: 4 }]);
    const l = levelOf([r], { world: trackWorld(r) });
    const states = play(l, runWith(l, spawn(120, FLOOR), [{ phase: 'waiting', m: 40 }]), 90, () => right);
    expect(states[89]!.player.x).toBeGreaterThan(160 + 40 + 16 + 6); // all the way through it
    expect(states.every((s) => s.carts[0]!.phase === 'waiting' && !inCart(l, s))).toBe(true);
    for (const s of states) if (s.player.x > 160 && s.player.x < 160 + 96) expect(s.player.y).toBeCloseTo(FLOOR - (s.player.x - 160), 6);
  });

  it('GDD-WLD-15 the floor rides 8 px over the rail\'s ground and is 32 px wide', () => {
    const states = play(lvl, runWith(lvl, { ...spawn(176, FLOOR - 40), grounded: false }), 60);
    expect(states[59]!.player).toMatchObject({ grounded: true, y: FLOOR - 8 });
    expect(cartFloor(R, { phase: 'waiting', m: 16 })).toEqual({ x: 160, y: FLOOR - 8, w: 32 });
    // Dropped with his body box just over its left end (x 160 - 5.99) he lands in it; just past it (x 160 - 6) he falls past to the ground.
    const edge = (x: number) => play(lvl, runWith(lvl, { ...spawn(x, FLOOR - 40), grounded: false }), 60)[59]!;
    expect(edge(160 - 5.99)).toMatchObject({ player: { y: FLOOR - 8 }, carts: [{ phase: 'rolling' }] });
    expect(edge(160 - 6)).toMatchObject({ player: { y: FLOOR }, carts: [{ phase: 'waiting' }] });
    expect(edge(192 + 5.99)).toMatchObject({ player: { y: FLOOR - 8 } });
  });

  it('GDD-WLD-15 he passes through the floor from below', () => {
    // The rail two tiles over the floor (its ground at y 160) over air: a full jump from the floor under it (56 px) goes up through the cart.
    const high = levelOf([rail(160, level(20), { y: FLOOR - 2 * TILE })]);
    const states = play(high, runWith(high, spawn(176, FLOOR)), 120, () => hold);
    expect(Math.min(...states.map((s) => s.player.y))).toBeLessThan(FLOOR - 2 * TILE - 8); // through it
    const at = states.findIndex((s) => s.player.grounded);
    expect(states[at]!.player.y).toBeCloseTo(FLOOR - 2 * TILE - 8, 9); // and onto it coming down
    expect(states[at]!.carts[0]!.phase).toBe('rolling');
  });
});

describe('GDD-WLD-15 rolling', () => {

  it('GDD-WLD-15 150 px/s on the level', () => {
    expect(rolls(rail(0, level(40)), 16, 60)[59]! - 16).toBeCloseTo(150, 6);
  });

  it('GDD-WLD-15 120 px/s uphill along the rail', () => {
    const up = rail(0, [{ kind: 'climb', tiles: 20 }], { y: 400 });
    const m = rolls(up, 16, 60)[59]!;
    expect(m - 16).toBeCloseTo(120 / SQRT2, 2); // 84.85 across
    expect(m - 16).toBeCloseTo(84.85, 2);
    expect(groundOf(up, 16) - groundOf(up, m)).toBeCloseTo(84.85, 2); // and as much up
  });

  it('GDD-WLD-15 180 px/s downhill', () => {
    const down = rail(0, [{ kind: 'descent', tiles: 20 }], { y: 0 });
    const m = rolls(down, 16, 60)[59]!;
    expect(m - 16).toBeCloseTo(127.28, 2);
    expect(groundOf(down, m) - groundOf(down, 16)).toBeCloseTo(127.28, 2);
  });

  it('GDD-WLD-15 the speed changes on the step the middle passes a join', () => {
    // 4 level tiles (the join at 64 px), then up.
    const r = rail(0, [{ kind: 'level', tiles: 4 }, { kind: 'climb', tiles: 10 }], { y: 400 });
    const ms = [16, ...rolls(r, 16, 40)];
    const first = ms.findIndex((m) => m >= 64);
    expect(ms[first - 1]!).toBeLessThan(64);
    expect(ms[first]! - ms[first - 1]!).toBeCloseTo(150 / 60, 9); // the step that starts before the join, and ends past it, is level
    expect(ms[first + 1]! - ms[first]!).toBeCloseTo(84.85 / 60, 4); // the next starts past it
  });

  it('GDD-WLD-15 one screen of level rail takes 3.2 s', () => {
    const ms = rolls(rail(0, level(40)), 16, 192);
    expect(ms[191]! - 16).toBeCloseTo(480, 6);
    expect(ms[190]! - 16).toBeLessThan(480);
  });

  it('GDD-WLD-15 it never stops or turns for him', () => {
    const lvl = levelOf([rail(160, level(60))]);
    const quiet = play(lvl, riding(lvl, 16), 100);
    // He holds left for 20 steps, does nothing for 20, then jumps out.
    const busy = play(lvl, riding(lvl, 16), 100, (i) => (i < 20 ? left : i < 40 ? idle : { move: 1, jumpHeld: i < 50 }));
    expect(busy.map((s) => s.carts[0]!.m)).toEqual(quiet.map((s) => s.carts[0]!.m));
    expect(busy[99]!.player.x).not.toBeCloseTo(quiet[99]!.player.x, 0); // he did move about
  });

  it('GDD-WLD-15 the rider is carried, up a climb too', () => {
    // Level for 4 tiles (64 px) on the floor, up 4 tiles (to y 128) over air, then level (`climbGround`).
    const r = rail(160, [{ kind: 'level', tiles: 4 }, { kind: 'climb', tiles: 4 }, { kind: 'level', tiles: 8 }]);
    const lvl = levelOf([r]);
    const states = play(lvl, riding(lvl, 16), 120);
    expect(states[119]!.carts[0]!.m).toBeGreaterThan(160); // past the climb
    for (const s of states) {
      expect(s.player.x).toBeCloseTo(160 + s.carts[0]!.m, 9);
      expect(s.player.y).toBeCloseTo(climbGround(s.carts[0]!.m) - 8, 9);
      expect(s.player.grounded).toBe(true);
    }
  });

  it('GDD-WLD-15 the floor under him follows the rail: 8 px over its ground under his feet on a slope', () => {
    // A climb from x 160 (FLOOR) over air; the cart's middle at 50 px across, he stands 10 px ahead of it and 10 px behind it.
    const r = rail(160, [{ kind: 'climb', tiles: 10 }]);
    const lvl = levelOf([r]);
    const ground = (x: number) => FLOOR - (x - 160);
    for (const dx of [10, -10]) {
      const states = play(lvl, riding(lvl, 50, { dx }), 30);
      for (const s of states) {
        expect(inCart(lvl, s)).toBe(true);
        expect(s.player.y).toBeCloseTo(ground(s.player.x) - 8, 6);
      }
      expect(Math.abs(states[29]!.player.y - (ground(middle(lvl, states[29]!)) - 8))).toBeCloseTo(10, 6); // not the floor under the middle
    }
    // Dropped into it 10 px behind its middle, he lands on the floor under his own feet.
    const drop = play(lvl, runWith(lvl, { ...spawn(160 + 50 - 10, FLOOR - 120), grounded: false }, [{ phase: 'waiting', m: 50 }]), 60);
    const at = drop.findIndex((s) => s.player.grounded);
    expect(drop[at]!.player.y).toBeCloseTo(ground(drop[at]!.player.x) - 8, 6);
  });

  for (const kind of ['descent', 'climb'] as const) {
    for (const ground of ['air', 'slope tiles'] as const) {
      it(`GDD-WLD-15 a rider anywhere in the cart stays in it over a join: a ${kind} over ${ground}`, () => {
        // From x 160: 4 level tiles, 4 of the slope, 6 level; a descent starts 4 tiles up, a climb on the floor.
        const y0 = kind === 'descent' ? FLOOR - 64 : FLOOR;
        const r = rail(160, [{ kind: 'level', tiles: 4 }, { kind, tiles: 4 }, { kind: 'level', tiles: 6 }], { y: y0 });
        const lvl = levelOf([r], ground === 'slope tiles' ? { world: trackWorld(r) } : {});
        const under = joinGround(kind, y0);
        for (const offset of [-10, -6, 0, 6, 10]) {
          // He walks to the offset from the middle, then stands.
          let there = offset === 0;
          const states = play(lvl, riding(lvl, 16), 120, (_i, s) => {
            const gap = offset - (s.player.x - middle(lvl, s));
            if (!there && Math.abs(gap) < 1) there = true;
            return there ? idle : { move: Math.sign(gap), jumpHeld: false };
          });
          const stop = states.findIndex((s) => s.carts[0]!.phase === 'stopped');
          expect(stop).toBeGreaterThan(40);
          for (const [i, s] of states.slice(0, stop + 10).entries()) {
            expect(inCart(lvl, s), `offset ${offset}, step ${i}`).toBe(true);
            expect(s.player.y, `offset ${offset}, step ${i}`).toBeCloseTo(under(s.player.x) - 8, 6);
          }
          expect(Math.abs(states[stop]!.player.x - middle(lvl, states[stop]!) - offset)).toBeLessThan(6); // he stopped near it
        }
      });
    }
  }

  it('GDD-WLD-15 walking in a cart on a descent keeps him on its floor', () => {
    // A descent from x 160, 64 px up, over air: walking forward from 10 px behind the middle, the floor falls away under his feet each step.
    const r = rail(160, [{ kind: 'descent', tiles: 10 }], { y: FLOOR - 160 });
    const lvl = levelOf([r]);
    const states = play(lvl, riding(lvl, 40, { dx: -10 }), 12, () => right);
    expect(states[11]!.player.x - middle(lvl, states[11]!)).toBeGreaterThan(-10 + 5); // he did walk forward in it
    for (const s of states) {
      expect(s.player.grounded).toBe(true);
      expect(s.player.y).toBeCloseTo(FLOOR - 160 + (s.player.x - 160) - 8, 6);
      expect(s.player.carry).toBeUndefined();
    }
  });

  it('GDD-WLD-15 past the rail\'s ends the floor is level with them', () => {
    // A climb from x 160 at the floor, its cart waiting: dropped from 12 px over the floor with his feet 5 px behind the rail's start (his
    // body still over the cart's back), he lands on the step his feet reach the floor of its start, 8 px over the rail's ground there:
    // the 5th (the floor 5 px lower, read past the start, would take a step more). Then its back wall holds him.
    const up = rail(160, [{ kind: 'climb', tiles: 10 }]);
    const l1 = levelOf([up]);
    const back = play(l1, runWith(l1, { ...spawn(155, FLOOR - 12), grounded: false }), 10);
    expect(back.findIndex((s) => s.player.grounded)).toBe(4);
    // A descent to the floor, its cart at its buffer: his feet 5 px past the rail's end read its end.
    const down = rail(160, [{ kind: 'descent', tiles: 10 }], { y: FLOOR - 160 });
    const l2 = levelOf([down]);
    const front = play(l2, runWith(l2, { ...spawn(325, FLOOR - 40), grounded: false }, [{ phase: 'stopped', m: 144 }]), 60);
    expect(front[59]!.player).toMatchObject({ grounded: true, y: FLOOR - 8 });
  });

  it('GDD-WLD-15 at a buffer the cart stops with its front at the rail\'s end and he walks off it', () => {
    const r = rail(160, level(10)); // its end at x 320, 160 px across
    const lvl = levelOf([r]);
    const states = play(lvl, riding(lvl, 16), 360, (i) => (i < 300 ? idle : right));
    const at = states.findIndex((s) => s.carts[0]!.phase === 'stopped');
    expect(at).toBeGreaterThan(0);
    expect(states[at]!.carts[0]!.m).toBe(160 - 16);
    expect(cartFloor(r, states[at]!.carts[0]!).x + 32).toBe(320);
    expect(states.slice(at, 300).every((s) => s.carts[0]!.phase === 'stopped' && s.carts[0]!.m === 144 && inCart(lvl, s))).toBe(true);
    expect(states[359]!.player).toMatchObject({ grounded: true, y: FLOOR });
    expect(states[359]!.player.x).toBeGreaterThan(320 + 6); // a stopped cart's walls hold nobody: he walks off its front
    // A stopped cart gives him no carried speed: off its front his speed is his own.
    expect(states.slice(300).every((s) => s.player.carry === undefined && s.player.vx <= 120)).toBe(true);
  });

  it('GDD-WLD-15 a buffer does not block Poncho', () => {
    const lvl = levelOf([rail(160, level(10))]);
    const there = play(lvl, runWith(lvl, spawn(300, FLOOR)), 40, () => right);
    expect(there[39]!.player.x).toBeGreaterThan(340);
    const back = play(lvl, there[39]!, 60, () => left);
    expect(back[59]!.player.x).toBeLessThan(300);
    expect([...there, ...back].every((s) => s.player.y === FLOOR)).toBe(true);
  });

  it('GDD-WLD-15 a cart that rolls left is mirrored', () => {
    const r = rail(600, level(10), { dir: -1 }); // from x 600 left to x 440
    const lvl = levelOf([r]);
    const long = levelOf([rail(600, level(20), { dir: -1 })]);
    const states = play(long, riding(long, 16), 60);
    expect(middle(long, riding(long, 16))).toBe(584);
    expect(middle(long, states[59]!)).toBeCloseTo(584 - 150, 6);
    expect(states[59]!.player.x).toBeCloseTo(584 - 150, 6);
    const stops = play(lvl, riding(lvl, 16), 120);
    expect(stops[119]!.carts[0]).toEqual({ phase: 'stopped', m: 160 - 16 });
    expect(cartFloor(r, stops[119]!.carts[0]!).x).toBe(440); // its left edge at the rail's end
    // On a slope too: rolling left up a climb, a rider 10 px ahead of the middle and one 10 px behind stand 8 px over the rail under them.
    const upLeft = levelOf([rail(600, [{ kind: 'climb', tiles: 10 }], { dir: -1 })]);
    for (const dx of [-10, 10]) {
      for (const s of play(upLeft, riding(upLeft, 50, { dx }), 20)) expect(s.player.y).toBeCloseTo(FLOOR - (600 - s.player.x) - 8, 6);
    }
    // Its walls mirrored: holding left (forward, the way it rolls) he stands 10 px left of its middle.
    const held = play(long, riding(long, 40), 40, () => left)[39]!;
    expect(held.player.x - middle(long, held)).toBeCloseTo(-10, 9);
    // The carry rule mirrored: a full jump straight up keeps -150 px/s and lands him back in it, his speed in it 0 again.
    const from = riding(long, 40);
    const jump = jumpFrom(long, from);
    expect(jump.slice(0, -1).every((s) => s.player.vx === -150 && s.player.carry === -150)).toBe(true);
    expect(inCart(long, jump[jump.length - 1]!)).toBe(true);
    expect(jump[jump.length - 1]!.player.vx).toBe(0);
    // Walking against the roll (right) at 150 px/s in it as he jumps, his own speed counts up to 120: -30 px/s; walking with it, none.
    expect(jumpFrom(long, riding(long, 40, { vx: 150 }), () => hold, { move: 1, jumpHeld: true })[0]!.player.vx).toBeCloseTo(-30, 9);
    expect(jumpFrom(long, riding(long, 40, { vx: -120 }), () => hold, { move: -1, jumpHeld: true })[0]!.player.vx).toBe(-150);
  });

  it('GDD-WLD-15 a lost life puts every cart back at its start, standing', () => {
    // Two rails; the first cart rolling, the second stopped at its buffer. Poncho stands on a spike (column 2) and loses a life.
    const lvl = levelOf([rail(160, level(20)), rail(640, level(10))], { spikes: [{ col: 2, row: 11 }] });
    const r: RunState = { ...runWith(lvl, spawn(40, FLOOR)), carts: [{ phase: 'rolling', m: 100 }, { phase: 'stopped', m: 144 }] };
    expect(startRun(lvl).carts).toEqual([{ phase: 'waiting', m: 16 }, { phase: 'waiting', m: 16 }]);
    const hit = stepRun(r, idle, lvl);
    expect(hit.phase).toBe('respawning');
    const back = play(lvl, hit, RESPAWN.delaySteps)[RESPAWN.delaySteps - 1]!;
    expect(back.phase).toBe('playing');
    expect(back.carts).toEqual([{ phase: 'waiting', m: 16 }, { phase: 'waiting', m: 16 }]);
  });

  it('GDD-WLD-15 a cart he stands in is not carried into a solid tile', () => {
    // A low beam: a tile at column 20 (x 320 to 336), row 9, its underside at y 160, 2 tiles (32 px) over the rail's ground.
    const lvl = levelOf([rail(160, level(40))], { world: withTiles([[20, 9]]) });
    const states = play(lvl, riding(lvl, 16), 200);
    const empty = play(lvl, runWith(lvl, spawn(40, FLOOR), [{ phase: 'rolling', m: 16 }]), 200);
    expect(states.map((s) => s.carts[0]!.m)).toEqual(empty.map((s) => s.carts[0]!.m)); // the cart rolls on
    expect(Math.max(...states.map((s) => s.player.x))).toBeLessThanOrEqual(320 - 6 + 1e-6); // he is left behind at the beam's face
    expect(states[199]!.player).toMatchObject({ grounded: true, y: FLOOR }); // dropped 8 px to the ground, standing
    // The walls do not pull him through the beam: he is left behind the cart's back.
    expect(cartFloor(lvl.rails![0]!, states[199]!.carts[0]!).x - states[199]!.player.x).toBeGreaterThan(10);
    expect(states.every((s) => s.phase === 'playing')).toBe(true);
    // A walker passes under it: his 32 px body fits the 2 tiles.
    const walk = play(lvl, runWith(lvl, spawn(280, FLOOR)), 60, () => right);
    expect(walk[59]!.player.x).toBeGreaterThan(336 + 6);
  });
});

describe('GDD-WLD-15 the carry rule', () => {
  const R = rail(32, level(90));
  const lvl = levelOf([R]);

  it('a full jump straight up lands him back in the cart after 0.55 s and 85.0 px', () => {
    const from = riding(lvl, 100);
    const states = jumpFrom(lvl, from);
    const last = states[states.length - 1]!;
    expect(states.length - 1).toBe(33); // 0.55 s
    expect(inCart(lvl, last)).toBe(true);
    // From where he stood at the start of the takeoff step, the base of every distance here: 34 steps of 2.5 px (the GDD's scratch figure
    // was 82.7).
    expect(measure(states, from).across).toBeCloseTo(85.0, 1);
    expect(last.player.x - middle(lvl, last)).toBeCloseTo(from.player.x - middle(lvl, from), 6); // he never drifts in the cart
    expect(states.slice(0, -1).every((s) => s.player.carry === 150)).toBe(true);
  });

  it('forward input holds exactly the cart\'s speed', () => {
    const from = riding(lvl, 100);
    const still = jumpFrom(lvl, from);
    // From the first step in the air (on the takeoff step forward input walks him 0.11 px in the cart first, his own speed then cut to 0).
    const forward = jumpFrom(lvl, from, () => ({ move: 1, jumpHeld: true }));
    expect(forward.map((s) => s.player.x)).toEqual(still.map((s) => s.player.x));
    expect(forward.map((s) => s.player.vx)).toEqual(still.map((s) => s.player.vx));
    const fromTakeoff = jumpFrom(lvl, from, () => ({ move: 1, jumpHeld: true }), { move: 1, jumpHeld: true });
    expect(fromTakeoff.length).toBe(still.length);
    expect(fromTakeoff.slice(0, -1).every((s) => s.player.vx === 150)).toBe(true);
  });

  it('with the glide held he lands back in it after 1.12 s and 170.0 px', () => {
    const glide = levelOf([R], { abilities: { glide: true } });
    const from = riding(glide, 100);
    const states = jumpFrom(glide, from);
    expect(states.some((s) => s.player.gliding)).toBe(true);
    expect(inCart(glide, states[states.length - 1]!)).toBe(true);
    expect(measure(states, from).steps).toBe(67); // measured 1.12 s (the GDD's 1.13 s would be 68 steps)
    expect(measure(states, from).across).toBeCloseTo(170.0, 1);
  });

  it('holding against the roll the cart leaves him', () => {
    const from = riding(lvl, 100);
    const states = jumpFrom(lvl, from, () => ({ move: -1, jumpHeld: true }), { move: -1, jumpHeld: true });
    const last = states[states.length - 1]!;
    expect(last.player.y).toBe(FLOOR); // on the rail's ground, not in the cart
    // 28.9 px ahead of where he stood and 58.6 px behind the cart's middle (the GDD's scratch figures were 27.9 and 55).
    expect(last.player.x - from.player.x).toBeCloseTo(28.9, 1);
    expect(middle(lvl, last) - last.player.x).toBeCloseTo(58.6, 1);
    expect(states.slice(0, -1).every((s) => s.player.vx >= 30 - 1e-9)).toBe(true);
    // Holding against the roll only once in the air, he turns to face the way he holds.
    expect(jumpFrom(lvl, from, () => ({ move: -1, jumpHeld: true }))[5]!.player.facing).toBe(-1);
    expect(Math.min(...states.slice(1, -1).map((s) => s.player.vx))).toBeCloseTo(30, 9); // he does slow all the way to 150 - 120
  });

  it('he is never faster across than the cart he left', () => {
    // Walking forward inside it at 120 px/s when he jumps.
    const states = jumpFrom(lvl, riding(lvl, 100, { vx: 120 }), () => ({ move: 1, jumpHeld: true }), { move: 1, jumpHeld: true });
    expect(states.length).toBeGreaterThan(20);
    expect(states.slice(0, -1).every((s) => Math.abs(s.player.vx) <= 150 + 1e-6)).toBe(true);
    expect(states[0]!.player.vx).toBe(150);
  });

  it('walking against the roll at takeoff takes his own speed off the cart\'s', () => {
    const states = jumpFrom(lvl, riding(lvl, 100, { vx: -120 }), () => hold, { move: -1, jumpHeld: true });
    expect(states[0]!.player.vx).toBeCloseTo(30, 9);
    expect(states[1]!.player.vx).toBeCloseTo(30 + 600 / 60, 9); // then back towards 150 at 600 px/s² with no input
    // Faster than RUN.maxSpeed against the roll (just landed in it from a standstill), his own speed counts only up to 120.
    expect(jumpFrom(lvl, riding(lvl, 100, { vx: -150 }), () => hold, { move: -1, jumpHeld: true })[0]!.player.vx).toBeCloseTo(30, 9);
  });

  it('GDD-WLD-15 holding against the roll slows him by his normal run speed also while the Chile Fantasma runs', () => {
    const from: RunState = { ...riding(lvl, 100), fantasma: 300 };
    const states = jumpFrom(lvl, from, () => ({ move: -1, jumpHeld: true }), { move: -1, jumpHeld: true });
    expect(FANTASMA.runSpeed).toBe(180);
    expect(states.slice(0, -1).every((s) => s.fantasma > 0 && s.player.vx >= 30 - 1e-9)).toBe(true);
    expect(Math.min(...states.slice(1, -1).map((s) => s.player.vx))).toBeCloseTo(150 - 120, 9);
  });

  // The GDD's scratch 46.8 and 70.2 px were its flat jump's 0.55 s at the cart's speed; the floor rising (falling) to meet him lands him
  // sooner (later).
  it('a jump from a climbing cart carries 84.9 px/s across: 38.2 px', () => {
    const up = levelOf([rail(32, [{ kind: 'climb', tiles: 10 }], { y: FLOOR })], { world: rows(() => '.'.repeat(COLS)) });
    const from = riding(up, 100);
    const states = jumpFrom(up, from);
    expect(states[1]!.player.vx).toBeCloseTo(84.85, 2);
    expect(inCart(up, states[states.length - 1]!)).toBe(true);
    expect(measure(states, from).across).toBeCloseTo(38.2, 1);
  });

  it('a jump from a descending cart carries 127.3 px/s: 108.2 px', () => {
    const down = levelOf([rail(32, [{ kind: 'descent', tiles: 10 }], { y: FLOOR - 160 })]);
    const from = riding(down, 30);
    const states = jumpFrom(down, from);
    expect(states[1]!.player.vx).toBeCloseTo(127.28, 2);
    expect(inCart(down, states[states.length - 1]!)).toBe(true);
    expect(measure(states, from).across).toBeCloseTo(108.2, 1);
  });

  it('on landing on the ground his speed is his own: from 150 px/s he is at 120 in 3 steps holding forward, and stops in 9 steps and 11.25 px with no input', () => {
    // The rail ends at a buffer at x 192 with ground beyond; a jump with the cart 44 px from its stop carries him past it onto the ground.
    const r = rail(32, level(10));
    const l = levelOf([r]);
    const states = jumpFrom(l, riding(l, 100));
    const landing = states[states.length - 1]!;
    expect(landing.player).toMatchObject({ grounded: true, y: FLOOR, vx: 150 });
    expect(landing.player.carry).toBeUndefined();
    expect(landing.player.x).toBeGreaterThan(192 + 6);
    const forward = play(l, landing, 3, () => right);
    expect(forward.map((s) => s.player.vx)).toEqual([150 - 800 / 60, 150 - 1600 / 60, 120].map((v) => expect.closeTo(v, 9)));
    const stop = play(l, landing, 9);
    expect(stop[7]!.player.vx).toBeGreaterThan(0);
    expect(stop[8]!.player.vx).toBe(0);
    expect(stop[8]!.player.x - landing.player.x).toBeCloseTo(11.25, 6); // the GDD's scratch figure was 11.2
  });

  it('a wall ends it and he drops straight down its face', () => {
    // A wall at column 9 (x 144), rows 0 to 10, ahead of him.
    const l = levelOf([R], { world: rows((r) => (r <= 10 ? '.'.repeat(9) + '#' + '.'.repeat(COLS - 10) : '.'.repeat(COLS))) });
    const from = riding(l, 100); // his x 132, his box's front 138, the wall's face at 144
    const states = jumpFrom(l, from);
    // The step his box reaches the wall's face, well before he lands: from it on no carried speed, no speed across, and he stays at the face.
    const hit = states.findIndex((s) => s.player.x === 144 - 6);
    expect(hit).toBeGreaterThan(0);
    expect(hit).toBeLessThan(states.length - 10);
    expect(states.slice(0, hit).every((s) => s.player.carry === 150)).toBe(true);
    expect(states.slice(hit).every((s) => s.player.x === 144 - 6 && s.player.vx === 0 && s.player.carry === undefined)).toBe(true);
    expect(states[states.length - 1]!.player).toMatchObject({ grounded: true, y: FLOOR });
  });

  it('a sand slope\'s high side is a wall too: it ends the carried speed', () => {
    // GDD-MOV-09: a '\\' slope at column 9 (x 144), row 11, its high side (y 176) 14 px over his feet as he flies low at the carried speed:
    // the middle of his feet stops at it.
    const world = rows((r) => (r === 11 ? '.'.repeat(9) + '\\' + '.'.repeat(COLS - 10) : '.'.repeat(COLS)));
    const flying: PlayerState = { ...spawn(142.5, FLOOR - 2), grounded: false, vx: 150, carry: 150 };
    const after = step(flying, idle, world);
    expect(after).toMatchObject({ x: 142.5, vx: 0 });
    expect(after.carry).toBeUndefined();
  });

  it('the carried speed does not follow the cart', () => {
    // 6 level tiles (the join at 96 px), then up: a jump with the middle at 90 takes off at 150 px/s; the cart slows to 84.85 at the join.
    const l = levelOf([rail(32, [{ kind: 'level', tiles: 6 }, { kind: 'climb', tiles: 10 }])]);
    const states = jumpFrom(l, riding(l, 90));
    expect(states.length).toBeGreaterThan(20);
    expect(states.slice(0, -1).every((s) => s.player.vx === 150 && s.player.carry === 150)).toBe(true);
    expect(states[10]!.carts[0]!.m - states[9]!.carts[0]!.m).toBeCloseTo(84.85 / 60, 4);
  });

  it('a carried speed left on a standing Poncho is dropped: his next jump is his own', () => {
    // A landing `step()` does not see (a moving block's top) leaves `carry` set on a grounded Poncho.
    let p: PlayerState = { ...spawn(80, FLOOR), carry: 150 };
    const world = rows();
    p = step(p, { move: 0, jumpHeld: true }, world);
    expect(p.grounded).toBe(false);
    expect(p.carry).toBeUndefined();
    for (let i = 0; i < 10; i++) p = step(p, { move: 0, jumpHeld: true }, world);
    expect(p.vx).toBe(0);
    expect(p.x).toBe(80);
  });

  it('a moving platform still gives none of its speed to a jump', () => {
    const across: MovingPlatform = { x0: 100, y0: 128, x1: 400, y1: 128, w: 48 };
    const l = levelOf([], { platforms: [across] });
    const from = runWith(l, spawn(124, 128));
    const states = jumpFrom(l, from);
    expect(states.length).toBeGreaterThan(20);
    expect(Math.max(...states.map((s) => Math.abs(s.player.x - from.player.x)))).toBeLessThan(1);
    expect(states.every((s) => s.player.carry === undefined)).toBe(true);
  });

  it('landing in a rolling cart makes his speed relative again', () => {
    const from = riding(lvl, 100);
    const states = jumpFrom(lvl, from);
    const landing = states[states.length - 1]!;
    expect(states[states.length - 2]!.player.vx).toBe(150);
    expect(landing.player.vx).toBe(150 - 150);
    expect(landing.player.carry).toBeUndefined(); // landing ends it
    const after = play(lvl, landing, 30);
    expect(after.every((s) => inCart(lvl, s) && Math.abs(s.player.x - middle(lvl, s) - (from.player.x - middle(lvl, from))) < 1e-6)).toBe(true);
  });

  it('boarding a rolling cart: a drop onto a passing cart lands and rides', () => {
    // User, 2026-11-11: "A rolling cart can be boarded." Falling at a standstill over the path of a cart rolling at m 100 (its middle x 132):
    // it is under him 9 steps later with his x near its front, and he slides back 11.25 px in it as his speed in the cart comes to 0.
    const r: RunState = runWith(lvl, { ...spawn(165, FLOOR - 30), grounded: false }, [{ phase: 'rolling', m: 100 }]);
    const states = play(lvl, r, 60);
    const at = states.findIndex((s) => s.player.grounded);
    expect(at).toBeGreaterThan(0);
    expect(states[at]!.player.y).toBeCloseTo(FLOOR - 8, 9);
    expect(states[at]!.player.vx).toBeCloseTo(-150, 9); // he landed at a standstill: in the cart he moves back at its speed, then stops
    expect(states.slice(at).every((s) => inCart(lvl, s))).toBe(true);
    expect(states[59]!.player.x).toBeGreaterThan(states[at]!.player.x + 50); // and rides with it
  });
});

describe('GDD-WLD-15 boarding and acting in a rolling cart', () => {
  const R = rail(32, level(90));
  const lvl = levelOf([R]);

  it('GDD-CMB-03 a hit in the air ends the carried speed', () => {
    // A spike hanging at column 9, row 8 (it hurts through y 136 to 144), over his way up from a cart at 150 px/s; in Taco he lives.
    const l = levelOf([R], { spikes: [{ col: 9, row: 8 }] });
    const states = jumpFrom(l, { ...riding(l, 100), power: 'taco' });
    const hit = states.findIndex((s) => s.power === 'base');
    expect(hit).toBeGreaterThan(0);
    expect(states.slice(0, hit).every((s) => s.player.carry === 150)).toBe(true);
    expect(states[hit]!.player.grounded).toBe(false);
    expect(states[hit]!.player.carry).toBeUndefined();
    expect(states[hit]!.player.vx).toBe(-HIT.knockback); // pushed back, away from the spike's middle
    expect(states[hit + 1]!.player.vx).toBeCloseTo(-HIT.knockback + 300 / 60, 9); // then slowing at the air deceleration, as any knockback
  });

  it('GDD-WLD-15 a rolling cart\'s walls hold him: holding forward he stands at its front, 10 px ahead of its middle', () => {
    // A rail of 20 level tiles from x 32: forward held all the way, he walks to its front wall and rides there to the buffer.
    const l = levelOf([rail(32, level(20))]);
    const states = play(l, riding(l, 16), 200, (_i, r) => (r.carts[0]!.phase === 'stopped' ? idle : right));
    expect(states[59]!.player.x - middle(l, states[59]!)).toBe(10);
    expect(states[59]!.player.vx).toBe(0);
    const stop = states.findIndex((s) => s.carts[0]!.phase === 'stopped');
    expect(stop).toBeGreaterThan(59);
    expect(states.slice(0, stop).every((s) => inCart(l, s) && s.player.x - middle(l, s) <= 10 + 1e-9)).toBe(true);
    expect(inCart(l, states[stop]!)).toBe(true); // in it at the buffer, where a stopped cart holds him no more
  });

  it('GDD-WLD-15 a rolling cart\'s walls hold him: holding back he stands at its back, 10 px behind its middle', () => {
    const states = play(lvl, riding(lvl, 100), 60, () => left);
    expect(states[59]!.player.x - middle(lvl, states[59]!)).toBe(-10);
    expect(states.every((s) => inCart(lvl, s))).toBe(true);
  });

  it('GDD-WLD-15 a rolling cart\'s walls hold him: a hop at full run into a standing cart\'s front stays in it', () => {
    // At full run (120 px/s) and holding forward, he comes down onto a waiting cart's floor 12 to 16 px ahead of its middle (x 48): the
    // landing starts it, and its front wall holds him from that step.
    const l = levelOf([rail(32, level(20))]);
    for (const ahead of [12, 13, 14, 15, 16]) {
      const r = runWith(l, { ...spawn(48 + ahead - 2, FLOOR - 8 - 1), grounded: false, vx: 120, vy: 60 });
      const states = play(l, r, 200, (_i, s) => (s.carts[0]!.phase === 'stopped' ? idle : right));
      expect(states[0]!.carts[0]!.phase, `${ahead}`).toBe('rolling');
      expect(states[0]!.player.x - middle(l, states[0]!), `${ahead}`).toBe(10);
      const stop = states.findIndex((s) => s.carts[0]!.phase === 'stopped');
      expect(states.slice(0, stop + 1).every((s) => inCart(l, s)), `${ahead}`).toBe(true);
    }
  });

  it('GDD-WLD-15 a rolling cart\'s walls hold him: a standing drop into a passing cart: he slides back to its back wall and stays in', () => {
    // Landing at a standstill his speed in it is -150 px/s, and he slides back until its back wall stops him, wherever his box landed over
    // its floor; he rides it to its buffer. Landing at its middle, the slide is 10 px (it would be 11.25 px, past the wall, with no wall).
    const l = levelOf([rail(32, level(30))]);
    /** A standing drop that lands in the cart rolling at m 100 on this step, `d` px from its middle after the step. */
    const dropAt = (d: number): RunState[] => {
      const at = 32 + 100 + 150 / 60; // the middle after the landing step
      return play(l, runWith(l, { ...spawn(at + d, FLOOR - 8 - 0.05), grounded: false, vy: 60 }, [{ phase: 'rolling', m: 100 }]), 200);
    };
    for (const d of [-21, -16, -10.75, -5, 0, 5, 10, 16, 21]) {
      const states = dropAt(d);
      expect(states[0]!.player.grounded, `${d}`).toBe(true);
      const stop = states.findIndex((s) => s.carts[0]!.phase === 'stopped');
      expect(stop, `${d}`).toBeGreaterThan(0);
      expect(states.slice(0, stop + 1).every((s) => inCart(l, s) && s.player.x - middle(l, s) >= -10), `${d}`).toBe(true);
    }
    const mid = dropAt(0);
    const slid = mid.map((s) => s.player.x - middle(l, s));
    expect(slid[0]).toBeCloseTo(0, 9);
    expect(Math.min(...slid)).toBe(-10);
    expect(mid[10]!.player.vx).toBe(0);
  });

  it('GDD-WLD-15 a rolling cart\'s walls hold him: on a slope the wall puts him on the floor under his new x', () => {
    // A climb from x 160 over air, forward held: at its front wall his feet are 8 px over the rail's ground 10 px ahead of the middle.
    const up = levelOf([rail(160, [{ kind: 'climb', tiles: 12 }])]);
    const states = play(up, riding(up, 40), 40, () => right);
    for (const s of states.slice(20)) {
      expect(s.player.x - middle(up, s)).toBeCloseTo(10, 9);
      expect(s.player.y).toBeCloseTo(FLOOR - (middle(up, s) + 10 - 160) - 8, 6);
    }
  });

  it('GDD-WLD-15 the claw swings from a rolling cart', () => {
    const states = play(lvl, riding(lvl, 100), 6, (i) => ({ ...idle, claw: i === 0 }));
    const swing = states.find((s) => s.claw.phase === 'swing')!;
    expect(swing).toBeDefined();
    expect(inCart(lvl, swing)).toBe(true);
    // Its box in front of him where he is now, as from any floor (GDD-CMB-02).
    expect(clawBox(swing.player, swing.claw)).toEqual({ x0: swing.player.x + 6, x1: swing.player.x + 6 + 20, y0: swing.player.y - 32, y1: swing.player.y });
  });

  it('GDD-WLD-15 Fuego is spat from a rolling cart', () => {
    const [spat] = play(lvl, { ...riding(lvl, 100), power: 'fuego' }, 1, () => ({ ...idle, fuego: true }));
    expect(spat!.fireballs).toHaveLength(1);
    expect(inCart(lvl, spat!)).toBe(true);
    // From his front where he is after the step, at its own 180 px/s: the cart's speed is not added (GDD-PWR-03).
    expect(spat!.fireballs[0]).toEqual(spawnFireball(spat!.player));
    expect(spat!.fireballs[0]!.vx).toBe(180);
  });
});

describe('GDD-WLD-15 jump rules on a cart', () => {
  const R = rail(160, level(60));
  const lvl = levelOf([R]);

  it('GDD-MOV-03 a jump buffered before landing in a waiting cart jumps from it and the cart rolls', () => {
    // Falling into it from 40 px up; jump pressed 3 steps before the landing step and held.
    const drop = runWith(lvl, { ...spawn(176, FLOOR - 40), grounded: false });
    const plain = play(lvl, drop, 60);
    const land = plain.findIndex((s) => s.player.grounded);
    const states = play(lvl, drop, 60, (i) => ({ move: 0, jumpHeld: i >= land - 3 }));
    expect(states[land]!.carts[0]).toEqual({ phase: 'rolling', m: 16 });
    expect(states[land]!.player.grounded).toBe(true);
    expect(states[land + 1]!.player).toMatchObject({ grounded: false, carry: 150 }); // takes off on the next step
    const back = states.findIndex((s, i) => i > land + 1 && s.player.grounded);
    expect(back).toBeGreaterThan(land + 20);
    expect(inCart(lvl, states[back]!)).toBe(true);
    expect(states[back]!.carts[0]!.phase).toBe('rolling');
  });

  it('GDD-MOV-02 a short hop from a rolling cart lands back in it', () => {
    const from = riding(lvl, 100, { dx: 4 });
    const states = jumpFrom(lvl, from, () => idle, hold);
    const last = states[states.length - 1]!;
    expect(states.length).toBeLessThan(20); // a hop, not a full jump
    expect(inCart(lvl, last)).toBe(true);
    expect(last.player.x - middle(lvl, last)).toBeCloseTo(4, 6);
  });

  it('GDD-MOV-07 a jump held from a rolling cart glides at the carried speed', () => {
    const glide = levelOf([R], { abilities: { glide: true } });
    const states = jumpFrom(glide, riding(glide, 100));
    const gliding = states.filter((s) => s.player.gliding);
    expect(gliding.length).toBeGreaterThan(20);
    expect(gliding.every((s) => s.player.vx === 150)).toBe(true);
  });

  it('GDD-LIFE-02 jump held through a respawn does not jump out of a cart', () => {
    // Spawned on a ledge tile beside the cart's back with jump held from the respawn: he walks off it into the cart, holding jump.
    const l: Level = { ...levelOf([R], { world: withTiles([[9, 11]]) }), spawn: { x: 150, y: FLOOR - TILE } };
    let r: RunState = { ...startRun(l), player: { ...spawn(150, FLOOR + 400), grounded: false } };
    r = stepRun(r, hold, l);
    expect(r.phase).toBe('respawning');
    for (let i = 0; i < 200 && r.phase !== 'playing'; i++) r = stepRun(r, hold, l);
    const states = play(l, r, 80, (_i, s) => ({ move: s.carts[0]!.phase === 'waiting' ? 1 : 0, jumpHeld: true }));
    const at = states.findIndex((s) => s.carts[0]!.phase === 'rolling');
    expect(at).toBeGreaterThan(0);
    expect(states.slice(at).every((s) => s.player.grounded && inCart(l, s))).toBe(true);
  });
});

describe('GDD-BOS-01 hit-stop and carts', () => {
  it('GDD-BOS-01 a hit-stop holds a rolling cart', () => {
    // The hit-stop is the scene loop's (`hitStopSteps`): a held tick runs no step. This plays that loop over 1-4 with a rail added and its
    // cart rolling: a claw hit on Don Zopilote stuck in the sand holds 4 ticks, and the cart does not move in them.
    const l: Level = { ...LEVEL_1_4, rails: [rail(16, level(26), { y: 14 * TILE })] };
    let run: RunState = { ...startRun(l), player: { ...spawn(200, 224), grounded: true }, boss: { ...bossStart(LEVEL_1_4.boss!, 0), mode: 'stuck', age: 0, x: 232, y: 209, tx: 232, ty: 209 }, carts: [{ phase: 'rolling', m: 16 }] };
    let holding = 0;
    const ms: number[] = [];
    const held: boolean[] = [];
    for (let tick = 1; tick <= 10; tick++) {
      held.push(holding > 0);
      if (holding > 0) holding--;
      else {
        const before = run;
        run = stepRun(run, { ...idle, claw: tick === 1 }, l);
        holding = hitStopSteps(before, run);
      }
      ms.push(run.carts[0]!.m);
    }
    expect(held).toEqual([false, false, false, true, true, true, true, false, false, false]);
    expect(ms.slice(2, 7).every((m) => m === ms[2])).toBe(true);
    expect(ms[7]!).toBeCloseTo(ms[2]! + 2.5, 9);
    expect(railLength(l.rails![0]!)).toBe(26 * TILE);
  });
});
