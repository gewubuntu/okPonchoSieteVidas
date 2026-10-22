import { expect, test, type Page } from '@playwright/test';
import { boot } from './helpers';

const api = <T>(page: Page, fn: () => T) => page.evaluate(fn);

// The sandbox level has a piñata at tile column 9, row 11 (x 144 to 160, underside y = 192), 32 px above the floor.
const bumpIt = (page: Page) =>
  page.evaluate(() => {
    window.__PONCHO__!.pause(true);
    window.__PONCHO__!.teleport(152, 224);
    window.__PONCHO__!.step(2);
    window.__PONCHO__!.step(25, { move: 0, jumpHeld: true });
  });

/** Like `bumpIt`, but stops on the step the taco appears, so it is still standing on the piñata. */
const bumpItAndStop = (page: Page) =>
  page.evaluate(() => {
    window.__PONCHO__!.pause(true);
    window.__PONCHO__!.teleport(152, 224);
    window.__PONCHO__!.step(2);
    for (let i = 0; i < 40 && window.__PONCHO__!.itemsDrawn().length === 0; i++) window.__PONCHO__!.step(1, { move: 0, jumpHeld: true });
  });

test('GDD-PWR-05 a jump from underneath opens the piñata and a taco walks out on top of it', async ({ page }) => {
  await boot(page);
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 10);
  expect(await api(page, () => window.__PONCHO__!.pinatasDrawn())).toEqual([false, false]);
  await bumpItAndStop(page);
  expect(await api(page, () => window.__PONCHO__!.pinatasDrawn())).toEqual([true, false]);
  const items = await api(page, () => window.__PONCHO__!.itemsDrawn());
  expect(items).toHaveLength(1);
  expect(items[0]!.y).toBe(176); // standing on the piñata's top, not fallen through it
  const x0 = items[0]!.x;
  await page.evaluate(() => window.__PONCHO__!.step(10));
  expect((await api(page, () => window.__PONCHO__!.itemsDrawn()))[0]!.x).toBeGreaterThan(x0); // walking away
  expect(await api(page, () => window.__PONCHO__!.power())).toBe('base');
  expect(await api(page, () => window.__PONCHO__!.lives())).toBe(7);
});

test('GDD-PWR-06 touching the walking taco makes Poncho Taco and it is gone', async ({ page }) => {
  await boot(page);
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 10);
  await bumpIt(page);
  const item = (await api(page, () => window.__PONCHO__!.itemsDrawn()))[0]!;
  await page.evaluate(({ x, y }) => {
    window.__PONCHO__!.teleport(x, y);
    window.__PONCHO__!.step(2);
  }, item);
  expect(await api(page, () => window.__PONCHO__!.power())).toBe('taco');
  expect(await api(page, () => window.__PONCHO__!.itemsDrawn())).toEqual([]);
});

test('GDD-PWR-05 losing a life closes the piñata again', async ({ page }) => {
  await boot(page);
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 10);
  await bumpIt(page);
  await page.evaluate(() => {
    window.__PONCHO__!.teleport(248, 150); // into the pit
    window.__PONCHO__!.step(140);
  });
  expect(await api(page, () => window.__PONCHO__!.phase())).toBe('playing');
  expect(await api(page, () => window.__PONCHO__!.pinatasDrawn())).toEqual([false, false]);
  expect(await api(page, () => window.__PONCHO__!.itemsDrawn())).toEqual([]);
});
