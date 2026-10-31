import { expect, test, type Page } from '@playwright/test';
import { boot, openGame, stepUntil, tapAt } from './helpers';

// GDD-PRG-02: the run is saved when the checkpoint moves to a later ofrenda and resumed by the title's "Continue" row (GDD-UI-02). These
// play 0-1, whose ofrendas stand on the floor at x 376, 792 and 1224 (y 224), and whose first spikes are at x 712. Things are timed in
// simulation steps (L-042). A fresh `/` opens the title over 0-1 until the tutorial has started, then over 1-1.
const api = <T>(page: Page, fn: () => T) => page.evaluate(fn);
const SAVE_KEY = 'poncho-siete-vidas';
const NONE = '0'.repeat(50);
const OFRENDA_X = [376, 792, 1224];
/** A hilos text of 50 characters with a `1` at each index given. */
const hilosAt = (...indexes: number[]): string => Array.from(NONE, (_, i) => (indexes.includes(i) ? '1' : '0')).join('');

interface Saved {
  level: string;
  checkpoint: number;
  lives: number;
  used: string[];
  hilos: string;
  clock: number;
}
const savedRun = (over: Partial<Saved> = {}): Saved => ({ level: '0-1', checkpoint: 1, lives: 4, used: ['ofrenda:0-1-1', 'ofrenda:0-1-2'], hilos: hilosAt(0, 1), clock: 1800, ...over });

/** Saves a game with a run before the page loads (only if nothing is saved yet, so a reload keeps what the game wrote). */
const seed = (page: Page, run: Saved | null, tutorialPlayed = false) =>
  page.addInitScript(
    ([key, text]) => {
      if (localStorage.getItem(key!) === null) localStorage.setItem(key!, text!);
    },
    [SAVE_KEY, JSON.stringify({ version: 1, settings: { master: 10, effects: 10, language: 'en' }, progress: { tutorialPlayed }, levels: {}, run })],
  );
/** Where the browser refuses storage. */
const refuseStorage = (page: Page) =>
  page.addInitScript(() => {
    Storage.prototype.getItem = () => { throw new Error('storage refused'); };
    Storage.prototype.setItem = () => { throw new Error('storage refused'); };
  });
/** The run the game saved: the run part of the save, or null where nothing is saved or the run was dropped. */
const stored = async (page: Page): Promise<Saved | null> => {
  const text = await api(page, () => localStorage.getItem('poncho-siete-vidas'));
  if (text === null) return null;
  const data: { run?: Saved | null } = JSON.parse(text);
  return data.run ?? null;
};

/** Starts 0-1 from its title and pauses the game once it runs (the debug pause: steps are taken by `step`). */
async function play(page: Page): Promise<void> {
  await boot(page, '/');
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 5);
  await api(page, () => window.__PONCHO__!.pause(true));
}
/** From a paused game: puts Poncho on the floor at `x` and takes one step, so an ofrenda there is touched. */
const touchAt = (page: Page, x: number) =>
  page.evaluate((px) => {
    window.__PONCHO__!.teleport(px, 224);
    window.__PONCHO__!.step(1);
  }, x);
/** Takes the paused game back to the title with the pause menu: Escape, then Down, Down and Enter on "Quit to title". */
async function quitToTitle(page: Page): Promise<void> {
  await api(page, () => window.__PONCHO__!.pause(false));
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.__PONCHO__!.pauseDrawn().shown);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.waitForFunction(() => window.__PONCHO__!.pauseDrawn().menu.chosen === 'quit');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__PONCHO__!.titleDrawn().shown);
}
const titleItems = (page: Page) => api(page, () => window.__PONCHO__!.titleDrawn().menu.items);
/** Waits until the resumed run has flipped in and plays. */
const playing = (page: Page) => page.waitForFunction(() => !window.__PONCHO__!.titleDrawn().shown && window.__PONCHO__!.phase() === 'playing');

