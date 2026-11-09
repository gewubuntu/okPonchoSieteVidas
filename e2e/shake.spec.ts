import { expect, test, type Page } from '@playwright/test';
import { bossPipBoxes } from '../src/ui/bossPose';
import { boot, pixelsAt, stepToBossMode, stepToEstrellaTear } from './helpers';

// GDD-BOS-01: the screen shake, the camera's y offset on screen. The stepped tests pause the game and step it in the page (L-042) and read
// the camera's scroll and the shake together after each step (L-033, L-073); one test runs the real loop through a hit-stop (L-021). What
// stays still is read from the picture (`pixelsAt`, the same few columns before the shake and during it): the boss bar's middle pip, the far
// backdrop's mountains, and the world's floor edge, which must move. A positive offset draws the world down, so the camera's scroll is
// minus the offset.
const api = <T>(page: Page, fn: () => T) => page.evaluate(fn);
const SAVE_KEY = 'poncho-siete-vidas';
/** A save whose Screen shake row is Off (GDD-UI-02, GDD-PRG-02). */
const SAVE_OFF = '{"version":1,"settings":{"master":10,"effects":10,"language":"en","shake":"off"},"progress":{"tutorialPlayed":true}}';

/** Boots a boss arena from its title screen and pauses it a few steps in. */
async function arena(page: Page, path: string): Promise<string[]> {
  const errors = await boot(page, path);
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 5);
  await api(page, () => window.__PONCHO__!.pause(true));
  return errors;
}

/**
 * Don Zopilote in 1-4 with `hits` taken, paused: his dive aimed at the start (Poncho stands at x 232 until the aim is taken), Poncho moved
 * to x 190 on the floor once it is under way, 42 px left of where he lands, and the game stepped until the step that sticks him in the sand.
 */
async function dive(page: Page, hits = 0): Promise<void> {
  if (hits > 0) await page.evaluate((h) => window.__PONCHO__!.setBoss(h), hits);
  expect(await stepToBossMode(page, 'dive')).toBeLessThan(1000);
  expect(await api(page, () => window.__PONCHO__!.boss()!.tx)).toBe(232);
  await api(page, () => window.__PONCHO__!.teleport(190, 224));
}
/** Steps (paused) to the step that sticks him in the sand. */
async function stick(page: Page): Promise<void> {
  expect(await stepToBossMode(page, 'stuck')).toBeLessThan(200);
}

const frames = (page: Page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null)))));

/** `n` points one game px apart down the column x, the first at `from` (each in the middle of its px). */
const col = (x: number, from: number, n: number) => Array.from({ length: n }, (_, i) => ({ x, y: from + i + 0.5 }));

/** What the picture shows of the boss bar's middle pip (a column), the far backdrop (a grid over the mountains) and the world's floor edge (a column), as text. */
async function columns(page: Page): Promise<{ hud: string; backdrop: string; floor: string }> {
  await frames(page);
  const mountainsY = await api(page, () => window.__PONCHO__!.backdropLayout().mountainsY);
  const pip = bossPipBoxes(3)[1]!;
  const hud = col(pip.x + pip.w / 2, pip.y - 4, pip.h + 8);
  // The far band is a picture of mountains over the sky: a grid of points over its top part, clear of the pillars and of Don Zopilote.
  const backdrop = Array.from({ length: 15 }, (_, i) => col(70 + i * 24, Math.floor(mountainsY) - 3, 40).filter((_p, j) => j % 2 === 0)).flat();
  const floor = col(100, 220, 12);
  const all = await pixelsAt(page, [...hud, ...backdrop, ...floor]);
  const text = (from: number, n: number) => JSON.stringify(all.slice(from, from + n));
  return { hud: text(0, hud.length), backdrop: text(hud.length, backdrop.length), floor: text(hud.length + backdrop.length, floor.length) };
}

