// Screenshots of level 0-1 for visual review (GDD-WLD-06). Run with `npm run shots`; images land in shots/ (not committed).
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { openGame, start } from '../helpers';

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

test('GDD-WLD-06 0-1: title over the level', async ({ page }, info) => {
  await openGame(page, '/');
  expect(await page.evaluate(() => window.__PONCHO__!.level())).toBe('0-1');
  expect(await page.evaluate(() => window.__PONCHO__!.titleDrawn().shown)).toBe(true);
  await shot(page, info, 'level0-1-title');
});

test('GDD-WLD-06 0-1: start, the alacran pen, the pinata and spikes, the platform and ledge, the exit, the clear screen', async ({ page, isMobile }, info) => {
  await start(page, isMobile); // the device's way (L-045)
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 10);
  expect(await page.evaluate(() => window.__PONCHO__!.phase())).toBe('playing');
  expect(await page.evaluate(() => window.__PONCHO__!.camera().viewX)).toBe(0);
  await shot(page, info, 'level0-1-start');
  await stand(page, 470, 224, 214); // between the 1-tile blocks at columns 27 and 37, in the first Alacrán's pen
  await shot(page, info, 'level0-1-alacran-pen');
  await stand(page, 640, 224, 384); // under the piñata at column 40, the two spikes just ahead
  await shot(page, info, 'level0-1-pinata-spikes');
  await stand(page, 1060, 160, 804); // on the raised platform, the veladora ledge ahead
  expect(await page.evaluate(() => window.__PONCHO__!.veladoraDrawn())).toBe(true);
  await shot(page, info, 'level0-1-platform-ledge');
  await stand(page, 1330, 224, 960); // the exit in view
  expect(await page.evaluate(() => window.__PONCHO__!.exitDrawn())).toBe(true);
  await shot(page, info, 'level0-1-exit');
  // GDD-WLD-06: some hilos collected on the way, so the clear screen shows a count (the three on the floor at the start).
  for (const col of [4, 5, 6]) {
    const before = await page.evaluate(() => window.__PONCHO__!.hilos().taken);
    await page.evaluate((x) => window.__PONCHO__!.teleport(x, 224), col * 16 + 8);
    await page.evaluate(() => window.__PONCHO__!.step(1));
    expect(await page.evaluate(() => window.__PONCHO__!.hilos().taken)).toBe(before + 1);
  }
  await page.evaluate(() => window.__PONCHO__!.teleport(1400, 224));
  await page.evaluate(() => window.__PONCHO__!.step(61));
  await page.waitForFunction(() => window.__PONCHO__!.clearDrawn().shown && window.__PONCHO__!.clearDrawn().prompt);
  expect(await page.evaluate(() => window.__PONCHO__!.phase())).toBe('clear');
  expect((await page.evaluate(() => window.__PONCHO__!.clearDrawn())).hilos).toBe('Hilos 3/50');
  await shot(page, info, 'level0-1-clear');
});
