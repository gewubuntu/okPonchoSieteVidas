import { describe, expect, it } from 'vitest';
import { ARMADILLO, CART, CLAW, ENEMY_ART, STEP, TILE } from '../config/tuning';
import { cartFloor, floorUnder, railLength } from '../sim/cart';
import { enemyBox, kindOf, type EnemyState } from '../sim/enemy';
import { hurtbox } from '../sim/hazards';
import { spawn, type PlayerInput } from '../sim/movement';
import { standsOnPlatform } from '../sim/platform';
import { startRun, stepRun, type RunState } from '../sim/run';
import { stepRang } from '../ui/enemyPose';
import { levelById } from './index';
import { LAB_3A_DIP, LAB_3A_ENEMIES, LAB_3A_FLOOR_ROW, LAB_3A_ID, LAB_3A_LEDGE, LAB_3A_LEVEL, LAB_3A_OFRENDAS, LAB_3A_PEN, LAB_3A_RAILS, LAB_3A_SLOPE, LAB_3A_SPAWN } from './lab3a';
import { validateLevel } from './validate';

// GDD-ENM-04, GDD-TEC-04: lab-3a, the Armadillo's lab, over the real level data (L-014): each piece's claim played in the simulation with a
// bot's inputs, never a hand-built state, and no life lost, so the playtests can rely on it. Positions are read from `src/levels/lab3a.ts`.
// The expected numbers are the GDD's: a tuck of 30 steps, a daze of 60, a roll at 130 px/s on the level, 160 down a slope and 100 up it
// measured along the ground, a walk at 20 px/s, sight 24 px up or down (GDD-ENM-04).
const level = LAB_3A_LEVEL;
const { world } = level;
const solid = (col: number, row: number) => world.solidTile(col, row);
const cols = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);
const FLOOR_Y = LAB_3A_FLOOR_ROW * TILE;
const RAIL = LAB_3A_RAILS[0]!;
const idle: PlayerInput = { move: 0, jumpHeld: false };
/** The four Armadillos by piece. */
const [PEN, SLOPE, LEDGE, RAILED] = [0, 1, 2, 3] as const;

/** A run with Poncho standing at (x, y): put down there, as the debug hook does. */
const at = (x: number, y: number): RunState => ({ ...startRun(level), player: spawn(x, y) });
const phaseOf = (e: EnemyState): string => (e.alive ? e.shell!.phase : 'gone');

/**
 * A bot that, from where the run puts him, walks to `goTo` (if given) while the Armadillo `i` walks or tucks, and once it rolls at him takes a
 * full jump (held while rising) when its box is 12 px or less from his hurtbox; once it lies dazed it walks to `after` (if given). It lets go of
 * jump for at least a step before pressing it again (L-048). The states of `steps` steps.
 */
function dodge(r: RunState, i: number, steps: number, o: { goTo?: number; after?: number } = {}): RunState[] {
  const states: RunState[] = [];
  let jumpWas = false;
  for (let n = 0; n < steps; n++) {
    const p = r.player;
    const e = r.enemies[i]!;
    const phase = phaseOf(e);
    const target = phase === 'dazed' ? o.after : phase === 'roll' ? undefined : o.goTo;
    let input: PlayerInput = { move: target !== undefined && Math.abs(target - p.x) > 2 ? Math.sign(target - p.x) : 0, jumpHeld: false };
    if (phase === 'roll' && (e.dir > 0) === (e.x < p.x)) {
      const h = hurtbox(p);
      const b = enemyBox(level.enemies[i]!, e);
      const gap = e.dir > 0 ? h.x - b.x1 : b.x0 - (h.x + h.w);
      if (p.grounded && !jumpWas && gap >= 0 && gap <= 12) input = { move: 0, jumpHeld: true };
    }
    if (!p.grounded && jumpWas && p.vy < 0) input = { move: 0, jumpHeld: true };
    jumpWas = input.jumpHeld;
    r = stepRun(r, input, level);
    states.push(r);
  }
  return states;
}

