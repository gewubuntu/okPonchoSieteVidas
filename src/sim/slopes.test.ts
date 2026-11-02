import { describe, expect, it } from 'vitest';
import { TACO } from '../config/tuning';
import { BOUNCE_SPEED, stepFireball, type Fireball } from './fireball';
import { enemyBox, freshEnemies, stepEnemy, type Enemy, type EnemyState } from './enemy';
import { stepItem, type Item } from './item';
import { spawn, step, type Abilities, type PlayerInput, type PlayerState, type World } from './movement';
import { startRun, stepRun, type Level } from './run';
import { surfaceY } from './slope';
import { parseTiles, SLOPE_CHARS, type SlopeChar, type TileGrid } from './tilemap';

// RAMP: floor row 4 (y = 64); a 45-degree ramp two tiles high: `/` at (4,3) from y 64 at x 64 to y 48 at x 80, `/` at (5,2) to y 32 at
// x 96, then a top at y = 32 to the right edge (x = 192). Surface from the rule: y = 64 for x <= 64, 128 - x for 64..96, 32 after.
const RAMP = parseTiles(['............', '............', '...../######', '..../#######', '############']);
// DUNE: floor row 4 (y = 64); `r` (2,3) 64 to 56 over x 32..48, `R` (3,3) 56 to 48 over 48..64, top 48 over 64..96, `F` (6,3) 48 to 56 over
// 96..112, `f` (7,3) 56 to 64 over 112..128. Level 160 px wide.
const DUNE = parseTiles(['..........', '..........', '..........', '..rR##Ff..', '##########']);
// CLIFF: a `/` at (4,3) whose high end (x = 80, y = 48) meets no ground: the floor (row 4) ends at x = 80, a pit after it.
const CLIFF = parseTiles(['..........', '..........', '..........', '..../.....', '#####.....']);
// FACE: a `\` at (3,3) whose high side (x = 48, y 48 to 64) faces the floor to its left (floor row 4, y = 64).
const FACE = parseTiles(['........', '........', '........', '...\\....', '########']);
// WALL_TOP: a `/` at (2,4) (y = 112 - x over x 32..48) rising into a wall 3 tiles high at column 3 (x = 48); floor row 5 (y = 80).
const WALL_TOP = parseTiles(['........', '........', '...#....', '...#....', '../#....', '########']);
// WALL_FOOT: `#\#` on row 4 with nothing above it: a `\` at (3,4) (y = 16 + x over x 48..64) running down into a wall one tile high at
// column 4 (x = 64, top y = 64). One tile, not two, so only the box's lowered bottom edge (6 px on 45 degrees) decides whether it is met.
const WALL_FOOT = parseTiles(['........', '........', '........', '........', '..#\\#...', '########']);
// WALL_FOOT_GENTLE: the same with an `F` at (3,4) (y = 40 + x / 2 over x 48..64), whose foot is 8 px below the wall's top (3 px sink).
const WALL_FOOT_GENTLE = parseTiles(['........', '........', '........', '........', '..#F#...', '########']);
// VALLEY: floor row 2 (y = 32); a level tile at (1,1) (top y = 16), a `\` at (2,1) (y = x - 16 over x 32..48), a `/` at (3,1)
// (y = 80 - x over x 48..64), a level tile at (4,1) (top 16), then a pit beyond x = 80 on row 1's level (the floor goes on at y = 32).
const VALLEY = parseTiles(['........', '.#\\/#...', '########']);
// CEILING: a 45-degree ramp 4 tiles high, `/` at (4,13) (5,12) (6,11) (7,10), surface y = 288 - x for x 64..128, top y = 160 after;
// a ceiling on row 8 (underside y = 144) over columns 5 to 12; floor row 14 (y = 224).
const CEILING_ROWS = [
  ...Array.from({ length: 8 }, () => '................'),
  '.....########...',
  '................',
  '......./########',
  '....../#########',
  '...../##########',
  '..../###########',
  '################',
  '################',
  '################',
];
const CEILING = parseTiles(CEILING_ROWS);
// CEILING_LOW: the same ramp with the ceiling one row lower, on row 9 (underside y = 160), for the 12 px taco.
const CEILING_LOW = parseTiles(CEILING_ROWS.map((r, i) => (i === 8 ? '................' : i === 9 ? '.....########...' : r)));
const FLAT = parseTiles(['............', '............', '............', '............', '############']);

