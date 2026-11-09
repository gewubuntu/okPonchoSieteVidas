import { describe, expect, it } from 'vitest';
import { HIT_STOP } from '../config/tuning';
import { LEVEL_1_1 } from '../levels/level1-1';
import { LEVEL_1_4 } from '../levels/level1-4';
import { LEVEL_2_4 } from '../levels/level2-4';
import { bossStart, type BossState } from './boss';
import { estrellaStart, type EstrellaMode, type EstrellaState } from './estrella';
import { hitStopSteps } from './hitStop';
import { spawn, type PlayerInput } from './movement';
import { startRun, stepRun, type Level, type RunState } from './run';

// GDD-BOS-01: the hit-stop. The scene's loop holds still after the step a hit lands on a boss; this is the pure rule that says for how many
// steps. The expected numbers are the GDD's: 4 steps (67 ms) after a hit that leaves him hurt, 12 (200 ms) after the hit that defeats him.
const DON = LEVEL_1_4.boss!;
const ESTRELLA = LEVEL_2_4.estrella!;
const STILL: PlayerInput = { move: 0, jumpHeld: false };

/** A run of 1-4, or 2-4, with Poncho standing at (x, y) facing right, and the boss as given. */
const donFight = (x: number, y: number, boss: BossState): RunState => ({ ...startRun(LEVEL_1_4), player: { ...spawn(x, y), grounded: true }, boss });
const estrellaFight = (x: number, y: number, estrella: EstrellaState): RunState => ({ ...startRun(LEVEL_2_4), player: { ...spawn(x, y), grounded: true }, estrella });
/** Stuck in the sand at x, with `hits` taken. */
const stuckAt = (x: number, hits: number): BossState => ({ ...bossStart(DON, hits), mode: 'stuck', age: 0, x, y: 209, tx: x, ty: 209 });
/** La Estrella in `mode`, still there after a step, at x with her box's bottom at y, `hits` taken. */
const posed = (mode: EstrellaMode, x: number, y: number, hits: number): EstrellaState => ({ ...estrellaStart(ESTRELLA, hits), mode, age: 0, x, y, tx: x, ty: y });

/** The hold after each of `n` steps from `run` (`input(i)` is the input of step i, 1-based). */
function holds(run: RunState, level: Level, n: number, input: (i: number) => PlayerInput = () => STILL): number[] {
  const out: number[] = [];
  let r = run;
  for (let i = 1; i <= n; i++) {
    const before = r;
    r = stepRun(r, input(i), level);
    out.push(hitStopSteps(before, r));
  }
  return out;
}
const claw = (i: number): PlayerInput => ({ ...STILL, claw: i === 1 });

