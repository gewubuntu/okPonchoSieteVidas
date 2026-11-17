import { expect, test, type Page } from '@playwright/test';
import { SANDBOX_PINATAS } from '../src/levels/sandbox';
import { TILE } from '../src/config/tuning';
import { itemAt } from '../src/ui/ponchoPose';
import { boot, clearOfButtons, nearHex, pixelsAt, readSheet, spotsIn } from './helpers';

// GDD-PWR-04: the Chile Fantasma, as the game draws it, read back from the images (`glowDrawn()`, `ponchoSprite()`), step by step in the paused
// game (L-042), and once through the game's own frames (L-021). The sandbox: the floor's top is y 224, Poncho starts at x 56, the Alacrán walks the
// platform at row 10 (x 64 to 128, top y 160), the wall 3 tiles high at columns 22 and 23 has its top at y 176 and is out of the Zopilote's reach.
// 0-1's exit stands at x 1400 on the floor.
const api = <T>(page: Page, fn: () => T) => page.evaluate(fn);
const twoFrames = (page: Page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const GOLD = '#F9D24C'; // the glow's bright gold, Poncho's gold (GDD-ART-03)
const PALE = '#D3C193'; // the dim glow's pale gold, measured on the user's reference (scripts/art/poncho/items.mjs)
const FLAME = 2; // the flame's frame in the glow sheet (ITEM_LOOKS.glow)
// Where the flame frame has a square of solid gold 1.5 game px across (3 x 3 drawing px: 2 px or more across on the phone too, L-017), read from its sheet.
const FLAME_SPOTS = spotsIn(readSheet('poncho/glow.png'), 8, 8, FLAME, GOLD, { size: 1.5 });

/** Boots the sandbox, pauses it and stands Poncho on the floor at the start (steps the game two steps so he is down). */
async function standing(page: Page, x = 56, y = 224): Promise<string[]> {
  const errors = await boot(page);
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 10);
  await page.evaluate(([px, py]) => {
    const d = window.__PONCHO__!;
    d.pause(true);
    d.teleport(px!, py!);
    d.step(2);
  }, [x, y]);
  return errors;
}

// The special piñata is the sandbox's last (column 26, row 2: x 416 to 432, y 32 to 48, read from the level module, L-062); the pepper stands on its top.
const SPECIAL = SANDBOX_PINATAS.findIndex((p) => p.special === true);
const SPECIAL_BOX = { x: SANDBOX_PINATAS[SPECIAL]!.col * TILE, y: SANDBOX_PINATAS[SPECIAL]!.row * TILE, w: TILE, h: TILE };

test('GDD-PWR-04 the special piñata gives the Chile Fantasma, and taking it he glows', async ({ page }) => {
  const errors = await standing(page, 424, 96); // on the top right ledge, under the special piñata (the sandbox's Tlacuache walks on, away from him)
  const closed = await api(page, () => window.__PONCHO__!.pinatasDrawn());
  expect(closed).toHaveLength(SANDBOX_PINATAS.length);
  expect(closed[SPECIAL]).toBe(false);
  await page.evaluate((special) => {
    const d = window.__PONCHO__!;
    for (let i = 0; i < 20 && !d.pinatasDrawn()[special]; i++) d.step(1, { move: 0, jumpHeld: true });
  }, SPECIAL);
  expect((await api(page, () => window.__PONCHO__!.pinatasDrawn()))[SPECIAL]).toBe(true);
  // It looks like any other piñata (no new art): the others are drawn the same, so only its open state is read. The pepper stands on its top.
  const items = await api(page, () => window.__PONCHO__!.itemsDrawn());
  expect(items).toHaveLength(1);
  expect(items[0]).toMatchObject({ kind: 'fantasma', x: 424, y: 32 });
  const at = itemAt('fantasma', 424, 32);
  expect(items[0]!.frameAt.x).toBe(at.x);
  expect(items[0]!.frameAt.y).toBe(at.y);
  // To the piñata's left, then a wall kick and a glide (src/levels/sandbox.test.ts): he lands on its top and takes it.
  const taken = await page.evaluate(() => {
    const d = window.__PONCHO__!;
    for (let i = 0; i < 60 && !(d.state().grounded && d.state().y === 96); i++) d.step(1);
    for (let i = 0; i < 40 && d.state().x > 408; i++) d.step(1, { move: -1, jumpHeld: false });
    d.step(30);
    for (let i = 0; i < 120 && d.fantasma() === 0; i++) d.step(1, { move: i < 49 ? 1 : 0, jumpHeld: i < 10 || (i >= 11 && i < 50) });
    return { left: d.fantasma(), lives: d.lives(), items: d.itemsDrawn().length };
  });
  expect(taken).toMatchObject({ lives: 7, items: 0 });
  expect(taken.left).toBeGreaterThan(0);
  const sprite = await api(page, () => window.__PONCHO__!.ponchoSprite());
  const glow = await api(page, () => window.__PONCHO__!.glowDrawn());
  expect(glow).toMatchObject({ look: 'bright', colour: GOLD });
  expect(glow.copies.map((c) => [c.visible, c.frame])).toEqual([[true, sprite.frame], [true, sprite.frame], [true, sprite.frame], [true, sprite.frame]]);
  expect(glow.copies.map((c) => [c.x - sprite.centerX, c.y - sprite.bottom])).toEqual([[-0.5, 0], [0.5, 0], [0, -0.5], [0, 0.5]]);
  expect(errors).toEqual([]);
});

