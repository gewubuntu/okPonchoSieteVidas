import { expect, test, type Page } from '@playwright/test';
import { LEVEL_1_2 } from '../src/levels/level1-2';
import { boot, openGame, stepToBossMode, stepUntil, tapAt, waitForResults } from './helpers';

// GDD-LIFE-05: the lives carried through World 1 (Next level, Retry), kept in the save, and the restart at 1-1 after the last life;
// GDD-UI-02: what "Start" plays, and with how many lives, once World 1 has levels cleared; GDD-PRG-02: the hilos kept when the last life
// is lost. These play 1-1, 1-2, 1-3 and the boss arena 1-4: the exits of 1-1 and 1-2 are at x 2780 (y 224), 1-3's at x 2780 on its last cliff (y 128), the
// spikes at column 39 (x 632) in 1-1 and 1-2 and at column 104 (x 1672, under 1-3's shuttle), 1-1's first hilos at x 40, 72 and 104 and
// 1-2's at x 72, 88 and 104 (the floor, y 224), 1-3's second hilo at x 72, 1-2's first two ofrendas at x 760 and 1592. Things are timed in
// simulation steps (L-042).
const api = <T>(page: Page, fn: () => T) => page.evaluate(fn);
const SAVE_KEY = 'poncho-siete-vidas';
const NONE = '0'.repeat(50);
/** A hilos text of 50 characters with a `1` at each index given. */
const hilosAt = (...indexes: number[]): string => Array.from(NONE, (_, i) => (indexes.includes(i) ? '1' : '0')).join('');

interface Entry {
  hilos: string;
  medal: string | null;
  bestSteps: number | null;
  cleared: boolean;
}
/** 1-1 cleared, as a seeded save has it. */
const CLEARED_1_1: Entry = { hilos: NONE, medal: 'bronze', bestSteps: 9000, cleared: true };

interface Saved {
  progress: { tutorialPlayed: boolean; worldLives: Record<string, number>; worldAt: Record<string, string> };
  levels: Record<string, Entry>;
  run: { level: string; checkpoint: number; lives: number; livesIn: number } | null;
}

/** Saves a game before the page loads, the tutorial played (only if nothing is saved yet, so a reload keeps what the game wrote). */
const seed = (page: Page, levels: Record<string, Entry>, worldLives: Record<string, number> = {}, worldAt: Record<string, string> = {}) =>
  page.addInitScript(
    ([key, text]) => {
      if (localStorage.getItem(key!) === null) localStorage.setItem(key!, text!);
    },
    [SAVE_KEY, JSON.stringify({ version: 1, settings: { master: 10, effects: 10, language: 'en' }, progress: { tutorialPlayed: true, worldLives, worldAt }, levels, run: null })],
  );
/** Where the browser refuses storage. */
const refuseStorage = (page: Page) =>
  page.addInitScript(() => {
    Storage.prototype.getItem = () => { throw new Error('storage refused'); };
    Storage.prototype.setItem = () => { throw new Error('storage refused'); };
  });
/** The save the game wrote, parsed, or null where nothing is saved. */
const stored = async (page: Page): Promise<Saved | null> => {
  const text = await api(page, () => localStorage.getItem('poncho-siete-vidas'));
  if (text === null) return null;
  const data: Saved = JSON.parse(text);
  return data;
};

/** From a paused game: puts Poncho on the floor at `x` and takes one step, so a pickup there is touched. */
const walkOnto = (page: Page, x: number) =>
  page.evaluate((px) => {
    window.__PONCHO__!.teleport(px, 224);
    window.__PONCHO__!.step(1);
  }, x);
/** To the exit of the level played (on the floor, or at `y`) and its clear screen with the results menu up (the menu takes keys while the debug pause is on, as in `e2e/level0-1.spec.ts`). */
async function toExit(page: Page, y = 224): Promise<void> {
  await api(page, () => window.__PONCHO__!.pause(true));
  await page.evaluate((py) => window.__PONCHO__!.teleport(2780, py), y);
  await stepUntil(page, { phase: 'clear' }, 30);
  await api(page, () => window.__PONCHO__!.step(61));
  await waitForResults(page);
}
/** From a paused game with one life left: onto the spikes at x 632 (or at `x`), the last life lost, and the Siete vidas gastadas screen up. */
async function outOfLives(page: Page, x = 632): Promise<void> {
  expect(await api(page, () => window.__PONCHO__!.lives())).toBe(1);
  await page.evaluate((px) => window.__PONCHO__!.teleport(px, 224), x);
  await stepUntil(page, { phase: 'respawning' }, 30);
  expect(await api(page, () => window.__PONCHO__!.lives())).toBe(0);
  await stepUntil(page, { phase: 'gameover' }, 60);
  expect(await api(page, () => window.__PONCHO__!.phase())).toBe('gameover');
}
/** On the screen: 61 steps (past its 1.0 s lockout), then one step with jump pressed, all in one task so the next frame cannot replace the scene in between. */
async function pressThrough(page: Page): Promise<{ phase: string; level: string }> {
  await api(page, () => window.__PONCHO__!.step(61));
  return page.evaluate(() => {
    window.__PONCHO__!.step(1, { move: 0, jumpHeld: true });
    return { phase: window.__PONCHO__!.phase(), level: window.__PONCHO__!.level() };
  });
}
/** The pause menu's keys to Quit to title, as in `e2e/saved-run.spec.ts`: Escape, Down twice, Enter. Pauses nothing and resumes nothing itself. */
async function chooseQuit(page: Page): Promise<void> {
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.__PONCHO__!.pauseDrawn().shown);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.waitForFunction(() => window.__PONCHO__!.pauseDrawn().menu.chosen === 'quit');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__PONCHO__!.titleDrawn().shown);
}
/** Takes the paused game back to the title with the pause menu, the debug pause turned off first. */
async function quitToTitle(page: Page): Promise<void> {
  await api(page, () => window.__PONCHO__!.pause(false));
  await chooseQuit(page);
}
/**
 * The same, but with the debug pause still on: no step runs between the last check and the quit, so a crack or a pulse stands still
 * (L-042). The pause menu opens and takes keys under the debug pause, as the results menu does in `toExit`.
 */
