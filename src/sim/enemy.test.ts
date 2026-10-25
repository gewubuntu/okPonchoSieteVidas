import { describe, expect, it } from 'vitest';
import { ENEMY, HIT, LIVES_MAX, RESPAWN, STEP, STOMP } from '../config/tuning';
import { boxHitsEnemy, freshEnemies, isStomp, stepEnemy, touchesEnemy, type Enemy, type EnemyState } from './enemy';
import type { Fireball } from './fireball';
import { spawn, type PlayerInput, type PlayerState } from './movement';
import { startRun, stepRun, type Level, type RunState } from './run';
import type { Power } from './taco';
import { parseTiles } from './tilemap';

const idle: PlayerInput = { move: 0, jumpHeld: false };
const right: PlayerInput = { move: 1, jumpHeld: false };

// Ground at row 8 (top y = 128, 16 px wide tiles). A platform in row 5, columns 4 to 8 (x 64 to 144, top y = 80). The
// Alacrán stands on it in the middle (x = 104) heading right: a 14 x 10 box, so y 70 to 80.
const rows = Array.from({ length: 10 }, (_, r) => {
  if (r === 5) return '....#####...........';
  if (r >= 8) return '#'.repeat(20);
  return '.'.repeat(20);
});
const world = parseTiles(rows);
const def: Enemy = { x: 104, y: 80 };
const baseLevel: Level = {
  world,
  spawn: { x: 24, y: 128 },
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
  enemies: [def],
};
/** Poncho well out of any enemy's way, for tests that only watch the enemy. */
const far = spawn(24, 128);
const alive = (x: number, dir: 1 | -1 = 1): EnemyState => ({ x, dir, alive: true });
const at = (x: number, y: number, vy = 0): PlayerState => ({ ...spawn(x, y), vy, grounded: false });
const run = (r: RunState, input: PlayerInput, steps: number, l: Level = baseLevel): RunState => {
  for (let i = 0; i < steps; i++) r = stepRun(r, input, l);
  return r;
};
const withPlayer = (player: PlayerState, extra: Partial<RunState> = {}, l: Level = baseLevel): RunState => ({ ...startRun(l), player, ...extra });

/** Walks until it turns round (or 200 steps), returning where it was when it did. */
const walkToTurn = (state: EnemyState, w = world): EnemyState => {
  const dir = state.dir;
  for (let i = 0; i < 200 && state.dir === dir; i++) state = stepEnemy(def, state, w, far);
  return state;
};
const walk = (state: EnemyState, steps: number, w = world): EnemyState => {
  for (let i = 0; i < steps; i++) state = stepEnemy(def, state, w, far);
  return state;
};

describe('GDD-ENM-02 the Alacrán patrols', () => {
  it('starts alive, in the middle of its platform, heading right', () => {
    expect(freshEnemies([def])).toEqual([{ x: 104, dir: 1, alive: true }]);
    expect([ENEMY.width, ENEMY.height]).toEqual([14, 10]);
  });

  it('walks at 30 px/s, half a pixel a step', () => {
    expect(walk(alive(104), 20).x).toBeCloseTo(104 + 30 * 20 * STEP, 9);
  });

  it('turns round at the right end of its platform, with its leading edge still over the ground', () => {
    // The platform ends at x = 144, so the middle can go as far as 137 (leading edge at 144).
    const end = walkToTurn(alive(104));
    expect(end.x).toBe(137);
    expect(end.dir).toBe(-1);
  });

  it('turns round at the left end too, and patrols back and forth without ever leaving the platform', () => {
    let state = alive(104);
    let leftEnd = Infinity;
    let rightEnd = -Infinity;
    for (let i = 0; i < 600; i++) {
      state = stepEnemy(def, state, world, far);
      leftEnd = Math.min(leftEnd, state.x);
      rightEnd = Math.max(rightEnd, state.x);
    }
    expect(leftEnd).toBe(71);
    expect(rightEnd).toBe(137);
  });

  it('turns round at a wall, flush against it', () => {
    const blocked = parseTiles(rows.map((row, r) => (r === 4 ? row.slice(0, 7) + '#' + row.slice(8) : row))); // a wall in column 7 (x 112 to 128), row 4 (y 64 to 80)
    const state = walkToTurn(alive(104), blocked);
    expect(state.x).toBe(112 - 7);
    expect(state.dir).toBe(-1);
  });

  it('a defeated one stays where it is', () => {
    const dead: EnemyState = { x: 120, dir: 1, alive: false };
    expect(stepEnemy(def, dead, world, far)).toBe(dead);
  });
});

