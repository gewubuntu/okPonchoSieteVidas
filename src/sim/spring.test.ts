import { describe, expect, it } from 'vitest';
import { SPRING, TILE } from '../config/tuning';
import { spawn, step, type PlayerInput, type PlayerState } from './movement';
import { bounce, withSprings, type Spring } from './spring';
import { startRun, stepRun, type Level, type RunState } from './run';
import { parseTiles } from './tilemap';
import { SANDBOX_CRUMBLES, SANDBOX_OFRENDAS, SANDBOX_PLATFORMS, SANDBOX_ROWS, SANDBOX_SPAWN, SANDBOX_SPIKES, SANDBOX_SPRINGS } from '../levels/sandbox';

const idle: PlayerInput = { move: 0, jumpHeld: false };
const right: PlayerInput = { move: 1, jumpHeld: false };

// A floor at row 8 (top y = 128) with a spring set into it at column 3 (x 48 to 64), flush with the floor.
const world = parseTiles([...Array.from({ length: 8 }, () => '..........'), '###.######']);
const spring: Spring = { col: 3, row: 8 };
const level: Level = { world, spawn: { x: 24, y: 8 * TILE }, ofrendas: [], spikes: [], crumbles: [], springs: [spring], platforms: [], tacos: [], pinatas: [], doors: [], keys: [], fragiles: [] };
const onSpring: PlayerState = spawn(56, 8 * TILE);

/** Plays from `r` with the given input for each step, returning every state, and the highest rise above the floor. */
function play(r: RunState, steps: number, input: (i: number) => PlayerInput = () => idle) {
  const states: RunState[] = [];
  for (let i = 0; i < steps; i++) {
    r = stepRun(r, input(i), level);
    states.push(r);
  }
  return { states, rise: 8 * TILE - Math.min(...states.map((s) => s.player.y)) };
}
/** Poncho dropped onto the spring from 30 px up. */
const drop = (): RunState => ({ ...startRun(level), player: { ...spawn(56, 8 * TILE - 30), grounded: false } });
const launched = (states: RunState[]) => states.find((s) => s.player.vy === -SPRING.velocity);

