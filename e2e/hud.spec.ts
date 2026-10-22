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

test('GDD-LIFE-04 with one life left the last triangle pulses, drawn larger at the peak; not with two', async ({ page }) => {
  await boot(page);
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 5);
  await page.evaluate(() => window.__PONCHO__!.pause(true));
  for (let i = 0; i < 5; i++) await page.evaluate(() => window.__PONCHO__!.loseLife());
  await page.evaluate(() => window.__PONCHO__!.step(1));
  expect(await page.evaluate(() => window.__PONCHO__!.hudPulse())).toBeNull(); // two lives
  await page.evaluate(() => window.__PONCHO__!.loseLife());
  // The first triangle spans x 8 to 18, y 8 to 17; at 1.4x it reaches x 6 to 20, y 5.6 to 18.2. Count the pixels that are
  // not background in a box around it, at the smallest and the largest point of a pulse.
  const box = Array.from({ length: 16 * 18 }, (_, i) => ({ x: 4 + (i % 16), y: 4 + Math.floor(i / 16) }));
  const lit = async () => {
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null)))));
    return (await pixelsAt(page, box)).filter((c) => c.r > 70).length;
  };
  const scaleNow = () => page.evaluate(() => window.__PONCHO__!.hudPulse());
  let small = -1;
  let large = -1;
  for (let i = 0; i < 48 && (small < 0 || large < 0); i++) {
    await page.evaluate(() => window.__PONCHO__!.step(1));
    const s = await scaleNow();
    expect(s).not.toBeNull();
    if (small < 0 && s! < 1.01) small = await lit();
    if (large < 0 && s! > 1.39) large = await lit();
  }
  expect(small).toBeGreaterThan(0);
  expect(large).toBeGreaterThan(small * 1.5); // the area nearly doubles at 1.4x
});

test('GDD-LIFE-04 in real play the pulse keeps moving after the crack is over, and starts at the normal size', async ({ page }) => {
  await boot(page);
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 5);
  for (let i = 0; i < 5; i++) await page.evaluate(() => window.__PONCHO__!.loseLife());
  // Down to one: the pulse starts here, at 1.0x. Read in the same call, before the running game takes another step.
  const first = await page.evaluate(() => {
    window.__PONCHO__!.loseLife();
    return window.__PONCHO__!.hudPulse();
  });
  expect(first).toBe(1);
  // Not paused: frames run through the scene's own update, as in play. Wait past the 24-step crack, then sample.
  const start = await page.evaluate(() => window.__PONCHO__!.ticks());
  await page.waitForFunction((s) => window.__PONCHO__!.ticks() >= s + 30, start);
  const seen = new Set<number>();
  for (let i = 0; i < 20; i++) {
    seen.add(Math.round((await page.evaluate(() => window.__PONCHO__!.hudPulse()))! * 1000));
    await page.waitForTimeout(50);
  }
  expect(seen.size).toBeGreaterThan(8);
});

test('GDD-LIFE-04 a second drop to one life, after a life came back, starts the pulse at the normal size again', async ({ page }) => {
  await boot(page);
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 5);
  await page.evaluate(() => window.__PONCHO__!.pause(true));
  for (let i = 0; i < 6; i++) await page.evaluate(() => window.__PONCHO__!.loseLife());
  await page.evaluate(() => window.__PONCHO__!.step(20)); // well into the first pulse
  await page.evaluate(() => window.__PONCHO__!.activateOfrenda('a')); // back to two
  await page.evaluate(() => window.__PONCHO__!.step(1));
  expect(await page.evaluate(() => window.__PONCHO__!.hudPulse())).toBeNull();
  const again = await page.evaluate(() => {
    window.__PONCHO__!.loseLife(); // down to one again
    return window.__PONCHO__!.hudPulse();
  });
  expect(again).toBe(1);
});
