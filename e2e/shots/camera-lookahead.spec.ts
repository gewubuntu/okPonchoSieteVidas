// Screenshots of the camera's look-ahead for visual review (GDD-UI-04): up and down in lab-3t (the lift, the two carts, a fall), sideways in a
// rolling cart in lab-3c, and the look in the real levels 3-1 and 3-2. Run with `npm run shots`; images land in shots/ (not committed). Where
// things are comes from the level modules (L-062). Each scene reaches its state by real inputs stepped in the paused game (L-042) and asserts
// what it shows right before the shot (L-016): the camera's `look` ('up' or 'downward' on the ground) and where his feet are on the screen (the
// look-up holds them at y 162, the look-down at y 108).
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { CAMERA, CART, TILE } from '../../src/config/tuning';
import { LAB_3C_RAILS } from '../../src/levels/lab3c';
import { LAB_3T_DROP, LAB_3T_RAILS } from '../../src/levels/lab3t';
import { LEVEL_3_1_PITS } from '../../src/levels/level3-1';
import { LEVEL_3_2_RAIL } from '../../src/levels/level3-2';
import { start } from '../helpers';

const shot = async (page: Page, info: TestInfo, name: string) => {
  await page.waitForTimeout(250); // L-042: real time only lets the paused frame render before the picture; nothing is timed by it
  await page.screenshot({ path: `shots/${name}-${info.project.name.replace('shots-', '')}.png` });
};

/** The drawn camera rounds to whole art pixels (a quarter px), so a screen position read against it is within an eighth of a px of the rule's. */
const ROUND = 1 / 8;
const mid = (col: number) => col * TILE + TILE / 2;

/** Starts the level the device's way (L-045), pauses it and lets him land; with `at`, Poncho is put down 1 px over (x, y) first (a teleport: a cut). */
async function open(page: Page, isMobile: boolean, level: string, at?: { x: number; y: number }): Promise<void> {
  await start(page, isMobile, `/?level=${level}`);
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 10);
  await page.evaluate((p) => {
    const d = window.__PONCHO__!;
    d.pause(true);
    if (p) d.teleport(p.x, p.y - 1);
    d.step(20);
  }, at ?? null);
}

/** What the screen shows: the camera, Poncho, the carts, the platforms and the phase. */
const view = (page: Page) =>
  page.evaluate(() => ({ cam: window.__PONCHO__!.camera(), s: window.__PONCHO__!.state(), carts: window.__PONCHO__!.carts(), platforms: window.__PONCHO__!.platforms(), phase: window.__PONCHO__!.phase() }));
/** Where his feet are on the screen, y. */
const feetOn = (v: Awaited<ReturnType<typeof view>>) => v.s.y - v.cam.scrollY;
/** Where his body is on the screen, x. */
const bodyOn = (v: Awaited<ReturnType<typeof view>>) => v.s.x - v.cam.scrollX;

/** Puts Poncho 1 px over cart `i`'s floor in the paused game (a teleport: a cut) and steps until the cart rolls with him in it. */
const intoCart = (page: Page, i: number, rail: { x: number; y: number; dir: 1 | -1 }) =>
  page.evaluate(
    ([k, x, y]) => {
      const d = window.__PONCHO__!;
      d.teleport(x!, y! - 1);
      let n = 0;
      for (; n < 60 && d.carts()[k!]!.phase !== 'rolling'; n++) d.step(1);
      return n;
    },
    [i, rail.x + rail.dir * (CART.width / 2), rail.y - CART.floorPx],
  );

test('GDD-UI-04 camera look-ahead: the lift past its look-up turn, his feet at 60% of the screen', async ({ page, isMobile }, info) => {
  await open(page, isMobile, 'lab-3t');
  // Onto the lift where it is, then up with it until the look-up has caught up: his feet on the 60% line, 162.
  const up = await page.evaluate((line) => {
    const d = window.__PONCHO__!;
    const lift = d.platforms()[0]!;
    d.teleport(lift.x + lift.w / 2, lift.y - 1);
    let n = 0;
    for (; n < 700 && !(n > 70 && d.state().grounded && Math.abs(d.state().y - d.camera().scrollY - line) < 1e-9); n++) d.step(1);
    return { n, deck: d.platforms()[0]!.y };
  }, CAMERA.upFeet);
  expect(up.n).toBeLessThan(700);
  const v = await view(page);
  expect(v.s.grounded).toBe(true);
  expect(v.s.y).toBeCloseTo(v.platforms[0]!.y, 6);
  expect(v.cam.look).toBe('up');
  expect(Math.abs(feetOn(v) - CAMERA.upFeet)).toBeLessThanOrEqual(ROUND);
  expect(v.cam.scrollY).toBeGreaterThan(0);
  await shot(page, info, 'camera-lookahead-lift');
});

