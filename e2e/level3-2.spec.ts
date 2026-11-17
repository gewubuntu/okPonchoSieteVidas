import { expect, test, type Page } from '@playwright/test';
import { ARMADILLO, CART, HITBOX, TILE } from '../src/config/tuning';
import { CAREFUL_READ } from '../src/levels/level3-2.drive';
import {
  LEVEL_3_2,
  LEVEL_3_2_BEAMS,
  LEVEL_3_2_CUTTING_K3,
  LEVEL_3_2_FAR_WALL,
  LEVEL_3_2_LEDGES,
  LEVEL_3_2_PEN,
  LEVEL_3_2_PILLAR,
  LEVEL_3_2_RAIL,
  LEVEL_3_2_RAMPS,
  LEVEL_3_2_SEAT,
  LEVEL_3_2_SUNKEN,
} from '../src/levels/level3-2';
import type { PonchoDebug } from '../src/scenes/PlayScene';
import { railLength } from '../src/sim/cart';
import { kindOf } from '../src/sim/enemy';
import type { PlayerInput } from '../src/sim/movement';
import { openGame, resultsRowCentre, stepUntil, tapAt, waitForResults } from './helpers';
import { MINE_DEEP_FRAME, MINE_UNDERSIDE_FRAME, TOP_FRAME } from '../src/ui/groundTiles';

// Level 3-2 "La Mina" (GDD-WLD-17) in the real game, opened by its address (GDD-UI-02). Where things are is read from
// `src/levels/level3-2.ts` (L-062); enemies are picked by their kind and starting column (L-015). Every test drives the game from its start
// (or from a respawn the game made), paused and stepped in the page by a bot that reads the game's state each step (L-042, L-073): the
// sweeps' bots of `src/levels/level3-2.drive.ts` read the simulation's `RunState`, which the page does not have, so their steps are
// re-derived here from the debug hooks, with their take-off numbers (each commented where it is hard-coded).
const api = <T>(page: Page, fn: () => T) => page.evaluate(fn);
const Y = (row: number) => row * TILE;
const mid = (col: number) => col * TILE + TILE / 2;
const L = LEVEL_3_2;
const SAVE_KEY = 'poncho-siete-vidas';

/** The place in the level's list of the enemy of `kind` that starts in column `col` (GDD-WLD-17's enemies). */
const enemyAt = (kind: 'alacran' | 'armadillo', col: number): number => L.enemies.findIndex((e) => kindOf(e) === kind && Math.floor(e.x / TILE) === col);
const PEN_BALL = enemyAt('armadillo', 126);
const GALLERY = [enemyAt('alacran', 149), enemyAt('armadillo', 153), enemyAt('alacran', 157)];

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'K1', 'K2', 'K3'] as const;
type Letter = (typeof LETTERS)[number];
const cartOf = (letter: Letter) => LETTERS.indexOf(letter);
/** A rail's end, in px across. */
const endOf = (letter: Letter) => LEVEL_3_2_RAIL[letter].x + railLength(LEVEL_3_2_RAIL[letter]);

/** What the bots read: the level's places, from its module. */
const K = {
  tile: TILE,
  /** Half his body box's width: his box overlaps a floor while his middle is within this of its ends. */
  body: HITBOX.width / 2,
  letters: LETTERS,
  ends: LETTERS.map(endOf),
  half: CART.width / 2,
  ofrendas: L.ofrendas.map((o) => o.x),
  penBall: PEN_BALL,
  tuckSteps: ARMADILLO.tuckSteps,
  careful: { heading: CAREFUL_READ.heading, px: CAREFUL_READ.tiles * TILE },
  seatFace: LEVEL_3_2_SEAT.col0 * TILE,
  seatEdge: (LEVEL_3_2_SEAT.col1 + 1) * TILE,
  pen: LEVEL_3_2_PEN,
  farWall: LEVEL_3_2_FAR_WALL,
  pillar: LEVEL_3_2_PILLAR,
  beamE: LEVEL_3_2_BEAMS.E.col * TILE,
  beamK2: LEVEL_3_2_BEAMS.K2.col * TILE,
};

