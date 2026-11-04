import { describe, expect, it } from 'vitest';
import { bossStart, type BossState } from '../sim/boss';
import { spawn, type PlayerInput } from '../sim/movement';
import { medal } from '../sim/results';
import { startRun, stepRun, type Level, type RunState } from '../sim/run';
import { LEVEL_1_4 } from './level1-4';
import { LEVELS } from './index';
import { gaps } from './validate';

const world = LEVEL_1_4.world;
const STILL: PlayerInput = { move: 0, jumpHeld: false };
const DEF = LEVEL_1_4.boss!;

/** A run of 1-4 with Poncho standing at (x, y) facing `facing`, and the boss as given. */
const standing = (x: number, y: number, boss: BossState = bossStart(DEF, 0), facing: 1 | -1 = 1): RunState => ({ ...startRun(LEVEL_1_4), player: { ...spawn(x, y), grounded: true, facing }, boss });
/** Whether a jump from the floor at x, moving `move`, with jump held for `holdSteps`, lands on a pillar top (y = 176); he cannot be hurt meanwhile. */
function landsOnPillar(x: number, move: number, holdSteps: number): boolean {
  let run: RunState = { ...standing(x, 224), boss: { ...bossStart(DEF, 0), mode: 'hurt' } };
  let onTop = false;
  for (let i = 0; i < 90; i++) {
    run = stepRun(run, { move, jumpHeld: i < holdSteps }, LEVEL_1_4);
    if (run.player.grounded && run.player.y === 176) onTop = true;
  }
  return onTop;
}
function play(run: RunState, n: number, input: (i: number) => PlayerInput = () => STILL): RunState {
  let r = run;
  for (let i = 1; i <= n; i++) r = stepRun(r, input(i), LEVEL_1_4);
  return r;
}
/** A fresh run of 1-4 with `lives` left. */
const withLives = (lives: number): RunState => ({ ...startRun(LEVEL_1_4), lives: { lives, used: new Set<string>() } });
/** Steps a run of 1-4 with no input until Poncho loses a life (L-026: the measurement ends there) or `n` steps pass: that step, 0 if none, and the boss's mode as it began. */
function firstLoss(run: RunState, n: number): { step: number; mode: string } {
  let r = run;
  for (let i = 1; i <= n; i++) {
    const mode = r.boss!.mode;
    r = stepRun(r, STILL, LEVEL_1_4);
    if (r.lives.lives < 7) return { step: i, mode };
  }
  return { step: 0, mode: '' };
}

describe('GDD-BOS-02 level 1-4', () => {
  it('GDD-BOS-02 1-4 is 30 by 17 tiles, a World 1 level, no test level, and comes after 1-3, naming 2-1 as its next level', () => {
    expect(world.width).toBe(30);
    expect(world.height).toBe(17);
    const entry = LEVELS.find((e) => e.id === '1-4');
    expect(entry).toMatchObject({ world: 1, test: false });
    expect(entry!.level).toBe(LEVEL_1_4);
    expect(entry!.next).toBe('2-1');
    expect(LEVELS.find((e) => e.id === '1-3')!.next).toBe('1-4');
    expect(entry!.tips).toBeUndefined();
  });

  it('GDD-BOS-02 1-4 has the floor and the two pillars and no other solid tile', () => {
    const expected = new Set<string>();
    for (let c = 0; c < 30; c++) for (let r = 14; r <= 16; r++) expected.add(`${c},${r}`);
    for (const c of [0, 1, 2, 3, 26, 27, 28, 29]) for (let r = 11; r <= 13; r++) expected.add(`${c},${r}`);
    const found = new Set<string>();
    for (let c = 0; c < 30; c++) for (let r = 0; r < 17; r++) if (world.solidTile(c, r)) found.add(`${c},${r}`);
    expect(found).toEqual(expected);
    expect(gaps(world)).toEqual([]);
  });

  it('GDD-BOS-02 1-4 starts Poncho at column 14, has its boss and two rocks, and nothing else', () => {
    expect(LEVEL_1_4.spawn).toEqual({ x: 232, y: 224 });
    expect(LEVEL_1_4.boss).toEqual({ x: 240, y: 72, floor: 224 });
    expect(LEVEL_1_4.rocks).toEqual([
      { x: 56, y: 176 },
      { x: 424, y: 176 },
    ]);
    for (const empty of ['ofrendas', 'spikes', 'crumbles', 'springs', 'platforms', 'tacos', 'pinatas', 'doors', 'keys', 'fragiles', 'enemies'] as const) expect(LEVEL_1_4[empty], empty).toEqual([]);
    for (const none of ['exit', 'hilos', 'veladora', 'blocks', 'abilities'] as const) expect(LEVEL_1_4[none], none).toBeUndefined();
  });
});