test("GDD-BOS-01 shake: Don Zopilote's dive into the sand shakes the world, not the HUD", async ({ page, isMobile }) => {
  const errors = await arena(page, '/?level=1-4');
  await dive(page);
  // Before the shake: nothing runs, the camera is level. Slow reads first (L-042).
  expect(await api(page, () => window.__PONCHO__!.shake())).toBeNull();
  expect(await api(page, () => window.__PONCHO__!.cameraScrollY())).toBe(0);
  const buttons = isMobile ? await api(page, () => window.__PONCHO__!.touch().buttons) : [];
  const still = await columns(page);
  await stick(page);
  // The step that sticks him starts the shake at age 0: 2 px, drawn down (offset +2, the camera's scroll -2), read together on that drawn state.
  const now = await api(page, () => ({ shake: window.__PONCHO__!.shake(), scrollY: window.__PONCHO__!.cameraScrollY(), mode: window.__PONCHO__!.boss()!.mode }));
  expect(now).toEqual({ shake: { px: 2, age: 0, dying: false, size: 2, offset: 2 }, scrollY: -2, mode: 'stuck' });
  const shaken = await columns(page);
  expect(shaken.floor, 'the world moved').not.toBe(still.floor);
  expect(shaken.hud, 'the boss bar did not').toBe(still.hud);
  expect(shaken.backdrop, 'the far backdrop did not').toBe(still.backdrop);
  if (isMobile) expect(await api(page, () => window.__PONCHO__!.touch().buttons)).toEqual(buttons);
  expect(errors).toEqual([]);
});

test('GDD-BOS-01 shake: the touch buttons stay where they are during a shake', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'touch buttons are drawn on the phone only');
  await arena(page, '/?level=1-4');
  await dive(page);
  // The buttons float over a world that shakes behind them, so the picture under them differs; what is asked is whether the camera moves
  // their drawing: read with the camera's scroll, on the same drawn state (L-033).
  const buttons = await api(page, () => window.__PONCHO__!.touch().buttons);
  expect(await api(page, () => window.__PONCHO__!.touch().shiftY)).toBe(0);
  await stick(page);
  const now = await api(page, () => ({ scrollY: window.__PONCHO__!.cameraScrollY(), touch: window.__PONCHO__!.touch() }));
  expect(now.scrollY).toBe(-2);
  expect(now.touch.shiftY).toBe(0);
  expect(now.touch.buttons).toEqual(buttons);
});

test('GDD-BOS-01 shake: with Screen shake Off nothing shakes', async ({ page }) => {
  await page.addInitScript(([key, text]) => localStorage.setItem(key!, text!), [SAVE_KEY, SAVE_OFF]);
  await arena(page, '/?level=1-4');
  expect(await api(page, () => window.__PONCHO__!.settings().shake)).toBe('off');
  await dive(page);
  // The shake itself is still tracked (its steps run), but it is drawn at 0 on every step of it: the camera stays level.
  const seen = await api(page, () => {
    const d = window.__PONCHO__!;
    const out: { age: number; offset: number; scrollY: number }[] = [];
    for (let i = 0; i < 200 && d.boss()!.mode !== 'stuck'; i++) d.step(1);
    for (let i = 0; i < 14; i++) {
      const s = d.shake();
      out.push({ age: s?.age ?? -1, offset: s?.offset ?? 0, scrollY: d.cameraScrollY() });
      d.step(1);
    }
    return out;
  });
  // The first 10 are the shake's ages 0 to 9, then it is gone (age -1).
  expect(seen.map((s) => s.age)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, -1, -1, -1, -1]);
  expect(seen.every((s) => s.offset === 0 && s.scrollY === 0), JSON.stringify(seen)).toBe(true);
});

