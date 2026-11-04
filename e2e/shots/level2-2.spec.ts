// Screenshots of level 2-2 "Mercado Municipal" for visual review (GDD-WLD-13, GDD-WLD-11, GDD-WLD-10, GDD-ENM-03, GDD-PWR-03). Run with
// `npm run shots`; images land in shots/ (not committed). Each scene is reached as src/levels/level2-2.test.ts's bot plays it: Poncho is
// put on the ground before the spot, then the real inputs run step by step in the paused game (L-042) until the moment the mechanic shows.
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { start } from '../helpers';

const shot = async (page: Page, info: TestInfo, name: string) => {
  await page.waitForTimeout(250); // L-042: real time only lets the frame render before the picture; nothing is timed by it
  await page.screenshot({ path: `shots/${name}-${info.project.name.replace('shots-', '')}.png` });
};

/**
 * Starts 2-2 the device's way (L-045), collects the first three hilos on the floor by holding right (L-045: the HUD shows a count a player
 * could see), pauses, and puts Poncho at (x, y), in the air at rest: the next steps land him.
 */
async function begin(page: Page, isMobile: boolean, x: number, y: number): Promise<void> {
  await start(page, isMobile, '/?level=2-2');
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 10);
  await page.evaluate(() => {
    const d = window.__PONCHO__!;
    d.pause(true);
    d.step(35, { move: 1, jumpHeld: false });
  });
  expect((await page.evaluate(() => window.__PONCHO__!.hilos())).taken).toBe(3);
  await page.evaluate(([px, py]) => {
    const d = window.__PONCHO__!;
    d.teleport(px!, py!);
    d.step(3);
  }, [x, y]);
}

/** The bot's `goTo`: walks right to just short of `x` on the ground and stops there, facing right (it never overshoots). */
const goTo = (page: Page, x: number) =>
  page.evaluate((target) => {
    const d = window.__PONCHO__!;
    for (let i = 0; i < 300; i++) {
      const p = d.state();
      if (p.grounded && Math.abs(p.vx) < 1e-9 && target - p.x < 4) return p.x;
      d.step(1, { move: p.x + (p.vx * p.vx) / 2000 + p.vx / 60 < target ? 1 : 0, jumpHeld: false });
    }
    return d.state().x;
  }, x);

/** The bot's `jump`: holds jump `n` steps moving `move`, then keeps moving `after` until he lands. Returns his feet's y. */
const jump = (page: Page, n: number, move: number, after = move) =>
  page.evaluate(([k, m, a]) => {
    const d = window.__PONCHO__!;
    for (let t = 0; t < 200; t++) {
      if (t > k! + 2 && d.state().grounded) break;
      d.step(1, { move: t < k! ? m! : a!, jumpHeld: t < k! });
    }
    d.step(1); // jump let go for a step before the next press (L-048)
    return d.state().y;
  }, [n, move, after]);

/** Waits until the camera has followed Poncho: its left edge 256 px left of him, inside the level (GDD-UI-04). */
const followed = (page: Page) =>
  page.waitForFunction(() => {
    const d = window.__PONCHO__!;
    const want = Math.min(2400, Math.max(0, Math.round(d.state().x) - 256));
    return Math.abs(d.camera().viewX - want) <= 1 && Math.abs(d.bodyPose().x - d.state().x) < 0.01;
  });

test('GDD-WLD-11 2-2: a rollo over a floor pit, rolled up before the claw, then unrolling ahead of Poncho as he runs onto it', async ({ page, isMobile }, info) => {
  // The bot's crossRollo(1): at the pit's edge (x 777), a claw swipe, two steps, then a running jump held right onto the line.
  // The first shot is on his way there, 20 px short of the edge, so his body does not cover the bundle at the post (x 784 to 796).
  await begin(page, isMobile, 740, 224);
  expect(await goTo(page, 760)).toBeGreaterThan(755);
  const before = await page.evaluate(() => window.__PONCHO__!.market());
  expect(before.unrolled[1]).toBeNull();
  expect(before.rollos[1]!.bundle).not.toBeNull();
  await followed(page);
  await shot(page, info, 'level2-2-rollo-before');
  expect(await goTo(page, 777)).toBeGreaterThan(772);
  const front = await page.evaluate(() => {
    const d = window.__PONCHO__!;
    d.step(1, { move: 0, jumpHeld: false, claw: true });
    for (let i = 0; i < 10 && (d.market().unrolled[1] ?? -1) < 2; i++) d.step(1);
    // The running jump, until the strung line is half its 96 px: its front 48 px from the post.
    for (let t = 0; t < 60 && (d.market().unrolled[1] ?? 0) < 18; t++) d.step(1, { move: 1, jumpHeld: t < 20 });
    return { steps: d.market().unrolled[1]!, x: d.state().x, y: d.state().y };
  });
  expect(front.steps).toBe(18);
  expect(784 + (18 * 160) / 60).toBeGreaterThan(front.x + 6); // the line's front (48 px from the post at 784) ahead of his body
  expect(front.y).toBeLessThan(216);
  await followed(page);
  expect(await page.evaluate(() => window.__PONCHO__!.lives())).toBe(7);
  await shot(page, info, 'level2-2-rollo-unrolling');
});