const rampY = (x: number) => (x <= 64 ? 64 : x < 96 ? 128 - x : 32);
const duneY = (x: number) => (x <= 32 ? 64 : x < 64 ? 64 - (x - 32) / 2 : x <= 96 ? 48 : x < 128 ? 48 + (x - 96) / 2 : 64);
const valleyY = (x: number) => (x <= 32 ? 16 : x < 48 ? x - 16 : x < 64 ? 80 - x : 16);

const idle: PlayerInput = { move: 0, jumpHeld: false };
const right: PlayerInput = { move: 1, jumpHeld: false };
const left: PlayerInput = { move: -1, jumpHeld: false };

/** Steps `s` while `going` says so (at most `max` steps) and returns every state, the start included. */
function play(s: PlayerState, input: (i: number, s: PlayerState) => PlayerInput, world: World, steps: number, abilities?: Abilities): PlayerState[] {
  const states = [s];
  for (let i = 0; i < steps; i++) {
    s = step(s, input(i, s), world, abilities);
    states.push(s);
  }
  return states;
}

/** Holds `input` until `done` says so (at most `max` steps). Returns every state, the start included. */
function until(s: PlayerState, input: PlayerInput, world: World, done: (s: PlayerState) => boolean, max: number): PlayerState[] {
  const states = [s];
  for (let i = 0; i < max && !done(s); i++) {
    s = step(s, input, world);
    states.push(s);
  }
  return states;
}

/** From a state, `after` steps holding right, jump held on the last only (a press); the state after the last. */
function pressAfter(from: PlayerState, world: World, after: number): PlayerState {
  let s = from;
  for (let i = 1; i <= after; i++) s = step(s, { move: 1, jumpHeld: i === after }, world);
  return s;
}

/** The first state not grounded, running right from x = 24 on the floor (y = 64). */
const offTheEnd = (world: World): PlayerState => last(until(spawn(24, 64), right, world, (s) => !s.grounded, 100));

const taco = (x: number, y: number): Item => ({ x, y, vx: TACO.walkSpeed, vy: 0, kind: 'taco' });

const last = <T>(list: readonly T[]): T => list[list.length - 1]!;

/** Peak height above the takeoff y: the takeoff state first, then the steps until grounded again; `held` steps of jump held from the first. */
function peak(start: PlayerState, world: World, held: number, move: number): number {
  let s = start;
  const y0 = s.y;
  let top = y0;
  for (let i = 0; i < 200; i++) {
    s = step(s, { move, jumpHeld: i < held }, world);
    top = Math.min(top, s.y);
    if (s.grounded) break;
  }
  return y0 - top;
}

describe('GDD-MOV-09 slope tiles', () => {
  it('GDD-MOV-09 the six slope characters, their heights and what is not a slope', () => {
    const g = parseTiles(['/\\rRFf.#', '########']);
    const expected: [SlopeChar, number, number][] = [
      ['/', 0, 16],
      ['\\', 16, 0],
      ['r', 0, 8],
      ['R', 8, 16],
      ['F', 16, 8],
      ['f', 8, 0],
    ];
    expect([...SLOPE_CHARS]).toEqual(expected.map(([c]) => c));
    expected.forEach(([c, l, r], i) => {
      expect(g.slopeAt(i, 0), c).toBe(c);
      expect(g.solidTile(i, 0), c).toBe(false);
      expect(surfaceY(i, 0, c, 16 * i), `${c} left`).toBeCloseTo(16 - l, 9);
      expect(surfaceY(i, 0, c, 16 * i + 8), `${c} middle`).toBeCloseTo(16 - (l + r) / 2, 9);
      expect(surfaceY(i, 0, c, 16 * i + 16), `${c} right`).toBeCloseTo(16 - r, 9);
    });
    for (const [tx, ty] of [[6, 0], [7, 0], [0, 1], [-1, 0], [8, 0], [0, -1], [0, 2]] as const) expect(g.slopeAt(tx, ty), `${tx},${ty}`).toBeNull();
    expect(() => parseTiles(['.x'])).toThrow(/other than/);
  });
});