const quitPaused = chooseQuit;
/** 0-1's exit and its clear screen with the results menu up, from a paused 0-1. */
async function toExit01(page: Page): Promise<void> {
  await api(page, () => window.__PONCHO__!.pause(true));
  await api(page, () => window.__PONCHO__!.teleport(1400, 224));
  await stepUntil(page, { phase: 'clear' }, 30);
  await api(page, () => window.__PONCHO__!.step(61));
  await waitForResults(page);
}
/** Waits until the level is playing in a scene of `level` that has run a few steps. */
const playingIn = (page: Page, level: string) => page.waitForFunction((l) => window.__PONCHO__!.level() === l && window.__PONCHO__!.phase() === 'playing' && window.__PONCHO__!.ticks() > 2, level);
/**
 * From a paused 1-4 (Poncho at its start): Don Zopilote set to two hits, stepped to his dive aimed at Poncho, Poncho moved 42 px left of
 * where he lands, stepped to his sticking in the sand, then the claw swing that is the third hit, and the clear screen with the results menu up.
 */
async function beatBoss(page: Page): Promise<void> {
  await api(page, () => window.__PONCHO__!.setBoss(2));
  expect(await stepToBossMode(page, 'dive')).toBeLessThan(1000);
  await api(page, () => window.__PONCHO__!.teleport(190, 224));
  expect(await stepToBossMode(page, 'stuck')).toBeLessThan(200);
  await api(page, () => window.__PONCHO__!.step(3, { move: 0, jumpHeld: false, claw: true }));
  expect(await api(page, () => window.__PONCHO__!.boss())).toMatchObject({ hits: 3, mode: 'defeated' });
  await stepUntil(page, { phase: 'clear' }, 70);
  await api(page, () => window.__PONCHO__!.step(61));
  await waitForResults(page);
}
/** From 1-1 by its address: three lives lost (four left), the exit, and Next level picked into 1-2. */
async function intoTwoWithFour(page: Page): Promise<void> {
  await boot(page, '/?level=1-1');
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 5);
  await api(page, () => window.__PONCHO__!.pause(true));
  for (let i = 0; i < 3; i++) await api(page, () => window.__PONCHO__!.loseLife());
  expect(await api(page, () => window.__PONCHO__!.lives())).toBe(4);
  await toExit(page);
  await page.keyboard.press('Enter', { delay: 30 });
  await playingIn(page, '1-2');
}

test('GDD-LIFE-05 the lives at the exit of 1-1 carry into 1-2 by Next level, and Retry of 1-2 starts it with the lives at its clear', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard test');
  await boot(page, '/?level=1-1');
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 5);
  await api(page, () => window.__PONCHO__!.pause(true));
  for (let i = 0; i < 3; i++) await api(page, () => window.__PONCHO__!.loseLife());
  expect(await api(page, () => window.__PONCHO__!.lives())).toBe(4);
  await toExit(page);
  // The clear keeps its lives, whatever the address.
  expect((await stored(page))!.progress.worldLives).toEqual({ '1': 4 });
  expect((await api(page, () => window.__PONCHO__!.clearDrawn())).menu.chosen).toBe('next');
  await page.keyboard.press('Enter', { delay: 30 });
  await playingIn(page, '1-2');
  expect(await api(page, () => window.__PONCHO__!.lives())).toBe(4);
  expect(await api(page, () => window.__PONCHO__!.hudFilled())).toBe(4);
  expect(await api(page, () => window.__PONCHO__!.hudCracking())).toEqual([]);
  expect(await api(page, () => window.__PONCHO__!.veladoraDrawn())).toBe(true);
  expect((await api(page, () => window.__PONCHO__!.titleDrawn())).shown).toBe(false);
  // 1-2's first ofrenda is unused, whatever the lives carried.
  await api(page, () => window.__PONCHO__!.pause(true));
  await walkOnto(page, 760);
  expect(await api(page, () => window.__PONCHO__!.lives())).toBe(5);
  await toExit(page);
  expect((await stored(page))!.progress.worldLives).toEqual({ '1': 5 });
  // 1-2 names 1-3: the menu opens on Next level, and Down picks Retry.
  expect((await api(page, () => window.__PONCHO__!.clearDrawn())).menu.chosen).toBe('next');
  await page.keyboard.press('ArrowDown');
  await page.waitForFunction(() => window.__PONCHO__!.clearDrawn().menu.chosen === 'retry');
  await page.keyboard.press('Enter', { delay: 30 });
  await playingIn(page, '1-2');
  expect(await api(page, () => window.__PONCHO__!.lives())).toBe(5);
  expect(await api(page, () => window.__PONCHO__!.state())).toMatchObject({ x: 56, y: 224 });
  // After Retry the ofrendas are unused again: they can win some back.
  await api(page, () => window.__PONCHO__!.pause(true));
  await walkOnto(page, 760);
  expect(await api(page, () => window.__PONCHO__!.lives())).toBe(6);
});

