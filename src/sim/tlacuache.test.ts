import { describe, expect, it } from 'vitest';
import { HIT, LIVES_MAX, RESPAWN } from '../config/tuning';
import { enemyBox, freshEnemies, isStomp, stepEnemy, touchesEnemy, type Enemy, type EnemyState, type Gait } from './enemy';
import type { Fireball } from './fireball';
import { spawn, type PlayerInput, type PlayerState } from './movement';
import { startRun, stepRun, type Level, type RunState } from './run';
import type { Power } from './taco';
import { parseTiles } from './tilemap';

const idle: PlayerInput = { move: 0, jumpHeld: false };

// Floor at row 10 (top y = 160) from column 0 to 15, so its right end (a ledge) is at x = 256. A wall in column 2, rows 8 and 9
// (x 32 to 48). The Tlacuache starts at x = 100 on the floor heading right: a 16 x 10 box, x 92 to 108, y 150 to 160.
const world = parseTiles(
  Array.from({ length: 12 }, (_, r) => {
    if (r >= 10) return '#'.repeat(16) + '....';
    if (r >= 8) return '..#' + '.'.repeat(17);
    return '.'.repeat(20);
  }),
);
const def: Enemy = { x: 100, y: 160, kind: 'tlacuache' };
const level: Level = { world, spawn: { x: 24, y: 160 }, ofrendas: [], spikes: [], crumbles: [], springs: [], platforms: [], tacos: [], pinatas: [], doors: [], keys: [], fragiles: [], enemies: [def] };
const standing = (x: number, y = 160): PlayerState => ({ ...spawn(x, y), grounded: true });
const falling = (x: number, y: number, vy = 150): PlayerState => ({ ...spawn(x, y), vy, grounded: false });
/** Poncho high above everything, never level with it. */
const away = standing(300, 40);
const fresh = (): EnemyState => freshEnemies([def])[0]!;
const gait = (s: EnemyState): Gait => s.gait!;
const with_ = (g: Partial<Gait>, x = 100, dir: 1 | -1 = 1): EnemyState => ({ x, dir, alive: true, gait: { phase: 'walk', age: 0, playedDead: false, ...g } });
const walk = (s: EnemyState, steps: number, p: PlayerState = away): EnemyState => {
  for (let i = 0; i < steps; i++) s = stepEnemy(def, s, world, p);
  return s;
};
/** Steps until it is in `phase` (at most 600 steps), returning the steps taken and the state. */
const until = (s: EnemyState, phase: Gait['phase'], p: PlayerState = away): { steps: number; s: EnemyState } => {
  let steps = 0;
  while (gait(s).phase !== phase && steps < 600) {
    s = stepEnemy(def, s, world, p);
    steps++;
  }
  return { steps, s };
};
const spotted = (p: PlayerState, s: EnemyState = fresh()): boolean => gait(walk(s, 1, p)).phase === 'telegraph';
const withPlayer = (player: PlayerState, extra: Partial<RunState> = {}): RunState => ({ ...startRun(level), player, ...extra });
const dead = (): EnemyState => with_({ phase: 'dead', playedDead: true });
const touching = (power: Power): RunState => withPlayer(standing(100), { power });
const run = (r: RunState, steps: number, input: PlayerInput = idle): RunState => {
  for (let i = 0; i < steps; i++) r = stepRun(r, input, level);
  return r;
};

describe('GDD-ENM-02 the Tlacuache walks', () => {
  it('starts alive where the level puts it, heading right, walking, not yet stomped', () => {
    expect(fresh()).toEqual({ x: 100, dir: 1, alive: true, gait: { phase: 'walk', age: 0, playedDead: false } });
  });

  it('is a 16 x 10 px box standing on its y', () => {
    expect(enemyBox(def, fresh())).toEqual({ x0: 92, x1: 108, y0: 150, y1: 160 });
  });

  it('walks at 24 px/s', () => {
    expect(walk(fresh(), 30).x).toBeCloseTo(100 + 12, 9);
  });

  it('turns round at the ledge, never walking off it, and flush against a wall', () => {
    let s = fresh();
    let max = -Infinity;
    let min = Infinity;
    for (let i = 0; i < 2000; i++) {
      s = walk(s, 1);
      max = Math.max(max, s.x);
      min = Math.min(min, s.x);
    }
    expect(max).toBeLessThanOrEqual(256 - 8 + 1e-6); // its leading edge never passes the ledge
    expect(max).toBeGreaterThan(256 - 8 - 0.4);
    expect(min).toBe(48 + 8); // flush against the wall's right face
  });
});