type Seen = ReturnType<PonchoDebug['state']>;
/** One step's read of the game for a bot: Poncho, the carts, the enemies (with the steps each has been in its phase), lives and phase. */
interface View {
  p: Seen;
  carts: ReturnType<PonchoDebug['carts']>;
  enemies: ReturnType<PonchoDebug['enemies']>;
  ages: number[];
  phase: string;
  lives: number;
  checkpoint: { x: number; y: number };
  power: string;
}
/** A bot's step: the input for the step, or done (then the next task is asked on the same step), as `Ctl` in `level3-2.drive.ts`. */
type Ctl = (r: View) => { input: PlayerInput; done: boolean };
type Jump = 'tap' | 'top' | 'held' | 'again';
interface BotRun {
  steps: number;
  /** The tasks done (all of them, unless it stopped). */
  done: number;
  /** The steps on which a life was lost, and the step each task was done on. */
  lost: number[];
  marks: number[];
}
/** The bots, kept on `window` by `install` so a test's `page.evaluate` builds its route from them. */
interface Mina {
  K: typeof K;
  view(): View;
  middle(r: View, letter: Letter): number;
  end(letter: Letter): number;
  inCart(r: View, letter: Letter): boolean;
  passed(i: number): (r: View) => boolean;
  standsOn(s: { col0: number; col1: number; row: number }): (r: View) => boolean;
  carefulDrop: (r: View) => boolean;
  waitFor(until: (r: View) => boolean): Ctl;
  runUntil(dir: 1 | -1, until: (r: View) => boolean): Ctl;
  jumpAt(x: number, hold: 'top' | number, dir?: 1 | -1): Ctl;
  hopInto(letter: Letter): Ctl;
  jumpFromCart(when: (r: View) => boolean, kind: Jump, move?: 0 | 1): Ctl;
  penBot(): Ctl;
  /** The rider's route in pieces, each to the next ofrenda (Ketsu to the exit); Ten is the careful rider's (`CAREFUL_TEN`). */
  ki(): Ctl[];
  sho(): Ctl[];
  ontoSeat(): Ctl[];
  tenFromSeat(): Ctl[];
  ketsu(): Ctl[];
  /** The rider from the start to: standing in cart F, rolling (`F`); the third ofrenda (`third`); the exit (`exit`). */
  rider(to: 'F' | 'third' | 'exit'): Ctl[];
  /** Plays `tasks` in turn (at most `max` steps), holding nothing while he respawns, to the level's clear or, with `stopAtLoss`, a life lost. */
  bot(tasks: Ctl[], opts?: { max?: number; stopAtLoss?: boolean; each?: (r: View) => void }): BotRun;
}
declare global {
  interface Window {
    mina?: Mina;
  }
}

