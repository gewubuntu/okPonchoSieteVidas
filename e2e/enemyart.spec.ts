import { expect, test, type Page } from '@playwright/test';
import { boot } from './helpers';
import { SANDBOX_ENEMIES } from '../src/levels/sandbox';

// GDD-ENM-02: World 1's enemies drawn as sprites, read back from the images (`enemiesDrawn`, `defeatsDrawn`). In the sandbox (L-062:
// read from its module) the Alacrán is enemy 0 on the platform at y = 160, the Zopilote 1 cruising at y = 64, the cactus buddy 2 on the
// 2-tile wall (columns 10 and 11, top y = 192) and the Tlacuache 3 on the top right ledge (y = 96). The game is paused and stepped in the
// page, a frame drawn after each step, so every count is in steps (L-042).
const [, , CACTUS, TLACUACHE] = SANDBOX_ENEMIES;
const start = async (page: Page) => {
  const errors = await boot(page);
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 10);
  await page.evaluate(() => window.__PONCHO__!.pause(true));
  return errors;
};

type Drawn = { look: string | undefined; flip: boolean | undefined; x: number; dir: number; phase: string };
/**
 * Enemy `i` (0 to 3, the sandbox's order of kinds) as drawn and as it is in the run over `n` steps with `input`: after each step and a drawn
 * frame (`every`), or only once after all of them. One round trip.
 */
const looksOver = (page: Page, i: number, n: number, input = { move: 0, jumpHeld: false }, every = true): Promise<Drawn[]> =>
  page.evaluate(
    async ({ index, steps, held, each }) => {
      const d = window.__PONCHO__!;
      const kind = (['alacran', 'zopilote', 'cactus', 'tlacuache'] as const)[index]!;
      const read = async () => {
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        const drawn = d.enemiesDrawn().find((e) => e.kind === kind);
        const sim = d.enemies()[index]!;
        return { look: drawn?.look, flip: drawn?.flip, x: sim.x, dir: sim.dir, phase: sim.phase };
      };
      const out: Drawn[] = [];
      for (let k = 0; k < steps; k++) {
        d.step(1, held);
        if (each) out.push(await read());
      }
      if (!each) out.push(await read());
      return out;
    },
    { index: i, steps: n, held: input, each: every },
  );
/** Enemy `i` as drawn after `n` more steps (0: as it is now) and a drawn frame. */
const looksAfter = async (page: Page, i: number, n: number): Promise<Drawn> => (await looksOver(page, i, n, undefined, false))[0]!;

test('GDD-ENM-02 the Alacran changes walk frames as it walks and flips when it turns', async ({ page }) => {
  const errors = await start(page);
  // 0.5 px a step: a frame every 4 steps (2 px), walk0 to walk3 by its x.
  const walked = await looksOver(page, 0, 24);
  for (const w of walked) expect(w.look, `x ${w.x}`).toBe(`walk${((Math.floor(w.x / 2) % 4) + 4) % 4}`);
  expect(new Set(walked.map((w) => w.look)).size).toBe(4);
  for (const w of walked) expect(w.flip, `x ${w.x}`).toBe(w.dir < 0);
  // Walk on until it turns round (it turns at x = 71 and 137, 0.5 px a step: within 140 steps), then a frame drawn.
  const first = walked.at(-1)!.dir;
  expect(walked.at(-1)!.flip).toBe(first < 0);
  await page.evaluate((dir) => {
    const d = window.__PONCHO__!;
    for (let k = 0; k < 400 && d.enemies()[0]!.dir === dir; k++) d.step(1);
  }, first);
  const turned = await looksAfter(page, 0, 0);
  expect(turned.dir).toBe(-first);
  expect(turned.flip).toBe(first > 0);
  expect(errors).toEqual([]);
});

test('GDD-ENM-01 the Zopilote shows its telegraph flashing red, then a dive look', async ({ page }) => {
  await start(page);
  await page.evaluate(() => window.__PONCHO__!.teleport(224, 112)); // on the spring ledge, 32 px below its line: it spots him
  const steps = await looksOver(page, 1, 40);
  const tele = steps.filter((s) => s.phase === 'telegraph').map((s) => s.look);
  expect(tele.length).toBeGreaterThan(20);
  expect(new Set(tele)).toEqual(new Set(['tele', 'teleRed']));
  const dive = steps.filter((s) => s.phase === 'dive').map((s) => s.look);
  expect(dive.length).toBeGreaterThan(0);
  for (const look of dive) expect(['diveSteep', 'diveShallow']).toContain(look);
});

