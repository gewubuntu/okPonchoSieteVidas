import { describe, expect, it } from 'vitest';
import { CACTUS, HIT, LIVES_MAX } from '../config/tuning';
import { defeatable, enemyBox, freshEnemies, harmlessFromBelow, isStomp, stepEnemy, touchesEnemy, type Enemy } from './enemy';
import type { Fireball } from './fireball';
import { spawn, type PlayerInput, type PlayerState } from './movement';
import { startRun, stepRun, type Level, type RunState } from './run';
import type { Power } from './taco';
import { parseTiles } from './tilemap';

const idle: PlayerInput = { move: 0, jumpHeld: false };

// Floor at row 10 (top y = 160). A cactus buddy stands on it at x = 100 (a 12 x 16 box, x 94 to 106, y 144 to 160), and a
// second hangs in the air for the from-below tests: its box is x 94 to 106, y 84 to 100.
const world = parseTiles(Array.from({ length: 12 }, (_, r) => (r >= 10 ? '#'.repeat(20) : '.'.repeat(20))));
const floor: Enemy = { x: 100, y: 160, kind: 'cactus' };
const high: Enemy = { x: 100, y: 100, kind: 'cactus' };
const levelOf = (...enemies: Enemy[]): Level => ({ world, spawn: { x: 24, y: 160 }, ofrendas: [], spikes: [], crumbles: [], springs: [], platforms: [], tacos: [], pinatas: [], doors: [], keys: [], fragiles: [], enemies });
const level = levelOf(floor);
const withPlayer = (player: PlayerState, extra: Partial<RunState> = {}, l: Level = level): RunState => ({ ...startRun(l), player, ...extra });
const run = (r: RunState, steps: number, l: Level = level, input: PlayerInput = idle): RunState => {
  for (let i = 0; i < steps; i++) r = stepRun(r, input, l);
  return r;
};
const touching = (power: Power): RunState => withPlayer({ ...spawn(100, 160), grounded: true }, { power });

describe('GDD-ENM-02 the cactus buddy', () => {
  it('starts alive where the level puts it, and never moves', () => {
    const [state] = freshEnemies([floor]);
    expect(state).toEqual({ x: 100, dir: 1, alive: true });
    let s = state!;
    for (let i = 0; i < 300; i++) s = stepEnemy(floor, s, world, spawn(300, 160));
    expect(s).toEqual(state);
  });

  it('is a 12 x 16 px box standing on its y', () => {
    expect([CACTUS.width, CACTUS.height]).toEqual([12, 16]);
    expect(enemyBox(floor, freshEnemies([floor])[0]!)).toEqual({ x0: 94, x1: 106, y0: 144, y1: 160 });
  });

  it('cannot be defeated, unlike the other enemies', () => {
    expect(defeatable(floor)).toBe(false);
    expect(defeatable({ x: 0, y: 0 })).toBe(true);
    expect(defeatable({ x: 0, y: 0, kind: 'zopilote' })).toBe(true);
  });
});

describe('GDD-CMB-01 and GDD-CMB-03 touching a cactus buddy', () => {
  it('landing on it is not a stomp, it is a hit', () => {
    const above: PlayerState = { ...spawn(100, 146), vy: 100, grounded: false };
    const state = freshEnemies([floor])[0]!;
    expect(touchesEnemy(above, floor, state)).toBe(true);
    expect(isStomp({ ...above, y: 140 }, above, floor, state)).toBe(false); // an Alacrán's stomp rule would count this
    let r = withPlayer({ ...spawn(100, 140), vy: 300, grounded: false });
    r = run(r, 4);
    expect(r.enemies[0]!.alive).toBe(true);
    expect(r.phase).not.toBe('playing');
    expect(r.lives.lives).toBe(LIVES_MAX - 1);
  });

  it('walking into it costs a life in Base', () => {
    const r = run(touching('base'), 1);
    expect(r.lives.lives).toBe(LIVES_MAX - 1);
    expect(r.enemies[0]!.alive).toBe(true);
  });

  it('spends the taco in Taco, with 2.0 s of invulnerability and a push away from it', () => {
    const r = run(withPlayer({ ...spawn(96, 160), grounded: true }, { power: 'taco' }), 1);
    expect(r).toMatchObject({ power: 'base', phase: 'playing', invulnerable: HIT.invulnerableSteps });
    expect(r.player.vx).toBe(-HIT.knockback); // he is on its left
  });
});

