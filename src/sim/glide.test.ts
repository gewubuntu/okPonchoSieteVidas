import { describe, expect, it } from 'vitest';
import { GLIDE, GRAVITY, RUN } from '../config/tuning';
import { flatWorld, spawn, step, type Abilities, type PlayerInput, type PlayerState } from './movement';
import { resumeHeld } from './pause';
import { startRun, stepRun, type Level } from './run';
import { parseTiles } from './tilemap';

const FLOOR = 0;
const flat = flatWorld(FLOOR);
const GLIDES: Abilities = { glide: true };
const idle: PlayerInput = { move: 0, jumpHeld: false };
const hold: PlayerInput = { move: 0, jumpHeld: true };
/** High above the floor, falling at `vy`, jump not held yet. */
const falling = (vy: number): PlayerState => ({ ...spawn(0, FLOOR), y: -400, vy, grounded: false });
/** The same, with jump already held for the 0.1 s it takes before a glide can start. */
const heldFalling = (vy: number): PlayerState => ({ ...falling(vy), jumpWasHeld: true, jumpHeldSteps: GLIDE.holdSteps });
/** Steps in the air of a jump with jump held throughout. */
const airSteps = (glide: boolean): number => {
  let s = step(spawn(0, FLOOR), hold, flat, { glide });
  let n = 0;
  while (!s.grounded && n < 1000) {
    s = step(s, hold, flat, { glide });
    n++;
  }
  return n;
};
const run = (s: PlayerState, input: PlayerInput, steps: number, abilities = GLIDES): PlayerState => {
  for (let i = 0; i < steps; i++) s = step(s, input, flat, abilities);
  return s;
};

