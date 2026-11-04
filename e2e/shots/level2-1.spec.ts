// Screenshots of level 2-1 "El Tianguis" for visual review (GDD-WLD-12, GDD-WLD-10, GDD-WLD-11, GDD-ENM-03, GDD-ART-06). Run with
// `npm run shots`; images land in shots/ (not committed). Each scene is reached as src/levels/level2-1.test.ts plays it: Poncho is put
// on the floor before the spot, then the real inputs run step by step in the paused game (L-042) until the moment the mechanic shows.
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { LEVEL_2_1 } from '../../src/levels/level2-1';
import { start } from '../helpers';

const shot = async (page: Page, info: TestInfo, name: string) => {
  await page.waitForTimeout(250); // L-042: real time only lets the frame render before the picture; nothing is timed by it
  await page.screenshot({ path: `shots/${name}-${info.project.name.replace('shots-', '')}.png` });
};

/** The middle of tile column `col`, in px. */
const mid = (col: number) => col * 16 + 8;

/**
 * Starts 2-1 the device's way (L-045), collects the two floor hilos at columns 5 and 7 by holding right (L-045: the HUD shows a count a
 * player could see), pauses, and puts Poncho at (x, y), in the air at rest: the next step lands him.
 */
async function begin(page: Page, isMobile: boolean, x: number, y: number): Promise<void> {
  await start(page, isMobile, '/?level=2-1');
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 10);
  await page.evaluate(() => {
    const d = window.__PONCHO__!;
    d.pause(true);
    d.step(45, { move: 1, jumpHeld: false });
  });
  expect((await page.evaluate(() => window.__PONCHO__!.hilos())).taken).toBe(2);
  await page.evaluate(([px, py]) => {
    const d = window.__PONCHO__!;
    d.teleport(px!, py!);
    d.step(2);
  }, [x, y]);
}

/** The camera's rightmost left edge: the level's width less one screen of 480 px (L-061: read from the level). */
const EDGE = LEVEL_2_1.world.width * 16 - 480;

/** Waits until the camera has followed Poncho: its left edge 256 px left of him, inside the level (GDD-UI-04). */
const followed = (page: Page) =>
  page.waitForFunction((edge) => {
    const d = window.__PONCHO__!;
    const want = Math.min(edge, Math.max(0, Math.round(d.state().x) - 256));
    return Math.abs(d.camera().viewX - want) <= 1 && Math.abs(d.bodyPose().x - d.state().x) < 0.01;
  }, EDGE);

test('GDD-WLD-10 2-1: the first awning, a held rebound up its hilo column, the cloth sagging under tier 2', async ({ page, isMobile }, info) => {
  await begin(page, isMobile, mid(32), 224);
  // A jump from the floor under the column lands on the awning and settles after one small hop (the Ki), then jump is let go for a step.
  const settled = await page.evaluate(() => {
    const d = window.__PONCHO__!;
    for (let i = 0; i < 90; i++) {
      d.step(1, { move: 0, jumpHeld: i < 20 });
      if (i > 25 && d.state().grounded && d.state().y === 192) break;
    }
    d.step(1);
    return d.state();
  });
  expect(settled).toMatchObject({ y: 192, grounded: true });
  // Held: the jump, tier 1, then the tier 2 rebound; two steps after it the cloth sags 4 px and he is on his way up.
  const tier = await page.evaluate(() => {
    const d = window.__PONCHO__!;
    let last = d.market().bounce?.at;
    for (let i = 0; i < 200; i++) {
      d.step(1, { move: 0, jumpHeld: true });
      const b = d.market().bounce;
      if (b && b.at !== last && b.tier === 2) break;
      last = b?.at;
    }
    d.step(2, { move: 0, jumpHeld: true });
    return d.market().bounce!.tier;
  });
  expect(tier).toBe(2);
  await followed(page);
  await page.waitForFunction(() => window.__PONCHO__!.market().awnings[0]!.sag === 4);
  expect((await page.evaluate(() => window.__PONCHO__!.state())).vy).toBeLessThan(0);
  expect((await page.evaluate(() => window.__PONCHO__!.hilos())).taken).toBe(4); // the column's lower two, its upper two still hanging
  await shot(page, info, 'level2-1-awning');
});