test('GDD-BOS-01 shake: set to Off mid-shake, the world is drawn still from that frame', async ({ page }) => {
  await arena(page, '/?level=1-4');
  await dive(page);
  await stick(page);
  await api(page, () => window.__PONCHO__!.step(1));
  expect(await api(page, () => ({ s: window.__PONCHO__!.shake(), y: window.__PONCHO__!.cameraScrollY() }))).toEqual({ s: { px: 2, age: 1, dying: false, size: 2, offset: 2 }, y: -2 });
  // The player's pause over the debug one (its events are read every frame), then Settings, down to the Screen shake row, and Right.
  const key = (code: string, keyCode: number) => page.evaluate(([c, k]) => window.dispatchEvent(new KeyboardEvent('keydown', { code: c, keyCode: k, bubbles: true })), [code, keyCode] as const);
  await key('Escape', 27);
  await page.waitForFunction(() => window.__PONCHO__!.pauseDrawn().shown);
  await key('ArrowDown', 40);
  await page.waitForFunction(() => window.__PONCHO__!.pauseDrawn().menu.chosen === 'settings');
  await key('Enter', 13);
  await page.waitForFunction(() => window.__PONCHO__!.settingsDrawn().shown);
  for (const row of ['effects', 'language', 'buttonOpacity', 'layout', 'shake']) {
    await key('ArrowDown', 40);
    await page.waitForFunction((r) => window.__PONCHO__!.settingsDrawn().chosen === r, row);
  }
  // Paused with the shake still at age 1: the world is drawn down while the screen is open (the shake waits through a pause).
  expect(await api(page, () => ({ s: window.__PONCHO__!.shake()!.age, y: window.__PONCHO__!.cameraScrollY() }))).toEqual({ s: 1, y: -2 });
  await key('ArrowRight', 39);
  // From the frame the setting is Off: the offset read, the scroll and the setting together (L-033), the shake itself at the same age.
  await page.waitForFunction(() => {
    const d = window.__PONCHO__!;
    return d.settings().shake === 'off' && d.cameraScrollY() === 0 && d.shake()!.offset === 0 && d.shake()!.age === 1;
  });
  // Back out, resume, and let the shake's steps run: still level, and the shake ran on to its end.
  await key('Escape', 27);
  await page.waitForFunction(() => !window.__PONCHO__!.settingsDrawn().shown);
  await key('Escape', 27);
  await page.waitForFunction(() => !window.__PONCHO__!.pauseDrawn().shown);
  const run = await api(page, () => {
    const d = window.__PONCHO__!;
    const out: number[] = [];
    for (let i = 0; i < 12; i++) {
      d.step(1);
      out.push(d.cameraScrollY());
    }
    return { out, left: d.shake() };
  });
  expect(run.out.every((y) => y === 0), JSON.stringify(run)).toBe(true);
  expect(run.left).toBeNull();
});

test('GDD-BOS-01 shake: a quit to the title ends the shake and the title is drawn level', async ({ page }) => {
  await arena(page, '/?level=1-4');
  await dive(page);
  await stick(page);
  expect(await api(page, () => ({ s: window.__PONCHO__!.shake()!.age, y: window.__PONCHO__!.cameraScrollY() }))).toEqual({ s: 0, y: -2 });
  // Pause (over the debug pause), Down to Quit to title, Enter: the same scene starts over under the title screen.
  const key = (code: string, keyCode: number) => page.evaluate(([c, k]) => window.dispatchEvent(new KeyboardEvent('keydown', { code: c, keyCode: k, bubbles: true })), [code, keyCode] as const);
  await key('Escape', 27);
  await page.waitForFunction(() => window.__PONCHO__!.pauseDrawn().shown);
  await key('ArrowDown', 40);
  await key('ArrowDown', 40);
  await page.waitForFunction(() => window.__PONCHO__!.pauseDrawn().menu.chosen === 'quit');
  await key('Enter', 13);
  await page.waitForFunction(() => window.__PONCHO__!.titleDrawn().shown);
  // The shake and the camera together (L-033): no shake running and the camera level.
  await page.waitForFunction(() => window.__PONCHO__!.shake() === null && window.__PONCHO__!.cameraScrollY() === 0);
});