describe('GDD-MOV-09 standing on a slope', () => {
  it('GDD-MOV-09 standing on a slope the middle of his feet is on its surface and he does not slide', () => {
    let s = spawn(72, 56);
    for (let i = 0; i < 120; i++) s = step(s, idle, RAMP);
    expect(s).toMatchObject({ x: 72, y: 56, grounded: true });
    let d = spawn(40, 60);
    for (let i = 0; i < 120; i++) d = step(d, idle, DUNE);
    expect(d).toMatchObject({ x: 40, y: 60, grounded: true });
  });

  it('GDD-MOV-09 a fall onto a slope lands the middle of his feet on its surface', () => {
    for (const [x, y] of [[72, 56], [70.5, 57.5]] as const) {
      const states = until({ ...spawn(x, 0), grounded: false }, idle, RAMP, (s) => s.grounded, 120);
      const end = last(states);
      expect(end.grounded, `x ${x}`).toBe(true);
      expect(end.y, `x ${x}`).toBeCloseTo(y, 9);
      expect(end.vy).toBe(0);
    }
  });
});

describe('GDD-MOV-09 running on slopes', () => {
  it('GDD-MOV-09 he runs up a ramp onto its top at the run speed, on the ground every step', () => {
    const states = play(spawn(24, 64), () => right, RAMP, 60);
    states.forEach((s, i) => {
      expect(s.grounded, `step ${i}`).toBe(true);
      expect(s.y, `step ${i}`).toBeCloseTo(rampY(s.x), 9);
    });
    for (let i = 10; i < states.length; i++) expect(states[i]!.x - states[i - 1]!.x, `step ${i}`).toBeCloseTo(2, 9);
    expect(last(states).x).toBeCloseTo(135, 9);
    expect(last(states).y).toBeCloseTo(32, 9);
  });

  it('GDD-MOV-09 he runs down the ramp at the run speed, on the ground every step', () => {
    const states = until(spawn(150, 32), left, RAMP, (s) => s.x <= 30, 200);
    states.forEach((s, i) => {
      expect(s.grounded, `step ${i}`).toBe(true);
      expect(s.y, `step ${i}`).toBeCloseTo(rampY(s.x), 9);
    });
    for (let i = 10; i < states.length; i++) expect(states[i]!.x - states[i - 1]!.x, `step ${i}`).toBeCloseTo(-2, 9);
    expect(states.length - 1).toBe(65);
    expect(last(states).x).toBeCloseTo(29, 9);
  });

  it('GDD-MOV-09 he runs over a gentle dune both ways at the run speed, on the ground every step', () => {
    const there = until(spawn(8, 64), right, DUNE, (s) => s.x >= 140, 200);
    const back = until(last(there), left, DUNE, (s) => s.x <= 10, 200);
    for (const [states, dir] of [[there, 1], [back, -1]] as const) {
      states.forEach((s, i) => {
        expect(s.grounded, `step ${i}`).toBe(true);
        expect(s.y, `step ${i}`).toBeCloseTo(duneY(s.x), 9);
      });
      const first = states.findIndex((s, i) => i > 0 && Math.abs(s.x - states[i - 1]!.x - 2 * dir) < 1e-9);
      expect(first, 'reaches full speed').toBeGreaterThan(0);
      for (let i = first; i < states.length; i++) expect(states[i]!.x - states[i - 1]!.x, `dir ${dir} step ${i}`).toBeCloseTo(2 * dir, 9);
    }
  });
});

