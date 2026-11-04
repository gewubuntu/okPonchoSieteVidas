import { describe, expect, it } from 'vitest';
import { AWNING, FORGIVENESS, JUMP, SPRING, STOMP, TILE, WALL } from '../config/tuning';
import { awningTops, landOnAwnings, type Awning } from './awning';
import { spawn, type Abilities, type PlayerInput, type PlayerState } from './movement';
import { resumeHeld } from './pause';
import { startRun, stepRun, type Level, type RunState } from './run';
import { parseTiles } from './tilemap';

const idle: PlayerInput = { move: 0, jumpHeld: false };
const hold: PlayerInput = { move: 0, jumpHeld: true };

const base = { ofrendas: [], spikes: [], crumbles: [], springs: [], platforms: [], tacos: [], pinatas: [], doors: [], keys: [], fragiles: [], enemies: [] } as const;

// 40 tiles wide, 17 tall, the floor's top at row 14 (y = 224). Column 25 is a wall from row 0 to row 13, its left face at x = 400.
const rows = (extra: (col: number, row: number) => boolean = () => false) =>
  parseTiles(Array.from({ length: 17 }, (_row, r) => Array.from({ length: 40 }, (_, c) => (r >= 14 || extra(c, r) ? '#' : '.')).join('')));
const FLOOR = 14 * TILE;
// Two awnings 48 px above the floor (Poncho walks under them): A over columns 6 to 9, B over columns 12 to 15. W against the wall.
const A: Awning = { x: 96, y: 176, w: 64 };
const B: Awning = { x: 192, y: 176, w: 64 };
const W: Awning = { x: 336, y: 176, w: 64 };
const world = rows((c, r) => c === 25 && r < 14);
const levelOf = (awnings: readonly Awning[], more: Partial<Level> = {}): Level => ({ ...base, world, spawn: { x: 40, y: FLOOR }, awnings, ...more });
const level = levelOf([A, B, W]);

/** A run with Poncho in the air, his feet `h` px above A's top at x, falling from rest. */
const above = (lv: Level, x: number, h: number, extra: Partial<PlayerState> = {}): RunState => ({ ...startRun(lv), player: { ...spawn(x, A.y - h), grounded: false, ...extra } });

function play(lv: Level, r: RunState, steps: number, input: (i: number) => PlayerInput = () => idle): RunState[] {
  const states: RunState[] = [];
  for (let i = 0; i < steps; i++) {
    r = stepRun(r, input(i), lv);
    states.push(r);
  }
  return states;
}

/** The steps that threw him up off an awning: on its top, rising. */
const rebounds = (states: readonly RunState[]): number[] => states.flatMap((s, i) => (s.player.y === A.y && s.player.vy < 0 && !s.player.grounded ? [i] : []));
/** The first step he stands on the awning's top. */
const settled = (states: readonly RunState[]): number => states.findIndex((s) => s.player.grounded && s.player.y === A.y);
/** The speed of the first rebound. */
const first = (states: readonly RunState[]): number => states[rebounds(states)[0]!]!.player.vy;
/** The highest his feet get above A's top from step `from` to the next rebound or landing, whichever comes first (L-026). */
function peakAfter(states: readonly RunState[], from: number): number {
  let top = states[from]!.player.y;
  for (let i = from + 1; i < states.length; i++) {
    const p = states[i]!.player;
    if (p.vy >= 0 && p.y >= top) break;
    top = Math.min(top, p.y);
  }
  return A.y - top;
}

