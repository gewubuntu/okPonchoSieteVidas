// Screenshots of the vagonetas for visual review (GDD-WLD-15), in lab-3c. Run with `npm run shots`; images land in shots/ (not committed).
// The rails' places come from `src/levels/lab3c.ts` (L-062).
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { LAB_3C_OFRENDAS, LAB_3C_RAILS, LAB_3C_SPAWN } from '../../src/levels/lab3c';
import { start } from '../helpers';

const shot = async (page: Page, info: TestInfo, name: string) => {
  await page.waitForTimeout(150); // L-042: real time is fine here, only to let the paused frame render before the screenshot
  await page.screenshot({ path: `shots/${name}-${info.project.name.replace('shots-', '')}.png` });
};

/** Starts lab-3c the device's way (L-045) and pauses it; with `at`, Poncho is put down there and lands first. */
const open = async (page: Page, isMobile: boolean, at?: { x: number; y: number }) => {
  await start(page, isMobile, '/?level=lab-3c');
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 10);
  await page.evaluate((p) => {
    const d = window.__PONCHO__!;
    d.pause(true);
    if (p) d.teleport(p.x, p.y - 1);
    d.step(30);
  }, at ?? null);
};

/** Hops Poncho into cart `i` by steps: a jump at once, steering over its middle, and nothing held once it rolls. The steps it took. */
const hopInto = (page: Page, i: number) =>
  page.evaluate((k) => {
    const d = window.__PONCHO__!;
    let n = 0;
    for (; n < 300 && d.carts()[k]!.phase === 'waiting'; n++) {
      const gap = d.carts()[k]!.x + 16 - d.state().x;
      const far = Math.abs(gap) > 60;
      d.step(1, { move: Math.abs(gap) > 4 ? Math.sign(gap) : 0, jumpHeld: !far && (d.state().grounded ? !d.state().jumpWasHeld : d.state().vy < 0) });
    }
    return n;
  }, i);

const cart = (page: Page, i: number) => page.evaluate((k) => ({ cart: window.__PONCHO__!.carts()[k]!, s: window.__PONCHO__!.state() }), i);

test('GDD-WLD-15 vagonetas: waiting, riding, a jump over the cart and stopped at the buffer, on R1', async ({ page, isMobile }, info) => {
  await open(page, isMobile);
  let seen = await cart(page, 0);
  expect(seen.cart.phase).toBe('waiting');
  expect(seen.s).toMatchObject({ x: LAB_3C_SPAWN.x, y: LAB_3C_SPAWN.y, grounded: true });
  await shot(page, info, 'cart-waiting');

  expect(await hopInto(page, 0)).toBeLessThan(300);
  await page.evaluate(() => window.__PONCHO__!.step(40));
  seen = await cart(page, 0);
  expect(seen.cart.phase).toBe('rolling');
  expect([seen.s.grounded, seen.s.y]).toEqual([true, seen.cart.y]);
  await shot(page, info, 'cart-riding');

  // A full jump straight up, to its top (16 steps in the air), over the cart rolling on under him.
  await page.evaluate(() => window.__PONCHO__!.step(16, { move: 0, jumpHeld: true }));
  seen = await cart(page, 0);
  expect(seen.cart.phase).toBe('rolling');
  expect(seen.s.grounded).toBe(false);
  expect(seen.cart.y - seen.s.y).toBeGreaterThan(50);
  await shot(page, info, 'cart-jump');

  await page.evaluate(() => {
    const d = window.__PONCHO__!;
    d.step(30, { move: 0, jumpHeld: true });
    for (let n = 0; n < 300 && d.carts()[0]!.phase !== 'stopped'; n++) d.step(1);
    d.step(20);
  });
  seen = await cart(page, 0);
  expect(seen.cart.phase).toBe('stopped');
  expect([seen.s.grounded, seen.s.y]).toEqual([true, seen.cart.y]);
  await shot(page, info, 'cart-buffer');
});

test('GDD-WLD-15 vagonetas: climbing R2\'s slope to the plateau', async ({ page, isMobile }, info) => {
  await open(page, isMobile, LAB_3C_OFRENDAS[0]);
  expect(await hopInto(page, 1)).toBeLessThan(300);
  // R2 climbs from 4 tiles across (64 px) to 8 (128 px): rolled on until the cart's middle is halfway up, 96 px across.
  const r2 = LAB_3C_RAILS[1]!;
  await page.evaluate((midX) => {
    const d = window.__PONCHO__!;
    for (let n = 0; n < 300 && d.carts()[1]!.x + 16 < midX; n++) d.step(1);
  }, r2.x + 96);
  const seen = await cart(page, 1);
  expect(seen.cart.phase).toBe('rolling');
  expect(seen.cart.y).toBeLessThan(r2.y - 8 - 16); // risen off the floor
  expect([seen.s.grounded, seen.s.y]).toEqual([true, seen.cart.y]);
  await shot(page, info, 'cart-climb');
});

test('GDD-WLD-15 vagonetas: R4 rolling left', async ({ page, isMobile }, info) => {
  await open(page, isMobile, LAB_3C_OFRENDAS[2]);
  expect(await hopInto(page, 3)).toBeLessThan(300);
  const r4 = LAB_3C_RAILS[3]!;
  await page.evaluate(() => window.__PONCHO__!.step(30));
  const seen = await cart(page, 3);
  expect(seen.cart.phase).toBe('rolling');
  expect(seen.cart.x + 16).toBeLessThan(r4.x - 16 - 50); // gone left from its start
  expect([seen.s.grounded, seen.s.y]).toEqual([true, seen.cart.y]);
  await shot(page, info, 'cart-left');
});