describe('GDD-MOV-09 jumping from a slope', () => {
  it('GDD-MOV-09 a standing jump and a short hop from a slope rise as high as from flat ground', () => {
    const full = peak(spawn(72, 56), RAMP, 999, 0);
    expect(full).toBe(peak(spawn(72, 64), FLAT, 999, 0));
    expect(full).toBeGreaterThan(54.5);
    expect(full).toBeLessThan(57.5);
    expect(peak(spawn(72, 56), RAMP, 1, 0)).toBe(peak(spawn(72, 64), FLAT, 1, 0));
  });

  it('GDD-MOV-09 a running jump uphill or downhill rises as high as one on flat ground', () => {
    // Uphill: n steps to x >= 66 on the ramp (x is 67, y 61), the same n steps on flat ground.
    const uphill = until(spawn(24, 64), right, RAMP, (s) => s.x >= 66, 100);
    const n = uphill.length - 1;
    const flatUp = play(spawn(24, 64), () => right, FLAT, n);
    expect(last(uphill).x).toBeCloseTo(67, 9);
    expect(last(uphill).y).toBeCloseTo(61, 9);
    expect(peak(last(uphill), RAMP, 999, 1)).toBe(peak(last(flatUp), FLAT, 999, 1));
    // Downhill: the same with the walk down the ramp.
    const downhill = until(spawn(150, 32), left, RAMP, (s) => s.x <= 90, 100);
    const m = downhill.length - 1;
    const flatDown = play(spawn(150, 64), () => left, FLAT, m);
    expect(peak(last(downhill), RAMP, 999, -1)).toBe(peak(last(flatDown), FLAT, 999, -1));
  });

  it('GDD-MOV-09 a jump at the top of a ramp keeps his speed and is not pushed back', () => {
    for (const X of [89, 91, 93, 95]) {
      const run = until(spawn(24, 64), right, RAMP, (s) => s.x >= X, 100);
      const at = last(run);
      expect(at.x, `X ${X}`).toBeCloseTo(X, 9);
      const s = step(at, { move: 1, jumpHeld: true }, RAMP);
      expect(s.takeoff, `X ${X}`).toBe('jump');
      expect(s.vy, `X ${X}`).toBeLessThan(0);
      expect(s.vx, `X ${X}`).toBe(120);
      expect(s.x, `X ${X}`).toBeCloseTo(X + 2, 9);
      // The takeoff step rises (410 + 385) / 2 / 60 = 6.625 px; at X = 95 the middle of his feet reaches the level tile at the top (x = 97) and is lifted onto its top.
      expect(s.y, `X ${X}`).toBeCloseTo((X === 95 ? 32 : rampY(X)) - 6.625, 9);
    }
  });

  it('GDD-MOV-09 a jump pressed just before landing on a slope takes off on landing', () => {
    let fall: PlayerState = { ...spawn(72, 0), grounded: false };
    const states = [fall];
    while (!fall.grounded) {
      fall = step(fall, idle, RAMP);
      states.push(fall);
    }
    let t = states[states.length - 1 - 3]!;
    for (let i = 0; i < 5; i++) t = step(t, { move: 0, jumpHeld: true }, RAMP);
    expect(t.vy).toBeLessThan(0);
  });

  it('GDD-MOV-09 off the high end of a ramp he falls with no launch, with the coyote time of a ledge', () => {
    const LEDGE = parseTiles(['..........', '..........', '..........', '..........', '#####.....']);
    const cliff = offTheEnd(CLIFF);
    expect(cliff.grounded).toBe(false);
    expect(cliff.x).toBeGreaterThan(80);
    expect(cliff.x).toBeLessThanOrEqual(82);
    expect(cliff.vy).toBeGreaterThanOrEqual(0);
    const ledge = offTheEnd(LEDGE);
    for (const [name, from, world] of [['ramp', cliff, CLIFF], ['ledge', ledge, LEDGE]] as const) {
      expect(pressAfter(from, world, 5).takeoff, `${name} 5th step`).toBe('jump');
      expect(pressAfter(from, world, 6).takeoff, `${name} 6th step`).toBeUndefined();
    }
  });
});