/** Whether a box (`h` px tall) comes within 2 px of the special piñata's. */
const hits = (b: { x: number; y: number; w: number }, h: number) => SPECIAL_BOX.x < b.x + b.w + 2 && SPECIAL_BOX.x + SPECIAL_BOX.w > b.x - 2 && SPECIAL_BOX.y < b.y + h + 2 && SPECIAL_BOX.y + SPECIAL_BOX.h > b.y - 2;

test('GDD-PWR-04 the special piñata clears the HUD and the pause button', async ({ page }) => {
  await standing(page);
  const hud = await api(page, () => window.__PONCHO__!.hudHilos());
  const { buttons } = await api(page, () => window.__PONCHO__!.touch());
  // The hilo counter: its icon left of its text, the text's right edge at hud.right, about 10 px tall from hud.top (the text is 8 px monospace).
  expect(hits({ x: hud.iconX, y: hud.top, w: hud.right - hud.iconX }, 12), JSON.stringify(hud)).toBe(false);
  // Every touch button (the pause button top right, the rest at the bottom corners): none is on the piñata's box.
  for (const b of buttons) expect(hits(b, b.h), `${b.id} ${JSON.stringify(b)}`).toBe(false);
});

test('GDD-PWR-04 the glow is four gold copies of his frame, one drawing pixel off him each way, with sparkles round him', async ({ page }) => {
  const errors = await standing(page);
  expect(await api(page, () => window.__PONCHO__!.glowDrawn())).toMatchObject({ look: null, colour: null, fx: [] });
  await page.evaluate(() => window.__PONCHO__!.setFantasma(300));
  expect(await api(page, () => window.__PONCHO__!.fantasma())).toBe(300);
  const sprite = await api(page, () => window.__PONCHO__!.ponchoSprite());
  const glow = await api(page, () => window.__PONCHO__!.glowDrawn());
  expect(glow.look).toBe('bright');
  expect(glow.colour).toBe(GOLD);
  // Left, right, up and down, half a game px (one drawing pixel of his 96 px frame at 48 game px) from his body, in his frame.
  expect(glow.copies.map((c) => c.visible)).toEqual([true, true, true, true]);
  expect(glow.copies.map((c) => [c.x - sprite.centerX, c.y - sprite.bottom])).toEqual([[-0.5, 0], [0.5, 0], [0, -0.5], [0, 0.5]]);
  for (const c of glow.copies) expect(c.frame).toBe(sprite.frame);
  // Standing: three sparkles and a flame flicker round him, near his middle.
  expect(glow.fx.filter((f) => f.look === 'flame')).toHaveLength(1);
  expect(glow.fx.filter((f) => f.look === 'sparkleStar' || f.look === 'sparklePlus')).toHaveLength(3);
  expect(glow.fx.filter((f) => f.look === 'streak')).toHaveLength(0);
  expect(errors).toEqual([]);
});

