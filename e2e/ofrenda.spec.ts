import { expect, test, type Page } from '@playwright/test';
import { boot, passGameOver } from './helpers';

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

test('GDD-LIFE-02 after a pit fall Poncho respawns at the latest ofrenda reached', async ({ page }) => {
  await boot(page);
  await touch(page, 312);
  await page.waitForFunction(() => window.__PONCHO__!.ofrendas()[1]!.used);
  expect(await api(page, () => window.__PONCHO__!.checkpoint())).toMatchObject({ x: 312, y: 224 });
  await page.evaluate(() => window.__PONCHO__!.teleport(248, 150)); // above the pit
  await page.waitForFunction(() => window.__PONCHO__!.lives() === 6);
  await page.waitForFunction(() => window.__PONCHO__!.phase() === 'playing');
  expect(await api(page, () => window.__PONCHO__!.state())).toMatchObject({ x: 312, y: 224, grounded: true });
});

test('GDD-LIFE-03 only the latest ofrenda counts: walking back to an earlier one keeps the respawn point', async ({ page }) => {
  await boot(page);
  await touch(page, 312);
  await page.waitForFunction(() => window.__PONCHO__!.ofrendas()[1]!.used);
  await touch(page, 120); // the earlier ofrenda, for the first time
  await page.waitForFunction(() => window.__PONCHO__!.ofrendas()[0]!.used);
  expect(await api(page, () => window.__PONCHO__!.checkpoint())).toMatchObject({ x: 312, y: 224 });
  await page.evaluate(() => window.__PONCHO__!.teleport(248, 150)); // above the pit
  await page.waitForFunction(() => window.__PONCHO__!.phase() === 'respawning');
  await page.waitForFunction(() => window.__PONCHO__!.phase() === 'playing');
  expect(await api(page, () => window.__PONCHO__!.state())).toMatchObject({ x: 312, y: 224, grounded: true });
});

test('GDD-LIFE-05 losing the last life puts the ofrendas back and restarts at the level start', async ({ page }) => {
  await boot(page);
  await touch(page, 120);
  await page.waitForFunction(() => window.__PONCHO__!.ofrendas()[0]!.used);
  for (let i = 0; i < 6; i++) await page.evaluate(() => window.__PONCHO__!.loseLife());
  await page.evaluate(() => window.__PONCHO__!.teleport(248, 150));
  await passGameOver(page); // the Siete vidas gastadas screen first
  await page.waitForFunction(() => window.__PONCHO__!.lives() === 7 && window.__PONCHO__!.phase() === 'playing');
  expect(await api(page, () => window.__PONCHO__!.ofrendas().every((o) => !o.used))).toBe(true);
  expect(await api(page, () => window.__PONCHO__!.state())).toMatchObject({ x: 56, y: 224 });
  expect(await api(page, () => window.__PONCHO__!.checkpoint())).toMatchObject({ x: 56, y: 224 });
});

test('GDD-AUD-02 the ofrenda sound plays on the first touch of each ofrenda, not on a repeat or a restart', async ({ page }) => {
  await boot(page);
  // The other sounds (the meow, the life lost sound) share the log, so only the ofrenda ones are counted.
  const ofrendas = () => page.evaluate(() => window.__PONCHO__!.sfx().filter((s) => s === 'ofrenda'));
  expect(await api(page, () => window.__PONCHO__!.sfx())).toEqual([]);
  await touch(page, 120);
  await page.waitForFunction(() => window.__PONCHO__!.sfx().filter((s) => s === 'ofrenda').length === 1);
  await touch(page, 312);
  await page.waitForFunction(() => window.__PONCHO__!.sfx().filter((s) => s === 'ofrenda').length === 2);
  await touch(page, 120); // already used
  await page.waitForTimeout(200);
  expect(await ofrendas()).toEqual(['ofrenda', 'ofrenda']);
  for (let i = 0; i < 6; i++) await page.evaluate(() => window.__PONCHO__!.loseLife());
  await page.evaluate(() => window.__PONCHO__!.teleport(248, 150)); // lose the last life: the ofrendas reset on the restart
  await passGameOver(page);
  await page.waitForFunction(() => window.__PONCHO__!.ofrendas().every((o) => !o.used));
  await page.waitForTimeout(200);
  expect(await ofrendas()).toEqual(['ofrenda', 'ofrenda']);
});

test('GDD-AUD-02 the sound files load without errors', async ({ page }) => {
  const errors = await boot(page);
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 5);
  const loaded = await page.evaluate(() => window.__PONCHO__!.sfxLoaded());
  expect(loaded).toBe(true);
  expect(errors).toEqual([]);
});