describe('GDD-MOV-09 feet kept on the ground', () => {
  it('GDD-MOV-09 he runs down into a valley and up out of it on the ground every step', () => {
    const states = until(spawn(24, 16), right, VALLEY, (s) => s.x >= 76, 60);
    expect(last(states).x).toBeGreaterThanOrEqual(76);
    states.forEach((s, i) => {
      expect(s.grounded, `step ${i}`).toBe(true);
      expect(s.y, `step ${i}`).toBeCloseTo(valleyY(s.x), 9);
    });
  });

  it('GDD-MOV-09 on the ground he is put back on a slope up to 4 px below, not from further', () => {
    const near = step(spawn(72, 52.5), idle, RAMP);
    expect(near.y).toBeCloseTo(56, 9);
    expect(near.grounded).toBe(true);
    const far = step(spawn(72, 51.5), idle, RAMP);
    expect(far.grounded).toBe(false);
    expect(far.y).toBeCloseTo(51.65625, 9);
  });

  it('GDD-MOV-09 in the air he is not pulled down onto a slope', () => {
    const s = step({ ...spawn(72, 52.5), grounded: false }, idle, RAMP);
    expect(s.grounded).toBe(false);
    expect(s.y).toBeCloseTo(52.65625, 9);
  });

  it('GDD-MOV-09 a step up of up to 4 px is climbed, a higher one is a wall', () => {
    const up = step({ ...spawn(64, 64), vx: 240 }, right, RAMP);
    expect(up.x).toBeCloseTo(64 + 3.8889, 3);
    expect(up.y).toBeCloseTo(128 - up.x, 9);
    expect(up.grounded).toBe(true);
    const wall = step({ ...spawn(64, 64), vx: 300 }, right, RAMP);
    expect(wall).toMatchObject({ x: 64, vx: 0, y: 64, grounded: true });
  });
});

describe('GDD-MOV-09 walls and ceilings', () => {
  it('GDD-MOV-09 a slope high side stops the middle of his feet', () => {
    const states = play(spawn(8, 64), () => right, FACE, 120);
    for (const s of states) expect(s.x).toBeLessThan(48);
    expect(last(states).x).toBeGreaterThan(47.8);
    expect(last(states)).toMatchObject({ y: 64, vx: 0, grounded: true });
  });

  it('GDD-MOV-09 a ramp into a wall stops his box against it with his feet on the ramp', () => {
    const states = play(spawn(8, 80), () => right, WALL_TOP, 120);
    for (const s of states) expect(s.x).toBeLessThanOrEqual(42 + 1e-9);
    const end = last(states);
    expect(end.x).toBeGreaterThan(41.8);
    expect(end.y).toBeCloseTo(112 - end.x, 9);
    expect(end.grounded).toBe(true);
    expect(end.vx).toBe(0);
  });

  it('GDD-MOV-09 a slope down into a wall stops him flush against it on the slope', () => {
    for (const [name, world, y] of [['45 degrees', WALL_FOOT, 74], ['gentle', WALL_FOOT_GENTLE, 69]] as const) {
      const states = play(spawn(40, 64), () => right, world, 120);
      for (const s of states) expect(s.x, name).toBeLessThanOrEqual(58 + 1e-9);
      const end = last(states);
      expect(end.x, name).toBeCloseTo(58, 9);
      expect(end.y, name).toBeCloseTo(y, 9);
      expect(end.grounded, name).toBe(true);
    }
  });

  it('GDD-MOV-09 a ramp under a ceiling stops him where his head meets it, never pushed back', () => {
    const states = play(spawn(24, 224), () => right, CEILING, 200);
    states.forEach((s, i) => {
      if (i > 0) expect(s.x, `step ${i}`).toBeGreaterThanOrEqual(states[i - 1]!.x - 1e-9);
      expect(s.y - 32, `step ${i}`).toBeGreaterThanOrEqual(144 - 1e-9);
    });
    const end = last(states);
    expect(end.x).toBeGreaterThan(111.8);
    expect(end.x).toBeLessThanOrEqual(112 + 1e-9);
    expect(end.y).toBeCloseTo(288 - end.x, 9);
    expect(end.grounded).toBe(true);
    expect(end.vx).toBe(0);
  });

  it('GDD-MOV-09 falling onto the tile at a ramp top while moving toward it, he lands on its top', () => {
    const states = play({ ...spawn(90, 30), grounded: false, vx: 120, vy: 60 }, () => right, RAMP, 6);
    states.forEach((s, i) => {
      if (i > 0) expect(s.x, `step ${i}`).toBeGreaterThanOrEqual(states[i - 1]!.x);
    });
    const third = states[3]!;
    expect(third.x).toBeCloseTo(96, 9);
    expect(third.y).toBe(32);
    expect(third.grounded).toBe(true);
  });
});

