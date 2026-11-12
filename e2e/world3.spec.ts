import { expect, test, type Page } from '@playwright/test';
import { TILE } from '../src/config/tuning';
import { LEVEL_3_1, LEVEL_3_1_GROUND, LEVEL_3_1_PITS } from '../src/levels/level3-1';
import { boot, openGame, stepUntil, tapAt } from './helpers';

// World 3, the Sierra (GDD-WLD-16): "Start" playing World 3's run once 2-4 is cleared (GDD-UI-02), the restart at 3-1 with seven after the
// last life (GDD-LIFE-05) and a run in 3-1 saved at an ofrenda and resumed (GDD-PRG-02). 2-4's Next level into 3-1 is in
// `e2e/world2.spec.ts`. Where things are is read from `src/levels/level3-1.ts` (L-062); time in steps (L-042).
const api = <T>(page: Page, fn: () => T) => page.evaluate(fn);
const SAVE_KEY = 'poncho-siete-vidas';
/** The middle of tile column `col`, in px. */
const mid = (col: number) => col * TILE + TILE / 2;
/** The progress the game saved, parsed (L-054). */
const storedProgress = async (page: Page): Promise<{ worldLives: Record<string, number>; worldAt: Record<string, string> }> =>
  JSON.parse((await api(page, () => localStorage.getItem('poncho-siete-vidas')))!).progress;

test('GDD-UI-02 with 2-4 cleared in the save Start plays 3-1', async ({ page, isMobile }) => {
  // A save that has played the tutorial and cleared both worlds' last levels, 1-4 and 2-4, as one that reached 2-4 has (the latest world
  // reached goes world by world, `frontierWorld`; the arenas have no hilos, so their texts are empty), and keeps no World 3 run.
  const arena = { hilos: '', medal: 'gold', bestSteps: 5000, cleared: true };
  const text = JSON.stringify({ version: 1, settings: { master: 10, effects: 10, language: 'en' }, progress: { tutorialPlayed: true, worldLives: { '1': 7, '2': 4 }, worldAt: { '1': '1-1', '2': '2-1' } }, levels: { '1-4': arena, '2-4': arena } });
  await page.addInitScript(([key, value]) => localStorage.setItem(key!, value!), [SAVE_KEY, text]);
  const errors = await openGame(page, '/');
  expect(await api(page, () => window.__PONCHO__!.level())).toBe('3-1');
  expect((await api(page, () => window.__PONCHO__!.titleDrawn())).shown).toBe(true);
  expect(await api(page, () => window.__PONCHO__!.lives())).toBe(7);
  if (isMobile) await tapAt(page, 240, 60, true);
  else await page.keyboard.press('Enter');
  await page.waitForFunction(() => !window.__PONCHO__!.titleDrawn().shown && window.__PONCHO__!.ticks() > 2);
  expect(await api(page, () => window.__PONCHO__!.level())).toBe('3-1');
  expect(await api(page, () => window.__PONCHO__!.lives())).toBe(7);
  expect(await api(page, () => window.__PONCHO__!.state())).toMatchObject({ x: LEVEL_3_1.spawn.x });
  expect(errors).toEqual([]);
});

test('GDD-LIFE-05 the Siete vidas gastadas screen in 3-1 restarts 3-1 with seven', async ({ page }) => {
  await boot(page, '/?level=3-1');
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 5);
  await api(page, () => window.__PONCHO__!.pause(true));
  for (let i = 0; i < 6; i++) await api(page, () => window.__PONCHO__!.loseLife());
  expect(await api(page, () => window.__PONCHO__!.lives())).toBe(1);
  // Dropped over the middle of the first chasm (no enemy near): the last life is lost at its raised bottom.
  const chasm = LEVEL_3_1_PITS[0]!;
  await page.evaluate((x) => window.__PONCHO__!.teleport(x, 150), mid(Math.floor((chasm.col0 + chasm.col1) / 2)));
  expect(await stepUntil(page, { phase: 'respawning' }, 200)).toBeLessThan(200);
  expect(await api(page, () => window.__PONCHO__!.lives())).toBe(0);
  await stepUntil(page, { phase: 'gameover' }, 60);
  expect(await api(page, () => window.__PONCHO__!.phase())).toBe('gameover');
  // Saved as the screen comes up: World 3's lives spent and its run back at 3-1.
  expect(await storedProgress(page)).toMatchObject({ worldLives: { '3': 0 }, worldAt: { '3': '3-1' } });
  // The press after the screen's 1.0 s restarts 3-1 at its start with seven.
  await api(page, () => window.__PONCHO__!.step(61));
  await api(page, () => window.__PONCHO__!.step(1, { move: 0, jumpHeld: true }));
  await page.waitForFunction(() => window.__PONCHO__!.level() === '3-1' && window.__PONCHO__!.phase() !== 'gameover');
  await stepUntil(page, { phase: 'playing' }, 300);
  expect(await api(page, () => window.__PONCHO__!.phase())).toBe('playing');
  expect(await api(page, () => window.__PONCHO__!.lives())).toBe(7);
  expect(await api(page, () => window.__PONCHO__!.state())).toMatchObject({ x: LEVEL_3_1.spawn.x, y: LEVEL_3_1.spawn.y });
});

test('GDD-PRG-02 a run in 3-1 is saved and resumed at its ofrenda', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard test');
  await boot(page, '/?level=3-1');
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 5);
  await api(page, () => window.__PONCHO__!.pause(true));
  // A life lost, then a walk over the first ofrenda from the ground 4 columns before it: the checkpoint moves, and the run is saved.
  await api(page, () => window.__PONCHO__!.loseLife());
  expect(await stepUntil(page, { phase: 'playing' }, 300)).toBeLessThan(300);
  const ofrenda = LEVEL_3_1.ofrendas[0]!;
  const col = Math.floor(ofrenda.x / TILE) - 4;
  const row = LEVEL_3_1_GROUND.find((g) => g.col0 <= col && g.col1 >= col)!.row;
  await page.evaluate(
    ([x, y, to]) => {
      const d = window.__PONCHO__!;
      d.teleport(x!, y! - 1);
      for (let i = 0; i < 120 && d.checkpoint().x !== to; i++) d.step(1, { move: d.state().grounded ? 1 : 0, jumpHeld: false });
      d.step(1);
    },
    [mid(col), row * TILE, ofrenda.x],
  );
  expect(await api(page, () => window.__PONCHO__!.checkpoint())).toEqual({ x: ofrenda.x, y: ofrenda.y });
  const saved: { run: { level: string; checkpoint: number; lives: number } } = JSON.parse((await api(page, () => localStorage.getItem('poncho-siete-vidas')))!);
  // The touch gives back the life lost.
  expect(saved.run).toMatchObject({ level: '3-1', checkpoint: 0, lives: 7 });
  // A new visit to the game: Continue, chosen on the title, resumes it at that ofrenda.
  await openGame(page, '/');
  expect((await api(page, () => window.__PONCHO__!.titleDrawn())).menu.chosen).toBe('continue');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__PONCHO__!.level() === '3-1' && !window.__PONCHO__!.titleDrawn().shown && window.__PONCHO__!.phase() === 'playing');
  expect(await api(page, () => window.__PONCHO__!.state())).toMatchObject({ x: ofrenda.x, y: ofrenda.y });
  expect(await api(page, () => window.__PONCHO__!.lives())).toBe(7);
});
