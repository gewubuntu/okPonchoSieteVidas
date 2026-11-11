import { describe, expect, it } from 'vitest';
import { CART, OFRENDA, TILE } from '../config/tuning';
import { cartFloor, fallingBox, floorUnder, railLength, warningPost } from '../sim/cart';
import { clawBox } from '../sim/claw';
import { enemyBox, kindOf, overlaps } from '../sim/enemy';
import { spawn, type PlayerInput } from '../sim/movement';
import { standsOnPlatform } from '../sim/platform';
import { startRun, stepRun, type RunState } from '../sim/run';
import { levelById } from './index';
import { LAB_3C_BEAM, LAB_3C_ENEMIES, LAB_3C_FLOOR_Y, LAB_3C_ID, LAB_3C_LEVEL, LAB_3C_NOTCHES, LAB_3C_OFRENDAS, LAB_3C_PIT, LAB_3C_PLATEAU, LAB_3C_RAILS, LAB_3C_SPAWN, LAB_3C_SUNKEN } from './lab3c';
import { validateLevel } from './validate';

// GDD-WLD-15, GDD-TEC-04: lab-3c, over the real level data (L-014). Positions are read from `src/levels/lab3c.ts`.
const level = LAB_3C_LEVEL;
const idle: PlayerInput = { move: 0, jumpHeld: false };
const PLATEAU_Y = LAB_3C_PLATEAU.row * TILE;
const R5 = LAB_3C_RAILS[4]!;
const R6 = LAB_3C_RAILS[5]!;
/** The hanging beam's near face over R5 (its left edge: R5 rolls right), and its far face. */
const BEAM_FACE = LAB_3C_BEAM.col * TILE;
const BEAM_BACK = BEAM_FACE + TILE;
/** The sunken floor's top past R6's end. */
const SUNKEN_Y = LAB_3C_SUNKEN.row * TILE;

const floorOf = (r: RunState, i: number) => cartFloor(LAB_3C_RAILS[i]!, r.carts[i]!);
const middleOf = (r: RunState, i: number) => floorOf(r, i).x + CART.width / 2;
/** Standing in cart `i`: on its floor under his feet (GDD-WLD-15: the floor follows the rail). */
const inCart = (r: RunState, i: number) => standsOnPlatform(r.player, floorUnder(LAB_3C_RAILS[i]!, r.carts[i]!, r.player.x));

/** What he holds once the cart rolls under him (L-075): right held throughout, nothing, or left. */
type After = 'right' | 'none' | 'left';

/**
 * A hop into cart `i` from standing at (x0, y0): he holds right until he lands in it, and holds jump for `hold` steps from step `wait`; from
 * the landing on he holds what `after` says (with 'right', jump too while its `hold` steps last). Whether he boarded it, and if he did,
 * whether he is standing in it on the step it stops at its buffer (at most 400 steps).
 */
function hop(i: number, x0: number, y0: number, hold: number, wait: number, after: After): { boarded: boolean; rode: boolean } {
  let r = at(x0, y0);
  for (let n = 0; n < 400; n++) {
    if (r.carts[i]!.phase === 'waiting' && n > 150) return { boarded: false, rode: false };
    const jump = n >= wait && n < wait + hold;
    const rolling = r.carts[i]!.phase !== 'waiting';
    const input: PlayerInput = !rolling || after === 'right' ? { move: 1, jumpHeld: jump } : { move: after === 'left' ? -1 : 0, jumpHeld: false };
    r = stepRun(r, input, level);
    if (r.carts[i]!.phase === 'stopped') return { boarded: true, rode: inCart(r, i) };
  }
  return { boarded: r.carts[i]!.phase !== 'waiting', rode: false };
}
/**
 * Hops from every 4 px of `x0s`, with jump held 2 to 30 steps and pressed after 0 to 10, each with `after` held from the landing: the takeoffs
 * that boarded, and those of them that did not ride to the buffer.
 */