describe('GDD-MOV-09 other rules on slopes', () => {
  it('GDD-MOV-09 a slope is no wall to cling to or kick off', () => {
    const abilities: Abilities = { wallCling: true };
    const beside: PlayerState = { ...spawn(42, 60), grounded: false, vy: 100, coyote: 0 };
    const hold = step(beside, right, FACE, abilities);
    expect(hold.clinging).toBeFalsy();
    expect(hold.vy).toBeCloseTo(137.5, 9);
    const press = step(beside, { move: 1, jumpHeld: true }, FACE, abilities);
    expect(press.takeoff).toBeUndefined();
  });

  it('GDD-MOV-09 corner correction works on a jump from a slope', () => {
    const RAMPB = parseTiles(['.....#......', '............', '...../######', '..../#######', '############']);
    const s = step(spawn(76, 52), { move: 0, jumpHeld: true }, RAMPB);
    expect(s.x).toBeCloseTo(74, 9);
    expect(s.vy).toBeLessThan(0);
  });

  it('GDD-MOV-09 a crumbling tile at a ramp top starts only once he stands on its top', () => {
    const level: Level = {
      world: parseTiles(['............', '............', '...../.#####', '..../#######', '############']),
      spawn: { x: 24, y: 64 },
      ofrendas: [],
      spikes: [],
      crumbles: [{ col: 6, row: 2 }],
      springs: [],
      platforms: [],
      tacos: [],
      pinatas: [],
      doors: [],
      keys: [],
      fragiles: [],
      enemies: [],
    };
    let run = startRun(level);
    let sawOver = false;
    let first = -1;
    for (let i = 0; i < 60 && first < 0; i++) {
      run = stepRun(run, right, level);
      if (run.player.grounded && run.player.y === 32) first = i;
      else {
        expect(run.crumbles[0]!.phase, `step ${i}`).toBe('idle');
        if (run.player.x > 90) sawOver = true;
      }
    }
    expect(first).toBeGreaterThan(0);
    expect(sawOver).toBe(true);
    expect(run.crumbles[0]!.phase).toBe('warning');
  });
});

