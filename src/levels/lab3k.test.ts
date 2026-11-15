import { describe, expect, it } from 'vitest';
import { CACOMIXTLE, CART, TILE } from '../config/tuning';
import { floorUnder } from '../sim/cart';
import type { Enemy } from '../sim/enemy';
import { spawn, type PlayerInput, type PlayerState } from '../sim/movement';
import { startRun, stepRun, type RunState } from '../sim/run';
import type { LevelEntry } from './index';
import { LAB_3K_ENEMIES, LAB_3K_FLOOR_ROW, LAB_3K_ID, LAB_3K_LEVEL, LAB_3K_PERCH, LAB_3K_RAILS, LAB_3K_SHELF } from './lab3k';
import { validateLevel } from './validate';

// GDD-ENM-04, GDD-TEC-04: lab-3k, the Cacomixtle's lab, over the real level data (L-014): each claim played in the simulation with a bot's
// inputs, never a hand-built state past where Poncho stands, and no life lost. The expected numbers are the GDD's: its sight is his hurtbox's
// centre ahead of it by up to 200 px (the ringtail's middle is at x = 528: the rail starts at x = 544 and the middle is 16 px along), the
// perch's top is 40 px over the floor (y = 208, so y = 168), and the cart passes 18 px under his feet there (its floor is 8 px over the floor and
// the ringtail is 14 tall: 208 - 8 - 14 = 186).
const level = LAB_3K_LEVEL;
const idle: PlayerInput = { move: 0, jumpHeld: false };
const entry = (l = level): LevelEntry => ({ id: LAB_3K_ID, world: 3, test: true, level: l, place: 'mina' });
const FLOOR_Y = LAB_3K_FLOOR_ROW * TILE;
/** The middle of Ka's ringtail at its cart's start, and the wake line 200 px ahead of it. */
const KA_MIDDLE = 528;
const WAKE = KA_MIDDLE - CACOMIXTLE.sightX;
const PERCH_TOP = FLOOR_Y - 40;
/** The cart's middle at Ka's buffer: its rail's end at x = 272 less half the cart. */
const KA_PARKED = 272 + CART.width / 2;

const standing = (x: number, y: number, vx = 0): PlayerState => ({ ...spawn(x, y), vx });
const run = (player: PlayerState): RunState => ({ ...startRun(level), player });
const ka = (r: RunState) => r.enemies[0]!;
const cartKa = (r: RunState) => r.carts[0]!;

