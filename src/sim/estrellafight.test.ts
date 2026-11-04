import { describe, expect, it } from 'vitest';
import { FLIP, GAME_OVER, HIT, HITBOX, RESPAWN } from '../config/tuning';
import { estrellaStart, type Estrella, type EstrellaMode, type EstrellaState, type Tejocote } from './estrella';
import { hurtbox } from './hazards';
import { loseLife, startWorld } from './lives';
import { spawn, type PlayerInput } from './movement';
import { startRun, stepRun, type Level, type RunState } from './run';
import { parseTiles } from './tilemap';

// GDD-BOS-01, GDD-BOS-03: La Estrella in a run, in an arena laid out like 2-4: the floor's top at y = 224 across the whole width, three
// whole awnings 4 tiles wide with their tops at y = 176 (x 48 to 112, 208 to 272, 368 to 432), two cordeles at y = 136 between them (x 112
// to 208 and 272 to 368), Poncho's start at x = 240. Her phase 1 starts over x = 400 and drops at 80, then 400; phase 2 over 320, at 160
// then 320; phase 3 over 400, aiming at him.
const DEF: Estrella = { floor: 224, spots: [[400, 80], [320, 160], [400]] };
const ARENA: Level = {
  world: parseTiles([...Array<string>(14).fill('.'.repeat(30)), ...Array<string>(3).fill('#'.repeat(30))]),
  spawn: { x: 240, y: 224 },
  ofrendas: [],
  spikes: [],
  crumbles: [],
  springs: [],
  platforms: [],
  tacos: [],
  pinatas: [],
  doors: [],
  keys: [],
  fragiles: [],
  enemies: [],
  awnings: [
    { x: 48, y: 176, w: 64 },
    { x: 208, y: 176, w: 64 },
    { x: 368, y: 176, w: 64 },
  ],
  cordeles: [
    { x: 112, y: 136, w: 96 },
    { x: 272, y: 136, w: 96 },
  ],
  estrella: DEF,
};
const STILL: PlayerInput = { move: 0, jumpHeld: false };

/** A run with Poncho standing at (x, y) facing `facing`, and her as given. */
function fight(x: number, y: number, estrella: EstrellaState = estrellaStart(DEF, 0), facing: 1 | -1 = 1): RunState {
  return { ...startRun(ARENA), player: { ...spawn(x, y), grounded: true, facing }, estrella };
}
/** Her in `mode`, still there after a step (her target is where she is), at x with her box's bottom at y, `hits` taken. */
const posed = (mode: EstrellaMode, x: number, y: number, hits = 0): EstrellaState => ({ ...estrellaStart(DEF, hits), mode, age: 0, x, y, tx: x, ty: y });
/** A tejocote out of her, rolling `dir`. */
const rolling = (x: number, dir: 1 | -1 = 1): Tejocote => ({ x, y: 224, dir, wait: 0 });
/** Runs `n` steps; `input(i)` is the input of step i (1-based). Stops early once `until` holds. */
function play(run: RunState, n: number, input: (i: number) => PlayerInput = () => STILL, until?: (r: RunState) => boolean, level: Level = ARENA): { run: RunState; steps: number } {
  let r = run;
  for (let i = 1; i <= n; i++) {
    r = stepRun(r, input(i), level);
    if (until?.(r)) return { run: r, steps: i };
  }
  return { run: r, steps: n };
}

/** Her first drop has ended: she is past her glide, telegraph and drop. */
const dropEnded = (r: RunState): boolean => r.estrella!.mode !== 'glide' && r.estrella!.mode !== 'telegraph' && r.estrella!.mode !== 'drop';
/** Poncho in Fuego at x 60 on the floor, facing right, and her as given. */
const fuego = (estrella: EstrellaState): RunState => ({ ...fight(60, 224, estrella), power: 'fuego' });

