import { describe, expect, it } from 'vitest';
import { STOMP } from '../config/tuning';
import { enemyBox, freshEnemies, stepEnemy, type Enemy, type EnemyState } from './enemy';
import type { Fireball } from './fireball';
import { hurtbox } from './hazards';
import { spawn, type PlayerInput, type PlayerState } from './movement';
import type { Wing } from './paloma';
import { startRun, stepRun, type Level, type RunState } from './run';
import { NO_COMBO, stepSounds } from './sfx';
import { parseTiles } from './tilemap';

const idle: PlayerInput = { move: 0, jumpHeld: false };
const right: PlayerInput = { move: 1, jumpHeld: false };

// Floor at row 10 (top y = 160) from column 0 to 19, so its right end (a ledge) is at x = 320. A wall in column 2, rows 8 and 9 (x 32 to
// 48). The Paloma starts at x = 200 on the floor heading right: a 14 x 12 box, x 193 to 207, y 148 to 160.
const world = parseTiles(
  Array.from({ length: 12 }, (_, r) => {
    if (r >= 10) return '#'.repeat(20) + '..........';
    if (r >= 8) return '..#' + '.'.repeat(27);
    return '.'.repeat(30);
  }),
);
const def: Enemy = { x: 200, y: 160, kind: 'paloma' };
const level: Level = { world, spawn: { x: 72, y: 160 }, ofrendas: [], spikes: [], crumbles: [], springs: [], platforms: [], tacos: [], pinatas: [], doors: [], keys: [], fragiles: [], enemies: [def] };
const standing = (x: number, y = 160): PlayerState => ({ ...spawn(x, y), grounded: true });
const falling = (x: number, y: number, vy = 150): PlayerState => ({ ...spawn(x, y), vy, grounded: false });
/** Poncho far above everything, never near it. */
const away = standing(400, 20);
const fresh = (): EnemyState => freshEnemies([def])[0]!;
const wing = (s: EnemyState): Wing => s.wing!;
const at = (w: Partial<Wing>, x = 200): EnemyState => ({ x, dir: 1, alive: true, wing: { phase: 'walk', age: 0, lift: 0, ...w } });
const steps = (s: EnemyState, n: number, p: PlayerState = away, d: Enemy = def): EnemyState => {
  for (let i = 0; i < n; i++) s = stepEnemy(d, s, world, p);
  return s;
};
/** Steps until it is in `phase` (at most 600), returning the steps taken and the state. */
const until = (s: EnemyState, phase: Wing['phase'], p: PlayerState = away): { n: number; s: EnemyState } => {
  let n = 0;
  while (wing(s).phase !== phase && n < 600) {
    s = stepEnemy(def, s, world, p);
    n++;
  }
  return { n, s };
};
const telegraphing = (): EnemyState => at({ phase: 'telegraph' });
/** Does a step with Poncho at `p` startle a fresh Paloma? */
const startled = (p: PlayerState): boolean => wing(steps(fresh(), 1, p)).phase === 'telegraph';
const withPlayer = (player: PlayerState, extra: Partial<RunState> = {}): RunState => ({ ...startRun(level), player, ...extra });
const run = (r: RunState, n: number, input: PlayerInput = idle): RunState => {
  for (let i = 0; i < n; i++) r = stepRun(r, input, level);
  return r;
};

describe('GDD-ENM-03 the Paloma walks', () => {
  it('starts alive where the level puts it, heading right, walking on the ground', () => {
    expect(fresh()).toEqual({ x: 200, dir: 1, alive: true, wing: { phase: 'walk', age: 0, lift: 0 } });
  });

  it('is a 14 x 12 px box standing on its y', () => {
    expect(enemyBox(def, fresh())).toEqual({ x0: 193, x1: 207, y0: 148, y1: 160 });
  });

  it('walks at 20 px/s', () => {
    expect(steps(fresh(), 30).x).toBeCloseTo(210, 9);
  });

  it('turns round at the ledge, never walking off it, and flush against a wall', () => {
    let s = fresh();
    let max = -Infinity;
    let min = Infinity;
    for (let i = 0; i < 3000; i++) {
      s = steps(s, 1);
      max = Math.max(max, s.x);
      min = Math.min(min, s.x);
    }
    expect(max).toBeLessThanOrEqual(320 - 7 + 1e-6);
    expect(max).toBeGreaterThan(320 - 7 - 0.4);
    expect(min).toBe(48 + 7);
  });
});

