import { describe, expect, it } from 'vitest';
import { RUN, STOMP, TILE } from '../config/tuning';
import { LEVEL_1_4 } from '../levels/level1-4';
import { LEVEL_2_4 } from '../levels/level2-4';
import { bossBox, bossStart, ponchoBox } from './boss';
import { estrellaStart, type EstrellaState, type Tejocote } from './estrella';
import { freshEnemies, overlaps, type Enemy, type EnemyState } from './enemy';
import { CROUCHING } from './chapulin';
import { stun } from './trompo';
import type { MovingBlock } from './block';
import { releaseFrom, stepItem, type Item } from './item';
import { spawn, type PlayerInput, type PlayerState } from './movement';
import { withPinatas, type Pinata } from './pinata';
import { startRun, stepRun, type Level, type RunState } from './run';
import { eat, type Power } from './taco';
import { parseTiles } from './tilemap';

const idle: PlayerInput = { move: 0, jumpHeld: false };
const right: PlayerInput = { move: 1, jumpHeld: false };
const jump: PlayerInput = { move: 0, jumpHeld: true };

// A floor at row 8 (top y = 128) in a world 40 tiles wide and 10 tall. The special piñata hangs in column 5, row 4 (x 80 to 96, underside
// y = 80): 48 px above the floor, so a standing Poncho's 32 px head is 16 px short of it and any jump bumps it (GDD-PWR-05). Row 3 above it
// is free, so what it releases stands on its top, y = 64.
const COLS = 40;
const rowsOf = (extra: Readonly<Record<number, string>> = {}): string[] => Array.from({ length: 10 }, (_, r) => extra[r] ?? (r >= 8 ? '#'.repeat(COLS) : '.'.repeat(COLS)));
const world = parseTiles(rowsOf());
const special: Pinata = { col: 5, row: 4, special: true };
const levelOf = (more: Partial<Level> = {}): Level => ({
  world,
  spawn: { x: 88, y: 128 },
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
  ...more,
});
const plain = levelOf();
/** A spike in column 5 on the floor (row 7), under Poncho at x = 88. */
const spiked = levelOf({ spikes: [{ col: 5, row: 7 }] });
const standing = (x: number, y = 128): PlayerState => ({ ...spawn(x, y), grounded: true });
const runAt = (level: Level, player: PlayerState, more: Partial<RunState> = {}): RunState => ({ ...startRun(level), player, ...more });
/** A pepper on the floor right on Poncho at x = 88: he eats it on the next step. */
const pepper: Item = { x: 88, y: 128, vx: 0, vy: 0, kind: 'fantasma' };
const play = (r: RunState, input: PlayerInput, steps: number, level: Level = plain): RunState => {
  for (let i = 0; i < steps; i++) r = stepRun(r, input, level);
  return r;
};
/** Holds jump under the piñata until it opens (at most 40 steps). */
const bump = (r: RunState, level: Level): RunState => {
  for (let i = 0; i < 40 && !r.pinatasOpen.some(Boolean); i++) r = stepRun(r, jump, level);
  return r;
};

/**
 * Eaten on step 1 (Poncho stands on the pepper), then idle on the plain level up to step `touch - 1`, then step `touch` on the spiked
 * level with Poncho standing in the spike. Returns the run after step `touch`.
 */
const spikeAt = (touch: number): RunState => {
  let r = stepRun(runAt(plain, standing(88), { items: [pepper] }), idle, plain);
  r = play(r, idle, touch - 2);
  return stepRun(r, idle, spiked);
};


/**
 * Eaten on step 1, again on step 301 (Poncho stands on a pepper each time), idle to step `touch - 1`, then step `touch` on the spiked level.
 * Returns the run after step `touch`.
 */
const spikeAfterSecond = (touch: number): RunState => {
  let r = stepRun(runAt(plain, standing(88), { items: [pepper] }), idle, plain);
  r = play(r, idle, 299); // steps 2 to 300
  r = stepRun({ ...r, items: [pepper] }, idle, plain); // step 301
  r = play(r, idle, touch - 302);
  return stepRun(r, idle, spiked);
};

