import { expect, test, type Page } from '@playwright/test';
import { boot, openGame, pixelsAt, resultsRowCentre, stepToBossMode, stepUntil, tapAt, waitForResults } from './helpers';

// GDD-BOS-01, GDD-BOS-02: Don Zopilote in his arena, level 1-4, opened by its address (GDD-UI-02). Timed in simulation steps, never by
// polling around an event (L-042): the stepped tests pause the game and step it in the page; one test runs through the game's own frames
// (L-021). The boss is read through `boss()` and `bossDrawn()`, never picked out by where he is (L-015).
const api = <T>(page: Page, fn: () => T) => page.evaluate(fn);
type Colour = { r: number; g: number; b: number };
const brightness = (c: Colour) => c.r + c.g + c.b;
const pale = (c: Colour) => c.r > 220 && c.g > 220 && c.b > 205; // his thorns, f2efe6

/** Boots 1-4 from its title screen and pauses it a few steps in, Poncho at the start (x 232). */
async function arena(page: Page): Promise<string[]> {
  const errors = await boot(page, '/?level=1-4');
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 5);
  await api(page, () => window.__PONCHO__!.pause(true));
  return errors;
}

/**
 * Steps (paused) until he is stuck in the sand after a dive aimed at the start (Poncho stands at x 232 until the aim is taken), Poncho
 * moved to x 190 on the floor once the dive is under way: 42 px left of where he lands, facing him, clear of his box.
 */
async function stuckBeside(page: Page): Promise<void> {
  expect(await stepToBossMode(page, 'dive')).toBeLessThan(1000);
  expect(await api(page, () => window.__PONCHO__!.boss()!.tx)).toBe(232);
  await api(page, () => window.__PONCHO__!.teleport(190, 224));
  expect(await stepToBossMode(page, 'stuck')).toBeLessThan(200);
}

test('GDD-BOS-02 level=1-4 opens the arena on the title screen and Start plays it, with the boss bar', async ({ page, isMobile }) => {
  const errors = await openGame(page, '/?level=1-4');
  expect(await api(page, () => window.__PONCHO__!.level())).toBe('1-4');
  expect((await api(page, () => window.__PONCHO__!.titleDrawn())).shown).toBe(true);
  // GDD-UI-01: under the title screen's veil (depth 11) the bar is drawn, dimmed like the rest of the HUD (L-023): the middle pip is
  // sampled there and again once the level has started.
  await page.waitForFunction(() => window.__PONCHO__!.bossBar().pips === 3);
  const [pipDim] = await pixelsAt(page, [{ x: 240, y: 21 }]);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => !window.__PONCHO__!.titleDrawn().shown && window.__PONCHO__!.ticks() > 5 && window.__PONCHO__!.bossBar().pips === 3);
  expect(await api(page, () => window.__PONCHO__!.bossBar())).toEqual({ shown: true, name: 'Don Zopilote', nameY: 10, pips: 3, outlines: 0 });
  expect(await api(page, () => window.__PONCHO__!.boss())).toMatchObject({ hits: 0, mode: 'lap' });
  expect(await api(page, () => window.__PONCHO__!.exitDrawn())).toBe(false);
  expect(await api(page, () => window.__PONCHO__!.hilos())).toMatchObject({ taken: 0, total: 0 });
  // GDD-UI-01: with no hilos in the arena the counter reads "0/0" (an Open Question for the user).
  expect((await api(page, () => window.__PONCHO__!.hudHilos())).text).toBe('0/0');
  expect(await api(page, () => window.__PONCHO__!.rocksDrawn())).toEqual([
    { x: 56, y: 176 },
    { x: 424, y: 176 },
  ]);
  // The three pips are drawn filled: their middles show the HUD's red (#b94842), not the amber sky (#e39a48) behind them.
  const pips = await pixelsAt(page, [{ x: 230, y: 21 }, { x: 240, y: 21 }, { x: 250, y: 21 }]);
  for (const c of pips) expect(c.g, JSON.stringify(c)).toBeLessThan(110);
  expect(brightness(pipDim!), `${JSON.stringify(pipDim)} under the veil, ${JSON.stringify(pips[1])} in play`).toBeLessThan(brightness(pips[1]!) * 0.5);
  if (isMobile) {
    // The bar (x 227 to 253, y 6 to 24) keeps clear of the pause button in the top right (L-027).
    const pause = (await api(page, () => window.__PONCHO__!.touch().buttons)).find((b) => b.id === 'pause')!;
    expect(pause.x).toBeGreaterThan(253);
  }
  expect(errors).toEqual([]);
});