// ---- Saving ----

test('GDD-PRG-02 reaching an ofrenda saves the run', async ({ page, isMobile }) => {
  test.skip(isMobile, 'the same on a phone: the saving is not input');
  await play(page);
  expect(await stored(page)).toBeNull();
  await touchAt(page, OFRENDA_X[0]!);
  const first = await stored(page);
  expect(first).toMatchObject({ level: '0-1', checkpoint: 0, lives: 7, used: ['ofrenda:0-1-1'], hilos: NONE });
  expect(first!.clock).toBeGreaterThan(0);
  expect(await api(page, () => window.__PONCHO__!.savedRun())).toMatchObject({ level: '0-1', checkpoint: 0, lives: 7, used: ['ofrenda:0-1-1'], clock: first!.clock });
  // A later ofrenda replaces it, with the lives then: two lost, one given back by the touch.
  await api(page, () => window.__PONCHO__!.loseLife());
  await api(page, () => window.__PONCHO__!.loseLife());
  await touchAt(page, OFRENDA_X[1]!);
  const second = await stored(page);
  expect(second).toMatchObject({ checkpoint: 1, lives: 6, used: ['ofrenda:0-1-1', 'ofrenda:0-1-2'] });
  expect(second!.clock).toBeGreaterThan(first!.clock);
});

test('GDD-PRG-02 touching an earlier ofrenda again does not write the run again', async ({ page, isMobile }) => {
  test.skip(isMobile, 'the same on a phone: the saving is not input');
  await play(page);
  await touchAt(page, OFRENDA_X[1]!);
  const saved = await stored(page);
  expect(saved).toMatchObject({ checkpoint: 1 });
  // 20 steps later, and a life lost, Poncho touches ofrenda 0 and stands on ofrenda 1 again: the saved run is the one of the checkpoint.
  await api(page, () => window.__PONCHO__!.step(20));
  await api(page, () => window.__PONCHO__!.loseLife());
  await touchAt(page, OFRENDA_X[0]!);
  await touchAt(page, OFRENDA_X[1]!);
  expect(await stored(page)).toEqual(saved);
});

test('GDD-PRG-02 the sandbox saves no run', async ({ page, isMobile }) => {
  test.skip(isMobile, 'the same on a phone: the saving is not input');
  await boot(page); // the sandbox
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 5);
  await api(page, () => window.__PONCHO__!.pause(true));
  await api(page, () => window.__PONCHO__!.loseLife());
  await touchAt(page, 120); // the sandbox's first ofrenda
  expect((await api(page, () => window.__PONCHO__!.ofrendas()))[0]!.used).toBe(true);
  expect(await stored(page)).toBeNull();
  expect(await api(page, () => window.__PONCHO__!.savedRun())).toBeNull();
});

// ---- The title ----

test('GDD-UI-02 Continue is on the title after a reload, chosen first', async ({ page, isMobile }) => {
  test.skip(isMobile, 'the same on a phone: the saving is not input');
  await play(page);
  await touchAt(page, OFRENDA_X[0]!);
  await page.reload();
  await page.waitForFunction(() => window.__PONCHO__ !== undefined && window.__PONCHO__.titleDrawn().shown);
  const title = await api(page, () => window.__PONCHO__!.titleDrawn());
  expect(title.menu).toMatchObject({ shown: true, items: ['Continue', 'Start', 'Tutorial', 'Settings'], chosen: 'continue' });
  const rows = await api(page, () => window.__PONCHO__!.titleMenu());
  expect(rows.map((r) => [r.item, r.y, r.h])).toEqual([['continue', 112, 28], ['start', 140, 28], ['tutorial', 168, 28], ['settings', 196, 28]]);
  expect(title.menu.markerY).toBe(rows[0]!.y + rows[0]!.h / 2);
});

