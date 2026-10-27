import { expect, test, type Page } from '@playwright/test';
import { boot, openGame } from './helpers';

// GDD-WLD-07: level 1-1, opened by its address, its camera at the right edge (GDD-UI-04), its clear screen (GDD-UI-02), and the way
// in from 0-1's clear screen. Things are timed in simulation steps (`phaseSince()`, `ticks()`), never by polling (L-042).
const api = <T>(page: Page, fn: () => T) => page.evaluate(fn);

test('GDD-UI-02 level=1-1 opens 1-1 on the title screen and Start plays it', async ({ page }) => {
  const errors = await openGame(page, '/?level=1-1');
  expect(await api(page, () => window.__PONCHO__!.level())).toBe('1-1');
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

test('GDD-UI-04 1-1 the camera stops at the right edge, 2400 px in', async ({ page }) => {
  await boot(page, '/?level=1-1');
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 5);
  await page.evaluate(() => window.__PONCHO__!.pause(true));
  await page.evaluate(() => window.__PONCHO__!.teleport(2860, 224));
  await page.evaluate(() => window.__PONCHO__!.step(1));
  await page.waitForFunction(() => window.__PONCHO__!.camera().viewX === 2400 && window.__PONCHO__!.camera().scrollX === 2400);
});

test('GDD-UI-02 1-1 the clear screen goes back to the title over a fresh run of 1-1', async ({ page }) => {
  await boot(page, '/?level=1-1');
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 5);
  await page.evaluate(() => window.__PONCHO__!.teleport(2780, 224));
  await page.waitForFunction(() => window.__PONCHO__!.phase() === 'clear');
  await page.waitForFunction(() => window.__PONCHO__!.ticks() - window.__PONCHO__!.phaseSince() >= 60 && window.__PONCHO__!.clearDrawn().prompt);
  await page.keyboard.press('KeyX', { delay: 30 });
  await page.waitForFunction(() => window.__PONCHO__!.titleDrawn().shown);
  expect(await api(page, () => window.__PONCHO__!.level())).toBe('1-1');
  expect(await api(page, () => window.__PONCHO__!.lives())).toBe(7);
  expect((await api(page, () => window.__PONCHO__!.camera())).viewX).toBe(0);
});

/** Plays 0-1 from the title, puts Poncho in front of its exit and waits until its clear screen takes a press. */
async function at01Clear(page: Page): Promise<string[]> {
  const errors = await boot(page, '/');
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 5);
  await page.evaluate(() => window.__PONCHO__!.teleport(1400, 224));
  await page.waitForFunction(() => window.__PONCHO__!.phase() === 'clear');
  await page.waitForFunction(() => window.__PONCHO__!.ticks() - window.__PONCHO__!.phaseSince() >= 60 && window.__PONCHO__!.clearDrawn().prompt);
  return errors;
}

test('GDD-WLD-07 0-1 leads on to 1-1, which plays and pauses like any level, with no error', async ({ page }) => {
  const errors = await at01Clear(page);
  await page.keyboard.press('Enter'); // no game button: the clear screen waits
  await page.keyboard.press('ArrowRight', { delay: 30 });
  await page.waitForFunction(() => window.__PONCHO__!.level() === '1-1' && window.__PONCHO__!.ticks() > 10);
  // Holding right runs into the level and collects the first hilos.
  await page.keyboard.down('ArrowRight');
  await page.waitForFunction(() => window.__PONCHO__!.hilos().taken >= 1 && window.__PONCHO__!.hudHilos().text === `${window.__PONCHO__!.hilos().taken}/50`);
  await page.keyboard.up('ArrowRight');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.__PONCHO__!.playerPause().paused);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !window.__PONCHO__!.playerPause().paused);
  expect(errors).toEqual([]);
});
