import { expect, test, type CDPSession, type Page } from '@playwright/test';
import { boot } from './helpers';

const api = <T>(page: Page, fn: () => T) => page.evaluate(fn);

/** Where the centre of a touch button is on the page, in CSS px. */
async function buttonAt(page: Page, id: 'left' | 'right' | 'jump' | 'claw' | 'stick' | 'mode' | 'pause') {
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
  expect(new Set(touch.buttons.map((b) => b.id))).toEqual(new Set(isMobile ? ['left', 'right', 'jump', 'claw', 'mode', 'pause'] : []));
  expect(touch.buttons).toHaveLength(isMobile ? 6 : 0);
});

test('GDD-CTL-03 every touch button is at least 48 CSS px on screen', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'touch device only');
  await boot(page);
  for (const id of ['left', 'right', 'jump', 'claw', 'mode', 'pause'] as const) {
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
  await page.evaluate(() => window.__PONCHO__!.teleport(280, 224)); // open ground: no platform overhead to bump his head
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

test('GDD-CMB-02 a finger on the claw button swings the claw, together with moving', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'touch device only');
  await boot(page);
  await page.evaluate(() => window.__PONCHO__!.teleport(280, 224));
  await page.waitForFunction(() => window.__PONCHO__!.state().grounded);
  const cdp = await page.context().newCDPSession(page);
  const claw = await buttonAt(page, 'claw');
  const right = await buttonAt(page, 'right');
  await fingers(cdp, 'touchStart', [
    { x: claw.x, y: claw.y, id: 1 },
    { x: right.x, y: right.y, id: 2 },
  ]);
  await page.waitForFunction(() => window.__PONCHO__!.claw() !== 'idle');
  expect(await api(page, () => window.__PONCHO__!.touch().pressed)).toEqual(expect.arrayContaining(['claw', 'right']));
  await fingers(cdp, 'touchEnd', []);
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
  for (const id of ['left', 'right', 'jump', 'claw', 'mode', 'pause'] as const) {
    const b = await buttonAt(page, id);
    expect(b.widthCss).toBeGreaterThanOrEqual(48);
    expect(b.heightCss).toBeGreaterThanOrEqual(48);
  }
});

/** Taps the mode switch with a real touch and waits for the zone to change. */
async function switchTo(page: Page, cdp: CDPSession, mode: 'buttons' | 'stick') {
  const sw = await buttonAt(page, 'mode');
  await fingers(cdp, 'touchStart', [{ x: sw.x, y: sw.y, id: 9 }]);
  await fingers(cdp, 'touchEnd', []);
  await page.waitForFunction((m) => window.__PONCHO__!.touch().mode === m, mode);
}

test('GDD-CTL-03 the mode switch swaps the buttons for the slide stick and back, and the choice survives a reload', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'touch device only');
  await boot(page);
  const cdp = await page.context().newCDPSession(page);
  expect((await api(page, () => window.__PONCHO__!.touch())).mode).toBe('buttons');
  await switchTo(page, cdp, 'stick');
  expect(new Set((await api(page, () => window.__PONCHO__!.touch())).buttons.map((b) => b.id))).toEqual(new Set(['stick', 'jump', 'claw', 'mode', 'pause']));
  await page.reload();
  await boot(page);
  expect((await api(page, () => window.__PONCHO__!.touch())).mode).toBe('stick');
  await switchTo(page, cdp, 'buttons');
  expect(new Set((await api(page, () => window.__PONCHO__!.touch())).buttons.map((b) => b.id))).toEqual(new Set(['left', 'right', 'jump', 'claw', 'mode', 'pause']));
});

test('GDD-CTL-03 sliding the finger right of the stick centre runs right, slower near the centre than at the end', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'touch device only');
  await boot(page);
  const cdp = await page.context().newCDPSession(page);
  await switchTo(page, cdp, 'stick');
  const track = await buttonAt(page, 'stick');
  const speedAt = async (frac: number) => {
    await page.evaluate(() => window.__PONCHO__!.teleport(280, 224));
    await page.waitForFunction(() => window.__PONCHO__!.state().grounded);
    await fingers(cdp, 'touchStart', [{ x: track.x + frac * (track.widthCss / 2), y: track.y, id: 1 }]);
    await page.waitForTimeout(300); // long enough to reach that stick position's top speed, short of the wall at x 352
    const vx = await page.evaluate(() => window.__PONCHO__!.state().vx);
    await fingers(cdp, 'touchEnd', []);
    return vx;
  };
  const slow = await speedAt(0.6); // 0.5 of full speed (dead zone 0.2)
  const full = await speedAt(1);
  expect(slow).toBeCloseTo(60, 0);
  expect(full).toBeCloseTo(120, 0);
  expect(await speedAt(0.1)).toBe(0); // inside the dead zone
  expect(await speedAt(-1)).toBeCloseTo(-120, 0);
});

test('GDD-CTL-03 a finger that slides from the stick onto the mode switch does not flip the mode', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'touch device only');
  await boot(page);
  const cdp = await page.context().newCDPSession(page);
  await switchTo(page, cdp, 'stick');
  const track = await buttonAt(page, 'stick');
  const sw = await buttonAt(page, 'mode');
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: track.x, y: track.y, id: 1 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: sw.x, y: sw.y, id: 1 }] });
  await page.waitForTimeout(300);
  expect((await api(page, () => window.__PONCHO__!.touch())).mode).toBe('stick');
  await fingers(cdp, 'touchEnd', []);
  // and a finger that stays on the switch flips it once, not every frame
  await fingers(cdp, 'touchStart', [{ x: sw.x, y: sw.y, id: 2 }]);
  await page.waitForFunction(() => window.__PONCHO__!.touch().mode === 'buttons');
  await page.waitForTimeout(300);
  expect((await api(page, () => window.__PONCHO__!.touch())).mode).toBe('buttons');
  await fingers(cdp, 'touchEnd', []);
});
