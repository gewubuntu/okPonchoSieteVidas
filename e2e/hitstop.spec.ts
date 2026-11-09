import { expect, test, type Page } from '@playwright/test';
import { boot, stepToBossMode } from './helpers';

// GDD-BOS-01: the hit-stop, the freeze on a hit on a boss. It lives only in the game's own loop (`update`), so each test stages the hit
// in the paused game (L-042: in steps, in the page), then lets the real loop run the hit and samples it once a frame inside one
// `page.evaluate` (L-073): the step counters, the clock, the hold's counters and what was drawn, read together (L-033). A frame runs at
// most 5 steps, so a 12-step hold always shows `left > 0` at the end of the frame of the hit and of the next; a 4-step hold may be over
// within the hit's own frame, so the tests that act inside the hold use the defeating hit (12) and the tests of the 4 count it.
const api = <T>(page: Page, fn: () => T) => page.evaluate(fn);

/** One frame's reading of the real loop. */
interface Sample {
  ticks: number;
  clock: number;
  held: number;
  left: number;
  swings: number;
  spits: number;
  grounded: boolean;
  y: number;
  x: number;
  bodyX: number;
  paused: boolean;
}

/** What to do inside the hold, the first time a frame ends with steps of it left. */
type Act = { keys: [string, number][] } | { touch: { x: number; y: number } } | { pause: true } | null;

/** Boots 1-4 from its title screen and pauses it a few steps in, Poncho at the start (x 232). */
async function arena(page: Page, path: string): Promise<string[]> {
  const errors = await boot(page, path);
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 5);
  await api(page, () => window.__PONCHO__!.pause(true));
  return errors;
}

/**
 * Don Zopilote in 1-4 with `hits` taken, paused, stuck in the sand after a dive aimed at the start, Poncho 42 px left of him on the floor
 * at x 190, facing him, clear of his box (as `e2e/boss.spec.ts` does).
 */
async function stuckBeside(page: Page, hits: number): Promise<void> {
  if (hits > 0) await page.evaluate((h) => window.__PONCHO__!.setBoss(h), hits);
  expect(await stepToBossMode(page, 'dive')).toBeLessThan(1000);
  expect(await api(page, () => window.__PONCHO__!.boss()!.tx)).toBe(232);
  await api(page, () => window.__PONCHO__!.teleport(190, 224));
  expect(await stepToBossMode(page, 'stuck')).toBeLessThan(200);
}

/** The claw's first step, made in the paused game: its swing comes 2 steps later, in the real loop, and hits him stuck in the sand. */
const startClaw = (page: Page, move = 0) => page.evaluate((m) => window.__PONCHO__!.step(1, { move: m, jumpHeld: false, claw: true }), move);

/**
 * Unpauses the game and samples it on every frame of its own loop until the hold that a hit starts is over and three frames more have
 * run (at most 300 frames, L-064), doing `act` the first time a frame ends with steps of the hold left: a tap of a key or of the touch
 * button inside one task (L-006), or the pause (Escape) and, 8 frames later, the resume. The game is paused again at the end.
 */
