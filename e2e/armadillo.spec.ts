import { expect, test, type Page } from '@playwright/test';
import { ARMADILLO, ENEMY_ART, STEP, TILE } from '../src/config/tuning';
import { LAB_3A_ENEMIES, LAB_3A_FLOOR_ROW, LAB_3A_LEDGE, LAB_3A_PEN, LAB_3A_RAILS, LAB_3A_SLOPE } from '../src/levels/lab3a';
import { kindOf } from '../src/sim/enemy';
import { boot, clearOfButtons, nearHex, pixelsAt } from './helpers';

// GDD-ENM-04: the Armadillo in play, in lab-3a (`?level=lab-3a`, `src/levels/lab3a.ts`; L-062: where things are is read from it). Each
// Armadillo is picked by its kind and its starting column (L-015). The game is paused and stepped in the page, with a frame drawn before
// each read of what was drawn, so every count is in steps (L-042); one test runs the tuck through the game's own frames (L-021). The claims
// these replay are pinned in the simulation by `src/levels/lab3a.test.ts`.
const api = <T>(page: Page, fn: () => T) => page.evaluate(fn);
/** The place in the level's list of the Armadillo that starts in column `col`. */
const armadilloAt = (col: number): number => LAB_3A_ENEMIES.findIndex((e) => kindOf(e) === 'armadillo' && Math.floor(e.x / TILE) === col);
const SLOPE = armadilloAt(30);
const LEDGE = armadilloAt(36);
const RAILED = armadilloAt(Math.floor(LAB_3A_ENEMIES[3]!.x / TILE));
const FLOOR_Y = LAB_3A_FLOOR_ROW * TILE;
/** On the slope's ramp, 4 px into its third tile (an 'r' rising 8 px over 16 from y = 192): its surface there, 14 px under the upper floor. */
const RAMP_SPOT = { x: 420, y: 190 };
/** At the ledge's right end, on its top. */
const LEDGE_SPOT = { x: (LAB_3A_LEDGE.col1 + 1) * TILE - 12, y: LAB_3A_LEDGE.row * TILE };
/** The wall the slope's Armadillo is dazed against rolling down: the pen's far wall, its face at x = 288. */
const SLOPE_LOW_WALL = (LAB_3A_PEN.wall1 + 1) * TILE;

/** Starts lab-3a, waits a few steps and pauses it. */
async function open(page: Page): Promise<string[]> {
  const errors = await boot(page, '/?level=lab-3a');
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 2);
  await api(page, () => window.__PONCHO__!.pause(true));
  return errors;
}

