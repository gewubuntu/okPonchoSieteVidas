import { describe, expect, it } from 'vitest';
import { RESPAWN, TACO, TILE } from '../config/tuning';
import { stepItem, touchesItem, releaseFrom, type Item } from './item';
import { spawn, type PlayerInput, type PlayerState } from './movement';
import { bumpedPinata, withPinatas, type Pinata } from './pinata';
import { startRun, stepRun, type Level, type RunState } from './run';
import { parseTiles } from './tilemap';

const idle: PlayerInput = { move: 0, jumpHeld: false };
const jump: PlayerInput = { move: 0, jumpHeld: true };

// Floor top at y = 128 (row 8). A piñata in column 5, row 5: x 80 to 96, underside y = 96. A standing Poncho's head is at
// 114, so a jump bumps it after rising 18 px. A wall in column 14 (rows 6 and 7) turns a walking taco round.
const rows = [...Array.from({ length: 6 }, () => '..............#...'), '..............#...', '..............#...', '#################.'];
const world = parseTiles(rows);
const pinata: Pinata = { col: 5, row: 5 };
const level: Level = {
  world,
  spawn: { x: 88, y: 8 * TILE },
  ofrendas: [],
  spikes: [],
  crumbles: [],
  springs: [],
  platforms: [],
  tacos: [],
  pinatas: [pinata],
};
const at = (x: number, y: number, vy = 0): PlayerState => ({ ...spawn(x, y), vy });
const run = (r: RunState, input: PlayerInput, steps: number, l: Level = level): RunState => {
  for (let i = 0; i < steps; i++) r = stepRun(r, input, l);
  return r;
};
/** Standing under the piñata at x, holds jump until it opens (or 40 steps pass). */
const bump = (r: RunState, l: Level = level): RunState => {
  for (let i = 0; i < 40; i++) {
    r = stepRun(r, jump, l);
    if (r.pinatasOpen.some(Boolean)) break;
  }
  return r;
};
const under = (x = 88, power: RunState['power'] = 'base'): RunState => ({ ...startRun(level), player: at(x, 128), power });

describe('GDD-PWR-05 a piñata is a solid tile, closed or open', () => {
  it('blocks like a wall', () => {
    expect(withPinatas(world, [pinata]).solidTile(5, 5)).toBe(true);
    expect(world.solidTile(5, 5)).toBe(false);
    expect(withPinatas(world, [pinata]).solidTile(4, 5)).toBe(false);
  });

  it('Poncho stands on top of it', () => {
    const r = run({ ...startRun(level), player: at(88, 70) }, idle, 30);
    expect(r.player).toMatchObject({ y: 80, grounded: true });
  });
});

/** Poncho with his head flush against the piñata's underside (y 96). */
const head = (x: number, vy = 0) => at(x, 96 + 14, vy);

describe('GDD-PWR-05 what counts as a head bump', () => {
  it('rising, then stopped with the head flush under the tile', () => {
    expect(bumpedPinata(at(88, 111, -100), head(88), [pinata])).toBe(0);
  });
  it('not when he was not rising', () => {
    expect(bumpedPinata(at(88, 110, 0), head(88), [pinata])).toBe(-1);
    expect(bumpedPinata(at(88, 110, 50), head(88), [pinata])).toBe(-1);
  });
  it('not when he is still moving up after the step (a corner nudge, not a bump)', () => {
    expect(bumpedPinata(at(88, 111, -100), head(88, -50), [pinata])).toBe(-1);
  });
  it('not when the head is not flush with the underside', () => {
    expect(bumpedPinata(at(88, 111, -100), at(88, 109.9), [pinata])).toBe(-1);
    expect(bumpedPinata(at(88, 111, -100), at(88, 110.1), [pinata])).toBe(-1);
  });
  it('the body must overlap the tile column: touching only an edge is not a bump', () => {
    expect(bumpedPinata(at(74.01, 111, -100), head(74.01), [pinata])).toBe(0); // body right edge 80.01
    expect(bumpedPinata(at(74, 111, -100), head(74), [pinata])).toBe(-1);
    expect(bumpedPinata(at(101.99, 111, -100), head(101.99), [pinata])).toBe(0);
    expect(bumpedPinata(at(102, 111, -100), head(102), [pinata])).toBe(-1);
  });
  it('two neighbouring piñatas: the one whose middle is nearer wins', () => {
    const two: Pinata[] = [pinata, { col: 6, row: 5 }]; // middles 88 and 104
    expect(bumpedPinata(at(95, 111, -100), head(95), two)).toBe(0);
    expect(bumpedPinata(at(97, 111, -100), head(97), two)).toBe(1);
  });
});

