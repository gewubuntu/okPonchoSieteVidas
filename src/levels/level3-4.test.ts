import { describe, expect, it } from 'vitest';
import { CART, CATORCE, HIT, RESPAWN } from '../config/tuning';
import { catorceBox, catorceStart, type CatorceState } from '../sim/catorce';
import { clawBox } from '../sim/claw';
import { cartFloor, freshCarts, railGround, railLength, type CartState } from '../sim/cart';
import { levelBoss } from '../sim/bossLevel';
import { freshCrumbles } from '../sim/crumble';
import { overlaps } from '../sim/enemy';
import { fireballBox } from '../sim/fireball';
import { hitStopSteps } from '../sim/hitStop';
import { spawn, type PlayerInput, type PlayerState } from '../sim/movement';
import { startRun, stepRun, type Level, type RunState } from '../sim/run';
import { LEVEL_3_4, LEVEL_3_4_HOME, LEVEL_3_4_PERCHES, LEVEL_3_4_RAILS, LEVEL_3_4_ROWS, LEVEL_3_4_SPRINGS } from './level3-4';
import { validateLevel } from './validate';

// GDD-BOS-04: the arena 3-4 and La Catorce's fight in it, measured over the real level data and `stepRun` (L-003, L-014). Expected values
// come from the GDD's numbers: the floor's top at y = 224, home at columns 14 and 15 of row 10 (top y = 160), two rails at y = 128 from x = 208
// and 272 to broken ends at x = 112 and 368, her box 64 x 32 on the floor, and the plan's worked cases (a cart boarded at step L hits her at L + 55).
const DEF = LEVEL_3_4.catorce!;
const STILL: PlayerInput = { move: 0, jumpHeld: false };
/** Long enough to outlast any test: Poncho is not hurt, so only what the fight does to her is measured. */
const UNHURT = 1e6;
/** The step of her second slam at the left stop in phase 1 (her first is armoured), where the plan's worked cases start. */
const SECOND_LEFT_SLAM = 1170;

/** Plays `n` steps from `run`. */
function play(run: RunState, n: number, input: (i: number) => PlayerInput = () => STILL, level: Level = LEVEL_3_4): RunState {
  let r = run;
  for (let i = 1; i <= n; i++) r = stepRun(r, input(i), level);
  return r;
}
/** Plays `n` steps from `run`, returning every state (index 0 is `run`). */
function record(run: RunState, n: number, input: (i: number) => PlayerInput = () => STILL): RunState[] {
  const states = [run];
  for (let i = 1; i <= n; i++) states.push(stepRun(states[i - 1]!, input(i), LEVEL_3_4));
  return states;
}
/** A fresh run of 3-4 with Poncho unhurt on home: phase 1 from its start. */
const fresh = (): RunState => ({ ...startRun(LEVEL_3_4), fantasma: UNHURT });
/** A rolling cart at the start of rail `i`, just boarded: how `boardCarts` leaves a cart he landed in. */
const boarded = (r: RunState, i: number): RunState => ({ ...r, carts: r.carts.map((c, k) => (k === i ? { phase: 'rolling' as const, m: CART.width / 2 } : c)) });
/** Poncho standing in the cart `cart` of rail `i`, at its middle. */
function inCart(r: RunState, i: number, cart: CartState): PlayerState {
  const f = cartFloor(LEVEL_3_4_RAILS[i]!, cart);
  return { ...r.player, x: f.x + f.w / 2, y: f.y, vx: 0, vy: 0, grounded: true };
}

/** What the validator says of 3-4 with its spawn moved to `spawnAt`. */
const validatedAt = (spawnAt: { x: number; y: number }): readonly string[] => validateLevel({ id: '3-4', world: 3, test: false, level: { ...LEVEL_3_4, spawn: spawnAt } });
/** `r` has lost a life and respawned: the state when control returns. */
function lost(r: RunState): RunState {
  let s = stepRun(r, STILL, LEVEL_3_4);
  expect(s.phase).toBe('respawning');
  for (let i = 0; i < RESPAWN.delaySteps + 5 && s.phase === 'respawning'; i++) s = stepRun(s, STILL, LEVEL_3_4);
  expect(s.phase).toBe('playing');
  return s;
}

