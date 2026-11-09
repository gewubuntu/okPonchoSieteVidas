// Screenshots of World 2's Mercado backdrop, ground and decor for visual review (GDD-ART-06), in level 2-1 (GDD-WLD-12) and the arena 2-4,
// and La Estrella's placeholder in each phase (GDD-BOS-03). Run with `npm run shots`; images land in shots/ (not committed).
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { bumpEstrella, phase3Hit, start, stepToEstrellaMode, stepToEstrellaTear } from '../helpers';

const shot = async (page: Page, info: TestInfo, name: string) => {
  await page.waitForTimeout(250); // L-042: real time only lets the frame render before the picture; nothing is timed by it
  await page.screenshot({ path: `shots/${name}-${info.project.name.replace('shots-', '')}.png` });
};

/** Pauses the game and puts Poncho at (x, y) without stepping, so nothing can hurt him; waits until he is drawn there and the camera followed. */
async function stand(page: Page, x: number, y: number, viewX: number): Promise<void> {
  await page.evaluate(() => window.__PONCHO__!.pause(true));
  await page.evaluate(([px, py]) => window.__PONCHO__!.teleport(px!, py!), [x, y]);
  await page.waitForFunction(([px, py, vx]) => {
    const d = window.__PONCHO__!;
    return Math.abs(d.bodyPose().x - px!) < 0.01 && Math.abs(d.bodyPose().y - py!) < 0.01 && d.camera().viewX === vx;
  }, [x, y, viewX]);
}

test('GDD-ART-06 mercado: level 2-1 at the start', async ({ page, isMobile }, info) => {
  await start(page, isMobile, '/?level=2-1'); // the device's way (L-045)
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 10);
  expect(await page.evaluate(() => window.__PONCHO__!.level())).toBe('2-1');
  expect(await page.evaluate(() => window.__PONCHO__!.scenery())).toEqual({ set: 'mercado', midKey: 'mercado:mid' });
  expect(await page.evaluate(() => window.__PONCHO__!.camera().viewX)).toBe(0);
  await shot(page, info, 'mercado-start');
});

test('GDD-ART-06 mercado: scrolled, the far town and the rooftops have moved, the 8-tile pit with its awning in view', async ({ page, isMobile }, info) => {
  await start(page, isMobile, '/?level=2-1');
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 10);
  await stand(page, 2584, 192, 2328); // on the crate at column 161, the pit at columns 166 to 173 (x 2656 to 2784) ahead
  const offsets = await page.evaluate(() => window.__PONCHO__!.backdrop());
  expect(offsets.mountains).toBeGreaterThan(0);
  expect(offsets.desert).toBeGreaterThan(offsets.mountains);
  expect(await page.evaluate(() => window.__PONCHO__!.groundFrame(165, 14))).not.toBeNull();
  for (const col of [166, 169, 173]) expect(await page.evaluate((c) => window.__PONCHO__!.groundFrame(c, 14), col)).toBeNull();
  await shot(page, info, 'mercado-mid');
});

test('GDD-ART-06 mercado: the decor close up, beside Poncho on the floor', async ({ page, isMobile }, info) => {
  await start(page, isMobile, '/?level=2-1');
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 10);
  // plantSpots(LEVEL_2_1, MERCADO.decor) puts five kinds within columns 8 to 27: kinds 3 and 6 at 8 and 9, 4 on the crate at 10, 2 at
  // 17, 1 and 4 at 26 and 27 (src/ui/plants.test.ts). Poncho stands on the floor at column 20, by the 3-tile gap at 22 to 24.
  await stand(page, 328, 224, 72);
  expect(await page.evaluate(() => window.__PONCHO__!.groundFrame(20, 14))).not.toBeNull();
  const inView = (await page.evaluate(() => window.__PONCHO__!.plants())).filter((p) => p.x > 72 && p.x < 552);
  expect(inView.map((p) => p.x)).toEqual([8, 9, 10, 17, 26, 27].map((c) => c * 16 + 8));
  expect(new Set(inView.map((p) => p.kind)).size).toBe(5);
  await shot(page, info, 'mercado-decor');
});

test('GDD-ART-06 mercado: the arena 2-4 with the plaza and the kiosco', async ({ page, isMobile }, info) => {
  await start(page, isMobile, '/?level=2-4');
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 10);
  expect(await page.evaluate(() => window.__PONCHO__!.level())).toBe('2-4');
  expect(await page.evaluate(() => window.__PONCHO__!.scenery())).toEqual({ set: 'mercado', midKey: 'mercado:plaza' });
  expect(await page.evaluate(() => window.__PONCHO__!.bossBar().shown)).toBe(true);
  await page.evaluate(() => window.__PONCHO__!.pause(true));
  await shot(page, info, 'mercado-arena');
});