test('GDD-PWR-04 the last 2 s dim the glow', async ({ page }) => {
  await standing(page);
  await page.evaluate(() => window.__PONCHO__!.setFantasma(121));
  expect(await api(page, () => window.__PONCHO__!.glowDrawn())).toMatchObject({ look: 'bright', colour: GOLD });
  // One step on, 120 are left: the 2 s warning begins, in pale gold, steady, and what floats round him is gone.
  await page.evaluate(() => window.__PONCHO__!.step(1));
  expect(await api(page, () => window.__PONCHO__!.fantasma())).toBe(120);
  const dim = await api(page, () => window.__PONCHO__!.glowDrawn());
  expect(dim).toMatchObject({ look: 'dim', colour: PALE, fx: [] });
  expect(dim.copies.map((c) => c.visible)).toEqual([true, true, true, true]);
  // Steady: dim at every step of the 2 s, never back to bright and never blinking off.
  const seen = await page.evaluate(() => {
    const d = window.__PONCHO__!;
    const out: string[] = [];
    for (let i = 0; i < 119; i++) {
      d.step(1);
      const g = d.glowDrawn();
      out.push(`${g.look}/${g.colour}/${g.copies.filter((c) => c.visible).length}/${g.fx.length}`);
    }
    return { out, left: d.fantasma() };
  });
  expect(seen.left).toBe(1);
  expect(new Set(seen.out)).toEqual(new Set([`dim/${PALE}/4/0`]));
  // The last step runs it out: no glow at all.
  await page.evaluate(() => window.__PONCHO__!.step(1));
  expect(await api(page, () => window.__PONCHO__!.fantasma())).toBe(0);
  const gone = await api(page, () => window.__PONCHO__!.glowDrawn());
  expect(gone).toMatchObject({ look: null, colour: null, fx: [] });
  expect(gone.copies.map((c) => c.visible)).toEqual([false, false, false, false]);
});

test('GDD-PWR-04 his touch defeats the sandbox Alacrán', async ({ page }) => {
  // On the Alacrán's platform at its left end, walking right into it; he is invulnerable, so nothing the Zopilote does costs him either.
  await standing(page, 72, 160);
  await page.evaluate(() => window.__PONCHO__!.setFantasma(480));
  expect((await api(page, () => window.__PONCHO__!.enemies()))[0]!.alive).toBe(true);
  const after = await page.evaluate(() => {
    const d = window.__PONCHO__!;
    let steps = 0;
    while (steps < 120 && d.enemies()[0]!.alive) {
      d.step(1, { move: 1, jumpHeld: false });
      steps++;
    }
    return { alive: d.enemies()[0]!.alive, lives: d.lives(), phase: d.phase(), steps, power: d.power() };
  });
  expect(after).toMatchObject({ alive: false, lives: 7, phase: 'playing', power: 'base' });
  expect(after.steps).toBeLessThan(120);
});

test('GDD-PWR-04 the glow copies and what floats round him mirror with him and blink with him', async ({ page }) => {
  // In Taco, a spike hit spends the taco and starts the 2.0 s blink (GDD-LIFE-02); then the Chile Fantasma (a test hook, as the sandbox has none to
  // eat on the floor), so that he glows while he blinks, and he turns left.
  await standing(page, 330, 224);
  await page.evaluate(() => {
    const d = window.__PONCHO__!;
    d.setPower('taco');
    for (let i = 0; i < 30 && d.invulnerable() === 0; i++) d.step(1, { move: 1, jumpHeld: false });
    d.setFantasma(300);
  });
  expect(await api(page, () => window.__PONCHO__!.invulnerable())).toBeGreaterThan(0);
  const seen = await page.evaluate(() => {
    const d = window.__PONCHO__!;
    const out: { body: number; flipX: boolean; copies: { alpha: number; flipX: boolean }[]; fx: number[] }[] = [];
    for (let i = 0; i < 40; i++) {
      d.step(1, { move: -1, jumpHeld: false });
      const g = d.glowDrawn();
      out.push({ body: d.bodyAlpha(), flipX: d.ponchoSprite().flipX, copies: g.copies.map((c) => ({ alpha: c.alpha, flipX: c.flipX })), fx: g.fx.map((f) => f.alpha) });
    }
    return out;
  });
  expect(seen.some((s) => s.body < 1)).toBe(true); // the blink's dim steps are among them
  expect(seen.some((s) => s.body === 1)).toBe(true);
  expect(seen.some((s) => s.flipX)).toBe(true); // he faces left
  for (const s of seen) {
    for (const c of s.copies) expect(c, JSON.stringify(s)).toEqual({ alpha: s.body, flipX: s.flipX });
    for (const a of s.fx) expect(a, JSON.stringify(s)).toBe(s.body);
  }
});