describe('GDD-WLD-05 spring', () => {
  it('is a solid tile like the floor', () => {
    expect(withSprings(world, [spring]).solidTile(3, 8)).toBe(true);
    expect(world.solidTile(3, 8)).toBe(false);
    expect(withSprings(world, []).solidTile(3, 8)).toBe(false);
  });

  it('launches Poncho up at 480 px/s the step he stands on it', () => {
    const r = bounce(onSpring, [spring]);
    expect(SPRING.velocity).toBe(480);
    expect(r).toMatchObject({ vy: -480, grounded: false, bounced: true });
    expect(r.y).toBe(onSpring.y);
  });

  it('does nothing when he is beside it, in the air above it, or below its top', () => {
    const beside = spawn(40, 8 * TILE); // body box 34 to 46, clear of the spring at 48
    const air = { ...onSpring, grounded: false };
    const sunk = { ...onSpring, y: 8 * TILE + 1 };
    for (const p of [beside, air, sunk]) expect(bounce(p, [spring])).toBe(p);
  });

  it('walking onto it from the floor launches him, up to the 480 px/s', () => {
    const { states } = play(startRun(level), 60, () => right);
    const first = launched(states)!;
    expect(first).toBeDefined();
    expect(first.player.x).toBeGreaterThan(48 - 6); // his body box has reached the spring tile
    expect(first.player.bounced).toBe(true);
  });

  it('landing on it from above launches him', () => {
    const r: RunState = { ...startRun(level), player: { ...spawn(56, 80), grounded: false } };
    expect(launched(play(r, 60).states)).toBeDefined();
  });

  it('throws him to about 77 px up, clearly higher than a jump (56 px)', () => {
    const r: RunState = { ...startRun(level), player: onSpring };
    const { rise } = play(r, 120);
    expect(rise).toBeGreaterThan(76); // 480 squared over 2 x 1500 = 76.8 px, a little more with the slow hang at the top
    expect(rise).toBeLessThan(90);
    const jump = play({ ...startRun(level), player: spawn(24, 8 * TILE) }, 120, (i) => ({ move: 0, jumpHeld: i < 40 }));
    expect(jump.rise).toBeLessThan(58);
  });

  it('releasing jump does not cut the launch short', () => {
    const held: RunState = { ...startRun(level), player: { ...onSpring, jumpWasHeld: true } };
    const released = play(held, 120, (i) => ({ move: 0, jumpHeld: i === 0 })); // held on the landing step, let go on the next
    const kept = play(held, 120, () => ({ move: 0, jumpHeld: true }));
    expect(released.states[1]!.player.vy).toBeLessThan(-400); // not cut to 0.4 of the launch
    expect(released.rise).toBeGreaterThan(76);
    expect(released.rise).toBeCloseTo(kept.rise, 5);
  });

  it('holding jump does not change the height: only a press counts', () => {
    const plain = play({ ...startRun(level), player: onSpring }, 120).rise;
    const held = play({ ...startRun(level), player: onSpring }, 120, () => ({ move: 0, jumpHeld: true })).rise;
    expect(held).toBeCloseTo(plain, 5);
  });

  it('walking onto it gives the plain 480 launch', () => {
    const { states } = play(startRun(level), 60, () => ({ move: 1, jumpHeld: false }));
    expect(launched(states)).toBeDefined();
  });

  describe('a jump pressed just before landing (a timed press)', () => {
    // `landing` is the step the launch happens on when dropped from 30 px up, found without any press.
    const landing = play(drop(), 60).states.findIndex((s) => s.player.vy < -400);
    /** The launch speed with one press on step `at`, and the jump held from then until the end. */
    const launchSpeed = (at: number, hold = true): number => {
      const { states } = play(drop(), 60, (i) => ({ move: 0, jumpHeld: hold ? i >= at : i === at }));
      return -states[landing]!.player.vy;
    };

    it('launches at 600 px/s, from 0.1 s (6 steps) before the landing up to the landing step itself', () => {
      expect(landing).toBeGreaterThan(8); // the fall is long enough to tell a press from holding
      expect(SPRING.boostVelocity).toBe(600);
      for (let back = 0; back <= 5; back++) expect(launchSpeed(landing - back)).toBe(600);
    });

    it('a press 6 or more steps early, or after the landing, gives the plain 480', () => {
      expect(launchSpeed(landing - 6)).toBe(480);
      expect(launchSpeed(0)).toBe(480);
      expect(launchSpeed(landing + 1)).toBe(480);
    });

    it('throws him to about 120 px up, 40 px more than the plain launch', () => {
      const { rise } = play(drop(), 160, (i) => ({ move: 0, jumpHeld: i >= landing - 2 }));
      expect(rise).toBeGreaterThan(118); // 600 squared over 2 x 1500 = 120 px, a little more with the slow hang at the top
      expect(rise).toBeLessThan(135);
    });

    it('letting go of jump does not cut the boosted launch', () => {
      const { states, rise } = play(drop(), 160, (i) => ({ move: 0, jumpHeld: i === landing - 2 || i === landing - 1 }));
      expect(states[landing + 1]!.player.vy).toBeLessThan(-550);
      expect(rise).toBeGreaterThan(118);
    });
  });

  it('a jump pressed the step after the launch does not replace it with a weaker 410 px/s jump', () => {
    const { states, rise } = play({ ...startRun(level), player: onSpring }, 120, (i) => ({ move: 0, jumpHeld: i === 1 }));
    expect(states[1]!.player.vy).toBeLessThan(-440);
    expect(rise).toBeGreaterThan(76);
  });

  it('the launch flag is gone once he falls, so a later jump is cut as usual', () => {
    const { states } = play({ ...startRun(level), player: onSpring }, 120);
    expect(states[states.length - 1]!.player.bounced).toBe(false);
    let p = spawn(24, 8 * TILE);
    p = step(p, { move: 0, jumpHeld: true }, level.world);
    p = step(p, { move: 0, jumpHeld: true }, level.world);
    const v = p.vy;
    expect(step(p, idle, level.world).vy).toBeCloseTo(v * 0.4 + 1500 / 60, 5); // cut to 0.4 on release (GDD-MOV-02), then rising gravity
  });
});

describe('GDD-WLD-05 the sandbox spring and its ledge', () => {
  // The ledge (tile columns 13 and 14, row 8) has its top at y = 128, 96 px above the floor next to the spring.
  const sandbox: Level = {
    world: parseTiles(SANDBOX_ROWS),
    spawn: SANDBOX_SPAWN,
    ofrendas: SANDBOX_OFRENDAS,
    spikes: SANDBOX_SPIKES,
    crumbles: SANDBOX_CRUMBLES,
    springs: SANDBOX_SPRINGS,
    platforms: SANDBOX_PLATFORMS,
    tacos: [],
    pinatas: [], doors: [], keys: [], fragiles: [],
  };
  /**
   * Drops onto the spring from 34 px up (he lands on step 11), optionally pressing jump on step 8, which is inside the
   * 0.1 s before the landing, and drifting right once he is above the ledge. Whether he ever stands on the ledge.
   */
  const reachesLedge = (timed: boolean): boolean => {
    let r: RunState = { ...startRun(sandbox), player: { ...spawn(200, 190), grounded: false } };
    let up = false;
    for (let i = 0; i < 300; i++) {
      up ||= r.player.vy <= -400;
      const drift = up && r.player.y < 128 ? 1 : 0;
      r = stepRun(r, { move: drift, jumpHeld: timed && i >= 8 && !up }, sandbox);
      if (r.player.grounded && r.player.y === 128) return true;
    }
    return false;
  };

  it('a timed press lands on the ledge, 96 px up', () => {
    expect(reachesLedge(true)).toBe(true);
  });

  it('the plain launch falls short of it', () => {
    expect(reachesLedge(false)).toBe(false); // it keeps bouncing on the spring, 77 px up, 19 px short
  });
});