test('GDD-UI-02 Poncho stands beside the title with the Continue row too, clear of the menu', async ({ page }) => {
  await seed(page, savedRun());
  await openGame(page, '/');
  const title = await api(page, () => window.__PONCHO__!.titleDrawn());
  expect(title.ponchoBottom).toBe(104);
  expect(title.ponchoRight).toBeLessThan(240 - 57);
  const rows = await api(page, () => window.__PONCHO__!.titleMenu());
  expect(rows[0]!.y).toBeGreaterThanOrEqual(title.ponchoBottom); // the menu starts under his feet, so nothing overlaps
});

test('GDD-UI-02 there is no Continue row without a saved run, and an unreadable run shows none', async ({ page }) => {
  await seed(page, savedRun({ checkpoint: 3 })); // 0-1 has three ofrendas
  await openGame(page, '/');
  expect(await titleItems(page)).toEqual(['Start', 'Tutorial', 'Settings']);
  expect((await api(page, () => window.__PONCHO__!.titleDrawn())).menu.chosen).toBe('start');
  expect(await api(page, () => window.__PONCHO__!.savedRun())).toBeNull();
});

test('GDD-UI-02 Up and Down move over the four rows, with no wrap-around', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard test');
  await seed(page, savedRun());
  await openGame(page, '/');
  const chosen = (item: string) => page.waitForFunction((i) => window.__PONCHO__!.titleDrawn().menu.chosen === i, item);
  await page.keyboard.press('ArrowUp');
  expect((await api(page, () => window.__PONCHO__!.titleDrawn())).menu.chosen).toBe('continue');
  for (const item of ['start', 'tutorial', 'settings']) {
    await page.keyboard.press('ArrowDown');
    await chosen(item);
  }
  await page.keyboard.press('KeyS');
  expect((await api(page, () => window.__PONCHO__!.titleDrawn())).menu.chosen).toBe('settings');
  for (const item of ['tutorial', 'start', 'continue']) {
    await page.keyboard.press('KeyW');
    await chosen(item);
  }
  expect((await api(page, () => window.__PONCHO__!.titleDrawn())).shown).toBe(true);
});

test('GDD-UI-02 Continue is in the chosen language', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard test');
  await seed(page, savedRun());
  await openGame(page, '/');
  // Down x3 to Settings, Enter, Down x2 to Language, Right chooses Español, then back.
  for (const key of ['ArrowDown', 'ArrowDown', 'ArrowDown', 'Enter', 'ArrowDown', 'ArrowDown', 'ArrowRight']) await page.keyboard.press(key);
  await page.waitForFunction(() => window.__PONCHO__!.settings().language === 'es');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.__PONCHO__!.titleDrawn().shown);
  expect(await titleItems(page)).toEqual(['Continuar', 'Jugar', 'Tutorial', 'Configuración']);
  for (const key of ['ArrowDown', 'ArrowDown', 'Enter', 'ArrowDown', 'ArrowDown', 'ArrowRight']) await page.keyboard.press(key);
  await page.waitForFunction(() => window.__PONCHO__!.settings().language === 'de');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.__PONCHO__!.titleDrawn().shown);
  expect(await titleItems(page)).toEqual(['Weiter', 'Spielen', 'Tutorial', 'Einstellungen']);
});

// ---- Resuming ----

