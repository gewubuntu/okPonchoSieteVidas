import { expect, test, type Page } from '@playwright/test';
import { CACOMIXTLE, ENEMY_ART, TILE } from '../src/config/tuning';
import { LAB_3K_ENEMIES, LAB_3K_PERCH, LAB_3K_RAILS, LAB_3K_SHELF } from '../src/levels/lab3k';
import { boot } from './helpers';

// GDD-ENM-04: the Cacomixtle in play, in lab-3k (`?level=lab-3k`, `src/levels/lab3k.ts`; L-062: where things are is read from it). The game is
// paused and stepped in the page, each step with the scene's picture redrawn in the same call (`step()`, and `drawAt(0.5)` for the picture half
// way between two steps), so every count is in steps (L-042) and a whole ride is one round trip (L-073); one test runs the telegraph through the
// game's own frames (L-021). The claims these replay are pinned in the simulation by `src/sim/cacomixtle.test.ts` and `src/levels/lab3k.test.ts`.
const KA = 0;
const KB = 1;
const ALACRAN = 2;
/** Poncho on the perch (a still platform, top 40 px over the floor), 8 px from its middle: in Ka's sight, over the cart as it passes under. */
const PERCH_SPOT = { x: LAB_3K_PERCH.x0 + 24, y: LAB_3K_PERCH.y0 };
/** On Kb's shelf, 178 px ahead of its ringtail along its rail and 24 px over the cart's floor: in its sight. */
const SHELF_SPOT = { x: 750, y: LAB_3K_SHELF.row * TILE };

/** On the shelf behind Kb's buffer (x = 672), the third ofrenda's column: out of the cart's way, out of its sight. */
const BEHIND_BUFFER = { x: 632, y: LAB_3K_SHELF.row * TILE };

/** The telegraph's flash is red on its step `t` (GDD-ENM-01, 4 on and 4 off from step 1). */
const redAt = (t: number) => Math.floor((t - 1) / CACOMIXTLE.flashOn) % 2 === 0;

/** Starts lab-3k, waits a few steps and pauses it. */
async function open(page: Page): Promise<string[]> {
  const errors = await boot(page, '/?level=lab-3k');
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 2);
  await page.evaluate(() => window.__PONCHO__!.pause(true));
  return errors;
}

