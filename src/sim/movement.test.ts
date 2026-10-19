import { describe, expect, it } from 'vitest';
import { FORGIVENESS, GRAVITY, RUN, STEP, TICK_HZ } from '../config/tuning';
import { flatWorld, spawn, step, type PlayerInput, type PlayerState, type World } from './movement';

const FLOOR = 0;
const flat = flatWorld(FLOOR);
const scripted = (i: number): PlayerInput => ({ move: Math.sin(i / 9) > 0 ? 1 : -1, jumpHeld: i % 40 < 20 });
const idle: PlayerInput = { move: 0, jumpHeld: false };
const right: PlayerInput = { move: 1, jumpHeld: false };

const run = (s: PlayerState, input: PlayerInput, steps: number, world: World = flat): PlayerState => {
  for (let i = 0; i < steps; i++) s = step(s, input, world);
  return s;
};

/** Plays a full jump from standstill or steady run. Returns peak height, horizontal distance and air time. */
function fullJump(runSpeedInput: number, holdSteps: number) {
  let s = run(spawn(0, FLOOR), { move: runSpeedInput, jumpHeld: false }, 30);
  const x0 = s.x;
  let peak = 0;
  let airSteps = 0;
  s = step(s, { move: runSpeedInput, jumpHeld: true }, flat);
  for (let i = 0; !s.grounded && i < 600; i++) {
    peak = Math.max(peak, FLOOR - s.y);
    airSteps++;
    s = step(s, { move: runSpeedInput, jumpHeld: i < holdSteps }, flat);
  }
  return { peak, distance: s.x - x0, airSeconds: airSteps * STEP };
}

/** Presses jump `stepsBeforeLanding` steps before touching the floor, then plays on. */
function pressBeforeLanding(stepsBeforeLanding: number): PlayerState {
  let fall: PlayerState = { ...spawn(0, FLOOR), y: -200, grounded: false };
  const states: PlayerState[] = [fall];
  while (!fall.grounded) {
    fall = step(fall, idle, flat);
    states.push(fall);
  }
  let t = states[states.length - 1 - stepsBeforeLanding]!;
  for (let i = 0; i < stepsBeforeLanding + 2; i++) t = step(t, { move: 0, jumpHeld: true }, flat);
  return t;
}

function playScripted(): PlayerState {
  let s = spawn(0, FLOOR);
  for (let i = 0; i < 600; i++) s = step(s, scripted(i), flat);
  return s;
}

describe('GDD-MOV-01 run', () => {
  it('reaches max speed in 0.15 s and never exceeds it', () => {
    const s = run(spawn(0, FLOOR), right, TICK_HZ);
    expect(s.vx).toBe(RUN.maxSpeed);
    expect(run(spawn(0, FLOOR), right, 8).vx).toBeLessThan(RUN.maxSpeed);
    expect(run(spawn(0, FLOOR), right, 9).vx).toBeCloseTo(RUN.maxSpeed, 5);
  });

  it('stops using ground deceleration', () => {
    const s = run(run(spawn(0, FLOOR), right, 30), idle, 8);
    expect(s.vx).toBe(0);
  });

  it('turns around faster than it accelerates', () => {
    const fast = run(spawn(0, FLOOR), right, 30);
    const turned = run(fast, { move: -1, jumpHeld: false }, 1);
    expect(fast.vx - turned.vx).toBeCloseTo(RUN.turnAccel * STEP, 5);
  });

  it('accelerates less in the air', () => {
    const air = { ...spawn(0, -50), grounded: false };
    expect(step(air, right, flat).vx).toBeCloseTo(RUN.airAccel * STEP, 5);
  });
});

describe('GDD-MOV-02 jump', () => {
  it('full jump peaks at about 56 px (3.5 tiles)', () => {
    const { peak } = fullJump(0, 1000);
    expect(peak).toBeGreaterThan(54.5);
    expect(peak).toBeLessThan(57.5);
  });

  it('releasing the button at once gives a short hop of about 15 px (under one tile)', () => {
    // The takeoff step already rises before a release can register, so the minimum hop is above the 9 px
    // that cutting the full takeoff speed alone would give.
    const { peak } = fullJump(0, 0);
    expect(peak).toBeGreaterThan(12);
    expect(peak).toBeLessThan(18);
  });

  it('holding jump after landing does not jump again', () => {
    let s = spawn(0, FLOOR);
    s = step(s, { move: 0, jumpHeld: true }, flat);
    for (let i = 0; i < 300; i++) s = step(s, { move: 0, jumpHeld: true }, flat);
    expect(s.grounded).toBe(true);
    expect(s.vy).toBe(0);
  });
});

describe('GDD-MOV-03 input forgiveness', () => {
  const ledge: World = { floorAt: (x) => (x < 50 ? FLOOR : Infinity) };

  function walkOffAndPress(stepsAfterLeaving: number): PlayerState {
    let s = spawn(40, FLOOR);
    for (let guard = 0; s.grounded && guard < 200; guard++) s = step(s, right, ledge); // first airborne state
    for (let i = 0; i < stepsAfterLeaving; i++) s = step(s, right, ledge);
    return step(s, { move: 1, jumpHeld: true }, ledge);
  }

  it('allows a jump up to 100 ms after leaving a ledge', () => {
    expect(walkOffAndPress(FORGIVENESS.coyoteSteps - 2).vy).toBeLessThan(0);
  });

  it('refuses a jump well after the coyote window', () => {
    expect(walkOffAndPress(FORGIVENESS.coyoteSteps + 3).vy).toBeGreaterThan(0);
  });

  it('remembers a jump pressed up to 100 ms before landing', () => {
    expect(pressBeforeLanding(FORGIVENESS.bufferSteps - 2).vy).toBeLessThan(0);
  });

  it('forgets a jump pressed much earlier than that', () => {
    const t = pressBeforeLanding(FORGIVENESS.bufferSteps + 4);
    expect(t.vy).toBeGreaterThanOrEqual(0);
  });
});

describe('GDD-MOV-04 gravity and falling', () => {
  it('never exceeds terminal velocity', () => {
    let s: PlayerState = { ...spawn(0, 5000), grounded: false };
    let max = 0;
    for (let i = 0; i < 600; i++) {
      s = step(s, idle, flat);
      max = Math.max(max, s.vy);
    }
    expect(max).toBeLessThanOrEqual(GRAVITY.terminalVelocity);
  });

  it('is deterministic: the same inputs give the same state', () => {
    expect(playScripted()).toEqual(playScripted());
  });
});

describe('GDD-TEC-05 derived jump numbers (GDD section 4)', () => {
  it('full jump peaks at 56 px within 1.5 px', () => {
    expect(Math.abs(fullJump(0, 1000).peak - 56)).toBeLessThan(1.5);
  });

  it('full jump at full run speed covers about 66 to 68 px, within one step of travel', () => {
    const { distance } = fullJump(1, 1000);
    // one step at full speed is 2 px, which is the resolution of landing time
    expect(Math.abs(distance - 66)).toBeLessThanOrEqual(RUN.maxSpeed * STEP + 0.5);
  });
});
