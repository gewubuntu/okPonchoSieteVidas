import { describe, expect, it } from 'vitest';
import { FIREBALL, HIT, LIVES_MAX, RESPAWN, STEP, TILE } from '../config/tuning';
import { BOUNCE_SPEED, spawnFireball, stepFireball, type Fireball } from './fireball';
import type { Item } from './item';
import { spawn, type PlayerInput, type PlayerState } from './movement';
import { startRun, stepRun, type Level, type RunState } from './run';
import { eat, type ItemKind, type Power } from './taco';
import { parseTiles } from './tilemap';

const idle: PlayerInput = { move: 0, jumpHeld: false };
const spit: PlayerInput = { move: 0, jumpHeld: false, fuego: true };

describe('GDD-PWR-03 and GDD-PWR-01 eating an item', () => {
  const table: [Power, ItemKind, Power][] = [
    ['base', 'taco', 'taco'],
    ['taco', 'taco', 'taco'],
    ['fuego', 'taco', 'fuego'],
    ['base', 'chile', 'taco'],
    ['taco', 'chile', 'fuego'],
    ['fuego', 'chile', 'fuego'],
  ];
  it.each(table)('%s eating a %s becomes %s', (from, kind, to) => {
    expect(eat(from, kind)).toBe(to);
  });
});

// A floor at row 4 (top y = 64), 40 columns wide (640 px) so a fireball can fly for its whole life.
const row = '.'.repeat(40);
const world = parseTiles([row, row, row, row, '#'.repeat(40), '#'.repeat(40)]);
const level: Level = {
  world,
  spawn: { x: 24, y: 4 * TILE },
  ofrendas: [],
  spikes: [{ col: 8, row: 3 }],
  crumbles: [],
  springs: [],
  platforms: [],
  tacos: [],
  pinatas: [],
  doors: [],
  keys: [],
  fragiles: [],
};
const at = (x: number, y = 64): PlayerState => spawn(x, y);
const run = (r: RunState, input: PlayerInput, steps: number, l: Level = level): RunState => {
  for (let i = 0; i < steps; i++) r = stepRun(r, input, l);
  return r;
};
const as = (power: Power, extra: Partial<RunState> = {}): RunState => ({ ...startRun(level), power, player: at(24), ...extra });

const chile = (x = 24): Item => ({ x, y: 64, vx: 0, vy: 0, kind: 'chile' });

describe('GDD-PWR-03 collecting a chile', () => {
  it('Taco becomes Fuego and the chile is used up', () => {
    expect(stepRun(as('taco', { items: [chile()] }), idle, level)).toMatchObject({ power: 'fuego', items: [] });
  });
  it('Base becomes Taco', () => {
    expect(stepRun(as('base', { items: [chile()] }), idle, level)).toMatchObject({ power: 'taco', items: [] });
  });
  it('Fuego stays Fuego and the chile is used up (hilos are not built yet)', () => {
    expect(stepRun(as('fuego', { items: [chile()] }), idle, level)).toMatchObject({ power: 'fuego', items: [] });
  });
  it('a chile out of reach is not eaten', () => {
    expect(stepRun(as('taco', { items: [chile(60)] }), idle, level)).toMatchObject({ power: 'taco', items: [chile(60)] });
  });
  it('a taco item does not improve Fuego, and is used up', () => {
    const taco: Item = { x: 24, y: 64, vx: 0, vy: 0, kind: 'taco' };
    expect(stepRun(as('fuego', { items: [taco] }), idle, level)).toMatchObject({ power: 'fuego', items: [] });
  });
});

const onSpike = (power: Power): RunState => ({ ...startRun(level), power, player: at(136) });