describe('GDD-BOS-02 1-4 measured', () => {
  it('GDD-BOS-02 a full jump from the floor beside each pillar lands on its top, a short hop does not', () => {
    expect(landsOnPillar(80, -1, 40)).toBe(true);
    expect(landsOnPillar(400, 1, 40)).toBe(true);
    expect(landsOnPillar(80, -1, 1)).toBe(false);
    expect(landsOnPillar(400, 1, 1)).toBe(false);
  });

  it('GDD-BOS-02 on a pillar top nothing reaches Poncho in any phase, except within 5 px of its inner edge', () => {
    // Up to x 59 on the left pillar and from x 421 on the right his hurtbox stays clear of the dive and the drop beside the pillar,
    // whose box's side is flush with the pillar's wall (x 64 and 416).
    for (const x of [40, 59, 421, 440]) {
      for (const hits of [0, 1, 2]) expect(firstLoss(standing(x, 176, bossStart(DEF, hits)), 1000).step, `x ${x}, phase ${hits + 1}`).toBe(0);
    }
    // 1 px further in (the pillar top runs to x 64 and from 416, and Poncho stands on it with his middle up to 6 px past that), the dive
    // beside the pillar (phases 1 and 3) or the drop beside it (phase 2) reaches him.
    for (const [hits, mode] of [[0, 'dive'], [1, 'drop'], [2, 'dive']] as const) {
      expect(firstLoss(standing(60, 176, bossStart(DEF, hits)), 1000).mode, `x 60, phase ${hits + 1}`).toBe(mode);
      expect(firstLoss(standing(420, 176, bossStart(DEF, hits), -1), 1000).mode, `x 420, phase ${hits + 1}`).toBe(mode);
    }
  });

  it('GDD-BOS-02 standing anywhere on the floor between the pillars the phase 2 drop or sweep reaches Poncho', () => {
    // The first life lost is to his drop (beside the right pillar) or his sweep, not to a fruit (L-026).
    for (const x of [70, 150, 232, 330, 410]) expect(['drop', 'sweep'], `x ${x}`).toContain(firstLoss(standing(x, 224, bossStart(DEF, 1)), 460).mode);
  });

  it('GDD-PRG-03 in 1-4, which has no hilos, every hilo is none: gold with at most 3 lives lost in the level, else silver, never bronze', () => {
    // Started with 7 (the run's lives at 1-1): 4 left is 3 lost.
    expect(medal(withLives(4), LEVEL_1_4)).toBe('gold');
    expect(medal(withLives(3), LEVEL_1_4)).toBe('silver');
    expect(medal(withLives(1), LEVEL_1_4)).toBe('silver');
    // Started with 5, the lives carried from 1-3 (GDD-LIFE-05): the lives lost count, not the lives left.
    expect(medal({ ...startRun(LEVEL_1_4, undefined, 5), lives: { lives: 5, used: new Set<string>() } }, LEVEL_1_4)).toBe('gold');
    expect(medal({ ...startRun(LEVEL_1_4, undefined, 5), lives: { lives: 2, used: new Set<string>() } }, LEVEL_1_4)).toBe('gold');
    expect(medal({ ...startRun(LEVEL_1_4, undefined, 5), lives: { lives: 1, used: new Set<string>() } }, LEVEL_1_4)).toBe('silver');
  });

  it('GDD-BOS-02 no fruit falls on a pillar top', () => {
    let run = standing(40, 176);
    const landedOn: number[] = [];
    for (let i = 0; i < 1500; i++) {
      run = stepRun(run, STILL, LEVEL_1_4);
      for (const f of run.fruit) if (f.x < 64 || f.x > 416) landedOn.push(f.x);
    }
    expect(landedOn).toEqual([]);
  });

  it('GDD-BOS-02 the rock windows: 24 press steps from the pillar he drops beside, 65 from the one he climbs beside', () => {
    // Phase 2 from the right end: the lap ends on step 240, he drops at x 392 from step 270, sweeps left and climbs at x 88 from step 438.
    const presses = (x: number, facing: 1 | -1, from: number, to: number): number[] => {
      const hit: number[] = [];
      for (let at = from; at <= to; at++) if (play(standing(x, 176, bossStart(DEF, 1), facing), to + 60, (i) => ({ ...STILL, claw: i === at })).boss!.hits === 2) hit.push(at);
      return hit;
    };
    const drop = presses(440, -1, 260, 330);
    expect([drop[0], drop[drop.length - 1], drop.length]).toEqual([282, 305, 24]);
    const climb = presses(40, 1, 380, 480);
    expect([climb[0], climb[climb.length - 1], climb.length]).toEqual([402, 466, 65]);
    const run = play(standing(40, 176, bossStart(DEF, 1)), 438);
    expect(run.boss).toMatchObject({ mode: 'climb', x: 88 });
    expect(play(standing(40, 176, bossStart(DEF, 1)), 270).boss).toMatchObject({ mode: 'drop', x: 392 });
  });
});

