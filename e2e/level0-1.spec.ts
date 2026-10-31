import { expect, test, type CDPSession, type Page } from '@playwright/test';
import { boot, openGame, pixelsAt, resultsRowCentre, waitForResults } from './helpers';

// GDD-WLD-06: level 0-1, its camera (GDD-UI-04), its exit and the level clear screen (GDD-WLD-03, GDD-UI-02), its veladora
// (GDD-LIFE-03), and the clear screen leading on to 1-1 (GDD-WLD-07). These open the game at "/", which plays 0-1; every other
// playtest opens the sandbox or 1-1. Things are timed in simulation steps (`phaseSince()`, `ticks()`), never by polling (L-042).
const api = <T>(page: Page, fn: () => T) => page.evaluate(fn);
const frames = (page: Page, n = 2) => page.evaluate((k) => new Promise((r) => { let i = 0; const tick = () => (++i >= k ? r(null) : requestAnimationFrame(tick)); requestAnimationFrame(tick); }), n);

/** Plays 0-1 from the title and puts Poncho on the floor in front of the exit, which he reaches at once. */
async function atExit(page: Page): Promise<void> {
  await boot(page, '/');
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 5);
  await page.evaluate(() => window.__PONCHO__!.teleport(1400, 224));
  await page.waitForFunction(() => window.__PONCHO__!.phase() === 'clear');
}

/** Poncho's highest point (lowest y) over the next `n` frames. */
const topOver = (page: Page, n: number) =>
  page.evaluate((k) => new Promise<number>((r) => { let i = 0; let top = Infinity; const tick = () => { top = Math.min(top, window.__PONCHO__!.state().y); if (++i >= k) r(top); else requestAnimationFrame(tick); }; requestAnimationFrame(tick); }), n);

/** Waits for the clear screen's first 1.0 s (60 steps) to be over, which is when it shows its results menu. */
const afterLockout = (page: Page) => waitForResults(page);

const PALE = '#fff3dc';
const GREY = '#9ba3c4';

test('GDD-UI-02 the game opens on 0-1 and Start plays it', async ({ page }) => {
  await openGame(page, '/');
  expect(await api(page, () => window.__PONCHO__!.level())).toBe('0-1');
  expect((await api(page, () => window.__PONCHO__!.titleDrawn())).shown).toBe(true);
  expect((await api(page, () => window.__PONCHO__!.camera())).viewX).toBe(0);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => !window.__PONCHO__!.titleDrawn().shown);
  expect((await api(page, () => window.__PONCHO__!.hilos())).total).toBe(50);
  expect((await api(page, () => window.__PONCHO__!.camera())).viewX).toBe(0);
  // GDD-WLD-06: hilos are collected in play. Holding right from the start picks up the first ones, and the counter follows.
  await page.keyboard.down('ArrowRight');
  await page.waitForFunction(() => window.__PONCHO__!.hilos().taken >= 1 && window.__PONCHO__!.hudHilos().text === `${window.__PONCHO__!.hilos().taken}/50`);
  await page.keyboard.up('ArrowRight');
});

test('GDD-UI-02 level=sandbox plays the sandbox', async ({ page }) => {
  await openGame(page);
  expect(await api(page, () => window.__PONCHO__!.level())).toBe('sandbox');
  expect((await api(page, () => window.__PONCHO__!.hilos())).total).toBe(20);
  expect(await api(page, () => window.__PONCHO__!.exitDrawn())).toBe(false);
  expect(await api(page, () => window.__PONCHO__!.veladoraDrawn())).toBe(false);
});

