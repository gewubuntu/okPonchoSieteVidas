import { describe, expect, it } from 'vitest';
import { HIT, LIVES_MAX, RESPAWN } from '../config/tuning';
import { boxHitsEnemy, enemyBox, freshEnemies, isStomp, stepEnemy, touchesEnemy, type Enemy, type EnemyState } from './enemy';
import type { Fireball } from './fireball';
import { spawn, type PlayerInput, type PlayerState } from './movement';
import { startRun, stepRun, type Level, type RunState } from './run';
import type { Power } from './taco';
import { parseTiles } from './tilemap';

const idle: PlayerInput = { move: 0, jumpHeld: false };

// Floor at row 10 (top y = 160) with a wall in column 12 (x 192 to 208, y 128 to 160). The Zopilote cruises at y = 100 from
// x = 160, so it flies 112 to 208 either side. Poncho standing on the floor has his hurtbox centred at y = 153, 53 px below it.
const rows = Array.from({ length: 12 }, (_, r) => {
  if (r >= 10) return '#'.repeat(20);
  if (r >= 8) return '............#.......';
  return '.'.repeat(20);
});
const world = parseTiles(rows);
const def: Enemy = { x: 160, y: 100, kind: 'zopilote' };
const level: Level = { world, spawn: { x: 24, y: 160 }, ofrendas: [], spikes: [], crumbles: [], springs: [], platforms: [], tacos: [], pinatas: [], doors: [], keys: [], fragiles: [], enemies: [def] };
const standing = (x: number, y = 160): PlayerState => ({ ...spawn(x, y), grounded: true });
/** Poncho high above everything, so nothing is below the Zopilote to spot. */
const away = standing(24, 40);
const fresh = (): EnemyState => freshEnemies([def])[0]!;
const flight = (s: EnemyState) => s.flight!;
const walk = (s: EnemyState, steps: number, p: PlayerState = away): EnemyState => {
  for (let i = 0; i < steps; i++) s = stepEnemy(def, s, world, p);
  return s;
};
/** Steps until it is in `phase` (at most 600 steps), returning the steps taken and the state. */
const until = (s: EnemyState, phase: string, p: PlayerState = away): { steps: number; s: EnemyState } => {
  let steps = 0;
  while (flight(s).phase !== phase && steps < 600) {
    s = stepEnemy(def, s, world, p);
    steps++;
  }
  return { steps, s };
};
const spotted = (p: PlayerState): boolean => flight(walk(fresh(), 1, p)).phase === 'telegraph';
const start = (p: PlayerState) => until(fresh(), 'telegraph', p).s;
const withPlayer = (player: PlayerState, extra: Partial<RunState> = {}): RunState => ({ ...startRun(level), player, ...extra });
const touching = (power: Power): RunState => withPlayer({ ...spawn(150, 107), grounded: false }, { power });
const run = (r: RunState, input: PlayerInput, steps: number): RunState => {
  for (let i = 0; i < steps; i++) r = stepRun(r, input, level);
  return r;
};

describe('GDD-ENM-02 the Zopilote cruises', () => {
  it('starts alive at its place, heading right, cruising on its line', () => {
    expect(fresh()).toEqual({ x: 160, dir: 1, alive: true, flight: { y: 100, phase: 'cruise', age: 0, aimX: 0, aimY: 0 } });
  });

  it('flies at 40 px/s, two thirds of a pixel a step', () => {
    expect(walk(fresh(), 30).x).toBeCloseTo(160 + 40 * 0.5, 9);
  });

  it('turns round 48 px from its start and flies back and forth between 112 and 208', () => {
    let s = fresh();
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < 600; i++) {
      s = walk(s, 1);
      min = Math.min(min, s.x);
      max = Math.max(max, s.x);
    }
    expect(min).toBe(112);
    expect(max).toBe(208);
    expect(walk(fresh(), 72).dir).toBe(-1); // 48 px at 2/3 px a step is 72 steps
    expect(walk(fresh(), 71).dir).toBe(1);
  });

  it('bobs on a sine 12 px high with a period of 2.5 s (150 steps)', () => {
    const at = (n: number) => flight(walk(fresh(), n)).y;
    expect(at(37.5 | 0)).toBeCloseTo(100 + 12 * Math.sin((2 * Math.PI * 37) / 150), 9);
    expect(at(38)).toBeCloseTo(100 + 12 * Math.sin((2 * Math.PI * 38) / 150), 9);
    expect(at(75)).toBeCloseTo(100, 9);
    expect(at(113)).toBeCloseTo(100 - 12 * Math.sin((2 * Math.PI * 37) / 150), 9);
    expect(at(150)).toBeCloseTo(100, 9);
    let s = fresh();
    for (let i = 0; i < 300; i++) {
      s = walk(s, 1);
      expect(Math.abs(flight(s).y - 100)).toBeLessThanOrEqual(12);
    }
  });

  it('a defeated one stays where it is', () => {
    const dead = { ...fresh(), alive: false };
    expect(stepEnemy(def, dead, world, standing(160))).toBe(dead);
  });

  it('is a 16 x 10 box centred on its position', () => {
    expect(enemyBox(def, fresh())).toEqual({ x0: 152, x1: 168, y0: 95, y1: 105 });
  });
});