test('GDD-ENM-03 2-2: the first Chapulín crouching in its pen, Poncho watching from the pen wall', async ({ page, isMobile }, info) => {
  // On top of the pen's left wall (column 33, 2 tiles high), out of its hops; the shot is halfway through a crouch (36 steps).
  await begin(page, isMobile, 536, 176);
  const seen = await page.evaluate(() => {
    const d = window.__PONCHO__!;
    let before = d.enemies()[0]!.phase;
    for (let i = 0; i < 600; i++) {
      d.step(1);
      const s = d.enemies()[0]!;
      if (s.phase === 'crouch' && before === 'air' && s.x < 600) break;
      before = s.phase;
    }
    d.step(18);
    return d.enemies()[0]!;
  });
  expect(seen.phase).toBe('crouch');
  expect(await page.evaluate(() => window.__PONCHO__!.state())).toMatchObject({ y: 192, grounded: true });
  await followed(page);
  await shot(page, info, 'level2-2-chapulin-crouch');
});

test('GDD-ENM-03 GDD-WLD-10 2-2: the second Chapulín thrown high by the awning it hops on, Poncho on the flower stall wall', async ({ page, isMobile }, info) => {
  // Poncho watches from the top of the flower stall's wall (columns 87 to 89, y 128), past the awning and out of the Chapulín's hops,
  // so the awning is in the middle of the screen, clear of the phone's buttons. The shot is a hop off the awning, near its top.
  await begin(page, isMobile, 1416, 112);
  await page.evaluate(() => window.__PONCHO__!.step(10));
  expect(await page.evaluate(() => window.__PONCHO__!.state())).toMatchObject({ y: 128, grounded: true });
  const air = await page.evaluate(() => {
    const d = window.__PONCHO__!;
    let low = 999;
    for (let i = 0; i < 900; i++) {
      d.step(1);
      const s = d.enemies()[2]!;
      // Over the awning (x 1312 to 1392), rising off it: once it has risen 48 px above the cloth.
      if (s.phase === 'air' && s.x > 1312 && s.x < 1392 && s.y < 160 && s.y < low) low = s.y;
      if (low < 160 && s.y > low) return { ...s, peak: low };
    }
    return { ...d.enemies()[2]!, peak: low };
  });
  expect(air.phase).toBe('air');
  expect(air.peak).toBeLessThan(160);
  expect(await page.evaluate(() => window.__PONCHO__!.lives())).toBe(7);
  await followed(page);
  await shot(page, info, 'level2-2-chapulin-awning');
});

