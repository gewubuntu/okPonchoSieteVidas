import { expect, test, type Page } from '@playwright/test';
import { boot, openGame, resultsRowCentre, waitForResults } from './helpers';

// L-006: a tap whose press and release land in one frame must still reach a simulation step. The events are dispatched in
// one task, so the browser cannot show a frame in between.
const api = <T>(page: Page, fn: () => T) => page.evaluate(fn);

const tapKey = (page: Page, code: string, keyCode: number, times: number) =>
  page.evaluate(
    async ({ c, k, n }) => {
      for (let i = 0; i < n; i++) {
        window.dispatchEvent(new KeyboardEvent('keydown', { code: c, keyCode: k, bubbles: true }));
        window.dispatchEvent(new KeyboardEvent('keyup', { code: c, keyCode: k, bubbles: true }));
        await new Promise((r) => setTimeout(r, 400)); // clear of the 0.25 s claw cooldown
      }
    },
    { c: code, k: keyCode, n: times },
  );

test('GDD-CTL-01 a real keyboard press of X and of J swings the claw', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard test');
  await boot(page);
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 10);
  await page.keyboard.press('KeyX', { delay: 60 });
  await page.waitForFunction(() => window.__PONCHO__!.swings() === 1);
  await afterSwing(page, 1);
  await page.keyboard.press('KeyJ', { delay: 60 });
  await page.waitForFunction(() => window.__PONCHO__!.swings() === 2);
});

/**
 * Waits for swing number `n` and then for its wind-up, swing and cooldown counted in steps, so the next tap is clear of the
 * cooldown however slow the frames are (GDD-CMB-02: 2, 3 and 15 steps, and one more). Wall time is not enough on a slow runner (L-042).
 */
async function afterSwing(page: Page, n: number): Promise<void> {
  await page.waitForFunction((k) => window.__PONCHO__!.swings() === k, n);
  const t0 = await api(page, () => window.__PONCHO__!.ticks());
  await page.waitForFunction((t) => window.__PONCHO__!.ticks() >= t, t0 + 21);
}

test('L-006 a claw tap shorter than one frame still swings, every time', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard test');
  test.setTimeout(90_000); // ten taps, each waiting for its swing and cooldown in steps
  await boot(page);
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 10);
  for (let i = 0; i < 6; i++) {
    await tapKey(page, 'KeyX', 88, 1);
    await afterSwing(page, i + 1);
  }
  for (let i = 0; i < 4; i++) {
    await tapKey(page, 'KeyJ', 74, 1);
    await afterSwing(page, 7 + i);
  }
  expect(await api(page, () => window.__PONCHO__!.swings())).toBe(10);
});

test('L-006 a jump tap shorter than one frame still makes Poncho jump', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard test');
  await boot(page);
  await page.evaluate(() => window.__PONCHO__!.teleport(280, 224));
  await page.waitForFunction(() => window.__PONCHO__!.state().grounded);
  await page.evaluate(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', keyCode: 32, bubbles: true }));
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space', keyCode: 32, bubbles: true }));
  });
  await page.waitForFunction(() => !window.__PONCHO__!.state().grounded);
  expect(await api(page, () => window.__PONCHO__!.peakRise())).toBeGreaterThanOrEqual(0);
});

test('GDD-UI-02 a Space tap inside one task starts the level (L-006)', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard test');
  await openGame(page);
  await tapKey(page, 'Space', 32, 1);
  await page.waitForFunction(() => !window.__PONCHO__!.titleDrawn().shown);
});

test('GDD-UI-02 a Left, Right, claw or Fuego tap inside one task starts the level from the title (L-006)', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard test');
  for (const [code, keyCode] of [['ArrowLeft', 37], ['ArrowRight', 39], ['KeyX', 88], ['KeyC', 67]] as const) {
    await openGame(page);
    await tapKey(page, code, keyCode, 1);
    await page.waitForFunction(() => !window.__PONCHO__!.titleDrawn().shown);
  }
});

