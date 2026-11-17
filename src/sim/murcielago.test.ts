import { describe, expect, it } from 'vitest';
import { GLIDE } from '../config/tuning';
import type { Rail } from './cart';
import { enemyBox, enemyPhase, freshEnemies, stepEnemy, type Box, type Enemy, type EnemyState } from './enemy';
import type { Fireball } from './fireball';
import { hurtbox } from './hazards';
import { spawn, type PlayerInput, type PlayerState } from './movement';
import { startRun, stepRun, type Level, type RunState } from './run';
import { parseTiles } from './tilemap';

// GDD-ENM-04: the Murciélago. The expected numbers are the GDD's: a 16 x 10 px box centred on where it is, its middle at the loop's middle
// plus (rx cos a, ry sin a), a = 2π (steps + phase) / 240; stomped with the usual bounce, 260 px/s or 410 with jump held (GDD-CMB-01).
const idle: PlayerInput = { move: 0, jumpHeld: false };
const hold: PlayerInput = { move: 0, jumpHeld: true };
const right: PlayerInput = { move: 1, jumpHeld: false };

/** A bat at (x, y) with the loop given. */
const bat = (x: number, y: number, o: { rx?: number; ry?: number; phase?: number } = {}): Enemy => ({ x, y, kind: 'murcielago', ...o });
/** Its middle: the middle of its box. */
const middle = (def: Enemy, s: EnemyState): { x: number; y: number } => {
  const b = enemyBox(def, s);
  return { x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2 };
};
/** Its middle after each of 0 to `n` steps from its start, Poncho at `p`, in `world`. */
function path(def: Enemy, n: number, p: PlayerState = spawn(5000, 5000), world = open): { x: number; y: number }[] {
  let s = freshEnemies([def])[0]!;
  const out = [middle(def, s)];
  for (let i = 0; i < n; i++) {
    s = stepEnemy(def, s, world, p);
    out.push(middle(def, s));
  }
  return out;
}
/** The GDD's formula, written out here: its middle `n` steps from its start. */
const loopAt = (def: Enemy, n: number) => {
  const a = (2 * Math.PI * (n + (def.phase ?? 0))) / 240;
  return { x: def.x + (def.rx ?? 0) * Math.cos(a), y: def.y + (def.ry ?? 0) * Math.sin(a) };
};
const near = (got: { x: number; y: number }, want: { x: number; y: number }, label: string) => {
  expect(Math.abs(got.x - want.x), `${label} x ${got.x} vs ${want.x}`).toBeLessThan(1e-6);
  expect(Math.abs(got.y - want.y), `${label} y ${got.y} vs ${want.y}`).toBeLessThan(1e-6);
};

/** Open air, 80 columns by 40 rows, round a loop whose middle is (1000, 500). */
const open = parseTiles(Array.from({ length: 40 }, () => '.'.repeat(80)));
/** The same with a wall in column 62 (x 992 to 1008), rows 28 to 34 (y 448 to 560): right across every loop round (1000, 500). */
const walled = parseTiles(Array.from({ length: 40 }, (_, r) => (r >= 28 && r <= 34 ? '.'.repeat(62) + '#' + '.'.repeat(17) : '.'.repeat(80))));

