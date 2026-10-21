import { expect, test, type Page } from '@playwright/test';
import { boot } from './helpers';

const api = <T>(page: Page, fn: () => T) => page.evaluate(fn);

// The sandbox level has a taco on the floor at tile column 18 (x 288 to 304), then the second ofrenda and two spikes at
// x 320 to 352.
const runRight = (page: Page, steps: number) => page.evaluate((n) => window.__PONCHO__!.step(n, { move: 1, jumpHeld: false }), steps);

test('GDD-PWR-02 walking onto the taco picks it up: it leaves the level and shows in his hand and on the HUD', async ({ page }) => {
  await boot(page);
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 10);
  await page.evaluate(() => {
    window.__PONCHO__!.pause(true);
    window.__PONCHO__!.teleport(280, 224);
    window.__PONCHO__!.step(2);
  });
  expect(await api(page, () => window.__PONCHO__!.power())).toBe('base');
  expect(await api(page, () => window.__PONCHO__!.tacosDrawn())).toBe(1);
  expect(await api(page, () => window.__PONCHO__!.heldTacoVisible())).toBe(false);
  await runRight(page, 20);
  expect(await api(page, () => window.__PONCHO__!.power())).toBe('taco');
  expect(await api(page, () => window.__PONCHO__!.tacosDrawn())).toBe(0);
  expect(await api(page, () => window.__PONCHO__!.heldTacoVisible())).toBe(true);
  expect(await api(page, () => window.__PONCHO__!.hudPowerIcon())).toBe(true);
  expect(await api(page, () => window.__PONCHO__!.lives())).toBe(7);
});

test('GDD-CMB-03 a spike hit in Taco spends the taco, not a life, and Poncho carries on invulnerable', async ({ page }) => {
  await boot(page);
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 10);
  await page.evaluate(() => {
    window.__PONCHO__!.pause(true);
    window.__PONCHO__!.teleport(280, 224);
  });
  await runRight(page, 60);
  expect(await api(page, () => window.__PONCHO__!.power())).toBe('base');
  expect(await api(page, () => window.__PONCHO__!.lives())).toBe(7);
  expect(await api(page, () => window.__PONCHO__!.phase())).toBe('playing');
  expect(await api(page, () => window.__PONCHO__!.invulnerable())).toBeGreaterThan(0);
  expect(await api(page, () => window.__PONCHO__!.heldTacoVisible())).toBe(false);
  expect(await api(page, () => window.__PONCHO__!.hudPowerIcon())).toBe(false);
});

test('GDD-PWR-01 losing a life puts the taco back in the level and Poncho back in Base', async ({ page }) => {
  await boot(page);
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 10);
  await page.evaluate(() => {
    window.__PONCHO__!.pause(true);
    window.__PONCHO__!.teleport(280, 224);
  });
  await runRight(page, 20); // picks the taco up
  await page.evaluate(() => window.__PONCHO__!.teleport(248, 150)); // into the pit
  await page.evaluate(() => window.__PONCHO__!.step(140));
  expect(await api(page, () => window.__PONCHO__!.phase())).toBe('playing');
  expect(await api(page, () => window.__PONCHO__!.power())).toBe('base');
  expect(await api(page, () => window.__PONCHO__!.tacosDrawn())).toBe(1);
});
