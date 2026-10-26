// Screenshots of World 1's desert backdrop and ground for visual review (GDD-ART-06). Run with `npm run shots`; images land in shots/ (not committed).
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { start } from '../helpers';

const shot = async (page: Page, info: TestInfo, name: string) => {
  await page.waitForTimeout(250); // let the frame render
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

test('GDD-ART-06 desert: level 0-1 at the start', async ({ page, isMobile }, info) => {
  await start(page, isMobile); // the device's way (L-045)
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 10);
  expect(await page.evaluate(() => window.__PONCHO__!.level())).toBe('0-1');
  expect(await page.evaluate(() => window.__PONCHO__!.camera().viewX)).toBe(0);
  await shot(page, info, 'desert-start');
});

test('GDD-ART-06 desert: scrolled, the mountains and clouds have moved, a 3-tile gap in view', async ({ page, isMobile }, info) => {
  await start(page, isMobile);
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 10);
  await stand(page, 760, 224, 504); // past the spikes, the gap at columns 53 to 55 (x 848 to 896) ahead
  expect((await page.evaluate(() => window.__PONCHO__!.backdrop())).mountains).toBeGreaterThan(0);
  expect(await page.evaluate(() => window.__PONCHO__!.groundFrame(54, 14))).toBeNull();
  await shot(page, info, 'desert-mid');
});

test('GDD-ART-06 desert: the sandbox', async ({ page, isMobile }, info) => {
  await start(page, isMobile, '/?level=sandbox');
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 10);
  expect(await page.evaluate(() => window.__PONCHO__!.level())).toBe('sandbox');
  await shot(page, info, 'desert-sandbox');
});
