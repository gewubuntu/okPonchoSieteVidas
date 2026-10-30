import { expect, test, type CDPSession, type Page } from '@playwright/test';
import { TIPS_0_1 } from '../src/levels/level0-1';
import { boot, openGame, start } from './helpers';

// GDD-UI-02 (the Language row, the first language), GDD-UI-05 (the tips in each language), GDD-PRG-02 (the language is saved).
const api = <T>(page: Page, fn: () => T) => page.evaluate(fn);
const frames = (page: Page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null)))));
const settingsDrawn = (page: Page) => api(page, () => window.__PONCHO__!.settingsDrawn());
const SAVE_KEY = 'poncho-siete-vidas';

/** A save in the browser's storage, before the page loads (it is written again on a reload, so tests that reload do not use it). */
const seed = (page: Page, language: string) =>
  page.addInitScript(([key, text]) => localStorage.setItem(key!, text!), [SAVE_KEY, `{"version":1,"settings":{"master":10,"effects":10,"language":"${language}"},"progress":{"tutorialPlayed":false}}`]);

/** A bare browser key event, like the settings specs, so the phone project takes the same path as the desktop one. */
const KEYS = { Escape: 27, Enter: 13, ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40 } as const;
async function press(page: Page, code: keyof typeof KEYS, times = 1): Promise<void> {
  for (let i = 0; i < times; i++) await page.evaluate(([c, k]) => window.dispatchEvent(new KeyboardEvent('keydown', { code: c, keyCode: k, bubbles: true })), [code, KEYS[code]] as const);
}
/** On the title, opens Settings (Down, Down, Enter) and chooses the Language row (two more Downs). */
async function languageRowFromTitle(page: Page): Promise<void> {
  await press(page, 'ArrowDown', 2);
  await page.waitForFunction(() => window.__PONCHO__!.titleDrawn().menu.chosen === 'settings');
  await press(page, 'Enter');
  await page.waitForFunction(() => window.__PONCHO__!.settingsDrawn().shown);
  await press(page, 'ArrowDown', 2);
  await page.waitForFunction(() => window.__PONCHO__!.settingsDrawn().chosen === 'language');
}
const language = (page: Page) => api(page, () => window.__PONCHO__!.settings().language);
/** Presses Right or Left on the Language row and waits for the language. */
async function change(page: Page, key: 'ArrowLeft' | 'ArrowRight', want: string): Promise<void> {
  await press(page, key);
  await page.waitForFunction((w) => window.__PONCHO__!.settings().language === w, want);
}
const titleItems = (page: Page) => api(page, () => window.__PONCHO__!.titleDrawn().menu.items);
const savedLanguage = async (page: Page): Promise<string | undefined> => {
  const text = await api(page, () => localStorage.getItem('poncho-siete-vidas'));
  if (text === null) return undefined;
  const data: { settings: { language: string } } = JSON.parse(text);
  return data.settings.language;
};

// ---- Touch helpers ----
async function tapVirtual(page: Page, x: number, y: number): Promise<void> {
  const box = (await page.locator('canvas').boundingBox())!;
  const k = box.width / 480;
  await page.touchscreen.tap(box.x + x * k, box.y + y * k);
}
async function tapButton(page: Page, id: string): Promise<void> {
  const b = (await api(page, () => window.__PONCHO__!.touch())).buttons.find((x) => x.id === id)!;
  await tapVirtual(page, b.x + b.w / 2, b.y + b.h / 2);
}
/** Real touch events through the browser, so a finger can stay down across frames (L-032). Virtual px in. */
async function touchAt(page: Page, cdp: CDPSession, type: 'touchStart' | 'touchEnd', points: { x: number; y: number; id: number }[]): Promise<void> {
  const box = (await page.locator('canvas').boundingBox())!;
  const k = box.width / 480;
  await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchStart' ? points.map((p) => ({ id: p.id, x: box.x + p.x * k, y: box.y + p.y * k })) : [] });
}
const languageRow = async (page: Page) => (await api(page, () => window.__PONCHO__!.settingsMenu())).find((r) => r.item === 'language')!;

