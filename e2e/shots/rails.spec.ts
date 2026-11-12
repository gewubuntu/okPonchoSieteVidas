// Screenshots of World 3's railway art (GDD-ART-06, GDD-WLD-15) in lab-3c, for visual review: the standing cart with its chock, riding on
// level rail, down a ramp, over a trestle, a broken end with its lit post, and the cart at its buffer. Run with `npm run shots`; images land
// in shots/ (not committed). Where things are comes from `src/levels/lab3c.ts` and `railLook` (L-062).
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { CART, TILE } from '../../src/config/tuning';
import { LAB_3C_LEVEL, LAB_3C_OFRENDAS, LAB_3C_RAILS, LAB_3C_SPAWN } from '../../src/levels/lab3c';
import { railLength, warningPost } from '../../src/sim/cart';
import { railLook } from '../../src/ui/railLook';
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
      const gap = d.carts()[k]!.x! + 16 - d.state().x;
      const far = Math.abs(gap) > 60;
      d.step(1, { move: Math.abs(gap) > 4 ? Math.sign(gap) : 0, jumpHeld: !far && (d.state().grounded ? !d.state().jumpWasHeld : d.state().vy < 0) });
    }
    return n;
  }, i);

/** In cart `i`, rolling, he holds nothing until its middle is at `midX`. */
const rollTo = (page: Page, i: number, midX: number) =>
  page.evaluate(
    ({ k, until }) => {
      const d = window.__PONCHO__!;
      for (let n = 0; n < 300 && d.carts()[k]!.x! + 16 < until; n++) d.step(1);
    },
    { k: i, until: midX },
  );

const seen = (page: Page, i: number) => page.evaluate((k) => ({ cart: window.__PONCHO__!.carts()[k]!, s: window.__PONCHO__!.state(), viewX: window.__PONCHO__!.camera().viewX }), i);
/** Whether game x lies on the screen (480 game px wide from `viewX`). */
const inView = (viewX: number, x: number) => x >= viewX && x <= viewX + 480;
const LOOK = railLook(LAB_3C_LEVEL.world, LAB_3C_RAILS, LAB_3C_LEVEL.world.height);

test('GDD-ART-06 rails: the standing cart with its chock, then riding on level rail, on R1', async ({ page, isMobile }, info) => {
  await open(page, isMobile);
  let at = await seen(page, 0);
  expect([at.cart.phase, at.cart.look]).toEqual(['waiting', 'standing']);
  expect(at.s).toMatchObject({ x: LAB_3C_SPAWN.x, grounded: true });
  expect(inView(at.viewX, at.cart.x!)).toBe(true);
  await shot(page, info, 'rails-cart-standing');

  expect(await hopInto(page, 0)).toBeLessThan(300);
  await page.evaluate(() => window.__PONCHO__!.step(40));
  at = await seen(page, 0);
  expect(at.cart.phase).toBe('rolling');
  expect(['rolling0', 'rolling1']).toContain(at.cart.look);
  expect(at.cart.angle).toBe(0);
  expect([at.s.grounded, at.s.y]).toEqual([true, at.cart.y]);
  await shot(page, info, 'rails-ride');
});

test('GDD-ART-06 rails: riding down R3\'s ramp, the cart tilted', async ({ page, isMobile }, info) => {
  await open(page, isMobile, LAB_3C_OFRENDAS[1]);
  expect(await hopInto(page, 2)).toBeLessThan(300);
  // R3 descends from 32 px across to 96: halfway down at 64.
  await rollTo(page, 2, LAB_3C_RAILS[2]!.x + 64);
  const at = await seen(page, 2);
  expect(at.cart.phase).toBe('rolling');
  expect(at.cart.angle!).toBeCloseTo(45, 6);
  expect(at.s.grounded).toBe(true);
  await shot(page, info, 'rails-ramp');
});

test('GDD-ART-06 rails: riding up R2 over its trestle', async ({ page, isMobile }, info) => {
  await open(page, isMobile, LAB_3C_OFRENDAS[0]);
  expect(await hopInto(page, 1)).toBeLessThan(300);
  // R2 climbs over air from 4 tiles across to 8: its middle at 6 tiles, the bents under its climb on screen.
  await rollTo(page, 1, LAB_3C_RAILS[1]!.x + 96);
  const at = await seen(page, 1);
  expect(at.cart.phase).toBe('rolling');
  expect(at.cart.angle!).toBeCloseTo(-45, 6);
  expect(at.s.grounded).toBe(true);
  const bents = LOOK.filter((im) => im.rail === 1 && im.part === 'bent');
  expect(bents.length).toBeGreaterThan(0);
  for (const b of bents) expect(inView(at.viewX, b.x)).toBe(true);
  expect((await page.evaluate(() => window.__PONCHO__!.rails())).trestleBents).toBe(LOOK.filter((im) => im.part === 'bent').length);
  await shot(page, info, 'rails-trestle');
});

test('GDD-ART-06 rails: standing before R5\'s broken end, its post lit', async ({ page, isMobile }, info) => {
  const r5 = LAB_3C_RAILS[4]!;
  const post = warningPost(r5)!;
  // Put down on the floor 2 tiles before the post: the post and the splayed end, 6 tiles on, ahead of him.
  await open(page, isMobile, { x: post.x - 2 * TILE, y: post.y });
  const at = await seen(page, 4);
  expect(at.cart.phase).toBe('waiting');
  expect(at.s.grounded).toBe(true);
  const end = r5.x + railLength(r5);
  expect(inView(at.viewX, post.x)).toBe(true);
  expect(inView(at.viewX, end)).toBe(true);
  expect(await page.evaluate(() => window.__PONCHO__!.rails())).toMatchObject({ posts: 2, brokenEnds: 2 });
  await shot(page, info, 'rails-broken');
});

test('GDD-ART-06 rails: the cart at R1\'s buffer, Poncho stepped off', async ({ page, isMobile }, info) => {
  await open(page, isMobile);
  expect(await hopInto(page, 0)).toBeLessThan(300);
  const r1 = LAB_3C_RAILS[0]!;
  const end = r1.x + railLength(r1);
  // Rolled to the buffer, then he walks off its front, through the buffer (it blocks carts only), and stops on the floor in the tile between
  // the buffer and R2's waiting cart (behind the stopped cart lies R1's last notch).
  const steps = await page.evaluate((x) => {
    const d = window.__PONCHO__!;
    let n = 0;
    for (; n < 300 && d.carts()[0]!.phase !== 'stopped'; n++) d.step(1);
    for (; n < 600 && d.state().x < x; n++) d.step(1, { move: 1, jumpHeld: false });
    d.step(30);
    return n;
  }, end + TILE - 4);
  expect(steps).toBeLessThan(600);
  const at = await seen(page, 0);
  expect([at.cart.phase, at.cart.look]).toEqual(['stopped', 'stopped']);
  expect(at.cart.x! + CART.width).toBe(end);
  expect([at.s.grounded, at.s.y]).toEqual([true, r1.y]);
  expect(at.s.x).toBeGreaterThan(end + TILE / 2);
  expect(at.s.x).toBeLessThan(LAB_3C_RAILS[1]!.x);
  expect(inView(at.viewX, end)).toBe(true);
  await shot(page, info, 'rails-buffer');
});