describe('GDD-BOS-03 La Estrella in a run', () => {
  it('GDD-BOS-03 a run of her level starts with her high over x 400 and no tejocotes; a level without her has none', () => {
    const run = startRun(ARENA);
    expect(run.estrella).toEqual(estrellaStart(DEF, 0));
    expect(run.estrella).toMatchObject({ x: 400, y: 40, mode: 'glide', hits: 0 });
    expect(run.tejocotes).toEqual([]);
    const { estrella: _e, ...without } = ARENA;
    expect(startRun(without).estrella).toBeNull();
    expect(stepRun(startRun(without), STILL, without).estrella).toBeNull();
  });

  it('GDD-BOS-03 in a run she glides at 80 px a second', () => {
    const e = play(fight(240, 224), 60).run.estrella!;
    expect(e).toMatchObject({ y: 40, mode: 'glide' });
    expect(e.x).toBeCloseTo(320, 6);
  });

  it('GDD-BOS-03 in a run the left awning throws her back up in phase 1, on step 298; with no awning she thuds on the floor', () => {
    const landed = play(fight(240, 224), 400, () => STILL, dropEnded);
    expect(landed.steps).toBe(298);
    expect(landed.run.estrella).toMatchObject({ mode: 'bounce', x: 80, y: 176 });
    const bare: Level = { ...ARENA, awnings: [] };
    const thud = play({ ...fight(240, 224), estrella: estrellaStart(DEF, 0) }, 400, () => STILL, dropEnded, bare);
    expect(thud.run.estrella).toMatchObject({ mode: 'rest', x: 80, y: 224 });
  });

  it('GDD-BOS-03 in a run she passes through the cordel in phase 2: on the floor at x 160 on step 163, one tejocote rolling each way', () => {
    const { run, steps } = play(fight(400, 224, estrellaStart(DEF, 1)), 300, () => STILL, (r) => r.estrella!.mode === 'rest');
    expect(steps).toBe(163);
    expect(run.estrella).toMatchObject({ x: 160, y: 224 });
    expect(run.tejocotes).toEqual([
      { x: 160, y: 224, dir: -1, wait: 0 },
      { x: 160, y: 224, dir: 1, wait: 0 },
    ]);
    expect(play(run, 10).run.tejocotes.map((t) => t.x)).toEqual([145, 175]);
  });
});

describe('GDD-BOS-03 Remolino in a run', () => {
  it('GDD-BOS-03 in phase 3 her drop aimed over the middle awning tears through it to the floor and spills two pairs of tejocotes', () => {
    // Poncho under the awning (invulnerable, so he is only her aim): she lands on the floor on step 141, the awning still whole.
    const { run, steps } = play({ ...fight(240, 224, estrellaStart(DEF, 2)), invulnerable: 1000 }, 300, () => STILL, (r) => r.estrella!.mode === 'rest');
    expect(steps).toBe(141);
    expect(run.estrella).toMatchObject({ x: 240, y: 224, hits: 2 });
    expect(run.awningsGone).toEqual([false, false, false]);
    expect(run.tejocotes).toEqual([
      { x: 240, y: 224, dir: -1, wait: 0 },
      { x: 240, y: 224, dir: 1, wait: 0 },
      { x: 240, y: 224, dir: -1, wait: 24 },
      { x: 240, y: 224, dir: 1, wait: 24 },
    ]);
  });
});