describe('GDD-MOV-09 enemies on slopes', () => {
  const far = spawn(1000, 0);
  const walkAll = (def: Enemy, world: TileGrid, steps: number, from?: EnemyState): EnemyState[] => {
    let s = from ?? freshEnemies([def])[0]!;
    const states = [s];
    for (let i = 0; i < steps; i++) {
      s = stepEnemy(def, s, world, far);
      states.push(s);
    }
    return states;
  };

  it('GDD-MOV-09 an Alacrán walks up and down a ramp with its feet on its surface', () => {
    const def: Enemy = { x: 24, y: 64 };
    const states = walkAll(def, RAMP, 1500);
    for (const s of states) expect(enemyBox(def, s).y1).toBeCloseTo(rampY(s.x), 9);
    expect(Math.min(...states.map((s) => s.x))).toBeCloseTo(7, 9);
    expect(Math.max(...states.map((s) => s.x))).toBeCloseTo(185, 9);
  });

  it('GDD-MOV-09 an Alacrán walks up a ramp onto a ledge with nothing under it', () => {
    const LEDGE5 = parseTiles(['..........', '..........', '..........', '...../####', '######....']);
    const states = walkAll({ x: 40, y: 64 }, LEDGE5, 400);
    expect(Math.max(...states.map((s) => s.x))).toBeCloseTo(153, 9);
  });

  it('GDD-MOV-09 a slope high side turns an Alacrán like a wall', () => {
    const def: Enemy = { x: 24, y: 64 };
    const states = walkAll(def, FACE, 200);
    expect(Math.max(...states.map((s) => s.x))).toBeCloseTo(47.5, 9);
    expect(states.some((s) => s.dir === -1)).toBe(true);
    for (const s of states) expect(enemyBox(def, s).y1).toBe(64);
  });

  it('GDD-MOV-09 a Tlacuache charges up a ramp with its feet on its surface', () => {
    const def: Enemy = { x: 24, y: 64, kind: 'tlacuache' };
    let s: EnemyState = { x: 24, dir: 1, alive: true, gait: { phase: 'charge', age: 0, playedDead: false } };
    let passed = false;
    for (let i = 0; i < 100 && s.gait!.phase === 'charge'; i++) {
      s = stepEnemy(def, s, RAMP, far);
      if (s.gait!.phase === 'charge') {
        expect(enemyBox(def, s).y1, `step ${i}`).toBeCloseTo(rampY(s.x), 9);
        if (s.x > 96) passed = true;
      }
    }
    expect(passed).toBe(true);
    expect(s.gait!.phase).toBe('walk');
    expect(s.x).toBeCloseTo(184, 9);
  });

  it('GDD-MOV-09 an enemy box stands where its feet have walked to', () => {
    expect(enemyBox({ x: 100, y: 160 }, { x: 100, dir: 1, alive: true, y: 150 })).toEqual({ x0: 93, x1: 107, y0: 140, y1: 150 });
    const gait = { phase: 'walk', age: 0, playedDead: false } as const;
    expect(enemyBox({ x: 100, y: 160, kind: 'tlacuache' }, { x: 100, dir: 1, alive: true, y: 150, gait })).toEqual({ x0: 92, x1: 108, y0: 140, y1: 150 });
  });

  it('GDD-MOV-09 a Tlacuache spots Poncho by where its feet are now', () => {
    const world = parseTiles(Array.from({ length: 12 }, (_, r) => (r >= 8 ? '#'.repeat(20) : '.'.repeat(20))));
    const def: Enemy = { x: 100, y: 160, kind: 'tlacuache' };
    const state: EnemyState = { x: 100, dir: 1, alive: true, y: 128, gait: { phase: 'walk', age: 0, playedDead: false } };
    expect(stepEnemy(def, state, world, { ...spawn(140, 128), grounded: true }).gait!.phase).toBe('telegraph');
    expect(stepEnemy(def, state, world, spawn(140, 160)).gait!.phase).toBe('walk');
  });
});