/** Puts the bots on `window` (the page's game must be paused). */
const install = (page: Page) =>
  page.evaluate((k) => {
    const d = window.__PONCHO__!;
    const idle = { move: 0, jumpHeld: false };
    let phases = d.enemies().map((e) => e.phase);
    let ages = phases.map(() => 0);
    const view = (): View => ({ p: d.state(), carts: d.carts(), enemies: d.enemies(), ages, phase: d.phase(), lives: d.lives(), checkpoint: d.checkpoint(), power: d.power() });
    /** One step, and each enemy's steps in its phase (an Armadillo's tuck age: 0 on its first step tucked). */
    const step = (input: PlayerInput) => {
      d.step(1, input);
      const now = d.enemies().map((e) => (e.alive ? e.phase : 'gone'));
      ages = now.map((ph, i) => (ph === phases[i] ? ages[i]! + 1 : 0));
      phases = now;
    };
    const at = (letter: Letter) => k.letters.indexOf(letter);
    const middle = (r: View, letter: Letter) => r.carts[at(letter)]!.x! + k.half;
    const end = (letter: Letter) => k.ends[at(letter)]!;
    /** Standing in the cart: on its rail, his feet on its floor and his box over it (`inCart`; the floor read under the cart's middle). */
    const inCart = (r: View, letter: Letter) => {
      const c = r.carts[at(letter)]!;
      if (c.phase === 'falling' || c.phase === 'gone') return false;
      return r.p.grounded && Math.abs(r.p.y - c.y!) < 1e-6 && Math.abs(r.p.x - middle(r, letter)) < k.half + k.body;
    };
    const passed = (i: number) => (r: View) => r.checkpoint.x >= k.ofrendas[i]!;
    const standsOn = (s: { col0: number; col1: number; row: number }) => (r: View) => r.p.grounded && r.p.y === s.row * k.tile && r.p.x + k.body > s.col0 * k.tile && r.p.x - k.body < (s.col1 + 1) * k.tile;
    const ball = (r: View) => r.enemies[k.penBall]!;
    const carefulDrop = (r: View) => ball(r).alive && ball(r).phase === 'walk' && ball(r).dir === k.careful.heading && ball(r).x - k.seatEdge >= k.careful.px;
    const waitFor = (until: (r: View) => boolean): Ctl => (r) => ({ input: idle, done: until(r) });
    const runUntil = (dir: 1 | -1, until: (r: View) => boolean): Ctl => (r) => ({ input: { ...idle, move: dir }, done: until(r) });
    const jumpAt = (x: number, hold: 'top' | number, dir: 1 | -1 = 1): Ctl => {
      let pressed = false;
      let air = false;
      return (r) => {
        const p = r.p;
        if (!pressed) {
          pressed = p.grounded && dir * (p.x - x) >= 0 && !p.jumpWasHeld;
          return { input: { move: dir, jumpHeld: pressed }, done: false };
        }
        if (!p.grounded) air = true;
        if (air && p.grounded) return { input: { ...idle, move: dir }, done: true };
        return { input: { move: dir, jumpHeld: hold === 'top' ? p.vy < 0 : dir * (p.x - hold) < 0 }, done: false };
      };
    };
    const hopInto = (letter: Letter): Ctl => {
      let jumpWas = false;
      return (r) => {
        if (r.carts[at(letter)]!.phase !== 'waiting' && inCart(r, letter)) return { input: idle, done: true };
        const gap = middle(r, letter) - r.p.x;
        const p = r.p;
        const jump = p.grounded ? !jumpWas && !p.jumpWasHeld && Math.abs(gap) >= 20 && Math.abs(gap) <= 60 : jumpWas && p.vy < 0;
        jumpWas = jump;
        const out = p.grounded && Math.abs(gap) < 20;
        return { input: { move: out ? (gap >= 0 ? -1 : 1) : Math.abs(gap) > 4 ? Math.sign(gap) : 0, jumpHeld: jump }, done: false };
      };
    };
    const jumper = (kind: Jump, move: 0 | 1) => {
      let top = -1;
      return (r: View, i: number) => {
        if (i === 0) return { move, jumpHeld: true };
        if (kind === 'tap') return { ...idle, move };
        if (kind === 'held') return { move, jumpHeld: true };
        if (top < 0 && r.p.vy >= 0) top = i;
        if (top < 0) return { move, jumpHeld: true };
        return { move, jumpHeld: kind === 'again' && i >= top + 10 };
      };
    };
    const jumpFromCart = (when: (r: View) => boolean, kind: Jump, move: 0 | 1 = 0): Ctl => {
      let i = -1;
      let input: ((r: View, i: number) => PlayerInput) | undefined;
      let air = false;
      return (r) => {
        if (input === undefined) {
          if (!when(r)) return { input: idle, done: false };
          input = jumper(kind, move);
        }
        i++;
        if (!r.p.grounded) air = true;
        if (air && r.p.grounded) return { input: idle, done: true };
        return { input: input(r, i), done: false };
      };
    };
    // `penBot`: stands; when the ball's flash ends, a jump held to the landing (the glide); once it lies dazed, runs to it and claws it.
    const penBot = (): Ctl => {
      let holding = false;
      let air = false;
      let n = 0;
      return (r) => {
        const b = ball(r);
        const p = r.p;
        n++;
        if (!b.alive || n > 300) return { input: idle, done: true };
        if (holding) {
          if (!p.grounded) air = true;
          if (air && p.grounded) holding = false;
          return { input: { move: 0, jumpHeld: holding }, done: false };
        }
        if (b.phase === 'tuck' && r.ages[k.penBall] === k.tuckSteps - 1 && p.grounded && !p.jumpWasHeld) {
          holding = true;
          air = false;
          return { input: { move: 0, jumpHeld: true }, done: false };
        }
        if (b.phase === 'dazed' && p.grounded) {
          const dx = b.x - p.x;
          return { input: { move: Math.abs(dx) > 18 ? Math.sign(dx) : 0, jumpHeld: false, claw: Math.abs(dx) <= 22 && n % 2 === 0 }, done: false };
        }
        return { input: idle, done: false };
      };
    };
    const mina: Mina = {
      K: k,
      view,
      middle,
      end,
      inCart,
      passed,
      standsOn,
      carefulDrop,
      waitFor,
      runUntil,
      jumpAt,
      hopInto,
      jumpFromCart,
      penBot,
      // RIDE_KI: the step into A; from A at x 320 into B; 30 px before B's and C's ends; on to the first ofrenda.
      ki: () => [
        runUntil(1, (r) => r.carts[at('A')]!.phase !== 'waiting'),
        jumpFromCart((r) => r.p.x >= 320, 'top'),
        jumpFromCart((r) => end('B') - r.p.x <= 30, 'top'),
        jumpFromCart((r) => end('C') - r.p.x <= 30, 'top'),
        runUntil(1, passed(0)),
      ],
      // RIDE_SHO: into D and out 30 px before its end; into E, over the beam 40 px before its face; off at the rib, on to the second ofrenda.
      sho: () => [
        hopInto('D'),
        jumpFromCart((r) => end('D') - r.p.x <= 30, 'top'),
        hopInto('E'),
        jumpFromCart((r) => k.beamE - r.p.x <= 40, 'top'),
        waitFor((r) => !inCart(r, 'E')),
        runUntil(1, passed(1)),
      ],
      // ONTO_SEAT: to the seat's wall, a full jump onto it, standing still there.
      ontoSeat: () => [runUntil(1, (r) => r.p.x >= k.seatFace - 6 - 1e-6), jumpAt(k.seatFace - 7, 'top'), waitFor((r) => r.p.grounded && r.p.vx === 0)],
      // CAREFUL_TEN from the seat: the careful read, off the seat, the pen (`penBot`), the far wall and the two hops (TEN_TO_ISLAND's take-offs
      // at x 2030, 2080 held to 2140, and 2184), into F, out at x 2625 onto the ledge (RIDE_TEN), on to the third ofrenda.
      tenFromSeat: () => [
        waitFor(carefulDrop),
        runUntil(1, standsOn(k.pen)),
        penBot(),
        jumpAt(2030, 'top'),
        waitFor(standsOn(k.farWall)),
        jumpAt(2080, 2140),
        waitFor(standsOn(k.pillar)),
        jumpAt(2184, 'top'),
        hopInto('F'),
        jumpFromCart((r) => r.p.x >= 2625, 'top'),
        runUntil(1, passed(2)),
      ],
      // RIDE_KETSU: into K1, out 30 px before its end into K2, over its beam 40 px before its face, out 20 px before its end into K3, out at
      // x 3625 onto the ledge, and right to the exit.
      ketsu: () => [
        hopInto('K1'),
        jumpFromCart((r) => end('K1') - r.p.x <= 30, 'top'),
        jumpFromCart((r) => k.beamK2 - r.p.x <= 40, 'top'),
        jumpFromCart((r) => end('K2') - r.p.x <= 20, 'top'),
        jumpFromCart((r) => r.p.x >= 3625, 'top'),
        runUntil(1, (r) => r.phase === 'clear'),
      ],
      rider(to) {
        const third = [...mina.ki(), ...mina.sho(), ...mina.ontoSeat(), ...mina.tenFromSeat()];
        return to === 'F' ? third.slice(0, -2) : to === 'third' ? third : [...third, ...mina.ketsu()];
      },
      bot(tasks, { max = 4000, stopAtLoss = false, each } = {}) {
        const out: BotRun = { steps: 0, done: 0, lost: [], marks: [] };
        let r = view();
        while (out.done < tasks.length && out.steps < max && r.phase !== 'clear' && r.phase !== 'gameover') {
          if (r.phase !== 'playing') {
            step(idle);
          } else {
            const { input, done } = tasks[out.done]!(r);
            if (done) {
              out.marks.push(out.steps);
              out.done++;
              continue;
            }
            step(input);
          }
          out.steps++;
          const before = r.lives;
          r = view();
          each?.(r);
          if (r.lives < before) {
            out.lost.push(out.steps);
            if (stopAtLoss) break;
          }
        }
        return out;
      },
    };
    window.mina = mina;
  }, K);

