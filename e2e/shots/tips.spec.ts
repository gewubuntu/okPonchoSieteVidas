// Screenshots of the tutorial tips of 0-1 for visual review (GDD-UI-05). Run with `npm run shots`; images land in shots/ (not committed).
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { start } from '../helpers';

const shot = async (page: Page, info: TestInfo, name: string) => {
  await page.waitForTimeout(250); // let the frame render
  await page.screenshot({ path: `shots/${name}-${info.project.name.replace('shots-', '')}.png` });
};

/**
 * Pauses the simulation, puts Poncho at (x, y), runs until the tip is fully faded in and then on to a step where the highlight is
 * halfway through its pulse (a pulse is 48 steps, and the pulse counts the steps since the page loaded), and checks the tip.
 */
async function showTip(page: Page, x: number, y: number, index: number): Promise<void> {
  await page.evaluate(() => window.__PONCHO__!.pause(true));
  await page.evaluate(([px, py]) => window.__PONCHO__!.teleport(px!, py!), [x, y]);
  await page.evaluate(() => window.__PONCHO__!.step(13));
  await page.evaluate(() => window.__PONCHO__!.step((12 - (window.__PONCHO__!.ticks() % 48) + 48) % 48));
  await page.waitForFunction(([i]) => window.__PONCHO__!.tip().index === i && window.__PONCHO__!.tip().alpha === 1, [index]);
  expect(await page.evaluate(() => window.__PONCHO__!.phase())).toBe('playing');
}

test('GDD-UI-05 tips: run (the move buttons outlined on touch)', async ({ page, isMobile }, info) => {
  await start(page, isMobile); // a tap on a phone, so the words and outlines are the touch ones
  await showTip(page, 56, 224, 0);
  expect((await page.evaluate(() => window.__PONCHO__!.tip())).device).toBe(isMobile ? 'touch' : 'keyboard');
  if (isMobile) expect((await page.evaluate(() => window.__PONCHO__!.touch())).highlighted).toBe('move');
  await shot(page, info, 'tips-run');
});

test('GDD-UI-05 tips: jump, the Alacrán, the piñata, the veladora and the exit', async ({ page, isMobile }, info) => {
  await start(page, isMobile);
  await showTip(page, 150, 224, 1); // the 2-tile wall
  await shot(page, info, 'tips-jump');
  await showTip(page, 470, 224, 4); // the first Alacrán's pen
  await shot(page, info, 'tips-alacran');
  await showTip(page, 648, 224, 5); // under the piñata
  await shot(page, info, 'tips-pinata');
  await showTip(page, 1098, 160, 10); // on the raised platform, the ledge ahead
  await shot(page, info, 'tips-veladora');
  await showTip(page, 1380, 224, 11); // in front of the exit
  await shot(page, info, 'tips-exit');
});