describe('GDD-ENM-03 the Paloma walks along a cordel', () => {
  // GDD-WLD-11: a cordel's top in mid-air, x 64 to 160 at y = 96, over nothing.
  const cordel = { x: 64, y: 96, w: 96 };
  const onCordel: Enemy = { x: 112, y: 96, kind: 'paloma' };
  const tops = { awnings: [], cordeles: [cordel] };

  it('walks end to end along it, turning at its ends, and never leaves it', () => {
    let s = freshEnemies([onCordel])[0]!;
    let max = -Infinity;
    let min = Infinity;
    for (let i = 0; i < 2000; i++) {
      s = stepEnemy(onCordel, s, world, away, tops);
      max = Math.max(max, s.x);
      min = Math.min(min, s.x);
      expect(s.y ?? 96).toBe(96);
    }
    expect(max).toBeLessThanOrEqual(160 - 7 + 1e-6);
    expect(max).toBeGreaterThan(160 - 7 - 0.4);
    expect(min).toBeGreaterThanOrEqual(64 + 7 - 1e-6);
    expect(min).toBeLessThan(64 + 7 + 0.4);
  });

  it('walks off the end of a tile ledge onto a cordel that goes on at the height of its feet, but not onto one lower down', () => {
    // The floor's right end is at x = 320; a cordel goes on from there at the floor's top, another 8 px lower.
    const ledge: Enemy = { x: 300, y: 160, kind: 'paloma' };
    const onward = freshEnemies([ledge])[0]!;
    let s = onward;
    for (let i = 0; i < 300; i++) s = stepEnemy(ledge, s, world, away, { awnings: [], cordeles: [{ x: 320, y: 160, w: 64 }] });
    expect(s.x).toBeGreaterThan(320 + 7);
    s = onward;
    for (let i = 0; i < 300; i++) s = stepEnemy(ledge, s, world, away, { awnings: [], cordeles: [{ x: 320, y: 168, w: 64 }] });
    expect(s.x).toBeLessThanOrEqual(320 - 7 + 1e-6);
  });

  it('is the only one that walks on cordeles: an Alacrán turns at the same ledge', () => {
    const alacran: Enemy = { x: 300, y: 160 };
    let s = freshEnemies([alacran])[0]!;
    let max = -Infinity;
    for (let i = 0; i < 300; i++) {
      s = stepEnemy(alacran, s, world, away, { awnings: [], cordeles: [{ x: 320, y: 160, w: 64 }] });
      max = Math.max(max, s.x);
    }
    expect(max).toBeLessThanOrEqual(320 - 7 + 1e-6);
  });
});

