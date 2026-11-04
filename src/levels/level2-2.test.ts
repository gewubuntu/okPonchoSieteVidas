import { describe, expect, it } from 'vitest';
import { AWNING, TILE } from '../config/tuning';
import { enemyBox, kindOf } from '../sim/enemy';
import { touchesHilo } from '../sim/hilo';
import { spawn, type PlayerInput, type PlayerState } from '../sim/movement';
import { bundleBox, rolloLength } from '../sim/papel';
import { startRun, stepRun, type Level, type RunState } from '../sim/run';
import { veladoraUsed } from '../sim/veladora';
import type { LevelEntry } from './index';
import { LEVEL_2_2 } from './level2-2';
import { gaps, openGaps, validateLevel } from './validate';

/** 2-2 as the game's level list will hold it: a World 2 level, not a test level (GDD-WLD-13, GDD-TEC-04). */
const ENTRY: LevelEntry = { id: '2-2', world: 2, test: false, level: LEVEL_2_2 };

const L = LEVEL_2_2;
const world = L.world;
const R = L.rollos!;
const A = L.awnings!;
const C = L.cordeles!;
const mid = (col: number) => col * TILE + TILE / 2;
const quiet: Level = { ...L, enemies: [] };
const idle: PlayerInput = { move: 0, jumpHeld: false };
const standing = (x: number, y: number): PlayerState => ({ ...spawn(x, y), grounded: true });
/** A run of `level` with Poncho standing at (x, y), in `power`. */
const at = (level: Level, x: number, y: number, power: RunState['power'] = 'base'): RunState => ({ ...startRun(level), player: standing(x, y), power });
/**
 * GDD-WLD-04: what Poncho can stand on in a column: a level tile's top, a cordel's or a rollo's line, an awning's top; how far above it
 * his body reaches: a jump lifts his feet 56 px (GDD-MOV-02), a tier 3 rebound off an awning about 120 px (GDD-WLD-10), plus his 32 px.
 */
const tops = (col: number): { y: number; reach: number }[] => {
  const out: { y: number; reach: number }[] = [];
  for (let row = 1; row < world.height; row++) if (world.solidTile(col, row) && !world.solidTile(col, row - 1)) out.push({ y: row * TILE, reach: 88 });
  for (const l of [...C, ...R]) if (l.x <= col * TILE && l.x + l.w >= (col + 1) * TILE) out.push({ y: l.y, reach: 88 });
  for (const a of A) if (a.x <= col * TILE && a.x + a.w >= (col + 1) * TILE) out.push({ y: a.y, reach: 152 });
  return out;
};
/** The same run with rollo `i` strung to its full length (GDD-WLD-11). */
const strung = (r: RunState, i: number): RunState => ({ ...r, rollos: r.rollos.map((s, k) => (k === i ? { steps: 60 } : s)) });

// ---------------------------------------------------------------------------------------------------------------------------------
// The bot. It plays a list of controllers, each giving the input for a step and saying when it is done. It lets go of a button for a
// step before pressing it again (L-048): claw and Fuego are pressed on the first step a controller asks for them only.

type Ctl = (r: RunState, t: number) => { input: PlayerInput; done: boolean };

/**
 * Holds right until `until` holds. On the ground it jumps (held 20 steps) at a wall in the row above its feet within 14 px of its front
 * edge, at a spike on its floor starting within 26 px, at a closed piñata 48 px over its feet just ahead, and, unless `drops` is false,
 * at a drop to a pit within 10 px. It claws any enemy whose box is level with its body and starts within 22 px of its front edge.
 */
const runRight = (until: (r: RunState) => boolean, drops = false): Ctl => {
  let hold = 0;
  // The controller before may have ended holding jump: let go for a step before the first press (L-048).
  let before = true;
  return (r) => {
    const p = r.player;
    if (until(r)) return { input: idle, done: true };
    let jump = false;
    let claw = false;
    const front = p.x + 6;
    if (p.grounded) {
      const feetRow = Math.floor((p.y - 1) / TILE);
      for (let d = 0; d <= 14; d++) if (world.solidTile(Math.floor((front + d) / TILE), feetRow) && p.y - feetRow * TILE > 4) jump = true;
      if (drops) {
        for (let d = 0; d <= 10; d++) {
          const col = Math.floor((front + d) / TILE);
          let row = feetRow + 1;
          while (row < world.height && !world.solidTile(col, row)) row++;
          if (row >= world.height) jump = true;
        }
      }
      for (const s of L.spikes) if (s.row === feetRow && s.col * TILE - p.x >= 0 && s.col * TILE - p.x <= 26) jump = true;
      L.pinatas.forEach((pn, i) => {
        if (!r.pinatasOpen[i] && (pn.row + 4) * TILE === p.y && pn.col * TILE - p.x >= -12 && pn.col * TILE - p.x <= -2) jump = true;
      });
    }
    if (r.enemies.length === L.enemies.length) L.enemies.forEach((e, i) => {
      const s = r.enemies[i]!;
      if (!s.alive) return;
      const b = enemyBox(e, s);
      if (b.x0 - front <= 22 && b.x1 > p.x && b.y1 > p.y - 32 && b.y0 < p.y) claw = true;
    });
    if (jump && hold === 0 && !before) hold = 20;
    const held = hold > 0;
    if (hold > 0) hold--;
    before = held;
    return { input: { move: 1, jumpHeld: held, claw }, done: false };
  };
};

