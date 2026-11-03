import { describe, expect, it } from 'vitest';
import { RESPAWN, FLIP, GAME_OVER } from '../config/tuning';
import { bossStart, fruitBox, ponchoBox, rockBox, type Boss, type BossState, type RockState } from './boss';
import { clawBox } from './claw';
import { overlaps } from './enemy';
import { fireballBox } from './fireball';
import { loseLife, startWorld } from './lives';
import { spawn, type PlayerInput } from './movement';
import { startRun, stepRun, type Level, type RunState } from './run';
import { parseTiles } from './tilemap';

// GDD-BOS-01, GDD-BOS-02: the fight in a run, in an arena laid out like 1-4: floor top at y = 224, a pillar 4 tiles wide and 3 tall at
// each side (top y = 176), his lap's middle at (240, 72), rocks at x = 56 and x = 424 on the pillar tops, Poncho's start at x = 232.
const DEF: Boss = { x: 240, y: 72, floor: 224 };
const ARENA: Level = {
  world: parseTiles([...Array<string>(11).fill('.'.repeat(30)), ...Array<string>(3).fill('####' + '.'.repeat(22) + '####'), ...Array<string>(3).fill('#'.repeat(30))]),
  spawn: { x: 232, y: 224 },
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
  boss: DEF,
  rocks: [
    { x: 56, y: 176 },
    { x: 424, y: 176 },
  ],
};
const STILL: PlayerInput = { move: 0, jumpHeld: false };

/** A fresh run with Poncho standing at (x, y), facing `facing`, and the boss as given. */
function fight(x: number, y: number, boss: BossState = bossStart(DEF, 0), facing: 1 | -1 = 1): RunState {
  return { ...startRun(ARENA), player: { ...spawn(x, y), grounded: true, facing }, boss };
}
/** Runs `n` steps; `input(i)` is the input of step i (1-based). Stops early once `until` holds. */
function play(run: RunState, n: number, input: (i: number) => PlayerInput = () => STILL, until?: (r: RunState) => boolean): { run: RunState; steps: number } {
  let r = run;
  for (let i = 1; i <= n; i++) {
    r = stepRun(r, input(i), ARENA);
    if (until?.(r)) return { run: r, steps: i };
  }
  return { run: r, steps: n };
}
const flying = (x: number, y: number): RockState => ({ x, y, vx: 0, vy: 0, mode: 'flying', age: 0 });
const resting = (x: number): RockState => ({ x, y: 176, vx: 0, vy: 0, mode: 'rest', age: 0 });
/** Stuck in the sand at x, with `hits` taken. */
const stuckAt = (x: number, hits = 0): BossState => ({ ...bossStart(DEF, hits), mode: 'stuck', age: 0, x, y: 209, tx: x, ty: 209 });

describe('GDD-BOS-02 the boss in a run', () => {
  it('GDD-BOS-02 a run of a boss level starts with him at the right end and every rock resting', () => {
    const run = startRun(ARENA);
    expect(run.boss).toEqual(bossStart(DEF, 0));
    expect(run.fruit).toEqual([]);
    expect(run.rocks).toEqual([resting(56), resting(424)]);
    const { boss: _boss, rocks: _rocks, ...withoutBoss } = ARENA;
    const plain = startRun(withoutBoss);
    expect(plain.boss).toBeNull();
    expect(plain.rocks).toEqual([]);
  });

  it('GDD-BOS-02 in a run he flies his lap', () => {
    const { run } = play(fight(232, 224), 120);
    expect(run.boss!.x).toBeCloseTo(88, 6);
    expect(run.boss!.mode).toBe('lap');
  });

  it('GDD-BOS-02 in a run he drops fruit that falls 2 px a step', () => {
    const at40 = play(fight(232, 224), 40).run;
    expect(at40.fruit).toHaveLength(1);
    expect(at40.fruit[0]!.x).toBeCloseTo(316, 2);
    expect(at40.fruit[0]!.y).toBeCloseTo(108.856, 2);
    const at41 = stepRun(at40, STILL, ARENA);
    expect(at41.fruit[0]!.y).toBeCloseTo(110.856, 2);
  });

  it('GDD-BOS-02 in phase 1 a fruit bursts on the floor on step 98', () => {
    const at97 = play(fight(232, 224), 97).run;
    expect(at97.fruit.map((f) => Math.round(f.x))).toEqual([316]);
    expect(stepRun(at97, STILL, ARENA).fruit).toEqual([]);
  });

  it('GDD-BOS-02 in phase 3 a fruit lies on the floor for 3.0 s in a run', () => {
    const run = fight(40, 176, bossStart(DEF, 2)); // on the left pillar, out of his reach
    const at98 = play(run, 98).run;
    expect(at98.fruit.find((f) => Math.round(f.x) === 316)).toMatchObject({ y: 224, landed: true, age: 0 });
    const at277 = play(at98, 179).run;
    expect(at277.fruit.find((f) => Math.round(f.x) === 316)).toMatchObject({ landed: true, age: 179 });
    expect(stepRun(at277, STILL, ARENA).fruit.find((f) => Math.round(f.x) === 316)).toBeUndefined();
    expect(at277.lives.lives).toBe(7);
  });
});

