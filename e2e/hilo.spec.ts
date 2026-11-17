import { expect, test, type Page } from '@playwright/test';
import { TILE } from '../src/config/tuning';
import { LEVEL_3_1, LEVEL_3_1_GROUND } from '../src/levels/level3-1';
import { kindOf } from '../src/sim/enemy';
import { HILO_HUD } from '../src/ui/hiloCounter';
import { boot, clearOfButtons, nearHex, pixelsAt, start } from './helpers';

const api = <T>(page: Page, fn: () => T) => page.evaluate(fn);
const frames = (page: Page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null)))));

/** How far a pixel's colour is from a colour (r, g, b). */
const near = (c: { r: number; g: number; b: number }, to: [number, number, number]) => Math.hypot(c.r - to[0], c.g - to[1], c.b - to[2]);

// The sandbox has 20 hilos. The first is on the floor in tile column 4 (middle x 72, y 216), 16 px right of the spawn; the second
// is in column 6 (x 104), on the other side of the key at column 5.

/** Paused after boot with Poncho on the floor at x = 56, a few steps in, short of the first hilo. */
const atFirst = async (page: Page) => {
  await boot(page);
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 10);
  await page.evaluate(() => {
    window.__PONCHO__!.pause(true);
    window.__PONCHO__!.teleport(56, 224);
    window.__PONCHO__!.step(2);
  });
};
/** Runs right one step at a time until Poncho is past x = 72, which takes the first hilo and not yet the second. */
const pastFirst = (page: Page) =>
  page.evaluate(() => {
    for (let i = 0; i < 60 && window.__PONCHO__!.state().x <= 72; i++) window.__PONCHO__!.step(1, { move: 1, jumpHeld: false });
  });

test('GDD-WLD-04 walking into a hilo collects it: it leaves the level and the counter goes up', async ({ page }) => {
  await atFirst(page);
  expect(await api(page, () => window.__PONCHO__!.hilos())).toEqual({ taken: 0, total: 20, drawn: 20, faded: 0 });
  expect((await api(page, () => window.__PONCHO__!.hudHilos())).text).toBe('0/20');
  await pastFirst(page);
  expect(await api(page, () => window.__PONCHO__!.hilos())).toEqual({ taken: 1, total: 20, drawn: 19, faded: 0 });
  expect((await api(page, () => window.__PONCHO__!.hudHilos())).text).toBe('1/20');
});

test('GDD-LIFE-02 a lost life keeps collected hilos', async ({ page }) => {
  await atFirst(page);
  await pastFirst(page);
  await page.evaluate(() => window.__PONCHO__!.teleport(262, 170)); // into the pit, clear of the hilo over its middle (x 244 to 252) and of the ledge and platform above
  await page.evaluate(() => window.__PONCHO__!.step(140));
  expect(await api(page, () => window.__PONCHO__!.phase())).toBe('playing');
  expect(await api(page, () => window.__PONCHO__!.lives())).toBe(6);
  expect(await api(page, () => window.__PONCHO__!.hilos())).toEqual({ taken: 1, total: 20, drawn: 19, faded: 0 });
  expect((await api(page, () => window.__PONCHO__!.hudHilos())).text).toBe('1/20');
});

test('GDD-WLD-04 a hilo is drawn in its colour and gone once collected', async ({ page }) => {
  await atFirst(page);
  // The first hilo is red (185 72 66) and sits on the far desert's sand (the strip's checker of #E8B87A and #D19A5E, GDD-ART-06) once gone.
  // Its middle is plain colour, 2 px clear of the wraps; the touch buttons are not over it (L-018).
  const spot = { x: 72, y: 216 };
  const buttons = (await api(page, () => window.__PONCHO__!.touch())).buttons;
  expect(buttons.some((b) => spot.x >= b.x && spot.x <= b.x + b.w && spot.y >= b.y && spot.y <= b.y + b.h)).toBe(false);
  await frames(page);
  const [before] = await pixelsAt(page, [spot]);
  expect(near(before!, [185, 72, 66])).toBeLessThan(Math.min(near(before!, [232, 184, 122]), near(before!, [209, 154, 94])));
  expect(near(before!, [185, 72, 66])).toBeLessThan(40);
  await pastFirst(page);
  await page.evaluate(() => window.__PONCHO__!.teleport(300, 100)); // out of the way, so he is not drawn over the spot
  await page.evaluate(() => window.__PONCHO__!.step(1));
  await frames(page);
  const [after] = await pixelsAt(page, [spot]);
  expect(Math.min(near(after!, [232, 184, 122]), near(after!, [209, 154, 94]))).toBeLessThan(near(after!, [185, 72, 66]));
});