describe('GDD-MOV-09 a walking taco on slopes', () => {
  it('GDD-MOV-09 a taco walks up and down a ramp with its feet on its surface', () => {
    let t = taco(24, 64);
    const xs: number[] = [];
    for (let i = 0; i < 1200; i++) {
      t = stepItem(t, RAMP);
      xs.push(t.x);
      expect(t.vy, `step ${i}`).toBe(0);
      expect(t.y, `step ${i}`).toBeCloseTo(rampY(t.x), 9);
    }
    expect(Math.min(...xs)).toBeCloseTo(6, 9);
    expect(Math.max(...xs)).toBeCloseTo(186, 9);
  });

  it('GDD-MOV-09 a slope high side turns a taco', () => {
    let t = taco(24, 64);
    const xs: number[] = [];
    for (let i = 0; i < 60; i++) {
      t = stepItem(t, FACE);
      xs.push(t.x);
      expect(t.x, `step ${i}`).toBeLessThanOrEqual(48);
    }
    expect(Math.max(...xs)).toBeGreaterThan(47.3);
    expect(t.vx).toBe(-40);
  });

  it('GDD-MOV-09 a taco meeting a ceiling over a ramp turns without being pushed back', () => {
    let t = taco(24, 224);
    let turnedAt = -1;
    for (let i = 0; i < 300 && turnedAt < 0; i++) {
      const before = t;
      t = stepItem(t, CEILING_LOW);
      expect(t.y - 12, `step ${i}`).toBeGreaterThanOrEqual(160 - 1e-9);
      if (t.vx < 0) turnedAt = t.x;
      else expect(t.x, `step ${i}`).toBeGreaterThanOrEqual(before.x);
    }
    expect(turnedAt).toBeGreaterThan(115.3);
    expect(turnedAt).toBeLessThanOrEqual(116 + 1e-9);
  });
});

describe('GDD-MOV-09 fireballs on slopes', () => {
  it('GDD-MOV-09 a fireball bounces up a ramp, over the tile at its top and on', () => {
    let fb: Fireball | null = { x: 30, y: 51, vx: 180, vy: 0, age: 0 };
    for (let i = 0; i < 60 && fb !== null && fb.x < 150; i++) {
      fb = stepFireball(fb, RAMP);
      expect(fb, `step ${i}`).not.toBeNull();
      if (fb) expect(fb.y, `step ${i}`).toBeLessThanOrEqual(rampY(fb.x) + 1e-9);
    }
    expect(fb!.x).toBeGreaterThanOrEqual(150);
  });

  it('GDD-MOV-09 a fireball vanishes at a slope high side', () => {
    let fb: Fireball | null = { x: 42, y: 64, vx: 180, vy: 0, age: 0 };
    let gone = -1;
    for (let i = 0; i < 3 && gone < 0; i++) {
      fb = stepFireball(fb!, FACE);
      if (fb === null) gone = i;
      else expect(fb.x).toBeLessThan(48);
    }
    expect(gone).toBeGreaterThanOrEqual(0);
  });

  it('GDD-MOV-09 a fireball bounces off a slope at the speed it bounces off flat ground', () => {
    let fb: Fireball = { x: 72, y: 20, vx: 0, vy: 0, age: 0 };
    let bounced: Fireball | null = null;
    for (let i = 0; i < 60 && bounced === null; i++) {
      const next = stepFireball(fb, RAMP);
      expect(next, `step ${i}`).not.toBeNull();
      fb = next!;
      if (fb.vy < 0) bounced = fb;
      else expect(fb.y, `step ${i}`).toBeLessThan(56);
    }
    expect(bounced).not.toBeNull();
    expect(bounced!.y).toBeCloseTo(56, 9);
    expect(bounced!.vy).toBeCloseTo(-BOUNCE_SPEED, 9);
  });

  it('GDD-MOV-09 only a slope lifts a fireball: one reaching a block side near its top still vanishes', () => {
    const row = '.'.repeat(40);
    const world = parseTiles([row, row, row, row.slice(0, 10) + '#' + row.slice(11), '#'.repeat(40)]);
    expect(stepFireball({ x: 157, y: 50, vx: 180, vy: 0, age: 0 }, world)).toBeNull();
  });
});
