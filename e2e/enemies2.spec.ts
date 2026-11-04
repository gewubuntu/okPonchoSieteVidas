import { expect, test, type Page } from '@playwright/test';
import { boot } from './helpers';

// GDD-ENM-03: World 2's enemies in lab-2e (`?level=lab-2e`), a 60-tile test level with three pens: a Paloma starting at x = 200, a Chapulín
// at x = 472 and a Trompo at x = 760, each on the floor (y = 224). Not run by the stream that wrote it: port 4173 is shared between
// worktrees, so it runs after the merge.
const start = async (page: Page) => {
  await boot(page, '/?level=lab-2e');
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 2);
  await page.evaluate(() => window.__PONCHO__!.pause(true));
};
type Input = { move: number; jumpHeld: boolean; claw?: boolean };
const step = (page: Page, n: number, input: Input = { move: 0, jumpHeld: false }) => page.evaluate(({ k, i }) => window.__PONCHO__!.step(k, i), { k: n, i: input });
const enemy = async (page: Page, i: number) => (await page.evaluate(() => window.__PONCHO__!.enemies()))[i]!;
const frames = (page: Page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null)))));

test('GDD-ENM-03 lab-2e paints a Paloma, a Chapulín and a Trompo where they are', async ({ page }) => {
  await start(page);
  await step(page, 30);
  await frames(page);
  const drawn = await page.evaluate(() => window.__PONCHO__!.enemiesDrawn());
  expect(drawn.map((d) => d.kind)).toEqual(['paloma', 'chapulin', 'trompo']);
  for (let i = 0; i < 3; i++) {
    const e = await enemy(page, i);
    expect(drawn[i]!.x).toBeCloseTo(e.x, 6);
  }
});

test('GDD-ENM-03 the Paloma telegraphs when Poncho comes close, then flies up', async ({ page }) => {
  await start(page);
  const { x } = await enemy(page, 0);
  await page.evaluate((px) => window.__PONCHO__!.teleport(px - 30, 224), x);
  await step(page, 1);
  expect((await enemy(page, 0)).phase).toBe('telegraph');
  await step(page, 30);
  expect((await enemy(page, 0)).phase).toBe('rise');
});

test('GDD-ENM-03 and GDD-CMB-02 the claw stuns the Trompo, and a stomp then defeats it', async ({ page }) => {
  await start(page);
  // Wait until it heads back left, then stand 28 px to its left, facing it, and swipe.
  for (let i = 0; i < 600 && (await enemy(page, 2)).dir > 0; i++) await step(page, 5);
  const { x } = await enemy(page, 2);
  await page.evaluate((tx) => window.__PONCHO__!.teleport(tx - 28, 224), x);
  await step(page, 1, { move: 1, jumpHeld: false });
  await step(page, 3, { move: 0, jumpHeld: false, claw: true });
  expect((await enemy(page, 2)).phase).toBe('stunned');
  for (let i = 0; i < 60 && (await enemy(page, 2)).alive; i++) await step(page, 1, { move: 1, jumpHeld: i < 4 });
  expect((await enemy(page, 2)).alive).toBe(false);
});