/** Walks right to just short of `x` on the ground and stops there, facing right (it never overshoots: 1000 px/s² braking, GDD-MOV-01). */
const goTo = (x: number): Ctl => (r) => {
  const p = r.player;
  if (p.grounded && Math.abs(p.vx) < 1e-9 && x - p.x < 4) return { input: idle, done: true };
  return { input: { move: p.x + (p.vx * p.vx) / 2000 + p.vx / 60 < x ? 1 : 0, jumpHeld: false }, done: false };
};
/** One step with this input. */
const once = (input: PlayerInput): Ctl => (_r, t) => ({ input, done: t >= 1 });
const waitFor = (cond: (r: RunState) => boolean): Ctl => (r) => ({ input: idle, done: cond(r) });
/** Holds jump for `n` steps, moving `move`, then keeps moving `after` until he lands. */
const jump = (n: number, move: number, after = move): Ctl => (r, t) => {
  if (t > n + 2 && r.player.grounded) return { input: idle, done: true };
  return { input: { move: t < n ? move : after, jumpHeld: t < n }, done: false };
};
/** A full jump (held 20 steps) that steers right until his centre passes `x`, then lands. */
const hopTo = (x: number): Ctl => (r, t) => {
  if (t > 3 && r.player.grounded) return { input: idle, done: true };
  return { input: { move: r.player.x < x ? 1 : 0, jumpHeld: t < 20 }, done: false };
};
/** Stands at the edge of rollo `i`'s pit, claws its bundle, waits two steps and jumps onto the line (GDD-WLD-11). */
const crossRollo = (i: number): Ctl[] => [goTo(R[i]!.x - 7), once({ ...idle, claw: true }), waitFor((r) => (r.rollos[i]!.steps ?? -1) >= 2), jump(20, 1)];
/** Walks right towards enemy `i` and claws it once its box is within 18 px of his front edge; done once it is defeated. */
const fight = (i: number): Ctl => (r) => {
  const s = r.enemies[i]!;
  if (!s.alive) return { input: idle, done: true };
  const b = enemyBox(L.enemies[i]!, s);
  const gap = b.x0 - (r.player.x + 6);
  return { input: { move: gap > 14 ? 1 : 0, jumpHeld: false, claw: gap <= 18 && b.y1 > r.player.y - 32 && b.y0 < r.player.y }, done: false };
};
const groundAt = (y: number, x: number) => (r: RunState) => r.player.grounded && r.player.y === y && r.player.x > x;
/** Holds jump (and so climbs the awning's ladder, GDD-WLD-10), steering right once the chain reaches `tier`, until he stands at `y`. */
const ladder = (tier: number, y: number): Ctl => (r, t) => ({ input: { move: (r.player.awningChain ?? 0) >= tier ? 1 : 0, jumpHeld: true }, done: t > 5 && r.player.grounded && r.player.y === y });

/** The main route, start to the last awning, as fresh controllers (`runRight` keeps state). */
const route = (): Ctl[] => [
  // Ki: up the crate and onto the mezzanine; claw the bundle at its edge and hop onto the bridge as it unrolls.
  runRight(groundAt(160, 250)),
  ...crossRollo(0),
  // Shō: through the first Chapulín's pen; the three rollos over the floor's pits, the Paloma on the pillar between the last two.
  runRight(groundAt(224, 700)),
  ...crossRollo(1),
  runRight(groundAt(224, 900)),
  ...crossRollo(2),
  runRight(groundAt(224, 1030)),
  ...crossRollo(3),
  // The second Chapulín: from the top of its pen's wall, wait until it crouches near, step down and claw it.
  runRight(groundAt(224, 1150)),
  goTo(1176),
  jump(12, 1, 0),
  goTo(1199),
  waitFor((r) => r.enemies[2]!.hop!.phase === 'crouch' && r.enemies[2]!.x < 1245 && r.enemies[2]!.hop!.age < 3),
  fight(2),
  // Under the awning: once the Paloma on the stall's cordel walks away (or is gone), jump and hold, two held rebounds, the second
  // steering right onto the flower stall's wall; then the cordel.
  goTo(1330),
  ladder(2, 128),
  runRight(groundAt(128, 1460), true),
  runRight(groundAt(224, 1560)),
  // Ten: the taco on the floor, a jump under the piñata opens it (the chile on its top), onto the walkway, a hop left onto the
  // piñata takes the chile, back onto the walkway, a fireball, and a jump over the spikes onto the bridge as it unrolls.
  runRight(groundAt(176, 1700)),
  goTo(1705),
  jump(20, -1),
  jump(20, 1),
  goTo(1750),
  once({ ...idle, fuego: true }),
  waitFor((r) => (r.rollos[4]!.steps ?? -1) >= 1),
  (r, t) => ({ input: { move: 1, jumpHeld: r.player.x >= 1772 && t < 60 }, done: t > 10 && r.player.grounded && r.player.y === 200 }),
  // Ketsu: past the Tlacuache's pen, the aisle's rollo, a held hop onto its first awning and up onto the cordel above.
  runRight(groundAt(224, 2030)),
  ...crossRollo(5),
  goTo(2118),
  (r, t) => ({ input: { move: 1, jumpHeld: r.player.x >= 2126 }, done: t > 5 && r.player.grounded && r.player.y === 144 }),
  // Over the gap onto the second cordel (its Paloma), off its end, past the third ofrenda, over the wall and onto the last awning.
  runRight(groundAt(144, 2245), true),
  runRight((r) => r.player.x > 2440),
  goTo(2466),
  hopTo(2490),
  goTo(2512),
  hopTo(2560),
  goTo(2588),
];

/** The end of the main route: a jump from the awning's right end, a claw on the way up, then right along the high bridge to the exit. */
const finale = (): Ctl[] => [
  (r) => {
    const p = r.player;
    const clawed = r.rollos[6]!.steps !== null;
    return { input: { move: clawed ? 1 : 0, jumpHeld: true, claw: !clawed && p.vy < 0 && p.y < 152 }, done: p.grounded && p.y === 112 };
  },
  runRight(() => false),
];