test('GDD-UI-01 the counter is top-right, left of the pause button on touch', async ({ page, isMobile }) => {
  await atFirst(page);
  const hud = await api(page, () => window.__PONCHO__!.hudHilos());
  expect(hud.top).toBe(8);
  const touch = await api(page, () => window.__PONCHO__!.touch());
  if (isMobile) {
    const pause = touch.buttons.find((b) => b.id === 'pause')!;
    expect(touch.visible).toBe(true);
    expect(hud.right).toBe(pause.x - 6);
  } else {
    expect(hud.right).toBe(472);
  }
  expect(hud.iconX).toBeLessThan(hud.right);
});

test('GDD-UI-01 the counter updates in real play', async ({ page }) => {
  // Unpaused (L-021): nothing but the scene's own frames redraws the counter.
  await boot(page);
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 10);
  await page.evaluate(() => window.__PONCHO__!.teleport(56, 224));
  expect((await api(page, () => window.__PONCHO__!.hudHilos())).text).toBe('0/20');
  await page.keyboard.down('ArrowRight');
  await page.waitForFunction(() => window.__PONCHO__!.hudHilos().text === '1/20');
  await page.keyboard.up('ArrowRight');
  expect((await api(page, () => window.__PONCHO__!.hilos())).taken).toBeGreaterThanOrEqual(1);
});

/** The middle of 3-1's tile column `col`, and the top row of its ground there. */
const mid = (col: number) => col * TILE + TILE / 2;
const groundRow = (col: number): number => LEVEL_3_1_GROUND.find((s) => col >= s.col0 && col <= s.col1)!.row;
/**
 * The hilo counter's glyphs are 8 px text smoothed at 1 game px, so their pale (#fff3dc) mixes with the outline's dark at their edges: a
 * pixel within 120 of it (RGB distance) and as blue as those mixes (blue over 0.8 of red) is a glyph's; 3-1's ochre rock and its pale
 * specks are yellower. The outline is the lives' dark (GDD-UI-01).
 */
const pale = (c: { r: number; g: number; b: number }) => Math.hypot(c.r - 0xff, c.g - 0xf3, c.b - 0xdc) < 120 && c.b > 0.8 * c.r;
const dark = (c: { r: number; g: number; b: number }) => nearHex(c, '#2a1f2e', 24);

/**
 * The colours of the screenshot's pixels over a box of the game (game px, `x1` and `y1` left out), row by row at the screenshot's own
 * scale, and the screenshot's px per game px (`k`).
 */
async function screenBox(page: Page, area: { x0: number; y0: number; x1: number; y1: number }) {
  const canvas = (await page.locator('canvas').boundingBox())!;
  const png = await page.screenshot();
  return page.evaluate(
    async ({ b64, c, area: box }) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const cv = document.createElement('canvas');
      [cv.width, cv.height] = [img.width, img.height];
      const ctx = cv.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      const k = (c.width / 480) * (img.width / window.innerWidth); // screenshot px per game px
      const at = (gx: number, gy: number) => [Math.round(c.x * (img.width / window.innerWidth) + gx * k), Math.round(c.y * (img.width / window.innerWidth) + gy * k)] as const;
      const [sx0, sy0] = at(box.x0, box.y0);
      const [sx1, sy1] = at(box.x1, box.y1);
      const data = ctx.getImageData(sx0, sy0, sx1 - sx0, sy1 - sy0).data;
      const px = Array.from({ length: sy1 - sy0 }, (_r, y) => Array.from({ length: sx1 - sx0 }, (_c, x) => ({ r: data[(y * (sx1 - sx0) + x) * 4]!, g: data[(y * (sx1 - sx0) + x) * 4 + 1]!, b: data[(y * (sx1 - sx0) + x) * 4 + 2]! })));
      return { k, px };
    },
    { b64: png.toString('base64'), c: canvas, area },
  );
}