describe('GDD-BOS-01 hit-stop', () => {
  it('GDD-BOS-01 hit-stop: a claw hit that leaves Don Zopilote hurt holds 4 steps', () => {
    // The swing comes on the third step of a press; the hold is on that step only.
    expect(holds(donFight(200, 224, stuckAt(232, 0)), LEVEL_1_4, 6, claw)).toEqual([0, 0, 4, 0, 0, 0]);
  });

  it('GDD-BOS-01 hit-stop: the hit that defeats Don Zopilote holds 12 steps', () => {
    const run = donFight(200, 224, stuckAt(232, 2));
    expect(holds(run, LEVEL_1_4, 6, claw)).toEqual([0, 0, 12, 0, 0, 0]);
    expect(stepRun(stepRun(stepRun(run, claw(1), LEVEL_1_4), STILL, LEVEL_1_4), STILL, LEVEL_1_4).boss).toMatchObject({ hits: 3, mode: 'defeated' });
  });

  it('GDD-BOS-01 hit-stop: a rock knocked onto Don Zopilote holds 4 steps', () => {
    // On the left pillar the dive aims at x 88 and sticks him there on step 382; the claw knocks the rock off the pillar onto him.
    let run = donFight(40, 176, bossStart(DON, 0));
    for (let i = 0; i < 382; i++) run = stepRun(run, STILL, LEVEL_1_4);
    expect(run.boss).toMatchObject({ mode: 'stuck', x: 88, hits: 0 });
    const out = holds(run, LEVEL_1_4, 30, claw);
    expect(out.filter((n) => n > 0)).toEqual([HIT_STOP.hurtSteps]);
    let after = run;
    for (let i = 1; i <= 30; i++) after = stepRun(after, claw(i), LEVEL_1_4);
    // The hit was the rock's: it broke on him (the claw's own box never reached him from the pillar).
    expect(after.boss!.hits).toBe(1);
    expect(after.rocks[0]!.mode).toBe('gone');
  });

  it('GDD-BOS-01 hit-stop: a bump that leaves La Estrella hurt holds 4 steps', () => {
    // A jump from the left awning bumps her hanging over it (her bottom at 112).
    const run = estrellaFight(80, 176, posed('hang', 80, 112, 0));
    const out = holds(run, LEVEL_2_4, 30, () => ({ ...STILL, jumpHeld: true }));
    expect(out.filter((n) => n > 0)).toEqual([4]);
    let after = run;
    for (let i = 0; i < 30; i++) after = stepRun(after, { ...STILL, jumpHeld: true }, LEVEL_2_4);
    expect(after.estrella).toMatchObject({ hits: 1, mode: 'hurt' });
  });

  it('GDD-BOS-01 hit-stop: the hit that defeats La Estrella holds 12 steps', () => {
    const run = estrellaFight(60, 224, posed('hang', 90, 220, 2));
    expect(holds(run, LEVEL_2_4, 6, claw)).toEqual([0, 0, 12, 0, 0, 0]);
  });

  it('GDD-BOS-01 hit-stop: a step with no hit on a boss holds nothing in 1-4', () => {
    // A plain run of steps with him lapping, then diving and hurt after a hit: only the hit's own step holds.
    expect(holds({ ...startRun(LEVEL_1_4), invulnerable: 1000 }, LEVEL_1_4, 120).every((n) => n === 0)).toBe(true);
    expect(holds(donFight(200, 224, { ...stuckAt(232, 1), mode: 'hurt' }), LEVEL_1_4, 5)).toEqual([0, 0, 0, 0, 0]);
  });

  it('GDD-BOS-01 hit-stop: a step with no hit on a boss holds nothing in 2-4', () => {
    expect(holds({ ...startRun(LEVEL_2_4), invulnerable: 1000 }, LEVEL_2_4, 120).every((n) => n === 0)).toBe(true);
    expect(holds(estrellaFight(60, 224, posed('hurt', 90, 220, 1)), LEVEL_2_4, 5)).toEqual([0, 0, 0, 0, 0]);
  });

  it('GDD-BOS-01 hit-stop: a step with no hit on a boss holds nothing in a level with no boss', () => {
    expect(startRun(LEVEL_1_1).boss).toBeNull();
    expect(startRun(LEVEL_1_1).estrella).toBeNull();
    expect(holds(startRun(LEVEL_1_1), LEVEL_1_1, 30, () => ({ move: 1, jumpHeld: false, claw: true }))).toEqual(Array<number>(30).fill(0));
  });

  it('GDD-BOS-01 hit-stop: a step that costs Poncho a life holds nothing', () => {
    // A jump from the floor under her (her bottom at 188) would bump her, while a tejocote at his feet touches him: the life is lost
    // and the sim keeps no hit on her in that step.
    const run = { ...estrellaFight(80, 224, posed('hang', 80, 188, 0)), tejocotes: [{ x: 80, y: 224, dir: 1 as const, wait: 0 }] };
    const after = stepRun(run, { ...STILL, jumpHeld: true }, LEVEL_2_4);
    expect(after).toMatchObject({ phase: 'respawning', lives: { lives: 6 } });
    expect(after.estrella!.hits).toBe(0);
    expect(hitStopSteps(run, after)).toBe(0);
  });

  it('GDD-BOS-01 HIT_STOP is 4 and 12 steps, as GDD-BOS-01 says', () => {
    expect(HIT_STOP).toEqual({ hurtSteps: 4, defeatSteps: 12 });
  });
});