/** The expert's end: three held rebounds off the last awning, a claw on the tier 3 rise, the veladora at its top, then the bridge. */
const expert = (): Ctl[] => [
  goTo(2585),
  (r) => {
    const p = r.player;
    const tier3 = (p.awningChain ?? 0) >= 3;
    const clawed = r.rollos[6]!.steps !== null;
    // Right once the rise is over: the veladora is at its top, over the awning's right end.
    return { input: { move: tier3 && clawed && p.vy >= 0 ? 1 : 0, jumpHeld: true, claw: tier3 && !clawed && p.vy < 0 && p.y < 152 }, done: p.grounded && p.y === 112 };
  },
  runRight(() => false),
];

interface Played {
  readonly run: RunState;
  readonly states: readonly RunState[];
  readonly lost: number;
  /** The step each controller finished on. */
  readonly marks: readonly number[];
}

function play(tasks: readonly Ctl[], level: Level = L, from: RunState = startRun(level), maxSteps = 3000): Played {
  let run = from;
  const states: RunState[] = [];
  const marks: number[] = [];
  let k = 0;
  let t = 0;
  let clawBefore = false;
  let fuegoBefore = false;
  let lost = 0;
  while (k < tasks.length && run.phase !== 'clear' && states.length < maxSteps) {
    const { input, done } = tasks[k]!(run, t);
    if (done) {
      marks.push(states.length);
      k++;
      t = 0;
      continue;
    }
    t++;
    const step: PlayerInput = { ...input, claw: (input.claw ?? false) && !clawBefore, fuego: (input.fuego ?? false) && !fuegoBefore };
    clawBefore = input.claw ?? false;
    fuegoBefore = input.fuego ?? false;
    const before = run.lives.lives;
    run = stepRun(run, step, level);
    if (run.lives.lives < before) lost++;
    states.push(run);
  }
  return { run, states, lost, marks };
}

/**
 * Every running or standing jump from `xs` (standing still there, then holding right from the first step; jump pressed on step `k` for
 * each k from 0 to 24 and held 20 steps): where each first comes down (its feet's y and x), or 'lost' if a life goes first.
 */
function everyJump(level: Level, xs: readonly number[], y: number, power: RunState['power'] = 'base'): ({ x: number; y: number } | 'lost')[] {
  const out: ({ x: number; y: number } | 'lost')[] = [];
  for (const x0 of xs) {
    for (let k = 0; k <= 24; k++) {
      let r = at(level, x0, y, power);
      let air = false;
      let end: { x: number; y: number } | 'lost' | null = null;
      for (let i = 0; i < 240 && end === null; i++) {
        r = stepRun(r, { move: 1, jumpHeld: i >= k && i < k + 20 }, level);
        if (r.phase !== 'playing' || r.lives.lives < 7 || r.power !== power) end = 'lost';
        else if (!r.player.grounded) air = true;
        else if (air) end = { x: r.player.x, y: r.player.y };
      }
      out.push(end ?? 'lost');
    }
  }
  return out;
}

const range = (from: number, to: number, by: number): number[] => Array.from({ length: Math.floor((to - from) / by) + 1 }, (_, i) => from + i * by);

