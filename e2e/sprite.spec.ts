import { expect, test, type Page } from '@playwright/test';
import { boot, openGame, pixelsAt } from './helpers';

const api = <T>(page: Page, fn: () => T) => page.evaluate(fn);
/** Waits for Poncho to stand on the floor after the title screen. */
const settled = (page: Page) => page.waitForFunction(() => window.__PONCHO__!.ticks() > 10 && window.__PONCHO__!.state().grounded);
/** The frame of his sprite on each rendered frame until it has gone round the run cycle and back to frame 1 (or `ms` pass), with the flip seen last. */
const sampleFrames = (page: Page, ms: number) =>
  page.evaluate(
    (duration) =>
      new Promise<{ frames: number[]; flipX: boolean }>((done) => {
        const frames: number[] = [];
        const start = performance.now();
        const tick = () => {
          const s = window.__PONCHO__!.ponchoSprite();
          frames.push(s.frame);
          const wrapped = frames.lastIndexOf(1) > frames.lastIndexOf(4) && frames.includes(4);
          if (!wrapped && performance.now() - start < duration) requestAnimationFrame(tick);
          else done({ frames, flipX: s.flipX });
        };
        tick();
      }),
    ms,
  );

// A pixel of the user's drawing (GDD-ART-02) where the poncho is a solid blue, #3F66B1: the drawing's cell (50, 10) and its eight
// neighbours are all blue. The frame is 160 art px square and its middle column is on his x, its bottom row on his feet; the
// drawing starts 16 art px from the frame's left (with the tail's room) and 18 from its top, each cell 2 x 2 art px.
// That cell's middle is at art pixel (133, 39), which is 13.25 game px right of his x and 30.25 above his feet.
const BLUE = { r: 0x3f, g: 0x66, b: 0xb1 };
const BLUE_AT = { right: 13.25, above: 30.25 };
const near = (c: { r: number; g: number; b: number }, want: { r: number; g: number; b: number }) =>
  Math.abs(c.r - want.r) <= 24 && Math.abs(c.g - want.g) <= 24 && Math.abs(c.b - want.b) <= 24;

test('GDD-ART-01 the canvas is 1920 x 1080', async ({ page }) => {
  await openGame(page);
  expect(await api(page, () => ({ w: document.querySelector('canvas')!.width, h: document.querySelector('canvas')!.height }))).toEqual({ w: 1920, h: 1080 });
});

test('GDD-ART-04 standing, Poncho shows the standing frame, 40 game px wide, feet on the floor', async ({ page }) => {
  await boot(page);
  await settled(page);
  await page.waitForTimeout(100);
  const sprite = await api(page, () => window.__PONCHO__!.ponchoSprite());
  const s = await api(page, () => window.__PONCHO__!.state());
  expect(sprite).toMatchObject({ frame: 0, width: 40, height: 40 });
  expect(sprite.bottom).toBe(s.y);
  expect(sprite.centerX).toBe(s.x);
});

test('GDD-ART-04 running right plays the run frames in order, facing right', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard test');
  await boot(page);
  await settled(page);
  await page.keyboard.down('ArrowRight');
  const { frames, flipX } = await sampleFrames(page, 4000);
  await page.keyboard.up('ArrowRight');
  // The first sample can still be the standing frame; from the first run frame on, each change goes to the next.
  const running = frames.filter((f) => f !== 0);
  const changes = running.filter((f, i) => i === 0 || f !== running[i - 1]);
  expect(changes.slice(0, 5), JSON.stringify(frames)).toEqual([1, 2, 3, 4, 1]);
  expect(flipX).toBe(false);
});

test('GDD-ART-04 facing left mirrors him', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard test');
  await boot(page);
  await settled(page);
  await page.keyboard.down('ArrowLeft');
  await page.waitForFunction(() => window.__PONCHO__!.state().x < 40);
  await page.keyboard.up('ArrowLeft');
  await page.waitForFunction(() => window.__PONCHO__!.state().vx === 0);
  await page.waitForTimeout(100);
  const sprite = await api(page, () => window.__PONCHO__!.ponchoSprite());
  expect(sprite.flipX).toBe(true);
  expect(sprite.frame).toBe(0);
});

test('GDD-ART-04 in the air he shows the standing frame', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard test');
  await boot(page);
  await settled(page);
  await page.keyboard.down('ArrowRight');
  await page.waitForFunction(() => window.__PONCHO__!.ponchoSprite().frame !== 0);
  await page.keyboard.down('Space');
  await page.waitForFunction(() => !window.__PONCHO__!.state().grounded);
  // Sample every frame until he lands: the frame is 0 whenever the simulation says he is not on the ground.
  const seen = await page.evaluate(
    () =>
      new Promise<{ air: number[]; frames: number }>((done) => {
        const air: number[] = [];
        let frames = 0;
        const tick = () => {
          frames++;
          if (!window.__PONCHO__!.state().grounded) air.push(window.__PONCHO__!.ponchoSprite().frame);
          if (frames < 10 || !window.__PONCHO__!.state().grounded) requestAnimationFrame(tick);
          else done({ air, frames });
        };
        tick();
      }),
  );
  await page.keyboard.up('Space');
  await page.keyboard.up('ArrowRight');
  expect(seen.air.length).toBeGreaterThan(10);
  expect(new Set(seen.air)).toEqual(new Set([0]));
});

test('GDD-ART-02 his sprite is drawn on screen', async ({ page }) => {
  await boot(page);
  await settled(page);
  await page.waitForTimeout(100);
  const s = await api(page, () => window.__PONCHO__!.state());
  const [poncho] = await pixelsAt(page, [{ x: s.x + BLUE_AT.right, y: s.y - BLUE_AT.above }]);
  expect(near(poncho!, BLUE), JSON.stringify(poncho)).toBe(true);
});

test('GDD-UI-02 the title screen shows the standing frame above the menu', async ({ page }) => {
  await openGame(page);
  await page.waitForTimeout(300);
  const title = await api(page, () => window.__PONCHO__!.titleDrawn());
  expect(title.ponchoShown).toBe(true);
  expect(title.ponchoBottom).toBe(168);
  const [poncho] = await pixelsAt(page, [{ x: 240 + BLUE_AT.right, y: title.ponchoBottom - BLUE_AT.above }]);
  expect(near(poncho!, BLUE), JSON.stringify(poncho)).toBe(true);
});