test("GDD-BOS-01 shake: La Estrella's tear shakes the world 4 px, dying away, and the thud 8 steps later does not cut it", async ({ page }) => {
  const errors = await arena(page, '/?level=2-4');
  await api(page, () => window.__PONCHO__!.setEstrella(2));
  // Poncho on the end of the left cordel, clear of her drop at x 240 and of the tejocotes on the floor.
  await api(page, () => window.__PONCHO__!.teleport(205, 136));
  expect(await stepToEstrellaTear(page)).toBeLessThan(400);
  // The step of the tear is the shake's age 0; then 20 steps in all, the thud (her mode 'rest') among them, and each step's scroll with it.
  const seen = await api(page, () => {
    const d = window.__PONCHO__!;
    const out: { age: number; size: number; offset: number; scrollY: number; mode: string }[] = [];
    for (let i = 0; i < 22; i++) {
      const s = d.shake();
      out.push({ age: s?.age ?? -1, size: s?.size ?? 0, offset: s?.offset ?? 0, scrollY: d.cameraScrollY(), mode: d.estrella()!.mode });
      d.step(1);
    }
    return out;
  });
  expect(seen.map((s) => s.age)).toEqual([...Array.from({ length: 20 }, (_, i) => i), -1, -1]);
  expect(seen.map((s) => s.size)).toEqual([4, 4, 4, 4, 4, 3, 3, 3, 3, 3, 2, 2, 2, 2, 2, 1, 1, 1, 1, 1, 0, 0]);
  expect(seen.map((s) => s.offset)).toEqual([4, 4, -4, -4, 4, 3, -3, -3, 3, 3, -2, -2, 2, 2, -2, -1, 1, 1, -1, -1, 0, 0]);
  expect(seen.map((s) => s.scrollY)).toEqual(seen.map((s) => -s.offset));
  // The thud is the step from age 7 to 8 (she is at rest by age 8); the tear's 4 px is still the running shake, not the thud's 2 px.
  expect(seen[8]!.mode).toBe('rest');
  expect(seen[7]!.mode).toBe('drop');
  expect(errors).toEqual([]);
});

test('GDD-BOS-01 shake: a shake waits through the hit-stop of the real loop', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard test');
  await arena(page, '/?level=1-4');
  // The third hit: stuck in the sand, a claw swings 2 steps after its first, while the dive's 10-step shake is still running.
  await dive(page, 2);
  await stick(page);
  await api(page, () => window.__PONCHO__!.step(1, { move: 0, jumpHeld: false, claw: true }));
  const { samples } = await api(page, async () => {
    const d = window.__PONCHO__!;
    const base = d.hitStop().held;
    const out: { left: number; held: number; age: number; scrollY: number; ticks: number }[] = [];
    d.pause(false);
    for (let i = 0; i < 300; i++) {
      await new Promise<void>((r) => requestAnimationFrame(() => r()));
      const s = d.shake();
      const stop = d.hitStop();
      out.push({ left: stop.left, held: stop.held - base, age: s?.age ?? -1, scrollY: d.cameraScrollY(), ticks: d.ticks() });
      if (stop.held - base >= 12 && stop.left === 0 && out.length > 3 && d.ticks() > out.find((o) => o.held > 0)!.ticks + 3) break;
    }
    d.pause(true);
    return { samples: out };
  });
  const first = samples.findIndex((s) => s.held > 0 || s.left > 0);
  expect(first, 'a hit was seen').toBeGreaterThanOrEqual(0);
  const hit = samples[first]!;
  // The shake was running when the hit landed, and the hit started none: the same age and scroll on every frame still inside the hold.
  expect(hit.age).toBeGreaterThanOrEqual(2);
  const inside = samples.slice(first).filter((s) => s.held < 12);
  expect(inside.length).toBeGreaterThanOrEqual(2);
  for (const s of inside) expect([s.age, s.scrollY, s.ticks], JSON.stringify(s)).toEqual([hit.age, hit.scrollY, hit.ticks]);
  // Then the steps go on and the shake with them (or it has run out).
  const last = samples[samples.length - 1]!;
  expect(last.ticks).toBeGreaterThan(hit.ticks);
  expect(last.age === -1 || last.age > hit.age).toBe(true);
});