test('GDD-UI-02 the Language row switches every settings text at once', async ({ page }) => {
  await openGame(page);
  await languageRowFromTitle(page);
  expect(await settingsDrawn(page)).toMatchObject({ title: 'Settings', chosen: 'language' });
  await change(page, 'ArrowRight', 'es');
  const es = await settingsDrawn(page);
  expect(es.title).toBe('Configuración');
  expect(es.rows.map((r) => r.label)).toEqual(['Volumen general', 'Volumen de efectos', 'Idioma', 'Volver']);
  expect(es.rows[2]).toMatchObject({ item: 'language', value: 'Español' });
  // The name stands where a volume row's bars are: the middle of the 68 px span that ends 20 px inside a row at x 110 and 260 wide.
  expect(es.rows[2]!.valueX).toBe(316);
  expect(es.chosen).toBe('language');
  await change(page, 'ArrowRight', 'de');
  const de = await settingsDrawn(page);
  expect(de.title).toBe('Einstellungen');
  expect(de.rows.map((r) => r.label)).toEqual(['Gesamtlautstärke', 'Effektlautstärke', 'Sprache', 'Zurück']);
  expect(de.rows[2]).toMatchObject({ value: 'Deutsch', valueX: 316 });
  expect(de.chosen).toBe('language');
  await press(page, 'ArrowRight'); // Deutsch is the last: no wrap-around
  await frames(page);
  await frames(page);
  expect(await language(page)).toBe('de');
  expect((await settingsDrawn(page)).title).toBe('Einstellungen');
  await change(page, 'ArrowLeft', 'es');
  await change(page, 'ArrowLeft', 'en');
  const en = await settingsDrawn(page);
  expect(en.title).toBe('Settings');
  expect(en.rows.map((r) => r.label)).toEqual(['Master volume', 'Effects volume', 'Language', 'Back']);
  expect(en.rows[2]).toMatchObject({ value: 'English', valueX: 316 });
});

test('GDD-UI-02 a language change plays no sound and is saved', async ({ page }) => {
  await openGame(page);
  await languageRowFromTitle(page);
  expect(await api(page, () => window.__PONCHO__!.sfxPlayed())).toEqual([]);
  await change(page, 'ArrowRight', 'es');
  await frames(page);
  await frames(page);
  expect(await api(page, () => window.__PONCHO__!.sfxPlayed())).toHaveLength(0);
  expect(await savedLanguage(page)).toBe('es');
  // A volume change still plays the jump sound.
  await press(page, 'ArrowUp');
  await page.waitForFunction(() => window.__PONCHO__!.settingsDrawn().chosen === 'effects');
  await press(page, 'ArrowLeft');
  await page.waitForFunction(() => window.__PONCHO__!.sfxPlayed().length === 1);
  expect((await api(page, () => window.__PONCHO__!.sfxPlayed()))[0]).toMatchObject({ key: 'sfx-jump' });
  expect(await savedLanguage(page)).toBe('es');
});

test('GDD-UI-02 the title and pause menus in the chosen language', async ({ page }) => {
  await openGame(page);
  await languageRowFromTitle(page);
  await change(page, 'ArrowRight', 'es');
  await change(page, 'ArrowRight', 'de');
  await press(page, 'Escape'); // back to the title, Settings chosen
  await page.waitForFunction(() => !window.__PONCHO__!.settingsDrawn().shown && window.__PONCHO__!.titleDrawn().shown);
  expect(await api(page, () => window.__PONCHO__!.titleDrawn())).toMatchObject({ title: 'PONCHO', subtitle: 'Siete Vidas', menu: { items: ['Spielen', 'Tutorial', 'Einstellungen'] } });
  await press(page, 'ArrowUp', 2);
  await page.waitForFunction(() => window.__PONCHO__!.titleDrawn().menu.chosen === 'start');
  await press(page, 'Enter');
  await page.waitForFunction(() => !window.__PONCHO__!.titleDrawn().shown && window.__PONCHO__!.ticks() > 5);
  await press(page, 'Escape');
  await page.waitForFunction(() => window.__PONCHO__!.pauseDrawn().shown);
  expect(await api(page, () => window.__PONCHO__!.pauseDrawn())).toMatchObject({ title: 'Pause', menu: { items: ['Weiter', 'Einstellungen', 'Zurück zum Titel'] } });
});

test('GDD-UI-02 the saved language is used on the next visit', async ({ page }) => {
  await openGame(page);
  expect(await titleItems(page)).toEqual(['Start', 'Tutorial', 'Settings']);
  await languageRowFromTitle(page);
  await change(page, 'ArrowRight', 'es');
  await page.reload();
  await page.waitForFunction(() => window.__PONCHO__ !== undefined);
  expect(await titleItems(page)).toEqual(['Jugar', 'Tutorial', 'Configuración']);
});