function hops(i: number, x0s: readonly [number, number], y0: number, after: After): { boarded: number; lost: string[] } {
  let boarded = 0;
  const lost: string[] = [];
  for (let x0 = x0s[0]; x0 <= x0s[1]; x0 += 4) {
    for (const hold of [2, 4, 7, 10, 15, 22, 30]) {
      for (const wait of [0, 3, 6, 10]) {
        const h = hop(i, x0, y0, hold, wait, after);
        if (!h.boarded) continue;
        boarded++;
        if (!h.rode) lost.push(`x0 ${x0}, jump held ${hold} from step ${wait}`);
      }
    }
  }
  return { boarded, lost };
}
/** A run with Poncho standing at (x, y). */
const at = (x: number, y: number): RunState => ({ ...startRun(level), player: spawn(x, y) });

/**
 * A bot that rides cart `i`: on the ground it walks towards the cart's middle and, 20 to 60 px from it, jumps (held while rising) and
 * steers over the middle; once the cart rolls it stands still, and once it has stopped it walks off its front. It lets go of jump for at
 * least a step before pressing it again (L-048). The states of every step, until he stands on the ground past the cart's front, at most `max`.
 */
function ride(r: RunState, i: number, max = 600): RunState[] {
  const rail = LAB_3C_RAILS[i]!;
  const states: RunState[] = [];
  let jumpWas = false;
  for (let n = 0; n < max; n++) {
    const p = r.player;
    const cart = r.carts[i]!;
    let input = idle;
    if (cart.phase === 'waiting') {
      const gap = middleOf(r, i) - p.x;
      const move = Math.abs(gap) > 4 ? Math.sign(gap) : 0;
      const jump = p.grounded ? !jumpWas && Math.abs(gap) >= 20 && Math.abs(gap) <= 60 : jumpWas && p.vy < 0;
      input = { move, jumpHeld: jump };
    } else if (cart.phase === 'stopped') {
      const front = floorOf(r, i).x + (rail.dir > 0 ? CART.width : 0);
      if (p.grounded && !inCart(r, i) && (p.x - front) * rail.dir > 6) return states;
      input = { move: rail.dir, jumpHeld: false };
    }
    jumpWas = input.jumpHeld;
    r = stepRun(r, input, level);
    states.push(r);
  }
  return states;
}

/**
 * A bot that rides cart `i` on a broken rail: on the ground it walks to the cart and hops in as `ride` does, once; standing in the rolling
 * cart, it takes a full jump (held while rising) with `beam` when its x is 35 px before the hanging beam's near face (in the GDD's window),
 * and with `before` when the cart's middle is that many px before the rail's end; with `out` it holds right in the air after boarding (the
 * carried speed is held as with no input) and, once standing on the sunken floor, jumps out over its far wall. Otherwise it holds nothing.
 * It lets go of jump for at least a step before pressing it again (L-048).
 * The states of `steps` steps.
 */
function brokenRide(r: RunState, i: number, o: { beam?: boolean; before?: number; out?: boolean }, steps: number): RunState[] {
  const rail = LAB_3C_RAILS[i]!;
  const states: RunState[] = [];
  let jumpWas = false;
  let boarded = false;
  let hopped = false;
  for (let n = 0; n < steps; n++) {
    const p = r.player;
    let input = idle;
    if (r.carts[i]!.phase !== 'waiting') boarded = true;
    if (r.phase !== 'playing') input = idle;
    else if (!boarded) {
      const gap = middleOf(r, i) - p.x;
      input = { move: Math.abs(gap) > 4 ? Math.sign(gap) : 0, jumpHeld: p.grounded ? !jumpWas && Math.abs(gap) >= 20 && Math.abs(gap) <= 60 : jumpWas && p.vy < 0 };
    } else if (!p.grounded) input = { move: o.out ? 1 : 0, jumpHeld: jumpWas && p.vy < 0 };
    else if (inCart(r, i) && !jumpWas) {
      const atBeam = (o.beam ?? false) && !hopped && BEAM_FACE - p.x <= 35;
      const atEnd = o.before !== undefined && rail.x + railLength(rail) - middleOf(r, i) <= o.before;
      if (atBeam) hopped = true;
      input = { move: 0, jumpHeld: atBeam || atEnd };
    } else if (o.out && p.y === SUNKEN_Y && !jumpWas) input = { move: 1, jumpHeld: true };
    jumpWas = input.jumpHeld;
    r = stepRun(r, input, level);
    states.push(r);
  }
  return states;
}