describe('GDD-BOS-02 what hurts Poncho', () => {
  it('GDD-BOS-02 a fruit that touches Poncho costs a life on step 83', () => {
    const at82 = play(fight(316, 224), 82).run;
    expect(at82.lives.lives).toBe(7);
    const at83 = stepRun(at82, STILL, ARENA);
    expect(at83.lives.lives).toBe(6);
    expect(at83.phase).toBe('respawning');
  });

  it('GDD-BOS-02 in Taco a fruit pushes him away from the fruit', () => {
    const { run } = play({ ...fight(314, 224), power: 'taco' }, 83);
    expect(run.power).toBe('base');
    expect(run.player.vx).toBe(-80);
    expect(run.lives.lives).toBe(7);
  });

  it('GDD-BOS-02 in Taco a lying fruit costs the taco once while he is invulnerable', () => {
    const lying = { ...fight(316, 224, { ...bossStart(DEF, 2), x: 392 }), power: 'taco' as const, fruit: [{ x: 316, y: 224, landed: true, age: 0 }] };
    const { run } = play(lying, 60);
    expect(run.power).toBe('base');
    expect(run.lives.lives).toBe(7);
  });

  it('GDD-BOS-02 touching him while he sweeps costs a life on step 369', () => {
    const at368 = play(fight(232, 224, bossStart(DEF, 1)), 368).run;
    expect(at368.lives.lives).toBe(7);
    expect(at368.boss!.mode).toBe('sweep');
    expect(stepRun(at368, STILL, ARENA).lives.lives).toBe(6);
  });

  it('GDD-BOS-02 in Taco the sweep costs the taco once', () => {
    const { run } = play({ ...fight(232, 224, bossStart(DEF, 1)), power: 'taco' }, 380);
    expect(run.power).toBe('base');
    expect(run.lives.lives).toBe(7);
  });

  it('GDD-BOS-02 when he and a fruit touch Poncho in one step he is pushed away from Don Zopilote', () => {
    // GDD-CMB-03: one hit, pushed away from the first of spike, enemy, Don Zopilote, fruit. He sweeps in from the left, a fruit lies on the right.
    const sweeping: BossState = { ...bossStart(DEF, 1), mode: 'sweep', age: 10, x: 180, y: 209, dir: -1, tx: 88, ty: 209 };
    const run = stepRun({ ...fight(200, 224, sweeping), power: 'taco', fruit: [{ x: 204, y: 224, landed: true, age: 0 }] }, STILL, ARENA);
    expect(run.power).toBe('base');
    expect(run.player.vx).toBe(80);
  });

  it('GDD-BOS-02 when an enemy and Don Zopilote touch Poncho in one step he is pushed away from the enemy', () => {
    const withAlacran: Level = { ...ARENA, enemies: [{ x: 210, y: 224 }] };
    const sweeping: BossState = { ...bossStart(DEF, 1), mode: 'sweep', age: 10, x: 180, y: 209, dir: -1, tx: 88, ty: 209 };
    const start: RunState = { ...startRun(withAlacran), player: { ...spawn(200, 224), grounded: true }, boss: sweeping, power: 'taco' };
    const run = stepRun(start, STILL, withAlacran);
    expect(run.power).toBe('base');
    expect(run.player.vx).toBe(-80);
  });

  it('GDD-BOS-02 landing on him is no stomp, it costs a life', () => {
    // GDD-CMB-01: he cannot be stomped; landing on him is a touch like any other. He is frozen in his telegraph, Poncho falls onto his top.
    const frozen: BossState = { ...bossStart(DEF, 0), mode: 'telegraph', age: 0, x: 240, y: 72 };
    const run = stepRun({ ...fight(240, 58, frozen), player: { ...spawn(240, 58), grounded: false, vy: 120 } }, STILL, ARENA);
    expect(run.stomped).toBe(false);
    expect(run.lives.lives).toBe(6);
    expect(run.phase).toBe('respawning');
  });

  it('GDD-BOS-02 a flying rock that touches Poncho does not hurt him', () => {
    // A rock never hurts Poncho: one flying through his hurtbox leaves him as he was, in Base, with all seven lives.
    const run = stepRun({ ...fight(200, 224), rocks: [flying(200, 215), resting(424)] }, STILL, ARENA);
    expect(overlaps(ponchoBox(run.player), rockBox(run.rocks[0]!))).toBe(true);
    expect(run.rocks[0]!.mode).toBe('flying');
    expect(run).toMatchObject({ phase: 'playing', power: 'base', invulnerable: 0, lives: { lives: 7 } });
    expect(run.player.vx).toBe(0);
  });

  it('GDD-BOS-02 touching him while he is stuck in the sand does nothing', () => {
    const stuck: BossState = { ...bossStart(DEF, 0), mode: 'stuck', age: 0, x: 232, y: 209, tx: 232, ty: 209 };
    const { run } = play(fight(232, 224, stuck), 30);
    expect(run.lives.lives).toBe(7);
    expect(run.phase).toBe('playing');
  });
});

