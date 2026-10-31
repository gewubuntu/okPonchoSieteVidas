import { expect, test, type Page } from '@playwright/test';
import { boot, openGame, pixelsAt, stepUntil, waitForResults } from './helpers';

// GDD-PRG-02: the saved progress of a level (each hilo once, the best medal, the best time, cleared), written at the level clear; GDD-WLD-04:
// a saved hilo is drawn faded and counts from the start; GDD-UI-02: the best time and "New best!" on the clear screen. These play 0-1, whose
// hilos 1, 2 and 3 are the floor ones at the start (columns 4, 5 and 6, row 13) and whose exit is at x 1400. Things are timed in simulation
// steps (L-042). `/?level=0-1` keeps the title over 0-1 whatever the save says.
const api = <T>(page: Page, fn: () => T) => page.evaluate(fn);
const SAVE_KEY = 'poncho-siete-vidas';
const LEVEL = '/?level=0-1';
const NONE = '0'.repeat(50);

interface Entry {
  hilos: string;
  medal: string | null;
  bestSteps: number | null;
  cleared: boolean;
}
const entry = (over: Partial<Entry> = {}): Entry => ({ hilos: NONE, medal: null, bestSteps: null, cleared: false, ...over });
/** A hilos text of 50 characters with a `1` at each index given. */
const hilosAt = (...indexes: number[]): string => Array.from(NONE, (_, i) => (indexes.includes(i) ? '1' : '0')).join('');

/** Saves a game before the page loads (only if nothing is saved yet, so a reload keeps what the game wrote). */
const seed = (page: Page, levels: Record<string, Entry>) =>
  page.addInitScript(
    ([key, text]) => {
      if (localStorage.getItem(key!) === null) localStorage.setItem(key!, text!);
    },
    [SAVE_KEY, JSON.stringify({ version: 1, settings: { master: 10, effects: 10, language: 'en' }, progress: { tutorialPlayed: true }, levels })],
  );
/** Where the browser refuses storage. */
const refuseStorage = (page: Page) =>
  page.addInitScript(() => {
    Storage.prototype.getItem = () => { throw new Error('storage refused'); };
    Storage.prototype.setItem = () => { throw new Error('storage refused'); };
  });
/** What the game saved: the levels part, or null where nothing is saved. */
const savedLevels = async (page: Page): Promise<Record<string, Entry> | null> => {
  const text = await api(page, () => localStorage.getItem('poncho-siete-vidas'));
  if (text === null) return null;
  const data: { levels: Record<string, Entry> } = JSON.parse(text);
  return data.levels;
};

/** Pauses (the dev pause) and puts Poncho on the floor at `x`, then steps once so a hilo there is touched. */
const walkOnto = async (page: Page, x: number) => {
  await page.evaluate((px) => {
    window.__PONCHO__!.teleport(px, 224);
    window.__PONCHO__!.step(1);
  }, x);
};
/** Hilo `i` of 0-1 for i in 0 to 3: columns 2, 4, 5 and 6 on the floor (the middle of the tile). */
const FLOOR = [40, 72, 88, 104];
/** From a paused game: 130 idle steps (so the time is over 2 s), then to the exit and the clear screen with its results menu up. */
async function clearIt(page: Page): Promise<void> {
  await page.evaluate(() => window.__PONCHO__!.step(130));
  await page.evaluate(() => window.__PONCHO__!.teleport(1400, 224));
  await stepUntil(page, { phase: 'clear' }, 30);
  expect(await api(page, () => window.__PONCHO__!.phase())).toBe('clear');
  await api(page, () => window.__PONCHO__!.step(61));
  await waitForResults(page);
}
/** Starts 0-1 by its address and pauses once it runs. */
async function play(page: Page): Promise<void> {
  await boot(page, LEVEL);
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 5);
  await api(page, () => window.__PONCHO__!.pause(true));
}
/** 35 % of `a` over `b`: what a pixel of colour `a` painted at 35 % opacity over `b` shows. */
const mix = (a: number, b: number) => 0.35 * a + 0.65 * b;
const hiloSounds = (page: Page) => api(page, () => window.__PONCHO__!.sfx().filter((s) => s.startsWith('hilo')).length);

