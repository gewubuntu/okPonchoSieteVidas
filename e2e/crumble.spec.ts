import { expect, test, type Page } from '@playwright/test';
import { boot } from './helpers';

const api = <T>(page: Page, fn: () => T) => page.evaluate(fn);
const phases = (page: Page) => api(page, () => window.__PONCHO__!.crumbles().map((c) => c.phase));

// The sandbox level has three crumbling tiles in tile columns 24 to 26 of row 10 (x 384 to 432, top y = 160).
test('GDD-WLD-05 a crumbling tile warns when stood on, then drops Poncho, and comes back after a lost life', async ({ page }) => {
  await boot(page);
  expect(await phases(page)).toEqual(['idle', 'idle', 'idle']);
  await page.evaluate(() => window.__PONCHO__!.teleport(408, 150)); // lands on the middle tile (from below the Tlacuache's ledge, whose underside is y = 112)
  await page.waitForFunction(() => window.__PONCHO__!.crumbles()[1]!.phase === 'warning');
  expect(await phases(page)).toEqual(['idle', 'warning', 'idle']);
  expect(await api(page, () => window.__PONCHO__!.state().y)).toBe(160);
  await page.waitForFunction(() => window.__PONCHO__!.crumbles()[1]!.phase === 'gone');
  await page.waitForFunction(() => window.__PONCHO__!.state().y > 160); // he falls through where it was
  expect((await phases(page))[0]).toBe('idle');
  await page.evaluate(() => window.__PONCHO__!.teleport(248, 150)); // into the pit: a life is lost
  await page.waitForFunction(() => window.__PONCHO__!.phase() === 'playing' && window.__PONCHO__!.lives() === 6);
  expect(await phases(page)).toEqual(['idle', 'idle', 'idle']);
});