describe('GDD-WLD-15 lab-3c', () => {
  it('GDD-TEC-04 lab-3c passes the validator', () => {
    const entry = levelById(LAB_3C_ID)!;
    expect(entry).toMatchObject({ world: 3, test: true });
    expect(validateLevel(entry)).toEqual([]);
  });

  it('GDD-WLD-15 lab-3c has six rails', () => {
    expect(LAB_3C_RAILS.map((r) => ({ dir: r.dir, end: r.end, segments: r.segments.map((s) => `${s.kind} ${s.tiles}`) }))).toEqual([
      { dir: 1, end: 'buffer', segments: ['level 20'] },
      { dir: 1, end: 'buffer', segments: ['level 4', 'climb 4', 'level 4'] },
      { dir: 1, end: 'buffer', segments: ['level 2', 'descent 4', 'level 3'] },
      { dir: -1, end: 'buffer', segments: ['level 8'] },
      { dir: 1, end: 'broken', segments: ['level 20'] },
      { dir: 1, end: 'broken', segments: ['level 12'] },
    ]);
    // R1, R2, R4, R5 and R6 start on the floor, R3 on the plateau's top; R2 ends on it (4 tiles up) and R3 on the floor (4 tiles down).
    expect(LAB_3C_RAILS.map((r) => r.y)).toEqual([LAB_3C_FLOOR_Y, LAB_3C_FLOOR_Y, PLATEAU_Y, LAB_3C_FLOOR_Y, LAB_3C_FLOOR_Y, LAB_3C_FLOOR_Y]);
    expect(LAB_3C_FLOOR_Y - PLATEAU_Y).toBe(64);
    expect(LAB_3C_RAILS[1]!.x + 8 * TILE).toBe(LAB_3C_PLATEAU.col0 * TILE); // R2's climb ends at the plateau's left edge
    expect(LAB_3C_RAILS[2]!.x + 2 * TILE).toBe((LAB_3C_PLATEAU.col1 + 1) * TILE); // R3's descent starts at its right edge
    // R5 ends at the lip of its pit, 3 tiles wide, and R6 at the lip of the sunken floor, 2 tiles down and 6 tiles long.
    expect(R5.x + railLength(R5)).toBe(LAB_3C_PIT.col0 * TILE);
    expect(LAB_3C_PIT.col1 - LAB_3C_PIT.col0 + 1).toBe(3);
    expect(R6.x + railLength(R6)).toBe(LAB_3C_SUNKEN.col0 * TILE);
    expect([LAB_3C_SUNKEN.col1 - LAB_3C_SUNKEN.col0 + 1, LAB_3C_SUNKEN.row * TILE - LAB_3C_FLOOR_Y]).toEqual([6, 32]);
    expect(startRun(level).carts).toEqual(LAB_3C_RAILS.map(() => ({ phase: 'waiting', m: 16 })));
  });

  it('GDD-WLD-15 lab-3c: the third ofrenda overlaps no buffer, rail end or cart', () => {
    const o = LAB_3C_OFRENDAS[2]!;
    // The ofrenda's box, OFRENDA.width wide, against each rail's ends (a buffer is drawn 8 px past its end) and each cart at its start.
    const spans = LAB_3C_RAILS.flatMap((r) => {
      const end = r.x + r.dir * railLength(r);
      return [[Math.min(r.x, r.x + r.dir * CART.width), Math.max(r.x, r.x + r.dir * CART.width)], [Math.min(end, end + r.dir * 8), Math.max(end, end + r.dir * 8)]];
    });
    expect(spans.filter(([a, b]) => o.x + OFRENDA.width / 2 > a! && o.x - OFRENDA.width / 2 < b!)).toEqual([]);
  });

  it('GDD-WLD-15 lab-3c R1: a bot hops in and rides 20 tiles to the buffer', () => {
    const states = ride(startRun(level), 0);
    const boarded = states.findIndex((s) => s.carts[0]!.phase === 'rolling');
    const stopped = states.findIndex((s) => s.carts[0]!.phase === 'stopped');
    expect(boarded).toBeGreaterThan(0);
    // 20 tiles less the cart's 2: 18 tiles (288 px) at 150 px/s, 2.5 px a step: 115.2 steps, so it stops on the 116th after the landing.
    expect(stopped - boarded).toBe(116);
    expect(states[stopped]!.carts[0]!.m).toBe(20 * TILE - 16);
    expect(states.slice(boarded, stopped + 1).every((s) => inCart(s, 0))).toBe(true);
    expect(states[states.length - 1]!.player).toMatchObject({ grounded: true, y: LAB_3C_FLOOR_Y });
  });

  it('GDD-WLD-15 lab-3c R1: the cart runs down the Alacrán, the Trompo and the cactus buddy, and he loses no life', () => {
    // Three enemies on the floor under R1, each at least 8 tiles from its start and 3 from the spawn and every ofrenda (GDD-ENM-01).
    expect(level.enemies.map(kindOf)).toEqual(['cactus', 'alacran', 'trompo']);
    const r1 = LAB_3C_RAILS[0]!;
    for (const e of level.enemies) {
      expect(e.y).toBe(LAB_3C_FLOOR_Y);
      expect(e.x - r1.x).toBeGreaterThanOrEqual(8 * TILE);
      expect(e.x).toBeLessThan(r1.x + railLength(r1));
      for (const o of [LAB_3C_SPAWN, ...LAB_3C_OFRENDAS]) expect(Math.hypot(e.x - o.x, e.y - o.y)).toBeGreaterThanOrEqual(3 * TILE);
    }
    // The bot hops in and rides to the buffer: each enemy is defeated on a step the cart rolls, and he stays in it with every life.
    const start = startRun(level);
    const states = ride(start, 0);
    const boarded = states.findIndex((s) => s.carts[0]!.phase === 'rolling');
    const stopped = states.findIndex((s) => s.carts[0]!.phase === 'stopped');
    expect(states.slice(0, boarded + 1).every((s) => s.enemies.every((e) => e.alive))).toBe(true);
    for (let i = 0; i < level.enemies.length; i++) {
      const k = states.findIndex((s) => !s.enemies[i]!.alive);
      expect(k, `enemy ${i}`).toBeGreaterThan(boarded);
      expect(k, `enemy ${i}`).toBeLessThan(stopped);
      expect(states[k]!.carts[0]!.phase, `enemy ${i}`).toBe('rolling');
    }
    expect(states.slice(boarded, stopped + 1).every((s) => inCart(s, 0))).toBe(true);
    expect(states.every((s) => s.phase === 'playing' && s.lives.lives === start.lives.lives && s.invulnerable === 0)).toBe(true);
  });

  it('GDD-WLD-15 lab-3c R1: the Alacrán and the Trompo are penned by the notches', () => {
    // Each notch's floor top is missing, one tile wide and one deep; the walkers stay between theirs for 20 s.
    for (const col of LAB_3C_NOTCHES) {
      expect([level.world.solidTile(col, LAB_3C_FLOOR_Y / TILE), level.world.solidTile(col, LAB_3C_FLOOR_Y / TILE + 1)]).toEqual([false, true]);
      expect(level.world.solidTile(col - 1, LAB_3C_FLOOR_Y / TILE) && level.world.solidTile(col + 1, LAB_3C_FLOOR_Y / TILE)).toBe(true);
    }
    let r = at(LAB_3C_SPAWN.x, LAB_3C_SPAWN.y);
    const xs: number[][] = [[], []];
    for (let n = 0; n < 1200; n++) {
      r = stepRun(r, idle, level);
      xs[0]!.push(r.enemies[1]!.x);
      xs[1]!.push(r.enemies[2]!.x);
    }
    // Each walks its pen end to end, turning within a step (at most 70 / 60 px) of the notch on either side; both are 14 px wide.
    const [a, b, c] = [LAB_3C_NOTCHES[0]!, LAB_3C_NOTCHES[1]!, LAB_3C_NOTCHES[2]!];
    for (const [i, from, to] of [[0, (a + 1) * TILE + 7, b * TILE - 7], [1, (b + 1) * TILE + 7, c * TILE - 7]] as const) {
      const [lo, hi] = [Math.min(...xs[i]!), Math.max(...xs[i]!)];
      expect(lo, `${i}`).toBeGreaterThanOrEqual(from - 1e-6);
      expect(lo, `${i}`).toBeLessThan(from + 70 / 60);
      expect(hi, `${i}`).toBeLessThanOrEqual(to + 1e-6);
      expect(hi, `${i}`).toBeGreaterThan(to - 70 / 60);
    }
    expect(r.enemies.every((e) => e.alive)).toBe(true);
  });

  it('GDD-WLD-15 lab-3c on foot the cactus buddy cannot be defeated', () => {
    // Standing 20 px before it (his hurtbox clear of it), a claw swipe: the swing's box overlaps it, and passes through; it is alive after.
    const cactus = LAB_3C_ENEMIES[0]!;
    let r = at(cactus.x - 20, LAB_3C_FLOOR_Y);
    let swung = false;
    for (let n = 0; n < 30; n++) {
      r = stepRun(r, { move: 0, jumpHeld: false, claw: n === 0 }, level);
      const box = clawBox(r.player, r.claw);
      if (box && overlaps(box, enemyBox(cactus, r.enemies[0]!))) swung = true;
    }
    expect(swung).toBe(true);
    expect(r.enemies[0]!.alive).toBe(true);
    expect(r).toMatchObject({ phase: 'playing', invulnerable: 0 });
  });

  it('GDD-WLD-15 lab-3c R2 carries him up the plateau no jump reaches', () => {
    // Without the cart: a running full jump at the plateau's 64 px wall from the floor before it lands back on the floor.
    let r = at(LAB_3C_RAILS[1]!.x + 4 * TILE, LAB_3C_FLOOR_Y);
    let top = Infinity;
    for (let n = 0; n < 120; n++) {
      r = stepRun(r, { move: 1, jumpHeld: n >= 20 && n < 60 }, level);
      if (r.player.grounded) top = Math.min(top, r.player.y);
    }
    expect(top).toBe(LAB_3C_FLOOR_Y);
    expect(r.player.x).toBeLessThan(LAB_3C_PLATEAU.col0 * TILE);
    // Riding R2 from the ofrenda before it, he ends standing on the plateau.
    const states = ride(at(LAB_3C_OFRENDAS[0]!.x, LAB_3C_OFRENDAS[0]!.y), 1);
    expect(states.some((s) => s.carts[1]!.phase === 'stopped')).toBe(true);
    expect(states[states.length - 1]!.player).toMatchObject({ grounded: true, y: PLATEAU_Y });
  });

  for (const after of ['right', 'none', 'left'] as const) {
    it(`GDD-WLD-15 lab-3c: every hop that boards R3 rides it to its buffer, ${after} held after the landing`, () => {
      // From the plateau before its cart (x 600 to 654): its floor follows the rail over the descent, wherever in it he landed.
      const { boarded, lost } = hops(2, [600, 654], PLATEAU_Y, after);
      expect(boarded).toBeGreaterThan(200);
      expect(lost).toEqual([]);
    }, 20_000);

    it(`GDD-WLD-15 lab-3c: every hop that boards R2 rides it to its buffer, ${after} held after the landing`, () => {
      // From the floor before its cart (x 376 to 434), up the climb onto the plateau.
      const { boarded, lost } = hops(1, [376, 434], LAB_3C_FLOOR_Y, after);
      expect(boarded).toBeGreaterThan(200);
      expect(lost).toEqual([]);
    }, 20_000);
  }

  it('GDD-WLD-15 lab-3c R3 takes him back down', () => {
    const states = ride(at(LAB_3C_OFRENDAS[1]!.x, LAB_3C_OFRENDAS[1]!.y), 2);
    const last = states[states.length - 1]!;
    // (Stopped with nobody in it, it counts towards its return: `toMatchObject`.)
    expect(last.carts[2]).toMatchObject({ phase: 'stopped', m: railLength(LAB_3C_RAILS[2]!) - 16 });
    expect(last.player).toMatchObject({ grounded: true, y: LAB_3C_FLOOR_Y });
  });

  it('GDD-WLD-15 lab-3c R4 rolls left to its buffer', () => {
    const r4 = LAB_3C_RAILS[3]!;
    const r = at(LAB_3C_OFRENDAS[2]!.x, LAB_3C_OFRENDAS[2]!.y);
    const start = middleOf(r, 3);
    const states = ride(r, 3);
    const stopped = states.find((s) => s.carts[3]!.phase === 'stopped')!;
    expect(stopped).toBeDefined();
    expect(middleOf(stopped, 3)).toBe(start - (railLength(r4) - CART.width));
    expect(floorOf(stopped, 3).x).toBe(r4.x - railLength(r4)); // its left edge at the rail's end
    expect(states[states.length - 1]!.player).toMatchObject({ grounded: true, y: LAB_3C_FLOOR_Y });
    expect(states[states.length - 1]!.player.x).toBeLessThan(floorOf(stopped, 3).x);
  });

  it('GDD-WLD-15 lab-3c a full jump from R1\'s cart lands back in it', () => {
    let r = ride(startRun(level), 0).find((s) => s.carts[0]!.phase === 'rolling')!;
    expect(r).toBeDefined();
    // Jump let go, and his speed in the cart down to 0 after the hop's landing.
    for (let n = 0; n < 30 && (n < 3 || r.player.vx !== 0); n++) r = stepRun(r, idle, level);
    expect(r.player.vx).toBe(0);
    const offset = r.player.x - middleOf(r, 0);
    r = stepRun(r, { move: 0, jumpHeld: true }, level);
    expect(r.player.grounded).toBe(false);
    for (let n = 0; n < 100 && !r.player.grounded; n++) r = stepRun(r, { move: 0, jumpHeld: true }, level);
    expect(inCart(r, 0)).toBe(true);
    expect(r.carts[0]!.phase).toBe('rolling');
    expect(r.player.x - middleOf(r, 0)).toBeCloseTo(offset, 6);
  });

  it('GDD-WLD-15 lab-3c R5: a jump from the cart crosses the pit and the cart is back 2 s after it fell', () => {
    // From the third ofrenda: he hops in, hops the hanging beam and lands back in the cart, and jumps with its middle 20 px before the end.
    const states = brokenRide(at(LAB_3C_OFRENDAS[2]!.x, LAB_3C_OFRENDAS[2]!.y), 4, { beam: true, before: 20 }, 450);
    expect(states.every((s) => s.phase === 'playing')).toBe(true);
    const over = states.findIndex((s) => !s.player.grounded && s.player.x > BEAM_FACE - 6 && s.player.x < BEAM_BACK + 6);
    expect(over).toBeGreaterThan(0);
    expect(states[over]!.player.y).toBeLessThanOrEqual(LAB_3C_BEAM.row * TILE); // over its top
    const left = states.findIndex((s) => s.carts[4]!.phase === 'falling');
    expect(states.slice(over, left).some((s) => inCart(s, 4) && s.player.x > BEAM_BACK + 6)).toBe(true); // back in the cart past it
    const last = states[states.length - 1]!;
    expect(last.player).toMatchObject({ grounded: true, y: LAB_3C_FLOOR_Y });
    expect(last.player.x).toBeGreaterThan((LAB_3C_PIT.col1 + 1) * TILE - 6); // on the far bank
    const landed = states.findIndex((s, i) => i > left && s.player.grounded);
    // Measured: he lands 68.5 px past the rail's end (its far bank starts 48 px past it, the pit being 3 tiles), riding at the cart's middle.
    expect(states[landed]!.player.x - (R5.x + railLength(R5))).toBeCloseTo(68.5, 6);
    expect(states[left + 119]!.carts[4]!.phase).toBe('gone');
    expect(states[left + 120]!.carts[4]).toEqual({ phase: 'waiting', m: 16 });
    // Measured (the GDD quotes it): the cart breaks 13 steps after it leaves the rail, on the far bank's face.
    expect(states.findIndex((s) => s.carts[4]!.phase === 'gone') - left).toBe(13);
  });

  it('GDD-WLD-15 lab-3c R5: the plain jump\'s window over the pit', () => {
    // Measured (the GDD quotes it): from his place at the cart's middle at takeoff, every 2.5 px a ride passes, the plain held jumps that land
    // on the far bank: from 44 px before the rail's end to 1.5 px (18 steps).
    const end = R5.x + railLength(R5);
    const lands: number[] = [];
    for (let m = 16; m < railLength(R5); m += 2.5) {
      let r: RunState = { ...startRun(level), player: spawn(R5.x + m, LAB_3C_FLOOR_Y - CART.floorPx), carts: LAB_3C_RAILS.map((_, i) => (i === 4 ? { phase: 'rolling', m } : { phase: 'waiting', m: 16 })) };
      for (let n = 0; n < 80 && !(n > 0 && r.player.grounded) && r.phase === 'playing'; n++) r = stepRun(r, { move: 0, jumpHeld: true }, level);
      if (r.phase === 'playing' && r.player.y === LAB_3C_FLOOR_Y && r.player.x > (LAB_3C_PIT.col1 + 1) * TILE - 6) lands.push(end - (R5.x + m));
    }
    expect({ first: Math.max(...lands), last: Math.min(...lands), steps: lands.length }).toEqual({ first: 44, last: 1.5, steps: 18 });
  });

  it('GDD-WLD-15 lab-3c R5: staying in costs a life in the pit, and the respawn finds the cart at its start', () => {
    const start = at(LAB_3C_OFRENDAS[2]!.x, LAB_3C_OFRENDAS[2]!.y);
    const states = brokenRide(start, 4, { beam: true }, 400);
    const fell = states.findIndex((s) => s.phase === 'respawning');
    expect(fell).toBeGreaterThan(0);
    expect(states[fell]!.lives.lives).toBe(start.lives.lives - 1);
    expect(states[fell]!.player.y - 32).toBeGreaterThan(level.world.height * TILE); // by the pit rule
    // Measured (the GDD quotes it): the life is lost 20 steps after the cart leaves the rail.
    expect(fell - states.findIndex((s) => s.carts[4]!.phase === 'falling')).toBe(20);
    const back = states.findIndex((s, i) => i > fell && s.phase === 'playing');
    expect(back).toBeGreaterThan(fell);
    expect(states[back]!.player).toMatchObject({ x: LAB_3C_OFRENDAS[2]!.x, y: LAB_3C_OFRENDAS[2]!.y });
    expect(states[back]!.carts[4]).toEqual({ phase: 'waiting', m: 16 });
  });

  it('GDD-WLD-15 lab-3c R5: the hanging beam is hopped from the cart', () => {
    // Its underside 2 tiles (32 px) over the rail's ground, open space over it, the post at least 6 tiles past it.
    expect(LAB_3C_FLOOR_Y - (LAB_3C_BEAM.row + 1) * TILE).toBe(32);
    expect(level.world.solidTile(LAB_3C_BEAM.col, LAB_3C_BEAM.row - 1)).toBe(false);
    expect(warningPost(R5)!.x - BEAM_BACK).toBeGreaterThanOrEqual(6 * TILE);
    // The bot hops it and lands back in the cart past it.
    const hopped = brokenRide(at(LAB_3C_OFRENDAS[2]!.x, LAB_3C_OFRENDAS[2]!.y), 4, { beam: true }, 200);
    expect(hopped.some((s) => inCart(s, 4) && s.player.x > BEAM_BACK + 6)).toBe(true);
    // The takeoffs that clear it: a full held jump from standing at the cart's middle, its middle at m, for every m a ride passes (2.5 px a
    // step from 16): those that land back in the cart past the beam. Measured: 8 steps, from 45 px before its near face to 27.5 px (the
    // GDD's scratch figure was 9 steps, 25 to 45 px). Earlier ones land on the beam's top or hit its face; later ones hit its face.
    const clears: number[] = [];
    for (let m = 16; R5.x + m < BEAM_FACE; m += 2.5) {
      let r: RunState = { ...startRun(level), player: spawn(R5.x + m, LAB_3C_FLOOR_Y - CART.floorPx), carts: LAB_3C_RAILS.map((_, i) => (i === 4 ? { phase: 'rolling', m } : { phase: 'waiting', m: 16 })) };
      for (let n = 0; n < 60 && !(n > 0 && r.player.grounded); n++) r = stepRun(r, { move: 0, jumpHeld: true }, level);
      if (inCart(r, 4) && r.player.x > BEAM_BACK + 6) clears.push(BEAM_FACE - (R5.x + m));
    }
    expect(clears.length).toBe(8);
    expect([Math.max(...clears), Math.min(...clears)]).toEqual([45, 27.5]);
    expect(clears.every((d, i) => i === 0 || clears[i - 1]! - d === 2.5)).toBe(true); // one window, no gaps
    // A rider who does not hop is stopped by it, at its face, while the cart rolls on.
    const stays = brokenRide(at(LAB_3C_OFRENDAS[2]!.x, LAB_3C_OFRENDAS[2]!.y), 4, { beam: false }, 200);
    expect(Math.max(...stays.map((s) => s.player.x))).toBeLessThanOrEqual(BEAM_FACE - 6 + 1e-6);
    expect(stays[stays.length - 1]!.player).toMatchObject({ grounded: true, y: LAB_3C_FLOOR_Y });
    expect(stays.some((s) => s.carts[4]!.phase === 'rolling' && middleOf(s, 4) > BEAM_BACK + 50)).toBe(true);
  });

  it('GDD-WLD-15 lab-3c R6: the cart breaks on the sunken floor and a Poncho who stays in lands there with no life lost and jumps back out', () => {
    // From the far bank of R5's pit, 3 tiles before R6's start: he hops in, stays in over the end, and once on the sunken floor jumps out
    // over its far wall.
    const start = at(R6.x - 3 * TILE, LAB_3C_FLOOR_Y);
    const states = brokenRide(start, 5, { out: true }, 400);
    expect(states.every((s) => s.phase === 'playing' && s.lives.lives === start.lives.lives)).toBe(true);
    const left = states.findIndex((s) => s.carts[5]!.phase === 'falling');
    const gone = states.findIndex((s) => s.carts[5]!.phase === 'gone');
    expect(left).toBeGreaterThan(0);
    // It breaks on the sunken floor: the step before, its box is over it and above its top; that step its bottom is past it.
    const before = fallingBox(R6, states[gone - 1]!.carts[5]!)!;
    expect(before.y + before.h).toBeLessThanOrEqual(SUNKEN_Y);
    expect(before.x).toBeGreaterThanOrEqual(LAB_3C_SUNKEN.col0 * TILE);
    expect(before.x + before.w).toBeLessThanOrEqual((LAB_3C_SUNKEN.col1 + 1) * TILE);
    // Measured (the GDD quotes it): 17 steps from the step it left the rail (6 rolling off level, then 11 falling).
    expect(gone - left).toBe(17);
    // He lands on the sunken floor, and jumps back out onto the floor past its far wall.
    const down = states.findIndex((s) => s.player.grounded && s.player.y === SUNKEN_Y);
    expect(down).toBeGreaterThan(left);
    // Measured (the GDD quotes it): he lands there 12 steps after the cart leaves the rail, 31.5 px past its end.
    expect(down - left).toBe(12);
    expect(states[down]!.player.x - (R6.x + railLength(R6))).toBeCloseTo(31.5, 6);
    const last = states[states.length - 1]!;
    expect(last.player).toMatchObject({ grounded: true, y: LAB_3C_FLOOR_Y });
    expect(last.player.x).toBeGreaterThan((LAB_3C_SUNKEN.col1 + 1) * TILE);
  });

  it('GDD-WLD-15 lab-3c: each broken end\'s post is 6 tiles before it', () => {
    expect(LAB_3C_RAILS.map((r) => warningPost(r))).toEqual([null, null, null, null, { x: R5.x + railLength(R5) - 96, y: LAB_3C_FLOOR_Y }, { x: R6.x + railLength(R6) - 96, y: LAB_3C_FLOOR_Y }]);
  });
});