// The first visit: the browser's languages decide (Playwright's `locale` sets navigator.languages), until something is saved.
test.describe('GDD-UI-02 the first visit takes the browser\'s language', () => {
  test.describe('de-DE', () => {
    test.use({ locale: 'de-DE' });
    test('GDD-UI-02 a German browser opens in Deutsch', async ({ page }) => {
      await openGame(page);
      expect(await titleItems(page)).toEqual(['Spielen', 'Tutorial', 'Einstellungen']);
      expect(await language(page)).toBe('de');
    });
    test('GDD-UI-02 a saved language wins over the browser\'s', async ({ page }) => {
      await page.addInitScript(([key, text]) => localStorage.setItem(key!, text!), [SAVE_KEY, '{"version":1,"settings":{"master":4,"effects":6,"language":"es"}}']);
      await openGame(page);
      expect(await titleItems(page)).toEqual(['Jugar', 'Tutorial', 'Configuración']);
      expect(await api(page, () => window.__PONCHO__!.settings())).toEqual({ master: 4, effects: 6, language: 'es' });
    });
  });
  test.describe('es-MX', () => {
    test.use({ locale: 'es-MX' });
    test('GDD-UI-02 a Mexican Spanish browser opens in Español', async ({ page }) => {
      await openGame(page);
      expect(await titleItems(page)).toEqual(['Jugar', 'Tutorial', 'Configuración']);
    });
  });
  // GDD-UI-02: the browser's languages, in its order (navigator.languages), else its one language.
  test.describe('en-US', () => {
    test('GDD-UI-02 the first of the browser\'s languages that is en, es or de decides', async ({ page }) => {
      await page.addInitScript(() => Object.defineProperty(navigator, 'languages', { value: ['fr-FR', 'de-AT', 'es'], configurable: true }));
      await openGame(page);
      expect(await titleItems(page)).toEqual(['Spielen', 'Tutorial', 'Einstellungen']);
    });
    test('GDD-UI-02 with no list of languages the browser\'s one language decides', async ({ page }) => {
      await page.addInitScript(() => {
        Object.defineProperty(navigator, 'languages', { value: [], configurable: true });
        Object.defineProperty(navigator, 'language', { value: 'es-ES', configurable: true });
      });
      await openGame(page);
      expect(await titleItems(page)).toEqual(['Jugar', 'Tutorial', 'Configuración']);
    });
  });
  test.describe('de-DE with storage refused', () => {
    test.use({ locale: 'de-DE' });
    test('GDD-UI-02 where storage is refused the browser\'s language is used', async ({ page }) => {
      await page.addInitScript(() => {
        Storage.prototype.getItem = () => { throw new Error('storage refused'); };
        Storage.prototype.setItem = () => { throw new Error('storage refused'); };
      });
      await openGame(page);
      expect(await titleItems(page)).toEqual(['Spielen', 'Tutorial', 'Einstellungen']);
    });
  });
  test.describe('fr-FR', () => {
    test.use({ locale: 'fr-FR' });
    test('GDD-UI-02 a French browser opens in English', async ({ page }) => {
      await openGame(page);
      expect(await titleItems(page)).toEqual(['Start', 'Tutorial', 'Settings']);
      expect(await language(page)).toBe('en');
    });
  });
});

test('GDD-UI-02 the texts are in the saved language from the moment the scene is made', async ({ page }) => {
  await seed(page, 'de');
  // The title's texts as the debug hook first exists, which is the end of the scene's create(), before its first frame.
  await page.addInitScript(() => {
    let hook: Window['__PONCHO__'];
    Object.defineProperty(window, '__PONCHO__', {
      configurable: true,
      get: () => hook,
      set: (v: Window['__PONCHO__']) => {
        if (hook === undefined && v !== undefined) Reflect.set(window, '__firstItems', v.titleDrawn().menu.items);
        hook = v;
      },
    });
  });
  await openGame(page);
  expect(await page.evaluate(() => Reflect.get(window, '__firstItems'))).toEqual(['Spielen', 'Tutorial', 'Einstellungen']);
});

