import { expect, test, type CDPSession, type Page } from '@playwright/test';
import { boot } from './helpers';

const api = <T>(page: Page, fn: () => T) => page.evaluate(fn);

/** Where the centre of a touch button is on the page, in CSS px. */
async function buttonAt(page: Page, id: 'left' | 'right' | 'jump') {
  const b = (await api(page, () => window.__PONCHO__!.touch())).buttons.find((x) => x.id === id)!;
  const box = (await page.locator('canvas').boundingBox())!;
  const k = box.width / 480; // CSS px per virtual px
  return { x: box.x + (b.x + b.w / 2) * k, y: box.y + (b.y + b.h / 2) * k, widthCss: b.w * k, heightCss: b.h * k };
}

/** Real touch events through the browser, so several fingers can be held down at once. */
const fingers = async (cdp: CDPSession, type: 'touchStart' | 'touchEnd' | 'touchCancel', points: { x: number; y: number; id: number }[]) =>
  cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchStart' ? points : [] });

test('GDD-CTL-03 touch buttons show on a touch device and not on a desktop', async ({ page, isMobile }) => {
  await boot(page);
  const touch = await api(page, () => window.__PONCHO__!.touch());
  expect(touch.visible).toBe(isMobile);
  expect(new Set(touch.buttons.map((b) => b.id))).toEqual(new Set(isMobile ? ['left', 'right', 'jump'] : []));
  expect(touch.buttons).toHaveLength(isMobile ? 3 : 0);
});

test('GDD-CTL-03 every touch button is at least 48 CSS px on screen', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'touch device only');
  await boot(page);
  for (const id of ['left', 'right', 'jump'] as const) {
    const b = await buttonAt(page, id);
    expect(b.widthCss).toBeGreaterThanOrEqual(48);
    expect(b.heightCss).toBeGreaterThanOrEqual(48);
  }
});

test('GDD-CTL-03 holding the right button runs Poncho right, and he stops when the finger lifts', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'touch device only');
  await boot(page);
  const cdp = await page.context().newCDPSession(page);
  const right = await buttonAt(page, 'right');
  await fingers(cdp, 'touchStart', [{ x: right.x, y: right.y, id: 1 }]);
  await page.waitForFunction(() => window.__PONCHO__!.state().x > 90);
  expect(await api(page, () => window.__PONCHO__!.touch().pressed)).toEqual(['right']);
  await fingers(cdp, 'touchEnd', []);
  await page.waitForFunction(() => window.__PONCHO__!.state().vx === 0);
  expect(await api(page, () => window.__PONCHO__!.touch().pressed)).toEqual([]);
});

test('GDD-CTL-03 moving and jumping at the same time works with two fingers', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'touch device only');
  await boot(page);
  await page.evaluate(() => window.__PONCHO__!.teleport(290, 224)); // open ground: no platform overhead to bump his head
  await page.waitForFunction(() => window.__PONCHO__!.state().grounded);
  const cdp = await page.context().newCDPSession(page);
  const right = await buttonAt(page, 'right');
  const jump = await buttonAt(page, 'jump');
  await fingers(cdp, 'touchStart', [
    { x: right.x, y: right.y, id: 1 },
    { x: jump.x, y: jump.y, id: 2 },
  ]);
  await page.waitForFunction(() => window.__PONCHO__!.touch().pressed.length === 2);
  await page.waitForFunction(() => !window.__PONCHO__!.state().grounded);
  await page.waitForFunction(() => window.__PONCHO__!.state().vy > 0); // held through the top of the jump: a full jump
  expect((await api(page, () => window.__PONCHO__!.state())).x).toBeGreaterThan(290);
  await fingers(cdp, 'touchEnd', []);
  await page.waitForFunction(() => window.__PONCHO__!.state().grounded);
  expect(await api(page, () => window.__PONCHO__!.peakRise())).toBeGreaterThan(50); // a full jump is about 56 px (GDD-MOV-02)
});

test('GDD-CTL-03 a cancelled touch (a call or a system gesture) releases the buttons', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'touch device only');
  await boot(page);
  const cdp = await page.context().newCDPSession(page);
  const right = await buttonAt(page, 'right');
  await fingers(cdp, 'touchStart', [{ x: right.x, y: right.y, id: 1 }]);
  await page.waitForFunction(() => window.__PONCHO__!.touch().pressed.length === 1);
  await fingers(cdp, 'touchCancel', []);
  await page.waitForFunction(() => window.__PONCHO__!.touch().pressed.length === 0);
  await page.waitForFunction(() => window.__PONCHO__!.state().vx === 0);
});

test('GDD-CTL-03 keyboard and touch work together: a held key and a button add up', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'touch device only');
  await boot(page);
  const cdp = await page.context().newCDPSession(page);
  const right = await buttonAt(page, 'right');
  await page.keyboard.down('ArrowLeft'); // pushes left against the left level edge...
  await fingers(cdp, 'touchStart', [{ x: right.x, y: right.y, id: 1 }]);
  await page.waitForFunction(() => window.__PONCHO__!.touch().pressed.length === 1);
  const before = (await api(page, () => window.__PONCHO__!.state())).x;
  await page.waitForTimeout(400);
  // ...while the right button pushes right: the two cancel out, so he stays put (a button alone would run right).
  expect(Math.abs((await api(page, () => window.__PONCHO__!.state())).x - before)).toBeLessThan(2);
  await page.keyboard.up('ArrowLeft');
  await page.waitForFunction((x) => window.__PONCHO__!.state().x > x + 20, before); // now only the button: he runs right
  await fingers(cdp, 'touchEnd', []);
});

test('GDD-CTL-03 the buttons are laid out again, and stay at least 48 CSS px, when the screen is resized', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'touch device only');
  await boot(page);
  const before = (await api(page, () => window.__PONCHO__!.touch())).buttons.find((b) => b.id === 'left')!.w;
  await page.setViewportSize({ width: 360, height: 200 }); // a very small landscape screen
  await page.waitForFunction((w) => window.__PONCHO__!.touch().buttons.find((b) => b.id === 'left')!.w > w, before);
  for (const id of ['left', 'right', 'jump'] as const) {
    const b = await buttonAt(page, id);
    expect(b.widthCss).toBeGreaterThanOrEqual(48);
    expect(b.heightCss).toBeGreaterThanOrEqual(48);
  }
});