test('GDD-UI-04 the camera follows Poncho and stops at the level edges', async ({ page }) => {
  await boot(page, '/');
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 5);
  await page.evaluate(() => window.__PONCHO__!.pause(true));
  // Past the spikes at columns 43 and 44, clear of every hazard: his middle is 504 px from the level start, 256 from the screen's left.
  await page.evaluate(() => window.__PONCHO__!.teleport(760, 224));
  await page.evaluate(() => window.__PONCHO__!.step(1));
  await page.waitForFunction(() => window.__PONCHO__!.camera().viewX === 504 && window.__PONCHO__!.camera().scrollX === 504);
  await page.evaluate(() => window.__PONCHO__!.teleport(1430, 224));
  await page.evaluate(() => window.__PONCHO__!.step(1));
  await page.waitForFunction(() => window.__PONCHO__!.camera().viewX === 960 && window.__PONCHO__!.camera().scrollX === 960);
  await page.evaluate(() => window.__PONCHO__!.teleport(100, 224));
  await page.evaluate(() => window.__PONCHO__!.step(1));
  await page.waitForFunction(() => window.__PONCHO__!.camera().viewX === 0 && window.__PONCHO__!.camera().scrollX === 0);
});

test('GDD-UI-04 the camera stands still while Poncho waits to respawn, then moves to the respawn point at once', async ({ page }) => {
  await boot(page, '/');
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 5);
  await page.evaluate(() => window.__PONCHO__!.pause(true));
  await page.evaluate(() => window.__PONCHO__!.teleport(872, 224)); // over the first 3-tile gap, columns 53 to 55
  await page.evaluate(() => window.__PONCHO__!.step(1));
  await page.waitForFunction(() => window.__PONCHO__!.camera().scrollX === 616);
  await page.evaluate(() => window.__PONCHO__!.teleport(872, 306)); // his whole body below the level: a lost life
  await page.evaluate(() => window.__PONCHO__!.step(21));
  expect(await api(page, () => window.__PONCHO__!.phase())).toBe('respawning');
  expect(await api(page, () => window.__PONCHO__!.bodyVisible())).toBe(false);
  await page.waitForFunction(() => window.__PONCHO__!.camera().viewX === 616 && window.__PONCHO__!.camera().scrollX === 616);
  await page.evaluate(() => window.__PONCHO__!.step(28));
  expect(await api(page, () => window.__PONCHO__!.phase())).toBe('playing');
  await page.waitForFunction(() => window.__PONCHO__!.camera().viewX === 0 && window.__PONCHO__!.camera().scrollX === 0);
});

