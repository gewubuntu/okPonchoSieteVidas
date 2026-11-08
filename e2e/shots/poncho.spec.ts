// Screenshots of Poncho's animations, the taco, the chile and the claw swipe for visual review (GDD-ART-04, GDD-PWR-02, GDD-PWR-03,
// GDD-CMB-02): each animation's key frame in World 1's 1-1 and on a World 2 rooftop in 2-1. Run with `npm run shots`; images land in shots/
// (not committed). Each scene is reached step by step in the paused game (L-042) by the real inputs, until the frame it is named for shows
// (read back from the images, L-016).
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { LEVEL_1_1 } from '../../src/levels/level1-1';
import { start } from '../helpers';

const shot = async (page: Page, info: TestInfo, name: string) => {
  await page.waitForTimeout(250); // L-042: real time only lets the frame render before the picture; nothing is timed by it
  await page.screenshot({ path: `shots/${name}-${info.project.name.replace('shots-', '')}.png` });
};
type Input = { move: number; jumpHeld: boolean; claw?: boolean; fuego?: boolean };
const IDLE: Input = { move: 0, jumpHeld: false };

/** The middle of tile column `col`, in px. */
const mid = (col: number) => col * 16 + 8;
// 1-1 (L-062: from the level): the floor's top is y 224 (the spawn's), the first piñata at column 34 hangs over it, and the first spikes
// lie at columns 39 and 40.
const FLOOR = LEVEL_1_1.spawn.y;
const PINATA = LEVEL_1_1.pinatas[0]!;
const SPIKE = LEVEL_1_1.spikes[0]!;
// 2-1: the second rooftop, columns 98 to 110, its top y 112 (src/levels/level2-1.test.ts), with no enemy on it.
const ROOF = { x: mid(104), y: 112 };

/** Starts the level the device's way (L-045), pauses, and stands Poncho at (x, y) in `power`, settled for 10 steps. */
async function begin(page: Page, isMobile: boolean, path: string, x: number, y: number, power: 'base' | 'taco' | 'fuego' = 'base'): Promise<void> {
  await start(page, isMobile, path);
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 10);
  await page.evaluate(({ px, py, p }) => {
    const d = window.__PONCHO__!;
    d.pause(true);
    d.setPower(p);
    d.teleport(px, py);
    d.step(10);
  }, { px: x, py: y, p: power });
}

/** Steps with `input` until Poncho's frame is `look` (with that swipe or effect drawn, if given), at most `max` steps; returns whether it got there. */
const until = (page: Page, look: string, input: Input, max = 120, also: { swipe?: string; fx?: string } = {}) =>
  page.evaluate(
    ({ l, i, m, a }) => {
      const d = window.__PONCHO__!;
      const ok = () => d.ponchoSprite().look === l && (a.swipe === undefined || d.swipeDrawn()?.look === a.swipe) && (a.fx === undefined || d.fxDrawn()[0]?.look === a.fx);
      for (let n = 0; n < m && !ok(); n++) d.step(1, i);
      return ok();
    },
    { l: look, i: input, m: max, a: also },
  );

/** The frames of the moves and actions that need no thing of the level's, at (x, y), named `where`. */
async function moves(page: Page, isMobile: boolean, info: TestInfo, path: string, x: number, y: number, where: string): Promise<void> {
  await begin(page, isMobile, path, x, y);
  expect(await page.evaluate(() => window.__PONCHO__!.ponchoSprite().look)).toBe('idle');
  await shot(page, info, `poncho-${where}-stand`);
  expect(await until(page, 'run1', { move: 1, jumpHeld: false })).toBe(true);
  await shot(page, info, `poncho-${where}-run`);
  expect(await until(page, 'skid', { move: -1, jumpHeld: false })).toBe(true);
  await shot(page, info, `poncho-${where}-skid`);
  await page.evaluate(([px, py]) => (window.__PONCHO__!.teleport(px!, py!), window.__PONCHO__!.step(20)), [x, y]);
  for (const [look, name] of [['jump0', 'jump'], ['jump1', 'rise'], ['apex', 'apex'], ['fall0', 'fall'], ['fall1', 'fall-fast'], ['land', 'land']] as const) {
    expect(await until(page, look, { move: 0, jumpHeld: true }), look).toBe(true);
    await shot(page, info, `poncho-${where}-${name}`);
  }
  await page.evaluate(() => window.__PONCHO__!.step(20));
  await page.evaluate(() => window.__PONCHO__!.step(1, { move: 0, jumpHeld: false, claw: true }));
  expect(await until(page, 'clawSwipe', IDLE, 5, { swipe: 'swipe1' })).toBe(true);
  await shot(page, info, `poncho-${where}-claw`);
  expect(await until(page, 'clawFollow', IDLE, 5, { swipe: 'swipe2' })).toBe(true);
  await shot(page, info, `poncho-${where}-claw-follow`);
  await page.evaluate(() => (window.__PONCHO__!.setPower('taco'), window.__PONCHO__!.step(20)));
  expect(await page.evaluate(() => window.__PONCHO__!.heldDrawn()?.look)).toBe('tacoHeld');
  await shot(page, info, `poncho-${where}-holding-taco`);
  await page.evaluate(() => (window.__PONCHO__!.setPower('fuego'), window.__PONCHO__!.step(1)));
  expect(await page.evaluate(() => window.__PONCHO__!.heldDrawn()?.look)).toBe('chileHeld');
  await shot(page, info, `poncho-${where}-holding-chile`);
  await page.evaluate(() => window.__PONCHO__!.step(1, { move: 0, jumpHeld: false, fuego: true }));
  expect(await until(page, 'spit1', IDLE, 10, { fx: 'flame1' })).toBe(true);
  await shot(page, info, `poncho-${where}-spit`);
}