describe('GDD-BOS-02 hitting him', () => {
  it('GDD-BOS-02 a claw swipe hits him while he is stuck', () => {
    const { run } = play(fight(200, 224, stuckAt(232)), 6, (i) => ({ ...STILL, claw: i === 1 }));
    expect(run.boss).toMatchObject({ hits: 1, mode: 'hurt' });
  });

  it('GDD-BOS-02 the claw does not hit him while he climbs', () => {
    const climbing: BossState = { ...stuckAt(232), mode: 'climb', tx: 88, ty: 72 };
    const { run } = play(fight(200, 224, climbing), 6, (i) => ({ ...STILL, claw: i === 1 }));
    expect(run.boss!.hits).toBe(0);
  });

  it('GDD-BOS-02 a fireball hits him while he is stuck and is used up', () => {
    const { run } = play({ ...fight(180, 224, stuckAt(232)), power: 'fuego' }, 12, (i) => ({ ...STILL, fuego: i === 1 }));
    expect(run.boss).toMatchObject({ hits: 1, mode: 'hurt' });
    expect(run.fireballs).toEqual([]);
  });

  it('GDD-BOS-02 a fireball that touches him while he sweeps is used up and is no hit', () => {
    const sweeping: BossState = { ...bossStart(DEF, 1), mode: 'sweep', age: 0, x: 260, y: 209, dir: -1, tx: 88, ty: 209 };
    const { run } = play({ ...fight(180, 224, sweeping), power: 'fuego' }, 12, (i) => ({ ...STILL, fuego: i === 1 }));
    expect(run.boss!.hits).toBe(1);
    expect(run.fireballs).toEqual([]);
  });

  it('GDD-BOS-02 a fireball passes through him once he is defeated', () => {
    const down: BossState = { ...stuckAt(232, 3), mode: 'defeated' };
    const { run } = play({ ...fight(180, 224, down), power: 'fuego' }, 10, (i) => ({ ...STILL, fuego: i === 1 }));
    expect(run.fireballs).toHaveLength(1);
  });

  it('GDD-BOS-02 a claw swipe knocks the rock off the left pillar and it breaks on the floor on step 26', () => {
    const run = fight(40, 176);
    const at3 = play(run, 3, (i) => ({ ...STILL, claw: i === 1 })).run;
    expect(at3.rocks[0]).toMatchObject({ mode: 'flying', x: 56, y: 176, vx: 90, vy: -150 });
    expect(at3.rocks[1]).toEqual(resting(424));
    const at15 = play(at3, 12).run;
    expect(at15.rocks[0]!.x).toBeCloseTo(74, 6);
    expect(at15.rocks[0]!.y).toBeCloseTo(176, 6);
    const at25 = play(at15, 10).run;
    expect(at25.rocks[0]!.mode).toBe('flying');
    expect(stepRun(at25, STILL, ARENA).rocks[0]).toMatchObject({ mode: 'gone', age: 0 });
  });

  it('GDD-BOS-02 a rock knocked left from the pillar edge breaks on the pillar top', () => {
    const run = fight(58, 176, bossStart(DEF, 0), -1);
    const at15 = play(run, 15, (i) => ({ ...STILL, claw: i === 1 })).run;
    expect(at15.rocks[0]!.mode).toBe('flying');
    expect(at15.rocks[0]!.vx).toBe(-90);
    expect(stepRun(at15, STILL, ARENA).rocks[0]!.mode).toBe('gone');
  });

  it('GDD-BOS-02 a broken rock is back on its spot 120 steps later', () => {
    const run = fight(40, 176);
    const at145 = play(run, 145, (i) => ({ ...STILL, claw: i === 1 })).run;
    expect(at145.rocks[0]!.mode).toBe('gone');
    expect(stepRun(at145, STILL, ARENA).rocks[0]).toEqual(resting(56));
  });

  it('GDD-BOS-02 in phase 1 a rock knocked from the pillar hits him stuck beside it', () => {
    // On the left pillar the dive aims at x 88, the end of his lap, and sticks him there on step 382.
    const at382 = play(fight(40, 176), 382).run;
    expect(at382.boss).toMatchObject({ mode: 'stuck', x: 88, y: 209 });
    const { run } = play(at382, 30, (i) => ({ ...STILL, claw: i === 1 }));
    expect(run.boss).toMatchObject({ hits: 1, mode: 'hurt' });
    expect(run.rocks[0]!.mode).toBe('gone');
  });

  it('GDD-BOS-02 a rock that touches him while he is hurt breaks and is no hit', () => {
    const hurt: BossState = { ...stuckAt(232, 1), mode: 'hurt' };
    const { run } = play({ ...fight(400, 224, hurt), rocks: [flying(232, 200), resting(424)] }, 1);
    expect(run.boss!.hits).toBe(1);
    expect(run.rocks[0]!.mode).toBe('gone');
  });

  it('GDD-BOS-02 a rock that is not flying does not hit him', () => {
    // One resting and one broken where they would touch him stuck in the sand at x 232.
    const lying: RockState[] = [
      { x: 232, y: 224, vx: 0, vy: 0, mode: 'rest', age: 0 },
      { x: 240, y: 224, vx: 90, vy: 300, mode: 'gone', age: 0 },
    ];
    const run = stepRun({ ...fight(400, 224, stuckAt(232)), rocks: lying }, STILL, ARENA);
    expect(run.boss).toMatchObject({ hits: 0, mode: 'stuck' });
    expect(run.rocks.map((r) => r.mode)).toEqual(['rest', 'gone']);
  });

  it('GDD-BOS-02 a claw swipe does not knock a broken rock', () => {
    // A rock broken on the floor lies where it broke until it is back on its spot; the swing on step 3 overlaps it.
    const broke: RockState = { x: 84, y: 224, vx: 90, vy: 300, mode: 'gone', age: 0 };
    const { run } = play({ ...fight(70, 224), rocks: [broke, resting(424)] }, 3, (i) => ({ ...STILL, claw: i === 1 }));
    expect(run.claw.phase).toBe('swing');
    expect(run.rocks[0]).toMatchObject({ mode: 'gone', age: 3 });
  });

  it('GDD-BOS-02 the step that hits him does not hurt Poncho', () => {
    const sweeping: BossState = { ...bossStart(DEF, 1), mode: 'sweep', age: 10, x: 200, y: 209, dir: -1, tx: 88, ty: 209 };
    const run = stepRun({ ...fight(170, 224, sweeping), rocks: [flying(200, 196), resting(424)] }, STILL, ARENA);
    expect(run.boss).toMatchObject({ hits: 2, mode: 'hurt' });
    expect(run.lives.lives).toBe(7);
    expect(run.phase).toBe('playing');
  });

  it('GDD-BOS-02 a step that costs Poncho a life does not hit him', () => {
    const sweeping: BossState = { ...bossStart(DEF, 1), mode: 'sweep', age: 10, x: 200, y: 209, dir: -1, tx: 88, ty: 209 };
    const run = stepRun({ ...fight(170, 224, sweeping), rocks: [flying(200, 196), resting(424)], fruit: [{ x: 170, y: 192.5, landed: false, age: 0 }] }, STILL, ARENA);
    expect(run.phase).toBe('respawning');
    expect(run.lives.lives).toBe(6);
    expect(run.boss!.hits).toBe(1);
  });

  it('GDD-BOS-02 the third hit defeats him and his fruit is gone at once', () => {
    const run = { ...fight(200, 224, stuckAt(232, 2)), fruit: [{ x: 316, y: 224, landed: true, age: 0 }, { x: 160, y: 120, landed: false, age: 0 }] };
    const at3 = play(run, 3, (i) => ({ ...STILL, claw: i === 1 })).run;
    expect(at3.boss).toMatchObject({ hits: 3, mode: 'defeated', age: 0 });
    expect(at3.fruit).toEqual([]);
  });

  it('GDD-BOS-02 the level is clear 1.0 s after the third hit', () => {
    const at3 = play(fight(200, 224, stuckAt(232, 2)), 3, (i) => ({ ...STILL, claw: i === 1 })).run;
    const at62 = play(at3, 59).run;
    expect(at62.phase).toBe('playing');
    expect(stepRun(at62, STILL, ARENA).phase).toBe('clear');
  });

  it('GDD-BOS-02 a button held as he is defeated is no new press on the clear screen', () => {
    const held: PlayerInput = { ...STILL, claw: true };
    const { run } = play(fight(200, 224, stuckAt(232, 2)), 64, () => held);
    expect(run.phase).toBe('clear');
    expect(run.revealAll).toBe(false);
  });
});