function runHit(page: Page, act: Act): Promise<{ samples: Sample[]; base: { held: number; swings: number; spits: number }; acted: boolean }> {
  return page.evaluate(async (what) => {
    const d = window.__PONCHO__!;
    // A key tap in one task (L-006), and the next frame, as methods of one object: the page cannot see this file's helpers.
    const io = {
      frame: () => new Promise<void>((r) => requestAnimationFrame(() => r())),
      press: (code: string, keyCode: number) => {
        window.dispatchEvent(new KeyboardEvent('keydown', { code, keyCode, bubbles: true }));
        window.dispatchEvent(new KeyboardEvent('keyup', { code, keyCode, bubbles: true }));
      },
    };
    const base = { held: d.hitStop().held, swings: d.swings(), spits: d.spits() };
    const samples: Sample[] = [];
    let acted = false;
    let resumed = false;
    let pausedFrames = 0;
    let hitTicks = -1;
    let after = 0;
    d.pause(false);
    for (let i = 0; i < 300; i++) {
      await io.frame();
      const stop = d.hitStop();
      const state = d.state();
      samples.push({
        ticks: d.ticks(),
        clock: d.clock(),
        held: stop.held - base.held,
        left: stop.left,
        swings: d.swings() - base.swings,
        spits: d.spits() - base.spits,
        grounded: state.grounded,
        y: state.y,
        x: state.x,
        bodyX: d.bodyPose().x,
        paused: d.playerPause().paused,
      });
      const hit = stop.held > base.held || stop.left > 0;
      if (hit && hitTicks < 0) hitTicks = d.ticks();
      if (hit && !acted && stop.left > 0 && what) {
        acted = true;
        if ('keys' in what) for (const [code, keyCode] of what.keys) io.press(code, keyCode);
        else if ('touch' in what) {
          const { x, y } = what.touch;
          const target = document.querySelector('canvas')!;
          const touch = new Touch({ identifier: 7, target, clientX: x, clientY: y, pageX: x, pageY: y, screenX: x, screenY: y });
          const init = { bubbles: true, cancelable: true, touches: [touch], targetTouches: [touch], changedTouches: [touch] };
          target.dispatchEvent(new TouchEvent('touchstart', init));
          target.dispatchEvent(new TouchEvent('touchend', { ...init, touches: [], targetTouches: [] }));
        } else io.press('Escape', 27);
      }
      if (what && 'pause' in what && acted && !resumed && d.playerPause().paused && ++pausedFrames === 8) {
        io.press('Escape', 27);
        resumed = true;
      }
      if (hit && stop.left === 0 && d.ticks() > hitTicks && ++after >= 3) break;
    }
    d.pause(true);
    return { samples, base, acted };
  }, act);
}

/** The frames at which a hit's hold was still going at the frame's end, with the first of them (the hit's own frame). */
function hold(samples: Sample[], total: number): { first: Sample; mid: Sample[]; last: Sample } {
  const at = samples.findIndex((s) => s.held > 0 || s.left > 0);
  expect(at, 'a hit was seen').toBeGreaterThanOrEqual(0);
  const first = samples[at]!;
  return { first, mid: samples.slice(at).filter((s) => s.held < total), last: samples[samples.length - 1]! };
}

for (const total of [4, 12] as const) {
  test(`GDD-BOS-01 hit-stop: a ${total === 4 ? 'hurting' : 'defeating'} hit on Don Zopilote holds ${total} steps of the real loop, the level clock waiting`, async ({ page }) => {
    const errors = await arena(page, '/?level=1-4');
    await stuckBeside(page, total === 4 ? 0 : 2);
    await startClaw(page);
    const { samples } = await runHit(page, null);
    const { first, mid, last } = hold(samples, total);
    // Exactly the hold's steps were held, once the loop was past it (the pause and title never count).
    expect(last.held).toBe(total);
    expect(last.left).toBe(0);
    // Across the hold no step ran and the clock waited (`first` is the frame of the hit: nothing ran after it). The 12-step hold shows in at
    // least two frames; the 4-step one may fit in one.
    for (const s of mid) expect([s.ticks, s.clock], JSON.stringify(s)).toEqual([first.ticks, first.clock]);
    if (total === 12) expect(mid.length).toBeGreaterThanOrEqual(2);
    // Then the steps go on, the clock with them.
    expect(last.ticks).toBeGreaterThan(first.ticks);
    expect(last.clock).toBeGreaterThan(first.clock);
    expect(await api(page, () => window.__PONCHO__!.boss()!.hits)).toBe(total === 4 ? 1 : 3);
    expect(errors).toEqual([]);
  });
}