/** The runs of phases of Armadillo `i` over `states`: each phase with its first state's index and how many steps it lasted. */
function phases(states: readonly RunState[], i: number): { phase: string; from: number; steps: number }[] {
  const out: { phase: string; from: number; steps: number }[] = [];
  states.forEach((s, k) => {
    const phase = phaseOf(s.enemies[i]!);
    const last = out[out.length - 1];
    if (last && last.phase === phase) last.steps++;
    else out.push({ phase, from: k, steps: 1 });
  });
  return out;
}

const noLifeLost = (states: readonly RunState[]) => states.every((s) => s.phase === 'playing' && s.lives.lives === states[0]!.lives.lives);

const middleOf = (r: RunState) => cartFloor(RAIL, r.carts[0]!).x + CART.width / 2;
const inCart = (r: RunState) => standsOnPlatform(r.player, floorUnder(RAIL, r.carts[0]!, r.player.x));

describe('GDD-ENM-04 lab-3a, the Armadillo lab', () => {
  it('GDD-ENM-04 lab-3a is a World 3 test level in the mine, 60 x 17, with the glide, and passes the validator', () => {
    const entry = levelById(LAB_3A_ID)!;
    expect(LAB_3A_ID).toBe('lab-3a');
    expect(entry).toMatchObject({ world: 3, test: true, place: 'mina' });
    expect(entry.level).toBe(LAB_3A_LEVEL);
    expect([world.width, world.height]).toEqual([60, 17]);
    expect(validateLevel(entry)).toEqual([]);
    expect(level.abilities).toEqual({ glide: true });
    // Four Armadillos, one a piece, each standing on ground, and each 3 tiles or more from the spawn and every ofrenda (GDD-ENM-01).
    expect(LAB_3A_ENEMIES.map(kindOf)).toEqual(['armadillo', 'armadillo', 'armadillo', 'armadillo']);
    expect(LAB_3A_OFRENDAS).toHaveLength(3);
    for (const e of LAB_3A_ENEMIES) {
      expect(solid(Math.floor(e.x / TILE), e.y / TILE), `${e.x} on ground`).toBe(true);
      for (const o of [LAB_3A_SPAWN, ...LAB_3A_OFRENDAS]) expect(Math.hypot(e.x - o.x, e.y - o.y), `${e.x} from ${o.x}`).toBeGreaterThanOrEqual(3 * TILE);
    }
  });

  it('GDD-ENM-04 lab-3a pieces: a pen, a ramp, a ledge and a rail, each walled off from the next', () => {
    // The pen (3-2's, GDD-WLD-17): a block and a far wall 2 tiles tall, 2 wide, 11 tiles of floor between them, its roof 5 tiles over that floor.
    expect(LAB_3A_PEN.col1 - LAB_3A_PEN.col0 + 1).toBe(11);
    for (const col of [LAB_3A_PEN.block0, LAB_3A_PEN.block1, LAB_3A_PEN.wall0, LAB_3A_PEN.wall1]) {
      expect([solid(col, LAB_3A_FLOOR_ROW - 3), solid(col, LAB_3A_FLOOR_ROW - 2), solid(col, LAB_3A_FLOOR_ROW - 1)], `wall ${col}`).toEqual([false, true, true]);
    }
    for (const col of cols(LAB_3A_PEN.col0, LAB_3A_PEN.col1)) {
      expect(solid(col, LAB_3A_FLOOR_ROW), `pen floor ${col}`).toBe(true);
      for (let row = LAB_3A_PEN.roofRow; row < LAB_3A_FLOOR_ROW; row++) expect(solid(col, row), `pen ${col},${row}`).toBe(false);
      expect(solid(col, LAB_3A_PEN.roofRow - 1), `roof ${col}`).toBe(true);
    }
    expect(FLOOR_Y - LAB_3A_PEN.roofRow * TILE).toBe(5 * TILE);
    // The slope: 6 tiles of lower floor, a ramp of 4 slope tiles (r R, then r R a row up) 32 px up to the right, the upper floor, a wall.
    expect(LAB_3A_SLOPE.low1 - LAB_3A_SLOPE.low0 + 1).toBe(6);
    expect(cols(LAB_3A_SLOPE.ramp0, LAB_3A_SLOPE.ramp1).map((col) => world.slopeAt(col, 12) ?? world.slopeAt(col, 11))).toEqual(['r', 'R', 'r', 'R']);
    expect(FLOOR_Y - LAB_3A_SLOPE.highRow * TILE).toBe(32);
    expect(solid(LAB_3A_SLOPE.wall0, LAB_3A_SLOPE.highRow - 1) && solid(LAB_3A_SLOPE.wall0, LAB_3A_SLOPE.highRow - 2)).toBe(true);
    // The ledge, 3 tiles over its floor, and the wall past that floor.
    expect(FLOOR_Y - LAB_3A_LEDGE.row * TILE).toBe(3 * TILE);
    for (const col of cols(LAB_3A_LEDGE.col0, LAB_3A_LEDGE.col1)) expect([solid(col, LAB_3A_LEDGE.row - 1), solid(col, LAB_3A_LEDGE.row)], `ledge ${col}`).toEqual([false, true]);
    for (const col of cols(LAB_3A_LEDGE.floor0, LAB_3A_LEDGE.floor1)) expect([solid(col, LAB_3A_FLOOR_ROW - 1), solid(col, LAB_3A_FLOOR_ROW)], `floor ${col}`).toEqual([false, true]);
    expect(solid(LAB_3A_LEDGE.wall, LAB_3A_FLOOR_ROW - 1) && solid(LAB_3A_LEDGE.wall, LAB_3A_FLOOR_ROW - 3)).toBe(true);
    // The rail: level for 12 tiles on the floor, a buffer at its end, its cart at its start, the dip 2 tiles wide and 1 deep past the cart,
    // and the Armadillo 8 tiles (128 px) past the standing cart's front.
    expect(RAIL).toMatchObject({ y: FLOOR_Y, dir: 1, end: 'buffer', segments: [{ kind: 'level', tiles: 12 }] });
    expect(RAIL.x).toBe((LAB_3A_LEDGE.wall + 1) * TILE);
    expect(RAIL.x + railLength(RAIL)).toBeLessThanOrEqual(world.width * TILE);
    expect(LAB_3A_DIP.col0 * TILE).toBe(RAIL.x + CART.width);
    for (const col of cols(LAB_3A_DIP.col0, LAB_3A_DIP.col1)) expect([solid(col, LAB_3A_FLOOR_ROW), solid(col, LAB_3A_FLOOR_ROW + 1)], `dip ${col}`).toEqual([false, true]);
    expect(LAB_3A_ENEMIES[RAILED]!.x - (RAIL.x + CART.width)).toBe(8 * TILE);
    expect(LAB_3A_ENEMIES[RAILED]!.y).toBe(FLOOR_Y);
  });

  it('GDD-ENM-04 lab-3a pen: Poncho on the block, 32 px over it, does not startle it as it walks under him', () => {
    // On the block's right half, his feet on its top.
    const top = LAB_3A_PEN.topRow * TILE;
    let r = at((LAB_3A_PEN.block1 + 1) * TILE - 8, top);
    let nearest = Infinity;
    for (let n = 0; n < 1200; n++) {
      r = stepRun(r, idle, level);
      const e = r.enemies[PEN]!;
      nearest = Math.min(nearest, Math.abs(e.x - r.player.x));
      expect(phaseOf(e), `step ${n}`).toBe('walk');
    }
    // It walks the pen end to end, within 80 px across of him (it would be startled there from his height less 8 px).
    expect(nearest).toBeLessThanOrEqual(ARMADILLO.sightX);
    expect(r.player.y).toBe(top);
  });

  it('GDD-ENM-04 lab-3a pen: dropped in, it tucks 30 steps, rolls, lies dazed 60 steps at the wall and walks away', () => {
    // From the block he walks into the pen to x = 140; he jumps the ball, and once it lies dazed he walks on to x = 220, out of its sight.
    const top = LAB_3A_PEN.topRow * TILE;
    const states = dodge(at((LAB_3A_PEN.block1 + 1) * TILE - 8, top), PEN, 300, { goTo: 140, after: 220 });
    const ph = phases(states, PEN);
    expect(ph.slice(0, 5).map((p) => p.phase)).toEqual(['walk', 'tuck', 'roll', 'dazed', 'walk']);
    expect(ph[1]!.steps).toBe(ARMADILLO.tuckSteps);
    expect(ph[3]!.steps).toBe(ARMADILLO.dazedSteps);
    // It rolls at him, to the left, and is stopped flush against the block's face (x = 80): its middle 8 px off it.
    const rolling = states.slice(ph[2]!.from, ph[3]!.from);
    expect(rolling.every((s) => s.enemies[PEN]!.dir === -1)).toBe(true);
    const dazed = states.slice(ph[3]!.from, ph[4]!.from);
    expect(dazed.every((s) => s.enemies[PEN]!.x === (LAB_3A_PEN.block1 + 1) * TILE + ARMADILLO.width / 2)).toBe(true);
    // Then it walks away from the wall at 20 px/s.
    const away = states[ph[4]!.from]!.enemies[PEN]!;
    expect(away.dir).toBe(1);
    expect(away.x).toBeCloseTo((LAB_3A_PEN.block1 + 1) * TILE + ARMADILLO.width / 2 + ARMADILLO.walkSpeed * STEP, 9);
    expect(noLifeLost(states)).toBe(true);
  });

  it('GDD-ENM-04 lab-3a slope: it rolls down the ramp at 160 px/s, lies dazed at the far wall, and rolls back up it at 100 px/s', () => {
    // Poncho stands on the ramp's third tile, his feet 14 px under the upper floor's (within its 24), 68 px left of it: startled at once, it
    // faces him and rolls down the ramp at him; he jumps it. Dazed at the pen's far wall, it walks back and is startled from the lower floor.
    // x = 420 is 4 px into the ramp's third tile, an 'r' rising 8 px over its 16 from y = 192: its surface is at y = 190.
    const states = dodge(at(420, 190), SLOPE, 500);
    const ph = phases(states, SLOPE);
    expect(ph.slice(0, 7).map((p) => p.phase)).toEqual(['tuck', 'roll', 'dazed', 'walk', 'tuck', 'roll', 'dazed']);
    const rampX0 = LAB_3A_SLOPE.ramp0 * TILE;
    const rampX1 = (LAB_3A_SLOPE.ramp1 + 1) * TILE;
    /** Its speed along the ground, px/s, on each step that starts and ends on the ramp. */
    const speeds = (from: number, to: number) => {
      const out: number[] = [];
      for (let k = from + 1; k < to; k++) {
        const [a, b] = [states[k - 1]!.enemies[SLOPE]!, states[k]!.enemies[SLOPE]!];
        if (a.x > rampX0 && a.x < rampX1 && b.x > rampX0 && b.x < rampX1) out.push(Math.hypot(b.x - a.x, b.y! - a.y!) / STEP);
      }
      return out;
    };
    const down = speeds(ph[1]!.from, ph[2]!.from);
    expect(down.length).toBeGreaterThan(20);
    for (const v of down) expect(v).toBeCloseTo(ARMADILLO.rollDown, 6);
    expect(states[ph[2]!.from]!.enemies[SLOPE]!).toMatchObject({ x: (LAB_3A_PEN.wall1 + 1) * TILE + ARMADILLO.width / 2, y: FLOOR_Y, dir: -1 });
    const up = speeds(ph[5]!.from, ph[6]!.from);
    expect(up.length).toBeGreaterThan(20);
    for (const v of up) expect(v).toBeCloseTo(ARMADILLO.rollUp, 6);
    expect(states[ph[6]!.from]!.enemies[SLOPE]!).toMatchObject({ x: LAB_3A_SLOPE.wall0 * TILE - ARMADILLO.width / 2, y: LAB_3A_SLOPE.highRow * TILE, dir: 1 });
    // Down is faster than up: fewer steps over the same ramp.
    expect(down.length).toBeLessThan(up.length);
    expect(noLifeLost(states)).toBe(true);
  });

  it('GDD-ENM-04 lab-3a slope: a real claw swing rings off the rolling ball on each step it reaches it, and the white flash lasts one step more', () => {
    // As above, the ball rolls down the ramp at Poncho; he swings when it is 24 px off. The swing's box is out CLAW.activeSteps (3) steps and
    // reaches the ball on all three, so it rings on three steps running (`rang` lasts its step), and the flash (`stepRang`, ENEMY_ART.rangSteps
    // from each ring) shows from the first ring to the step after the last: 4 steps. Then the ball, which the claw cannot harm, reaches him.
    let r = at(420, 190);
    let left: number[] = [];
    let swung = false;
    const rang: number[] = [];
    const white: number[] = [];
    for (let n = 0; n < 200 && r.phase === 'playing'; n++) {
      const e = r.enemies[SLOPE]!;
      const gap = enemyBox(level.enemies[SLOPE]!, e).x0 - (hurtbox(r.player).x + hurtbox(r.player).w);
      const claw: boolean = !swung && e.shell!.phase === 'roll' && gap <= 24;
      swung ||= claw;
      r = stepRun(r, { move: 0, jumpHeld: false, claw }, level);
      left = stepRang(left, r);
      if (r.enemies[SLOPE]!.shell!.rang) rang.push(n);
      if ((left[SLOPE] ?? 0) > 0) white.push(n);
    }
    expect(rang).toHaveLength(CLAW.activeSteps);
    expect(rang[rang.length - 1]! - rang[0]!).toBe(CLAW.activeSteps - 1);
    expect(white).toEqual(Array.from({ length: CLAW.activeSteps + ENEMY_ART.rangSteps - 1 }, (_, k) => rang[0]! + k));
    expect(r.phase).toBe('respawning');
  });

  it('GDD-ENM-04 lab-3a ledge: it rolls off the ledge, falls, and rolls on to the wall', () => {
    // Poncho stands at the ledge's right end, 44 px right of it: startled at once, it rolls at him; he jumps it.
    const states = dodge(at((LAB_3A_LEDGE.col1 + 1) * TILE - 12, LAB_3A_LEDGE.row * TILE), LEDGE, 200);
    const ph = phases(states, LEDGE);
    expect(ph.slice(0, 3).map((p) => p.phase)).toEqual(['tuck', 'roll', 'dazed']);
    const roll = states.slice(ph[1]!.from, ph[2]!.from).map((s) => s.enemies[LEDGE]!);
    const ledgeY = LAB_3A_LEDGE.row * TILE;
    const air = roll.filter((e) => e.y! > ledgeY && e.y! < FLOOR_Y);
    expect(air.length).toBeGreaterThan(5);
    // It keeps 130 px/s across all the way, in the air too, and rolls on along the floor after it lands.
    for (let k = 1; k < roll.length; k++) expect((roll[k]!.x - roll[k - 1]!.x) / STEP).toBeCloseTo(ARMADILLO.rollSpeed, 6);
    expect(roll.filter((e) => e.y === FLOOR_Y).length).toBeGreaterThan(5);
    expect(states[ph[2]!.from]!.enemies[LEDGE]!).toMatchObject({ x: LAB_3A_LEDGE.wall * TILE - ARMADILLO.width / 2, y: FLOOR_Y, dir: 1 });
    expect(noLifeLost(states)).toBe(true);
  });
});

