import { expect, test, type Page } from '@playwright/test';
import { boot } from './helpers';

const api = <T>(page: Page, fn: () => T) => page.evaluate(fn);

// The sandbox level has two spikes on the floor at x 320 to 352 (tile columns 20 and 21).
test('GDD-WLD-05 landing on the spikes costs one life, then Poncho respawns at the start with invulnerability', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => window.__PONCHO__!.teleport(336, 190));
  await page.waitForFunction(() => window.__PONCHO__!.lives() === 6);
  expect(await api(page, () => window.__PONCHO__!.hudFilled())).toBe(6);
  await page.waitForFunction(() => window.__PONCHO__!.phase() === 'playing');
  expect(await api(page, () => window.__PONCHO__!.state())).toMatchObject({ x: 56, y: 224, grounded: true });
  expect(await api(page, () => window.__PONCHO__!.invulnerable())).toBeGreaterThan(0);
  expect(await api(page, () => window.__PONCHO__!.lives())).toBe(6);
});

test('GDD-CMB-03 spikes do not hurt while Poncho is invulnerable', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => window.__PONCHO__!.teleport(248, 150)); // fall into the pit to get 2 s of invulnerability
  await page.waitForFunction(() => window.__PONCHO__!.lives() === 6 && window.__PONCHO__!.phase() === 'playing');
  await page.evaluate(() => window.__PONCHO__!.teleport(336, 190));
  await page.waitForFunction(() => window.__PONCHO__!.state().grounded);
  expect(await api(page, () => window.__PONCHO__!.lives())).toBe(6);
  expect(await api(page, () => window.__PONCHO__!.phase())).toBe('playing');
});

test('GDD-WLD-05 a jump from the second ofrenda over the spikes onto the wall does not cost a life', async ({ page }) => {
  await boot(page);
  // Stepped by hand with right and jump held (the keys' real presses are tested in subframe.spec.ts), so it does not depend on the frame rate.
  const reached = await page.evaluate(() => {
    const d = window.__PONCHO__!;
    d.pause(true);
    d.teleport(312, 224); // at the second ofrenda, 8 px from the spikes
    d.step(2);
    let n = 0;
    while (n < 120 && d.state().x <= 360) {
      d.step(1, { move: 1, jumpHeld: true });
      n++;
    }
    return { steps: n, x: d.state().x, lives: d.lives() };
  });
  expect(reached.x).toBeGreaterThan(360);
  expect(reached.lives).toBe(7);
});