test('GDD-WLD-03 reaching the exit shows the level clear screen', async ({ page }) => {
  await boot(page, '/');
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 5);
  await page.evaluate(() => window.__PONCHO__!.pause(true));
  // GDD-UI-02: 130 idle steps first, so the clear time is over 2 s and cannot be told from the steps the screen itself has been up.
  await page.evaluate(() => window.__PONCHO__!.step(130));
  await page.evaluate(() => window.__PONCHO__!.teleport(1400, 224));
  await page.evaluate(() => window.__PONCHO__!.step(1));
  expect(await api(page, () => window.__PONCHO__!.phase())).toBe('clear');
  // The game opened at the title and no life was lost, so every step taken is on the clock: the clock is the clearing step's `ticks()`.
  const clock = await api(page, () => window.__PONCHO__!.ticks());
  expect(clock).toBeGreaterThan(130);
  const seconds = Math.floor(clock / 60);
  const time = `Time ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  expect(time).toBe('Time 0:02');
  // Just up: the title shows, the hilo, time and medal lines have not appeared yet.
  expect(await api(page, () => window.__PONCHO__!.clearDrawn())).toMatchObject({ shown: true, title: 'Level clear!', hilos: 'Hilos 0/50', time, medal: 'Bronze medal', medalColour: '#c7834a', lines: 0 });
  expect((await api(page, () => window.__PONCHO__!.clearDrawn())).menu.shown).toBe(false);
  expect(await api(page, () => window.__PONCHO__!.exitDrawn())).toBe(true);
  expect(await api(page, () => window.__PONCHO__!.bodyVisible())).toBe(true);
  await api(page, () => window.__PONCHO__!.step(59));
  expect((await api(page, () => window.__PONCHO__!.clearDrawn())).menu.shown).toBe(false);
  // GDD-UI-02: Down and Enter before the menu shows do nothing: the screen stays and the menu opens on Next level.
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await frames(page, 5);
  expect(await api(page, () => window.__PONCHO__!.phase())).toBe('clear');
  expect(await api(page, () => window.__PONCHO__!.level())).toBe('0-1');
  await api(page, () => window.__PONCHO__!.step(1));
  const drawn = await api(page, () => window.__PONCHO__!.clearDrawn());
  // GDD-UI-02: from 1.0 s on, the results menu, opened on Next level (0-1 names a next level).
  expect(drawn.menu).toMatchObject({ shown: true, items: ['Next level', 'Retry', 'Quit to title'], chosen: 'next', colors: [PALE, GREY, GREY] });
  // The ">" stands beside the chosen row: its y is the row's middle (game px).
  const next = (await api(page, () => window.__PONCHO__!.resultsMenu())).find((r) => r.item === 'next')!;
  expect(drawn.menu.markerY).toBe(next.y + next.h / 2);
  // All three lines are up by 1.0 s, with the time unchanged by the steps the screen has been up.
  expect(drawn).toMatchObject({ time, medal: 'Bronze medal', medalColour: '#c7834a', lines: 3 });
  // GDD-UI-02: the disc is 6 px left of the text, and the pair is centred on the screen (the margins left and right are equal).
  expect(drawn.textX - drawn.discX).toBe(11);
  expect(drawn.medalWidth).toBeGreaterThan(40);
  expect(Math.abs(drawn.discX - 5 - (480 - (drawn.textX + drawn.medalWidth)))).toBeLessThanOrEqual(0.5);
  // The disc is drawn in the medal's colour, bronze #c7834a (read from a real screenshot, in the middle of the 10 px disc; L-017).
  const [disc] = await pixelsAt(page, [{ x: drawn.discX, y: 150 }]);
  expect(Math.abs(disc!.r - 0xc7)).toBeLessThanOrEqual(3);
  expect(Math.abs(disc!.g - 0x83)).toBeLessThanOrEqual(3);
  expect(Math.abs(disc!.b - 0x4a)).toBeLessThanOrEqual(3);
});

test('GDD-UI-02 the clear screen lines appear one by one', async ({ page }) => {
  await atExit(page);
  await afterLockout(page);
  const reveal = await api(page, () => window.__PONCHO__!.clearReveal());
  expect(reveal.length).toBeGreaterThan(0);
  // Each frame's lines follow the steps the screen had been up: the hilo line from 15, the time line from 30, the medal line from 45.
  for (const e of reveal) expect(e.lines, `wait ${e.wait}`).toBe(e.wait >= 45 ? 3 : e.wait >= 30 ? 2 : e.wait >= 15 ? 1 : 0);
  // The log starts at the beginning of the screen.
  expect(reveal.some((e) => e.wait < 15)).toBe(true);
});

test('GDD-UI-02 Enter on Next level starts 1-1 at once, the press held', async ({ page }) => {
  await atExit(page);
  await afterLockout(page);
  // A claw key held through the pick: the pick is Enter, and the claw press only skips the reveal.
  await page.keyboard.down('KeyX');
  await page.keyboard.press('Enter', { delay: 30 });
  // GDD-WLD-07: the next level, playing at once with no title screen, a fresh run of seven lives.
  await page.waitForFunction(() => window.__PONCHO__!.level() === '1-1' && window.__PONCHO__!.ticks() > 10);
  expect((await api(page, () => window.__PONCHO__!.titleDrawn())).shown).toBe(false);
  expect(await api(page, () => window.__PONCHO__!.phase())).toBe('playing');
  expect(await api(page, () => window.__PONCHO__!.lives())).toBe(7);
  expect(await api(page, () => window.__PONCHO__!.hilos())).toMatchObject({ taken: 0, total: 50 });
  expect((await api(page, () => window.__PONCHO__!.camera())).viewX).toBe(0);
  expect(await api(page, () => window.__PONCHO__!.state())).toMatchObject({ x: 56, y: 224 });
  // The claw key still down counts as held: no swing, not even when it repeats; letting go is no press either.
  await page.keyboard.down('KeyX'); // an auto-repeat keydown
  await frames(page, 10);
  await page.keyboard.up('KeyX');
  await frames(page, 10);
  expect(await api(page, () => window.__PONCHO__!.swings())).toBe(0);
  // A new press does swing.
  await page.keyboard.press('KeyX', { delay: 60 });
  await page.waitForFunction(() => window.__PONCHO__!.swings() === 1);
});

test('GDD-UI-02 a claw, Fuego, Left or Right press does not leave the results menu', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard test');
  await atExit(page);
  await afterLockout(page);
  for (const key of ['KeyX', 'KeyJ', 'KeyC', 'KeyK', 'ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD']) await page.keyboard.press(key, { delay: 30 });
  // 30 more steps, counted in steps (L-042): the screen is still there with its choice.
  const t0 = await api(page, () => window.__PONCHO__!.ticks());
  await page.waitForFunction((t) => window.__PONCHO__!.ticks() >= t + 30, t0);
  expect(await api(page, () => window.__PONCHO__!.phase())).toBe('clear');
  expect(await api(page, () => window.__PONCHO__!.level())).toBe('0-1');
  expect((await api(page, () => window.__PONCHO__!.clearDrawn())).menu).toMatchObject({ shown: true, chosen: 'next' });
});

test('GDD-UI-02 a jump key held from the results menu into 1-1 does not jump, even when it repeats', async ({ page }) => {
  await atExit(page);
  await afterLockout(page);
  await page.keyboard.down('Space');
  await page.waitForFunction(() => window.__PONCHO__!.level() === '1-1' && window.__PONCHO__!.ticks() > 10);
  await page.keyboard.down('Space'); // an auto-repeat keydown, the first this level sees
  expect(await topOver(page, 60)).toBe(224);
  await page.keyboard.up('Space');
  await page.keyboard.down('Space');
  await page.waitForFunction(() => window.__PONCHO__!.state().y < 200);
  await page.keyboard.up('Space');
});

test('GDD-LIFE-03 the veladora on its ledge restores a life and stays used after a lost life', async ({ page }) => {
  await boot(page, '/');
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 5);
  expect(await api(page, () => window.__PONCHO__!.veladoraDrawn())).toBe(true);
  await page.evaluate(() => window.__PONCHO__!.loseLife()); // the hook changes the lives only
  await page.waitForFunction(() => window.__PONCHO__!.lives() === 6);
  await page.evaluate(() => window.__PONCHO__!.teleport(1128, 112));
  await page.waitForFunction(() => window.__PONCHO__!.lives() === 7 && !window.__PONCHO__!.veladoraDrawn());
  await page.evaluate(() => window.__PONCHO__!.loseLife());
  const since = await api(page, () => window.__PONCHO__!.ticks());
  await page.waitForFunction((s) => window.__PONCHO__!.ticks() >= s + 20, since);
  expect(await api(page, () => window.__PONCHO__!.lives())).toBe(6);
  expect(await api(page, () => window.__PONCHO__!.veladoraDrawn())).toBe(false);
});

test('GDD-UI-02 a tap on the Next level row starts 1-1', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'touch device only');
  await atExit(page);
  await afterLockout(page);
  const row = await resultsRowCentre(page, 'next');
  await page.touchscreen.tap(row.x, row.y);
  await page.waitForFunction(() => window.__PONCHO__!.level() === '1-1' && window.__PONCHO__!.phase() === 'playing' && !window.__PONCHO__!.titleDrawn().shown);
  expect(await api(page, () => window.__PONCHO__!.state())).toMatchObject({ x: 56 });
});

/** Real touch events through the browser, so a finger can stay down across frames (L-032). CSS px in. */
const touch = (cdp: CDPSession, type: 'touchStart' | 'touchEnd', at?: { x: number; y: number }) =>
  cdp.send('Input.dispatchTouchEvent', { type, touchPoints: at ? [{ id: 1, ...at }] : [] });

/** Switches the left thumb zone to the slide stick with a tap on the mode switch. */
async function stickMode(page: Page, cdp: CDPSession): Promise<void> {
  const sw = (await api(page, () => window.__PONCHO__!.touch())).buttons.find((b) => b.id === 'mode')!;
  const box = (await page.locator('canvas').boundingBox())!;
  const k = box.width / 480;
  await touch(cdp, 'touchStart', { x: box.x + (sw.x + sw.w / 2) * k, y: box.y + (sw.y + sw.h / 2) * k });
  await touch(cdp, 'touchEnd');
  await page.waitForFunction(() => window.__PONCHO__!.touch().mode === 'stick');
}

for (const mode of ['buttons', 'stick'] as const) {
  // L-032: the Next level row (x 160 to 240 of it) is inside the lower left quarter the slide stick reads.
  test(`GDD-UI-02 a finger held on the Next level row into 1-1 does not move or jump him, in ${mode} mode`, async ({ page, isMobile }) => {
    test.skip(!isMobile, 'touch device only');
    await atExit(page);
    const cdp: CDPSession = await page.context().newCDPSession(page);
    if (mode === 'stick') await stickMode(page, cdp);
    await afterLockout(page);
    // On the row's left end, in the stick's zone and left of its track's middle.
    const row = (await api(page, () => window.__PONCHO__!.resultsMenu())).find((r) => r.item === 'next')!;
    const box = (await page.locator('canvas').boundingBox())!;
    const k = box.width / 480;
    await touch(cdp, 'touchStart', { x: box.x + (row.x + 8) * k, y: box.y + (row.y + row.h / 2) * k });
    await page.waitForFunction(() => window.__PONCHO__!.level() === '1-1' && window.__PONCHO__!.ticks() > 2);
    const t0 = await api(page, () => window.__PONCHO__!.ticks());
    // 60 steps with the finger down: it steers and jumps nothing, and he stays at the start.
    expect(await topOver(page, 60)).toBe(224);
    await page.waitForFunction((t) => window.__PONCHO__!.ticks() >= t + 60, t0);
    expect(await api(page, () => window.__PONCHO__!.state())).toMatchObject({ x: 56, y: 224 });
    await touch(cdp, 'touchEnd');
  });
}

test('GDD-UI-02 a gamepad south held from the results menu into 1-1 does not jump', async ({ page }) => {
  // GDD-CTL-02: a fake standard pad, as in e2e/gamepad.spec.ts; south (button 0) jumps.
  await page.addInitScript(() => {
    const pad = { id: 'fake', index: 0, connected: true, mapping: 'standard', timestamp: 0, buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })), axes: [0, 0, 0, 0] };
    window.__pad = pad; // typed by e2e/gamepad.spec.ts
    Object.defineProperty(navigator, 'getGamepads', { value: () => [pad], configurable: true });
  });
  const south = (down: boolean) =>
    page.evaluate((d) => {
      const b = window.__pad!.buttons[0]!;
      b.pressed = d;
      b.value = d ? 1 : 0;
    }, down);
  await atExit(page);
  await afterLockout(page);
  await south(true);
  await page.waitForFunction(() => window.__PONCHO__!.level() === '1-1');
  expect(await topOver(page, 60)).toBe(224);
  await south(false);
});

test('GDD-UI-02 Retry starts 0-1 again fresh', async ({ page }) => {
  await boot(page, '/');
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 5);
  // Hilos collected in play, as a player would.
  await page.keyboard.down('ArrowRight');
  await page.waitForFunction(() => window.__PONCHO__!.hilos().taken >= 1);
  await page.keyboard.up('ArrowRight');
  await page.evaluate(() => window.__PONCHO__!.pause(true));
  // A life lost, and 130 steps more so the clock is over 2 s.
  await page.evaluate(() => window.__PONCHO__!.loseLife());
  await page.waitForFunction(() => window.__PONCHO__!.lives() === 6);
  await page.evaluate(() => window.__PONCHO__!.step(130));
  const taken = (await api(page, () => window.__PONCHO__!.hilos())).taken; // read here: he may still slide over a hilo after the key is up
  expect(taken).toBeGreaterThanOrEqual(1);
  await page.evaluate(() => window.__PONCHO__!.teleport(1400, 224));
  await page.evaluate(() => window.__PONCHO__!.step(61));
  const first = await api(page, () => window.__PONCHO__!.clearDrawn());
  expect(first.hilos).toBe(`Hilos ${taken}/50`);
  expect(first.time).not.toBe('Time 0:00');
  expect(first.menu.shown).toBe(true);
  // Down to Retry, Enter.
  await page.keyboard.press('ArrowDown');
  await page.waitForFunction(() => window.__PONCHO__!.clearDrawn().menu.chosen === 'retry');
  await page.keyboard.press('Enter', { delay: 30 });
  // A fresh scene of 0-1, playing at once, no title: seven lives, every hilo back, Poncho at the start.
  await page.waitForFunction(() => window.__PONCHO__!.phase() === 'playing' && window.__PONCHO__!.ticks() > 2);
  expect(await api(page, () => window.__PONCHO__!.level())).toBe('0-1');
  expect((await api(page, () => window.__PONCHO__!.titleDrawn())).shown).toBe(false);
  expect(await api(page, () => window.__PONCHO__!.lives())).toBe(7);
  expect(await api(page, () => window.__PONCHO__!.hilos())).toMatchObject({ taken: 0, total: 50 });
  expect((await api(page, () => window.__PONCHO__!.hudHilos())).text).toBe('0/50');
  expect(await api(page, () => window.__PONCHO__!.state())).toMatchObject({ x: 56, y: 224 });
  expect((await api(page, () => window.__PONCHO__!.camera())).viewX).toBe(0);
  // The clock starts again at 0:00: reach the exit within 60 steps and the time line says so.
  await page.evaluate(() => window.__PONCHO__!.pause(true));
  await page.evaluate(() => window.__PONCHO__!.teleport(1400, 224));
  await page.evaluate(() => window.__PONCHO__!.step(1));
  expect(await api(page, () => window.__PONCHO__!.phase())).toBe('clear');
  expect(await api(page, () => window.__PONCHO__!.ticks())).toBeLessThan(60);
  expect((await api(page, () => window.__PONCHO__!.clearDrawn())).time).toBe('Time 0:00');
});

test('GDD-UI-02 Quit to title from the results menu', async ({ page }) => {
  await atExit(page);
  await afterLockout(page);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.waitForFunction(() => window.__PONCHO__!.clearDrawn().menu.chosen === 'quit');
  await page.keyboard.down('Enter');
  // 0-1 has been started, so "Start" plays 1-1: the title over a fresh run of it.
  await page.waitForFunction(() => window.__PONCHO__!.titleDrawn().shown && window.__PONCHO__!.level() === '1-1');
  expect(await api(page, () => window.__PONCHO__!.phase())).toBe('playing');
  expect(await api(page, () => window.__PONCHO__!.lives())).toBe(7);
  // The Enter that picked is still down, with its repeats, and starts nothing.
  await page.keyboard.down('Enter');
  await frames(page, 20);
  expect((await api(page, () => window.__PONCHO__!.titleDrawn())).shown).toBe(true);
  await page.keyboard.up('Enter');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => !window.__PONCHO__!.titleDrawn().shown);
});

test('GDD-UI-02 Escape on the results menu pauses, and resume brings it back', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard test');
  await atExit(page);
  await afterLockout(page);
  await page.keyboard.press('ArrowDown');
  await page.waitForFunction(() => window.__PONCHO__!.clearDrawn().menu.chosen === 'retry');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.__PONCHO__!.pauseDrawn().menu.shown);
  // The pause menu is over the screen, the results menu hidden under it.
  expect((await api(page, () => window.__PONCHO__!.clearDrawn())).menu).toMatchObject({ shown: false, chosen: null, markerY: null });
  // A pick on the pause menu is the pause menu's (Resume), not the results menu's Retry.
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !window.__PONCHO__!.playerPause().paused && window.__PONCHO__!.clearDrawn().menu.shown);
  const back = await api(page, () => ({ menu: window.__PONCHO__!.clearDrawn().menu, rows: window.__PONCHO__!.resultsMenu() }));
  expect(back.menu).toMatchObject({ chosen: 'retry', colors: [GREY, PALE, GREY] });
  const retry = back.rows.find((r) => r.item === 'retry')!;
  expect(back.menu.markerY).toBe(retry.y + retry.h / 2);
  expect(await api(page, () => window.__PONCHO__!.phase())).toBe('clear');
});
