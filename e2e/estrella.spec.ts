import { expect, test, type Page } from '@playwright/test';
import { estrellaFrameInfo, estrellaPose } from '../src/ui/estrellaPose';
import { LEVEL_2_4 } from '../src/levels/level2-4';
import { boot, bumpEstrella, openGame, phase3Hit, pixelsAt, stepToEstrellaMode, stepToEstrellaTear, stepUntil, tapAt, waitForResults } from './helpers';

// GDD-BOS-01, GDD-BOS-03: La Estrella in her arena, level 2-4, opened by its address (GDD-UI-02). Timed in simulation steps, never by
// polling around an event (L-042): the stepped tests pause the game and step it in the page; one test runs through the game's own frames
// (L-021). She is read through `estrella()` and `estrellaDrawn()`, never picked out by where she is (L-015). Her hits come from the bump
// a player makes: from the floor under the left awning (x 80), a jump held through its landing on the awning rebounds into her (GDD-WLD-10).
const api = <T>(page: Page, fn: () => T) => page.evaluate(fn);
type Debug = NonNullable<Window['__PONCHO__']>;
const nearColour = (c: { r: number; g: number; b: number }, [r, g, b]: number[]) => Math.abs(c.r - r!) < 8 && Math.abs(c.g - g!) < 8 && Math.abs(c.b - b!) < 8;
/** The quarter turn of a tejocote's calyx after rolling to x: one for each 8 * pi / 4 px (a circle 8 px across). */
const quarter = (x: number) => Math.floor((x * 4) / (Math.PI * 8)) % 4;

/** Boots 2-4 from its title screen and pauses it a few steps in, Poncho at the start (x 240). */
async function arena(page: Page): Promise<string[]> {
  const errors = await boot(page, '/?level=2-4');
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 5);
  await api(page, () => window.__PONCHO__!.pause(true));
  return errors;
}

