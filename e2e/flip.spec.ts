import { expect, test, type Page } from '@playwright/test';
import { PONCHO_LOOKS } from '../src/ui/ponchoLooks';
import { boot, clearOfButtons, nearHex, pixelsAt, readSheet, spotsIn, stepUntil } from './helpers';

const FLOOR = 224; // the sandbox floor, and the level start is at x = 56
// GDD-ART-04: the turn is drawn by the flip's frames (flip0 to flip7, 45 degrees apart), not by turning the body, so `look` says how far he has turned.
const pose = (page: Page) => page.evaluate(() => ({ ...window.__PONCHO__!.bodyPose(), visible: window.__PONCHO__!.bodyVisible(), look: window.__PONCHO__!.ponchoSprite().look }));
/** How far round a flip frame is, in eighths of a turn. */
const eighths = (look: string) => Number(/^flip(\d)$/.exec(look)?.[1] ?? NaN);
const BLUE = '#3F66B1'; // his poncho's blue (GDD-ART-02)
// Close, so the blue mountains behind him (#4D5A9C, GDD-ART-06) do not count: the art's blue is drawn as it is.
const blue = (c: { r: number; g: number; b: number }) => nearHex(c, BLUE, 12);
// Where his frames have a square of solid blue 1.5 game px across (3 x 3 of the drawing's pixels), read from his sheet (game px from the
// frame's middle, facing right): in flip4 (half a turn) where the standing frame is clear, and in the standing frame where flip4 is clear.
const SHEET = readSheet('poncho.png');
const FLIP4_BLUE = spotsIn(SHEET, 48, 48, PONCHO_LOOKS.indexOf('flip4'), BLUE, { size: 1.5, not: PONCHO_LOOKS.indexOf('idle') });
const IDLE_BLUE = spotsIn(SHEET, 48, 48, PONCHO_LOOKS.indexOf('idle'), BLUE, { size: 1.5, not: PONCHO_LOOKS.indexOf('flip4') });
/** A spot of his frame on the screen, his feet at (x, y): the frame's middle is 24 px above his feet. */
const onScreen = (p: { x: number; y: number }, s: { dx: number; dy: number }) => ({ x: p.x + s.dx, y: p.y - 24 + s.dy });
const step = (page: Page, n: number, input?: { move: number; jumpHeld: boolean }) =>
  page.evaluate(([k, i]) => window.__PONCHO__!.step(k, i), [n, input] as const);

/** Drops Poncho into the pit with the game paused, and steps to the first step of the 0.8 s wait (48 steps left). */
async function fallIntoPit(page: Page) {
  await boot(page);
  await page.evaluate(() => {
    window.__PONCHO__!.pause(true);
    window.__PONCHO__!.teleport(248, 150); // above the pit
  });
  await stepUntil(page, { phase: 'respawning' }, 200);
  expect(await page.evaluate(() => window.__PONCHO__!.phase())).toBe('respawning');
}

test('GDD-LIFE-02 Poncho is hidden for the first part of the wait, then drops in above the level start', async ({ page }) => {
  await fallIntoPit(page);
  await step(page, 26); // 22 steps of the wait left: the flip has not started
  expect((await pose(page)).visible).toBe(false);
  await step(page, 1); // 21 left: the first step of the flip
  const first = await pose(page);
  expect(first.visible).toBe(true);
  expect(first.x).toBe(56);
  expect(FLOOR - first.y).toBeGreaterThan(46); // about 48 px above the ground
  expect(FLOOR - first.y).toBeLessThanOrEqual(48);
  expect(first.look).toBe('flip0'); // turned 17 degrees: the nearest frame is the first
  expect(first.rotation).toBe(0);
});

test('GDD-MOV-05 he turns once and lands feet-first on the last step of the wait, and does not jump when control returns', async ({ page }) => {
  await fallIntoPit(page);
  await step(page, 27); // the first step of the flip
  let last = await pose(page);
  // Follow the turn as the sum of the frame changes, an eighth each: never back, never more than one at a step.
  let turned = 0;
  for (let i = 0; i < 19; i++) {
    await step(page, 1);
    const now = await pose(page);
    expect(now.y).toBeGreaterThan(last.y); // falling
    const delta = (eighths(now.look) - eighths(last.look) + 8) % 8;
    expect(delta, `${last.look} to ${now.look}`).toBeLessThanOrEqual(1); // and turning the same way every step
    turned += delta;
    last = now;
  }
  await step(page, 1); // one step of the wait left: on the ground, a whole turn done
  turned += (eighths((await pose(page)).look) - eighths(last.look) + 8) % 8;
  last = await pose(page);
  expect(last.y).toBe(FLOOR);
  expect(last.look).toBe('flip0'); // upright, feet down
  expect(last.rotation).toBe(0);
  expect(turned).toBe(8); // after one whole turn, not a half or two
  await step(page, 1); // the wait is over: playing, upright, same place
  expect(await page.evaluate(() => window.__PONCHO__!.phase())).toBe('playing');
  const landed = await pose(page);
  expect(landed.y).toBe(FLOOR);
  expect(landed.rotation).toBe(0);
  expect(landed.look).toBe('idle');
  expect(await page.evaluate(() => window.__PONCHO__!.state())).toMatchObject({ x: 56, y: FLOOR, grounded: true });
});