/** Opens 3-2 by its address, starts it the device's way, pauses it with Poncho standing at the spawn and puts the bots on; the errors seen. */
async function play(page: Page, isMobile: boolean): Promise<string[]> {
  const errors = await openGame(page, '/?level=3-2');
  if (isMobile) await tapAt(page, 240, 60, true);
  else await page.keyboard.press('Enter');
  await page.waitForFunction(() => !window.__PONCHO__!.titleDrawn().shown && window.__PONCHO__!.ticks() > 2);
  await page.evaluate(() => {
    const d = window.__PONCHO__!;
    d.pause(true);
    for (let i = 0; i < 30 && !d.state().grounded; i++) d.step(1);
  });
  await install(page);
  return errors;
}

test('GDD-WLD-17 3-2 opens in the mine: the spawn on its step, the mine\'s backdrop and ground', async ({ page, isMobile }) => {
  const errors = await play(page, isMobile);
  expect(await api(page, () => window.__PONCHO__!.level())).toBe('3-2');
  expect(await api(page, () => window.__PONCHO__!.lives())).toBe(7);
  // On the step at column 3, its top row 8 (GDD-WLD-17).
  expect(await api(page, () => window.__PONCHO__!.state())).toMatchObject({ x: L.spawn.x, y: Y(8), grounded: true });
  const seen = await page.evaluate(() => {
    const d = window.__PONCHO__!;
    // The step's top under him (column 3, row 8), the upper gallery's roof over cart A (column 10: its last row 1, the rock in row 0).
    return { scenery: d.scenery(), layout: d.backdropLayout(), top: d.groundFrame(3, 8), underside: d.groundFrame(10, 1), deep: d.groundFrame(10, 0), shown: d.groundShown().shown };
  });
  expect(seen.scenery).toEqual({ set: 'sierra', midKey: 'sierra:mid-mina', place: 'mina' });
  // The mine's bands, as in lab-3m (GDD-ART-06): the old workings from y 40, the timbering from 100, its foot from 200.
  expect([seen.layout.mountainsY, seen.layout.desertY, seen.layout.footY]).toEqual([40, 100, 200]);
  expect([TOP_FRAME, TOP_FRAME + 1]).toContain(seen.top);
  expect([MINE_UNDERSIDE_FRAME, MINE_UNDERSIDE_FRAME + 1]).toContain(seen.underside);
  expect([MINE_DEEP_FRAME, MINE_DEEP_FRAME + 1]).toContain(seen.deep);
  expect(seen.shown).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test('GDD-WLD-17 3-2 walking off the start\'s step drops him into cart A, which rides him to its buffer with its five hilos', async ({ page, isMobile }) => {
  await play(page, isMobile);
  // Right held and nothing else, every step, until cart A has stood at its buffer 10 steps.
  const run = await page.evaluate(() => {
    const m = window.mina!;
    const seen: { phase: string; inA: boolean; jump: boolean }[] = [];
    const r = m.bot([m.runUntil(1, (v) => v.carts[0]!.phase === 'stopped'), m.runUntil(1, () => seen.filter((s) => s.phase === 'stopped').length >= 10)], {
      max: 400,
      each: (v) => seen.push({ phase: v.carts[0]!.phase, inA: m.inCart(v, 'A'), jump: v.p.jumpWasHeld }),
    });
    return { r, seen, end: m.view(), hilos: window.__PONCHO__!.hilos() };
  });
  const board = run.seen.findIndex((s) => s.phase === 'rolling');
  const stop = run.seen.findIndex((s) => s.phase === 'stopped');
  expect(board).toBeGreaterThan(0);
  // He never pressed jump; in the cart from the landing to its stop and on at its buffer, right held: A's ride is 77 steps (1.28 s, GDD-WLD-17).
  expect(run.seen.every((s) => !s.jump)).toBe(true);
  expect(run.seen.slice(board).every((s) => s.inA)).toBe(true);
  expect(stop - board).toBe(77);
  expect(run.end.carts[0]).toMatchObject({ phase: 'stopped', x: endOf('A') - CART.width });
  // The two hilos leading off the step and A's three: five of the level's 50; no life lost.
  expect(run.hilos).toMatchObject({ taken: 5, total: 50 });
  expect(run.end.lives).toBe(7);
  expect(run.r.lost).toEqual([]);
});

test('GDD-WLD-15 3-2 a jump from cart C\'s last tiles lands on its far bank; staying in falls onto the sunken floor with no life lost', async ({ page, isMobile }) => {
  await play(page, isMobile);
  // The rider's Ki: A, B and C, the jump 30 px before C's end, and on to the first ofrenda on the bank.
  const jumped = await page.evaluate(() => {
    const m = window.mina!;
    const tasks = m.ki();
    let landed: View | undefined;
    const r = m.bot(tasks, { max: 1000, each: (v) => (landed ??= ['falling', 'gone'].includes(v.carts[2]!.phase) && v.p.grounded ? v : undefined) });
    return { r, landed, end: m.view() };
  });
  expect(jumped.r.done).toBe(5);
  expect(jumped.r.lost).toEqual([]);
  // The first step he stands once cart C has left its torn end: on the far bank (row 13), past the rail's end.
  expect(jumped.landed!.p).toMatchObject({ grounded: true, y: Y(13) });
  expect(jumped.landed!.p.x).toBeGreaterThan(endOf('C'));
  expect(jumped.end.checkpoint).toEqual({ x: L.ofrendas[0]!.x, y: L.ofrendas[0]!.y });
  expect(jumped.end.lives).toBe(7);
  // Again from the start, staying in C: he falls on his own onto the sunken floor (row 15) beside the broken cart, with every life. The
  // run saved at the ofrenda is cleared first, so the title's Enter starts the level rather than continuing it (GDD-PRG-02).
  await page.evaluate((key) => localStorage.removeItem(key), SAVE_KEY);
  await play(page, isMobile);
  const stayed = await page.evaluate(() => {
    const m = window.mina!;
    const phases: string[] = [];
    const r = m.bot([...m.ki().slice(0, 3), m.waitFor((v) => v.p.grounded && v.p.y === 15 * 16 && v.carts[2]!.phase !== 'rolling'), m.waitFor((v) => v.carts[2]!.phase === 'gone')], {
      max: 1000,
      each: (v) => phases.push(v.carts[2]!.phase),
    });
    return { r, phases, end: m.view() };
  });
  expect(stayed.r.done).toBe(5);
  expect(stayed.r.lost).toEqual([]);
  expect(stayed.phases).toContain('falling');
  expect(stayed.end.p).toMatchObject({ grounded: true, y: Y(LEVEL_3_2_SUNKEN.row) });
  expect(stayed.end.p.x).toBeGreaterThan(endOf('C'));
  expect(stayed.end.lives).toBe(7);
  expect(stayed.end.phase).toBe('playing');
});

test('GDD-WLD-17 3-2 staying in cart D costs a life at its broken end, and he respawns at the first ofrenda with D back at its start', async ({ page, isMobile }) => {
  await play(page, isMobile);
  const run = await page.evaluate(() => {
    const m = window.mina!;
    const r = m.bot([...m.ki(), m.hopInto('D'), m.waitFor(() => false)], { max: 1500, stopAtLoss: true });
    return { r, at: m.view() };
  });
  // Ki and the hop in done, then the life lost at D's end, over pit D.
  expect(run.r.done).toBe(6);
  expect(run.r.lost).toHaveLength(1);
  expect(run.at).toMatchObject({ lives: 6, phase: 'respawning' });
  expect(run.at.p.x).toBeGreaterThan(endOf('D'));
  expect(await stepUntil(page, { phase: 'playing' }, 300)).toBeLessThan(300);
  const back = await page.evaluate(() => window.mina!.view());
  expect(back.p).toMatchObject({ x: L.ofrendas[0]!.x, y: L.ofrendas[0]!.y });
  expect(back.lives).toBe(6);
  expect(back.carts[cartOf('D')]).toMatchObject({ phase: 'waiting', x: LEVEL_3_2_RAIL.D.x });
});

test('GDD-WLD-15 3-2 rail E\'s hanging beam stops a rider who does nothing, with no life lost, and a hop over it lands back in the cart', async ({ page, isMobile }) => {
  await play(page, isMobile);
  // The rider's Ki and rail D, then into E holding nothing, until E stands at its buffer.
  const still = await page.evaluate(() => {
    const m = window.mina!;
    const xs: number[] = [];
    const r = m.bot([...m.ki(), ...m.sho().slice(0, 3), m.waitFor((v) => v.carts[4]!.phase === 'stopped')], { max: 2000, each: (v) => xs.push(v.p.x) });
    return { r, xs, at: m.view() };
  });
  expect(still.r.done).toBe(9);
  expect(still.r.lost).toEqual([]);
  // Stopped at the beam's near face, his box against it (6 px), standing on the floor (row 13); the cart rolled on to its buffer.
  expect(still.at.p).toMatchObject({ grounded: true, y: Y(13), x: K.beamE - 6 });
  expect(Math.max(...still.xs)).toBeLessThanOrEqual(K.beamE - 6 + 1e-6);
  expect(still.at.carts[cartOf('E')]).toMatchObject({ phase: 'stopped', x: endOf('E') - CART.width });
  expect(still.at.lives).toBe(7);
  // Once E is back at its start (2.0 s), the hop back into it, and the plain jump 40 px before the beam's face: back in the cart past it.
  const hop = await page.evaluate(() => {
    const m = window.mina!;
    let landed: View | undefined;
    const r = m.bot([m.waitFor((v) => v.carts[4]!.phase === 'waiting'), m.hopInto('E'), m.jumpFromCart((v) => m.K.beamE - v.p.x <= 40, 'top')], {
      max: 600,
      each: (v) => (landed = v),
    });
    return { r, landed: landed!, inE: m.inCart(landed!, 'E') };
  });
  expect(hop.r.done).toBe(3);
  expect(hop.r.lost).toEqual([]);
  expect(hop.inE).toBe(true);
  expect(hop.landed.carts[cartOf('E')]!.phase).toBe('rolling');
  expect(hop.landed.p.x - 6).toBeGreaterThan(K.beamE + TILE);
});

test('GDD-ENM-04 3-2 the pen: from the seat the Armadillo is not startled; dropped in, a jump at its flash\'s end clears its roll and it lies dazed at the wall', async ({ page, isMobile }) => {
  test.setTimeout(60_000);
  await play(page, isMobile);
  // The rider's Ki and Shō to the second ofrenda, onto the seat; there he waits until the pen's Armadillo has walked up under him (its
  // middle within its 80 px of sight across) and back to the careful read (`CAREFUL_READ`), every step walking.
  const seat = await page.evaluate((sight) => {
    const m = window.mina!;
    const r = m.bot([...m.ki(), ...m.sho(), ...m.ontoSeat()], { max: 2500 });
    const walks: string[] = [];
    let near = Infinity;
    const wait = m.bot([m.waitFor((v) => Math.abs(v.enemies[m.K.penBall]!.x - v.p.x) < sight), m.waitFor(m.carefulDrop)], {
      max: 1200,
      each: (v) => {
        walks.push(v.enemies[m.K.penBall]!.phase);
        near = Math.min(near, Math.abs(v.enemies[m.K.penBall]!.x - v.p.x));
      },
    });
    return { r, wait, walks, near, at: m.view() };
  }, ARMADILLO.sightX);
  expect(seat.r.done).toBe(14);
  expect(seat.wait.done).toBe(2);
  expect(seat.at.p).toMatchObject({ grounded: true, y: Y(LEVEL_3_2_SEAT.row) });
  expect(seat.near).toBeLessThan(ARMADILLO.sightX);
  expect(new Set(seat.walks)).toEqual(new Set(['walk']));
  // Off the seat into the pen, and `penBot`: he stands; on the step its flash ends he jumps, held to the landing (the careful read was
  // measured with the jump held into the glide); once it lies dazed he claws it. It rolls at him, misses, and lies dazed against the
  // seat's wall behind him.
  const pen = await page.evaluate(() => {
    const m = window.mina!;
    const seen: { phase: string; x: number; dir: number; lives: number; px: number }[] = [];
    const r = m.bot([m.runUntil(1, m.standsOn(m.K.pen)), m.penBot()], {
      max: 400,
      each: (v) => seen.push({ phase: v.enemies[m.K.penBall]!.alive ? v.enemies[m.K.penBall]!.phase : 'gone', x: v.enemies[m.K.penBall]!.x, dir: v.enemies[m.K.penBall]!.dir, lives: v.lives, px: v.p.x }),
    });
    return { r, seen };
  });
  expect(pen.r.done).toBe(2);
  expect(pen.r.lost).toEqual([]);
  const order = pen.seen.map((s) => s.phase).filter((ph, i, all) => i === 0 || ph !== all[i - 1]);
  expect(order).toEqual(['walk', 'tuck', 'roll', 'dazed', 'gone']);
  // Its tuck is the 0.5 s telegraph (30 steps); it rolled left, at him, and lies with its box against the seat's face.
  expect(pen.seen.filter((s) => s.phase === 'tuck')).toHaveLength(ARMADILLO.tuckSteps);
  const dazed = pen.seen.find((s) => s.phase === 'dazed')!;
  expect(dazed).toMatchObject({ x: K.seatEdge + ARMADILLO.width / 2, dir: -1, lives: 7 });
  expect(dazed.px).toBeGreaterThan(dazed.x);
});


test('GDD-WLD-15 3-2 riding cart F runs down the gallery\'s walkers', async ({ page, isMobile }) => {
  await play(page, isMobile);
  const run = await page.evaluate((gallery) => {
    const m = window.mina!;
    const alive = (v: View) => gallery.filter((k) => v.enemies[k]!.alive).length;
    const r = m.bot(m.rider('F'), { max: 3500 });
    const boarded = m.view();
    // Riding F, nothing held, from the landing until it leaves the rail over the spike hollow: each walker's defeat, where it was, the
    // cart's phase and whether he stood in it then.
    const downs: { k: number; x: number; y: number; cart: string; riding: boolean }[] = [];
    let was = boarded;
    const ride = m.bot([m.waitFor((v) => v.carts[5]!.phase !== 'rolling')], {
      max: 400,
      stopAtLoss: true,
      each: (v) => {
        for (const k of gallery) if (was.enemies[k]!.alive && !v.enemies[k]!.alive) downs.push({ k, x: was.enemies[k]!.x, y: was.enemies[k]!.y, cart: v.carts[5]!.phase, riding: m.inCart(v, 'F') });
        was = v;
      },
    });
    return { r, before: alive(boarded), after: alive(m.view()), downs, lives: [boarded.lives, m.view().lives], ride, at: boarded.enemies.filter((_, k) => gallery.includes(k)) };
  }, GALLERY);
  expect(run.r.done).toBe(23);
  expect(run.before).toBe(3);
  expect(run.after).toBe(0);
  expect(run.downs).toHaveLength(3);
  expect(new Set(run.downs.map((d) => d.k))).toEqual(new Set(GALLERY));
  for (const d of run.downs) expect(d).toMatchObject({ cart: 'rolling', riding: true });
  expect(run.ride.lost).toEqual([]);
});

test('GDD-WLD-17 3-2 staying in cart F falls onto the spikes: one life; with a taco, the taco and no life', async ({ page, isMobile }) => {
  test.setTimeout(60_000);
  await play(page, isMobile);
  // The rider into F, then nothing held: he falls from its torn end into the spike hollow.
  const stayed = await page.evaluate(() => {
    const m = window.mina!;
    const r = m.bot([...m.rider('F'), m.waitFor(() => false)], { max: 4000, stopAtLoss: true });
    return { r, at: m.view() };
  });
  expect(stayed.r.done).toBe(23);
  expect(stayed.r.lost).toHaveLength(1);
  expect(stayed.at).toMatchObject({ lives: 6, phase: 'respawning', power: 'base' });
  // In the hollow, past the cutting's last tile (column 175).
  expect(stayed.at.p.x).toBeGreaterThan(176 * TILE);
  expect(await stepUntil(page, { phase: 'playing' }, 300)).toBeLessThan(300);
  // He respawns at the second ofrenda (column 110), every cart at its start.
  const back = await page.evaluate(() => window.mina!.view());
  expect(back.p).toMatchObject({ x: L.ofrendas[1]!.x, y: L.ofrendas[1]!.y });
  expect(back.carts.every((c) => c.phase === 'waiting')).toBe(true);
  // From there in Base: under the piñata (column 113), a jump into it held 12 steps, and he waits there until its taco has walked back to
  // him (GDD-PWR-05); then Ten again to F, and nothing held: the spikes take the taco and no life (GDD-WLD-15, GDD-CMB-03).
  const taco = await page.evaluate((x) => {
    const m = window.mina!;
    let held = 0;
    const bump: Ctl = (v) => ({ input: { move: 0, jumpHeld: held < 12 }, done: held++ >= 12 && v.p.grounded });
    const r = m.bot([m.runUntil(1, (v) => v.p.x >= x), m.waitFor((v) => v.p.vx === 0), bump, m.waitFor((v) => v.power === 'taco')], { max: 900 });
    const got = m.view();
    const on = m.bot([...m.ontoSeat(), ...m.tenFromSeat().slice(0, 9), m.waitFor((v) => v.power === 'base'), m.waitFor((v) => v.p.grounded)], { max: 3000 });
    return { r, got, on, at: m.view() };
  }, mid(L.pinatas[0]!.col) - 4);
  expect(taco.r.done).toBe(4);
  expect(taco.got).toMatchObject({ power: 'taco', lives: 6 });
  expect(taco.on.done).toBe(14);
  expect(taco.on.lost).toEqual([]);
  expect(taco.at).toMatchObject({ power: 'base', lives: 6, phase: 'playing' });
  // Down in the hollow on its floor (row 16), past the cutting.
  expect(taco.at.p).toMatchObject({ grounded: true, y: Y(16) });
  expect(taco.at.p.x).toBeGreaterThan(176 * TILE);
});

test('GDD-WLD-17 3-2 the chain: from K1 into K2, over its beam, into K3, and staying in K3 takes the veladora; then the exit', async ({ page, isMobile }) => {
  test.setTimeout(60_000);
  await play(page, isMobile);
  // The rider to the third ofrenda, and there a life taken by the debug hook (the count only: he stays where he is), so the veladora has a
  // life to give.
  const third = await page.evaluate(() => {
    const m = window.mina!;
    const r = m.bot(m.rider('third'), { max: 4000 });
    window.__PONCHO__!.loseLife();
    return { r, at: m.view() };
  });
  expect(third.r.done).toBe(25);
  expect(third.r.lost).toEqual([]);
  expect(third.at).toMatchObject({ lives: 6, phase: 'playing', checkpoint: { x: L.ofrendas[2]!.x, y: L.ofrendas[2]!.y } });
  // Into K1; out 30 px before its end, into K2; over its beam 40 px before its face, back into K2; out 20 px before its end, into K3; then
  // nothing held while K3 rides down its ramp into the cutting to its buffer, and a walk on, off the cart's front onto the cutting's floor in
  // the veladora's column (238), as the secret's unit test walks. Where he stands after each jump.
  const chain = await page.evaluate((vel) => {
    const m = window.mina!;
    const ketsu = m.ketsu();
    const landings: { cart: string | null; x: number }[] = [];
    const cartIn = (v: View) => m.K.letters.find((l) => m.inCart(v, l)) ?? null;
    const r = m.bot([ketsu[0]!, ketsu[1]!, m.waitFor((v) => (landings.push({ cart: cartIn(v), x: v.p.x }), true)), ketsu[2]!, m.waitFor((v) => (landings.push({ cart: cartIn(v), x: v.p.x }), true)), ketsu[3]!, m.waitFor((v) => (landings.push({ cart: cartIn(v), x: v.p.x }), true)), m.waitFor((v) => v.carts[8]!.phase === 'stopped'), m.runUntil(1, (v) => v.p.grounded && v.p.x >= vel && v.p.y === 15 * 16)], { max: 800 });
    return { r, landings, at: m.view(), veladora: window.__PONCHO__!.veladoraDrawn() };
  }, L.veladora!.col * TILE + 2);
  expect(chain.r.done).toBe(9);
  expect(chain.r.lost).toEqual([]);
  expect(chain.landings.map((l) => l.cart)).toEqual(['K2', 'K2', 'K3']);
  expect(chain.landings[1]!.x - 6).toBeGreaterThan(K.beamK2 + TILE);
  // In the cutting at K3's buffer, on its floor (row 15): the veladora gives the life back and is no longer drawn.
  expect(chain.at.p).toMatchObject({ grounded: true, y: Y(LEVEL_3_2_CUTTING_K3.row) });
  expect(chain.at.lives).toBe(7);
  expect(chain.veladora).toBe(false);
  // Out of the cutting: back up the ramp on foot to its top (column 227), and the 4-tile jump from there over it to the ledge, held while he
  // glides (as the secret's test: from x = 3640 held to past the lip's first tile), and right to the exit.
  const out = await page.evaluate(
    ([top, lip]) => {
      const m = window.mina!;
      const r = m.bot([m.runUntil(-1, (v) => v.p.x <= top!), m.jumpAt(top!, lip!), m.runUntil(1, (v) => v.phase === 'clear')], { max: 600 });
      return { r, at: m.view() };
    },
    [LEVEL_3_2_RAMPS.K3.col0 * TILE - 8, (LEVEL_3_2_LEDGES.K3.col0 + 1) * TILE],
  );
  expect(out.r.lost).toEqual([]);
  expect(out.at).toMatchObject({ phase: 'clear', lives: 7 });
});

test('GDD-WLD-17 3-2 the exit clears the level; its results menu greys Next level, as the last level built', async ({ page, isMobile }) => {
  test.setTimeout(60_000);
  await play(page, isMobile);
  // The rider's whole route, from the start to the exit.
  const run = await page.evaluate(() => {
    const m = window.mina!;
    const r = m.bot(m.rider('exit'), { max: 5000 });
    return { r, at: m.view() };
  });
  expect(run.r.lost).toEqual([]);
  expect(run.at).toMatchObject({ phase: 'clear', lives: 7 });
  await api(page, () => window.__PONCHO__!.step(61));
  await waitForResults(page);
  expect((await api(page, () => window.__PONCHO__!.clearDrawn())).menu).toMatchObject({ chosen: 'retry', colors: ['#5c6178', '#fff3dc', '#9ba3c4'] });
  // World 3's run ends there: a new one at 3-1.
  const progress: { worldAt: Record<string, string> } = JSON.parse((await page.evaluate((key) => localStorage.getItem(key), SAVE_KEY))!).progress;
  expect(progress).toMatchObject({ worldAt: { '3': '3-1' } });
  await api(page, () => window.__PONCHO__!.pause(false));
  // Up from Retry stays there, and a tap or click on the greyed row does nothing.
  await page.keyboard.press('ArrowUp');
  const t0 = await api(page, () => window.__PONCHO__!.ticks());
  await page.waitForFunction((t) => window.__PONCHO__!.ticks() >= t + 10, t0);
  expect((await api(page, () => window.__PONCHO__!.clearDrawn())).menu.chosen).toBe('retry');
  const row = await resultsRowCentre(page, 'next');
  if (isMobile) await page.touchscreen.tap(row.x, row.y);
  else await page.mouse.click(row.x, row.y);
  const t1 = await api(page, () => window.__PONCHO__!.ticks());
  await page.waitForFunction((t) => window.__PONCHO__!.ticks() >= t + 20, t1);
  expect(await api(page, () => window.__PONCHO__!.phase())).toBe('clear');
  expect(await api(page, () => window.__PONCHO__!.level())).toBe('3-2');
  expect((await api(page, () => window.__PONCHO__!.clearDrawn())).menu.chosen).toBe('retry');
});
