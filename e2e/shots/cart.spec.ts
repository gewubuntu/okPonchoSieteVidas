// Screenshots of the vagonetas for visual review (GDD-WLD-15), in lab-3c. Run with `npm run shots`; images land in shots/ (not committed).
// The rails' places come from `src/levels/lab3c.ts` (L-062).
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { CART, TILE } from '../../src/config/tuning';
import { LAB_3C_BEAM, LAB_3C_OFRENDAS, LAB_3C_PIT, LAB_3C_RAILS, LAB_3C_SPAWN, LAB_3C_SUNKEN } from '../../src/levels/lab3c';
import { floorUnder, railLength, warningPost } from '../../src/sim/cart';
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
  expect(seen.cart.y! - seen.s.y).toBeGreaterThan(50);
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

/**
 * In cart `i`, rolling: with `held` 0 he is nudged to its middle and lets go of everything (his speed in it settles to 0); with 1 or -1 he
 * holds that way, against its front or back wall. Then it rolls on until its middle is at `midX`.
 */
const standIn = (page: Page, i: number, held: -1 | 0 | 1, midX: number) =>
  page.evaluate(
    ({ k, move, until }) => {
      const d = window.__PONCHO__!;
      const off = () => d.state().x - (d.carts()[k]!.x! + 16);
      if (move === 0) {
        // Walked towards the middle while it is further than he slides to a stop (v² / 2000 px at 1000 px/s², GDD-MOV-01), then settled.
        for (let n = 0; n < 60 && Math.abs(off()) > 0.5 + d.state().vx ** 2 / 2000; n++) d.step(1, { move: -Math.sign(off()), jumpHeld: false });
        for (let n = 0; n < 60 && d.state().vx !== 0; n++) d.step(1);
      }
      for (let n = 0; n < 300 && d.carts()[k]!.x! + 16 < until; n++) d.step(1, { move, jumpHeld: false });
    },
    { k: i, move: held, until: midX },
  );

/** Where a slope shot finds him and the cart: rolling, tilted by `angle`, his feet on the floor under them, `offset` px from its middle. */
const onSlope = async (page: Page, i: number, angle: number, offset: number, near: number) => {
  const r = LAB_3C_RAILS[i]!;
  const seen = await cart(page, i);
  expect(seen.cart.phase).toBe('rolling');
  expect(seen.cart.angle!).toBeCloseTo(angle, 6); // drawn tilted (`cartPose`)
  expect(seen.s.grounded).toBe(true);
  expect(seen.s.y).toBeCloseTo(floorUnder(r, { phase: 'rolling', m: seen.cart.x! + 16 - r.x }, seen.s.x).y, 6); // the floor under his feet
  expect(Math.abs(seen.s.x - (seen.cart.x! + 16) - offset)).toBeLessThanOrEqual(near);
};

// R2 climbs from 4 tiles across (64 px) to 8 (128 px): rolled on until the cart's middle is halfway up, 96 px across. R3 descends from 32 px
// across to 96: halfway down at 64. On a slope its walls hold him 10 / sqrt(2) = 7.07 px from its middle.
const R2_HALF = LAB_3C_RAILS[1]!.x + 96;
const R3_HALF = LAB_3C_RAILS[2]!.x + 64;
const WALL = 10 / Math.SQRT2;

test('GDD-WLD-15 vagonetas: climbing R2\'s slope to the plateau, standing at the cart\'s middle', async ({ page, isMobile }, info) => {
  await open(page, isMobile, LAB_3C_OFRENDAS[0]);
  expect(await hopInto(page, 1)).toBeLessThan(300);
  await standIn(page, 1, 0, R2_HALF);
  await onSlope(page, 1, -45, 0, 1);
  await shot(page, info, 'cart-climb');
});

test('GDD-WLD-15 vagonetas: climbing R2\'s slope, at the front wall', async ({ page, isMobile }, info) => {
  await open(page, isMobile, LAB_3C_OFRENDAS[0]);
  expect(await hopInto(page, 1)).toBeLessThan(300);
  await standIn(page, 1, 1, R2_HALF);
  await onSlope(page, 1, -45, WALL, 1e-6);
  await shot(page, info, 'cart-climb-front');
});

