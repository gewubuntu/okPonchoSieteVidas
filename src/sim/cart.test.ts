import { describe, expect, it } from 'vitest';
import { CART, FANTASMA, HIT, RESPAWN, SPIKE, TILE } from '../config/tuning';
import { LEVEL_1_4 } from '../levels/level1-4';
import { bossBox, bossStart } from './boss';
import { cartFloor, fallingBox, floorUnder, railLength, rollCarts, warningPost, type CartState, type Rail, type RailSegment } from './cart';
import { clawBox } from './claw';
import { enemyBox, freshEnemies, type Box, type Enemy, type EnemyState } from './enemy';
import { spawnFireball } from './fireball';
import { hitStopSteps } from './hitStop';
import { blocked, spawn, step, type Abilities, type PlayerInput, type PlayerState } from './movement';
import { standsOnPlatform, type MovingPlatform } from './platform';
import { startRun, stepRun, type Level, type RunState } from './run';
import { parseTiles } from './tilemap';
import { stun } from './trompo';

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
const rail = (x: number, segments: readonly RailSegment[], o: { y?: number; dir?: 1 | -1; end?: Rail['end'] } = {}): Rail => ({ x, y: o.y ?? FLOOR, dir: o.dir ?? 1, segments, end: o.end ?? 'buffer' });
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
 * A world whose ground follows a rail: under each level tile solid tiles from the rail's ground down to the floor, under each tile of a climb
 * or a descent a slope tile on solid tiles (GDD-MOV-09), so the rail lies on the ground. Rolling right a climb is '/', a descent '\\';
 * rolling left the other way round.
 */