/** Waits for two frames, so what a step changed is drawn (L-033). */
const nextFrames = (page: Page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

type Layer = { x: number; y: number; rotation: number; depth: number };
type Sample = {
  /** 1 at the end of a step, 0.5 half way between the two last. */
  alpha: number;
  step: number;
  look: string;
  red: boolean;
  flip: boolean;
  x: number;
  y: number;
  rotation: number;
  depth: number;
  cart: { back: Layer; front: Layer };
  cartPhase: string;
  /** The simulation's: the cart's floor under its middle, and the ringtail's own place. */
  floor: { x: number; y: number };
  sim: { x: number; y: number };
  ride: { phase: string; t: number };
  lives: number;
};

/**
 * In the page: puts Poncho at `at` if given (and at `leave` once the ringtail rides), then steps the paused game one step at a time for at most `max` steps, nothing held. After each
 * step it reads Ka's or Kb's ringtail (the place `i` in the level's list) as drawn, and again after a half-way redraw (`drawAt(0.5)`). It
 * stops once its cart has stopped and `after` more steps have run, or `stopWhen` returns true on the step's sample.
 */
const rideOf = (page: Page, i: number, rail: number, at: { x: number; y: number } | null, max: number, leave: { x: number; y: number } | null = null, after = 3): Promise<Sample[]> =>
  page.evaluate(
    ({ index, railIndex, spot, limit, extra, away }) => {
      const d = window.__PONCHO__!;
      if (spot) d.teleport(spot.x, spot.y - 1);
      const out: Sample[] = [];
      let tail = -1;
      const read = (alpha: number, step: number): Sample => {
        const e = d.enemiesDrawn().find((x) => x.kind === 'cacomixtle' && x.rail === railIndex)!;
        const cart = d.carts()[railIndex]!;
        const sim = d.enemies()[index]!;
        return {
          alpha, step, look: e.look, red: e.red, flip: e.flip, x: e.x, y: e.y, rotation: e.rotation, depth: e.depth, cart: e.cart!, cartPhase: cart.phase,
          floor: { x: (cart.x ?? 0) + (cart.w ?? 0) / 2, y: cart.y ?? 0 }, sim: { x: sim.x, y: sim.y }, ride: sim.ride!, lives: d.lives(),
        };
      };
      for (let k = 0; k < limit && tail < extra; k++) {
        d.step(1);
        // Once it rides he is put out of its way, behind its buffer (it rolls through the shelf he stood on).
        if (away && d.enemies()[index]!.ride!.phase === 'riding') d.teleport(away.x, away.y - 1);
        out.push(read(1, k));
        d.drawAt(0.5);
        out.push(read(0.5, k));
        d.drawAt(1);
        if (out[out.length - 1]!.cartPhase === 'stopped') tail++;
      }
      return out;
    },
    { index: i, railIndex: rail, spot: at, limit: max, extra: after, away: leave },
  );

test('GDD-ENM-04 cacomixtle telegraphs then rides: doze, a red flash for 30 steps, the ride, parked at the buffer, always on its cart', async ({ page }) => {
  const errors = await open(page);
  // The sheet is loaded because this level has a Cacomixtle, and the Armadillo's is not (GDD-TEC-03).
  const sheets = await page.evaluate(() => window.__PONCHO__!.enemySheetsLoaded());
  expect(sheets).toContain('cacomixtle');
  expect(sheets).not.toContain('armadillo');
  // Waiting, before he is in its sight: it dozes, on its cart's floor at its middle.
  await nextFrames(page);
  const before = await page.evaluate(() => window.__PONCHO__!.enemiesDrawn().find((e) => e.kind === 'cacomixtle' && e.rail === 0)!);
  expect(before).toMatchObject({ look: 'doze', flip: true, red: false, x: LAB_3K_ENEMIES[KA]!.x, y: LAB_3K_ENEMIES[KA]!.y });
  // On the perch, in its sight: the telegraph, the ride under him, the buffer.
  const s = await rideOf(page, KA, 0, PERCH_SPOT, 400);
  const ends = s.filter((x) => x.alpha === 1);
  expect(ends.at(-1)!.cartPhase).toBe('stopped');
  // Its telegraph: exactly 30 steps of `stand` and `standRed`, the cart still, red on its steps 1 to 4, 9 to 12 and so on (4 on, 4 off, GDD-ENM-01).
  const tele = ends.filter((x) => x.ride.phase === 'telegraph');
  expect(tele.map((x) => x.ride.t)).toEqual(Array.from({ length: CACOMIXTLE.telegraphSteps }, (_, k) => k + 1));
  for (const x of tele) {
    expect(x.look, `telegraph step ${x.ride.t}`).toBe(Math.floor((x.ride.t - 1) / 4) % 2 === 0 ? 'standRed' : 'stand');
    expect(x.red).toBe(x.look === 'standRed');
    // The cart is still for the telegraph: it starts rolling at the end of its 30th step and first moves on the next.
    expect(x.cartPhase).toBe(x.ride.t < CACOMIXTLE.telegraphSteps ? 'waiting' : 'rolling');
  }
  expect(new Set(tele.map((x) => x.look))).toEqual(new Set(['stand', 'standRed']));
  // Waiting it dozes up to the telegraph and never again; riding it shows ride0 and ride1 in turn, every 4 steps; parked at the buffer it peeks.
  const waiting = ends.filter((x) => x.ride.phase === 'waiting');
  for (const x of waiting) expect(x.look).toBe('doze');
  const riding = ends.filter((x) => x.ride.phase === 'riding');
  expect(riding.length).toBeGreaterThan(60);
  expect(new Set(riding.map((x) => x.look))).toEqual(new Set(['ride0', 'ride1']));
  for (const x of riding) expect(x.cartPhase).toBe('rolling');
  const parked = ends.filter((x) => x.ride.phase === 'parked');
  expect(parked.length).toBeGreaterThan(0);
  for (const x of parked) expect(x).toMatchObject({ look: 'parked', cartPhase: 'stopped' });
  // The order of the phases: telegraph, riding, parked (waiting is the doze before, above).
  expect(ends.map((x) => x.ride.phase).filter((p, k, all) => k === 0 || p !== all[k - 1])).toEqual(['telegraph', 'riding', 'parked']); // in its sight from the first step
  // Mirrored: its rail rolls left.
  for (const x of ends) expect(x.flip).toBe(true);
  // On every sampled frame, at the end of a step and half way between two, it stands on its cart's drawn floor line (within 0.5 px), turned with
  // its cart's images, and its image lies between the cart's back and front layers (depth). On level rail it is not turned.
  for (const x of s) {
    const label = `step ${x.step} alpha ${x.alpha}`;
    expect(Math.abs(x.x - x.cart.back.x), `${label} x`).toBeLessThanOrEqual(0.5);
    expect(Math.abs(x.y - x.cart.back.y), `${label} y`).toBeLessThanOrEqual(0.5);
    expect(x.rotation, label).toBeCloseTo(x.cart.back.rotation, 9);
    expect(x.rotation, label).toBeCloseTo(0, 9);
    expect(x.depth, label).toBeGreaterThan(x.cart.back.depth);
    expect(x.depth, label).toBeLessThan(x.cart.front.depth);
  }
  // At the end of a step the drawn place is the simulation's, the cart's floor under its middle, which is not the same half way: a ringtail
  // drawn at the simulation's place would lag the cart's picture by half a step's roll (1.25 px on level rail).
  for (const x of ends) {
    expect(Math.abs(x.x - x.sim.x), `step ${x.step}`).toBeLessThanOrEqual(1e-6);
    expect(Math.abs(x.y - x.floor.y), `step ${x.step}`).toBeLessThanOrEqual(1e-6);
  }
  const rolling = s.filter((x) => x.alpha === 0.5 && x.cartPhase === 'rolling');
  expect(rolling.length).toBeGreaterThan(60);
  expect(rolling.filter((x) => Math.abs(x.x - x.sim.x) > 1).length).toBeGreaterThan(60);
  // He stood on the perch the whole time, and no life was lost.
  expect(s.every((x) => x.lives === 7)).toBe(true);
  expect(errors).toEqual([]);
});

test('GDD-ENM-04 cacomixtle stomped: a squash and a poof, and its cart stands empty, to be ridden', async ({ page }) => {
  await open(page);
  // Dropped on Ka waiting, from 30 px over its head: the stomp defeats it and bounces him.
  const r = await page.evaluate(
    ({ x, y, max }) => {
      const d = window.__PONCHO__!;
      d.teleport(x, y);
      let k = 0;
      while (k < max && d.enemies()[0]!.alive) {
        d.step(1);
        k++;
      }
      const vy: number[] = [];
      for (let j = 0; j < 3; j++) {
        d.step(1);
        vy.push(d.state().vy);
      }
      return { k, vy, alive: d.enemies()[0]!.alive, lives: d.lives(), cart: d.carts()[0]!.phase, ride: d.enemies()[0]!.ride };
    },
    { x: LAB_3K_ENEMIES[KA]!.x, y: LAB_3K_ENEMIES[KA]!.y - 14 - 30, max: 40 },
  );
  expect(r.alive).toBe(false);
  expect(r.k).toBeLessThan(40);
  expect(r.vy[0]!).toBeLessThan(0); // bounced
  expect(r.lives).toBe(7);
  expect(r.cart).toBe('waiting'); // its cart stands still, empty, at its start
  // The squash frame where it stood, then the poof (a squash for ENEMY_ART.defeatSteps steps, then a frame every poofSteps).
  await nextFrames(page);
  const first = await page.evaluate(() => window.__PONCHO__!.defeatsDrawn());
  expect(first).toHaveLength(1);
  expect(first[0]).toMatchObject({ kind: 'cacomixtle', look: 'squash', x: LAB_3K_ENEMIES[KA]!.x });
  expect(await page.evaluate(() => window.__PONCHO__!.enemiesDrawn().filter((e) => e.kind === 'cacomixtle').map((e) => e.rail))).toEqual([KB]);
  await page.evaluate((n) => window.__PONCHO__!.step(n), ENEMY_ART.defeatSteps - 3); // 3 steps have run since it fell: its age is 8
  await nextFrames(page);
  const poof = await page.evaluate(() => window.__PONCHO__!.defeatsDrawn());
  expect(poof[0]).toMatchObject({ kind: 'cacomixtle', look: 'poof0' });
  // Its cart is an ordinary cart now: Poncho lands in it and it rolls, with him anchored at its middle.
  const ridden = await page.evaluate(
    ({ x, y }) => {
      const d = window.__PONCHO__!;
      d.teleport(x, y - 40);
      for (let k = 0; k < 40 && d.carts()[0]!.phase === 'waiting'; k++) d.step(1);
      d.step(2);
      return { phase: d.carts()[0]!.phase, px: d.state().x, lives: d.lives() };
    },
    { x: LAB_3K_ENEMIES[KA]!.x, y: LAB_3K_ENEMIES[KA]!.y },
  );
  expect(ridden.phase).toBe('rolling');
  expect(ridden.lives).toBe(7);
  expect(ridden.px).toBeLessThan(LAB_3K_ENEMIES[KA]!.x);
});

test('GDD-ENM-04 cacomixtle on the climb: its painted turn is its cart\'s, 45 degrees on the two-tile climb and level on the terrace and the shelf', async ({ page }) => {
  await open(page);
  const s = await rideOf(page, KB, 1, SHELF_SPOT, 500, BEHIND_BUFFER);
  const ends = s.filter((x) => x.alpha === 1);
  expect(ends.at(-1)!.cartPhase).toBe('stopped');
  expect(s.every((x) => x.lives === 7)).toBe(true);
  // Its rail rolls left, so on the climb its cart is turned clockwise, +45 degrees (a turn through the joins on the way). Always the cart's own turn.
  for (const x of s) {
    expect(x.rotation, `step ${x.step} alpha ${x.alpha}`).toBeCloseTo(x.cart.back.rotation, 9);
    expect(x.rotation, `step ${x.step} alpha ${x.alpha}`).toBeCloseTo(x.cart.front.rotation, 9);
    expect(Math.abs(x.x - x.cart.back.x)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(x.y - x.cart.back.y)).toBeLessThanOrEqual(0.5);
    expect(x.depth).toBeGreaterThan(x.cart.back.depth);
    expect(x.depth).toBeLessThan(x.cart.front.depth);
  }
  const turned = s.filter((x) => Math.abs(x.rotation - Math.PI / 4) < 1e-6);
  expect(turned.length).toBeGreaterThanOrEqual(16); // both wheels on the climb's 32 px across at 85 px/s: about 10 steps, twice sampled
  expect(s.some((x) => Math.abs(x.rotation) < 1e-9 && x.cartPhase === 'rolling')).toBe(true); // level before and after
  expect(s.some((x) => x.rotation > 0 && x.rotation < Math.PI / 4 - 1e-3)).toBe(true); // turning through a join
  // At its start the ringtail is on the lower terrace and level; parked it is on the shelf, level again, at the buffer's end of the rail.
  expect(s[0]!.rotation).toBeCloseTo(0, 9);
  expect(ends.at(-1)!.rotation).toBeCloseTo(0, 9);
  expect(ends.at(-1)!.y).toBeLessThan(LAB_3K_RAILS[KB]!.y - 20); // up on the shelf, 24 px over where it started
});

test('GDD-ENM-04 the images of a defeated ringtail are not left on the next enemy: an Alacran drawn on a turned, layered image is upright at depth 3', async ({ page }) => {
  await open(page);
  // Kb rides the climb, its image turned and between its cart's layers; the Alacrán is the next enemy in the level's list, so when Kb is
  // stomped on the climb it takes Kb's pooled image (L-069). Nothing of Kb's turn or depth may stay on it.
  const r = await page.evaluate(
    ({ spot, alacran, away }) => {
      const d = window.__PONCHO__!;
      d.teleport(spot.x, spot.y - 1);
      const ringtails = () => d.enemiesDrawn().filter((e) => e.kind === 'cacomixtle');
      let k = 0;
      while (k < 300 && !ringtails().some((e) => e.rail === 1 && Math.abs(e.rotation) > 0.5)) {
        d.step(1);
        if (d.enemies()[1]!.ride!.phase === 'riding') d.teleport(away.x, away.y - 1); // out of its way
        k++;
      }
      const turned = ringtails().find((e) => e.rail === 1)!;
      const was = { rotation: turned.rotation, depth: turned.depth };
      const placed = d.enemies()[1]!;
      // Over its head, on the climb, a little ahead of it (it climbs away from under him as he falls): he lands on it.
      d.teleport(placed.x - 4, placed.y - 14 - 8);
      let j = 0;
      while (j < 40 && d.enemies()[1]!.alive) {
        d.step(1);
        j++;
      }
      const after = d.enemiesDrawn();
      const al = after.find((e) => e.kind === 'alacran');
      return { k, was, killed: !d.enemies()[1]!.alive, j, kinds: after.map((e) => e.kind), alacran: al ? { rotation: al.rotation, depth: al.depth, x: al.x } : null, lives: d.lives(), alacranAt: alacran };
    },
    { spot: SHELF_SPOT, alacran: LAB_3K_ENEMIES[ALACRAN]!.x, away: BEHIND_BUFFER },
  );
  // Precondition: Kb really was drawn turned and between its layers on the image the Alacrán then takes.
  expect(r.was.rotation).toBeGreaterThan(0.5);
  expect(r.was.depth).toBeGreaterThan(2.5);
  expect(r.was.depth).toBeLessThan(3.2);
  expect(r.was.depth).not.toBe(3);
  expect(r.killed).toBe(true);
  expect(r.lives).toBe(7);
  // Ka and the Alacrán are drawn now, Ka first: the Alacrán is on the image Kb had.
  expect(r.kinds).toEqual(['cacomixtle', 'alacran']);
  expect(r.alacran).toMatchObject({ rotation: 0, depth: 3 });
  expect(Math.abs(r.alacran!.x - r.alacranAt)).toBeLessThan(40); // it walks its closet, 23 px each way
});

test('GDD-ENM-04 cacomixtle through the game\'s own frames: the telegraph flashes red in step with the simulation', async ({ page }) => {
  await open(page);
  // L-021: unpaused, on each frame the ringtail's ride as the simulation has it and the frame the scene drew; he stands on the perch.
  const seen = await page.evaluate(
    (spot) =>
      new Promise<{ phase: string; t: number; look: string; red: boolean; off: number; rolling: boolean }[]>((resolve) => {
        const d = window.__PONCHO__!;
        const out: { phase: string; t: number; look: string; red: boolean; off: number; rolling: boolean }[] = [];
        let rolled = 0;
        d.teleport(spot.x, spot.y - 1);
        d.pause(false);
        const tick = () => {
          const drawn = d.enemiesDrawn().find((e) => e.kind === 'cacomixtle' && e.rail === 0);
          const ride = d.enemies()[0]!.ride!;
          if (drawn) {
            // How far the ringtail is drawn from the cart's drawn floor point, this frame (the carts are drawn before the enemies).
            const off = Math.hypot(drawn.x - drawn.cart!.back.x, drawn.y - drawn.cart!.back.y);
            out.push({ phase: ride.phase, t: ride.t, look: drawn.look, red: drawn.red, off, rolling: d.carts()[0]!.phase === 'rolling' });
          }
          if (ride.phase === 'riding') rolled++;
          if (rolled > 12 || out.length > 400) {
            d.pause(true);
            resolve(out);
          } else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
    PERCH_SPOT,
  );
  const tele = seen.filter((f) => f.phase === 'telegraph' && f.look.startsWith('stand'));
  expect(tele.length).toBeGreaterThan(3);
  // A frame can draw the step before the one read (the callback runs before or after the scene's update), so a frame's red is the flash of
  // its own step or of the one before it, and both kinds of frame are seen.
  for (const f of tele) expect([redAt(f.t), redAt(Math.max(1, f.t - 1))], `t ${f.t}`).toContain(f.red);
  expect(new Set(tele.map((f) => f.red))).toEqual(new Set([true, false]));
  expect(new Set(tele.map((f) => f.look))).toEqual(new Set(['stand', 'standRed']));
  // And on its cart in every frame the game drew, the ride's too: never a frame behind its cart (L-021).
  const riding = seen.filter((f) => f.rolling);
  expect(riding.length).toBeGreaterThan(8);
  for (const f of seen) expect(f.off, `t ${f.t}`).toBeLessThanOrEqual(0.5);
});