test('GDD-WLD-10 2-1: the tier ladder, from the stall row up the ladder awning onto the first rooftop', async ({ page, isMobile }, info) => {
  // Holding jump and right from the floor past the first ofrenda: the stalls at tiers 1, 2 and 3, then the ladder awning against
  // the rooftop's wall; two steps after its rebound the cloth sags 6 px under him.
  await begin(page, isMobile, 1015, 224); // as the level test starts it, 1 column before the first stall
  const seen = await page.evaluate(() => {
    const d = window.__PONCHO__!;
    const out: [number, number][] = [];
    let last = d.market().bounce?.at;
    for (let i = 0; i < 300; i++) {
      d.step(1, { move: 1, jumpHeld: true });
      const b = d.market().bounce;
      if (b && b.at !== last) out.push([b.awning, b.tier]);
      last = b?.at;
      if (b?.awning === 4) break;
    }
    d.step(2, { move: 1, jumpHeld: true });
    return out;
  });
  expect(seen).toEqual([[1, 1], [2, 2], [3, 3], [4, 3]]);
  await followed(page);
  await page.waitForFunction(() => window.__PONCHO__!.market().awnings[4]!.sag === 6);
  expect(await page.evaluate(() => window.__PONCHO__!.lives())).toBe(7);
  await shot(page, info, 'level2-1-ladder');
});

test('GDD-ENM-03 2-1: the first Paloma telegraphs as Poncho comes near, then hovers while he walks under it', async ({ page, isMobile }, info) => {
  // On the crate before its pen, out of its sight, he waits until it walks to the pen's far half; then, as the level test plays it, he
  // walks up while it walks, waits while it telegraphs and rises, and walks under it while it hovers.
  await begin(page, isMobile, mid(48), 176);
  await page.evaluate(() => {
    const d = window.__PONCHO__!;
    for (let i = 0; i < 600 && !(d.enemies()[1]!.phase === 'walk' && d.enemies()[1]!.x > 860); i++) d.step(1);
  });
  const play = (until: 'telegraph' | 'under') =>
    page.evaluate((goal) => {
      const d = window.__PONCHO__!;
      for (let i = 0; i < 400; i++) {
        const s = d.enemies()[1]!;
        const x = d.state().x;
        if (goal === 'telegraph' && s.phase === 'telegraph') return i > 0 ? s.phase : 'already';
        if (goal === 'under' && s.phase === 'hover' && Math.abs(x - s.x) < 4) return s.phase;
        const go = s.phase === 'walk' ? x < s.x - 20 : s.phase === 'hover' || x > s.x + 14;
        d.step(1, { move: go ? 1 : 0, jumpHeld: false });
      }
      return 'never';
    }, until);
  expect(await play('telegraph')).toBe('telegraph');
  // It started on the step before: 9 steps on, its body is in its second red flash (on 4 steps, off 4, GDD-ENM-01).
  await page.evaluate(() => window.__PONCHO__!.step(9));
  expect((await page.evaluate(() => window.__PONCHO__!.enemies()))[1]!.phase).toBe('telegraph');
  await followed(page);
  await shot(page, info, 'level2-1-paloma-telegraph');
  expect(await play('under')).toBe('hover');
  await followed(page);
  expect(await page.evaluate(() => window.__PONCHO__!.lives())).toBe(7);
  await shot(page, info, 'level2-1-paloma-hover');
});

test('GDD-WLD-10 GDD-ENM-03 2-1: the rung, a tier 1 rebound coming down on the rung Paloma, the landing awning and the third rooftop ahead', async ({ page, isMobile }, info) => {
  // At the second ofrenda (column 126), out of the rung Paloma's sight, he waits until it walks back towards the pen's crate from x 2210,
  // where the level test's 2 s wait finds it; then, as that test plays the rung, he runs, presses jump past x 2040 and holds it: the
  // take-off awning (the seventh) throws him at tier 1 over the crate, and the picture is taken as he comes down on the Paloma, his feet
  // 12 px or less over its top (y 212), the step before the stomp; the level test then has the stomp keep the chain and the landing
  // awning throw him at tier 2 onto the rooftop.
  await begin(page, isMobile, LEVEL_2_1.ofrendas[1]!.x, 224);
  const fall = await page.evaluate(() => {
    const d = window.__PONCHO__!;
    for (let i = 0; i < 800; i++) {
      const s = d.enemies()[4]!;
      if (s.phase === 'walk' && s.dir < 0 && Math.abs(s.x - 2210) < 0.2) break;
      d.step(1);
    }
    let pressed = false;
    for (let i = 0; i < 200; i++) {
      pressed ||= d.state().x > 2040;
      const p = d.state();
      const b = d.market().bounce;
      if (b?.awning === 6 && b.tier === 1 && p.vy > 0 && p.y >= 200 && d.enemies()[4]!.alive) break;
      d.step(1, { move: 1, jumpHeld: pressed });
    }
    return { player: d.state(), paloma: d.enemies()[4]!, chain: d.market().chain };
  });
  expect(fall.paloma.alive).toBe(true);
  expect(fall.chain).toBe(1);
  expect(fall.player.vy).toBeGreaterThan(0);
  expect(fall.player.y).toBeGreaterThanOrEqual(200);
  expect(fall.player.y).toBeLessThan(212);
  expect(Math.abs(fall.player.x - fall.paloma.x)).toBeLessThan(13); // over it: the boxes overlap across
  await followed(page);
  expect(await page.evaluate(() => window.__PONCHO__!.lives())).toBe(7);
  await shot(page, info, 'level2-1-rung');
  // Within the next few steps, jump still held, he stomps it and keeps the chain (the level test measures the rest).
  const after = await page.evaluate(() => {
    const d = window.__PONCHO__!;
    for (let i = 0; i < 4 && d.enemies()[4]!.alive; i++) d.step(1, { move: 1, jumpHeld: true });
    return { alive: d.enemies()[4]!.alive, chain: d.market().chain, lives: d.lives() };
  });
  expect(after).toEqual({ alive: false, chain: 1, lives: 7 });
});

