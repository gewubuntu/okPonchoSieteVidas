import { describe, expect, it } from 'vitest';
import { BLOCK, HITBOX, RESPAWN, TILE } from '../config/tuning';
import { blockAt, moveBlocks, type MovingBlock } from './block';
import { spawn, type Abilities, type PlayerInput, type PlayerState } from './movement';
import { startRun, stepRun, type Level, type RunState } from './run';
import type { Door } from './door';
import { parseTiles } from './tilemap';

const idle: PlayerInput = { move: 0, jumpHeld: false };
const HALF = HITBOX.width / 2;

// A floor at row 12 (top y = 192) in a world 20 tiles wide; `extra(row)` gives any other row.
const worldOf = (extra: (row: number) => string = () => '.'.repeat(20)) => parseTiles(Array.from({ length: 13 }, (_, r) => (r === 12 ? '#'.repeat(20) : extra(r))));
const open = worldOf();
const levelOf = (blocks: MovingBlock[], world = open, more: Partial<Level> = {}, abilities: Abilities = {}): Level => ({
  world,
  spawn: { x: 16, y: 12 * TILE },
  ofrendas: [],
  spikes: [],
  crumbles: [],
  springs: [],
  platforms: [],
  tacos: [], pinatas: [], doors: [], keys: [], fragiles: [], enemies: [],
  blocks,
  abilities,
  ...more,
});

/** Plays on, returning every state. */
function play(level: Level, r: RunState, steps: number, input: (i: number) => PlayerInput = () => idle): RunState[] {
  const states: RunState[] = [];
  for (let i = 0; i < steps; i++) {
    r = stepRun(r, input(i), level);
    states.push(r);
  }
  return states;
}
const runAt = (level: Level, player: PlayerState, extra: Partial<RunState> = {}): RunState => ({ ...startRun(level), player, ...extra });
const standing = (x: number, y: number): PlayerState => ({ ...spawn(x, y), grounded: true });
const airborne = (x: number, y: number): PlayerState => ({ ...spawn(x, y), grounded: false });

// Vertical: 96 px, 2.4 s one way at 40 px/s.
const vertical: MovingBlock = { x0: 40, y0: 32, x1: 40, y1: 128, w: 16, h: 16 };

describe('GDD-WLD-05 moving block path', () => {
  it('starts at its first end and moves 40 px a second', () => {
    expect(BLOCK.speed).toBe(40);
    expect(blockAt(vertical, 0)).toEqual({ x: 40, y: 32, w: 16, h: 16 });
    expect(blockAt(vertical, 60).y).toBeCloseTo(72, 9);
    expect(blockAt(vertical, 60).x).toBe(40);
  });

  it('reaches the second end after length / 40 s and is back at the first after twice that', () => {
    expect(blockAt(vertical, 144).y).toBeCloseTo(128, 9);
    expect(blockAt(vertical, 216).y).toBeCloseTo(80, 9);
    expect(blockAt(vertical, 288).y).toBeCloseTo(32, 9);
    expect(blockAt(vertical, 288 + 60).y).toBeCloseTo(72, 9);
  });

  it('keeps its size', () => {
    expect(blockAt({ x0: 0, y0: 0, x1: 0, y1: 0, w: 32, h: 48 }, 100)).toEqual({ x: 0, y: 0, w: 32, h: 48 });
  });
});

