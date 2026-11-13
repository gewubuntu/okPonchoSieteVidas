// Screenshots of the mine's look for visual review (GDD-ART-06): the backdrop underground, the floor, the decor, the black shaft of a pit,
// the ramp, the low roof, the placeholder cart and rail, and the HUD over the roof band, in lab-3m. Run with `npm run shots`; images land in
// shots/ (not committed). Where things are comes from `src/levels/lab3m.ts` (L-062).
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { LIVES_MAX, TILE } from '../../src/config/tuning';
import { LAB_3M_FLOOR_ROW, LAB_3M_LOW_ROOF, LAB_3M_LOWER, LAB_3M_PIT, LAB_3M_RAILS, LAB_3M_RAMP, LAB_3M_SPAWN } from '../../src/levels/lab3m';
import { start } from '../helpers';

const FLOOR_Y = LAB_3M_FLOOR_ROW * TILE;

const shot = async (page: Page, info: TestInfo, name: string) => {
  await page.waitForTimeout(150); // L-042: real time is fine here, only to let the paused frame render before the screenshot
  await page.screenshot({ path: `shots/${name}-${info.project.name.replace('shots-', '')}.png` });
};

/** Starts lab-3m the device's way (L-045) and pauses it; with `at`, Poncho is put down there (a teleport: the camera cuts) and lands first. */
const open = async (page: Page, isMobile: boolean, at?: { x: number; y: number }) => {
  await start(page, isMobile, '/?level=lab-3m');
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 10);
  await page.evaluate((p) => {
    const d = window.__PONCHO__!;
    d.pause(true);
    if (p) d.teleport(p.x, p.y - 1);
    d.step(20);
  }, at ?? null);
  expect(await page.evaluate(() => window.__PONCHO__!.scenery())).toEqual({ set: 'sierra', midKey: 'sierra:mid-mina', place: 'mina' });
};

const view = (page: Page) => page.evaluate(() => ({ cam: window.__PONCHO__!.camera(), s: window.__PONCHO__!.state(), layout: window.__PONCHO__!.backdropLayout() }));

test('GDD-ART-06 mina: the main gallery, lamps and timber sets behind, the floor and the decor', async ({ page, isMobile }, info) => {
  await open(page, isMobile);
  const { cam, s, layout } = await view(page);
  expect(s).toMatchObject({ x: LAB_3M_SPAWN.x, y: LAB_3M_SPAWN.y, grounded: true });
  expect(cam.scrollX).toBe(0);
  // The far band from y 40, the mid band from 100, its foot from 200.
  expect([layout.mountainsY, layout.desertY, layout.footY]).toEqual([40, 100, 200]);
  // Some of the mine's decor stands in the gallery in view.
  const plants = await page.evaluate(() => window.__PONCHO__!.plants());
  expect(plants.filter((p) => p.x < 480 && p.y <= FLOOR_Y + 1).length).toBeGreaterThan(0);
  await shot(page, info, 'mina-gallery');
});

test('GDD-ART-06 mina: at the pit lip, the shaft black', async ({ page, isMobile }, info) => {
  // Standing on the last floor column before the pit, his box's right edge 1 px short of the lip.
  await open(page, isMobile, { x: LAB_3M_PIT.col0 * TILE - 7, y: FLOOR_Y });
  const { s } = await view(page);
  expect(s).toMatchObject({ y: FLOOR_Y, grounded: true });
  expect(s.x + 6).toBeLessThanOrEqual(LAB_3M_PIT.col0 * TILE);
  expect(s.x + 6).toBeGreaterThan(LAB_3M_PIT.col0 * TILE - 2);
  await shot(page, info, 'mina-pit');
});

test('GDD-ART-06 mina: on the ramp down to the lower floor', async ({ page, isMobile }, info) => {
  // On the ramp's second tile, between the floor's top (y 208) and the lower floor's (y 240).
  await open(page, isMobile, { x: (LAB_3M_RAMP.col0 + 1) * TILE + TILE / 2, y: FLOOR_Y + TILE });
  const { s } = await view(page);
  expect(s.grounded).toBe(true);
  expect(Math.floor(s.x / TILE)).toBe(LAB_3M_RAMP.col0 + 1);
  expect(s.y).toBeGreaterThan(FLOOR_Y);
  expect(s.y).toBeLessThan(LAB_3M_LOWER.row * TILE);
  await shot(page, info, 'mina-ramp');
});