describe('GDD-BOS-02 the claw and fireballs pass through fruit', () => {
  // A fruit lying on the floor in phase 3, in front of Poncho but clear of him; Don Zopilote is hurt, so he drops nothing new.
  const hurt: BossState = { ...bossStart(DEF, 2), mode: 'hurt' };

  it('GDD-BOS-02 a claw swipe passes through a fruit', () => {
    const lying = { x: 200, y: 224, landed: true, age: 0 };
    const { run } = play({ ...fight(180, 224, hurt), fruit: [lying] }, 3, (i) => ({ ...STILL, claw: i === 1 }));
    expect(overlaps(clawBox(run.player, run.claw)!, fruitBox(run.fruit[0]!))).toBe(true);
    expect(run.fruit).toEqual([{ ...lying, age: 3 }]);
    expect(run.lives.lives).toBe(7);
  });

  it('GDD-BOS-02 a fireball passes through a fruit', () => {
    let run: RunState = { ...fight(180, 224, hurt), power: 'fuego', fruit: [{ x: 208, y: 224, landed: true, age: 0 }] };
    let met = 0;
    for (let i = 1; i <= 12; i++) {
      run = stepRun(run, { ...STILL, fuego: i === 1 }, ARENA);
      if (run.fireballs.some((f) => overlaps(fireballBox(f), fruitBox(run.fruit[0]!)))) met++;
    }
    expect(met).toBeGreaterThan(0);
    expect(run.fireballs).toHaveLength(1);
    expect(run.fruit).toHaveLength(1);
  });
});

