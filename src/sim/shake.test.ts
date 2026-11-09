import { describe, expect, it } from 'vitest';
import { SHAKE } from '../config/tuning';
import { LEVEL_1_1 } from '../levels/level1-1';
import { LEVEL_1_4 } from '../levels/level1-4';
import { LEVEL_2_4 } from '../levels/level2-4';
import { bossStart, hitBoss, type BossState } from './boss';
import { estrellaStart, type EstrellaMode, type EstrellaState } from './estrella';
import { spawn, type PlayerInput } from './movement';
import { startRun, stepRun, type Level, type RunState } from './run';
import { nextShake, shakeOffset, shakeSize, shakeStarts, type Shake, type ShakeDef } from './shake';

// GDD-BOS-01: the screen shake. The pure rules: which step starts which shake (from the boss states before and after it), how a new shake
// meets a running one, a shake's size at each step and which way the world is drawn. The expected numbers are the GDD's, written out here:
// La Estrella 1 px for 6 steps on an awning, 2 px for 10 on the floor, 4 px for 20 dying away at the tear, 3 px for 16 for her pot at her
// defeat; Don Zopilote 2 px for 10 stuck in the sand, 3 px for 16 on the floor at his defeat. Down for 2 steps, then up for 2.
const DON = LEVEL_1_4.boss!;
const ESTRELLA = LEVEL_2_4.estrella!;
const STILL: PlayerInput = { move: 0, jumpHeld: false };
const claw = (i: number): PlayerInput => ({ ...STILL, claw: i === 1 });

const AWNING: ShakeDef = { px: 1, steps: 6, dying: false };
const FLOOR: ShakeDef = { px: 2, steps: 10, dying: false };
const TEAR: ShakeDef = { px: 4, steps: 20, dying: true };
const ESTRELLA_DEFEAT: ShakeDef = { px: 3, steps: 16, dying: false };
const STUCK: ShakeDef = { px: 2, steps: 10, dying: false };
const BOSS_DEFEAT: ShakeDef = { px: 3, steps: 16, dying: false };

/** A run of 1-4, or 2-4, with Poncho standing at (x, y) facing right, and the boss as given. */
const donFight = (x: number, y: number, boss: BossState): RunState => ({ ...startRun(LEVEL_1_4), player: { ...spawn(x, y), grounded: true }, boss });
const estrellaFight = (x: number, y: number, estrella: EstrellaState): RunState => ({ ...startRun(LEVEL_2_4), player: { ...spawn(x, y), grounded: true }, estrella });
/** Stuck in the sand at x, with `hits` taken. */
const stuckAt = (x: number, hits: number): BossState => ({ ...bossStart(DON, hits), mode: 'stuck', age: 0, x, y: 209, tx: x, ty: 209 });
/** La Estrella in `mode`, still there after a step, at x with her box's bottom at y, `hits` taken. */
const posed = (mode: EstrellaMode, x: number, y: number, hits: number, tx = x, ty = y): EstrellaState => ({ ...estrellaStart(ESTRELLA, hits), mode, age: 0, x, y, tx, ty });

/** A run of 1-4 with both a boss and La Estrella, which no real arena has. */
const both = (boss: BossState, estrella: EstrellaState): RunState => ({ ...startRun(LEVEL_1_4), boss, estrella });
/** A shake of `def` that has run `age` steps. */
const shake = (def: ShakeDef, age: number): Shake => ({ ...def, age });

/** The shake each of `n` steps from `run` starts (`input(i)` is the input of step i, 1-based), with the run after each. */
function starts(run: RunState, level: Level, n: number, input: (i: number) => PlayerInput = () => STILL): { out: (ShakeDef | null)[]; runs: RunState[] } {
  const out: (ShakeDef | null)[] = [];
  const runs: RunState[] = [];
  let r = run;
  for (let i = 1; i <= n; i++) {
    const before = r;
    r = stepRun(r, input(i), level);
    out.push(shakeStarts(before, r, level));
    runs.push(r);
  }
  return { out, runs };
}
/** The 1-based steps (of `out`) that start a shake. */
const at = (out: (ShakeDef | null)[]): number[] => out.flatMap((s, i) => (s === null ? [] : [i + 1]));