test('GDD-BOS-01 hit-stop: the defeating hit on La Estrella holds 12 steps', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard test');
  const errors = await arena(page, '/?level=2-4');
  await api(page, () => window.__PONCHO__!.setEstrella(2));
  // Phase 3, as `phase3Hit` in `helpers.ts` stages it: Poncho on the end of the left cordel at x 205 until she hangs within 21 px across;
  // then a jump held from there bumps her, here by the real loop with Space held down.
  await api(page, () => {
    const d = window.__PONCHO__!;
    d.teleport(205, 136);
    for (let i = 0; i < 400 && !(d.estrella()!.mode === 'hang' && Math.abs(d.estrella()!.x - 205) < 21); i++) d.step(1);
  });
  expect(await api(page, () => window.__PONCHO__!.estrella())).toMatchObject({ mode: 'hang', hits: 2, tore: true });
  await page.keyboard.down('Space');
  const { samples } = await runHit(page, null);
  await page.keyboard.up('Space');
  const { first, mid, last } = hold(samples, 12);
  expect(last.held).toBe(12);
  for (const s of mid) expect([s.ticks, s.clock], JSON.stringify(s)).toEqual([first.ticks, first.clock]);
  expect(mid.length).toBeGreaterThanOrEqual(2);
  expect(last.ticks).toBeGreaterThan(first.ticks);
  expect(await api(page, () => window.__PONCHO__!.estrella())).toMatchObject({ hits: 3, mode: 'defeated' });
  expect(errors).toEqual([]);
});

test('GDD-BOS-01 hit-stop: Poncho is drawn still during the hold', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard test');
  await arena(page, '/?level=1-4');
  await stuckBeside(page, 2);
  // Poncho runs right as the claw lands, so the step of the hit moves him: the picture must not slide him from the step before to it.
  await page.keyboard.down('ArrowRight');
  await startClaw(page, 1);
  const { samples } = await runHit(page, null);
  await page.keyboard.up('ArrowRight');
  const { mid } = hold(samples, 12);
  expect(mid.length).toBeGreaterThanOrEqual(2);
  // The drawn body is where Poncho is, to the pixel, on every frame inside the hold (read with the state, L-033).
  for (const s of mid) expect(s.bodyX, JSON.stringify(s)).toBeCloseTo(s.x, 6);
  expect(mid.map((s) => s.x)).toEqual(mid.map(() => mid[0]!.x));
});

test('GDD-BOS-01 hit-stop: a Space tap during the hold is a jump on the first step after it', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard test');
  await arena(page, '/?level=1-4');
  await stuckBeside(page, 2);
  await startClaw(page);
  const { samples, acted } = await runHit(page, { keys: [['Space', 32]] });
  expect(acted).toBe(true);
  const { first, mid } = hold(samples, 12);
  // Still on the floor all through the hold, then up on the first frame with a step after it.
  expect(mid.every((s) => s.grounded)).toBe(true);
  const after = samples.find((s) => s.ticks > first.ticks)!;
  expect(after.grounded).toBe(false);
  expect(after.y).toBeLessThan(first.y);
});

test('GDD-BOS-01 hit-stop: a claw key tap during the hold swings on the first step after it', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard test');
  await arena(page, '/?level=1-4');
  await stuckBeside(page, 2);
  // The hit is a fireball's, so the claw is free: Fuego, one spit made in the paused game; the fireball flies on in the real loop.
  await api(page, () => {
    window.__PONCHO__!.setPower('fuego');
    window.__PONCHO__!.step(1, { move: 0, jumpHeld: false, fuego: true });
  });
  const { samples, acted } = await runHit(page, { keys: [['KeyX', 88]] });
  expect(acted).toBe(true);
  const { first, mid, last } = hold(samples, 12);
  expect(mid.every((s) => s.swings === 0)).toBe(true);
  expect(last.ticks).toBeGreaterThan(first.ticks);
  expect(last.swings).toBe(1);
});