test('GDD-ART-06 mina: under the low roof', async ({ page, isMobile }, info) => {
  const col = Math.floor((LAB_3M_LOW_ROOF.col0 + LAB_3M_LOW_ROOF.col1) / 2);
  await open(page, isMobile, { x: col * TILE + TILE / 2, y: FLOOR_Y });
  const { s } = await view(page);
  expect(s).toMatchObject({ y: FLOOR_Y, grounded: true });
  expect(Math.floor(s.x / TILE)).toBeGreaterThanOrEqual(LAB_3M_LOW_ROOF.col0);
  expect(Math.floor(s.x / TILE)).toBeLessThanOrEqual(LAB_3M_LOW_ROOF.col1);
  await shot(page, info, 'mina-low');
});

test('GDD-ART-06 mina: under the 5-row roof, its underside lip, the lit skin and the deep rock behind it', async ({ page, isMobile }, info) => {
  // Standing on the floor between the pit and the low roof: in view the roof's last row over the gallery (an underside) with deep rock
  // over it, the pit's walls (plain rock, the lit skin) and the low roof's underside. The frames are the mine's (`mineGroundFrame`): the
  // underside 28 or 29, deep rock 30 or 31, plain rock 2 or 34, the ore streak 3.
  const col = LAB_3M_LOW_ROOF.col0 - 1;
  await open(page, isMobile, { x: col * TILE + TILE / 2, y: FLOOR_Y });
  const { cam, s } = await view(page);
  expect(s).toMatchObject({ y: FLOOR_Y, grounded: true });
  expect(Math.floor(s.x / TILE)).toBe(col);
  const roofLast = 4;
  const tiles = { underside: [LAB_3M_PIT.col0, roofLast], deep: [LAB_3M_PIT.col0, roofLast - 2], skin: [LAB_3M_PIT.col0 - 1, LAB_3M_FLOOR_ROW + 1], low: [LAB_3M_LOW_ROOF.col0 + 1, LAB_3M_LOW_ROOF.row] } as const;
  const frames = await page.evaluate((ts) => Object.fromEntries(Object.entries(ts).map(([k, [tx, ty]]) => [k, window.__PONCHO__!.groundFrame(tx, ty)])), tiles);
  expect([28, 29]).toContain(frames.underside);
  expect([30, 31]).toContain(frames.deep);
  expect([2, 3, 34]).toContain(frames.skin);
  expect([28, 29]).toContain(frames.low);
  // Each of them on screen.
  for (const [k, [tx, ty]] of Object.entries(tiles)) {
    expect(tx * TILE - cam.viewX, k).toBeGreaterThanOrEqual(0);
    expect((tx + 1) * TILE - cam.viewX, k).toBeLessThanOrEqual(480);
    expect(ty * TILE - cam.scrollY, k).toBeGreaterThanOrEqual(0);
    expect((ty + 1) * TILE - cam.scrollY, k).toBeLessThanOrEqual(270);
  }
  await shot(page, info, 'mina-roof');
});

test('GDD-ART-06 mina: beside the placeholder cart and its rail on the lower floor', async ({ page, isMobile }, info) => {
  const rail = LAB_3M_RAILS[0]!;
  await open(page, isMobile, { x: rail.x - TILE / 2, y: rail.y });
  const seen = await page.evaluate(() => ({ cart: window.__PONCHO__!.carts()[0]!, s: window.__PONCHO__!.state() }));
  expect(seen.cart.phase).toBe('waiting');
  expect(seen.s).toMatchObject({ y: rail.y, grounded: true });
  await shot(page, info, 'mina-cart');
});

test('GDD-UI-01 mina: two lives lost, the HUD over the roof band', async ({ page, isMobile }, info) => {
  await open(page, isMobile);
  // Two falls into the pit, each back at the spawn after the wait and the flip.
  const lost = await page.evaluate(
    ([x, y]) => {
      const d = window.__PONCHO__!;
      for (let k = 0; k < 2; k++) {
        d.teleport(x!, y!);
        for (let i = 0; i < 300 && d.phase() === 'playing'; i++) d.step(1);
        for (let i = 0; i < 300 && d.phase() !== 'playing'; i++) d.step(1);
      }
      d.step(40);
      return d.lives();
    },
    [(LAB_3M_PIT.col0 + 1) * TILE + TILE / 2, FLOOR_Y - TILE],
  );
  expect(lost).toBe(LIVES_MAX - 2);
  const { cam, s } = await view(page);
  expect(s).toMatchObject({ x: LAB_3M_SPAWN.x, y: LAB_3M_SPAWN.y });
  expect(cam.scrollX).toBe(0);
  const outlines = await page.evaluate(() => window.__PONCHO__!.hudOutlines());
  expect(outlines.map((o) => o.filled)).toEqual([true, true, true, true, true, false, false]);
  await shot(page, info, 'mina-lives');
});
