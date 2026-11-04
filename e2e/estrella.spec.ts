import { expect, test, type Page } from '@playwright/test';
import { boot, bumpEstrella, openGame, pixelsAt, stepToEstrellaMode, stepUntil, tapAt, waitForResults } from './helpers';

// GDD-BOS-01, GDD-BOS-03: La Estrella in her arena, level 2-4, opened by its address (GDD-UI-02). Timed in simulation steps, never by
// polling around an event (L-042): the stepped tests pause the game and step it in the page; one test runs through the game's own frames
// (L-021). She is read through `estrella()` and `estrellaDrawn()`, never picked out by where she is (L-015). Her hits come from the bump
// a player makes: from the floor under the left awning (x 80), a jump held through its landing on the awning rebounds into her (GDD-WLD-10).
const api = <T>(page: Page, fn: () => T) => page.evaluate(fn);

/** Boots 2-4 from its title screen and pauses it a few steps in, Poncho at the start (x 240). */
async function arena(page: Page): Promise<string[]> {
  const errors = await boot(page, '/?level=2-4');
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 5);
  await api(page, () => window.__PONCHO__!.pause(true));
  return errors;
}

/** From the paused arena: Poncho on the floor under the left awning, stepped until she hangs over it (in phase 3 she aims at him there). */
async function underLeftAwning(page: Page): Promise<void> {
  await api(page, () => window.__PONCHO__!.teleport(80, 224));
  expect(await stepToEstrellaMode(page, 'hang', 1000)).toBeLessThan(1000);
  expect(await api(page, () => window.__PONCHO__!.estrella()!.tx)).toBe(80);
}

test('GDD-BOS-03 level=2-4 opens her arena on the title screen and Start plays it, with the bar: La Estrella, three pips', async ({ page, isMobile }) => {
  const errors = await openGame(page, '/?level=2-4');
  expect(await api(page, () => window.__PONCHO__!.level())).toBe('2-4');
  expect((await api(page, () => window.__PONCHO__!.titleDrawn())).shown).toBe(true);
  if (isMobile) await tapAt(page, 240, 60, true);
  else await page.keyboard.press('Enter');
  await page.waitForFunction(() => !window.__PONCHO__!.titleDrawn().shown && window.__PONCHO__!.ticks() > 5 && window.__PONCHO__!.bossBar().pips === 3);
  expect(await api(page, () => window.__PONCHO__!.bossBar())).toEqual({ shown: true, name: 'La Estrella', nameY: 10, pips: 3, outlines: 0 });
  expect(await api(page, () => window.__PONCHO__!.estrella())).toMatchObject({ hits: 0, mode: 'glide', y: 40 });
  expect(await api(page, () => window.__PONCHO__!.boss())).toBeNull();
  // Her seven cones, the three top ones with pale tips, her rope from the trolley on the cable at y 8 down to her top at y 8 (no length).
  expect(await api(page, () => window.__PONCHO__!.estrellaDrawn())).toMatchObject({ y: 24, cones: 7, pale: 3, flash: null, rope: 0 });
  expect(await api(page, () => window.__PONCHO__!.exitDrawn())).toBe(false);
  expect(await api(page, () => window.__PONCHO__!.hilos())).toMatchObject({ taken: 0, total: 0 });
  expect(await api(page, () => window.__PONCHO__!.scenery())).toEqual({ set: 'mercado', midKey: 'mercado:plaza' });
  expect(errors).toEqual([]);
});