describe('GDD-WLD-10 awning: a one-way surface', () => {
  it('he lands on it from above when his 12 px body box overlaps it by any amount, and falls past it when it only touches', () => {
    const edge = play(level, above(level, A.x - 5.9, 20), 30);
    expect(edge.some((s) => s.player.y === A.y)).toBe(true);
    const touching = play(level, above(level, A.x - 6, 20), 40);
    expect(touching.some((s) => s.player.y === A.y)).toBe(false);
    expect(touching.at(-1)!.player).toMatchObject({ y: FLOOR, grounded: true });
  });

  it('he jumps up through it from below and comes down on it', () => {
    const r: RunState = { ...startRun(level), player: spawn(128, FLOOR) };
    const states = play(level, r, 60, (i) => ({ move: 0, jumpHeld: i < 40 }));
    const through = states.findIndex((s) => s.player.y < A.y);
    expect(through).toBeGreaterThan(0);
    expect(states[through]!.player.vy).toBeLessThan(0); // still rising as he passes its top
    expect(states.slice(0, through).every((s) => s.player.y > A.y)).toBe(true); // nothing caught him on the way up
    const caught = states.findIndex((s) => s.player.y === A.y);
    expect(Math.min(...states.slice(0, caught).map((s) => s.player.y))).toBeCloseTo(FLOOR - 56.4, 0); // an ordinary jump peak
    expect(states.slice(through).some((s) => s.player.y === A.y)).toBe(true);
  });

  it('he passes through it from the side', () => {
    // Feet 4 px below its top, rising slowly, moving right across its whole width at the run speed.
    const r: RunState = { ...startRun(level), player: { ...spawn(A.x - 20, A.y + 4), grounded: false, vx: 120, vy: -100 } };
    const states = play(level, r, 60, () => ({ move: 1, jumpHeld: false }));
    expect(states.find((s) => s.player.x > A.x + A.w + 6)).toBeDefined();
    expect(states.every((s) => s.player.vx === 120 && s.player.y > A.y)).toBe(true);
  });

  it('a level tile with its top at the awning\'s height wins: he lands on the tile, with no rebound', () => {
    // A tile at column 10, row 11 (top y = 176), against A's right end.
    const lv: Level = { ...levelOf([A]), world: rows((c, r) => c === 10 && r === 11) };
    const states = play(lv, above(lv, 160, 40, { awningChain: 2 }), 90, () => hold);
    const landing = states.find((s) => s.player.y === A.y)!;
    expect(landing.player).toMatchObject({ grounded: true, vy: 0, awningChain: 0 });
    expect(landing.awningBounce).toBeNull();
  });
});

describe('GDD-WLD-10 awning: a plain landing', () => {
  it('a fall of 1 tile lands at about 265 px/s and settles at once: he stands on it', () => {
    let speed = 0;
    let r = above(level, 128, 16);
    for (let i = 0; i < 30 && !r.player.grounded; i++) {
      speed = r.player.vy;
      r = stepRun(r, idle, level);
    }
    expect(r.player).toMatchObject({ y: A.y, grounded: true, vy: 0 });
    expect(speed).toBeGreaterThan(230); // the speed a step before the landing; it lands at about 265 (design section 0)
    const after = play(level, r, 30);
    expect(after.every((s) => s.player.y === A.y && s.player.grounded)).toBe(true);
  });

  it('a fall of 2 tiles or more rebounds once at half the 360 px/s landing speed, 180 px/s, then he stands on it', () => {
    const states = play(level, above(level, 128, 64), 90);
    const hops = rebounds(states);
    expect(hops).toHaveLength(1);
    expect(states[hops[0]!]!.player.vy).toBe(-180);
    const settle = settled(states);
    expect(settle).toBeGreaterThan(hops[0]!);
    expect(states.slice(settle).every((s) => s.player.y === A.y && s.player.grounded)).toBe(true);
    expect(peakAfter(states, hops[0]!)).toBeCloseTo(11.3, 0); // h(180) = (180² − 1600) / 3000 + 1.07 (design section 0)
  });

  it('half the landing speed; under 150 px/s he stands', () => {
    const before = { ...spawn(128, A.y - 1), grounded: false };
    const at = (vy: number) => landOnAwnings(before, { ...before, y: A.y + 1, vy }, idle, [A], [false]).player;
    expect(at(300)).toMatchObject({ vy: -150, grounded: false, y: A.y });
    expect(at(299.9)).toMatchObject({ vy: 0, grounded: true, y: A.y });
    expect(AWNING.plainFactor).toBe(0.5);
    expect(AWNING.settleSpeed).toBe(150);
  });

  it('standing on it he jumps the ordinary 410 px/s jump, once the late press is over, to about 56 px', () => {
    const states = play(level, above(level, 128, 16), 80, (i) => ({ move: 0, jumpHeld: i >= 20 && i < 60 }));
    const jump = states[20]!;
    expect(jump.player.vy).toBeGreaterThan(-JUMP.velocity); // took off at 410 and gravity acted on it
    expect(jump.player.vy).toBeLessThan(-JUMP.velocity + 30);
    expect(jump.player.takeoff).toBe('jump');
    expect(peakAfter(states, 20)).toBeGreaterThan(54);
    expect(peakAfter(states, 20)).toBeLessThan(58);
  });
});

