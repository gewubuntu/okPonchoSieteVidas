// Screenshots of the settings screen for visual review. Run with `npm run shots`; images land in shots/ (not committed).
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { boot, openGame, start, stepUntil } from '../helpers';

const shot = async (page: Page, info: TestInfo, name: string) => {
  await page.waitForTimeout(150);
  await page.screenshot({ path: `shots/${name}-${info.project.name.replace('shots-', '')}.png` });
};
// A key event on the window, so the phone project, which has a keyboard too, takes the same path.
const press = (page: Page, code: string, keyCode: number) => page.evaluate(({ c, k }) => window.dispatchEvent(new KeyboardEvent('keydown', { code: c, keyCode: k, bubbles: true })), { c: code, k: keyCode });
const chosen = (page: Page, row: string) => page.waitForFunction((r) => window.__PONCHO__!.settingsDrawn().chosen === r, row);

test('GDD-UI-02 the settings screen from the pause menu, after changes, and Back chosen', async ({ page }, info) => {
  await boot(page);
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 10 && window.__PONCHO__!.state().grounded);
  await press(page, 'Escape', 27);
  await page.waitForFunction(() => window.__PONCHO__!.pauseDrawn().shown);
  await press(page, 'ArrowDown', 40);
  await page.waitForFunction(() => window.__PONCHO__!.pauseDrawn().menu.chosen === 'settings');
  await press(page, 'Enter', 13);
  await chosen(page, 'master');
  expect(await page.evaluate(() => window.__PONCHO__!.settingsDrawn())).toMatchObject({ shown: true, from: 'pause', chosen: 'master' });
  await shot(page, info, 'settings-pause-master');
  for (let v = 9; v >= 6; v--) {
    await press(page, 'ArrowLeft', 37);
    await page.waitForFunction((w) => window.__PONCHO__!.settings().master === w, v);
  }
  await press(page, 'ArrowDown', 40);
  await chosen(page, 'effects');
  await shot(page, info, 'settings-pause-changed');
  await press(page, 'ArrowDown', 40);
  await chosen(page, 'language');
  await press(page, 'ArrowDown', 40);
  await chosen(page, 'buttonOpacity');
  await press(page, 'ArrowDown', 40);
  await chosen(page, 'back');
  expect(await page.evaluate(() => window.__PONCHO__!.settings())).toEqual({ master: 6, effects: 10, language: 'en', buttonOpacity: 'medium' });
  await shot(page, info, 'settings-pause-back');
});

test('GDD-UI-02 the settings screen from the title menu', async ({ page }, info) => {
  await openGame(page);
  await press(page, 'ArrowDown', 40); // Start, Tutorial, Settings: two Downs
  await press(page, 'ArrowDown', 40);
  await page.waitForFunction(() => window.__PONCHO__!.titleDrawn().menu.chosen === 'settings');
  await press(page, 'Enter', 13);
  await chosen(page, 'master');
  expect(await page.evaluate(() => window.__PONCHO__!.settingsDrawn())).toMatchObject({ shown: true, from: 'title' });
  await shot(page, info, 'settings-title');
});

test('GDD-UI-02 the settings screen on an upright phone', async ({ page, isMobile }, info) => {
  test.skip(!isMobile, 'touch device only');
  await boot(page);
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 10);
  await press(page, 'Escape', 27);
  await page.waitForFunction(() => window.__PONCHO__!.pauseDrawn().shown);
  await press(page, 'ArrowDown', 40);
  await page.waitForFunction(() => window.__PONCHO__!.pauseDrawn().menu.chosen === 'settings');
  await press(page, 'Enter', 13);
  await chosen(page, 'master');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(() => window.__PONCHO__!.settingsDrawn().prompt === 'Turn your device sideways');
  expect((await page.evaluate(() => window.__PONCHO__!.settingsDrawn())).rows).toEqual([]);
  await shot(page, info, 'settings-portrait');
});

// GDD-UI-02 the Language row: the same screens in Español and Deutsch. The save is seeded so the shot starts in that language, as a
// player's second visit does.
const seed = (page: Page, language: string) =>
  page.addInitScript(([key, text]) => localStorage.setItem(key!, text!), ['poncho-siete-vidas', `{"version":1,"settings":{"master":10,"effects":10,"language":"${language}"},"progress":{"tutorialPlayed":false}}`]);

test('GDD-UI-02 the settings screen in Español and in Deutsch, with Language chosen', async ({ page }, info) => {
  await openGame(page);
  await press(page, 'ArrowDown', 40);
  await press(page, 'ArrowDown', 40);
  await page.waitForFunction(() => window.__PONCHO__!.titleDrawn().menu.chosen === 'settings');
  await press(page, 'Enter', 13);
  await chosen(page, 'master');
  await press(page, 'ArrowDown', 40);
  await press(page, 'ArrowDown', 40);
  await chosen(page, 'language');
  await press(page, 'ArrowRight', 39);
  await page.waitForFunction(() => window.__PONCHO__!.settingsDrawn().title === 'Configuración');
  expect(await page.evaluate(() => window.__PONCHO__!.settingsDrawn())).toMatchObject({ shown: true, from: 'title', chosen: 'language' });
  await shot(page, info, 'language-1-settings-es');
  await press(page, 'ArrowRight', 39);
  await page.waitForFunction(() => window.__PONCHO__!.settingsDrawn().title === 'Einstellungen');
  expect(await page.evaluate(() => window.__PONCHO__!.settingsDrawn())).toMatchObject({ shown: true, from: 'title', chosen: 'language' });
  await shot(page, info, 'language-2-settings-de');
});