describe('GDD-ENM-02 the Tlacuache spots Poncho', () => {
  // After one step it is at x = 100.4, facing right. Poncho's hurtbox centre is at his x.
  const x1 = 100 + 24 / 60;

  it('when his hurtbox centre is up to 80 px in front of it', () => {
    expect(spotted(standing(x1 + 80))).toBe(true);
    expect(spotted(standing(x1 + 1))).toBe(true);
    expect(spotted(standing(x1 + 80.5))).toBe(false);
  });

  it('not behind it, nor right on its centre', () => {
    expect(spotted(standing(x1 - 20))).toBe(false);
    expect(spotted(standing(x1))).toBe(false);
    expect(spotted(standing(x1 - 20), with_({}, 100, -1))).toBe(true); // facing left, he is in front
  });

  it('only when his feet are within 16 px of its own, up or down', () => {
    expect(spotted(standing(x1 + 40, 160 - 16))).toBe(true);
    expect(spotted(standing(x1 + 40, 160 + 16))).toBe(true);
    expect(spotted(standing(x1 + 40, 160 - 16.5))).toBe(false);
    expect(spotted(standing(x1 + 40, 160 + 16.5))).toBe(false);
  });
});

describe('GDD-ENM-01 the Tlacuache telegraphs for 0.5 s before it charges', () => {
  it('freezes for exactly 30 steps, then charges', () => {
    const p = standing(160);
    const frozen = until(fresh(), 'telegraph', p).s;
    const { steps, s } = until(frozen, 'charge', p);
    expect(steps).toBe(30);
    expect(s.x).toBe(frozen.x);
  });
});

describe('GDD-ENM-02 the Tlacuache charges', () => {
  it('at 150 px/s the way it faces, without following Poncho, until the ledge stops it; then it turns and walks', () => {
    const p = standing(160);
    let s = until(until(fresh(), 'telegraph', p).s, 'charge', p).s;
    const x0 = s.x;
    s = walk(s, 1, standing(40)); // he is behind it now; it does not turn to follow
    expect(s.x - x0).toBeCloseTo(2.5, 9);
    const { s: end } = until(s, 'walk');
    expect(end.x).toBeLessThanOrEqual(256 - 8);
    expect(end.x).toBeGreaterThan(256 - 8 - 2.5);
    expect(end.dir).toBe(-1);
    expect(walk(end, 1).x - end.x).toBeCloseTo(-0.4, 9); // walking again, at 24 px/s
  });

  it('stops flush against a wall', () => {
    const p = standing(70);
    const s = until(until(with_({}, 100, -1), 'charge', p).s, 'walk', p).s;
    expect(s.x).toBe(48 + 8);
    expect(s.dir).toBe(1);
  });
});

describe('GDD-CMB-01 the first stomp makes it play dead', () => {
  it('Poncho bounces as from any stomp, and it lies there, alive, playing dead', () => {
    const r = run(withPlayer(falling(100, 150)), 1);
    expect(r.enemies[0]).toMatchObject({ alive: true, gait: { phase: 'dead', playedDead: true } });
    expect(r.player.vy).toBe(-260);
    expect(r.lives.lives).toBe(LIVES_MAX);
  });

  it('also while it telegraphs or charges', () => {
    for (const phase of ['telegraph', 'charge'] as const) {
      const r = run(withPlayer(falling(100, 150), { enemies: [with_({ phase, age: 5 })] }), 1);
      expect(r.enemies[0]!.gait!.phase, phase).toBe('dead');
    }
  });

  it('it lies still for 2.0 s (120 steps), then wakes and walks the way it faced', () => {
    let s = with_({ phase: 'dead', playedDead: true }, 100, -1);
    s = walk(s, 119, standing(80)); // 2.0 s is 120 steps
    expect(s).toMatchObject({ x: 100, gait: { phase: 'dead' } });
    s = walk(s, 1, standing(300, 40));
    expect(s).toMatchObject({ x: 100, dir: -1, gait: { phase: 'walk', age: 0, playedDead: true } });
  });
});