describe('GDD-ENM-02 touching an Alacrán', () => {
  const s = alive(104); // box x 97 to 111, y 70 to 80
  it('is the hurtbox (10 x 30) against its box: edges that only meet do not touch', () => {
    expect(touchesEnemy(at(92, 80), def, s)).toBe(false); // hurtbox right edge 97
    expect(touchesEnemy(at(92.01, 80), def, s)).toBe(true);
    expect(touchesEnemy(at(115.99, 80), def, s)).toBe(true);
    expect(touchesEnemy(at(116, 80), def, s)).toBe(false);
    expect(touchesEnemy(at(104, 71), def, s)).toBe(false); // hurtbox bottom (feet - 1) = 70, its top
    expect(touchesEnemy(at(104, 71.01), def, s)).toBe(true);
    expect(touchesEnemy(at(104, 110.99), def, s)).toBe(true);
    expect(touchesEnemy(at(104, 111), def, s)).toBe(false); // hurtbox top (feet - 31) = 80, its bottom
  });
  it('a defeated one is not touched, and boxes that only share an edge do not hit it', () => {
    expect(touchesEnemy(at(104, 80), def, { ...s, alive: false })).toBe(false);
    expect(boxHitsEnemy({ x0: 111, x1: 131, y0: 70, y1: 80 }, def, s)).toBe(false);
    expect(boxHitsEnemy({ x0: 110.99, x1: 131, y0: 70, y1: 80 }, def, s)).toBe(true);
  });
});

describe('GDD-CMB-01 stomp', () => {
  const s = alive(104);
  it('counts when he is falling onto it and his feet were at most 4 px below its top a step ago', () => {
    expect(isStomp(at(104, 74), at(104, 76, 100), def, s)).toBe(true); // top is y = 70
    expect(isStomp(at(104, 74.01), at(104, 76, 100), def, s)).toBe(false);
    expect(STOMP.tolerance).toBe(4);
  });
  it('not when he is rising, or not over it', () => {
    expect(isStomp(at(104, 74), at(104, 76, -50), def, s)).toBe(false);
    expect(isStomp(at(104, 74), at(104, 76, 0), def, s)).toBe(false);
    expect(isStomp(at(80, 74), at(80, 76, 100), def, s)).toBe(false);
  });
  it('not on one that is already defeated', () => {
    expect(isStomp(at(104, 74), at(104, 76, 100), def, { ...s, alive: false })).toBe(false);
  });

  /** Falls onto the Alacrán from above, with the given input each step, until it is defeated; returns that state. */
  const land = (input: PlayerInput, jumpBuffer = 0, wasHeld = false): RunState => {
    let r = withPlayer({ ...at(104, 62, 150), jumpBuffer, jumpWasHeld: wasHeld }, { enemies: [alive(104)] });
    for (let i = 0; i < 20 && r.enemies[0]!.alive; i++) r = stepRun(r, input, baseLevel);
    return r;
  };
  it('defeats it and bounces Poncho up at 260 px/s', () => {
    const r = land(idle);
    expect(r.enemies[0]!.alive).toBe(false);
    expect(r.player.vy).toBe(-260);
    expect(r.player.grounded).toBe(false);
    expect(r).toMatchObject({ phase: 'playing', power: 'base' });
    expect(r.lives.lives).toBe(LIVES_MAX);
    expect(r.invulnerable).toBe(0); // a stomp is not a hit
  });
  it('bounces at 410 px/s, the jump velocity, when jump is held (held since before, so no new press)', () => {
    expect(land({ move: 0, jumpHeld: true }, 0, true).player.vy).toBe(-410);
  });
  it('bounces at 410 px/s when jump was pressed in the 0.1 s before (the buffer)', () => {
    expect(land(idle, 4).player.vy).toBe(-410);
  });
  it('an expired buffer gives the 260 bounce', () => {
    expect(land(idle, 0).player.vy).toBe(-260);
  });
  it('works while invulnerable', () => {
    let r = withPlayer(at(104, 62, 150), { enemies: [alive(104)], invulnerable: 100 });
    for (let i = 0; i < 20 && r.enemies[0]!.alive; i++) r = stepRun(r, idle, baseLevel);
    expect(r.enemies[0]!.alive).toBe(false);
  });
});

/** Poncho standing on the platform beside it, walking into it. */
const beside = (power: Power, extra: Partial<RunState> = {}): RunState => withPlayer({ ...spawn(84, 80), facing: 1 }, { power, enemies: [alive(104, -1)], ...extra });
/** Walks into it until something happens: a life is lost, or at most 40 steps. */
const bump = (r: RunState): RunState => {
  for (let i = 0; i < 40 && r.phase === 'playing'; i++) r = stepRun(r, right, baseLevel);
  return r;
};