// Hurtbox top = feet - 31 (GDD-MOV-06: 30 px tall, 1 px above the feet). Before: feet 131.5, top 100.5 (just below its underside at y = 100). After rising 6 px, it overlaps.
const rising = (feet: number, vy: number) => {
  const before: PlayerState = { ...spawn(100, feet), vy, grounded: false };
  const after: PlayerState = { ...before, y: feet - 6.5 };
  return { before, after };
};

describe('GDD-ENM-02 a cactus buddy is harmless from below', () => {
  const highLevel = levelOf(high);
  const state = freshEnemies([high])[0]!;

  it('is harmless when he rises into it with his head below its underside a step before', () => {
    const { before, after } = rising(131.5, -400);
    expect(touchesEnemy(after, high, state)).toBe(true);
    expect(harmlessFromBelow(before, after, high, state)).toBe(true);
  });

  it('still counts when his head was exactly at its underside a step before', () => {
    const { before, after } = rising(131, -400); // head top at y = 100, the underside
    expect(harmlessFromBelow(before, after, high, state)).toBe(true);
  });

  it('is a hit when he is not rising, or was already inside it a step before', () => {
    const { before, after } = rising(131.5, -400);
    expect(harmlessFromBelow(before, { ...after, vy: 0 }, high, state)).toBe(false);
    expect(harmlessFromBelow(before, { ...after, vy: 50 }, high, state)).toBe(false);
    expect(harmlessFromBelow({ ...before, y: 130.5 }, after, high, state)).toBe(false); // hurtbox top at y = 99.5, already above its underside
  });

  it('applies only to the cactus buddy, not to other enemies in the same place', () => {
    const { before, after } = rising(131.5, -400);
    expect(harmlessFromBelow(before, after, { ...high, kind: 'zopilote' }, state)).toBe(false);
    expect(harmlessFromBelow(before, after, { x: high.x, y: high.y }, state)).toBe(false);
  });

  it('costs nothing in the step: he passes up through it in Base', () => {
    const r = run(withPlayer({ ...spawn(100, 131.5), vy: -400, grounded: false, jumpWasHeld: true }, {}, highLevel), 1, highLevel, { move: 0, jumpHeld: true });
    expect(r.phase).toBe('playing');
    expect(r.lives.lives).toBe(LIVES_MAX);
    expect(r.invulnerable).toBe(0);
  });

  it('but the next step he is inside it and, now above its underside, falls under the usual hit', () => {
    let r = withPlayer({ ...spawn(100, 131.5), vy: -400, grounded: false, jumpWasHeld: true }, {}, highLevel);
    r = run(r, 4, highLevel, { move: 0, jumpHeld: true });
    expect(r.phase).not.toBe('playing'); // his head went on up into the cactus: that is a hit, not a free pass
  });
});

describe('GDD-CMB-02 and GDD-PWR-03 the claw passes through it and a fireball is used up', () => {
  it('a claw swing that reaches it does not defeat it, and is no hit', () => {
    const swing = { phase: 'swing', steps: 1, cooldown: 10, dir: 1, held: true } as const; // reaches x 90 to 110
    const r = run(withPlayer({ ...spawn(84, 160), facing: 1, grounded: true }, { claw: swing }), 1);
    expect(r.enemies[0]!.alive).toBe(true);
    expect(r.lives.lives).toBe(LIVES_MAX);
  });

  it('a fireball that hits it is used up and does not defeat it', () => {
    const fb: Fireball = { x: 80, y: 152, vx: 180, vy: 0, age: 0 };
    let r = withPlayer(spawn(24, 160), { fireballs: [fb] });
    r = run(r, 8);
    expect(r.enemies[0]!.alive).toBe(true);
    expect(r.fireballs).toEqual([]);
  });
});

describe('GDD-LIFE-02 the cactus buddy after a life is lost', () => {
  it('is simply there, alive', () => {
    expect(freshEnemies([floor])).toEqual([{ x: 100, dir: 1, alive: true }]);
  });
});
