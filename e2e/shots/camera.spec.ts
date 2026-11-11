// Screenshots of the camera up and down for visual review (GDD-UI-04, GDD-ART-06), in lab-3t, a level 40 rows tall. Run with `npm run shots`;
// images land in shots/ (not committed). Where things are comes from `src/levels/lab3t.ts` (L-062).
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { CAMERA, CART, TILE } from '../../src/config/tuning';
import { LAB_3T_CHASM, LAB_3T_DROP, LAB_3T_LOWEST, LAB_3T_RAILS, LAB_3T_SPAWN } from '../../src/levels/lab3t';
import { start } from '../helpers';

const LANDING_Y = LAB_3T_DROP.row * TILE;

const shot = async (page: Page, info: TestInfo, name: string) => {
  await page.waitForTimeout(150); // L-042: real time is fine here, only to let the paused frame render before the screenshot
  await page.screenshot({ path: `shots/${name}-${info.project.name.replace('shots-', '')}.png` });
};

/** Starts lab-3t the device's way (L-045) and pauses it; with `at`, Poncho is put down there (a teleport: the camera cuts) and lands first. */
const open = async (page: Page, isMobile: boolean, at?: { x: number; y: number }) => {
  await start(page, isMobile, '/?level=lab-3t');
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 10);
  await page.evaluate((p) => {
    const d = window.__PONCHO__!;
    d.pause(true);
    if (p) d.teleport(p.x, p.y - 1);
    d.step(20);
  }, at ?? null);
};

const view = (page: Page) => page.evaluate(() => ({ cam: window.__PONCHO__!.camera(), s: window.__PONCHO__!.state() }));

test('GDD-UI-04 camera: the start plateau at the level top', async ({ page, isMobile }, info) => {
  await open(page, isMobile);
  const { cam, s } = await view(page);
  expect(s).toMatchObject({ x: LAB_3T_SPAWN.x, y: LAB_3T_SPAWN.y, grounded: true });
  expect(cam.scrollY).toBe(0);
  await shot(page, info, 'camera-top');
});

test('GDD-UI-04 camera: mid-fall off the drop, the landing ground in view', async ({ page, isMobile }, info) => {
  await open(page, isMobile, { x: LAB_3T_DROP.lipCol * TILE + 4, y: LAB_3T_DROP.lipRow * TILE });
  await page.evaluate(() => {
    const d = window.__PONCHO__!;
    for (let i = 0; i < 100 && (i < 5 || d.state().y < 190); i++) d.step(1, { move: 1, jumpHeld: false });
  });
  const { cam, s } = await view(page);
  expect(s.grounded).toBe(false);
  expect(cam.scrollY).toBeGreaterThan(0);
  expect(LANDING_Y - cam.scrollY).toBeLessThan(270);
  await shot(page, info, 'camera-drop');
});

test('GDD-UI-04 camera: gliding over the chasm', async ({ page, isMobile }, info) => {
  await open(page, isMobile, { x: LAB_3T_DROP.col0 * TILE + TILE / 2, y: LANDING_Y });
  // A run to the lip, a jump there held into the glide, to the chasm's middle.
  const middle = ((LAB_3T_CHASM.col0 + LAB_3T_CHASM.col1 + 1) / 2) * TILE;
  await page.evaluate(
    ([lip, mid]) => {
      const d = window.__PONCHO__!;
      let jumped = false;
      for (let i = 0; i < 300 && d.state().x < mid!; i++) {
        if (d.state().x + 6 >= lip! - 2) jumped = true;
        d.step(1, { move: 1, jumpHeld: jumped });
      }
    },
    [(LAB_3T_DROP.col1 + 1) * TILE, middle],
  );
  const { s } = await view(page);
  expect(s.gliding).toBe(true);
  expect(s.x).toBeGreaterThanOrEqual(middle);
  await shot(page, info, 'camera-glide');
});

test('GDD-UI-04 camera: the lowest ground, the camera at its bottom limit', async ({ page, isMobile }, info) => {
  await open(page, isMobile, { x: (LAB_3T_LOWEST.col0 + 6) * TILE, y: LAB_3T_LOWEST.row * TILE });
  const { cam, s } = await view(page);
  expect(s).toMatchObject({ y: LAB_3T_LOWEST.row * TILE, grounded: true });
  expect(cam.scrollY).toBe(368);
  await shot(page, info, 'camera-low');
});

test('GDD-UI-04 camera: riding the lift', async ({ page, isMobile }, info) => {
  await open(page, isMobile);
  // Onto the lift where it is, then up with it until it is 6 tiles over the ledge it starts at (at most a full round, 672 steps).
  const on = await page.evaluate(() => {
    const d = window.__PONCHO__!;
    const lift = d.platforms()[0]!;
    d.teleport(lift.x + lift.w / 2, lift.y - 1);
    for (let i = 0; i < 700 && !(d.state().grounded && d.platforms()[0]!.y < 200 && d.platforms()[0]!.y > 180); i++) d.step(1);
    return { feet: d.state().y, deck: d.platforms()[0]!.y, grounded: d.state().grounded };
  });
  expect(on.grounded).toBe(true);
  expect(on.feet).toBeCloseTo(on.deck, 6);
  const { cam, s } = await view(page);
  expect(s.y - cam.scrollY).toBeGreaterThanOrEqual(CAMERA.bandTop - 0.125);
  expect(s.y - cam.scrollY).toBeLessThanOrEqual(CAMERA.bandBottom + 0.125);
  await shot(page, info, 'camera-lift');
});

test('GDD-UI-04 camera: the cart climbing', async ({ page, isMobile }, info) => {
  const R1 = LAB_3T_RAILS[0]!;
  await open(page, isMobile, { x: R1.x - TILE / 2, y: R1.y });
  // A hop into R1's cart, steering over its middle, then nothing held while it climbs, to the middle of the climb (3 tiles up).
  const ride = await page.evaluate(
    ([half, mid]) => {
      const d = window.__PONCHO__!;
      for (let n = 0; n < 200 && d.carts()[0]!.phase === 'waiting'; n++) {
        const gap = d.carts()[0]!.x! + half! - d.state().x;
        d.step(1, { move: Math.abs(gap) > 2 ? Math.sign(gap) : 0, jumpHeld: n < 12 });
      }
      for (let n = 0; n < 400 && d.carts()[0]!.y! > mid!; n++) d.step(1);
      return { phase: d.carts()[0]!.phase, cart: d.carts()[0]!.y!, feet: d.state().y, grounded: d.state().grounded };
    },
    [CART.width / 2, R1.y - CART.floorPx - 3 * TILE],
  );
  expect(ride.phase).toBe('rolling');
  expect([ride.grounded, ride.feet]).toEqual([true, ride.cart]);
  const { cam, s } = await view(page);
  expect(s.y - cam.scrollY).toBeCloseTo(CAMERA.bandTop, 0);
  await shot(page, info, 'camera-cart-climb');
});
