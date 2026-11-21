import { describe, expect, it } from 'vitest';
import { BASE_HEIGHT, CAMERA, GLIDE, GRAVITY, STEP, TILE } from '../config/tuning';
import { LEVELS, levelById } from '../levels';
import { LAB_3C_FLOOR_Y, LAB_3C_LEVEL } from '../levels/lab3c';
import { cartFloor, type CartState } from '../sim/cart';
import { flatWorld, spawn, step, type PlayerState } from '../sim/movement';
import { startRun, stepRun, type Level, type RunState } from '../sim/run';
import { parseTiles } from '../sim/tilemap';
import { cameraDrawY, cartLeadDraw, cameraLimits, cameraLimitsAt, cameraScroll, cutCameraY, followCamera, followCameraY, placeCameraY, ponchoShown, stepCameraY, stepCartLead, type CameraStepped, type CameraY, type CameraYInput } from './camera';

// The screen is 480 px wide, so the dead zone, 32 px in the middle, is 224 to 256 px from the screen's left edge. The level is
// 1440 px wide unless stated, so the camera's scroll goes from 0 to 960.
const WIDTH = 1440;

describe('GDD-UI-04 the camera', () => {
  it('GDD-UI-04 camera stays still while Poncho is in the dead zone', () => {
    expect(followCamera(100, 330, WIDTH)).toBe(100); // screen x 230
    expect(followCamera(100, 324, WIDTH)).toBe(100); // 224, the zone's left edge
    expect(followCamera(100, 356, WIDTH)).toBe(100); // 256, the zone's right edge
  });

  it('GDD-UI-04 camera follows past the right edge of the dead zone', () => {
    expect(followCamera(0, 300, WIDTH)).toBe(44); // he stays on the zone's right edge, 256
    expect(followCamera(100, 357, WIDTH)).toBe(101);
  });

  it('GDD-UI-04 camera follows past the left edge of the dead zone', () => {
    expect(followCamera(100, 300, WIDTH)).toBe(76); // screen x 200, he stays on the zone's left edge, 224
    expect(followCamera(100, 323, WIDTH)).toBe(99);
  });

  it('GDD-UI-04 camera stops at the level edges', () => {
    expect(followCamera(0, 56, WIDTH)).toBe(0);
    expect(followCamera(500, 100, WIDTH)).toBe(0);
    expect(followCamera(900, 1430, WIDTH)).toBe(960);
    expect(followCamera(960, 1439, WIDTH)).toBe(960);
  });

  it('GDD-UI-04 a one-screen level never scrolls', () => {
    for (const target of [0, 300, 470]) expect(followCamera(0, target, 480), `${target}`).toBe(0);
    // A level narrower than the screen has a negative end to scroll to, which is no end at all.
    for (const target of [0, 300, 470]) expect(followCamera(0, target, 320), `${target}`).toBe(0);
  });

  it('GDD-UI-04 camera stands at whole art pixels', () => {
    expect(followCamera(0, 300.1, WIDTH)).toBe(44); // 44.1 rounds to a quarter-pixel step below
    expect(followCamera(0, 300.2, WIDTH)).toBe(44.25);
  });

  it('GDD-UI-04 camera stands still while Poncho is hidden', () => {
    expect(followCamera(300, null, WIDTH)).toBe(300);
  });
});

// GDD-UI-04, up and down. Screen y is counted from the screen's top (0 to 270) and "feet" is the bottom of his body box; the band is 116
// to 156, the air's top line 56. The expected values are the GDD's. A level 40 rows tall (640 px) lets the camera go from 0 to 368.
const LIMITS = cameraLimits(40 * TILE);
// The camera at `y` in the band's look, where he last stood still at `ref` (the new look-ahead fields, GDD-UI-04); `last` null: before any
// grounded step, so the air tests, which never read it, use it as it is.
const still = (y: number, ref = 0): CameraY => ({ y, lead: false, look: 'band', ref, still: 0, last: null });
/** The camera at `y` with him standing at level y `feetY`, as a cut puts it there and as a step on the ground leaves it. */
const stood = (y: number, feetY: number): CameraY => ({ ...still(y, feetY), last: feetY });
/** What a grounded step changes besides these is the look's bookkeeping (`ref`, `still`, `last`): the old rule's tests compare these. */
const flat = (c: CameraY) => ({ y: c.y, lead: c.lead, look: c.look });
const ground = (feetY: number): CameraYInput => ({ feetY, grounded: true, vy: 0, hidden: false });
const air = (feetY: number, vy: number): CameraYInput => ({ feetY, grounded: false, vy, hidden: false });
/** What the camera reads of Poncho after a step. */
const seen = (p: PlayerState): CameraYInput => ({ feetY: p.y, grounded: p.grounded, vy: p.vy, hidden: false });

/** A test level: these rows and the springs given; nothing else. */
const levelOf = (rows: readonly string[], springs: Level['springs'] = []): Level => ({
  world: parseTiles(rows),
  spawn: { x: 24, y: 0 },
  ofrendas: [],
  spikes: [],
  crumbles: [],
  springs,
  platforms: [],
  tacos: [],
  pinatas: [],
  doors: [],
  keys: [],
  fragiles: [],
  enemies: [],
});
/** `width` columns and 40 rows, solid from row `top(col)` down. */
const rowsOf = (width: number, top: (col: number) => number): string[] =>
  Array.from({ length: 40 }, (_, row) => Array.from({ length: width }, (_t, col) => (row >= top(col) ? '#' : '.')).join(''));

/** The camera's move on each of 20 steps from y 100 with him standing, his feet at `feetY`. */
const pan = (feetY: number): number[] => {
  let cam = stood(100, feetY);
  const moves: number[] = [];
  for (let i = 0; i < 20; i++) {
    const next = followCameraY(cam, ground(feetY), LIMITS);
    moves.push(next.y - cam.y);
    cam = next;
  }
  return moves;
};

/** From standing at level y `from` to standing at `to` (the look starts), the look and the steps until his feet are on its line, and the camera's y then. */
const reach = (from: number, to: number) => {
  let cam: CameraY = { ...stood(100, from), last: to };
  const first = followCameraY(cam, ground(to), LIMITS);
  let steps = 0;
  for (cam = first; steps < 100; steps++) {
    if (Math.abs(to - cam.y - (to < from ? CAMERA.upFeet : CAMERA.downFeet)) < 1e-9) break;
    cam = followCameraY(cam, ground(to), LIMITS);
  }
  return { look: first.look, steps: steps + 1, y: cam.y };
};

