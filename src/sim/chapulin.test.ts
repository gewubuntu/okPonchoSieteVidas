import { describe, expect, it } from 'vitest';
import { STOMP } from '../config/tuning';
import type { Hop } from './chapulin';
import { enemyBox, freshEnemies, stepEnemy, type Enemy, type EnemyState, type EnemyTops } from './enemy';
import type { Fireball } from './fireball';
import { hurtbox } from './hazards';
import { spawn, type PlayerInput, type PlayerState } from './movement';
import type { PlatformPos } from './platform';
import { startRun, stepRun, type Level, type RunState } from './run';
import { NO_COMBO, stepSounds } from './sfx';
import { parseTiles, type TileGrid } from './tilemap';

const idle: PlayerInput = { move: 0, jumpHeld: false };

/** A world of 30 columns and 12 rows whose rows 10 and 11 are floor (top y = 160), with changes. */
const grid = (edit: (row: number) => string = () => '.'.repeat(30)): TileGrid =>
  parseTiles(Array.from({ length: 12 }, (_, r) => (r >= 10 ? '#'.repeat(30) : edit(r))));
const flat = grid();
// The floor ends at column 19 (x = 320): a pit beyond. A 2-tile wall in column 3 (x 48 to 64, top y = 128).
const ledgeWorld = parseTiles(
  Array.from({ length: 12 }, (_, r) => {
    if (r >= 10) return '#'.repeat(20) + '.'.repeat(10);
    if (r >= 8) return '...#' + '.'.repeat(26);
    return '.'.repeat(30);
  }),
);
const def: Enemy = { x: 100, y: 160, kind: 'chapulin' };
const away = { ...spawn(440, 20), grounded: true };
const fresh = (d: Enemy = def): EnemyState => freshEnemies([d])[0]!;
const hop = (s: EnemyState): Hop => s.hop!;
const step = (s: EnemyState, world: TileGrid, n = 1, tops: EnemyTops = { awnings: [], cordeles: [] }, d: Enemy = def): EnemyState => {
  for (let i = 0; i < n; i++) s = stepEnemy(d, s, world, away, tops);
  return s;
};
/** Crouched on the floor at x, heading `dir`, at the start of its crouch. */
const crouched = (x = 100, dir: 1 | -1 = 1, y = 160): EnemyState => ({ x, y, dir, alive: true, hop: { phase: 'crouch', age: 0, vy: 0 } });
const awnings = (...a: PlatformPos[]): EnemyTops => ({ awnings: a, cordeles: [] });
const falling = (x: number, y: number): PlayerState => ({ ...spawn(x, y), vy: 150, grounded: false });

/** Plays one hop from the end of a crouch at (x, 160) on `world`: its peak above the floor, the steps in the air and how far across it went. */
function measureHop(world: TileGrid, x = 100): { peak: number; air: number; across: number; landY: number } {
  let s = step(crouched(x), world, 35);
  let peak = 0;
  let air = 0;
  do {
    s = step(s, world);
    peak = Math.max(peak, 160 - s.y!);
    air++;
  } while (hop(s).phase === 'air' && air < 200);
  return { peak, air, across: s.x - x, landY: s.y! };
}