/** Waits until a frame has drawn La Estrella with these fields (`estrellaDrawn`), as the debug `step` does not draw (L-033). */
const drawnAs = (page: Page, want: Record<string, unknown>) =>
  page.waitForFunction((w) => {
    const d = window.__PONCHO__!.estrellaDrawn() as Record<string, unknown> | null;
    return d !== null && Object.entries(w).every(([k, v]) => d[k] === v);
  }, want);

/** Starts 2-4 the device's way and pauses it, La Estrella set to the start of phase `hits + 1` and Poncho put at (x, y). */
async function fight(page: Page, isMobile: boolean, hits: number, x: number, y: number): Promise<void> {
  await start(page, isMobile, '/?level=2-4');
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 10);
  await page.evaluate(
    ([h, px, py]) => {
      const d = window.__PONCHO__!;
      d.pause(true);
      d.setEstrella(h!);
      d.teleport(px!, py!);
    },
    [hits, x, y],
  );
}

test('GDD-BOS-03 estrella: phase 1, her telegraph over the left awning, flashing red and shaken right', async ({ page, isMobile }, info) => {
  await fight(page, isMobile, 0, 80, 224);
  expect(await stepToEstrellaMode(page, 'telegraph')).toBeLessThan(1000);
  await page.evaluate(() => window.__PONCHO__!.step(1));
  const e = (await page.evaluate(() => window.__PONCHO__!.estrella()))!;
  expect(e).toMatchObject({ mode: 'telegraph', x: 80, y: 40, age: 1 });
  await drawnAs(page, { flash: 'red', x: 82, cones: 7 });
  await shot(page, info, 'estrella-telegraph');
});

test('GDD-BOS-03 estrella: phase 1, hanging low over the left awning after its throw, seven cones', async ({ page, isMobile }, info) => {
  await fight(page, isMobile, 0, 240, 224);
  expect(await stepToEstrellaMode(page, 'hang')).toBeLessThan(1000);
  await page.evaluate(() => window.__PONCHO__!.step(10));
  expect(await page.evaluate(() => window.__PONCHO__!.estrella())).toMatchObject({ mode: 'hang', x: 80, y: 112 });
  await drawnAs(page, { flash: null, cones: 7, pale: 3, rope: 72 });
  await shot(page, info, 'estrella-phase1-hang');
});

test('GDD-BOS-03 estrella: hurt by a bump from a held rebound, flashing white, five cones', async ({ page, isMobile }, info) => {
  await fight(page, isMobile, 0, 80, 224);
  expect(await stepToEstrellaMode(page, 'hang')).toBeLessThan(1000);
  expect(await bumpEstrella(page)).toBe(1);
  expect(await page.evaluate(() => window.__PONCHO__!.estrella())).toMatchObject({ mode: 'hurt', age: 0 });
  await drawnAs(page, { flash: 'white', cones: 5 });
  expect(await page.evaluate(() => window.__PONCHO__!.bossBar())).toMatchObject({ pips: 2, outlines: 1 });
  await shot(page, info, 'estrella-hurt');
});

test('GDD-BOS-03 estrella: phase 2, risen from her thud at x 160, the tejocotes rolling, Poncho on the cordel', async ({ page, isMobile }, info) => {
  await fight(page, isMobile, 1, 127, 136);
  expect(await stepToEstrellaMode(page, 'rise', 400)).toBeLessThan(400);
  await page.evaluate(() => window.__PONCHO__!.step(30));
  expect(await page.evaluate(() => window.__PONCHO__!.estrella())).toMatchObject({ mode: 'rise', x: 160 });
  expect(await page.evaluate(() => window.__PONCHO__!.tejocotesDrawn().length)).toBe(2);
  await drawnAs(page, { cones: 5 });
  await shot(page, info, 'estrella-phase2-tejocotes');
});

/** Waits until a frame has drawn the middle awning torn apart (`market().awnings[1].gone`), together with the run's flag (L-033). */
const middleTorn = (page: Page) => page.waitForFunction(() => window.__PONCHO__!.market().awnings[1]!.gone && window.__PONCHO__!.market().gone[1]!);