test('GDD-PWR-03 GDD-WLD-11 2-2: the chile from the piñata, then a fireball from the walkway unrolls the bundle the claw cannot reach', async ({ page, isMobile }, info) => {
  // The bot's Ten from the second ofrenda: the taco on the floor, a jump under the piñata gives the chile on its top, up onto the
  // walkway, a hop left onto the piñata takes it, back onto the walkway, and a fireball from x 1750 at the bundle past the spikes.
  await begin(page, isMobile, 1592, 224);
  await page.evaluate(() => window.__PONCHO__!.step(18, { move: 1, jumpHeld: false }));
  expect(await page.evaluate(() => window.__PONCHO__!.power())).toBe('taco');
  await goTo(page, 1655);
  await jump(page, 20, 0);
  expect(await page.evaluate(() => window.__PONCHO__!.pinatasDrawn())).toEqual([true]);
  /** A full jump steering right while his drift would not carry his centre past `x` (level2-3.test.ts's `towards`); returns where he lands. */
  const hopTo = (x: number) =>
    page.evaluate((target) => {
      const d = window.__PONCHO__!;
      for (let t = 0; t < 120; t++) {
        if (t > 3 && d.state().grounded) break;
        const p = d.state();
        d.step(1, { move: p.x + (p.vx * Math.abs(p.vx)) / 600 < target ? 1 : 0, jumpHeld: t < 20 });
      }
      d.step(1); // jump let go for a step before the next press (L-048)
      return d.state();
    }, x);
  await goTo(page, 1676);
  expect(await hopTo(1704)).toMatchObject({ y: 176, grounded: true }); // onto the walkway (its wall at x 1696), where the bot's run comes down
  await goTo(page, 1705);
  expect(await jump(page, 20, -1, 0)).toBe(160); // onto the piñata's top, taking the chile
  expect(await page.evaluate(() => window.__PONCHO__!.power())).toBe('fuego');
  await page.evaluate(() => window.__PONCHO__!.step(10)); // he stops on the piñata's top
  expect(await hopTo(1730)).toMatchObject({ y: 176, grounded: true });
  await goTo(page, 1750);
  const flying = await page.evaluate(() => {
    const d = window.__PONCHO__!;
    d.step(1, { move: 0, jumpHeld: false, fuego: true });
    for (let i = 0; i < 60 && d.fireballAt().length > 0 && d.fireballAt()[0]!.x < 1800; i++) d.step(1);
    return d.fireballAt();
  });
  expect(flying).toHaveLength(1);
  expect(await page.evaluate(() => window.__PONCHO__!.market().unrolled[4])).toBeNull();
  await followed(page);
  await shot(page, info, 'level2-2-fireball');
  // As the bot goes on: once the bundle is hit, right held and a jump from the walkway's edge (x 1772) onto the bridge as it unrolls, over
  // the spikes. The shot is 8 steps after he lands on it, running along it, the camera past the phone's buttons.
  const bridge = await page.evaluate(() => {
    const d = window.__PONCHO__!;
    for (let i = 0; i < 60 && d.market().unrolled[4] === null; i++) d.step(1);
    for (let t = 0; t < 120; t++) {
      if (t > 10 && d.state().grounded && d.state().y === 200) break;
      d.step(1, { move: 1, jumpHeld: d.state().x >= 1772 && t < 60 });
    }
    d.step(8, { move: 1, jumpHeld: false });
    return { ...d.state(), unrolled: d.market().unrolled[4] };
  });
  expect(bridge).toMatchObject({ y: 200, grounded: true });
  expect(bridge.x).toBeGreaterThan(1840);
  expect(bridge.x).toBeLessThan(1936);
  expect(await page.evaluate(() => window.__PONCHO__!.power())).toBe('fuego');
  await followed(page);
  expect(await page.evaluate(() => window.__PONCHO__!.lives())).toBe(7);
  await shot(page, info, 'level2-2-fireball-bridge');
});

test('GDD-WLD-11 2-2: the finale, a jump from the last awning and a claw in mid-air unrolls the high bundle', async ({ page, isMobile }, info) => {
  // The bot's end of the route: from the wall before the last awning a hop onto it, to its right end, then the finale: jump held, the
  // claw pressed once on the way up (feet above y 152), right once the bundle is clawed. The shot is two steps into the swipe.
  await begin(page, isMobile, 2490, 176);
  await goTo(page, 2512);
  expect(
    await page.evaluate(() => {
      const d = window.__PONCHO__!;
      for (let t = 0; t < 120; t++) {
        if (t > 3 && d.state().grounded) break;
        d.step(1, { move: d.state().x < 2560 ? 1 : 0, jumpHeld: t < 20 });
      }
      d.step(1);
      return d.state().y;
    }),
  ).toBe(160);
  await goTo(page, 2588);
  const swipe = await page.evaluate(() => {
    const d = window.__PONCHO__!;
    d.step(1);
    for (let i = 0; i < 60; i++) {
      const p = d.state();
      const claw = p.vy < 0 && p.y < 152;
      d.step(1, { move: 0, jumpHeld: true, claw });
      if (claw) break;
    }
    d.step(2, { move: 1, jumpHeld: true });
    return { claw: d.claw(), unrolled: d.market().unrolled[6], y: d.state().y };
  });
  expect(swipe.claw).toBe('swing');
  expect(swipe.unrolled).not.toBeNull();
  expect(swipe.y).toBeLessThan(152);
  await followed(page);
  await page.waitForFunction(() => window.__PONCHO__!.clawDrawn() === 'swing');
  expect(await page.evaluate(() => window.__PONCHO__!.lives())).toBe(7);
  await shot(page, info, 'level2-2-finale-claw');
});