/**
 * Rail bots, all on the real rail. `board`: from the wall top left of the cart he walks right and drops into it. With `hopOut` he jumps out
 * holding left from the step the cart rolls, for 10 steps. With `from` he stands on the rail's floor at that x until the Armadillo tucks, then
 * walks to the cart and hops in (held while rising), as `src/levels/lab3c.test.ts`'s riders do. The states until the Armadillo is defeated
 * (at most 300 steps).
 */
function railRun(o: { hopOut?: boolean; from?: number }): RunState[] {
  let r = o.from === undefined ? at(LAB_3A_LEDGE.wall * TILE + 8, LAB_3A_LEDGE.wallRow * TILE) : at(o.from, FLOOR_Y);
  const states: RunState[] = [];
  let tucked = o.from === undefined;
  let jumpWas = false;
  let rolledAt = -1;
  for (let n = 0; n < 300 && r.enemies[RAILED]!.alive; n++) {
    const p = r.player;
    if (r.enemies[RAILED]!.shell!.phase === 'tuck') tucked = true;
    let input = idle;
    if (r.carts[0]!.phase === 'waiting' && tucked) {
      const gap = middleOf(r) - p.x;
      const hop = o.from !== undefined && (p.grounded ? !jumpWas && Math.abs(gap) >= 20 && Math.abs(gap) <= 60 : jumpWas && p.vy < 0);
      input = { move: Math.abs(gap) > 2 ? Math.sign(gap) : 0, jumpHeld: hop };
    } else if (r.carts[0]!.phase === 'rolling' && o.hopOut) {
      if (rolledAt < 0) rolledAt = n;
      input = { move: -1, jumpHeld: n - rolledAt < 10 };
    }
    jumpWas = input.jumpHeld;
    r = stepRun(r, input, level);
    states.push(r);
  }
  return states;
}