describe('GDD-ENM-03 the Chapulín crouches and hops', () => {
  it('starts alive where the level puts it, heading right, crouched', () => {
    expect(fresh()).toEqual({ x: 100, dir: 1, alive: true, hop: { phase: 'crouch', age: 0, vy: 0 } });
  });

  it('a crouch with no ground under it falls; one with only a corner of its box on a ledge stays', () => {
    const s = step(crouched(100, 1, 120), flat);
    expect(hop(s).phase).toBe('air');
    expect(s.y).toBeGreaterThan(120);
    // On the ledge world the floor ends at x = 320: the middle of its feet is over the pit, its box's left 3 px over the floor.
    expect(step(crouched(323), ledgeWorld, 10)).toMatchObject({ x: 323, y: 160, hop: { phase: 'crouch', age: 10 } });
  });

  it('is a 12 x 10 px box standing on its feet', () => {
    expect(enemyBox(def, crouched())).toEqual({ x0: 94, x1: 106, y0: 150, y1: 160 });
  });

  it('crouches still for 0.6 s (36 steps), then hops', () => {
    let s = crouched();
    for (let i = 1; i < 36; i++) {
      s = step(s, flat);
      expect(s).toMatchObject({ x: 100, y: 160, hop: { phase: 'crouch', age: i } });
    }
    s = step(s, flat);
    expect(hop(s).phase).toBe('air');
    expect(s.x).toBeCloseTo(101, 9);
    expect(s.y).toBeLessThan(160);
  });

  it('hops 300 px/s up and 60 px/s across: about 30.5 px up and 0.41 s in the air, about 25 px across, back on its own level', () => {
    // Measured in steps (L-003): the peak is 30.2 px (30.5 by the continuous formula), 25 steps (0.42 s) in the air, 25 px across.
    const m = measureHop(flat);
    expect(m.peak).toBeCloseTo(30.21, 2);
    expect(m.air).toBe(25);
    expect(m.across).toBeCloseTo(m.air, 9); // 1 px a step
    expect(m.landY).toBe(160);
  });

  it('crouches again where it lands, and hops on the same way', () => {
    let s = step(crouched(), flat, 36);
    for (let i = 0; i < 200 && hop(s).phase === 'air'; i++) s = step(s, flat);
    expect(hop(s)).toEqual({ phase: 'crouch', age: 0, vy: 0 });
    const x = s.x;
    s = step(s, flat, 36);
    expect(s.x).toBeGreaterThan(x);
  });

  it('climbs a step 1 tile high (16 px, under its 30.5 px)', () => {
    // A step at columns 8 and up, row 9 (top y = 144), its left side at x = 128.
    const world = grid((r) => (r === 9 ? '........' + '#'.repeat(22) : '.'.repeat(30)));
    let s = crouched(118);
    for (let i = 0; i < 80; i++) s = step(s, world);
    expect(s.y).toBe(144);
    expect(s.x).toBeGreaterThan(128);
  });

  it('turns round instead of hopping into a 2-tile wall (32 px, over its 30.5 px), and never passes it', () => {
    let s = crouched(80, -1);
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < 600; i++) {
      s = step(s, ledgeWorld);
      min = Math.min(min, s.x);
      max = Math.max(max, s.x);
    }
    expect(min).toBeGreaterThanOrEqual(64 + 6);
    expect(max).toBeGreaterThan(80 + 25); // it turned and hopped away
    expect(s.y).toBe(160);
  });

  it('at the wall it turns round on the ground, where it crouched, instead of hopping', () => {
    // Crouched 7 px from the wall's right face (x = 64), facing it: its hop would meet the wall.
    expect(step(crouched(77, -1), ledgeWorld, 36)).toEqual({ ...crouched(77, 1) });
  });

  it('a ceiling stops its rise', () => {
    // A ceiling in row 8 (its underside at y = 144), 6 px over its head when it crouches on the floor.
    const world = grid((r) => (r === 8 ? '#'.repeat(30) : '.'.repeat(30)));
    let s = crouched(100);
    let highest = 160;
    for (let i = 0; i < 120; i++) {
      s = step(s, world);
      highest = Math.min(highest, s.y!);
    }
    expect(highest - 10).toBeGreaterThanOrEqual(144 - 1e-6);
    expect(s.y).toBe(160);
    expect(s.x).toBeGreaterThan(100);
  });

  it('lands on a corner of the floor with the middle of its feet over a pit, and stays there', () => {
    // Falling at 200 px/s from x = 322, 5 px over the floor, which ends at x = 320: it comes down at x = 324, its box's left 2 px over it.
    let s: EnemyState = { x: 322, y: 155, dir: 1, alive: true, hop: { phase: 'air', age: 0, vy: 200 } };
    for (let i = 0; i < 20; i++) s = step(s, ledgeWorld);
    expect(s).toMatchObject({ x: 324, y: 160, hop: { phase: 'crouch' } });
  });

  it('lands on a sand slope\'s surface (GDD-MOV-09)', () => {
    // A 45-degree slope in column 8, row 9 (rising from y = 160 at x = 128 to 144 at x = 144), then ground at y = 144.
    const world = grid((r) => (r === 9 ? '......../' + '#'.repeat(21) : '.'.repeat(30)));
    let s = crouched(118);
    s = step(s, world, 36);
    for (let i = 0; i < 200 && hop(s).phase === 'air'; i++) s = step(s, world);
    expect(s.x).toBeGreaterThan(128);
    expect(s.x).toBeLessThan(144);
    expect(s.y).toBeCloseTo(160 - (s.x - 128), 9);
  });

  it('turns round at a hop that would land in the pit beyond a ledge, so it never falls', () => {
    let s = crouched(300);
    let lowest = 0;
    let dirs = new Set<number>();
    for (let i = 0; i < 1200; i++) {
      s = step(s, ledgeWorld);
      lowest = Math.max(lowest, s.y!);
      dirs.add(s.dir);
    }
    expect(lowest).toBe(160);
    expect(dirs).toEqual(new Set([1, -1]));
  });

  it('turns round at a hop that would land lower than it is: it never hops down a step', () => {
    // Its ground, columns 0 to 9 at row 9 (top y = 144), ends at x = 160 above the floor at y = 160.
    const world = grid((r) => (r === 9 ? '#'.repeat(10) + '.'.repeat(20) : '.'.repeat(30)));
    let s = crouched(140, 1, 144);
    let lowest = 0;
    for (let i = 0; i < 1200; i++) {
      s = step(s, world);
      lowest = Math.max(lowest, s.y!);
    }
    expect(lowest).toBe(144);
  });
});