test('GDD-PRG-02 Continue resumes at the ofrenda with the saved lives, hilos and clock', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard test');
  await seed(page, savedRun());
  await openGame(page, '/'); // the title over 0-1: the scene's own level
  // Every frame from here on records a cracking triangle on the HUD: the lives spent before this visit are no lives just lost.
  await page.evaluate(() => {
    const cracks: number[] = [];
    Reflect.set(window, '__cracks', cracks);
    const watch = () => {
      cracks.push(window.__PONCHO__!.hudCracking().length);
      requestAnimationFrame(watch);
    };
    watch();
  });
  await page.keyboard.press('Enter');
  await playing(page);
  expect(await api(page, () => window.__PONCHO__!.level())).toBe('0-1');
  // He is at ofrenda 1, upright on the floor; HUD: 4 lives and 2 of 50 hilos; the clock goes on from 1800.
  expect(await api(page, () => window.__PONCHO__!.state())).toMatchObject({ x: OFRENDA_X[1], y: 224, grounded: true });
  expect(await api(page, () => window.__PONCHO__!.lives())).toBe(4);
  expect(await api(page, () => window.__PONCHO__!.hudFilled())).toBe(4);
  expect((await api(page, () => window.__PONCHO__!.hudHilos())).text).toBe('2/50');
  expect(await api(page, () => window.__PONCHO__!.hilos())).toMatchObject({ taken: 2, total: 50 });
  expect(await api(page, () => window.__PONCHO__!.clock())).toBeGreaterThanOrEqual(1800);
  // The ofrendas used are drawn used, with no marimba, and no triangle cracks for the lives spent before.
  expect((await api(page, () => window.__PONCHO__!.ofrendas())).map((o) => o.used)).toEqual([true, true, false]);
  const sounds = await api(page, () => window.__PONCHO__!.sfx());
  expect(sounds.filter((s) => s === 'meow')).toHaveLength(1);
  expect(sounds).not.toContain('ofrenda');
  expect(await api(page, () => window.__PONCHO__!.hudCracking())).toEqual([]);
  const cracks = await page.evaluate((): number[] => {
    const seen: number[] = Reflect.get(window, '__cracks');
    return seen;
  });
  expect(cracks.length).toBeGreaterThan(0);
  expect(Math.max(...cracks)).toBe(0);
  // The run goes on from the checkpoint: the ofrenda is the respawn point, and the saved run is still there.
  expect(await stored(page)).toEqual(savedRun());
});

test('GDD-PRG-02 Continue from the title over another level starts that level at once', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard test');
  await seed(page, savedRun(), true); // the tutorial was played: the title is over 1-1
  await openGame(page, '/');
  expect(await api(page, () => window.__PONCHO__!.level())).toBe('1-1');
  expect(await titleItems(page)).toEqual(['Continue', 'Start', 'Tutorial', 'Settings']);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__PONCHO__!.level() === '0-1' && !window.__PONCHO__!.titleDrawn().shown && window.__PONCHO__!.phase() === 'playing');
  expect(await api(page, () => window.__PONCHO__!.state())).toMatchObject({ x: OFRENDA_X[1], y: 224 });
  expect(await api(page, () => window.__PONCHO__!.lives())).toBe(4);
  expect((await api(page, () => window.__PONCHO__!.hudHilos())).text).toBe('2/50');
  expect((await api(page, () => window.__PONCHO__!.ofrendas())).map((o) => o.used)).toEqual([true, true, false]);
  expect(await api(page, () => window.__PONCHO__!.hudCracking())).toEqual([]);
  expect((await api(page, () => window.__PONCHO__!.sfx())).filter((s) => s === 'meow')).toHaveLength(1);
});

test('GDD-PRG-02 Continue adds the run\'s hilos to the hilos saved for good, which stay faded', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard test');
  const levels = { '0-1': { hilos: hilosAt(5, 6, 7), medal: null, bestSteps: null, cleared: false } };
  await page.addInitScript(
    ([key, text]) => localStorage.setItem(key!, text!),
    [SAVE_KEY, JSON.stringify({ version: 1, settings: { master: 10, effects: 10, language: 'en' }, progress: { tutorialPlayed: false }, levels, run: savedRun() })],
  );
  await openGame(page, '/');
  await page.keyboard.press('Enter');
  await playing(page);
  expect(await api(page, () => window.__PONCHO__!.hilos())).toMatchObject({ taken: 5, faded: 3, drawn: 45 });
  expect((await api(page, () => window.__PONCHO__!.hudHilos())).text).toBe('5/50');
});

