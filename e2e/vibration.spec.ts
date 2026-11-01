import { expect, test, type Page } from '@playwright/test';
import { boot } from './helpers';

declare global {
  interface Window {
    __vibrated?: unknown[];
  }
}

// GDD-CTL-03: a short vibration (50 ms) on life loss where the platform supports it. The browser's `navigator.vibrate` is replaced
// before the game loads, by one that records what it was given, or left undefined for a platform without it.
const stubVibrate = (page: Page, supported: boolean) =>
  page.addInitScript((has) => {
    window.__vibrated = [];
    const value = has ? (p: unknown) => (window.__vibrated!.push(p), true) : undefined;
    Object.defineProperty(Navigator.prototype, 'vibrate', { configurable: true, value });
  }, supported);

const fallInPit = async (page: Page) => {
  await boot(page);
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 10);
  await page.evaluate(() => window.__PONCHO__!.teleport(248, 150)); // above the sandbox pit
  await page.waitForFunction(() => window.__PONCHO__!.lives() === 6);
};

test('GDD-CTL-03 a life lost in a pit vibrates 50 ms once', async ({ page }) => {
  await stubVibrate(page, true);
  await fallInPit(page);
  expect(await page.evaluate(() => window.__vibrated)).toEqual([50]);
  expect(await page.evaluate(() => window.__PONCHO__!.vibrations())).toEqual([50]);
  // Nothing more while he waits and flips back in.
  await page.waitForFunction(() => window.__PONCHO__!.phase() === 'playing');
  expect(await page.evaluate(() => window.__vibrated)).toEqual([50]);
});

test('GDD-CTL-03 a platform without vibration loses the life without error', async ({ page }) => {
  const errors: Error[] = [];
  page.on('pageerror', (e) => errors.push(e));
  await stubVibrate(page, false);
  await fallInPit(page);
  await page.waitForFunction(() => window.__PONCHO__!.phase() === 'playing');
  expect(await page.evaluate(() => typeof navigator.vibrate)).toBe('undefined');
  expect(await page.evaluate(() => window.__PONCHO__!.vibrations())).toEqual([]);
  expect(errors).toEqual([]);
});
