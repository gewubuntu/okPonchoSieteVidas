import { expect, test, type Page } from '@playwright/test';
import { PONCHO_LOOKS } from '../src/ui/ponchoLooks';
import { boot, clearOfButtons, nearHex, pixelsAt, readSheet, spotsIn, stepToBossMode, stepUntil } from './helpers';

// GDD-ART-04, GDD-UI-02: on the level clear screen Poncho plays his victory where he stands, drawn above the screen's veil and under its
// lines and menu. Timed in simulation steps, never frames (L-042): the stepped tests pause the game and step it in the page; one test runs
// through the game's own frames (L-021). 0-1's exit stands at x 1400 on the floor (y 224); 1-4 is Don Zopilote's arena.
const api = <T>(page: Page, fn: () => T) => page.evaluate(fn);
const BLUE = '#3F66B1'; // his poncho's blue (GDD-ART-02); close matches only, so the sky and the mountains do not count
// Where victory0 has a square of solid blue 1.5 game px across, read from his sheet (game px from the frame's middle).
const BLUE_SPOTS = spotsIn(readSheet('poncho.png'), 48, 48, PONCHO_LOOKS.indexOf('victory0'), BLUE, { size: 1.5 });
declare global {
  interface Window {
    /** The looks noted frame by frame by the unpaused test, in order, without repeats. */
    victoryLooks?: string[];
  }
}

/** Boots 0-1, pauses it a few steps in, and steps once with `move` held on the floor at the exit: the first step of the clear screen. */
async function atExit(page: Page, move: -1 | 0 | 1 = 0): Promise<string[]> {
  const errors = await boot(page, '/?level=0-1');
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 5);
  await api(page, () => window.__PONCHO__!.pause(true));
  await page.evaluate((m) => {
    const d = window.__PONCHO__!;
    d.teleport(1400, 224);
    d.step(1, { move: m, jumpHeld: false });
  }, move);
  expect(await api(page, () => window.__PONCHO__!.phase())).toBe('clear');
  return errors;
}

/** Steps `n` times (in the page) and returns the look and the mirroring he is drawn with. */
const after = (page: Page, n: number) =>
  page.evaluate((k) => {
    const d = window.__PONCHO__!;
    d.step(k);
    const s = d.ponchoSprite();
    return { look: s.look, flipX: s.flipX };
  }, n);

test('GDD-ART-04 GDD-UI-02 on the clear screen Poncho plays the victory above the veil', async ({ page }) => {
  const errors = await boot(page, '/?level=0-1');
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 5);
  await api(page, () => window.__PONCHO__!.pause(true));
  // In play he is under the screens, at the level's depth 3.
  expect(await api(page, () => window.__PONCHO__!.clearLayers())).toMatchObject({ poncho: 3, veilShown: false });
  // He comes to the exit facing left: a step to the left on its floor reaches it.
  await page.evaluate(() => {
    const d = window.__PONCHO__!;
    d.teleport(1400, 224);
    d.step(1, { move: -1, jumpHeld: false });
  });
  expect(await api(page, () => window.__PONCHO__!.phase())).toBe('clear');
  expect(await api(page, () => window.__PONCHO__!.state().facing)).toBe(-1);
  // The screen's first step: victory0, not mirrored although he faces left. Then 12 steps on: step 13, victory1; 5 more: victory2; 5 more:
  // victory3; 24 more: victory2.
  const first = await api(page, () => ({ look: window.__PONCHO__!.ponchoSprite().look, flipX: window.__PONCHO__!.ponchoSprite().flipX }));
  expect([first, await after(page, 12), await after(page, 5), await after(page, 5), await after(page, 24)]).toEqual([
    { look: 'victory0', flipX: false },
    { look: 'victory1', flipX: false },
    { look: 'victory2', flipX: false },
    { look: 'victory3', flipX: false },
    { look: 'victory2', flipX: false },
  ]);
  // Above the veil, under the lines and the menu.
  const layers = await api(page, () => window.__PONCHO__!.clearLayers());
  expect(layers.veilShown).toBe(true);
  expect(layers.veil).toBeLessThan(layers.poncho);
  expect(layers.poncho).toBeLessThan(layers.lines);
  expect(await api(page, () => window.__PONCHO__!.clearDrawn().shown)).toBe(true);
  expect(errors).toEqual([]);
});

