// Screenshots of World 3's Sierra look for visual review (GDD-ART-06): the canyon's backdrop, ground, decor and rock ledges in lab-3t and
// lab-3c, and the lives' dark outline (GDD-UI-01) over the grey-blue sky and over rock. Run with `npm run shots`; images land in shots/ (not
// committed). Where things are comes from `src/levels/lab3t.ts` and `src/levels/lab3c.ts` (L-062).
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { LIVES_MAX, TILE } from '../../src/config/tuning';
import { LAB_3C_RAILS } from '../../src/levels/lab3c';
import { LAB_3T_HIGH_BOTTOM, LAB_3T_HIGH_PIT, LAB_3T_LEDGES, LAB_3T_LOW_PIT, LAB_3T_LOWEST, LAB_3T_SPAWN } from '../../src/levels/lab3t';
import { start } from '../helpers';

const shot = async (page: Page, info: TestInfo, name: string) => {
  await page.waitForTimeout(150); // L-042: real time is fine here, only to let the paused frame render before the screenshot
  await page.screenshot({ path: `shots/${name}-${info.project.name.replace('shots-', '')}.png` });
};

/** Starts the level the device's way (L-045) and pauses it; with `at`, Poncho is put down there (a teleport: the camera cuts) and lands first. */
const open = async (page: Page, isMobile: boolean, level: string, at?: { x: number; y: number }) => {
  await start(page, isMobile, `/?level=${level}`);
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 10);
  await page.evaluate((p) => {
    const d = window.__PONCHO__!;
    d.pause(true);
    if (p) d.teleport(p.x, p.y - 1);
    d.step(20);
  }, at ?? null);
  expect(await page.evaluate(() => window.__PONCHO__!.scenery())).toEqual({ set: 'sierra', midKey: 'sierra:mid' });
};

const view = (page: Page) => page.evaluate(() => ({ cam: window.__PONCHO__!.camera(), s: window.__PONCHO__!.state(), layout: window.__PONCHO__!.backdropLayout() }));

test('GDD-ART-06 sierra: lab-3t at its spawn, on the rim', async ({ page, isMobile }, info) => {
  await open(page, isMobile, 'lab-3t');
  const { cam, s } = await view(page);
  expect(s).toMatchObject({ x: LAB_3T_SPAWN.x, y: LAB_3T_SPAWN.y, grounded: true });
  expect(cam.scrollY).toBe(0);
  await shot(page, info, 'sierra-rim');
});

test('GDD-ART-06 sierra: low in lab-3t, the canyon wall of the mid strip in view', async ({ page, isMobile }, info) => {
  await open(page, isMobile, 'lab-3t', { x: (LAB_3T_LOWEST.col0 + 6) * TILE + TILE / 2, y: LAB_3T_LOWEST.row * TILE });
  const { cam, s, layout } = await view(page);
  expect(s).toMatchObject({ y: LAB_3T_LOWEST.row * TILE, grounded: true });
  // At the level's bottom the backdrop is at its rest: the mid strip from y 148 to the floor's line on the screen (224).
  expect(cam.scrollY).toBe(368);
  expect(layout.desertY).toBe(148);
  await shot(page, info, 'sierra-descent');
});

test('GDD-ART-06 sierra: lab-3t at the lip of its high pit, over the raised bottom', async ({ page, isMobile }, info) => {
  const lip = LAB_3T_HIGH_PIT.row * TILE;
  // Standing on the last ground column before the pit, his box's right edge 1 px short of the lip.
  await open(page, isMobile, 'lab-3t', { x: LAB_3T_HIGH_PIT.col0 * TILE - 7, y: lip });
  const { cam, s } = await view(page);
  expect(s).toMatchObject({ y: lip, grounded: true });
  expect(s.x + 6).toBeLessThanOrEqual(LAB_3T_HIGH_PIT.col0 * TILE);
  expect(s.x + 6).toBeGreaterThan(LAB_3T_HIGH_PIT.col0 * TILE - 2);
  // The camera at the raised bottom's limit (its bottom edge 2 px above the floor line).
  expect(cam.scrollY).toBe((LAB_3T_HIGH_BOTTOM.row + 1) * TILE - 2 - 270);
  await shot(page, info, 'sierra-pit');
});

