// Screenshots of the Armadillo for visual review (GDD-ENM-04, GDD-ART-06), in lab-3a: walking, turning at a wall, walking on the ramp,
// tucked on a red frame, rolling with its dust behind, rolling down the ramp, dazed on its back at the wall and kicking, and Poncho bouncing
// off the ball. Run with `npm run shots`; images land in shots/ (not committed). Where things are comes from `src/levels/lab3a.ts` (L-062);
// the Armadillo is picked by its kind and starting column (L-015); the game is paused and stepped in the page (L-042), and each shot asserts
// its state first (L-016). `armadillo-wall` shows the walking frame shifted off the wall it turns at, `armadillo-ramp-walk` and
// `armadillo-ramp` the walking frame and the roll's dust raised off the ramp's sand.
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { ARMADILLO, TILE } from '../../src/config/tuning';
import { LAB_3A_ENEMIES, LAB_3A_FLOOR_ROW, LAB_3A_LEDGE, LAB_3A_PEN, LAB_3A_SLOPE } from '../../src/levels/lab3a';
import { kindOf } from '../../src/sim/enemy';
import { start } from '../helpers';

const shot = async (page: Page, info: TestInfo, name: string) => {
  await page.waitForTimeout(250); // L-042: real time only lets the paused frame render before the picture; nothing is timed by it
  await page.screenshot({ path: `shots/${name}-${info.project.name.replace('shots-', '')}.png` });
};

const armadilloAt = (col: number): number => LAB_3A_ENEMIES.findIndex((e) => kindOf(e) === 'armadillo' && Math.floor(e.x / TILE) === col);
const PEN = armadilloAt(10);
const SLOPE = armadilloAt(30);
const LEDGE = armadilloAt(36);
const FLOOR_Y = LAB_3A_FLOOR_ROW * TILE;
const BLOCK_SPOT = { x: (LAB_3A_PEN.block1 + 1) * TILE - 8, y: LAB_3A_PEN.topRow * TILE };
const RAMP_SPOT = { x: 420, y: 190 }; // on the ramp's third tile ('r', from y = 192 up 8 px over 16): its surface at x = 420
const LEDGE_SPOT = { x: (LAB_3A_LEDGE.col1 + 1) * TILE - 12, y: LAB_3A_LEDGE.row * TILE };
/** On the slope's right wall, 32 px over the upper floor: out of the slope Armadillo's sight wherever it walks. */
const HIGH_SPOT = { x: LAB_3A_SLOPE.wall0 * TILE + 8, y: LAB_3A_SLOPE.wallRow * TILE };

/** Starts lab-3a the device's way (L-045), pauses it and puts Poncho down at `at`, stepped until he stands. */
async function open(page: Page, isMobile: boolean, at: { x: number; y: number }): Promise<void> {
  await start(page, isMobile, '/?level=lab-3a');
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 2);
  await page.evaluate((p) => {
    const d = window.__PONCHO__!;
    d.pause(true);
    d.teleport(p.x, p.y - 1);
  }, at);
}

type Goal = 'walking' | 'turned' | 'onRamp' | 'red' | 'rolling' | 'rollingOnRamp' | 'kicking' | 'bounced';

/**
 * In the page: steps the paused game until Armadillo `i` reaches `goal` (checked after each step, with a frame drawn for the goals read
 * from the picture), at most `max` steps. Poncho holds nothing but a full jump (held while rising) when a ball rolling at him is 12 px off,
 * unless `stand`. For 'bounced' he is first dropped from 40 px over the rolling ball, 22 px ahead of it. Whether the goal was reached, and the
 * Armadillo as it is and as it was drawn.
 */