test('GDD-LIFE-04 1-2 entered with one life pulses its last triangle from the start', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard test');
  await boot(page, '/?level=1-1');
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 5);
  await api(page, () => window.__PONCHO__!.pause(true));
  for (let i = 0; i < 6; i++) await api(page, () => window.__PONCHO__!.loseLife());
  await toExit(page);
  await page.keyboard.press('Enter', { delay: 30 });
  await page.waitForFunction(() => window.__PONCHO__!.level() === '1-2' && window.__PONCHO__!.phase() === 'playing');
  expect(await api(page, () => window.__PONCHO__!.lives())).toBe(1);
  expect(await api(page, () => window.__PONCHO__!.hudPulse())).not.toBeNull();
  // The pulse grows to 1.4 (GDD-LIFE-04).
  await page.waitForFunction(() => (window.__PONCHO__!.hudPulse() ?? 0) > 1.2);
});

test('GDD-PRG-02 a run of 1-2 begun with lives carried from 1-1 is saved and continued with them', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard test');
  await intoTwoWithFour(page);
  await api(page, () => window.__PONCHO__!.pause(true));
  await walkOnto(page, 760);
  expect(await api(page, () => window.__PONCHO__!.lives())).toBe(5);
  expect((await stored(page))!.run).toMatchObject({ level: '1-2', checkpoint: 0, lives: 5, livesIn: 4 });
  // The title over 1-1, the address.
  await quitToTitle(page);
  expect((await api(page, () => window.__PONCHO__!.titleDrawn())).menu).toMatchObject({ items: ['Continue', 'Start', 'Tutorial', 'Settings'], chosen: 'continue' });
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__PONCHO__!.level() === '1-2' && window.__PONCHO__!.phase() === 'playing');
  expect(await api(page, () => window.__PONCHO__!.lives())).toBe(5);
  expect(await api(page, () => window.__PONCHO__!.state())).toMatchObject({ x: 760, y: 224 });
});

test('GDD-LIFE-05 out of lives in 1-2, the press starts 1-1 at once with seven lives by the flip, and the hilos of 1-2 stay', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard test');
  await seed(page, { '1-1': { hilos: hilosAt(0), medal: 'bronze', bestSteps: 9000, cleared: true } }, { '1': 6 });
  await boot(page, '/?level=1-2');
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 5);
  await api(page, () => window.__PONCHO__!.pause(true));
  expect(await api(page, () => window.__PONCHO__!.level())).toBe('1-2');
  for (const x of [72, 88, 104]) await walkOnto(page, x);
  expect((await api(page, () => window.__PONCHO__!.hilos())).taken).toBe(3);
  for (let i = 0; i < 6; i++) await api(page, () => window.__PONCHO__!.loseLife());
  await outOfLives(page);
  const saved = (await stored(page))!;
  expect(saved.levels['1-2']).toMatchObject({ hilos: hilosAt(0, 1, 2), medal: null, bestSteps: null, cleared: false });
  expect(saved.levels['1-1']).toMatchObject({ hilos: hilosAt(0), cleared: true });
  expect(saved.progress.worldLives).toEqual({ '1': 0 });
  expect(saved.run).toBeNull();
  // The screen stays up until 1-1 starts.
  expect(await pressThrough(page)).toEqual({ phase: 'gameover', level: '1-2' });
  await page.waitForFunction(() => window.__PONCHO__!.level() === '1-1');
  await page.waitForFunction(() => window.__PONCHO__!.phase() === 'playing');
  // The restart's flip (FLIP.steps + 1 = 22 steps from the new scene's start) was not skipped by the press.
  expect(await api(page, () => window.__PONCHO__!.phaseSince())).toBe(22);
  expect(await api(page, () => window.__PONCHO__!.lives())).toBe(7);
  expect(await api(page, () => window.__PONCHO__!.hudFilled())).toBe(7);
  expect(await api(page, () => window.__PONCHO__!.state())).toMatchObject({ x: 56, y: 224 });
  expect((await api(page, () => window.__PONCHO__!.camera())).viewX).toBe(0);
  expect((await api(page, () => window.__PONCHO__!.titleDrawn())).shown).toBe(false);
  // 1-1's saved hilo; the run is fresh.
  expect(await api(page, () => window.__PONCHO__!.hilos())).toMatchObject({ taken: 1, faded: 1 });
  const two = (await api(page, () => window.__PONCHO__!.progress()))['1-2']!;
  expect(two).toMatchObject({ medal: null, bestSteps: null, cleared: false });
  expect(two.hilos.slice(0, 4)).toEqual([true, true, true, false]);
  // The address wins on the title: 1-2 with seven lives, its hilos stayed (GDD-LIFE-05).
  await quitToTitle(page);
  await page.waitForFunction(() => window.__PONCHO__!.titleDrawn().shown && window.__PONCHO__!.level() === '1-2');
  expect(await api(page, () => window.__PONCHO__!.hilos())).toMatchObject({ taken: 3, faded: 3 });
  expect(await api(page, () => window.__PONCHO__!.lives())).toBe(7);
});

