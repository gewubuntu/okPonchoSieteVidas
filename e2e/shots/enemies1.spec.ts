// Screenshots of World 1's enemy sprites for visual review (GDD-ENM-02, GDD-ART-05). Run with `npm run shots`; images land in shots/
// (not committed). Each enemy is read from the level module it plays in (L-062); the game is paused and stepped, so every pose is set in steps.
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { start } from '../helpers';
import { LEVEL_1_1 } from '../../src/levels/level1-1';
import { LEVEL_1_2 } from '../../src/levels/level1-2';
import { LEVEL_2_3 } from '../../src/levels/level2-3';

const shot = async (page: Page, info: TestInfo, name: string) => {
  await page.waitForTimeout(250); // L-042: a frame to draw before the screenshot, no game time is measured
  await page.screenshot({ path: `shots/${name}-${info.project.name.replace('shots-', '')}.png` });
};
type Input = { move: number; jumpHeld: boolean };
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
const index = (level: { enemies: readonly { kind?: string }[] }, kind: string) => level.enemies.findIndex((e) => (e.kind ?? 'alacran') === kind);

test('GDD-ENM-02 1-1: the Alacran walking and stomped, the Zopilote flapping and in its red telegraph, the cactus buddy dozing and alarmed', async ({ page, isMobile }, info) => {
  await start(page, isMobile, '/?level=1-1'); // the device's way (L-045)
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 5);
  const a = index(LEVEL_1_1, 'alacran');
  const alacran = LEVEL_1_1.enemies[a]!;
  await stand(page, alacran.x - 64, 224);
  let now = await drawn(page, a);
  expect(now.drawn.find((e) => e.kind === 'alacran' && Math.abs(e.x - now.sim.x) < 1e-6)?.look).toMatch(/^walk[0-3]$/);
  await shot(page, info, 'enemies1-alacran-walk');
  // The stomp: falling onto it from 10 px above its top, stepped until it is defeated.
  await stand(page, now.sim.x, 224 - 10 - 10);
  await page.evaluate((i) => {
    const d = window.__PONCHO__!;
    for (let k = 0; k < 30 && d.enemies()[i]!.alive; k++) d.step(1);
  }, a);
  // Put aside without a step (the squash stays at its age 0), so he does not stand over it in the picture.
  await stand(page, now.sim.x - 40, 224);
  now = await drawn(page, a);
  expect(now.sim.alive).toBe(false);
  expect(now.defeats.map((e) => e.look)).toEqual(['squash']);
  await shot(page, info, 'enemies1-alacran-squash');
  await step(page, 13); // age 13: the poof's second frame
  now = await drawn(page, a);
  expect(now.defeats.map((e) => e.look)).toEqual(['poof1']);
  await shot(page, info, 'enemies1-poof');

  const z = index(LEVEL_1_1, 'zopilote');
  const zopilote = LEVEL_1_1.enemies[z]!;
  await stand(page, zopilote.x - 130, 224); // too far across for it to spot him
  now = await drawn(page, z);
  expect(now.sim.phase).toBe('cruise');
  expect(now.drawn.find((e) => e.kind === 'zopilote')?.look).toMatch(/^flap[0-3]$/);
  await shot(page, info, 'enemies1-zopilote-flap');
  await stand(page, now.sim.x - 30, 224); // under it: it spots him on the next step
  await step(page, 1);
  now = await drawn(page, z);
  expect(now.sim.phase).toBe('telegraph');
  expect(now.drawn.find((e) => e.kind === 'zopilote')?.look).toBe('teleRed');
  await shot(page, info, 'enemies1-zopilote-telegraph');

  const c = index(LEVEL_1_1, 'cactus');
  const cactus = LEVEL_1_1.enemies[c]!;
  await stand(page, cactus.x - 100, 224);
  now = await drawn(page, c);
  expect(now.drawn.find((e) => e.kind === 'cactus' && e.x === cactus.x)?.look).toMatch(/^doze[01]$/);
  await shot(page, info, 'enemies1-cactus-doze');
  await stand(page, cactus.x - 22, 224); // right beside it
  now = await drawn(page, c);
  expect(now.drawn.find((e) => e.kind === 'cactus' && e.x === cactus.x)).toMatchObject({ look: expect.stringMatching(/^alarm[01]$/), flip: true });
  await shot(page, info, 'enemies1-cactus-alarm');
});