describe('GDD-MOV-07 glide', () => {
  it('jump held while falling caps the fall speed at 70 px/s', () => {
    expect(GLIDE.fallSpeed).toBe(70);
    const s = step(heldFalling(300), hold, flat, GLIDES);
    expect(s.vy).toBe(70);
    expect(s.gliding).toBe(true);
    expect(run(s, hold, 60).vy).toBe(70); // and stays there
  });

  it('a fall slower than 70 px/s speeds up to 70 and no further', () => {
    let s = step(heldFalling(10), hold, flat, GLIDES);
    expect(s.vy).toBeGreaterThan(10);
    expect(s.vy).toBeLessThan(70);
    s = run(s, hold, 30);
    expect(s.vy).toBe(70);
  });

  it('without jump held he falls as usual, up to the terminal velocity', () => {
    const s = run(falling(300), idle, 60);
    expect(s.vy).toBe(GRAVITY.terminalVelocity);
    expect(s.gliding).toBe(false);
  });

  it('horizontal speed is unchanged: he still runs at full speed and steers as in the air', () => {
    const right: PlayerInput = { move: 1, jumpHeld: true };
    const glide = run({ ...heldFalling(300), vx: RUN.maxSpeed }, right, 20);
    const fall = run({ ...falling(300), vx: RUN.maxSpeed }, { move: 1, jumpHeld: false }, 20, { glide: false });
    expect(glide.vx).toBe(RUN.maxSpeed);
    expect(glide.vx).toBe(fall.vx);
    const turned = run({ ...heldFalling(300), vx: RUN.maxSpeed }, { move: -1, jumpHeld: true }, 10);
    const turnedFall = run({ ...falling(300), vx: RUN.maxSpeed }, { move: -1, jumpHeld: false }, 10, { glide: false });
    expect(turned.vx).toBe(turnedFall.vx);
  });

  it('lasts as long as jump is held: letting go ends it and he falls faster again', () => {
    let s = run(heldFalling(300), hold, 20);
    expect(s.gliding).toBe(true);
    s = step(s, idle, flat, GLIDES);
    expect(s.gliding).toBe(false);
    expect(s.vy).toBeGreaterThan(70);
  });

  it('a press while falling glides once jump has been held longer than the 0.1 s jump buffer (6 steps)', () => {
    expect(GLIDE.holdSteps).toBe(6);
    let s = falling(300);
    for (let i = 1; i <= 6; i++) {
      s = step(s, hold, flat, GLIDES);
      expect(s.gliding, `step ${i}`).toBe(false);
    }
    s = step(s, hold, flat, GLIDES);
    expect(s).toMatchObject({ gliding: true, vy: 70 });
  });

  it('a press just before landing is still a buffered jump (GDD-MOV-03), not a glide that lands too late for it', () => {
    let s: PlayerState = { ...spawn(0, FLOOR), y: -30, vy: 300, grounded: false };
    while (s.y < -10) s = step(s, idle, flat, GLIDES); // about 3 steps above the floor
    for (let i = 0; i < 10 && !(!s.grounded && s.vy < 0 && s.y < -1); i++) s = step(s, hold, flat, GLIDES);
    expect(s.vy).toBeLessThan(0); // jumped off the landing
  });

  it('letting go and pressing again in the air glides again after the same 0.1 s', () => {
    let s = run(heldFalling(300), hold, 10);
    s = run(s, idle, 10);
    expect(s.vy).toBeGreaterThan(70);
    s = run(s, hold, 6);
    expect(s.gliding).toBe(false);
    s = step(s, hold, flat, GLIDES);
    expect(s).toMatchObject({ gliding: true, vy: 70 });
  });

  it('holding jump from the jump itself through the top glides as soon as he starts to fall', () => {
    let s = step(spawn(0, FLOOR), hold, flat, GLIDES);
    expect(s.vy).toBeLessThan(0);
    while (s.vy < 0) {
      expect(s.gliding).toBe(false); // not while rising
      s = step(s, hold, flat, GLIDES);
    }
    expect(s.gliding).toBe(true);
    expect(s.vy).toBeLessThanOrEqual(70);
  });

  it('a glided fall from a jump lasts longer than a plain fall', () => {
    expect(airSteps(true)).toBeGreaterThan(airSteps(false) + 30);
  });

  it('ends on the step he lands', () => {
    let s: PlayerState = { ...heldFalling(70), y: -20 };
    for (let i = 0; i < 60 && !s.grounded; i++) {
      s = step(s, hold, flat, GLIDES);
      if (!s.grounded) expect(s.gliding).toBe(true);
    }
    expect(s).toMatchObject({ grounded: true, gliding: false, vy: 0 });
  });

  it('holding jump on the ground does not glide (nor rejump)', () => {
    let s = step(spawn(0, FLOOR), hold, flat, GLIDES);
    while (!s.grounded) s = step(s, hold, flat, GLIDES);
    for (let i = 0; i < 10; i++) {
      s = step(s, hold, flat, GLIDES);
      expect(s).toMatchObject({ grounded: true, gliding: false });
    }
  });

  it('only with the ability: without it, holding jump does nothing to a fall', () => {
    const s = run(falling(300), hold, 30, { glide: false });
    expect(s.gliding).toBe(false);
    expect(s.vy).toBe(GRAVITY.terminalVelocity);
    expect(step(falling(300), hold, flat).gliding).toBe(false); // left out means no ability
  });

  it('cannot start within 150 ms (9 steps) of a stomp bounce, and can after', () => {
    expect(GLIDE.stompLockSteps).toBe(9);
    let s: PlayerState = { ...heldFalling(300), glideLock: GLIDE.stompLockSteps };
    for (let i = 1; i < GLIDE.stompLockSteps; i++) {
      s = step(s, hold, flat, GLIDES);
      expect(s.gliding, `step ${i}`).toBe(false);
    }
    s = step(s, hold, flat, GLIDES); // the 9th step after the bounce: the lock has run out
    expect(s.gliding).toBe(true);
  });
});

// A floor at y = 96 with an Alacrán on it, and Poncho dropped onto it from above.
const world = parseTiles(['..........', '..........', '..........', '..........', '..........', '..........', '##########']);
const base: Level = { world, spawn: { x: 40, y: 96 }, ofrendas: [], spikes: [], crumbles: [], springs: [], platforms: [], tacos: [], pinatas: [], doors: [], keys: [], fragiles: [], enemies: [{ x: 120, y: 96 }] };

