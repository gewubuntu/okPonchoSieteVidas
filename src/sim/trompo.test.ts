import { describe, expect, it } from 'vitest';
import { STOMP } from '../config/tuning';
import { enemyBox, freshEnemies, stepEnemy, type Enemy, type EnemyState } from './enemy';
import type { Fireball } from './fireball';
import { spawn, type PlayerInput, type PlayerState } from './movement';
import { startRun, stepRun, type Level, type RunState } from './run';
import { NO_COMBO, stepSounds } from './sfx';
import { parseTiles } from './tilemap';
import type { Spin } from './trompo';

const idle: PlayerInput = { move: 0, jumpHeld: false };
const swipe: PlayerInput = { move: 0, jumpHeld: false, claw: true };

// Floor at row 10 (top y = 160) from column 0 to 19, so its right end (a ledge) is at x = 320. A wall in column 2, rows 8 and 9 (x 32 to
// 48). The Trompo starts at x = 200 on the floor heading right: a 14 x 14 box, x 193 to 207, y 146 to 160.
const world = parseTiles(
  Array.from({ length: 12 }, (_, r) => {
    if (r >= 10) return '#'.repeat(20) + '..........';
    if (r >= 8) return '..#' + '.'.repeat(27);
    return '.'.repeat(30);
  }),
);
const def: Enemy = { x: 200, y: 160, kind: 'trompo' };
const level: Level = { world, spawn: { x: 72, y: 160 }, ofrendas: [], spikes: [], crumbles: [], springs: [], platforms: [], tacos: [], pinatas: [], doors: [], keys: [], fragiles: [], enemies: [def] };
const standing = (x: number, y = 160, facing: 1 | -1 = 1): PlayerState => ({ ...spawn(x, y), grounded: true, facing });
const falling = (x: number, y: number, vy = 150): PlayerState => ({ ...spawn(x, y), vy, grounded: false });
const away = standing(400, 20);
const fresh = (): EnemyState => freshEnemies([def])[0]!;
const at = (sp: Spin, x = 200, dir: 1 | -1 = 1): EnemyState => ({ x, dir, alive: true, spin: sp });
const stunned = (age = 0, x = 200, dir: 1 | -1 = 1): EnemyState => at({ phase: 'stunned', age }, x, dir);
const steps = (s: EnemyState, n: number): EnemyState => {
  for (let i = 0; i < n; i++) s = stepEnemy(def, s, world, away);
  return s;
};
const withPlayer = (player: PlayerState, extra: Partial<RunState> = {}): RunState => ({ ...startRun(level), player, ...extra });
const run = (r: RunState, n: number, input: PlayerInput = idle): RunState => {
  for (let i = 0; i < n; i++) r = stepRun(r, input, level);
  return r;
};
/** A Trompo spinning away from the wall's right face at x = 55, towards a Poncho on its right: 7/6 px a step, at x = 58.5 three steps on. */
const coming = (): EnemyState => at({ phase: 'spin', age: 0 }, 55, 1);

describe('GDD-ENM-03 the Trompo spins along', () => {
  it('starts alive where the level puts it, heading right, spinning', () => {
    expect(fresh()).toEqual({ x: 200, dir: 1, alive: true, spin: { phase: 'spin', age: 0 } });
  });

  it('is a 14 x 14 px box standing on its y', () => {
    expect(enemyBox(def, fresh())).toEqual({ x0: 193, x1: 207, y0: 146, y1: 160 });
  });

  it('spins along at 70 px/s', () => {
    expect(steps(fresh(), 60).x).toBeCloseTo(270, 9);
  });

  it('turns round at the ledge, never going off it, and flush against a wall', () => {
    let s = fresh();
    let max = -Infinity;
    let min = Infinity;
    for (let i = 0; i < 1000; i++) {
      s = steps(s, 1);
      max = Math.max(max, s.x);
      min = Math.min(min, s.x);
    }
    expect(max).toBeLessThanOrEqual(320 - 7 + 1e-6);
    expect(max).toBeGreaterThan(320 - 7 - 1.2);
    expect(min).toBe(48 + 7);
  });

  it('cannot be stomped while it spins: landing on it is a hit, with no bounce', () => {
    let r = withPlayer(falling(200, 145), { enemies: [at({ phase: 'spin', age: 0 }, 200)] });
    r = run(r, 1);
    expect(r.phase).toBe('respawning');
    expect(r.lives.lives).toBe(6);
    expect(r.stomped).toBe(false);
    let t = withPlayer(falling(200, 145), { power: 'taco', enemies: [at({ phase: 'spin', age: 0 }, 200)] });
    t = run(t, 1);
    expect(t).toMatchObject({ power: 'base', stomped: false, lives: { lives: 7 } });
    expect(t.player.vy).toBeGreaterThan(0);
    expect(t.enemies[0]!.alive).toBe(true);
  });

  it('touching it from the side while it spins is a hit', () => {
    expect(run(withPlayer(standing(190)), 1).lives.lives).toBe(6);
  });
});