describe('GDD-WLD-13 level 2-2', () => {
  it('GDD-WLD-13 2-2 is 180 by 17 tiles and passes the validator with World 2 rules, which World 1 rules would not', () => {
    expect(world.width).toBe(180);
    expect(world.height).toBe(17); // GDD-UI-04: one screen tall, the camera moves sideways only
    expect(validateLevel(ENTRY)).toEqual([]);
    // The aisle's and the last pit's open runs are 4 tiles: World 2 allows them (GDD-WLD-03), World 1 would not.
    expect(validateLevel({ ...ENTRY, world: 1 })).toEqual(['gap of 4 tiles at columns 133 to 136, World 1 allows 3', 'gap of 4 tiles at columns 162 to 165, World 1 allows 3']);
    expect(L.abilities).toBeUndefined(); // GDD-PRG-01: no glide and no wall cling in World 2
  });

  it('GDD-WLD-13 2-2 starts at column 3 on the floor, and the exit stands at column 174 on the rooftop', () => {
    expect(L.spawn).toEqual({ x: 56, y: 224 });
    expect(L.exit).toEqual({ x: 2792, y: 112 });
    expect(world.solidTile(174, 7)).toBe(true);
    expect(world.solidTile(174, 6)).toBe(false);
  });

  it('GDD-WLD-03 2-2 ofrendas stand on the floor at columns 45, 99 and 153, about 25 55 and 85 percent', () => {
    expect(L.ofrendas.map((o) => [o.id, o.x, o.y])).toEqual([
      ['2-2-1', 728, 224],
      ['2-2-2', 1592, 224],
      ['2-2-3', 2456, 224],
    ]);
    [0.25, 0.55, 0.85].forEach((share, i) => expect(Math.abs(L.ofrendas[i]!.x / 2880 - share), `ofrenda ${i + 1}`).toBeLessThan(0.03));
  });

  it('GDD-WLD-13 2-2 has the walls, mezzanines, pen walls, walkway, rooftop and beam of its map and no other ground above the floor', () => {
    const expected = new Set<string>();
    const add = (c0: number, c1: number, r0: number, r1: number) => {
      for (let c = c0; c <= c1; c++) for (let r = r0; r <= r1; r++) expected.add(`${c},${r}`);
    };
    add(9, 9, 12, 13); // the crate up
    add(10, 19, 10, 13); // the mezzanine, top y = 160
    add(20, 20, 12, 13); // the step out of the sunken aisle
    add(26, 28, 10, 13); // the far mezzanine
    add(29, 29, 12, 13); // the crate down
    add(33, 33, 12, 13); // the first Chapulín's pen
    add(41, 41, 12, 13);
    add(74, 74, 12, 13); // the second Chapulín's pen wall
    add(87, 89, 8, 13); // the flower stall's wall, top y = 128
    add(106, 110, 11, 13); // the walkway over the chile stall, top y = 176
    add(123, 123, 13, 13); // the Tlacuache's block
    add(155, 156, 12, 13); // the wall before the last awning
    add(170, 179, 7, 13); // the rooftop, top y = 112
    const found = new Set<string>();
    for (let c = 0; c < world.width; c++) for (let r = 0; r < 14; r++) if (world.solidTile(c, r)) found.add(`${c},${r}`);
    expect(found).toEqual(expected);
  });

  it('GDD-WLD-03 2-2 pits are 6, 6, 6, 6, 6, 14 and 8 tiles wide, and the uncovered runs in them at most 4 (World 2)', () => {
    expect(gaps(world)).toEqual([
      { col: 49, width: 6 },
      { col: 58, width: 6 },
      { col: 66, width: 6 },
      { col: 90, width: 6 },
      { col: 115, width: 6 },
      { col: 129, width: 14 },
      { col: 162, width: 8 },
    ]);
    // Covered (GDD-WLD-03): the rollos over the floor's pits; the cordel's near half past the stall wall; the aisle's rollo and awnings;
    // the high rollo's far half, level with the rooftop.
    expect(openGaps(L)).toEqual([
      { col: 90, width: 1 },
      { col: 93, width: 3 },
      { col: 133, width: 4 },
      { col: 139, width: 2 },
      { col: 162, width: 4 },
    ]);
  });

  it('GDD-WLD-11 2-2 has seven rollos, each tied at its left post with no ofrenda between its post and its far end', () => {
    expect(R.map((r) => [r.x / TILE, r.y, r.w / TILE, r.post])).toEqual([
      [20, 152, 6, 'left'],
      [49, 216, 6, 'left'],
      [58, 216, 6, 'left'],
      [66, 216, 6, 'left'],
      [115, 200, 6, 'left'],
      [129, 208, 4, 'left'],
      [162, 112, 8, 'left'],
    ]);
    // A rollo lies between its respawn ofrenda and the pit it bridges, so Poncho never respawns past a rolled-up bridge (GDD-WLD-11).
    for (const r of R) expect(L.ofrendas.some((o) => o.x >= r.x && o.x <= r.x + r.w), `rollo at ${r.x}`).toBe(false);
    // Each bridges the sunken aisle or a pit: under its line the first ground is 40 px down or more (the step in the aisle), or none.
    for (const r of R) {
      for (let c = r.x / TILE; c < (r.x + r.w) / TILE; c++) {
        let row = Math.ceil(r.y / TILE);
        while (row < world.height && !world.solidTile(c, row)) row++;
        expect(row * TILE - r.y, `rollo at ${r.x}, column ${c}`).toBeGreaterThanOrEqual(40);
      }
    }
  });

  it('GDD-WLD-10 GDD-WLD-11 2-2 awnings and cordeles: where they are, clear air between them, no piñata near, edges that read', () => {
    expect(A.map((a) => [a.x / TILE, a.y, a.w / TILE, a.torn ?? false])).toEqual([
      [82, 208, 5, false],
      [137, 208, 2, false],
      [141, 208, 2, false],
      [158, 160, 4, false],
    ]);
    expect(C.map((c) => [c.x / TILE, c.y, c.w / TILE])).toEqual([
      [91, 128, 5],
      [133, 144, 6],
      [140, 144, 5],
    ]);
    // A cordel over an awning has at least 2 tiles of clear air between them (GDD-WLD-11).
    for (const c of C) for (const a of A) if (c.x < a.x + a.w && c.x + c.w > a.x) expect(a.y - c.y, `cordel ${c.x} over awning ${a.x}`).toBeGreaterThanOrEqual(2 * TILE + 2);
    // No piñata in an awning's tiles or over one, and an awning's end is a tile or more from a level tile whose top is at its height (GDD-WLD-10).
    for (const a of A) {
      for (const p of L.pinatas) expect(p.col * TILE >= a.x && p.col * TILE < a.x + a.w, `piñata ${p.col}`).toBe(false);
      const row = a.y / TILE;
      for (const col of [a.x / TILE - 1, (a.x + a.w) / TILE]) expect(world.solidTile(col, row) && !world.solidTile(col, row - 1), `awning ${a.x}, column ${col}`).toBe(false);
      expect(a.y).toBeGreaterThanOrEqual(AWNING.minTopY);
    }
  });

  it('GDD-ENM-03 2-2 enemies: three Chapulines, three Palomas and a Tlacuache, where the map puts them', () => {
    expect(L.enemies.map((e) => [kindOf(e), e.x, e.y])).toEqual([
      ['chapulin', mid(37), 224],
      ['paloma', 1040, 224],
      ['chapulin', mid(84), 208],
      ['paloma', mid(94), 128],
      ['tlacuache', mid(126), 224],
      ['paloma', mid(142), 144],
      ['chapulin', mid(159), 224],
    ]);
  });

  it('GDD-ENM-03 2-2 while Poncho waits at the start, each enemy keeps to its stretch and no walker crosses an awning', () => {
    let r = startRun(L);
    const lo = L.enemies.map(() => Infinity);
    const hi = L.enemies.map(() => -Infinity);
    let thrown = 0;
    let onFloor = 0;
    for (let i = 0; i < 1800; i++) {
      r = stepRun(r, idle, L);
      r.enemies.forEach((e, k) => {
        lo[k] = Math.min(lo[k]!, e.x);
        hi[k] = Math.max(hi[k]!, e.x);
        const def = L.enemies[k]!;
        if (kindOf(def) !== 'chapulin') {
          const b = enemyBox(def, e);
          for (const a of A) expect(b.x0 < a.x + a.w && b.x1 > a.x && b.y0 < a.y + AWNING.height && b.y1 > a.y, `${kindOf(def)} ${k} on awning ${a.x}`).toBe(false);
        }
      });
      const c = r.enemies[2]!;
      if (c.hop!.on !== undefined) thrown++;
      if (c.hop!.phase === 'crouch' && c.y === 224 && c.hop!.age === 0) onFloor++;
    }
    expect(r.enemies.every((e) => e.alive)).toBe(true);
    const span = lo.map((v, k) => [Math.round(v), Math.round(hi[k]!)]);
    expect(span).toEqual([
      [550, 650], // the first Chapulín, in its pen (columns 34 to 40)
      [1031, 1049], // the Paloma, on the pillar
      [1216, 1386], // the second Chapulín, between its pen wall and the flower stall
      [1463, 1529], // the Paloma on the cordel past the flower stall, never on its wall
      [1992, 2056], // the Tlacuache, between its block and the aisle's pit
      [2247, 2313], // the Paloma on the aisle's second cordel, clear of the first awning (x = 2192 to 2224)
      [2527, 2577], // the third Chapulín, under the last awning
    ]);
    // The second Chapulín's round: tall, regular rebounds on its awning, then hops on the floor, and back.
    expect(thrown).toBe(11);
    expect(onFloor).toBe(24);
  });

  it('GDD-WLD-04 2-2 has 50 hilos each in an empty tile within reach of something to stand on, and none at a respawn', () => {
    const hilos = L.hilos!;
    expect(hilos).toHaveLength(50);
    expect(new Set(hilos.map((h) => `${h.col},${h.row}`)).size).toBe(50);
    const things = [...L.pinatas, ...L.tacos, ...L.spikes, L.veladora!];
    for (const h of hilos) {
      const where = `hilo at ${h.col},${h.row}`;
      expect(world.solidTile(h.col, h.row), where).toBe(false);
      expect(things.some((t) => t.col === h.col && t.row === h.row), where).toBe(false);
      const y = h.row * TILE + TILE / 2;
      expect([-2, -1, 0, 1, 2].some((d) => tops(h.col + d).some((t) => t.y - y >= 0 && t.y - y <= t.reach)), where).toBe(true);
    }
    for (const p of [L.spawn, ...L.ofrendas]) for (const h of hilos) expect(touchesHilo(spawn(p.x, p.y), h), `${p.x}: ${h.col},${h.row}`).toBe(false);
  });

  it('GDD-PWR-05 2-2 the piñata hangs 48 px over the floor, two columns before the walkway, the taco on the floor before it', () => {
    expect(L.pinatas).toEqual([{ col: 103, row: 10 }]);
    expect(L.tacos).toEqual([{ col: 101, row: 13 }]);
    expect(L.spikes).toEqual([111, 112, 113, 114].map((col) => ({ col, row: 13 })));
    expect(L.veladora).toEqual({ col: 161, row: 0 });
    expect(L.springs).toEqual([]);
    expect(L.crumbles).toEqual([]);
  });
});