test('GDD-BOS-03 estrella: phase 3, her first drop tearing down through the middle awning, which is gone, Poncho clear of it on the left cordel', async ({ page, isMobile }, info) => {
  // As the arena's bot plays it (phase3Hit): he waits on the left cordel's end at x 205, clear of her line at x 240. The shot is the step
  // her pot's bottom is 12 px through the awning's top (y 176), on her way to the floor: the tear has just happened.
  await fight(page, isMobile, 2, 205, 136);
  expect(await stepToEstrellaMode(page, 'drop')).toBeLessThan(1000);
  const reached = await page.evaluate(() => {
    const d = window.__PONCHO__!;
    let i = 0;
    while (i < 200 && d.estrella()!.y < 188) {
      d.step(1);
      i++;
    }
    return i;
  });
  expect(reached).toBeLessThan(200);
  expect(await page.evaluate(() => window.__PONCHO__!.estrella())).toMatchObject({ mode: 'drop', tx: 240, ty: 224, hits: 2, tore: true });
  expect(await page.evaluate(() => window.__PONCHO__!.market().gone)).toEqual([false, true, false]);
  expect(await page.evaluate(() => window.__PONCHO__!.state())).toMatchObject({ y: 136, grounded: true });
  await middleTorn(page);
  await drawnAs(page, { cones: 3 });
  await shot(page, info, 'estrella-phase3-tear');
});

test('GDD-BOS-03 estrella: phase 3, risen from the floor where the middle awning was, two pairs of tejocotes, Poncho on the left cordel', async ({ page, isMobile }, info) => {
  await fight(page, isMobile, 2, 205, 136);
  expect(await stepToEstrellaMode(page, 'rise', 400)).toBeLessThan(400);
  await page.evaluate(() => window.__PONCHO__!.step(40));
  expect(await page.evaluate(() => window.__PONCHO__!.estrella())).toMatchObject({ mode: 'rise', tx: 240, hits: 2, tore: true });
  expect(await page.evaluate(() => window.__PONCHO__!.tejocotes().length)).toBe(4);
  await middleTorn(page);
  await drawnAs(page, { cones: 3, pale: 3 });
  await shot(page, info, 'estrella-phase3-rise');
});

test('GDD-BOS-03 estrella: phase 3 after the tear, the middle awning torn away, her drop on the floor', async ({ page, isMobile }, info) => {
  // Reached the way the game does (L-045): from the start of phase 3 her first drop is played out, not set torn by a hook.
  await fight(page, isMobile, 2, 205, 136);
  expect(await page.evaluate(() => window.__PONCHO__!.estrella())).toMatchObject({ hits: 2, tore: false });
  expect(await page.evaluate(() => window.__PONCHO__!.market().gone)).toEqual([false, false, false]);
  expect(await stepToEstrellaMode(page, 'rest', 400)).toBeLessThan(400);
  expect(await page.evaluate(() => window.__PONCHO__!.estrella())).toMatchObject({ mode: 'rest', x: 240, y: 224, hits: 2, tore: true });
  expect(await page.evaluate(() => window.__PONCHO__!.market().gone)).toEqual([false, true, false]);
  expect(await page.evaluate(() => window.__PONCHO__!.state())).toMatchObject({ y: 136, grounded: true });
  expect(await page.evaluate(() => window.__PONCHO__!.lives())).toBe(7);
  await middleTorn(page);
  await drawnAs(page, { cones: 3 });
  await shot(page, info, 'estrella-tear');
});

test('GDD-BOS-01 shake: the tear shakes the world 4 px down, then 4 px up, the HUD still', async ({ page, isMobile }, info) => {
  // Reached the way the game does (L-045): phase 3's first drop played out to the step of the tear, the shake's age 0.
  await fight(page, isMobile, 2, 205, 136);
  expect(await stepToEstrellaTear(page)).toBeLessThan(400);
  expect(await page.evaluate(() => window.__PONCHO__!.shake())).toMatchObject({ age: 0, offset: 4 });
  await page.waitForFunction(() => window.__PONCHO__!.cameraScrollY() === -4);
  await shot(page, info, 'shake-down');
  await page.evaluate(() => window.__PONCHO__!.step(2));
  expect(await page.evaluate(() => window.__PONCHO__!.shake())).toMatchObject({ age: 2, offset: -4 });
  await page.waitForFunction(() => window.__PONCHO__!.cameraScrollY() === 4);
  await shot(page, info, 'shake-up');
});

test('GDD-BOS-03 estrella: defeated, her rope snapped, the empty pot falling', async ({ page, isMobile }, info) => {
  await fight(page, isMobile, 2, 205, 136);
  expect(await phase3Hit(page)).toBe(3);
  await page.evaluate(() => window.__PONCHO__!.step(20));
  expect(await page.evaluate(() => window.__PONCHO__!.estrella())).toMatchObject({ mode: 'defeated', age: 20 });
  await drawnAs(page, { cones: 0, rope: null });
  await shot(page, info, 'estrella-defeated');
});
