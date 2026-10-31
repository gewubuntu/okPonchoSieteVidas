import { expect, test, type Page } from '@playwright/test';
import { boot, waitForResults } from './helpers';

const api = <T>(page: Page, fn: () => T) => page.evaluate(fn);
const sfx = (page: Page) => page.evaluate(() => window.__PONCHO__!.sfx());

// The sandbox spawn is the middle of tile column 3 on the floor (x = 56, y = 224). Its first two hilos are on the floor in tile
// columns 4 and 6 (x 72 and 104), 32 px apart: about a quarter of a second at a run.
const start = async (page: Page) => {
  await boot(page);
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 10);
};

test('GDD-AUD-02 a jump plays jump, then land on touchdown', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard test');
  await start(page);
  expect(await sfx(page)).toEqual([]);
  await page.keyboard.press('Space', { delay: 60 });
  await page.waitForFunction(() => window.__PONCHO__!.sfx().includes('land'));
  expect(await sfx(page)).toEqual(['jump', 'land']);
});

test('GDD-AUD-02 a claw swing plays claw', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard test');
  await start(page);
  await page.keyboard.press('KeyX', { delay: 60 });
  await page.waitForFunction(() => window.__PONCHO__!.sfx().includes('claw'));
  await page.waitForTimeout(300);
  expect(await sfx(page)).toEqual(['claw']);
});

test('GDD-AUD-02 a fall into a pit plays lifeLost, then the meow when Poncho flips back in', async ({ page }) => {
  await start(page);
  await page.evaluate(() => window.__PONCHO__!.teleport(248, 150)); // above the pit
  await page.waitForFunction(() => window.__PONCHO__!.lives() === 6);
  expect(await sfx(page)).toContain('lifeLost');
  expect(await sfx(page)).not.toContain('meow'); // he is still hidden
  await page.waitForFunction(() => window.__PONCHO__!.phase() === 'playing');
  expect((await sfx(page)).filter((s) => s === 'lifeLost' || s === 'meow')).toEqual(['lifeLost', 'meow']);
});

test('GDD-AUD-02 hilos play rising notes', async ({ page }) => {
  await start(page);
  await page.evaluate(() => {
    window.__PONCHO__!.pause(true);
    window.__PONCHO__!.teleport(56, 224);
    window.__PONCHO__!.step(2);
  });
  // Run right, one step at a time, until the second hilo (x 104) is taken.
  await page.evaluate(() => {
    for (let i = 0; i < 80 && window.__PONCHO__!.hilos().taken < 2; i++) window.__PONCHO__!.step(1, { move: 1, jumpHeld: false });
  });
  expect(await api(page, () => window.__PONCHO__!.hilos().taken)).toBe(2);
  expect((await sfx(page)).filter((s) => s.startsWith('hilo'))).toEqual(['hilo:0', 'hilo:2']);
  // The rates the audio system was given: the root, then a whole tone up (2^(2/12)).
  const rates = (await api(page, () => window.__PONCHO__!.sfxPlayed())).filter((p) => p.key === 'sfx-hilo').map((p) => p.rate);
  expect(rates).toHaveLength(2);
  expect(rates[0]).toBe(1);
  expect(rates[1]).toBeCloseTo(1.122462, 5);
  // At the default settings (Master 10, Effects 10, GDD-UI-02) every sound plays at full volume (GDD-AUD-01).
  const played = await api(page, () => window.__PONCHO__!.sfxPlayed());
  expect(played.length).toBeGreaterThan(0);
  expect(played.every((p) => p.volume === 1)).toBe(true);
});

test('GDD-AUD-02 the clear screen ticks once per line', async ({ page }) => {
  await boot(page, '/');
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 5);
  await page.evaluate(() => window.__PONCHO__!.teleport(1400, 224));
  await page.waitForFunction(() => window.__PONCHO__!.phase() === 'clear');
  await waitForResults(page);
  // The hilo, time and medal lines each ticked, and nothing else played: three ticks, at Master times Effects (1 at the defaults).
  const ticks = (await api(page, () => window.__PONCHO__!.sfxPlayed())).filter((p) => p.key === 'sfx-tick');
  expect(ticks).toHaveLength(3);
  for (const t of ticks) expect(t).toEqual({ key: 'sfx-tick', rate: 1, volume: 1 });
});
