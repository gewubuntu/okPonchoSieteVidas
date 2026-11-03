import { expect, test, type Page } from '@playwright/test';
import { boot, openGame, resultsRowCentre, waitForResults } from './helpers';

// GDD-WLD-08: level 1-2, opened by its address, its camera at the right edge (GDD-UI-04), its clear screen (GDD-UI-02), and the way
// in from 1-1's clear screen. Things are timed in simulation steps (`phaseSince()`, `ticks()`), never by polling (L-042).
const api = <T>(page: Page, fn: () => T) => page.evaluate(fn);

test('GDD-UI-02 level=1-2 opens 1-2 on the title screen and Start plays it', async ({ page }) => {
  const errors = await openGame(page, '/?level=1-2');
  expect(await api(page, () => window.__PONCHO__!.level())).toBe('1-2');
  expect((await api(page, () => window.__PONCHO__!.titleDrawn())).shown).toBe(true);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => !window.__PONCHO__!.titleDrawn().shown && window.__PONCHO__!.ticks() > 5);
  expect(await api(page, () => window.__PONCHO__!.hilos())).toMatchObject({ taken: 0, total: 50 });
  expect(await api(page, () => window.__PONCHO__!.exitDrawn())).toBe(true);
  expect(await api(page, () => window.__PONCHO__!.veladoraDrawn())).toBe(true);
  // A real level: no placeholder lines and no tips.
  expect(await api(page, () => window.__PONCHO__!.placeholderLines())).toBe(false);
  expect(errors).toEqual([]);
});

test('GDD-UI-04 1-2 the camera stops at the right edge, 2400 px in', async ({ page }) => {
  await boot(page, '/?level=1-2');
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 5);
  await page.evaluate(() => window.__PONCHO__!.pause(true));
  await page.evaluate(() => window.__PONCHO__!.teleport(2860, 224));
  await page.evaluate(() => window.__PONCHO__!.step(1));
  await page.waitForFunction(() => window.__PONCHO__!.camera().viewX === 2400 && window.__PONCHO__!.camera().scrollX === 2400);
});

test('GDD-UI-02 the results menu of 1-2 opens on Next level, which starts 1-3', async ({ page, isMobile }) => {
  await boot(page, '/?level=1-2');
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 5);
  await page.evaluate(() => window.__PONCHO__!.teleport(2780, 224));
  await page.waitForFunction(() => window.__PONCHO__!.phase() === 'clear');
  await waitForResults(page);
  // 1-2 names 1-3: "Next level" is chosen when the menu opens.
  expect((await api(page, () => window.__PONCHO__!.clearDrawn())).menu).toMatchObject({ shown: true, items: ['Next level', 'Retry', 'Quit to title'], chosen: 'next', colors: ['#fff3dc', '#9ba3c4', '#9ba3c4'] });
  const row = await resultsRowCentre(page, 'next');
  if (isMobile) await page.touchscreen.tap(row.x, row.y);
  else await page.mouse.click(row.x, row.y);
  await page.waitForFunction(() => window.__PONCHO__!.level() === '1-3' && window.__PONCHO__!.phase() === 'playing' && window.__PONCHO__!.ticks() > 2);
  expect(await api(page, () => window.__PONCHO__!.lives())).toBe(7);
  expect((await api(page, () => window.__PONCHO__!.camera())).viewX).toBe(0);
  expect(await api(page, () => window.__PONCHO__!.hilos())).toMatchObject({ taken: 0, total: 50 });
});

test('GDD-WLD-08 1-1 leads on to 1-2, which plays, pauses and quits like any level, with no error', async ({ page }) => {
  const errors = await boot(page, '/?level=1-1');
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 5);
  await page.evaluate(() => window.__PONCHO__!.teleport(2780, 224));
  await waitForResults(page);
  await page.keyboard.press('ArrowRight', { delay: 30 }); // no pick: the clear screen waits
  expect(await api(page, () => window.__PONCHO__!.phase())).toBe('clear');
  await page.keyboard.press('Enter'); // picks Next level
  await page.waitForFunction(() => window.__PONCHO__!.level() === '1-2' && window.__PONCHO__!.ticks() > 10);
  // Holding right runs into the level and collects the first hilos.
  await page.keyboard.down('ArrowRight');
  await page.waitForFunction(() => window.__PONCHO__!.hilos().taken >= 1 && window.__PONCHO__!.hudHilos().text === `${window.__PONCHO__!.hilos().taken}/50`);
  await page.keyboard.up('ArrowRight');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.__PONCHO__!.playerPause().paused);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !window.__PONCHO__!.playerPause().paused);
  // Quit to title: the title over the level "Start" plays, which the address ?level=1-1 makes 1-1 (without it, 1-1 being cleared, 1-2).
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.__PONCHO__!.playerPause().paused);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter', { delay: 30 });
  await page.waitForFunction(() => window.__PONCHO__!.level() === '1-1' && window.__PONCHO__!.titleDrawn().shown);
  expect(errors).toEqual([]);
});