test('GDD-WLD-15 vagonetas: riding R3 down its descent, standing at the cart\'s middle', async ({ page, isMobile }, info) => {
  await open(page, isMobile, LAB_3C_OFRENDAS[1]);
  expect(await hopInto(page, 2)).toBeLessThan(300);
  await standIn(page, 2, 0, R3_HALF);
  await onSlope(page, 2, 45, 0, 1);
  await shot(page, info, 'cart-descent');
});

test('GDD-WLD-15 vagonetas: riding R3 down its descent, at the back wall', async ({ page, isMobile }, info) => {
  await open(page, isMobile, LAB_3C_OFRENDAS[1]);
  expect(await hopInto(page, 2)).toBeLessThan(300);
  await standIn(page, 2, -1, R3_HALF);
  await onSlope(page, 2, 45, -WALL, 1e-6);
  await shot(page, info, 'cart-descent-back');
});

test('GDD-WLD-15 vagonetas: R4 rolling left', async ({ page, isMobile }, info) => {
  await open(page, isMobile, LAB_3C_OFRENDAS[2]);
  expect(await hopInto(page, 3)).toBeLessThan(300);
  const r4 = LAB_3C_RAILS[3]!;
  await page.evaluate(() => window.__PONCHO__!.step(30));
  const seen = await cart(page, 3);
  expect(seen.cart.phase).toBe('rolling');
  expect(seen.cart.x! + 16).toBeLessThan(r4.x - 16 - 50); // gone left from its start
  expect([seen.s.grounded, seen.s.y]).toEqual([true, seen.cart.y]);
  await shot(page, info, 'cart-left');
});

/** When `rideOn` stops: each field given must hold. */
interface Until {
  /** The cart's middle at or past this x, and Poncho standing. */
  readonly middle?: number;
  /** The cart falling, and Poncho in the air past this x. */
  readonly airPast?: number;
  /** The cart falling, its box's bottom within one step's fall (6 px at 360 px/s) of this y. */
  readonly nearFloor?: number;
}

/**
 * Rides cart `i` on, by steps: standing in it, a full jump (held while rising) when his x is 35 px before the hanging beam's near face
 * (`beam`), or when its middle is 20 px before the rail's end (`end`); in the air, jump held while rising. Until `until` holds, at most 400
 * steps; the steps it took.
 */
const rideOn = (page: Page, i: number, o: { beam?: number; end?: number }, until: Until) =>
  page.evaluate(
    ({ k, beam, end, stop }) => {
      const d = window.__PONCHO__!;
      const done = () => {
        const c = d.carts()[k]!;
        const s = d.state();
        if (stop.middle !== undefined && !(c.x! + 16 >= stop.middle && s.grounded)) return false;
        if (stop.airPast !== undefined && !(c.phase === 'falling' && !s.grounded && s.x > stop.airPast)) return false;
        if (stop.nearFloor !== undefined && !(c.phase === 'falling' && c.y! + c.h! + 6 >= stop.nearFloor)) return false;
        return true;
      };
      let jumpWas = d.state().jumpWasHeld;
      let hopped = false;
      let n = 0;
      for (; n < 400 && !done(); n++) {
        const c = d.carts()[k]!;
        const s = d.state();
        const middle = c.x! + 16;
        const inCart = c.phase === 'rolling' && s.grounded && s.y === c.y && Math.abs(s.x - middle) < 22;
        let input = { move: 0, jumpHeld: !s.grounded && jumpWas && s.vy < 0 };
        if (inCart && !jumpWas) {
          const atBeam = beam !== null && !hopped && beam - s.x <= 35;
          if (atBeam) hopped = true;
          input = { move: 0, jumpHeld: atBeam || (end !== null && end - middle <= 20) };
        }
        jumpWas = input.jumpHeld;
        d.step(1, input);
      }
      return n;
    },
    { k: i, beam: o.beam ?? null, end: o.end ?? null, stop: until },
  );