describe('GDD-ENM-04 lab-3k', () => {
  it('GDD-ENM-04 lab-3k validates', () => {
    expect(validateLevel(entry())).toEqual([]);
    // Ka's ringtail is where its cart stands: x = 528 on the floor 8 px over the rail's ground, 3 tiles clear of every respawn.
    expect(LAB_3K_ENEMIES[0]).toMatchObject({ x: KA_MIDDLE, y: FLOOR_Y - 8, kind: 'cacomixtle', rail: 0 });
    expect(LAB_3K_RAILS[0]).toMatchObject({ x: 544, y: FLOOR_Y, dir: -1, end: 'buffer' });
    // The perch is 2 tiles wide, still, and 40 px over the floor; the wake line is in the middle of its first tile.
    expect(LAB_3K_PERCH).toEqual({ x0: 320, y0: PERCH_TOP, x1: 320, y1: PERCH_TOP, w: 2 * TILE });
    expect(WAKE).toBe(328);
    expect(LAB_3K_SHELF.row * TILE).toBe(FLOOR_Y - 2 * TILE);
  });

  it('GDD-ENM-04 lab-3k Ka wakes where the rule says: the first step that starts with his hurtbox centre 200 px or less ahead of the ringtail', () => {
    let r = run(standing(LAB_3K_LEVEL.spawn.x, FLOOR_Y));
    const xs = [r.player.x];
    let woke = -1;
    for (let i = 1; i <= 400 && woke < 0; i++) {
      r = stepRun(r, { move: 1, jumpHeld: false }, level);
      xs.push(r.player.x);
      if (ka(r).ride!.phase !== 'waiting') woke = i;
    }
    // He starts the telegraph on step `woke`, read from where he was when it began (xs[woke - 1]): at or past x = 328, and a step earlier not.
    expect(woke).toBeGreaterThan(2);
    expect(ka(r).ride).toEqual({ phase: 'telegraph', t: 1 });
    expect(xs[woke - 1]).toBeGreaterThanOrEqual(WAKE);
    expect(xs[woke - 2]).toBeLessThan(WAKE);
    // At full run, 2 px a step: he is within 2 px of the line, still standing on the floor, no life lost, the cart still.
    expect(xs[woke - 1]! - WAKE).toBeLessThan(2.5);
    expect(r.player.y).toBe(FLOOR_Y);
    expect(r.lives.lives).toBe(7);
    expect(cartKa(r)).toEqual({ phase: 'waiting', m: 16 });
    // Kb's ringtail, 400 px further on, sees nothing of him.
    expect(r.enemies[1]!.ride).toEqual({ phase: 'waiting', t: 0 });
  });

  it('GDD-ENM-04 lab-3k the perch is safe at every place on it: the cart passes under him and parks behind', () => {
    // L-014, L-075: standing still on the perch at every 0.2 tile (3.2 px) place across it, 11 places from its left edge to its right.
    let inSight = 0;
    for (let k = 0; k <= 10; k++) {
      const x = LAB_3K_PERCH.x0 + k * 3.2;
      let r = stepRun(run(standing(x, PERCH_TOP)), idle, level);
      expect(r.player).toMatchObject({ x, y: PERCH_TOP, grounded: true });
      // Before the wake: a place left of the line (x < 328) is not in sight yet; he steps in (to the right along the perch) until he is.
      if (ka(r).ride!.phase === 'waiting') {
        expect(x).toBeLessThan(WAKE);
        for (let i = 0; i < 60 && ka(r).ride!.phase === 'waiting'; i++) r = stepRun(r, { move: 1, jumpHeld: false }, level);
        expect(ka(r).ride!.phase).toBe('telegraph');
      } else {
        inSight++;
        expect(x).toBeGreaterThanOrEqual(WAKE);
      }
      for (let i = 0; i < 600 && cartKa(r).phase !== 'stopped'; i++) r = stepRun(r, idle, level);
      // The cart has passed under him and parked at its buffer 3 tiles behind the perch; he is on the perch, his lives are what they were.
      expect(cartKa(r)).toEqual({ phase: 'stopped', m: 256 });
      expect(ka(r)).toMatchObject({ alive: true, ride: { phase: 'parked', t: 0 } });
      expect(r.lives.lives).toBe(7);
      expect(r.player).toMatchObject({ y: PERCH_TOP, grounded: true });
      expect(r.player.x).toBeGreaterThan(LAB_3K_PERCH.x0 - 6);
      expect(r.player.x).toBeLessThan(LAB_3K_PERCH.x0 + LAB_3K_PERCH.w + 6);
      expect(KA_PARKED).toBe(288);
    }
    expect(inSight).toBe(8);
  });

  it('GDD-ENM-04 lab-3k hopping onto the perch saves him: every take-off that lands on it keeps his lives as Ka passes under', () => {
    // Take-offs 0.2 tile (3.2 px) apart over the 3 tiles before the perch (x 272 to 320), from a standstill and at a run (right held on the
    // take-off step, as a run holds it), jump held to the landing and let go of there (L-048), nothing else held in the air.
    const landedOn: string[] = [];
    for (const speed of ['stand', 'run'] as const) {
      for (let k = 0; k <= 15; k++) {
        const x = LAB_3K_PERCH.x0 - 48 + k * 3.2;
        let r = run(standing(x, FLOOR_Y, speed === 'run' ? 120 : 0));
        let left = false;
        let landed = false;
        let onPerch = false;
        for (let i = 0; i < 120 && !landed && r.phase === 'playing'; i++) {
          r = stepRun(r, { move: speed === 'run' && !left ? 1 : 0, jumpHeld: true }, level);
          if (!r.player.grounded) left = true;
          else if (left) {
            landed = true;
            onPerch = r.player.y === PERCH_TOP;
          }
        }
        if (!onPerch) continue;
        landedOn.push(speed);
        // Landed left of the wake line, he steps in along the perch until he is in sight.
        for (let i = 0; i < 60 && ka(r).ride!.phase === 'waiting'; i++) r = stepRun(r, { move: 1, jumpHeld: false }, level);
        expect(ka(r).ride!.phase, `${speed} take-off at x = ${x}`).not.toBe('waiting');
        for (let i = 0; i < 600 && cartKa(r).phase !== 'stopped'; i++) r = stepRun(r, idle, level);
        expect(cartKa(r), `${speed} take-off at x = ${x}`).toEqual({ phase: 'stopped', m: 256 });
        expect(r.lives.lives, `${speed} take-off at x = ${x}`).toBe(7);
        expect(r.player.y, `${speed} take-off at x = ${x}`).toBe(PERCH_TOP);
        expect(ka(r).alive).toBe(true);
      }
    }
    // Measured (L-003): 12 of the 32 take-offs land on it, 2 from a standstill (x 316.8 and 320) and 10 at a run.
    expect(landedOn.filter((speed) => speed === 'stand').length).toBe(2);
    expect(landedOn.filter((speed) => speed === 'run').length).toBe(10);
    expect(landedOn.length).toBe(12);
  });

  it('GDD-ENM-04 lab-3k standing in Kb\'s cart beside its ringtail, he is carried through both joins at the same place on its floor', () => {
    // L-075: no anchor holds him in a cart with a live ringtail in it (GDD-ENM-04), so the rule is tested over where he can stand (9 px of floor
    // each side of the ringtail: his body over it, his hurtbox clear of its box, 12 to 21 px from its middle), through the climb's two joins,
    // with nothing held. Ahead of it (to its left) he wakes it; behind it he cannot, so its telegraph is set to its last step but one.
    const kb = LAB_3K_RAILS[1]!;
    let rides = 0;
    for (const dx of [-21, -18, -14, -12, 12, 14, 18, 21]) {
      let r = run(standing(928 + dx, FLOOR_Y - 8));
      if (dx > 0) r = { ...r, enemies: r.enemies.map((e, i) => (i === 1 ? { ...e, ride: { phase: 'telegraph', t: 29 } } : e)) };
      let steps = 0;
      for (let i = 0; i < 400 && r.carts[1]!.phase !== 'stopped'; i++) {
        r = stepRun(r, idle, level);
        const mid = kb.x + kb.dir * r.carts[1]!.m;
        expect(r.player.x - mid, `dx ${dx} step ${i}`).toBeCloseTo(dx, 6);
        expect(r.player.grounded, `dx ${dx} step ${i}`).toBe(true);
        expect(r.player.y, `dx ${dx} step ${i}`).toBeCloseTo(floorUnder(kb, r.carts[1]!, r.player.x).y, 6);
        expect(r.lives.lives, `dx ${dx} step ${i}`).toBe(7);
        steps++;
      }
      // The ride is 17 tiles less the cart's front half from its start: 256 px at 150 and 120/sqrt 2 px/s: over 100 steps, and he is on it at its buffer.
      expect(steps).toBeGreaterThan(100);
      expect(r.carts[1]).toEqual({ phase: 'stopped', m: 256 });
      expect(r.enemies[1]!.ride).toEqual({ phase: 'parked', t: 0 });
      rides++;
    }
    expect(rides).toBe(8);
  });

  it('GDD-ENM-04 lab-3k Kb is the named exception: its ground rule fails on the shelf and its sentence is the exception', () => {
    // Kb's start floor is y = 200, the shelf's ground 24 px over it (y = 176) in columns 45 to 52 of its stretch (x 728 to 928): 8 failures.
    const kb = LAB_3K_ENEMIES[1]!;
    expect(kb.sightException).toBe('GDD-WLD-18: K1 meets him uphill, 40 px inside its sight');
    const bare: Enemy = { x: kb.x, y: kb.y, kind: 'cacomixtle', rail: 1 };
    const without = validateLevel(entry({ ...level, enemies: [LAB_3K_ENEMIES[0]!, bare] }));
    const cols = [45, 46, 47, 48, 49, 50, 51, 52];
    expect(without).toEqual(cols.map((c) => `cacomixtle at 928,200 has ground at column ${c}, row 11, 24 px from its cart's floor in its sight stretch, expected within 8 or over 120`));
    expect(validateLevel(entry())).toEqual([]);
  });

  it('GDD-ENM-04 lab-3k Ka is a named exception too: its perch is a platform in its sight, 32 px over its floor', () => {
    // Ka's floor is y = 200 and the perch's top y = 168: 32 px, in (8, 120], over columns 20 and 21 of its stretch (x 328 to 528): one problem.
    const kaDef = LAB_3K_ENEMIES[0]!;
    expect(kaDef.sightException).toBe('GDD-WLD-18: the perch, K1 s lesson, stands in its sight');
    const bare: Enemy = { x: kaDef.x, y: kaDef.y, kind: 'cacomixtle', rail: 0 };
    const without = validateLevel(entry({ ...level, enemies: [bare, LAB_3K_ENEMIES[1]!] }));
    expect(without).toEqual(["cacomixtle at 528,200 has a platform at 320,168, 32 px from its cart's floor in its sight stretch, expected within 8 or over 120"]);
    expect(validateLevel(entry())).toEqual([]);
  });
});