test('GDD-PRG-02 a clear saves the hilos, the medal, the time and cleared', async ({ page }) => {
  await boot(page, '/');
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 5);
  await api(page, () => window.__PONCHO__!.pause(true));
  // Nothing of the level is saved before the clear (the game saved the tutorial flag when it started).
  expect(await savedLevels(page)).toEqual({});
  for (const x of FLOOR.slice(1)) await walkOnto(page, x);
  expect((await api(page, () => window.__PONCHO__!.hilos())).taken).toBe(3);
  await page.evaluate(() => window.__PONCHO__!.teleport(1400, 224));
  await stepUntil(page, { phase: 'clear' }, 30);
  expect(await api(page, () => window.__PONCHO__!.phase())).toBe('clear');
  // The clock is the steps taken since the start: the step that reached the exit is the clear's `phaseSince()`.
  const clock = await api(page, () => window.__PONCHO__!.phaseSince());
  expect(clock).toBeGreaterThan(3);
  expect(await savedLevels(page)).toEqual({ '0-1': { hilos: hilosAt(1, 2, 3), medal: 'bronze', bestSteps: clock, cleared: true } });
  expect((await api(page, () => window.__PONCHO__!.progress()))['0-1']).toMatchObject({ medal: 'bronze', bestSteps: clock, cleared: true });
});

test('GDD-WLD-04 saved hilos are faded and count from the start', async ({ page }) => {
  await seed(page, { '0-1': entry({ hilos: hilosAt(0, 2, 3), medal: 'bronze', bestSteps: 5000, cleared: true }) });
  await boot(page, LEVEL);
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 2);
  await api(page, () => window.__PONCHO__!.pause(true));
  // Three of the 50 count from the start: on the HUD counter, in the run, three painted faded and the other 47 as usual.
  expect(await api(page, () => window.__PONCHO__!.hilos())).toEqual({ taken: 3, total: 50, drawn: 47, faded: 3 });
  expect((await api(page, () => window.__PONCHO__!.hudHilos())).text).toBe('3/50');
  // Walking through a saved hilo (the first, on the floor at column 2) collects nothing and plays no hilo note.
  await walkOnto(page, FLOOR[0]!);
  expect(await api(page, () => window.__PONCHO__!.hilos())).toEqual({ taken: 3, total: 50, drawn: 47, faded: 3 });
  expect(await hiloSounds(page)).toBe(0);
  // The control: the hilo beside it (column 4) is not saved, and collecting it counts and plays a note.
  await walkOnto(page, FLOOR[1]!);
  expect(await api(page, () => window.__PONCHO__!.hilos())).toEqual({ taken: 4, total: 50, drawn: 46, faded: 3 });
  expect((await api(page, () => window.__PONCHO__!.hudHilos())).text).toBe('4/50');
  expect(await hiloSounds(page)).toBe(1);
});

test('GDD-WLD-04 a saved hilo is painted at 35 percent opacity', async ({ page }) => {
  // The fourth hilo (on the floor at column 6, blue 111 143 216), read three ways at its middle, which is plain colour, clear of the wraps, and
  // not under a touch button (L-018): at full strength (nothing saved), gone (collected), and saved. Saved is 35 % of the first over the second.
  const spot = { x: 104, y: 216 };
  const readSpot = async () => {
    await api(page, () => {
      window.__PONCHO__!.pause(true);
      window.__PONCHO__!.teleport(150, 100); // out of the way, so he is not drawn over the spot, and the camera stays at the start
      window.__PONCHO__!.step(1);
    });
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null)))));
    return (await pixelsAt(page, [spot]))[0]!;
  };
  await boot(page, LEVEL);
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 2);
  const buttons = (await api(page, () => window.__PONCHO__!.touch())).buttons;
  expect(buttons.some((b) => spot.x >= b.x && spot.x <= b.x + b.w && spot.y >= b.y && spot.y <= b.y + b.h)).toBe(false);
  const full = await readSpot();
  expect(Math.hypot(full.r - 111, full.g - 143, full.b - 216)).toBeLessThan(40);
  await walkOnto(page, FLOOR[3]!);
  const gone = await readSpot();
  // Now the same level with that hilo saved.
  await page.evaluate(([key, text]) => localStorage.setItem(key!, text!), [SAVE_KEY, JSON.stringify({ version: 1, settings: { master: 10, effects: 10, language: 'en' }, progress: { tutorialPlayed: true }, levels: { '0-1': entry({ hilos: hilosAt(3), medal: 'bronze', bestSteps: 5000, cleared: true }) } })]);
  await boot(page, LEVEL);
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 2);
  expect((await api(page, () => window.__PONCHO__!.hilos())).faded).toBe(1);
  const faded = await readSpot();
  expect(Math.hypot(faded.r - mix(full.r, gone.r), faded.g - mix(full.g, gone.g), faded.b - mix(full.b, gone.b))).toBeLessThan(12);
  // Far from both: a mutant that paints it at full strength, or not at all, is told apart.
  expect(Math.hypot(faded.r - full.r, faded.g - full.g, faded.b - full.b)).toBeGreaterThan(25);
  expect(Math.hypot(faded.r - gone.r, faded.g - gone.g, faded.b - gone.b)).toBeGreaterThan(15);
});