describe('GDD-BOS-01 a life lost mid-fight', () => {
  it('GDD-BOS-01 a lost life keeps his hits and starts his phase again with no fruit and every rock back', () => {
    const sweeping: BossState = { ...bossStart(DEF, 1), mode: 'sweep', age: 10, x: 200, y: 209, dir: -1, tx: 88, ty: 209 };
    const lost = stepRun({ ...fight(170, 224, sweeping), rocks: [flying(300, 100), resting(424)], fruit: [{ x: 170, y: 192.5, landed: false, age: 0 }] }, STILL, ARENA);
    expect(lost.phase).toBe('respawning');
    const { run } = play(lost, RESPAWN.delaySteps);
    expect(run.phase).toBe('playing');
    expect(run.boss).toEqual(bossStart(DEF, 1));
    expect(run.fruit).toEqual([]);
    expect(run.rocks).toEqual([resting(56), resting(424)]);
    // Poncho is back at the arena start, its only checkpoint (GDD-BOS-01).
    expect(run.player).toMatchObject({ x: 232, y: 224 });
  });

  it('GDD-BOS-01 a life lost while he is hurt starts the next phase', () => {
    // Hit once and still flashing, he is in phase 2 already: the respawn starts phase 2, not phase 1 again.
    const hurt: BossState = { ...stuckAt(232, 1), mode: 'hurt', age: 10 };
    const lost = stepRun({ ...fight(170, 224, hurt), fruit: [{ x: 170, y: 192.5, landed: false, age: 0 }] }, STILL, ARENA);
    expect(lost).toMatchObject({ phase: 'respawning', lives: { lives: 6 } });
    const { run } = play(lost, RESPAWN.delaySteps);
    expect(run.phase).toBe('playing');
    expect(run.boss).toEqual(bossStart(DEF, 1));
  });

  it('GDD-BOS-01 the restart after the last life starts the fight afresh', () => {
    const last = { ...fight(316, 224, bossStart(DEF, 2)), lives: [1, 2, 3, 4, 5, 6].reduce((l) => loseLife(l), startWorld()) };
    const lost = play(last, 200, () => STILL, (r) => r.phase === 'gameover').run;
    expect(lost.phase).toBe('gameover');
    expect(lost.boss!.hits).toBe(2);
    const waited = play(lost, GAME_OVER.lockoutSteps).run;
    const pressed = stepRun(waited, { ...STILL, jumpHeld: true }, ARENA);
    expect(pressed.phase).toBe('respawning');
    const { run } = play(pressed, FLIP.steps, () => ({ ...STILL, jumpHeld: true }));
    expect(run.phase).toBe('playing');
    expect(run.boss).toEqual(bossStart(DEF, 0));
  });
});