test('GDD-UI-02 the title screen in Deutsch', async ({ page }, info) => {
  await seed(page, 'de');
  await openGame(page);
  expect(await page.evaluate(() => window.__PONCHO__!.titleDrawn().menu.items)).toEqual(['Spielen', 'Tutorial', 'Einstellungen']);
  await shot(page, info, 'language-3-title-de');
});

test('GDD-UI-02 the pause menu in Español', async ({ page }, info) => {
  await seed(page, 'es');
  await boot(page);
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 10 && window.__PONCHO__!.state().grounded);
  await press(page, 'Escape', 27);
  await page.waitForFunction(() => window.__PONCHO__!.pauseDrawn().shown);
  expect(await page.evaluate(() => window.__PONCHO__!.pauseDrawn())).toMatchObject({ title: 'Pausa', menu: { items: ['Continuar', 'Configuración', 'Salir al título'] } });
  await shot(page, info, 'language-4-pause-es');
});

test('GDD-UI-05 the first tip of 0-1 in Deutsch', async ({ page, isMobile }, info) => {
  await seed(page, 'de');
  await start(page, isMobile);
  await page.waitForFunction(() => window.__PONCHO__!.tip().alpha === 1);
  expect(await page.evaluate(() => window.__PONCHO__!.tip())).toMatchObject({ index: 0, text: isMobile ? 'Links oder rechts halten zum Laufen' : 'Pfeiltasten oder A/D zum Laufen' });
  await shot(page, info, 'language-5-tip-de');
});

test('GDD-UI-02 the Siete vidas gastadas screen in Español, with its prompt', async ({ page }, info) => {
  await seed(page, 'es');
  await boot(page);
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 10);
  await page.evaluate(() => window.__PONCHO__!.pause(true));
  for (let i = 0; i < 6; i++) await page.evaluate(() => window.__PONCHO__!.loseLife());
  await page.evaluate(() => window.__PONCHO__!.teleport(248, 150)); // into the pit with the last life
  await stepUntil(page, { phase: 'gameover' }, 200);
  await page.evaluate(() => window.__PONCHO__!.step(70, { move: 0, jumpHeld: false }));
  expect(await page.evaluate(() => window.__PONCHO__!.gameOverDrawn())).toMatchObject({ shown: true, subtitle: 'Fin del juego', prompt: true, promptText: 'Presiona cualquier botón para reintentar' });
  await shot(page, info, 'language-6-gameover-es');
});

test('GDD-UI-05 the running jump tip of 0-1 in Español', async ({ page, isMobile }, info) => {
  await seed(page, 'es');
  await start(page, isMobile);
  await page.waitForFunction(() => window.__PONCHO__!.state().grounded);
  const y = await page.evaluate(() => window.__PONCHO__!.state().y);
  await page.evaluate((fy) => window.__PONCHO__!.teleport(56 * 16 + 8, fy), y); // column 56, on the floor past the 3-tile gap (columns 53 to 55)
  await page.waitForFunction(() => window.__PONCHO__!.tip().index === 8 && window.__PONCHO__!.tip().alpha === 1);
  await page.evaluate(() => window.__PONCHO__!.pause(true));
  expect(await page.evaluate(() => window.__PONCHO__!.tip().text)).toBe('Un salto con impulso cruza 3 casillas');
  await shot(page, info, 'language-7-tip-es');
});

// GDD-CTL-03 the touch buttons at Low and at High Button opacity, in play. The setting is changed on the settings screen opened from the
// pause menu, as a player does, and the game resumed before the shot. The desktop draws no touch buttons, so only the phone takes it.
test('GDD-CTL-03 the touch buttons at Low and at High opacity', async ({ page, isMobile }, info) => {
  test.skip(!isMobile, 'the desktop draws no touch buttons');
  await start(page, isMobile);
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 10 && window.__PONCHO__!.state().grounded);
  await press(page, 'Escape', 27);
  await page.waitForFunction(() => window.__PONCHO__!.pauseDrawn().shown);
  await press(page, 'ArrowDown', 40);
  await page.waitForFunction(() => window.__PONCHO__!.pauseDrawn().menu.chosen === 'settings');
  await press(page, 'Enter', 13);
  for (const row of ['master', 'effects', 'language', 'buttonOpacity']) {
    if (row !== 'master') await press(page, 'ArrowDown', 40);
    await chosen(page, row);
  }
  for (const [key, code, name, shotName] of [['ArrowLeft', 37, 'low', 'touch-opacity-1-low'], ['ArrowRight', 39, 'high', 'touch-opacity-2-high']] as const) {
    // Low is one step from Medium; High is two from Low.
    for (let i = 0; i < (name === 'low' ? 1 : 2); i++) await press(page, key, code);
    await page.waitForFunction((o) => window.__PONCHO__!.touch().opacity === o, name);
    await press(page, 'Escape', 27); // back to the pause menu
    await page.waitForFunction(() => !window.__PONCHO__!.settingsDrawn().shown);
    await press(page, 'Escape', 27); // resume
    await page.waitForFunction(() => !window.__PONCHO__!.playerPause().paused);
    expect(await page.evaluate(() => window.__PONCHO__!.touch())).toMatchObject({ visible: true, opacity: name });
    await shot(page, info, shotName);
    if (name === 'low') {
      await press(page, 'Escape', 27);
      await page.waitForFunction(() => window.__PONCHO__!.pauseDrawn().shown);
      await press(page, 'ArrowDown', 40);
      await page.waitForFunction(() => window.__PONCHO__!.pauseDrawn().menu.chosen === 'settings');
      await press(page, 'Enter', 13);
      await chosen(page, 'master');
      for (const row of ['effects', 'language', 'buttonOpacity']) {
        await press(page, 'ArrowDown', 40);
        await chosen(page, row);
      }
    }
  }
});