const R5 = LAB_3C_RAILS[4]!;
const R6 = LAB_3C_RAILS[5]!;
const BEAM_FACE = LAB_3C_BEAM.col * TILE;

test('GDD-WLD-15 vagonetas: R5\'s warning post and broken end ahead, then the jump out over the pit', async ({ page, isMobile }, info) => {
  await open(page, isMobile, LAB_3C_OFRENDAS[2]);
  expect(await hopInto(page, 4)).toBeLessThan(300);
  const post = warningPost(R5)!;
  // Riding on, the beam hopped, until the cart's middle is 3 tiles before the post: the post and the broken end ahead of him.
  expect(await rideOn(page, 4, { beam: BEAM_FACE }, { middle: post.x - 3 * TILE })).toBeLessThan(400);
  let seen = await cart(page, 4);
  expect(seen.cart.phase).toBe('rolling');
  expect([seen.s.grounded, seen.s.y]).toEqual([true, seen.cart.y]);
  expect(post.x - seen.s.x).toBeGreaterThan(0);
  await shot(page, info, 'cart-post');

  // He jumps 20 px before the end; once the cart has left the rail and he is over the pit, still in the air.
  const pit = { x0: LAB_3C_PIT.col0 * TILE, x1: (LAB_3C_PIT.col1 + 1) * TILE };
  expect(await rideOn(page, 4, { end: R5.x + railLength(R5) }, { airPast: pit.x0 })).toBeLessThan(400);
  seen = await cart(page, 4);
  expect(seen.cart.phase).toBe('falling');
  expect(seen.s.grounded).toBe(false);
  expect(seen.s.x).toBeGreaterThan(pit.x0);
  expect(seen.s.x).toBeLessThan(pit.x1);
  expect(seen.cart.y!).toBeGreaterThan(seen.s.y - 32); // the cart under him, falling
  await shot(page, info, 'cart-jump-out');
});

test('GDD-WLD-15 vagonetas: R6\'s cart about to break on the sunken floor', async ({ page, isMobile }, info) => {
  await open(page, isMobile, { x: R6.x - 3 * TILE, y: R6.y });
  expect(await hopInto(page, 5)).toBeLessThan(300);
  // He stays in; the step before it breaks: falling, its box's bottom within one step's fall (6 px at 360 px/s) of the sunken floor's top.
  const top = LAB_3C_SUNKEN.row * TILE;
  expect(await rideOn(page, 5, {}, { nearFloor: top })).toBeLessThan(400);
  const seen = await cart(page, 5);
  expect(seen.cart.phase).toBe('falling');
  expect(seen.cart.y! + CART.height).toBeLessThanOrEqual(top);
  expect(seen.cart.x!).toBeGreaterThanOrEqual(LAB_3C_SUNKEN.col0 * TILE);
  await shot(page, info, 'cart-broken-floor');
});

test('GDD-WLD-15 vagonetas: an empty cart back at its start, on R1', async ({ page, isMobile }, info) => {
  await open(page, isMobile);
  expect(await hopInto(page, 0)).toBeLessThan(300);
  // He jumps out at once holding back, so it rolls on to its buffer with nobody in it; it is back at its start 2.0 s after it stops.
  const steps = await page.evaluate(() => {
    const d = window.__PONCHO__!;
    d.step(3);
    d.step(40, { move: -1, jumpHeld: true });
    let stopped = false;
    let n = 0;
    for (; n < 400 && !(stopped && d.carts()[0]!.phase === 'waiting'); n++) {
      d.step(1);
      stopped ||= d.carts()[0]!.phase === 'stopped';
    }
    d.step(20);
    return n;
  });
  expect(steps).toBeLessThan(400);
  const seen = await cart(page, 0);
  expect(seen.cart).toMatchObject({ phase: 'waiting', x: LAB_3C_RAILS[0]!.x });
  expect(seen.s.grounded).toBe(true);
  expect(seen.s.y).toBe(LAB_3C_RAILS[0]!.y); // on the ground, not in it
  await shot(page, info, 'cart-returned');
});