test('GDD-BOS-03 she glides along the cable and drops onto the awning in real time', async ({ page }) => {
  const errors = await boot(page, '/?level=2-4');
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 5);
  const x0 = await api(page, () => window.__PONCHO__!.estrellaDrawn()!.x);
  // Drawn moving left along the cable, the trolley with her (L-021).
  await page.waitForFunction((x) => window.__PONCHO__!.estrellaDrawn()!.x < x - 20, x0);
  const drawn = (await api(page, () => window.__PONCHO__!.estrellaDrawn()))!;
  expect(drawn.trolleyX).toBe(drawn.x);
  // Drawn low over the left awning after her drop: her middle 16 px over its top or higher, read with her mode (L-033).
  await page.waitForFunction(() => {
    const d = window.__PONCHO__!;
    return (d.estrella()!.mode === 'bounce' || d.estrella()!.mode === 'hang') && d.estrellaDrawn()!.x === 80 && d.estrellaDrawn()!.y > 60;
  }, undefined, { timeout: 30_000 });
  expect(errors).toEqual([]);
});

test('GDD-BOS-03 her telegraph flashes red and shakes her 2 px, then a bump from a held rebound hits her: white, a pip lost, stomp', async ({ page }) => {
  await arena(page);
  await api(page, () => window.__PONCHO__!.teleport(80, 224));
  expect(await stepToEstrellaMode(page, 'telegraph')).toBeLessThan(1000);
  // Red and shaken right on the telegraph's first steps, read from what was handed to Phaser once a frame has drawn it (L-033); 4 steps
  // later plain and shaken left, the trolley with her.
  const x = await api(page, () => window.__PONCHO__!.estrella()!.x);
  await page.waitForFunction((ex) => {
    const d = window.__PONCHO__!.estrellaDrawn()!;
    return d.flash === 'red' && d.x === ex + 2 && d.trolleyX === ex + 2;
  }, x);
  await api(page, () => window.__PONCHO__!.step(4));
  await page.waitForFunction((ex) => {
    const d = window.__PONCHO__!.estrellaDrawn()!;
    return d.flash === null && d.x === ex - 2 && d.trolleyX === ex - 2;
  }, x);
  expect(await stepToEstrellaMode(page, 'hang', 200)).toBeLessThan(200);
  const heard = (await api(page, () => window.__PONCHO__!.sfx())).length;
  expect(await bumpEstrella(page)).toBe(1);
  expect(await api(page, () => window.__PONCHO__!.estrella())).toMatchObject({ mode: 'hurt', hits: 1, x: 80, y: 112 });
  // Two pips filled and one grey outline, five cones and her white flash, read together (L-033).
  await page.waitForFunction(() => {
    const d = window.__PONCHO__!;
    return d.estrellaDrawn()?.flash === 'white' && d.estrellaDrawn()?.cones === 5 && d.bossBar().pips === 2 && d.bossBar().outlines === 1;
  });
  // Her clay core, 6 px above her middle (80, 96): white, clear of the HUD and the touch buttons.
  const [white] = await pixelsAt(page, [{ x: 80, y: 90 }]);
  expect(Math.min(white!.r, white!.g, white!.b), JSON.stringify(white)).toBeGreaterThan(220);
  expect((await api(page, () => window.__PONCHO__!.sfx())).slice(heard)).toContain('stomp');
  expect(await api(page, () => window.__PONCHO__!.lives())).toBe(7);
});

test('GDD-BOS-03 in phase 2 she thuds through the cordel to the floor and a tejocote rolls out each way, drawn there', async ({ page }) => {
  await arena(page);
  await api(page, () => {
    window.__PONCHO__!.setEstrella(1);
    window.__PONCHO__!.teleport(127, 136);
  });
  expect(await stepToEstrellaMode(page, 'rest', 400)).toBeLessThan(400);
  expect(await api(page, () => window.__PONCHO__!.estrella())).toMatchObject({ x: 160, y: 224 });
  await api(page, () => window.__PONCHO__!.step(10));
  const run = await api(page, () => window.__PONCHO__!.tejocotes());
  expect(run.map((t) => t.x)).toEqual([145, 175]);
  await page.waitForFunction(() => window.__PONCHO__!.tejocotesDrawn().length === 2);
  expect(await api(page, () => window.__PONCHO__!.tejocotesDrawn())).toEqual([
    { x: 141, y: 216 },
    { x: 171, y: 216 },
  ]);
  expect(await api(page, () => window.__PONCHO__!.lives())).toBe(7);
  // The test hook starts her phase as a lost life does: no tejocotes.
  await api(page, () => window.__PONCHO__!.setEstrella(1));
  expect(await api(page, () => window.__PONCHO__!.tejocotes())).toEqual([]);
});