describe('GDD-UI-04 the camera follows up and down', () => {
  it('GDD-UI-04 it stands still while his feet are in the band on the ground: at 116 and at 156', () => {
    expect(flat(followCameraY(stood(100, 216), ground(216), LIMITS))).toEqual(flat(still(100)));
    expect(flat(followCameraY(stood(100, 256), ground(256), LIMITS))).toEqual(flat(still(100)));
  });

  it('GDD-UI-04 it moves when they are a quarter px outside: at 115.75 and 156.25', () => {
    expect(followCameraY(stood(100, 215.75), ground(215.75), LIMITS).y).toBe(99.75);
    expect(followCameraY(stood(100, 256.25), ground(256.25), LIMITS).y).toBe(100.25);
  });

  it('GDD-UI-04 on the ground it pans at 180 px/s, 3 px a step, and stops with his feet on the nearer edge of the band', () => {
    // His feet 40 px below the band (screen y 196): 13 steps of 3 px and one of 1 px, then still with them on its bottom edge, 156.
    expect(pan(296)).toEqual([...Array<number>(13).fill(3), 1, ...Array<number>(6).fill(0)]);
    // 40 px above it (76): the same upwards, to its top edge, 116.
    expect(pan(176)).toEqual([...Array<number>(13).fill(-3), -1, ...Array<number>(6).fill(0)]);
  });

  it('GDD-UI-04 a step of one tile does not move it', () => {
    // From the band's middle (136) a tile up or down stays inside it, and from either edge towards the other.
    expect(followCameraY(stood(100, 236), ground(236 + TILE), LIMITS).y).toBe(100);
    expect(followCameraY(stood(100, 236), ground(236 - TILE), LIMITS).y).toBe(100);
    expect(followCameraY(stood(100, 216), ground(216 + TILE), LIMITS).y).toBe(100);
    expect(followCameraY(stood(100, 256), ground(256 - TILE), LIMITS).y).toBe(100);
  });

  it('GDD-UI-04 a step of two tiles starts the look-up and pans his feet to the 60% line', () => {
    // Two tiles are the trigger (32 px). From the band's bottom edge (screen y 156) and its middle (136) up, and from its top edge (116) and
    // its middle down: his feet are held at 162 (up) or 108 (down), 3 px a step with him standing, and the band's 12 px and 28 px pans are
    // gone. He stands at the new height already (`last` there), so only the pan is measured: steps until his feet are on the line.
    // Up from 256 to 224: the camera's top from 100 to 62, 38 px: 12 steps of 3 and one of 2. From the middle, 236 to 204: 42, 58 px, 20 steps.
    expect(reach(256, 224)).toEqual({ look: 'up', steps: 13, y: 62 });
    expect(reach(236, 204)).toEqual({ look: 'up', steps: 20, y: 42 });
    // Down from 216 to 248: 140, 40 px, 14 steps. From the middle, 236 to 268: 160, 60 px, 20 steps.
    expect(reach(216, 248)).toEqual({ look: 'downward', steps: 14, y: 140 });
    expect(reach(236, 268)).toEqual({ look: 'downward', steps: 20, y: 160 });
  });

  it('GDD-UI-04 a jump from the ground does not move it', () => {
    const FLOOR = 320;
    const world = flatWorld(FLOOR);
    const limits = cameraLimits(2000);
    for (const edge of [CAMERA.bandTop, CAMERA.bandBottom]) {
      const y0 = FLOOR - edge;
      let cam = stood(y0, FLOOR);
      let s = step(spawn(100, FLOOR), { move: 0, jumpHeld: true }, world);
      cam = followCameraY(cam, seen(s), limits);
      let highest = s.y - cam.y;
      for (let i = 0; i < 300 && !s.grounded; i++) {
        s = step(s, { move: 0, jumpHeld: true }, world);
        cam = followCameraY(cam, seen(s), limits);
        expect(cam.y, `from ${edge}, step ${i}`).toBe(y0);
        highest = Math.min(highest, s.y - cam.y);
      }
      expect(s.grounded).toBe(true);
      // The full jump rises 56.4 px (GDD-MOV-07, measured), so from the band's top edge his feet reach 59.6, under the line at 56.
      expect(highest, `from ${edge}`).toBeCloseTo(edge - 56.4, 1);
    }
  });

  it('GDD-UI-04 rising past y = 56 it goes up with him, his feet held at 56', () => {
    // A plain spring launch (480 px/s, about 77 px up, GDD-WLD-05) from a floor at row 30 (y 480), walked onto from the left.
    const level = levelOf(rowsOf(20, (col) => (col === 6 ? 31 : 30)), [{ col: 6, row: 30 }]);
    const launch = (edge: number): { moved: number; feetAt: number } => {
      const y0 = 30 * TILE - edge;
      let r: RunState = { ...startRun(level), player: spawn(56, 30 * TILE) };
      let cam = stood(y0, 30 * TILE);
      let launched = false;
      let feetAt = edge;
      for (let i = 0; i < 300; i++) {
        r = stepRun(r, { move: launched ? 0 : 1, jumpHeld: false }, level);
        cam = followCameraY(cam, seen(r.player), LIMITS);
        if (r.player.vy < 0) launched = true;
        feetAt = Math.min(feetAt, r.player.y - cam.y);
        if (launched) expect(r.player.y - cam.y, `step ${i}`).toBeGreaterThanOrEqual(CAMERA.airTop - 1e-9);
        // Measured to the top of the first launch (L-026).
        if (launched && r.player.vy >= 0) break;
      }
      expect(launched).toBe(true);
      return { moved: y0 - cam.y, feetAt };
    };
    // From the band's top edge the camera goes up 17.1 px (measured: the launch rises 77.1 px; the GDD's target is 17 at most), and his
    // feet stop at 56; from its bottom edge it stays.
    const top = launch(CAMERA.bandTop);
    expect(top.moved).toBeCloseTo(17.08, 2);
    expect(top.feetAt).toBeCloseTo(CAMERA.airTop, 6);
    const bottom = launch(CAMERA.bandBottom);
    expect(bottom.moved).toBe(0);
    expect(bottom.feetAt).toBeCloseTo(CAMERA.bandBottom - 77.08, 2);
  });

  it('GDD-UI-04 a fall looks down: below y = 156 and falling, it gains 2 px a step on him until his feet are at 108, then follows at his fall speed', () => {
    // At a speed vy (px/s) his feet move vy / 60 a step, from the band's bottom edge (screen y 156).
    // A level tall enough that no limit is reached.
    const limits = cameraLimits(2000);
    const fall = (vy: number) => {
      let cam = still(100);
      let feetY = 256;
      const moves: number[] = [];
      const feet: number[] = [];
      for (let i = 0; i < 40; i++) {
        feetY += vy * STEP;
        const next = followCameraY(cam, air(feetY, vy), limits);
        moves.push(next.y - cam.y);
        feet.push(feetY - next.y);
        cam = next;
      }
      return { moves, feet };
    };
    for (const vy of [GRAVITY.terminalVelocity, GLIDE.fallSpeed]) {
      const { moves, feet } = fall(vy);
      // 24 steps at his speed plus 120 px/s (2 px a step more than him), which bring his feet from 156 to 108 (the 40% line, GDD-UI-04's
      // look-ahead; to the band's top, 116, in 20 steps before it); then at his speed.
      moves.forEach((m, i) => expect(m, `${vy} px/s, step ${i}`).toBeCloseTo(((i < 24 ? vy + CAMERA.leadSpeed : vy) * STEP), 9));
      feet.forEach((f, i) => expect(f, `${vy} px/s, step ${i}`).toBeCloseTo(i < 24 ? 154 - 2 * i : 108, 9));
    }
    // A plain fall moves it at up to 480 px/s (8 px a step), a glide at 190 px/s for a third of a second and then at 70.
    expect((GRAVITY.terminalVelocity + CAMERA.leadSpeed) * STEP).toBe(8);
  });

  it('GDD-UI-04 the look-down does not start while he rises, nor above y = 156', () => {
    // Rising, with his feet anywhere under the air's top line: still.
    for (const on of [60, 140, 157, 200, 260]) expect(followCameraY(still(100), air(100 + on, -200), LIMITS), `${on}`).toEqual(still(100));
    // Falling inside the band, and on the line: still.
    for (const on of [120, 150, 156]) expect(followCameraY(still(100), air(100 + on, 300), LIMITS), `${on}`).toEqual(still(100));
    // Past it: the look-down.
    expect(followCameraY(still(100), air(256.5, 300), LIMITS).lead).toBe(true);
  });

  it('GDD-UI-04 a landing 2 tiles or more below starts the look-down on the ground', () => {
    // A fall of 60 px from standing at 256, the camera at the look-down's end of it: 10 steps of 6 px.
    let cam = stood(100, 256);
    let feetY = 256;
    for (let i = 0; i < 10; i++) {
      feetY += 6;
      cam = followCameraY(cam, air(feetY, 360), LIMITS);
    }
    expect(cam.lead).toBe(true);
    // The landing is the next grounded step, 60 px below the reference: the look-down on the ground, the lead over. A landing counts no
    // speed of its own (he was in the air the step before), so the camera moves at the pan, 3 px.
    const landed = followCameraY(cam, ground(feetY), LIMITS);
    expect(landed).toMatchObject({ look: 'downward', ref: feetY, lead: false, last: feetY });
    expect(landed.y).toBe(cam.y + 3);
    // His feet go to the 108 line, 3 px a step: 25 px away after the landing step.
    let on = landed;
    let steps = 0;
    while (feetY - on.y > CAMERA.downFeet && steps++ < 50) on = followCameraY(on, ground(feetY), LIMITS);
    expect([steps, feetY - on.y, on.look]).toEqual([9, CAMERA.downFeet, 'downward']);
    // 30 steps at one height end it, counted from the landing; the camera pans to the band's nearer edge, its top, 116: 8 px, 3 steps.
    let after = on;
    for (let i = steps + 1; i <= CAMERA.settleSteps; i++) after = followCameraY(after, ground(feetY), LIMITS);
    expect(after.look).toBe('band');
    for (let i = 0; i < 4; i++) after = followCameraY(after, ground(feetY), LIMITS);
    expect([after.look, feetY - after.y]).toEqual(['band', CAMERA.bandTop]);
    // A landing less than 32 px below has no swing back: 18 px in 3 steps, his feet inside the band when he lands.
    let short = stood(100, 256);
    let low = 256;
    for (let i = 0; i < 3; i++) {
      low += 6;
      short = followCameraY(short, air(low, 360), LIMITS);
    }
    const down = followCameraY(short, ground(low), LIMITS);
    expect(down).toMatchObject({ look: 'band', ref: 256, lead: false });
    expect(down.y).toBe(short.y);
    let hold = down;
    for (let i = 0; i < 30; i++) hold = followCameraY(hold, ground(low), LIMITS);
    expect(flat(hold)).toEqual(flat(down));
  });

  it('GDD-UI-04 in any fall at least 114 px below his feet are in view, and 162 px once the look-down has caught up', () => {
    // He walks off ground at row 10 (y 160) and falls 12 tiles to ground at row 22, the camera with his feet on the band's top, middle
    // and bottom. What is in view below his feet (270 less their screen y) on each step in the air, by where they started.
    const level = levelOf(rowsOf(30, (col) => (col < 10 ? 10 : 22)));
    const below = new Map<number, number[]>();
    for (const on of [CAMERA.bandTop, CAMERA.spawnFeet, CAMERA.bandBottom]) {
      let r: RunState = { ...startRun(level), player: spawn(140, 10 * TILE) };
      let cam = stood(10 * TILE - on, 10 * TILE);
      const seenBelow: number[] = [];
      for (let i = 0; i < 300; i++) {
        r = stepRun(r, { move: 1, jumpHeld: false }, level);
        cam = followCameraY(cam, seen(r.player), LIMITS);
        if (r.player.grounded && seenBelow.length > 0) break;
        if (!r.player.grounded) seenBelow.push(BASE_HEIGHT - (r.player.y - cam.y));
      }
      expect(r.player.y, `from ${on}`).toBe(22 * TILE);
      below.set(on, seenBelow);
    }
    // Measured: the least in the air is 115.7 px, from the band's middle, 9 steps in (the GDD's target: at least 114, what he has standing
    // on the band's bottom edge before he leaves it).
    const least = Math.min(...[...below.values()].flat());
    expect(least).toBeGreaterThanOrEqual(114);
    expect(least).toBeCloseTo(115.72, 2);
    // From the band's bottom edge the look-down starts at once and catches up with his feet at the 40% line (108, GDD-UI-04's look-ahead): 162
    // px below them from the 23rd step on (154 px, from the 20th, when it caught up to the band's top at 116).
    expect(below.get(CAMERA.bandBottom)![19]).toBeCloseTo(157, 6);
    expect(below.get(CAMERA.bandBottom)!.findIndex((b) => b > 161.99) + 1).toBe(23);
    // Measured: from higher in the band it starts only once his feet pass 156, so 20 steps in he sees 135.1 px (from the top edge) and
    // 138.4 (from the middle), and 162 from the 34th and the 32nd step on (the 30th and the 28th to 154).
    expect(below.get(CAMERA.bandTop)![19]).toBeCloseTo(135.13, 2);
    expect(below.get(CAMERA.spawnFeet)![19]).toBeCloseTo(138.38, 2);
    expect(below.get(CAMERA.bandTop)!.findIndex((b) => b > 161.99) + 1).toBe(34);
    expect(below.get(CAMERA.spawnFeet)!.findIndex((b) => b > 161.99) + 1).toBe(32);
  });

  it('GDD-UI-04 it never moves more than 8 px in a step', () => {
    // A teleport-sized change: on the ground the 3 px pan, in the air at most 8 px, up or down.
    expect(followCameraY(stood(200, 5000), ground(5000), LIMITS).y).toBe(203);
    expect(followCameraY(still(200), air(5000, 3000), LIMITS).y).toBe(208);
    expect(followCameraY(still(200), air(-5000, -3000), LIMITS).y).toBe(192);
    expect(followCameraY({ ...still(200), lead: true }, air(5000, 3000), LIMITS).y).toBe(208);
  });

  it('GDD-UI-04 it stops at the level top and at 2 px above its floor line', () => {
    expect(cameraLimits(272)).toEqual({ top: 0, bottom: 0 });
    expect(cameraLimits(640)).toEqual({ top: 0, bottom: 368 });
    // A floor line above the level's bottom (a raised bottom, GDD-WLD-03) stops it 2 px above that line.
    expect(cameraLimits(640, 400)).toEqual({ top: 0, bottom: 128 });
    expect(followCameraY(stood(1, 50), ground(50), LIMITS).y).toBe(0);
    expect(followCameraY(still(1), air(-500, -400), LIMITS).y).toBe(0);
    expect(followCameraY(stood(367, 700), ground(700), LIMITS).y).toBe(368);
    expect(followCameraY({ ...still(366), lead: true }, air(900, 360), LIMITS).y).toBe(368);
  });

  it('GDD-UI-04 a level 17 rows tall never moves it: every level in the game today', () => {
    // Every level but 3-1 (51 rows, GDD-WLD-16), 3-3 (37 rows, GDD-WLD-18) and the tall lab is 17 rows (272 px): its camera has no room to
    // move (the approved screenshots hold).
    expect(LEVELS.filter((e) => e.level.world.height !== 17).map((e) => e.id)).toEqual(['3-1', '3-3', 'lab-3t']);
    for (const e of LEVELS.filter((l) => l.level.world.height === 17)) expect(cameraLimits(e.level.world.height * TILE), e.id).toEqual({ top: 0, bottom: 0 });
    // Any inputs at all: it stays at 0.
    const limits = cameraLimits(17 * TILE);
    let seed = 7;
    const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    let cam = placeCameraY(224, limits);
    for (let i = 0; i < 5000; i++) {
      cam = followCameraY(cam, { feetY: rand() * 800 - 200, grounded: rand() < 0.5, vy: rand() * 1600 - 800, hidden: rand() < 0.1 }, limits);
      expect(cam.y, `step ${i}`).toBe(0);
    }
  });

  it('GDD-UI-04 hidden, it holds', () => {
    for (const lead of [false, true]) {
      const held = { ...stood(100, 300), lead };
      expect(followCameraY(held, { feetY: 600, grounded: false, vy: 360, hidden: true }, LIMITS)).toEqual(held);
      expect(followCameraY(held, { feetY: 20, grounded: true, vy: 0, hidden: true }, LIMITS)).toEqual(held);
    }
  });

  it('GDD-UI-04 the cut puts his feet at 136, or as near as the limits allow', () => {
    expect(placeCameraY(300, LIMITS)).toEqual(stood(164, 300));
    expect(placeCameraY(100, LIMITS)).toEqual(stood(0, 100));
    expect(placeCameraY(600, LIMITS)).toEqual(stood(368, 600));
  });

  it('GDD-UI-04 it is drawn at whole art pixels between steps', () => {
    expect([0, 0.5, 1].map((a) => cameraDrawY(100, 108, a))).toEqual([100, 104, 108]);
    expect(cameraDrawY(100, 101, 0.3)).toBe(100.25); // 100.3 to the nearest quarter px
    expect(cameraDrawY(100, 100.6, 1)).toBe(100.5);
    expect(cameraDrawY(100, 100.9, 1)).toBe(101);
  });

  it('GDD-UI-04 over a raised bottom the camera stops 2 px above its floor line', () => {
    // A raised bottom's floor line at y 432 (GDD-WLD-03): the camera's bottom edge stops at 430, its y at 160, in a fall as on the ground.
    const raised = cameraLimits(640, 432);
    expect(raised).toEqual({ top: 0, bottom: 160 });
    expect(raised.bottom + BASE_HEIGHT).toBe(432 - CAMERA.bottomCutPx);
    let cam: CameraY = { ...still(150), lead: true };
    for (let i = 0; i < 20; i++) cam = followCameraY(cam, air(400 + 6 * i, 360), raised);
    expect(cam.y).toBe(160);
    expect(followCameraY(stood(159, 600), ground(600), raised).y).toBe(160);
  });

  it('GDD-UI-04 a bottom limit that rises as he walks is reached at the pan 3 px a step, never by a jump', () => {
    // The camera at the level's own bottom limit (368); he walks onto a raised bottom that puts it 100 px higher (268) and stands there, his
    // feet below the band: it pans up 3 px a step, 33 steps and one of 1 px, then stands at the new limit.
    const risen = { top: 0, bottom: 268 };
    let cam = stood(368, 600);
    const moves: number[] = [];
    for (let i = 0; i < 40; i++) {
      const next = followCameraY(cam, ground(600), risen);
      moves.push(next.y - cam.y);
      cam = next;
    }
    expect(moves).toEqual([...Array<number>(33).fill(-3), -1, ...Array<number>(6).fill(0)]);
    expect(cam.y).toBe(268);
    // Falling, with the look-down wanting it lower, it still pans up 3 px a step; rising past the air's top line it may go up faster, 8 px at most.
    expect(followCameraY({ ...still(368), lead: true }, air(700, 360), risen)).toEqual({ ...still(365), lead: true });
    expect(followCameraY(still(368), air(368 + 20, -400), risen).y).toBe(360);
  });

  it('GDD-UI-04 a bottom limit that drops lets the camera follow by the ordinary rule', () => {
    // At a raised bottom's limit (160) he walks off it onto ground where the limit is the level's (368): the camera does not move by itself.
    const dropped = cameraLimits(640);
    expect(flat(followCameraY(stood(160, 160 + 140), ground(160 + 140), dropped))).toEqual(flat(still(160)));
    // With his feet below the band it pans down 3 px a step as anywhere.
    expect(flat(followCameraY(stood(160, 160 + 192), ground(160 + 192), dropped))).toEqual(flat(still(163)));
  });

  it('GDD-UI-04 the step he appears at a respawn is a cut to the respawn point, drawn from there', () => {
    // A level 40 rows tall with a floor at row 30 (y 480); his checkpoint on it at x 100: the cut puts his feet at 136, y 344. He fell out at
    // x 200, far below; the camera held at 200 while he was hidden.
    const level = levelOf(rowsOf(30, () => 30));
    let r: RunState = { ...startRun(level), checkpoint: { x: 100, y: 480 }, player: { ...spawn(200, 700), grounded: false } };
    r = stepRun(r, { move: 0, jumpHeld: false }, level);
    expect(r.phase).toBe('respawning');
    let cam = still(200);
    let appeared: CameraStepped | null = null;
    for (let i = 0; i < 120 && appeared === null; i++) {
      const next = stepRun(r, { move: 0, jumpHeld: false }, level);
      const stepped = stepCameraY(cam, r, next, level);
      if (ponchoShown(next) && !ponchoShown(r)) appeared = stepped;
      // Hidden, it holds, though his feet are 500 px under it and falling (a camera told he is in play would look down after him).
      else expect(stepped, `step ${i}`).toEqual({ camera: still(200), from: 200 });
      cam = stepped.camera;
      r = next;
    }
    expect(r.phase).toBe('respawning');
    // The cut, to where he appears, not where he fell; drawn from the new y, so nothing between the two is drawn.
    expect(appeared).toEqual({ camera: stood(344, 480), from: 344 });
    expect(cutCameraY(r, level)).toEqual(stood(344, 480));
  });

  it('GDD-UI-04 stepping the camera reads whether he stands and draws from its last y', () => {
    // Standing on the floor at y 480 with his feet at screen y 380, below the band: on the ground it pans 3 px; read as in the air it would hold.
    const level = levelOf(rowsOf(30, () => 30));
    const r: RunState = { ...startRun(level), player: spawn(200, 480) };
    const next = stepRun(r, { move: 0, jumpHeld: false }, level);
    expect(next.player.grounded).toBe(true);
    const panned = stepCameraY(stood(100, 480), r, next, level);
    expect({ camera: flat(panned.camera), from: panned.from }).toEqual({ camera: flat(still(103)), from: 100 });
    // In play it reads the limits of his column: a raised bottom over it at row 29 (GDD-WLD-03, its floor line y 480 under his feet) puts its
    // limit at 208; from 210, his feet below the band, it pans up 2 px to that limit instead of down 3.
    const raised: Level = { ...level, bottoms: [{ fromCol: 10, toCol: 15, row: 29 }] };
    expect(cameraLimitsAt(raised, 200)).toEqual({ top: 0, bottom: 208 });
    const onRaised = stepRun(r, { move: 0, jumpHeld: false }, raised);
    expect(onRaised.phase).toBe('playing');
    const [up, down] = [stepCameraY(stood(210, 480), r, onRaised, raised), stepCameraY(stood(210, 480), r, onRaised, level)];
    expect([up.camera.y, up.from, down.camera.y, down.from]).toEqual([208, 210, 213, 210]);
  });

  it("GDD-UI-04 a cut over a raised bottom stops at the span's limit", () => {
    // The 40-row level with its floor at row 30 (y 480), a raised bottom over columns 10 to 15 at row 30 (GDD-WLD-03): its floor line y 496,
    // its limit 224 (the level's own 368). His feet at 480 want the camera at 344: inside the span the cut stops at 224, outside it does not.
    const level: Level = { ...levelOf(rowsOf(30, () => 30)), bottoms: [{ fromCol: 10, toCol: 15, row: 30 }] };
    expect(cameraLimitsAt(level, 12 * TILE)).toEqual({ top: 0, bottom: 224 });
    const run = startRun(level);
    expect(cutCameraY({ ...run, player: spawn(12 * TILE, 480) }, level)).toEqual(stood(224, 480));
    expect(cutCameraY({ ...run, player: spawn(20 * TILE, 480) }, level)).toEqual(stood(344, 480));
    // At a respawn the respawn point's column counts, not where he fell.
    const waiting: RunState = { ...run, phase: 'respawning', wait: 10, checkpoint: { x: 12 * TILE, y: 480 }, player: spawn(20 * TILE, 900) };
    expect(cutCameraY(waiting, level)).toEqual(stood(224, 480));
    expect(cutCameraY({ ...waiting, checkpoint: { x: 20 * TILE, y: 480 }, player: spawn(12 * TILE, 900) }, level)).toEqual(stood(344, 480));
  });

  it('GDD-UI-04 the level start is a cut to his feet at 136, which in every level built but 3-1 and 3-3 is the camera at 0', () => {
    // A start low in a tall level: the cut puts his feet at 136.
    const level = { ...levelOf(rowsOf(30, () => 30)), spawn: { x: 200, y: 480 } };
    expect(cutCameraY(startRun(level), level)).toEqual(stood(344, 480));
    // Every level built but 3-1 and 3-3 starts where the cut puts the camera at 0, where it is before the first cut: the scene's start cut
    // changes nothing there (lab-3t's start is on its plateau at row 8, his feet at y 128). 3-1 starts on its rim at row 9 (GDD-WLD-16), his
    // feet at y 144: the cut puts them at 136, the camera at 8. 3-3 starts on G0 at row 34 (GDD-WLD-18), his feet at y 544, 37 rows down:
    // the cut would put the camera at 408, and the level's bottom holds it at 320 (592 - 272), his feet at 224, as
    // `level3-3.camera.test.ts` measures at the start clock 0.
    for (const e of LEVELS.filter((l) => l.id !== '3-1' && l.id !== '3-3')) {
      const run = startRun(e.level);
      expect(cutCameraY(run, e.level), e.id).toEqual(stood(0, run.player.y));
    }
    const rim = levelById('3-1')!.level;
    expect(cutCameraY(startRun(rim), rim)).toEqual(stood(8, 144));
    const peaks = levelById('3-3')!.level;
    expect(cutCameraY(startRun(peaks), peaks)).toEqual(stood(320, 544));
  });

  it('GDD-BOS-01 a screen shake is drawn on top of the camera y', () => {
    // A positive offset draws the world lower: the camera goes up by it, from wherever it is.
    expect(cameraScroll(100, 2)).toBe(98);
    expect(cameraScroll(100, -4)).toBe(104);
    expect(cameraScroll(0, 2)).toBe(-2);
  });
});