describe('GDD-WLD-10 awning: held rebounds, the hold ladder', () => {
  it('landing with jump held throws him up at 480, then 540, then 600 px/s, and 600 after that', () => {
    expect(AWNING.tiers).toEqual([SPRING.velocity, 540, SPRING.boostVelocity]);
    const states = play(level, above(level, 128, 32), 400, () => hold);
    expect(rebounds(states).slice(0, 4).map((i) => states[i]!.player.vy)).toEqual([-480, -540, -600, -600]);
    expect(rebounds(states).slice(0, 4).map((i) => states[i]!.player.awningChain)).toEqual([1, 2, 3, 3]);
  });

  it('his feet peak about 77, 98 and 120 px over the awning (L-003, measured)', () => {
    const states = play(level, above(level, 128, 32), 300, () => hold);
    const [one, two, three] = rebounds(states).map((i) => peakAfter(states, i));
    expect(one).toBeGreaterThan(76);
    expect(one).toBeLessThan(80);
    expect(two).toBeGreaterThan(97);
    expect(two).toBeLessThan(101);
    expect(three).toBeGreaterThan(119);
    expect(three).toBeLessThan(124);
  });

  it('a jump pressed in the 0.1 s buffer before the landing counts as held, even if let go before it', () => {
    const plain = play(level, above(level, 128, 64), 30);
    const land = rebounds(plain)[0]!;
    for (let k = 0; k < FORGIVENESS.bufferSteps; k++) {
      const states = play(level, above(level, 128, 64), 30, (i) => ({ move: 0, jumpHeld: i === land - k }));
      expect(states[land]!.player.vy, `pressed ${k} steps before`).toBe(-480);
    }
    const early = play(level, above(level, 128, 64), 30, (i) => ({ move: 0, jumpHeld: i === land - FORGIVENESS.bufferSteps }));
    expect(early[land]!.player.vy).toBe(-180);
  });

  it('a jump held through a respawn does not count until it is pressed again (GDD-LIFE-02)', () => {
    // He is in the pit; the checkpoint is over A, 32 px above its top. Jump is held all along, which also skips the wait.
    const r: RunState = { ...startRun(level), checkpoint: { x: 128, y: A.y - 32 }, player: { ...spawn(128, 400), grounded: false } };
    const states = play(level, r, 80, () => hold);
    const back = states.findIndex((s) => s.phase === 'playing' && s.player.y < A.y);
    expect(back).toBeGreaterThan(0);
    const hop = rebounds(states.slice(back))[0]!;
    expect(states[back + hop]!.player.vy).toBe(-180);
    // Nor does it count as a late press while it stays held.
    expect(states.slice(back).some((s) => s.player.vy <= -480)).toBe(false);
  });

  it('a jump pressed while paused and held through the resume does not count; one held since before the pause does (GDD-UI-02)', () => {
    const r = above(level, 128, 32);
    expect(first(play(level, resumeHeld(r, hold), 30, () => hold))).toBe(-180);
    const holding = play(level, r, 3, () => hold).at(-1)!;
    expect(first(play(level, resumeHeld(holding, hold), 30, () => hold))).toBe(-480);
  });

  it('a rebound keeps his speed across (air control as in any jump)', () => {
    const before = { ...spawn(128, A.y - 1), grounded: false, vx: 87, jumpHeldSteps: 5 };
    expect(landOnAwnings(before, { ...before, y: A.y + 1, vy: 300 }, hold, [A], [false]).player.vx).toBe(87);
    expect(landOnAwnings(before, { ...before, y: A.y + 1, vy: 300, jumpHeldSteps: 0 }, idle, [A], [false]).player.vx).toBe(87);
  });

  it('releasing jump while rising cuts the rebound like a jump (x 0.4)', () => {
    const hop = rebounds(play(level, above(level, 128, 32), 60, () => hold))[0]!;
    // Held up to and including the landing step, let go on the next.
    const cut = play(level, above(level, 128, 32), 60, (i) => ({ move: 0, jumpHeld: i <= hop }));
    expect(cut[hop + 1]!.player.vy).toBeGreaterThan(-480 * JUMP.cutMultiplier);
    expect(cut[hop + 1]!.player.vy).toBeLessThan(-480 * JUMP.cutMultiplier + 30);
    expect(peakAfter(cut, hop)).toBeLessThan(20);
  });
});

