import { expect, test, type Page } from '@playwright/test';
import { boot, openGame, pixelsAt, resultsRowCentre, stepToBossMode, stepUntil, tapAt, waitForResults } from './helpers';

// GDD-BOS-01, GDD-BOS-02: Don Zopilote in his arena, level 1-4, opened by its address (GDD-UI-02). Timed in simulation steps, never by
// polling around an event (L-042): the stepped tests pause the game and step it in the page; one test runs through the game's own frames
// (L-021). The boss is read through `boss()` and `bossDrawn()`, never picked out by where he is (L-015).
const api = <T>(page: Page, fn: () => T) => page.evaluate(fn);
type Colour = { r: number; g: number; b: number };
const brightness = (c: Colour) => c.r + c.g + c.b;
const green = (c: Colour) => c.g > c.r + 25 && c.g > c.b + 25; // a cholla joint: g clearly over r and b

/** Boots 1-4 from its title screen and pauses it a few steps in, Poncho at the start (x 232). */
async function arena(page: Page): Promise<string[]> {
  const errors = await boot(page, '/?level=1-4');
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 5);
  await api(page, () => window.__PONCHO__!.pause(true));
  return errors;
}

/** The keys of the sounds the audio system was given since the page loaded, in order (`sfxPlayed`). */
const played = (page: Page) => api(page, () => window.__PONCHO__!.sfxPlayed().map((p) => p.key));

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
  expect(await api(page, () => window.__PONCHO__!.bossBar())).toEqual({ shown: true, name: 'Don Zopilote', stroke: ['#2a1f2e', 2], nameY: 10, pips: 3, outlines: 0 });
  expect(await api(page, () => window.__PONCHO__!.boss())).toMatchObject({ hits: 0, mode: 'lap' });
  // GDD-BOS-02: three points on his crown, a flap look, and his sprite facing the way he does (left at the start), read in one go.
  const start = await api(page, () => ({ boss: window.__PONCHO__!.boss()!, drawn: window.__PONCHO__!.bossDrawn()! }));
  expect(start.drawn).toMatchObject({ crown: 3, dir: start.boss.dir });
  expect(['flapUp', 'flapDown']).toContain(start.drawn.look);
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
  // GDD-AUD-02: the step his telegraph starts plays the hiss, once; the steps after it do not play it again.
  expect((await played(page)).filter((k) => k === 'sfx-hiss')).toHaveLength(1);
  // Red and wings raised, both read from what was handed to Phaser, in one read (L-033).
  await page.waitForFunction(() => window.__PONCHO__!.bossDrawn()?.flash === 'red' && window.__PONCHO__!.bossDrawn()?.wings === 'raised');
  const b = (await api(page, () => window.__PONCHO__!.boss()))!;
  // The middle of his body, 3 px below his middle: under no head, wing, thorn or touch button.
  const [red] = await pixelsAt(page, [{ x: b.x, y: b.y + 3 }]);
  expect(red!.r, JSON.stringify(red)).toBeGreaterThan(200);
  expect(red!.g, JSON.stringify(red)).toBeLessThan(120);
  await api(page, () => window.__PONCHO__!.step(4));
  expect((await played(page)).filter((k) => k === 'sfx-hiss')).toHaveLength(1);
  await page.waitForFunction(() => window.__PONCHO__!.bossDrawn()?.flash === null);
  const [plain] = await pixelsAt(page, [{ x: b.x, y: b.y + 3 }]);
  expect(plain!.r, JSON.stringify(plain)).toBeLessThan(200); // his brown plumage, not the flash's red (r 216)
  await stuckBeside(page);
  // A press held for three steps: two of wind-up, then the swing that reaches him (GDD-CMB-02).
  const heardBefore = (await played(page)).length;
  await api(page, () => window.__PONCHO__!.step(3, { move: 0, jumpHeld: false, claw: true }));
  // Two pips filled and the hit taken drawn as a grey outline (GDD-UI-01, GDD-UI-03), read with his flash in one read (L-033).
  await page.waitForFunction(() => {
    const d = window.__PONCHO__!;
    return d.boss()!.mode === 'hurt' && d.bossDrawn()?.flash === 'white' && d.bossBar().pips === 2 && d.bossBar().outlines === 1;
  });
  // One hit taken: two points left on his crown (GDD-BOS-02).
  expect(await api(page, () => window.__PONCHO__!.bossDrawn())).toMatchObject({ crown: 2, look: 'hurtWhite', wings: 'tucked' });
  const [white, first, last] = await pixelsAt(page, [{ x: 232, y: 208 }, { x: 230, y: 21 }, { x: 250, y: 21 }]);
  // The flash's white is World 1's pale cream, fff6d0, sampled 1 px above his middle (232, 209), clear of his tucked wing's shaded fold.
  expect(Math.min(white!.r, white!.g), JSON.stringify(white)).toBeGreaterThan(230);
  expect(white!.b, JSON.stringify(white)).toBeGreaterThan(190);
  expect(first!.g, JSON.stringify(first)).toBeLessThan(110); // still filled
  expect(last!.g, JSON.stringify(last)).toBeGreaterThan(120); // an outline: the sky shows through
  // GDD-AUD-02: the hit grunts, and no longer thuds like a stomp; the swing's own claw sound plays before it.
  const heard = (await played(page)).slice(heardBefore);
  expect(heard).toContain('sfx-grunt');
  expect(heard).not.toContain('sfx-stomp');
  expect(heard).toEqual(['sfx-claw', 'sfx-grunt']);
});