/** Stomps the Alacrán from above with the given player fields and returns Poncho afterwards. */
const stomp = (player: Partial<PlayerState>): PlayerState => {
  let r = withPlayer({ ...at(104, 62, 150), ...player }, { enemies: [alive(104)] });
  for (let i = 0; i < 20 && r.enemies[0]!.alive; i++) r = stepRun(r, idle, baseLevel);
  expect(r.enemies[0]!.alive).toBe(false);
  return r.player;
};

describe('GDD-CMB-01 stomp details', () => {
  it('two enemies stomped in one step give one bounce, and both are defeated', () => {
    const two: Level = { ...baseLevel, enemies: [def, { x: 106, y: 80 }] };
    let r: RunState = { ...startRun(two), player: at(105, 62, 150), enemies: [alive(104), alive(106)] };
    for (let i = 0; i < 20 && r.enemies.every((e) => e.alive); i++) r = stepRun(r, idle, two);
    expect(r.enemies.map((e) => e.alive)).toEqual([false, false]);
    expect(r.player.vy).toBe(-260);
  });

  it('releasing jump after the bounce cuts the rise short, like any jump', () => {
    let r = withPlayer({ ...at(104, 62, 150), jumpWasHeld: true }, { enemies: [alive(104)] });
    for (let i = 0; i < 20 && r.enemies[0]!.alive; i++) r = stepRun(r, { move: 0, jumpHeld: true }, baseLevel);
    expect(r.player.vy).toBe(-410);
    r = stepRun(r, idle, baseLevel); // jump let go while rising
    expect(r.player.vy).toBeGreaterThan(-410 * 0.5);
  });

  it('uses up the coyote time and the jump buffer, so one stomp cannot become a second jump', () => {
    expect(stomp({ coyote: 5 }).coyote).toBe(0);
    expect(stomp({ jumpBuffer: 5 }).jumpBuffer).toBe(0);
  });
});

describe('GDD-CMB-03 and GDD-ENM-01 an Alacrán hit', () => {
  it('costs a life in Base, like any hit, and the enemy stays', () => {
    const r = bump(beside('base'));
    expect(r.phase).toBe('respawning'); // held input skips the wait, so it is read right at the hit
    expect(r.lives.lives).toBe(LIVES_MAX - 1);
    expect(r.enemies[0]!.alive).toBe(true);
  });

  it('spends the taco in Taco instead, with 2.0 s invulnerability and a push away from it', () => {
    let r = beside('taco');
    for (let i = 0; i < 40 && r.power === 'taco'; i++) r = stepRun(r, right, baseLevel);
    expect(r).toMatchObject({ power: 'base', phase: 'playing', invulnerable: HIT.invulnerableSteps });
    expect(r.lives.lives).toBe(LIVES_MAX);
    expect(r.player.vx).toBe(-HIT.knockback); // the Alacrán is to his right
  });

  it('goes back to Taco in Fuego', () => {
    let r = beside('fuego');
    for (let i = 0; i < 40 && r.power === 'fuego'; i++) r = stepRun(r, right, baseLevel);
    expect(r.power).toBe('taco');
  });

  it('is pushed to the right when the Alacrán is on his left', () => {
    let r = withPlayer({ ...spawn(124, 80), facing: -1 }, { power: 'taco', enemies: [alive(104, 1)] });
    for (let i = 0; i < 40 && r.power === 'taco'; i++) r = stepRun(r, { move: -1, jumpHeld: false }, baseLevel);
    expect(r.player.vx).toBe(HIT.knockback);
  });

  it('does not hurt while Poncho is invulnerable, or once it is defeated', () => {
    expect(bump(beside('base', { invulnerable: 600 })).phase).toBe('playing');
    expect(bump(beside('base', { enemies: [{ x: 104, dir: -1, alive: false }] })).phase).toBe('playing');
  });

  it('a hit from the side, not from above: standing on the same platform is not a stomp', () => {
    const r = bump(beside('taco'));
    expect(r.enemies[0]!.alive).toBe(true);
  });
});

describe('GDD-CMB-02 and GDD-CMB-03 a hit during a claw swing', () => {
  it('ends the swing but not its cooldown', () => {
    // Facing left with the swing going away from the Alacrán on his right, so only the hit can end it.
    const swinging = { phase: 'swing', steps: 1, cooldown: 10, dir: -1, held: false } as const;
    const r = stepRun(beside('taco', { claw: swinging, player: { ...spawn(95, 80), facing: -1, grounded: true } }), idle, baseLevel);
    expect(r.power).toBe('base');
    expect(r.enemies[0]!.alive).toBe(true);
    expect(r.claw.phase).toBe('idle');
    expect(r.claw.steps).toBe(0);
    expect(r.claw.cooldown).toBe(9);
  });
});

