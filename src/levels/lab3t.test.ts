import { describe, expect, it } from 'vitest';
import { BASE_HEIGHT, CAMERA, CART, HITBOX, LIVES_MAX, PLATFORM, TILE } from '../config/tuning';
import { cartFloor } from '../sim/cart';
import { spawn, type PlayerInput } from '../sim/movement';
import { platformAt } from '../sim/platform';
import { startRun, stepRun, type RunState } from '../sim/run';
import { parseTiles } from '../sim/tilemap';
import { cameraLimits, cameraLimitsAt, cutCameraY, followCamera, ponchoShown as shown, stepCameraY, type CameraY } from '../ui/camera';
import { levelById } from './index';
import { LAB_3T_CART_PLATEAU, LAB_3T_CHASM, LAB_3T_DROP, LAB_3T_HIGH_BOTTOM, LAB_3T_HIGH_PIT, LAB_3T_ID, LAB_3T_LEDGE, LAB_3T_LEVEL, LAB_3T_LIFT, LAB_3T_LOW_PIT, LAB_3T_LOWEST, LAB_3T_OFRENDAS, LAB_3T_PLATEAU, LAB_3T_RAILS, LAB_3T_ROWS, LAB_3T_SPAWN, LAB_3T_SPRINGS, LAB_3T_STAIRS, LAB_3T_TOP } from './lab3t';
import { gaps } from './validate';
import { validateLevel } from './validate';

// GDD-UI-04, GDD-TEC-04: lab-3t, over the real level data (L-014), with the camera stepped beside the run as the scene steps it. Positions
// are read from `src/levels/lab3t.ts` (L-062).
const level = LAB_3T_LEVEL;
/** The level's own limits: 0 to 368. */
const LIMITS = cameraLimits(level.world.height * TILE);
/** GDD-WLD-03: the limits over the column level x `x` is in, as the scene's step reads them: 2 px above that column's floor line. */
const limitsAt = (x: number) => cameraLimitsAt(level, x);
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

/** One step of the run and of the camera beside it, as the scene steps it (`stepCameraY`). The sideways camera follows his body. */
function advance(f: Frame, input: PlayerInput): Frame {
  const r = stepRun(f.r, input, level);
  return { r, cam: stepCameraY(f.cam, f.r, r, level).camera, scrollX: followCamera(f.scrollX, shown(r) ? r.player.x : null, WIDTH_PX) };
}

