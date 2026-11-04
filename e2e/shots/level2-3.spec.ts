// Screenshots of level 2-3 "Azoteas" for visual review (GDD-WLD-14, GDD-WLD-10, GDD-WLD-11, GDD-ENM-03, GDD-CMB-02). Run with
// `npm run shots`; images land in shots/ (not committed). Each scene is reached as src/levels/level2-3.test.ts plays it: Poncho is put on
// the roof before the spot, then the real inputs run step by step in the paused game (L-042) until the moment the mechanic shows. Where
// things are comes from the level module (L-061); the numbers left are the test's steering targets, commented where they are used.
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { AWNINGS_2_3, ENEMIES_2_3, LEVEL_2_3, ROLLOS_2_3 } from '../../src/levels/level2-3';
import { bundleBox } from '../../src/sim/papel';
import { start } from '../helpers';

const shot = async (page: Page, info: TestInfo, name: string) => {
  await page.waitForTimeout(250); // L-042: real time only lets the frame render before the picture; nothing is timed by it
  await page.screenshot({ path: `shots/${name}-${info.project.name.replace('shots-', '')}.png` });
};

/**
 * Starts 2-3 the device's way (L-045), collects the hilo on the roof at column 5 by holding right (L-045: the HUD shows a count a player
 * could see), pauses, and puts Poncho at (x, y), in the air at rest: the next steps land him.
 */
async function begin(page: Page, isMobile: boolean, x: number, y: number): Promise<void> {
  await start(page, isMobile, '/?level=2-3');
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 10);
  await page.evaluate(() => {
    const d = window.__PONCHO__!;
    d.pause(true);
    d.step(25, { move: 1, jumpHeld: false });
  });
  expect((await page.evaluate(() => window.__PONCHO__!.hilos())).taken).toBe(1);
  await page.evaluate(([px, py]) => {
    const d = window.__PONCHO__!;
    d.teleport(px!, py!);
    d.step(3);
  }, [x, y]);
}

/** The camera's rightmost left edge: the level's width less one screen (GDD-UI-04). */
const CAMERA_MAX = LEVEL_2_3.world.width * 16 - 480;

/** Waits until the camera has followed Poncho: its left edge 256 px left of him, inside the level (GDD-UI-04). */
const followed = (page: Page) =>
  page.waitForFunction((max) => {
    const d = window.__PONCHO__!;
    const want = Math.min(max, Math.max(0, Math.round(d.state().x) - 256));
    return Math.abs(d.camera().viewX - want) <= 1 && Math.abs(d.bodyPose().x - d.state().x) < 0.01;
  }, CAMERA_MAX);

/** The awnings by their place in the level's list (level2-3.ts): T1 the first torn one, T2 to T4 the torn chain, Wa, Tb, Wc and Td the mixed chain, T5 the exam's. */
const T1 = 1;
const T2 = 2;
const T3 = 3;
const T4 = 4;
const WA = 5;
const TB = 6;
const WC = 7;
const TD = 8;
const T5 = AWNINGS_2_3.length - 1;
/** The Trompo on the roof L, past the mixed chain, and the Trompo in the first pen. */
const TROMPO_L = 4;
const TROMPO_PEN = 1;

test('GDD-WLD-10 2-3: the torn awning T1 just before Poncho lands on it, then torn apart under its one rebound', async ({ page, isMobile }, info) => {
  // As the level test plays it: from the roof at x 150, a jump let go at once, steered onto T1's middle (x 200).
  await begin(page, isMobile, 150, 224);
  const play = (until: 'above' | 'torn') =>
    page.evaluate(([goal, gone]) => {
      const d = window.__PONCHO__!;
      for (let i = 0; i < 120; i++) {
        const p = d.state();
        if (goal === 'above' && p.vy > 0 && p.y > 172) return 'above';
        if (goal === 'torn' && d.market().gone[gone as number]) return 'torn';
        d.step(1, { move: p.x + (p.vx * Math.abs(p.vx)) / 600 < 200 ? 1 : 0, jumpHeld: goal === 'above' && i < 12 });
      }
      return 'never';
    }, [until, T1] as const);
  expect(await play('above')).toBe('above');
  expect((await page.evaluate(() => window.__PONCHO__!.market())).awnings[T1]!.gone).toBe(false);
  await followed(page);
  await shot(page, info, 'level2-3-torn-before');
  expect(await play('torn')).toBe('torn');
  await page.evaluate(() => window.__PONCHO__!.step(2));
  expect((await page.evaluate(() => window.__PONCHO__!.market())).awnings[T1]!.gone).toBe(true);
  expect((await page.evaluate(() => window.__PONCHO__!.state())).vy).toBeLessThan(0); // on his one small rebound
  await followed(page);
  await shot(page, info, 'level2-3-torn-after');
});

