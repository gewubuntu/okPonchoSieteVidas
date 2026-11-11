import { describe, expect, it } from 'vitest';
import { BASE_HEIGHT, CAMERA, GLIDE, GRAVITY, STEP, TILE } from '../config/tuning';
import { LEVELS } from '../levels';
import { flatWorld, spawn, step, type PlayerState } from '../sim/movement';
import { startRun, stepRun, type Level, type RunState } from '../sim/run';
import { parseTiles } from '../sim/tilemap';
import { cameraDrawY, cameraLimits, cameraScroll, followCamera, followCameraY, placeCameraY, type CameraY, type CameraYInput } from './camera';

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
const still = (y: number): CameraY => ({ y, lead: false });
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
  let cam = still(100);
  const moves: number[] = [];
  for (let i = 0; i < 20; i++) {
    const next = followCameraY(cam, ground(feetY), LIMITS);
    moves.push(next.y - cam.y);
    cam = next;
  }
  return moves;
};

describe('GDD-UI-04 the camera follows up and down', () => {
  it('GDD-UI-04 it stands still while his feet are in the band on the ground: at 116 and at 156', () => {
    expect(followCameraY(still(100), ground(216), LIMITS)).toEqual(still(100));
    expect(followCameraY(still(100), ground(256), LIMITS)).toEqual(still(100));
  });

  it('GDD-UI-04 it moves when they are a quarter px outside: at 115.75 and 156.25', () => {
    expect(followCameraY(still(100), ground(215.75), LIMITS).y).toBe(99.75);
    expect(followCameraY(still(100), ground(256.25), LIMITS).y).toBe(100.25);
  });

  it('GDD-UI-04 on the ground it pans at 180 px/s, 3 px a step, and stops with his feet on the nearer edge of the band', () => {
    // His feet 40 px below the band (screen y 196): 13 steps of 3 px and one of 1 px, then still with them on its bottom edge, 156.
    expect(pan(296)).toEqual([...Array<number>(13).fill(3), 1, ...Array<number>(6).fill(0)]);
    // 40 px above it (76): the same upwards, to its top edge, 116.
    expect(pan(176)).toEqual([...Array<number>(13).fill(-3), -1, ...Array<number>(6).fill(0)]);
  });

  it('GDD-UI-04 a step of one or two tiles does not move it', () => {
    // From the band's middle (136) a tile up or down stays inside it.
    expect(followCameraY(still(100), ground(236 + TILE), LIMITS).y).toBe(100);
    expect(followCameraY(still(100), ground(236 - TILE), LIMITS).y).toBe(100);
    // Two tiles from one edge towards the other stay inside it: from 116 down to 148, from 156 up to 124.
    expect(followCameraY(still(100), ground(216 + 2 * TILE), LIMITS).y).toBe(100);
    expect(followCameraY(still(100), ground(256 - 2 * TILE), LIMITS).y).toBe(100);
    // Measured: two tiles from the middle land 8 px outside the 40 px band (168 or 104), so the camera pans 12 px to the nearer edge.
    let cam = still(100);
    for (let i = 0; i < 10; i++) cam = followCameraY(cam, ground(236 + 2 * TILE), LIMITS);
    expect(cam.y).toBe(112);
    // Three tiles never fit in it: from either edge it moves.
    expect(followCameraY(still(100), ground(216 + 3 * TILE), LIMITS).y).toBeGreaterThan(100);
    expect(followCameraY(still(100), ground(256 - 3 * TILE), LIMITS).y).toBeLessThan(100);
  });

  it('GDD-UI-04 a jump from the ground does not move it', () => {
    const FLOOR = 320;
    const world = flatWorld(FLOOR);
    const limits = cameraLimits(2000);
    for (const edge of [CAMERA.bandTop, CAMERA.bandBottom]) {
      const y0 = FLOOR - edge;
      let cam = still(y0);
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
      let cam = still(y0);
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

  it('GDD-UI-04 a fall looks down: below y = 156 and falling, it gains 2 px a step on him until his feet are at 116, then follows at his fall speed', () => {
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
      // 20 steps at his speed plus 120 px/s (2 px a step more than him), which bring his feet from 156 to 116; then at his speed.
      moves.forEach((m, i) => expect(m, `${vy} px/s, step ${i}`).toBeCloseTo(((i < 20 ? vy + CAMERA.leadSpeed : vy) * STEP), 9));
      feet.forEach((f, i) => expect(f, `${vy} px/s, step ${i}`).toBeCloseTo(i < 20 ? 154 - 2 * i : 116, 9));
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

  it('GDD-UI-04 it ends when he lands, with no swing back', () => {
    let cam = still(100);
    let feetY = 256;
    for (let i = 0; i < 10; i++) {
      feetY += 6;
      cam = followCameraY(cam, air(feetY, 360), LIMITS);
    }
    expect(cam.lead).toBe(true);
    const landed = followCameraY(cam, ground(feetY), LIMITS);
    expect(landed.lead).toBe(false);
    expect(landed.y).toBe(cam.y);
    // His feet are inside the band: the next 30 steps on the ground do not move it.
    let after = landed;
    for (let i = 0; i < 30; i++) after = followCameraY(after, ground(feetY), LIMITS);
    expect(after).toEqual(landed);
    // And a hop down inside the band afterwards is no look-down.
    expect(followCameraY(after, air(feetY + 4, 200), LIMITS)).toEqual(landed);
    // Rising ends it too.
    expect(followCameraY(cam, air(feetY - 2, -100), LIMITS).lead).toBe(false);
  });

  it('GDD-UI-04 in any fall at least 114 px below his feet are in view, and 154 px after 20 steps', () => {
    // He walks off ground at row 10 (y 160) and falls 12 tiles to ground at row 22, the camera with his feet on the band's top, middle
    // and bottom. What is in view below his feet (270 less their screen y) on each step in the air, by where they started.
    const level = levelOf(rowsOf(30, (col) => (col < 10 ? 10 : 22)));
    const below = new Map<number, number[]>();
    for (const on of [CAMERA.bandTop, CAMERA.spawnFeet, CAMERA.bandBottom]) {
      let r: RunState = { ...startRun(level), player: spawn(140, 10 * TILE) };
      let cam = still(10 * TILE - on);
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
    // From the band's bottom edge the look-down starts at once: 154 px from the 19th step on, so after 20 steps (0.33 s) as the GDD says.
    expect(below.get(CAMERA.bandBottom)![19]).toBeCloseTo(154, 6);
    // Measured: from higher in the band it starts only once his feet pass 156, so 20 steps in he sees 135.1 px (from the top edge) and
    // 138.4 (from the middle), and 154 from the 30th and the 28th step on.
    expect(below.get(CAMERA.bandTop)![19]).toBeCloseTo(135.13, 2);
    expect(below.get(CAMERA.spawnFeet)![19]).toBeCloseTo(138.38, 2);
    expect(below.get(CAMERA.bandTop)!.findIndex((b) => b > 153.99) + 1).toBe(30);
    expect(below.get(CAMERA.spawnFeet)!.findIndex((b) => b > 153.99) + 1).toBe(28);
  });

  it('GDD-UI-04 it never moves more than 8 px in a step', () => {
    // A teleport-sized change: on the ground the 3 px pan, in the air at most 8 px, up or down.
    expect(followCameraY(still(200), ground(5000), LIMITS).y).toBe(203);
    expect(followCameraY(still(200), air(5000, 3000), LIMITS).y).toBe(208);
    expect(followCameraY(still(200), air(-5000, -3000), LIMITS).y).toBe(192);
    expect(followCameraY({ y: 200, lead: true }, air(5000, 3000), LIMITS).y).toBe(208);
  });

  it('GDD-UI-04 it stops at the level top and at 2 px above its floor line', () => {
    expect(cameraLimits(272)).toEqual({ top: 0, bottom: 0 });
    expect(cameraLimits(640)).toEqual({ top: 0, bottom: 368 });
    // A floor line above the level's bottom (a raised bottom, GDD-WLD-03) stops it 2 px above that line.
    expect(cameraLimits(640, 400)).toEqual({ top: 0, bottom: 128 });
    expect(followCameraY(still(1), ground(50), LIMITS).y).toBe(0);
    expect(followCameraY(still(1), air(-500, -400), LIMITS).y).toBe(0);
    expect(followCameraY(still(367), ground(700), LIMITS).y).toBe(368);
    expect(followCameraY({ y: 366, lead: true }, air(900, 360), LIMITS).y).toBe(368);
  });

  it('GDD-UI-04 a level 17 rows tall never moves it: every level in the game today', () => {
    // Every level but the tall lab is 17 rows (272 px): its camera has no room to move (the approved screenshots hold).
    expect(LEVELS.filter((e) => e.level.world.height !== 17).map((e) => e.id)).toEqual(['lab-3t']);
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
      expect(followCameraY({ y: 100, lead }, { feetY: 600, grounded: false, vy: 360, hidden: true }, LIMITS)).toEqual({ y: 100, lead });
      expect(followCameraY({ y: 100, lead }, { feetY: 20, grounded: true, vy: 0, hidden: true }, LIMITS)).toEqual({ y: 100, lead });
    }
  });

  it('GDD-UI-04 the cut puts his feet at 136, or as near as the limits allow', () => {
    expect(placeCameraY(300, LIMITS)).toEqual(still(164));
    expect(placeCameraY(100, LIMITS)).toEqual(still(0));
    expect(placeCameraY(600, LIMITS)).toEqual(still(368));
  });

  it('GDD-UI-04 it is drawn at whole art pixels between steps', () => {
    expect([0, 0.5, 1].map((a) => cameraDrawY(100, 108, a))).toEqual([100, 104, 108]);
    expect(cameraDrawY(100, 101, 0.3)).toBe(100.25); // 100.3 to the nearest quarter px
    expect(cameraDrawY(100, 100.6, 1)).toBe(100.5);
    expect(cameraDrawY(100, 100.9, 1)).toBe(101);
  });

  it('GDD-BOS-01 a screen shake is drawn on top of the camera y', () => {
    // A positive offset draws the world lower: the camera goes up by it, from wherever it is.
    expect(cameraScroll(100, 2)).toBe(98);
    expect(cameraScroll(100, -4)).toBe(104);
    expect(cameraScroll(0, 2)).toBe(-2);
  });
});