test('GDD-LIFE-05 out of lives in 1-1, the restart stays in 1-1 and keeps its hilos', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard test');
  await seed(page, { '1-1': { hilos: hilosAt(5), medal: 'silver', bestSteps: 5000, cleared: true } }, { '1': 6 });
  await boot(page, '/?level=1-1');
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 5);
  await api(page, () => window.__PONCHO__!.pause(true));
  expect(await api(page, () => window.__PONCHO__!.hilos())).toMatchObject({ taken: 1, faded: 1 });
  for (const x of [40, 72, 104]) await walkOnto(page, x);
  expect((await api(page, () => window.__PONCHO__!.hilos())).taken).toBe(4);
  for (let i = 0; i < 6; i++) await api(page, () => window.__PONCHO__!.loseLife());
  await outOfLives(page);
  const saved = (await stored(page))!;
  // The medal, the time and cleared are kept.
  expect(saved.levels['1-1']).toMatchObject({ hilos: hilosAt(0, 1, 2, 5), medal: 'silver', bestSteps: 5000, cleared: true });
  expect(saved.progress.worldLives).toEqual({ '1': 0 });
  expect(saved.progress.worldAt).toEqual({ '1': '1-1' });
  // The same scene restarts at once.
  expect(await pressThrough(page)).toEqual({ phase: 'respawning', level: '1-1' });
  await api(page, () => window.__PONCHO__!.step(21));
  expect(await api(page, () => window.__PONCHO__!.phase())).toBe('playing');
  expect(await api(page, () => window.__PONCHO__!.state())).toMatchObject({ x: 56, y: 224 });
  expect(await api(page, () => window.__PONCHO__!.lives())).toBe(7);
  // The three taken in the run stay taken in it, not faded.
  expect(await api(page, () => window.__PONCHO__!.hilos())).toMatchObject({ taken: 4, faded: 1 });
});

test('GDD-LIFE-05 the lives of the tutorial do not carry into 1-1, and the save keeps none for it', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard test');
  await boot(page, '/');
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 5);
  await api(page, () => window.__PONCHO__!.pause(true));
  for (let i = 0; i < 2; i++) await api(page, () => window.__PONCHO__!.loseLife());
  await toExit01(page);
  expect((await stored(page))!.progress.worldLives).toEqual({});
  await page.keyboard.press('Enter', { delay: 30 });
  await playingIn(page, '1-1');
  expect(await api(page, () => window.__PONCHO__!.lives())).toBe(7);
  expect(await api(page, () => window.__PONCHO__!.hudFilled())).toBe(7);
});

test('GDD-UI-02 with 1-1 cleared and World 1 keeping 5 lives, the game opens on the title over 1-2, Start plays it with 5, and quitting keeps them', async ({ page, isMobile }) => {
  await seed(page, { '1-1': CLEARED_1_1 }, { '1': 5 });
  await openGame(page, '/');
  expect(await api(page, () => window.__PONCHO__!.level())).toBe('1-2');
  expect(await api(page, () => window.__PONCHO__!.lives())).toBe(5);
  expect(await api(page, () => window.__PONCHO__!.titleDrawn())).toMatchObject({ shown: true, menu: { items: ['Start', 'Tutorial', 'Settings'], chosen: 'start' } });
  // The device's way: Enter on a desktop, a tap off the rows on a phone (which starts the level as "Start" does).
  if (isMobile) await tapAt(page, 240, 60, true);
  else await page.keyboard.press('Enter');
  await page.waitForFunction(() => !window.__PONCHO__!.titleDrawn().shown && window.__PONCHO__!.ticks() > 5);
  expect(await api(page, () => window.__PONCHO__!.level())).toBe('1-2');
  expect(await api(page, () => window.__PONCHO__!.lives())).toBe(5);
  if (!isMobile) {
    await api(page, () => window.__PONCHO__!.pause(true));
    await quitToTitle(page);
    await page.waitForFunction(() => window.__PONCHO__!.titleDrawn().shown && window.__PONCHO__!.level() === '1-2');
    // The run behind the title is a fresh one of what "Start" plays, with its lives.
    expect(await api(page, () => window.__PONCHO__!.lives())).toBe(5);
    expect(await api(page, () => window.__PONCHO__!.hudFilled())).toBe(5);
  }
});

test('GDD-UI-02 clearing 1-1 then quitting brings the title back over 1-2 with the lives at the clear, which Start plays', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard test');
  await seed(page, {});
  await boot(page, '/');
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 5);
  expect(await api(page, () => window.__PONCHO__!.level())).toBe('1-1');
  expect(await api(page, () => window.__PONCHO__!.lives())).toBe(7);
  await api(page, () => window.__PONCHO__!.pause(true));
  for (let i = 0; i < 2; i++) await api(page, () => window.__PONCHO__!.loseLife());
  await toExit(page);
  expect((await api(page, () => window.__PONCHO__!.clearDrawn())).menu.chosen).toBe('next');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.waitForFunction(() => window.__PONCHO__!.clearDrawn().menu.chosen === 'quit');
  await page.keyboard.press('Enter', { delay: 30 });
  await page.waitForFunction(() => window.__PONCHO__!.titleDrawn().shown && window.__PONCHO__!.level() === '1-2');
  expect((await api(page, () => window.__PONCHO__!.progress()))['1-1']!.cleared).toBe(true);
  expect(await api(page, () => window.__PONCHO__!.lives())).toBe(5);
  expect(await api(page, () => window.__PONCHO__!.hudFilled())).toBe(5);
  expect((await api(page, () => window.__PONCHO__!.titleDrawn())).menu.chosen).toBe('start');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => !window.__PONCHO__!.titleDrawn().shown && window.__PONCHO__!.ticks() > 5);
  expect(await api(page, () => window.__PONCHO__!.level())).toBe('1-2');
  expect(await api(page, () => window.__PONCHO__!.lives())).toBe(5);
});

