// Screenshots of level 1-1 for visual review (GDD-WLD-07). Run with `npm run shots`; images land in shots/ (not committed).
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

test('GDD-WLD-07 1-1: from 0-1 clear screen into 1-1, then its six screens, the exit and the clear screen', async ({ page, isMobile }, info) => {
  await start(page, isMobile); // 0-1, the device's way (L-045)
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 5);
  await page.evaluate(() => window.__PONCHO__!.teleport(1400, 224));
  await page.waitForFunction(() => window.__PONCHO__!.phase() === 'clear');
  await page.waitForFunction(() => window.__PONCHO__!.ticks() - window.__PONCHO__!.phaseSince() >= 60 && window.__PONCHO__!.clearDrawn().prompt);
  // The clear screen ends the device's way too: the touch Jump button on a phone, the claw key on a desktop.
  if (isMobile) {
    const b = (await page.evaluate(() => window.__PONCHO__!.touch())).buttons.find((x) => x.id === 'jump')!;
    const box = (await page.locator('canvas').boundingBox())!;
    const k = box.width / 480;
    await page.touchscreen.tap(box.x + (b.x + b.w / 2) * k, box.y + (b.y + b.h / 2) * k);
  } else await page.keyboard.press('KeyX', { delay: 30 });
  await page.waitForFunction(() => window.__PONCHO__!.level() === '1-1' && window.__PONCHO__!.ticks() > 10);
  expect(await page.evaluate(() => window.__PONCHO__!.camera().viewX)).toBe(0);
  await shot(page, info, 'level1-1-start');
  await stand(page, 456, 224, 200); // the first Alacrán's pen, the taco piñata and the spikes ahead
  await shot(page, info, 'level1-1-screen1');
  await stand(page, 840, 224, 584); // the first ofrenda behind, the first Zopilote cruising ahead
  await shot(page, info, 'level1-1-zopilote');
  await stand(page, 1176, 192, 920); // on the 2-tile wall: the cactus buddy behind, the chile piñata and the Fuego pen ahead
  await shot(page, info, 'level1-1-cactus-chile');
  await stand(page, 1700, 160, 1444); // on the raised platform, the veladora ledge ahead
  expect(await page.evaluate(() => window.__PONCHO__!.veladoraDrawn())).toBe(true);
  await shot(page, info, 'level1-1-platform-ledge');
  await stand(page, 2000, 224, 1744); // past the 2-tile wall: a cactus buddy and the second Zopilote over its gap
  await shot(page, info, 'level1-1-zopilote-gap');
  await stand(page, 2620, 224, 2364); // the third ofrenda behind, the last cactus, wall and pen, and the exit
  expect(await page.evaluate(() => window.__PONCHO__!.exitDrawn())).toBe(true);
  await shot(page, info, 'level1-1-end');
  // GDD-WLD-07: some hilos collected on the way, so the clear screen shows a count (the three on the floor at the start, then the one beside the exit).
  for (const col of [2, 4, 6]) {
    const before = await page.evaluate(() => window.__PONCHO__!.hilos().taken);
    await page.evaluate((x) => window.__PONCHO__!.teleport(x, 224), col * 16 + 8);
    await page.evaluate(() => window.__PONCHO__!.step(1));
    expect(await page.evaluate(() => window.__PONCHO__!.hilos().taken)).toBe(before + 1);
  }
  await page.evaluate(() => window.__PONCHO__!.teleport(2780, 224));
  await page.evaluate(() => window.__PONCHO__!.step(61));
  await page.waitForFunction(() => window.__PONCHO__!.clearDrawn().shown && window.__PONCHO__!.clearDrawn().prompt);
  expect((await page.evaluate(() => window.__PONCHO__!.clearDrawn())).hilos).toBe('Hilos 4/50'); // and the one beside the exit, at column 173
  await shot(page, info, 'level1-1-clear');
});
