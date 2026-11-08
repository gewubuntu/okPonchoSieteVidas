// Screenshots of World 2's enemy sprites for visual review (GDD-ENM-03, GDD-ART-05, GDD-ART-06). Run with `npm run shots`; images land in
// shots/ (not committed). Each enemy is read from the level module it plays in (L-062); the game is paused and stepped, so every pose is set in
// steps (L-042). Every enemy of these levels is penned between walls 2 tiles high, so Poncho stands outside the pen unless the shot needs him in it.
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { start } from '../helpers';
import { LEVEL_2_1 } from '../../src/levels/level2-1';
import { LEVEL_2_2 } from '../../src/levels/level2-2';
import { LEVEL_2_3 } from '../../src/levels/level2-3';

const shot = async (page: Page, info: TestInfo, name: string) => {
  await page.waitForTimeout(250); // L-042: a frame to draw before the screenshot, no game time is measured
  await page.screenshot({ path: `shots/${name}-${info.project.name.replace('shots-', '')}.png` });
};
type Input = { move: number; jumpHeld: boolean; claw?: boolean };
const step = (page: Page, n: number, input: Input = { move: 0, jumpHeld: false }) => page.evaluate(({ k, i }) => window.__PONCHO__!.step(k, i), { k: n, i: input });

/** Pauses the game and puts Poncho at (x, y) without stepping, so nothing can hurt him; waits until he is drawn there. */
async function stand(page: Page, x: number, y: number): Promise<void> {
  await page.evaluate(() => window.__PONCHO__!.pause(true));
  await page.evaluate(([px, py]) => window.__PONCHO__!.teleport(px!, py!), [x, y]);
  await page.waitForFunction(([px, py]) => Math.abs(window.__PONCHO__!.bodyPose().x - px!) < 0.01 && Math.abs(window.__PONCHO__!.bodyPose().y - py!) < 0.01, [x, y]);
}
/** Enemy `i` as the scene drew it last, and as it is in the run; waits for a frame drawn after the last step. */
async function drawn(page: Page, i: number) {
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  return page.evaluate((index) => {
    const d = window.__PONCHO__!;
    return { sim: d.enemies()[index]!, drawn: d.enemiesDrawn(), defeats: d.defeatsDrawn() };
  }, i);
}
/** Steps one at a time, up to `max`, until the drawn look of the `kind` enemy matches `look`; returns the look then drawn. */
async function stepToLook(page: Page, kind: string, look: RegExp, max: number): Promise<string | undefined> {
  return page.evaluate(
    async ({ k, source, limit }) => {
      const d = window.__PONCHO__!;
      const re = new RegExp(source);
      let seen: string | undefined;
      for (let n = 0; n <= limit; n++) {
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        seen = d.enemiesDrawn().find((e) => e.kind === k)?.look;
        if (seen && re.test(seen)) break;
        d.step(1);
      }
      return seen;
    },
    { k: kind, source: look.source, limit: max },
  );
}
const index = (level: { enemies: readonly { kind?: string }[] }, kind: string) => level.enemies.findIndex((e) => (e.kind ?? 'alacran') === kind);

test('GDD-ENM-03 2-1: the Paloma walking, in its red telegraph and hovering', async ({ page, isMobile }, info) => {
  await start(page, isMobile, '/?level=2-1'); // the device's way (L-045)
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 5);
  const p = index(LEVEL_2_1, 'paloma');
  const def = LEVEL_2_1.enemies[p]!;
  await stand(page, def.x - 100, def.y); // outside its pen, before the wall
  let now = await drawn(page, p);
  expect(now.sim.phase).toBe('walk');
  expect(now.drawn.find((e) => e.kind === 'paloma' && Math.abs(e.x - now.sim.x) < 1e-6)?.look).toMatch(/^walk[0-3]$/);
  await shot(page, info, 'enemies2-paloma-walk');
  // Inside the pen 30 px from it, on the side with room: it spots him on the next step and flashes red (age 0).
  await stand(page, now.sim.x - 30 >= def.x - 40 ? now.sim.x - 30 : now.sim.x + 30, def.y);
  await step(page, 1);
  now = await drawn(page, p);
  expect(now.sim.phase).toBe('telegraph');
  expect(now.drawn.find((e) => e.kind === 'paloma')?.look).toBe('teleRed');
  await shot(page, info, 'enemies2-paloma-tele');
  await step(page, 30 + 20); // the 30 steps of the telegraph and the 20 of its rise, from the second: its first step hovering
  now = await drawn(page, p);
  expect(now.sim.phase).toBe('hover');
  const hovering = now.drawn.find((e) => e.kind === 'paloma')!;
  expect(hovering.look).toMatch(/^flap[0-3]$/);
  expect(hovering.y).toBeCloseTo(def.y - 40, 2);
  await shot(page, info, 'enemies2-paloma-hover');
});

