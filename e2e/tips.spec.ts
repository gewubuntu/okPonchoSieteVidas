import { expect, test, type Page } from '@playwright/test';
import { boot, openGame, start, stepUntil, tapAt } from './helpers';

// GDD-UI-05: the tutorial tips of 0-1. These open the game at "/", which plays 0-1. Things are timed in simulation steps (L-042):
// the game is paused with `pause(true)` and moved with `teleport` and `step`, except where the test is about real frames.
const api = <T>(page: Page, fn: () => T) => page.evaluate(fn);
const frames = (page: Page, n = 2) => page.evaluate((k) => new Promise((r) => { let i = 0; const tick = () => (++i >= k ? r(null) : requestAnimationFrame(tick)); requestAnimationFrame(tick); }), n);
const tip = (page: Page) => api(page, () => window.__PONCHO__!.tip());

type Rect = { x: number; y: number; w: number; h: number };
const apart = (a: Rect, b: Rect) => a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y;

/** Pauses the simulation, puts Poncho on the floor at x and runs 13 steps, which is past a tip's fade in. */
async function standAt(page: Page, x: number): Promise<void> {
  await page.evaluate(() => window.__PONCHO__!.pause(true));
  await page.evaluate((px) => window.__PONCHO__!.teleport(px, 224), x);
  await page.evaluate(() => window.__PONCHO__!.step(13));
}

test('GDD-CTL-03 at Low Button opacity the tip outline round the touch buttons keeps its own alpha', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'the desktop draws no touch buttons');
  // A save with Button opacity Low, as if set on the settings screen earlier (GDD-PRG-02).
  await page.addInitScript(() =>
    localStorage.setItem('poncho-siete-vidas', JSON.stringify({ version: 1, settings: { master: 10, effects: 10, language: 'en', buttonOpacity: 'low' }, progress: { tutorialPlayed: false } })),
  );
  await start(page, isMobile);
  await page.waitForFunction(() => window.__PONCHO__!.tip().alpha === 1 && window.__PONCHO__!.touch().highlighted === 'move');
  const touch = await api(page, () => window.__PONCHO__!.touch());
  expect(touch.opacity).toBe('low'); // the buttons are drawn at half
  expect(touch.alphas.idleOutline).toBeCloseTo(0.175, 10);
  expect(touch.highlightAlpha).toBe(1); // the outline is not
});

test('GDD-UI-05 the first tip shows at the start in the words of the device', async ({ page, isMobile }) => {
  await start(page, isMobile);
  await page.waitForFunction(() => window.__PONCHO__!.tip().alpha === 1);
  const shown = await tip(page);
  expect(shown).toMatchObject({ index: 0, button: 'move', highlight: null });
  if (isMobile) {
    expect(shown).toMatchObject({ text: 'Hold left or right to run', device: 'touch' });
    expect((await api(page, () => window.__PONCHO__!.touch())).highlighted).toBe('move');
  } else {
    expect(shown).toMatchObject({ text: 'Arrows or A/D to run', device: 'keyboard' });
    expect((await api(page, () => window.__PONCHO__!.touch())).highlighted).toBeNull(); // no touch buttons on a desktop
    // A mouse click is no touch: the words stay the keyboard's.
    await tapAt(page, 240, 60, false);
    await frames(page, 4);
    expect(await tip(page)).toMatchObject({ text: 'Arrows or A/D to run', device: 'keyboard' });
  }
});

test('GDD-UI-05 a key press switches the words to the keyboard', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'a phone starts on touch');
  await start(page, true);
  await page.waitForFunction(() => window.__PONCHO__!.tip().alpha === 1);
  expect((await tip(page)).device).toBe('touch');
  await page.keyboard.press('ArrowRight');
  await page.waitForFunction(() => window.__PONCHO__!.tip().device === 'keyboard' && window.__PONCHO__!.tip().text === 'Arrows or A/D to run');
  // The touch buttons are outlined only while touch is the device used last.
  await page.waitForFunction(() => window.__PONCHO__!.touch().highlighted === null);
});