test('GDD-PRG-02 a run that quits keeps nothing', async ({ page }) => {
  const seeded = entry({ hilos: hilosAt(0), medal: 'silver', bestSteps: 5000, cleared: true });
  await seed(page, { '0-1': seeded });
  await play(page);
  expect(await api(page, () => window.__PONCHO__!.hilos())).toMatchObject({ taken: 1, faded: 1 });
  await walkOnto(page, FLOOR[1]!);
  expect(await api(page, () => window.__PONCHO__!.hilos())).toMatchObject({ taken: 2, faded: 1 });
  await api(page, () => window.__PONCHO__!.pause(false));
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.__PONCHO__!.pauseDrawn().shown);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.waitForFunction(() => window.__PONCHO__!.pauseDrawn().menu.chosen === 'quit');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__PONCHO__!.titleDrawn().shown);
  // The save has only what it had, and the fresh run behind the title starts from it: the saved hilo counts, the one taken is back.
  expect(await savedLevels(page)).toEqual({ '0-1': seeded });
  expect(await api(page, () => window.__PONCHO__!.hilos())).toEqual({ taken: 1, total: 50, drawn: 49, faded: 1 });
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => !window.__PONCHO__!.titleDrawn().shown);
  expect(await api(page, () => window.__PONCHO__!.hilos())).toEqual({ taken: 1, total: 50, drawn: 49, faded: 1 });
  expect(await savedLevels(page)).toEqual({ '0-1': seeded });
});

test('GDD-PRG-02 quitting to the title after a clear brings the hilos the clear saved back faded', async ({ page }) => {
  await seed(page, {});
  await play(page);
  await walkOnto(page, FLOOR[1]!);
  await clearIt(page);
  // Down twice to Quit to title, then Enter: a fresh run behind the title, from what the clear saved.
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.waitForFunction(() => window.__PONCHO__!.clearDrawn().menu.chosen === 'quit');
  await page.keyboard.press('Enter', { delay: 30 });
  await page.waitForFunction(() => window.__PONCHO__!.titleDrawn().shown);
  await page.waitForFunction(() => window.__PONCHO__!.hilos().faded === 1, undefined, { timeout: 5000 });
  expect(await api(page, () => window.__PONCHO__!.hilos())).toEqual({ taken: 1, total: 50, drawn: 49, faded: 1 });
  expect((await api(page, () => window.__PONCHO__!.hudHilos())).text).toBe('1/50');
});

test('GDD-PRG-02 a clear adds to what is saved and never takes away', async ({ page }) => {
  // Saved: hilos 0 and 2, silver, a fast time. This run takes hilo 1 only, in a slow time, and gets bronze.
  await seed(page, { '0-1': entry({ hilos: hilosAt(0, 2), medal: 'silver', bestSteps: 100, cleared: true }) });
  await play(page);
  await walkOnto(page, FLOOR[1]!);
  await clearIt(page);
  expect(await savedLevels(page)).toEqual({ '0-1': { hilos: hilosAt(0, 1, 2), medal: 'silver', bestSteps: 100, cleared: true } });
});

test('GDD-PRG-02 a faster clear saves the new time', async ({ page }) => {
  await seed(page, { '0-1': entry({ medal: 'bronze', bestSteps: 99999, cleared: true }) });
  await play(page);
  await clearIt(page);
  const clock = await api(page, () => window.__PONCHO__!.phaseSince());
  expect(await savedLevels(page)).toEqual({ '0-1': entry({ medal: 'bronze', bestSteps: clock, cleared: true }) });
});

test('GDD-UI-02 the clear screen shows the best time and New best!', async ({ page }) => {
  await seed(page, { '0-1': entry({ medal: 'bronze', bestSteps: 99999, cleared: true }) });
  await play(page);
  await clearIt(page);
  // The run took about 2 s, far under the saved best: a new best, no "Best" word.
  expect(await api(page, () => window.__PONCHO__!.clearDrawn())).toMatchObject({ time: 'Time 0:02  New best!', medal: 'Bronze medal' });
});

