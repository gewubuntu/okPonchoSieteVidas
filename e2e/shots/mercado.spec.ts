// Screenshots of World 2's Mercado backdrop, ground and decor for visual review (GDD-ART-06), in the stub levels 2-1 and 2-4. Run with
// `npm run shots`; images land in shots/ (not committed).
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { start } from '../helpers';

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

test('GDD-ART-06 mercado: scrolled, the far town and the rooftops have moved, the 4-tile gap in view', async ({ page, isMobile }, info) => {
  await start(page, isMobile, '/?level=2-1');
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 10);
  await stand(page, 600, 224, 344); // the gap at columns 40 to 43 (x 640 to 704) ahead
  const offsets = await page.evaluate(() => window.__PONCHO__!.backdrop());
  expect(offsets.mountains).toBeGreaterThan(0);
  expect(offsets.desert).toBeGreaterThan(offsets.mountains);
  expect(await page.evaluate(() => window.__PONCHO__!.groundFrame(41, 14))).toBeNull();
  await shot(page, info, 'mercado-mid');
});

test('GDD-ART-06 mercado: the decor close up, beside Poncho on the floor', async ({ page, isMobile }, info) => {
  await start(page, isMobile, '/?level=2-1');
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 10);
  // Columns 17 to 36 hold a huacal, rebozos, a bugambilia, a farol, a maceta and ollas (src/ui/plants.test.ts).
  await stand(page, 360, 224, 104);
  const inView = (await page.evaluate(() => window.__PONCHO__!.plants())).filter((p) => p.x > 104 && p.x < 584);
  expect(new Set(inView.map((p) => p.kind)).size).toBeGreaterThanOrEqual(6);
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