/**
 * A bot for 1-4. Phases 1 and 3: it waits at the start; while he dives it runs to 64 px past where he aims, away from where he comes
 * from; while he is stuck it stands 38 px from his middle, facing him, and claws. Phase 2: it climbs the left pillar (from x 104 or less
 * on the floor it runs left and jumps) and stands at x 40 facing right; when he drops beside it with his middle 140 px down or lower and
 * the rock resting, it claws. It steps 30 px aside from a fruit falling right above it and jumps a fruit lying just ahead. It lets go of a
 * button for a step before pressing it again (L-048).
 */
function bot(level: Level, maxSteps: number): { run: RunState; steps: number } {
  let run = startRun(level);
  let steps = 0;
  let hold = 0;
  let jumpBefore = false;
  let clawBefore = false;
  while (run.phase !== 'clear' && steps < maxSteps) {
    const { x, y, grounded, facing } = run.player;
    const b = run.boss!;
    const phase = b.hits + 1;
    let target = x;
    let jump = false;
    let claw = false;
    let face: 0 | 1 | -1 = 0;
    if (run.phase === 'playing') {
      if (phase === 2 && b.mode !== 'hurt') {
        if (y > 176) {
          if (x > 104) target = 96;
          else {
            target = 0;
            jump = grounded;
          }
        } else {
          target = 40;
          face = 1;
          if (b.mode === 'drop' && b.x < 100 && b.y >= 140 && run.rocks[0]!.mode === 'rest') claw = true;
        }
      } else if (b.mode === 'stuck') {
        const side = x < b.x ? -1 : 1;
        target = b.x + side * 38;
        face = side === -1 ? 1 : -1;
        if (Math.abs(x - target) < 6) claw = true;
      } else if (b.mode === 'dive') {
        target = b.x < b.tx ? Math.min(400, b.tx + 64) : Math.max(80, b.tx - 64);
      } else if (phase !== 2) target = 232;
      for (const f of run.fruit) if (!f.landed && Math.abs(f.x - x) < 14 && f.y < y && y - f.y < 140) target = f.x < x ? x + 30 : x - 30;
    }
    let move = Math.abs(target - x) < 3 ? 0 : Math.sign(target - x);
    if (move === 0 && face !== 0 && facing !== face) move = face;
    for (const f of run.fruit) if (f.landed && grounded && move !== 0 && (f.x - x) * move > 0 && Math.abs(f.x - x) < 24) jump = true;
    if (jump && grounded && hold === 0 && !jumpBefore) hold = 20;
    const input: PlayerInput = { move, jumpHeld: hold > 0, claw: claw && !clawBefore };
    if (hold > 0) hold--;
    jumpBefore = input.jumpHeld;
    clawBefore = input.claw === true;
    run = stepRun(run, input, level);
    steps++;
  }
  return { run, steps };
}

describe('GDD-BOS-02 playing 1-4', () => {
  it('GDD-BOS-02 1-4 can be won from the start with all seven lives in under 1500 steps', () => {
    const { run, steps } = bot(LEVEL_1_4, 1500);
    expect(run.phase).toBe('clear');
    expect(steps).toBeLessThan(1500);
    expect(run.lives.lives).toBe(7);
    expect(run.boss).toMatchObject({ hits: 3, mode: 'defeated' });
  });
});
