import { expect, test } from '@playwright/test';
import { boot, pixelsAt, red } from './helpers';

test('GDD-UI-01 the HUD starts with seven filled triangles', async ({ page }) => {
  const errors = await boot(page);
  expect(await page.evaluate(() => window.__PONCHO__!.lives())).toBe(7);
  expect(await page.evaluate(() => window.__PONCHO__!.hudFilled())).toBe(7);
  expect(errors).toEqual([]);
});

test('GDD-UI-01 and GDD-LIFE-02 losing lives empties the HUD one triangle at a time, never below zero', async ({ page }) => {
  await boot(page);
  const hud = () => page.evaluate(() => window.__PONCHO__!.hudFilled());
  for (let expected = 6; expected >= 0; expected--) {
    await page.evaluate(() => window.__PONCHO__!.loseLife());
    expect(await hud()).toBe(expected);
  }
  await page.evaluate(() => window.__PONCHO__!.loseLife());
  expect(await hud()).toBe(0);
});

test('GDD-UI-01 and GDD-LIFE-03 an ofrenda refills one triangle, once', async ({ page }) => {
  await boot(page);
  const hud = () => page.evaluate(() => window.__PONCHO__!.hudFilled());
  for (let i = 0; i < 3; i++) await page.evaluate(() => window.__PONCHO__!.loseLife());
  expect(await hud()).toBe(4);
  await page.evaluate(() => window.__PONCHO__!.activateOfrenda('a'));
  expect(await hud()).toBe(5);
  await page.evaluate(() => window.__PONCHO__!.activateOfrenda('a'));
  expect(await hud()).toBe(5);
});

test('GDD-UI-01 each tap of the dev key L loses exactly one life', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard test');
  await boot(page);
  // A real tap lasts well over one frame. Playwright's instant press() can start and end inside one frame,
  // which key polling cannot see (see docs/LESSONS.md L-006), so hold each key for 80 ms.
  for (let i = 0; i < 3; i++) {
    await page.keyboard.down('l');
    await page.waitForTimeout(80);
    await page.keyboard.up('l');
    await page.waitForTimeout(80);
  }
  expect(await page.evaluate(() => window.__PONCHO__!.hudFilled())).toBe(4);
});

test('GDD-LIFE-02 a lost life cracks and fades on the HUD for 0.4 s, then stays an outline', async ({ page }) => {
  await boot(page);
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 5);
  expect(await page.evaluate(() => window.__PONCHO__!.hudCracking())).toEqual([]);
  const start = await page.evaluate(() => {
    window.__PONCHO__!.loseLife();
    return window.__PONCHO__!.ticks();
  });
  // Cracking now: the lost triangle (the rightmost, index 6) is not counted as filled, and its fill is still showing.
  const first = await page.evaluate(() => ({ cracking: window.__PONCHO__!.hudCracking(), filled: window.__PONCHO__!.hudFilled() }));
  expect(first.filled).toBe(6);
  expect(first.cracking).toHaveLength(1);
  expect(first.cracking[0]).toMatchObject({ index: 6 });
  expect(first.cracking[0]!.fillAlpha).toBeGreaterThan(0.5);
  // Later in the animation the fill has faded, and the crack was seen at some point.
  const seen: number[] = [];
  for (let i = 0; i < 30; i++) {
    const c = await page.evaluate(() => window.__PONCHO__!.hudCracking());
    if (c[0]) seen.push(c[0].crackAlpha);
    await page.waitForTimeout(10);
  }
  expect(Math.max(...seen)).toBeGreaterThan(0.5);
  // After 24 steps it is over: nothing cracking, still six filled.
  await page.waitForFunction((s) => window.__PONCHO__!.ticks() >= s + 26, start);
  expect(await page.evaluate(() => window.__PONCHO__!.hudCracking())).toEqual([]);
  expect(await page.evaluate(() => window.__PONCHO__!.hudFilled())).toBe(6);
});

test('GDD-LIFE-02 a pit fall cracks the lost triangle, and a refilled triangle does not crack', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => window.__PONCHO__!.teleport(248, 150)); // above the pit
  await page.waitForFunction(() => window.__PONCHO__!.lives() === 6);
  expect((await page.evaluate(() => window.__PONCHO__!.hudCracking()))[0]).toMatchObject({ index: 6 });
  await page.evaluate(() => window.__PONCHO__!.activateOfrenda('a')); // refills it at once
  expect(await page.evaluate(() => window.__PONCHO__!.hudCracking())).toEqual([]);
  expect(await page.evaluate(() => window.__PONCHO__!.hudFilled())).toBe(7);
});

test('GDD-LIFE-02 the HUD really draws the fade and the crack: red fill, then a crack line, then no fill', async ({ page }) => {
  await boot(page);
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 5);
  await page.evaluate(() => {
    window.__PONCHO__!.pause(true);
    window.__PONCHO__!.loseLife(); // the seventh triangle (index 6) cracks; it spans x 86 to 96, y 8 to 17 in virtual px
  });
  // A spot in the fill away from the crack, and a spot on the crack line (the middle of its second segment).
  const fill = { x: 93, y: 15.5 };
  const crack = { x: 90.9, y: 12.3 };

  const [start] = await pixelsAt(page, [fill]);
  expect(red(start!)).toBeGreaterThan(90); // step 0: the full red fill is drawn

  await page.evaluate(() => window.__PONCHO__!.step(5));
  const [early, earlyCrack] = await pixelsAt(page, [fill, crack]);
  expect(earlyCrack!.g).toBeGreaterThan(150); // step 5: the pale crack line is drawn across the fill
  expect(red(early!)).toBeLessThan(red(start!)); // and the fill has started to fade

  await page.evaluate(() => window.__PONCHO__!.step(7));
  const [middle] = await pixelsAt(page, [fill]);
  expect(red(middle!)).toBeLessThan(red(early!)); // step 12: about half faded, so it is between full and gone
  expect(red(middle!)).toBeGreaterThan(20);

  await page.evaluate(() => window.__PONCHO__!.step(12));
  const [done, doneCrack] = await pixelsAt(page, [fill, crack]);
  expect(red(done!)).toBeLessThan(20); // step 24: the fill is gone, only the outline of a lost life is left
  expect(doneCrack!.g).toBeLessThan(120); // and the crack line is gone too
});