describe('GDD-ENM-04 the Murciélago flies its loop', () => {
  it('GDD-ENM-04 a Murciélago is where its steps say: the loop\'s middle plus rx cos a and ry sin a, one loop every 240 steps', () => {
    const def = bat(1000, 500, { rx: 16, ry: 24, phase: 0 });
    const p = path(def, 240);
    const want = [[0, 1016, 500], [60, 1000, 524], [120, 984, 500], [180, 1000, 476], [240, 1016, 500]] as const;
    for (const [n, x, y] of want) near(p[n]!, { x, y }, `step ${n}`);
    // With phase 120 it starts half a loop on, at its left end.
    near(path(bat(1000, 500, { rx: 16, ry: 24, phase: 120 }), 0)[0]!, { x: 984, y: 500 }, 'phase 120');
    // rx 0: a bob up and down; ry 0: a shuttle across; both 0: a hover.
    const bob = path(bat(1000, 500, { ry: 24 }), 240);
    expect(bob.every((q) => q.x === 1000)).toBe(true);
    expect(Math.max(...bob.map((q) => q.y)) - Math.min(...bob.map((q) => q.y))).toBeCloseTo(48, 6);
    const shuttle = path(bat(1000, 500, { rx: 16 }), 240);
    expect(shuttle.every((q) => q.y === 500)).toBe(true);
    expect(Math.max(...shuttle.map((q) => q.x)) - Math.min(...shuttle.map((q) => q.x))).toBeCloseTo(32, 6);
    expect(path(bat(1000, 500), 240).every((q) => q.x === 1000 && q.y === 500)).toBe(true);
    // Its one state, for the debug hook: flying.
    expect(enemyPhase(freshEnemies([def])[0]!)).toBe('fly');
  });

  it('GDD-ENM-04 a Murciélago never reacts to Poncho and ignores tiles', () => {
    const def = bat(1000, 500, { rx: 48, ry: 24, phase: 30 });
    const cases: [string, PlayerState, typeof open][] = [
      ['Poncho far away', spawn(5000, 5000), open],
      ['Poncho beside it', spawn(1040, 520), open],
      ['Poncho under it', spawn(1000, 560), open],
      ['a wall across its path', spawn(5000, 5000), walled],
    ];
    for (const [label, p, world] of cases) {
      const got = path(def, 240, p, world);
      got.forEach((q, n) => near(q, loopAt(def, n), `${label}, step ${n}`));
    }
  });

  it('GDD-ENM-04 a Murciélago\'s box is 16 by 10 px centred on it', () => {
    const hover = bat(1000, 500);
    expect(enemyBox(hover, freshEnemies([hover])[0]!)).toEqual({ x0: 992, x1: 1008, y0: 495, y1: 505 });
    // Round a loop, at every step: 16 x 10 px about its middle.
    const def = bat(1000, 500, { rx: 16, ry: 24 });
    let s = freshEnemies([def])[0]!;
    for (let n = 0; n <= 240; n++) {
      const b = enemyBox(def, s);
      const at = loopAt(def, n);
      near({ x: b.x0, y: b.y0 }, { x: at.x - 8, y: at.y - 5 }, `step ${n} top left`);
      near({ x: b.x1, y: b.y1 }, { x: at.x + 8, y: at.y + 5 }, `step ${n} bottom right`);
      s = stepEnemy(def, s, open, spawn(5000, 5000));
    }
  });

  it('GDD-ENM-04 at the widest loop it moves at most 75.4 px/s across and 37.7 px/s up or down, slower than the glide\'s 70 px/s fall', () => {
    const p = path(bat(1000, 500, { rx: 48, ry: 24 }), 240);
    let across = 0;
    let down = 0;
    for (let n = 1; n < p.length; n++) {
      across = Math.max(across, Math.abs(p[n]!.x - p[n - 1]!.x));
      down = Math.max(down, Math.abs(p[n]!.y - p[n - 1]!.y));
    }
    expect(across * 60).toBeGreaterThan(75);
    expect(across * 60).toBeLessThan(75.5);
    expect(down * 60).toBeGreaterThan(37.5);
    expect(down * 60).toBeLessThan(37.8);
    expect(down * 60).toBeLessThan(GLIDE.fallSpeed);
  });

  it('GDD-ENM-04 a Murciélago faces the way it moves across', () => {
    // rx 16 from phase 0: it starts at its right end, moves left for half a loop (steps 1 to 120), then right (121 to 240).
    const def = bat(1000, 500, { rx: 16, ry: 24 });
    let s = freshEnemies([def])[0]!;
    expect(s.dir).toBe(1);
    for (let n = 1; n <= 240; n++) {
      s = stepEnemy(def, s, open, spawn(5000, 5000));
      expect(s.dir, `step ${n}`).toBe(n <= 120 ? -1 : 1);
    }
    // A bob never moves across: it keeps facing right.
    const bob = bat(1000, 500, { ry: 24 });
    let b = freshEnemies([bob])[0]!;
    for (let n = 1; n <= 240; n++) {
      b = stepEnemy(bob, b, open, spawn(5000, 5000));
      expect(b.dir, `bob step ${n}`).toBe(1);
    }
  });
});