describe('GDD-PWR-01 and GDD-CMB-03 a hit in Fuego', () => {
  it('goes back to Taco with no life lost, 2.0 s of invulnerability and a push', () => {
    const r = stepRun(onSpike('fuego'), idle, level);
    expect(r).toMatchObject({ power: 'taco', phase: 'playing', invulnerable: HIT.invulnerableSteps });
    expect(r.lives.lives).toBe(LIVES_MAX);
    expect(Math.abs(r.player.vx)).toBe(HIT.knockback);
  });
  it('a second hit takes the Taco, and a third a life', () => {
    let r = stepRun(onSpike('fuego'), idle, level);
    r = stepRun({ ...r, invulnerable: 0 }, idle, level);
    expect(r.power).toBe('base');
    r = stepRun({ ...r, invulnerable: 0 }, idle, level);
    expect(r.phase).toBe('respawning');
  });
  it('losing a life puts Poncho back in Base', () => {
    const pit: Level = { ...level, world: parseTiles(['....', '....']), spikes: [] };
    let r: RunState = { ...startRun(pit), power: 'fuego', player: at(24, 200) };
    r = run(r, idle, 1 + RESPAWN.delaySteps, pit);
    expect(r).toMatchObject({ phase: 'playing', power: 'base' });
  });
});

const flying = (over: Partial<Fireball> = {}): Fireball => ({ x: 100, y: 40, vx: FIREBALL.speed, vy: 0, age: 0, ...over });

const fly = (fb: Fireball, steps: number): Fireball | null => {
  let f: Fireball | null = fb;
  for (let i = 0; i < steps && f; i++) f = stepFireball(f, world);
  return f;
};

describe('GDD-PWR-03 the fireball', () => {

  it('starts at Poncho\'s front edge, level with the middle of his body, heading the way he faces at 180 px/s', () => {
    expect(spawnFireball({ ...at(100), facing: 1 })).toEqual({ x: 109, y: 60, vx: 180, vy: 0, age: 0 });
    expect(spawnFireball({ ...at(100), facing: -1 })).toEqual({ x: 91, y: 60, vx: -180, vy: 0, age: 0 });
  });

  it('flies 3 px a step', () => {
    expect(stepFireball(flying(), world)!.x).toBeCloseTo(103, 9);
    expect(stepFireball(flying({ vx: -FIREBALL.speed }), world)!.x).toBeCloseTo(97, 9);
  });

  it('falls first, lands on the ground and bounces back up about 20 px each time', () => {
    let f: Fireball | null = flying({ vx: 0, y: 40 });
    const tops: number[] = [];
    let bounces = 0;
    for (let i = 0; i < 200 && f && bounces < 3; i++) {
      const next: Fireball | null = stepFireball(f, world);
      if (next && next.vy < 0 && f.vy >= 0) bounces++;
      if (next && next.vy >= 0 && f.vy < 0) tops.push(next.y);
      f = next;
    }
    expect(bounces).toBe(3);
    expect(tops).toHaveLength(2);
    for (const top of tops) expect(64 - top).toBeGreaterThan(FIREBALL.bounceHeight - 1.5);
    for (const top of tops) expect(64 - top).toBeLessThan(FIREBALL.bounceHeight + 1.5);
    expect(BOUNCE_SPEED).toBeCloseTo(Math.sqrt(2 * FIREBALL.gravity * FIREBALL.bounceHeight), 9);
  });

  it('vanishes against a wall', () => {
    const wall = parseTiles([row, row, row, row.slice(0, 10) + '#' + row.slice(11), '#'.repeat(40)]);
    let f: Fireball | null = flying({ x: 120, y: 56 });
    for (let i = 0; i < 60 && f; i++) f = stepFireball(f, wall);
    expect(f).toBeNull();
    expect(stepFireball(flying({ x: 100, y: 56 }), wall)).not.toBeNull(); // still far from it
  });

  it('vanishes under a ceiling', () => {
    const low = parseTiles([row, '#'.repeat(40), row, row, '#'.repeat(40)]);
    expect(stepFireball({ x: 100, y: 40, vx: 0, vy: -200, age: 0 }, low)).toBeNull();
  });

  it('vanishes when it falls out of the bottom of the level', () => {
    const open = parseTiles([row, row]); // 32 px tall, no floor
    let f: Fireball | null = flying({ vx: 0, y: 10 });
    for (let i = 0; i < 60; i++) f = f && stepFireball(f, open);
    expect(f).toBeNull(); // gone well before its 3 s are up
    expect(stepFireball(flying({ vx: 0, y: 30 }), open)).not.toBeNull(); // still inside the level
  });

  it('lives 3 s: still there on the last step of its life, gone on the next', () => {
    expect(FIREBALL.lifeSteps).toBe(180);
    const old = flying({ vx: 0, y: 63, age: FIREBALL.lifeSteps - 1 });
    expect(stepFireball(old, world)).not.toBeNull();
    expect(stepFireball({ ...old, age: FIREBALL.lifeSteps }, world)).toBeNull();
  });

  it('can fly right across the level, 540 px, without hitting anything on a flat floor', () => {
    const f = fly(flying({ x: 10, y: 58 }), FIREBALL.lifeSteps - 1);
    expect(f).not.toBeNull();
    expect(f!.x).toBeCloseTo(10 + 179 * 180 * STEP, 6);
  });
});