test('GDD-UI-02 on the title, two Downs and Enter tapped inside one task open the settings screen, and a Left tap there lowers a volume and starts nothing', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard test');
  await openGame(page);
  await page.evaluate(() => {
    for (const [code, keyCode] of [['ArrowDown', 40], ['ArrowDown', 40], ['Enter', 13], ['ArrowLeft', 37]] as const) {
      window.dispatchEvent(new KeyboardEvent('keydown', { code, keyCode, bubbles: true }));
      window.dispatchEvent(new KeyboardEvent('keyup', { code, keyCode, bubbles: true }));
    }
  });
  await page.waitForFunction(() => window.__PONCHO__!.settings().master === 9);
  expect(await api(page, () => window.__PONCHO__!.settingsDrawn())).toMatchObject({ shown: true, from: 'title', chosen: 'master' });
  await page.waitForTimeout(250);
  expect(await api(page, () => window.__PONCHO__!.ticks())).toBe(0);
});

test('GDD-UI-02 an Enter tap inside one task starts the level (L-006)', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard test');
  await openGame(page);
  await tapKey(page, 'Enter', 13, 1);
  await page.waitForFunction(() => !window.__PONCHO__!.titleDrawn().shown);
});

/** Where the centre of a touch button is on the page, in CSS px. */
async function buttonCentre(page: Page, id: 'claw' | 'jump' | 'left' | 'right') {
  const b = (await api(page, () => window.__PONCHO__!.touch())).buttons.find((x) => x.id === id)!;
  const box = (await page.locator('canvas').boundingBox())!;
  const k = box.width / 480;
  return { x: box.x + (b.x + b.w / 2) * k, y: box.y + (b.y + b.h / 2) * k };
}

/** A touch that starts and ends in one task, so no frame runs while the finger is down. */
const tapTouch = (page: Page, at: { x: number; y: number }) =>
  page.evaluate(({ x, y }) => {
    const target = document.querySelector('canvas')!;
    const touch = new Touch({ identifier: 7, target, clientX: x, clientY: y, pageX: x, pageY: y, screenX: x, screenY: y });
    const init = { bubbles: true, cancelable: true, touches: [touch], targetTouches: [touch], changedTouches: [touch] };
    target.dispatchEvent(new TouchEvent('touchstart', init));
    target.dispatchEvent(new TouchEvent('touchend', { ...init, touches: [], targetTouches: [] }));
  }, at);

test('L-006 a touch tap on the Claw button shorter than one frame still swings', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'touch device only');
  await boot(page);
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 10);
  const claw = await buttonCentre(page, 'claw');
  for (let i = 0; i < 4; i++) {
    await tapTouch(page, claw);
    await afterSwing(page, i + 1);
  }
  expect(await api(page, () => window.__PONCHO__!.swings())).toBe(4);
});

test('L-006 a touch tap on the Jump button shorter than one frame still makes Poncho jump', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'touch device only');
  await boot(page);
  await page.evaluate(() => window.__PONCHO__!.teleport(280, 224));
  await page.waitForFunction(() => window.__PONCHO__!.state().grounded);
  await tapTouch(page, await buttonCentre(page, 'jump'));
  await page.waitForFunction(() => !window.__PONCHO__!.state().grounded);
});

test('GDD-CTL-01 a real keyboard press of C and of K spits a fireball, and a tap inside one frame does too', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard test');
  await boot(page);
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 10);
  await page.evaluate(() => window.__PONCHO__!.setPower('fuego'));
  await page.keyboard.press('KeyC', { delay: 60 });
  await page.waitForFunction(() => window.__PONCHO__!.spits() === 1);
  await page.waitForTimeout(1500); // let it fly into a wall and vanish
  await page.keyboard.press('KeyK', { delay: 60 });
  await page.waitForFunction(() => window.__PONCHO__!.spits() === 2);
  await page.waitForTimeout(1500);
  await tapKey(page, 'KeyC', 67, 1);
  expect(await api(page, () => window.__PONCHO__!.spits())).toBe(3);
  await page.waitForTimeout(1500);
  await tapKey(page, 'KeyK', 75, 1);
  expect(await api(page, () => window.__PONCHO__!.spits())).toBe(4);
});