test('GDD-UI-02 the clear screen shows the saved best time when this run is slower', async ({ page }) => {
  await seed(page, { '0-1': entry({ medal: 'bronze', bestSteps: 90, cleared: true }) });
  await play(page);
  await clearIt(page);
  // 90 steps are 1.5 s, shown as 0:01.
  expect(await api(page, () => window.__PONCHO__!.clearDrawn())).toMatchObject({ time: 'Time 0:02  Best 0:01', medal: 'Bronze medal' });
});

test('GDD-UI-02 the first clear of a level shows no best time and no New best!', async ({ page }) => {
  await play(page);
  await clearIt(page);
  expect(await api(page, () => window.__PONCHO__!.clearDrawn())).toMatchObject({ time: 'Time 0:02', medal: 'Bronze medal' });
});

test('GDD-UI-02 the medal line says New best! for a better medal, in its colour, centred with the disc', async ({ page }) => {
  // Every hilo saved and seven lives make gold; the saved best is silver.
  await seed(page, { '0-1': entry({ hilos: '1'.repeat(50), medal: 'silver', bestSteps: 5000, cleared: true }) });
  await play(page);
  await clearIt(page);
  const drawn = await api(page, () => window.__PONCHO__!.clearDrawn());
  expect(drawn).toMatchObject({ hilos: 'Hilos 50/50', medal: 'Gold medal  New best!', medalColour: '#f2c14e' });
  expect(Math.abs(drawn.discX - 5 - (480 - (drawn.textX + drawn.medalWidth)))).toBeLessThanOrEqual(0.5);
  expect((await savedLevels(page))!['0-1']).toMatchObject({ medal: 'gold' });
});

test('GDD-UI-02 the medal line shows nothing more for the same medal', async ({ page }) => {
  await seed(page, { '0-1': entry({ hilos: '1'.repeat(50), medal: 'gold', bestSteps: 5000, cleared: true }) });
  await play(page);
  await clearIt(page);
  expect(await api(page, () => window.__PONCHO__!.clearDrawn())).toMatchObject({ medal: 'Gold medal' });
});

test('GDD-UI-02 the best words are in the chosen language', async ({ page }) => {
  await page.addInitScript(
    ([key, text]) => localStorage.setItem(key!, text!),
    [SAVE_KEY, JSON.stringify({ version: 1, settings: { master: 10, effects: 10, language: 'de' }, progress: { tutorialPlayed: true }, levels: { '0-1': entry({ hilos: '1'.repeat(50), medal: 'silver', bestSteps: 90, cleared: true }) } })],
  );
  await play(page);
  await clearIt(page);
  expect(await api(page, () => window.__PONCHO__!.clearDrawn())).toMatchObject({ time: 'Zeit 0:02  Bestzeit 0:01', medal: 'Goldmedaille  Neuer Rekord!' });
});

test('GDD-PRG-02 saving a setting keeps the progress', async ({ page }) => {
  const seeded = entry({ hilos: hilosAt(0, 2, 3), medal: 'silver', bestSteps: 5000, cleared: true });
  await seed(page, { '0-1': seeded });
  await openGame(page, LEVEL);
  // Master lowered by two on the title's settings screen: saved at once.
  for (const key of ['ArrowDown', 'ArrowDown', 'Enter', 'ArrowLeft', 'ArrowLeft', 'Escape', 'ArrowUp', 'ArrowUp']) await page.keyboard.press(key);
  await page.waitForFunction(() => window.__PONCHO__!.settings().master === 8 && window.__PONCHO__!.titleDrawn().menu.chosen === 'start');
  const text = await api(page, () => localStorage.getItem('poncho-siete-vidas'));
  expect(JSON.parse(text!)).toMatchObject({ settings: { master: 8 }, levels: { '0-1': seeded } });
});

test('GDD-PRG-02 an unreadable entry reads as nothing saved and the game plays', async ({ page }) => {
  await page.addInitScript(
    ([key, text]) => localStorage.setItem(key!, text!),
    [SAVE_KEY, JSON.stringify({ version: 1, settings: { master: 10, effects: 10, language: 'en' }, progress: { tutorialPlayed: true }, levels: { '0-1': { hilos: '101', medal: 'platinum', bestSteps: -3, cleared: 'true' }, '1-1': 7 } })],
  );
  const errors = await boot(page, LEVEL);
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 2);
  expect(await api(page, () => window.__PONCHO__!.hilos())).toEqual({ taken: 0, total: 50, drawn: 50, faded: 0 });
  expect((await api(page, () => window.__PONCHO__!.progress()))['0-1']).toEqual({ hilos: Array<boolean>(50).fill(false), medal: null, bestSteps: null, cleared: false });
  expect((await api(page, () => window.__PONCHO__!.progress()))['1-1']).toBeUndefined();
  expect(errors).toEqual([]);
});