test('GDD-UI-02 the game over and level clear screens in the chosen language', async ({ page }) => {
  await seed(page, 'de');
  await boot(page);
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 5);
  for (let i = 0; i < 6; i++) await page.evaluate(() => window.__PONCHO__!.loseLife());
  await page.evaluate(() => window.__PONCHO__!.teleport(248, 150));
  await page.waitForFunction(() => window.__PONCHO__!.phase() === 'gameover');
  await page.waitForFunction(() => window.__PONCHO__!.gameOverDrawn().prompt);
  expect(await api(page, () => window.__PONCHO__!.gameOverDrawn())).toEqual({
    shown: true,
    title: 'Siete vidas gastadas',
    subtitle: 'Spiel vorbei',
    prompt: true,
    promptText: 'Drücke eine Taste für einen neuen Versuch',
  });
  // The level clear screen, in 0-1.
  await page.goto('/?level=0-1');
  await page.waitForFunction(() => window.__PONCHO__ !== undefined);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => !window.__PONCHO__!.titleDrawn().shown && window.__PONCHO__!.ticks() > 5);
  await page.evaluate(() => window.__PONCHO__!.teleport(1400, 224));
  await page.waitForFunction(() => window.__PONCHO__!.phase() === 'clear' && window.__PONCHO__!.clearDrawn().prompt);
  const clear = await api(page, () => window.__PONCHO__!.clearDrawn());
  expect(clear).toMatchObject({ shown: true, title: 'Level geschafft!', prompt: true, promptText: 'Drücke eine Taste' });
  expect(clear.hilos.startsWith('Hilos ')).toBe(true);
});

test('GDD-UI-05 the tips in the chosen language', async ({ page, isMobile }) => {
  await seed(page, 'es');
  await start(page, isMobile);
  await page.waitForFunction(() => window.__PONCHO__!.tip().alpha === 1);
  expect(await api(page, () => window.__PONCHO__!.tip())).toMatchObject(
    isMobile ? { text: 'Mantén izquierda o derecha para correr', device: 'touch' } : { text: 'Flechas o A/D para correr', device: 'keyboard' },
  );
});

test('GDD-UI-05 every tip fits two lines in every language', async ({ page, isMobile }) => {
  test.skip(isMobile, 'the wrapping does not depend on the viewport');
  await openGame(page);
  for (const [i, tip] of TIPS_0_1.entries()) {
    for (const lang of ['en', 'es', 'de'] as const) {
      for (const device of ['keyboard', 'touch', 'pad'] as const) {
        const text = tip.text[lang][device];
        const lines = await page.evaluate((t) => window.__PONCHO__!.wrapTip(t), text);
        const label = `tip ${i + 1} ${lang} ${device}: ${text}`;
        expect(lines.join(' ').replace(/\s+/g, ' ').trim(), label).toBe(text); // the lines are the tip's words
        expect(lines.length, label).toBeLessThanOrEqual(2);
      }
    }
  }
  // The hook really wraps: a text well past the 280 px wrap width comes back as two lines.
  const long = await page.evaluate((t) => window.__PONCHO__!.wrapTip(t), 'Ofrendas sind Kontrollpunkte. Die erste Berührung gibt ein Leben zurück');
  expect(long).toHaveLength(2);
});

test('GDD-UI-02 the upright prompt in the chosen language', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'touch device only');
  await seed(page, 'es');
  await openGame(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(() => window.__PONCHO__!.titleDrawn().prompt === 'Gira tu dispositivo de lado');
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForFunction(() => window.__PONCHO__!.titleDrawn().prompt === '' && window.__PONCHO__!.titleDrawn().menu.shown);
  await press(page, 'Enter'); // Start
  await page.waitForFunction(() => !window.__PONCHO__!.titleDrawn().shown && window.__PONCHO__!.ticks() > 5);
  await press(page, 'Escape');
  await page.waitForFunction(() => window.__PONCHO__!.pauseDrawn().menu.shown);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(() => window.__PONCHO__!.pauseDrawn().prompt === 'Gira tu dispositivo de lado');
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForFunction(() => window.__PONCHO__!.pauseDrawn().menu.shown);
  await press(page, 'ArrowDown');
  await press(page, 'Enter'); // Configuración
  await page.waitForFunction(() => window.__PONCHO__!.settingsDrawn().shown);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(() => window.__PONCHO__!.settingsDrawn().prompt === 'Gira tu dispositivo de lado');
});