test('GDD-WLD-10 2-3: the torn chain over the chimneys, T2 gone behind Poncho, T3 tearing under his tier 2 rebound, T4 ahead', async ({ page, isMobile }, info) => {
  // As the level test plays it: from the roof 39 px before the edge (x 985, past the first ofrenda), right held and jump held from the
  // 10th step. The two Trompos before it are penned behind the wall at column 58.
  await begin(page, isMobile, 985, 224);
  const seen = await page.evaluate((t3) => {
    const d = window.__PONCHO__!;
    const out: number[] = [];
    let last = d.market().bounce?.at;
    for (let i = 0; i < 240; i++) {
      d.step(1, { move: 1, jumpHeld: i >= 10 });
      const b = d.market().bounce;
      if (b && b.at !== last) out.push(b.awning);
      last = b?.at;
      if (b?.awning === t3) break;
    }
    d.step(3, { move: 1, jumpHeld: true });
    return out;
  }, T3);
  expect(seen).toEqual([T2, T3]);
  const m = await page.evaluate(() => window.__PONCHO__!.market());
  expect([m.gone[T2], m.gone[T3], m.gone[T4]]).toEqual([true, true, false]);
  await followed(page);
  expect(await page.evaluate(() => window.__PONCHO__!.lives())).toBe(7);
  await shot(page, info, 'level2-3-chain');
});

test('GDD-WLD-10 GDD-ENM-03 2-3: the mixed chain, Tb tearing under the tier 2 rebound over the tall chimney, then Poncho waiting on Wc for the Trompo on L', async ({ page, isMobile }, info) => {
  // As the level test plays it: from the roof 39 px before the mixed chain's edge (x 1433), a jump onto Wa let go (it settles there);
  // a hop in place holding jump (Wa, tier 1), steered onto Tb's middle (x 1592), then right held (Tb, tier 2) over the tall chimney.
  await begin(page, isMobile, 1433, 224);
  const settled = await page.evaluate((wa) => {
    const d = window.__PONCHO__!;
    for (let i = 0; i < 120; i++) {
      const p = d.state();
      d.step(1, { move: p.x + (p.vx * Math.abs(p.vx)) / 600 < 1512 ? 1 : 0, jumpHeld: i >= 10 && i < 20 });
    }
    const p = d.state();
    return { y: p.y, grounded: p.grounded, on: d.market().bounce?.awning === wa };
  }, WA);
  expect(settled).toEqual({ y: 208, grounded: true, on: true });
  const rising = await page.evaluate(([tb, tallX1]) => {
    const d = window.__PONCHO__!;
    d.step(1); // a step with jump let go, before the press
    for (let i = 0; i < 200; i++) {
      const p = d.state();
      const b = d.market().bounce;
      if (b?.awning === tb && p.vy < 0 && p.x > tallX1 - 30) return { tier: b.tier, y: p.y };
      const towards = p.x + (p.vx * Math.abs(p.vx)) / 600 < 1592 ? 1 : 0;
      d.step(1, { move: b?.awning === tb ? 1 : (p.awningChain ?? 0) >= 1 ? towards : 0, jumpHeld: true });
    }
    return null;
  }, [TB, 102 * 16] as const);
  expect(rising?.tier).toBe(2);
  const m = await page.evaluate(() => window.__PONCHO__!.market());
  expect([m.gone[TB], m.gone[TD], m.awnings[WA]!.gone, m.awnings[WC]!.gone]).toEqual([true, false, false, false]);
  await followed(page);
  expect(await page.evaluate(() => window.__PONCHO__!.lives())).toBe(7);
  await shot(page, info, 'level2-3-mixed-rise');
  // Past the tall chimney he lets go and steers onto Wc's middle (x 1672), where he settles, and waits, the Trompo spinning on L ahead.
  const waiting = await page.evaluate(([wc, t]) => {
    const d = window.__PONCHO__!;
    let letGo = false;
    for (let i = 0; i < 200; i++) {
      const p = d.state();
      if (p.grounded && p.y === 208 && d.market().bounce?.awning === wc) break;
      letGo ||= p.vy > 0 && p.x > 102 * 16; // falling past the tall chimney, he lets go of jump for good
      d.step(1, { move: letGo ? (p.x + (p.vx * Math.abs(p.vx)) / 600 < 1672 ? 1 : 0) : 1, jumpHeld: !letGo });
    }
    d.step(30);
    // The moment to go, as the bot takes it (level2-3.test.ts): the Trompo has turned at the pit's edge and heads for the step.
    for (let i = 0; i < 300 && !(d.enemies()[t]!.dir > 0 && d.enemies()[t]!.x < 1840); i++) d.step(1);
    return d.state();
  }, [WC, TROMPO_L] as const);
  expect(waiting).toMatchObject({ y: 208, grounded: true });
  const trompo = await page.evaluate((i) => window.__PONCHO__!.enemies()[i]!, TROMPO_L);
  expect(trompo).toMatchObject({ alive: true, phase: 'spin' });
  expect(trompo.x).toBeGreaterThan(111 * 16); // on L, past the pit with Td
  expect([trompo.dir, trompo.x < 1840]).toEqual([1, true]); // turned at the pit's edge, heading for the step
  await followed(page);
  expect(await page.evaluate(() => window.__PONCHO__!.lives())).toBe(7);
  await shot(page, info, 'level2-3-mixed-wait');
});