test('GDD-PRG-02 the sandbox saves nothing and shows nothing saved', async ({ page }) => {
  // Even a save that names the sandbox: it is not a level whose progress is kept.
  await page.addInitScript(
    ([key, text]) => localStorage.setItem(key!, text!),
    [SAVE_KEY, JSON.stringify({ version: 1, settings: { master: 10, effects: 10, language: 'en' }, progress: { tutorialPlayed: true }, levels: { sandbox: entry({ hilos: '1'.repeat(20), medal: 'gold', bestSteps: 5, cleared: true }) } })],
  );
  await boot(page);
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 5);
  expect(await api(page, () => window.__PONCHO__!.level())).toBe('sandbox');
  expect(await api(page, () => window.__PONCHO__!.hilos())).toMatchObject({ taken: 0, total: 20, faded: 0 });
  expect(await api(page, () => window.__PONCHO__!.progress())).toEqual({});
});

// ---- Where the browser refuses storage, the progress lasts for the visit (L-049) ----

test('GDD-PRG-02 where storage is refused, a Retry keeps the progress of the visit', async ({ page }) => {
  await refuseStorage(page);
  await play(page);
  await walkOnto(page, FLOOR[0]!);
  expect((await api(page, () => window.__PONCHO__!.hilos())).taken).toBe(1);
  await clearIt(page);
  await page.keyboard.press('ArrowDown');
  await page.waitForFunction(() => window.__PONCHO__!.clearDrawn().menu.chosen === 'retry');
  await page.keyboard.press('Enter', { delay: 30 });
  // A fresh scene at once: the hilo the clear saved is faded and counts, the others are back.
  await page.waitForFunction(() => window.__PONCHO__!.phase() === 'playing' && window.__PONCHO__!.ticks() > 2 && window.__PONCHO__!.hilos().faded === 1);
  expect(await api(page, () => window.__PONCHO__!.hilos())).toEqual({ taken: 1, total: 50, drawn: 49, faded: 1 });
  expect((await api(page, () => window.__PONCHO__!.hudHilos())).text).toBe('1/50');
  // Its clear screen compares with the visit's: this run is slower or equal, never "first".
  await api(page, () => window.__PONCHO__!.pause(true));
  await clearIt(page);
  expect((await api(page, () => window.__PONCHO__!.clearDrawn())).time).toMatch(/^Time \d+:\d\d {2}(Best \d+:\d\d|New best!)$/);
});

test('GDD-PRG-02 where storage is refused, the next level and a title over another level keep the progress of the visit', async ({ page }) => {
  await refuseStorage(page);
  await boot(page, '/'); // 0-1 until it has started, then "Start" plays 1-1
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 5);
  await api(page, () => window.__PONCHO__!.pause(true));
  await walkOnto(page, FLOOR[0]!);
  await clearIt(page);
  // Next level (the menu opens on it): 1-1, whose own progress is empty.
  await page.keyboard.press('Enter', { delay: 30 });
  await page.waitForFunction(() => window.__PONCHO__!.level() === '1-1' && window.__PONCHO__!.phase() === 'playing' && window.__PONCHO__!.ticks() > 2);
  expect(await api(page, () => window.__PONCHO__!.hilos())).toMatchObject({ taken: 0, faded: 0 });
  expect(Object.keys(await api(page, () => window.__PONCHO__!.progress()))).toEqual(['0-1']);
  // Quit to title, then Tutorial on it: a scene of 0-1 takes the title's place, with the hilo faded.
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.__PONCHO__!.pauseDrawn().shown);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.waitForFunction(() => window.__PONCHO__!.pauseDrawn().menu.chosen === 'quit');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__PONCHO__!.titleDrawn().shown && window.__PONCHO__!.level() === '1-1');
  await page.keyboard.press('ArrowDown');
  await page.waitForFunction(() => window.__PONCHO__!.titleDrawn().menu.chosen === 'tutorial');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__PONCHO__!.level() === '0-1' && !window.__PONCHO__!.titleDrawn().shown && window.__PONCHO__!.ticks() > 2);
  expect(await api(page, () => window.__PONCHO__!.hilos())).toMatchObject({ taken: 1, faded: 1, drawn: 49 });
});