/** Poncho standing at (x, y) in `run` (a fresh one by default), the camera placed there by the cut, as at a level start or a teleport. */
const at = (x: number, y: number, run: RunState = startRun(level)): Frame => {
  const r = { ...run, player: spawn(x, y) };
  return { r, cam: cutCameraY(r, level), scrollX: followCamera(0, x, WIDTH_PX) };
};

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
  it('GDD-TEC-04 lab-3t with ground hidden under its high pit fails the validator', () => {
    // The review's input: the high pit's columns solid from the row right under its raised bottom (27) down to the last. He would land on its
    // floor line, never be lost, and stand below the picture.
    const rows = LAB_3T_ROWS.map((r, row) => (row > LAB_3T_HIGH_BOTTOM.row ? r.slice(0, LAB_3T_HIGH_PIT.col0) + '#'.repeat(4) + r.slice(LAB_3T_HIGH_PIT.col1 + 1) : r));
    const hidden = { ...levelById(LAB_3T_ID)!, level: { ...level, world: parseTiles(rows) } };
    expect(validateLevel(hidden)).toEqual([66, 67, 68, 69].map((c) => `column ${c} under the raised bottom at row 26 is neither solid nor empty all the way down`));
  });

  it('GDD-TEC-04 lab-3t passes the validator', () => {
    const entry = levelById(LAB_3T_ID)!;
    expect(entry).toMatchObject({ world: 3, test: true });
    expect(entry.level).toBe(level);
    expect(validateLevel(entry)).toEqual([]);
    // 80 x 40 tiles: the camera's y goes from 0 to 368. Three ofrendas, no exit, no enemy. Two pits: the low one, 3 tiles at the level's bottom,
    // and the high one, 4 tiles, under its raised bottom; every other column is solid on its bottom row.
    expect([level.world.width, level.world.height]).toEqual([80, 40]);
    expect(LIMITS).toEqual({ top: 0, bottom: 368 });
    expect([level.ofrendas.length, level.exit, level.enemies.length]).toEqual([3, undefined, 0]);
    expect(level.bottoms).toEqual([LAB_3T_HIGH_BOTTOM]);
    expect(gaps(level.world, level.bottoms)).toEqual([
      { col: LAB_3T_LOW_PIT.col0, width: 3 },
      { col: LAB_3T_HIGH_PIT.col0, width: 4 },
    ]);
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

// GDD-WLD-03, GDD-LIFE-02, GDD-UI-04: the two pits. The high one past the descending cart's end, in the far side's ground (row 22, y 352), with
// a raised bottom 4 rows under its lips; the low one at the level's bottom, in the lowest ground against the landing ground's wall.
const HIGH_LIP_Y = LAB_3T_HIGH_PIT.row * TILE;
const HIGH_FLOOR = (LAB_3T_HIGH_BOTTOM.row + 1) * TILE;
const LOWEST_Y = LAB_3T_LOWEST.row * TILE;
/** On the far side 4 columns short of the high pit's raised bottom, and on the lowest ground 4 columns right of the low pit. */
const BEFORE_HIGH = { x: (LAB_3T_HIGH_BOTTOM.fromCol - 4) * TILE + TILE / 2, y: HIGH_LIP_Y };
const BEFORE_LOW = { x: (LAB_3T_LOW_PIT.col1 + 4) * TILE + TILE / 2, y: LOWEST_Y };

/** From `f`, walking the way `dir` says into the pit ahead, every frame until the life is lost and he is back in play (or `max` steps). */
function walkInto(f: Frame, dir: 1 | -1, max = 400): Frame[] {
  const frames = [f];
  for (let i = 0; i < max && !(f.r.phase === 'playing' && frames.some((g) => g.r.phase === 'respawning')); i++) {
    f = advance(f, f.r.phase === 'playing' ? { move: dir, jumpHeld: false } : { move: 0, jumpHeld: false });
    frames.push(f);
  }
  return frames;
}

/** The steps from the one he leaves the lip on to the one the life is lost on, and that frame. */
function pitFall(frames: readonly Frame[]): { n: number; lost: Frame; left: number; at: number } {
  const lostAt = frames.findIndex((f) => f.r.phase === 'respawning');
  const left = frames.findIndex((f) => !f.r.player.grounded);
  expect(left).toBeGreaterThan(0);
  expect(lostAt).toBeGreaterThan(left);
  expect(frames[lostAt]!.r.lives.lives).toBe(LIVES_MAX - 1);
  return { n: lostAt - left, lost: frames[lostAt]!, left, at: lostAt };
}

describe('GDD-WLD-03 lab-3t, its pits', () => {
  it('GDD-WLD-03 lab-3t: falling into the high pit costs the life N steps after he leaves the lip, at its raised bottom', () => {
    // 4 tiles wide, its lips both at row 22, its raised bottom 4 rows under them, over the pit and 6 columns of ground on each side; the
    // level's last row 13 rows under that, 17 under the lips.
    expect(LAB_3T_HIGH_PIT.col1 - LAB_3T_HIGH_PIT.col0 + 1).toBe(4);
    expect([groundTop(LAB_3T_HIGH_PIT.col0 - 1), groundTop(LAB_3T_HIGH_PIT.col1 + 1)]).toEqual([HIGH_LIP_Y, HIGH_LIP_Y]);
    expect(LAB_3T_HIGH_BOTTOM).toEqual({ fromCol: LAB_3T_HIGH_PIT.col0 - 6, toCol: LAB_3T_HIGH_PIT.col1 + 6, row: LAB_3T_HIGH_PIT.row + 4 });
    expect(level.world.height - 1 - LAB_3T_HIGH_PIT.row).toBe(17);
    const frames = walkInto(at(BEFORE_HIGH.x, BEFORE_HIGH.y), 1);
    const { n, lost } = pitFall(frames);
    // Measured: 24 steps after the step he leaves the lip, his box's top 0.875 px below the floor line (y 432).
    expect(n).toBe(24);
    expect(lost.r.player.y - HITBOX.height).toBeGreaterThan(HIGH_FLOOR);
    expect(lost.r.player.y - HITBOX.height - HIGH_FLOOR).toBeCloseTo(0.875, 6);
    expect(Math.floor(lost.r.player.x / TILE)).toBeGreaterThanOrEqual(LAB_3T_HIGH_PIT.col0);
    expect(Math.floor(lost.r.player.x / TILE)).toBeLessThanOrEqual(LAB_3T_HIGH_PIT.col1);
    // His feet 7.05 rows under the lip when lost (measured; GDD-WLD-03's raised bottom 4 rows under the lip puts its floor line 5 rows under
    // the lip's top, and his whole box, 2 rows tall, must be under it), far from the level's bottom (y 640).
    expect((lost.r.player.y - HIGH_LIP_Y) / TILE).toBeCloseTo(7.05, 2);
    expect(lost.r.player.y).toBeLessThan(level.world.height * TILE - 5 * TILE);
  });

  it('GDD-WLD-03 lab-3t: falling into the low pit costs the life N steps after he leaves the lip, at the level bottom', () => {
    // 3 tiles wide, no raised bottom: the level's last row is its bottom row.
    expect(LAB_3T_LOW_PIT.col1 - LAB_3T_LOW_PIT.col0 + 1).toBe(3);
    expect(level.bottoms!.some((b) => b.toCol >= LAB_3T_LOW_PIT.col0 && b.fromCol <= LAB_3T_LOW_PIT.col1)).toBe(false);
    const frames = walkInto(at(BEFORE_LOW.x, BEFORE_LOW.y), -1);
    const { n, lost } = pitFall(frames);
    // Measured: 19 steps, his box's top 2.875 px under the level's bottom (y 640).
    expect(n).toBe(19);
    expect(lost.r.player.y - HITBOX.height).toBeGreaterThan(level.world.height * TILE);
    expect(lost.r.player.y - HITBOX.height).toBeLessThan(level.world.height * TILE + 6);
    // The camera at its bottom limit, the level's, all the way.
    frames.slice(0, frames.findIndex((f) => f.r.phase === 'respawning') + 1).forEach((f, i) => expect(f.cam.y, `step ${i}`).toBe(LIMITS.bottom));
  });

  it('GDD-UI-04 lab-3t: the camera stops 2 px above the high pit floor line and does not follow him out', () => {
    // Its bottom limit over the raised bottom: 160, the picture's bottom edge at y 430.
    expect(limitsAt(LAB_3T_HIGH_PIT.col0 * TILE).bottom + BASE_HEIGHT).toBe(HIGH_FLOOR - CAMERA.bottomCutPx);
    expect(limitsAt(LAB_3T_HIGH_PIT.col0 * TILE).bottom).toBe(160);
    const frames = walkInto(at(BEFORE_HIGH.x, BEFORE_HIGH.y), 1);
    const { left, at: lostAt, lost } = pitFall(frames);
    // Up at the pan to that limit before he leaves the lip, and held there through the fall and the wait that follows, until the cut.
    expect(frames[left - 1]!.cam.y).toBe(160);
    const cut = frames.findIndex((f, i) => i > lostAt && shown(f.r));
    expect(cut).toBeGreaterThan(lostAt);
    for (const f of frames.slice(left - 1, cut)) expect(f.cam.y, `step ${frames.indexOf(f)}`).toBe(160);
    // On the step he is lost his whole box is below the picture: he fell out of it.
    expect(lost.r.player.y - HITBOX.height - lost.cam.y).toBeGreaterThan(BASE_HEIGHT);
  });

  it('GDD-UI-04 lab-3t: walking from the high pit span onto ground beyond it the camera limit changes without a jump of the picture', () => {
    // From the far side short of the raised bottom, right across it (a running jump over the pit) and on past its end to the level's right
    // edge: every frame.
    let f = at(BEFORE_HIGH.x, BEFORE_HIGH.y);
    const frames = [f];
    const lip = LAB_3T_HIGH_PIT.col0 * TILE;
    let jumped = false;
    for (let i = 0; i < 600 && f.r.player.x < (level.world.width - 1) * TILE; i++) {
      const p = f.r.player;
      if (!jumped && p.grounded && p.x + HITBOX.width / 2 >= lip - 2) jumped = true;
      f = advance(f, { move: 1, jumpHeld: jumped && p.x < (LAB_3T_HIGH_PIT.col1 + 1) * TILE });
      frames.push(f);
    }
    expect(frames.every((g) => g.r.phase === 'playing')).toBe(true);
    expect(f.r.player).toMatchObject({ grounded: true, y: HIGH_LIP_Y });
    const moves = frames.slice(1).map((g, i) => g.cam.y - frames[i]!.cam.y);
    // Never more than 8 px in a step, and 3 px while he stands.
    moves.forEach((m, i) => expect(Math.abs(m), `step ${i + 1}`).toBeLessThanOrEqual(8));
    moves.forEach((m, i) => frames[i + 1]!.r.player.grounded && expect(Math.abs(m), `step ${i + 1}`).toBeLessThanOrEqual(3));
    // Into the span the camera pans up to its limit, 3 px a step; out of it, down by the band rule to his feet on its bottom edge, 3 px a step.
    const into = frames.findIndex((g) => Math.floor(g.r.player.x / TILE) >= LAB_3T_HIGH_BOTTOM.fromCol);
    const out = frames.findIndex((g) => Math.floor(g.r.player.x / TILE) > LAB_3T_HIGH_BOTTOM.toCol);
    // (Where the cut put it at the start, his feet at 136.)
    expect(frames[into - 1]!.cam.y).toBe(HIGH_LIP_Y - CAMERA.spawnFeet);
    expect(moves[into - 1]).toBe(-3);
    expect(frames[out - 1]!.cam.y).toBe(160);
    expect(moves[out - 1]).toBe(3);
    expect(f.cam.y).toBe(HIGH_LIP_Y - CAMERA.bandBottom);
  });

  it('GDD-UI-04 lab-3t: the respawn after each pit is a cut to its ofrenda', () => {
    // The high pit comes after the third ofrenda on the way (the highest ledge, then down to the carts), the low one after the first (the
    // landing ground over the chasm). Held while he is hidden, then the cut at once: no y in between.
    const cases = [
      { from: BEFORE_HIGH, dir: 1 as const, i: 2, held: 160, cut: 0 },
      { from: BEFORE_LOW, dir: -1 as const, i: 0, held: LIMITS.bottom, cut: 120 },
    ];
    for (const c of cases) {
      const o = LAB_3T_OFRENDAS[c.i]!;
      const frames = walkInto(at(c.from.x, c.from.y, { ...startRun(level), checkpoint: { x: o.x, y: o.y }, checkpointIndex: c.i }), c.dir);
      const { at: lostAt } = pitFall(frames);
      const back = frames.at(-1)!;
      expect(back.r.phase, o.id).toBe('playing');
      expect(back.r.player, o.id).toMatchObject({ x: o.x, y: o.y });
      expect([...new Set(frames.slice(lostAt).map((g) => g.cam.y))], o.id).toEqual([c.held, c.cut]);
      expect(c.cut, o.id).toBe(Math.min(LIMITS.bottom, Math.max(0, o.y - CAMERA.spawnFeet)));
    }
  });
});

// GDD-UI-04: where the GDD's "landing leaves his feet inside the band, so the camera does not swing back" and "at least 114 px below his feet"
// do not hold, measured over the lab (review of the camera's first slice).
describe('GDD-UI-04 lab-3t, the camera after a landing and in a fall', () => {
  it('GDD-UI-04 lab-3t: a landing that lifts him into a cart turns the camera up by at most 12 px', () => {
    // Dropped from rest 1 to 14 tiles over the floor of R2's waiting cart, from 40 px left of its middle to 40 px right, every px: the cart's
    // anchor lifts him on the step he lands in it, and the camera, which looked down on the way, pans back up after him.
    const R2 = LAB_3T_RAILS[1]!;
    const floor = cartFloor(R2, { phase: 'waiting', m: CART.width / 2 });
    let most = 0;
    let boarded = 0;
    for (let dx = -40; dx <= 40; dx++) {
      for (let h = 1; h <= 14; h++) {
        let f = at(floor.x + floor.w / 2 + dx, floor.y - h * TILE);
        f = { ...f, r: { ...f.r, player: { ...f.r.player, grounded: false } } };
        let landed = -1;
        let before = 0;
        let least = Infinity;
        for (let i = 0; i < 200 && (landed < 0 || i - landed < 60); i++) {
          const y = f.cam.y;
          f = advance(f, { move: 0, jumpHeld: false });
          if (landed < 0 && f.r.player.grounded) [landed, before] = [i, y];
          if (landed >= 0) least = Math.min(least, f.cam.y);
        }
        if (landed < 0 || f.r.carts[1]!.phase === 'waiting') continue;
        boarded++;
        most = Math.max(most, before - least);
      }
    }
    expect(boarded).toBeGreaterThan(100);
    // Measured: 12 px at the most (from 19 px right of its middle, 7 tiles up).
    expect(most).toBe(12);
  }, 60_000);

  it('GDD-UI-04 lab-3t: a spring bounce back onto the ledge above swings the camera down 55.25 px and up 35.25 px', () => {
    // From the floating ledge's left end, left off it onto the second spring with jump pressed as he lands (the boosted launch, 600 px/s:
    // the plain one does not reach back up), then right once his feet are over the ledge's top, onto it.
    const spring = LAB_3T_SPRINGS[1]!;
    let f = at(LAB_3T_LEDGE.col0 * TILE + TILE / 2, LAB_3T_LEDGE.row * TILE);
    const ys = [f.cam.y];
    let off = false;
    let launched = false;
    for (let i = 0; i < 200; i++) {
      const p = f.r.player;
      off ||= !p.grounded;
      const press = off && !launched && p.vy > 0 && p.y > spring.row * TILE - 6;
      const move = launched ? (p.y < LAB_3T_LEDGE.row * TILE && p.x < (LAB_3T_LEDGE.col0 + 1) * TILE ? 1 : 0) : off && p.x < (spring.col + 1) * TILE - 2 ? 0 : -1;
      f = advance(f, { move, jumpHeld: press });
      ys.push(f.cam.y);
      if (f.r.player.vy < -500) launched = true;
    }
    expect(launched).toBe(true);
    expect(f.r.player).toMatchObject({ grounded: true, y: LAB_3T_LEDGE.row * TILE });
    // Down as he falls onto the spring, then up after him to the ledge, where his feet end on the band's top edge.
    const low = Math.max(...ys);
    expect(low - ys[0]!).toBe(55.25);
    expect(low - Math.min(...ys.slice(ys.indexOf(low)))).toBe(35.25);
    expect(feetOnScreen(f)).toBe(CAMERA.bandTop);
  });

  it('GDD-UI-04 lab-3t: the least view below his feet in a fall is 114.09 px, and 113.71 px with a glide started as his feet pass the band', () => {
    // A walk-off from the landing ground into the chasm with his feet at every quarter px of the band (116 to 156), and jump held from each
    // step 0 to 40 after it (a jump while he can, a glide once he falls): the least of 270 less his feet's screen y while he falls, but where
    // the camera stands at its bottom limit, until the look-down has caught up with his feet.
    const lip = (LAB_3T_DROP.col1 + 1) * TILE;
    let plain = Infinity;
    let glided = { least: Infinity, gliding: false };
    for (let on = CAMERA.bandTop; on <= CAMERA.bandBottom; on += 0.25) {
      for (let j = -1; j <= 40; j++) {
        let f: Frame = { ...at(lip - 7, LANDING_Y), cam: { y: LANDING_Y - on, lead: false } };
        let left = false;
        for (let i = 0; i < 150; i++) {
          f = advance(f, { move: 1, jumpHeld: j >= 0 && i >= j });
          left ||= !f.r.player.grounded;
          if (left && f.r.player.grounded) break;
          if (f.r.player.grounded || f.r.player.vy <= 0 || f.cam.y >= LIMITS.bottom) continue;
          const below = BASE_HEIGHT - feetOnScreen(f);
          if (j < 0) plain = Math.min(plain, below);
          if (below < glided.least) glided = { least: below, gliding: f.r.player.gliding === true };
          if (f.cam.lead && feetOnScreen(f) <= CAMERA.bandTop + 1e-9 && i > j + 2) break;
        }
      }
    }
    // Measured: a plain walk-off keeps the GDD's 114 px (114.09); a glide that starts on the step his feet pass 156 leaves 113.71, 0.29 px
    // under it (from his feet at 121 on the band, jump held from the 16th step).
    expect(plain).toBeCloseTo(114.09, 2);
    expect(glided.least).toBeCloseTo(113.71, 2);
    expect(glided.gliding).toBe(true);
  }, 60_000);
});