/** Waits for two frames, so what a step changed is drawn (L-033). */
const frames = (page: Page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

type Seen = { tick: number; x: number; y: number; dir: number; phase: string; alive: boolean; px: number; py: number; vy: number; lives: number };
type Bot = { jumpAt?: number; clawAt?: number; until: string; max: number; teleport?: { x: number; y: number } };

/**
 * In the page: puts Poncho at `teleport` if given, then steps the paused game, Armadillo `i` read each step. While it rolls at him, he
 * swings the claw once when its box is `clawAt` px or less from his hurtbox and takes a full jump (held while rising) at `jumpAt` px or less;
 * otherwise he holds nothing. It stops once the Armadillo's phase is `until` ('gone' once it is defeated) or after `max` steps. What it saw
 * after each step.
 */
const dodge = (page: Page, i: number, bot: Bot): Promise<Seen[]> =>
  page.evaluate(
    ({ index, b, half, hurt }) => {
      const d = window.__PONCHO__!;
      if (b.teleport) d.teleport(b.teleport.x, b.teleport.y - 1);
      const out: Seen[] = [];
      let jumpWas = false;
      let clawed = false;
      for (let k = 0; k < b.max; k++) {
        const p = d.state();
        const e = d.enemies()[index]!;
        const input = { move: 0, jumpHeld: false, claw: false };
        if (e.alive && e.phase === 'roll' && (e.dir > 0) === (e.x < p.x)) {
          const gap = e.dir > 0 ? p.x - hurt - (e.x + half) : e.x - half - (p.x + hurt);
          if (b.clawAt !== undefined && !clawed && gap >= 0 && gap <= b.clawAt) input.claw = clawed = true;
          else if (b.jumpAt !== undefined && p.grounded && !jumpWas && gap >= 0 && gap <= b.jumpAt) input.jumpHeld = true;
        }
        if (!p.grounded && jumpWas && p.vy < 0) input.jumpHeld = true;
        jumpWas = input.jumpHeld;
        d.step(1, input);
        const now = d.enemies()[index]!;
        const s = d.state();
        out.push({ tick: d.ticks(), x: now.x, y: now.y, dir: now.dir, phase: now.alive ? now.phase : 'gone', alive: now.alive, px: s.x, py: s.y, vy: s.vy, lives: d.lives() });
        if (out[out.length - 1]!.phase === b.until) break;
      }
      return out;
    },
    { index: i, b: bot, half: ARMADILLO.width / 2, hurt: 5 },
  );

/** The phases in order over `seen`, each with how many steps it lasted. */
const runs = (seen: readonly Seen[]) => {
  const out: { phase: string; steps: number; from: number }[] = [];
  seen.forEach((s, k) => {
    const last = out[out.length - 1];
    if (last && last.phase === s.phase) last.steps++;
    else out.push({ phase: s.phase, steps: 1, from: k });
  });
  return out;
};

test('GDD-ENM-04 the Armadillo tucks for 0.5 s flashing red, rolls at him and lies dazed at the wall', async ({ page }) => {
  const errors = await open(page);
  // Put on the ramp 68 px left of the slope's Armadillo and 14 px under its feet: it is startled on the first step and tucks facing him.
  const first = await dodge(page, SLOPE, { teleport: RAMP_SPOT, until: 'tuck', max: 5 });
  expect(first.at(-1)!.phase).toBe('tuck');
  expect(first.at(-1)!.dir).toBe(-1);
  const t0 = first.at(-1)!.tick; // its tuck's first step (age 0)
  // Unpaused, through the game's own frames (L-021): on each frame the step count and what was drawn, until it rolls; then paused again.
  const tuck = await page.evaluate(
    (i) =>
      new Promise<{ tick: number; phase: string; look: string; red: boolean }[]>((resolve) => {
        const d = window.__PONCHO__!;
        const out: { tick: number; phase: string; look: string; red: boolean }[] = [];
        d.pause(false);
        const tick = () => {
          const drawn = d.enemiesDrawn()[i]!;
          out.push({ tick: d.ticks(), phase: d.enemies()[i]!.phase, look: drawn.look, red: drawn.red });
          if (d.enemies()[i]!.phase !== 'tuck' || out.length > 200) {
            d.pause(true);
            resolve(out);
          } else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
    SLOPE,
  );
  // Each frame drawn in the tuck shows the tuck, red on its steps 0 to 3, 8 to 11, ... and plain on 4 to 7, ... (4 on, 4 off, GDD-ENM-01).
  const tucked = tuck.filter((f) => f.phase === 'tuck' && f.look.startsWith('tuck'));
  expect(tucked.length).toBeGreaterThan(3);
  for (const f of tucked) expect(f.red, `age ${f.tick - t0}`).toBe(Math.floor((f.tick - t0) / ENEMY_ART.flashSteps) % 2 === 0);
  expect(new Set(tucked.map((f) => f.red))).toEqual(new Set([true, false]));
  expect(new Set(tuck.filter((f) => f.phase === 'tuck').map((f) => f.look))).toEqual(new Set(['tuck', 'tuckRed']));
  // It rolls on the step its 30 tuck steps end: the first frame past the tuck is at least 30 steps on.
  const rolled = tuck.find((f) => f.phase !== 'tuck')!;
  expect(rolled.phase).toBe('roll');
  expect(rolled.tick - t0).toBeGreaterThanOrEqual(ARMADILLO.tuckSteps);
  // Paused again: it rolls at him down the ramp; he jumps it; it lies dazed at the pen's far wall, drawn on its back.
  const rest = await dodge(page, SLOPE, { jumpAt: 12, until: 'dazed', max: 200 });
  expect(rest.at(-1)).toMatchObject({ phase: 'dazed', x: SLOPE_LOW_WALL + ARMADILLO.width / 2, y: FLOOR_Y, dir: -1, lives: 7 });
  expect(rest.every((s) => s.lives === 7)).toBe(true);
  await frames(page);
  const drawn = await page.evaluate((i) => window.__PONCHO__!.enemiesDrawn()[i]!, SLOPE);
  // On its back, facing the wall it rolled into, drawn ENEMY_ART.dazedBack px back from it.
  expect(drawn).toMatchObject({ kind: 'armadillo', look: 'dazed', flip: true, red: false, white: false, y: FLOOR_Y, x: SLOPE_LOW_WALL + ARMADILLO.width / 2 + ENEMY_ART.dazedBack });
  // Its last 30 dazed steps kick, every other 4 steps (from its age 32, GDD-ENM-04): plain at age 20, kicking at 32; then it walks away from
  // the wall.
  const looks = await page.evaluate(async (i) => {
    const d = window.__PONCHO__!;
    d.step(20);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const at20 = d.enemiesDrawn()[i]!.look;
    d.step(12);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const at32 = d.enemiesDrawn()[i]!.look;
    for (let k = 0; k < 40 && d.enemies()[i]!.phase === 'dazed'; k++) d.step(1);
    return { at20, at32, phase: d.enemies()[i]!.phase, dir: d.enemies()[i]!.dir };
  }, SLOPE);
  expect(looks).toEqual({ at20: 'dazed', at32: 'dazedKick', phase: 'walk', dir: 1 });
  expect(errors).toEqual([]);
});

test('GDD-ENM-04 a stomp on the rolling ball bounces him and it rolls on; a stomp on the dazed one defeats it', async ({ page }) => {
  await open(page);
  // The slope's Armadillo startled from the ramp, its tuck stepped through; then Poncho dropped from 40 px over the ball, 22 px ahead of it
  // as it rolls (it covers about that in the 11 steps he falls).
  await dodge(page, SLOPE, { teleport: RAMP_SPOT, until: 'roll', max: 40 });
  const stomp = await page.evaluate((i) => {
    const d = window.__PONCHO__!;
    const e = d.enemies()[i]!;
    d.teleport(e.x + e.dir * 22, e.y - 40);
    let bounced = false;
    for (let k = 0; k < 40 && !bounced; k++) {
      const before = d.state().vy;
      d.step(1);
      bounced = before > 0 && d.state().vy < 0;
    }
    const after = d.enemies()[i]!;
    return { bounced, vy: d.state().vy, alive: after.alive, phase: after.phase, lives: d.lives() };
  }, SLOPE);
  expect(stomp).toMatchObject({ bounced: true, alive: true, phase: 'roll', lives: 7 });
  // A stomp bounces at 260 px/s, or 410 with jump held (GDD-CMB-01); nothing was held.
  expect(stomp.vy).toBeCloseTo(-260, 0);
  // It rolls on to the wall and lies dazed; a drop onto it then defeats it, squashed.
  const on = await dodge(page, SLOPE, { until: 'dazed', max: 200 });
  expect(on.at(-1)!.phase).toBe('dazed');
  expect(on.every((s) => s.lives === 7)).toBe(true);
  const squash = await page.evaluate((i) => {
    const d = window.__PONCHO__!;
    const e = d.enemies()[i]!;
    d.teleport(e.x, e.y - 30);
    for (let k = 0; k < 40 && d.enemies()[i]!.alive; k++) d.step(1);
    return { alive: d.enemies()[i]!.alive, lives: d.lives(), vy: d.state().vy };
  }, SLOPE);
  expect(squash).toMatchObject({ alive: false, lives: 7 });
  expect(squash.vy).toBeLessThan(0);
  await frames(page);
  expect(await api(page, () => window.__PONCHO__!.defeatsDrawn())).toEqual([expect.objectContaining({ kind: 'armadillo', look: 'squash' })]);
});

test('GDD-ENM-04 the claw rings off the rolling ball and defeats it dazed', async ({ page }) => {
  await open(page);
  // The swing, 24 px before the ball reaches him: the ball is drawn plain white on the steps it rings (`white`, the image filled white) and
  // stays alive and rolling; then he jumps it.
  await dodge(page, SLOPE, { teleport: RAMP_SPOT, until: 'roll', max: 40 });
  const rang = await page.evaluate(
    async ({ i, half }) => {
      const d = window.__PONCHO__!;
      let jumpWas = false;
      for (let k = 0; k < 60; k++) {
        const p = d.state();
        const e = d.enemies()[i]!;
        const gap = e.x - half - (p.x + 5);
        // The swing at 24 px; then the jump at 12 px (held while rising).
        const jump: boolean = p.grounded ? !jumpWas && d.swings() > 0 && gap >= 0 && gap <= 12 : jumpWas && p.vy < 0;
        jumpWas = jump;
        d.step(1, { move: 0, jumpHeld: jump, claw: gap <= 24 && d.swings() === 0 });
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        const drawn = d.enemiesDrawn()[i]!;
        if (drawn.white) return { first: { drawn, phase: d.enemies()[i]!.phase, alive: d.enemies()[i]!.alive, view: d.camera() }, lives: d.lives(), jumpWas };
      }
      return { first: null, lives: d.lives(), jumpWas };
    },
    { i: SLOPE, half: ARMADILLO.width / 2 },
  );
  expect(rang.first).not.toBeNull();
  expect(rang.first!).toMatchObject({ phase: 'roll', alive: true, drawn: { kind: 'armadillo', white: true } });
  // The picture: the ball's middle, 6 px over its feet, is white on that frame (a screenshot of the page, L-017: the ball is 14 x 12 px).
  const at = { x: rang.first!.drawn.x - rang.first!.view.viewX, y: rang.first!.drawn.y - 6 - rang.first!.view.viewY };
  expect(await clearOfButtons(page, [at])).toHaveLength(1);
  const [px] = await pixelsAt(page, [at]);
  expect(nearHex(px!, '#FFFFFF', 12), JSON.stringify(px)).toBe(true);
  // The flash lasts from the first ring to the step after the last: 2 to 4 steps (each of the swing's 3 active steps that reaches the ball
  // rings, `rangSteps` 2 from each). Stepped on, with the jump at 12 px (held while rising, also one begun before), the ball is drawn in
  // its own colours again and he is not hit; the steps go on until he stands again, so the next bot starts on the ground.
  const after = await page.evaluate(
    async ({ i, half, held }) => {
      const d = window.__PONCHO__!;
      let white = 1;
      let flashing = true;
      let jumpWas = held;
      for (let k = 0; k < 80; k++) {
        const p = d.state();
        const e = d.enemies()[i]!;
        const gap = e.x - half - (p.x + 5);
        const jump: boolean = p.grounded ? !jumpWas && e.phase === 'roll' && gap >= 0 && gap <= 12 : jumpWas && p.vy < 0;
        jumpWas = jump;
        d.step(1, { move: 0, jumpHeld: jump });
        if (flashing) {
          await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
          flashing = d.enemiesDrawn()[i]!.white;
          if (flashing) white++;
        }
        if (!flashing && d.state().grounded && d.enemies()[i]!.x < d.state().x) break;
      }
      return { white, lives: d.lives() };
    },
    { i: SLOPE, half: ARMADILLO.width / 2, held: rang.jumpWas },
  );
  expect(after.white).toBeGreaterThanOrEqual(2);
  expect(after.white).toBeLessThanOrEqual(4);
  expect(after.lives).toBe(7);
  // He jumps the ball; it lies dazed at the wall; walked up to and clawed there, it is defeated, knocked over (its dazed frame), no life lost.
  const on = await dodge(page, SLOPE, { jumpAt: 12, until: 'dazed', max: 200 });
  expect(on.at(-1)!.phase).toBe('dazed');
  const clawed = await page.evaluate((i) => {
    const d = window.__PONCHO__!;
    const e = d.enemies()[i]!;
    d.teleport(e.x + 20, e.y);
    for (let k = 0; k < 10 && !d.state().grounded; k++) d.step(1);
    d.step(1, { move: -1, jumpHeld: false });
    for (let k = 0; k < 20 && d.enemies()[i]!.alive; k++) d.step(1, { move: 0, jumpHeld: false, claw: k === 0 });
    return { alive: d.enemies()[i]!.alive, lives: d.lives() };
  }, SLOPE);
  expect(clawed).toEqual({ alive: false, lives: 7 });
  await frames(page);
  expect(await api(page, () => window.__PONCHO__!.defeatsDrawn())).toEqual([expect.objectContaining({ kind: 'armadillo', look: 'dazed' })]);
});

test('GDD-ENM-04 a rolling cart runs the Armadillo down, rolling too', async ({ page }) => {
  await open(page);
  // Standing 60 px left of the rail's Armadillo, past the dip: it tucks facing him; he goes back to the cart and hops in (held while rising,
  // as lab3a.test.ts's rider does); the ball rolling at the cart is run down, knocked over (its dazed frame), and he loses no life.
  const rail = LAB_3A_RAILS[0]!;
  const out = await page.evaluate(
    ({ i, x0, y0, cartMid }) => {
      const d = window.__PONCHO__!;
      d.teleport(x0, y0 - 1);
      let tucked = false;
      let jumpWas = false;
      let was = '';
      for (let k = 0; k < 300 && d.enemies()[i]!.alive; k++) {
        const p = d.state();
        const e = d.enemies()[i]!;
        tucked ||= e.phase === 'tuck';
        const input = { move: 0, jumpHeld: false };
        if (tucked && d.carts()[0]!.phase === 'waiting') {
          const gap = cartMid - p.x;
          input.move = Math.abs(gap) > 2 ? Math.sign(gap) : 0;
          input.jumpHeld = p.grounded ? !jumpWas && Math.abs(gap) >= 20 && Math.abs(gap) <= 60 : jumpWas && p.vy < 0;
        }
        jumpWas = input.jumpHeld;
        was = e.phase;
        d.step(1, input);
      }
      return { alive: d.enemies()[i]!.alive, was, cart: d.carts()[0]!.phase, lives: d.lives() };
    },
    { i: RAILED, x0: LAB_3A_ENEMIES[RAILED]!.x - 60, y0: FLOOR_Y, cartMid: rail.x + 16 },
  );
  expect(out).toEqual({ alive: false, was: 'roll', cart: 'rolling', lives: 7 });
  await frames(page);
  expect(await api(page, () => window.__PONCHO__!.defeatsDrawn())).toEqual([expect.objectContaining({ kind: 'armadillo', look: 'dazed' })]);
});

test('GDD-ENM-04 it rolls off a ledge and rolls on', async ({ page }) => {
  await open(page);
  // Startled from the ledge's right end, it rolls at him; he jumps it; it rolls off the ledge, falls 3 tiles keeping 130 px/s across, and
  // rolls on along the floor to the wall.
  const seen = await dodge(page, LEDGE, { teleport: LEDGE_SPOT, jumpAt: 12, until: 'dazed', max: 200 });
  const roll = seen.filter((s) => s.phase === 'roll');
  const ledgeY = LAB_3A_LEDGE.row * TILE;
  expect(roll.some((s) => s.y > ledgeY && s.y < FLOOR_Y)).toBe(true); // in the air
  expect(roll.filter((s) => s.y === FLOOR_Y).length).toBeGreaterThan(3); // on along the floor
  for (let k = 1; k < roll.length; k++) expect((roll[k]!.x - roll[k - 1]!.x) / STEP).toBeCloseTo(ARMADILLO.rollSpeed, 4);
  expect(seen.at(-1)).toMatchObject({ phase: 'dazed', x: LAB_3A_LEDGE.wall * TILE - ARMADILLO.width / 2, y: FLOOR_Y, lives: 7 });
});

test('GDD-ENM-04 it rolls down a ramp faster than up it', async ({ page }) => {
  await open(page);
  // From the ramp: down at him (startled from its left), dazed at the bottom wall, then up again at him once it walks back into his sight.
  const seen = await dodge(page, SLOPE, { teleport: RAMP_SPOT, jumpAt: 12, until: 'none', max: 500 });
  const r = runs(seen).filter((p) => p.phase === 'roll');
  expect(r).toHaveLength(2);
  const [x0, x1] = [LAB_3A_SLOPE.ramp0 * TILE, (LAB_3A_SLOPE.ramp1 + 1) * TILE];
  /** Its speed along the ground, px/s, on the steps of a roll that start and end on the ramp. */
  const along = (from: number, steps: number) => {
    const v: number[] = [];
    for (let k = from + 1; k < from + steps; k++) {
      const [a, b] = [seen[k - 1]!, seen[k]!];
      if (a.x > x0 && a.x < x1 && b.x > x0 && b.x < x1) v.push(Math.hypot(b.x - a.x, b.y - a.y) / STEP);
    }
    return v;
  };
  const down = along(r[0]!.from, r[0]!.steps);
  const up = along(r[1]!.from, r[1]!.steps);
  expect(seen[r[0]!.from]!.dir).toBe(-1);
  expect(seen[r[1]!.from]!.dir).toBe(1);
  for (const v of down) expect(v).toBeCloseTo(ARMADILLO.rollDown, 4);
  for (const v of up) expect(v).toBeCloseTo(ARMADILLO.rollUp, 4);
  expect(down.length).toBeLessThan(up.length); // fewer steps over the same ramp
  expect(seen.every((s) => s.lives === 7)).toBe(true);
});

test('GDD-ENM-04 a touch of the dazed Armadillo costs nothing and the ball\'s side costs a life', async ({ page }) => {
  await open(page);
  // Dazed at the wall (he jumped the ball): put standing inside it for 20 steps, well within its 60: no life lost.
  const on = await dodge(page, SLOPE, { teleport: RAMP_SPOT, jumpAt: 12, until: 'dazed', max: 200 });
  expect(on.at(-1)!.phase).toBe('dazed');
  const inside = await page.evaluate((i) => {
    const d = window.__PONCHO__!;
    const e = d.enemies()[i]!;
    d.teleport(e.x + 4, e.y - 1);
    d.step(20);
    return { phase: d.enemies()[i]!.phase, lives: d.lives(), run: d.phase() };
  }, SLOPE);
  expect(inside).toEqual({ phase: 'dazed', lives: 7, run: 'playing' });
  // The rail's Armadillo, rolling at a Poncho who stands still in its way 60 px from it on its floor: its side is a hit, one life.
  const hit = await page.evaluate(
    ({ i, floor }) => {
      const d = window.__PONCHO__!;
      const e = d.enemies()[i]!;
      d.teleport(e.x - 60 > 790 ? e.x - 60 : e.x + 60, floor - 1);
      let was = '';
      for (let k = 0; k < 150 && d.lives() === 7; k++) {
        was = d.enemies()[i]!.phase;
        d.step(1);
      }
      return { lives: d.lives(), was, run: d.phase() };
    },
    { i: RAILED, floor: FLOOR_Y },
  );
  expect(hit).toEqual({ lives: 6, was: 'roll', run: 'respawning' });
});

test('GDD-ENM-04 the Armadillo sheet is loaded in lab-3a and not in a level without one', async ({ page }) => {
  // GDD-TEC-03: the scene's own preload, read from its textures: lab-3a has Armadillos, lab-3m (the mine's other lab) none.
  const errors = await open(page);
  expect(await api(page, () => window.__PONCHO__!.enemySheetsLoaded())).toContain('armadillo');
  await page.goto('/?level=lab-3m');
  await page.waitForFunction(() => window.__PONCHO__ !== undefined);
  const without = await api(page, () => window.__PONCHO__!.enemySheetsLoaded());
  expect(without).not.toContain('armadillo');
  expect(without).toEqual(expect.arrayContaining(['alacran', 'murcielago', 'poof']));
  expect(errors).toEqual([]);
});