test('GDD-UI-05 the wall tip and its outline', async ({ page }) => {
  await boot(page, '/');
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 5);
  await standAt(page, 150);
  expect(await tip(page)).toMatchObject({ index: 1, alpha: 1, highlight: { x: 174, y: 190, w: 36, h: 36 }, button: 'jump' });
  expect((await tip(page)).box.y).toBe(26);
  // The outline is halfway through its 48-step pulse every 12 steps in: it has grown 2 px * (1 - cos(2 pi steps / 48)) / 2, and the page's steps are the pulse's.
  const { grow } = await tip(page);
  const steps = await api(page, () => window.__PONCHO__!.ticks());
  expect(grow).toBeCloseTo(1 - Math.cos((2 * Math.PI * steps) / 48), 6);
});

test('GDD-UI-05 the Alacrán tip goes for good once it is defeated', async ({ page }) => {
  await boot(page, '/?level=0-1'); // by its address, so quitting to the title brings 0-1 back, not 1-1 (GDD-UI-02)
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 5);
  await page.evaluate(() => window.__PONCHO__!.pause(true));
  // Drop onto the first Alacrán from above until it is defeated (the stomp).
  await page.evaluate(() => {
    const d = window.__PONCHO__!;
    for (let i = 0; i < 40 && d.enemies()[0]!.alive; i++) {
      if (i % 12 === 0) d.teleport(d.enemies()[0]!.x + 3, 200);
      d.step(1);
    }
  });
  expect(await api(page, () => window.__PONCHO__!.enemies()[0]!.alive)).toBe(false);
  await page.evaluate(() => window.__PONCHO__!.teleport(470, 224));
  await page.evaluate(() => window.__PONCHO__!.step(20));
  expect(await tip(page)).toMatchObject({ index: null, alpha: 0 });
  expect((await api(page, () => window.__PONCHO__!.tipsDone()))[4]).toBe(true);
  // A lost life, in the first 3-tile gap: the Alacrán is alive again, and the tip stays gone.
  await page.evaluate(() => window.__PONCHO__!.teleport(872, 230));
  await stepUntil(page, { phase: 'respawning' }, 100);
  expect(await api(page, () => window.__PONCHO__!.phase())).toBe('respawning');
  await page.evaluate(() => window.__PONCHO__!.step(48));
  expect(await api(page, () => window.__PONCHO__!.phase())).toBe('playing');
  expect(await api(page, () => window.__PONCHO__!.enemies()[0]!.alive)).toBe(true);
  await page.evaluate(() => window.__PONCHO__!.teleport(470, 224));
  await page.evaluate(() => window.__PONCHO__!.step(20));
  expect(await tip(page)).toMatchObject({ index: null, alpha: 0 });
  // Quit to the title with a tip showing, and start again: a fresh run, no tip left over on the title, and the tip is back in the pen.
  await page.evaluate(() => window.__PONCHO__!.teleport(150, 224));
  await page.evaluate(() => window.__PONCHO__!.step(13));
  expect(await tip(page)).toMatchObject({ index: 1, alpha: 1 });
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.__PONCHO__!.pauseDrawn().shown);
  for (const want of ['settings', 'quit'] as const) {
    await page.keyboard.press('ArrowDown');
    await page.waitForFunction((w) => window.__PONCHO__!.pauseDrawn().menu.chosen === w, want);
  }
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__PONCHO__!.titleDrawn().shown);
  expect((await api(page, () => window.__PONCHO__!.tipsDone())).some(Boolean)).toBe(false);
  await frames(page, 3);
  expect(await tip(page)).toMatchObject({ index: null, alpha: 0 });
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => !window.__PONCHO__!.titleDrawn().shown);
  await page.evaluate(() => window.__PONCHO__!.teleport(470, 224));
  await page.evaluate(() => window.__PONCHO__!.step(13));
  expect(await tip(page)).toMatchObject({ index: 4, alpha: 1 });
});