test('GDD-ENM-03 GDD-CMB-02 2-3: the Trompo spinning at Poncho in its pen, then lying stunned after his claw', async ({ page, isMobile }, info) => {
  // On the pen's left wall (column 29) he waits until the Trompo spins off to the right; then he steps into the pen at x 500, where the
  // level test starts him, and swipes once it is within the claw's reach (its near edge 26 px past his front, at most).
  await begin(page, isMobile, 472, 176);
  await page.evaluate((i) => {
    const d = window.__PONCHO__!;
    for (let k = 0; k < 600 && !(d.enemies()[i]!.dir > 0 && d.enemies()[i]!.x > 550); k++) d.step(1);
    d.teleport(500, 224);
    d.step(1);
  }, TROMPO_PEN);
  /** The Trompo's near edge past Poncho's front: its box is 14 px wide, his 12. */
  const gap = () => page.evaluate((i) => window.__PONCHO__!.enemies()[i]!.x - 7 - (window.__PONCHO__!.state().x + 6), TROMPO_PEN);
  const spin = await page.evaluate((i) => {
    const d = window.__PONCHO__!;
    for (let k = 0; k < 300; k++) {
      const s = d.enemies()[i]!;
      if (s.dir < 0 && s.x - 7 - (d.state().x + 6) <= 40) return s.phase;
      d.step(1);
    }
    return 'never';
  }, TROMPO_PEN);
  expect(spin).toBe('spin');
  expect(await gap()).toBeGreaterThan(26);
  await followed(page);
  await shot(page, info, 'level2-3-trompo-spin');
  const stunned = await page.evaluate((i) => {
    const d = window.__PONCHO__!;
    for (let k = 0; k < 60; k++) {
      const near = d.enemies()[i]!.x - 7 - (d.state().x + 6);
      if (near <= 26) {
        d.step(1, { move: 0, jumpHeld: false, claw: true });
        break;
      }
      d.step(1);
    }
    d.step(8);
    return d.enemies()[i]!.phase;
  }, TROMPO_PEN);
  expect(stunned).toBe('stunned');
  expect(await page.evaluate(() => window.__PONCHO__!.lives())).toBe(7);
  await followed(page);
  await shot(page, info, 'level2-3-trompo-stunned');
});

/**
 * GDD-WLD-11: the bot's far-post rollo crossing (level2-3.test.ts `CROSSINGS`), from the roof at `from`: jump held, its rebounds steered to
 * `aim` (never pressing left), one claw while rising with the claw's reach over the bundle and the feet 20 to 56 px under the line's top.
 * It stops `after` steps into the unrolling, or once he stands on the strung line when `after` is null. Returns the rollo's steps.
 */