describe('GDD-ENM-03 and GDD-WLD-10 an awning throws the Chapulín up', () => {
  // An awning 4 tiles wide, x 64 to 128, its top at y = 112, 48 px over the floor.
  const awning = { x: 64, y: 112, w: 64 };
  const onAwning: Enemy = { x: 80, y: 112, kind: 'chapulin' };

  it('its fall onto an awning throws it up at 480 px/s, keeping its 60 px/s across, with no crouch', () => {
    const s = step(fresh(onAwning), flat, 1, awnings(awning), onAwning);
    expect(s.y).toBe(112);
    expect(hop(s)).toMatchObject({ phase: 'air', vy: -480, on: 0 });
    const next = step(s, flat, 1, awnings(awning), onAwning);
    expect(next.x - s.x).toBeCloseTo(1, 9);
  });

  it('each bounce rises about 77 px and lasts about 0.66 s, moving it about 40 px; it bounces along a 4-tile awning and off its end, then crouches on the ground', () => {
    let s = fresh(onAwning);
    const bounces: { x: number; step: number }[] = [];
    let peak = Infinity;
    for (let i = 0; i < 400; i++) {
      s = step(s, flat, 1, awnings(awning), onAwning);
      if (hop(s).on !== undefined) bounces.push({ x: s.x, step: i });
      if (bounces.length === 1) peak = Math.min(peak, s.y!);
      if (hop(s).phase === 'crouch') break;
    }
    // Measured in steps (L-003): 77.1 px up (77.3 by the continuous formula), 40 steps (0.67 s) and 40 px a bounce.
    expect(bounces).toHaveLength(2);
    expect(112 - peak).toBeCloseTo(77.08, 2);
    const each = bounces[1]!.step - bounces[0]!.step;
    expect(each).toBe(40);
    expect(bounces[1]!.x - bounces[0]!.x).toBeCloseTo(each, 9);
    expect(s).toMatchObject({ y: 160, hop: { phase: 'crouch', age: 0 } });
  });

  it('a hop from the ground that comes down over an awning is thrown up from it', () => {
    // An awning 1 tile over the floor (top y = 144), x 112 to 176; the Chapulín crouches just left of it.
    let s = crouched(100);
    let thrown = false;
    for (let i = 0; i < 70 && !thrown; i++) {
      s = step(s, flat, 1, awnings({ x: 112, y: 144, w: 64 }));
      thrown = hop(s).vy === -480;
    }
    expect(thrown).toBe(true);
  });

  it('says which awning threw it, so a torn one can tear (GDD-WLD-10), and nothing on other steps', () => {
    const other = { x: 300, y: 112, w: 32 };
    const s = step(fresh(onAwning), flat, 1, awnings(other, awning), onAwning);
    expect(hop(s).on).toBe(1);
    expect(hop(step(s, flat, 1, awnings(other, awning), onAwning)).on).toBeUndefined();
  });

  it('passes up through an awning from below', () => {
    // An awning 16 px over the floor right above it: its hop goes up through it and comes back down onto it.
    let s = crouched(100);
    s = step(s, flat, 36, awnings({ x: 80, y: 144, w: 64 }));
    expect(hop(s).vy).toBeLessThan(0);
    expect(s.y).toBeLessThan(160);
  });

  it('an awning whose top is above its feet does not throw it: only a fall onto the top does', () => {
    // Falling from rest at y = 150, under an awning whose top is at y = 144: it falls on to the floor.
    let s: EnemyState = { x: 100, y: 150, dir: 1, alive: true, hop: { phase: 'air', age: 0, vy: 0 } };
    for (let i = 0; i < 20; i++) s = step(s, flat, 1, awnings({ x: 64, y: 144, w: 96 }));
    expect(s).toMatchObject({ y: 160, hop: { phase: 'crouch' } });
  });

  it('only an awning its box is over throws it: falling just past either end of one it lands on the floor', () => {
    // The awning is x 64 to 128 at y = 112. Falling at 200 px/s from 8 px over it, moving away from it: past its left end (box x 51 to
    // 63), and past its right end (box x 129 to 141).
    for (const [x, dir] of [[57, -1], [135, 1]] as const) {
      let s: EnemyState = { x, y: 104, dir, alive: true, hop: { phase: 'air', age: 0, vy: 200 } };
      for (let i = 0; i < 40 && hop(s).phase === 'air'; i++) s = step(s, flat, 1, awnings(awning));
      expect(s, `${x}`).toMatchObject({ y: 160, hop: { phase: 'crouch' } });
    }
  });

  it('a tile it lands on wins over an awning at the same height', () => {
    // An awning whose top is the floor's top, under its feet: landing on the floor it crouches.
    let s = crouched(100);
    s = step(s, flat, 36);
    for (let i = 0; i < 200 && hop(s).phase === 'air'; i++) s = step(s, flat, 1, awnings({ x: 0, y: 160, w: 480 }));
    expect(hop(s).phase).toBe('crouch');
  });
});