test('GDD-BOS-01 hit-stop: a Fuego key tap during the hold throws a fireball after it', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard test');
  await arena(page, '/?level=1-4');
  await stuckBeside(page, 2);
  await api(page, () => window.__PONCHO__!.setPower('fuego'));
  await startClaw(page);
  const { samples, acted } = await runHit(page, { keys: [['KeyC', 67]] });
  expect(acted).toBe(true);
  const { first, mid, last } = hold(samples, 12);
  expect(mid.every((s) => s.spits === 0)).toBe(true);
  expect(last.ticks).toBeGreaterThan(first.ticks);
  expect(last.spits).toBe(1);
});

test('GDD-BOS-01 hit-stop: a touch jump tap during the hold is a jump after it', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'touch device only');
  await arena(page, '/?level=1-4');
  await stuckBeside(page, 2);
  // Slow setup first (L-042): where the Jump button is, in CSS px.
  const b = (await api(page, () => window.__PONCHO__!.touch())).buttons.find((x) => x.id === 'jump')!;
  const box = (await page.locator('canvas').boundingBox())!;
  const k = box.width / 480;
  const at = { x: box.x + (b.x + b.w / 2) * k, y: box.y + (b.y + b.h / 2) * k };
  await startClaw(page);
  const { samples, acted } = await runHit(page, { touch: at });
  expect(acted).toBe(true);
  const { first, mid } = hold(samples, 12);
  expect(mid.every((s) => s.grounded)).toBe(true);
  const after = samples.find((s) => s.ticks > first.ticks)!;
  expect(after.grounded).toBe(false);
  expect(after.y).toBeLessThan(first.y);
});

test('GDD-BOS-01 hit-stop: the pause works during the hold and the hold resumes after it', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard test');
  await arena(page, '/?level=1-4');
  await stuckBeside(page, 2);
  await startClaw(page);
  const { samples, acted } = await runHit(page, { pause: true });
  expect(acted).toBe(true);
  const { first, last } = hold(samples, 12);
  // Paused inside the hold: for the frames of the pause nothing is held, nothing steps and the steps left stay the same.
  const stopped = samples.filter((s) => s.paused);
  expect(stopped.length).toBeGreaterThanOrEqual(8);
  for (const s of stopped) expect([s.ticks, s.held, s.left], JSON.stringify(s)).toEqual([stopped[0]!.ticks, stopped[0]!.held, stopped[0]!.left]);
  expect(stopped[0]!.left).toBeGreaterThan(0);
  expect(stopped[0]!.ticks).toBe(first.ticks);
  // After the resume the rest of the hold runs, the total still 12, and the steps go on.
  expect(last.held).toBe(12);
  expect(last.ticks).toBeGreaterThan(first.ticks);
});

test('GDD-BOS-01 hit-stop: quitting to the title during the hold ends it', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard test');
  await arena(page, '/?level=1-4');
  await stuckBeside(page, 2);
  await startClaw(page);
  const left = await page.evaluate(async () => {
    const d = window.__PONCHO__!;
    // A key tap in one task (L-006), and the next frame, as methods of one object: the page cannot see this file's helpers.
    const io = {
      frame: () => new Promise<void>((r) => requestAnimationFrame(() => r())),
      press: (code: string, keyCode: number) => {
        window.dispatchEvent(new KeyboardEvent('keydown', { code, keyCode, bubbles: true }));
        window.dispatchEvent(new KeyboardEvent('keyup', { code, keyCode, bubbles: true }));
      },
    };
    d.pause(false);
    for (let i = 0; i < 300 && d.hitStop().left === 0; i++) await io.frame();
    if (d.hitStop().left === 0) throw new Error('no hold');
    io.press('Escape', 27);
    for (let i = 0; i < 300 && !d.pauseDrawn().menu.shown; i++) await io.frame();
    for (const [code, keyCode] of [['ArrowDown', 40], ['ArrowDown', 40], ['Enter', 13]] as const) io.press(code, keyCode);
    for (let i = 0; i < 300 && !d.titleDrawn().shown; i++) await io.frame();
    if (!d.titleDrawn().shown) throw new Error('no title');
    return d.hitStop().left;
  });
  expect(left).toBe(0);
});