test('GDD-BOS-03 level=2-4 opens her arena on the title screen and Start plays it, with the bar: La Estrella, three pips', async ({ page, isMobile }) => {
  const errors = await openGame(page, '/?level=2-4');
  expect(await api(page, () => window.__PONCHO__!.level())).toBe('2-4');
  expect((await api(page, () => window.__PONCHO__!.titleDrawn())).shown).toBe(true);
  if (isMobile) await tapAt(page, 240, 60, true);
  else await page.keyboard.press('Enter');
  await page.waitForFunction(() => !window.__PONCHO__!.titleDrawn().shown && window.__PONCHO__!.ticks() > 5 && window.__PONCHO__!.bossBar().pips === 3);
  expect(await api(page, () => window.__PONCHO__!.bossBar())).toEqual({ shown: true, name: 'La Estrella', stroke: ['#2a1f2e', 2], nameY: 10, pips: 3, outlines: 0 });
  expect(await api(page, () => window.__PONCHO__!.estrella())).toMatchObject({ hits: 0, mode: 'glide', y: 40 });
  expect(await api(page, () => window.__PONCHO__!.boss())).toBeNull();
  // Her glide frame at no hits (seven cones; the three pale tips are in the art), mirrored: she starts at x 400 heading left for x 80. Her
  // rope has no length up under the cable.
  expect(await api(page, () => window.__PONCHO__!.estrellaDrawn())).toMatchObject({ y: 24, frame: 0, look: 'glide', hits: 0, cones: 7, flash: null, flipX: true, rope: 0 });
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
  expect(drawn).toMatchObject({ look: 'glide', flipX: true });
  // The trolley's wheel turns as she rolls along the cable: over 40 frames of the glide both its frames are drawn (L-021).
  const wheel = await page.evaluate(async () => {
    const seen = new Set<number>();
    for (let i = 0; i < 40; i++) {
      await new Promise((r) => requestAnimationFrame(r));
      const d = window.__PONCHO__!.estrellaDrawn();
      if (d?.look === 'glide') seen.add(d.trolleyFrame);
    }
    return [...seen];
  });
  expect(new Set(wheel)).toEqual(new Set([0, 1]));
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
    return d.flash === 'red' && d.look === 'telegraphRRed' && d.x === ex + 2 && d.trolleyX === ex + 2;
  }, x);
  await api(page, () => window.__PONCHO__!.step(4));
  await page.waitForFunction((ex) => {
    const d = window.__PONCHO__!.estrellaDrawn()!;
    return d.flash === null && d.look === 'telegraphR' && d.x === ex - 2 && d.trolleyX === ex - 2;
  }, x);
  expect(await stepToEstrellaMode(page, 'hang', 200)).toBeLessThan(200);
  const heard = (await api(page, () => window.__PONCHO__!.sfx())).length;
  expect(await bumpEstrella(page)).toBe(1);
  expect(await api(page, () => window.__PONCHO__!.estrella())).toMatchObject({ mode: 'hurt', hits: 1, x: 80, y: 112 });
  // Two pips filled and one grey outline, five cones and her white flash, read together (L-033).
  await page.waitForFunction(() => {
    const d = window.__PONCHO__!;
    return d.estrellaDrawn()?.flash === 'white' && d.estrellaDrawn()?.look === 'hurtWhite' && d.estrellaDrawn()?.cones === 5 && d.bossBar().pips === 2 && d.bossBar().outlines === 1;
  });
  // Her clay pot, 6 px above her middle (80, 96): in her white flash frame the glaze white of the flash or its far lilac shade (#F4EFE2 or
  // #C3C6DE), clear of the HUD and the touch buttons; her clay is #C45E3E and its shades, with a blue channel under 90.
  const [white] = await pixelsAt(page, [{ x: 80, y: 90 }]);
  expect([[0xf4, 0xef, 0xe2], [0xc3, 0xc6, 0xde]].some((w) => nearColour(white!, w)), JSON.stringify(white)).toBe(true);
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
  // Each a box at 8 px to the left of its middle and 8 px high, the calyx turned a quarter for each 6.28 px rolled: x 145 is 23 quarters, 175 is 27.
  expect(await api(page, () => window.__PONCHO__!.tejocotesDrawn())).toEqual([
    { x: 141, y: 216, w: 8, h: 8, frame: 3 },
    { x: 171, y: 216, w: 8, h: 8, frame: 3 },
  ]);
  expect(await api(page, () => window.__PONCHO__!.lives())).toBe(7);
  // The test hook starts her phase as a lost life does: no tejocotes.
  await api(page, () => window.__PONCHO__!.setEstrella(1));
  expect(await api(page, () => window.__PONCHO__!.tejocotes())).toEqual([]);
});