describe('GDD-ENM-02 playing dead it is out of play', () => {
  it('touching it is no hit, until it wakes, when it is', () => {
    let r = withPlayer(standing(100), { enemies: [dead()] });
    r = run(r, 119);
    expect(r).toMatchObject({ phase: 'playing', invulnerable: 0 });
    expect(r.lives.lives).toBe(LIVES_MAX);
    r = run(r, 1);
    expect(r.phase).toBe('respawning');
    expect(r.lives.lives).toBe(LIVES_MAX - 1);
  });

  it('landing on it is no stomp: no bounce, it plays on', () => {
    const before = falling(100, 145);
    const after = falling(100, 152);
    expect(isStomp(before, after, def, dead())).toBe(false);
    const r = run(withPlayer(falling(100, 150), { enemies: [dead()] }), 1);
    expect(r.player.vy).toBeGreaterThan(0);
    expect(r.enemies[0]!.gait!.phase).toBe('dead');
  });

  it('the claw passes through it', () => {
    const swing = { phase: 'swing', steps: 1, cooldown: 10, dir: 1, held: true } as const;
    const r = run(withPlayer({ ...standing(84), facing: 1 }, { enemies: [dead()], claw: swing }), 1);
    expect(r.enemies[0]).toMatchObject({ alive: true, gait: { phase: 'dead' } });
  });

  it('a fireball passes over it and is not used up', () => {
    const fb: Fireball = { x: 95, y: 159, vx: 180, vy: 0, age: 0 };
    const r = run(withPlayer(away, { enemies: [dead()], fireballs: [fb] }), 1);
    expect(touchesEnemy(standing(100), def, dead())).toBe(false);
    expect(r.enemies[0]!.alive).toBe(true);
    expect(r.fireballs.length).toBe(1);
  });
});

describe('GDD-CMB-01 once awake, a second stomp defeats it', () => {
  it('a stomp on a Tlacuache that has played dead defeats it, with a bounce', () => {
    const r = run(withPlayer(falling(100, 150), { enemies: [with_({ playedDead: true })] }), 1);
    expect(r.enemies[0]!.alive).toBe(false);
    expect(r.player.vy).toBe(-260);
  });
});

describe('GDD-CMB-02 and GDD-PWR-03 the claw and a fireball defeat it while awake', () => {
  it('a claw swing that reaches it defeats it, even if it was never stomped', () => {
    const swing = { phase: 'swing', steps: 1, cooldown: 10, dir: 1, held: true } as const;
    const r = run(withPlayer({ ...standing(84), facing: 1 }, { claw: swing }), 1);
    expect(r.enemies[0]!.alive).toBe(false);
    expect(r.lives.lives).toBe(LIVES_MAX);
  });

  it('a fireball that hits it defeats it and is used up', () => {
    const fb: Fireball = { x: 80, y: 159, vx: 180, vy: 0, age: 0 };
    const r = run(withPlayer(away, { fireballs: [fb] }), 8);
    expect(r.enemies[0]!.alive).toBe(false);
    expect(r.fireballs).toEqual([]);
  });

  it('a claw swing on the step of a first stomp defeats it, rather than letting it play dead', () => {
    // Falling onto its left edge (hurtbox x 83 to 93 against its 92 to 108) with a live swing whose box (x 94 to 114) reaches it.
    const swing = { phase: 'swing', steps: 1, cooldown: 10, dir: 1, held: true } as const;
    const r = run(withPlayer({ ...falling(88, 150), facing: 1 }, { claw: swing }), 1);
    expect(r.enemies[0]!.alive).toBe(false);
    expect(r.player.vy).toBe(-260); // the stomp still bounces him
  });

  it('a fireball on the step of a first stomp defeats it, rather than letting it play dead', () => {
    const fb: Fireball = { x: 95, y: 159, vx: 180, vy: 0, age: 0 };
    const r = run(withPlayer(falling(100, 150), { fireballs: [fb] }), 1);
    expect(r.enemies[0]!.alive).toBe(false);
    expect(r.player.vy).toBe(-260);
  });
});

describe('GDD-CMB-03 a Tlacuache hit', () => {
  it('costs a life in Base', () => {
    const r = run(touching('base'), 1);
    expect(r.phase).toBe('respawning');
    expect(r.lives.lives).toBe(LIVES_MAX - 1);
  });

  it('spends the taco in Taco, with 2.0 s of invulnerability and a push away from it', () => {
    const r = run({ ...touching('taco'), player: standing(96) }, 1);
    expect(r).toMatchObject({ power: 'base', phase: 'playing', invulnerable: HIT.invulnerableSteps });
    expect(r.player.vx).toBe(-HIT.knockback); // it is to his right
  });
});

describe('GDD-LIFE-02 the Tlacuache after a life is lost', () => {
  it('is back at its start, walking, and must be stomped twice again', () => {
    const pit: Level = { ...level, world: parseTiles(['....', '....']) };
    let r: RunState = { ...startRun(pit), player: spawn(24, 200), enemies: [with_({ phase: 'dead', age: 9, playedDead: true }, 200, -1)] };
    for (let i = 0; i < 1 + RESPAWN.delaySteps; i++) r = stepRun(r, idle, i === 0 ? pit : level);
    expect(r.enemies).toEqual(freshEnemies([def]));
  });
});