test('GDD-UI-01 no boss bar in a level without a boss', async ({ page }) => {
  await boot(page);
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 5);
  expect(await api(page, () => window.__PONCHO__!.bossBar())).toMatchObject({ shown: false, pips: 0, outlines: 0 });
  expect(await api(page, () => window.__PONCHO__!.boss())).toBeNull();
  expect(await api(page, () => window.__PONCHO__!.bossDrawn())).toBeNull();
});

test('GDD-BOS-02 he circles, dives and sticks in the sand, dazed, in real time', async ({ page }) => {
  const errors = await boot(page, '/?level=1-4');
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 5);
  // On the left pillar top, out of his reach: the dive aims at the end of his lap beside it, x 88.
  await api(page, () => window.__PONCHO__!.teleport(40, 176));
  const x0 = await api(page, () => window.__PONCHO__!.bossDrawn()!.x);
  await page.waitForFunction((x) => Math.abs(window.__PONCHO__!.bossDrawn()!.x - x) > 20, x0);
  // Stuck beside the pillar, at the end of his lap (x 88) with his box on the floor (y 209), dazed: read together (L-033).
  await page.waitForFunction(
    () => {
      const d = window.__PONCHO__!;
      const b = d.boss()!;
      return b.mode === 'stuck' && b.x === 88 && b.y === 209 && b.hits === 0 && d.bossDrawn()?.dots === 3 && d.bossDrawn()?.wings === 'lowered';
    },
    undefined,
    { timeout: 20_000 },
  );
  expect(await api(page, () => window.__PONCHO__!.lives())).toBe(7);
  expect(errors).toEqual([]);
});

test('GDD-BOS-02 his body flashes red in his telegraph and white when a claw swipe hits him stuck, and the bar loses a pip', async ({ page }) => {
  await arena(page);
  expect(await stepToBossMode(page, 'telegraph')).toBeLessThan(1000);
  // Red and wings raised, both read from what was handed to Phaser, in one read (L-033).
  await page.waitForFunction(() => window.__PONCHO__!.bossDrawn()?.flash === 'red' && window.__PONCHO__!.bossDrawn()?.wings === 'raised');
  const b = (await api(page, () => window.__PONCHO__!.boss()))!;
  // The middle of his body, 3 px below his middle: under no head, wing, thorn or touch button.
  const [red] = await pixelsAt(page, [{ x: b.x, y: b.y + 3 }]);
  expect(red!.r, JSON.stringify(red)).toBeGreaterThan(200);
  expect(red!.g, JSON.stringify(red)).toBeLessThan(120);
  await api(page, () => window.__PONCHO__!.step(4));
  await page.waitForFunction(() => window.__PONCHO__!.bossDrawn()?.flash === null);
  const [plain] = await pixelsAt(page, [{ x: b.x, y: b.y + 3 }]);
  expect(plain!.r, JSON.stringify(plain)).toBeLessThan(120);
  await stuckBeside(page);
  // A press held for three steps: two of wind-up, then the swing that reaches him (GDD-CMB-02).
  await api(page, () => window.__PONCHO__!.step(3, { move: 0, jumpHeld: false, claw: true }));
  // Two pips filled and the hit taken drawn as a grey outline (GDD-UI-01, GDD-UI-03), read with his flash in one read (L-033).
  await page.waitForFunction(() => {
    const d = window.__PONCHO__!;
    return d.boss()!.mode === 'hurt' && d.bossDrawn()?.flash === 'white' && d.bossBar().pips === 2 && d.bossBar().outlines === 1;
  });
  const [white, first, last] = await pixelsAt(page, [{ x: 232, y: 212 }, { x: 230, y: 21 }, { x: 250, y: 21 }]);
  expect(Math.min(white!.r, white!.g, white!.b), JSON.stringify(white)).toBeGreaterThan(220);
  expect(first!.g, JSON.stringify(first)).toBeLessThan(110); // still filled
  expect(last!.g, JSON.stringify(last)).toBeGreaterThan(120); // an outline: the sky shows through
  expect(await api(page, () => window.__PONCHO__!.sfx())).toContain('stomp');
});

test('GDD-CMB-01 three pale thorns on his back mark Don Zopilote as not stompable', async ({ page }) => {
  await arena(page);
  expect(await stepToBossMode(page, 'telegraph')).toBeLessThan(1000);
  // Frozen at the right end of his lap, wings raised, facing Poncho to the left. Each thorn is sampled in its middle, 3 px above its
  // base, where it is 6 px wide: clear of his head and crown (to the left), with a raised wing behind the outer two and the sky behind
  // the middle one, so none of them shows pale without its thorn (L-017).
  await page.waitForFunction(() => window.__PONCHO__!.bossDrawn()?.flash === 'red' && window.__PONCHO__!.bossDrawn()?.wings === 'raised');
  const { x, y } = (await api(page, () => window.__PONCHO__!.boss()))!;
  const thorns = await pixelsAt(page, [-11, 1, 13].map((dx) => ({ x: x + dx, y: y - 9 })));
  expect(thorns.filter(pale).length, JSON.stringify(thorns)).toBeGreaterThanOrEqual(2);
});

