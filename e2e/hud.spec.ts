import { expect, test } from '@playwright/test';
import { boot } from './helpers';

test('GDD-UI-01 the HUD starts with seven filled triangles', async ({ page }) => {
  const errors = await boot(page);
  expect(await page.evaluate(() => window.__PONCHO__!.lives())).toBe(7);
  expect(await page.evaluate(() => window.__PONCHO__!.hudFilled())).toBe(7);
  expect(errors).toEqual([]);
});

test('GDD-UI-01 and GDD-LIFE-02 losing lives empties the HUD one triangle at a time, never below zero', async ({ page }) => {
  await boot(page);
  const hud = () => page.evaluate(() => window.__PONCHO__!.hudFilled());
  for (let expected = 6; expected >= 0; expected--) {
    await page.evaluate(() => window.__PONCHO__!.loseLife());
    expect(await hud()).toBe(expected);
  }
  await page.evaluate(() => window.__PONCHO__!.loseLife());
  expect(await hud()).toBe(0);
});

test('GDD-UI-01 and GDD-LIFE-03 an ofrenda refills one triangle, once', async ({ page }) => {
  await boot(page);
  const hud = () => page.evaluate(() => window.__PONCHO__!.hudFilled());
  for (let i = 0; i < 3; i++) await page.evaluate(() => window.__PONCHO__!.loseLife());
  expect(await hud()).toBe(4);
  await page.evaluate(() => window.__PONCHO__!.activateOfrenda('a'));
  expect(await hud()).toBe(5);
  await page.evaluate(() => window.__PONCHO__!.activateOfrenda('a'));
  expect(await hud()).toBe(5);
});

test('GDD-UI-01 each tap of the dev key L loses exactly one life', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard test');
  await boot(page);
  // A real tap lasts well over one frame. Playwright's instant press() can start and end inside one frame,
  // which key polling cannot see (see docs/LESSONS.md L-006), so hold each key for 80 ms.
  for (let i = 0; i < 3; i++) {
    await page.keyboard.down('l');
    await page.waitForTimeout(80);
    await page.keyboard.up('l');
    await page.waitForTimeout(80);
  }
  expect(await page.evaluate(() => window.__PONCHO__!.hudFilled())).toBe(4);
});