describe('GDD-BOS-01 shake starts', () => {
  it('GDD-BOS-01 shake: La Estrella landing on an awning starts 1 px for 6 steps', () => {
    // A phase 1 drop onto the left awning (top y 176) from her low spot over it: 5 px a step; the awning throws her up on the landing step.
    const run = { ...estrellaFight(300, 224, posed('drop', 80, 150, 0, 80, 176)), invulnerable: 1000 };
    const { out, runs } = starts(run, LEVEL_2_4, 12);
    expect(at(out)).toEqual([6]);
    expect(out[5]).toEqual(AWNING);
    expect(runs[4]!.estrella!.mode).toBe('drop');
    expect(runs[5]!.estrella!.mode).toBe('bounce');
  });

  it('GDD-BOS-01 shake: La Estrella thudding on the floor starts 2 px for 10 steps', () => {
    // A phase 1 drop at x 300, where there is no awning: to the floor.
    const run = { ...estrellaFight(100, 224, posed('drop', 300, 150, 0, 300, 224)), invulnerable: 1000 };
    const { out, runs } = starts(run, LEVEL_2_4, 20);
    expect(at(out)).toEqual([15]);
    expect(out[14]).toEqual(FLOOR);
    expect(runs[13]!.estrella!.mode).toBe('drop');
    expect(runs[14]!.estrella!.mode).toBe('rest');
  });

  it('GDD-BOS-01 shake: the tear starts 4 px for 20 steps, dying away', () => {
    // Phase 3, Poncho (invulnerable, so he is only her aim) at x 400: she glides to the tear's x 240, telegraphs and drops, tearing at 176.
    const run = { ...estrellaFight(400, 224, estrellaStart(ESTRELLA, 2)), invulnerable: 1000 };
    const { out, runs } = starts(run, LEVEL_2_4, 300);
    const tore = runs.findIndex((r) => r.estrella!.tore);
    expect(tore).toBeGreaterThan(0);
    expect(out[tore]).toEqual(TEAR);
    expect(runs[tore - 1]!.estrella!.tore).toBe(false);
    // Not on any other step before the thud (it starts one of its own then).
    expect(at(out).filter((s) => s <= tore + 1)).toEqual([tore + 1]);
  });

  it('GDD-BOS-01 shake: her empty pot hitting the floor at her defeat starts 3 px for 16 steps', () => {
    // Defeated, the pot falls 2 px a step from y 200 to the floor at 224: 12 steps; it starts nothing on the steps it falls before that.
    const run = { ...estrellaFight(100, 224, posed('defeated', 240, 200, 3)), invulnerable: 1000 };
    const { out, runs } = starts(run, LEVEL_2_4, 30);
    expect(at(out)).toEqual([12]);
    expect(out[11]).toEqual(ESTRELLA_DEFEAT);
    expect(runs[10]!.estrella!.y).toBeLessThan(224);
    expect(runs[11]!.estrella!.y).toBe(224);
  });

  it('GDD-BOS-01 shake: a dive sticking Don Zopilote in the sand starts 2 px for 10 steps', () => {
    // From the start of 1-4 (invulnerable, so he is only his aim): his first dive ends in the sand.
    const { out, runs } = starts({ ...startRun(LEVEL_1_4), invulnerable: 1000 }, LEVEL_1_4, 600);
    const stuck = runs.findIndex((r) => r.boss!.mode === 'stuck');
    expect(stuck).toBeGreaterThan(0);
    expect(runs[stuck - 1]!.boss!.mode).toBe('dive');
    expect(out[stuck]).toEqual(STUCK);
    expect(at(out)).toEqual([stuck + 1]);
  });

  it('GDD-BOS-01 shake: Don Zopilote landing on the floor at his defeat starts 3 px for 16 steps', () => {
    // Defeated high in the air at y 150: he falls 2 px a step to the floor, his middle at 209 (his box's bottom on the floor at 224).
    const run = { ...donFight(40, 176, { ...bossStart(DON, 3), mode: 'defeated', age: 0, x: 232, y: 150 }), invulnerable: 1000 };
    const { out, runs } = starts(run, LEVEL_1_4, 60);
    expect(at(out)).toEqual([30]);
    expect(out[29]).toEqual(BOSS_DEFEAT);
    expect(runs[28]!.boss!.y).toBeLessThan(209);
    expect(runs[29]!.boss!.y).toBe(209);
  });

  it('GDD-BOS-01 shake: a hit on a boss starts no shake', () => {
    // Don Zopilote stuck in the sand, a claw: a hit that leaves him hurt, and the one that defeats him, on the swing's own step and after.
    for (const hits of [0, 2]) {
      const { out, runs } = starts(donFight(200, 224, stuckAt(232, hits)), LEVEL_1_4, 8, claw);
      expect(runs.some((r) => r.boss!.hits === hits + 1)).toBe(true);
      expect(out.every((s) => s === null)).toBe(true);
    }
    // And a hit that defeats him in the air, from his states alone: he was not yet on the floor, and the hit's step is no landing.
    const flying: BossState = { ...bossStart(DON, 2), mode: 'lap', y: 100 };
    expect(shakeStarts({ ...startRun(LEVEL_1_4), boss: flying }, { ...startRun(LEVEL_1_4), boss: hitBoss(flying) }, LEVEL_1_4)).toBeNull();
    // And the hit's own step is no landing even where the hit puts him or her on the floor: only a boss that was already defeated, and falling,
    // lands (the hit that defeats him while he dives, the one that defeats her while she hangs just over the floor).
    const lying = DON.floor - 15;
    const diving: BossState = { ...bossStart(DON, 2), mode: 'dive', y: lying - 1 };
    expect(shakeStarts({ ...startRun(LEVEL_1_4), boss: diving }, { ...startRun(LEVEL_1_4), boss: { ...hitBoss(diving), y: lying } }, LEVEL_1_4)).toBeNull();
    const hanging = posed('hang', 90, 223, 2);
    expect(shakeStarts(estrellaFight(60, 224, hanging), estrellaFight(60, 224, { ...hanging, mode: 'defeated', hits: 3, y: 224 }), LEVEL_2_4)).toBeNull();
    // La Estrella: a bump from the left awning leaves her hurt; a claw defeats her.
    const bump = starts(estrellaFight(80, 176, posed('hang', 80, 112, 0)), LEVEL_2_4, 30, () => ({ ...STILL, jumpHeld: true }));
    expect(bump.runs.some((r) => r.estrella!.hits === 1)).toBe(true);
    expect(bump.out.every((s) => s === null)).toBe(true);
    const last = starts(estrellaFight(60, 224, posed('hang', 90, 220, 2)), LEVEL_2_4, 6, claw);
    expect(last.runs[2]!.estrella).toMatchObject({ hits: 3, mode: 'defeated' });
    expect(last.out.slice(0, 3).every((s) => s === null)).toBe(true);
  });

  it('GDD-BOS-01 shake: a step with nothing landing starts none', () => {
    // Don Zopilote lapping and telegraphing (his first 240 + 30 steps), La Estrella gliding and telegraphing (her first 200 steps): no landing.
    expect(starts({ ...startRun(LEVEL_1_4), invulnerable: 1000 }, LEVEL_1_4, 250).out.every((s) => s === null)).toBe(true);
    expect(starts({ ...startRun(LEVEL_2_4), invulnerable: 1000 }, LEVEL_2_4, 150).out.every((s) => s === null)).toBe(true);
    // A level with no boss.
    expect(startRun(LEVEL_1_1).boss).toBeNull();
    expect(startRun(LEVEL_1_1).estrella).toBeNull();
    expect(starts(startRun(LEVEL_1_1), LEVEL_1_1, 30, () => ({ move: 1, jumpHeld: false })).out.every((s) => s === null)).toBe(true);
  });

  it('GDD-BOS-01 shake: a step that starts two shakes starts the bigger', () => {
    // It cannot in the real arenas (a level has one boss or the other): a made-up run with both, each landing on the same step.
    const level: Level = { ...LEVEL_1_4, estrella: ESTRELLA };
    const dive: BossState = { ...bossStart(DON, 0), mode: 'dive' };
    const air: BossState = { ...bossStart(DON, 3), mode: 'defeated', y: 208 };
    const dropping = posed('drop', 80, 170, 0);
    // His 2 px against her awning's 1 px, whichever is the boss's and whichever is hers.
    expect(shakeStarts(both(dive, dropping), both({ ...dive, mode: 'stuck' }, posed('bounce', 80, 176, 0)), level)).toEqual(STUCK);
    // His 2 px against her tear's 4 px.
    const tearing = posed('drop', 240, 172, 2);
    expect(shakeStarts(both(dive, tearing), both({ ...dive, mode: 'stuck' }, { ...posed('drop', 240, 178, 2), tore: true }), level)).toEqual(TEAR);
    // His defeat's 3 px against her awning's 1 px.
    expect(shakeStarts(both(air, dropping), both({ ...air, y: 209 }, posed('bounce', 80, 176, 0)), level)).toEqual(BOSS_DEFEAT);
  });
});