/** The camera at `y` in the look `look`, his feet last grounded at `last` (default `ref`), none of the 30 steps counted yet. */
const looking = (look: 'up' | 'downward', y: number, ref: number, last = ref): CameraY => ({ ...stood(y, last), look, ref });

// GDD-UI-04, the look-ahead up and down (Proposed): the expected values are the GDD's. Limits wide enough that nothing clamps unless a test
// says so: a level 100 rows tall.
describe('GDD-UI-04 the look-ahead, up and down', () => {
  const WIDE = cameraLimits(100 * TILE);
  /** `n` grounded steps with his feet at level y `feetY`. */
  const stand = (cam: CameraY, feetY: number, n: number): CameraY => {
    for (let i = 0; i < n; i++) cam = followCameraY(cam, ground(feetY), WIDE);
    return cam;
  };

  it('GDD-UI-04 standing 32 px above the reference starts the look-up and pans to the 60% line', () => {
    // Standing at 500; the camera's top at 250, so his feet are at screen y 250 (88 px under the 60% line, 162).
    const start = { ...stood(250, 500), last: 468 }; // standing at 468 already: only the pan is measured
    let cam = followCameraY(start, ground(468), WIDE);
    expect(cam).toMatchObject({ look: 'up', ref: 468 });
    // 3 px a step (180 px/s) until his feet are at 162: 468 - 162 = 306, 56 px from 250: 18 steps of 3 and one of 2.
    const moves = [cam.y - 250];
    for (let i = 0; i < 25; i++) {
      const next = followCameraY(cam, ground(468), WIDE);
      moves.push(next.y - cam.y);
      cam = next;
      expect(cam.look, `step ${i}`).toBe('up');
      if (468 - cam.y === 162) break;
    }
    expect(moves).toEqual([...Array<number>(18).fill(3), 2]);
    expect(468 - cam.y).toBe(162);
    // 31 px above is not enough: the band stays, the reference where it was.
    expect(followCameraY(start, ground(469), WIDE)).toMatchObject({ look: 'band', ref: 500 });
  });

  it('GDD-UI-04 standing 32 px below the reference starts the look-down on the ground at the 40% line', () => {
    // Standing at 500; the camera's top at 380.
    const start = { ...stood(380, 500), last: 532 };
    let cam = followCameraY(start, ground(532), WIDE);
    expect(cam).toMatchObject({ look: 'downward', ref: 532 });
    // His feet at 532 - 380 = 152 on screen: 44 px to go to 108, so 14 steps of 3 and one of 2.
    const moves = [cam.y - 380];
    for (let i = 0; i < 25; i++) {
      const next = followCameraY(cam, ground(532), WIDE);
      moves.push(next.y - cam.y);
      cam = next;
      expect(cam.look, `step ${i}`).toBe('downward');
      if (532 - cam.y === 108) break;
    }
    expect(moves).toEqual([...Array<number>(14).fill(3), 2]);
    expect(532 - cam.y).toBe(108);
    expect(followCameraY(start, ground(531), WIDE)).toMatchObject({ look: 'band', ref: 500 });
  });

  it('GDD-UI-04 the look-up keeps the highest he has stood and turns at 32 px back', () => {
    const up = looking('up', 300, 400);
    // Higher: the reference follows him.
    const higher = followCameraY(up, ground(380), WIDE);
    expect(higher).toMatchObject({ look: 'up', ref: 380 });
    // Back down 31 px from the highest: still the look-up; 32 px: the look-down, with his feet there as its reference.
    expect(followCameraY(higher, ground(411), WIDE)).toMatchObject({ look: 'up', ref: 380 });
    expect(followCameraY(higher, ground(412), WIDE)).toMatchObject({ look: 'downward', ref: 412 });
    // The mirror: the look-down keeps the lowest and turns at 32 px up.
    const down = looking('downward', 300, 400);
    const lower = followCameraY(down, ground(420), WIDE);
    expect(lower).toMatchObject({ look: 'downward', ref: 420 });
    expect(followCameraY(lower, ground(389), WIDE)).toMatchObject({ look: 'downward', ref: 420 });
    expect(followCameraY(lower, ground(388), WIDE)).toMatchObject({ look: 'up', ref: 388 });
  });

  it('GDD-UI-04 30 steps at one height end the look and the band holds again', () => {
    // In the look-up with his feet at screen y 162 (camera 306 for feet 468): 29 steps at one height keep it, the 30th ends it.
    const up = looking('up', 306, 468);
    const after29 = stand(up, 468, 29);
    expect(after29).toMatchObject({ look: 'up', ref: 468, still: 29, y: 306 });
    const settled = followCameraY(after29, ground(468), WIDE);
    expect(settled).toMatchObject({ look: 'band', ref: 468, y: 309 });
    // The band pans him from 162 to its bottom edge, 156: 6 px, 3 px a step.
    expect(stand(settled, 468, 2).y).toBe(312);
    expect(468 - stand(settled, 468, 5).y).toBe(CAMERA.bandBottom);
    // The same in the look-down: 108 to the band's top, 116.
    const settledDown = stand(looking('downward', 360, 468), 468, 30);
    expect(settledDown).toMatchObject({ look: 'band', ref: 468 });
    expect(468 - stand(settledDown, 468, 5).y).toBe(CAMERA.bandTop);
    // A step that moves his feet by 0.02 px resets the count; one that moves them by 0.005 does not. From 28 counted steps:
    const nearly = { ...up, still: 28 };
    expect(stand(nearly, 468.005, 2)).toMatchObject({ look: 'band', ref: 468.005 });
    expect(stand(nearly, 468.02, 2)).toMatchObject({ look: 'up', still: 1 });
    // The step he arrives at a new height counts 0: 29 more there keep the look-up, the 30th ends it.
    const arrived = followCameraY(up, ground(470), WIDE);
    expect(arrived.still).toBe(0);
    expect(stand(arrived, 470, 29).look).toBe('up');
    expect(stand(arrived, 470, 30)).toMatchObject({ look: 'band', ref: 470 });
  });

  it('GDD-UI-04 standing still in the band makes where he stands the reference', () => {
    // The band's look, the reference at 500: 30 steps at 484, and 468 is then 16 px above the reference, not 32.
    const band = { ...stood(300, 500), last: 484 };
    expect(followCameraY(stand(band, 484, 30), ground(468), WIDE)).toMatchObject({ look: 'band', ref: 484 });
    // 29 steps are not enough: the reference stays 500 and 468 starts the look-up.
    expect(followCameraY(stand(band, 484, 29), ground(468), WIDE)).toMatchObject({ look: 'up', ref: 468 });
  });

  it("GDD-UI-04 a fall's look-down catches up at the 40% line", () => {
    // In the air falling at 300 px/s with the look-down on, the camera's top at 100: it gains 7 px a step (the fall's 5 and 2) while his feet
    // are lower than screen y 108 and 2 px more than they gain on it at the end, and stops when they are at 108.
    const falling = { ...still(100), lead: true };
    expect(followCameraY(falling, air(100 + 108, 300), WIDE).y).toBe(100);
    expect(followCameraY(falling, air(100 + 110, 300), WIDE).y).toBe(102);
    expect(followCameraY(falling, air(100 + 116, 300), WIDE).y).toBe(107);
    expect(followCameraY(falling, air(100 + 130, 300), WIDE).y).toBe(107);
  });

  it('GDD-UI-04 in the look-up a fall starts the look-down below 194, not 156', () => {
    // upFeet + riseTrigger: 162 + 32. A drop of less than two tiles from the 60% line lands in the look-up without a look-down first.
    const falling = (look: 'up' | 'downward', onScreen: number) => followCameraY({ ...looking(look, 100, 300), last: 300 }, air(100 + onScreen, 300), WIDE);
    expect(falling('up', 160).lead).toBe(false);
    expect(falling('up', 162.5).lead).toBe(false);
    expect(falling('up', 194).lead).toBe(false);
    expect(falling('up', 194.5).lead).toBe(true);
    // In the band, and in the look-down on the ground, the line is 156 as before.
    expect(followCameraY(still(100), air(100 + 157, 300), WIDE).lead).toBe(true);
    expect(followCameraY(still(100), air(100 + 156, 300), WIDE).lead).toBe(false);
    expect(falling('downward', 157).lead).toBe(true);
    expect(falling('downward', 156).lead).toBe(false);
  });

  it('GDD-UI-04 the air keeps the look and the reference and forgets the last grounded y', () => {
    const mid: CameraY = { ...looking('up', 100, 300, 310), still: 12 };
    for (const [name, input] of [['rising', air(300, -200)], ['falling', air(280, 200)]] as const) {
      const next = followCameraY(mid, input, WIDE);
      expect(next, name).toMatchObject({ look: 'up', ref: 300, last: null, still: 0 });
    }
    // And the landing is the next grounded step, compared with the reference: 32 px under it starts the look-down.
    const landed = followCameraY(followCameraY(mid, air(300, 200), WIDE), ground(332), WIDE);
    expect(landed).toMatchObject({ look: 'downward', ref: 332, still: 0, last: 332 });
  });

  it('GDD-UI-04 the cut places the band mode at his feet', () => {
    expect(placeCameraY(300, LIMITS)).toEqual({ y: 164, lead: false, look: 'band', ref: 300, still: 0, last: 300 });
  });

  it('GDD-UI-04 a jump onto a ledge one tile up and a cart anchor of 15.5 px do not start the look-up', () => {
    const band = stood(300, 500);
    for (const rise of [TILE, 15.5, 31.75]) expect(followCameraY(band, ground(500 - rise), WIDE), `${rise}`).toMatchObject({ look: 'band', ref: 500 });
    for (const drop of [TILE, 15.5, 31.75]) expect(followCameraY(band, ground(500 + drop), WIDE), `${drop}`).toMatchObject({ look: 'band', ref: 500 });
  });

  it('GDD-UI-04 in a look on the ground the camera gains 2 px a step on him', () => {
    // His feet move `speed` px a step (down or up) with the look on; the camera, far from its line, moves at his speed plus 2 px (120 px/s),
    // 3 px a step at least, 8 at most, and stops with his feet on the line.
    const chase = (look: 'up' | 'downward', speed: number, start: number) => {
      const sign = look === 'up' ? -1 : 1;
      let feetY = 1000;
      let cam = looking(look, start, feetY);
      const moves: number[] = [];
      for (let i = 0; i < 80; i++) {
        feetY += sign * speed;
        const next = followCameraY(cam, ground(feetY), WIDE);
        moves.push(next.y - cam.y);
        cam = next;
        if (Math.abs(feetY - cam.y - (look === 'up' ? CAMERA.upFeet : CAMERA.downFeet)) < 1e-9) break;
      }
      return { moves: moves.map((m) => sign * m), on: feetY - cam.y };
    };
    // 2.12 px a step (the descending cart): 4.12 a step, on his feet's line at the end, never past it.
    for (const [look, start] of [['downward', 800], ['up', 900]] as const) {
      const { moves, on } = chase(look, 2.12, start);
      moves.slice(0, -1).forEach((m, i) => expect(m, `${look} step ${i}`).toBeCloseTo(4.12, 9));
      expect(moves.at(-1)!, look).toBeLessThanOrEqual(4.12 + 1e-9);
      expect(on, look).toBeCloseTo(look === 'up' ? CAMERA.upFeet : CAMERA.downFeet, 9);
    }
    // 0.5 px a step: 2.5 is under the pan, so 3. 10 px a step: 12 is over the fastest move, so 8.
    expect(chase('downward', 0.5, 800).moves.slice(0, -1).every((m) => Math.abs(m - 3) < 1e-9)).toBe(true);
    expect(chase('downward', 10, 400).moves.slice(0, 5)).toEqual([8, 8, 8, 8, 8]);
    // The band's pan is not gained on: his feet at 6 px a step, 40 px below it, still 3 px a step.
    expect(followCameraY({ ...stood(100, 296), last: 290 }, ground(296), LIMITS).y).toBe(103);
  });

  it('GDD-UI-04 the look-up still pans at most 3 px a step and respects the limits', () => {
    // His feet at 312, the camera at 100: the 60% line puts it at 150, 50 px away: 16 steps of 3 and one of 2.
    let cam = looking('up', 100, 312);
    const moves: number[] = [];
    for (let i = 0; i < 17; i++) {
      const next = followCameraY(cam, ground(312), WIDE);
      moves.push(next.y - cam.y);
      cam = next;
    }
    expect(moves).toEqual([...Array<number>(16).fill(3), 2]);
    // The target (-2) is over the top limit (90): it stops there. And a target under the bottom limit (120) stops there.
    const top = { top: 90, bottom: 1000 };
    let high = looking('up', 100, 160);
    for (let i = 0; i < 10; i++) high = followCameraY(high, ground(160), top);
    expect(high.y).toBe(90);
    let low = looking('up', 100, 312);
    for (let i = 0; i < 10; i++) low = followCameraY(low, ground(312), { top: 0, bottom: 120 });
    expect(low.y).toBe(120);
    // The look-down's line (108) is held by the same limits: feet at 312 want 204, over the bottom limit 120; at 160 they want 52, over the top 90.
    let deep = looking('downward', 100, 312);
    for (let i = 0; i < 10; i++) deep = followCameraY(deep, ground(312), { top: 0, bottom: 120 });
    expect(deep.y).toBe(120);
    let shallow = looking('downward', 100, 160);
    for (let i = 0; i < 10; i++) shallow = followCameraY(shallow, ground(160), top);
    expect(shallow.y).toBe(90);
  });
});

