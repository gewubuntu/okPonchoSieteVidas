import { expect, test, type Page } from '@playwright/test';
import { TILE } from '../src/config/tuning';
import { LEVEL_3_3, LEVEL_3_3_AT } from '../src/levels/level3-3';
import { openGame, resultsRowCentre, stepUntil, tapAt, waitForResults } from './helpers';

// Level 3-3 "Las Cumbres" (GDD-WLD-18) in the real game, opened by its address (GDD-UI-02). Where things are is read from
// `src/levels/level3-3.ts` (L-062); time is counted in steps, the game paused and stepped in the page (L-042).
const api = <T>(page: Page, fn: () => T) => page.evaluate(fn);
const SAVE_KEY = 'poncho-siete-vidas';
/** The middle of tile column `col`, in px. */
const mid = (col: number) => col * TILE + TILE / 2;

/** Opens 3-3 by its address and starts it the device's way (a tap off the menu rows on a phone, Enter on a desktop); returns the errors seen. */
async function open(page: Page, isMobile: boolean): Promise<string[]> {
  const errors = await openGame(page, '/?level=3-3');
  if (isMobile) await tapAt(page, 240, 60, true);
  else await page.keyboard.press('Enter');
  await page.waitForFunction(() => !window.__PONCHO__!.titleDrawn().shown && window.__PONCHO__!.ticks() > 2);
  return errors;
}

/** Waits for two frames, so what a step changed is drawn (L-033). */
const frames = (page: Page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

test('GDD-WLD-18 3-3 opens at its spawn on G0, drawn as the canyon, the camera at the level\'s bottom', async ({ page, isMobile }) => {
  const errors = await open(page, isMobile);
  expect(await api(page, () => window.__PONCHO__!.level())).toBe('3-3');
  await api(page, () => {
    const d = window.__PONCHO__!;
    d.pause(true);
    for (let i = 0; i < 30 && !d.state().grounded; i++) d.step(1);
  });
  await frames(page);
  // On G0 at column 2, row 34 (GDD-WLD-18).
  expect(await api(page, () => window.__PONCHO__!.state())).toMatchObject({ grounded: true, x: LEVEL_3_3.spawn.x, y: LEVEL_3_3.spawn.y });
  expect(LEVEL_3_3.spawn).toEqual({ x: mid(2), y: LEVEL_3_3_AT.G0.row * TILE });
  // It names no place: the canyon, as 3-1 (GDD-ART-06).
  expect(await api(page, () => window.__PONCHO__!.scenery())).toEqual({ set: 'sierra', midKey: 'sierra:mid', place: 'barranca' });
  // The level is 37 rows: the camera rests at its bottom limit, 37 * 16 - 272 (`level3-3.camera.test.ts`).
  expect(await api(page, () => window.__PONCHO__!.camera().scrollY)).toBe(320);
  expect(errors).toEqual([]);
});

test("GDD-UI-02 3-3 the exit clears the level; its results menu offers Next level, which starts La Catorce's arena 3-4 with 3-3's lives carried", async ({ page, isMobile }) => {
  await open(page, isMobile);
  await api(page, () => window.__PONCHO__!.pause(true));
  // Two lives taken first by the debug hook (the count only), each followed by the respawn: 5 left, so the carry into 3-4 shows (GDD-LIFE-05).
  for (let k = 0; k < 2; k++) {
    await api(page, () => window.__PONCHO__!.loseLife());
    expect(await stepUntil(page, { phase: 'playing' }, 300)).toBeLessThan(300);
  }
  expect(await api(page, () => window.__PONCHO__!.lives())).toBe(5);
  // No enemy starts within 12 columns of the bank (the Zopilote at 189, the ringtails at 58, 178 and 197), so the walk onto the exit meets none.
  const bank = LEVEL_3_3_AT.bank;
  for (const e of LEVEL_3_3.enemies) expect(Math.abs(Math.floor(e.x / TILE) - bank.col0), `enemy at x ${e.x}`).toBeGreaterThan(12);
  // Put on the bank at its first column, right held to the exit's arch at column 234.
  const grounded = await page.evaluate(
    ([x, y]) => {
      const d = window.__PONCHO__!;
      d.teleport(x!, y! - 1);
      for (let i = 0; i < 30 && !d.state().grounded; i++) d.step(1);
      return d.state().grounded;
    },
    [mid(bank.col0), bank.row * TILE],
  );
  expect(grounded).toBe(true);
  expect(await stepUntil(page, { phase: 'clear' }, 120, { move: 1, jumpHeld: false })).toBeLessThan(120);
  expect(await api(page, () => window.__PONCHO__!.lives())).toBe(5);
  await api(page, () => window.__PONCHO__!.step(61));
  await waitForResults(page);
  // 3-3 names 3-4 (GDD-BOS-04; user, 2026-11-21: "Link 3-3 to 3-4 now"): Next level is offered and chosen.
  expect((await api(page, () => window.__PONCHO__!.clearDrawn())).menu).toMatchObject({ chosen: 'next', colors: ['#fff3dc', '#9ba3c4', '#9ba3c4'] });
  // World 3's run goes on at 3-4 with the lives at the clear.
  const progress: { worldAt: Record<string, string>; worldLives: Record<string, number> } = JSON.parse((await page.evaluate((key) => localStorage.getItem(key), SAVE_KEY))!).progress;
  expect(progress).toMatchObject({ worldAt: { '3': '3-4' }, worldLives: { '3': 5 } });
  await api(page, () => window.__PONCHO__!.pause(false));
  if (isMobile) {
    const row = await resultsRowCentre(page, 'next');
    await page.touchscreen.tap(row.x, row.y);
  } else await page.keyboard.press('Enter', { delay: 30 });
  // 3-4, a level of the same world, starts at once with them: her fight, with the boss bar.
  await page.waitForFunction(() => window.__PONCHO__!.level() === '3-4' && window.__PONCHO__!.phase() === 'playing' && window.__PONCHO__!.ticks() > 2);
  expect(await api(page, () => window.__PONCHO__!.lives())).toBe(5);
  expect((await api(page, () => window.__PONCHO__!.titleDrawn())).shown).toBe(false);
  expect(await api(page, () => window.__PONCHO__!.bossBar())).toMatchObject({ shown: true, name: 'La Catorce' });
});