// A floor at row 10 (its top y = 160) across 40 columns, and open air above it. The glide is on only where a test says.
const FLOOR = 160;
const ground = parseTiles(Array.from({ length: 12 }, (_, r) => (r >= 10 ? '#'.repeat(40) : '.'.repeat(40))));
const levelWith = (enemies: readonly Enemy[], o: Partial<Level> = {}): Level => ({
  world: ground,
  spawn: { x: 24, y: FLOOR },
  ofrendas: [],
  spikes: [],
  crumbles: [],
  springs: [],
  platforms: [],
  tacos: [],
  pinatas: [],
  doors: [],
  keys: [],
  fragiles: [],
  enemies,
  ...o,
});
const standing = (x: number): PlayerState => ({ ...spawn(x, FLOOR), grounded: true });
const falling = (x: number, y: number, vy = 150): PlayerState => ({ ...spawn(x, y), vy, grounded: false });
const withPlayer = (level: Level, player: PlayerState, extra: Partial<RunState> = {}): RunState => ({ ...startRun(level), player, ...extra });
const play = (level: Level, r: RunState, n: number, input: PlayerInput = idle): RunState => {
  for (let i = 0; i < n; i++) r = stepRun(r, input, level);
  return r;
};
/** Do two boxes overlap? Boxes that only share an edge do not. */
const touch = (a: Box, b: Box): boolean => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
const hurt = (p: PlayerState): Box => {
  const h = hurtbox(p);
  return { x0: h.x, x1: h.x + h.w, y0: h.y, y1: h.y + h.h };
};
/**
 * Plays from `r` with `input` until the step his hurtbox first overlaps `box` (at most 120 steps), and returns that step's state: the hit
 * must come on that very step, not one later.
 */
function firstTouch(level: Level, r: RunState, input: PlayerInput, box: Box): RunState {
  for (let i = 0; i < 120; i++) {
    r = stepRun(r, input, level);
    if (touch(hurt(r.player), box)) return r;
  }
  throw new Error('he never touched it');
}