describe('GDD-BOS-04 level 3-4', () => {
  it('GDD-BOS-04 3-4 is 30 by 17, a boss level holding La Catorce, the validator passes', () => {
    expect([LEVEL_3_4.world.width, LEVEL_3_4.world.height]).toEqual([30, 17]);
    expect(levelBoss(LEVEL_3_4)).toBe('catorce');
    expect(validateLevel({ id: '3-4', world: 3, test: false, level: LEVEL_3_4 })).toEqual([]);
  });

  it('GDD-BOS-04 3-4 layout', () => {
    // The floor's top is y = 224 at every column but the two springs' (12 and 17), where a spring tile stands; rows 0 to 13 are empty.
    expect(LEVEL_3_4_ROWS).toHaveLength(17);
    for (let col = 0; col < 30; col++) {
      expect(LEVEL_3_4.world.solidTile(col, 14), `column ${col}`).toBe(col !== 12 && col !== 17);
      expect(LEVEL_3_4.world.solidTile(col, 13), `column ${col} row 13`).toBe(false);
      for (const row of [15, 16]) expect(LEVEL_3_4.world.solidTile(col, row), `column ${col} row ${row}`).toBe(true);
    }
    expect(LEVEL_3_4_SPRINGS).toEqual([{ col: 12, row: 14 }, { col: 17, row: 14 }]);
    expect(LEVEL_3_4.springs).toBe(LEVEL_3_4_SPRINGS);
    // Home: columns 14 and 15, row 10, solid in the run's world at the start: Poncho stands on them (x = 240, y = 160) and does not fall.
    expect(LEVEL_3_4_HOME).toEqual([{ col: 14, row: 10 }, { col: 15, row: 10 }]);
    expect(LEVEL_3_4.spawn).toEqual({ x: 240, y: 160 });
    const stood = play(startRun(LEVEL_3_4), 20);
    expect(stood.player).toMatchObject({ x: 240, y: 160, grounded: true });
    expect(LEVEL_3_4.world.solidTile(14, 10)).toBe(false);
    // The perches: row 6 (top y = 96), columns 0 to 3 and 26 to 29, crumbling tiles that come back.
    expect(LEVEL_3_4.crumbles).toBe(LEVEL_3_4_PERCHES);
    expect(LEVEL_3_4_PERCHES.map((c) => c.col)).toEqual([0, 1, 2, 3, 26, 27, 28, 29]);
    expect(LEVEL_3_4_PERCHES.every((c) => c.row === 6)).toBe(true);
    expect(LEVEL_3_4.crumblesReturn).toBe(true);
    // The rails: broken ends at x 112 and 368, at y 128.
    expect(LEVEL_3_4_RAILS.map((r) => r.x + r.dir * railLength(r))).toEqual([112, 368]);
    expect(LEVEL_3_4_RAILS.map((r) => railGround(r, railLength(r)))).toEqual([128, 128]);
    expect(LEVEL_3_4_RAILS.map((r) => r.end)).toEqual(['broken', 'broken']);
    expect(LEVEL_3_4.catorce).toEqual({ floor: 224, home: LEVEL_3_4_HOME });
    expect(LEVEL_3_4.abilities).toEqual({ glide: true });
  });

  it('GDD-BOS-04 3-4 validator: La Catorce too near the spawn, at every phase\'s start', () => {
    // Her middle is (400, 208) in phases 1 and 2: 8 px from (400, 200); phase 3's (448, 208) is hypot(48, 8) = 48.66 away, no line.
    expect(validatedAt({ x: 400, y: 200 })).toEqual(['La Catorce starts phase 1 8 px from the spawn, under 48', 'La Catorce starts phase 2 8 px from the spawn, under 48']);
    expect(validatedAt({ x: 448, y: 200 })).toEqual(['La Catorce starts phase 3 8 px from the spawn, under 48']);
    // Her height counts too: the same x, 108 px above her middle (a spawn on home is 48), is far enough.
    expect(validatedAt({ x: 400, y: 100 })).toEqual([]);
    expect(validatedAt({ x: 400, y: 160 })).toEqual([]);
  });

  it('GDD-BOS-04 3-4 her touch costs a life in Base, the taco in Taco, nothing with the Chile Fantasma', () => {
    // Poncho on the floor at x 300 facing left, she charging left from 400: her box's left edge (368) is 62 px from his hurtbox's (306).
    const charging: CatorceState = { ...catorceStart(DEF, 0), mode: 'charge', age: 0 };
    const run = (o: Partial<RunState>): RunState => ({ ...startRun(LEVEL_3_4), player: { ...spawn(300, 224), facing: -1 }, catorce: charging, ...o });
    // Base: a life lost, respawning.
    let r = run({});
    for (let i = 0; i < 600 && r.phase === 'playing'; i++) r = stepRun(r, STILL, LEVEL_3_4);
    expect(r).toMatchObject({ phase: 'respawning', lives: { lives: 6 }, power: 'base' });
    // Taco: the taco is spent and he is pushed away from her middle (he is left of it: to the left, 80 px/s), invulnerable for 2.0 s.
    r = run({ power: 'taco' });
    let steps = 0;
    for (; steps < 600 && r.power === 'taco'; steps++) r = stepRun(r, STILL, LEVEL_3_4);
    expect(r).toMatchObject({ phase: 'playing', power: 'base', lives: { lives: 7 }, invulnerable: HIT.invulnerableSteps });
    expect(r.player.vx).toBe(-HIT.knockback);
    // The Chile Fantasma: she runs through him, no life lost over 600 steps.
    r = play(run({ fantasma: UNHURT }), 600);
    expect(r).toMatchObject({ phase: 'playing', lives: { lives: 7 }, power: 'base' });
  });

  it('GDD-BOS-04 3-4 lost life: her hits kept, her phase from its right stop, carts and every perch and home tile whole', () => {
    const def = DEF;
    const hurtHome: CatorceState = { ...catorceStart(def, 1), mode: 'charge', x: 200, home: [{ phase: 'gone', steps: 50 }, { phase: 'idle', steps: 0 }] };
    // He falls out of the level (no pit, so from far below the floor), costing a life.
    const base: RunState = {
      ...startRun(LEVEL_3_4),
      catorce: hurtHome,
      crumbles: LEVEL_3_4_PERCHES.map((_, i) => (i === 2 ? { phase: 'gone' as const, steps: 40 } : { phase: 'idle' as const, steps: 0 })),
      carts: [{ phase: 'falling', m: 140, fall: { y: 150, vy: 200, vx: 150 } }, { phase: 'stopped', m: 60, empty: 30 }],
      player: { ...spawn(240, 400), grounded: false, vy: 100 },
    };
    const back = lost(base);
    expect(back.catorce).toEqual(catorceStart(def, 1));
    expect(back.carts).toEqual(freshCarts(LEVEL_3_4_RAILS));
    expect(back.crumbles).toEqual(freshCrumbles(LEVEL_3_4_PERCHES));
    expect(back.player).toMatchObject({ x: 240, y: 160 });
    // A life lost while she is hurt after her second hit starts phase 3.
    const hurt = lost({ ...base, catorce: { ...catorceStart(def, 2), mode: 'hurt', age: 20 } });
    expect(hurt.catorce).toEqual(catorceStart(def, 2));
    expect(hurt.catorce).toMatchObject({ x: 448, hits: 2, armoured: true, mode: 'telegraph' });
  });

  it('GDD-BOS-04 3-4 an empty cart sent at the right moment hits her', () => {
    // Her second slam at the left stop (x 80, box 48 to 112, unarmoured, resting until 1349): the cart set rolling at m 16 leaves the rail on its
    // 32nd roll, its box's bottom passes her roof 23 steps later, 55 after the board, with its box 38.5 to 70.5 across.
    const states = record(fresh(), SECOND_LEFT_SLAM);
    const slam = states[SECOND_LEFT_SLAM]!;
    expect(slam.catorce).toMatchObject({ x: 80, armoured: false, hits: 0, mode: 'rest' });
    expect(states[SECOND_LEFT_SLAM - 1]!.catorce).toMatchObject({ mode: 'charge' });
    const after = record(boarded(slam, 0), 80);
    const L = SECOND_LEFT_SLAM;
    expect(after.slice(0, 55).every((s) => s.catorce!.hits === 0)).toBe(true);
    expect(after[55]!.catorce).toMatchObject({ hits: 1, mode: 'hurt', age: 0 });
    expect(after[55]!.carts[0]!.phase).toBe('gone');
    expect(after[54]!.carts[0]).toMatchObject({ phase: 'falling', ridden: false });
    expect(L + 55).toBe(1225);
    expect(after[55]!.phase).toBe('playing');
    expect(hitStopSteps(after[54]!, after[55]!)).toBe(4);
    // Only that step holds, and the hit is not counted twice.
    expect(after.slice(56).every((s, i) => hitStopSteps(after[55 + i]!, s) === 0)).toBe(true);
    expect(after[80]!.catorce!.hits).toBe(1);
  });

  it('GDD-BOS-04 3-4 a ridden-off cart breaks on her and does not count', () => {
    const slam = record(fresh(), SECOND_LEFT_SLAM)[SECOND_LEFT_SLAM]!;
    const cart: CartState = { phase: 'rolling', m: CART.width / 2 };
    // Unhurt, so he does not die on the way: he rides it with no input, the cart marked ridden off the step it leaves, and it breaks on her at
    // the same step as in the case above (55 after the board) without hurting her.
    const ride = record({ ...slam, player: inCart(slam, 0, cart), carts: [cart, slam.carts[1]!] }, 80);
    expect(ride[31]!.carts[0]!.phase).toBe('rolling');
    expect(ride[32]!.carts[0]).toMatchObject({ phase: 'falling', ridden: true });
    expect(ride[54]!.carts[0]!.phase).toBe('falling');
    expect(ride[55]!.carts[0]!.phase).toBe('gone');
    expect(ride.every((s) => s.catorce!.hits === 0)).toBe(true);
    expect(ride.every((s) => hitStopSteps(ride[0]!, s) === 0)).toBe(true);
    // In Base he falls on his own onto her roof, a touch, before the cart gets there: a life lost, and still no hit on her.
    const base = record({ ...slam, fantasma: 0, player: inCart(slam, 0, cart), carts: [cart, slam.carts[1]!] }, 80);
    const lostAt = base.findIndex((s) => s.phase === 'respawning');
    expect(lostAt).toBeGreaterThan(32);
    expect(lostAt).toBeLessThan(55);
    expect(base[lostAt]!.lives.lives).toBe(6);
    expect(base[lostAt]!.catorce!.hits).toBe(0);
    // Poncho's own box was on hers on that step: he is over her roof (192) with his hurtbox.
    expect(overlaps({ x0: base[lostAt]!.player.x - 5, x1: base[lostAt]!.player.x + 5, y0: base[lostAt]!.player.y - 31, y1: base[lostAt]!.player.y - 1 }, catorceBox(DEF, base[lostAt]!.catorce!))).toBe(true);
  });

  it('GDD-BOS-04 3-4 defeat clears the level 60 steps after the third hit, every cart gone at once', () => {
    // Her third hit: she rests at the left stop in phase 3's hit count (2), and the left cart is one step from her roof, as at step 1224 above.
    const falling: CartState = { phase: 'falling', m: 151, fall: { y: 189.125, vy: 360, vx: 150 }, ridden: false, empty: 22 };
    const rolling: CartState = { phase: 'rolling', m: 50 };
    const run: RunState = { ...fresh(), catorce: { ...catorceStart(DEF, 2), mode: 'rest', x: 32, age: 0, dir: 1, armoured: false }, carts: [falling, rolling] };
    // (At x 32 her box is 0 to 64: the cart's box at 38.5 to 70.5 overlaps it.)
    const states = record(run, 62);
    expect(states[1]!.catorce).toMatchObject({ mode: 'defeated', hits: 3, age: 0 });
    expect(states[1]!.carts.map((c) => c.phase)).toEqual(['gone', 'gone']);
    expect(hitStopSteps(states[0]!, states[1]!)).toBe(12);
    expect(states.slice(1, 61).every((s) => s.phase === 'playing')).toBe(true);
    expect(states[60]!.catorce!.age).toBe(59);
    expect(states[61]!).toMatchObject({ phase: 'clear' });
    expect(states[61]!.catorce!.age).toBe(CATORCE.defeatSteps);
  });

  it('GDD-BOS-04 3-4 nothing else hits her: claw, stomp, fireball', () => {
    // She rests at the left stop (x 80, box 48 to 112) with her armour off. Poncho in Fuego beside her swings the claw and spits fireballs...
    const rest: CatorceState = { ...catorceStart(DEF, 0), mode: 'rest', x: 80, age: 0, dir: 1, armoured: false };
    let r: RunState = { ...fresh(), power: 'fuego', catorce: rest, player: { ...spawn(30, 224), facing: 1 } };
    const box = catorceBox(DEF, rest);
    let spent = 0;
    for (let i = 1; i <= 150; i++) {
      const before = r;
      r = stepRun(r, { ...STILL, claw: i % 10 === 1, fuego: i % 2 === 1 }, LEVEL_3_4);
      // Every fireball that reaches her is used up in the step it does.
      expect(r.fireballs.every((f) => !overlaps(fireballBox(f), box)), `step ${i}`).toBe(true);
      if (before.fireballs.length + (i % 2 === 1 ? 1 : 0) > r.fireballs.length) spent++;
      expect(r.catorce!.hits, `step ${i}`).toBe(0);
    }
    expect(spent).toBeGreaterThan(5);
    // ...and dropped from above onto her roof: a stomp is a touch, not a hit on her.
    r = { ...fresh(), catorce: rest, player: { ...spawn(80, 150), grounded: false } };
    const states = record(r, 60);
    expect(states.some((s) => s.player.y > 193 && s.player.y < 224)).toBe(true);
    expect(states.every((s) => s.catorce!.hits === 0)).toBe(true);
    expect(states.every((s) => s.invulnerable === 0 || s.fantasma > 0)).toBe(true);
    // The claw swung across her box with nothing else: no hit either.
    const swung = record({ ...fresh(), catorce: rest, player: { ...spawn(44, 224), facing: 1 } }, 100, (i) => ({ ...STILL, claw: i % 10 === 1 }));
    expect(swung.every((s) => s.catorce!.hits === 0)).toBe(true);
    // (The swings did reach her: their box overlapped hers.)
    expect(swung.some((s) => { const c = clawBox(s.player, s.claw); return c !== null && overlaps(c, box); })).toBe(true);
  });
});
