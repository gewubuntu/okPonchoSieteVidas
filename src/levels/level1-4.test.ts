import { describe, expect, it } from 'vitest';
import { BOSS, BOSS_ART } from '../config/tuning';
import { bossCrown, bossStart, type BossState, type RockState } from '../sim/boss';
import { shakeStarts, type ShakeDef } from '../sim/shake';
import { bossPose } from '../ui/bossPose';
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
function bot(level: Level, maxSteps: number, each: (run: RunState) => void = () => {}): { run: RunState; steps: number } {
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
    each(run);
  }
  return { run, steps };
}

/** How far past his box's bottom each look reaches, in game px (`scripts/art/boss.test.mjs` measures the frames). */
const BELOW: Partial<Record<string, number>> = { flapDown: BOSS_ART.wingsBelow, climbDown: BOSS_ART.wingsBelow, tumbleA: 7, tumbleAWhite: 7, tumbleB: 12, tumbleBWhite: 12 };

/**
 * A run of 1-4 on the step after a flying rock hit the boss, who was in phase 3 in `mode` at (x, y) facing `dir`: his third hit. His
 * hit step is the one this returns; the steps after it have age 1, 2, and so on.
 */
function defeatedByRock(mode: BossState['mode'], x: number, y: number, dir: 1 | -1): RunState {
  const rock: RockState = { x, y, vx: 0, vy: 0, mode: 'flying', age: 0 };
  // A dive (phase 3: 300 px/s, 5 px a step) is 5 px higher when the step starts; stuck in the sand he does not move.
  const boss: BossState = { ...bossStart(DEF, 2), mode, x, y: mode === 'dive' ? y - 5 : y, dir, age: 5, tx: x, ty: 209 };
  const hit = stepRun({ ...standing(40, 176, boss), rocks: [rock, { x: 424, y: 176, vx: 0, vy: 0, mode: 'rest', age: 0 }] }, STILL, LEVEL_1_4);
  expect(hit.boss).toMatchObject({ mode: 'defeated', hits: 3, age: 0, tx: x, ty: y, dir });
  return hit;
}

/** The steps (counted from the hit) at which his crown first touches the floor and rests there, and its y at the clear screen, 60 steps after the hit, where the boss stops (age 60). */
function measure(hit: RunState): { landed: number; rested: number; last: number } {
  const def = LEVEL_1_4.boss!;
  let run = hit;
  let landed = -1;
  let rested = -1;
  for (let age = 0; age <= 60; age++) {
    const crown = bossCrown(def, run.boss!)!;
    if (landed < 0 && crown.y === def.floor) landed = age;
    if (rested < 0 && crown.resting) rested = age;
    if (age < 60) run = stepRun(run, STILL, LEVEL_1_4);
  }
  expect(run.phase).toBe('clear');
  return { landed, rested, last: bossCrown(def, run.boss!)!.y };
}

