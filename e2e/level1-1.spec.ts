import { expect, test, type Page } from '@playwright/test';
import { boot, openGame } from './helpers';

// GDD-WLD-06: level 1-1, its camera (GDD-UI-04), its exit and the level clear screen (GDD-WLD-03, GDD-UI-02), and its veladora
// (GDD-LIFE-03). These open the game at "/", which plays 1-1; every other playtest opens the sandbox. Things are timed in
// simulation steps (`phaseSince()`, `ticks()`), never by polling (L-042).
const api = <T>(page: Page, fn: () => T) => page.evaluate(fn);
const frames = (page: Page, n = 2) => page.evaluate((k) => new Promise((r) => { let i = 0; const tick = () => (++i >= k ? r(null) : requestAnimationFrame(tick)); requestAnimationFrame(tick); }), n);

/** Plays 1-1 from the title and puts Poncho on the floor in front of the exit, which he reaches at once. */
async function atExit(page: Page): Promise<void> {
  await boot(page, '/');
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 5);
  await page.evaluate(() => window.__PONCHO__!.teleport(1400, 224));
  await page.waitForFunction(() => window.__PONCHO__!.phase() === 'clear');
}

/** Waits for the clear screen's first 1.0 s (60 steps) to be over, which is when it takes a press and shows its prompt. */
const afterLockout = (page: Page) =>
  page.waitForFunction(() => window.__PONCHO__!.ticks() - window.__PONCHO__!.phaseSince() >= 60 && window.__PONCHO__!.clearDrawn().prompt);

test('GDD-UI-02 the game opens on 1-1 and Start plays it', async ({ page }) => {
  await openGame(page, '/');
  expect(await api(page, () => window.__PONCHO__!.level())).toBe('1-1');
  expect((await api(page, () => window.__PONCHO__!.titleDrawn())).shown).toBe(true);
  expect((await api(page, () => window.__PONCHO__!.camera())).viewX).toBe(0);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => !window.__PONCHO__!.titleDrawn().shown);
  expect((await api(page, () => window.__PONCHO__!.hilos())).total).toBe(50);
  expect((await api(page, () => window.__PONCHO__!.camera())).viewX).toBe(0);
});

test('GDD-UI-02 level=sandbox plays the sandbox', async ({ page }) => {
  await openGame(page);
  expect(await api(page, () => window.__PONCHO__!.level())).toBe('sandbox');
  expect((await api(page, () => window.__PONCHO__!.hilos())).total).toBe(20);
  expect(await api(page, () => window.__PONCHO__!.exitDrawn())).toBe(false);
  expect(await api(page, () => window.__PONCHO__!.veladoraDrawn())).toBe(false);
});

test('GDD-UI-04 the camera follows Poncho and stops at the level edges', async ({ page }) => {
  await boot(page, '/');
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 5);
  await page.evaluate(() => window.__PONCHO__!.pause(true));
  // Past the spikes at columns 43 and 44, clear of every hazard: his middle is 504 px from the level start, 256 from the screen's left.
  await page.evaluate(() => window.__PONCHO__!.teleport(760, 224));
  await page.evaluate(() => window.__PONCHO__!.step(1));
  await page.waitForFunction(() => window.__PONCHO__!.camera().viewX === 504 && window.__PONCHO__!.camera().scrollX === 504);
  await page.evaluate(() => window.__PONCHO__!.teleport(1430, 224));
  await page.evaluate(() => window.__PONCHO__!.step(1));
  await page.waitForFunction(() => window.__PONCHO__!.camera().viewX === 960 && window.__PONCHO__!.camera().scrollX === 960);
  await page.evaluate(() => window.__PONCHO__!.teleport(100, 224));
  await page.evaluate(() => window.__PONCHO__!.step(1));
  await page.waitForFunction(() => window.__PONCHO__!.camera().viewX === 0 && window.__PONCHO__!.camera().scrollX === 0);
});

test('GDD-UI-04 the camera stands still while Poncho waits to respawn, then moves to the respawn point at once', async ({ page }) => {
  await boot(page, '/');
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 5);
  await page.evaluate(() => window.__PONCHO__!.pause(true));
  await page.evaluate(() => window.__PONCHO__!.teleport(872, 224)); // over the first 3-tile gap, columns 53 to 55
  await page.evaluate(() => window.__PONCHO__!.step(1));
  await page.waitForFunction(() => window.__PONCHO__!.camera().scrollX === 616);
  await page.evaluate(() => window.__PONCHO__!.teleport(872, 306)); // his whole body below the level: a lost life
  await page.evaluate(() => window.__PONCHO__!.step(21));
  expect(await api(page, () => window.__PONCHO__!.phase())).toBe('respawning');
  expect(await api(page, () => window.__PONCHO__!.bodyVisible())).toBe(false);
  await page.waitForFunction(() => window.__PONCHO__!.camera().viewX === 616 && window.__PONCHO__!.camera().scrollX === 616);
  await page.evaluate(() => window.__PONCHO__!.step(28));
  expect(await api(page, () => window.__PONCHO__!.phase())).toBe('playing');
  await page.waitForFunction(() => window.__PONCHO__!.camera().viewX === 0 && window.__PONCHO__!.camera().scrollX === 0);
});