test('GDD-UI-05 the tip fades while the game runs', async ({ page }) => {
  await boot(page, '/');
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 5);
  // Real frames, nothing paused (L-021): from tip 1's stretch to tip 3's, on the floor between the two gaps. The teleport and the
  // sampling are one task, so the first frame sampled is the first after the teleport. Each sample is the steps run so far and the tip's
  // opacity as drawn, so what is checked is how the picture follows the steps (a frame takes up to 5 of them), not how many frames come.
  const samples = await page.evaluate(async () => {
    const d = window.__PONCHO__!;
    d.teleport(290, 224);
    const seen: { ticks: number; alpha: number }[] = [];
    for (let i = 0; i < 200 && seen.at(-1)?.alpha !== 1; i++) {
      await new Promise((r) => requestAnimationFrame(r));
      const t = d.tip();
      if (t.index === 2) seen.push({ ticks: d.ticks(), alpha: t.alpha });
    }
    return seen;
  });
  expect(samples.length).toBeGreaterThanOrEqual(3); // 12 steps of fade, at most 5 a frame
  expect(samples[0]!.alpha).toBeLessThan(1);
  expect(samples.at(-1)!.alpha).toBe(1);
  // The fade is 1/12 a step from the step the tip became the one shown: every sample's opacity is the steps since then over 12, up to 1.
  const began = samples[0]!.ticks - samples[0]!.alpha * 12;
  for (const s of samples) expect(s.alpha, JSON.stringify(s)).toBeCloseTo(Math.min(1, (s.ticks - began) / 12), 6);
  expect(new Set(samples.map((s) => s.alpha)).size).toBeGreaterThanOrEqual(3);
});

test('GDD-UI-05 the tutorial draws no placeholder lines and the sandbox does', async ({ page }) => {
  await openGame(page, '/');
  expect(await api(page, () => window.__PONCHO__!.placeholderLines())).toBe(false);
  await openGame(page);
  expect(await api(page, () => window.__PONCHO__!.placeholderLines())).toBe(true);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => !window.__PONCHO__!.titleDrawn().shown);
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 30);
  expect(await tip(page)).toMatchObject({ index: null, alpha: 0 });
});

test('GDD-UI-05 the tip box sits under the HUD and clear of the pause button', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'touch device only');
  await start(page, true);
  await standAt(page, 150);
  const { box, index } = await tip(page);
  expect(index).toBe(1);
  const touch = await api(page, () => window.__PONCHO__!.touch());
  const pause = touch.buttons.find((b) => b.id === 'pause')!;
  expect(apart(box, pause)).toBe(true);
  // The hilo counter: its text and the skein left of it, from the top of the HUD row (y 8) 12 px down; the lives row ends at y 17.
  const counter = await api(page, () => window.__PONCHO__!.hudHilos());
  expect(apart(box, { x: counter.iconX - 5, y: counter.top, w: counter.right - counter.iconX + 5, h: 12 })).toBe(true);
  expect(apart(box, { x: 8, y: 8, w: 7 * 13, h: 12 })).toBe(true);
  expect(box.y).toBeGreaterThanOrEqual(26);
});

test('GDD-UI-05 a gamepad button switches the words to the pad', async ({ page }) => {
  await page.addInitScript(() => {
    const pad = { id: 'fake', index: 0, connected: true, mapping: 'standard', timestamp: 0, buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })), axes: [0, 0, 0, 0] };
    window.__pad = pad;
    Object.defineProperty(navigator, 'getGamepads', { value: () => [pad], configurable: true });
  });
  await boot(page, '/');
  await standAt(page, 150);
  await page.waitForFunction(() => window.__PONCHO__!.tip().text === 'Space to jump. Hold it to jump higher');
  await page.evaluate(() => {
    window.__pad!.buttons[4]!.pressed = true; // a shoulder button: any button counts
  });
  await page.waitForFunction(() => window.__PONCHO__!.tip().device === 'pad' && window.__PONCHO__!.tip().text === 'Bottom button to jump. Hold it to jump higher');
});
