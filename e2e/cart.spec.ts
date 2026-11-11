import { expect, test, type Page } from '@playwright/test';
import { CART } from '../src/config/tuning';
import { LAB_3C_RAILS } from '../src/levels/lab3c';
import { railLength } from '../src/sim/cart';
import { boot, clearOfButtons, nearHex, pixelsAt, readSheet, spotsIn } from './helpers';

// GDD-WLD-15: the vagonetas in lab-3c (`?level=lab-3c`). Where R1 is comes from `src/levels/lab3c.ts` (L-062): its cart stands at the rail's
// start, 2 tiles right of the spawn, and its buffer is at the rail's end, 20 tiles on.
const R1 = LAB_3C_RAILS[0]!;
/** Where R1's cart stops: its floor's left end, with its front at the rail's end. */
const R1_STOP_X = R1.x + railLength(R1) - CART.width;
const frames = (page: Page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null)))));

/**
 * Boots lab-3c, pauses it and hops Poncho into R1's cart by steps: he jumps at once from the spawn, holding right while he is short of the
 * cart's middle, and lets go of everything once it rolls. Returns the console errors.
 */
async function hopIn(page: Page): Promise<string[]> {
  const errors = await boot(page, '/?level=lab-3c');
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 10);
  const steps = await page.evaluate(() => {
    const d = window.__PONCHO__!;
    d.pause(true);
    let n = 0;
    for (; n < 200 && d.carts()[0]!.phase === 'waiting'; n++) {
      const gap = d.carts()[0]!.x + 16 - d.state().x;
      d.step(1, { move: Math.abs(gap) > 4 ? Math.sign(gap) : 0, jumpHeld: n < 20 });
    }
    return n;
  });
  expect(steps).toBeLessThan(200);
  return errors;
}

test('GDD-WLD-15 Poncho hops into the cart and rides it to the buffer', async ({ page }) => {
  const errors = await hopIn(page);
  expect(await page.evaluate(() => window.__PONCHO__!.carts()[0]!.phase)).toBe('rolling');
  // The game's own frames roll it on (L-021): each frame, his feet and the cart's floor, read together (L-033), until it stops.
  await page.evaluate(() => window.__PONCHO__!.pause(false));
  const seen = await page.evaluate(
    () =>
      new Promise<{ phase: string; feet: number; floor: number; grounded: boolean }[]>((resolve) => {
        const d = window.__PONCHO__!;
        const out: { phase: string; feet: number; floor: number; grounded: boolean }[] = [];
        const tick = () => {
          const c = d.carts()[0]!;
          const s = d.state();
          out.push({ phase: c.phase, feet: s.y, floor: c.y, grounded: s.grounded });
          if (c.phase === 'stopped' || out.length > 3000) resolve(out);
          else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
  );
  expect(seen[seen.length - 1]!.phase).toBe('stopped');
  const riding = seen.filter((s) => s.phase === 'rolling');
  expect(riding.length).toBeGreaterThan(3);
  for (const s of riding) expect([s.grounded, s.feet]).toEqual([true, s.floor]);
  const end = await page.evaluate(() => ({ cart: window.__PONCHO__!.carts()[0]!, feet: window.__PONCHO__!.state().y }));
  expect(end.cart).toMatchObject({ x: R1_STOP_X, y: R1.y - CART.floorPx, w: CART.width, phase: 'stopped' });
  expect(end.feet).toBe(end.cart.y);
  expect(errors).toEqual([]);
});

test('GDD-WLD-15 a jump straight up from the rolling cart lands back in it', async ({ page }) => {
  await hopIn(page);
  await page.evaluate(() => window.__PONCHO__!.step(3)); // nothing held, a step after the landing
  expect(await page.evaluate(() => window.__PONCHO__!.state().jumpWasHeld)).toBe(false);
  await page.evaluate(() => window.__PONCHO__!.pause(false));
  // The waits start before the press (L-042): the jump is about 34 steps in the air.
  const up = page.waitForFunction(() => !window.__PONCHO__!.state().grounded);
  await page.keyboard.down('Space');
  await up;
  const back = await page.waitForFunction(() => {
    const d = window.__PONCHO__!;
    const s = d.state();
    return s.grounded ? { feet: s.y, x: s.x, cart: d.carts()[0]! } : null;
  });
  await page.keyboard.up('Space');
  const landed = (await back.jsonValue())!;
  expect(landed.cart.phase).toBe('rolling');
  expect(landed.feet).toBe(landed.cart.y);
  expect(landed.x).toBeGreaterThan(landed.cart.x - 6);
  expect(landed.x).toBeLessThan(landed.cart.x + landed.cart.w + 6);
});

// GDD-ART-04: spots of his standing frame in his light fur and paw colours (not the outline, which the cart shares, nor the dark fur, near
// its rust), 1 game px across: his paws are on his frame's last two rows.
const SHEET = readSheet('poncho.png');
const FUR = ['#F1A361', '#FBDAB7', '#CD9A86', '#ECE3D9', '#C58D62'];

test('GDD-WLD-15 the cart\'s front wall is drawn over Poncho\'s feet', async ({ page }) => {
  await hopIn(page);
  // Rolled to its buffer and settled, then left to the game's own frames to draw (paused, so nothing moves).
  const stopped = await page.evaluate(() => {
    const d = window.__PONCHO__!;
    for (let i = 0; i < 300 && d.carts()[0]!.phase !== 'stopped'; i++) d.step(1);
    d.step(30);
    return { cart: d.carts()[0]!, s: d.state() };
  });
  expect(stopped.cart.phase).toBe('stopped');
  expect([stopped.s.grounded, stopped.s.y, stopped.s.vx]).toEqual([true, stopped.cart.y, 0]);
  await frames(page);
  const sprite = await page.evaluate(() => window.__PONCHO__!.ponchoSprite());
  const viewX = await page.evaluate(() => window.__PONCHO__!.camera().viewX);
  const scrollY = await page.evaluate(() => window.__PONCHO__!.cameraScrollY());
  // The spots of his frame within 3 px over his feet, inside the front wall's rust (which runs from 3 px over the floor to 2 px under it).
  const feet = spotsIn(SHEET, 48, 48, sprite.frame, FUR, { size: 1 })
    .map((p) => ({ x: sprite.centerX + (sprite.flipX ? -p.dx : p.dx), y: sprite.bottom - 24 + p.dy }))
    .filter((p) => p.y > stopped.s.y - 3 && p.y < stopped.s.y && p.x > stopped.cart.x + 2 && p.x < stopped.cart.x + stopped.cart.w - 2);
  expect(feet.length).toBeGreaterThan(0);
  const onScreen = await clearOfButtons(page, feet.map((p) => ({ x: p.x - viewX, y: p.y - scrollY })));
  expect(onScreen.length).toBeGreaterThan(0);
  const colours = await pixelsAt(page, onScreen);
  for (const c of colours) expect(nearHex(c, '#B0562E', 12), JSON.stringify(c)).toBe(true); // the tub's rust, not his fur
});