describe('GDD-ENM-03 the Paloma is startled', () => {
  // After one step it has walked to x = 200 + 1/3; Poncho's hurtbox centre is his x.
  const moved = 200 + 20 / 60;

  it('when his hurtbox centre is within 48 px of it across, on either side', () => {
    expect(startled(standing(moved + 48))).toBe(true);
    expect(startled(standing(moved + 48.01))).toBe(false);
    expect(startled(standing(moved - 48))).toBe(true);
    expect(startled(standing(moved - 48.01))).toBe(false);
  });

  it('only when his feet are within 24 px of its own, up or down', () => {
    expect(startled(standing(moved + 10, 160 - 24))).toBe(true);
    expect(startled(standing(moved + 10, 160 - 24.01))).toBe(false);
    expect(startled(standing(moved + 10, 160 + 24))).toBe(true);
    expect(startled(standing(moved + 10, 160 + 24.01))).toBe(false);
  });

  it('it stops where it is: startled, it does not walk on', () => {
    const s = steps(fresh(), 1, standing(moved + 30));
    expect(s.x).toBeCloseTo(moved, 9);
    expect(steps(s, 10, standing(moved + 30)).x).toBeCloseTo(moved, 9);
  });

  it('telegraphs for exactly 0.5 s (30 steps), frozen on the ground, then rises', () => {
    const near = standing(230);
    const { n, s } = until(telegraphing(), 'rise', near);
    expect(n).toBe(30);
    expect(s.x).toBe(200);
    expect(wing(steps(telegraphing(), 29, near))).toMatchObject({ phase: 'telegraph', lift: 0 });
  });

  it('rises 40 px straight up at 120 px/s: 2 px a step, there in 20 steps (0.33 s)', () => {
    let s = steps(telegraphing(), 29);
    for (let k = 1; k <= 20; k++) {
      s = steps(s, 1);
      expect(wing(s).lift).toBeCloseTo(2 * k, 9);
      expect(wing(s).phase).toBe(k < 20 ? 'rise' : 'hover');
      expect(s.x).toBe(200);
    }
    expect(enemyBox(def, s)).toEqual({ x0: 193, x1: 207, y0: 108, y1: 120 });
  });

  it('hovers 1.0 s (60 steps) at 40 px, then comes back down at 60 px/s: 40 steps (0.67 s) to where it was', () => {
    let s = at({ phase: 'hover', lift: 40 });
    for (let k = 1; k < 60; k++) {
      s = steps(s, 1);
      expect(wing(s)).toMatchObject({ phase: 'hover', lift: 40 });
    }
    for (let k = 1; k <= 40; k++) {
      s = steps(s, 1);
      expect(wing(s).lift).toBeCloseTo(Math.max(0, 40 - k), 9);
      expect(wing(s).phase).toBe(k < 40 ? 'descend' : 'walk');
    }
    expect(s.x).toBe(200);
    expect(enemyBox(def, s)).toEqual({ x0: 193, x1: 207, y0: 148, y1: 160 });
    expect(steps(s, 30).x).toBeCloseTo(210, 9); // then it walks on
  });

  it('is not startled while it flies, and may be startled again once down', () => {
    const near = standing(230);
    let s = until(telegraphing(), 'hover', near).s;
    s = until(s, 'descend', near).s;
    s = until(s, 'walk', near).s;
    expect(wing(steps(s, 1, near)).phase).toBe('telegraph');
  });
});

describe('GDD-ENM-03 walking under a hovering Paloma', () => {
  it('clears Poncho by 9 px: its box bottom is 40 px above its feet, his hurtbox top 31 px above his (8 px from his body box)', () => {
    const s = at({ phase: 'hover', lift: 40 });
    const h = hurtbox(standing(200));
    expect(h.y - enemyBox(def, s).y1).toBe(9);
    expect(160 - 32 - enemyBox(def, s).y1).toBe(8);
  });

  it('leaves him room to pass under it for 73 steps (1.22 s): from 0.27 s into the rise until 0.15 s into the descent', () => {
    // A Poncho standing right under it (feet at its feet): safe while its bottom is at or above his hurtbox top, 31 px up. From the
    // spec: the 16th to 19th rise steps (lift 32 to 38), the 60 steps at 40 px (the 20th rise step is the first), the first 9 descent
    // steps (lift 39 to 31).
    const under = standing(200);
    const top = hurtbox(under).y;
    let s = telegraphing();
    let clear = 0;
    let streak = 0;
    for (let i = 0; i < 200; i++) {
      s = steps(s, 1, under);
      if (enemyBox(def, s).y1 <= top) streak++;
      else if (streak > 0) {
        clear = streak;
        break;
      }
    }
    expect(clear).toBe(73);
  });

  it('a Poncho who waits for it to rise walks under it from one side to the other without a hit', () => {
    // He stands 24 px to its left: close enough to startle it, too far to touch it (5 + 7 = 12 px).
    let r = withPlayer(standing(176));
    for (let i = 0; i < 200 && r.enemies[0]!.wing!.phase !== 'hover'; i++) r = run(r, 1);
    for (let i = 0; i < 200 && r.player.x < 224; i++) r = run(r, 1, right);
    expect(r.lives.lives).toBe(7);
    expect(r.invulnerable).toBe(0);
    expect(r.enemies[0]!.wing!.phase).toBe('hover');
  });

  it('sprinting into one is a hit: 48 px at 120 px/s is 0.4 s, inside its 0.5 s telegraph', () => {
    let r = withPlayer({ ...standing(100), vx: 120 });
    for (let i = 0; i < 60 && r.phase === 'playing'; i++) r = run(r, 1, right);
    expect(r.lives.lives).toBe(6);
    expect(r.enemies[0]!.wing!.phase).toBe('telegraph');
  });
});