test('GDD-UI-02 where storage is refused, clearing 1-1 then quitting brings the title back over 1-2 with the lives at the clear', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard test');
  await refuseStorage(page);
  await boot(page, '/');
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 5);
  await toExit01(page);
  await page.keyboard.press('Enter', { delay: 30 }); // Next level
  await playingIn(page, '1-1');
  await api(page, () => window.__PONCHO__!.pause(true));
  for (let i = 0; i < 2; i++) await api(page, () => window.__PONCHO__!.loseLife());
  await toExit(page);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.waitForFunction(() => window.__PONCHO__!.clearDrawn().menu.chosen === 'quit');
  await page.keyboard.press('Enter', { delay: 30 });
  // 1-1 cleared in this visit counts, and so do the lives kept in it.
  await page.waitForFunction(() => window.__PONCHO__!.titleDrawn().shown && window.__PONCHO__!.level() === '1-2');
  expect(await api(page, () => window.__PONCHO__!.lives())).toBe(5);
});

test('GDD-PRG-02 where storage is refused, the hilos of 1-2 kept at the Siete vidas gastadas screen are in the progress after the restart in 1-1', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard test');
  await refuseStorage(page);
  await boot(page, '/?level=1-2');
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 5);
  await api(page, () => window.__PONCHO__!.pause(true));
  await walkOnto(page, 72);
  for (let i = 0; i < 6; i++) await api(page, () => window.__PONCHO__!.loseLife());
  await outOfLives(page);
  await api(page, () => window.__PONCHO__!.step(61));
  await api(page, () => window.__PONCHO__!.step(1, { move: 0, jumpHeld: true }));
  await page.waitForFunction(() => window.__PONCHO__!.level() === '1-1' && window.__PONCHO__!.phase() === 'playing');
  expect((await api(page, () => window.__PONCHO__!.progress()))['1-2']!.hilos[0]).toBe(true);
});

test('GDD-LIFE-05 after the last life is lost in 1-2, a new visit opens on 1-1 and Start plays it with seven', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard test');
  await seed(page, { '1-1': CLEARED_1_1 }, { '1': 5 });
  await openGame(page, '/');
  await page.waitForFunction(() => window.__PONCHO__!.titleDrawn().shown && window.__PONCHO__!.level() === '1-2');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => !window.__PONCHO__!.titleDrawn().shown && window.__PONCHO__!.ticks() > 5);
  await api(page, () => window.__PONCHO__!.pause(true));
  for (let i = 0; i < 4; i++) await api(page, () => window.__PONCHO__!.loseLife());
  await outOfLives(page);
  expect((await stored(page))!.progress.worldLives).toEqual({ '1': 0 });
  // However you get there: a new visit (the seed is kept, it writes only when nothing is saved).
  await page.reload();
  await page.waitForFunction(() => window.__PONCHO__ !== undefined && window.__PONCHO__.titleDrawn().shown);
  expect(await api(page, () => window.__PONCHO__!.level())).toBe('1-1');
  expect(await api(page, () => window.__PONCHO__!.lives())).toBe(7);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => !window.__PONCHO__!.titleDrawn().shown && window.__PONCHO__!.ticks() > 5);
  expect(await api(page, () => window.__PONCHO__!.level())).toBe('1-1');
  expect(await api(page, () => window.__PONCHO__!.lives())).toBe(7);
});

test('GDD-LIFE-05 where storage is refused, quitting from the restart in 1-1 after the last life in 1-2 brings the title back over 1-1', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard test');
  await refuseStorage(page);
  await boot(page, '/');
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 5);
  await toExit01(page);
  await page.keyboard.press('Enter', { delay: 30 });
  await playingIn(page, '1-1');
  // 1-1 cleared in this visit, with seven lives kept.
  await toExit(page);
  await page.keyboard.press('Enter', { delay: 30 }); // Next level
  await playingIn(page, '1-2');
  await api(page, () => window.__PONCHO__!.pause(true));
  for (let i = 0; i < 6; i++) await api(page, () => window.__PONCHO__!.loseLife());
  await outOfLives(page);
  await api(page, () => window.__PONCHO__!.step(61));
  await api(page, () => window.__PONCHO__!.step(1, { move: 0, jumpHeld: true }));
  await page.waitForFunction(() => window.__PONCHO__!.level() === '1-1' && window.__PONCHO__!.phase() === 'playing');
  await quitToTitle(page);
  // Not 1-2: World 1's lives are 0 in this visit, though 1-1 is cleared.
  expect(await api(page, () => window.__PONCHO__!.level())).toBe('1-1');
  expect(await api(page, () => window.__PONCHO__!.lives())).toBe(7);
});

test('GDD-LIFE-05 quitting from 1-2 with more lives than World 1 keeps brings back the title with the kept lives and no crack', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard test');
  await seed(page, { '1-1': CLEARED_1_1 }, { '1': 5 });
  await openGame(page, '/');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__PONCHO__!.level() === '1-2' && !window.__PONCHO__!.titleDrawn().shown && window.__PONCHO__!.ticks() > 5);
  await api(page, () => window.__PONCHO__!.pause(true));
  await walkOnto(page, 760);
  await walkOnto(page, 1592);
  expect(await api(page, () => window.__PONCHO__!.lives())).toBe(7);
  await api(page, () => window.__PONCHO__!.loseLife());
  expect(await api(page, () => window.__PONCHO__!.lives())).toBe(6);
  // The seventh triangle cracks, standing still while paused.
  await page.waitForFunction(() => window.__PONCHO__!.hudCracking().length === 1);
  await quitPaused(page); // the same scene: "Start" plays 1-2
  expect(await api(page, () => window.__PONCHO__!.level())).toBe('1-2');
  expect(await api(page, () => window.__PONCHO__!.lives())).toBe(5);
  expect(await api(page, () => window.__PONCHO__!.hudFilled())).toBe(5);
  // The two triangles the fresh run lacks show no crack, and the crack of the life lost just before is gone.
  expect(await api(page, () => window.__PONCHO__!.hudCracking())).toEqual([]);
});