describe('GDD-PWR-05 opening a piñata', () => {
  it('a jump from underneath opens it in Base and a taco appears on top of it, heading right at 40 px/s', () => {
    const r = bump(under());
    expect(r.pinatasOpen).toEqual([true]);
    expect(r.items).toEqual([{ x: 88, y: 80, vx: TACO.walkSpeed, vy: 0 }]);
  });

  it('opening one takes no life and does not change the state by itself', () => {
    const r = bump(under());
    expect(r).toMatchObject({ power: 'base', phase: 'playing' });
  });

  it('a piñata only opens once: another bump releases nothing more', () => {
    const first = bump(under());
    const r = run({ ...first, player: at(88, 128), items: [] }, jump, 25); // jumps and bumps it again
    expect(r.items).toEqual([]);
    expect(r.pinatasOpen).toEqual([true]);
  });

  it('in Taco it opens but releases nothing (the chile arrives with GDD-PWR-03)', () => {
    const r = bump(under(88, 'taco'));
    expect(r.pinatasOpen).toEqual([true]);
    expect(r.items).toEqual([]);
  });

  it('a bump that only clips the corner slides past and opens nothing', () => {
    const r = run({ ...startRun(level), player: at(99, 128) }, jump, 25); // body overlaps the tile by 3 px
    expect(r.pinatasOpen).toEqual([false]);
  });

  it('standing or walking under it does nothing', () => {
    expect(run(under(), idle, 10).pinatasOpen).toEqual([false]);
  });

  it('with no room above it (a solid tile there) it stays closed and releases nothing', () => {
    const blockedWorld = parseTiles(rows.map((row, i) => (i === 4 ? row.slice(0, 5) + '#' + row.slice(6) : row)));
    const blockedLevel: Level = { ...level, world: blockedWorld };
    const r = bump({ ...startRun(blockedLevel), player: at(88, 128) }, blockedLevel);
    expect(r.pinatasOpen).toEqual([false]);
    expect(r.items).toEqual([]);
  });
});

const stepsOf = (item: Item, n: number): Item => {
  for (let i = 0; i < n; i++) item = stepItem(item, world);
  return item;
};

describe('GDD-PWR-02 the walking taco', () => {
  const onFloor: Item = { x: 100, y: 128, vx: TACO.walkSpeed, vy: 0 };

  it('walks along the ground at 40 px/s', () => {
    const walker = stepsOf(onFloor, 60);
    expect(walker.x).toBeCloseTo(140, 6);
    expect(walker.y).toBe(128);
  });

  it('turns round at a wall and walks back', () => {
    // The wall in column 14 starts at x = 224, so a 12 px wide taco turns with its middle at 218.
    const walker = stepsOf({ ...onFloor, x: 210 }, 40);
    expect(walker.vx).toBe(-TACO.walkSpeed);
    expect(walker.x).toBeLessThanOrEqual(218);
  });

  it('turns round against a wall on its left too, with its box flush against the wall', () => {
    // The wall in column 14 ends at x = 240, so a left-moving taco turns with its middle at 246 (box from 240 to 252).
    let walker: Item = { x: 250, y: 128, vx: -TACO.walkSpeed, vy: 0 };
    for (let i = 0; i < 20 && walker.vx < 0; i++) walker = stepItem(walker, world);
    expect(walker).toMatchObject({ x: 246, vx: TACO.walkSpeed });
  });

  it('turns right-hand walls with its box flush too: the middle stops at 218', () => {
    let walker: Item = { ...onFloor, x: 210 };
    for (let i = 0; i < 40 && walker.vx > 0; i++) walker = stepItem(walker, world);
    expect(walker).toMatchObject({ x: 218, vx: -TACO.walkSpeed });
  });

  it('falls off a ledge instead of turning', () => {
    const ledge: Item = { x: 94, y: 80, vx: TACO.walkSpeed, vy: 0 }; // on top of the piñata, which ends at x = 96
    const walker = stepsOf(ledge, 60);
    expect(walker.y).toBe(128);
    expect(walker.vx).toBe(TACO.walkSpeed);
    expect(walker.x).toBeGreaterThan(96);
  });

  it('is released only where there is room', () => {
    expect(releaseFrom(pinata, world)).toEqual({ x: 88, y: 80, vx: TACO.walkSpeed, vy: 0 });
    expect(releaseFrom(pinata, withPinatas(world, [{ col: 5, row: 4 }]))).toBeNull();
  });

  it('is touched by the 12 x 14 body: edges that only meet do not count', () => {
    const item: Item = { x: 100, y: 128, vx: 0, vy: 0 }; // box x 94 to 106, y 116 to 128
    expect(touchesItem(at(87.99, 128), item)).toBe(false); // body right edge 93.99
    expect(touchesItem(at(88.01, 128), item)).toBe(true);
    expect(touchesItem(at(111.99, 128), item)).toBe(true);
    expect(touchesItem(at(112.01, 128), item)).toBe(false);
    expect(touchesItem(at(100, 142), item)).toBe(false); // body top at 128: only touching
    expect(touchesItem(at(100, 141.99), item)).toBe(true);
    expect(touchesItem(at(100, 116), item)).toBe(false); // feet at its top
    expect(touchesItem(at(100, 116.01), item)).toBe(true);
  });
});