test('GDD-UI-01 the hilo counter is drawn with a dark outline, its digits where they were', async ({ page, isMobile }) => {
  // In 3-1 at the lower pen, where the buttress's pale rock is behind the counter, reached as its screenshot scenario does: the arc's four
  // hilos taken over the flat, then a few tiles before the pen's Alacrán.
  await start(page, isMobile, '/?level=3-1');
  const taken = await page.evaluate(() => {
    const d = window.__PONCHO__!;
    d.pause(true);
    for (let i = 0; i < 30 && !d.state().grounded; i++) d.step(1);
    let [jumped, air] = [false, false];
    for (let i = 0; i < 300 && !(air && d.state().grounded); i++) {
      if (!jumped && d.state().x >= 92) jumped = true;
      d.step(1, { move: 1, jumpHeld: jumped });
      air ||= !d.state().grounded;
    }
    d.step(10);
    return d.hilos().taken;
  });
  expect(taken).toBe(4);
  const pen = Math.floor(LEVEL_3_1.enemies.find((e) => kindOf(e) === 'alacran' && Math.floor(e.x / TILE) === 157)!.x / TILE) - 7;
  const stood = await page.evaluate(
    ([x, y, to]) => {
      const d = window.__PONCHO__!;
      d.teleport(x!, y! - 1);
      for (let i = 0; i < 30 && !d.state().grounded; i++) d.step(1);
      for (let i = 0; i < 300 && d.state().x < to!; i++) d.step(1, { move: 1, jumpHeld: false });
      for (let i = 0; i < 30 && d.state().vx !== 0; i++) d.step(1);
      return d.state();
    },
    [mid(pen - 3), groundRow(pen - 3) * TILE, mid(pen)],
  );
  expect(stood).toMatchObject({ grounded: true, y: groundRow(pen) * TILE });
  const hud = await api(page, () => window.__PONCHO__!.hudHilos());
  expect(hud).toMatchObject({ text: '4/50', top: 8, outline: HILO_HUD.outline });
  // Unpaused, through two of the game's own frames (L-021).
  await page.evaluate(() => window.__PONCHO__!.pause(false));
  await frames(page);
  // The glyphs' box: from the icon's right edge and its gap to the text's right edge, from its top 11 px down (8 px text), clear of the
  // touch buttons (L-018); and around it the 1 px where the outline lies.
  const glyphs = { x0: hud.iconX + HILO_HUD.iconSize / 2 + HILO_HUD.iconGap, y0: hud.top, x1: hud.right, y1: hud.top + 11 };
  expect(await clearOfButtons(page, [{ x: glyphs.x0 - 1, y: glyphs.y0 - 1 }, { x: glyphs.x1, y: glyphs.y1 }], 0)).toHaveLength(2);
  const { k, px } = await screenBox(page, { x0: glyphs.x0 - 1, y0: glyphs.y0 - 1, x1: glyphs.x1, y1: glyphs.y1 });
  const edge = Math.round(k); // the screenshot's px in the 1 game px round the glyphs
  const glyph: { x: number; y: number }[] = [];
  px.forEach((row, y) => row.forEach((c, x) => x >= edge && y >= edge && pale(c) && glyph.push({ x, y })));
  expect(glyph.length).toBeGreaterThan(0);
  const left = Math.min(...glyph.map((p) => p.x));
  const top = Math.min(...glyph.map((p) => p.y));
  // The digits sit in the box the hook gives, whatever the monospace font: their rightmost pale column at most 2 game px inside its right
  // edge, and their top at or under its top (the text object's top plus half its stroke) and within the 8 px line. The font's ascent moves
  // the top: measured 1.9 game px under it on the desktop here and 2.1 on the phone, 0.75 on CI's runner (another font); the right edge 1.1
  // and 1.4 here, 1.1 on CI.
  const fromRight = (px[0]!.length - 1 - Math.max(...glyph.map((p) => p.x))) / k;
  const fromTop = (top - edge) / k;
  expect([fromRight >= 0 && fromRight <= 2, fromTop >= 0.5 && fromTop <= 4], `${fromRight}, ${fromTop}`).toEqual([true, true]);
  // Dark pixels lie within 1 game px left of the leftmost pale column and above the topmost pale row, on the rows and columns of it.
  const leftOf = glyph.filter((p) => p.x === left).some((p) => Array.from({ length: edge }, (_, j) => px[p.y]![p.x - 1 - j]).some((c) => c !== undefined && dark(c)));
  const above = glyph.filter((p) => p.y === top).some((p) => Array.from({ length: edge }, (_, j) => px[p.y - 1 - j]?.[p.x]).some((c) => c !== undefined && dark(c)));
  expect([leftOf, above]).toEqual([true, true]);
  // The icon's dark edge: in the 1 px ring left of the coil (radius 4 about `iconX`), on the rows about its middle.
  const ring = await screenBox(page, { x0: hud.iconX - 5, y0: hud.top + 3, x1: hud.iconX - 4, y1: hud.top + 8 });
  expect(ring.px.flat().some(dark), JSON.stringify(ring.px)).toBe(true);
});

