// Screenshots of the touch controls for visual review. Run with `npm run shots`; images land in shots/ (not committed).
import { test, type Page, type TestInfo } from '@playwright/test';
import { boot } from '../helpers';

const shot = async (page: Page, info: TestInfo, name: string) => {
  await page.waitForTimeout(150); // let the frame render
  await page.screenshot({ path: `shots/${name}-${info.project.name.replace('shots-', '')}.png` });
};

test('GDD-CTL-03 touch: buttons idle, then right and jump held', async ({ page, isMobile }, info) => {
  await boot(page);
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 10);
  await shot(page, info, 'touch-idle');
  if (!isMobile) return; // the desktop shows no buttons; the idle picture is the evidence
  const b = async (id: string) => {
    const btn = (await page.evaluate(() => window.__PONCHO__!.touch())).buttons.find((x) => x.id === id)!;
    const box = (await page.locator('canvas').boundingBox())!;
    const k = box.width / 480;
    return { x: box.x + (btn.x + btn.w / 2) * k, y: box.y + (btn.y + btn.h / 2) * k };
  };
  await page.evaluate(() => window.__PONCHO__!.teleport(290, 224));
  await page.waitForFunction(() => window.__PONCHO__!.state().grounded);
  const cdp = await page.context().newCDPSession(page);
  const [right, jump] = [await b('right'), await b('jump')];
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ ...right, id: 1 }, { ...jump, id: 2 }],
  });
  await page.waitForFunction(() => window.__PONCHO__!.touch().pressed.length === 2 && !window.__PONCHO__!.state().grounded);
  await shot(page, info, 'touch-right-and-jump');
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
});