describe('GDD-WLD-13 playing 2-2: ki, the rollo where failing is safe', () => {
  it('GDD-WLD-13 2-2 walking off the mezzanine into the sunken aisle costs no life, and he climbs back out by the step', () => {
    let r = at(quiet, 300, 160);
    for (let i = 0; i < 60; i++) r = stepRun(r, { move: 1, jumpHeld: false }, quiet);
    expect(r.player.y).toBe(224);
    expect(r.player.grounded).toBe(true);
    expect(r.lives.lives).toBe(7);
    // Back left: a hop onto the step (2 tiles), another onto the mezzanine (2 tiles).
    const back = play([(rr, t) => ({ input: { move: -1, jumpHeld: t >= 20 && t < 40 }, done: t > 25 && rr.player.grounded && rr.player.y === 192 }), (rr, t) => ({ input: { move: -1, jumpHeld: t < 20 }, done: t > 3 && rr.player.grounded })], quiet, r);
    expect(back.run.player.y).toBe(160);
    expect(back.run.player.x).toBeLessThan(320);
    expect(back.lost).toBe(0);
  });

  it('GDD-WLD-13 2-2 without the bridge no jump from the mezzanine reaches the far mezzanine, and none costs a life', () => {
    const ends = everyJump(quiet, range(200, 314, 6), 160);
    // Each comes down on the mezzanine itself (a jump before its edge), on the step in the sunken aisle, or on the aisle's floor.
    expect(ends.every((e) => e !== 'lost' && ((e.y === 160 && e.x - 6 < 320) || (e.y === 192 && e.x - 6 < 336) || (e.y === 224 && e.x + 6 > 336 && e.x - 6 < 416)))).toBe(true);
    expect(ends.filter((e) => e !== 'lost' && e.y === 224).length).toBeGreaterThan(ends.length / 3);
  });

  it('GDD-WLD-11 2-2 a claw from the mezzanine edge unrolls the bundle and the bridge carries him over, its front always ahead of him', () => {
    const p = play(crossRollo(0), quiet, at(quiet, 250, 160));
    expect(p.run.player.y).toBe(152);
    expect(p.run.player.grounded).toBe(true);
    // From the swipe (pressed on the step he stops) and running straight on, his centre stays behind the strung front.
    const margins = p.states.flatMap((s) => (s.rollos[0]!.steps === null || rolloLength(R[0]!, s.rollos[0]!) >= R[0]!.w ? [] : [R[0]!.x + rolloLength(R[0]!, s.rollos[0]!) - s.player.x]));
    expect(margins.length).toBeGreaterThan(30); // 96 px at 160 px/s: 36 steps
    expect(Math.min(...margins)).toBeGreaterThan(0);
  });
});

