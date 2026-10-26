import { expect, test, type Page } from '@playwright/test';
import { pixelsAt, start } from './helpers';

// GDD-ART-06: World 1's desert backdrop (sky, sun, clouds, mountains) and ground tiles, read from the real picture. These play 0-1
// ("/"). Pixel samples are at least 2 px from edges and clear of the touch buttons (L-017, L-018).
type Colour = { r: number; g: number; b: number };
const rgb = (hex: string): Colour => ({ r: parseInt(hex.slice(1, 3), 16), g: parseInt(hex.slice(3, 5), 16), b: parseInt(hex.slice(5, 7), 16) });
/** Whether a pixel is within 12 per channel of a colour. */
const near = (c: Colour, hex: string) => {
  const t = rgb(hex);
  return Math.abs(c.r - t.r) <= 12 && Math.abs(c.g - t.g) <= 12 && Math.abs(c.b - t.b) <= 12;
};
const nearAny = (c: Colour, hexes: string[]) => hexes.some((h) => near(c, h));

/** The touch buttons' boxes in game px, grown by `pad`, while they are shown (none on a desktop). */
async function buttonBoxes(page: Page, pad = 6): Promise<{ x0: number; y0: number; x1: number; y1: number }[]> {
  const touch = await page.evaluate(() => window.__PONCHO__!.touch());
  if (!touch.visible) return [];
  return touch.buttons.map((b) => ({ x0: b.x - pad, y0: b.y - pad, x1: b.x + b.w + pad, y1: b.y + b.h + pad }));
}
const covered = (boxes: { x0: number; y0: number; x1: number; y1: number }[], x: number, y: number) => boxes.some((b) => x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1);

test('GDD-ART-06 parallax follows the camera', async ({ page, isMobile }) => {
  await start(page, isMobile);
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 5);
  expect(await page.evaluate(() => window.__PONCHO__!.camera().scrollX)).toBe(0);
  expect(await page.evaluate(() => window.__PONCHO__!.backdrop())).toEqual({ clouds: 0, mountains: 0 });
  const boxes = await buttonBoxes(page);
  // A row of points in the mountain area, clear of the level's own things (they stand on the floor), the HUD and the buttons.
  const points = Array.from({ length: 22 }, (_, i) => ({ x: 10 + i * 21, y: 150 })).filter((p) => !covered(boxes, p.x, p.y));
  expect(points.length).toBeGreaterThan(10);
  // A cloud's cream top, 0.1 of the scroll to the left of where it stands at the start (the small cloud centred at game x 420, y 69).
  const cloud = { x: 420.5, y: 69.5 };
  const before = await pixelsAt(page, [...points, cloud]);
  expect(near(before[points.length]!, '#FFF4DC'), `cloud ${JSON.stringify(before[points.length])}`).toBe(true);

  await page.evaluate(() => window.__PONCHO__!.pause(true));
  await page.evaluate(() => window.__PONCHO__!.teleport(900, 224));
  await page.evaluate(() => window.__PONCHO__!.step(1));
  await page.waitForFunction(() => window.__PONCHO__!.camera().scrollX > 0 && window.__PONCHO__!.camera().viewX === window.__PONCHO__!.camera().scrollX);
  const { scrollX } = await page.evaluate(() => window.__PONCHO__!.camera());
  expect(scrollX).toBeGreaterThan(300);
  const offsets = await page.evaluate(() => window.__PONCHO__!.backdrop());
  expect(offsets.clouds).toBe(Math.round(scrollX * 0.1 * 4) / 4);
  expect(offsets.mountains).toBe(Math.round(scrollX * 0.3 * 4) / 4);
  expect(offsets.mountains).toBeGreaterThan(90);

  // The first cloud (x 38 to 75) has gone off the left and wrapped: its copy one screen to the left shows its right end at the screen's left edge.
  const wrapped = { x: 38 - offsets.clouds + 29.5, y: 66.5 };
  expect(wrapped.x).toBeGreaterThan(2);
  expect(wrapped.x).toBeLessThan(9);
  const after = await pixelsAt(page, [...points, { x: cloud.x - offsets.clouds, y: cloud.y }, wrapped]);
  const changed = points.filter((_, i) => Math.abs(before[i]!.r - after[i]!.r) + Math.abs(before[i]!.g - after[i]!.g) + Math.abs(before[i]!.b - after[i]!.b) > 30);
  expect(changed.length).toBeGreaterThan(0);
  // The cloud has moved left by its share of the scroll and is still there; its old place shows sky.
  expect(near(after[points.length]!, '#FFF4DC'), `moved cloud ${JSON.stringify(after[points.length])}`).toBe(true);
  expect(near(after[points.length + 1]!, '#FFF4DC'), `wrapped cloud ${JSON.stringify(after[points.length + 1])}`).toBe(true);
  expect(near((await pixelsAt(page, [cloud]))[0]!, '#FFF4DC')).toBe(false);
  // The mountains still fill the screen's width there, below every peak (the near range's lowest ridge is above y 175): they follow the camera at 0.3, not the level.
  const low = Array.from({ length: 22 }, (_, i) => ({ x: 10 + i * 21, y: 182 })).filter((p) => !covered(boxes, p.x, p.y));
  const rows = await pixelsAt(page, low);
  expect(rows.filter((c) => nearAny(c, ['#8E6A96', '#A65B5B', '#4D5A9C', '#3A4580'])).length).toBeGreaterThan(low.length * 0.7);
});