test('GDD-CMB-01 three cholla joints on his back mark Don Zopilote as not stompable', async ({ page }) => {
  await arena(page);
  expect(await stepToBossMode(page, 'telegraph')).toBeLessThan(1000);
  // Frozen at the right end of his lap, wings raised, facing Poncho to the left, a few steps into the telegraph so that the red flash is
  // off and the joints show their own green (the flash paints him all red). The sprite is drawn facing right and mirrored about his middle
  // for left, so each joint's place is mirrored with it: they sit 9, 4.5 and 0 px from his middle towards his tail, 4.5 px above it. Each
  // is sampled in its middle, where it is 4 px or more across (L-017); two of the three green is enough, as a joint can be half a
  // pixel off where the sprite lands.
  await api(page, () => window.__PONCHO__!.step(4));
  await page.waitForFunction(() => window.__PONCHO__!.bossDrawn()?.look === 'telegraph' && window.__PONCHO__!.bossDrawn()?.wings === 'raised');
  const { x, y, dir } = (await api(page, () => window.__PONCHO__!.boss()))!;
  const joints = await pixelsAt(page, [-9, -4.5, 0].map((dx) => ({ x: x + dir * dx, y: y - 4.5 })));
  expect(joints.filter(green).length, JSON.stringify(joints)).toBeGreaterThanOrEqual(2);
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

test('GDD-BOS-02 his wings are tucked while he dives and while he sweeps', async ({ page }) => {
  await arena(page);
  expect(await stepToBossMode(page, 'dive')).toBeLessThan(1000);
  await page.waitForFunction(() => window.__PONCHO__!.bossDrawn()?.wings === 'tucked' && window.__PONCHO__!.bossDrawn()?.look === 'dive');
  await api(page, () => window.__PONCHO__!.step(8));
  expect(await api(page, () => window.__PONCHO__!.boss()!.mode)).toBe('dive');
  await page.waitForFunction(() => window.__PONCHO__!.bossDrawn()?.wings === 'tucked' && window.__PONCHO__!.bossDrawn()?.look === 'dive');
  // Phase 2: he sweeps the floor, wings tucked and no flap.
  await api(page, () => {
    window.__PONCHO__!.setBoss(1);
    window.__PONCHO__!.teleport(40, 176);
  });
  expect(await stepToBossMode(page, 'sweep')).toBeLessThan(1000);
  await page.waitForFunction(() => window.__PONCHO__!.bossDrawn()?.wings === 'tucked' && window.__PONCHO__!.bossDrawn()?.look === 'sweep');
  await api(page, () => window.__PONCHO__!.step(8));
  expect(await api(page, () => window.__PONCHO__!.boss()!.mode)).toBe('sweep');
  await page.waitForFunction(() => window.__PONCHO__!.bossDrawn()?.wings === 'tucked' && window.__PONCHO__!.bossDrawn()?.look === 'sweep');
});

test('GDD-BOS-02 near the floor at the end of a drop his wings stay raised, not lowered into the floor', async ({ page }) => {
  await arena(page);
  await api(page, () => {
    window.__PONCHO__!.setBoss(1);
    window.__PONCHO__!.teleport(40, 176);
  });
  expect(await stepToBossMode(page, 'drop')).toBeLessThan(1000);
  // Step on to a step of the drop where his flap is down and his box's bottom is within BOSS_ART.wingsBelow (14) px of the floor (224).
  const found = await page.evaluate(() => {
    const d = window.__PONCHO__!;
    for (let i = 0; i < 200; i++) {
      const b = d.boss()!;
      if (b.mode !== 'drop') return false;
      if (b.y + 15 > 224 - 14 && Math.floor(b.age / 8) % 2 === 1) return true;
      d.step(1);
    }
    return false;
  });
  expect(found).toBe(true);
  await page.waitForFunction(() => window.__PONCHO__!.bossDrawn()?.look === 'flapUp' && window.__PONCHO__!.bossDrawn()?.wings === 'raised');
});

test('GDD-BOS-02 his sprite is drawn facing right when he faces right, and left when he faces left', async ({ page }) => {
  await arena(page);
  // Both ways in one lap: he starts facing left; read the sprite's way on a step where the boss faces each way.
  for (const dir of [-1, 1]) {
    await page.evaluate((d) => {
      const poncho = window.__PONCHO__!;
      for (let i = 0; i < 400 && poncho.boss()!.dir !== d; i++) poncho.step(1);
    }, dir);
    expect(await api(page, () => window.__PONCHO__!.boss()!.dir)).toBe(dir);
    await page.waitForFunction((d) => window.__PONCHO__!.bossDrawn()?.dir === d, dir);
  }
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
  // Two lives lost first: five are left at the clear, and Next level still starts 2-1 with seven (GDD-LIFE-05).
  for (let i = 0; i < 2; i++) await api(page, () => window.__PONCHO__!.loseLife());
  expect(await api(page, () => window.__PONCHO__!.lives())).toBe(5);
  await api(page, () => window.__PONCHO__!.setBoss(2));
  await stuckBeside(page);
  // Only the sounds of the hit itself: `played()` lists every sound since the page loaded.
  const heardBefore = (await played(page)).length;
  expect(await api(page, () => window.__PONCHO__!.bossCrownDrawn())).toBeNull();
  await api(page, () => window.__PONCHO__!.step(3, { move: 0, jumpHeld: false, claw: true }));
  expect(await api(page, () => window.__PONCHO__!.boss())).toMatchObject({ hits: 3, mode: 'defeated', age: 0, ty: 209 });
  await page.waitForFunction(() => window.__PONCHO__!.bossDrawn()?.flash === 'white' && window.__PONCHO__!.bossBar().pips === 0 && window.__PONCHO__!.bossBar().outlines === 3);
  // Defeated: no points left on his crown (GDD-BOS-02). He is on the floor, so he lies from the start.
  expect(await api(page, () => window.__PONCHO__!.bossDrawn())).toMatchObject({ crown: 0, look: 'defeatWhite', dots: 3 });
  // GDD-AUD-02: the defeat plays his long hiss, and neither the grunt, the stomp nor Poncho's meow.
  const heard = (await played(page)).slice(heardBefore);
  expect(heard).toContain('sfx-bossDefeat');
  for (const not of ['sfx-grunt', 'sfx-stomp', 'sfx-meow']) expect(heard, not).not.toContain(not);
  // His crown pops off his head: he lies (on the floor), so his head is 11 px behind the way he faces and its top 5 px below his middle (x 232, y 209), level and then spinning (GDD-BOS-02).
  const hit = (await api(page, () => window.__PONCHO__!.boss()))!;
  const start = (await api(page, () => window.__PONCHO__!.bossCrownDrawn()))!;
  expect(hit.tx).toBe(232);
  expect(start.x).toBeCloseTo(hit.tx - 11 * hit.dir, 3);
  expect(start.y).toBeCloseTo(214, 3);
  expect(start.tilted).toBe(false);
  // 4 steps on: the crown has risen and turned to its tilted frame, and his white flash is off, so he lies in his own colours.
  await api(page, () => window.__PONCHO__!.step(4));
  await page.waitForFunction(() => window.__PONCHO__!.bossCrownDrawn()?.tilted === true && window.__PONCHO__!.bossDrawn()?.flash === null);
  const rising = (await api(page, () => window.__PONCHO__!.bossCrownDrawn()))!;
  expect(rising.y).toBeLessThan(start.y); // up first
  expect(rising.x).toBeGreaterThan(start.x); // towards the middle of the arena (x 240), to the right of the hit at x 232
  expect(await api(page, () => window.__PONCHO__!.bossDrawn())).toMatchObject({ crown: 0, look: 'defeat', dots: 3, wings: 'tucked' });
  expect(await api(page, () => window.__PONCHO__!.fruit())).toEqual([]);
  await api(page, () => window.__PONCHO__!.step(4));
  await page.waitForFunction(() => window.__PONCHO__!.bossCrownDrawn()?.tilted === false);
  // It rests on the floor on its 18th step, before the clear screen (step 60): on step 48 it lies at y 224, level, and stays.
  await api(page, () => window.__PONCHO__!.step(40));
  const rest = (await api(page, () => window.__PONCHO__!.bossCrownDrawn()))!;
  expect(rest.y).toBeCloseTo(224, 3);
  expect(rest.tilted).toBe(false);
  expect(rest.x).toBeGreaterThan(start.x);
  await api(page, () => window.__PONCHO__!.step(4));
  expect(await api(page, () => window.__PONCHO__!.bossCrownDrawn())).toEqual(rest);
  await api(page, () => window.__PONCHO__!.step(7));
  expect(await api(page, () => window.__PONCHO__!.phase())).toBe('playing');
  await api(page, () => window.__PONCHO__!.step(1));
  expect(await api(page, () => window.__PONCHO__!.phase())).toBe('clear');
  await api(page, () => window.__PONCHO__!.pause(false));
  await waitForResults(page);
  const clear = await api(page, () => window.__PONCHO__!.clearDrawn());
  expect(clear).toMatchObject({ shown: true, hilos: 'Hilos 0/0', medal: 'Gold medal' });
  const saved: { levels: Record<string, unknown> } = JSON.parse((await page.evaluate(() => window.localStorage.getItem('poncho-siete-vidas')))!);
  expect(saved.levels['1-4']).toMatchObject({ hilos: '', medal: 'gold', cleared: true });
  // 1-4 names 2-1 (GDD-UI-02, user, 2026-11-04): "Next level" can be chosen and the menu opens on it.
  expect(clear.menu).toMatchObject({ chosen: 'next', colors: ['#fff3dc', '#9ba3c4', '#9ba3c4'] });
  // A tap or click on it starts World 2's first level at once, with seven lives (a new world, GDD-LIFE-05), in the Mercado's look.
  const row = await resultsRowCentre(page, 'next');
  if (isMobile) await page.touchscreen.tap(row.x, row.y);
  else await page.mouse.click(row.x, row.y);
  await page.waitForFunction(() => window.__PONCHO__!.level() === '2-1' && window.__PONCHO__!.phase() === 'playing' && window.__PONCHO__!.ticks() > 2);
  expect(await api(page, () => window.__PONCHO__!.lives())).toBe(7);
  expect(await api(page, () => window.__PONCHO__!.bossBar())).toMatchObject({ shown: false, pips: 0 });
  expect((await api(page, () => window.__PONCHO__!.scenery())).set).toBe('mercado');
});

test('GDD-BOS-02 in real time his crown pops off, arcs and comes to rest on the floor, frame after frame', async ({ page }) => {
  await arena(page);
  await api(page, () => window.__PONCHO__!.setBoss(2));
  await stuckBeside(page);
  // Slow setup first (L-042): the hit is made while paused, then the game runs through its own frames (L-021) and a sampler in the page
  // reads what was drawn on every frame, with the boss's age beside it, so no poll lags.
  await api(page, () => window.__PONCHO__!.step(3, { move: 0, jumpHeld: false, claw: true }));
  expect(await api(page, () => window.__PONCHO__!.boss())).toMatchObject({ mode: 'defeated', age: 0 });
  const frames = await page.evaluate(
    () =>
      new Promise<{ y: number; x: number; tilted: boolean; age: number }[]>((resolve) => {
        const d = window.__PONCHO__!;
        const samples: { y: number; x: number; tilted: boolean; age: number }[] = [];
        let after = 0;
        const tick = () => {
          const crown = d.bossCrownDrawn();
          if (crown) samples.push({ ...crown, age: d.boss()!.age });
          // Three frames more once the clear screen is up.
          if (d.phase() === 'clear') after++;
          if (after > 3) resolve(samples);
          else requestAnimationFrame(tick);
        };
        d.pause(false);
        tick();
      }),
  );
  // It was drawn on frame after frame and moved: up first (above its start, 214), then down to the floor.
  expect(frames.length).toBeGreaterThan(4);
  // The arc is 18 steps long, a few frames at the headless frame rate: the crown changes from frame to frame, rises above its start (214) and
  // comes down to the floor. (Its spin is read step by step in the test above: a frame may miss a 4-step turn.)
  expect(new Set(frames.map((f) => f.y)).size).toBeGreaterThan(2);
  expect(Math.min(...frames.map((f) => f.y))).toBeLessThan(214);
  // From its 18th step it lies on the floor, level, in one place, whatever frame shows it: the last frames are well past that.
  const resting = frames.filter((frame) => frame.age >= 18);
  expect(resting.length).toBeGreaterThan(0);
  for (const r of resting) expect(r, `age ${r.age}`).toMatchObject({ y: 224, tilted: false });
  expect(new Set(resting.map((r) => r.x)).size).toBe(1);
  // Before it, on every frame it is in the air.
  for (const early of frames.filter((frame) => frame.age < 14)) expect(early.y, `age ${early.age}`).toBeLessThan(224);
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