test('GDD-PWR-03 the Fuego button shows only in Fuego, and a touch tap inside one frame spits', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'touch device only');
  await boot(page);
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 10);
  expect((await api(page, () => window.__PONCHO__!.touch())).buttons.some((b) => b.id === 'fuego')).toBe(false);
  await page.evaluate(() => window.__PONCHO__!.setPower('taco'));
  await page.waitForTimeout(150);
  expect((await api(page, () => window.__PONCHO__!.touch())).buttons.some((b) => b.id === 'fuego')).toBe(false);
  await page.evaluate(() => window.__PONCHO__!.setPower('fuego'));
  await page.waitForFunction(() => window.__PONCHO__!.touch().buttons.some((b) => b.id === 'fuego'));
  const b = (await api(page, () => window.__PONCHO__!.touch())).buttons.find((x) => x.id === 'fuego')!;
  const box = (await page.locator('canvas').boundingBox())!;
  const k = box.width / 480;
  expect(b.w * k).toBeGreaterThanOrEqual(48);
  const centre = { x: box.x + (b.x + b.w / 2) * k, y: box.y + (b.y + b.h / 2) * k };
  await tapTouch(page, centre);
  await page.waitForFunction(() => window.__PONCHO__!.spits() === 1);
  await page.waitForTimeout(500);
  await tapTouch(page, centre); // a second tap: the first one's latch must have been spent
  await page.waitForFunction(() => window.__PONCHO__!.spits() === 2);
  await page.evaluate(() => window.__PONCHO__!.setPower('taco'));
  await page.waitForFunction(() => !window.__PONCHO__!.touch().buttons.some((x) => x.id === 'fuego'));
});

/** GDD-LIFE-05: loses the last life and waits until the Siete vidas gastadas screen takes presses. */
async function onGameOver(page: Page): Promise<void> {
  await boot(page);
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 10);
  for (let i = 0; i < 6; i++) await page.evaluate(() => window.__PONCHO__!.loseLife());
  await page.evaluate(() => window.__PONCHO__!.teleport(248, 150));
  await page.waitForFunction(() => window.__PONCHO__!.gameOverDrawn().prompt);
}

for (const [code, keyCode] of [['ArrowLeft', 37], ['ArrowRight', 39], ['KeyX', 88], ['KeyC', 67]] as const) {
  test(`GDD-LIFE-05 a ${code} tap inside one frame ends the Siete vidas gastadas screen`, async ({ page, isMobile }) => {
    test.skip(isMobile, 'keyboard test');
    await onGameOver(page);
    await tapKey(page, code, keyCode, 1);
    await page.waitForFunction(() => window.__PONCHO__!.phase() !== 'gameover');
    expect(await api(page, () => window.__PONCHO__!.lives())).toBe(7);
  });
}

for (const id of ['left', 'right', 'claw'] as const) {
  test(`GDD-LIFE-05 a touch tap on ${id} inside one frame ends the Siete vidas gastadas screen`, async ({ page, isMobile }) => {
    test.skip(!isMobile, 'touch device only');
    await onGameOver(page);
    await tapTouch(page, await buttonCentre(page, id));
    await page.waitForFunction(() => window.__PONCHO__!.phase() !== 'gameover');
    expect(await api(page, () => window.__PONCHO__!.lives())).toBe(7);
  });
}

test('GDD-LIFE-02 a claw tap inside one frame skips the respawn wait, and does not swing', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard test');
  await boot(page);
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 10);
  await page.evaluate(() => window.__PONCHO__!.teleport(248, 150));
  await page.waitForFunction(() => window.__PONCHO__!.phase() === 'respawning');
  // Timed in steps where they happen (L-042): the step the wait began (`phaseSince`), the tap made in the same task that sees 25 steps
  // done (past 0.3 s, well before 0.8 s), and the step the phase changed to playing. A frame runs at most 5 steps, so the tap lands
  // within 5 steps of the 25th whatever the frame rate.
  const began = await api(page, () => window.__PONCHO__!.phaseSince());
  await page.evaluate(async (s) => {
    while (window.__PONCHO__!.ticks() < s + 25) await new Promise((r) => requestAnimationFrame(r));
    // down and up in one task, so no frame runs between them (tapKey would add a 400 ms pause after)
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyX', keyCode: 88, bubbles: true }));
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyX', keyCode: 88, bubbles: true }));
  }, began);
  await page.waitForFunction(() => window.__PONCHO__!.phase() === 'playing');
  expect((await api(page, () => window.__PONCHO__!.phaseSince())) - began).toBeLessThan(40);
  expect(await api(page, () => window.__PONCHO__!.swings())).toBe(0);
});