describe('GDD-WLD-10 awning: the chain', () => {
  it('goes on from one awning to the next: 480 on A, then 540 on B', () => {
    const states = play(level, above(level, 148, 32), 120, () => ({ move: 1, jumpHeld: true }));
    const bounces = states.filter((s, i) => i > 0 && s.awningBounce !== states[i - 1]!.awningBounce).map((s) => s.awningBounce);
    expect(bounces.slice(0, 2)).toEqual([
      { awning: 0, tier: 1, at: expect.any(Number) },
      { awning: 1, tier: 2, at: expect.any(Number) },
    ]);
  });

  it('a jump taken from a settled awning is 410, and landing back on it holding jump is tier 1: 56, 77, 98, 120 px from standing', () => {
    const r: RunState = { ...startRun(level), player: spawn(128, A.y) };
    const states = play(level, r, 400, () => hold);
    expect(states[0]!.player.takeoff).toBe('jump');
    const hops = rebounds(states);
    expect(hops.slice(0, 3).map((i) => states[i]!.player.vy)).toEqual([-480, -540, -600]);
    expect(peakAfter(states, 0)).toBeGreaterThan(54);
    expect(peakAfter(states, 0)).toBeLessThan(58);
  });

  it('goes back to 0 on a plain landing, and the late press then gives the tier after the last', () => {
    const states = play(level, above(level, 128, 64, { awningChain: 2 }), 30);
    const hop = rebounds(states)[0]!;
    expect(states[hop]!.player).toMatchObject({ vy: -180, awningChain: 0, awningLateTier: 3 });
  });

  it('goes back to 0 on landing on the floor', () => {
    const r: RunState = { ...startRun(level), player: { ...spawn(40, FLOOR - 20), grounded: false, awningChain: 2 } };
    expect(play(level, r, 20).at(-1)!.player).toMatchObject({ grounded: true, awningChain: 0 });
  });

  it('goes back to 0 on landing on a moving platform, a cordel and a spring', () => {
    const platformLevel = levelOf([A], { platforms: [{ x0: 16, y0: 160, x1: 16, y1: 160, w: 48 }] });
    const onPlatform = play(platformLevel, { ...startRun(platformLevel), player: { ...spawn(40, 140), grounded: false, awningChain: 2 } }, 20).at(-1)!;
    expect(onPlatform.player).toMatchObject({ y: 160, grounded: true, awningChain: 0 });
    const cordelLevel = levelOf([A], { cordeles: [{ x: 16, y: 160, w: 48 }] });
    const onCordel = play(cordelLevel, { ...startRun(cordelLevel), player: { ...spawn(40, 140), grounded: false, awningChain: 2 } }, 20).at(-1)!;
    expect(onCordel.player).toMatchObject({ y: 160, grounded: true, awningChain: 0 });
    const springLevel: Level = { ...levelOf([A]), world: rows((c, r) => c === 2 && r === 13), springs: [{ col: 2, row: 13 }] };
    const sprung = play(springLevel, { ...startRun(springLevel), player: { ...spawn(40, 190), grounded: false, awningChain: 2 } }, 20);
    const launch = sprung.find((s) => s.player.vy === -SPRING.velocity)!;
    expect(launch.player.awningChain).toBe(0);
  });

  it('goes back to 0 when a life is lost', () => {
    const r: RunState = { ...startRun(level), awningBounce: { awning: 0, tier: 2, at: 0 }, player: { ...spawn(128, 400), grounded: false, awningChain: 2, awningLate: 3, awningLateTier: 3 } };
    const back = play(level, r, 60).find((s, i, all) => i > 0 && all[i - 1]!.phase === 'respawning' && s.phase === 'playing')!;
    expect(back.player.awningChain ?? 0).toBe(0);
    expect(back.player.awningLate ?? 0).toBe(0);
    expect(back.awningBounce).toBeNull();
  });
});