describe('GDD-BOS-03 hitting her in a run', () => {
  it('GDD-BOS-03 a jump from the left awning bumps her hanging in phase 1: his body box flush under her, his rise stopped', () => {
    const { run, steps } = play(fight(80, 176, posed('hang', 80, 112)), 30, () => ({ ...STILL, jumpHeld: true }), (r) => r.estrella!.hits > 0);
    expect(steps).toBeLessThan(30);
    expect(run.estrella).toMatchObject({ hits: 1, mode: 'hurt', age: 0 });
    expect(run.player.y - HITBOX.height).toBe(112);
    expect(hurtbox(run.player).y).toBe(113);
    expect(run.player.vy).toBe(0);
    expect(run.lives.lives).toBe(7);
  });

  it('GDD-BOS-03 a claw swipe hits her: on the third step of a press, when the swing comes', () => {
    // Her box 74 to 106 across, its bottom on the floor while she hangs (posed); the claw's box 66 to 86, clear of his body (54 to 66).
    const { run } = play(fight(60, 224, posed('hang', 90, 220)), 3, (i) => ({ ...STILL, claw: i === 1 }));
    expect(run.estrella).toMatchObject({ hits: 1, mode: 'hurt' });
    expect(play(fight(60, 224, posed('hang', 90, 220)), 2, (i) => ({ ...STILL, claw: i === 1 })).run.estrella!.hits).toBe(0);
    expect(run.lives.lives).toBe(7);
  });

  it('GDD-BOS-03 a fireball is used up on her and does nothing', () => {
    const { run } = play(fuego(posed('hang', 110, 224)), 12, (i) => ({ ...STILL, fuego: i === 1 }));
    expect(run.fireballs).toEqual([]);
    expect(run.estrella).toMatchObject({ hits: 0, mode: 'hang' });
    // With her high over x 400, the same fireball is still in flight.
    expect(play(fuego(estrellaStart(DEF, 0)), 12, (i) => ({ ...STILL, fuego: i === 1 })).run.fireballs).toHaveLength(1);
  });

  it('GDD-BOS-03 a fireball bursts a tejocote and is used up; the claw bursts one', () => {
    const burst = play({ ...fight(60, 224), power: 'fuego', tejocotes: [rolling(120, -1)] }, 20, (i) => ({ ...STILL, fuego: i === 1 }));
    expect(burst.run.tejocotes).toEqual([]);
    expect(burst.run.fireballs).toEqual([]);
    expect(burst.run.lives.lives).toBe(7);
    const clawed = play({ ...fight(60, 224), tejocotes: [rolling(84, -1)] }, 3, (i) => ({ ...STILL, claw: i === 1 }));
    expect(clawed.run.tejocotes).toEqual([]);
    expect(clawed.run.lives.lives).toBe(7);
  });

  it('GDD-BOS-03 the third hit defeats her and her tejocotes are gone at once; the level is clear 1.0 s after it', () => {
    const at3 = play({ ...fight(60, 224, posed('hang', 90, 220, 2)), tejocotes: [rolling(300), rolling(400)] }, 3, (i) => ({ ...STILL, claw: i === 1 })).run;
    expect(at3.estrella).toMatchObject({ hits: 3, mode: 'defeated', age: 0 });
    expect(at3.tejocotes).toEqual([]);
    const at62 = play(at3, 59).run;
    expect(at62.phase).toBe('playing');
    expect(stepRun(at62, STILL, ARENA).phase).toBe('clear');
  });
});

describe('GDD-BOS-03 her touch in a run', () => {
  it('GDD-BOS-03 touching her costs a life in Base; in Taco it costs the taco and pushes him away from her middle', () => {
    expect(stepRun(fight(240, 224, posed('rest', 240, 224)), STILL, ARENA)).toMatchObject({ phase: 'respawning', lives: { lives: 6 } });
    const taco = stepRun({ ...fight(250, 224, posed('rest', 240, 224)), power: 'taco' }, STILL, ARENA);
    expect(taco).toMatchObject({ phase: 'playing', power: 'base', invulnerable: HIT.invulnerableSteps, lives: { lives: 7 } });
    expect(taco.player.vx).toBe(HIT.knockback);
  });

  it('GDD-BOS-03 touching a tejocote costs a life; not while invulnerable', () => {
    expect(stepRun({ ...fight(240, 224), tejocotes: [rolling(236)] }, STILL, ARENA)).toMatchObject({ phase: 'respawning', lives: { lives: 6 } });
    const taco = stepRun({ ...fight(240, 224), power: 'taco', tejocotes: [rolling(236)] }, STILL, ARENA);
    expect(taco.player.vx).toBe(HIT.knockback);
    expect(stepRun({ ...fight(240, 224), invulnerable: 5, tejocotes: [rolling(236)] }, STILL, ARENA)).toMatchObject({ phase: 'playing', lives: { lives: 7 } });
    expect(stepRun({ ...fight(240, 224, posed('rest', 240, 224)), invulnerable: 5 }, STILL, ARENA)).toMatchObject({ phase: 'playing', lives: { lives: 7 } });
  });

  it('GDD-BOS-03 the step that hits her does not hurt him through her', () => {
    // He stands inside her box (54 to 86); invulnerable for the claw's wind-up, the swing's first step hits her and her touch is gone.
    const run = { ...fight(60, 224, posed('hang', 70, 224)), invulnerable: 2 };
    const swiped = play(run, 3, (i) => ({ ...STILL, claw: i === 1 })).run;
    expect(swiped.estrella).toMatchObject({ hits: 1, mode: 'hurt' });
    expect(swiped).toMatchObject({ phase: 'playing', lives: { lives: 7 } });
    expect(play(run, 3).run).toMatchObject({ phase: 'respawning', lives: { lives: 6 } });
  });

  it('GDD-BOS-03 a step that costs Poncho a life does not hit her; in Taco the same step hits her', () => {
    // A jump from the floor under her (her bottom at 188): its first step lifts his hurtbox's top from 193 to 186.2, a bump, while a
    // tejocote at his feet touches him.
    const run = { ...fight(80, 224, posed('hang', 80, 188)), tejocotes: [rolling(80)] };
    const jump: PlayerInput = { ...STILL, jumpHeld: true };
    const base = stepRun(run, jump, ARENA);
    expect(base).toMatchObject({ phase: 'respawning', lives: { lives: 6 } });
    expect(base.estrella!.hits).toBe(0);
    const taco = stepRun({ ...run, power: 'taco' }, jump, ARENA);
    expect(taco).toMatchObject({ phase: 'playing', power: 'base', lives: { lives: 7 } });
    expect(taco.estrella).toMatchObject({ hits: 1, mode: 'hurt' });
    // The bump stopped his rise and the tejocote (at 81.5 after its roll) pushes him left.
    expect([taco.player.vy, taco.player.vx]).toEqual([0, -HIT.knockback]);
  });
});

