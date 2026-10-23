import { describe, expect, it } from 'vitest';
import { FORGIVENESS, GLIDE, GRAVITY, HITBOX, JUMP, RUN, SPRING, TILE, WALL } from '../config/tuning';
import { spawn, step, type Abilities, type PlayerInput, type PlayerState, type World } from './movement';
import { resumeHeld } from './pause';
import { startRun, stepRun, type Level } from './run';
import { parseTiles } from './tilemap';
import { SANDBOX_ROWS, SANDBOX_SPRINGS } from '../levels/sandbox';

// A wall along x = 0 (everything left of it is solid) and a floor at y = 0.
const walled: World = { solidTile: (tx, ty) => tx < 0 || ty >= 0 };
const CLING: Abilities = { wallCling: true };
const BOTH: Abilities = { wallCling: true, glide: true };
const FLUSH = HITBOX.width / 2; // feet x of a Poncho touching the wall
const idle: PlayerInput = { move: 0, jumpHeld: false };
const toward: PlayerInput = { move: -1, jumpHeld: false };
const away: PlayerInput = { move: 1, jumpHeld: false };
const jump = (move = 0): PlayerInput => ({ move, jumpHeld: true });
/** In the air beside the wall, high up, moving at `vy`. */
const atWall = (vy: number, x = FLUSH): PlayerState => ({ ...spawn(x, 0), y: -300, vy, grounded: false, coyote: 0 });
const run = (s: PlayerState, input: PlayerInput, steps: number, abilities: Abilities = CLING): PlayerState => {
  for (let i = 0; i < steps; i++) s = step(s, input, walled, abilities);
  return s;
};

describe('GDD-MOV-08 wall cling', () => {
  it('pressing toward a wall while falling slows the slide to 60 px/s', () => {
    expect(WALL.slideSpeed).toBe(60);
    const s = step(atWall(300), toward, walled, CLING);
    expect(s).toMatchObject({ clinging: true, vy: 60, x: FLUSH });
    expect(run(s, toward, 60).vy).toBe(60);
  });

  it('a slower fall speeds up to 60 and no further', () => {
    let s = step(atWall(10), toward, walled, CLING);
    expect(s.vy).toBeLessThan(60);
    s = run(s, toward, 30);
    expect(s.vy).toBe(60);
  });

  it('not without pressing toward the wall: idle or pressing away falls as usual', () => {
    for (const input of [idle, away]) {
      const s = run(atWall(300), input, 3);
      expect(s.clinging, JSON.stringify(input)).toBe(false);
      expect(s.vy).toBeGreaterThan(60);
    }
  });

  it('not while rising: pressing toward the wall on the way up does not slow him', () => {
    const s = step(atWall(-300), toward, walled, CLING);
    expect(s.clinging).toBe(false);
    expect(s.vy).toBeLessThan(0);
    expect(s.vy).toBe(-300 + GRAVITY.rising * (1 / 60));
  });

  it('not away from a wall: pressing left in open air falls as usual', () => {
    const s = run(atWall(300, 100), toward, 3);
    expect(s.clinging).toBe(false);
    expect(s.vy).toBeGreaterThan(60);
  });

  it('not on the ground: standing against the wall pressing toward it just stands', () => {
    const s = run({ ...spawn(FLUSH, 0) }, toward, 10);
    expect(s).toMatchObject({ grounded: true, clinging: false, vy: 0 });
  });

  it('ends on landing', () => {
    let s: PlayerState = { ...atWall(60), y: -20 };
    for (let i = 0; i < 60 && !s.grounded; i++) {
      s = step(s, toward, walled, CLING);
      if (!s.grounded) expect(s.clinging).toBe(true);
    }
    expect(s).toMatchObject({ grounded: true, clinging: false });
  });

  it('only with the ability', () => {
    expect(step(atWall(300), toward, walled).clinging).toBe(false);
    expect(step(atWall(300), toward, walled, { glide: true }).vy).toBeGreaterThan(60);
  });

  it('the cling wins over the glide: against the wall pressing toward it with jump held, he slides at 60 px/s', () => {
    const held: PlayerState = { ...atWall(300), jumpWasHeld: true, jumpHeldSteps: GLIDE.holdSteps };
    const s = step(held, jump(-1), walled, BOTH);
    expect(s).toMatchObject({ clinging: true, gliding: false, vy: 60 });
    // Off the wall (pressing away), the glide takes over.
    const off = step({ ...held, x: 100 }, jump(1), walled, BOTH);
    expect(off).toMatchObject({ clinging: false, gliding: true, vy: GLIDE.fallSpeed });
  });

  it('works on a wall to his right too', () => {
    const right: World = { solidTile: (tx, ty) => tx >= 10 || ty >= 0 };
    const s = step({ ...atWall(300), x: 160 - FLUSH }, { move: 1, jumpHeld: false }, right, CLING);
    expect(s).toMatchObject({ clinging: true, vy: 60 });
  });
});

