import { describe, expect, it } from 'vitest';
import { CLAW, LIVES_MAX, RESPAWN, TILE } from '../config/tuning';
import { boxTouchesTile, clawBox, IDLE_CLAW, stepClaw, type ClawState } from './claw';
import type { Fragile } from './fragile';
import type { Item } from './item';
import { spawn, type PlayerInput, type PlayerState } from './movement';
import { startRun, stepRun, type Level, type RunState } from './run';
import { parseTiles } from './tilemap';

const swipe: PlayerInput = { move: 0, jumpHeld: false, claw: true };
const idle: PlayerInput = { move: 0, jumpHeld: false };

/** Runs the state machine with the button down on the steps listed (a string of 1 and 0), returns the phase each step. */
const phases = (pattern: string, facing: 1 | -1 = 1): string[] => {
  let c: ClawState = IDLE_CLAW;
  return pattern.split('').map((ch) => {
    c = stepClaw(c, ch === '1', facing);
    return `${c.phase}${c.steps}`;
  });
};

describe('GDD-CMB-02 claw swing timing', () => {
  it('a press starts a 2-step wind-up, then a 3-step swing, then idle', () => {
    expect(phases('1000000')).toEqual(['windup1', 'windup2', 'swing1', 'swing2', 'swing3', 'idle0', 'idle0']);
    expect([CLAW.windupSteps, CLAW.activeSteps]).toEqual([2, 3]);
  });

  it('holding the button swings once, not again until it is let go and pressed', () => {
    const held = phases('1'.repeat(40));
    expect(held.filter((p) => p === 'windup1')).toHaveLength(1);
  });

  it('the cooldown is 0.25 s (15 steps) from the press: a press 14 steps later is ignored, 15 steps later swings', () => {
    const at14 = phases(`1${'0'.repeat(13)}1`);
    expect(at14[14]).toBe('idle0');
    const at15 = phases(`1${'0'.repeat(14)}1`);
    expect(at15[15]).toBe('windup1');
    expect(CLAW.cooldownSteps).toBe(15);
  });

  it('a press during the wind-up or the swing is ignored', () => {
    expect(phases('1101010')).toEqual(['windup1', 'windup2', 'swing1', 'swing2', 'swing3', 'idle0', 'idle0']);
  });

  it('the swing faces the way Poncho faced at the press', () => {
    let c = stepClaw(IDLE_CLAW, true, -1);
    c = stepClaw(c, false, 1);
    expect(c.dir).toBe(-1);
  });
});

const swinging = (dir: 1 | -1): ClawState => ({ ...IDLE_CLAW, phase: 'swing', steps: 1, dir });
const at = (x: number, y: number): PlayerState => spawn(x, y);

describe('GDD-CMB-02 claw hit area', () => {
  it('is 20 x 20 px, as tall as the body, starting at its front edge', () => {
    expect(clawBox(at(100, 64), swinging(1))).toEqual({ x0: 106, x1: 126, y0: 44, y1: 64 });
    expect(clawBox(at(100, 64), swinging(-1))).toEqual({ x0: 74, x1: 94, y0: 44, y1: 64 });
  });

  it('exists only while swinging', () => {
    expect(clawBox(at(100, 64), { ...IDLE_CLAW, phase: 'windup', steps: 2 })).toBeNull();
    expect(clawBox(at(100, 64), IDLE_CLAW)).toBeNull();
  });

  it('touches a tile it overlaps, and not one it only shares an edge with', () => {
    const box = { x0: 106, x1: 126, y0: 50, y1: 64 };
    expect(boxTouchesTile(box, 7, 3)).toBe(true); // x 112 to 128, y 48 to 64
    expect(boxTouchesTile(box, 8, 3)).toBe(false); // starts at x = 128
    expect(boxTouchesTile(box, 6, 3)).toBe(true); // x 96 to 112: the box starts at 106
    expect(boxTouchesTile(box, 5, 3)).toBe(false); // ends at x = 96
    expect(boxTouchesTile(box, 7, 2)).toBe(false); // y 32 to 48: above the box, which starts at y = 50
    expect(boxTouchesTile(box, 7, 4)).toBe(false); // y 64 to 80: the box ends at y = 64
    // A box that starts exactly on a tile's right edge or bottom edge only touches it.
    const flush = { x0: 112, x1: 132, y0: 48, y1: 62 };
    expect(boxTouchesTile(flush, 6, 3)).toBe(false); // tile x 96 to 112 ends where the box starts
    expect(boxTouchesTile(flush, 8, 2)).toBe(false); // tile y 32 to 48 ends where the box starts
    expect(boxTouchesTile(flush, 7, 3)).toBe(true);
  });
});