test('GDD-ENM-02 the cactus buddy dozes with Poncho far, peeks and is alarmed as he comes up to it, and faces him', async ({ page }) => {
  await start(page);
  expect(CACTUS).toMatchObject({ x: 184, y: 192, kind: 'cactus' });
  // On the floor (y = 224), 80 px to its left: his hurtbox centre 24 px below its box's middle, too far across to be seen.
  await page.evaluate(() => window.__PONCHO__!.teleport(104, 224));
  const far = await looksOver(page, 2, 4);
  for (const s of far) expect(s.look).toMatch(/^doze[01]$/);
  for (const s of far) expect(s.flip).toBe(false);
  // He walks right to the door at x = 128: within 64 px across it peeks at him, facing left.
  const walking = await looksOver(page, 2, 40, { move: 1, jumpHeld: false });
  const peeking = walking.filter((s) => s.look === 'peek');
  expect(peeking.length).toBeGreaterThan(0);
  for (const s of peeking) expect(s.flip).toBe(true);
  expect(walking.some((s) => s.look?.startsWith('doze'))).toBe(true); // dozing until he came near
  // Up on the wall's free left end, 18 px from it: alarmed, shivering, facing him.
  await page.evaluate(() => window.__PONCHO__!.teleport(166, 192));
  const close = await looksOver(page, 2, 12);
  for (const s of close) expect(s.look).toMatch(/^alarm[01]$/);
  expect(new Set(close.map((s) => s.look)).size).toBe(2);
  for (const s of close) expect(s.flip).toBe(true);
});

test('GDD-ENM-02 the Tlacuache shows dead after a stomp, and twitches before it wakes', async ({ page }) => {
  await start(page);
  expect(TLACUACHE!.kind).toBe('tlacuache');
  const { x } = (await page.evaluate(() => window.__PONCHO__!.enemies()))[3]!;
  await page.evaluate((ox) => window.__PONCHO__!.teleport(ox, 80), x); // 6 px above its top, falling onto it
  await page.evaluate(() => {
    const d = window.__PONCHO__!;
    for (let k = 0; k < 20 && d.enemies()[3]!.phase !== 'dead'; k++) d.step(1);
    d.teleport(24, 224); // out of its way
  });
  // Its age is 0 now (the step of the stomp). It twitches in its last 0.5 s, from age 90, every other 4 steps: still at 89, 92.
  const lying = [await looksAfter(page, 3, 0), await looksAfter(page, 3, 89), await looksAfter(page, 3, 1), await looksAfter(page, 3, 2)];
  expect(lying.map((s) => s.phase)).toEqual(['dead', 'dead', 'dead', 'dead']);
  expect(lying.map((s) => s.look)).toEqual(['dead', 'dead', 'deadTwitch', 'dead']);
});

test('GDD-ENM-02 a stomped Alacran shows its squash, then the poof, then nothing after 24 steps', async ({ page }) => {
  await start(page);
  const { x } = (await page.evaluate(() => window.__PONCHO__!.enemies()))[0]!;
  await page.evaluate((ex) => window.__PONCHO__!.teleport(ex, 140), x); // above its top (y = 150), falling
  const seen = await page.evaluate(async () => {
    const d = window.__PONCHO__!;
    for (let i = 0; i < 20 && d.enemies()[0]!.alive; i++) d.step(1);
    const out: { kind: string; look: string; x: number; y: number }[][] = [];
    for (let k = 0; k <= 24; k++) {
      if (k > 0) d.step(1); // k = 0: the step it was defeated in, age 0
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      out.push(d.defeatsDrawn());
    }
    return { out, x: d.enemies()[0]!.x, alive: d.enemies()[0]!.alive };
  });
  expect(seen.alive).toBe(false);
  const looks = seen.out.map((drawn) => drawn.map((e) => `${e.kind} ${e.look}`).join());
  expect(looks.slice(0, 8)).toEqual(Array(8).fill('alacran squash'));
  expect(looks.slice(8, 24)).toEqual(['poof0', 'poof1', 'poof2', 'poof3'].flatMap((p) => Array(4).fill(`alacran ${p}`)));
  expect(looks[24]).toBe('');
  expect(seen.out[0]![0]).toMatchObject({ x: seen.x, y: 160 }); // squashed on its feet
  expect(seen.out[8]![0]).toMatchObject({ x: seen.x, y: 155 }); // the poof on its box's middle
});

test('GDD-ENM-02 the Alacran walks through its frames in real play, unpaused', async ({ page }) => {
  // L-021: the game's own frames, not the debug step, redraw it: within 240 steps of play it shows every walk frame (one every 4 steps).
  await boot(page);
  const seen = await page.evaluate(async () => {
    const d = window.__PONCHO__!;
    const t0 = d.ticks();
    const looks = new Set<string>();
    for (let f = 0; f < 3000 && looks.size < 4 && d.ticks() < t0 + 240; f++) {
      await new Promise((r) => requestAnimationFrame(r));
      const look = d.enemiesDrawn().find((e) => e.kind === 'alacran')?.look;
      if (look) looks.add(look);
    }
    return [...looks];
  });
  expect(new Set(seen)).toEqual(new Set(['walk0', 'walk1', 'walk2', 'walk3']));
});