const withEnemy = (def: Enemy, make: (s: EnemyState) => EnemyState, more: Partial<RunState> = {}): { level: Level; run: RunState } => {
  const level = levelOf({ enemies: [def] });
  return { level, run: runAt(level, standing(88), { enemies: [make(freshEnemies([def])[0]!)], ...more }) };
};

describe('GDD-PWR-04 Chile Fantasma', () => {
  describe('where it comes from', () => {
    const pinataLevel = levelOf({ pinatas: [special] });
    it.each<Power>(['base', 'taco', 'fuego'])('GDD-PWR-04 a special piñata releases the Chile Fantasma in %s, standing on its top, not moving', (power) => {
      const r = bump(runAt(pinataLevel, standing(88), { power }), pinataLevel);
      expect(r.pinatasOpen).toEqual([true]);
      expect(r.items).toHaveLength(1);
      expect(r.items[0]).toMatchObject({ kind: 'fantasma', x: 88, y: 64, vx: 0 });
    });

    it('GDD-PWR-04 a plain piñata still releases a taco in Base and a chile in Taco', () => {
      const level = levelOf({ pinatas: [{ col: 5, row: 4 }] });
      expect(bump(runAt(level, standing(88)), level).items[0]).toMatchObject({ kind: 'taco', vx: 40 });
      expect(bump(runAt(level, standing(88), { power: 'taco' }), level).items[0]).toMatchObject({ kind: 'chile', vx: 0 });
    });

    it('GDD-PWR-04 a special piñata with no room above stays closed', () => {
      const walled = levelOf({ pinatas: [special], world: parseTiles(rowsOf({ 3: '.....#' + '.'.repeat(COLS - 6) })) });
      const r = bump(runAt(walled, standing(88)), walled);
      expect(r.pinatasOpen).toEqual([false]);
      expect(r.items).toEqual([]);
      expect(releaseFrom(special, walled.world, 'fantasma')).toBeNull();
    });

    it('GDD-PWR-04 the Chile Fantasma stays where it is', () => {
      const solid = withPinatas(world, [special]); // the piñata is solid, open or shut
      const item = releaseFrom(special, solid, 'fantasma')!;
      let moving = item;
      for (let i = 0; i < 60; i++) moving = stepItem(moving, solid);
      expect(moving.x).toBe(item.x);
      expect(moving.y).toBe(item.y);
    });
  });

  describe('eating it', () => {
    it.each<Power>(['base', 'taco', 'fuego'])('GDD-PWR-04 eating it keeps %s', (power) => {
      const r = stepRun(runAt(plain, standing(88), { power, items: [pepper] }), idle, plain);
      expect(r.items).toEqual([]);
      expect(r.power).toBe(power);
      expect(r.fantasma).toBeGreaterThan(0);
    });

    it('GDD-PWR-04 eat: the fantasma never changes the state, the taco and chile rules are unchanged', () => {
      const powers: Power[] = ['base', 'taco', 'fuego'];
      for (const p of powers) expect(eat(p, 'fantasma'), p).toBe(p);
      expect(powers.map((p) => eat(p, 'taco'))).toEqual(['taco', 'taco', 'fuego']);
      expect(powers.map((p) => eat(p, 'chile'))).toEqual(['taco', 'fuego', 'fuego']);
    });

    it('GDD-PWR-04 a taco or chile picked up while it runs works as usual', () => {
      const taco = stepRun(runAt(plain, standing(88), { fantasma: 100, items: [{ ...pepper, kind: 'taco' }] }), idle, plain);
      expect(taco.power).toBe('taco');
      expect(taco.fantasma).toBe(99);
      const chile = stepRun(runAt(plain, standing(88), { fantasma: 100, power: 'taco', items: [{ ...pepper, kind: 'chile' }] }), idle, plain);
      expect(chile.power).toBe('fuego');
      expect(chile.fantasma).toBe(99);
    });
  });

  describe('how long it protects', () => {
    it('GDD-PWR-04 it protects for exactly 480 steps, the eating step included', () => {
      // Eaten on step k = 1: steps 1 to 480 are protected, a spike touched on step 480 is no hit, on step 481 it is.
      const last = spikeAt(480);
      expect(last.lives.lives).toBe(7);
      expect(last.phase).toBe('playing');
      const over = spikeAt(481);
      expect(over.lives.lives).toBe(6);
      expect(over.phase).toBe('respawning');
    });

    it('GDD-PWR-04 the step it is eaten is protected', () => {
      const r = stepRun(runAt(spiked, standing(88), { items: [pepper] }), idle, spiked);
      expect(r.lives.lives).toBe(7);
      expect(r.phase).toBe('playing');
    });

    it('GDD-PWR-04 eating it again starts the 8 s over', () => {
      // Eaten on step 1 and again on step 301: protected from 301 to 780 (k + 779 for k = 1), hit on 781.
      expect(spikeAfterSecond(780).lives.lives).toBe(7);
      expect(spikeAfterSecond(781).lives.lives).toBe(6);
    });
  });

  describe('what it protects from', () => {
    it('GDD-PWR-04 a spike is no hit while it runs: no life lost, no push, no invulnerability, the state kept', () => {
      const r = stepRun(runAt(spiked, standing(88), { fantasma: 100, power: 'taco' }), idle, spiked);
      expect(r.phase).toBe('playing');
      expect(r.lives.lives).toBe(7);
      expect(r.power).toBe('taco');
      expect(r.invulnerable).toBe(0);
      expect(r.player.vx).toBe(0);
    });

    it('GDD-PWR-04 a pit still costs a life and ends it', () => {
      const gap = levelOf({ world: parseTiles(rowsOf({ 8: '#'.repeat(4) + '....' + '#'.repeat(COLS - 8), 9: '#'.repeat(4) + '....' + '#'.repeat(COLS - 8) })) });
      let r = runAt(gap, { ...spawn(88, 132), grounded: false }, { fantasma: 480 });
      for (let i = 0; i < 120 && r.phase === 'playing'; i++) r = stepRun(r, idle, gap);
      expect(r.phase).toBe('respawning');
      expect(r.lives.lives).toBe(6);
      expect(r.fantasma).toBe(0);
    });

    it('GDD-PWR-04 a crush still costs a life and ends it', () => {
      // As block.test.ts: a block coming down onto Poncho standing on the floor; its underside meets his head after about 66 steps.
      const dropper: MovingBlock = { x0: 80, y0: 36, x1: 80, y1: 112, w: 16, h: 16 };
      const level = levelOf({ blocks: [dropper] });
      let r = runAt(level, standing(88), { fantasma: 480 });
      for (let i = 0; i < 150 && r.phase === 'playing'; i++) r = stepRun(r, idle, level);
      expect(r.phase).toBe('respawning');
      expect(r.lives.lives).toBe(6);
      expect(r.fantasma).toBe(0);
    });

    it('GDD-PWR-04 the respawn starts without it', () => {
      const r = stepRun({ ...startRun(plain), phase: 'respawning', wait: 1, fantasma: 100 }, idle, plain);
      expect(r.phase).toBe('playing');
      expect(r.fantasma).toBe(0);
    });
  });

  describe('his touch', () => {
    // Each case: an enemy standing on the floor on Poncho at x = 88 (feet y = 128), or a Zopilote cruising at his height.
    const cases: [string, Enemy, (s: EnemyState) => EnemyState][] = [
      ['Alacrán', { x: 88, y: 128 }, (s) => s],
      ['Zopilote', { x: 88, y: 112, kind: 'zopilote' }, (s) => s],
      ['Tlacuache walking', { x: 88, y: 128, kind: 'tlacuache' }, (s) => s],
      ['Tlacuache playing dead', { x: 88, y: 128, kind: 'tlacuache' }, (s) => ({ ...s, gait: { phase: 'dead', age: 0, playedDead: true } })],
      ['cactus buddy', { x: 88, y: 128, kind: 'cactus' }, (s) => s],
      ['Paloma', { x: 88, y: 128, kind: 'paloma' }, (s) => s],
      ['Chapulín', { x: 88, y: 128, kind: 'chapulin' }, (s) => ({ ...s, hop: CROUCHING })],
      ['Trompo spinning', { x: 88, y: 128, kind: 'trompo' }, (s) => s],
      ['Trompo stunned', { x: 88, y: 128, kind: 'trompo' }, stun],
    ];
    it.each(cases)('GDD-PWR-04 his touch defeats every regular enemy: %s', (_name, def, make) => {
      const { level, run } = withEnemy(def, make, { fantasma: 100 });
      const r = stepRun(run, idle, level);
      expect(r.enemies[0]!.alive).toBe(false);
      expect(r.phase).toBe('playing');
      expect(r.lives.lives).toBe(7);
      expect(r.invulnerable).toBe(0);
    });

    it.each(cases.filter(([name]) => name !== 'Tlacuache playing dead' && name !== 'Trompo stunned'))('GDD-PWR-04 without it %s is a hit, and is not defeated', (_name, def, make) => {
      const { level, run } = withEnemy(def, make);
      const r = stepRun(run, idle, level);
      expect(r.phase).toBe('respawning');
      expect(r.enemies[0]!.alive).toBe(true);
    });

    it('GDD-PWR-04 without it the cactus buddy still cannot be defeated and touching it is a hit', () => {
      const { level, run } = withEnemy({ x: 88, y: 128, kind: 'cactus' }, (s) => s);
      let r = run;
      for (let i = 0; i < 3 && r.phase === 'playing'; i++) r = stepRun(r, idle, level);
      expect(r.enemies[0]!.alive).toBe(true);
      expect(r.lives.lives).toBe(6);
    });

    it('GDD-PWR-04 a stomp still bounces him while it runs', () => {
      const def: Enemy = { x: 88, y: 128 };
      const level = levelOf({ enemies: [def] });
      let r = runAt(level, { ...spawn(88, 110), vy: 150, grounded: false }, { fantasma: 100, enemies: freshEnemies([def]) });
      for (let i = 0; i < 20 && r.enemies[0]!.alive; i++) r = stepRun(r, idle, level);
      expect(r.enemies[0]!.alive).toBe(false);
      expect(r.stomped).toBe(true);
      expect(r.player.vy).toBe(-STOMP.bounce);
      expect(r.fantasma).toBeGreaterThan(0);
      expect(r.lives.lives).toBe(7);
    });

    it('GDD-PWR-04 Fuego still spits while it runs', () => {
      const r = stepRun(runAt(plain, standing(88), { fantasma: 100, power: 'fuego' }), { ...idle, fuego: true }, plain);
      expect(r.fireballs).toHaveLength(1);
      expect(r.power).toBe('fuego');
    });
  });

  describe('bosses', () => {
    const boss1 = LEVEL_1_4;
    /** Poncho in the air right on Don Zopilote's box (he laps, so he harms). */
    const onBoss = (more: Partial<RunState>): RunState => {
      const b = bossStart(boss1.boss!, 0);
      return runAt(boss1, { ...spawn(b.x, b.y + 16), grounded: false }, more);
    };

    it('GDD-PWR-04 Don Zopilote cannot hurt him and is not hurt by his touch', () => {
      const b = onBoss({}).boss!;
      expect(overlaps(ponchoBox(onBoss({}).player), bossBox(b))).toBe(true); // the setup is a touch
      const hurts = stepRun(onBoss({}), idle, boss1);
      expect(hurts.phase).toBe('respawning'); // without it, the same touch is a hit
      const r = stepRun(onBoss({ fantasma: 100 }), idle, boss1);
      expect(r.phase).toBe('playing');
      expect(r.lives.lives).toBe(7);
      expect(r.boss!.hits).toBe(0);
      expect(r.boss!.mode).toBe('lap');
    });

    it('GDD-PWR-04 a cactus fruit cannot hurt him and is not hurt by his touch', () => {
      const fruit = { x: 232, y: 224, landed: true, age: 0 };
      const level = boss1;
      const hit = stepRun(runAt(level, standing(232, 224), { fruit: [fruit] }), idle, level);
      expect(hit.phase).toBe('respawning'); // without it, a hit
      const r = stepRun(runAt(level, standing(232, 224), { fantasma: 100, fruit: [fruit] }), idle, level);
      expect(r.phase).toBe('playing');
      expect(r.lives.lives).toBe(7);
      expect(r.fruit).toHaveLength(1);
    });

    const arena = LEVEL_2_4;
    const hanging = (x: number): EstrellaState => ({ ...estrellaStart(arena.estrella!, 0), mode: 'hang', age: 0, x, y: 224, tx: x, ty: 224 });
    it('GDD-PWR-04 La Estrella cannot hurt him and is not hurt by his touch', () => {
      const without = stepRun(runAt(arena, standing(240, 224), { estrella: hanging(240) }), idle, arena);
      expect(without.phase).toBe('respawning'); // without it, her touch is a hit
      const r = stepRun(runAt(arena, standing(240, 224), { fantasma: 100, estrella: hanging(240) }), idle, arena);
      expect(r.phase).toBe('playing');
      expect(r.lives.lives).toBe(7);
      expect(r.estrella!.hits).toBe(0);
      expect(r.estrella!.mode).toBe('hang');
    });

    it('GDD-PWR-04 a tejocote cannot hurt him', () => {
      const tejocote: Tejocote = { x: 240, y: 224, dir: 1, wait: 0 };
      const without = stepRun(runAt(arena, standing(240, 224), { tejocotes: [tejocote] }), idle, arena);
      expect(without.phase).toBe('respawning');
      const r = stepRun(runAt(arena, standing(240, 224), { fantasma: 100, tejocotes: [tejocote] }), idle, arena);
      expect(r.phase).toBe('playing');
      expect(r.lives.lives).toBe(7);
    });
  });

  describe('his speed', () => {
    const long = levelOf();
    const maxVx = (fantasma: number): number => {
      let r = runAt(long, standing(24), { fantasma });
      let max = 0;
      for (let i = 0; i < 120; i++) {
        r = stepRun(r, right, long);
        expect(r.player.x, 'still on the floor').toBeLessThan(COLS * TILE - 8);
        max = Math.max(max, r.player.vx);
      }
      return max;
    };

    it('GDD-PWR-04 he runs at up to 180 px/s while it runs', () => {
      expect(maxVx(480)).toBe(180);
      expect(maxVx(0)).toBe(RUN.maxSpeed);
      expect(RUN.maxSpeed).toBe(120);
    });

    it('GDD-PWR-04 after it ends he slows back to 120 px/s holding right', () => {
      let r = runAt(long, { ...standing(24), vx: 180 }, { fantasma: 1 });
      const vxs: number[] = [];
      for (let i = 0; i < 60; i++) {
        r = stepRun(r, right, long);
        vxs.push(r.player.vx);
      }
      expect(vxs[0]).toBe(180); // the last protected step still runs at 180
      expect(r.fantasma).toBe(0);
      const at120 = vxs.indexOf(120);
      expect(at120).toBeGreaterThan(1);
      for (let i = 1; i <= at120; i++) expect(vxs[i], `step ${i + 1}`).toBeLessThan(vxs[i - 1]!); // falls every step...
      for (let i = at120; i < vxs.length; i++) expect(vxs[i]).toBe(120); // ...and stays at 120
    });
  });
});