test('GDD-PWR-04 the glow is not drawn on the level clear screen', async ({ page }) => {
  await boot(page, '/?level=0-1');
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 5);
  await api(page, () => window.__PONCHO__!.pause(true));
  await page.evaluate(() => {
    const d = window.__PONCHO__!;
    d.setFantasma(300);
    d.step(1);
  });
  expect(await api(page, () => window.__PONCHO__!.glowDrawn().look)).toBe('bright'); // in play it is drawn
  await page.evaluate(() => {
    const d = window.__PONCHO__!;
    d.teleport(1400, 224);
    d.step(1);
  });
  expect(await api(page, () => window.__PONCHO__!.phase())).toBe('clear');
  expect(await api(page, () => window.__PONCHO__!.fantasma())).toBeGreaterThan(0); // the timer stands still on the screen; it is the drawing that is off
  expect(await api(page, () => window.__PONCHO__!.bodyVisible())).toBe(true);
  const glow = await api(page, () => window.__PONCHO__!.glowDrawn());
  expect(glow).toMatchObject({ look: null, colour: null, fx: [] });
  expect(glow.copies.map((c) => c.visible)).toEqual([false, false, false, false]);
});

test('GDD-PWR-04 the glow follows his frames unpaused', async ({ page }) => {
  const errors = await boot(page);
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 10);
  await page.evaluate(() => {
    window.__PONCHO__!.teleport(56, 224);
    window.__PONCHO__!.setFantasma(480);
  });
  await page.keyboard.down('ArrowRight');
  // Over 40 of the game's own frames while he runs, then stands against the wall: the copies' frame is the body's on every one of them.
  const frames = await page.evaluate(
    () =>
      new Promise<{ frame: number; copies: number[]; visible: number; look: string | null; left: number; vx: number }[]>((resolve) => {
        const out: { frame: number; copies: number[]; visible: number; look: string | null; left: number; vx: number }[] = [];
        const tick = () => {
          const d = window.__PONCHO__!;
          const g = d.glowDrawn();
          out.push({ frame: d.ponchoSprite().frame, copies: g.copies.map((c) => c.frame), visible: g.copies.filter((c) => c.visible).length, look: g.look, left: d.fantasma(), vx: d.state().vx });
          if (out.length < 40) requestAnimationFrame(tick);
          else resolve(out);
        };
        requestAnimationFrame(tick);
      }),
  );
  await page.keyboard.up('ArrowRight');
  expect(frames.every((f) => f.left > 0)).toBe(true);
  expect(frames.every((f) => f.look === 'bright' && f.visible === 4)).toBe(true);
  for (const f of frames) expect(f.copies, `body frame ${f.frame}`).toEqual([f.frame, f.frame, f.frame, f.frame]);
  expect(new Set(frames.map((f) => f.frame)).size).toBeGreaterThanOrEqual(3); // run frames, not one picture
  expect(Math.max(...frames.map((f) => f.vx))).toBeGreaterThan(120); // and he ran faster than the usual 120 px/s
  expect(errors).toEqual([]);
});

test('GDD-PWR-04 the picture: a gold pixel where the glow draws its flame beside him', async ({ page }) => {
  // On the wall's top (columns 22 and 23, x 352 to 384), standing: the flame flickers on his left or his right, a spot clear of the touch buttons.
  await standing(page, 372, 176);
  await page.evaluate(() => window.__PONCHO__!.setFantasma(400));
  // Steps on (in the page, L-042) until the flame is on his left, where it is clear of the phone's buttons; the flicker changes sides every 30 steps.
  const flame = await page.evaluate(() => {
    const d = window.__PONCHO__!;
    for (let i = 0; i < 90; i++) {
      const f = d.glowDrawn().fx.find((fx) => fx.look === 'flame');
      if (f && f.x < d.ponchoSprite().centerX) return f;
      d.step(1);
    }
    return null;
  });
  expect(flame).not.toBeNull();
  await twoFrames(page);
  const viewX = (await api(page, () => window.__PONCHO__!.camera())).viewX;
  expect(FLAME_SPOTS.length).toBeGreaterThan(0);
  const clear = await clearOfButtons(page, FLAME_SPOTS.map((s) => ({ x: flame!.x - viewX + s.dx, y: flame!.y + s.dy })));
  expect(clear.length).toBeGreaterThan(0);
  const [mark] = await pixelsAt(page, [clear[0]!]);
  expect(nearHex(mark!, GOLD, 30), JSON.stringify(mark)).toBe(true);
  // Away from him and from everything it draws, the same level is not gold.
  const [away] = await pixelsAt(page, [{ x: 440, y: 24 }]);
  expect(nearHex(away!, GOLD, 30), JSON.stringify(away)).toBe(false);
});