describe('GDD-ENM-02 the Zopilote spots Poncho', () => {
  // After one step it is at x = 160.67 and y = 100 + 12 sin(2 pi / 150). Poncho's hurtbox centre is 7 px above his feet.
  const x1 = 160 + 40 / 60;
  const y1 = 100 + 12 * Math.sin((2 * Math.PI) / 150);

  it('when he is within 96 px to either side and up to 80 px below it', () => {
    expect(spotted(standing(x1 + 96, y1 + 7 + 50))).toBe(true);
    expect(spotted(standing(x1 - 96, y1 + 7 + 50))).toBe(true);
    expect(spotted(standing(x1 + 96.5, y1 + 7 + 50))).toBe(false);
    expect(spotted(standing(x1 - 96.5, y1 + 7 + 50))).toBe(false);
    expect(spotted(standing(x1, y1 + 7 + 80))).toBe(true);
    expect(spotted(standing(x1, y1 + 7 + 80.5))).toBe(false);
  });

  it('not when he is level with it or above it', () => {
    expect(spotted(standing(x1, y1 + 7))).toBe(false);
    expect(spotted(standing(x1, y1 + 7 - 20))).toBe(false);
  });
});

describe('GDD-ENM-01 the Zopilote telegraphs for 0.5 s before it dives', () => {
  const below = standing(160);

  it('freezes for exactly 30 steps, then dives', () => {
    const trigger = until(fresh(), 'telegraph', below);
    expect(trigger.steps).toBeLessThan(5);
    const frozen = trigger.s;
    const { steps, s } = until(frozen, 'dive', below);
    expect(steps).toBe(30);
    expect([s.x, flight(s).y]).toEqual([frozen.x, flight(frozen).y]); // it has not moved
    expect(walk(s, 1, below).x).not.toBe(s.x); // the next step it does
  });
});

describe('GDD-ENM-02 the Zopilote dives and climbs back', () => {
  it('aims at where Poncho was when the telegraph ended, not where he was when it began', () => {
    let s = start(standing(160));
    for (let i = 0; i < 30; i++) s = stepEnemy(def, s, world, standing(150 + i)); // he walks on
    expect(flight(s)).toMatchObject({ phase: 'dive', aimX: 150 + 29, aimY: 160 - 7 });
  });

  it('flies straight at the aim point at 150 px/s, 2.5 px a step, and does not follow him on', () => {
    let s = start(standing(160));
    s = until(s, 'dive', standing(160)).s;
    const { x, y } = { x: s.x, y: flight(s).y };
    const dist = Math.hypot(160 - x, 153 - y);
    s = stepEnemy(def, s, world, away); // he has moved away
    expect(Math.hypot(s.x - x, flight(s).y - y)).toBeCloseTo(2.5, 9);
    expect((160 - x) * (flight(s).y - y)).toBeCloseTo((153 - y) * (s.x - x), 9); // along the line to (160, 153)
    const { steps, s: end } = until(s, 'return', away);
    expect(steps).toBe(Math.ceil(dist / 2.5) - 1);
    expect([end.x, flight(end).y]).toEqual([160, 153]);
  });

  it('then climbs back to its cruise line at 60 px/s, 1 px a step, and cruises again', () => {
    let s = until(start(standing(160)), 'return', standing(160)).s;
    expect(flight(s).y).toBe(153);
    s = stepEnemy(def, s, world, away);
    expect(flight(s).y).toBe(152);
    const { steps, s: back } = until(s, 'cruise', away);
    expect(steps).toBe(52); // 52 px from 152 up to 100
    expect(flight(back)).toMatchObject({ y: 100, age: 0 });
  });

  it('flies through walls: tiles do not stop it', () => {
    const p = standing(200); // right under the wall tile at column 12 (x 192 to 208), at y 128 to 160
    let s = start(p);
    s = until(s, 'return', p).s;
    expect([s.x, flight(s).y]).toEqual([200, 153]); // inside the wall tile row, which it reached
  });
});