test('GDD-BOS-02 a claw press on the keyboard or the touch Claw button hits him while he is stuck', async ({ page, isMobile }) => {
  await arena(page);
  await stuckBeside(page);
  // Slow setup first (L-042): the button's place is read while still paused. The press is made while paused too: a latched press waits
  // for the next step (L-006), so it is used on the first step after the unpause. A tap on the phone takes about a second, as long as
  // his 60 steps in the sand, so tapping after the unpause would land the swing as he climbs away.
  const claw = isMobile ? (await api(page, () => window.__PONCHO__!.touch().buttons)).find((b) => b.id === 'claw')! : null;
  if (claw) await tapAt(page, claw.x + claw.w / 2, claw.y + claw.h / 2, true);
  else await page.keyboard.press('KeyX');
  await api(page, () => window.__PONCHO__!.pause(false));
  await page.waitForFunction(() => window.__PONCHO__!.boss()!.hits === 1 && window.__PONCHO__!.bossBar().pips === 2);
  expect(await api(page, () => window.__PONCHO__!.boss()!.mode)).toBe('hurt');
});

test('GDD-BOS-02 phase 2: a claw swipe on the pillar knocks its rock onto him as he climbs beside it', async ({ page }) => {
  await arena(page);
  await api(page, () => {
    window.__PONCHO__!.setBoss(1);
    window.__PONCHO__!.teleport(40, 176);
  });
  // From the right end he drops at x 392, sweeps left and climbs at x 88, beside the left pillar.
  expect(await stepToBossMode(page, 'climb')).toBeLessThan(600);
  expect(await api(page, () => window.__PONCHO__!.boss())).toMatchObject({ x: 88, y: 209, hits: 1 });
  await api(page, () => window.__PONCHO__!.step(1, { move: 0, jumpHeld: false, claw: true }));
  await api(page, () => window.__PONCHO__!.step(10));
  const flying = (await api(page, () => window.__PONCHO__!.rocks()))[0]!;
  expect(flying.mode).toBe('flying');
  await page.waitForFunction(([x, y]) => window.__PONCHO__!.rocksDrawn().some((r) => Math.abs(r.x - x!) < 0.01 && Math.abs(r.y - y!) < 0.01), [flying.x, flying.y]);
  await page.evaluate(() => {
    const d = window.__PONCHO__!;
    for (let i = 0; i < 40 && d.boss()!.hits < 2; i++) d.step(1);
  });
  expect(await api(page, () => window.__PONCHO__!.boss())).toMatchObject({ hits: 2, mode: 'hurt' });
  expect((await api(page, () => window.__PONCHO__!.rocks()))[0]!.mode).toBe('gone');
  await page.waitForFunction(() => window.__PONCHO__!.bossBar().pips === 1 && window.__PONCHO__!.rocksDrawn().length === 1);
});

test('GDD-BOS-02 phase 3: his fruit lies on the floor for 3.0 s, drawn there', async ({ page }) => {
  await arena(page);
  await api(page, () => {
    window.__PONCHO__!.setBoss(2);
    window.__PONCHO__!.teleport(40, 176);
  });
  // The lap's first fruit drops on its 40th step at x 316 and lands on the 98th.
  await api(page, () => window.__PONCHO__!.step(98));
  const lying = (await api(page, () => window.__PONCHO__!.fruit())).find((f) => f.landed)!;
  expect(lying).toMatchObject({ y: 224, landed: true });
  expect(lying.x).toBeCloseTo(316, 1);
  await page.waitForFunction((x) => window.__PONCHO__!.fruitDrawn().some((f) => f.landed && Math.abs(f.x - x) < 0.01), lying.x);
  await api(page, () => window.__PONCHO__!.step(179));
  expect((await api(page, () => window.__PONCHO__!.fruit())).some((f) => f.landed && Math.abs(f.x - 316) < 1)).toBe(true);
  await api(page, () => window.__PONCHO__!.step(1));
  expect((await api(page, () => window.__PONCHO__!.fruit())).some((f) => Math.abs(f.x - 316) < 1)).toBe(false);
  await page.waitForFunction(() => !window.__PONCHO__!.fruitDrawn().some((f) => Math.abs(f.x - 316) < 1));
  expect(await api(page, () => window.__PONCHO__!.lives())).toBe(7);
});

