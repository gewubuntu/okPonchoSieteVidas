// Screenshots of the touch controls for visual review. Run with `npm run shots`; images land in shots/ (not committed).
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { boot, start } from '../helpers';

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

test('GDD-CTL-03 touch: slide stick idle, then pushed right with jump held', async ({ page, isMobile }, info) => {
  if (!isMobile) return; // no touch buttons on the desktop
  await boot(page);
  const cdp = await page.context().newCDPSession(page);
  const at = async (id: string, fx = 0.5, fy = 0.5) => {
    const btn = (await page.evaluate(() => window.__PONCHO__!.touch())).buttons.find((x) => x.id === id)!;
    const box = (await page.locator('canvas').boundingBox())!;
    const k = box.width / 480;
    return { x: box.x + (btn.x + btn.w * fx) * k, y: box.y + (btn.y + btn.h * fy) * k };
  };
  const sw = await at('mode');
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...sw, id: 9 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForFunction(() => window.__PONCHO__!.touch().mode === 'stick');
  await shot(page, info, 'touch-stick-idle');
  await page.evaluate(() => window.__PONCHO__!.teleport(290, 224));
  await page.waitForFunction(() => window.__PONCHO__!.state().grounded);
  const [thumb, jump] = [await at('stick', 0.85), await at('jump')];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...thumb, id: 1 }, { ...jump, id: 2 }] });
  await page.waitForFunction(() => window.__PONCHO__!.touch().stick > 0.5 && !window.__PONCHO__!.state().grounded);
  await shot(page, info, 'touch-stick-right-and-jump');
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
});

/** A translucent magenta strip over each non-zero inset (CSS px) of the viewport, so the reviewer sees where the safe area ends. A page overlay only, not game code. */
const markInsets = (page: Page, insets: { left?: number; right?: number; top?: number; bottom?: number }) =>
  page.evaluate((i) => {
    const strips = [
      [i.left, 'left:0;top:0;bottom:0;width'],
      [i.right, 'right:0;top:0;bottom:0;width'],
      [i.top, 'left:0;right:0;top:0;height'],
      [i.bottom, 'left:0;right:0;bottom:0;height'],
    ] as const;
    for (const [css, place] of strips) {
      if (!css) continue;
      const d = document.createElement('div');
      d.style.cssText = `position:fixed;pointer-events:none;background:rgba(255,0,255,0.35);z-index:10;${place}:${css}px`;
      document.body.appendChild(d);
    }
  }, insets);

test('GDD-CTL-03 touch: the buttons kept clear of the safe-area insets', async ({ page, isMobile }, info) => {
  test.skip(!isMobile, 'the desktop draws no touch buttons');
  const cdp = await page.context().newCDPSession(page);
  const touch = () => page.evaluate(() => window.__PONCHO__!.touch());

  // An iPhone in landscape: the side insets lie in the letterbox bars, the home indicator reaches into the canvas.
  const iphone = { left: 47, right: 47, top: 0, bottom: 21 };
  await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: iphone });
  await start(page, isMobile, '/?level=sandbox');
  await page.waitForFunction(() => window.__PONCHO__!.state().grounded && window.__PONCHO__!.touch().insets.bottom === 15);
  await markInsets(page, iphone);
  const jump = (await touch()).buttons.find((b) => b.id === 'jump')!;
  expect(jump.y + jump.h).toBe(249); // 270 - 6 - 15
  expect((await touch()).insets.bottom).toBe(15);
  await shot(page, info, 'touch-safe-area-1-iphone');

  // A 16:9 phone with a cutout on the left: the inset reaches into the canvas, so the left buttons move in. A new page load
  // (the overlay goes with it), the override set before the level starts.
  await page.setViewportSize({ width: 800, height: 450 });
  await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { left: 40 } });
  await start(page, isMobile, '/?level=sandbox');
  await page.waitForFunction(() => window.__PONCHO__!.state().grounded && window.__PONCHO__!.touch().insets.left === 24);
  await markInsets(page, { left: 40 });
  const left = (await touch()).buttons.find((b) => b.id === 'left')!;
  expect(left.x).toBe(30); // 6 + 24
  expect((await touch()).insets.left).toBe(24);
  await shot(page, info, 'touch-safe-area-2-cutout-left');
});