test('GDD-LIFE-04 a last life kept in the save pulses from the level start, also after quitting to the title', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard test');
  await seed(page, { '1-1': CLEARED_1_1 }, { '1': 1 });
  await openGame(page, '/');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__PONCHO__!.level() === '1-2' && !window.__PONCHO__!.titleDrawn().shown && window.__PONCHO__!.ticks() > 5);
  await api(page, () => window.__PONCHO__!.pause(true));
  expect(await api(page, () => window.__PONCHO__!.lives())).toBe(1);
  // One step at a time until the pulse has grown, in one task: it counts from the level's start, so the steps that ran before the pause
  // decide where a fixed count would land (L-042).
  const grown = await page.evaluate(() => {
    for (let i = 0; i < 48 && (window.__PONCHO__!.hudPulse() ?? 1) <= 1.05; i++) window.__PONCHO__!.step(1);
    return window.__PONCHO__!.hudPulse() ?? 1;
  });
  expect(grown).toBeGreaterThan(1.05);
  await quitPaused(page);
  expect(await api(page, () => window.__PONCHO__!.level())).toBe('1-2');
  expect(await api(page, () => window.__PONCHO__!.lives())).toBe(1);
  // The fresh run's pulse starts at its normal size (GDD-LIFE-04).
  expect(await api(page, () => window.__PONCHO__!.hudPulse())).toBe(1);
});

/** From the opened title: Start by the device's way (Enter on a desktop, a tap off the rows on a phone), and waits until the level plays. */
async function startFromTitle(page: Page, isMobile: boolean): Promise<void> {
  if (isMobile) await tapAt(page, 240, 60, true);
  else await page.keyboard.press('Enter');
  await page.waitForFunction(() => !window.__PONCHO__!.titleDrawn().shown && window.__PONCHO__!.ticks() > 5);
}

test('GDD-UI-02 Start follows the run: after a game over the title is over 1-1', async ({ page, isMobile }) => {
  await seed(page, { '1-1': CLEARED_1_1, '1-2': CLEARED_1_1 }, { '1': 0 }, { '1': '1-1' });
  await openGame(page, '/');
  // 1-2 is cleared, but the run is back at 1-1.
  expect(await api(page, () => window.__PONCHO__!.level())).toBe('1-1');
  expect(await api(page, () => window.__PONCHO__!.lives())).toBe(7);
  expect((await api(page, () => window.__PONCHO__!.titleDrawn())).shown).toBe(true);
  await startFromTitle(page, isMobile);
  expect(await api(page, () => window.__PONCHO__!.level())).toBe('1-1');
  expect(await api(page, () => window.__PONCHO__!.lives())).toBe(7);
});

test('GDD-UI-02 Start follows the run: the run at 1-2 starts 1-2 with its lives', async ({ page, isMobile }) => {
  await seed(page, { '1-1': CLEARED_1_1, '1-2': CLEARED_1_1 }, { '1': 3 }, { '1': '1-2' });
  await openGame(page, '/');
  expect(await api(page, () => window.__PONCHO__!.level())).toBe('1-2');
  expect(await api(page, () => window.__PONCHO__!.lives())).toBe(3);
  expect((await api(page, () => window.__PONCHO__!.titleDrawn())).shown).toBe(true);
  await startFromTitle(page, isMobile);
  expect(await api(page, () => window.__PONCHO__!.level())).toBe('1-2');
  expect(await api(page, () => window.__PONCHO__!.lives())).toBe(3);
});

test('GDD-PRG-02 a clear of 1-1 saves the run at 1-2, and the Siete vidas gastadas screen in 1-2 puts it back at 1-1', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard test');
  await boot(page, '/?level=1-1');
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 5);
  await api(page, () => window.__PONCHO__!.pause(true));
  expect((await stored(page))?.progress.worldAt ?? {}).toEqual({});
  await toExit(page);
  expect((await stored(page))!.progress).toMatchObject({ worldAt: { '1': '1-2' } });
  await page.keyboard.press('Enter', { delay: 30 }); // Next level
  await playingIn(page, '1-2');
  await api(page, () => window.__PONCHO__!.pause(true));
  for (let i = 0; i < 6; i++) await api(page, () => window.__PONCHO__!.loseLife());
  await outOfLives(page);
  expect((await stored(page))!.progress).toMatchObject({ worldAt: { '1': '1-1' }, worldLives: { '1': 0 } });
});