describe('GDD-PWR-02 a released taco stands on the piñata it came from', () => {
  it('in a run, the open piñata is a floor for it, not just a wall for Poncho', () => {
    const standing: Item = { x: 88, y: 80, vx: 0, vy: 0 };
    const r = run({ ...startRun(level), player: at(24, 128), items: [standing] }, idle, 10);
    expect(r.items).toEqual([standing]);
  });
});

describe('GDD-PWR-02 a piñata is a wall for a walking taco', () => {
  it('a taco walking into the side of a piñata turns round with its box flush against it', () => {
    // A floor at row 6 (top y = 96), so a taco on it is level with the piñata in column 5, row 5 (x from 80).
    const shelf: Level = { ...level, world: parseTiles([...Array.from({ length: 6 }, () => '..........'), '##########', '..........']) };
    let r: RunState = { ...startRun(shelf), player: at(24, 96), items: [{ x: 60, y: 96, vx: TACO.walkSpeed, vy: 0 }] };
    for (let i = 0; i < 60 && r.items[0]!.vx > 0; i++) r = stepRun(r, idle, shelf);
    expect(r.items[0]).toMatchObject({ x: 74, y: 96, vx: -TACO.walkSpeed });
  });
});

describe('GDD-PWR-06 collecting a released taco', () => {
  const item: Item = { x: 100, y: 128, vx: 0, vy: 0 };
  it('in Base it makes Poncho Taco and is used up', () => {
    const r = stepRun({ ...startRun(level), player: at(100, 128), items: [item] }, idle, level);
    expect(r).toMatchObject({ power: 'taco', items: [] });
  });
  it('in Taco it is used up and changes nothing (hilos are not built yet)', () => {
    const r = stepRun({ ...startRun(level), player: at(100, 128), power: 'taco', items: [item] }, idle, level);
    expect(r).toMatchObject({ power: 'taco', items: [] });
  });
  it('one that falls into a pit is gone', () => {
    const pitLevel: Level = { ...level, world: parseTiles(['....', '....', '#...']) }; // Poncho keeps his floor in column 0
    let r: RunState = { ...startRun(pitLevel), player: at(8, 32), items: [{ x: 40, y: 30, vx: 0, vy: 0 }] };
    for (let i = 0; i < 80 && r.items.length > 0; i++) r = stepRun(r, idle, pitLevel);
    expect(r.items).toEqual([]);
  });
});

describe('GDD-PWR-05 losing a life closes the piñatas and clears the items', () => {
  it('after a spike or pit the piñata is closed again, and Poncho is back in Base', () => {
    let r = bump(under());
    const pit: Level = { ...level, world: parseTiles(['....', '....']) };
    r = { ...r, player: at(8, 200) };
    r = run(r, idle, 1 + RESPAWN.delaySteps, { ...pit, pinatas: level.pinatas });
    expect(r).toMatchObject({ phase: 'playing', pinatasOpen: [false], items: [] });
  });
});