describe('GDD-ENM-03 the Chapulín in a run', () => {
  const world = flat;
  const level: Level = { world, spawn: { x: 24, y: 160 }, ofrendas: [], spikes: [], crumbles: [], springs: [], platforms: [], tacos: [], pinatas: [], doors: [], keys: [], fragiles: [], enemies: [def] };
  const withPlayer = (player: PlayerState, extra: Partial<RunState> = {}): RunState => ({ ...startRun(level), player, ...extra });
  const run = (r: RunState, n: number, input: PlayerInput = idle): RunState => {
    for (let i = 0; i < n; i++) r = stepRun(r, input, level);
    return r;
  };

  it('stomped while it crouches it is defeated and Poncho bounces', () => {
    let r = withPlayer(falling(100, 149), { enemies: [crouched()] });
    for (let i = 0; i < 4 && r.enemies[0]!.alive; i++) r = run(r, 1);
    expect(r.enemies[0]!.alive).toBe(false);
    expect(r.player.vy).toBe(-STOMP.bounce);
  });

  it('GDD-AUD-02 a stomp on it plays the stomp sound', () => {
    let r = withPlayer(falling(100, 149), { enemies: [crouched()] });
    let names: string[] = [];
    for (let i = 0; i < 4 && r.enemies[0]!.alive; i++) {
      const after = run(r, 1);
      names = stepSounds(r, after, NO_COMBO).sounds.map((s) => s.name);
      r = after;
    }
    expect(r.enemies[0]!.alive).toBe(false);
    expect(names).toContain('stomp');
  });

  it('stomped in the air it is defeated too, and a held jump bounces Poncho high', () => {
    const airborne: EnemyState = { x: 100, y: 140, dir: 1, alive: true, hop: { phase: 'air', age: 5, vy: 100 } };
    let r = withPlayer(falling(100, 129), { enemies: [airborne] });
    for (let i = 0; i < 4 && r.enemies[0]!.alive; i++) r = run(r, 1, { move: 0, jumpHeld: true });
    expect(r.enemies[0]!.alive).toBe(false);
    expect(r.player.vy).toBe(-STOMP.boostBounce);
  });

  it('a claw swipe or a fireball defeats it', () => {
    expect(run(withPlayer({ ...spawn(80, 160), grounded: true }, { enemies: [crouched()] }), 4, { move: 0, jumpHeld: false, claw: true }).enemies[0]!.alive).toBe(false);
    const fb: Fireball = { x: 96, y: 158, vx: 180, vy: 0, age: 1 };
    const r = run(withPlayer(away, { enemies: [crouched()], fireballs: [fb] }), 1);
    expect(r.enemies[0]!.alive).toBe(false);
    expect(r.fireballs).toEqual([]);
  });

  it('running under its hop does not work: its peak, about 30 px up, reaches into a standing Poncho (hurtbox top 31 px up)', () => {
    // Poncho stands where the hop peaks, 12.5 px ahead of it: clear of its crouch (5 + 6 = 11 px), not of its hop.
    const p = { ...spawn(112.5, 160), grounded: true };
    let r = withPlayer(p, { enemies: [crouched()] });
    expect(enemyBox(def, crouched()).x1).toBeLessThan(hurtbox(p).x);
    for (let i = 0; i < 70 && r.phase === 'playing'; i++) r = run(r, 1);
    expect(r.lives.lives).toBe(6);
  });

  it('a lost life brings it back at its start', () => {
    let r = run(withPlayer({ ...spawn(100, 160), grounded: true }, { enemies: [crouched(300)] }), 1);
    r = run(r, 1);
    expect(r.phase).toBe('playing');
    let hit = withPlayer({ ...spawn(100, 160), grounded: true });
    hit = run(hit, 1);
    expect(hit.phase).toBe('respawning');
    while (hit.phase === 'respawning') hit = run(hit, 1);
    expect(hit.enemies[0]).toEqual(fresh());
  });
});
