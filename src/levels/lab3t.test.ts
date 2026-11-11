import { describe, expect, it } from 'vitest';
import { CAMERA, CART, HITBOX, PLATFORM, TILE } from '../config/tuning';
import { cartFloor } from '../sim/cart';
import { isOutOfLives } from '../sim/lives';
import { spawn, type PlayerInput } from '../sim/movement';
import { platformAt } from '../sim/platform';
import { flipPose } from '../sim/respawnFlip';
import { respawnPoint, startRun, stepRun, type RunState } from '../sim/run';
import { cameraLimits, followCamera, followCameraY, placeCameraY, type CameraY } from '../ui/camera';
import { levelById } from './index';
import { LAB_3T_CART_PLATEAU, LAB_3T_CHASM, LAB_3T_DROP, LAB_3T_ID, LAB_3T_LEDGE, LAB_3T_LEVEL, LAB_3T_LIFT, LAB_3T_LOWEST, LAB_3T_OFRENDAS, LAB_3T_PLATEAU, LAB_3T_RAILS, LAB_3T_SPAWN, LAB_3T_SPRINGS, LAB_3T_STAIRS, LAB_3T_TOP } from './lab3t';
import { validateLevel } from './validate';

// GDD-UI-04, GDD-TEC-04: lab-3t, over the real level data (L-014), with the camera stepped beside the run as the scene steps it. Positions
// are read from `src/levels/lab3t.ts` (L-062).
const level = LAB_3T_LEVEL;
const LIMITS = cameraLimits(level.world.height * TILE);
const WIDTH_PX = level.world.width * TILE;
const FAR_Y = LAB_3T_CHASM.farRow * TILE;
/** The top of the staircase's last step, whose right edge is the drop's lip. */
const LIP_Y = LAB_3T_DROP.lipRow * TILE;
const LANDING_Y = LAB_3T_DROP.row * TILE;

/** The run, the camera up and down and the sideways scroll after a step. */
interface Frame {
  readonly r: RunState;
  readonly cam: CameraY;
  readonly scrollX: number;
}

/** Whether Poncho is drawn, as the scene draws him: in play, on the clear screen, and in a respawn's flip once it shows him. */
const shown = (r: RunState): boolean => r.phase === 'playing' || r.phase === 'clear' || (r.phase === 'respawning' && !isOutOfLives(r.lives) && flipPose(r.wait).visible);

/**
 * One step of the run and of the camera beside it, as the scene steps it: on the step he appears at a respawn, the cut puts his feet at the
 * respawn point at 136; otherwise one step of the rule, holding while he is not in play. The sideways camera follows his body.
 */
function advance(f: Frame, input: PlayerInput): Frame {
  const r = stepRun(f.r, input, level);
  const cam =
    shown(r) && !shown(f.r)
      ? placeCameraY(r.phase === 'respawning' ? respawnPoint(r, level).y : r.player.y, LIMITS)
      : followCameraY(f.cam, { feetY: r.player.y, grounded: r.player.grounded, vy: r.player.vy, hidden: r.phase !== 'playing' }, LIMITS);
  return { r, cam, scrollX: followCamera(f.scrollX, shown(r) ? r.player.x : null, WIDTH_PX) };
}

/** Poncho standing at (x, y) in `run` (a fresh one by default), the camera placed there by the cut, as at a level start or a teleport. */
const at = (x: number, y: number, run: RunState = startRun(level)): Frame => ({ r: { ...run, player: spawn(x, y) }, cam: placeCameraY(y, LIMITS), scrollX: followCamera(0, x, WIDTH_PX) });

/** His feet's screen y. */
const feetOnScreen = (f: Frame): number => f.r.player.y - f.cam.y;

/** The top of the ground in column `col`, in px. */
const groundTop = (col: number): number => {
  let row = 0;
  while (row < level.world.height && !level.world.solidTile(col, row)) row++;
  return row * TILE;
};

/**
 * A bot that walks right from `f`: on the ground it jumps when the column ahead is higher than his feet, and holds jump only until his
 * feet are over that column's top, so he lands on it; it lets go of jump for a step before pressing it again (L-048). Every frame, until
 * `done` holds (at most `max` steps).
 */
