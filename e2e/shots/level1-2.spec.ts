// Screenshots of level 1-2 for visual review (GDD-WLD-08). Run with `npm run shots`; images land in shots/ (not committed).
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

test('GDD-WLD-08 1-2: from 1-1 clear screen into 1-2, then its six screens, the exit and the clear screen', async ({ page, isMobile }, info) => {
  await start(page, isMobile, '/?level=1-1'); // 1-1, the device's way (L-045)
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 5);
  // Three lives lost in 1-1 (a count a player can have, GDD-LIFE-05): 1-2 starts with the four left.
  await page.evaluate(() => {
    for (let i = 0; i < 3; i++) window.__PONCHO__!.loseLife();
  });
  expect(await page.evaluate(() => window.__PONCHO__!.lives())).toBe(4);
  await page.evaluate(() => window.__PONCHO__!.teleport(2780, 224));
  await page.waitForFunction(() => window.__PONCHO__!.phase() === 'clear');
  await waitForResults(page);
  // The clear screen is left by its results menu, the device's way too: a tap on the Next level row on a phone, Enter on a desktop.
  if (isMobile) {
    const row = await resultsRowCentre(page, 'next');
    await page.touchscreen.tap(row.x, row.y);
  } else await page.keyboard.press('Enter', { delay: 30 });
  await page.waitForFunction(() => window.__PONCHO__!.level() === '1-2' && window.__PONCHO__!.ticks() > 10);
  expect(await page.evaluate(() => window.__PONCHO__!.camera().viewX)).toBe(0);
  // The lives carried from 1-1, no crack.
  expect(await page.evaluate(() => window.__PONCHO__!.lives())).toBe(4);
  expect(await page.evaluate(() => window.__PONCHO__!.hudFilled())).toBe(4);
  expect(await page.evaluate(() => window.__PONCHO__!.hudCracking())).toEqual([]);
  await shot(page, info, 'level1-2-start'); // the spawn, the first dune and hill, the ramp to the 2-tile gap, four of the seven triangles filled
  // Some hilos collected in play (L-045): holding right from the start, the three on the floor.
  await page.evaluate(() => window.__PONCHO__!.pause(true));
  await page.evaluate(() => window.__PONCHO__!.step(30, { move: 1, jumpHeld: false }));
  expect((await page.evaluate(() => window.__PONCHO__!.hilos())).taken).toBe(3);
  await stand(page, 736, 224, 480); // the taco piñata, the block, the spiked dip, the first ofrenda, the walkway
  await shot(page, info, 'level1-2-dunes');
  await stand(page, 1016, 192, 760); // on the pen's left wall: the Tlacuache in its pen, the chile piñata, the veladora ledge, the first spring
  expect(await page.evaluate(() => window.__PONCHO__!.veladoraDrawn())).toBe(true);
  await shot(page, info, 'level1-2-pen');
  await stand(page, 1272, 160, 1016); // on the first 4-tile wall: the cactus buddy, the second spring, its spikes and wall
  await shot(page, info, 'level1-2-springs');
  await stand(page, 1624, 224, 1368); // the second ofrenda and the crumbling bridge over the spikes (column 101, flat floor)
  await shot(page, info, 'level1-2-bridge');
  await stand(page, 1960, 208, 1704); // on the block at column 122: the 3-tile gap behind, the Tlacuache's hill
  await shot(page, info, 'level1-2-hill');
  await stand(page, 2264, 160, 2008); // on the third spring's crumbling tiles: the spring, the spikes, the tall wall and the long slope down
  await shot(page, info, 'level1-2-crumbles');
  await stand(page, 2700, 208, 2400); // on the last ramp's top: the third ofrenda, the dune pen, the last gap, the exit
  expect(await page.evaluate(() => window.__PONCHO__!.exitDrawn())).toBe(true);
  await shot(page, info, 'level1-2-end');
  await page.evaluate(() => window.__PONCHO__!.teleport(2780, 224));
  await page.evaluate(() => window.__PONCHO__!.step(61));
  await page.waitForFunction(() => window.__PONCHO__!.clearDrawn().shown && window.__PONCHO__!.clearDrawn().menu.shown);
  expect((await page.evaluate(() => window.__PONCHO__!.clearDrawn())).hilos).toBe('Hilos 4/50'); // the three from the start and the one beside the exit, at column 173
  // 1-2 names 1-3: the menu opens on Next level.
  expect((await page.evaluate(() => window.__PONCHO__!.clearDrawn())).menu).toMatchObject({ chosen: 'next', colors: ['#fff3dc', '#9ba3c4', '#9ba3c4'] });
  await shot(page, info, 'level1-2-clear');
});
