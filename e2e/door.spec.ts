import { expect, test, type Page } from '@playwright/test';
import { boot } from './helpers';

const api = <T>(page: Page, fn: () => T) => page.evaluate(fn);

// The sandbox level has a key on the floor at tile column 5 (x 80 to 96) and, further right, a door three tiles tall at
// column 8 (x 128 to 144) that the piñata above it closes off. The first ofrenda stands between them at column 7.
const runRight = (page: Page, steps: number) => page.evaluate((n) => window.__PONCHO__!.step(n, { move: 1, jumpHeld: false }), steps);
const start = async (page: Page, x: number) => {
  await boot(page);
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 10);
  await page.evaluate((px) => {
    window.__PONCHO__!.pause(true);
    window.__PONCHO__!.teleport(px, 224);
    window.__PONCHO__!.step(2);
  }, x);
};

test('GDD-WLD-05 walking over the key takes it, and the door opens for him and lets him through', async ({ page }) => {
  await start(page, 60);
  expect(await api(page, () => window.__PONCHO__!.keysDrawn())).toBe(1);
  expect(await api(page, () => window.__PONCHO__!.doorsDrawn())).toEqual([false]);
  await runRight(page, 30);
  expect(await api(page, () => window.__PONCHO__!.keysHeld())).toBe(1);
  expect(await api(page, () => window.__PONCHO__!.keysDrawn())).toBe(0);
  expect(await api(page, () => window.__PONCHO__!.hudKeys())).toBe(1);
  await runRight(page, 60);
  expect(await api(page, () => window.__PONCHO__!.doorsDrawn())).toEqual([true]);
  expect(await api(page, () => window.__PONCHO__!.keysHeld())).toBe(0);
  expect(await api(page, () => window.__PONCHO__!.hudKeys())).toBe(0);
  expect((await api(page, () => window.__PONCHO__!.state())).x).toBeGreaterThan(144);
});

test('GDD-WLD-05 without a key the door stays shut and stops him', async ({ page }) => {
  await start(page, 120);
  await runRight(page, 60);
  expect(await api(page, () => window.__PONCHO__!.doorsDrawn())).toEqual([false]);
  expect((await api(page, () => window.__PONCHO__!.state())).x).toBe(128 - 6);
});

test('GDD-WLD-05 losing a life puts the key back and shuts the door', async ({ page }) => {
  await start(page, 60);
  await runRight(page, 90);
  expect(await api(page, () => window.__PONCHO__!.doorsDrawn())).toEqual([true]);
  await page.evaluate(() => {
    window.__PONCHO__!.teleport(248, 150); // into the pit
    window.__PONCHO__!.step(140);
  });
  expect(await api(page, () => window.__PONCHO__!.phase())).toBe('playing');
  expect(await api(page, () => window.__PONCHO__!.doorsDrawn())).toEqual([false]);
  expect(await api(page, () => window.__PONCHO__!.keysDrawn())).toBe(1);
  expect(await api(page, () => window.__PONCHO__!.keysHeld())).toBe(0);
});

test('GDD-WLD-05 past the door, a short jump against the 2-tile wall lands him on its top', async ({ page }) => {
  await start(page, 60);
  await runRight(page, 90);
  expect((await api(page, () => window.__PONCHO__!.state())).x).toBe(154);
  expect(await api(page, () => window.__PONCHO__!.doorsDrawn())).toEqual([true]);
  // Time in steps (L-042): six steps of jump held, then right held until he lands on the wall top (y = 192).
  const reached = await page.evaluate(() => {
    const g = window.__PONCHO__!;
    g.step(6, { move: 1, jumpHeld: true });
    for (let i = 0; i < 40; i++) {
      g.step(1, { move: 1, jumpHeld: false });
      const s = g.state();
      if (s.grounded && s.y === 192) return { x: s.x, lives: g.lives() };
    }
    return null;
  });
  expect(reached).not.toBeNull();
  expect(reached!.x).toBeGreaterThanOrEqual(160);
  expect(reached!.x).toBeLessThanOrEqual(178);
  expect(reached!.lives).toBe(7);
});