describe('GDD-MOV-07 glide in a run', () => {
  it('a level can turn the glide on (the sandbox does, until worlds unlock it, GDD-PRG-01); a level that does not, does not glide', () => {
    for (const glide of [true, false]) {
      let r = startRun({ ...base, abilities: { glide } });
      r = { ...r, player: { ...r.player, y: 20, grounded: false, vy: 200, jumpWasHeld: true, jumpHeldSteps: GLIDE.holdSteps } };
      r = stepRun(r, hold, { ...base, abilities: { glide } });
      expect(r.player.gliding, `glide ${glide}`).toBe(glide);
    }
    let r = startRun(base);
    r = { ...r, player: { ...r.player, y: 20, grounded: false, vy: 200, jumpWasHeld: true, jumpHeldSteps: GLIDE.holdSteps } };
    expect(stepRun(r, hold, base).player.gliding).toBe(false); // left out: off
  });

  it('a stomp bounce sets the 150 ms lock, so holding jump through the bounce does not glide early', () => {
    const level: Level = { ...base, abilities: { glide: true } };
    let r = startRun(level);
    // Gliding down onto it, jump held: the bounce ends the glide and locks it.
    r = { ...r, player: { ...r.player, x: r.enemies[0]!.x, y: 96 - 10 - 8, grounded: false, vy: 70, gliding: true, jumpWasHeld: true, jumpHeldSteps: 30 } };
    for (let i = 0; i < 20 && r.enemies[0]!.alive; i++) {
      r = stepRun(r, hold, level);
      if (r.enemies[0]!.alive) expect(r.player.gliding).toBe(true);
    }
    expect(r.enemies[0]!.alive).toBe(false);
    expect(r.player.vy).toBeLessThan(0);
    expect(r.player.glideLock).toBe(GLIDE.stompLockSteps);
    expect(r.player.gliding).toBe(false);
  });

  it('landing on a moving platform ends the glide on that step', () => {
    const level: Level = { ...base, abilities: { glide: true }, platforms: [{ x0: 20, y0: 60, x1: 20, y1: 60, w: 48 }] };
    let r = startRun(level);
    r = { ...r, player: { ...r.player, x: 40, y: 40, grounded: false, vy: 70, gliding: true, jumpWasHeld: true, jumpHeldSteps: 30 } };
    for (let i = 0; i < 40 && !r.player.grounded; i++) {
      r = stepRun(r, hold, level);
      if (!r.player.grounded) expect(r.player.gliding).toBe(true);
    }
    expect(r.player).toMatchObject({ grounded: true, gliding: false, y: 60 });
  });

  it('the sandbox level has the glide on', async () => {
    const { SANDBOX_ABILITIES } = await import('../levels/sandbox');
    expect(SANDBOX_ABILITIES).toEqual({ glide: true });
  });

});

describe('GDD-MOV-07 with GDD-UI-02: a jump pressed while paused does not glide on resume', () => {
  const level: Level = { ...base, abilities: { glide: true } };
  const fallingRun = () => {
    const r = startRun(level);
    return { ...r, player: { ...r.player, y: -400, grounded: false, vy: 200 } }; // high above the floor, so he is still falling throughout
  };

  it('pressed while paused and held through the resume: no glide until released and pressed again', () => {
    let r = resumeHeld(fallingRun(), hold);
    for (let i = 0; i < 20; i++) {
      r = stepRun(r, hold, level);
      expect(r.player.gliding, `step ${i + 1}`).toBe(false);
    }
    r = stepRun(r, idle, level);
    for (let i = 0; i <= GLIDE.holdSteps; i++) r = stepRun(r, hold, level);
    expect(r.player.gliding).toBe(true);
  });

  it('a glide held since before the pause carries on after it', () => {
    let r = fallingRun();
    for (let i = 0; i <= GLIDE.holdSteps; i++) r = stepRun(r, hold, level);
    expect(r.player.gliding).toBe(true);
    r = stepRun(resumeHeld(r, hold), hold, level);
    expect(r.player.gliding).toBe(true);
  });

  it('a jump still held after a respawn does not glide until pressed again', () => {
    const r = startRun(level);
    let p: PlayerState = { ...r.player, y: -400, grounded: false, vy: 200, jumpWasHeld: true };
    p = run(p, hold, 20);
    expect(p.gliding).toBe(false);
  });
});