const stepTo = (page: Page, i: number, goal: Goal, max: number, stand = false) =>
  page.evaluate(
    async ({ index, g, limit, still, ramp }) => {
      const d = window.__PONCHO__!;
      const startDir = d.enemies()[index]!.dir;
      if (g === 'bounced') {
        const e = d.enemies()[index]!;
        d.teleport(e.x + e.dir * 22, e.y - 40);
      }
      let jumpWas = false;
      let reached = false;
      for (let k = 0; k < limit && !reached; k++) {
        const p = d.state();
        const e = d.enemies()[index]!;
        let jump = false;
        if (!still && e.phase === 'roll' && (e.dir > 0) === (e.x < p.x)) {
          const gap = e.dir > 0 ? p.x - 5 - (e.x + 8) : e.x - 8 - (p.x + 5);
          jump = p.grounded && !jumpWas && gap >= 0 && gap <= 12;
        }
        if (!p.grounded && jumpWas && p.vy < 0) jump = true;
        jumpWas = jump;
        const vy = d.state().vy;
        d.step(1, { move: 0, jumpHeld: jump });
        const n = d.enemies()[index]!;
        const onRamp = n.x > ramp[0]! + 6 && n.x < ramp[1]! - 6;
        if (g === 'walking') reached = n.phase === 'walk' && k > 40;
        else if (g === 'turned') reached = n.phase === 'walk' && n.dir !== startDir;
        else if (g === 'onRamp') reached = n.phase === 'walk' && onRamp;
        else if (g === 'rolling') reached = n.phase === 'roll' && k > 6 && (n.dir > 0) === (n.x < d.state().x);
        else if (g === 'rollingOnRamp') reached = n.phase === 'roll' && onRamp;
        else if (g === 'bounced') reached = vy > 0 && d.state().vy < 0;
        else if (g === 'red' || g === 'kicking') {
          if (n.phase !== (g === 'red' ? 'tuck' : 'dazed')) continue;
          await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
          const drawn = d.enemiesDrawn().find((x) => x.kind === 'armadillo' && Math.abs(x.y - (n.y ?? 0)) < 4 && Math.abs(x.x - n.x) <= 5.01);
          reached = g === 'red' ? drawn?.red === true : drawn?.look === 'dazedKick';
        }
      }
      if (g === 'bounced') d.step(4); // a few steps up off the ball, so both are seen apart
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const e = d.enemies()[index]!;
      const cam = d.camera();
      const drawn = d.enemiesDrawn().find((x) => x.kind === 'armadillo' && Math.abs(x.x - e.x) <= 5.01);
      return { reached, e, drawn, p: d.state(), lives: d.lives(), screen: { x: e.x - cam.viewX, y: e.y - cam.viewY } };
    },
    { index: i, g: goal, limit: max, still: stand, ramp: [LAB_3A_SLOPE.ramp0 * TILE, (LAB_3A_SLOPE.ramp1 + 1) * TILE] },
  );

/** In view: its middle on the 480 x 270 screen with some room. */
const inView = (s: { x: number; y: number }) => s.x > 20 && s.x < 460 && s.y > 20 && s.y < 260;

test('GDD-ENM-04 armadillo: walking in the pen, he watching from the block', async ({ page, isMobile }, info) => {
  await open(page, isMobile, BLOCK_SPOT);
  const r = await stepTo(page, PEN, 'walking', 60);
  expect(r.reached).toBe(true);
  expect(r.drawn!.look).toMatch(/^walk[0-3]$/);
  expect(r.p).toMatchObject({ grounded: true, y: LAB_3A_PEN.topRow * TILE });
  expect(inView(r.screen)).toBe(true);
  await shot(page, info, 'armadillo-walk');
});

test('GDD-ENM-04 armadillo: turning flush against the pen\'s far wall', async ({ page, isMobile }, info) => {
  await open(page, isMobile, BLOCK_SPOT);
  // It starts heading right: the first turn is flush against the far wall's face (x = 256), its middle 8 px off it; now heading left, its
  // tail is towards the wall.
  const r = await stepTo(page, PEN, 'turned', 1200);
  expect(r.reached).toBe(true);
  expect(r.e.x).toBeCloseTo(LAB_3A_PEN.wall0 * TILE - ARMADILLO.width / 2, 0);
  expect(r.drawn).toMatchObject({ flip: true });
  // Drawn shifted off the wall by its tail's 5 px reach past its box (`enemyPose`), so nothing of it lies in the wall.
  expect(r.drawn!.x).toBeCloseTo(r.e.x - 5, 6);
  expect(inView(r.screen)).toBe(true);
  await shot(page, info, 'armadillo-wall');
});