test('GDD-ENM-03 2-2: the Chapulín crouched and in the air', async ({ page, isMobile }, info) => {
  await start(page, isMobile, '/?level=2-2');
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 5);
  const c = index(LEVEL_2_2, 'chapulin');
  const def = LEVEL_2_2.enemies[c]!;
  await stand(page, def.x - 100, def.y); // outside its pen
  expect(await stepToLook(page, 'chapulin', /^crouch[01]$/, 200)).toMatch(/^crouch[01]$/);
  let now = await drawn(page, c);
  expect(now.sim.phase).toBe('crouch');
  await shot(page, info, 'enemies2-chapulin-crouch');
  expect(await stepToLook(page, 'chapulin', /^rise$/, 100)).toBe('rise');
  now = await drawn(page, c);
  expect(now.sim.phase).toBe('air');
  await shot(page, info, 'enemies2-chapulin-air');
});

test('GDD-ENM-03 2-3: the Trompo spinning, stunned and squashed', async ({ page, isMobile }, info) => {
  await start(page, isMobile, '/?level=2-3');
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 5);
  const t = index(LEVEL_2_3, 'trompo');
  const def = LEVEL_2_3.enemies[t]!;
  await stand(page, def.x - 100, def.y); // outside its pen
  let now = await drawn(page, t);
  expect(now.sim.phase).toBe('spin');
  expect(now.drawn.find((e) => e.kind === 'trompo' && Math.abs(e.x - now.sim.x) < 1e-6)?.look).toMatch(/^spin[0-3]$/);
  await shot(page, info, 'enemies2-trompo-spin');
  // Step until it heads left from the right of its pen, then stand 28 px to its left, facing it, and swipe.
  await page.evaluate(([i, x]) => {
    const d = window.__PONCHO__!;
    for (let k = 0; k < 1200 && !(d.enemies()[i!]!.dir < 0 && d.enemies()[i!]!.x > x! + 20); k++) d.step(1);
  }, [t, def.x]);
  now = await drawn(page, t);
  expect(now.sim.dir).toBeLessThan(0);
  await stand(page, now.sim.x - 28, def.y);
  await step(page, 1, { move: 1, jumpHeld: false });
  await step(page, 3, { move: 0, jumpHeld: false, claw: true });
  now = await drawn(page, t);
  expect(now.sim.phase).toBe('stunned');
  expect(now.drawn.find((e) => e.kind === 'trompo')?.look).toBe('stun');
  await shot(page, info, 'enemies2-trompo-stun');
  // The stomp: run at it and jump, until it is defeated. Poncho is put aside without a step (the squash stays at its age 0).
  await page.evaluate((i) => {
    const d = window.__PONCHO__!;
    for (let k = 0; k < 60 && d.enemies()[i]!.alive; k++) d.step(1, { move: 1, jumpHeld: k < 4 });
  }, t);
  const lying = await page.evaluate((i) => window.__PONCHO__!.enemies()[i]!, t);
  expect(lying.alive).toBe(false);
  await stand(page, lying.x - 40, def.y);
  now = await drawn(page, t);
  expect(now.defeats.map((e) => `${e.kind} ${e.look}`)).toEqual(['trompo squash']);
  await shot(page, info, 'enemies2-trompo-squash');
});