test('GDD-UI-02 where storage is refused, the run of this visit moves on: 1-1, 1-2, 1-3 and 1-4 cleared, a new run, then 1-1 cleared, the title is over 1-2', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard test');
  await refuseStorage(page);
  await boot(page, '/');
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 5);
  await toExit01(page);
  await page.keyboard.press('Enter', { delay: 30 }); // Next level
  await playingIn(page, '1-1');
  await toExit(page);
  await page.keyboard.press('Enter', { delay: 30 }); // Next level
  await playingIn(page, '1-2');
  await toExit(page);
  await page.keyboard.press('Enter', { delay: 30 }); // Next level
  await playingIn(page, '1-3');
  await toExit(page, 128);
  // 1-3 names 1-4 (GDD-BOS-02): the menu opens on Next level, which starts the arena.
  expect((await api(page, () => window.__PONCHO__!.clearDrawn())).menu.chosen).toBe('next');
  await page.keyboard.press('Enter', { delay: 30 });
  await playingIn(page, '1-4');
  await api(page, () => window.__PONCHO__!.pause(true));
  await beatBoss(page);
  // 1-4 ends the run (it is World 1's last level): a new one at 1-1 (the older rule says 1-1 too, all being cleared).
  expect((await api(page, () => window.__PONCHO__!.clearDrawn())).menu.chosen).toBe('retry');
  await page.keyboard.press('ArrowDown');
  await page.waitForFunction(() => window.__PONCHO__!.clearDrawn().menu.chosen === 'quit');
  await page.keyboard.press('Enter', { delay: 30 });
  await page.waitForFunction(() => window.__PONCHO__!.titleDrawn().shown && window.__PONCHO__!.level() === '1-1');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => !window.__PONCHO__!.titleDrawn().shown && window.__PONCHO__!.ticks() > 5);
  await toExit(page);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.waitForFunction(() => window.__PONCHO__!.clearDrawn().menu.chosen === 'quit');
  await page.keyboard.press('Enter', { delay: 30 });
  // The run moved on to 1-2, though all four levels are cleared.
  await page.waitForFunction(() => window.__PONCHO__!.titleDrawn().shown && window.__PONCHO__!.level() === '1-2');
  expect(await api(page, () => window.__PONCHO__!.lives())).toBe(7);
  // The scene of that title knows the run too (this visit's, the storage refusing it): Start plays 1-2.
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => !window.__PONCHO__!.titleDrawn().shown && window.__PONCHO__!.ticks() > 5);
  expect(await api(page, () => window.__PONCHO__!.level())).toBe('1-2');
});

test('GDD-LIFE-05 out of lives in 1-4, the press starts 1-1 at once with seven lives, and the arena is a fresh fight', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard test');
  await boot(page, '/?level=1-4');
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 5);
  await api(page, () => window.__PONCHO__!.pause(true));
  expect(await api(page, () => window.__PONCHO__!.level())).toBe('1-4');
  await api(page, () => window.__PONCHO__!.setBoss(2));
  for (let i = 0; i < 6; i++) await api(page, () => window.__PONCHO__!.loseLife());
  expect(await api(page, () => window.__PONCHO__!.lives())).toBe(1);
  // Standing on the floor at the start, his phase 3 dive reaches Poncho: the last life is lost.
  expect(await stepUntil(page, { phase: 'respawning' }, 700)).toBeLessThan(700);
  expect(await api(page, () => window.__PONCHO__!.lives())).toBe(0);
  await stepUntil(page, { phase: 'gameover' }, 60);
  expect(await api(page, () => window.__PONCHO__!.phase())).toBe('gameover');
  // Saved as the screen comes up: the world's lives spent and its run back at 1-1.
  expect((await stored(page))!.progress).toMatchObject({ worldLives: { '1': 0 }, worldAt: { '1': '1-1' } });
  // The screen stays up until 1-1 starts.
  expect(await pressThrough(page)).toEqual({ phase: 'gameover', level: '1-4' });
  await page.waitForFunction(() => window.__PONCHO__!.level() === '1-1');
  await page.waitForFunction(() => window.__PONCHO__!.phase() === 'playing');
  expect(await api(page, () => window.__PONCHO__!.lives())).toBe(7);
  expect(await api(page, () => window.__PONCHO__!.hudFilled())).toBe(7);
  expect(await api(page, () => window.__PONCHO__!.state())).toMatchObject({ x: 56, y: 224 });
  expect((await api(page, () => window.__PONCHO__!.bossBar())).shown).toBe(false);
  // A later visit to the arena is a fresh fight: all three of his hits, seven lives.
  await openGame(page, '/?level=1-4');
  expect(await api(page, () => window.__PONCHO__!.lives())).toBe(7);
  await page.waitForFunction(() => window.__PONCHO__!.bossBar().pips === 3);
  expect(await api(page, () => window.__PONCHO__!.boss())).toMatchObject({ hits: 0, mode: 'lap' });
});

test('GDD-UI-02 Start follows the run: the run at 1-4 starts the arena with its lives and the boss bar', async ({ page, isMobile }) => {
  await seed(page, { '1-1': CLEARED_1_1, '1-2': CLEARED_1_1, '1-3': CLEARED_1_1 }, { '1': 3 }, { '1': '1-4' });
  await openGame(page, '/');
  expect(await api(page, () => window.__PONCHO__!.level())).toBe('1-4');
  expect(await api(page, () => window.__PONCHO__!.lives())).toBe(3);
  expect((await api(page, () => window.__PONCHO__!.titleDrawn())).shown).toBe(true);
  // The arena is behind the title's veil, with the boss bar under it.
  await page.waitForFunction(() => window.__PONCHO__!.bossBar().shown && window.__PONCHO__!.bossBar().pips === 3);
  await startFromTitle(page, isMobile);
  expect(await api(page, () => window.__PONCHO__!.level())).toBe('1-4');
  expect(await api(page, () => window.__PONCHO__!.lives())).toBe(3);
  expect(await api(page, () => window.__PONCHO__!.hudFilled())).toBe(3);
  expect(await api(page, () => window.__PONCHO__!.bossBar())).toMatchObject({ shown: true, pips: 3 });
});