describe('GDD-WLD-10 awning: the late press', () => {
  it('a jump pressed in the 6 steps after a plain rebound leaves at the tier from that step; the 7th is too late', () => {
    const plain = play(level, above(level, 128, 64), 30);
    const hop = rebounds(plain)[0]!;
    for (let k = 1; k <= AWNING.lateSteps; k++) {
      const states = play(level, above(level, 128, 64), 30, (i) => ({ move: 0, jumpHeld: i === hop + k }));
      expect(states[hop + k]!.player, `pressed ${k} steps after`).toMatchObject({ vy: -480, awningChain: 1 });
      expect(states[hop + k]!.player.y).toBeLessThan(A.y); // from where he is in the air
    }
    expect(AWNING.lateSteps).toBe(FORGIVENESS.bufferSteps);
    const late = play(level, above(level, 128, 64), 30, (i) => ({ move: 0, jumpHeld: i === hop + AWNING.lateSteps + 1 }));
    expect(late[hop + AWNING.lateSteps + 1]!.player.vy).toBeGreaterThan(-180);
  });

  it('a jump pressed in the 6 steps after settling leaves at the tier from the awning\'s top; the 7th is the ordinary jump', () => {
    const plain = play(level, above(level, 128, 16), 30);
    const land = settled(plain);
    for (let k = 1; k <= AWNING.lateSteps; k++) {
      const states = play(level, above(level, 128, 16), 30, (i) => ({ move: 0, jumpHeld: i === land + k }));
      expect(states[land + k]!.player, `pressed ${k} steps after`).toMatchObject({ vy: -480, y: A.y, awningChain: 1 });
      expect(states[land + k]!.player.takeoff).toBeUndefined(); // a rebound, not a jump (GDD-AUD-02)
    }
    const late = play(level, above(level, 128, 16), 30, (i) => ({ move: 0, jumpHeld: i === land + AWNING.lateSteps + 1 }));
    expect(late[land + AWNING.lateSteps + 1]!.player.takeoff).toBe('jump');
  });

  it('it gives the tier the landing would have given held: after a tier 1 rebound, 540', () => {
    const r = above(level, 128, 64, { awningChain: 1 });
    const plain = play(level, r, 30);
    const hop = rebounds(plain)[0]!;
    const late = play(level, r, 30, (i) => ({ move: 0, jumpHeld: i === hop + 1 }));
    expect(late[hop + 1]!.player).toMatchObject({ vy: -540, awningChain: 2 });
  });
});

describe('GDD-WLD-10 awning: the late press, once', () => {
  it('one late press per landing: let go and pressed again, the second press does nothing', () => {
    const plain = play(level, above(level, 128, 64), 30);
    const hop = rebounds(plain)[0]!;
    const states = play(level, above(level, 128, 64), 30, (i) => ({ move: 0, jumpHeld: i === hop + 1 || i === hop + 3 }));
    expect(states[hop + 1]!.player.vy).toBe(-480);
    expect(states[hop + 3]!.player.vy).toBeGreaterThan(-400);
  });

  it('it ends on landing on the floor: a jump from there is the ordinary jump', () => {
    const r: RunState = { ...startRun(level), player: { ...spawn(40, FLOOR - 2), grounded: false, vy: 200, awningLate: 6, awningLateTier: 2 } };
    const states = play(level, r, 4, (i) => ({ move: 0, jumpHeld: i === 2 }));
    expect(states[0]!.player.grounded).toBe(true);
    expect(states[2]!.player.takeoff).toBe('jump');
    expect(states[2]!.player.vy).toBeGreaterThan(-JUMP.velocity);
  });

  it('a rebound leaves no coyote time: let go and pressed again on the way up, no jump replaces it', () => {
    // Just above the awning, falling fast, with the coyote time of a ledge just left and jump held since before: he lands on step 0.
    const r = above(level, 128, 2, { vy: 300, coyote: FORGIVENESS.coyoteSteps, jumpWasHeld: true, jumpHeldSteps: 3 });
    const states = play(level, r, 10, (i) => ({ move: 0, jumpHeld: i === 0 || i === 2 }));
    const hop = 0;
    expect(states[hop]!.player.vy).toBe(-480);
    expect(states[hop + 2]!.player.takeoff).toBeUndefined();
  });
});