test('GDD-UI-02 a tap on the Language row\'s halves', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'touch device only');
  await openGame(page);
  const settingsRow = (await api(page, () => window.__PONCHO__!.titleMenu())).find((r) => r.item === 'settings')!;
  await tapVirtual(page, settingsRow.x + settingsRow.w / 2, settingsRow.y + settingsRow.h / 2);
  await page.waitForFunction(() => window.__PONCHO__!.settingsDrawn().shown);
  const row = await languageRow(page);
  const left = () => tapVirtual(page, row.x + row.w * 0.25, row.y + row.h / 2);
  const right = () => tapVirtual(page, row.x + row.w * 0.75, row.y + row.h / 2);
  // A tap on the left half at English chooses the row and changes nothing.
  await left();
  await page.waitForFunction(() => window.__PONCHO__!.settingsDrawn().chosen === 'language');
  await frames(page);
  expect(await language(page)).toBe('en');
  await right();
  await page.waitForFunction(() => window.__PONCHO__!.settings().language === 'es');
  await right();
  await page.waitForFunction(() => window.__PONCHO__!.settings().language === 'de');
  await left();
  await page.waitForFunction(() => window.__PONCHO__!.settings().language === 'es');
  await left();
  await page.waitForFunction(() => window.__PONCHO__!.settings().language === 'en');
});

test('GDD-UI-02 a finger held on the Language row moves the language once and steers nothing after the resume', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'touch device only');
  await seed(page, 'de');
  await boot(page);
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 10 && window.__PONCHO__!.state().grounded);
  const cdp = await page.context().newCDPSession(page);
  const sw = (await api(page, () => window.__PONCHO__!.touch())).buttons.find((b) => b.id === 'mode')!;
  await touchAt(page, cdp, 'touchStart', [{ x: sw.x + sw.w / 2, y: sw.y + sw.h / 2, id: 9 }]);
  await touchAt(page, cdp, 'touchEnd', []);
  await page.waitForFunction(() => window.__PONCHO__!.touch().mode === 'stick');
  await tapButton(page, 'pause');
  await page.waitForFunction(() => window.__PONCHO__!.pauseDrawn().menu.shown);
  const settingsItem = (await api(page, () => window.__PONCHO__!.pauseMenu())).find((x) => x.item === 'settings')!;
  await tapVirtual(page, settingsItem.x + settingsItem.w / 2, settingsItem.y + settingsItem.h / 2);
  await page.waitForFunction(() => window.__PONCHO__!.settingsDrawn().shown);
  const x0 = (await api(page, () => window.__PONCHO__!.state())).x;
  // On the Language row's left half, inside the lower left quarter the slide stick reads (x < 240, y >= 135 on the phone's rows).
  const row = await languageRow(page);
  expect(row.y).toBeGreaterThanOrEqual(135);
  await touchAt(page, cdp, 'touchStart', [{ x: 150, y: row.y + row.h / 2, id: 1 }]);
  await page.waitForFunction(() => window.__PONCHO__!.settings().language === 'es'); // de to es: a tap on the row
  for (let i = 0; i < 10; i++) await frames(page);
  expect(await language(page)).toBe('es'); // held for many frames, it moved once
  await press(page, 'Escape'); // leave settings
  await page.waitForFunction(() => !window.__PONCHO__!.settingsDrawn().shown);
  await press(page, 'Escape'); // resume
  await page.waitForFunction(() => !window.__PONCHO__!.playerPause().paused);
  const t = await api(page, () => window.__PONCHO__!.ticks());
  await page.waitForFunction((t0) => window.__PONCHO__!.ticks() > t0 + 20, t);
  expect((await api(page, () => window.__PONCHO__!.state())).x).toBe(x0); // 20 steps with the finger down, none moved him
  expect((await api(page, () => window.__PONCHO__!.touch())).stick).toBe(0);
  expect(await language(page)).toBe('es');
  await touchAt(page, cdp, 'touchEnd', []);
});

// GDD-CTL-02: the fake standard gamepad of e2e/gamepad.spec.ts.
interface FakePad {
  buttons: { pressed: boolean; touched: boolean; value: number }[];
  axes: number[];
}
declare global {
  interface Window {
    __langPad?: FakePad;
  }
}
const DOWN = 13;
const RIGHT = 15;
const SOUTH = 0;
async function withPad(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const pad = {
      id: 'fake',
      index: 0,
      connected: true,
      mapping: 'standard',
      timestamp: 0,
      buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })),
      axes: [0, 0, 0, 0],
    };
    window.__langPad = pad;
    Object.defineProperty(navigator, 'getGamepads', { value: () => [pad], configurable: true });
  });
}
async function padTap(page: Page, i: number): Promise<void> {
  const set = (down: boolean) =>
    page.evaluate(
      ([b, d]) => {
        const button = window.__langPad!.buttons[b]!;
        button.pressed = d;
        button.value = d ? 1 : 0;
      },
      [i, down] as const,
    );
  await set(true);
  await page.waitForTimeout(100);
  await set(false);
  await page.waitForTimeout(100);
}