test('GDD-ART-06 sierra: lab-3c at its first rail, the cart waiting', async ({ page, isMobile }, info) => {
  const R1 = LAB_3C_RAILS[0]!;
  await open(page, isMobile, 'lab-3c', { x: R1.x - TILE / 2, y: R1.y });
  const seen = await page.evaluate(() => ({ cart: window.__PONCHO__!.carts()[0]!, s: window.__PONCHO__!.state() }));
  expect(seen.cart.phase).toBe('waiting');
  expect(seen.s).toMatchObject({ y: R1.y, grounded: true });
  await shot(page, info, 'sierra-rails');
});

test('GDD-ART-06 sierra: the rock ledges, two at rest and one in its warning, flashing pale', async ({ page, isMobile }, info) => {
  const right = LAB_3T_LEDGES.col1;
  await open(page, isMobile, 'lab-3t', { x: right * TILE + TILE / 2, y: LAB_3T_LEDGES.row * TILE });
  // On the right ledge, stepped into its warning until it shows its pale flash.
  const drawn = await page.evaluate(() => {
    const d = window.__PONCHO__!;
    for (let i = 0; i < 40 && !(d.crumbles()[2]!.phase === 'warning' && d.crumbles()[2]!.frame === 1); i++) d.step(1);
    return d.crumbles();
  });
  expect(drawn.map((c) => [c.look, c.phase, c.frame])).toEqual([
    ['ledge', 'idle', 0],
    ['ledge', 'idle', 0],
    ['ledge', 'warning', 1],
  ]);
  await shot(page, info, 'sierra-ledge');
});

/** Three lives lost in play: three falls into lab-3t's low pit, each back at the spawn after the wait and the flip. */
const loseThree = async (page: Page) => {
  const lost = await page.evaluate(
    ([x, y]) => {
      const d = window.__PONCHO__!;
      for (let k = 0; k < 3; k++) {
        d.teleport(x!, y!);
        for (let i = 0; i < 300 && d.phase() === 'playing'; i++) d.step(1);
        for (let i = 0; i < 300 && d.phase() !== 'playing'; i++) d.step(1);
      }
      d.step(40); // the cracks are over
      return d.lives();
    },
    [(LAB_3T_LOW_PIT.col0 + 1) * TILE + TILE / 2, LAB_3T_LOWEST.row * TILE - 2 * TILE],
  );
  expect(lost).toBe(LIVES_MAX - 3);
};

test('GDD-UI-01 sierra: three lives lost, the lives outlined over the sky and over rock', async ({ page, isMobile }, info) => {
  await open(page, isMobile, 'lab-3t');
  await loseThree(page);
  let { cam, s } = await view(page);
  // Back at the spawn, the camera at the level's top: the HUD over the sky's top band.
  expect(s).toMatchObject({ x: LAB_3T_SPAWN.x, y: LAB_3T_SPAWN.y });
  expect(cam.scrollY).toBe(0);
  const outlines = await page.evaluate(() => window.__PONCHO__!.hudOutlines());
  expect(outlines.map((o) => o.filled)).toEqual([true, true, true, true, false, false, false]);
  await shot(page, info, 'sierra-lives-sky');
  // At the chasm's bottom by the low pit, the camera at its bottom limit: the HUD over the rock of the cliffs to the left.
  await page.evaluate(([x, y]) => {
    const d = window.__PONCHO__!;
    d.teleport(x!, y! - 1);
    d.step(20);
  }, [(LAB_3T_LOW_PIT.col1 + 2) * TILE + TILE / 2, LAB_3T_LOWEST.row * TILE]);
  ({ cam, s } = await view(page));
  expect(cam.scrollY).toBe(368);
  // The tiles behind the lives (screen x 8 to 100, y 8 to 17) are ground.
  const behind = await page.evaluate(([vx, vy]) => [0, 3, 6].map((i) => window.__PONCHO__!.groundFrame(Math.floor((vx! + 13 + i * 13) / 16), Math.floor((vy! + 12) / 16))), [cam.viewX, cam.scrollY]);
  expect(behind.every((f) => f !== null)).toBe(true);
  await shot(page, info, 'sierra-lives-ground');
});
