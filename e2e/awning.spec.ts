import { expect, test } from '@playwright/test';
import { boot } from './helpers';

// The Mercado lab (src/levels/lab2m.ts): the ladder awning over columns 5 to 8 (x 80 to 144, top y = 176), the tower at columns 10 to 12
// (top y = 64), the torn awning over columns 15 to 17 (x 240 to 288), the rollo across the pit at columns 27 to 32 (x 432 to 528, line
// y = 216). Times are in simulation steps (L-042): every test pauses and steps the game itself.
const LAB = '/?level=lab-2m';

test('GDD-WLD-10 holding jump on the awning climbs the ladder 480, 540, 600 and the cloth sags 2, 4, 6 px', async ({ page }) => {
  await boot(page, LAB);
  const seen = await page.evaluate(() => {
    const g = window.__PONCHO__!;
    g.pause(true);
    g.teleport(112, 144);
    const out: { vy: number; sag: number }[] = [];
    let last = g.market().bounce;
    for (let i = 0; i < 300 && out.length < 3; i++) {
      g.step(1, { move: 0, jumpHeld: true });
      const m = g.market();
      if (m.bounce !== null && m.bounce.at !== last?.at) out.push({ vy: g.state().vy, sag: m.awnings[0]!.sag });
      last = m.bounce;
    }
    return out;
  });
  expect(seen).toEqual([
    { vy: -480, sag: 2 },
    { vy: -540, sag: 4 },
    { vy: -600, sag: 6 },
  ]);
});

test('GDD-WLD-10 a held rebound plays the jump sound a step higher per tier', async ({ page }) => {
  await boot(page, LAB);
  await page.keyboard.press('ArrowRight'); // unlocks the audio (GDD-AUD-01)
  const rates = await page.evaluate(() => {
    const g = window.__PONCHO__!;
    g.pause(true);
    g.teleport(112, 144);
    const before = g.sfxPlayed().length;
    g.step(240, { move: 0, jumpHeld: true });
    return g.sfxPlayed().slice(before).filter((s) => s.key === 'sfx-jump').map((s) => s.rate);
  });
  expect(rates.slice(0, 3).map((r) => Math.round(Math.log2(r) * 12))).toEqual([0, 2, 4]);
});

test('GDD-WLD-10 the torn awning bounces him once, is drawn torn apart, and he falls through it', async ({ page }) => {
  await boot(page, LAB);
  const result = await page.evaluate(() => {
    const g = window.__PONCHO__!;
    g.pause(true);
    g.teleport(264, 160);
    let gone = false;
    for (let i = 0; i < 120 && !gone; i++) {
      g.step(1);
      gone = g.market().awnings[1]!.gone;
    }
    g.step(60);
    return { gone, drawn: g.market().awnings[1]!.gone, y: g.state().y };
  });
  expect(result).toEqual({ gone: true, drawn: true, y: 224 });
});

test('GDD-WLD-11 a claw swipe unrolls the rollo into a bridge he crosses', async ({ page }) => {
  await boot(page, LAB);
  const result = await page.evaluate(() => {
    const g = window.__PONCHO__!;
    g.pause(true);
    g.teleport(424, 224);
    g.step(10);
    const rolled = g.market().rollos[0]!.bundle;
    g.step(1, { move: 0, jumpHeld: false, claw: true });
    g.step(2, { move: 1, jumpHeld: false });
    g.step(17, { move: 1, jumpHeld: true });
    g.step(120, { move: 1, jumpHeld: false });
    return { rolled, unrolled: g.market().unrolled[0], bundle: g.market().rollos[0]!.bundle, x: g.state().x, lives: g.lives() };
  });
  expect(result.rolled).not.toBeNull();
  expect(result.unrolled).not.toBeNull();
  expect(result.bundle).toBeNull(); // strung to its full length
  expect(result.x).toBeGreaterThan(528);
  expect(result.lives).toBe(7);
});