test('GDD-WLD-03 reaching the exit shows the level clear screen', async ({ page }) => {
  await boot(page, '/');
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 5);
  await page.evaluate(() => window.__PONCHO__!.pause(true));
  await page.evaluate(() => window.__PONCHO__!.teleport(1400, 224));
  await page.evaluate(() => window.__PONCHO__!.step(1));
  expect(await api(page, () => window.__PONCHO__!.phase())).toBe('clear');
  expect(await api(page, () => window.__PONCHO__!.clearDrawn())).toEqual({ shown: true, title: 'Level clear!', hilos: 'Hilos 0/50', prompt: false, promptText: 'Press any button' });
  expect(await api(page, () => window.__PONCHO__!.exitDrawn())).toBe(true);
  expect(await api(page, () => window.__PONCHO__!.bodyVisible())).toBe(true);
  await api(page, () => window.__PONCHO__!.step(59));
  expect((await api(page, () => window.__PONCHO__!.clearDrawn())).prompt).toBe(false);
  await api(page, () => window.__PONCHO__!.step(1));
  expect((await api(page, () => window.__PONCHO__!.clearDrawn())).prompt).toBe(true);
});

test('GDD-UI-02 the clear screen takes a press after 1.0 s and goes back to the title over a fresh run', async ({ page }) => {
  await atExit(page);
  await page.keyboard.press('KeyX', { delay: 30 });
  expect(await api(page, () => window.__PONCHO__!.ticks() - window.__PONCHO__!.phaseSince())).toBeLessThan(50); // it was pressed in the first second
  expect(await api(page, () => window.__PONCHO__!.phase())).toBe('clear');
  await afterLockout(page);
  expect((await api(page, () => window.__PONCHO__!.clearDrawn())).promptText).toBe('Press any button');
  await page.keyboard.down('KeyX');
  await page.waitForFunction(() => window.__PONCHO__!.titleDrawn().shown);
  await page.waitForFunction(() => window.__PONCHO__!.phase() === 'playing' && !window.__PONCHO__!.clearDrawn().shown && window.__PONCHO__!.camera().viewX === 0);
  expect(await api(page, () => window.__PONCHO__!.lives())).toBe(7);
  expect((await api(page, () => window.__PONCHO__!.hilos())).taken).toBe(0);
  // The claw press that left counts as held on the title; letting go of it is no press, so the title stays.
  await page.keyboard.up('KeyX');
  await frames(page, 10);
  expect((await api(page, () => window.__PONCHO__!.titleDrawn())).shown).toBe(true);
});

test('GDD-LIFE-03 the veladora on its ledge restores a life and stays used after a lost life', async ({ page }) => {
  await boot(page, '/');
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 5);
  expect(await api(page, () => window.__PONCHO__!.veladoraDrawn())).toBe(true);
  await page.evaluate(() => window.__PONCHO__!.loseLife()); // the hook changes the lives only
  await page.waitForFunction(() => window.__PONCHO__!.lives() === 6);
  await page.evaluate(() => window.__PONCHO__!.teleport(1128, 112));
  await page.waitForFunction(() => window.__PONCHO__!.lives() === 7 && !window.__PONCHO__!.veladoraDrawn());
  await page.evaluate(() => window.__PONCHO__!.loseLife());
  const since = await api(page, () => window.__PONCHO__!.ticks());
  await page.waitForFunction((s) => window.__PONCHO__!.ticks() >= s + 20, since);
  expect(await api(page, () => window.__PONCHO__!.lives())).toBe(6);
  expect(await api(page, () => window.__PONCHO__!.veladoraDrawn())).toBe(false);
});

test('GDD-UI-02 a tap on the touch Jump button ends the clear screen', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'touch device only');
  await atExit(page);
  await afterLockout(page);
  const b = (await api(page, () => window.__PONCHO__!.touch())).buttons.find((x) => x.id === 'jump')!;
  const box = (await page.locator('canvas').boundingBox())!;
  const k = box.width / 480;
  await page.touchscreen.tap(box.x + (b.x + b.w / 2) * k, box.y + (b.y + b.h / 2) * k);
  await page.waitForFunction(() => window.__PONCHO__!.titleDrawn().shown);
});