// GDD-UI-04, the look-ahead sideways: in a rolling cart the camera keeps a lead of 64 px, grown and shrunk by 2 px a step, and follows the
// point `body.x + lead`. The level is lab-3c, whose rail 0 rolls right (20 tiles on the floor) and rail 3 rolls left (8 tiles). The expected
// values are the GDD's: 64 px, 2 px a step, his body at 192 rolling right and 288 rolling left.
/** The lead's steps from 0 to `to` by `by` px a step: `by`, 2 `by` ... `to`. */
const upTo = (to: number, by: number): number[] => Array.from({ length: Math.abs(to) / by }, (_, i) => Math.sign(to) * by * (i + 1));

/** The run waiting to respawn, before the flip shows him: Poncho is hidden. */
const waiting = (run: RunState): RunState => ({ ...run, phase: 'respawning', wait: 100 });

describe('GDD-UI-04 the lead in a rolling cart', () => {
  const lab = LAB_3C_LEVEL;
  const RIGHT = 0;
  const LEFT = 3;
  /** A run with Poncho standing in cart `i`, in phase `phase`, on the floor of that cart (`grounded` false: at its height in the air). */
  const inCart = (i: number, phase: CartState['phase'] = 'rolling', grounded = true): RunState => {
    const rail = lab.rails![i]!;
    const cart: CartState = { phase, m: 80 };
    const floor = cartFloor(rail, cart);
    const base = startRun(lab);
    return { ...base, player: { ...spawn(floor.x + floor.w / 2, floor.y), grounded }, carts: base.carts.map((c, k) => (k === i ? cart : c)) };
  };
  /** Poncho on the floor at column 30, with no cart there (R2 starts at column 27 and its cart is 32 px wide). */
  const onGround = (grounded = true): RunState => ({ ...startRun(lab), player: { ...spawn(30 * TILE + 8, LAB_3C_FLOOR_Y), grounded } });
  /** `n` steps of the lead in the one state, the leads after each. */
  const lead = (from: number, run: RunState, n: number): number[] => {
    const out: number[] = [];
    for (let i = 0; i < n; i++) out.push((from = stepCartLead(from, run, run, lab)));
    return out;
  };

  it('GDD-UI-04 standing in a rolling cart the lead grows 2 px a step to 64 the way it rolls', () => {
    expect(lab.rails![RIGHT]!.dir).toBe(1);
    expect(lab.rails![LEFT]!.dir).toBe(-1);
    expect(lead(0, inCart(RIGHT), 36)).toEqual([...upTo(64, 2), 64, 64, 64, 64]);
    expect(lead(0, inCart(LEFT), 36)).toEqual([...upTo(-64, 2), -64, -64, -64, -64]);
    // A lead of the other sign turns the same way, 2 px a step through 0: from -64 rolling right it takes 32 steps to 0.
    expect(lead(-64, inCart(RIGHT), 33).slice(29, 32)).toEqual([-4, -2, 0]);
  });

  it('GDD-UI-04 on ground or in a cart that is not rolling the lead shrinks 2 px a step to 0', () => {
    const down = [...Array.from({ length: 32 }, (_, i) => 62 - 2 * i), 0, 0];
    for (const [name, run] of [['a waiting cart', inCart(RIGHT, 'waiting')], ['a stopped cart', inCart(RIGHT, 'stopped')], ['plain ground', onGround()]] as const) {
      expect(lead(64, run, 34), name).toEqual(down);
      expect(lead(-64, run, 34), name).toEqual(down.map((l) => (l === 0 ? 0 : -l)));
    }
  });

  it('GDD-UI-04 in the air the lead holds', () => {
    // From 40, in the air off the ground (a jump out of a cart onto ground, or over one) and in the air over a rolling cart (a jump straight
    // up in it): it stays, whatever the target would be there (64 over a rolling cart, 0 elsewhere).
    for (const [name, run] of [['over nothing', onGround(false)], ['over a rolling cart', inCart(RIGHT, 'rolling', false)]] as const) {
      expect(lead(40, run, 5), name).toEqual([40, 40, 40, 40, 40]);
      expect(lead(-40, run, 5), name).toEqual([-40, -40, -40, -40, -40]);
    }
    // From the landing step he stands again: it moves.
    expect(lead(40, onGround(true), 2)).toEqual([38, 36]);
  });

  it('GDD-UI-04 hidden the lead holds, and the step he appears cuts it to 0', () => {
    // Hidden (waiting to respawn, before the flip shows him; or on the game over screen) with him grounded in a rolling cart or on the ground.
    for (const run of [waiting(inCart(RIGHT)), waiting(onGround()), { ...onGround(), phase: 'gameover' as const }]) {
      expect(ponchoShown(run)).toBe(false);
      expect(lead(40, run, 3)).toEqual([40, 40, 40]);
    }
    // The step he appears (the respawn: not shown before, in play after): 0, from any lead, though the rule would say 62 or 38.
    const before = waiting(onGround());
    for (const [from, run] of [[64, onGround()], [-64, onGround()], [40, inCart(RIGHT)]] as const) {
      expect(ponchoShown(run) && !ponchoShown(before)).toBe(true);
      expect(stepCartLead(from, before, run, lab)).toBe(0);
    }
    // Shown on both sides of the step, it is not a cut.
    expect(stepCartLead(64, onGround(), onGround(), lab)).toBe(62);
  });

  it('GDD-UI-04 with the lead at 64 rolling right he is held at 40% of the width', () => {
    // The scroll follows the point `x + lead` with the dead zone unchanged: settled, he is at 192 going right (288 px ahead) and 288 going left.
    const WIDE = 1920;
    const [right, left] = [lead(0, inCart(RIGHT), 40).at(-1)!, lead(0, inCart(LEFT), 40).at(-1)!];
    expect([right, left]).toEqual([64, -64]);
    let scroll = 0;
    for (const x of [100, 150, 192, 250, 300, 360]) {
      scroll = followCamera(scroll, x + right, WIDE);
      if (x >= 192) expect(x - scroll, `right at ${x}`).toBe(192);
    }
    expect(480 - 192).toBe(288);
    scroll = 700;
    for (const x of [1000, 950, 900, 850, 800]) {
      scroll = followCamera(scroll, x + left, WIDE);
      if (x <= 900) expect(x - scroll, `left at ${x}`).toBe(288);
    }
  });

  it('GDD-UI-04 the lead is drawn between its steps', () => {
    expect(cartLeadDraw(60, 62, 0.5)).toBe(61);
    expect(cartLeadDraw(60, 62, 0)).toBe(60);
    expect(cartLeadDraw(60, 62, 1)).toBe(62);
    expect(cartLeadDraw(-62, -64, 0.5)).toBe(-63);
  });
});