function walkRight(f: Frame, done: (f: Frame) => boolean, max = 600): Frame[] {
  const frames = [f];
  let jumpWas = false;
  let target = Infinity;
  for (let i = 0; i < max && !done(f); i++) {
    const p = f.r.player;
    const ahead = groundTop(Math.floor((p.x + HITBOX.width / 2 + 6) / TILE));
    if (p.grounded) target = ahead < p.y ? ahead : Infinity;
    const jump: boolean = p.grounded ? !jumpWas && target < p.y : jumpWas && p.vy < 0 && p.y > target - 4;
    f = advance(f, { move: 1, jumpHeld: jump });
    jumpWas = jump;
    frames.push(f);
  }
  return frames;
}

/** From the spawn up and down the staircase to its last step, standing on it short of the lip. */
const stairs = (): Frame[] => walkRight(at(LAB_3T_SPAWN.x, LAB_3T_SPAWN.y), (f) => f.r.player.grounded && f.r.player.y === LIP_Y);

/** From the last step, right off the lip and down to the landing ground. */
const drop = (from: Frame): Frame[] => walkRight(from, (f) => f.r.player.grounded && f.r.player.y > LIP_Y, 300);

/**
 * The glide over the chasm from the landing ground: a run from its left end, a jump at its lip held into the glide, let go of once he is
 * over the far side, then left held to land short of the first spring. Every frame until he stands on the far side.
 */
function glide(): Frame[] {
  let f = at(LAB_3T_DROP.col0 * TILE + TILE / 2, LANDING_Y);
  const frames = [f];
  const lip = (LAB_3T_DROP.col1 + 1) * TILE;
  let jumped = false;
  for (let i = 0; i < 400 && !(jumped && f.r.player.grounded); i++) {
    const p = f.r.player;
    if (!jumped && p.x + HITBOX.width / 2 >= lip - 2) jumped = true;
    const over = p.x - HITBOX.width / 2 > LAB_3T_CHASM.col1 * TILE + TILE;
    f = advance(f, { move: over ? -1 : 1, jumpHeld: jumped && !over });
    frames.push(f);
  }
  return frames;
}

/** A hop into the cart of rail `i` from standing at `x` on its ground, steering over its middle, nothing held once it rolls. Every frame until it stops at its buffer. */
function ride(i: number, x: number, y: number): Frame[] {
  const rail = LAB_3T_RAILS[i]!;
  let f = at(x, y);
  const frames = [f];
  let jumpWas = false;
  for (let n = 0; n < 900 && f.r.carts[i]!.phase !== 'stopped'; n++) {
    const p = f.r.player;
    const waiting = f.r.carts[i]!.phase === 'waiting';
    const gap = cartFloor(rail, f.r.carts[i]!).x + CART.width / 2 - p.x;
    const jump: boolean = waiting && (p.grounded ? !jumpWas && Math.abs(gap) < 40 : jumpWas && p.vy < 0);
    f = advance(f, { move: waiting && Math.abs(gap) > 2 ? Math.sign(gap) : 0, jumpHeld: jump });
    jumpWas = jump;
    frames.push(f);
  }
  return frames;
}

/**
 * The lift from the floating ledge: he stands at the ledge's end, his box over the lift's column, and the lift, which starts there, carries
 * him up; near the top he walks onto the highest ledge. Every frame until he stands there.
 */
function lift(): Frame[] {
  let f = at(LAB_3T_LIFT.x0 - 2, LAB_3T_LEDGE.row * TILE);
  const frames = [f];
  const top = LAB_3T_TOP.row * TILE;
  for (let i = 0; i < 1500 && !(f.r.player.grounded && Math.abs(f.r.player.y - top) < 1e-6 && f.r.player.x > (LAB_3T_TOP.col0 + 1) * TILE); i++) {
    const deck = platformAt(LAB_3T_LIFT, f.r.platformTick);
    // Right held once the lift is within a tile of the top: against the ledge's face until the lift is level with it.
    f = advance(f, { move: deck.y < top + TILE ? 1 : 0, jumpHeld: false });
    frames.push(f);
  }
  return frames;
}