describe('GDD-WLD-10 awning: the torn awning', () => {
  const T: Awning = { ...A, torn: true };
  const torn = levelOf([T]);

  it('a held landing gives the tier as usual and the chain goes on', () => {
    const states = play(torn, above(torn, 128, 32, { awningChain: 1 }), 30, () => hold);
    expect(states[rebounds(states)[0]!]!.player).toMatchObject({ vy: -540, awningChain: 2 });
  });

  it('a plain landing always rebounds, at least at 180 px/s, even from a 1-tile fall', () => {
    expect(AWNING.tornMinSpeed).toBe(180);
    const states = play(torn, above(torn, 128, 16), 30);
    expect(states[rebounds(states)[0]!]!.player.vy).toBe(-180);
  });

  it('it is gone from the next step: he falls through it to the floor', () => {
    const states = play(torn, above(torn, 128, 16), 90);
    const hop = rebounds(states)[0]!;
    expect(states[hop]!.awningsGone).toEqual([true]);
    expect(states[hop - 1]!.awningsGone).toEqual([false]);
    expect(rebounds(states)).toHaveLength(1);
    expect(states.at(-1)!.player).toMatchObject({ y: FLOOR, grounded: true });
  });

  it('it is whole again after a lost life', () => {
    const states = play(torn, above(torn, 128, 16), 90);
    const gone = states.at(-1)!;
    const fall: RunState = { ...gone, player: { ...gone.player, y: 400, grounded: false } };
    const back = play(torn, fall, 60).find((s) => s.phase === 'playing' && s.player.y === FLOOR)!;
    expect(back.awningsGone).toEqual([false]);
  });

  it('two torn awnings: one already gone stays gone when the other tears', () => {
    const lv = levelOf([{ ...A, torn: true }, { ...B, torn: true }]);
    const r: RunState = { ...above(lv, 224, 16), awningsGone: [true, false] };
    const states = play(lv, r, 30);
    expect(states.find((s) => s.awningsGone[1])!.awningsGone).toEqual([true, true]);
  });

  it('a whole awning is never gone', () => {
    const states = play(level, above(level, 128, 16), 60);
    expect(states.every((s) => s.awningsGone.every((g) => !g))).toBe(true);
  });
});

describe('GDD-WLD-10 awning: a stomp in the same step wins', () => {
  // An Alacrán on the floor (its top at y = 214) and an awning whose top is 2 px under it, so his feet cross both in one step.
  const S: Awning = { x: 96, y: 216, w: 64 };
  const stompLevel = levelOf([S], { enemies: [{ x: 128, y: FLOOR }] });
  const falling = (extra: Partial<PlayerState> = {}): RunState => ({ ...startRun(stompLevel), player: { ...spawn(128, 190), grounded: false, vy: 360, awningChain: 2, ...extra } });

  it('the stomp\'s bounce, no rebound, the chain kept', () => {
    const states = play(stompLevel, falling(), 10);
    const hit = states.findIndex((s) => s.stomped);
    expect(hit).toBeGreaterThanOrEqual(0);
    expect(states[hit - 1]?.player.y ?? 190).toBeLessThanOrEqual(S.y);
    expect(states[hit]!.player.y).toBeGreaterThanOrEqual(S.y);
    expect(states[hit]!.player).toMatchObject({ vy: -STOMP.bounce, awningChain: 2 });
    expect(states[hit]!.awningBounce).toBeNull();
  });

  it('the stomp boost reads jump held, and a press in the buffer (L-024)', () => {
    const held = play(stompLevel, falling({ jumpHeldSteps: 5, jumpWasHeld: true }), 40, () => hold);
    expect(held.find((s) => s.stomped)!.player.vy).toBe(-STOMP.boostBounce);
    const buffered = play(stompLevel, falling(), 10, (i) => ({ move: 0, jumpHeld: i === 0 }));
    expect(buffered.find((s) => s.stomped)!.player.vy).toBe(-STOMP.boostBounce);
  });
});