describe('GDD-BOS-02 playing 1-4', () => {
  it('GDD-BOS-02 1-4 can be won from the start with all seven lives in under 1500 steps', () => {
    const { run, steps } = bot(LEVEL_1_4, 1500);
    expect(run.phase).toBe('clear');
    expect(steps).toBeLessThan(1500);
    expect(run.lives.lives).toBe(7);
    expect(run.boss).toMatchObject({ hits: 3, mode: 'defeated' });
  });

  it('GDD-BOS-01 shake: in the bot\'s real fight each dive that sticks him shakes 2 px and the third hit makes him slump with 3 px for 16 steps', () => {
    // The bot claws him stuck in the sand three times (or knocks a rock on him in phase 2): the shakes the fight starts, with the step of each.
    const seen: { step: number; shake: ShakeDef }[] = [];
    let before = startRun(LEVEL_1_4);
    let step = 0;
    let third = -1;
    bot(LEVEL_1_4, 1500, (run) => {
      step++;
      const shake = shakeStarts(before, run, LEVEL_1_4);
      if (shake !== null) seen.push({ step, shake });
      if (third < 0 && run.boss!.hits === 3) third = step;
      before = run;
    });
    expect(third).toBeGreaterThan(0);
    // The hit's own step shakes nothing; the step after it starts the defeat's 3 px for 16 steps, the last shake of the fight, once.
    const slump = seen.filter((s) => s.step >= third);
    expect(slump).toEqual([{ step: third + 1, shake: { px: 3, steps: 16, dying: false } }]);
    // Before it, only dives that stuck him: 2 px for 10 steps (the bot hits him stuck in phases 1 and 3).
    const before3 = seen.filter((s) => s.step < third);
    expect(before3.length).toBeGreaterThanOrEqual(2);
    expect(before3.every((s) => s.shake.px === 2 && s.shake.steps === 10)).toBe(true);
  });

  // L-059: the frames of assets/sprites/boss/ (scripts/art/boss.test.mjs pins their reach) over the real fight.
  it('GDD-BOS-02 through the whole fight no frame of his reaches into the floor', () => {
    // Only the lowered wings reach below his box, BOSS_ART.wingsBelow px (scripts/art/boss.test.mjs); bossPose keeps them raised near the floor.
    const floor = LEVEL_1_4.boss!.floor;
    const lowered: string[] = [];
    let worst = Infinity;
    bot(LEVEL_1_4, 1500, (run) => {
      const b = run.boss!;
      const look = bossPose(b, floor).look;
      const below = BELOW[look] ?? 0;
      worst = Math.min(worst, floor - (b.y + BOSS.height / 2 + below));
      if (below > 0) lowered.push(b.mode);
    });
    expect(worst).toBeGreaterThanOrEqual(0);
    // The fight shows the lowered wings in every flapping mode, so the check above is not empty.
    expect(new Set(lowered)).toEqual(new Set(['lap', 'drop', 'climb']));
  });

  it('GDD-BOS-02 defeated by a rock in the air he tumbles down and no look he shows reaches into the floor', () => {
    const floor = LEVEL_1_4.boss!.floor;
    let run = defeatedByRock('dive', 232, 140, 1);
    const looks: string[] = [];
    let worst = Infinity;
    for (let i = 0; i < 60; i++) {
      const b = run.boss!;
      const look = bossPose(b, floor).look;
      looks.push(look);
      worst = Math.min(worst, floor - (b.y + BOSS.height / 2 + (BELOW[look] ?? 0)));
      run = stepRun(run, STILL, LEVEL_1_4);
    }
    expect(worst).toBeGreaterThanOrEqual(0);
    // From y 140 he has 69 px of room above the floor and lands on his 35th step, in the third turn of B (ages 30 to 35): there he shows A for
    // two steps (7 to 11 px of room) and then lies, never the deeper B. He shows both tumbles on the way down, and ends lying.
    const plain = looks.map((l) => l.replace('White', ''));
    expect(new Set(plain)).toEqual(new Set(['tumbleA', 'tumbleB', 'defeat']));
    expect(plain[0]).toBe('tumbleA');
    expect(plain[59]).toBe('defeat');
    // While he has 7 to 11 px of room (steps 30 and 31, in a turn of B) he is in the shallower tumble.
    run = defeatedByRock('dive', 232, 140, 1);
    const near: string[] = [];
    for (let i = 0; i < 60; i++) {
      const b = run.boss!;
      const room = floor - (b.y + BOSS.height / 2);
      if (room >= 7 && room < 12) near.push(bossPose(b, floor).look.replace('White', ''));
      run = stepRun(run, STILL, LEVEL_1_4);
    }
    expect(near.length).toBeGreaterThan(0);
    expect(new Set(near)).toEqual(new Set(['tumbleA']));
  });

  it('GDD-BOS-02 his crown lands and rests before the clear screen, hit stuck at the start or in the air at y 150', () => {
    // Stuck in the sand at the start (x 232, y 209) facing right: first on the floor on its 14th step, resting on its 18th.
    expect(measure(defeatedByRock('stuck', 232, 209, 1))).toMatchObject({ landed: 14, rested: 18, last: 224 });
    // Hit in the air in a dive at y 150: on the floor on its 24th step, resting on its 34th.
    expect(measure(defeatedByRock('dive', 232, 150, 1))).toMatchObject({ landed: 24, rested: 34, last: 224 });
  });
});