test('GDD-BOS-03 the third hit defeats her; 1.0 s later the level clear screen, 2-4 saved and Next level greyed', async ({ page }) => {
  await arena(page);
  await api(page, () => window.__PONCHO__!.setEstrella(2));
  const heard = (await api(page, () => window.__PONCHO__!.sfx())).length;
  // Her first phase 3 drop tears the middle awning away beside him on the left cordel; from there a jump bumps her as she hangs.
  expect(await phase3Hit(page)).toBe(3);
  expect(await api(page, () => window.__PONCHO__!.estrella())).toMatchObject({ hits: 3, mode: 'defeated', age: 0, tore: true });
  // Her rope snapped and no cone left; the bar's three pips are outlines.
  await page.waitForFunction(() => {
    const d = window.__PONCHO__!;
    return d.estrellaDrawn()?.rope === null && d.estrellaDrawn()?.cones === 0 && d.estrellaDrawn()?.look === 'fallWhite' && d.bossBar().pips === 0 && d.bossBar().outlines === 3;
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
  await page.waitForFunction(() => window.__PONCHO__!.bossBar().pips === 2 && window.__PONCHO__!.estrellaDrawn()?.cones === 5 && window.__PONCHO__!.estrellaDrawn()?.hits === 1);
});

test('GDD-BOS-03 the tear: in phase 3 her first drop tears the middle awning away, drawn as its two halves, and Poncho on it falls', async ({ page }) => {
  const errors = await arena(page);
  // Phase 3 from its start, Poncho standing on the middle awning (x 208 to 272) beside her line: her box spans x 224 to 256, his body 260 to 272.
  await api(page, () => {
    window.__PONCHO__!.setEstrella(2);
    window.__PONCHO__!.teleport(266, 176);
  });
  expect(await api(page, () => window.__PONCHO__!.estrella())).toMatchObject({ hits: 2, tore: false });
  // Her first glide heads for x 240, not for the spot above him (x 266); the awning is whole and drawn whole until she tears it.
  expect(await stepToEstrellaMode(page, 'telegraph')).toBeLessThan(1000);
  expect(await api(page, () => window.__PONCHO__!.estrella())).toMatchObject({ mode: 'telegraph', x: 240, tore: false });
  expect(await api(page, () => window.__PONCHO__!.market().gone)).toEqual([false, false, false]);
  expect(await api(page, () => window.__PONCHO__!.state())).toMatchObject({ x: 266, y: 176, grounded: true });
  // Steps until the tear, in the page (L-042): the awning is gone from the run on that step, the side two whole.
  expect(await stepToEstrellaTear(page)).toBeLessThan(400);
  expect(await api(page, () => window.__PONCHO__!.estrella())).toMatchObject({ mode: 'drop', x: 240, tx: 240, tore: true });
  expect(await api(page, () => window.__PONCHO__!.market().gone)).toEqual([false, true, false]);
  // Drawn torn apart in the next frame (L-033): the awning's post and its two halves, read together with the run's flag.
  await page.waitForFunction(() => {
    const m = window.__PONCHO__!.market();
    return m.awnings[1]!.gone && m.gone[1]! && !m.awnings[0]!.gone && !m.awnings[2]!.gone;
  });
  // A few steps later he has left the awning's top: he falls, without a rebound.
  await api(page, () => window.__PONCHO__!.step(3));
  const fall = await api(page, () => window.__PONCHO__!.state());
  expect(fall.y).toBeGreaterThan(176);
  expect(fall.grounded).toBe(false);
  expect(await api(page, () => window.__PONCHO__!.market().bounce)).toBeNull();
  expect(errors).toEqual([]);
});

test('GDD-BOS-01 GDD-BOS-03 a life lost after the tear: the middle awning stays drawn torn and her first glide heads for the spot above him', async ({ page }) => {
  await arena(page);
  await api(page, () => {
    window.__PONCHO__!.setEstrella(2);
    window.__PONCHO__!.teleport(400, 224);
  });
  expect(await stepToEstrellaTear(page)).toBeLessThan(400);
  // Under her drop on the floor: her thud costs the life.
  await api(page, () => window.__PONCHO__!.teleport(240, 224));
  expect(await stepUntil(page, { phase: 'respawning' }, 100)).toBeLessThan(100);
  expect(await api(page, () => window.__PONCHO__!.lives())).toBe(6);
  expect(await stepUntil(page, { phase: 'playing' }, 100)).toBeLessThan(100);
  expect(await api(page, () => window.__PONCHO__!.estrella())).toMatchObject({ x: 400, y: 40, mode: 'glide', age: 0, hits: 2, tore: true });
  expect(await api(page, () => window.__PONCHO__!.market().gone)).toEqual([false, true, false]);
  // Drawn torn in the frame after the respawn, read with the run's flag (L-033).
  await page.waitForFunction(() => {
    const m = window.__PONCHO__!.market();
    return m.awnings[1]!.gone && m.gone[1]!;
  });
  // Poncho put at x 300: she glides to the spot above him, not to x 240, and telegraphs there.
  await api(page, () => window.__PONCHO__!.teleport(300, 224));
  expect(await stepToEstrellaMode(page, 'telegraph', 200)).toBeLessThan(200);
  expect(await api(page, () => window.__PONCHO__!.estrella())).toMatchObject({ mode: 'telegraph', x: 300 });
});

test('GDD-BOS-03 the frame drawn is the one estrellaPose picks for the run, in each mode she passes through', async ({ page }) => {
  await arena(page);
  await api(page, () => window.__PONCHO__!.teleport(80, 224));
  // Her pattern in phase 1 with Poncho under the left awning: stepped to the first step of each mode, then two frames drawn, and the run, the
  // player and what was drawn read in one callback (L-033). The glide is checked in its own test above.
  for (const mode of ['telegraph', 'drop', 'bounce', 'hang', 'yank'] as const) {
    expect(await stepToEstrellaMode(page, mode, 1000), mode).toBeLessThan(1000);
    const read = await page.evaluate(() => new Promise<{ run: NonNullable<ReturnType<Debug['estrella']>>; player: ReturnType<Debug['state']>; drawn: ReturnType<Debug['estrellaDrawn']> }>((resolve) => {
      const d = window.__PONCHO__!;
      requestAnimationFrame(() => requestAnimationFrame(() => resolve({ run: d.estrella()!, player: d.state(), drawn: d.estrellaDrawn() })));
    }));
    expect(read.run.mode).toBe(mode);
    const pose = estrellaPose({ ...read.run, mode, spot: 0 }, read.player, LEVEL_2_4.estrella!);
    expect(read.drawn, mode).toMatchObject({ frame: pose.frame, x: pose.x, y: pose.y, flipX: pose.flipX, trolleyFrame: pose.trolley.frame, ...estrellaFrameInfo(pose.frame) });
    // The trolley rides the cable (y = 8) and the rope, where it shows, ties into her top cone's tip from the trolley's eye (GDD-BOS-03, "Her look").
    expect(read.drawn!.trolleyCableY, mode).toBe(8);
    // Drawn at true size (a frame is 72 x 72 game px, the trolley 16 x 16) and the cable across the arena, 1 px thick on y = 8 (L-010: drawn edges).
    expect({ size: read.drawn!.size, trolleySize: read.drawn!.trolleySize, cable: read.drawn!.cable }, mode).toEqual({
      size: { w: 72, h: 72 },
      trolleySize: { w: 16, h: 16 },
      cable: { x0: 0, y0: 7.5, x1: 480, y1: 8.5 },
    });
    if (mode === 'hang') expect({ x: read.drawn!.ropeX, top: read.drawn!.ropeTop }, mode).toEqual({ x: pose.rope!.x, top: pose.rope!.top });
  }
});

test('GDD-BOS-03 a tejocote\'s calyx turns as it rolls: the frame follows its x, forward going right and back going left', async ({ page }) => {
  await arena(page);
  await api(page, () => {
    window.__PONCHO__!.setEstrella(1);
    window.__PONCHO__!.teleport(127, 136);
  });
  expect(await stepToEstrellaMode(page, 'rest', 400)).toBeLessThan(400);
  // The first pair rolls out 10 steps on; then 4 steps and a frame drawn, over and over, in one callback (L-073), read with the run's x.
  await api(page, () => window.__PONCHO__!.step(10));
  const seen = await page.evaluate(async () => {
    const d = window.__PONCHO__!;
    const out: { x: number; frame: number }[][] = [];
    for (let i = 0; i < 6; i++) {
      d.step(4);
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const run = d.tejocotes();
      const drawn = d.tejocotesDrawn();
      out.push(run.map((t, k) => ({ x: t.x, frame: drawn[k]!.frame })));
    }
    return out;
  });
  // One rolling each way: the first goes left (x 145 and less), the second right.
  const left = seen.map((s) => s[0]!);
  const right = seen.map((s) => s[1]!);
  for (const s of [...left, ...right]) expect(s.frame, `x ${s.x}`).toBe(quarter(s.x));
  // Over 6 x 4 steps (36 px) each turns 5 or 6 quarters, through at least three different frames; the one rolling right moves up, the one left down.
  expect(new Set(right.map((s) => s.frame)).size).toBeGreaterThanOrEqual(3);
  expect(new Set(left.map((s) => s.frame)).size).toBeGreaterThanOrEqual(3);
  expect(right.at(-1)!.x).toBeGreaterThan(right[0]!.x);
  expect(left.at(-1)!.x).toBeLessThan(left[0]!.x);
});