describe('GDD-MOV-08 wall kick', () => {
  it('jump pressed against a wall in the air kicks away at 130 px/s across and 380 px/s up', () => {
    expect([WALL.kickX, WALL.kickY]).toEqual([130, 380]);
    const s = step(atWall(60), jump(-1), walled, CLING);
    expect(s.vx).toBe(130); // away from the wall on his left
    expect(s.vy).toBeCloseTo(-380 + GRAVITY.rising / 60, 9);
    expect(s.facing).toBe(1);
    expect(s.x).toBeGreaterThan(FLUSH);
  });

  it('from a wall on his right it kicks left', () => {
    const right: World = { solidTile: (tx, ty) => tx >= 10 || ty >= 0 };
    const s = step({ ...atWall(60), x: 160 - FLUSH }, jump(1), right, CLING);
    expect(s.vx).toBe(-130);
    expect(s.facing).toBe(-1);
  });

  it('works whenever he touches the wall in the air: rising, falling, pressing toward it or not', () => {
    for (const vy of [-200, 0, 300]) {
      for (const move of [-1, 0, 1]) {
        const s = step(atWall(vy), jump(move), walled, CLING);
        expect(s.vy, `vy ${vy} move ${move}`).toBeLessThan(-300);
      }
    }
  });

  it('then locks sideways control for 120 ms (7 steps): pressing back toward the wall does not turn him', () => {
    expect(WALL.lockSteps).toBe(7);
    let s = step(atWall(60), jump(-1), walled, CLING);
    for (let i = 1; i <= 7; i++) {
      s = step(s, jump(-1), walled, CLING);
      expect(s.vx, `step ${i}`).toBe(130);
    }
    s = step(s, jump(-1), walled, CLING);
    expect(s.vx).toBeLessThan(130); // control is back: air acceleration toward the wall
    expect(s.vx).toBe(130 - RUN.airAccel / 60);
  });

  it('only on a press: holding jump against the wall kicks once', () => {
    let s = step(atWall(60), jump(-1), walled, CLING);
    s = run(s, jump(0), 30);
    const before = s;
    s = run({ ...s, x: FLUSH, vx: 0, vy: 60 }, jump(-1), 1);
    expect(s.vy).toBeGreaterThan(0); // still held: no second kick
    expect(before.jumpWasHeld).toBe(true);
  });

  it('a jump that is a normal jump (on the ground, or in coyote time) stays a normal jump', () => {
    const ground = step(spawn(FLUSH, 0), jump(-1), walled, CLING);
    expect(ground.vy).toBe(-JUMP.velocity + GRAVITY.rising / 60);
    expect(ground.vx).toBeLessThanOrEqual(0);
    const coyote = step({ ...atWall(10), coyote: 3 }, jump(-1), walled, CLING);
    expect(coyote.vx).toBeLessThanOrEqual(0);
    expect(coyote.vy).toBe(-JUMP.velocity + GRAVITY.rising / 60);
  });

  it('kicks within 0.1 s (6 steps) of leaving the wall, and not after', () => {
    expect(WALL.graceSteps).toBe(FORGIVENESS.coyoteSteps);
    // Drift off the wall: one step touching, then moving away.
    const touching = step(atWall(60), idle, walled, CLING);
    const off = (n: number) => run({ ...touching, vx: 60 }, idle, n);
    expect(off(1).x).toBeGreaterThan(FLUSH);
    const late = (n: number) => step(off(n), jump(0), walled, CLING);
    expect(late(5).vx).toBe(130);
    expect(late(5).vy).toBeLessThan(-300);
    const tooLate = late(6);
    expect(tooLate.vy).toBeGreaterThan(-300);
  });

  it('one kick per touch: a second press on the way out, inside the 0.1 s, does not kick again', () => {
    let s = step(atWall(60), jump(-1), walled, CLING);
    s = step(s, idle, walled, CLING);
    s = step(s, jump(0), walled, CLING);
    expect(s.vy).toBeGreaterThan(-380 + 3 * GRAVITY.rising / 60 - 1); // only gravity since the kick, no new kick
    expect(s.vx).toBe(130);
  });

  it('releasing jump while rising cuts the kick like a jump (GDD-MOV-02)', () => {
    expect(JUMP.cutMultiplier).toBe(0.4);
    const kicked = step(atWall(60), jump(-1), walled, CLING);
    expect(kicked.vy).toBe(-380 + 1500 / 60);
    const released = step(kicked, idle, walled, CLING);
    expect(released.vy).toBeCloseTo((-380 + 1500 / 60) * 0.4 + 1500 / 60, 9); // cut to 0.4, then a step of rising gravity
    const held = step(kicked, jump(0), walled, CLING);
    expect(held.vy).toBeCloseTo(-380 + 2 * (1500 / 60), 9); // held on: not cut
  });

  it('not while rising from a spring: that launch is fixed (GDD-WLD-05); falling again, it kicks', () => {
    const launched: PlayerState = { ...atWall(-SPRING.velocity), bounced: true };
    const pressed = step(launched, jump(-1), walled, CLING);
    expect(pressed.vy).toBe(-SPRING.velocity + 1500 / 60); // only gravity: no kick
    expect(pressed.vx).toBeLessThanOrEqual(0);
    const falling: PlayerState = { ...atWall(60), bounced: false };
    expect(step(falling, jump(-1), walled, CLING).vx).toBe(130);
  });

  it('only with the ability: without it a jump in the air beside a wall does nothing', () => {
    const s = step(atWall(60), jump(-1), walled);
    expect(s.vy).toBeGreaterThan(0);
  });

  it('a jump pressed while paused, or held through a respawn, does not kick (GDD-UI-02)', () => {
    const s = step({ ...atWall(60), jumpWasHeld: true }, jump(-1), walled, CLING);
    expect(s.vy).toBeGreaterThan(0);
  });
});