/** The Armadillo's state on the step before the one it was defeated on, and that step's state. */
function defeat(states: readonly RunState[]): { was: EnemyState; on: RunState } {
  const k = states.findIndex((s) => !s.enemies[RAILED]!.alive);
  expect(k).toBeGreaterThan(0);
  return { was: states[k - 1]!.enemies[RAILED]!, on: states[k]! };
}

describe('GDD-ENM-04 lab-3a rail: a rolling cart runs the Armadillo down', () => {
  it('GDD-ENM-04 lab-3a rail: riding the cart, he startles it at 80 px and the cart runs it down in its tuck', () => {
    const states = railRun({});
    const { was, on } = defeat(states);
    expect(was.shell!.phase).toBe('tuck');
    expect(on.carts[0]!.phase).toBe('rolling');
    expect(inCart(on)).toBe(true);
    expect(noLifeLost(states)).toBe(true);
  });

  it('GDD-ENM-04 lab-3a rail: hopping out as it starts, the empty cart runs it down walking', () => {
    const states = railRun({ hopOut: true });
    const { was, on } = defeat(states);
    expect(was.shell!.phase).toBe('walk');
    expect(on.carts[0]!.phase).toBe('rolling');
    expect(inCart(on)).toBe(false);
    expect(noLifeLost(states)).toBe(true);
  });

  it('GDD-ENM-04 lab-3a rail: startled on foot, it rolls at the cart he hops into and the cart runs it down rolling', () => {
    // He stands 60 px left of it on the rail's floor, past the dip: it tucks at once facing him, he goes back and hops in.
    const states = railRun({ from: LAB_3A_ENEMIES[RAILED]!.x - 60 });
    const { was, on } = defeat(states);
    expect(was.shell!.phase).toBe('roll');
    expect(was.dir).toBe(-1);
    expect(on.carts[0]!.phase).toBe('rolling');
    // Met before the dip, on the rail's floor.
    expect(was.y).toBe(FLOOR_Y);
    expect(was.x - ARMADILLO.width / 2).toBeGreaterThanOrEqual((LAB_3A_DIP.col1 + 1) * TILE);
    expect(noLifeLost(states)).toBe(true);
  });
});