describe('GDD-PWR-03 spitting', () => {
  it('a press in Fuego spits one fireball, on the press step, in front of Poncho', () => {
    const r = stepRun(as('fuego'), spit, level);
    expect(r.fireballs).toEqual([{ x: 33, y: 60, vx: 180, vy: 0, age: 0 }]);
  });

  it('only in Fuego: Base and Taco spit nothing', () => {
    expect(stepRun(as('base'), spit, level).fireballs).toEqual([]);
    expect(stepRun(as('taco'), spit, level).fireballs).toEqual([]);
  });

  it('holding the button spits once, and a new press spits again', () => {
    let r = as('fuego');
    r = run(r, spit, 30);
    expect(r.fireballs).toHaveLength(1);
    r = run(r, idle, 1);
    r = run(r, spit, 1);
    expect(r.fireballs).toHaveLength(2);
  });

  it('at most 2 at once: a third press does nothing until one has vanished', () => {
    let r = as('fuego');
    for (let i = 0; i < 3; i++) r = run(run(r, spit, 1), idle, 1);
    expect(r.fireballs).toHaveLength(2);
    // The first dies at 180 steps of age; the second was 2 steps younger.
    r = run(r, idle, FIREBALL.lifeSteps - 3);
    expect(r.fireballs.length).toBeLessThan(2);
    r = run(run(r, spit, 1), idle, 1);
    expect(r.fireballs.length).toBeGreaterThan(0);
  });

  it('a fireball flies on over a spike tile', () => {
    // The level has a spike in column 8 (x 128 to 144), level with the fireball's bounces.
    const r = run(run(as('fuego'), spit, 1), idle, 40);
    expect(r.fireballs).toHaveLength(1);
    expect(r.fireballs[0]!.x).toBeGreaterThan(144);
  });

  it('the fireballs in flight keep going when Poncho takes a hit or leaves Fuego', () => {
    let r = run(as('fuego'), spit, 1);
    r = { ...r, power: 'taco' };
    r = run(r, idle, 5);
    expect(r.fireballs).toHaveLength(1);
    expect(r.fireballs[0]!.x).toBeGreaterThan(33 + 10);
  });

  it('a death ends the fireballs in flight, and Poncho comes back in Base so a held button spits nothing', () => {
    const pit: Level = { ...level, world: parseTiles(['..........', '..........', '..........', '..........', '#####.....']), spikes: [] };
    // A slow fireball on the floor that would live for 3 s if the death did not clear it.
    let r: RunState = { ...startRun(pit), power: 'fuego', fireballs: [{ x: 50, y: 40, vx: 0, vy: 0, age: 0 }], player: at(120, 200) };
    r = run(r, spit, 1 + RESPAWN.delaySteps + 30, pit);
    expect(r).toMatchObject({ phase: 'playing', power: 'base', fireballs: [] });
  });
});