function trackWorld(r: Rail) {
  const grid = Array.from({ length: 13 }, (_, row) => Array.from({ length: COLS }, (): string => (row === 12 ? '#' : '.')));
  let col = r.dir > 0 ? r.x / TILE : r.x / TILE - 1;
  let top = r.y / TILE;
  for (const seg of r.segments) {
    for (let k = 0; k < seg.tiles; k++, col += r.dir) {
      const slope = seg.kind === 'climb' ? top - 1 : seg.kind === 'descent' ? top : -1;
      if (slope >= 0) grid[slope]![col] = (seg.kind === 'climb') === r.dir > 0 ? '/' : '\\';
      for (let row = seg.kind === 'descent' ? top + 1 : top; row < 12; row++) grid[row]![col] = '#';
      if (seg.kind === 'climb') top--;
      if (seg.kind === 'descent') top++;
    }
  }
  return parseTiles(grid.map((row) => row.join('')));
}
/** The ground under x of a rail of 4 level tiles, 4 tiles of `kind` from `y0`, then 6 level tiles: from the GDD's shape. */
const joinGround = (kind: 'climb' | 'descent', y0: number, r: Rail) => (x: number): number => {
  const a = Math.min(14 * TILE, Math.max(0, r.dir * (x - r.x)));
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
    expect(busy[10]!.player.facing).toBe(-1); // he did turn about
    expect(busy.some((s) => !s.player.grounded)).toBe(true); // and jump
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

  it('GDD-WLD-15 on a slope he stands 8 px over the rail under the cart\'s middle', () => {
    // A climb from x 160 (FLOOR) over air; the cart's middle at 50 px across. Put 10 px ahead of it or behind it, he is anchored at its
    // middle on the first step, on the floor 8 px over the rail there, and stays there.
    const r = rail(160, [{ kind: 'climb', tiles: 10 }]);
    const lvl = levelOf([r]);
    const ground = (x: number) => FLOOR - (x - 160);
    for (const dx of [10, -10]) {
      for (const s of play(lvl, riding(lvl, 50, { dx }), 30)) {
        expect(inCart(lvl, s)).toBe(true);
        expect(s.player.x).toBeCloseTo(middle(lvl, s), 9);
        expect(s.player.y).toBeCloseTo(ground(middle(lvl, s)) - 8, 6);
      }
    }
    // Dropped into it 10 px behind its middle, he lands on the floor under his own feet, and on that step is at its middle, on the floor there.
    const drop = play(lvl, runWith(lvl, { ...spawn(160 + 50 - 10, FLOOR - 120), grounded: false }, [{ phase: 'waiting', m: 50 }]), 60);
    const at = drop.findIndex((s) => s.player.grounded);
    expect(drop[at]!.player.x).toBe(160 + 50);
    expect(drop[at]!.player.y).toBeCloseTo(ground(160 + 50) - 8, 6);
  });

  for (const kind of ['descent', 'climb'] as const) {
    for (const ground of ['air', 'slope tiles'] as const) {
      for (const dir of [1, -1] as const) {
        it(`GDD-WLD-15 he stays anchored over a join, a ${kind} over ${ground}, rolling ${dir > 0 ? 'right' : 'left'}`, () => {
          // From x 160 (rolling right) or x 400 (left): 4 level tiles, 4 of the slope, 6 level; a descent starts 4 tiles up, a climb on the floor.
          const y0 = kind === 'descent' ? FLOOR - 64 : FLOOR;
          const r = rail(dir > 0 ? 160 : 400, [{ kind: 'level', tiles: 4 }, { kind, tiles: 4 }, { kind: 'level', tiles: 6 }], { y: y0, dir });
          const lvl = levelOf([r], ground === 'slope tiles' ? { world: trackWorld(r) } : {});
          const under = joinGround(kind, y0, r);
          // He holds nothing, forward, or back: he only turns.
          for (const held of [idle, right, left]) {
            const states = play(lvl, riding(lvl, 16), 120, () => held);
            const stop = states.findIndex((s) => s.carts[0]!.phase === 'stopped');
            expect(stop).toBeGreaterThan(40);
            // To the step before it stops at its buffer (a stopped cart anchors nobody, so on that step he walks if he holds a way).
            expect(inCart(lvl, states[stop]!)).toBe(true);
            for (const [i, s] of states.slice(0, stop).entries()) {
              expect(inCart(lvl, s), `held ${held.move}, step ${i}`).toBe(true);
              expect(s.player.x - middle(lvl, s), `held ${held.move}, step ${i}`).toBeCloseTo(0, 6);
              expect(s.player.y, `held ${held.move}, step ${i}`).toBeCloseTo(under(s.player.x) - 8, 6);
            }
          }
        });
      }
    }
  }

  /** A rail over air from x 160 whose last 4 tiles descend (from y 32): its cart stopped at its buffer stands on the descent, middle at x 240. */
  const DOWN_END = rail(160, [{ kind: 'level', tiles: 2 }, { kind: 'descent', tiles: 4 }], { y: FLOOR - 160 });
  /** The ground under x on it. */
  const downEnd = (x: number) => FLOOR - 160 + Math.max(0, x - 192);

  it('GDD-WLD-15 walking in a stopped cart on a descent keeps him on its floor', () => {
    // A stopped cart anchors nobody: walking forward from 10 px behind its middle, the floor falls away under his feet each step.
    const lvl = levelOf([DOWN_END]);
    const states = play(lvl, riding(lvl, 80, { dx: -10, phase: 'stopped' }), 12, () => right);
    expect(states[11]!.player.x - middle(lvl, states[11]!)).toBeGreaterThan(-10 + 5); // he did walk forward in it
    for (const s of states) {
      expect(s.player.grounded).toBe(true);
      expect(s.player.y).toBeCloseTo(downEnd(s.player.x) - 8, 6);
      expect(s.player.carry).toBeUndefined();
    }
  });

  it('GDD-MOV-07 a rider kept on a descending cart\'s floor is not gliding', () => {
    // Walking forward in a stopped cart on a descent with jump held since before (no new press), glide on: the floor falling away under his
    // feet keeps him on it, which ends a glide as landing does.
    const lvl = levelOf([DOWN_END], { abilities: { glide: true } });
    const from = riding(lvl, 80, { dx: -10, phase: 'stopped' });
    const states = play(lvl, { ...from, player: { ...from.player, jumpWasHeld: true, jumpHeldSteps: 30 } }, 12, () => ({ move: 1, jumpHeld: true }));
    expect(states[11]!.player.x - middle(lvl, states[11]!)).toBeGreaterThan(-10 + 5);
    for (const [i, s] of states.entries()) {
      expect(s.player.grounded, `step ${i}`).toBe(true);
      expect(s.player.gliding, `step ${i}`).toBe(false);
    }
  });

  it('GDD-MOV-08 a rider kept on a descending cart\'s floor is not clinging', () => {
    // A descent over air from x 160; a wall of tiles in column 14 (x 224), rows 0 to 5, in his way. Holding right (towards it) at the cart's
    // middle, he is stopped at its face while the cart rolls on down, and the floor falling away under his feet keeps him on it while he
    // presses the wall: standing on it ends a wall slide, as landing does.
    const r = rail(160, [{ kind: 'descent', tiles: 10 }], { y: FLOOR - 160 });
    const lvl = levelOf([r], { world: withTiles(Array.from({ length: 6 }, (_, row) => [14, row] as const)), abilities: { glide: false, wallCling: true } });
    const states = play(lvl, riding(lvl, 40), 40, () => right);
    const pressed = states.filter((s) => s.player.grounded && s.player.x === 224 - 6);
    expect(pressed.length).toBeGreaterThan(0); // he stood against the wall
    for (const [i, s] of states.entries()) if (s.player.grounded) expect(s.player.clinging, `step ${i}`).toBe(false);
  });

  it('GDD-WLD-15 a cart is not allowed to put him into a tile under a descent', () => {
    // Walking forward in the stopped cart on a descent from 10 px behind its middle (x 230; his feet's path y = x - 168), a square tile stands
    // under the rail where the floor falling away under his feet would take his box: he is never moved into it (he is left on its top instead).
    let onTop = 0;
    for (const [col, row] of [[14, 4], [15, 5], [14, 5], [15, 4]] as const) {
      const lvl = levelOf([DOWN_END], { world: withTiles([[col, row]]) });
      const states = play(lvl, riding(lvl, 80, { dx: -10, phase: 'stopped' }), 20, () => right);
      for (const [i, s] of states.entries()) expect(blocked(lvl.world, s.player.x, s.player.y), `tile ${col},${row}, step ${i}`).toBe(false);
      if (states.some((s) => s.player.grounded && s.player.y === row * TILE)) onTop++;
    }
    expect(onTop).toBeGreaterThan(0); // the tile did come under his feet
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
    expect(states[359]!.player.x).toBeGreaterThan(320 + 6); // a stopped cart anchors nobody: he walks off its front
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
    // On a slope too: rolling left up a climb, he stands at its middle 8 px over the rail there.
    const upLeft = levelOf([rail(600, [{ kind: 'climb', tiles: 10 }], { dir: -1 })]);
    for (const s of play(upLeft, riding(upLeft, 50), 20)) expect(s.player.y).toBeCloseTo(FLOOR - (600 - s.player.x) - 8, 6);
    // Anchored, holding left (forward, the way it rolls) he stays at its middle, facing left.
    const held = play(long, riding(long, 40), 40, () => left)[39]!;
    expect(held.player.x - middle(long, held)).toBeCloseTo(0, 9);
    expect(held.player.facing).toBe(-1);
    // The carry rule mirrored: a full jump straight up keeps -150 px/s and lands him back in it, his speed in it 0 again.
    const from = riding(long, 40);
    const jump = jumpFrom(long, from);
    expect(jump.slice(0, -1).every((s) => s.player.vx === -150 && s.player.carry === -150)).toBe(true);
    expect(inCart(long, jump[jump.length - 1]!)).toBe(true);
    expect(jump[jump.length - 1]!.player.vx).toBe(0);
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
    // The anchor does not pull him through the beam: he is left behind the cart's back.
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
    // 31.4 px ahead of where he stood and 56.1 px behind the cart's middle (measured with the anchor, his own speed in the cart 0 at takeoff;
    // before it, 28.9 and 58.6; the GDD's scratch figures were 27.9 and 55).
    expect(last.player.x - from.player.x).toBeCloseTo(31.4, 1);
    expect(middle(lvl, last) - last.player.x).toBeCloseTo(56.1, 1);
    expect(states.slice(0, -1).every((s) => s.player.vx >= 30 - 1e-9)).toBe(true);
    // Holding against the roll only once in the air, he turns to face the way he holds.
    expect(jumpFrom(lvl, from, () => ({ move: -1, jumpHeld: true }))[5]!.player.facing).toBe(-1);
    expect(Math.min(...states.slice(1, -1).map((s) => s.player.vx))).toBeCloseTo(30, 9); // he does slow all the way to 150 - 120
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

  it('a jump from the anchored middle keeps the cart\'s speed and lands back at the middle', () => {
    // Holding nothing, forward or back as he takes off: his speed across in the air is the cart's from the takeoff step (his own speed in
    // the cart, which the anchor holds at 0, is not added), and a jump with nothing held lands him back at its middle.
    for (const held of [0, 1, -1]) {
      const states = jumpFrom(lvl, riding(lvl, 100), () => hold, { move: held, jumpHeld: true });
      expect(states[0]!.player).toMatchObject({ grounded: false, vx: 150, carry: 150 });
      const last = states[states.length - 1]!;
      expect(inCart(lvl, last)).toBe(true);
      expect(last.player.x - middle(lvl, last)).toBeCloseTo(0, 6);
    }
  });
});

describe('GDD-WLD-15 a rider is anchored at the cart\'s middle', () => {
  // User, 2026-11-11: "If poncho lands on a cart he should be getting anchored in the middle."
  const L = levelOf([rail(32, level(20))]); // its cart's middle at x 48 at its start; its buffer at x 352

  it('GDD-WLD-15 landing anywhere on a waiting cart puts him at its middle on the landing step', () => {
    // Coming down onto its floor from 21 px behind its middle to 21 px ahead (his box still over it), standing or at full run (put 2 px
    // back, the 1.96 px the step carries him).
    for (const d of [-21, -16, -10, -3, 0, 3, 10, 16, 21]) {
      for (const vx of [0, 120]) {
        const states = play(L, runWith(L, { ...spawn(48 + d - vx / 60, FLOOR - 8 - 1), grounded: false, vx, vy: 60 }), 1);
        expect(states[0]!.player, `${d}, ${vx}`).toMatchObject({ grounded: true, x: 48, y: FLOOR - 8, vx: 0 });
        expect(states[0]!.carts[0], `${d}, ${vx}`).toEqual({ phase: 'rolling', m: 16 });
      }
    }
  });

  it('GDD-WLD-15 landing on a rolling cart puts him at its middle', () => {
    // User, 2026-11-11: "A rolling cart can be boarded." A standing drop that lands in the cart rolling at m 100 on this step, `d` px from its
    // middle after the step (his box over its floor): on that step he is at its middle, his speed in it 0, and he rides there to its buffer.
    const at = 32 + 100 + 150 / 60; // the middle after the landing step
    for (const d of [-21, -16, -10.75, -5, 0, 5, 10, 16, 21]) {
      const states = play(L, runWith(L, { ...spawn(at + d, FLOOR - 8 - 0.05), grounded: false, vy: 60 }, [{ phase: 'rolling', m: 100 }]), 200);
      expect(states[0]!.player, `${d}`).toMatchObject({ grounded: true, x: at, y: FLOOR - 8, vx: 0 });
      const stop = states.findIndex((s) => s.carts[0]!.phase === 'stopped');
      expect(stop, `${d}`).toBeGreaterThan(0);
      expect(states.slice(0, stop + 1).every((s) => inCart(L, s) && Math.abs(s.player.x - middle(L, s)) < 1e-6), `${d}`).toBe(true);
    }
    // A drop from 30 px over the path of a cart rolling at m 100 lands in it 9 steps later and rides at its middle.
    const r: RunState = runWith(L, { ...spawn(165, FLOOR - 30), grounded: false }, [{ phase: 'rolling', m: 100 }]);
    const states = play(L, r, 60);
    const landed = states.findIndex((s) => s.player.grounded);
    expect(landed).toBeGreaterThan(0);
    expect(states.slice(landed).every((s) => inCart(L, s) && s.player.x === middle(L, s) && s.player.vx === 0)).toBe(true);
  });

  it('GDD-WLD-15 holding forward or back in a rolling cart he stays at its middle and only turns', () => {
    for (const held of [right, left]) {
      const states = play(L, riding(L, 16), 60, () => held);
      for (const [i, s] of states.entries()) {
        expect(s.player.x - middle(L, s), `${held.move}, step ${i}`).toBeCloseTo(0, 6);
        expect(s.player.y, `${held.move}, step ${i}`).toBe(FLOOR - 8);
        expect(s.player.vx, `${held.move}, step ${i}`).toBe(0);
        expect(s.player.facing, `${held.move}, step ${i}`).toBe(held.move);
      }
    }
  });

  it('GDD-WLD-15 a hop at full run into a standing cart is anchored and rides to the buffer', () => {
    // At full run (120 px/s) and holding forward, he comes down onto a waiting cart's floor 12 to 16 px ahead of its middle (x 48).
    for (const ahead of [12, 13, 14, 15, 16]) {
      const r = runWith(L, { ...spawn(48 + ahead - 2, FLOOR - 8 - 1), grounded: false, vx: 120, vy: 60 });
      const states = play(L, r, 200, (_i, s) => (s.carts[0]!.phase === 'stopped' ? idle : right));
      expect(states[0]!.carts[0]!.phase, `${ahead}`).toBe('rolling');
      expect(states[0]!.player.x - middle(L, states[0]!), `${ahead}`).toBe(0);
      const stop = states.findIndex((s) => s.carts[0]!.phase === 'stopped');
      // To the step before it stops (on that step a stopped cart no longer anchors him, and he walks on forward in it).
      expect(states.slice(0, stop).every((s) => inCart(L, s) && Math.abs(s.player.x - middle(L, s)) < 1e-6), `${ahead}`).toBe(true);
      expect(inCart(L, states[stop]!), `${ahead}`).toBe(true);
    }
  });

  it('GDD-WLD-15 a low beam still takes him out: the anchor does not pull him through a tile', () => {
    // A tile at column 20 (x 320 to 336), row 9, its underside 32 px over the rail's ground: it stops him at its face, x 314, while the cart
    // rolls on; while its middle passes under the tile he is still over its floor, and is never put into the tile; then he drops off it.
    const beam = levelOf([rail(32, level(40))], { world: withTiles([[20, 9]]) });
    const states = play(beam, riding(beam, 100), 120);
    expect(states.every((s) => !blocked(beam.world, s.player.x, s.player.y))).toBe(true);
    expect(Math.max(...states.map((s) => s.player.x))).toBeLessThanOrEqual(320 - 6 + 1e-6);
    expect(states.some((s) => inCart(beam, s) && middle(beam, s) > 320 && middle(beam, s) < 336)).toBe(true); // on its floor, its middle under the tile
    expect(states[119]!.player).toMatchObject({ grounded: true, y: FLOOR });
  });

  it('GDD-WLD-15 a landing whose anchoring a tile refuses: he is left in the cart with his own speed until the beam takes him out', () => {
    // A level rail of 60 tiles from x 160 and a hanging beam at column 40 (x 640 to 656), its underside 32 px over the rail's ground. From the
    // cart at m 389.5 a held jump (40 steps), back held from the 20th step after the takeoff: he comes down on the floor 16 px behind its
    // middle (x 634.5), where the anchor would put his body into the beam (his box reaches x 640.5), so it does not.
    const beam = levelOf([rail(160, level(60))], { world: withTiles([[40, 9]]) });
    const states = play(beam, riding(beam, 389.5), 120, (i) => ({ move: i >= 20 ? -1 : 0, jumpHeld: i < 40 }));
    const landed = states.findIndex((s, i) => i > 0 && s.player.grounded);
    expect(landed).toBeGreaterThan(20);
    expect(inCart(beam, states[landed]!)).toBe(true);
    expect(states[landed]!.player.x - middle(beam, states[landed]!)).toBeCloseTo(-16, 6);
    expect(blocked(beam.world, middle(beam, states[landed]!), FLOOR - 8)).toBe(true);
    // Left in the cart with the speed across he came down with: he moves on in it faster than the cart for a step.
    expect(states[landed]!.player.vx).toBeGreaterThan(0);
    expect(states[landed + 1]!.player.x - states[landed]!.player.x).toBeGreaterThan(2.5);
    // He is never in a tile and never past the beam in the cart: the floor moves on under him as he slows, he drops off its back, against
    // the beam's face, and is on the ground before the beam 14 steps after landing (measured; the review's probe said within 12).
    expect(states.every((s) => !blocked(beam.world, s.player.x, s.player.y))).toBe(true);
    expect(states.every((s) => !(inCart(beam, s) && s.player.x > 640 - 6))).toBe(true);
    const ground = states.findIndex((s, i) => i > landed && s.player.grounded && s.player.y === FLOOR);
    expect(ground).toBeGreaterThan(landed);
    expect(ground - landed).toBe(14);
    expect(states[ground]!.player.x).toBeLessThanOrEqual(640 - 6 + 1e-6);
  });

  it('GDD-WLD-15 a cart stopped at its buffer anchors nobody: he walks off it', () => {
    const states = play(L, riding(L, 16), 160, (_i, s) => (s.carts[0]!.phase === 'stopped' ? right : idle));
    const stop = states.findIndex((s) => s.carts[0]!.phase === 'stopped');
    expect(stop).toBeGreaterThan(0);
    expect(states[stop + 3]!.player.x - middle(L, states[stop + 3]!)).toBeGreaterThan(0.5); // he walks in it
    expect(states[159]!.player).toMatchObject({ grounded: true, y: FLOOR });
    expect(states[159]!.player.x).toBeGreaterThan(352 + 6); // and off its front
  });
});

describe('GDD-WLD-15 acting in a rolling cart', () => {
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

  it('GDD-WLD-15, GDD-CMB-03 a hit does not move an anchored rider out of the cart', () => {
    // A spike hanging at column 12, row 9 (it hurts through y 152 to 160), at the head of a Taco Poncho riding at 150 px/s on the floor (his
    // hurtbox from y 153): the taco absorbs the hit and knocks him back, but the anchor keeps him at the cart's middle, and he rides on,
    // invulnerable, to its buffer at x 512. Nothing, forward and back held.
    const l = levelOf([rail(32, level(30))], { spikes: [{ col: 12, row: 9 }] });
    for (const held of [idle, right, left]) {
      const states = play(l, { ...riding(l, 100), power: 'taco' }, 200, () => held);
      const hit = states.findIndex((s) => s.power === 'base');
      expect(hit, `${held.move}`).toBeGreaterThan(0);
      expect(states[hit]!.invulnerable, `${held.move}`).toBe(HIT.invulnerableSteps);
      const stop = stopIn(states);
      expect(stop, `${held.move}`).toBeGreaterThan(hit);
      // To the step before it stops (on that step a stopped cart no longer anchors him, and he walks in it if he holds forward).
      for (const s of states.slice(hit, stop)) {
        expect(inCart(l, s), `${held.move}`).toBe(true);
        expect(s.player.x, `${held.move}`).toBe(middle(l, s));
      }
      expect(inCart(l, states[stop]!), `${held.move}`).toBe(true);
      expect(states.every((s) => s.phase === 'playing' && s.lives.lives === 7), `${held.move}`).toBe(true);
      expect(states.slice(hit).every((s) => s.power === 'base'), `${held.move}`).toBe(true);
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
    const from = riding(lvl, 100);
    const states = jumpFrom(lvl, from, () => idle, hold);
    const last = states[states.length - 1]!;
    expect(states.length).toBeLessThan(20); // a hop, not a full jump
    expect(inCart(lvl, last)).toBe(true);
    expect(last.player.x - middle(lvl, last)).toBeCloseTo(0, 6);
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

/** A world `COLS` wide with the floor at row 12 missing in columns `c0` to `c1`: a pit open to the level's bottom. */
const pitWorld = (c0: number, c1: number) => parseTiles(Array.from({ length: 13 }, (_, r) => Array.from({ length: COLS }, (_c, c) => (r === 12 && (c < c0 || c > c1) ? '#' : '.')).join('')));
/**
 * GDD-WLD-15: how far a falling cart has dropped `k` steps after its first falling step began, from the rule: it starts at 0 px/s down, each step
 * its speed down grows by 2250 px/s² over the step (1/60 s) up to 360 px/s, and it moves by the average of its speed before and after the step
 * (the integration `movement.ts` documents for Poncho, exact for a constant acceleration). So it drops 2250 t² / 2 for 9 steps (25.3125 px,
 * at 337.5 px/s), then (337.5 + 360) / 2 / 60 = 5.8125 px on the step that reaches 360 px/s, then 6 px a step.
 */
const dropAfter = (k: number): number => (k <= 9 ? (2250 * (k / 60) ** 2) / 2 : 25.3125 + 5.8125 + 6 * (k - 10));
/**
 * GDD-WLD-15: a cart that leaves a broken end with its middle 1 px past it (m 225 on a rail 224 px long) rolls off level at 2.5 px a step
 * until a step begins with its back edge at or past the end (its middle 16 px past it, 6.4 steps of 150 px/s): its middle is 227.5 to 240
 * after the 6 steps after the leave step, the 7th begins at 240 and is its first falling step. So `j` steps after the leave step it has
 * dropped `dropAfter(j - 6)`, nothing before.
 */
const ROLL_OFF = 6;
const droppedAfterLeaving = (j: number): number => dropAfter(Math.max(0, j - ROLL_OFF));

/** A rider standing at the middle of cart 0, rolling at m 200, who does nothing for 150 steps. */
const stayIn = (l: Level) => play(l, riding(l, 200), 150);
/** The index of the step cart 0 leaves its rail. */
const leaves = (states: RunState[]) => states.findIndex((s) => s.carts[0]!.phase === 'falling');
/** The middle of falling cart 0's box. */
const fallMiddle = (r: Rail, s: RunState) => fallingBox(r, s.carts[0]!)!.x + CART.width / 2;
/** The index of the step cart 0 stops at its buffer. */
const stopIn = (states: RunState[]) => states.findIndex((s) => s.carts[0]!.phase === 'stopped');

describe('GDD-WLD-15 a broken end', () => {
  /** Level for 14 tiles (224 px) from x 32, its ground at y 32, broken, over air: the floor is 160 px under it. */
  const B = rail(32, level(14), { y: FLOOR - 160, end: 'broken' });
  const lvl = levelOf([B]);
  /** The same 2 tiles (32 px) over the floor. */
  const LOW = rail(32, level(14), { y: FLOOR - 2 * TILE, end: 'broken' });
  const low = levelOf([LOW]);
  /** Its cart rolling at `m` with nobody in it: Poncho stands on the floor far away. */
  const empty = (l: Level, m: number) => runWith(l, spawn(1200, FLOOR), [{ phase: 'rolling', m }]);

  it('GDD-WLD-15 at a broken end the cart leaves the rail on the step its middle passes the end', () => {
    // From m 200 at 2.5 px a step: 222.5 after 9 steps, 225 after 10, the first at or past the rail's end at 224 (a buffer would stop it at
    // 208, its front at the end).
    const states = play(lvl, empty(lvl, 200), 20);
    const at = leaves(states);
    expect(at).toBe(9);
    expect(states[at - 1]!.carts[0]).toEqual({ phase: 'rolling', m: 222.5 });
    expect(states[at]!.carts[0]!.phase).toBe('falling');
    expect(states[at]!.carts[0]!.m).toBeGreaterThanOrEqual(railLength(B));
    expect(states[at]!.carts[0]!.m).toBe(225);
    // From m 199 its middle reaches the end exactly, 224, on the 10th step: it leaves on that step.
    const exact = play(lvl, empty(lvl, 199), 20);
    expect(leaves(exact)).toBe(9);
    expect(exact[9]!.carts[0]!.m).toBe(224);
  });

  it('GDD-WLD-15 from that step it is no floor: a rider who does nothing falls on his own at the carried speed', () => {
    const states = play(low, riding(low, 200), 80);
    const at = leaves(states);
    expect(at).toBe(9);
    expect(states.slice(0, at).every((s) => s.player.grounded && inCart(low, s))).toBe(true);
    expect(states[at]!.player).toMatchObject({ grounded: false, carry: 150, vx: 150 });
    const land = states.findIndex((s, i) => i > at && s.player.grounded);
    expect(land).toBeGreaterThan(at);
    expect(states.slice(at, land).every((s) => s.player.vx === 150 && s.player.carry === 150)).toBe(true);
    expect(states[land]!.player).toMatchObject({ grounded: true, y: FLOOR }); // on the ground below
    expect(states.every((s) => s.phase === 'playing' && s.lives.lives === 7)).toBe(true);
  });

  it('GDD-WLD-15 on the step the cart leaves the rail its rider moves on at the carried speed', () => {
    // He stands at its middle doing nothing: 2.5 px across every step, the leave step too (carried across as the cart rolls off), then in the
    // air at 150 px/s.
    const states = play(low, riding(low, 200), 20);
    const at = leaves(states);
    expect(at).toBe(9);
    const xs = [riding(low, 200).player.x, ...states.map((s) => s.player.x)];
    for (let i = 1; i <= at + 6; i++) expect(xs[i]! - xs[i - 1]!, `step ${i - 1}`).toBeCloseTo(2.5, 6);
    expect(states[at]!.player).toMatchObject({ grounded: false, carry: 150 });
    expect(states[at]!.player.y).toBeGreaterThan(FLOOR - 2 * TILE - 8); // falling from the end of that step
  });

  it('GDD-WLD-15 no crash: staying in costs what the fall costs', () => {
    // He stays in, doing nothing, and lands about 30 px past the rail's end (x 256).
    // Over ground: none.
    expect(stayIn(levelOf([LOW])).every((s) => s.phase === 'playing' && s.lives.lives === 7)).toBe(true);
    // Over a pit (columns 15 to 40 open): one, by the pit rule (his whole body below the level's bottom).
    const pit = stayIn(levelOf([LOW], { world: pitWorld(15, 40) }));
    const fell = pit.findIndex((s) => s.phase === 'respawning');
    expect(fell).toBeGreaterThan(0);
    expect(pit[fell]!.lives.lives).toBe(6);
    expect(pit[fell]!.player.y - 32).toBeGreaterThan(13 * TILE);
    // Over spikes (columns 15 to 22 on the floor): one, by the spike.
    const spiked = stayIn(levelOf([LOW], { spikes: Array.from({ length: 8 }, (_, i) => ({ col: 15 + i, row: 11 })) }));
    const hit = spiked.findIndex((s) => s.phase === 'respawning');
    expect(hit).toBeGreaterThan(0);
    expect(spiked[hit]!.lives.lives).toBe(6);
    expect(spiked[hit]!.player.y).toBeLessThanOrEqual(FLOOR);
  });

  /** A rider standing at the middle, jump pressed on step `press` after the step it leaves (0: that step) and held: the states. */
  const pressAfterLeaving = (press: number) => {
    const from = riding(low, 200);
    const at = leaves(play(low, from, 20));
    return { at, states: play(low, from, at + press + 10, (i) => ({ move: 0, jumpHeld: i >= at + press })) };
  };

  it('GDD-MOV-03 coyote time after the cart leaves him at a broken end: a jump within 6 steps still jumps and keeps the carried speed', () => {
    for (let k = 0; k < 6; k++) {
      const { at, states } = pressAfterLeaving(k);
      expect(states[at + k]!.player.takeoff, `pressed ${k} steps after`).toBe('jump');
      expect(states[at + k]!.player.vy, `pressed ${k} steps after`).toBeLessThan(0);
      expect(states.slice(at).every((s) => s.player.vx === 150 && s.player.carry === 150), `pressed ${k} steps after`).toBe(true);
    }
  });

  it('GDD-MOV-03 coyote time after the cart leaves him at a broken end: a press on the 7th step does not jump', () => {
    const { at, states } = pressAfterLeaving(6);
    expect(states.slice(at).every((s) => s.player.takeoff === undefined && s.player.vy >= 0)).toBe(true);
  });

  it('GDD-MOV-07 he can glide from a broken end at the carried speed', () => {
    // Jump held since he hopped in (so it is no new press): the cart leaves him and he glides.
    const gl = levelOf([B], { abilities: { glide: true } });
    const from = riding(gl, 200);
    const states = play(gl, { ...from, player: { ...from.player, jumpWasHeld: true, jumpHeldSteps: 30 } }, 80, () => hold);
    const at = leaves(states);
    const gliding = states.slice(at).filter((s) => s.player.gliding);
    expect(gliding.length).toBeGreaterThan(20);
    expect(gliding.every((s) => s.player.vx === 150 && s.player.carry === 150 && s.player.vy <= 70)).toBe(true);
  });

  it('GDD-WLD-15 a jump taken before the end lands on the far bank', () => {
    // lab-3c's R5 in small: level for 14 tiles on the floor from x 32, its end at x 256 at the lip of the floor, a pit 3 tiles wide (columns
    // 16 to 18), the far bank from x 304 at the same height, 48 px past the end.
    const bank = levelOf([rail(32, level(14), { end: 'broken' })], { world: pitWorld(16, 18) });
    // A plain held jump with the cart's middle 20 px before the end (its last tiles).
    const from = riding(bank, 224 - 20);
    const states = jumpFrom(bank, from);
    const last = states[states.length - 1]!;
    expect(last.player).toMatchObject({ grounded: true, y: FLOOR });
    expect(last.player.x).toBeGreaterThan(304 - 6); // on the far bank
    // Measured: 34 steps in the air and 87.5 px across from where he stood.
    expect(measure(states, from)).toEqual({ steps: 34, across: 87.5 });
    expect(states.every((s) => s.phase === 'playing')).toBe(true);
    // The window (the GDD quotes it): from his place at the cart's middle at takeoff, every 2.5 px a ride passes, the plain held jumps that land
    // on the far bank: over the 3-tile pit from 43 px before the end to 0.5 px (18 steps), over a 4-tile pit only from 28 px (12 steps).
    const window = (l: Level, far: number) => {
      const lands: number[] = [];
      for (let m = 16; m < 224; m += 2.5) {
        const flight = jumpFrom(l, riding(l, m));
        const end = flight[flight.length - 1]!;
        if (end.phase === 'playing' && end.player.y === FLOOR && end.player.x > far - 6) lands.push(224 - m);
      }
      return { first: Math.max(...lands), last: Math.min(...lands), steps: lands.length };
    };
    expect(window(bank, 304)).toEqual({ first: 43, last: 0.5, steps: 18 });
    expect(window(levelOf([rail(32, level(14), { end: 'broken' })], { world: pitWorld(16, 19) }), 320)).toEqual({ first: 28, last: 0.5, steps: 12 });
    // Taken 2 tiles early (he stands 32 px before the end) it still lands (GDD: the first broken end is at most 3 tiles from its bank); over a
    // pit of 4 tiles the same jump falls in.
    const early = riding(bank, 224 - 32);
    expect(jumpFrom(bank, early)[jumpFrom(bank, early).length - 1]!.player).toMatchObject({ grounded: true, y: FLOOR });
    const wide = levelOf([rail(32, level(14), { end: 'broken' })], { world: pitWorld(16, 19) });
    expect(play(wide, riding(wide, 224 - 32), 80, () => hold).some((s) => s.phase === 'respawning')).toBe(true);
  });

  it('GDD-WLD-15 a cart off a broken end stays level until its back edge has passed the end, then falls', () => {
    const states = play(lvl, empty(lvl, 200), 20);
    const at = leaves(states);
    // On the step it leaves: its middle 225 px across from x 32, its box from 16 px over where the rail's ground would be (y 32) down to it.
    expect(fallingBox(B, states[at]!.carts[0]!)).toEqual({ x: 32 + 225 - 16, y: 32 - 16, w: 32, h: 16 });
    // The 6 steps after: level, its middle 227.5 to 240 (less than 16 px past the end at 224 when each began); then it falls.
    for (let j = 1; j <= 6; j++) {
      const c = states[at + j]!.carts[0]!;
      expect(c.phase).toBe('falling');
      expect(c.m).toBeCloseTo(225 + 2.5 * j, 9);
      expect(fallingBox(B, c)!.y, `${j} steps on`).toBe(32 - 16);
    }
    expect(fallingBox(B, states[at + 7]!.carts[0]!)!.y).toBeCloseTo(32 - 16 + 0.3125, 9);
    expect(fallingBox(B, states[at + 8]!.carts[0]!)!.y).toBeCloseTo(32 - 16 + 1.25, 9);
    expect([ROLL_OFF, droppedAfterLeaving(7), droppedAfterLeaving(8)]).toEqual([6, 0.3125, 1.25]);
  });

  it('GDD-WLD-15 a rail that ends at the lip of its ground: the cart falls past the lip and breaks on the floor below, not on the lip', () => {
    // Ground under the whole rail (14 tiles from x 32, columns 2 to 15, 10 rows deep down to the floor at y 192, its top at y 32), and a drop
    // of 10 tiles after its end at x 256 down to the floor.
    const world = rows((r) => Array.from({ length: COLS }, (_, c) => (r >= 2 && c <= 15 ? '#' : '.')).join(''));
    const L = rail(32, level(14), { y: 32, end: 'broken' });
    const lip = levelOf([L], { world });
    const states = play(lip, empty(lip, 200), 60);
    const at = leaves(states);
    // It falls the same way as over air, and breaks on the floor 160 px down: 32 falling steps after its 6 level ones.
    const k = Array.from({ length: 60 }, (_, i) => i).find((i) => 32 + droppedAfterLeaving(i) > FLOOR)!;
    expect(k).toBe(38);
    expect(states.slice(at, at + k).every((s) => s.carts[0]!.phase === 'falling')).toBe(true);
    expect(states[at + k]!.carts[0]!.phase).toBe('gone');
    expect(fallingBox(L, states[at + k - 1]!.carts[0]!)!.x).toBeGreaterThanOrEqual(256); // past the lip
  });

  it('GDD-WLD-15 the falling cart keeps its speed across and falls at 2250 px/s² up to 360 px/s', () => {
    const states = play(lvl, empty(lvl, 200), 60);
    const at = leaves(states) + ROLL_OFF; // the step before its first falling step
    expect(fallingBox(B, states[at]!.carts[0]!)).toEqual({ x: 32 + 240 - 16, y: 32 - 16, w: 32, h: 16 });
    // 1, 10 and 30 steps from its first falling step on.
    for (const k of [1, 10, 30]) {
      const box = fallingBox(B, states[at + k]!.carts[0]!)!;
      expect(box.x, `${k} steps on`).toBeCloseTo(32 + 240 - 16 + 2.5 * k, 9); // 150 px/s across
      expect(box.y, `${k} steps on`).toBeCloseTo(32 - 16 + dropAfter(k), 9);
    }
    expect([dropAfter(1), dropAfter(10), dropAfter(30)]).toEqual([0.3125, 31.125, 151.125]);
  });

  it('GDD-WLD-15 the falling cart breaks on the first tile it touches', () => {
    // The floor's top at y 192, 160 px under the rail: its box's bottom passes it 32 falling steps on (189.1 after 31, 195.1 after 32), 38
    // after it left the rail.
    const k = Array.from({ length: 60 }, (_, i) => i).find((i) => 32 + droppedAfterLeaving(i) > FLOOR)!;
    expect(k).toBe(38);
    const states = play(lvl, empty(lvl, 200), 60);
    const at = leaves(states);
    expect(states[at + k - 1]!.carts[0]!.phase).toBe('falling');
    expect(states[at + k]!.carts[0]!.phase).toBe('gone');
    expect(states.slice(at + k).every((s) => s.carts[0]!.phase === 'gone' && fallingBox(B, s.carts[0]!) === null)).toBe(true);
  });

  it('GDD-WLD-15 the falling cart breaks on a spike', () => {
    // A spike on the floor at column 21 (x 336 to 352), under its box 37 steps after it left the rail; its hurting part from y 184 down: the
    // box's bottom passes it a step before it would reach the floor.
    const spiked = levelOf([B], { spikes: [{ col: 21, row: 11 }] });
    const k = Array.from({ length: 60 }, (_, i) => i).find((i) => 32 + droppedAfterLeaving(i) > FLOOR - SPIKE.height)!;
    expect(k).toBe(37);
    const states = play(spiked, empty(spiked, 200), 60);
    const at = leaves(states);
    expect(states[at + k - 1]!.carts[0]!.phase).toBe('falling');
    expect(states[at + k]!.carts[0]!.phase).toBe('gone');
  });

  it('GDD-WLD-15 a falling cart passes beside a spike in the next column without breaking', () => {
    // 37 steps after it leaves, when its bottom passes a spike's hurting part (y 184), its box spans x 333.5 to 365.5: spikes in the columns
    // either side (19, x 304 to 320, and 23, x 368 to 384) are not under it, and it breaks on the floor a step later, as with none.
    const beside = levelOf([B], { spikes: [{ col: 19, row: 11 }, { col: 23, row: 11 }] });
    const states = play(beside, empty(beside, 200), 60);
    const at = leaves(states);
    expect(fallingBox(B, states[at + 37]!.carts[0]!)!.x).toBe(333.5);
    expect(states[at + 37]!.carts[0]!.phase).toBe('falling');
    expect(states[at + 38]!.carts[0]!.phase).toBe('gone');
  });

  it('GDD-WLD-15 a falling cart does not break on the empty upper half of a spike\'s tile', () => {
    // A spike hurts through the lower half of its tile only (GDD-WLD-05). The rail 4 px further right (from x 36): 36 steps after it leaves,
    // its box (x 335 to 367) reaches into column 20's spike tile (x 320 to 336) with its bottom at 183.1, in the tile's upper half (176 to
    // 184); the next step it has moved past the column (x 337.5) as its bottom drops into the lower half: it is not broken by the spike and
    // breaks on the floor 38 steps after it leaves.
    const B4 = rail(36, level(14), { y: FLOOR - 160, end: 'broken' });
    const upper = levelOf([B4], { spikes: [{ col: 20, row: 11 }] });
    const states = play(upper, empty(upper, 200), 60);
    const at = leaves(states);
    const box = fallingBox(B4, states[at + 36]!.carts[0]!)!;
    expect([box.x, box.y + box.h]).toEqual([335, 32 + droppedAfterLeaving(36)]);
    expect(box.y + box.h).toBeGreaterThan(FLOOR - TILE);
    expect(box.y + box.h).toBeLessThan(FLOOR - SPIKE.height);
    expect(states[at + 37]!.carts[0]!.phase).toBe('falling');
    expect(states[at + 38]!.carts[0]!.phase).toBe('gone');
  });

  it('GDD-WLD-15 a falling cart below a spike does not break on it', () => {
    // A spike at column 15, row 0 (its hurting part y 8 to 16), over the cart's box as it leaves (x 241 to 273, top y 16): the cart is below it,
    // so it is not broken, and breaks on the floor 38 steps after it leaves.
    const over = levelOf([B], { spikes: [{ col: 15, row: 0 }] });
    const states = play(over, empty(over, 200), 60);
    const at = leaves(states);
    expect(at).toBe(9);
    expect(states.slice(at, at + 38).every((s) => s.carts[0]!.phase === 'falling')).toBe(true);
    expect(states[at + 38]!.carts[0]!.phase).toBe('gone');
  });

  it('GDD-WLD-15 the falling cart breaks or falls out of the level', () => {
    // No floor under it (columns 10 to 60 open): it is gone the step its whole box is below the level's bottom (13 rows, y 208).
    const open = levelOf([B], { world: pitWorld(10, 60) });
    const k = Array.from({ length: 60 }, (_, i) => i).find((i) => 32 - 16 + droppedAfterLeaving(i) > 13 * TILE)!;
    expect(k).toBe(43);
    const states = play(open, empty(open, 200), 60);
    const at = leaves(states);
    expect(states[at + k - 1]!.carts[0]!.phase).toBe('falling');
    expect(states[at + k]!.carts[0]!.phase).toBe('gone');
  });

  it('GDD-WLD-15 a falling cart is no floor', () => {
    // Poncho falling at 360 px/s from 30 px over the rail's ground, over the cart's middle and with its speed across, as it leaves: he catches
    // it up and falls through it to the floor.
    const r = runWith(lvl, { ...spawn(32 + 225, 32 - 30), grounded: false, vx: 150, vy: 360, carry: 150 }, [{ phase: 'rolling', m: 222.5 }]);
    const states = play(lvl, r, 60);
    expect(states[0]!.carts[0]!.phase).toBe('falling');
    const land = states.findIndex((s) => s.player.grounded);
    expect(states[land]!.player.y).toBe(FLOOR);
    const through = states.slice(0, land).filter((s) => {
      const box = fallingBox(B, s.carts[0]!);
      return box !== null && s.player.y > box.y && s.player.y < box.y + box.h;
    });
    expect(through.length).toBeGreaterThan(0); // his feet were inside its box
  });

  it('GDD-WLD-15 the anchor does not hold him once the cart has left the rail', () => {
    // Holding back from the step after it leaves: he slows towards 30 px/s and the cart, at 150, leaves him behind.
    const states = play(lvl, riding(lvl, 200), 40, (_i, s) => (s.carts[0]!.phase === 'falling' ? left : idle));
    const at = leaves(states);
    const falling = states.slice(at, at + 25);
    expect(falling.every((s) => s.carts[0]!.phase === 'falling')).toBe(true);
    expect(Math.min(...falling.map((s) => s.player.x - fallMiddle(B, s)))).toBeLessThan(-10 - 5);
  });

  it('GDD-WLD-15 a left-rolling cart leaves a broken end mirrored', () => {
    const L = rail(600, level(14), { y: FLOOR - 160, dir: -1, end: 'broken' });
    const l = levelOf([L]);
    const states = play(l, empty(l, 200), 45);
    const at = leaves(states);
    expect(at).toBe(9);
    expect(fallingBox(L, states[at]!.carts[0]!)).toEqual({ x: 600 - 225 - 16, y: 32 - 16, w: 32, h: 16 });
    expect(fallingBox(L, states[at + 10]!.carts[0]!)!.x).toBeCloseTo(600 - 225 - 16 - 25, 9);
    // A rider who does nothing falls at -150 px/s.
    const ridden = play(l, riding(l, 200), 20);
    expect(ridden[at]!.player).toMatchObject({ grounded: false, vx: -150, carry: -150 });
  });

  it('GDD-WLD-15 the warning post stands 6 tiles before a broken end, on the rail\'s ground, and a buffer has none', () => {
    expect(warningPost(rail(32, level(14), { end: 'broken' }))).toEqual({ x: 32 + 224 - 96, y: FLOOR });
    expect(warningPost(rail(32, level(14)))).toBeNull();
    // Up 4 tiles (64 px), then level for 6: the post, 96 px before the end, stands at the climb's top, 64 px over the rail's start.
    expect(warningPost(rail(32, [{ kind: 'climb', tiles: 4 }, { kind: 'level', tiles: 6 }], { end: 'broken' }))).toEqual({ x: 32 + 64, y: FLOOR - 64 });
    // Rolling left from x 600: 96 px right of its end at x 376.
    expect(warningPost(rail(600, level(14), { dir: -1, end: 'broken' }))).toEqual({ x: 600 - 224 + 96, y: FLOOR });
  });
});

describe('GDD-WLD-15 an empty cart comes back', () => {
  const R = rail(160, level(10)); // its buffer at x 320; stopped, its middle is 144 px across
  const lvl = levelOf([R]);
  const B = rail(32, level(14), { y: FLOOR - 160, end: 'broken' });
  const broken = levelOf([B]);

  it('GDD-WLD-15 an empty cart at its buffer is back at its start 2.0 s later', () => {
    // He jumps out at once holding back: the cart leaves him on the ground and rolls on to its buffer with nobody in it.
    const states = play(lvl, riding(lvl, 16), 300, (i) => ({ move: i < 40 ? -1 : 0, jumpHeld: i < 30 }));
    const S = stopIn(states);
    expect(S).toBeGreaterThan(0);
    expect(states.slice(S).every((s) => !inCart(lvl, s))).toBe(true);
    expect(states[S + 119]!.carts[0]).toMatchObject({ phase: 'stopped', m: 144 });
    expect(states[S + 120]!.carts[0]).toEqual({ phase: 'waiting', m: 16 });
  });

  it('GDD-WLD-15 a cart he rode to a buffer returns 2.0 s after he steps off it', () => {
    // He stands in it 300 steps after it stops, then walks off its front.
    let S = -1;
    const states = play(lvl, riding(lvl, 16), 600, (i, s) => {
      if (S < 0 && s.carts[0]!.phase === 'stopped') S = i;
      return S >= 0 && i >= S + 300 ? right : idle;
    });
    expect(S).toBeGreaterThan(0);
    expect(states.slice(S, S + 300).every((s) => s.carts[0]!.phase === 'stopped' && inCart(lvl, s))).toBe(true);
    const T = states.findIndex((s, i) => i > S && !inCart(lvl, s)); // the first step at whose end he does not stand on it
    expect(T).toBeGreaterThan(S + 300);
    expect(states[T + 119]!.carts[0]).toMatchObject({ phase: 'stopped', m: 144 });
    expect(states[T + 120]!.carts[0]).toEqual({ phase: 'waiting', m: 16 });
  });

  it('GDD-WLD-15 stepping back on stops the count', () => {
    // He rides it to its buffer, walks off its front, hops back in (a bot steering over its middle, x 304), stands 60 steps, and walks off again.
    let phase: 'ride' | 'off' | 'hop' | 'stand' | 'leave' = 'ride';
    let since = 0;
    const T: number[] = [];
    const states = play(lvl, riding(lvl, 16), 700, (i, s) => {
      since++;
      const next = (p: typeof phase) => {
        phase = p;
        since = 0;
      };
      if (phase === 'ride' && s.carts[0]!.phase === 'stopped') next('off');
      if (phase === 'off' && s.player.x > 340) next('hop');
      if (phase === 'hop' && since > 2 && inCart(lvl, s)) next('stand');
      if (phase === 'stand' && since >= 60) next('leave');
      if (phase === 'off') return right;
      if (phase === 'hop') return { move: Math.abs(304 - s.player.x) > 4 ? Math.sign(304 - s.player.x) : 0, jumpHeld: since === 1 || (!s.player.grounded && s.player.vy < 0) };
      if (phase === 'leave') return right;
      void i;
      return idle;
    });
    for (let i = 1; i < states.length; i++) if (inCart(lvl, states[i - 1]!) && !inCart(lvl, states[i]!) && states[i]!.carts[0]!.phase === 'stopped') T.push(i);
    expect(T.length).toBe(2); // he stepped off twice
    // Off for long enough the first time that a count kept from then would bring it back before 120 steps after the second.
    const back = states.findIndex((s, i) => i > T[0]! && s.carts[0]!.phase === 'waiting');
    expect(back).toBe(T[1]! + 120);
    expect(states[T[1]! + 119]!.carts[0]).toMatchObject({ phase: 'stopped', m: 144 });
  });

  it('GDD-WLD-15 a cart that fell from a broken end is back 2.0 s after it left the rail', () => {
    for (const rider of [false, true]) {
      const states = play(broken, rider ? riding(broken, 200) : runWith(broken, spawn(1200, FLOOR), [{ phase: 'rolling', m: 200 }]), 200);
      const at = states.findIndex((s) => s.carts[0]!.phase === 'falling');
      expect(at, `rider ${rider}`).toBe(9);
      expect(states[at + 119]!.carts[0]!.phase, `rider ${rider}`).toBe('gone'); // it broke on the floor 32 steps after it left
      expect(states[at + 120]!.carts[0], `rider ${rider}`).toEqual({ phase: 'waiting', m: 16 });
      expect(states.every((s) => s.phase === 'playing'), `rider ${rider}`).toBe(true);
    }
  });

  it('GDD-WLD-15 the returned cart is a floor at once and rolls again when he lands in it', () => {
    // Rolling empty from m 130 to its buffer; then Poncho dropped from 1 px over its floor at its start, so he comes down on it this step.
    const states = play(lvl, runWith(lvl, spawn(1200, FLOOR), [{ phase: 'rolling', m: 130 }]), 200);
    const S = stopIn(states);
    const drop = (r: RunState): RunState => ({ ...r, player: { ...spawn(176, FLOOR - 8 - 1), grounded: false, vy: 120 } });
    // On the step it comes back he lands in it, and it starts.
    const back = stepRun(drop(states[S + 119]!), idle, lvl);
    expect(back.player).toMatchObject({ grounded: true, y: FLOOR - 8 });
    expect(back.carts[0]).toEqual({ phase: 'rolling', m: 16 });
    expect(stepRun(back, idle, lvl).carts[0]!.m).toBeCloseTo(16 + 2.5, 9);
    // A step earlier it is still at its buffer, and the same drop falls past to the ground.
    const early = play(lvl, drop(states[S + 118]!), 10);
    expect(early[0]!.carts[0]!.phase).toBe('stopped');
    expect(early[9]!.player).toMatchObject({ grounded: true, y: FLOOR });
  });

  it('GDD-WLD-15 a Poncho standing on the ground at its start is not boarded by the returning cart', () => {
    const states = play(lvl, runWith(lvl, spawn(176, FLOOR), [{ phase: 'rolling', m: 130 }]), 260);
    const S = stopIn(states);
    expect(states[S + 120]!.carts[0]).toEqual({ phase: 'waiting', m: 16 });
    expect(states.every((s) => s.player.y === FLOOR && s.player.x === 176)).toBe(true);
    expect(states.slice(S + 120).every((s) => s.carts[0]!.phase === 'waiting')).toBe(true);
  });

  it('GDD-WLD-15 in a boss level a cart at its rail\'s end does not come back', () => {
    // 1-4 with a rail added on its floor (as the hit-stop test does), Poncho at its spawn under the Chile Fantasma so nothing hurts him.
    for (const end of ['buffer', 'broken'] as const) {
      const l: Level = { ...LEVEL_1_4, rails: [rail(16, level(26), { y: 14 * TILE, end })] };
      const r: RunState = { ...startRun(l), fantasma: 10_000, carts: [{ phase: 'rolling', m: 26 * TILE - 30 }] };
      const states = play(l, r, 400);
      expect(states.every((s) => s.phase === 'playing'), end).toBe(true);
      const at = states.findIndex((s) => s.carts[0]!.phase !== 'rolling');
      expect(at, end).toBeGreaterThanOrEqual(0);
      const last = end === 'buffer' ? 'stopped' : 'gone';
      expect(states[at + 200]!.carts[0]!.phase, end).toBe(last);
      expect(states[states.length - 1]!.carts[0]!.phase, end).toBe(last);
    }
  });

  it('GDD-WLD-15 a lost life puts a falling, a gone and a returning cart back at once', () => {
    const lvl3 = levelOf([B, rail(400, level(14), { y: FLOOR - 160, end: 'broken' }), rail(800, level(10))], { spikes: [{ col: 2, row: 11 }] });
    const carts: CartState[] = [{ phase: 'falling', m: 230, fall: { y: 60, vy: 100, vx: 150 } }, { phase: 'gone', m: 240 }, { phase: 'stopped', m: 144, empty: 50 }];
    const hit = stepRun(runWith(lvl3, spawn(40, FLOOR), carts), idle, lvl3);
    expect(hit.phase).toBe('respawning');
    const back = play(lvl3, hit, RESPAWN.delaySteps)[RESPAWN.delaySteps - 1]!;
    expect(back.phase).toBe('playing');
    expect(back.carts).toEqual([{ phase: 'waiting', m: 16 }, { phase: 'waiting', m: 16 }, { phase: 'waiting', m: 16 }]);
  });
});

/** A run with cart 0 of `l` rolling at `m`, Poncho at its middle, and the enemies' states as given (the level's fresh ones unless said). */
const ridingWith = (l: Level, m: number, enemies?: readonly EnemyState[]): RunState => ({ ...riding(l, m), ...(enemies ? { enemies } : {}) });
/** A cart's box from the GDD: its middle on its rail, 32 px wide, from 16 px over the rail's ground (the rail's `y`: these rails are level) to it. */
const cartBox = (r: Rail, c: CartState): Box => ({ x0: r.x + r.dir * c.m - 16, x1: r.x + r.dir * c.m + 16, y0: r.y - 16, y1: r.y });
/** Do two boxes overlap? Boxes that only share an edge do not. */
const touch = (a: Box, b: Box): boolean => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
/** Does cart 0's box overlap enemy 0 after the step that gave `s`? */
const reaches = (l: Level, s: RunState): boolean => touch(cartBox(l.rails![0]!, s.carts[0]!), enemyBox(l.enemies[0]!, s.enemies[0]!));
/** Rides at the middle of cart 0 to step `k`: not knocked out of it. */
const rodeThrough = (l: Level, states: RunState[], k: number) => expect(states.slice(0, k + 1).every((s) => inCart(l, s) && s.player.x === middle(l, s))).toBe(true);

/**
 * Plays `steps` steps and finds the step enemy 0 is defeated: it is alive and clear of the rolling cart's box on the step before, and the
 * boxes overlap on that step. He loses no life and is not hit (never knocked back or made invulnerable). Returns the states and the step.
 */
function runsDown(l: Level, r: RunState, steps: number, input: (i: number, s: RunState) => PlayerInput = () => idle): { states: RunState[]; k: number } {
  const states = play(l, r, steps, input);
  const k = states.findIndex((s) => !s.enemies[0]!.alive);
  expect(k).toBeGreaterThan(0);
  expect(states[k - 1]!.enemies[0]!.alive).toBe(true);
  expect(reaches(l, states[k - 1]!)).toBe(false);
  expect(states[k]!.carts[0]!.phase).toBe('rolling');
  expect(reaches(l, states[k]!)).toBe(true);
  expect(states.every((s) => s.phase === 'playing' && s.lives.lives === 7 && s.invulnerable === 0 && s.power === r.power)).toBe(true);
  return { states, k };
}

describe('GDD-WLD-15 a rolling cart defeats the enemies it hits', () => {
  // User, 2026-11-10: "a rolling cart defeats every enemy it hits", the heavy ones too. Its box: 32 px wide around its middle, from 16 px over
  // the rail's ground under its middle down to that ground (the falling cart's box). Boxes that only share an edge do not touch.
  const R = rail(32, level(40)); // on the floor, its buffer at x 672; riding from m 100 its middle is at x 132
  /** A level with the rails given (R unless said) and the enemies given. */
  const withEnemies = (enemies: readonly Enemy[], o: { rails?: readonly Rail[]; world?: ReturnType<typeof rows>; spikes?: Level['spikes'] } = {}): Level => ({ ...levelOf(o.rails ?? [R], o), enemies });


  it('GDD-WLD-15 a rolling cart defeats an Alacrán', () => {
    const l = withEnemies([{ x: 192, y: FLOOR }]);
    const { states, k } = runsDown(l, ridingWith(l, 100), 60);
    rodeThrough(l, states, k);
  });

  it('GDD-WLD-15 a rolling cart defeats a cactus buddy, which only it and the Chile Fantasma defeat', () => {
    const l = withEnemies([{ x: 200, y: FLOOR, kind: 'cactus' }]);
    const { states, k } = runsDown(l, ridingWith(l, 100), 60);
    rodeThrough(l, states, k);
  });

  it('GDD-WLD-15 a rolling cart defeats a Trompo while it spins, with no stun', () => {
    // It spins on at 70 px/s ahead of the cart, which catches it up at 150.
    const l = withEnemies([{ x: 220, y: FLOOR, kind: 'trompo' }]);
    const { states, k } = runsDown(l, ridingWith(l, 100), 90);
    expect(states[k - 1]!.enemies[0]!.spin!.phase).toBe('spin');
    expect(states[k]!.enemies[0]!.spin!.phase).toBe('spin'); // defeated outright, not stunned
    expect(states.slice(k).every((s) => !s.enemies[0]!.alive)).toBe(true);
    rodeThrough(l, states, k);
  });

  it('GDD-WLD-15 a rolling cart defeats a stunned Trompo', () => {
    const l = withEnemies([{ x: 180, y: FLOOR, kind: 'trompo' }]);
    const { states, k } = runsDown(l, ridingWith(l, 100, [stun(freshEnemies(l.enemies)[0]!)]), 40);
    expect(states[k - 1]!.enemies[0]!.spin!.phase).toBe('stunned');
    rodeThrough(l, states, k);
  });

  it('GDD-WLD-15 a rolling cart defeats a Tlacuache charging', () => {
    // Charging left at 150 px/s into the cart rolling right.
    const l = withEnemies([{ x: 260, y: FLOOR, kind: 'tlacuache' }]);
    const charging: EnemyState = { ...freshEnemies(l.enemies)[0]!, dir: -1, gait: { phase: 'charge', age: 0, playedDead: false } };
    const { states, k } = runsDown(l, ridingWith(l, 100, [charging]), 40);
    expect(states[k - 1]!.enemies[0]!.gait!.phase).toBe('charge');
    rodeThrough(l, states, k);
  });

  it('GDD-WLD-15 a rolling cart defeats a Tlacuache playing dead', () => {
    const l = withEnemies([{ x: 180, y: FLOOR, kind: 'tlacuache' }]);
    const dead: EnemyState = { ...freshEnemies(l.enemies)[0]!, gait: { phase: 'dead', age: 0, playedDead: true } };
    const { states, k } = runsDown(l, ridingWith(l, 100, [dead]), 40);
    expect(states[k - 1]!.enemies[0]!.gait!.phase).toBe('dead');
    rodeThrough(l, states, k);
  });

  it('GDD-WLD-15 a rolling cart defeats a Paloma walking', () => {
    // A rider standing in the cart would startle it before the cart reached it (his middle within 48 px of its own, his feet within 24 px of
    // its feet): he jumps from the cart, so his feet are high over it when the cart reaches it walking, and he lands back in the cart.
    const l = withEnemies([{ x: 190, y: FLOOR, kind: 'paloma' }]);
    const { states, k } = runsDown(l, ridingWith(l, 100), 60, () => hold);
    expect(states[k - 1]!.enemies[0]!.wing!.phase).toBe('walk');
    expect(states[k]!.enemies[0]!.wing!.phase).toBe('walk');
    const back = states.findIndex((s, i) => i > k && s.player.grounded);
    expect(back).toBeGreaterThan(k);
    expect(inCart(l, states[back]!)).toBe(true);
  });

  it('GDD-WLD-15 a ridden cart runs down a Paloma in its startle telegraph, before it flutters up', () => {
    // A Paloma walking on the floor ahead of a cart he stands in: it startles on the step its middle, after its walk, is within 48 px of his
    // hurtbox's middle as the step began (his feet 8 px over its feet), and freezes on the ground for its 30-step telegraph. The cart's front,
    // 16 px ahead of him, reaches its box (7 px behind its middle) about 23 px later at 2.5 px a step: it is run down on the ground on the
    // 10th step of its telegraph, never in the air.
    const l = withEnemies([{ x: 230, y: FLOOR, kind: 'paloma' }]);
    const { states, k } = runsDown(l, ridingWith(l, 100), 60);
    const startle = states.findIndex((s) => s.enemies[0]!.wing!.phase === 'telegraph');
    expect(startle).toBeGreaterThan(1);
    expect(states[startle - 1]!.enemies[0]!.x - states[startle - 2]!.player.x).toBeGreaterThan(48);
    expect(states[startle]!.enemies[0]!.x - states[startle - 1]!.player.x).toBeLessThanOrEqual(48);
    expect(k - startle).toBe(9);
    expect(states.slice(startle, k + 1).every((s) => s.enemies[0]!.wing!.phase === 'telegraph' && s.enemies[0]!.wing!.lift === 0)).toBe(true);
    rodeThrough(l, states, k);
  });

  it('GDD-WLD-15 a rolling cart defeats a Paloma hovering in its path', () => {
    // The rail 2 tiles over the floor (its ground at y 160): a Paloma on the floor hovering 40 px up (its box y 140 to 152) is in the cart's
    // box (y 144 to 160).
    const high = rail(32, level(40), { y: FLOOR - 2 * TILE });
    const l = withEnemies([{ x: 190, y: FLOOR, kind: 'paloma' }], { rails: [high] });
    const hovering: EnemyState = { ...freshEnemies(l.enemies)[0]!, wing: { phase: 'hover', age: 0, lift: 40 } };
    const { states, k } = runsDown(l, ridingWith(l, 100, [hovering]), 40);
    expect(states[k - 1]!.enemies[0]!.wing!.phase).toBe('hover');
    rodeThrough(l, states, k);
  });

  it('GDD-WLD-15 a rolling cart defeats a Chapulín mid-hop', () => {
    // At the end of its crouch, facing the cart: it hops on the first step (its feet 4.8 px up), and the cart reaches it on the second, low in
    // its hop (its feet 9.2 px up, its box from y 172.8).
    const l = withEnemies([{ x: 158, y: FLOOR, kind: 'chapulin' }]);
    const about: EnemyState = { ...freshEnemies(l.enemies)[0]!, dir: -1, hop: { phase: 'crouch', age: 35, vy: 0 } };
    const { states, k } = runsDown(l, ridingWith(l, 100, [about]), 40);
    expect(k).toBe(1);
    expect(states[0]!.enemies[0]!.hop!.phase).toBe('air');
    expect(states[0]!.enemies[0]!.y!).toBeLessThan(FLOOR); // off the ground
    expect(states[1]!.enemies[0]!.hop!.phase).toBe('air');
    rodeThrough(l, states, k);
  });

  it('GDD-WLD-15 a rolling cart defeats a Zopilote flying low', () => {
    // Its cruise line 8 px over the floor: its box (10 px tall, bobbing 12 px) is in the cart's box all the way.
    const l = withEnemies([{ x: 220, y: FLOOR - 8, kind: 'zopilote' }]);
    const { states, k } = runsDown(l, ridingWith(l, 100), 60);
    expect(states[k - 1]!.enemies[0]!.flight!.phase).toBe('cruise');
    rodeThrough(l, states, k);
  });

  it('GDD-WLD-15 a cart on a plateau after a climb runs down an enemy there', () => {
    // A rail on the ground (`trackWorld`): 4 tiles on the floor, up 4 tiles over slope tiles to y 128, then 10 tiles on that plateau. An
    // Alacrán walks on the plateau; the cart's box there is 16 px over the plateau's ground (y 112 to 128), and runs it down before it can
    // reach him (on the floor's height the box would pass under it and it would walk into his hurtbox, y 89 to 119).
    const r = rail(32, [{ kind: 'level', tiles: 4 }, { kind: 'climb', tiles: 4 }, { kind: 'level', tiles: 10 }]);
    const l = withEnemies([{ x: 260, y: FLOOR - 64 }], { rails: [r], world: trackWorld(r) });
    const states = play(l, ridingWith(l, 140), 60);
    const box = (s: RunState): Box => ({ x0: r.x + s.carts[0]!.m - 16, x1: r.x + s.carts[0]!.m + 16, y0: FLOOR - 64 - 16, y1: FLOOR - 64 });
    const k = states.findIndex((s) => !s.enemies[0]!.alive);
    expect(k).toBeGreaterThan(0);
    expect(touch(box(states[k - 1]!), enemyBox(l.enemies[0]!, states[k - 1]!.enemies[0]!))).toBe(false);
    expect(touch(box(states[k]!), enemyBox(l.enemies[0]!, states[k]!.enemies[0]!))).toBe(true);
    expect(states.every((s) => s.phase === 'playing' && s.lives.lives === 7 && s.invulnerable === 0)).toBe(true);
    rodeThrough(l, states, k);
  });

  it('GDD-WLD-15 a cart on a raised stretch does not touch an enemy on the floor under it', () => {
    // The same rail over air: on its raised stretch the cart's box is y 112 to 128, high over an Alacrán walking on the floor (y 182 to 192),
    // which is alive after the cart has passed over it.
    const r = rail(32, [{ kind: 'level', tiles: 4 }, { kind: 'climb', tiles: 4 }, { kind: 'level', tiles: 20 }]);
    const l = withEnemies([{ x: 220, y: FLOOR }], { rails: [r] });
    const states = play(l, ridingWith(l, 140), 80);
    const middleX = (s: RunState) => r.x + s.carts[0]!.m;
    expect(states.some((s) => Math.abs(middleX(s) - s.enemies[0]!.x) < 1)).toBe(true); // right over it
    expect(middleX(states[79]!) - 16).toBeGreaterThan(states[79]!.enemies[0]!.x + 7); // and past it
    expect(states.every((s) => s.enemies[0]!.alive && s.carts[0]!.phase === 'rolling')).toBe(true);
  });

  it('GDD-WLD-15 a cart on a slope runs down an enemy standing on the slope', () => {
    // A climb of 8 tiles over slope tiles from x 96 (y 192) to x 224 (y 64), the cart rolling up it from m 70 at 84.9 px/s across. An Alacrán
    // walks up the sand slope ahead of it (GDD-MOV-09). The cart's box at its middle's ground reaches its box once it is within 16 px ahead
    // of the middle (its feet then within 16 px over that ground): it is defeated on the slope, and he is not hit.
    const r = rail(32, [{ kind: 'level', tiles: 4 }, { kind: 'climb', tiles: 8 }, { kind: 'level', tiles: 6 }]);
    const l = withEnemies([{ x: 170, y: FLOOR - (170 - 96) }], { rails: [r], world: trackWorld(r) });
    const states = play(l, ridingWith(l, 70), 90);
    const ground = (m: number) => FLOOR - (m - 64); // on the climb, m 64 to 192
    const box = (s: RunState): Box => ({ x0: r.x + s.carts[0]!.m - 16, x1: r.x + s.carts[0]!.m + 16, y0: ground(s.carts[0]!.m) - 16, y1: ground(s.carts[0]!.m) });
    const k = states.findIndex((s) => !s.enemies[0]!.alive);
    expect(k).toBeGreaterThan(0);
    const e = states[k]!.enemies[0]!;
    expect(e.x).toBeGreaterThan(96);
    expect(e.x).toBeLessThan(224);
    expect(e.y!).toBeCloseTo(FLOOR - (e.x - 96), 6); // standing on the slope
    expect(touch(box(states[k - 1]!), enemyBox(l.enemies[0]!, states[k - 1]!.enemies[0]!))).toBe(false);
    expect(touch(box(states[k]!), enemyBox(l.enemies[0]!, e))).toBe(true);
    expect(states.every((s) => s.phase === 'playing' && s.lives.lives === 7 && s.invulnerable === 0)).toBe(true);
    rodeThrough(l, states, k);
  });

  it('GDD-WLD-15 a fireball passes an enemy the cart defeats on that step', () => {
    // A spinning Trompo the cart reaches on the first step (its box x 144.2 to 158.2), and a fireball flying into it on that step (x 150 to
    // 156 after the step): the cart defeats it, plainly (not stunned), and the fireball flies on. So does a claw swing live on that step
    // (its box x 140.5 to 160.5): it changes nothing.
    const l = withEnemies([{ x: 150, y: FLOOR, kind: 'trompo' }]);
    const plain = play(l, ridingWith(l, 100), 1)[0]!;
    expect(plain.enemies[0]).toEqual({ x: 150 + 70 / 60, y: FLOOR, dir: 1, alive: false, spin: { phase: 'spin', age: 1 } });
    const fb = { x: 150, y: FLOOR - 2, vx: 180, vy: 0, age: 0 };
    const [shot] = play(l, { ...ridingWith(l, 100), fireballs: [fb] }, 1);
    expect(shot!.fireballs).toHaveLength(1);
    expect(shot!.fireballs[0]!.x).toBe(153);
    expect(touch({ x0: 150, x1: 156, y0: shot!.fireballs[0]!.y - 6, y1: shot!.fireballs[0]!.y }, enemyBox(l.enemies[0]!, plain.enemies[0]!))).toBe(true);
    expect(shot!.enemies[0]).toEqual(plain.enemies[0]);
    const [swiped] = play(l, { ...ridingWith(l, 100), claw: { phase: 'swing', steps: 1, cooldown: 10, dir: 1, held: true } }, 1);
    expect(swiped!.claw.phase).toBe('swing');
    expect(touch(clawBox(swiped!.player, swiped!.claw)!, enemyBox(l.enemies[0]!, plain.enemies[0]!))).toBe(true);
    expect(swiped!.enemies[0]).toEqual(plain.enemies[0]);
  });

  it('GDD-WLD-15 an enemy the cart reaches cannot hit him on that step', () => {
    // An Alacrán in Poncho's hurtbox (its box from y 182, his hurtbox to y 183) and in the cart's box on the first step: it is defeated, and
    // he is not hit (in Base a hit would cost a life).
    const l = withEnemies([{ x: 134, y: FLOOR }]); // it walks 0.5 px to 134.5, the cart's middle after the step
    const [first] = play(l, ridingWith(l, 100), 1);
    expect(reaches(l, first!)).toBe(true);
    const h = { x0: first!.player.x - 5, x1: first!.player.x + 5, y0: first!.player.y - 31, y1: first!.player.y - 1 }; // GDD-MOV-06: 10 x 30
    expect(touch(h, enemyBox(l.enemies[0]!, first!.enemies[0]!))).toBe(true);
    expect(first!.enemies[0]!.alive).toBe(false);
    expect(first!).toMatchObject({ phase: 'playing', lives: { lives: 7 }, invulnerable: 0 });
  });

  it('GDD-WLD-15 an enemy the cart reaches is no stomp on that step', () => {
    // A Paloma coming down, 2 px over the floor after the step (its box y 178 to 190), in the box of an empty cart rolling under it; Poncho
    // falling onto its top from 0 px over it, over the cart but above its floor (y 184). The cart defeats it first: no stomp, no bounce.
    const l = withEnemies([{ x: 145, y: FLOOR, kind: 'paloma' }]);
    const descending: EnemyState = { ...freshEnemies(l.enemies)[0]!, wing: { phase: 'descend', age: 0, lift: 3 } };
    const r = runWith(l, { ...spawn(145, FLOOR - 14), grounded: false, vy: 120 }, [{ phase: 'rolling', m: 100 }]);
    const [first] = play(l, { ...r, enemies: [descending] }, 1);
    expect(reaches(l, first!)).toBe(true);
    const h = { x0: first!.player.x - 5, x1: first!.player.x + 5, y0: first!.player.y - 31, y1: first!.player.y - 1 }; // GDD-MOV-06: 10 x 30
    expect(touch(h, enemyBox(l.enemies[0]!, { ...first!.enemies[0]!, alive: true }))).toBe(true);
    expect(first!.player.y).toBeLessThan(FLOOR - 8); // not down on the cart's floor
    expect(first!.enemies[0]!.alive).toBe(false);
    expect(first!.stomped).toBe(false);
    expect(first!.player.vy).toBeGreaterThan(0);
  });

  it('GDD-WLD-15 the rider\'s body is his own: an enemy at his head\'s height, clear of the cart\'s box, hits him', () => {
    // A Zopilote cruising at y 160, 32 px over the floor: it spots him and freezes for its telegraph at his head's height (its box about y 155
    // to 166, his hurtbox from y 153), clear of the cart's box (from y 176). He rides into it: in Base, one life.
    const l = withEnemies([{ x: 200, y: FLOOR - 32, kind: 'zopilote' }]);
    const states = play(l, ridingWith(l, 100), 40);
    const hit = states.findIndex((s) => s.phase === 'respawning');
    expect(hit).toBeGreaterThan(0);
    expect(states[hit]!.lives.lives).toBe(6);
    expect(states[hit]!.enemies[0]!.alive).toBe(true);
    expect(states.slice(0, hit + 1).every((s) => !reaches(l, s))).toBe(true);
  });

  it('GDD-WLD-15 boxes that only share an edge do not touch', () => {
    // A cactus buddy whose back edge is where the cart's front is after 10 steps from m 100 (x 148 + 25 = 173): still alive then, defeated on
    // the step after.
    const l = withEnemies([{ x: 179, y: FLOOR, kind: 'cactus' }]);
    const states = play(l, ridingWith(l, 100), 12);
    expect(cartBox(R, states[9]!.carts[0]!).x1).toBe(173);
    expect(enemyBox(l.enemies[0]!, states[9]!.enemies[0]!).x0).toBe(173);
    expect(states[9]!.enemies[0]!.alive).toBe(true);
    expect(states[10]!.enemies[0]!.alive).toBe(false);
    // A cactus buddy in mid-air with its feet on the top of the cart's box (y 176): an empty cart rolls under it and leaves it alive; one
    // 1 px lower is defeated.
    for (const [y, alive] of [[FLOOR - 16, true], [FLOOR - 15, false]] as const) {
      const over = withEnemies([{ x: 200, y, kind: 'cactus' }]);
      const passing = play(over, runWith(over, spawn(1200, FLOOR), [{ phase: 'rolling', m: 100 }]), 80);
      expect(passing.some((s) => cartBox(R, s.carts[0]!).x0 < 206 && cartBox(R, s.carts[0]!).x1 > 194), `${y}`).toBe(true);
      expect(passing[79]!.enemies[0]!.alive, `${y}`).toBe(alive);
    }
  });

  it('GDD-WLD-15 a waiting cart defeats nothing: an Alacrán walks through it', () => {
    // Its cart waiting at its start (x 32 to 64), Poncho far away; an Alacrán walks right through it at 30 px/s.
    const l = withEnemies([{ x: 12, y: FLOOR }]);
    const states = play(l, runWith(l, spawn(1200, FLOOR)), 160);
    expect(states.every((s) => s.carts[0]!.phase === 'waiting' && s.enemies[0]!.alive)).toBe(true);
    expect(states.filter((s) => reaches(l, s)).length).toBeGreaterThan(40);
    expect(states[159]!.enemies[0]!.x).toBeGreaterThan(64 + 7); // all the way through
  });

  it('GDD-WLD-15 a stopped cart defeats nothing', () => {
    // Its cart stopped at its buffer (x 640 to 672), nobody in it; an Alacrán walks right into it.
    const l = withEnemies([{ x: 620, y: FLOOR }]);
    const states = play(l, runWith(l, spawn(1200, FLOOR), [{ phase: 'stopped', m: 640 - 16 }]), 100);
    expect(states.every((s) => s.carts[0]!.phase === 'stopped' && s.enemies[0]!.alive)).toBe(true);
    expect(states.filter((s) => reaches(l, s)).length).toBeGreaterThan(40);
  });

  it('GDD-WLD-15 a falling cart defeats nothing', () => {
    // GDD: "A falling cart is no floor and defeats nothing." A broken rail 160 px over the floor, its end at x 256; a cactus buddy in mid-air
    // past the end at the rail's height (x 274 to 286, y 16 to 32), clear of the rolling cart's box (its front at most at x 272): the cart
    // rolls off the end level through it, with nobody in it.
    const B = rail(32, level(14), { y: FLOOR - 160, end: 'broken' });
    const l = withEnemies([{ x: 280, y: FLOOR - 160, kind: 'cactus' }], { rails: [B] });
    const states = play(l, runWith(l, spawn(1200, FLOOR), [{ phase: 'rolling', m: 200 }]), 30);
    const cactus = enemyBox(l.enemies[0]!, states[0]!.enemies[0]!);
    const through = states.filter((s) => {
      const box = fallingBox(B, s.carts[0]!);
      return box !== null && touch({ x0: box.x, x1: box.x + box.w, y0: box.y, y1: box.y + box.h }, cactus);
    });
    expect(through.length).toBeGreaterThan(3);
    expect(states.every((s) => s.enemies[0]!.alive)).toBe(true);
  });

  it('GDD-WLD-15 an empty rolling cart defeats too', () => {
    // He jumps out at once holding back; the cart rolls on with nobody in it into an Alacrán.
    const l = withEnemies([{ x: 300, y: FLOOR }]);
    const { states, k } = runsDown(l, ridingWith(l, 16), 200, (i) => ({ move: i < 40 ? -1 : 0, jumpHeld: i < 30 }));
    expect(states.slice(40, k + 1).every((s) => !inCart(l, s))).toBe(true);
  });

  it('GDD-WLD-15 a left-rolling cart defeats too', () => {
    // Rolling left from x 600, its middle at x 584 at its start; an Alacrán ahead of it on its left.
    const leftward = rail(600, level(30), { dir: -1 });
    const l = withEnemies([{ x: 500, y: FLOOR }], { rails: [leftward] });
    const { states, k } = runsDown(l, ridingWith(l, 16), 60);
    rodeThrough(l, states, k);
  });

  it('GDD-WLD-15 a lost life brings the enemies a cart ran down back', () => {
    // The cart runs down an Alacrán, then a spike hanging at his head's height (column 20, row 9) costs Base Poncho a life.
    const l = withEnemies([{ x: 192, y: FLOOR }], { spikes: [{ col: 20, row: 9 }] });
    const states = play(l, ridingWith(l, 100), 200);
    const k = states.findIndex((s) => !s.enemies[0]!.alive);
    const lost = states.findIndex((s) => s.phase === 'respawning');
    expect(k).toBeGreaterThan(0);
    expect(lost).toBeGreaterThan(k);
    expect(states.slice(k, lost + 1).every((s) => !s.enemies[0]!.alive)).toBe(true);
    const back = states.findIndex((s, i) => i > lost && s.phase === 'playing');
    expect(back).toBeGreaterThan(lost);
    expect(states[back]!.enemies).toEqual(freshEnemies(l.enemies));
  });

  it('GDD-WLD-15 a boss is not an enemy to a cart', () => {
    // 1-4 with a rail added on its floor (as the hit-stop test does): Don Zopilote stuck in the sand at x 232 (his box x 208 to 256, y 194 to
    // 224) in the way of the rolling cart (its box y 208 to 224), nobody in it. He takes no hit and is not defeated.
    const l: Level = { ...LEVEL_1_4, rails: [rail(16, level(26), { y: 14 * TILE })] };
    const r: RunState = { ...startRun(l), player: { ...spawn(400, 224), grounded: true }, boss: { ...bossStart(LEVEL_1_4.boss!, 0), mode: 'stuck', age: 0, x: 232, y: 209, tx: 232, ty: 209 }, carts: [{ phase: 'rolling', m: 150 }] };
    const states = play(l, r, 40);
    expect(states.filter((s) => s.carts[0]!.phase === 'rolling' && touch(cartBox(l.rails![0]!, s.carts[0]!), bossBox(s.boss!))).length).toBeGreaterThan(10);
    expect(states.every((s) => s.boss!.hits === 0 && s.boss!.mode !== 'hurt' && s.boss!.mode !== 'defeated')).toBe(true);
  });

  it('GDD-WLD-15, GDD-PWR-04 the Chile Fantasma and the cart together', () => {
    // With the Chile Fantasma running he rides through an Alacrán that the cart's box and his hurtbox both overlap on the first step: it is
    // defeated once, where it walked to, and stays so; the run goes on, with no stomp.
    const l = withEnemies([{ x: 134, y: FLOOR }]);
    const states = play(l, { ...ridingWith(l, 100), fantasma: FANTASMA.steps }, 30);
    expect(states[0]!.enemies[0]).toEqual({ x: 134.5, y: FLOOR, dir: 1, alive: false });
    expect(states.every((s) => s.enemies[0]!.x === 134.5 && !s.enemies[0]!.alive)).toBe(true);
    expect(states.every((s) => s.phase === 'playing' && s.lives.lives === 7 && !s.stomped && inCart(l, s))).toBe(true);
  });
});