describe('GDD-WLD-13 playing 2-2: shō', () => {
  it('GDD-WLD-11 2-2 no jump crosses a floor pit with its rollo rolled up: every one ends in the pit', () => {
    for (const i of [1, 2, 3]) {
      const r = R[i]!;
      // From the edge before the pit (the pillar for the third), standing or after a run-up.
      const from = i === 3 ? range(1030, 1050, 4) : range(r.x - 60, r.x - 7, 6);
      const ends = everyJump(quiet, from, 224);
      // Each comes down short of the pit (on the floor or the pillar he jumped from) or in it.
      expect(ends.every((e) => e === 'lost' || e.x - 6 < r.x), `rollo ${i}`).toBe(true);
      expect(ends.filter((e) => e === 'lost').length, `rollo ${i}`).toBeGreaterThan(ends.length / 2);
    }
  });

  it('GDD-WLD-11 2-2 on every floor pit the bot claws from the edge and the bridge front stays ahead of his centre', () => {
    const p = play(route().slice(0, 20), L);
    expect(p.lost).toBe(0);
    for (const i of [1, 2, 3]) {
      const r = R[i]!;
      const margins = p.states.flatMap((s) => (s.rollos[i]!.steps === null || rolloLength(r, s.rollos[i]!) >= r.w ? [] : [r.x + rolloLength(r, s.rollos[i]!) - s.player.x]));
      expect(Math.min(...margins), `rollo ${i}`).toBeGreaterThan(5);
      expect(p.states.some((s) => s.player.grounded && s.player.y === r.y && s.player.x > r.x + 8), `on rollo ${i}`).toBe(true);
    }
  });

  it('GDD-WLD-10 2-2 the flower stall wall: a tier 1 rebound off the awning falls short of its top, a tier 2 rebound clears it', () => {
    // Bouncing in place on the awning holding jump: the feet's highest point on each rise (GDD-WLD-10: about 56, 77, 98 and 120 px).
    let r = at(quiet, 1360, 208);
    const peaks: number[] = [];
    let top = 999;
    let rising = false;
    for (let i = 0; i < 200 && peaks.length < 3; i++) {
      r = stepRun(r, { move: 0, jumpHeld: true }, quiet);
      if (r.player.vy < 0) rising = true;
      top = Math.min(top, r.player.y);
      if (rising && r.player.vy > 0) {
        peaks.push(Math.round(top * 10) / 10);
        top = 999;
        rising = false;
      }
    }
    expect(peaks[0]).toBeGreaterThan(128 + 16); // the jump from standing
    expect(peaks[1]).toBeGreaterThan(128); // tier 1: short of the wall's top (y = 128)
    expect(peaks[2]).toBeLessThan(128 - 16); // tier 2: clears it
    expect(peaks).toEqual([151.6, 130.9, 110.7]);
  });

  it('GDD-WLD-10 2-2 from under the awning, two held rebounds and right on the second land him on the flower stall wall', () => {
    const p = play([ladder(2, 128)], quiet, at(quiet, 1330, 224));
    expect(p.run.player.y).toBe(128);
    expect(p.run.player.x).toBeGreaterThan(1392);
    expect(p.lost).toBe(0);
    // Steering right from the first held rebound instead, he meets the wall's side and comes down short of its top.
    let r = at(quiet, 1330, 224);
    let first = -1;
    for (let i = 0; i < 200 && first < 0; i++) {
      const before = r.player.awningChain ?? 0;
      r = stepRun(r, { move: (r.player.awningChain ?? 0) >= 1 ? 1 : 0, jumpHeld: true }, quiet);
      if (before === 1 && r.player.grounded) first = r.player.y;
      if (before === 1 && (r.player.awningChain ?? 0) === 2) first = 208;
    }
    expect(first).toBe(208);
  });
});

describe('GDD-WLD-13 playing 2-2: ten, the first chile and a bundle out of the claw reach', () => {
  it('GDD-PWR-02 2-2 walking right from the second ofrenda picks up the taco, and a jump under the piñata then gives the chile on its top', () => {
    let r = at(quiet, 1592, 224);
    for (let i = 0; i < 18; i++) r = stepRun(r, { move: 1, jumpHeld: false }, quiet);
    expect(r.power).toBe('taco');
    const p = play([goTo(1655), jump(20, 0)], quiet, r);
    expect(p.run.pinatasOpen).toEqual([true]);
    expect(p.run.items.map((item) => [item.kind, item.x, item.y])).toEqual([['chile', mid(103), 160]]);
  });

  it('GDD-PWR-05 2-2 the chile is taken by a hop left from the walkway end, and Poncho is Fuego', () => {
    const p = play([runRight(groundAt(176, 1700)), goTo(1705), jump(20, -1)], quiet, at(quiet, 1592, 224));
    expect(p.run.power).toBe('fuego');
    expect(p.run.player.y).toBe(160); // on the piñata's top
    expect(p.lost).toBe(0);
  });

  it('GDD-PWR-05 2-2 in Base the piñata gives a taco that Poncho, standing under it, catches as it comes back', () => {
    const level: Level = { ...quiet, tacos: [] };
    const p = play([goTo(1655), jump(20, 0), waitFor((r) => r.power === 'taco' || r.items.length === 0)], level, at(level, 1600, 224), 900);
    expect(p.run.power).toBe('taco');
    expect(p.states.length).toBeLessThan(400);
  });

  it('GDD-WLD-11 2-2 from anywhere on the walkway a claw never touches the bundle, a standing jump and claw neither', () => {
    for (const x of range(1702, 1781, 3)) {
      for (const k of [-1, ...range(0, 40, 2)]) {
        let r = at(quiet, x, 176);
        let held = false;
        for (let i = 0; i < 60; i++) {
          r = stepRun(r, { move: 0, jumpHeld: k >= 0 && i < 20, claw: i === Math.max(k, 0) + 1 && !held }, quiet);
          held = i === Math.max(k, 0) + 1;
        }
        expect(r.rollos[4]!.steps, `x ${x}, claw at ${k}`).toBeNull();
      }
    }
  });

  it('GDD-WLD-11 GDD-PWR-03 2-2 from anywhere on the walkway, facing right, a fireball unrolls the bundle', () => {
    const steps: number[] = [];
    for (const x of range(1702, 1776, 1)) {
      let r = at(quiet, x, 176, 'fuego');
      r = stepRun(r, { move: 0, jumpHeld: false, fuego: true }, quiet);
      let n = 1;
      while (r.rollos[4]!.steps === null && n < 120) {
        r = stepRun(r, idle, quiet);
        n++;
      }
      expect(r.rollos[4]!.steps, `x ${x}`).not.toBeNull();
      steps.push(n);
    }
    expect([Math.min(...steps), Math.max(...steps)]).toEqual([21, 44]);
  });

  it('GDD-WLD-13 2-2 from the walkway, without the bridge every jump lands on the spikes or in the pit', () => {
    for (const power of ['base', 'taco'] as const) {
      const ends = everyJump(quiet, range(1702, 1781, 6), 176, power);
      expect(ends.every((e) => e === 'lost' || e.y === 176), power).toBe(true);
    }
  });

  it('GDD-WLD-13 2-2 with the bridge strung, a running jump from the walkway edge lands on it over the spikes', () => {
    const r = strung(at(quiet, 1781, 176), 4);
    const p = play([jump(20, 1)], quiet, r);
    expect(p.run.player.y).toBe(200);
    expect(p.lost).toBe(0);
  });

  it('GDD-WLD-13 2-2 never a dead end: dropping onto the spikes in Taco costs the taco, and a claw by the pit unrolls the bundle', () => {
    const p = play([jump(4, 1), (r, t) => ({ input: { move: r.player.x < 1830 ? 1 : 0, jumpHeld: false, claw: t === 30 }, done: t > 40 }), jump(20, 1), runRight(groundAt(224, 1950))], quiet, at(quiet, 1781, 176, 'taco'));
    expect(p.run.power).toBe('base');
    expect(p.lost).toBe(0);
    expect(p.run.rollos[4]!.steps).not.toBeNull();
    expect(p.run.player.x).toBeGreaterThan(1950);
  });
});