test('GDD-WLD-10 2-1: the pit awning, a running jump past the hovering Paloma rebounds off it over the pit', async ({ page, isMobile }, info) => {
  // On the crate before the pit Paloma's pen (column 161), out of its sight, he waits until it walks right past its start (x 2632);
  // then he is put on the pen's floor 30 px from it, where the level test starts him, and plays it as that test does: he waits while it
  // telegraphs and rises, walks under it while it hovers, jumps from the edge (past x 2640) and holds jump through the landing on the pit
  // awning (the ninth). Three steps after the rebound he is over the pit, the cloth sagging.
  await begin(page, isMobile, mid(161), 176);
  const bounce = await page.evaluate(() => {
    const d = window.__PONCHO__!;
    for (let i = 0; i < 600; i++) {
      const s = d.enemies()[5]!;
      if (s.phase === 'walk' && s.dir > 0 && Math.abs(s.x - 2632) < 0.2) break;
      d.step(1);
    }
    d.teleport(2602, 224);
    let jumped = -1;
    for (let i = 0; i < 400; i++) {
      const hover = d.enemies()[5]!.phase === 'hover';
      if (hover && jumped < 0 && d.state().x > 2640) jumped = i;
      d.step(1, { move: hover || jumped >= 0 ? 1 : 0, jumpHeld: jumped >= 0 && i - jumped < 40 });
      if (d.market().bounce?.awning === 8 || d.lives() < 7) break;
    }
    d.step(3, { move: 1, jumpHeld: true });
    return d.market().bounce;
  });
  expect(bounce).toMatchObject({ awning: 8, tier: 1 });
  await followed(page);
  expect(await page.evaluate(() => window.__PONCHO__!.lives())).toBe(7);
  await shot(page, info, 'level2-1-pit');
});

test('GDD-WLD-11 2-1: the cordel staircase, Poncho at the top of his jump from the lower cordel to the upper', async ({ page, isMobile }, info) => {
  await begin(page, isMobile, mid(185), 224);
  /** A full jump drifting a little right, as the level test hops: returns where he lands. */
  const hop = (peak: boolean) =>
    page.evaluate((stopAtPeak) => {
      const d = window.__PONCHO__!;
      for (let i = 0; i < 80; i++) {
        d.step(1, { move: i < 20 ? 0.4 : 0, jumpHeld: i < 25 });
        if (stopAtPeak && i > 3 && d.state().vy >= 0) return d.state().y;
        if (i > 3 && d.state().grounded) return d.state().y;
      }
      return -1;
    }, peak);
  expect(await hop(false)).toBe(176); // onto the lower cordel
  await page.evaluate(() => window.__PONCHO__!.step(1));
  expect(await hop(true)).toBeLessThan(128); // over the upper cordel's line
  await followed(page);
  await shot(page, info, 'level2-1-cordel');
});

test('GDD-WLD-12 2-1: the last stall row climbs to the exit rooftop, Poncho on it with the exit ahead', async ({ page, isMobile }, info) => {
  // Holding jump and right from the floor before the last stalls: tiers 1, 2 and 3, the third onto the exit's rooftop (y 80).
  await begin(page, isMobile, 3430, 224); // on the floor 2 columns before the first of the last stalls (216)
  const top = await page.evaluate(() => {
    const d = window.__PONCHO__!;
    for (let i = 0; i < 400; i++) {
      const p = d.state();
      d.step(1, { move: 1, jumpHeld: !(p.grounded && p.y === 80) });
      if (d.state().grounded && d.state().y === 80 && d.state().x > 3708) break;
    }
    d.step(30); // right let go: he stops short of the exit (x 3752), past the decor on the roof's edge
    return d.state();
  });
  expect(top).toMatchObject({ y: 80, grounded: true });
  expect(top.x).toBeGreaterThan(3712);
  expect(top.x).toBeLessThan(LEVEL_2_1.exit!.x - 14);
  await followed(page);
  expect(await page.evaluate(() => window.__PONCHO__!.exitDrawn())).toBe(true);
  expect(await page.evaluate(() => window.__PONCHO__!.phase())).toBe('playing');
  await shot(page, info, 'level2-1-exit');
});