test('GDD-ART-04 Poncho in 1-1: standing, running, the skid, the jump, the claw swipe, holding the taco and the chile, the spit', async ({ page, isMobile }, info) => {
  await moves(page, isMobile, info, '/?level=1-1', mid(30), FLOOR, 'w1');
});

test('GDD-ART-04 Poncho on a 2-1 rooftop: standing, running, the skid, the jump, the claw swipe, holding the taco and the chile, the spit', async ({ page, isMobile }, info) => {
  await moves(page, isMobile, info, '/?level=2-1', ROOF.x, ROOF.y, 'w2-roof');
});

test('GDD-ART-04 1-1: the piñata\'s taco and chile, eating the taco with its crumbs, the hurt on the spikes, the respawn flip', async ({ page, isMobile }, info) => {
  // In Base a bump from under the piñata lets out a taco, which walks; he walks after it and eats it.
  await begin(page, isMobile, '/?level=1-1', mid(PINATA.col), FLOOR);
  await page.evaluate(() => {
    const d = window.__PONCHO__!;
    for (let i = 0; i < 40 && d.itemsDrawn().length === 0; i++) d.step(1, { move: 0, jumpHeld: true });
    d.step(30); // the taco walks off the piñata and drops to the floor
  });
  expect((await page.evaluate(() => window.__PONCHO__!.itemsDrawn()))[0]?.kind).toBe('taco');
  await shot(page, info, 'poncho-w1-taco-pickup');
  expect(await until(page, 'eat0', { move: 1, jumpHeld: false }, 200)).toBe(true);
  expect(await until(page, 'eat1', IDLE, 20, { fx: 'crumbs0' })).toBe(true); // stopped short of the spikes
  await shot(page, info, 'poncho-w1-eat');
  // In Taco the piñata lets out a chile, which stays on top of it (GDD-PWR-03): the level afresh, the piñata shut again.
  await begin(page, isMobile, '/?level=1-1', mid(PINATA.col), FLOOR, 'taco');
  await page.evaluate(() => {
    const d = window.__PONCHO__!;
    for (let i = 0; i < 40 && d.itemsDrawn().length === 0; i++) d.step(1, { move: 0, jumpHeld: true });
    d.step(40);
  });
  expect((await page.evaluate(() => window.__PONCHO__!.itemsDrawn()))[0]?.kind).toBe('chile');
  await shot(page, info, 'poncho-w1-chile-pickup');
  // In Taco he walks into the spikes: hurt, the sombrero tipping off.
  await page.evaluate((x) => (window.__PONCHO__!.teleport(x, 224), window.__PONCHO__!.step(2)), SPIKE.col * 16 - 30);
  expect(await until(page, 'hurt0', { move: 1, jumpHeld: false }, 60)).toBe(true);
  await shot(page, info, 'poncho-w1-hurt');
  expect(await until(page, 'hurt1', IDLE, 10)).toBe(true);
  await shot(page, info, 'poncho-w1-hurt-late');
  // In Base the spikes cost a life, once his 2 s of invulnerability are over: the flip in at the respawn point, no button held (any would skip it).
  await page.evaluate(() => {
    const d = window.__PONCHO__!;
    d.step(130);
    for (let i = 0; i < 120 && d.phase() === 'playing'; i++) d.step(1, { move: 1, jumpHeld: false });
  });
  expect(await until(page, 'flip3', IDLE, 60)).toBe(true);
  expect(await page.evaluate(() => window.__PONCHO__!.phase())).toBe('respawning');
  await shot(page, info, 'poncho-w1-flip');
});