// A floor at row 4 (top y = 64). A fragile wall in column 6, row 3 (x 96 to 112, y 48 to 64). A piñata in column 9, row 1
// (x 144 to 160, y 16 to 32), with a floor ledge in row 2 columns 8 to 10 under it for Poncho to stand on (y = 32 on top).
const world = parseTiles(['..........', '..........', '..........', '..........', '##########']);
const fragile = (rows: number[]): Fragile[] => rows.map((row) => ({ col: 6, row }));
const level: Level = {
  world,
  spawn: { x: 24, y: 4 * TILE },
  ofrendas: [],
  spikes: [],
  crumbles: [],
  springs: [],
  platforms: [],
  tacos: [],
  pinatas: [],
  doors: [],
  keys: [],
  fragiles: fragile([3]),
  enemies: [],
};
const run = (r: RunState, input: PlayerInput, steps: number, l: Level = level): RunState => {
  for (let i = 0; i < steps; i++) r = stepRun(r, input, l);
  return r;
};
/** Poncho at x on the floor, facing right, with the claw pressed on the first step. */
const swingFrom = (x: number, l: Level = level, extra: Partial<RunState> = {}): RunState => ({ ...startRun(l), player: { ...spawn(x, 64), facing: 1 }, ...extra });
/** Steps until the first swing step (press step, wind-up 2, then the swing). */
const SWING_AT = CLAW.windupSteps + 1;

/** The wall's flags after a swing pressed with Poncho standing at x, facing right. */
const reached = (x: number): boolean[] => {
  let r = swingFrom(x);
  r = stepRun(r, swipe, level);
  return [...run(r, idle, SWING_AT - 1).fragilesBroken];
};

describe('GDD-WLD-05 the claw breaks a fragile wall', () => {
  it('on the first swing step, for good, and Poncho walks through', () => {
    let r = swingFrom(84); // body right edge 90, claw reaches x 90 to 110: overlaps the wall (x 96 to 112)
    r = stepRun(r, swipe, level);
    r = run(r, idle, SWING_AT - 2);
    expect(r.fragilesBroken).toEqual([false]);
    r = stepRun(r, idle, level);
    expect(r.fragilesBroken).toEqual([true]);
    r = run(r, { move: 1, jumpHeld: false }, 80);
    expect(r.player.x).toBeGreaterThan(112);
  });

  it('only the tiles the claw box overlaps: a taller wall keeps the rows above its reach (the claw is 20 px tall)', () => {
    const tall: Level = { ...level, fragiles: fragile([0, 1, 2, 3]) };
    let r = swingFrom(84, tall);
    r = stepRun(r, swipe, tall);
    r = run(r, idle, SWING_AT - 1, tall);
    expect(r.fragilesBroken).toEqual([false, false, true, true]); // the box is y 44 to 64, so rows 2 and 3 (y 32 to 64)
  });

  it('a wall out of reach stays: the claw is 20 px long', () => {
    let r = swingFrom(63.9); // body right edge 69.9, the box ends at 89.9, the wall starts at 96
    r = stepRun(r, swipe, level);
    r = run(r, idle, SWING_AT - 1);
    expect(r.fragilesBroken).toEqual([false]);
  });

  it('reaches exactly to 20 px past the body: 0.01 px short does not break, 0.01 px into it does', () => {
    expect(reached(70)).toEqual([false]); // box ends at 96: only touching the wall
    expect(reached(70.01)).toEqual([true]);
  });

  it('swings the way Poncho faces: a wall behind him is not touched', () => {
    let r: RunState = { ...swingFrom(120), player: { ...spawn(120, 64), facing: -1 } }; // wall at x 96 to 112, box x 94 to 114
    r = stepRun(r, swipe, level);
    r = run(r, idle, SWING_AT - 1);
    expect(r.fragilesBroken).toEqual([true]);
    let behind: RunState = { ...swingFrom(80), player: { ...spawn(80, 64), facing: -1 } };
    behind = stepRun(behind, swipe, level);
    behind = run(behind, idle, SWING_AT - 1);
    expect(behind.fragilesBroken).toEqual([false]);
  });

  it('an unbroken wall is solid: Poncho stops at it', () => {
    const r = run(startRun(level), { move: 1, jumpHeld: false }, 200);
    expect(r.player.x).toBe(96 - 6);
  });

  it('losing a life puts the wall back and ends any swing', () => {
    const pit: Level = { ...level, world: parseTiles(['...', '...']), fragiles: fragile([0]) };
    let r: RunState = { ...startRun(pit), fragilesBroken: [true], claw: { ...IDLE_CLAW, phase: 'swing', steps: 1 }, player: spawn(24, 200) };
    r = run(r, idle, 1 + RESPAWN.delaySteps, pit);
    expect(r).toMatchObject({ phase: 'playing', fragilesBroken: [false], claw: IDLE_CLAW });
  });
});