describe('GDD-UI-04 lab-3t, the tall lab', () => {
  it('GDD-TEC-04 lab-3t passes the validator', () => {
    const entry = levelById(LAB_3T_ID)!;
    expect(entry).toMatchObject({ world: 3, test: true });
    expect(entry.level).toBe(level);
    expect(validateLevel(entry)).toEqual([]);
    // 60 x 40 tiles: the camera's y goes from 0 to 368. Three ofrendas, no exit, no enemy, no pit: every column is solid on the last row.
    expect([level.world.width, level.world.height]).toEqual([60, 40]);
    expect(LIMITS).toEqual({ top: 0, bottom: 368 });
    expect([level.ofrendas.length, level.exit, level.enemies.length]).toEqual([3, undefined, 0]);
    for (let col = 0; col < level.world.width; col++) expect(level.world.solidTile(col, level.world.height - 1), `column ${col}`).toBe(true);
    expect(level.abilities).toEqual({ glide: true });
  });

  it('GDD-UI-04 lab-3t: the staircase does not move the camera', () => {
    // The plateau's top at row 8, and steps of 1 and 2 tiles, down and up: up 1, down 2, up 2, up 1.
    expect(LAB_3T_PLATEAU.row).toBe(8);
    expect([LAB_3T_PLATEAU, ...LAB_3T_STAIRS].slice(1).map((s, i) => [LAB_3T_PLATEAU, ...LAB_3T_STAIRS][i]!.row - s.row)).toEqual([1, -2, 2, 1]);
    const frames = stairs();
    const last = frames[frames.length - 1]!;
    expect(last.r.player).toMatchObject({ grounded: true, y: LIP_Y });
    // He stood on every step on the way.
    const stood = new Set(frames.filter((f) => f.r.player.grounded).map((f) => f.r.player.y / TILE));
    for (const s of LAB_3T_STAIRS) expect(stood.has(s.row), `row ${s.row}`).toBe(true);
    frames.forEach((f, i) => expect(f.cam.y, `step ${i}`).toBe(0));
    // His feet stay between screen y 96 and 144 on it: inside the band or above it, where the level's top holds the camera.
    expect(Math.max(...frames.map(feetOnScreen))).toBeLessThanOrEqual(CAMERA.bandBottom);
  });

  it('GDD-UI-04 lab-3t: the walk-off drop: the landing ground is in view from the step he leaves the lip', () => {
    // 10 tiles from the lip down to the landing ground.
    expect(LAB_3T_DROP.row - LAB_3T_DROP.lipRow).toBe(10);
    const frames = drop(stairs().at(-1)!);
    const left = frames.findIndex((f) => !f.r.player.grounded);
    expect(left).toBeGreaterThan(0);
    const landed = frames.at(-1)!;
    expect(landed.r.player).toMatchObject({ grounded: true, y: LANDING_Y });
    expect(landed.r.player.y - frames[left - 1]!.r.player.y).toBe(10 * TILE);
    for (const f of frames.slice(left)) {
      expect(LANDING_Y - f.cam.y, `step ${frames.indexOf(f)}`).toBeLessThan(270);
      expect(LAB_3T_DROP.col0 * TILE - f.scrollX).toBeLessThan(480);
    }
    // The camera looked down on the way, and he lands with his feet in the band.
    expect(landed.cam.y).toBeGreaterThan(0);
    expect(feetOnScreen(landed)).toBeGreaterThanOrEqual(CAMERA.bandTop);
    expect(feetOnScreen(landed)).toBeLessThanOrEqual(CAMERA.bandBottom);
  });

  it('GDD-UI-04 lab-3t: the glide: the far side lip is in view before he has fallen 3 tiles', () => {
    // 12 tiles wide, the far side 6 tiles lower.
    expect([LAB_3T_CHASM.col1 - LAB_3T_CHASM.col0 + 1, LAB_3T_CHASM.farRow - LAB_3T_DROP.row]).toEqual([12, 6]);
    const frames = glide();
    const landed = frames.at(-1)!;
    expect(landed.r.player).toMatchObject({ grounded: true, y: FAR_Y });
    expect(landed.r.player.x).toBeGreaterThan((LAB_3T_CHASM.col1 + 1) * TILE);
    expect(landed.r.player.x).toBeLessThan(LAB_3T_SPRINGS[0]!.col * TILE);
    const lip = { x: (LAB_3T_CHASM.col1 + 1) * TILE, y: FAR_Y };
    const inView = (f: Frame) => lip.x - f.scrollX >= 0 && lip.x - f.scrollX < 480 && lip.y - f.cam.y >= 0 && lip.y - f.cam.y < 270;
    const first = frames.findIndex(inView);
    expect(first).toBeGreaterThanOrEqual(0);
    expect(frames[first]!.r.player.y - LANDING_Y).toBeLessThan(3 * TILE);
  });

  it('GDD-UI-04 lab-3t: the spring under open sky moves the camera by at most 17 px', () => {
    // From where the glide lands, right onto the first spring, to the top of the first launch (L-026).
    let f = glide().at(-1)!;
    const spring = LAB_3T_SPRINGS[0]!;
    // Open sky over it.
    for (let row = 0; row < spring.row; row++) expect(level.world.solidTile(spring.col, row), `row ${row}`).toBe(false);
    const y0 = f.cam.y;
    let launched = false;
    let least = y0;
    for (let i = 0; i < 300; i++) {
      f = advance(f, { move: launched ? 0 : 1, jumpHeld: false });
      if (f.r.player.vy < 0) launched = true;
      least = Math.min(least, f.cam.y);
      if (launched && f.r.player.vy >= 0) break;
    }
    expect(launched).toBe(true);
    // Measured: 15.2 px, from his feet at screen y 117.9 after the glide's landing (17.1 from the band's top edge, src/ui/camera.test.ts).
    expect(feetOnScreen(glide().at(-1)!)).toBeCloseTo(117.9, 1);
    expect(y0 - least).toBeCloseTo(15.19, 2);
    expect(y0 - least).toBeLessThanOrEqual(17);
  });

  it('GDD-UI-04 lab-3t: the lift is followed with his feet on the band edge', () => {
    // 14 tiles up, at 40 px/s.
    expect((LAB_3T_LIFT.y0 - LAB_3T_LIFT.y1) / TILE).toBe(14);
    expect(PLATFORM.speed).toBe(40);
    const frames = lift();
    const top = frames.at(-1)!;
    expect(top.r.player.grounded).toBe(true);
    expect(top.r.player.y).toBeCloseTo(LAB_3T_TOP.row * TILE, 6);
    // Once his feet reach the band's top edge they stay on it while the camera can go up, and over it once it is at the level's top.
    const reached = frames.findIndex((f) => feetOnScreen(f) <= CAMERA.bandTop + 1e-9);
    expect(reached).toBeGreaterThan(0);
    for (const f of frames.slice(reached)) {
      if (f.cam.y > 0) expect(feetOnScreen(f), `step ${frames.indexOf(f)}`).toBeCloseTo(CAMERA.bandTop, 6);
      else expect(feetOnScreen(f), `step ${frames.indexOf(f)}`).toBeLessThanOrEqual(CAMERA.bandTop);
    }
    frames.forEach((f) => expect(feetOnScreen(f)).toBeLessThanOrEqual(CAMERA.bandBottom));
  });

  it('GDD-UI-04 lab-3t: the climbing and the descending cart are followed with his feet on the band edge', () => {
    // R1 climbs 6 tiles, R2 descends 6 tiles (GDD-WLD-15: 84.9 px/s up, 127.3 px/s down, under the 180 px/s pan).
    expect(LAB_3T_RAILS.map((r) => r.segments.find((s) => s.kind !== 'level'))).toEqual([{ kind: 'climb', tiles: 6 }, { kind: 'descent', tiles: 6 }]);
    const cases = [
      { i: 0, x: (LAB_3T_RAILS[0]!.x - TILE) + TILE / 2, y: FAR_Y, edge: CAMERA.bandTop, rise: 6 * TILE },
      { i: 1, x: LAB_3T_CART_PLATEAU.col0 * TILE + TILE / 2, y: LAB_3T_CART_PLATEAU.row * TILE, edge: CAMERA.bandBottom, rise: -6 * TILE },
    ];
    const catchUp: number[] = [];
    for (const c of cases) {
      const frames = ride(c.i, c.x, c.y);
      const end = frames.at(-1)!;
      expect(end.r.carts[c.i]!.phase, `R${c.i + 1}`).toBe('stopped');
      const rolling = frames.findIndex((f) => f.r.carts[c.i]!.phase === 'rolling');
      expect(rolling, `R${c.i + 1}`).toBeGreaterThan(0);
      const ridden = frames.slice(rolling);
      ridden.forEach((f) => expect(f.r.player.grounded, `R${c.i + 1} step ${frames.indexOf(f)}`).toBe(true));
      expect(ridden[0]!.r.player.y - end.r.player.y, `R${c.i + 1}`).toBe(c.rise);
      // His feet on the band's edge from the step the camera has caught up with him, inside the band before.
      const caught = ridden.findIndex((f) => Math.abs(feetOnScreen(f) - c.edge) < 1e-9);
      expect(caught, `R${c.i + 1}`).toBeGreaterThanOrEqual(0);
      const outside = ridden.filter((f) => feetOnScreen(f) < CAMERA.bandTop - 1e-9 || feetOnScreen(f) > CAMERA.bandBottom + 1e-9).length;
      catchUp.push(outside);
      for (const f of ridden.slice(caught)) {
        const on = feetOnScreen(f);
        expect(on, `R${c.i + 1} step ${frames.indexOf(f)}`).toBeGreaterThanOrEqual(CAMERA.bandTop - 1e-9);
        expect(on, `R${c.i + 1} step ${frames.indexOf(f)}`).toBeLessThanOrEqual(CAMERA.bandBottom + 1e-9);
      }
    }
    // Measured: no step of either ride has his feet outside the band: the pan (3 px a step) outruns both carts (1.4 and 2.1 px a step).
    expect(catchUp).toEqual([0, 0]);
  });

  it('GDD-UI-04 lab-3t: at the lowest ground the camera is at its bottom limit and at the highest ledge at 0', () => {
    // Off the far side's lip, left into the chasm, down to the lowest ground on the level's last rows, and a second to settle.
    let f = at((LAB_3T_CHASM.col1 + 1) * TILE + TILE, FAR_Y);
    for (let i = 0; i < 300 && !(f.r.player.grounded && f.r.player.y > FAR_Y); i++) f = advance(f, { move: -1, jumpHeld: false });
    expect(f.r.player).toMatchObject({ grounded: true, y: LAB_3T_LOWEST.row * TILE });
    expect(level.world.height - LAB_3T_LOWEST.row).toBe(3);
    for (let i = 0; i < 60; i++) f = advance(f, { move: 0, jumpHeld: false });
    expect(f.cam.y).toBe(LIMITS.bottom);
    // His feet where a one-screen level's floor is: screen y 224.
    expect(feetOnScreen(f)).toBe(224);
    // The lift brings him to the highest ledge, where the camera is at the level's top.
    expect(lift().at(-1)!.cam.y).toBe(0);
  });

  it('GDD-UI-04 lab-3t: a respawn at each ofrenda cuts to his feet at 136 or the limit', () => {
    // He falls out of the level's bottom with the camera at its bottom limit, the ofrenda his checkpoint.
    LAB_3T_OFRENDAS.forEach((o, i) => {
      let f: Frame = { ...at(o.x, 700, { ...startRun(level), checkpoint: { x: o.x, y: o.y }, checkpointIndex: i }), cam: { y: LIMITS.bottom, lead: false } };
      f = { ...f, r: { ...f.r, player: { ...f.r.player, grounded: false } } };
      const ys: number[] = [];
      for (let n = 0; n < 200 && f.r.phase !== 'playing' || n === 0; n++) {
        f = advance(f, { move: 0, jumpHeld: false });
        ys.push(f.cam.y);
      }
      const cut = Math.min(LIMITS.bottom, Math.max(0, o.y - CAMERA.spawnFeet));
      expect(f.r.player, o.id).toMatchObject({ x: o.x, y: o.y });
      // Held while he is hidden, then the cut at once: no y in between.
      expect([...new Set(ys)], o.id).toEqual([LIMITS.bottom, cut]);
      expect(cut, o.id).toBe([120, 152, 0][i]);
    });
  });
});