describe('GDD-BOS-03 GDD-WLD-10 a bump is no landing', () => {
  it('GDD-BOS-03 after a bump off a tier 1 rebound, jump still held, the next landing on the awning is tier 2', () => {
    // From the floor under the left awning, a jump held through its landing on the awning: the tier 1 rebound bumps her hanging over it.
    let run = fight(80, 224, posed('hang', 80, 112));
    const tiers: number[] = [];
    let bumpedAt = -1;
    for (let i = 1; i <= 120 && tiers.length < 2; i++) {
      const before = run;
      run = stepRun(run, { ...STILL, jumpHeld: true }, ARENA);
      if (run.awningBounce !== before.awningBounce) tiers.push(run.awningBounce!.tier);
      if (bumpedAt < 0 && run.estrella!.hits > 0) bumpedAt = tiers.length;
    }
    expect(bumpedAt).toBe(1);
    expect(tiers).toEqual([1, 2]);
    expect(run.lives.lives).toBe(7);
  });
});

describe('GDD-BOS-01 GDD-BOS-03 a life lost mid-fight', () => {
  it('GDD-BOS-01 a lost life keeps her hits and starts her phase again over x 320 with no tejocotes', () => {
    const lost = stepRun({ ...fight(240, 224, posed('hang', 160, 72, 1)), tejocotes: [rolling(236), rolling(100, -1)] }, STILL, ARENA);
    expect(lost.phase).toBe('respawning');
    const { run } = play(lost, RESPAWN.delaySteps);
    expect(run.phase).toBe('playing');
    expect(run.estrella).toEqual(estrellaStart(DEF, 1));
    expect(run.estrella).toMatchObject({ x: 320, y: 40 });
    expect(run.tejocotes).toEqual([]);
    expect(run.player).toMatchObject({ x: 240, y: 224 });
  });

  it('GDD-BOS-01 a life lost while she is hurt starts the next phase: phase 3 over x 400', () => {
    const lost = stepRun({ ...fight(240, 224, { ...posed('hurt', 160, 72, 2), age: 10 }), tejocotes: [rolling(236)] }, STILL, ARENA);
    expect(lost).toMatchObject({ phase: 'respawning', lives: { lives: 6 } });
    const { run } = play(lost, RESPAWN.delaySteps);
    expect(run.estrella).toEqual(estrellaStart(DEF, 2));
    expect(run.estrella).toMatchObject({ x: 400, y: 40 });
  });

  it('GDD-BOS-01 the restart after the last life starts her fight afresh', () => {
    const last = { ...fight(240, 224, posed('hang', 160, 72, 2)), tejocotes: [rolling(236)], lives: [1, 2, 3, 4, 5, 6].reduce((l) => loseLife(l), startWorld()) };
    const lost = play(last, 200, () => STILL, (r) => r.phase === 'gameover').run;
    expect(lost.phase).toBe('gameover');
    expect(lost.estrella!.hits).toBe(2);
    const waited = play(lost, GAME_OVER.lockoutSteps).run;
    const pressed = stepRun(waited, { ...STILL, jumpHeld: true }, ARENA);
    expect(pressed.phase).toBe('respawning');
    const { run } = play(pressed, FLIP.steps, () => ({ ...STILL, jumpHeld: true }));
    expect(run.phase).toBe('playing');
    expect(run.estrella).toEqual(estrellaStart(DEF, 0));
  });
});
