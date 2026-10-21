import { expect, test, type Page } from '@playwright/test';
import { boot, pixelsAt } from './helpers';

const api = <T>(page: Page, fn: () => T) => page.evaluate(fn);
const frames = (page: Page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null)))));

// The sandbox level has a piñata at tile column 23, row 8 (x 368 to 384, underside y = 144) above the 3-tile wall at columns
// 22 and 23 (top y = 176). Poncho in Taco bumps it from the wall top and a chile comes out.
const start = async (page: Page, x: number, y: number) => {
  await boot(page);
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 10);
  await page.evaluate(
    ({ px, py }) => {
      window.__PONCHO__!.pause(true);
      window.__PONCHO__!.teleport(px, py);
      window.__PONCHO__!.step(2);
    },
    { px: x, py: y },
  );
};

test('GDD-PWR-03 a piñata bumped in Taco releases a chile that stays put, and eating it makes Poncho Fuego', async ({ page }) => {
  await start(page, 372, 176);
  await page.evaluate(() => window.__PONCHO__!.setPower('taco'));
  await page.evaluate(() => window.__PONCHO__!.step(25, { move: 0, jumpHeld: true }));
  const items = await api(page, () => window.__PONCHO__!.itemsDrawn());
  expect(items).toHaveLength(1);
  expect(items[0]).toMatchObject({ kind: 'chile', y: 128 }); // on top of the piñata (row 8, top y = 128)
  const { x } = items[0]!;
  await page.evaluate(() => window.__PONCHO__!.step(20));
  expect((await api(page, () => window.__PONCHO__!.itemsDrawn()))[0]!.x).toBe(x); // a chile does not walk
  await page.evaluate(({ cx, cy }) => {
    window.__PONCHO__!.teleport(cx, cy);
    window.__PONCHO__!.step(2);
  }, { cx: x, cy: 128 });
  await frames(page);
  expect(await api(page, () => window.__PONCHO__!.power())).toBe('fuego');
  expect(await api(page, () => window.__PONCHO__!.itemsDrawn())).toEqual([]);
  expect(await api(page, () => window.__PONCHO__!.heldPowerDrawn())).toBe('fuego');
  expect(await api(page, () => window.__PONCHO__!.hudPowerDrawn())).toBe('fuego');
});

test('GDD-PWR-03 a Fuego press spits a fireball that flies, bounces and is drawn where it is', async ({ page }) => {
  await start(page, 300, 224); // open floor between the pit and the spikes: nothing in the way of the first few px
  await page.evaluate(() => window.__PONCHO__!.setPower('fuego'));
  await page.evaluate(() => window.__PONCHO__!.step(1, { move: 0, jumpHeld: false, fuego: true }));
  await page.evaluate(() => window.__PONCHO__!.step(4));
  await frames(page);
  expect(await api(page, () => window.__PONCHO__!.fireballs())).toBe(1);
  await page.waitForFunction(() => window.__PONCHO__!.fireballsDrawn() === 1);
  const [f] = await api(page, () => window.__PONCHO__!.fireballAt());
  expect(f!.x).toBeGreaterThan(300 + 9);
  const [core] = await pixelsAt(page, [{ x: f!.x, y: f!.y - 3 }]);
  expect(core!.r).toBeGreaterThan(200); // the yellow core, 255 226 122
  expect(core!.g).toBeGreaterThan(170);
  expect(core!.b).toBeLessThan(170);
});

test('GDD-PWR-03 only in Fuego: a press in Taco spits nothing', async ({ page }) => {
  await start(page, 120, 224);
  await page.evaluate(() => window.__PONCHO__!.setPower('taco'));
  await page.evaluate(() => window.__PONCHO__!.step(3, { move: 0, jumpHeld: false, fuego: true }));
  expect(await api(page, () => window.__PONCHO__!.fireballs())).toBe(0);
});

type Colour = { r: number; g: number; b: number };
const red = (c: Colour) => c.r > 170 && c.g < 90 && c.b < 80; // the chile's red, 209 40 28
/** A few points around a spot, so a pixel that lands on an edge of a small shape still finds it. */
const around = (x: number, y: number) => [-1, 0, 1].flatMap((dx) => [-1, 0, 1].map((dy) => ({ x: x + dx, y: y + dy })));
const anyRed = async (page: Page, x: number, y: number) => (await pixelsAt(page, around(x, y))).some(red);

test('GDD-PWR-03 the chile is painted: on the piñata, in Poncho\'s hand in Fuego (not in Taco), and on the HUD', async ({ page }) => {
  await start(page, 372, 176);
  await page.evaluate(() => window.__PONCHO__!.setPower('taco'));
  await page.evaluate(() => window.__PONCHO__!.step(25, { move: 0, jumpHeld: true }));
  await frames(page);
  const chile = (await api(page, () => window.__PONCHO__!.itemsDrawn()))[0]!;
  expect(await anyRed(page, chile.x + 1, chile.y - 6)).toBe(true); // the pepper's body, in the middle of its 12 px box
  // Poncho in the empty sky: the chile in his hand sits 12 px out and 11 px up from his feet, facing right.
  await page.evaluate(() => {
    window.__PONCHO__!.teleport(300, 100);
    window.__PONCHO__!.step(2);
  });
  await frames(page);
  const { x, y } = await api(page, () => window.__PONCHO__!.state());
  expect(await anyRed(page, x + 12.5, y - 11.5)).toBe(false); // Taco: a taco, no chile
  await page.evaluate(() => window.__PONCHO__!.setPower('fuego'));
  await frames(page);
  expect(await anyRed(page, x + 12.5, y - 11.5)).toBe(true);
  expect(await anyRed(page, 8 + 7 * 13 + 6 + 13 * 0.55 + 1, 8 + 3 - 13 * 0.35)).toBe(true); // the HUD icon, right of the triangles
});

test('GDD-CTL-03 the Fuego button has its flame drawn', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'touch device only');
  await boot(page);
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 10);
  await page.evaluate(() => window.__PONCHO__!.setPower('fuego'));
  await page.waitForFunction(() => window.__PONCHO__!.touch().buttons.some((b) => b.id === 'fuego'));
  await frames(page);
  const b = (await api(page, () => window.__PONCHO__!.touch())).buttons.find((x) => x.id === 'fuego')!;
  const [flame] = await pixelsAt(page, [{ x: b.x + b.w / 2, y: b.y + b.h / 2 + b.w * 0.08 }]);
  expect(flame!.r - flame!.b).toBeGreaterThan(70); // orange over the dark button, not the dark button itself
});