test('GDD-PRG-02 a used ofrenda gives no life after Continue, an unused one does', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard test');
  await seed(page, savedRun());
  await openGame(page, '/');
  await page.keyboard.press('Enter');
  await playing(page);
  await api(page, () => window.__PONCHO__!.pause(true));
  await touchAt(page, OFRENDA_X[0]!);
  await touchAt(page, OFRENDA_X[1]!);
  expect(await api(page, () => window.__PONCHO__!.lives())).toBe(4);
  expect((await api(page, () => window.__PONCHO__!.sfx())).filter((s) => s === 'ofrenda')).toHaveLength(0);
  await touchAt(page, OFRENDA_X[2]!);
  expect(await api(page, () => window.__PONCHO__!.lives())).toBe(5);
  expect(await stored(page)).toMatchObject({ checkpoint: 2, lives: 5, used: ['ofrenda:0-1-1', 'ofrenda:0-1-2', 'ofrenda:0-1-3'] });
});

// ---- When the saved run is kept or dropped ----

test('GDD-PRG-02 quitting keeps the saved run, Start and Tutorial keep it, the clear drops it', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard test');
  await play(page);
  await touchAt(page, OFRENDA_X[0]!);
  const saved = await stored(page);
  expect(saved).not.toBeNull();
  await quitToTitle(page);
  expect(await stored(page)).toEqual(saved);
  expect(await titleItems(page)).toEqual(['Continue', 'Start', 'Tutorial', 'Settings']);
  expect((await api(page, () => window.__PONCHO__!.titleDrawn())).menu.chosen).toBe('continue');
  // Start: a fresh run (the tutorial has started, so it is 1-1); quitting from it keeps the saved run of 0-1.
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__PONCHO__!.level() === '1-1' && !window.__PONCHO__!.titleDrawn().shown && window.__PONCHO__!.ticks() > 5);
  expect(await api(page, () => window.__PONCHO__!.lives())).toBe(7);
  expect(await stored(page)).toEqual(saved);
  await quitToTitle(page);
  expect(await titleItems(page)).toEqual(['Continue', 'Start', 'Tutorial', 'Settings']);
  // Tutorial: a fresh run of 0-1 (touching nothing new); the saved run stays.
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__PONCHO__!.level() === '0-1' && !window.__PONCHO__!.titleDrawn().shown && window.__PONCHO__!.ticks() > 5);
  expect(await stored(page)).toEqual(saved);
  // Reaching the exit clears the level and drops the run.
  await api(page, () => window.__PONCHO__!.pause(true));
  await api(page, () => window.__PONCHO__!.teleport(1400, 224));
  await stepUntil(page, { phase: 'clear' }, 30);
  expect(await api(page, () => window.__PONCHO__!.phase())).toBe('clear');
  expect(await stored(page)).toBeNull();
  await page.reload();
  await page.waitForFunction(() => window.__PONCHO__ !== undefined && window.__PONCHO__.titleDrawn().shown);
  expect(await titleItems(page)).toEqual(['Start', 'Tutorial', 'Settings']);
});

test('GDD-PRG-02 a resumed run that is cleared drops the saved run', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard test');
  await seed(page, savedRun());
  await openGame(page, '/');
  await page.keyboard.press('Enter');
  await playing(page);
  await api(page, () => window.__PONCHO__!.pause(true));
  await api(page, () => window.__PONCHO__!.teleport(1400, 224));
  await stepUntil(page, { phase: 'clear' }, 30);
  expect(await stored(page)).toBeNull();
  expect(await api(page, () => window.__PONCHO__!.savedRun())).toBeNull();
});