describe('GDD-ENM-04 and GDD-CMB-01 to GDD-CMB-03 meeting a Murciélago', () => {
  it('GDD-ENM-04 touching a Murciélago from the side or from below costs a life', () => {
    // Walking into a hovering one at body height: its box x 192 to 208, y 139 to 149.
    const side = levelWith([bat(200, 144)]);
    const walked = firstTouch(side, withPlayer(side, standing(170)), right, { x0: 192, x1: 208, y0: 139, y1: 149 });
    expect(walked.lives.lives).toBe(6);
    expect(walked.enemies[0]!.alive).toBe(true);
    // Jumping up into one from beneath: its box x 292 to 308, y 95 to 105, over his head.
    const below = levelWith([bat(300, 100)]);
    const jumped = firstTouch(below, withPlayer(below, standing(300)), hold, { x0: 292, x1: 308, y0: 95, y1: 105 });
    expect(jumped.player.vy).toBeLessThan(0);
    expect(jumped.lives.lives).toBe(6);
    expect(jumped.enemies[0]!.alive).toBe(true);
  });

  it('GDD-ENM-04 a stomp defeats a Murciélago in any part of its loop, with the usual bounce', () => {
    // A bob of 24 px round (200, 100): at its top (phase 180, middle y 76), its bottom (phase 60, y 124), rising (phase 120, y 100) and
    // sinking (phase 0, y 100). Poncho falls onto it from 1 px over its top.
    const parts = [['top', 180, 76], ['bottom', 60, 124], ['rising', 120, 100], ['sinking', 0, 100]] as const;
    for (const [part, phase, y] of parts) {
      const level = levelWith([bat(200, 100, { ry: 24, phase })]);
      for (const [input, bounce] of [[idle, -260], [hold, -410]] as const) {
        let r = withPlayer(level, falling(200, y - 5 - 1));
        for (let i = 0; i < 4 && r.enemies[0]!.alive; i++) r = play(level, r, 1, input);
        const label = `${part}, jump ${input.jumpHeld ? 'held' : 'up'}`;
        expect(r.enemies[0]!.alive, label).toBe(false);
        expect(r.lives.lives, label).toBe(7);
        expect(r.player.vy, label).toBe(bounce);
      }
    }
  });

  // The stomp's bounce, measured on the real run (GDD-ENM-04, "measured"): from the stomp step (0), his feet's highest point over the stomp's
  // height and its step, and the step he is back at that height. The bat hovers at (300, 100), its top at y 95; the floor is far below.
  const deep = parseTiles(Array.from({ length: 30 }, (_, r) => (r >= 28 ? '#'.repeat(60) : '.'.repeat(60))));
  /** Plays until the stomp, then on to his first return to its height (at most 300 steps), with `input` throughout. */
  function bounceOff(start: PlayerState, input: PlayerInput, glide: boolean) {
    const level = levelWith([bat(300, 100)], { world: deep, abilities: { glide } });
    let r = withPlayer(level, start);
    for (let i = 0; i < 60 && r.enemies[0]!.alive; i++) r = stepRun(r, input, level);
    expect(r.enemies[0]!.alive).toBe(false);
    expect(r.lives.lives).toBe(7);
    const stomp = { x: r.player.x, y: r.player.y, vy: r.player.vy };
    const after: PlayerState[] = [];
    for (let i = 0; i < 300 && (after.length === 0 || after[after.length - 1]!.y < stomp.y); i++) {
      r = stepRun(r, input, level);
      after.push(r.player);
    }
    // The first apex: the step his feet are highest, before he comes down again.
    const peakAt = after.findIndex((p, i) => p.y <= after[i + 1]!.y);
    const backAt = after.findIndex((p) => p.y >= stomp.y);
    return { stomp, after, peakStep: peakAt + 1, peak: stomp.y - after[peakAt]!.y, backStep: backAt + 1, backX: after[backAt]!.x - stomp.x, peakState: after[peakAt]! };
  }

  it('GDD-ENM-04 a stomp out of a held glide is the high bounce and the glide starts again with no new press', () => {
    // Gliding down onto it at the full run, jump held all the while.
    const gliding: PlayerState = { ...falling(282, 86, 70), vx: 120, gliding: true, jumpWasHeld: true, jumpHeldSteps: 30 };
    const b = bounceOff(gliding, { move: 1, jumpHeld: true }, true);
    expect(b.stomp.vy).toBe(-410);
    expect(Math.abs(b.peak - 56.4), `peak ${b.peak}`).toBeLessThanOrEqual(0.5);
    expect(Math.abs(b.peakStep - 18), `peak at ${b.peakStep}`).toBeLessThanOrEqual(1);
    expect(b.peakState.gliding).toBe(true);
    expect(b.after.slice(0, b.peakStep - 1).every((p) => !p.gliding)).toBe(true); // not before
    expect(Math.abs(b.backStep - 68), `back at ${b.backStep}`).toBeLessThanOrEqual(1);
    expect(Math.abs(b.backX - 136), `back ${b.backX} px on`).toBeLessThanOrEqual(0.5);
  });

  it('GDD-ENM-04 a stomp from a plain fall with jump up peaks 22.9 px after 12 steps, longer than the glide\'s 9-step lock', () => {
    const b = bounceOff(falling(300, 86), idle, true);
    expect(b.stomp.vy).toBe(-260);
    expect(Math.abs(b.peak - 22.9), `peak ${b.peak}`).toBeLessThanOrEqual(0.5);
    expect(Math.abs(b.peakStep - 12), `peak at ${b.peakStep}`).toBeLessThanOrEqual(1);
    expect(b.peakStep).toBeGreaterThan(GLIDE.stompLockSteps);
  });

  it('GDD-ENM-04 the claw defeats a Murciélago, and a fireball does and is used up', () => {
    // Hovering at body height just in front of him (its box x 192 to 208, y 139 to 149), clear of his hurtbox (x 175 to 185).
    const level = levelWith([bat(200, 144)]);
    const clawed = play(level, withPlayer(level, standing(180)), 4, { move: 0, jumpHeld: false, claw: true });
    expect(clawed.enemies[0]!.alive).toBe(false);
    expect(clawed.lives.lives).toBe(7);
    const fb: Fireball = { x: 196, y: 146, vx: 180, vy: 0, age: 1 };
    const burnt = play(level, withPlayer(level, standing(400), { fireballs: [fb] }), 1);
    expect(burnt.enemies[0]!.alive).toBe(false);
    expect(burnt.fireballs).toEqual([]);
  });

  it('GDD-ENM-04 a rolling cart defeats a Murciélago its box runs into', () => {
    // A short rail on the floor from x 32, 10 tiles; its cart rolls from its start with nobody in it. The bat hovers low over the rail at
    // (120, 150), its box y 145 to 155, inside the cart's box (16 px over the rail's ground, y 144 to 160).
    const rail: Rail = { x: 32, y: FLOOR, dir: 1, segments: [{ kind: 'level', tiles: 10 }], end: 'buffer' };
    const level = levelWith([bat(120, 150)], { rails: [rail] });
    let r = withPlayer(level, standing(500), { carts: [{ phase: 'rolling', m: 16 }] });
    let k = -1;
    for (let i = 0; i < 60 && k < 0; i++) {
      r = stepRun(r, idle, level);
      if (!r.enemies[0]!.alive) k = i;
    }
    expect(k).toBeGreaterThan(0);
    expect(r.carts[0]!.phase).toBe('rolling');
    expect(r.lives.lives).toBe(7);
  });

  it('GDD-ENM-04 a stomped Murciélago stays gone, and a lost life brings it back with its steps counted from 0', () => {
    // A shuttle 16 px across round (200, 100), starting a quarter loop on (phase 60): at its middle, (200, 100). A spike at column 30 to lose
    // a life on.
    const def = bat(200, 100, { rx: 16, phase: 60 });
    const level = levelWith([def], { spikes: [{ col: 30, row: 9 }] });
    let r = withPlayer(level, falling(200, 94));
    for (let i = 0; i < 4 && r.enemies[0]!.alive; i++) r = play(level, r, 1);
    expect(r.enemies[0]!.alive).toBe(false);
    r = play(level, r, 600);
    expect(r.enemies[0]!.alive).toBe(false);
    expect(r.lives.lives).toBe(7);
    // On the spike: a life lost, then the respawn.
    r = play(level, { ...r, player: standing(488) }, 1);
    expect(r.phase).toBe('respawning');
    for (let i = 0; i < 600 && r.phase === 'respawning'; i++) r = play(level, r, 1);
    expect(r.phase).toBe('playing');
    expect(r.enemies[0]).toEqual({ x: 200, dir: 1, alive: true, loop: { steps: 0, y: 100 } });
    near(middle(def, r.enemies[0]!), { x: 200, y: 100 }, 'back at its phase');
    // And from there round its loop from step 0 again: 60 steps on, at its left end.
    near(middle(def, play(level, r, 60).enemies[0]!), { x: 184, y: 100 }, '60 steps after the respawn');
  });
});