describe('GDD-ENM-03 and GDD-CMB-02 the claw stuns the Trompo for 1.0 s', () => {
  it('a claw swipe that overlaps it topples it: it lies stunned, alive', () => {
    // Poncho at x = 80 faces it: his claw box is x 54 to 74, live from the press's third step, when the Trompo's box is x 51.5 to 65.5.
    const r = run(withPlayer(standing(80, 160, -1), { enemies: [coming()] }), 4, swipe);
    expect(r.enemies[0]).toMatchObject({ alive: true, spin: { phase: 'stunned', age: 1 } });
    expect(r.enemies[0]!.x).toBeCloseTo(58.5, 9);
    expect(r.lives.lives).toBe(7);
  });

  it('it lies still for exactly 60 steps, then gets up spinning the way it faced', () => {
    let s = stunned(0, 150, -1);
    for (let k = 1; k < 60; k++) {
      s = steps(s, 1);
      expect(s).toMatchObject({ x: 150, dir: -1, spin: { phase: 'stunned', age: k } });
    }
    s = steps(s, 1);
    expect(s).toMatchObject({ x: 150, dir: -1, spin: { phase: 'spin', age: 0 } });
    expect(steps(s, 1).x).toBeCloseTo(150 - 70 / 60, 9);
  });

  it('stunned it is harmless to touch, and a Poncho in it when it gets up is hit', () => {
    let r = withPlayer(standing(150), { enemies: [stunned(0, 150)] });
    r = run(r, 59);
    expect(r).toMatchObject({ phase: 'playing', invulnerable: 0, lives: { lives: 7 } });
    r = run(r, 1);
    expect(r.enemies[0]!.spin!.phase).toBe('spin');
    expect(r.lives.lives).toBe(6);
  });

  it('a claw on a stunned top does nothing more: its stun is not renewed', () => {
    const r = run(withPlayer(standing(130), { enemies: [stunned(30, 150)] }), 4, swipe);
    expect(r.enemies[0]).toMatchObject({ alive: true, spin: { phase: 'stunned', age: 34 } });
  });

  it('a fireball stuns it too and is used up; a fireball passes over a stunned top and is not used up', () => {
    const fb: Fireball = { x: 192, y: 158, vx: 180, vy: 0, age: 1 };
    const r = run(withPlayer(away, { enemies: [at({ phase: 'spin', age: 0 }, 200)], fireballs: [fb] }), 1);
    expect(r.enemies[0]).toMatchObject({ alive: true, spin: { phase: 'stunned', age: 0 } });
    expect(r.fireballs).toEqual([]);
    const past = run(withPlayer(away, { enemies: [stunned(0, 200)], fireballs: [fb] }), 1);
    expect(past.enemies[0]).toMatchObject({ alive: true, spin: { phase: 'stunned', age: 1 } });
    expect(past.fireballs).toHaveLength(1);
  });
});

describe('GDD-ENM-03 and GDD-CMB-01 a stomp on a stunned Trompo defeats it', () => {
  it('stomped while stunned it is defeated and Poncho bounces as from any stomp', () => {
    const r = run(withPlayer(falling(150, 145), { enemies: [stunned(10, 150)] }), 1);
    expect(r.enemies[0]!.alive).toBe(false);
    expect(r.player.vy).toBe(-STOMP.bounce);
    expect(r.lives.lives).toBe(7);
    const high = run(withPlayer(falling(150, 145), { enemies: [stunned(10, 150)] }), 1, { move: 0, jumpHeld: true });
    expect(high.player.vy).toBe(-STOMP.boostBounce);
  });

  it('claw, then a short hop onto it: a Poncho at the claw\'s reach lands on it well within its 1.0 s stun', () => {
    // Poncho at x = 80 faces the Trompo coming at him from the wall: his claw box (x 54 to 74) topples it at x = 58.5.
    let r = withPlayer(standing(80, 160, -1), { enemies: [coming()] });
    r = run(r, 3, { move: 0, jumpHeld: false, claw: true });
    expect(r.enemies[0]!.spin!.phase).toBe('stunned');
    let n = 0;
    // A short hop towards it: jump held for 4 steps, moving left all the way.
    while (r.enemies[0]!.alive && n < 120) {
      r = run(r, 1, { move: -1, jumpHeld: n < 4 });
      n++;
    }
    expect(r.enemies[0]!.alive).toBe(false);
    expect(n).toBeLessThan(57);
    expect(r.lives.lives).toBe(7);
  });

  it('a stunned top touches nothing until it gets up, and a stomp is all that defeats it', () => {
    const r = run(withPlayer(standing(150), { enemies: [stunned(0, 150)] }), 1, swipe);
    expect(r.enemies[0]!.alive).toBe(true);
  });

  it('a lost life brings it back at its start, spinning', () => {
    let r = run(withPlayer(standing(195), { enemies: [stunned(59, 195)] }), 1);
    expect(r.phase).toBe('respawning');
    while (r.phase === 'respawning') r = run(r, 1);
    expect(r.enemies[0]).toEqual(fresh());
  });
});

describe('GDD-ENM-03 and GDD-AUD-02 the Trompo\'s sounds', () => {
  it('a Trompo the claw topples thuds like a stomp, once', () => {
    let r = withPlayer(standing(80, 160, -1), { enemies: [coming()] });
    const names: string[][] = [];
    for (let i = 0; i < 6; i++) {
      const after = stepRun(r, swipe, level);
      names.push(stepSounds(r, after, NO_COMBO).sounds.map((s) => s.name).filter((n) => n === 'stomp'));
      r = after;
    }
    expect(names.flat()).toEqual(['stomp']);
    expect(names[2]).toEqual(['stomp']);
  });

  it('a stomp on a stunned top plays the stomp sound', () => {
    const before = withPlayer(falling(150, 145), { enemies: [stunned(10, 150)] });
    const after = stepRun(before, idle, level);
    expect(stepSounds(before, after, NO_COMBO).sounds.map((s) => s.name)).toContain('stomp');
  });
});