describe('GDD-WLD-13 playing 2-2: ketsu, rollos with awnings', () => {
  it('GDD-WLD-13 2-2 the aisle: no jump from its bridge reaches the cordel, a held rebound off the first awning does', () => {
    const r0 = strung(at(quiet, 2100, 208), 5);
    // A full jump lifts his feet about 56 px (GDD-MOV-02), and the cordel is 64 px over the bridge: none lands on it.
    for (const x of range(2070, 2122, 4)) {
      for (const k of [0, 4, 8]) {
        let r = { ...r0, player: standing(x, 208) };
        for (let i = 0; i < 90 && r.phase === 'playing'; i++) {
          r = stepRun(r, { move: 1, jumpHeld: i >= k && i < k + 20 }, quiet);
          expect(r.player.grounded && r.player.y === C[1]!.y, `x ${x}, jump at ${k}, step ${i}`).toBe(false);
        }
      }
    }
    const p = play([(r, t) => ({ input: { move: 1, jumpHeld: r.player.x >= 2126 }, done: t > 5 && r.player.grounded && r.player.y === 144 })], quiet, { ...r0, player: standing(2070, 208) }, 200);
    expect(p.run.player.y).toBe(144);
    expect(p.states.some((s) => (s.player.awningChain ?? 0) === 1)).toBe(true);
  });

  it('GDD-WLD-11 2-2 the aisle pit cannot be crossed with its rollo rolled up', () => {
    const ends = everyJump(quiet, range(2000, 2057, 6), 224);
    expect(ends.every((e) => e === 'lost' || e.x - 6 < R[5]!.x)).toBe(true);
  });

  it('GDD-WLD-11 2-2 the high bundle: no jump and claw from the floor touches it, a jump and claw from the last awning does', () => {
    for (const x of range(2540, 2597, 3)) {
      for (const k of range(0, 30, 1)) {
        let r = at(quiet, x, 224);
        for (let i = 0; i < 50; i++) r = stepRun(r, { move: 0, jumpHeld: i < 20, claw: i === k }, quiet);
        expect(r.rollos[6]!.steps, `floor x ${x}, claw at ${k}`).toBeNull();
      }
    }
    const p = play(finale(), quiet, at(quiet, 2588, 160));
    expect(p.run.phase).toBe('clear');
    expect(p.lost).toBe(0);
    const margins = p.states.flatMap((s) => (s.rollos[6]!.steps === null || rolloLength(R[6]!, s.rollos[6]!) >= R[6]!.w ? [] : [R[6]!.x + rolloLength(R[6]!, s.rollos[6]!) - s.player.x]));
    expect(Math.min(...margins)).toBeGreaterThan(0);
  });

  it('GDD-WLD-11 2-2 without the high bridge every jump from the floor or the last awning ends in the pit', () => {
    // From the awning: back on it, down in the Chapulín's pen under it, or in the pit. From the pen's floor the awning, 64 px up, is out of reach.
    const fromAwning = everyJump(quiet, range(2530, 2590, 6), 160);
    expect(fromAwning.every((e) => e === 'lost' || e.y === 160 || e.y === 224)).toBe(true);
    expect(fromAwning.filter((e) => e === 'lost').length).toBeGreaterThan(fromAwning.length / 2);
    expect(everyJump(quiet, range(2518, 2585, 6), 224).every((e) => e === 'lost' || e.y === 224)).toBe(true);
  });

  it('GDD-LIFE-03 2-2 the veladora: the rise of a tier 3 rebound off the last awning touches it, tier 2 and a jump from the bridge do not', () => {
    const p = play(expert(), quiet, at(quiet, 2560, 160));
    expect(p.run.phase).toBe('clear');
    expect(veladoraUsed(p.run.lives, L.veladora!)).toBe(true);
    expect(p.lost).toBe(0);
    // GDD-UI-04: the camera does not move up, and his head stays on the screen on the way.
    expect(Math.min(...p.states.map((s) => s.player.y - 32))).toBeGreaterThanOrEqual(0);
    // Its box is y = 2 to 14 (GDD-LIFE-03, 12 px). Bouncing in place under it, the head's highest point on each rise: tier 3 only goes
    // above its bottom; tier 2 stays 16 px under it, and a full jump from the bridge's start 9 px under it.
    let r = at(quiet, 2584, 160);
    const heads: number[] = [];
    let top = 999;
    let rising = false;
    let takenAt = -1;
    for (let i = 0; i < 300 && heads.length < 4; i++) {
      r = stepRun(r, { move: 0, jumpHeld: true }, quiet);
      if (takenAt < 0 && veladoraUsed(r.lives, L.veladora!)) takenAt = r.player.awningChain ?? 0;
      if (r.player.vy < 0) rising = true;
      top = Math.min(top, r.player.y - 32);
      if (rising && r.player.vy > 0) {
        heads.push(Math.round(top * 10) / 10);
        top = 999;
        rising = false;
      }
    }
    expect(heads).toEqual([71.6, 50.9, 30.7, 7.8]);
    expect(takenAt).toBe(3);
    let b = strung(at(quiet, 2590, 112), 6);
    let high = 999;
    for (let i = 0; i < 40; i++) {
      b = stepRun(b, { move: 0, jumpHeld: i < 20 }, quiet);
      high = Math.min(high, b.player.y - 32);
    }
    expect(Math.round(high * 10) / 10).toBe(23.6);
    expect(veladoraUsed(b.lives, L.veladora!)).toBe(false);
  });
});