test('GDD-MOV-08 a Space tap shorter than one frame, against the wall, still kicks off it', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard test');
  await boot(page);
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 10 && window.__PONCHO__!.state().grounded);
  await page.evaluate(() => window.__PONCHO__!.teleport(6, 100)); // beside the level's left edge, a full-height wall
  await page.keyboard.down('ArrowLeft');
  await page.waitForFunction(() => window.__PONCHO__!.state().clinging === true);
  await page.evaluate(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', keyCode: 32, bubbles: true }));
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space', keyCode: 32, bubbles: true }));
  });
  await page.waitForFunction(() => window.__PONCHO__!.state().vx > 0 && window.__PONCHO__!.state().vy < 0);
  await page.keyboard.up('ArrowLeft');
});

test('GDD-UI-02 a Space tapped inside one task picks Quit to title and does not block the next Space on the title', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard test');
  await boot(page);
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 10);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.__PONCHO__!.pauseDrawn().shown);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.waitForFunction(() => window.__PONCHO__!.pauseDrawn().menu.chosen === 'quit');
  await tapKey(page, 'Space', 32, 1);
  await page.waitForFunction(() => window.__PONCHO__!.titleDrawn().shown);
  await page.waitForTimeout(250);
  expect(await api(page, () => window.__PONCHO__!.titleDrawn().shown)).toBe(true); // the tap that picked did not start the level
  // The latch the tap left is spent: a second tap is a new press and starts the level.
  await tapKey(page, 'Space', 32, 1);
  await page.waitForFunction(() => !window.__PONCHO__!.titleDrawn().shown);
});

test('GDD-UI-02 an Enter tap inside one task picks Continue (L-006)', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard test');
  await page.addInitScript(
    ([key, text]) => localStorage.setItem(key!, text!),
    ['poncho-siete-vidas', JSON.stringify({ version: 1, settings: { master: 10, effects: 10, language: 'en' }, progress: { tutorialPlayed: false }, levels: {}, run: { level: '0-1', checkpoint: 1, lives: 4, used: ['ofrenda:0-1-1', 'ofrenda:0-1-2'], hilos: '0'.repeat(50), clock: 900 } })],
  );
  await openGame(page, '/');
  expect((await api(page, () => window.__PONCHO__!.titleDrawn())).menu.chosen).toBe('continue');
  await tapKey(page, 'Enter', 13, 1);
  await page.waitForFunction(() => !window.__PONCHO__!.titleDrawn().shown && window.__PONCHO__!.phase() === 'playing');
  expect(await api(page, () => window.__PONCHO__!.lives())).toBe(4);
  expect(await api(page, () => window.__PONCHO__!.state())).toMatchObject({ x: 792, y: 224 });
});

test('GDD-UI-02 Down, Down then Enter, each tapped inside one task, quit to the title screen', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard test');
  await boot(page);
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 10);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.__PONCHO__!.pauseDrawn().shown);
  await page.evaluate(() => {
    for (const [code, keyCode] of [['ArrowDown', 40], ['ArrowDown', 40], ['Enter', 13]] as const) {
      window.dispatchEvent(new KeyboardEvent('keydown', { code, keyCode, bubbles: true }));
      window.dispatchEvent(new KeyboardEvent('keyup', { code, keyCode, bubbles: true }));
    }
  });
  await page.waitForFunction(() => window.__PONCHO__!.titleDrawn().shown);
  await page.waitForTimeout(250);
  expect(await api(page, () => window.__PONCHO__!.titleDrawn().shown)).toBe(true);
});

test('GDD-UI-02 Down then Enter, each tapped inside one task, pick Retry on the results menu (L-006)', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard test');
  await boot(page, '/');
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 5);
  await page.evaluate(() => window.__PONCHO__!.teleport(1400, 224));
  await waitForResults(page);
  // Two taps, down and up in one task each, in one task together: no frame between them.
  await page.evaluate(() => {
    for (const [code, keyCode] of [['ArrowDown', 40], ['Enter', 13]] as const) {
      window.dispatchEvent(new KeyboardEvent('keydown', { code, keyCode, bubbles: true }));
      window.dispatchEvent(new KeyboardEvent('keyup', { code, keyCode, bubbles: true }));
    }
  });
  // Retry: a fresh 0-1, playing at once (Next level would be 1-1, Quit to title the title screen).
  await page.waitForFunction(() => window.__PONCHO__!.phase() === 'playing' && window.__PONCHO__!.ticks() > 2);
  expect(await api(page, () => window.__PONCHO__!.level())).toBe('0-1');
  expect((await api(page, () => window.__PONCHO__!.titleDrawn())).shown).toBe(false);
});

