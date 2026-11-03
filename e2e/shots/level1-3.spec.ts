// Screenshots of level 1-3 for visual review (GDD-WLD-09). Run with `npm run shots`; images land in shots/ (not committed).
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { resultsRowCentre, start, waitForResults } from '../helpers';

const shot = async (page: Page, info: TestInfo, name: string) => {
  await page.waitForTimeout(250); // L-042: a frame to draw before the screenshot, no game time is measured
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

test('GDD-WLD-09 1-3: from 1-2 clear screen into 1-3, then its six screens, the exit and the clear screen', async ({ page, isMobile }, info) => {
  await start(page, isMobile, '/?level=1-2'); // 1-2, the device's way (L-045)
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 5);
  await page.evaluate(() => window.__PONCHO__!.teleport(2780, 224));
  await page.waitForFunction(() => window.__PONCHO__!.phase() === 'clear');
  await waitForResults(page);
  // 1-2 names 1-3: the menu opens on Next level. The clear screen is left by it, the device's way too: a tap on the row on a phone, Enter on a desktop.
  expect((await page.evaluate(() => window.__PONCHO__!.clearDrawn())).menu).toMatchObject({ chosen: 'next' });
  if (isMobile) {
    const row = await resultsRowCentre(page, 'next');
    await page.touchscreen.tap(row.x, row.y);
  } else await page.keyboard.press('Enter', { delay: 30 });
  await page.waitForFunction(() => window.__PONCHO__!.level() === '1-3' && window.__PONCHO__!.ticks() > 10);
  expect(await page.evaluate(() => window.__PONCHO__!.camera().viewX)).toBe(0);
  await shot(page, info, 'level1-3-start'); // the hill, the key, the first door, the cactus buddy and the first gap
  // Some hilos collected in play (L-045): holding right from the start, the floor hilo and the four over the hill.
  await page.evaluate(() => window.__PONCHO__!.pause(true));
  await page.evaluate(() => window.__PONCHO__!.step(60, { move: 1, jumpHeld: false }));
  expect((await page.evaluate(() => window.__PONCHO__!.hilos())).taken).toBe(5);
  await stand(page, 680, 224, 424); // the first fragile wall, the 2-tile wall and the piñata, the first ofrenda, the first lift and its cliff
  await shot(page, info, 'level1-3-lift');
  await stand(page, 1080, 208, 824); // on the pen's block: the first crusher, the dune with its key and Tlacuache, the second door
  await shot(page, info, 'level1-3-dune');
  await stand(page, 1640, 192, 1384); // on the step: the second ofrenda, the shuttle over the spikes, the veladora ledge, the Zopilote, the far wall
  expect(await page.evaluate(() => window.__PONCHO__!.veladoraDrawn())).toBe(true);
  await shot(page, info, 'level1-3-shuttle');
  await stand(page, 1832, 224, 1576); // on the floor between the far wall and the second fragile wall: the Alacrán's pen and its block, the crusher beside it
  await shot(page, info, 'level1-3-pen');
  await stand(page, 2104, 224, 1848); // at the corridor's key: both corridor crushers, the third door, the third fragile wall
  await shot(page, info, 'level1-3-corridor');
  await stand(page, 2488, 224, 2232); // before the up ramp: the third ofrenda, the ramps and the crumbling bridge, the last lift and cliff
  await shot(page, info, 'level1-3-bridge');
  await stand(page, 2720, 128, 2400); // on the last cliff: the lift, the cliff top, its Tlacuache and the exit
  expect(await page.evaluate(() => window.__PONCHO__!.exitDrawn())).toBe(true);
  await shot(page, info, 'level1-3-end');
  await page.evaluate(() => window.__PONCHO__!.teleport(2780, 128));
  await page.evaluate(() => window.__PONCHO__!.step(61));
  await page.waitForFunction(() => window.__PONCHO__!.clearDrawn().shown && window.__PONCHO__!.clearDrawn().menu.shown);
  expect((await page.evaluate(() => window.__PONCHO__!.clearDrawn())).hilos).toBe('Hilos 5/50'); // no hilo is near the exit
  // 1-3 names no next level: Next level is greyed and the menu opens on Retry.
  expect((await page.evaluate(() => window.__PONCHO__!.clearDrawn())).menu).toMatchObject({ chosen: 'retry', colors: ['#5c6178', '#fff3dc', '#9ba3c4'] });
  await shot(page, info, 'level1-3-clear');
});