const cross = (page: Page, rollo: number, aim: number, after: number | null) =>
  page.evaluate(
    ([i, target, bx, lineY, stop]) => {
      const d = window.__PONCHO__!;
      let clawBefore = false;
      for (let k = 0; k < 600; k++) {
        const p = d.state();
        const steps = d.market().unrolled[i] ?? null;
        if (stop !== null && steps !== null && steps >= stop) break;
        if (stop === null && steps !== null && p.grounded && p.y === lineY) break;
        const move = p.y > 224 || !p.grounded ? (p.x + (p.vx * Math.abs(p.vx)) / 600 < target ? 1 : 0) : 1;
        const claw = steps === null && p.vy < 0 && p.y > lineY + 20 && p.y < lineY + 12 + 44 && p.x + 6 + 26 > bx && p.x + 6 < bx && p.facing === 1;
        d.step(1, { move, jumpHeld: true, claw: claw && !clawBefore });
        clawBefore = claw;
      }
      return d.market().unrolled[i];
    },
    [rollo, aim, bundleBox(ROLLOS_2_3[rollo]!).x0, ROLLOS_2_3[rollo]!.y, after] as const,
  );

test('GDD-WLD-11 2-3: the rollo on the far post unrolling towards Poncho as he rebounds off the deep awning', async ({ page, isMobile }, info) => {
  // R1 across the alley, tied at its right post on the high roof's wall: from the roof at x 2488 the bot drops onto A2, rebounds held
  // towards x 2602, claws the bundle on the way up, and the line grows back towards him. The shot is 24 steps into it (64 of 128 px).
  await begin(page, isMobile, 2488, 224);
  expect(await cross(page, 1, 2602, 24)).toBe(24);
  expect((await page.evaluate(() => window.__PONCHO__!.market())).rollos[1]!.tiles).toBeGreaterThan(0); // the line drawn from the post
  expect(await page.evaluate(() => window.__PONCHO__!.lives())).toBe(7);
  await followed(page);
  await shot(page, info, 'level2-3-rollo');
});

test('GDD-WLD-14 2-3: the exam, T5 torn, R4 strung, and Poncho on the exit roof with the exit ahead', async ({ page, isMobile }, info) => {
  // R4 across the exam's pit, its bundle on the exit roof's wall: from the roof at x 3416 the bot jumps onto T5 (it tears under its one
  // rebound), aims at x 3496, claws the bundle on the way up, lands on the strung line, walks right and jumps onto the exit roof (y 128).
  await begin(page, isMobile, 3416, 224);
  expect(await cross(page, 2, 3496, null)).not.toBeNull();
  expect(await page.evaluate((t5) => window.__PONCHO__!.market().gone[t5], T5)).toBe(true);
  const exitRoof = 220 * 16; // the exit roof's left edge
  const roof = await page.evaluate(
    ([wall, line]) => {
      const d = window.__PONCHO__!;
      d.step(1);
      for (let t = 0; t < 200; t++) {
        const p = d.state();
        if (p.grounded && p.y === 128 && p.x > wall + 36) break;
        d.step(1, { move: 1, jumpHeld: p.y === line ? p.x + 6 > wall - 14 : !p.grounded });
      }
      d.step(30); // right let go: he stops on the roof, short of the exit
      return d.state();
    },
    [exitRoof, ROLLOS_2_3[2]!.y] as const,
  );
  expect(roof).toMatchObject({ y: 128, grounded: true });
  expect(roof.x).toBeLessThan(LEVEL_2_3.exit!.x - 8);
  expect(await page.evaluate(() => window.__PONCHO__!.phase())).toBe('playing');
  expect(await page.evaluate(() => window.__PONCHO__!.exitDrawn())).toBe(true);
  expect(await page.evaluate(() => window.__PONCHO__!.lives())).toBe(7);
  await followed(page);
  await shot(page, info, 'level2-3-exit');
});

// The enemies' places come from the level module; this checks the indices the scenarios use still name the right kinds.
test('GDD-ENM-03 2-3: the scenarios name the Trompos by their places in the level list', () => {
  expect([ENEMIES_2_3[TROMPO_PEN]!.kind, ENEMIES_2_3[TROMPO_L]!.kind]).toEqual(['trompo', 'trompo']);
  expect([WA, TB, WC, TD].map((i) => AWNINGS_2_3[i]!.torn === true)).toEqual([false, true, false, true]);
  expect(AWNINGS_2_3[T5]!.torn).toBe(true);
});