test('GDD-UI-04 camera look-ahead: the cart climbing, the look-up caught up', async ({ page, isMobile }, info) => {
  const R1 = LAB_3T_RAILS[0]!;
  await open(page, isMobile, 'lab-3t', { x: R1.x + CART.width / 2, y: R1.y - CART.floorPx });
  // Rolling since the landing; 45 steps on the climb the look-up is caught up (it starts at step 17 and catches up at step 39).
  const ride = await page.evaluate(() => {
    const d = window.__PONCHO__!;
    for (let n = 0; n < 200 && d.carts()[0]!.phase !== 'rolling'; n++) d.step(1);
    d.step(45);
    return d.carts()[0]!;
  });
  expect(ride.phase).toBe('rolling');
  const v = await view(page);
  expect(v.s.grounded).toBe(true);
  expect(v.s.y).toBeCloseTo(ride.y!, 6);
  expect(v.s.y).toBeLessThan(R1.y - 2 * TILE);
  expect(v.cam.look).toBe('up');
  expect(Math.abs(feetOn(v) - CAMERA.upFeet)).toBeLessThanOrEqual(ROUND);
  expect(v.cam.scrollY).toBeGreaterThan(0);
  await shot(page, info, 'camera-lookahead-climb');
});

test('GDD-UI-04 camera look-ahead: the cart descending, the look-down caught up', async ({ page, isMobile }, info) => {
  const R2 = LAB_3T_RAILS[1]!;
  await open(page, isMobile, 'lab-3t', { x: R2.x + CART.width / 2, y: R2.y - CART.floorPx });
  // Rolling since the landing, down to where the look-down has caught up (step 42 of the ride; the ride is 48 steps in all), then 2 steps on.
  const ride = await page.evaluate((line) => {
    const d = window.__PONCHO__!;
    for (let n = 0; n < 200 && d.carts()[1]!.phase !== 'rolling'; n++) d.step(1);
    for (let n = 0; n < 60 && !(d.state().y > 300 && Math.abs(d.state().y - d.camera().scrollY - line) <= 0.125 + 1e-9); n++) d.step(1);
    d.step(2);
    return d.carts()[1]!;
  }, CAMERA.downFeet);
  expect(ride.phase).toBe('rolling');
  const v = await view(page);
  expect(v.s.grounded).toBe(true);
  expect(v.s.y).toBeCloseTo(ride.y!, 6);
  expect(v.s.y).toBeGreaterThan(R2.y + 2 * TILE);
  expect(v.cam.look).toBe('downward');
  expect(Math.abs(feetOn(v) - CAMERA.downFeet)).toBeLessThanOrEqual(ROUND);
  await shot(page, info, 'camera-lookahead-descent');
});

test('GDD-UI-04 camera look-ahead: a fall, the look-down caught up', async ({ page, isMobile }, info) => {
  // From the drop's landing ground, walked off its right edge into the chasm: a fall of 21 tiles. (The drop itself is too short: he lands
  // 17 steps after the look-down starts and it needs 24 to catch up.)
  await open(page, isMobile, 'lab-3t', { x: LAB_3T_DROP.col1 * TILE - 8, y: LAB_3T_DROP.row * TILE });
  const fall = await page.evaluate((line) => {
    const d = window.__PONCHO__!;
    let air = false;
    let n = 0;
    for (; n < 200; n++) {
      d.step(1, { move: 1, jumpHeld: false });
      air ||= !d.state().grounded;
      if (air && !d.state().grounded && Math.abs(d.state().y - d.camera().scrollY - line) <= 0.125 + 1e-9) break;
    }
    d.step(3, { move: 1, jumpHeld: false });
    return { n, phase: d.phase() };
  }, CAMERA.downFeet);
  expect(fall.n).toBeLessThan(200);
  expect(fall.phase).toBe('playing');
  const v = await view(page);
  expect(v.s.grounded).toBe(false);
  // The fall's look-down is not a `look` (those are on the ground): the camera keeps the band's look it had and holds his feet at 108 by the fall rule.
  expect(v.cam.look).toBe('band');
  expect(Math.floor(v.s.x / TILE)).toBeGreaterThan(LAB_3T_DROP.col1);
  expect(Math.abs(feetOn(v) - CAMERA.downFeet)).toBeLessThanOrEqual(ROUND);
  expect(v.cam.scrollY).toBeGreaterThan(LAB_3T_DROP.row * TILE - 270);
  await shot(page, info, 'camera-lookahead-fall');
});

test('GDD-UI-04 camera look-ahead: in a cart rolling right, he is at 40% of the width', async ({ page, isMobile }, info) => {
  const R1 = LAB_3C_RAILS[0]!;
  await open(page, isMobile, 'lab-3c');
  await intoCart(page, 0, R1);
  // Until the lead is 64 and the scroll follows (the cart is at x 176 when it is, and the camera moves from x 192).
  await page.evaluate(() => {
    const d = window.__PONCHO__!;
    for (let n = 0; n < 100 && !(d.camera().lead === 64 && d.camera().scrollX > 0); n++) d.step(1);
    d.step(10);
  });
  const v = await view(page);
  expect(v.carts[0]!.phase).toBe('rolling');
  expect(v.s.grounded).toBe(true);
  expect(v.cam.lead).toBe(CAMERA.cartLead);
  expect(Math.abs(bodyOn(v) - 192)).toBeLessThanOrEqual(ROUND);
  await shot(page, info, 'camera-lookahead-cart-right');
});

