// Screenshots of La Catorce in her arena 3-4 for visual review (GDD-BOS-04): her frames (`assets/sprites/boss/la-catorce.png`) in her telegraph,
// charge, slam, hurt and defeat, her armour's plume, her home tiles and the rails without warning posts. Run with `npm run shots`; images land in shots/ (not committed).
// Each shot is reached the player's way where one exists (start the level the device's way, L-045) and by the debug setters for the fight's
// moments (her phase, a cart sent) as La Estrella's are, and asserts the state it is named for right before it is taken (L-016).
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { start } from '../helpers';

const shot = async (page: Page, info: TestInfo, name: string) => {
  await page.waitForTimeout(250); // L-042: real time only lets the frame render before the picture; nothing is timed by it
  await page.screenshot({ path: `shots/${name}-${info.project.name.replace('shots-', '')}.png` });
};

/** Waits until a frame has drawn La Catorce with these fields (`catorceDrawn`), read with her state in one callback (L-033). */
const drawnAs = (page: Page, want: Record<string, unknown>) =>
  page.waitForFunction((w) => {
    const d = window.__PONCHO__!.catorceDrawn() as Record<string, unknown> | null;
    return d !== null && Object.entries(w).every(([k, v]) => d[k] === v);
  }, want);

/** Starts 3-4 the device's way and pauses it, her phase `hits + 1` started afresh (as after a lost life); Poncho stays on home. */
async function fight(page: Page, isMobile: boolean, hits: number): Promise<void> {
  await start(page, isMobile, '/?level=3-4');
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 10);
  await page.evaluate((h) => {
    const d = window.__PONCHO__!;
    d.pause(true);
    d.setCatorce(h);
  }, hits);
  expect(await page.evaluate(() => window.__PONCHO__!.state())).toMatchObject({ x: 240, y: 160, grounded: true });
}

/** Steps the paused game until her mode is `mode` (checked before each step) or `max` steps have run; the steps it took. */
const stepToMode = (page: Page, mode: string, max = 1000) =>
  page.evaluate(
    ({ m, n }) => {
      const d = window.__PONCHO__!;
      let i = 0;
      while (i < n && d.catorce()!.mode !== m) {
        d.step(1);
        i++;
      }
      return i;
    },
    { m: mode, n: max },
  );

/** Phase 1's second slam at the left stop on, a cart sent from the left rail: steps until her hits are `hits` (her phase set first). The steps the hit took. */
async function hitHer(page: Page, hits: number): Promise<number> {
  return page.evaluate((h) => {
    const d = window.__PONCHO__!;
    // Her phase `h` from its start (hits `h - 1`): the first slam at the left stop ends her armour, in phases 1 and 2 at step 270 and 205, in 3 at 197;
    // a cart set rolling 55 steps before the step after it lands one step after the slam.
    const slam = [270, 205, 197][h - 1]!;
    d.setCatorce(h - 1);
    d.step(slam - 54);
    d.setCart(0, 'rolling', 16);
    let n = 0;
    while (n < 100 && d.catorce()!.hits < h) {
      d.step(1);
      n++;
    }
    return n;
  }, hits);
}

test('GDD-BOS-04 catorce: the arena at the start, she telegraphs at the right stop, Poncho on home, no warning posts', async ({ page, isMobile }, info) => {
  await start(page, isMobile, '/?level=3-4');
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 10);
  await page.evaluate(() => window.__PONCHO__!.pause(true));
  expect(await page.evaluate(() => window.__PONCHO__!.catorce())).toMatchObject({ x: 400, mode: 'telegraph', hits: 0, armoured: true });
  expect(await page.evaluate(() => window.__PONCHO__!.state())).toMatchObject({ x: 240, y: 160, grounded: true });
  expect(await page.evaluate(() => window.__PONCHO__!.rails())).toMatchObject({ posts: 0, brokenEnds: 2 });
  expect(await page.evaluate(() => window.__PONCHO__!.bossBar())).toMatchObject({ shown: true, name: 'La Catorce', pips: 3, outlines: 0 });
  // Her telegraph at the age the boot left her in: red where floor(age / 4) is even, her wheels a quarter turn every 2 steps; facing left.
  const { age } = (await page.evaluate(() => window.__PONCHO__!.catorce()))!;
  await drawnAs(page, { look: `${Math.floor(age / 4) % 2 === 0 ? 'spinRed3_' : 'spin3_'}${Math.floor(age / 2) % 4}`, lamps: 3, left: true });
  await shot(page, info, 'catorce-arena');
});

test('GDD-BOS-04 catorce: mid-charge to the left, her red flash off, the plume of her armour', async ({ page, isMobile }, info) => {
  await fight(page, isMobile, 0);
  expect(await stepToMode(page, 'charge')).toBeLessThan(100);
  await page.evaluate(() => window.__PONCHO__!.step(40));
  const c = (await page.evaluate(() => window.__PONCHO__!.catorce()))!;
  expect(c).toMatchObject({ mode: 'charge', age: 40, armoured: true, dir: -1 });
  expect(c.x).toBeLessThan(400);
  expect(c.x).toBeGreaterThan(240);
  // x 400 - 40 x 80 / 60 = 346.67: q = floor(346.67 / 2 pi) = 55, facing left the turn ((-55 % 4) + 4) % 4 = 1.
  await drawnAs(page, { look: 'run3_1', flash: null, lamps: 3, left: true });
  await shot(page, info, 'catorce-charge');
});