describe('GDD-ENM-03 and GDD-CMB-01 the Paloma can be stomped in every phase', () => {
  const phases: Partial<Wing>[] = [{ phase: 'walk' }, { phase: 'telegraph', age: 10 }, { phase: 'rise', lift: 20 }, { phase: 'hover', lift: 40 }, { phase: 'descend', lift: 20 }];
  for (const w of phases) {
    it(`stomped while it is in ${w.phase} it is defeated and Poncho bounces`, () => {
      const s = at(w);
      const top = enemyBox(def, s).y0;
      let r = withPlayer(falling(200, top - 1), { enemies: [s] });
      for (let i = 0; i < 4 && r.enemies[0]!.alive; i++) r = run(r, 1);
      expect(r.enemies[0]!.alive).toBe(false);
      expect(r.player.vy).toBe(-STOMP.bounce);
      expect(r.lives.lives).toBe(7);
    });
  }

  it('GDD-AUD-02 a stomp on it plays the stomp sound', () => {
    let names: string[] = [];
    let s = withPlayer(falling(200, 107), { enemies: [at({ phase: 'hover', lift: 40 })] });
    for (let i = 0; i < 4 && s.enemies[0]!.alive; i++) {
      const after = run(s, 1);
      names = stepSounds(s, after, NO_COMBO).sounds.map((x) => x.name);
      s = after;
    }
    expect(s.enemies[0]!.alive).toBe(false);
    expect(names).toContain('stomp');
  });

  it('a Poncho dropping onto it from more than 24 px above is a stomp, whatever its startle', () => {
    let r = withPlayer(falling(201, 120, 0));
    for (let i = 0; i < 40 && r.enemies[0]!.alive; i++) r = run(r, 1);
    expect(r.enemies[0]!.alive).toBe(false);
    expect(r.lives.lives).toBe(7);
  });
});

describe('GDD-ENM-03 the claw and a fireball defeat the Paloma; any other touch is a hit', () => {
  it('a claw swipe that overlaps it defeats it', () => {
    const r = run(withPlayer(standing(180)), 4, { move: 0, jumpHeld: false, claw: true });
    expect(r.enemies[0]!.alive).toBe(false);
    expect(r.lives.lives).toBe(7);
  });

  it('a fireball that overlaps it defeats it and is used up', () => {
    const fb: Fireball = { x: 196, y: 158, vx: 180, vy: 0, age: 1 };
    const r = run(withPlayer(away, { fireballs: [fb] }), 1);
    expect(r.enemies[0]!.alive).toBe(false);
    expect(r.fireballs).toEqual([]);
  });

  it('touching it from the side is a hit, and in Taco it spends the taco', () => {
    expect(run(withPlayer(standing(190)), 1).lives.lives).toBe(6);
    expect(run(withPlayer(standing(190), { power: 'taco' }), 1)).toMatchObject({ power: 'base', lives: { lives: 7 } });
  });

  it('a lost life brings it back at its start, walking on the ground', () => {
    const r = run(withPlayer(standing(190), { enemies: [at({ phase: 'telegraph' }, 195)] }), 1);
    expect(r.phase).toBe('respawning');
    let back = r;
    while (back.phase === 'respawning') back = run(back, 1);
    expect(back.enemies[0]).toEqual(fresh());
  });
});