test('GDD-UI-04 camera look-ahead: in a cart rolling left, he is at 60% of the width', async ({ page, isMobile }, info) => {
  const R4 = LAB_3C_RAILS[3]!;
  await open(page, isMobile, 'lab-3c');
  await intoCart(page, 3, R4);
  // Rail 4 is the only one that rolls left and its ride is 38 steps: the lead is -64 from its 32nd, 4 steps are left to take the picture on.
  await page.evaluate(() => {
    const d = window.__PONCHO__!;
    for (let n = 0; n < 100 && d.camera().lead !== -64; n++) d.step(1);
    d.step(2);
  });
  const v = await view(page);
  expect(v.carts[3]!.phase).toBe('rolling');
  expect(v.s.grounded).toBe(true);
  expect(v.cam.lead).toBe(-CAMERA.cartLead);
  expect(Math.abs(bodyOn(v) - 288)).toBeLessThanOrEqual(ROUND);
  await shot(page, info, 'camera-lookahead-cart-left');
});

test('GDD-UI-04 camera look-ahead: 3-2, riding cart A with the lead settled', async ({ page, isMobile }, info) => {
  await open(page, isMobile, '3-2');
  // Right held from the spawn: he walks off the step into cart A and rides it until the lead is 64 and the camera follows him at 192.
  const ride = await page.evaluate(() => {
    const d = window.__PONCHO__!;
    let n = 0;
    for (; n < 300 && !(d.carts()[0]!.phase === 'rolling' && d.camera().lead === 64 && d.camera().scrollX > 0); n++) d.step(1, { move: 1, jumpHeld: false });
    d.step(8, { move: 1, jumpHeld: false });
    return n;
  });
  expect(ride).toBeLessThan(300);
  const v = await view(page);
  expect(v.carts[0]!.phase).toBe('rolling');
  expect(v.s.grounded).toBe(true);
  expect(Math.abs(v.s.y - v.carts[0]!.y!)).toBeLessThan(1e-6);
  expect(v.cam.lead).toBe(CAMERA.cartLead);
  expect(Math.abs(bodyOn(v) - 192)).toBeLessThanOrEqual(ROUND);
  expect(LEVEL_3_2_RAIL.A.dir).toBe(1);
  await shot(page, info, 'camera-lookahead-3-2');
});

test('GDD-UI-04 camera look-ahead: 3-1, over the second chasm, landed on the far bank with the look-down caught up', async ({ page, isMobile }, info) => {
  // The glide the 3-1 tests fly over the second chasm: a held jump from the flat's column 100 (x 1600, row 15), the glide held on to the far
  // bank (row 19, 4 tiles lower), where the look-down on the ground catches up and holds his feet at 40% of the height. The four hilos of the
  // flat's arc are taken first, in play (L-045).
  await open(page, isMobile, '3-1');
  const taken = await page.evaluate(() => {
    const d = window.__PONCHO__!;
    let jumped = false;
    let air = false;
    for (let i = 0; i < 300 && !(air && d.state().grounded); i++) {
      if (!jumped && d.state().x >= 92) jumped = true;
      d.step(1, { move: 1, jumpHeld: jumped });
      air ||= !d.state().grounded;
    }
    d.step(10);
    return d.hilos().taken;
  });
  expect(taken).toBe(4);
  const chasm = LEVEL_3_1_PITS[1]!;
  const glide = await page.evaluate(
    ([x, y, line]) => {
      const d = window.__PONCHO__!;
      d.teleport(x!, y! - 1);
      for (let i = 0; i < 30 && !d.state().grounded; i++) d.step(1);
      let jumped = false;
      let glided = false;
      let n = 0;
      for (; n < 300; n++) {
        const s = d.state();
        if (!jumped && s.grounded && s.x >= 100 * 16) jumped = true;
        d.step(1, { move: 1, jumpHeld: jumped });
        const t = d.state();
        glided = glided || t.gliding === true;
        if (glided && t.grounded && Math.abs(t.y - d.camera().scrollY - line!) <= 0.125 + 1e-9) break;
      }
      return { n, glided, phase: d.phase() };
    },
    [mid(96), 15 * TILE, CAMERA.downFeet],
  );
  expect(glide).toMatchObject({ glided: true, phase: 'playing' });
  expect(glide.n).toBeLessThan(300);
  const v = await view(page);
  expect(v.s.grounded).toBe(true);
  expect(v.s.y).toBe(19 * TILE);
  expect(v.cam.look).toBe('downward');
  expect(Math.floor(v.s.x / TILE)).toBeGreaterThan(chasm.col1);
  expect(Math.abs(feetOn(v) - CAMERA.downFeet)).toBeLessThanOrEqual(ROUND);
  await shot(page, info, 'camera-lookahead-3-1');
});