// The run passes the level's abilities on, and the pause marks held buttons.
const world = parseTiles(['..........', '..........', '..........', '..........', '..........', '..........', '##########']);
const base: Level = { world, spawn: { x: 40, y: 96 }, ofrendas: [], spikes: [], crumbles: [], springs: [], platforms: [], tacos: [], pinatas: [], doors: [], keys: [], fragiles: [], enemies: [] };

/** A run in `level` with Poncho falling fast beside the level's left edge. */
const at = (level: Level) => {
  const r = startRun(level);
  return { ...r, player: { ...r.player, x: FLUSH, y: 40, grounded: false, vy: 300, coyote: 0 } };
};

describe('GDD-MOV-08 in a run', () => {
  it('a level turns it on; left out, it is off', () => {
    const on: Level = { ...base, abilities: { wallCling: true } };
    expect(stepRun(at(on), toward, on).player.clinging).toBe(true);
    expect(stepRun(at(base), toward, base).player.clinging).toBe(false);
  });

  it('a jump pressed while paused and held through the resume does not kick', () => {
    const on: Level = { ...base, abilities: { wallCling: true } };
    const r = startRun(on);
    const air = { ...r, player: { ...r.player, x: FLUSH, y: 40, grounded: false, vy: 60, coyote: 0 } };
    const s = stepRun(resumeHeld(air, jump(-1)), jump(-1), on);
    expect(s.player.vy).toBeGreaterThan(0);
  });

  it('a stomp bounce off an enemy ends a wall slide', () => {
    const on: Level = { ...base, abilities: { wallCling: true }, enemies: [{ x: 14, y: 96 }] };
    let r = startRun(on);
    r = { ...r, player: { ...r.player, x: FLUSH, y: 82, grounded: false, vy: 60, coyote: 0 } }; // 4 px above its top (86), before it walks away
    for (let i = 0; i < 30 && r.enemies[0]!.alive; i++) {
      r = stepRun(r, toward, on);
      if (r.enemies[0]!.alive) expect(r.player.clinging).toBe(true);
    }
    expect(r.enemies[0]!.alive).toBe(false);
    expect(r.player.clinging).toBe(false);
  });

  it('landing on a moving platform ends a wall slide on that step', () => {
    const on: Level = { ...base, abilities: { wallCling: true }, platforms: [{ x0: 0, y0: 60, x1: 0, y1: 60, w: 48 }] };
    let r = startRun(on);
    r = { ...r, player: { ...r.player, x: FLUSH, y: 30, grounded: false, vy: 60, coyote: 0 } };
    for (let i = 0; i < 40 && !r.player.grounded; i++) {
      r = stepRun(r, toward, on);
      if (!r.player.grounded) expect(r.player.clinging).toBe(true);
    }
    expect(r.player).toMatchObject({ grounded: true, clinging: false, y: 60 });
  });

  it('on the sandbox spring against the 2-tile wall, a jump pressed during the launch does not cut it short', () => {
    // The spring is at column 12 (x 192 to 208, top y = 224); the wall to its left fills columns 10 and 11 up to y = 192.
    expect(SANDBOX_SPRINGS).toEqual([{ col: 12, row: 14 }]);
    const level: Level = { ...base, world: parseTiles(SANDBOX_ROWS), springs: SANDBOX_SPRINGS, abilities: { wallCling: true } };
    const rise = (pressAt: number | null) => {
      let r = startRun(level);
      r = { ...r, player: { ...r.player, x: 12 * TILE + FLUSH, y: 14 * TILE, grounded: true, vy: 0 } };
      // Only the first launch: up to its top, where he stops rising. A kick would push him away from the wall (vx > 0).
      let top = r.player.y;
      for (let i = 0; i < 60; i++) {
        r = stepRun(r, { move: -1, jumpHeld: pressAt !== null && i >= pressAt }, level);
        if (i > 0 && r.player.vy >= 0) break;
        expect(r.player.vx, `step ${i}`).toBeLessThanOrEqual(0);
        top = Math.min(top, r.player.y);
      }
      return 14 * TILE - top;
    };
    const plain = rise(null);
    expect(plain).toBeGreaterThan(70); // the plain launch, about 77 px (GDD-WLD-05)
    for (const pressAt of [2, 5]) expect(rise(pressAt), `press at step ${pressAt}`).toBeCloseTo(plain, 6);
  });

  it('the sandbox has it on', async () => {
    const { SANDBOX_ABILITIES } = await import('../levels/sandbox');
    expect(SANDBOX_ABILITIES).toEqual({ glide: true, wallCling: true });
  });
});
