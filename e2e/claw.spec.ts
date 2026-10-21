import { expect, test, type Page } from '@playwright/test';
import { boot } from './helpers';

const api = <T>(page: Page, fn: () => T) => page.evaluate(fn);

// The sandbox level has a fragile wall four tiles tall at tile column 27 (x 432 to 448), and a piñata at column 9, row 11
// (x 144 to 160, y 176 to 192) that Poncho can reach with the claw from the top of the 2-tile wall at columns 10 and 11.
const start = async (page: Page, x: number, y = 224) => {
  await boot(page);
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 10);
  await page.evaluate(
    ({ px, py }) => {
      window.__PONCHO__!.pause(true);
      window.__PONCHO__!.teleport(px, py);
      window.__PONCHO__!.step(2);
    },
    { px: x, py: y },
  );
};
const press = (page: Page, steps: number) => page.evaluate((n) => window.__PONCHO__!.step(n, { move: 0, jumpHeld: false, claw: true }), steps);
const idle = (page: Page, steps: number) => page.evaluate((n) => window.__PONCHO__!.step(n), steps);

test('GDD-CMB-02 a press winds up for 2 steps, swings for 3, and what is drawn follows', async ({ page }) => {
  await start(page, 120);
  expect(await api(page, () => window.__PONCHO__!.claw())).toBe('idle');
  expect(await api(page, () => window.__PONCHO__!.clawDrawn())).toBe('none');
  await press(page, 1);
  expect(await api(page, () => window.__PONCHO__!.claw())).toBe('windup');
  expect(await api(page, () => window.__PONCHO__!.clawDrawn())).toBe('windup');
  await idle(page, 2);
  expect(await api(page, () => window.__PONCHO__!.claw())).toBe('swing');
  expect(await api(page, () => window.__PONCHO__!.clawDrawn())).toBe('swing');
  await idle(page, 3);
  expect(await api(page, () => window.__PONCHO__!.claw())).toBe('idle');
  expect(await api(page, () => window.__PONCHO__!.clawDrawn())).toBe('none');
});

test('GDD-WLD-05 a claw swipe breaks the fragile wall where it reaches, and Poncho walks through the gap', async ({ page }) => {
  await start(page, 418);
  expect(await api(page, () => window.__PONCHO__!.fragilesDrawn())).toBe(4);
  await idle(page, 1);
  await page.evaluate(() => window.__PONCHO__!.step(60, { move: 1, jumpHeld: false }));
  expect((await api(page, () => window.__PONCHO__!.state())).x).toBe(432 - 6); // the wall stops him
  await press(page, 1);
  await idle(page, 4);
  expect(await api(page, () => window.__PONCHO__!.fragilesDrawn())).toBe(3); // the 14 px claw hits only the bottom tile
  await page.evaluate(() => window.__PONCHO__!.step(60, { move: 1, jumpHeld: false }));
  expect((await api(page, () => window.__PONCHO__!.state())).x).toBeGreaterThan(448);
});

test('GDD-PWR-05 a claw swipe from the top of the wall opens the piñata and a taco comes out', async ({ page }) => {
  await start(page, 168, 192);
  await page.evaluate(() => window.__PONCHO__!.step(1, { move: -1, jumpHeld: false })); // turn to face the piñata
  expect(await api(page, () => window.__PONCHO__!.pinatasDrawn())).toEqual([false]);
  await press(page, 1);
  await idle(page, 4);
  expect(await api(page, () => window.__PONCHO__!.pinatasDrawn())).toEqual([true]);
  expect((await api(page, () => window.__PONCHO__!.itemsDrawn())).length).toBe(1);
});

test('GDD-WLD-05 losing a life puts the fragile wall back', async ({ page }) => {
  await start(page, 418);
  await press(page, 1);
  await idle(page, 4);
  expect(await api(page, () => window.__PONCHO__!.fragilesDrawn())).toBe(3);
  await page.evaluate(() => {
    window.__PONCHO__!.teleport(248, 150); // into the pit
    window.__PONCHO__!.step(140);
  });
  expect(await api(page, () => window.__PONCHO__!.phase())).toBe('playing');
  expect(await api(page, () => window.__PONCHO__!.fragilesDrawn())).toBe(4);
});