describe('GDD-CMB-03 a spike and an Alacrán touching him in one step', () => {
  it('is one hit, pushed away from the spike', () => {
    // The spike is the tile right of him (column 6, x 96 to 112) and the Alacrán is to his left, both touching.
    const level: Level = { ...baseLevel, spikes: [{ col: 6, row: 4 }] };
    const r = stepRun({ ...startRun(level), power: 'fuego', player: { ...spawn(100, 80), facing: 1 }, enemies: [alive(96, 1)] }, idle, level);
    expect(r.power).toBe('taco'); // one level down, not two
    expect(r.player.vx).toBe(-HIT.knockback); // the spike's middle (104) is to his right
  });
});

const fireballAt = (x: number): Fireball => ({ x, y: 78, vx: 180, vy: 0, age: 0 }); // box y 72 to 78, level with the Alacrán

describe('GDD-CMB-02 and GDD-PWR-03 the claw and a fireball defeat it', () => {
  it('a claw swing that reaches it defeats it, with no hit', () => {
    let r = withPlayer({ ...spawn(84, 80), facing: 1, grounded: true }, { enemies: [alive(104)] }); // the claw reaches x 90 to 110
    r = stepRun(r, { move: 0, jumpHeld: false, claw: true }, baseLevel);
    r = run(r, idle, 2);
    expect(r.enemies[0]!.alive).toBe(false);
    expect(r).toMatchObject({ phase: 'playing', power: 'base' });
    expect(r.lives.lives).toBe(LIVES_MAX);
  });

  it('a swing that falls short does nothing', () => {
    let r = withPlayer({ ...spawn(70, 80), facing: 1, grounded: true }, { enemies: [alive(120)] }); // reaches x 76 to 96, the enemy starts at 113
    r = stepRun(r, { move: 0, jumpHeld: false, claw: true }, baseLevel);
    r = run(r, idle, 3);
    expect(r.enemies[0]!.alive).toBe(true);
  });

  it('a fireball that hits it defeats it and is used up', () => {
    const fb: Fireball = { x: 90, y: 78, vx: 180, vy: 0, age: 0 }; // box y 72 to 78, level with the Alacrán
    let r = withPlayer(spawn(24, 128), { enemies: [alive(104)], fireballs: [fb] });
    for (let i = 0; i < 12 && r.enemies[0]!.alive; i++) r = stepRun(r, idle, baseLevel);
    expect(r.enemies[0]!.alive).toBe(false);
    expect(r.fireballs).toEqual([]);
  });

  it('every fireball that overlaps it is used up, even when something else defeats it that step', () => {
    const two = withPlayer(spawn(24, 128), { enemies: [alive(104)], fireballs: [fireballAt(95), fireballAt(96)] });
    expect(stepRun(two, idle, baseLevel).fireballs).toEqual([]); // two on one enemy
    const swing = { phase: 'swing', steps: 1, cooldown: 10, dir: 1, held: true } as const; // reaches x 90 to 110
    const clawed = stepRun(withPlayer({ ...spawn(84, 80), facing: 1, grounded: true }, { enemies: [alive(104)], fireballs: [fireballAt(98)], claw: swing }), idle, baseLevel);
    expect(clawed.enemies[0]!.alive).toBe(false); // the swing defeats it, and the fireball over it is spent on it all the same
    expect(clawed.fireballs).toEqual([]);
  });

  it('a fireball that passes over it hits nothing and keeps flying', () => {
    const fb: Fireball = { x: 90, y: 60, vx: 180, vy: 0, age: 0 }; // box y 54 to 60, above its top at 70
    let r = withPlayer(spawn(24, 128), { enemies: [alive(104)], fireballs: [fb] });
    r = run(r, idle, 6);
    expect(r.enemies[0]!.alive).toBe(true);
    expect(r.fireballs).toHaveLength(1);
  });
});

describe('GDD-LIFE-02 enemies after a life is lost', () => {
  it('are all alive and back at their start', () => {
    const pit: Level = { ...baseLevel, world: parseTiles(['....', '....']), enemies: [{ x: 8, y: 16 }] };
    let r: RunState = { ...startRun(pit), player: spawn(24, 200), enemies: [{ x: 30, dir: -1, alive: false }] };
    r = run(r, idle, 1 + RESPAWN.delaySteps, { ...pit, world: baseLevel.world, spawn: baseLevel.spawn });
    expect(r.enemies).toEqual([{ x: 8, dir: 1, alive: true }]);
  });
});