test('GDD-ENM-04 armadillo: walking on the ramp', async ({ page, isMobile }, info) => {
  await open(page, isMobile, HIGH_SPOT);
  const r = await stepTo(page, SLOPE, 'onRamp', 1200);
  expect(r.reached).toBe(true);
  expect(r.drawn!.look).toMatch(/^walk[0-3]$/);
  expect(r.e.y).toBeGreaterThan(LAB_3A_SLOPE.highRow * TILE);
  expect(r.e.y).toBeLessThan(FLOOR_Y);
  expect(inView(r.screen)).toBe(true);
  await shot(page, info, 'armadillo-ramp-walk');
});

test('GDD-ENM-04 armadillo: tucked, on a red frame', async ({ page, isMobile }, info) => {
  await open(page, isMobile, RAMP_SPOT);
  const r = await stepTo(page, SLOPE, 'red', 40);
  expect(r.reached).toBe(true);
  expect(r.e.phase).toBe('tuck');
  expect(r.drawn).toMatchObject({ look: 'tuckRed', red: true, flip: true });
  expect(inView(r.screen)).toBe(true);
  await shot(page, info, 'armadillo-tuck');
});

test('GDD-ENM-04 armadillo: rolling at him along the ledge, its dust behind', async ({ page, isMobile }, info) => {
  await open(page, isMobile, LEDGE_SPOT);
  const r = await stepTo(page, LEDGE, 'rolling', 60, true);
  expect(r.reached).toBe(true);
  expect(r.drawn!.look).toMatch(/^roll[0-3]$/);
  expect(r.e.dir).toBe(1);
  expect(r.e.x).toBeLessThan(r.p.x); // the ball coming at him
  expect(r.lives).toBe(7);
  expect(inView(r.screen)).toBe(true);
  await shot(page, info, 'armadillo-roll');
});

test('GDD-ENM-04 armadillo: rolling down the ramp', async ({ page, isMobile }, info) => {
  await open(page, isMobile, RAMP_SPOT);
  const r = await stepTo(page, SLOPE, 'rollingOnRamp', 120);
  expect(r.reached).toBe(true);
  expect(r.e).toMatchObject({ phase: 'roll', dir: -1 });
  expect(r.drawn!.look).toMatch(/^roll[0-3]$/);
  expect(r.lives).toBe(7);
  expect(inView(r.screen)).toBe(true);
  await shot(page, info, 'armadillo-ramp');
});

test('GDD-ENM-04 armadillo: dazed on its back at the wall, kicking', async ({ page, isMobile }, info) => {
  await open(page, isMobile, RAMP_SPOT);
  const r = await stepTo(page, SLOPE, 'kicking', 300);
  expect(r.reached).toBe(true);
  expect(r.e).toMatchObject({ phase: 'dazed', x: (LAB_3A_PEN.wall1 + 1) * TILE + ARMADILLO.width / 2, y: FLOOR_Y });
  expect(r.drawn).toMatchObject({ look: 'dazedKick' });
  expect(r.lives).toBe(7);
  expect(inView(r.screen)).toBe(true);
  await shot(page, info, 'armadillo-dazed');
});

test('GDD-ENM-04 armadillo: he bounces off the rolling ball', async ({ page, isMobile }, info) => {
  await open(page, isMobile, RAMP_SPOT);
  const rolling = await stepTo(page, SLOPE, 'rolling', 60, true);
  expect(rolling.reached).toBe(true);
  const r = await stepTo(page, SLOPE, 'bounced', 40, true);
  expect(r.reached).toBe(true);
  expect(r.e.phase).toBe('roll');
  expect(r.p.vy).toBeLessThan(0);
  expect(r.p.y).toBeLessThan(r.e.y - ARMADILLO.height); // his feet over the ball
  expect(r.lives).toBe(7);
  expect(inView(r.screen)).toBe(true);
  await shot(page, info, 'armadillo-stomp');
});