test('GDD-BOS-04 catorce: her telegraph flashing red, facing left, her wheels spinning', async ({ page, isMobile }, info) => {
  await fight(page, isMobile, 0);
  await page.evaluate(() => window.__PONCHO__!.step(2));
  expect(await page.evaluate(() => window.__PONCHO__!.catorce())).toMatchObject({ mode: 'telegraph', age: 2, x: 400 });
  await drawnAs(page, { look: 'spinRed3_1', flash: 'red', lamps: 3, left: true });
  await shot(page, info, 'catorce-telegraph-red');
});

test('GDD-BOS-04 catorce: hit by an empty cart, flashing white, one lamp out, two pips', async ({ page, isMobile }, info) => {
  await fight(page, isMobile, 0);
  expect(await hitHer(page, 1)).toBe(55);
  expect(await page.evaluate(() => window.__PONCHO__!.catorce())).toMatchObject({ mode: 'hurt', age: 0, hits: 1, x: 80 });
  expect(await page.evaluate(() => window.__PONCHO__!.bossBar())).toMatchObject({ pips: 2, outlines: 1 });
  // Facing right: her slam at the left stop turned her round.
  await drawnAs(page, { look: 'hurtWhite2', flash: 'white', lamps: 2, plume: null, left: false });
  await shot(page, info, 'catorce-hurt');
});

test('GDD-BOS-04 catorce: phase 1, the step after her first slam at the left stop, squashed', async ({ page, isMobile }, info) => {
  await fight(page, isMobile, 0);
  // Her first slam at the left stop is step 270 of a fresh phase 1 (30 of telegraph, 240 of charge): one step on, her rest's age 1.
  await page.evaluate(() => window.__PONCHO__!.step(271));
  expect(await page.evaluate(() => window.__PONCHO__!.catorce())).toMatchObject({ mode: 'rest', age: 1, x: 80, hits: 0, armoured: false, dir: 1 });
  await drawnAs(page, { look: 'slam3', flash: null, lamps: 3, left: false, plume: null });
  await shot(page, info, 'catorce-slam');
});

test('GDD-BOS-04 catorce: phase 2, her slam at the left stop shaking home\'s left tile', async ({ page, isMobile }, info) => {
  await fight(page, isMobile, 1);
  // Poncho on home's right tile (x 248), so the left tile that her slam shakes down does not take him with it.
  await page.evaluate(() => window.__PONCHO__!.teleport(248, 160));
  const slam = await page.evaluate(() => {
    const d = window.__PONCHO__!;
    let n = 0;
    while (n < 400 && d.catorce()!.home[0] !== 'warning') {
      d.step(1);
      n++;
    }
    d.step(3);
    return n;
  });
  expect(slam).toBeLessThan(400);
  expect(await page.evaluate(() => window.__PONCHO__!.catorce())).toMatchObject({ x: 80, hits: 1, home: ['warning', 'idle'] });
  await page.waitForFunction(() => {
    const t = window.__PONCHO__!.homeDrawn();
    return t[0]!.phase === 'warning' && t[0]!.visible && t[0]!.x !== 224 && t[1]!.phase === 'idle' && t[1]!.x === 240;
  });
  // Three steps after her slam: still squashed, facing right.
  expect(await page.evaluate(() => window.__PONCHO__!.catorce())).toMatchObject({ mode: 'rest', age: 3 });
  await drawnAs(page, { look: 'slam2', lamps: 2, left: false });
  await shot(page, info, 'catorce-phase2-home-warning');
});

test('GDD-BOS-04 catorce: phase 3, charging wall to wall, one lamp lit', async ({ page, isMobile }, info) => {
  await fight(page, isMobile, 2);
  expect(await stepToMode(page, 'charge')).toBeLessThan(100);
  await page.evaluate(() => window.__PONCHO__!.step(30));
  const c = (await page.evaluate(() => window.__PONCHO__!.catorce()))!;
  expect(c).toMatchObject({ mode: 'charge', hits: 2, dir: -1 });
  expect(c.x).toBeLessThan(448);
  expect(await page.evaluate(() => window.__PONCHO__!.bossBar())).toMatchObject({ pips: 1, outlines: 2 });
  // x 448 - 30 x 150 / 60 = 373: q = floor(373 / 2 pi) = 59, facing left the turn ((-59 % 4) + 4) % 4 = 1.
  await drawnAs(page, { look: 'run1_1', flash: null, lamps: 1, left: true });
  await shot(page, info, 'catorce-phase3');
});

test('GDD-BOS-04 catorce: defeated, no lamp lit, three outlines on the bar', async ({ page, isMobile }, info) => {
  await fight(page, isMobile, 2);
  expect(await hitHer(page, 3)).toBe(55);
  await page.evaluate(() => window.__PONCHO__!.step(20));
  expect(await page.evaluate(() => window.__PONCHO__!.catorce())).toMatchObject({ mode: 'defeated', hits: 3, age: 20 });
  expect(await page.evaluate(() => window.__PONCHO__!.phase())).toBe('playing');
  expect(await page.evaluate(() => window.__PONCHO__!.bossBar())).toMatchObject({ pips: 0, outlines: 3 });
  // Past her white and plain 4 steps each: the wreck.
  await drawnAs(page, { look: 'wreck', flash: null, lamps: 0, plume: null });
  await shot(page, info, 'catorce-defeated');
});