test('GDD-ART-04 GDD-UI-02 the picture: his own colours above the veil, the level dimmed all round him', async ({ page }) => {
  await atExit(page);
  await api(page, () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const feet = await api(page, () => ({ ...window.__PONCHO__!.bodyPose(), viewX: window.__PONCHO__!.camera().viewX }));
  // His poncho's blue (the camera follows him, so the screen's x is the world's less the view's), undimmed, where victory0 has it (clear of the phone's touch buttons, L-018).
  const blue = await clearOfButtons(page, BLUE_SPOTS.map((s) => ({ x: feet.x - feet.viewX + s.dx, y: feet.y - 24 + s.dy })));
  expect(blue.length).toBeGreaterThan(0);
  const [mark] = await pixelsAt(page, [blue[0]!]);
  expect(nearHex(mark!, BLUE, 12), JSON.stringify(mark)).toBe(true);
  // The veil covers the whole screen, scrolled with the camera or not: the level at both sides of the screen, far from him, is dark.
  const sides = await clearOfButtons(page, [{ x: 24, y: 130 }, { x: 456, y: 130 }]);
  expect(sides.length).toBeGreaterThan(0);
  for (const c of await pixelsAt(page, sides)) expect(Math.max(c.r, c.g, c.b), JSON.stringify(c)).toBeLessThan(90);
});

test('GDD-ART-04 the victory is not mirrored, facing right either', async ({ page }) => {
  await atExit(page, 1);
  expect(await api(page, () => window.__PONCHO__!.state().facing)).toBe(1);
  expect(await api(page, () => window.__PONCHO__!.ponchoSprite())).toMatchObject({ look: 'victory0', flipX: false });
  expect(await after(page, 30)).toEqual({ look: 'victory3', flipX: false }); // the screen's step 31
});

test('GDD-ART-04 the victory shows in a boss arena too, where he is as the screen comes up', async ({ page }) => {
  await boot(page, '/?level=1-4');
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 5);
  await api(page, () => window.__PONCHO__!.pause(true));
  await api(page, () => window.__PONCHO__!.setBoss(2));
  // Beside the boss when he is stuck in the sand, as boss.spec.ts does, then the third hit.
  expect(await stepToBossMode(page, 'dive')).toBeLessThan(1000);
  await api(page, () => window.__PONCHO__!.teleport(190, 224));
  expect(await stepToBossMode(page, 'stuck')).toBeLessThan(200);
  await api(page, () => window.__PONCHO__!.step(3, { move: 0, jumpHeld: false, claw: true }));
  expect(await api(page, () => window.__PONCHO__!.boss())).toMatchObject({ hits: 3, mode: 'defeated' });
  expect(await api(page, () => window.__PONCHO__!.clearLayers().poncho)).toBe(3);
  expect(await stepUntil(page, { phase: 'clear' }, 120)).toBeLessThan(120);
  // He stood still where he was as the screen came up, drawn at the screen's depth, victory0 on its first step.
  const spot = await api(page, () => window.__PONCHO__!.state());
  expect(await api(page, () => window.__PONCHO__!.ponchoSprite())).toMatchObject({ look: 'victory0', flipX: false });
  const layers = await api(page, () => window.__PONCHO__!.clearLayers());
  expect(layers.veil).toBeLessThan(layers.poncho);
  expect(layers.poncho).toBeLessThan(layers.lines);
  expect(await api(page, () => window.__PONCHO__!.bodyPose())).toMatchObject({ x: spot.x, y: spot.y });
  expect(await after(page, 12)).toEqual({ look: 'victory1', flipX: false });
});

test('GDD-ART-04 the game\'s own frames play the victory through: it starts on victory0 and pumps between victory3 and victory2', async ({ page }) => {
  await boot(page, '/?level=0-1');
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 5);
  // L-021: unpaused, the looks are noted each frame from the moment he reaches the exit. A frame may take several steps, so the 5-step
  // looks (victory1, victory2) may go unseen: only the order of what is seen is asserted.
  await page.evaluate(() => {
    window.victoryLooks = [];
    const note = () => {
      const d = window.__PONCHO__!;
      const look = d.ponchoSprite().look;
      if (d.phase() === 'clear' && window.victoryLooks![window.victoryLooks!.length - 1] !== look) window.victoryLooks!.push(look);
      requestAnimationFrame(note);
    };
    requestAnimationFrame(note);
    window.__PONCHO__!.teleport(1400, 224);
  });
  await page.waitForFunction(() => {
    const seen = window.victoryLooks!;
    return seen.indexOf('victory3') > -1 && seen.lastIndexOf('victory2') > seen.indexOf('victory3');
  });
  const seen = await api(page, () => window.victoryLooks!);
  expect(seen[0]).toBe('victory0');
  expect(seen.every((look) => look.startsWith('victory'))).toBe(true);
  expect(seen.indexOf('victory3')).toBeGreaterThan(0);
});