test('GDD-PRG-02 the Siete vidas gastadas screen drops the saved run', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard test');
  await play(page);
  await touchAt(page, OFRENDA_X[0]!);
  expect(await stored(page)).not.toBeNull();
  for (let i = 0; i < 6; i++) await api(page, () => window.__PONCHO__!.loseLife());
  expect(await api(page, () => window.__PONCHO__!.lives())).toBe(1);
  // Onto the spikes at x 712: the last life is lost. The run is kept through the wait, and dropped when the screen comes up.
  await api(page, () => window.__PONCHO__!.teleport(712, 224));
  await stepUntil(page, { phase: 'respawning' }, 30);
  expect(await api(page, () => window.__PONCHO__!.lives())).toBe(0);
  expect(await stored(page)).not.toBeNull();
  await stepUntil(page, { phase: 'gameover' }, 60);
  expect(await api(page, () => window.__PONCHO__!.phase())).toBe('gameover');
  expect(await stored(page)).toBeNull();
  expect(await api(page, () => window.__PONCHO__!.savedRun())).toBeNull();
});

// ---- Where the browser refuses storage, the saved run lasts for the visit (L-049) ----

test('GDD-PRG-02 where storage is refused, the saved run lasts for the visit, across a new scene', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard test');
  await refuseStorage(page);
  await play(page);
  await touchAt(page, OFRENDA_X[1]!);
  const saved = await api(page, () => window.__PONCHO__!.savedRun());
  expect(saved).toMatchObject({ level: '0-1', checkpoint: 1, lives: 7 });
  // Quit to title: "Start" now plays 1-1, so a scene of 1-1 takes the title's place and must still have the run.
  await quitToTitle(page);
  await page.waitForFunction(() => window.__PONCHO__!.level() === '1-1');
  expect(await titleItems(page)).toEqual(['Continue', 'Start', 'Tutorial', 'Settings']);
  expect(await api(page, () => window.__PONCHO__!.savedRun())).toEqual(saved);
  // Continue: another new scene, of 0-1, resumes it at the ofrenda.
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__PONCHO__!.level() === '0-1' && !window.__PONCHO__!.titleDrawn().shown && window.__PONCHO__!.phase() === 'playing');
  expect(await api(page, () => window.__PONCHO__!.state())).toMatchObject({ x: OFRENDA_X[1], y: 224 });
  expect(await api(page, () => window.__PONCHO__!.savedRun())).toEqual(saved);
  // The clear drops it for the visit too: a title over a new scene shows no Continue.
  await api(page, () => window.__PONCHO__!.pause(true));
  await api(page, () => window.__PONCHO__!.teleport(1400, 224));
  await stepUntil(page, { phase: 'clear' }, 30);
  expect(await api(page, () => window.__PONCHO__!.savedRun())).toBeNull();
  await api(page, () => window.__PONCHO__!.step(61));
  await page.waitForFunction(() => window.__PONCHO__!.phase() === 'clear' && window.__PONCHO__!.clearDrawn().menu.shown);
  await api(page, () => window.__PONCHO__!.pause(false));
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.waitForFunction(() => window.__PONCHO__!.clearDrawn().menu.chosen === 'quit');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__PONCHO__!.titleDrawn().shown);
  expect(await titleItems(page)).toEqual(['Start', 'Tutorial', 'Settings']);
});

// ---- Touch ----

test('GDD-UI-02 on a phone a tap on the Continue row resumes', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'touch device only');
  await seed(page, savedRun());
  await openGame(page, '/');
  const row = (await api(page, () => window.__PONCHO__!.titleMenu())).find((r) => r.item === 'continue')!; // the slow layout read, before the tap (L-042)
  // Four rows of 34 px end at 248 on this phone: all on the screen.
  expect(row.y + row.h).toBeLessThan(270);
  const last = (await api(page, () => window.__PONCHO__!.titleMenu())).at(-1)!;
  expect(last.y + last.h).toBe(248);
  await tapAt(page, row.x + row.w / 2, row.y + row.h / 2, true);
  await playing(page);
  expect(await api(page, () => window.__PONCHO__!.state())).toMatchObject({ x: OFRENDA_X[1], y: 224 });
  expect(await api(page, () => window.__PONCHO__!.lives())).toBe(4);
});