test('GDD-BOS-03 the third hit defeats her; 1.0 s later the level clear screen, 2-4 saved and Next level greyed', async ({ page }) => {
  await arena(page);
  await api(page, () => window.__PONCHO__!.setEstrella(2));
  await underLeftAwning(page);
  const heard = (await api(page, () => window.__PONCHO__!.sfx())).length;
  expect(await bumpEstrella(page)).toBe(3);
  expect(await api(page, () => window.__PONCHO__!.estrella())).toMatchObject({ hits: 3, mode: 'defeated', age: 0 });
  // Her rope snapped and no cone left; the bar's three pips are outlines.
  await page.waitForFunction(() => {
    const d = window.__PONCHO__!;
    return d.estrellaDrawn()?.rope === null && d.estrellaDrawn()?.cones === 0 && d.bossBar().pips === 0 && d.bossBar().outlines === 3;
  });
  expect(await api(page, () => window.__PONCHO__!.tejocotes())).toEqual([]);
  expect((await api(page, () => window.__PONCHO__!.sfx())).slice(heard)).toEqual(expect.arrayContaining(['meow', 'stomp']));
  await api(page, () => window.__PONCHO__!.step(59));
  expect(await api(page, () => window.__PONCHO__!.phase())).toBe('playing');
  await api(page, () => window.__PONCHO__!.step(1));
  expect(await api(page, () => window.__PONCHO__!.phase())).toBe('clear');
  await api(page, () => window.__PONCHO__!.pause(false));
  await waitForResults(page);
  const clear = await api(page, () => window.__PONCHO__!.clearDrawn());
  expect(clear).toMatchObject({ shown: true, hilos: 'Hilos 0/0', medal: 'Gold medal' });
  // 2-4 is World 2's last level: Next level is greyed and the menu opens on Retry (GDD-UI-02).
  expect(clear.menu).toMatchObject({ chosen: 'retry', colors: ['#5c6178', '#fff3dc', '#9ba3c4'] });
  const saved: { levels: Record<string, unknown> } = JSON.parse((await page.evaluate(() => window.localStorage.getItem('poncho-siete-vidas')))!);
  expect(saved.levels['2-4']).toMatchObject({ hilos: '', medal: 'gold', cleared: true });
});

test('GDD-BOS-01 a life lost mid-fight keeps her hits and starts her phase again over x 320, the tejocotes gone', async ({ page }) => {
  await arena(page);
  await api(page, () => {
    window.__PONCHO__!.setEstrella(1);
    window.__PONCHO__!.teleport(160, 224);
  });
  // On the floor under her phase 2 drop at x 160: it reaches him.
  expect(await stepUntil(page, { phase: 'respawning' }, 400)).toBeLessThan(400);
  expect(await api(page, () => window.__PONCHO__!.lives())).toBe(6);
  expect(await api(page, () => window.__PONCHO__!.estrella()!.hits)).toBe(1);
  expect(await stepUntil(page, { phase: 'playing' }, 100)).toBeLessThan(100);
  expect(await api(page, () => window.__PONCHO__!.estrella())).toMatchObject({ x: 320, y: 40, mode: 'glide', age: 0, hits: 1 });
  expect(await api(page, () => window.__PONCHO__!.tejocotes())).toEqual([]);
  await page.waitForFunction(() => window.__PONCHO__!.bossBar().pips === 2 && window.__PONCHO__!.estrellaDrawn()?.cones === 5);
});
