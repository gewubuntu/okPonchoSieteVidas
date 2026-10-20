import { expect, test, type Page } from '@playwright/test';
import { boot } from './helpers';

const api = <T>(page: Page, fn: () => T) => page.evaluate(fn);
/** Puts Poncho on the floor inside the ofrenda at x, then waits for the game to notice. */
const touch = (page: Page, x: number) => page.evaluate((px) => window.__PONCHO__!.teleport(px, 224), x);

test('GDD-WLD-03 the sandbox level shows three unused ofrendas', async ({ page }) => {
  await boot(page);
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 5);
  expect(await api(page, () => window.__PONCHO__!.ofrendas())).toEqual([
    { id: 'sandbox-1', x: 120, used: false },
    { id: 'sandbox-2', x: 312, used: false },
    { id: 'sandbox-3', x: 408, used: false },
  ]);
});

test('GDD-LIFE-03 touching an ofrenda restores a life and draws it as used', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => window.__PONCHO__!.loseLife());
  await page.evaluate(() => window.__PONCHO__!.loseLife());
  expect(await api(page, () => window.__PONCHO__!.hudFilled())).toBe(5);
  await touch(page, 120);
  await page.waitForFunction(() => window.__PONCHO__!.lives() === 6);
  await page.waitForFunction(() => window.__PONCHO__!.ofrendas()[0]!.used);
  expect(await api(page, () => window.__PONCHO__!.hudFilled())).toBe(6);
  expect(await api(page, () => window.__PONCHO__!.ofrendas().map((o) => o.used))).toEqual([true, false, false]);
  // Touching it a second time gives nothing more.
  await touch(page, 312);
  await page.waitForFunction(() => window.__PONCHO__!.lives() === 7);
  await touch(page, 120);
  await page.waitForTimeout(200);
  expect(await api(page, () => window.__PONCHO__!.lives())).toBe(7);
});

test('GDD-LIFE-02 after a pit fall Poncho respawns at the last ofrenda touched', async ({ page }) => {
  await boot(page);
  await touch(page, 312);
  await page.waitForFunction(() => window.__PONCHO__!.ofrendas()[1]!.used);
  expect(await api(page, () => window.__PONCHO__!.checkpoint())).toMatchObject({ x: 312, y: 224 });
  await page.evaluate(() => window.__PONCHO__!.teleport(248, 150)); // above the pit
  await page.waitForFunction(() => window.__PONCHO__!.lives() === 6);
  await page.waitForFunction(() => window.__PONCHO__!.phase() === 'playing');
  expect(await api(page, () => window.__PONCHO__!.state())).toMatchObject({ x: 312, y: 224, grounded: true });
});

test('GDD-LIFE-05 losing the last life puts the ofrendas back and restarts at the level start', async ({ page }) => {
  await boot(page);
  await touch(page, 120);
  await page.waitForFunction(() => window.__PONCHO__!.ofrendas()[0]!.used);
  for (let i = 0; i < 6; i++) await page.evaluate(() => window.__PONCHO__!.loseLife());
  await page.evaluate(() => window.__PONCHO__!.teleport(248, 150));
  await page.waitForFunction(() => window.__PONCHO__!.lives() === 7 && window.__PONCHO__!.phase() === 'playing');
  expect(await api(page, () => window.__PONCHO__!.ofrendas().every((o) => !o.used))).toBe(true);
  expect(await api(page, () => window.__PONCHO__!.state())).toMatchObject({ x: 56, y: 224 });
  expect(await api(page, () => window.__PONCHO__!.checkpoint())).toMatchObject({ x: 56, y: 224 });
});