describe('GDD-WLD-13 2-2 played through', () => {
  const main = play([...route(), ...finale()]);

  it('GDD-WLD-13 2-2 the bot plays the main route from the start to the exit through every ofrenda, losing no life', () => {
    expect(main.run.phase).toBe('clear');
    expect(main.lost).toBe(0);
    expect(main.run.lives.lives).toBe(7);
    expect(main.run.checkpointIndex).toBe(2);
    for (const o of L.ofrendas) expect(main.run.lives.used.has(`ofrenda:${o.id}`), o.id).toBe(true);
    expect(main.states.length).toBeLessThan(2100);
    expect(main.states.length).toBe(1976);
  });

  it('GDD-WLD-13 2-2 on the way it unrolls every rollo, the fourth by a fireball, and collects 49 hilos', () => {
    expect(main.run.rollos.every((s) => s.steps !== null)).toBe(true);
    // The fourth unrolls while he stands on the walkway, out of the claw's reach, so only the fireball did it.
    const unrolled = main.states.findIndex((s) => s.rollos[4]!.steps !== null);
    expect(main.states[unrolled]!.player.y).toBe(176);
    expect(main.states[unrolled - 1]!.power).toBe('fuego');
    expect(main.run.hilosTaken.filter(Boolean).length).toBe(49);
    // Every bridge it claws (all but the fourth) unrolls ahead of him: his centre stays behind its strung front (GDD-WLD-11).
    for (const i of [0, 1, 2, 3, 5, 6]) {
      const r = R[i]!;
      const margins = main.states.flatMap((s) => (s.rollos[i]!.steps === null || rolloLength(r, s.rollos[i]!) >= r.w ? [] : [r.x + rolloLength(r, s.rollos[i]!) - s.player.x]));
      expect(Math.min(...margins), `rollo ${i}`).toBeGreaterThan(2);
    }
  });

  it('GDD-WLD-13 2-2 the expert route takes the veladora off the main route and still reaches the exit, and between them every hilo is taken', () => {
    const p = play([...route().slice(0, -1), ...expert()]);
    expect(p.run.phase).toBe('clear');
    expect(p.lost).toBe(0);
    expect(veladoraUsed(p.run.lives, L.veladora!)).toBe(true);
    const missed = L.hilos!.flatMap((h, i) => (main.run.hilosTaken[i] || p.run.hilosTaken[i] ? [] : [`${h.col},${h.row}`]));
    expect(missed).toEqual([]);
  });

  it('GDD-WLD-13 2-2 after waiting 1, 2, 3 or 4 s at the start the bot still reaches the exit losing no life', () => {
    for (const wait of [60, 120, 180, 240]) {
      let r = startRun(L);
      for (let i = 0; i < wait; i++) r = stepRun(r, idle, L);
      const p = play([...route(), ...finale()], L, r);
      expect(p.run.phase, `wait ${wait}`).toBe('clear');
      expect(p.lost, `wait ${wait}`).toBe(0);
    }
  });

  it('GDD-WLD-04 2-2 holding right from the start with no jump collects the first three hilos, on the floor, by the 35th step', () => {
    let r = startRun(L);
    for (let i = 0; i < 35; i++) r = stepRun(r, { move: 1, jumpHeld: false }, L);
    expect(r.hilosTaken.slice(0, 3)).toEqual([true, true, true]);
    expect(r.hilosTaken.filter(Boolean).length).toBe(3);
  });

  it('GDD-WLD-11 the bundles are where the claw of a Poncho standing at the edge reaches, but for the fourth and the last', () => {
    // GDD-CMB-02: the claw box is level with the body, 20 px in front of it. Standing at the edge before each post (or on the step for 0).
    const reach = R.map((r) => {
      const stand = r.x - 6.5;
      const ground = r === R[0] ? 160 : r === R[4] ? 176 : r === R[6] ? 176 : 224;
      const b = bundleBox(r);
      return b.y0 < ground && b.y1 > ground - 32 && b.x0 < stand + 6 + 20 && b.x1 > stand + 6;
    });
    expect(reach).toEqual([true, true, true, true, false, true, false]);
  });
});