describe('GDD-WLD-10 awning: the other rules on the jump button (L-024)', () => {
  it('jump buffer: a press just before landing on the floor beside an awning is a jump', () => {
    const r: RunState = { ...startRun(level), player: { ...spawn(40, FLOOR - 20), grounded: false } };
    const land = play(level, r, 30).findIndex((s) => s.player.grounded);
    const states = play(level, r, 30, (i) => ({ move: 0, jumpHeld: i === land - 2 }));
    expect(states[land]!.player.grounded).toBe(true);
    expect(states[land + 1]!.player.takeoff).toBe('jump');
  });

  it('coyote time: walking off a settled awning\'s end, a press in the next 0.1 s is the ordinary jump', () => {
    const r: RunState = { ...startRun(level), player: spawn(A.x + A.w - 2, A.y) };
    let s = r;
    let i = 0;
    while (s.player.grounded && i++ < 60) s = stepRun(s, { move: 1, jumpHeld: false }, level);
    expect(s.player.grounded).toBe(false);
    s = stepRun(s, { move: 1, jumpHeld: true }, level);
    expect(s.player.takeoff).toBe('jump');
  });

  it('variable jump: a tap from a settled awning jumps lower than a held jump', () => {
    const r: RunState = { ...startRun(level), player: spawn(128, A.y) };
    const tap = play(level, r, 60, (i) => ({ move: 0, jumpHeld: i < 2 }));
    const full = play(level, r, 60, (i) => ({ move: 0, jumpHeld: i < 30 }));
    expect(peakAfter(tap, 0)).toBeLessThan(25);
    expect(peakAfter(full, 0)).toBeGreaterThan(54);
  });

  it('glide: a held, glided fall onto an awning is a held rebound, and he glides again on the way down', () => {
    const glide: Abilities = { glide: true };
    const lv = levelOf([A], { abilities: glide });
    const states = play(lv, above(lv, 128, 64), 240, () => hold);
    const hops = rebounds(states);
    expect(states[hops[0]!]!.player.vy).toBe(-480);
    expect(states[hops[0]! - 1]!.player.gliding).toBe(true);
    expect(states[hops[0]!]!.player.gliding).toBe(false); // the landing ends the glide, as on a floor
    expect(states.slice(hops[0]).some((s) => s.player.gliding)).toBe(true);
    expect(states[hops[1]!]!.player.vy).toBe(-540);
  });

  it('wall cling on: a late press beside a wall kicks off it, the kick wins', () => {
    const lv = levelOf([W], { abilities: { wallCling: true } });
    const r: RunState = { ...startRun(lv), player: { ...spawn(W.x + W.w - 6, W.y - 64), grounded: false } };
    const plain = play(lv, r, 40);
    const hop = rebounds(plain)[0]!;
    const kicked = play(lv, r, 40, (i) => ({ move: 0, jumpHeld: i === hop + 1 }))[hop + 1]!;
    expect(kicked.player).toMatchObject({ takeoff: 'kick', vx: -WALL.kickX });
    expect(kicked.player.awningChain ?? 0).toBe(0);
  });

  it('wall cling on: landing or standing on an awning ends a wall slide, as on a floor', () => {
    const lv = levelOf([W], { abilities: { wallCling: true } });
    // Jump held since before (a press here would kick off the wall), sliding down the wall onto the awning.
    const r: RunState = { ...startRun(lv), player: { ...spawn(W.x + W.w - 6, W.y - 40), grounded: false, jumpWasHeld: true, jumpHeldSteps: 20 } };
    const held = play(lv, r, 60, () => ({ move: 1, jumpHeld: true }));
    const hop = rebounds(held)[0]!;
    expect(held[hop - 1]!.player.clinging).toBe(true);
    expect(held[hop]!.player.clinging).toBe(false);
    const standing = play(lv, { ...startRun(lv), player: spawn(W.x + W.w - 6, W.y) }, 10, () => ({ move: 1, jumpHeld: false }));
    expect(standing.every((s) => s.player.grounded && s.player.clinging === false)).toBe(true);
  });

  it('wall cling off: the same press is the late press', () => {
    const lv = levelOf([W]);
    const r: RunState = { ...startRun(lv), player: { ...spawn(W.x + W.w - 6, W.y - 64), grounded: false } };
    const plain = play(lv, r, 40);
    const hop = rebounds(plain)[0]!;
    expect(play(lv, r, 40, (i) => ({ move: 0, jumpHeld: i === hop + 1 }))[hop + 1]!.player.vy).toBe(-480);
  });
});

describe('GDD-WLD-10 awning tops for other things that land', () => {
  it('lists the awnings that are there: a torn one after its bounce is not', () => {
    expect(awningTops([A, { ...B, torn: true }], [false, true])).toEqual([{ x: 96, y: 176, w: 64 }]);
    expect(awningTops([A, B], [false, false])).toEqual([
      { x: 96, y: 176, w: 64 },
      { x: 192, y: 176, w: 64 },
    ]);
  });
});