describe('GDD-CMB-01 the Zopilote cannot be stomped', () => {
  it('landing on it is not a stomp', () => {
    const above: PlayerState = { ...spawn(160, 100), vy: 100, grounded: false };
    const before = { ...above, y: 90 }; // feet well above its top, so the Alacrán's stomp rule would count this landing
    expect(touchesEnemy(above, def, fresh())).toBe(true);
    expect(isStomp(before, above, def, fresh())).toBe(false);
  });

  it('so landing on it is a hit and it stays alive', () => {
    let r = withPlayer({ ...spawn(160, 94), vy: 300, grounded: false });
    r = run(r, idle, 3);
    expect(r.enemies[0]!.alive).toBe(true);
    expect(r.phase).not.toBe('playing');
    expect(r.lives.lives).toBe(LIVES_MAX - 1);
  });
});

describe('GDD-CMB-03 a Zopilote hit', () => {
  it('spends the taco in Taco, with 2.0 s of invulnerability and a push away from it', () => {
    const r = run(touching('taco'), idle, 1);
    expect(r).toMatchObject({ power: 'base', phase: 'playing', invulnerable: HIT.invulnerableSteps });
    expect(r.lives.lives).toBe(LIVES_MAX);
    expect(r.player.vx).toBe(-HIT.knockback); // it is to his right
  });
});

describe('GDD-CMB-02 and GDD-PWR-03 the claw and a fireball defeat it', () => {
  it('a claw swing that reaches it defeats it', () => {
    // It hovers at y 95 to 105; Poncho stands on a tall step so the claw box (14 tall from his feet) reaches it.
    const swing = { phase: 'swing', steps: 1, cooldown: 10, dir: 1, held: true } as const;
    const r = run(withPlayer({ ...spawn(142, 108), facing: 1, grounded: true }, { claw: swing }), idle, 1);
    expect(r.enemies[0]!.alive).toBe(false);
    expect(r.lives.lives).toBe(LIVES_MAX);
  });

  it('a swing that falls short does nothing', () => {
    const swing = { phase: 'swing', steps: 1, cooldown: 10, dir: 1, held: true } as const;
    const r = run(withPlayer({ ...spawn(142, 140), facing: 1, grounded: true }, { claw: swing }), idle, 1);
    expect(r.enemies[0]!.alive).toBe(true);
  });

  it('a fireball that hits it defeats it and is used up', () => {
    const fb: Fireball = { x: 140, y: 102, vx: 180, vy: 0, age: 0 };
    let r = withPlayer(standing(24), { fireballs: [fb] });
    r = run(r, idle, 8);
    expect(r.enemies[0]!.alive).toBe(false);
    expect(r.fireballs).toEqual([]);
  });
});

describe('GDD-LIFE-02 the Zopilote after a life is lost', () => {
  it('is back on its cruise line at its start', () => {
    const pit: Level = { ...level, world: parseTiles(['....', '....']) };
    let r: RunState = { ...startRun(pit), player: spawn(24, 200), enemies: [{ x: 200, dir: -1, alive: false, flight: { y: 140, phase: 'dive', age: 9, aimX: 1, aimY: 2 } }] };
    for (let i = 0; i < 1 + RESPAWN.delaySteps; i++) r = stepRun(r, idle, i === 0 ? pit : { ...pit, world: level.world, spawn: level.spawn });
    expect(r.enemies).toEqual(freshEnemies([def]));
  });
});

describe('GDD-ENM-02 the Zopilote box follows its flight', () => {
  it('a box hits it where it is flying, not on its cruise line', () => {
    expect(boxHitsEnemy({ x0: 150, x1: 170, y0: 90, y1: 110 }, def, fresh())).toBe(true);
    expect(boxHitsEnemy({ x0: 150, x1: 170, y0: 106, y1: 120 }, def, fresh())).toBe(false);
  });
});