test('GDD-ENM-02 1-2: the Tlacuache walking, hissing in its telegraph and playing dead', async ({ page, isMobile }, info) => {
  await start(page, isMobile, '/?level=1-2');
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 5);
  const t = index(LEVEL_1_2, 'tlacuache');
  const tlacuache = LEVEL_1_2.enemies[t]!;
  await stand(page, tlacuache.x - 120, tlacuache.y); // behind it, out of its sight
  let now = await drawn(page, t);
  expect(now.sim.phase).toBe('walk');
  await shot(page, info, 'enemies1-tlacuache-walk');
  // Step until it heads right, then stand 30 px in front of it: it spots him and hisses (the plain half of its flash, age 4).
  const x = await page.evaluate((i) => {
    const d = window.__PONCHO__!;
    for (let k = 0; k < 600 && d.enemies()[i]!.dir < 0; k++) d.step(1);
    return d.enemies()[i]!.x;
  }, t);
  await stand(page, x + 30, tlacuache.y);
  await step(page, 5);
  now = await drawn(page, t);
  expect(now.sim.phase).toBe('telegraph');
  expect(now.drawn.find((e) => e.kind === 'tlacuache')?.look).toBe('tele');
  await shot(page, info, 'enemies1-tlacuache-hiss');
  // Out of its way until it has charged and walks again, then the stomp: it plays dead. Poncho is put aside to show it lying there.
  await stand(page, x - 200, tlacuache.y);
  await page.evaluate((i) => {
    const d = window.__PONCHO__!;
    for (let k = 0; k < 600 && d.enemies()[i]!.phase !== 'walk'; k++) d.step(1);
  }, t);
  const lying = await page.evaluate((i) => window.__PONCHO__!.enemies()[i]!, t);
  await stand(page, lying.x, lying.y - 20);
  await page.evaluate((i) => {
    const d = window.__PONCHO__!;
    for (let k = 0; k < 30 && d.enemies()[i]!.phase !== 'dead'; k++) d.step(1);
  }, t);
  await stand(page, lying.x - 60, lying.y);
  now = await drawn(page, t);
  expect(now.sim.phase).toBe('dead');
  expect(now.drawn.find((e) => e.kind === 'tlacuache')?.look).toBe('dead');
  await shot(page, info, 'enemies1-tlacuache-dead');
});

test('GDD-ENM-02 2-3: the Alacran and the Tlacuache on the roofs', async ({ page, isMobile }, info) => {
  await start(page, isMobile, '/?level=2-3');
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 5);
  const a = index(LEVEL_2_3, 'alacran');
  const alacran = LEVEL_2_3.enemies[a]!;
  await stand(page, alacran.x + 60, alacran.y); // on the roof right of it (the gap at columns 20 to 22 is left of it)
  let now = await drawn(page, a);
  expect(now.drawn.some((e) => e.kind === 'alacran')).toBe(true);
  await shot(page, info, 'enemies1-roof-alacran');
  const t = index(LEVEL_2_3, 'tlacuache');
  const tlacuache = LEVEL_2_3.enemies[t]!;
  await stand(page, tlacuache.x - 36, tlacuache.y); // on the high roof F1 with it (columns 164 to 169)
  now = await drawn(page, t);
  expect(now.drawn.some((e) => e.kind === 'tlacuache')).toBe(true);
  await shot(page, info, 'enemies1-roof-tlacuache');
});