describe('GDD-UI-04 a short drop in the look-up', () => {
  // A floor at row 30 (y 480) up to column 9 and one tile lower (row 31) from column 10, in a level 40 rows tall, and the camera in the look-up with
  // his feet on the 60% line at the edge: the one-tile walk-off.
  const level = levelOf(rowsOf(40, (col) => (col < 10 ? 30 : 31)));
  const edge = (): { run: RunState; cam: CameraY } => {
    const run: RunState = { ...startRun(level), player: { ...spawn(9 * TILE + 8, 30 * TILE), grounded: true } };
    return { run, cam: { ...stood(480 - CAMERA.upFeet, 480), look: 'up', ref: 480 } };
  };

  it('GDD-UI-04 in the look-up his feet never stand lower than one step of fall past y = 194, so y = 200 at the most', () => {
    // A fall in the look-up starts the look-down only past y = 194, and then gains on him. So his feet can pass 194 by one step of fall at
    // most: terminal velocity, 6 px a step, gives y = 200, 8 px over the Jump button's top (208). Swept: every start height in the look-up
    // line's reach, every fall speed up to terminal velocity, with a landing (or a step on, in the air) on every step of the fall.
    const WIDE = cameraLimits(100 * TILE);
    const bound = CAMERA.upFeet + CAMERA.riseTrigger + GRAVITY.terminalVelocity * STEP;
    expect(bound).toBe(200);
    // `most` over every start, the rest line's and the heights a pan passes through after a short landing; `fromRest` over starts at the 60%
    // line or above, where he stands at rest, which must reach past 194 (else the look-down would start sooner than the rule says).
    let most = 0;
    let fromRest = 0;
    for (let startOn = 150; startOn <= 194; startOn += 0.35) {
      for (let vy = 30; vy <= GRAVITY.terminalVelocity; vy += 30) {
        let cam: CameraY = looking('up', 100, 100 + startOn - 16, 100 + startOn);
        let feetY = 100 + startOn;
        for (let i = 0; i < 40; i++) {
          feetY += vy * STEP;
          // The landing on this step, compared with going on in the air.
          const landed = followCameraY(cam, ground(feetY), WIDE);
          const low = Math.max(feetY - cam.y, feetY - landed.y);
          cam = followCameraY(cam, air(feetY, vy), WIDE);
          const lowest = Math.max(low, feetY - cam.y);
          most = Math.max(most, lowest);
          if (startOn <= CAMERA.upFeet) fromRest = Math.max(fromRest, lowest);
        }
      }
    }
    expect(most).toBeLessThanOrEqual(bound + 1e-9);
    expect(fromRest).toBeGreaterThan(CAMERA.upFeet + CAMERA.riseTrigger);
  });

  it('GDD-UI-04 a short drop in the look-up does not swing the camera back', () => {
    let { run, cam } = edge();
    const ys: number[] = [cam.y];
    const feet: number[] = [];
    let landed = -1;
    for (let i = 0; i < 160; i++) {
      const next = stepRun(run, { move: 1, jumpHeld: false }, level);
      cam = stepCameraY(cam, run, next, level).camera;
      run = next;
      ys.push(cam.y);
      feet.push(run.player.y);
      if (landed < 0 && i > 0 && run.player.y === 31 * TILE && run.player.grounded) landed = i;
    }
    // He walked off the edge and landed one tile lower, and the look-up held until the band came back.
    expect(landed).toBeGreaterThan(0);
    expect(run.player.y).toBe(31 * TILE);
    // The camera never moves up, at any step from the walk-off to the settled band: down 16 px to put his feet back on the 60% line, then 6 px
    // more when the band returns (30 still steps on), 22 in all.
    for (let i = 1; i < ys.length; i++) expect(ys[i]! - ys[i - 1]!, `step ${i}`).toBeGreaterThanOrEqual(0);
    expect(ys.at(-1)! - ys[0]!).toBeCloseTo(CAMERA.upFeet - CAMERA.bandBottom + TILE, 9);
    expect(cam.look).toBe('band');
    expect(run.player.y - cam.y).toBe(CAMERA.bandBottom);
    // No look-down was started in the air.
    expect(feet.length).toBeGreaterThan(0);
  });
});