test('GDD-UI-02 on a phone a tap on the Start row starts a fresh run, not the saved one', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'touch device only');
  await seed(page, savedRun());
  await openGame(page, '/');
  const row = (await api(page, () => window.__PONCHO__!.titleMenu())).find((r) => r.item === 'start')!;
  await tapAt(page, row.x + row.w / 2, row.y + row.h / 2, true);
  await page.waitForFunction(() => !window.__PONCHO__!.titleDrawn().shown && window.__PONCHO__!.ticks() > 2);
  expect(await api(page, () => window.__PONCHO__!.lives())).toBe(7);
  expect((await api(page, () => window.__PONCHO__!.state())).x).toBeLessThan(OFRENDA_X[0]!); // the level start, not an ofrenda
  expect(await stored(page)).toEqual(savedRun()); // starting keeps the saved run
});

test('GDD-UI-02 a finger held on the Continue row does not make Poncho move after the flip', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'touch device only');
  await seed(page, savedRun());
  await openGame(page, '/');
  const row = (await api(page, () => window.__PONCHO__!.titleMenu())).find((r) => r.item === 'continue')!;
  const box = (await page.locator('canvas').boundingBox())!;
  const k = box.width / 480;
  const cdp = await page.context().newCDPSession(page);
  const point = { x: box.x + (row.x + row.w / 2) * k, y: box.y + (row.y + row.h / 2) * k, id: 1 };
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
  await playing(page);
  // Held across the whole flip and 40 steps in play: still on the ofrenda's floor, no jump, no run.
  const result = await page.evaluate(async () => {
    const d = window.__PONCHO__!;
    const t0 = d.ticks();
    let top = d.state().y;
    let left = d.state().x;
    let right = left;
    while (d.ticks() < t0 + 40) {
      const s = d.state();
      top = Math.min(top, s.y);
      left = Math.min(left, s.x);
      right = Math.max(right, s.x);
      await new Promise((r) => requestAnimationFrame(r));
    }
    return { top, left, right };
  });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  expect(result).toEqual({ top: 224, left: OFRENDA_X[1], right: OFRENDA_X[1] });
});

test('GDD-UI-02 a Right key down in the frame Enter picked Continue does not run after the flip', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard test');
  await seed(page, savedRun());
  await openGame(page, '/');
  // Right goes down and Enter taps in one task, so one title frame sees both: the pick wins, and the Right is held back until released.
  await page.evaluate(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight', keyCode: 39, bubbles: true }));
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Enter', keyCode: 13, bubbles: true }));
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Enter', keyCode: 13, bubbles: true }));
  });
  await playing(page);
  const span = await page.evaluate(async () => {
    const d = window.__PONCHO__!;
    const t0 = d.ticks();
    let right = d.state().x;
    while (d.ticks() < t0 + 40) {
      right = Math.max(right, d.state().x);
      await new Promise((r) => requestAnimationFrame(r));
    }
    return right;
  });
  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keyup', { code: 'ArrowRight', keyCode: 39, bubbles: true })));
  expect(span).toBe(OFRENDA_X[1]);
});

test('GDD-UI-02 the Space that picked Continue, held through the flip, does not jump', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard test');
  await seed(page, savedRun());
  await openGame(page, '/');
  await page.keyboard.down('Space'); // Space picks the chosen row
  await playing(page);
  const top = await page.evaluate(async () => {
    const d = window.__PONCHO__!;
    const t0 = d.ticks();
    let min = d.state().y;
    while (d.ticks() < t0 + 40) {
      min = Math.min(min, d.state().y);
      await new Promise((r) => requestAnimationFrame(r));
    }
    return min;
  });
  await page.keyboard.up('Space');
  expect(top).toBe(224);
});