test('GDD-ART-06 sky and ground are drawn', async ({ page, isMobile }) => {
  await start(page, isMobile);
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 5);
  const boxes = await buttonBoxes(page);
  // The top band of the sky, between the HUD's two corners and clear of the sun (x 104) and the tip's text box.
  expect(covered(boxes, 300, 6)).toBe(false);
  const [sky] = await pixelsAt(page, [{ x: 300, y: 6 }]);
  expect(near(sky!, '#E39A48'), `sky ${JSON.stringify(sky)}`).toBe(true);

  // The tallest far peak, at column 140 of the mountains, reaches the top row of the image at y = 92 (BACKDROP.mountainTop): 2 px below it the purple is 7 px wide.
  // The horizon band, in the valley between two near peaks (the mountains' first row there is y 141), is the pale gold of the camera's background.
  // And the grass of the top of 0-1's 2-tile tower at column 11 (row 12, y 192), which is in front of the mountains.
  expect(covered(boxes, 205.5, 128.5) || covered(boxes, 184, 193.5)).toBe(false);
  const [peak, clouds, sun, horizon, tower] = await pixelsAt(page, [{ x: 140.5, y: 94.5 }, { x: 420.5, y: 69.5 }, { x: 104, y: 36 }, { x: 205.5, y: 128.5 }, { x: 184, y: 193.5 }]);
  expect(near(horizon!, '#F9DA8E'), `horizon ${JSON.stringify(horizon)}`).toBe(true);
  expect(nearAny(tower!, ['#6FA03A', '#9CC24E', '#4E7A2C']), `tower ${JSON.stringify(tower)}`).toBe(true);
  expect(near(sun!, '#FFF6D0'), `sun ${JSON.stringify(sun)}`).toBe(true); // the sun's pale disc, centred at game (104, 36)
  expect(near(peak!, '#8E6A96'), `peak ${JSON.stringify(peak)}`).toBe(true);
  expect(near(clouds!, '#FFF4DC'), `cloud ${JSON.stringify(clouds)}`).toBe(true); // the small cloud's cream top, in front of the sky

  // Where the fixed parts stand (GDD-ART-06): the sun's centre at (104, 36), the mountains from y = 92, their flat foot from y = 92 + 122 (art row 488).
  expect(await page.evaluate(() => window.__PONCHO__!.backdropLayout())).toEqual({ sunX: 104, sunY: 36, mountainsY: 92, footY: 214 });

  // Ground: the grass strip along the floor's top (row 14 from y 224, grass 3 px deep) and the earth two rows down (row 16 from y 256).
  expect([0, 1]).toContain(await page.evaluate(() => window.__PONCHO__!.groundFrame(5, 14)));
  expect([2, 3]).toContain(await page.evaluate(() => window.__PONCHO__!.groundFrame(5, 15)));
  expect(await page.evaluate(() => window.__PONCHO__!.groundFrame(16, 14))).toBeNull(); // the gap
  // Columns with nothing solid above the floor (0-1's walls stand at 7, 8, 11 and 12), clear of the touch buttons.
  const col = [5, 9, 10, 13, 14, 15].find((c) => !covered(boxes, c * 16 + 8, 225.5) && !covered(boxes, c * 16 + 8, 264))!;
  expect(col).toBeDefined();
  const [grass, earth] = await pixelsAt(page, [{ x: col * 16 + 8, y: 225.5 }, { x: col * 16 + 8, y: 264 }]);
  expect(nearAny(grass!, ['#6FA03A', '#9CC24E', '#4E7A2C']), `grass ${JSON.stringify(grass)}`).toBe(true);
  expect(nearAny(earth!, ['#A0472F', '#7A3326']), `earth ${JSON.stringify(earth)}`).toBe(true);
});

test('GDD-ART-06 a pit shows the mountains', async ({ page, isMobile }) => {
  await start(page, isMobile);
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 5);
  const { scrollX } = await page.evaluate(() => window.__PONCHO__!.camera());
  const boxes = await buttonBoxes(page);
  // 0-1's 1-tile gap is column 16 (x 256 to 272): its middle, 250 px down, well below the floor.
  const x = 16 * 16 + 8 - scrollX;
  expect(covered(boxes, x, 250)).toBe(false);
  const [pit] = await pixelsAt(page, [{ x, y: 250 }]);
  expect(nearAny(pit!, ['#4D5A9C', '#3A4580']), `pit ${JSON.stringify(pit)}`).toBe(true);
});
