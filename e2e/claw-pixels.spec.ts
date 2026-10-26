import { expect, test, type Page } from '@playwright/test';
import { boot, pixelsAt } from './helpers';

// What the player sees, read from a real screenshot, for the claw (GDD-CMB-02) and the fragile wall (GDD-WLD-05). The
// simulation is stepped by hand while the game is paused, and the picture is left to the game's own frame loop.
const api = <T>(page: Page, fn: () => T) => page.evaluate(fn);
const frames = (page: Page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null)))));
type Colour = { r: number; g: number; b: number };
const pale = (c: Colour) => c.r > 200 && c.g > 200 && c.b > 170; // the claw's cream, 255 243 220
/** Whether two pixels are the same colour, give or take a little for the phone's scaling. */
const same = (a: Colour, b: Colour) => Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b) < 30;
/** The desert backdrop's colours that can show where a tile was taken away (GDD-ART-06): the mountains and the sky, within 12 per channel. */
const BACKDROP = ['#8E6A96', '#A65B5B', '#4D5A9C', '#3A4580', '#E39A48', '#EDB15A', '#F4C66E', '#F9DA8E'];
const backdrop = (c: Colour) => BACKDROP.some((h) => [1, 3, 5].every((i, k) => Math.abs([c.r, c.g, c.b][k]! - parseInt(h.slice(i, i + 2), 16)) <= 12));
const pink = (c: Colour) => c.r > 190 && c.g < 120 && c.b > 100; // the papel picado, 224 80 138

/** Poncho in the empty sky at (300, 100), so nothing else is drawn near him. */
const inSky = async (page: Page) => {
  await boot(page);
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 10);
  await page.evaluate(() => {
    window.__PONCHO__!.pause(true);
    window.__PONCHO__!.teleport(300, 100);
  });
};
const claw = { move: 0, jumpHeld: false, claw: true };
/** The line is 2 px wide, so on a screen that scales it a little the exact pixel can miss: look at the middle and 1 px either side. */
const around = (m: { x: number; y: number }) => [-1, 0, 1].map((d) => ({ x: m.x + d, y: m.y }));
/** How light a pixel is, as the sum of its channels. */
const light = (c: Colour) => c.r + c.g + c.b;

for (const dir of [1, -1] as const) {
  const side = dir > 0 ? 'right' : 'left';

  test(`GDD-CMB-02 the wind-up mark is drawn in front of Poncho when he faces ${side}`, async ({ page }) => {
    await inSky(page);
    await page.evaluate((d) => window.__PONCHO__!.step(1, { move: d, jumpHeld: false }), dir);
    await page.evaluate((c) => window.__PONCHO__!.step(1, c), claw);
    await frames(page);
    const x = (await api(page, () => window.__PONCHO__!.state())).x;
    const y = (await api(page, () => window.__PONCHO__!.state())).y;
    const [front, behind] = await pixelsAt(page, [
      { x: x + dir * 8, y: y - 33 }, // the mark sits 1 px above his 32 px body
      { x: x - dir * 8, y: y - 33 },
    ]);
    expect(pale(front!)).toBe(true);
    expect(pale(behind!)).toBe(false); // his hat is there now, so not the sky: the mark would show cream on it
  });

  test(`GDD-CMB-02 the swing draws three slashes across the hit box when he faces ${side}, and none behind him`, async ({ page }) => {
    await inSky(page);
    await page.evaluate((d) => window.__PONCHO__!.step(1, { move: d, jumpHeld: false }), dir);
    await page.evaluate((c) => window.__PONCHO__!.step(1, c), claw);
    await page.evaluate(() => window.__PONCHO__!.step(2));
    await frames(page);
    expect(await api(page, () => window.__PONCHO__!.clawDrawn())).toBe('swing');
    const { x, y } = await api(page, () => window.__PONCHO__!.state());
    // The box starts at the front edge of the body, 6 px out. Slash i leans 4 px and its middle is 2 px along from its top.
    const edge = x + dir * 6;
    const mids = [0, 1, 2].map((i) => ({ x: edge + dir * (3 + i * 6 + 2), y: y - 16 }));
    // Behind him only the slashes' mirror positions that lie clear of his sprite, which is 32 px wide (GDD-ART-02): 17 and 23 px out.
    const behindMids = mids.slice(1).map((m) => ({ x: x - (m.x - x), y: m.y }));
    const front = await Promise.all(mids.map(async (m) => (await pixelsAt(page, around(m))).some(pale)));
    const behind = await Promise.all(behindMids.map((m) => pixelsAt(page, around(m))));
    expect(front).toEqual([true, true, true]);
    // The swing over, the same spots show what is there without it (the sky; GDD-ART-06): nothing was drawn behind him.
    await page.evaluate(() => window.__PONCHO__!.step(30));
    await page.waitForFunction(() => window.__PONCHO__!.clawDrawn() === 'none');
    await frames(page);
    const without = await Promise.all(behindMids.map((m) => pixelsAt(page, around(m))));
    expect(behind.map((spot, i) => spot.every((c, j) => same(c, without[i]![j]!)))).toEqual([true, true]);
  });
}

test('GDD-WLD-05 a broken fragile tile disappears from the picture, and the others stay', async ({ page, isMobile }) => {
  test.skip(isMobile, 'the Jump button covers the bottom tile on a phone');
  await boot(page);
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 10);
  await page.evaluate(() => {
    window.__PONCHO__!.pause(true);
    window.__PONCHO__!.teleport(418, 224);
    window.__PONCHO__!.step(2);
  });
  await frames(page);
  // The wall is column 27 (x 432 to 448), rows 10 to 13. A point on the pink, left of the cut-out diamond, in each row.
  const rows = [10, 11, 12, 13].map((r) => ({ x: 435, y: r * 16 + 8 }));
  expect((await pixelsAt(page, rows)).map(pink)).toEqual([true, true, true, true]);
  await page.evaluate((c) => window.__PONCHO__!.step(1, c), claw);
  await page.evaluate(() => window.__PONCHO__!.step(5));
  await frames(page);
  const after = await pixelsAt(page, rows);
  expect(after.map(pink)).toEqual([true, true, false, false]); // the 32 px claw broke the bottom two tiles
  expect(backdrop(after[2]!), JSON.stringify(after[2])).toBe(true); // where they were, the backdrop shows
  expect(backdrop(after[3]!), JSON.stringify(after[3])).toBe(true);
});

test('GDD-CTL-03 the Claw button has its three claw marks drawn', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'touch device only');
  await boot(page);
  const b = (await api(page, () => window.__PONCHO__!.touch())).buttons.find((x) => x.id === 'claw')!;
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  const r = b.w * 0.28;
  const marks = await pixelsAt(page, [-0.7, 0, 0.7].map((k) => ({ x: cx + k * r, y: cy })));
  const between = await pixelsAt(page, [-0.35, 0.35].map((k) => ({ x: cx + k * r, y: cy })));
  const markAverage = marks.reduce((s, c) => s + light(c), 0) / 3;
  const betweenAverage = between.reduce((s, c) => s + light(c), 0) / 2;
  expect(markAverage).toBeGreaterThan(betweenAverage + 90);
});