test('GDD-MOV-05 the drawn body really turns: his poncho is where it should be upside down, and upright after', async ({ page }) => {
  await fallIntoPit(page);
  await step(page, 27 + 10); // wait 11: upside down, about 188 degrees
  const p0 = await pose(page);
  expect(p0.look).toBe('flip4');
  // Spots clear of the phone's touch buttons (L-018): where flip4 is blue and the standing frame clear, and the other way round.
  const turned = await clearOfButtons(page, FLIP4_BLUE.map((s) => onScreen(p0, s)));
  const upright = await clearOfButtons(page, IDLE_BLUE.map((s) => onScreen(p0, s)));
  expect(turned.length).toBeGreaterThan(0);
  expect(upright.length).toBeGreaterThan(0);
  const [mark] = await pixelsAt(page, [turned[0]!]);
  expect(blue(mark!), JSON.stringify(mark)).toBe(true); // it has turned with him
  const [ifUpright] = await pixelsAt(page, [upright[0]!]); // where it would be if he had not turned
  expect(blue(ifUpright!)).toBe(false); // that is sky now

  await step(page, 10); // wait 1 left, then 1 more: landed, upright
  await step(page, 1);
  await step(page, 120); // out of the blink, fully opaque
  const p = await pose(page);
  const [standing] = await pixelsAt(page, (await clearOfButtons(page, IDLE_BLUE.map((s) => onScreen(p, s)))).slice(0, 1));
  expect(blue(standing!)).toBe(true);
});

test('GDD-LIFE-02 the flip lands at the latest ofrenda, not the level start', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => {
    window.__PONCHO__!.pause(true);
    window.__PONCHO__!.teleport(312, 224); // on the second ofrenda...
  });
  await step(page, 2);
  expect(await page.evaluate(() => window.__PONCHO__!.checkpoint())).toMatchObject({ x: 312, y: FLOOR });
  await page.evaluate(() => window.__PONCHO__!.teleport(248, 150)); // ...then fall into the pit
  await stepUntil(page, { phase: 'respawning' }, 200);
  await step(page, 27 + 10); // in the middle of the flip
  const middle = await pose(page);
  expect(middle.visible).toBe(true);
  expect(middle.x).toBe(312);
  await step(page, 11); // landed and respawned
  expect(await page.evaluate(() => window.__PONCHO__!.state())).toMatchObject({ x: 312, y: FLOOR, grounded: true });
});

test('GDD-LIFE-05 after the last life there is no flip until the screen is done, then it lands at the level start', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => {
    window.__PONCHO__!.pause(true);
    window.__PONCHO__!.teleport(312, 224); // the second ofrenda is the checkpoint...
  });
  await step(page, 2);
  expect(await page.evaluate(() => window.__PONCHO__!.checkpoint())).toMatchObject({ x: 312 });
  for (let i = 0; i < 6; i++) await page.evaluate(() => window.__PONCHO__!.loseLife()); // ...but only one life is left
  await page.evaluate(() => window.__PONCHO__!.teleport(248, 150));
  await stepUntil(page, { phase: 'respawning' }, 200);
  expect(await page.evaluate(() => window.__PONCHO__!.lives())).toBe(0);
  // Through the whole wait, where a respawn would flip in: his body is hidden after each of the 47 steps (read in the page, one round trip).
  const shown = await page.evaluate(() => {
    const d = window.__PONCHO__!;
    return Array.from({ length: 47 }, () => (d.step(1), d.bodyVisible()));
  });
  expect(shown).toEqual(Array.from({ length: 47 }, () => false));
  await step(page, 1);
  expect(await page.evaluate(() => window.__PONCHO__!.phase())).toBe('gameover');
  await step(page, 60); // the screen's first second
  await step(page, 1, { move: 0, jumpHeld: true });
  expect(await page.evaluate(() => window.__PONCHO__!.lives())).toBe(7);
  await step(page, 10); // in the middle of the flip
  const middle = await pose(page);
  expect(middle.visible).toBe(true);
  expect(middle.x).toBe(56); // over the level start
  await step(page, 11);
  expect(await page.evaluate(() => window.__PONCHO__!.state())).toMatchObject({ x: 56, y: FLOOR });
  expect(await page.evaluate(() => window.__PONCHO__!.phase())).toBe('playing');
});

test('GDD-LIFE-02 a skip in the middle of the flip puts him upright at the respawn point at once', async ({ page }) => {
  await fallIntoPit(page);
  await step(page, 27 + 10); // wait 11: upside down in mid-air
  const before = await pose(page);
  expect(before.y).toBeLessThan(FLOOR - 20);
  expect(before.look).toBe('flip4'); // clearly not upright
  await step(page, 1, { move: 1, jumpHeld: false }); // any input after 0.3 s skips the rest of the wait
  expect(await page.evaluate(() => window.__PONCHO__!.phase())).toBe('playing');
  const after = await pose(page);
  expect(after).toMatchObject({ x: 56, y: FLOOR, rotation: 0, visible: true });
  expect(after.look).not.toMatch(/^flip/);
});

test('GDD-LIFE-02 a skip before the flip starts never shows a flip', async ({ page }) => {
  await fallIntoPit(page);
  await step(page, 20); // 28 steps of the wait left, still hidden
  expect((await pose(page)).visible).toBe(false);
  await step(page, 1, { move: 1, jumpHeld: false }); // skipped: no flip is drawn
  expect(await page.evaluate(() => window.__PONCHO__!.phase())).toBe('playing');
  expect(await pose(page)).toMatchObject({ x: 56, y: FLOOR, rotation: 0, visible: true });
});
