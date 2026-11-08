import { expect, test, type Page } from '@playwright/test';
import { PONCHO_ART } from '../src/config/tuning';
import { ponchoFrame } from '../src/ui/ponchoLooks';
import { boot, pixelsAt, readSheet, spotsIn } from './helpers';

// What the player sees, read from a real screenshot, for the claw (GDD-CMB-02) and the fragile wall (GDD-WLD-05). The
// simulation is stepped by hand while the game is paused, and the picture is left to the game's own frame loop.
const api = <T>(page: Page, fn: () => T) => page.evaluate(fn);
const frames = (page: Page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null)))));
type Colour = { r: number; g: number; b: number };
const pale = (c: Colour) => c.r > 200 && c.g > 200 && c.b > 170; // the swipe's white and cream, 236 227 217 and 251 218 183
/** Whether two pixels are the same colour, give or take a little for the phone's scaling. */
const same = (a: Colour, b: Colour) => Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b) < 30;
/** The desert backdrop's colours that can show where a tile was taken away (GDD-ART-06): the mountains, the far desert's sand and the sky, within 12 per channel. */
const BACKDROP = ['#8E6A96', '#A65B5B', '#4D5A9C', '#3A4580', '#E8B87A', '#D19A5E', '#E39A48', '#EDB15A', '#F4C66E', '#F9DA8E'];
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

// GDD-ART-04: where his wind-up frame (clawWind) is painted and the standing frame is clear, and where each swipe frame is pale (its white
// and cream), squares 1.5 and 2 game px across read from the sheets (game px from each frame's middle, facing right).
const SHEET = readSheet('poncho.png');
const WIND = spotsIn(SHEET, 48, 48, ponchoFrame('clawWind'), ['#FBDAB7', '#F1A361', '#B06948', '#070509', '#ECE3D9'], { size: 1.5, not: ponchoFrame('idle') });
const SWIPES = readSheet('poncho/swipe.png');
const PALE = (look: string) => spotsIn(SWIPES, 32, 32, ['swipe0', 'swipe1', 'swipe2', 'swipe3'].indexOf(look), ['#ECE3D9', '#FBDAB7'], { size: 2 });

for (const dir of [1, -1] as const) {
  const side = dir > 0 ? 'right' : 'left';

  test(`GDD-CMB-02 the wind-up frame is drawn, facing ${side}`, async ({ page }) => {
    await inSky(page);
    await page.evaluate((d) => window.__PONCHO__!.step(1, { move: d, jumpHeld: false }), dir);
    await page.evaluate((c) => window.__PONCHO__!.step(1, c), claw);
    await frames(page);
    const sprite = await api(page, () => window.__PONCHO__!.ponchoSprite());
    expect([sprite.look, sprite.flipX, await api(page, () => window.__PONCHO__!.clawDrawn())]).toEqual(['clawWind', dir < 0, 'windup']);
    // His frame's middle is 24 px above his feet; a spot of the wind-up's paw, arm or coiled body where the standing frame shows the sky.
    const spots = WIND.map((s) => ({ x: sprite.centerX + dir * s.dx, y: sprite.bottom - 24 + s.dy }));
    const [painted] = await pixelsAt(page, spots.slice(0, 1));
    expect(backdrop(painted!), JSON.stringify(painted)).toBe(false);
  });

  test(`GDD-CMB-02 the swing draws the swipe across the hit box when he faces ${side}, and none behind him`, async ({ page }) => {
    await inSky(page);
    await page.evaluate((d) => window.__PONCHO__!.step(1, { move: d, jumpHeld: false }), dir);
    await page.evaluate((c) => window.__PONCHO__!.step(1, c), claw);
    await page.evaluate(() => window.__PONCHO__!.step(3));
    await frames(page);
    expect(await api(page, () => window.__PONCHO__!.clawDrawn())).toBe('swing');
    const { x, y } = await api(page, () => window.__PONCHO__!.state());
    const swipe = (await api(page, () => window.__PONCHO__!.swipeDrawn()))!;
    expect(swipe.look).toBe('swipe1');
    expect(swipe.flipX).toBe(dir < 0);
    // The swipe frame's box is the claw's: from the front edge of his body, 6 px out, 20 px on, and his 32 px height (GDD-CMB-02).
    const box = { x0: Math.min(x + dir * 6, x + dir * 26), x1: Math.max(x + dir * 6, x + dir * 26), y0: y - 32, y1: y };
    const inBox = PALE(swipe.look).map((s) => ({ x: swipe.x + dir * s.dx, y: swipe.y + s.dy })).filter((m) => m.x > box.x0 + 1 && m.x < box.x1 - 1 && m.y > box.y0 + 1 && m.y < box.y1 - 1);
    // Three spots of it, spread down the swipe, and their mirror images behind him that lie clear of his drawing: past how far the swing's
    // frame reaches behind his box (PONCHO_ART.reach, GDD-ART-04), and the standing frame's after it.
    const mids = [inBox[0]!, inBox[Math.floor(inBox.length / 2)]!, inBox[inBox.length - 1]!];
    const clear = 6 + Math.max(PONCHO_ART.reach.clawSwipe.behind, PONCHO_ART.reach.idle.behind) + 1;
    const behindMids = mids.map((m) => ({ x: x - (m.x - x), y: m.y })).filter((m) => Math.abs(m.x - x) > clear);
    expect(behindMids.length).toBeGreaterThan(0);
    const front = await Promise.all(mids.map(async (m) => (await pixelsAt(page, around(m))).some(pale)));
    const behind = await Promise.all(behindMids.map((m) => pixelsAt(page, around(m))));
    expect(front).toEqual([true, true, true]);
    // The swing and its follow-through over, the same spots show what is there without it (the sky; GDD-ART-06): nothing was drawn behind him.
    await page.evaluate(() => window.__PONCHO__!.step(30));
    await page.waitForFunction(() => window.__PONCHO__!.clawDrawn() === 'none');
    await frames(page);
    const without = await Promise.all(behindMids.map((m) => pixelsAt(page, around(m))));
    expect(behind.map((spot, i) => spot.every((c, j) => same(c, without[i]![j]!)))).toEqual(behindMids.map(() => true));
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