test('GDD-BOS-02 the third hit defeats him, and 1.0 s later the level clear screen comes up and 1-4 is saved', async ({ page, isMobile }) => {
  await arena(page);
  await api(page, () => window.__PONCHO__!.setBoss(2));
  await stuckBeside(page);
  // Only the sounds of the hit itself: `sfx()` lists every sound since the page loaded.
  const heard = (await api(page, () => window.__PONCHO__!.sfx())).length;
  await api(page, () => window.__PONCHO__!.step(3, { move: 0, jumpHeld: false, claw: true }));
  expect(await api(page, () => window.__PONCHO__!.boss())).toMatchObject({ hits: 3, mode: 'defeated' });
  await page.waitForFunction(() => window.__PONCHO__!.bossDrawn()?.flash === 'white' && window.__PONCHO__!.bossBar().pips === 0 && window.__PONCHO__!.bossBar().outlines === 3);
  expect(await api(page, () => window.__PONCHO__!.fruit())).toEqual([]);
  expect((await api(page, () => window.__PONCHO__!.sfx())).slice(heard)).toEqual(expect.arrayContaining(['meow', 'stomp']));
  await api(page, () => window.__PONCHO__!.step(59));
  expect(await api(page, () => window.__PONCHO__!.phase())).toBe('playing');
  await api(page, () => window.__PONCHO__!.step(1));
  expect(await api(page, () => window.__PONCHO__!.phase())).toBe('clear');
  await api(page, () => window.__PONCHO__!.pause(false));
  await waitForResults(page);
  const clear = await api(page, () => window.__PONCHO__!.clearDrawn());
  expect(clear).toMatchObject({ shown: true, hilos: 'Hilos 0/0', medal: 'Gold medal' });
  // 1-4 names no next level (GDD-UI-02): "Next level" is greyed and the menu opens on Retry.
  expect(clear.menu).toMatchObject({ chosen: 'retry', colors: ['#5c6178', '#fff3dc', '#9ba3c4'] });
  // Up from Retry stays there.
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('KeyW');
  const t0 = await api(page, () => window.__PONCHO__!.ticks());
  await page.waitForFunction((t) => window.__PONCHO__!.ticks() >= t + 10, t0);
  expect((await api(page, () => window.__PONCHO__!.clearDrawn())).menu).toMatchObject({ chosen: 'retry', colors: ['#5c6178', '#fff3dc', '#9ba3c4'] });
  // A tap or click on the greyed row does nothing.
  const row = await resultsRowCentre(page, 'next');
  if (isMobile) await page.touchscreen.tap(row.x, row.y);
  else await page.mouse.click(row.x, row.y);
  const t1 = await api(page, () => window.__PONCHO__!.ticks());
  await page.waitForFunction((t) => window.__PONCHO__!.ticks() >= t + 20, t1);
  expect(await api(page, () => window.__PONCHO__!.phase())).toBe('clear');
  expect(await api(page, () => window.__PONCHO__!.level())).toBe('1-4');
  expect((await api(page, () => window.__PONCHO__!.clearDrawn())).menu.chosen).toBe('retry');
  const saved: { levels: Record<string, unknown> } = JSON.parse((await page.evaluate(() => window.localStorage.getItem('poncho-siete-vidas')))!);
  expect(saved.levels['1-4']).toMatchObject({ hilos: '', medal: 'gold', cleared: true });
});

test('GDD-BOS-01 a life lost mid-fight keeps his hits and starts his phase again', async ({ page }) => {
  await arena(page);
  await api(page, () => {
    window.__PONCHO__!.setBoss(1);
    window.__PONCHO__!.teleport(232, 224);
  });
  // Standing on the floor, the phase 2 sweep reaches him (GDD-BOS-02).
  expect(await stepUntil(page, { phase: 'respawning' }, 500)).toBeLessThan(500);
  expect(await api(page, () => window.__PONCHO__!.lives())).toBe(6);
  expect(await api(page, () => window.__PONCHO__!.boss()!.hits)).toBe(1);
  expect(await stepUntil(page, { phase: 'playing' }, 100)).toBeLessThan(100);
  expect(await api(page, () => window.__PONCHO__!.boss())).toMatchObject({ x: 392, y: 72, mode: 'lap', age: 0, hits: 1 });
  expect(await api(page, () => window.__PONCHO__!.fruit())).toEqual([]);
  expect((await api(page, () => window.__PONCHO__!.rocks())).map((r) => r.mode)).toEqual(['rest', 'rest']);
  await page.waitForFunction(() => window.__PONCHO__!.bossBar().pips === 2);
});