test('GDD-LIFE-05 out of lives in 1-3, its hilos are saved and the press starts 1-1 at once with seven lives', async ({ page }) => {
  await boot(page, '/?level=1-3');
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 5);
  await api(page, () => window.__PONCHO__!.pause(true));
  expect(await api(page, () => window.__PONCHO__!.level())).toBe('1-3');
  await walkOnto(page, 72); // the hilo at column 4, the second in 1-3's list
  expect((await api(page, () => window.__PONCHO__!.hilos())).taken).toBe(1);
  for (let i = 0; i < 6; i++) await api(page, () => window.__PONCHO__!.loseLife());
  await outOfLives(page, 1672); // the spike at column 104, under the shuttle's first end
  // Saved for good as the screen comes up (user, 2026-11-02: "Keep them"), before any press.
  const saved = (await stored(page))!;
  expect(saved.levels['1-3']).toMatchObject({ cleared: false });
  expect(saved.levels['1-3']!.hilos.slice(0, 2)).toBe('01');
  expect((await api(page, () => window.__PONCHO__!.progress()))['1-3']!.hilos.slice(0, 2)).toEqual([false, true]);
  // The screen stays up until 1-1 starts.
  expect(await pressThrough(page)).toEqual({ phase: 'gameover', level: '1-3' });
  await page.waitForFunction(() => window.__PONCHO__!.level() === '1-1');
  await page.waitForFunction(() => window.__PONCHO__!.phase() === 'playing');
  expect(await api(page, () => window.__PONCHO__!.lives())).toBe(7);
  expect(await api(page, () => window.__PONCHO__!.hudFilled())).toBe(7);
  expect(await api(page, () => window.__PONCHO__!.state())).toMatchObject({ x: 56, y: 224 });
  expect((await api(page, () => window.__PONCHO__!.camera())).viewX).toBe(0);
  expect((await api(page, () => window.__PONCHO__!.titleDrawn())).shown).toBe(false);
});

test('GDD-UI-02 with 1-1 and 1-2 cleared the game opens on the title over 1-3, and Start plays it', async ({ page, isMobile }) => {
  await seed(page, { '1-1': CLEARED_1_1, '1-2': CLEARED_1_1 });
  await openGame(page, '/');
  expect(await api(page, () => window.__PONCHO__!.level())).toBe('1-3');
  expect(await api(page, () => window.__PONCHO__!.titleDrawn())).toMatchObject({ shown: true, menu: { items: ['Start', 'Tutorial', 'Settings'], chosen: 'start' } });
  await startFromTitle(page, isMobile);
  expect(await api(page, () => window.__PONCHO__!.level())).toBe('1-3');
  // The seeded save holds no World 1 lives: the world's seven.
  expect(await api(page, () => window.__PONCHO__!.lives())).toBe(7);
});

test('GDD-LIFE-05 the lives brought from 1-2 into 1-3 are saved, and a new visit Start plays 1-3 with them', async ({ page, isMobile }) => {
  await seed(page, { '1-1': CLEARED_1_1 });
  await boot(page, '/?level=1-2');
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 5);
  await api(page, () => {
    window.__PONCHO__!.loseLife();
    window.__PONCHO__!.loseLife();
  });
  expect(await api(page, () => window.__PONCHO__!.lives())).toBe(5);
  const exit = LEVEL_1_2.exit!;
  await api(page, () => window.__PONCHO__!.pause(true));
  await page.evaluate(([x, y]) => window.__PONCHO__!.teleport(x!, y!), [exit.x, exit.y]);
  await stepUntil(page, { phase: 'clear' }, 30);
  await api(page, () => window.__PONCHO__!.step(61));
  await waitForResults(page);
  expect((await api(page, () => window.__PONCHO__!.clearDrawn())).menu.chosen).toBe('next');
  await page.keyboard.press('Enter', { delay: 30 });
  await page.waitForFunction(() => window.__PONCHO__!.level() === '1-3' && window.__PONCHO__!.ticks() > 10);
  expect(await api(page, () => window.__PONCHO__!.lives())).toBe(5);
  // A new visit, no address: 1-1 was seeded cleared and 1-2 was cleared just now, so the run is at 1-3, with the five.
  await openGame(page, '/');
  expect(await api(page, () => window.__PONCHO__!.level())).toBe('1-3');
  expect(await api(page, () => window.__PONCHO__!.titleDrawn())).toMatchObject({ shown: true, menu: { chosen: 'start' } });
  await startFromTitle(page, isMobile);
  expect(await api(page, () => window.__PONCHO__!.level())).toBe('1-3');
  expect(await api(page, () => window.__PONCHO__!.lives())).toBe(5);
  expect(await api(page, () => window.__PONCHO__!.hudFilled())).toBe(5);
});

test('GDD-LIFE-05 after the last life in 1-3 a new visit Start plays 1-1 with seven, not 1-3', async ({ page, isMobile }) => {
  await seed(page, { '1-1': CLEARED_1_1, '1-2': CLEARED_1_1 });
  await openGame(page, '/');
  expect(await api(page, () => window.__PONCHO__!.level())).toBe('1-3');
  await startFromTitle(page, isMobile);
  await api(page, () => window.__PONCHO__!.pause(true));
  for (let i = 0; i < 6; i++) await api(page, () => window.__PONCHO__!.loseLife());
  await outOfLives(page, 1672);
  // Press nothing: a new visit while the screen is up, the run back at 1-1.
  await openGame(page, '/');
  expect(await api(page, () => window.__PONCHO__!.level())).toBe('1-1');
  expect((await api(page, () => window.__PONCHO__!.titleDrawn())).shown).toBe(true);
  await startFromTitle(page, isMobile);
  expect(await api(page, () => window.__PONCHO__!.level())).toBe('1-1');
  expect(await api(page, () => window.__PONCHO__!.lives())).toBe(7);
  expect(await api(page, () => window.__PONCHO__!.hudFilled())).toBe(7);
});