describe('GDD-WLD-05 moving block is solid on every side', () => {
  const still: MovingBlock = { x0: 100, y0: 128, x1: 100, y1: 128, w: 32, h: 16 };

  it('lands Poncho on its top: grounded, feet at its top', () => {
    const level = levelOf([still]);
    const states = play(level, runAt(level, airborne(116, 90)), 40);
    const last = states[states.length - 1]!.player;
    expect(last.grounded).toBe(true);
    expect(last.y).toBe(128);
    expect(last.vy).toBe(0);
  });

  it('carries him sideways while he stands on it', () => {
    const level = levelOf([{ x0: 40, y0: 128, x1: 136, y1: 128, w: 32, h: 16 }]);
    const states = play(level, runAt(level, standing(56, 128)), 60);
    const last = states[59]!.player;
    expect(last.x).toBeCloseTo(96, 6); // 40 px in 60 steps
    expect(last.y).toBe(128);
    expect(last.grounded).toBe(true);
  });

  it('carries him up and down with it', () => {
    const up = levelOf([{ x0: 40, y0: 160, x1: 40, y1: 64, w: 32, h: 16 }]);
    const rising = play(up, runAt(up, standing(56, 160)), 30)[29]!.player;
    expect(rising.y).toBeCloseTo(140, 6);
    expect(rising.grounded).toBe(true);
    const down = levelOf([{ x0: 40, y0: 64, x1: 40, y1: 160, w: 32, h: 16 }]);
    const sinking = play(down, runAt(down, standing(56, 64)), 30)[29]!.player;
    expect(sinking.y).toBeCloseTo(84, 6);
    expect(sinking.grounded).toBe(true);
  });

  it('stops his head on its underside and he falls', () => {
    // Underside at y = 140; a full jump from the floor rises 56 px, so his head (14 above his feet) would reach y = 122.
    const level = levelOf([{ x0: 100, y0: 124, x1: 100, y1: 124, w: 32, h: 16 }]);
    const states = play(level, runAt(level, standing(116, 192)), 40, () => ({ move: 0, jumpHeld: true }));
    for (const s of states) expect(s.player.y - HITBOX.height).toBeGreaterThanOrEqual(140 - 1e-6);
    const bump = states.findIndex((s) => Math.abs(s.player.y - (140 + HITBOX.height)) < 1e-6 && s.player.y < 192);
    expect(bump).toBeGreaterThan(0);
    expect(states[bump]!.player.vy).toBeGreaterThanOrEqual(0);
    expect(states[bump + 1]!.player.vy).toBeGreaterThan(0);
  });

  it('stops him at its sides, from either direction', () => {
    const wall = levelOf([{ x0: 100, y0: 160, x1: 100, y1: 160, w: 32, h: 32 }]);
    const fromLeft = play(wall, runAt(wall, standing(60, 192)), 80, () => ({ move: 1, jumpHeld: false }));
    for (const s of fromLeft) expect(s.player.x).toBeLessThanOrEqual(100 - HALF + 1e-6);
    expect(fromLeft[79]!.player.x).toBeCloseTo(100 - HALF, 6);
    const fromRight = play(wall, runAt(wall, standing(180, 192)), 120, () => ({ move: -1, jumpHeld: false }));
    for (const s of fromRight) expect(s.player.x).toBeGreaterThanOrEqual(132 + HALF - 1e-6);
    expect(fromRight[119]!.player.x).toBeCloseTo(132 + HALF, 6);
  });

  it('pushes Poncho along when it moves sideways into him, with no life lost', () => {
    const level = levelOf([{ x0: 40, y0: 160, x1: 136, y1: 160, w: 16, h: 32 }]);
    // The step in which its face first passes his left edge (x = 94): it moves him to the face.
    const first = moveBlocks(standing(100, 192), level.blocks!, 57, level.world);
    expect(first.crushed).toBe(false);
    expect(first.player.x - HALF).toBeCloseTo(blockAt(level.blocks![0]!, 58).x + 16, 6);
    const states = play(level, runAt(level, standing(100, 192)), 120);
    const last = states[119]!;
    expect(last.player.x - HALF).toBeCloseTo(blockAt(level.blocks![0]!, last.platformTick).x + 16, 6);
    expect(last.player.x).toBeGreaterThan(100);
    expect(last.lives.lives).toBe(7);
    expect(last.phase).toBe('playing');
  });

  it('pushes him down when it comes down onto him in mid-air with room below, with no life lost', () => {
    const level = levelOf([{ x0: 92, y0: 40, x1: 92, y1: 136, w: 32, h: 16 }]);
    // His head (14 above his feet) is at y = 56, the block's underside after it has moved a step: 0.67 px of overlap.
    const pushed = moveBlocks(airborne(108, 70), level.blocks!, 0, level.world);
    expect(pushed.crushed).toBe(false);
    expect(pushed.player.y - HITBOX.height).toBeCloseTo(blockAt(level.blocks![0]!, 1).y + 16, 6);
    expect(pushed.player.vy).toBeGreaterThan(40 - 1e-6); // at least the block's own speed
    const next = stepRun(runAt(level, airborne(108, 70)), idle, level);
    expect(next.lives.lives).toBe(7);
    expect(next.phase).toBe('playing');
    expect(next.player.y).toBeGreaterThan(70);
  });

  it('carried sideways into a wall he stays against it while the block slides on under his feet, no crush', () => {
    // A wall at column 10 (x 160 to 176), rows 9 to 11; the block's top is level with the floor of row 11.
    const world = worldOf((r) => (r >= 9 ? '.'.repeat(10) + '#' + '.'.repeat(9) : '.'.repeat(20)));
    const level = levelOf([{ x0: 100, y0: 176, x1: 200, y1: 176, w: 32, h: 16 }], world);
    const states = play(level, runAt(level, standing(116, 176)), 60);
    const last = states[59]!;
    expect(last.player.x).toBeCloseTo(160 - HALF, 6);
    expect(last.player.y).toBe(176);
    expect(last.player.grounded).toBe(true);
    expect(blockAt(level.blocks![0]!, last.platformTick).x).toBeCloseTo(140, 6);
    expect(last.lives.lives).toBe(7);
    expect(last.phase).toBe('playing');
  });

  it('its side is not a wall to cling to: no cling, no wall kick', () => {
    const tall: MovingBlock = { x0: 100, y0: 40, x1: 100, y1: 40, w: 16, h: 120 };
    const level = levelOf([tall], open, {}, { wallCling: true });
    const toward = { move: 1, jumpHeld: false };
    const states = play(level, runAt(level, airborne(94, 60)), 24, () => toward);
    for (const s of states) {
      expect(s.player.clinging ?? false).toBe(false);
      expect(s.player.x).toBeLessThanOrEqual(94 + 1e-6);
    }
    expect(states[20]!.player.vy).toBeGreaterThan(60); // a clinging slide is capped at 60 px/s
    // A jump press beside it does not kick off it: no upward speed, no push away.
    const kick = play(level, runAt(level, airborne(94, 60)), 24, (i) => ({ move: 1, jumpHeld: i === 12 }));
    for (const s of kick.slice(12)) {
      expect(s.player.vy).toBeGreaterThan(0);
      expect(s.player.vx).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('GDD-WLD-05 jumping from a moving block (jump buffer, coyote time)', () => {
  const still: MovingBlock = { x0: 100, y0: 128, x1: 100, y1: 128, w: 32, h: 16 };
  const level = levelOf([still]);

  it('a jump press standing on it jumps at once', () => {
    const states = play(level, runAt(level, standing(116, 128)), 3, (i) => ({ move: 0, jumpHeld: i >= 1 }));
    expect(states[0]!.player.grounded).toBe(true);
    expect(states[1]!.player.vy).toBeLessThan(0);
    expect(states[1]!.player.y).toBeLessThan(128);
  });

  it('a press 3 steps before landing on it jumps on landing', () => {
    const start = runAt(level, airborne(116, 90));
    const fall = play(level, start, 40);
    const landing = fall.findIndex((s) => s.player.grounded);
    expect(landing).toBeGreaterThan(3);
    const tap = play(level, start, landing + 12, (i) => ({ move: 0, jumpHeld: i === landing - 3 }));
    const after = tap.slice(landing);
    expect(after.some((s) => s.player.vy < 0 && s.player.y < 128 - 2)).toBe(true);
  });

  it('a press 2 steps after walking off its edge still jumps (coyote time)', () => {
    const walk = { move: 1, jumpHeld: false };
    const start = runAt(level, standing(128, 128));
    const left = play(level, start, 60, () => walk);
    const off = left.findIndex((s) => !s.player.grounded);
    expect(off).toBeGreaterThan(0);
    const jump = play(level, start, off + 4, (i) => ({ move: 1, jumpHeld: i === off + 2 }));
    expect(jump[off + 2]!.player.vy).toBeLessThan(0);
    expect(jump[off + 2]!.player.y).toBeLessThan(jump[off + 1]!.player.y);
  });
});

const crushedAt = (states: RunState[]) => states.findIndex((s) => s.phase === 'respawning');
const floor = (level: Level, extra: Partial<RunState> = {}) => runAt(level, standing(108, 192), extra);

describe('GDD-LIFE-02 crushing', () => {
  // A block coming down onto Poncho standing on the floor at x = 108: its underside meets his head (y = 178) after ~93 steps.
  const dropper: MovingBlock = { x0: 100, y0: 100, x1: 100, y1: 176, w: 16, h: 16 };

  it('a block coming down onto Poncho on the floor costs one life', () => {
    const level = levelOf([dropper]);
    const states = play(level, floor(level), 130);
    const i = crushedAt(states);
    expect(i).toBeGreaterThan(80);
    expect(i).toBeLessThan(100);
    expect(states[i]!.lives.lives).toBe(6);
    expect(states[i]!.wait).toBe(RESPAWN.delaySteps);
    expect(states[i - 1]!.lives.lives).toBe(7);
    expect(states[129]!.lives.lives).toBe(6);
  });

  it('riding a block up into a ceiling costs one life', () => {
    const ceiling = worldOf((r) => (r === 6 ? '.'.repeat(5) + '#'.repeat(4) + '.'.repeat(11) : '.'.repeat(20)));
    const level = levelOf([{ x0: 100, y0: 176, x1: 100, y1: 100, w: 32, h: 16 }], ceiling);
    const states = play(level, runAt(level, standing(116, 176)), 120);
    const i = crushedAt(states);
    expect(i).toBeGreaterThan(60);
    expect(states[i]!.lives.lives).toBe(6);
    expect(states[i - 1]!.player.y).toBeGreaterThan(126 - 1); // head (14 above) was under the ceiling's underside, y = 112
  });

  it('a block pushing him sideways into a wall costs one life', () => {
    const world = worldOf((r) => (r >= 9 ? '.'.repeat(8) + '#' + '.'.repeat(11) : '.'.repeat(20)));
    const level = levelOf([{ x0: 40, y0: 160, x1: 136, y1: 160, w: 16, h: 32 }], world);
    const states = play(level, runAt(level, standing(100, 192)), 150);
    const i = crushedAt(states);
    expect(i).toBeGreaterThan(0);
    expect(states[i]!.lives.lives).toBe(6);
  });

  it('a block pushing him into a shut door costs one life (the run\'s combined solid world counts)', () => {
    const door: Door = { col: 8, row: 9, height: 3 };
    const level = levelOf([{ x0: 40, y0: 160, x1: 136, y1: 160, w: 16, h: 32 }], open, { doors: [door] });
    const states = play(level, runAt(level, standing(100, 192), { doorsOpen: [false] }), 150);
    const i = crushedAt(states);
    expect(i).toBeGreaterThan(0);
    expect(states[i]!.lives.lives).toBe(6);
  });

  it('costs one life and brings him back in Base, from Taco and from Fuego alike', () => {
    const level = levelOf([dropper]);
    for (const power of ['taco', 'fuego'] as const) {
      const states = play(level, floor(level, { power }), 130);
      const i = crushedAt(states);
      expect(i, power).toBeGreaterThan(0);
      expect(states[i]!.lives.lives, power).toBe(6);
      expect(states[i]!.power, power).toBe('base');
      expect(states[i - 1]!.power, power).toBe(power);
    }
  });

  it('costs one life even while invulnerable', () => {
    const level = levelOf([dropper]);
    const states = play(level, floor(level, { invulnerable: 1000 }), 130);
    const i = crushedAt(states);
    expect(i).toBeGreaterThan(0);
    expect(states[i - 1]!.invulnerable).toBeGreaterThan(0);
    expect(states[i]!.lives.lives).toBe(6);
    expect(states[i]!.invulnerable).toBe(0);
  });

  it('the block stands still during the wait and starts from its first end again after the respawn', () => {
    const level = levelOf([dropper]);
    const states = play(level, floor(level), 130);
    const i = crushedAt(states);
    const tick = states[i]!.platformTick;
    expect(blockAt(dropper, tick).y).toBeGreaterThan(dropper.y0 + 40);
    const wait = play(level, states[i]!, RESPAWN.delaySteps);
    for (const s of wait.slice(0, -1)) expect(s.platformTick).toBe(tick);
    const back = wait[wait.length - 1]!;
    expect(back.phase).toBe('playing');
    expect(back.platformTick).toBe(0);
    expect(blockAt(dropper, back.platformTick)).toMatchObject({ x: dropper.x0, y: dropper.y0 });
  });

  it('a push that has room is not a crush: no life lost', () => {
    const level = levelOf([{ x0: 40, y0: 160, x1: 136, y1: 160, w: 16, h: 32 }]);
    const states = play(level, runAt(level, standing(100, 192)), 150);
    expect(states.every((s) => s.lives.lives === 7 && s.phase === 'playing')).toBe(true);
  });
});
