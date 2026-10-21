import { expect, test } from '@playwright/test';
import { boot } from './helpers';

// The sandbox level has a spring set into the floor at tile column 12 (x 192 to 208, top y = 224), between the 2-tile wall and the pit.
test('GDD-WLD-05 walking onto the spring throws Poncho about 77 px up, higher than a jump', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard test');
  await boot(page);
  await page.evaluate(() => window.__PONCHO__!.teleport(216, 224));
  await page.waitForFunction(() => window.__PONCHO__!.state().grounded); // on the floor tile just right of the spring
  await page.keyboard.down('ArrowLeft');
  await page.waitForFunction(() => window.__PONCHO__!.state().y < 224 - 70); // a jump peaks at 56
  await page.keyboard.up('ArrowLeft');
  const { y } = await page.evaluate(() => window.__PONCHO__!.state());
  expect(y).toBeLessThan(154);
  await page.waitForFunction(() => window.__PONCHO__!.state().grounded);
});

test('GDD-WLD-05 dropping onto the spring launches Poncho', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => window.__PONCHO__!.teleport(200, 190));
  await page.waitForFunction(() => window.__PONCHO__!.state().vy < -400);
  expect(await page.evaluate(() => window.__PONCHO__!.lives())).toBe(7);
});

test('GDD-WLD-05 a jump pressed just before landing launches at 600 px/s, holding jump does not', async ({ page }) => {
  await boot(page);
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 10);
  /** Drops onto the spring from 34 px up with one press on step `press` (or none, holding jump from step 0), and returns the launch speed. */
  const launchSpeed = (press: number | 'held') =>
    page.evaluate((p) => {
      const g = window.__PONCHO__!;
      g.pause(true);
      g.teleport(200, 190);
      let prevHeld = false;
      for (let i = 0; i < 40; i++) {
        const held = p === 'held' ? true : i === p;
        g.step(1, { move: 0, jumpHeld: held && !(prevHeld && p !== 'held') });
        prevHeld = held;
        if (g.state().vy < -400) return g.state().vy;
      }
      return 0;
    }, press);
  expect(await launchSpeed('held')).toBe(-480);
  expect(await launchSpeed(8)).toBe(-600); // the landing is on step 11, so this is 3 steps early
  expect(await launchSpeed(2)).toBe(-480); // 9 steps early is too early
});