test('GDD-UI-02 a touch tap on the Retry row inside one frame picks it (L-006)', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'touch device only');
  await boot(page, '/');
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 5);
  await page.evaluate(() => window.__PONCHO__!.teleport(1400, 224));
  await waitForResults(page);
  const retry = await resultsRowCentre(page, 'retry'); // the slow layout read, before the tap (L-042)
  await tapTouch(page, retry);
  await page.waitForFunction(() => window.__PONCHO__!.phase() === 'playing' && window.__PONCHO__!.ticks() > 2);
  expect(await api(page, () => window.__PONCHO__!.level())).toBe('0-1');
  expect((await api(page, () => window.__PONCHO__!.titleDrawn())).shown).toBe(false);
});

/** Plays 0-1 from the title. */
async function in01(page: Page): Promise<void> {
  await boot(page, '/');
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 5);
}

/** Brings up 0-1's clear screen by standing Poncho in front of the exit. */
async function toClearScreen(page: Page): Promise<void> {
  await page.evaluate(() => window.__PONCHO__!.teleport(1400, 224));
  await page.waitForFunction(() => window.__PONCHO__!.phase() === 'clear');
}

/** After a tap on the clear screen: every line shows, before the medal line's own 0.75 s, and the screen is still up. */
async function expectSkipped(page: Page, waitAtTap: number): Promise<void> {
  // The tap came early enough for the timer not to have shown everything by itself.
  expect(waitAtTap).toBeLessThan(30);
  await page.waitForFunction(() => window.__PONCHO__!.clearDrawn().lines === 3);
  const reveal = await api(page, () => window.__PONCHO__!.clearReveal());
  expect(reveal.find((e) => e.lines === 3)!.wait).toBeLessThan(45);
  expect(await api(page, () => window.__PONCHO__!.phase())).toBe('clear');
}

test('GDD-UI-02 a claw tap inside one task skips the clear screen\'s reveal (L-006)', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard test');
  await in01(page);
  await toClearScreen(page);
  // Read how long the screen has been up in the same task as the tap: no step runs between them.
  const waitAtTap = await page.evaluate(() => {
    const wait = window.__PONCHO__!.ticks() - window.__PONCHO__!.phaseSince();
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyX', keyCode: 88, bubbles: true }));
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyX', keyCode: 88, bubbles: true }));
    return wait;
  });
  await expectSkipped(page, waitAtTap);
  // One tick for the skip, and one for each line that had already appeared by itself.
  const linesBefore = [15, 30, 45].filter((w) => w <= waitAtTap).length;
  expect((await api(page, () => window.__PONCHO__!.sfxPlayed())).filter((p) => p.key === 'sfx-tick')).toHaveLength(linesBefore + 1);
});

test('GDD-UI-02 a touch tap on the Jump button inside one frame skips the clear screen\'s reveal (L-006)', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'touch device only');
  await in01(page);
  const jump = await buttonCentre(page, 'jump'); // the slow layout read, before the screen's clock starts (L-042)
  await toClearScreen(page);
  const waitAtTap = await page.evaluate(({ x, y }) => {
    const wait = window.__PONCHO__!.ticks() - window.__PONCHO__!.phaseSince();
    const target = document.querySelector('canvas')!;
    const touch = new Touch({ identifier: 7, target, clientX: x, clientY: y, pageX: x, pageY: y, screenX: x, screenY: y });
    const init = { bubbles: true, cancelable: true, touches: [touch], targetTouches: [touch], changedTouches: [touch] };
    target.dispatchEvent(new TouchEvent('touchstart', init));
    target.dispatchEvent(new TouchEvent('touchend', { ...init, touches: [], targetTouches: [] }));
    return wait;
  }, jump);
  await expectSkipped(page, waitAtTap);
});