test('GDD-UI-02 the gamepad changes the language', async ({ page, isMobile }) => {
  test.skip(isMobile, 'gamepad test');
  await withPad(page);
  await openGame(page);
  await padTap(page, DOWN);
  await padTap(page, DOWN);
  await page.waitForFunction(() => window.__PONCHO__!.titleDrawn().menu.chosen === 'settings');
  await padTap(page, SOUTH);
  await page.waitForFunction(() => window.__PONCHO__!.settingsDrawn().shown);
  await padTap(page, DOWN);
  await padTap(page, DOWN);
  await page.waitForFunction(() => window.__PONCHO__!.settingsDrawn().chosen === 'language');
  await padTap(page, RIGHT);
  await page.waitForFunction(() => window.__PONCHO__!.settings().language === 'es');
  expect((await settingsDrawn(page)).title).toBe('Configuración');
});

// GDD-UI-02, GDD-PRG-02: where the browser refuses storage a new scene keeps this visit's language like the volumes (L-049).
const refuseStorage = (page: Page) =>
  page.addInitScript(() => {
    Storage.prototype.getItem = () => { throw new Error('storage refused'); };
    Storage.prototype.setItem = () => { throw new Error('storage refused'); };
  });

test('GDD-UI-02 the next level keeps the language where storage is refused', async ({ page }) => {
  await refuseStorage(page);
  await openGame(page, '/');
  await languageRowFromTitle(page);
  await change(page, 'ArrowRight', 'es');
  await change(page, 'ArrowRight', 'de');
  await press(page, 'Escape');
  await press(page, 'ArrowUp', 2);
  await page.waitForFunction(() => window.__PONCHO__!.titleDrawn().menu.chosen === 'start');
  await press(page, 'Enter');
  await page.waitForFunction(() => !window.__PONCHO__!.titleDrawn().shown && window.__PONCHO__!.ticks() > 5);
  await page.evaluate(() => window.__PONCHO__!.teleport(1400, 224));
  await page.waitForFunction(() => window.__PONCHO__!.phase() === 'clear' && window.__PONCHO__!.clearDrawn().prompt);
  expect((await api(page, () => window.__PONCHO__!.clearDrawn())).title).toBe('Level geschafft!');
  await page.keyboard.press('KeyX', { delay: 30 });
  await page.waitForFunction(() => window.__PONCHO__!.level() === '1-1' && window.__PONCHO__!.ticks() > 5);
  expect(await language(page)).toBe('de');
  await press(page, 'Escape');
  await page.waitForFunction(() => window.__PONCHO__!.pauseDrawn().shown);
  expect((await api(page, () => window.__PONCHO__!.pauseDrawn())).menu.items).toEqual(['Weiter', 'Einstellungen', 'Zurück zum Titel']);
});

test('GDD-UI-02 a title over another level keeps the language where storage is refused', async ({ page }) => {
  await refuseStorage(page);
  await openGame(page, '/');
  await languageRowFromTitle(page);
  await change(page, 'ArrowRight', 'es');
  await change(page, 'ArrowRight', 'de');
  await press(page, 'Escape');
  await press(page, 'ArrowUp', 2);
  await page.waitForFunction(() => window.__PONCHO__!.titleDrawn().menu.chosen === 'start');
  await press(page, 'Enter');
  await page.waitForFunction(() => !window.__PONCHO__!.titleDrawn().shown && window.__PONCHO__!.ticks() > 5);
  await press(page, 'Escape');
  await page.waitForFunction(() => window.__PONCHO__!.pauseDrawn().shown);
  await press(page, 'ArrowDown', 2);
  await page.waitForFunction(() => window.__PONCHO__!.pauseDrawn().menu.chosen === 'quit');
  await press(page, 'Enter');
  // The tutorial has started, so the title comes back over 1-1, a new scene.
  await page.waitForFunction(() => window.__PONCHO__!.titleDrawn().shown && window.__PONCHO__!.level() === '1-1');
  expect(await language(page)).toBe('de');
  expect(await titleItems(page)).toEqual(['Spielen', 'Tutorial', 'Einstellungen']);
});