describe('GDD-BOS-01 shake size and rhythm', () => {
  it("GDD-BOS-01 shake: the tear's 4 px dies away 4 for 5 steps, then 3, 2 and 1 for 5 steps each", () => {
    // 4 * (1 - age / 20), rounded up: ages 0 to 4 are 4 (3.2 at age 4 rounds up to 4), 5 to 9 are 3, 10 to 14 are 2, 15 to 19 are 1.
    const sizes = Array.from({ length: 20 }, (_, age) => shakeSize(shake(TEAR, age)));
    expect(sizes).toEqual([4, 4, 4, 4, 4, 3, 3, 3, 3, 3, 2, 2, 2, 2, 2, 1, 1, 1, 1, 1]);
  });

  it('GDD-BOS-01 shake: a constant shake keeps its size and ends after its steps', () => {
    expect(Array.from({ length: 6 }, (_, age) => shakeSize(shake(AWNING, age)))).toEqual([1, 1, 1, 1, 1, 1]);
    expect(Array.from({ length: 10 }, (_, age) => shakeSize(shake(FLOOR, age))).every((n) => n === 2)).toBe(true);
    // It is drawn for exactly `steps` steps from the step it starts: ages 0 to 5, gone at age 6. A dying one as well: ages 0 to 19.
    for (const def of [AWNING, FLOOR, TEAR, ESTRELLA_DEFEAT]) {
      let s = nextShake(null, def);
      let drawn = 0;
      for (let i = 0; i < def.steps + 5 && s !== null; i++) {
        drawn++;
        s = nextShake(s, null);
      }
      expect(drawn).toBe(def.steps);
      expect(s).toBeNull();
    }
  });

  it('GDD-BOS-01 shake: down for 2 steps, up for 2', () => {
    // A 2 px shake: +2 (down) for ages 0 and 1, -2 (up) for 2 and 3, and so on.
    const offsets = Array.from({ length: 10 }, (_, age) => shakeOffset(shake(FLOOR, age), true));
    expect(offsets).toEqual([2, 2, -2, -2, 2, 2, -2, -2, 2, 2]);
    // A dying one flips by the same rhythm with its size at each step.
    const tear = Array.from({ length: 20 }, (_, age) => shakeOffset(shake(TEAR, age), true));
    expect(tear).toEqual([4, 4, -4, -4, 4, 3, -3, -3, 3, 3, -2, -2, 2, 2, -2, -1, 1, 1, -1, -1]);
  });

  it('GDD-BOS-01 shake: Off draws nothing', () => {
    for (let age = 0; age < 10; age++) expect(shakeOffset(shake(FLOOR, age), false)).toBe(0);
    expect(shakeOffset(shake(FLOOR, 0), true)).not.toBe(0);
    expect(shakeOffset(null, true)).toBe(0);
    expect(shakeOffset(null, false)).toBe(0);
  });

  it('GDD-BOS-01 shake: a shake started on a step is at age 0 and the next step ages it by one', () => {
    expect(nextShake(null, FLOOR)).toEqual({ ...FLOOR, age: 0 });
    expect(nextShake({ ...FLOOR, age: 0 }, null)).toEqual({ ...FLOOR, age: 1 });
    expect(nextShake(null, null)).toBeNull();
  });

  it('GDD-BOS-01 shake: a new shake at least as big as what is left replaces it', () => {
    // A 1 px (an awning's) running at age 2: a 2 px new one replaces it, from age 0.
    const running = { ...AWNING, age: 2 };
    expect(nextShake(running, FLOOR)).toEqual({ ...FLOOR, age: 0 });
    // Equal sizes: replaced (a fresh 1 px at age 0, not the running one at age 3).
    expect(nextShake(running, AWNING)).toEqual({ ...AWNING, age: 0 });
    // A smaller one is dropped: a 2 px running, a 1 px new one; the running one goes on, a step older.
    const big = { ...FLOOR, age: 2 };
    expect(nextShake(big, AWNING)).toEqual({ ...FLOOR, age: 3 });
    // What is left is its size now: the tear at age 9 (size 3 after the step) beats a 2 px thud, and loses to a 3 px one (equal replaces).
    const tear = { ...TEAR, age: 8 };
    expect(nextShake(tear, FLOOR)).toEqual({ ...TEAR, age: 9 });
    expect(nextShake(tear, ESTRELLA_DEFEAT)).toEqual({ ...ESTRELLA_DEFEAT, age: 0 });
    // A running shake that ends on this step is no longer there: any new one starts.
    expect(nextShake({ ...ESTRELLA_DEFEAT, age: 15 }, AWNING)).toEqual({ ...AWNING, age: 0 });
    expect(nextShake({ ...ESTRELLA_DEFEAT, age: 14 }, AWNING)).toEqual({ ...ESTRELLA_DEFEAT, age: 15 });
  });

  it("GDD-BOS-01 shake: the tear's shake is not cut by the thud 8 steps later", () => {
    // In the real 2-4 fight: from the tear, step to the floor thud, and measure the gap.
    let r: RunState = { ...estrellaFight(400, 224, estrellaStart(ESTRELLA, 2)), invulnerable: 1000 };
    let running: Shake | null = null;
    let tore = -1;
    let thud = -1;
    let atThud: Shake | null = null;
    for (let i = 1; i <= 300 && thud < 0; i++) {
      const before = r;
      r = stepRun(r, STILL, LEVEL_2_4);
      const start = shakeStarts(before, r, LEVEL_2_4);
      if (start !== null && tore > 0) {
        thud = i;
        atThud = nextShake(running, null); // the running shake as this step finds it, before the thud meets it
        expect(start).toEqual(FLOOR);
      }
      if (start !== null && tore < 0) {
        tore = i;
        expect(start).toEqual(TEAR);
      }
      running = nextShake(running, start);
    }
    expect(tore).toBeGreaterThan(0);
    expect(thud - tore).toBe(8);
    // At the thud the running shake is the tear's, 8 steps old, 3 px: the thud's 2 px was dropped.
    expect(atThud).toEqual({ ...TEAR, age: 8 });
    expect(shakeSize(atThud!)).toBe(3);
    expect(running).toEqual({ ...TEAR, age: 8 });
  });
});

describe('GDD-BOS-01 SHAKE', () => {
  it("GDD-BOS-01 SHAKE holds the GDD's numbers", () => {
    expect(SHAKE.flipSteps).toBe(2);
    expect(SHAKE.estrellaAwning).toEqual({ px: 1, steps: 6, dying: false });
    expect(SHAKE.estrellaFloor).toEqual({ px: 2, steps: 10, dying: false });
    expect(SHAKE.estrellaTear).toEqual({ px: 4, steps: 20, dying: true });
    expect(SHAKE.estrellaDefeat).toEqual({ px: 3, steps: 16, dying: false });
    expect(SHAKE.bossStuck).toEqual({ px: 2, steps: 10, dying: false });
    expect(SHAKE.bossDefeat).toEqual({ px: 3, steps: 16, dying: false });
  });
});