describe('GDD-WLD-05 an unbroken fragile wall is a wall for a walking taco', () => {
  it('turns it round with its box flush against the wall, and walks through once it is broken', () => {
    const walker: Item = { x: 80, y: 64, vx: 40, vy: 0, kind: 'taco' };
    let r: RunState = { ...startRun(level), player: spawn(24, 64), items: [walker] };
    for (let i = 0; i < 60 && r.items[0]!.vx > 0; i++) r = stepRun(r, idle, level);
    expect(r.items[0]).toMatchObject({ x: 90, vx: -40 }); // the wall starts at x = 96
    const broken: RunState = { ...startRun(level), player: spawn(24, 64), fragilesBroken: [true], items: [walker] };
    expect(run(broken, idle, 60).items[0]!.x).toBeGreaterThan(112);
  });
});

describe('GDD-PWR-05 the claw opens a piñata', () => {
  // Poncho stands on the floor at y = 64 and the piñata hangs in column 5, row 2 (x 80 to 96, y 32 to 48): out of reach of
  // a standing claw (y 50 to 64). From a ledge one tile lower the box overlaps it.
  const ledge = parseTiles(['..........', '..........', '..........', '..........', '##########']);
  const hanging: Level = { ...level, world: ledge, pinatas: [{ col: 5, row: 3 }], fragiles: [] }; // x 80 to 96, y 48 to 64
  it('a swing that overlaps it opens it, and in Base a taco appears on top', () => {
    let r = swingFrom(70, hanging); // body right edge 76, box x 76 to 96
    r = stepRun(r, swipe, hanging);
    r = run(r, idle, SWING_AT - 1, hanging);
    expect(r.pinatasOpen).toEqual([true]);
    expect(r.items).toHaveLength(1);
    expect(r.items[0]).toMatchObject({ x: 88, vx: 40 });
  });
  it('in Taco it opens and a chile comes out, staying where it is', () => {
    let r = swingFrom(70, hanging, { power: 'taco' });
    r = stepRun(r, swipe, hanging);
    r = run(r, idle, SWING_AT - 1, hanging);
    expect(r.pinatasOpen).toEqual([true]);
    expect(r.items).toEqual([{ x: 88, y: 48, vx: 0, vy: 0, kind: 'chile' }]);
  });
  it('a swing that does not reach it opens nothing', () => {
    let r = swingFrom(40, hanging);
    r = stepRun(r, swipe, hanging);
    r = run(r, idle, 10, hanging);
    expect(r.pinatasOpen).toEqual([false]);
  });
  it('a piñata under the box but out of its height is not hit: the claw is 20 px tall', () => {
    const high: Level = { ...hanging, pinatas: [{ col: 5, row: 1 }] }; // y 16 to 32, well above the box (y 44 to 64)
    let r = swingFrom(70, high);
    r = stepRun(r, swipe, high);
    r = run(r, idle, 10, high);
    expect(r.pinatasOpen).toEqual([false]);
  });
  it('already open stays open and releases nothing more', () => {
    let r = swingFrom(70, hanging, { pinatasOpen: [true] });
    r = stepRun(r, swipe, hanging);
    r = run(r, idle, SWING_AT - 1, hanging);
    expect(r.items).toEqual([]);
  });
});

describe('GDD-CMB-02 a hit interrupts the swing', () => {
  const spikeLevel: Level = { ...level, fragiles: [], spikes: [{ col: 3, row: 3 }] };
  it('a spike hit in Taco ends the swing but not the cooldown', () => {
    const midSwing: ClawState = { phase: 'swing', steps: 1, cooldown: 10, dir: 1, held: true };
    const r = stepRun({ ...startRun(spikeLevel), power: 'taco', player: spawn(56, 64), claw: midSwing }, swipe, spikeLevel);
    expect(r.claw).toMatchObject({ phase: 'idle', steps: 0 });
    expect(r.claw.cooldown).toBeGreaterThan(0);
    expect(r.lives.lives).toBe(LIVES_MAX);
  });
  it('the button still held after the hit does not swing again once the cooldown is over', () => {
    const midSwing: ClawState = { phase: 'swing', steps: 1, cooldown: 10, dir: 1, held: true };
    let r = stepRun({ ...startRun(spikeLevel), power: 'taco', player: spawn(56, 64), claw: midSwing }, swipe, spikeLevel);
    for (let i = 0; i < 40; i++) r = stepRun(r, swipe, spikeLevel); // held down the whole time, well past the cooldown
    expect(r.claw.phase).toBe('idle');
  });
});

describe('GDD-CMB-02 holding the button through a death', () => {
  it('does not swing the moment control returns after the respawn', () => {
    const pit: Level = { ...level, world: parseTiles(['..........', '..........', '..........', '..........', '#####.....']), fragiles: [], enemies: [] };
    let r: RunState = { ...startRun(pit), player: spawn(120, 200) }; // falls past the bottom: a life is lost, he respawns on the floor
    let swings = 0;
    for (let i = 0; i < 1 + RESPAWN.delaySteps + 40; i++) {
      const before = r.claw.phase;
      r = stepRun(r, swipe, pit); // the button is held the whole time
      if (before === 'idle' && r.claw.phase === 'windup') swings++;
    }
    expect(r.phase).toBe('playing');
    expect(swings).toBe(0);
  });
});
