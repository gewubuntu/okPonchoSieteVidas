import { describe, expect, it } from 'vitest';
import { catorceBox, catorceStart } from '../sim/catorce';
import { ponchoBox } from '../sim/boss';
import { overlaps } from '../sim/enemy';
import { spawn, type PlayerInput } from '../sim/movement';
import { stepRun, type RunState } from '../sim/run';
import { LEVEL_3_4 } from './level3-4';
import { base, ground, inCartRun, onSide, round6, SIDES, unhurt, type Side } from './level3-4.drive';

// GDD-BOS-04: the moves the fight asks of Poncho, measured over the real arena (L-003, L-014): `LEVEL_3_4` through `stepRun`, no copy with things
// taken out. Where a test says "unhurt" Poncho carries the Chile Fantasma so that the move is measured without her ending it; test 6 and the bot
// (`level3-4.bot.test.ts`) have no protection. Every figure is printed. Every left case is played again on the right (rail 1, the cart's middle 288,
// the perch's columns 26 to 29, `move` reversed) and gives the same counts at the mirrored x (L-014).
const DEF = LEVEL_3_4.catorce!;
const out = (s: string) => process.stdout.write(`${s}\n`);
/** Whole numbers of a list, as runs: [1, 2, 3, 7] is "1-3 7". */
function runs(a: readonly number[]): string {
  const parts: string[] = [];
  for (let i = 0; i < a.length; i++) {
    let j = i;
    while (j + 1 < a.length && a[j + 1] === a[j]! + 1) j++;
    parts.push(j === i ? `${a[i]}` : `${a[i]}-${a[j]}`);
    i = j;
  }
  return parts.length === 0 ? 'none' : parts.join(' ');
}

/** What a flight ended in: the state on the step he first stands again, the step it was (counted from 1), and every state. */
interface Flight {
  readonly end: RunState;
  readonly step: number;
  readonly states: readonly RunState[];
}
/** Plays `from` with `input` (given the state before the step and its number, from 1) until he stands again after leaving the ground, or `max` steps. */
function fly(from: RunState, input: (r: RunState, i: number) => PlayerInput, from_ = 1, max = 400): Flight {
  const states: RunState[] = [];
  let r = from;
  let air = false;
  for (let i = 1; i <= max; i++) {
    r = stepRun(r, input(r, i), LEVEL_3_4);
    states.push(r);
    if (i >= from_ && !r.player.grounded) air = true;
    if (air && r.player.grounded) return { end: r, step: i, states };
  }
  throw new Error(`no landing in ${max} steps`);
}

/** Whether `a` and `b` are the same list mirrored: the same grounds and steps, the x's summing to 480. */
const mirrored = (a: readonly { ground: string | undefined; x: number }[], b: readonly { ground: string | undefined; x: number }[]) =>
  a.map((r) => [r.ground, round6(480 - r.x)]).every((v, i) => v[0] === b[i]!.ground && v[1] === round6(b[i]!.x)) && a.length === b.length;

/** The `rel` values of a start that gave an outcome, as [first, last] spans of consecutive values (4 apart). */
function spans(rels: readonly number[]): number[][] {
  const acc: number[][] = [];
  for (const rel of rels) {
    const last = acc[acc.length - 1];
    if (last && last[1] === rel - 4) last[1] = rel;
    else acc.push([rel, rel]);
  }
  return acc;
}
/** How high his feet rose above the floor (y 224) in a flight. */
const peakOf = (f: Flight) => 224 - Math.min(...f.states.map((r) => r.player.y));
/** A run with Poncho standing on the floor at `x` facing right, her in phase 3 from her start, and `fantasma` steps of the Chile Fantasma. */
const phase3 = (x: number, fantasma: number): RunState => ({ ...base(), fantasma, player: { ...spawn(x, 224), facing: 1 }, catorce: catorceStart(DEF, 2) });

/** The hop of the timed launch starts at x 96 (384 on the right), 96 px short of the spring's near edge. */
const hopFrom = (side: Side) => onSide(side, 96);

describe('GDD-BOS-04 3-4 moves', () => {
  it('GDD-BOS-04 3-4 moves: the jump from home into a cart (unhurt)', () => {
    // From the spawn (240, 160): jump pressed on step 1, held while rising, moving toward the cart from step d + 1.
    const table = SIDES.map((side) =>
      Array.from({ length: 13 }, (_, d) => {
        const f = fly(unhurt(), (r, i) => ({ move: i >= d + 1 ? side.dir : 0, jumpHeld: i === 1 || (!r.player.grounded && r.player.vy < 0) }));
        const p = f.end.player;
        return { d, ground: ground(p), step: f.step, x: round6(p.x), y: p.y, rolling: f.end.carts[side.rail]!.phase === 'rolling' };
      }),
    );
    for (const [s, rows] of table.entries()) for (const r of rows) out(`GDD-BOS-04 jump from home, ${SIDES[s]!.name}, d ${r.d}: ${r.ground} step ${r.step} at (${r.x}, ${r.y}), cart rolling ${r.rolling}`);
    for (const [s, side] of SIDES.entries()) {
      const rows = table[s]!;
      // The delays that board the cart: 0 to 9.
      expect(rows.filter((r) => r.rolling).map((r) => r.d), `${side.name}: delays that board`).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
      // He lands in it on step 27 whatever the delay (the GDD's target was 26), anchored at the cart's middle: x 192 left, 288 right, y 120.
      for (const r of rows.slice(0, 10)) expect([r.ground, r.step, r.x, r.y], `${side.name} d ${r.d}`).toEqual(['cart', 27, onSide(side, 192), 120]);
      // Later he lands on the floor, on step 44, at 165, 168 and 171 from the left wall (315, 312 and 309 on the right).
      expect(rows.slice(10).map((r) => [r.ground, r.step, r.x, r.y]), `${side.name}: delays that miss`).toEqual([165, 168, 171].map((x) => ['floor', 44, onSide(side, x), 224]));
    }
  });

  it('GDD-BOS-04 3-4 moves: the plain jump out lands on the perch from the last 12 steps of the ride (unhurt)', () => {
    // In the left cart (state 0, m 16), jump pressed on step k, held while rising, moving with the roll throughout; the cart leaves its rail on step 32.
    const table = SIDES.map((side) =>
      Array.from({ length: 33 }, (_, n) => {
        const k = n + 1;
        const f = fly(inCartRun(unhurt(), side), (r, i) => ({ move: side.dir, jumpHeld: i === k || (i > k && !r.player.grounded && r.player.vy < 0) }), k);
        const falling = f.states.find((r) => r.carts[side.rail]!.phase === 'falling')!;
        return { k, ground: ground(f.end.player), x: round6(f.end.player.x), y: f.end.player.y, ridden: falling.carts[side.rail]!.ridden };
      }),
    );
    for (const [s, rows] of table.entries()) for (const r of rows) out(`GDD-BOS-04 plain jump out, ${SIDES[s]!.name}, k ${r.k}: ${r.ground} at (${r.x}, ${r.y}) ridden ${r.ridden}`);
    for (const [s, side] of SIDES.entries()) {
      const rows = table[s]!;
      const at = (k: number) => rows[k - 1]!;
      // The takeoffs that land on the perch (y 96): k 20 to 33; k 1 to 19 land on the floor.
      expect(runs(rows.filter((r) => r.ground === 'perch').map((r) => r.k)), `${side.name}: perch`).toBe('20-33');
      expect(runs(rows.filter((r) => r.ground === 'floor').map((r) => r.k)), `${side.name}: floor`).toBe('1-19');
      // The cart leaves the rail on step 32: a jump on k 32 and 33 leaves it falling with him in it (ridden off, it does not count), k 1 to 31 leave it empty.
      expect(rows.filter((r) => r.ridden).map((r) => r.k), `${side.name}: ridden off`).toEqual([32, 33]);
      expect(rows.every((r) => r.ridden !== undefined), `${side.name}: every cart fell`).toBe(true);
      // Where, from the wall's side: the first landings (x 64 at k 1, 39 at k 11, 56 for k 12 to 19) and the perch's ends (69 at k 20, 37 at k 33).
      expect([at(1).x, at(11).x, at(12).x, at(19).x, at(20).x, at(33).x].map((x) => Math.round(onSide(side, x))), `${side.name}: where`).toEqual([64, 39, 56, 56, 69, 37]);
      // The perch's tiles: the left four columns cover x 0 to 64, and his box is 12 wide: a middle up to 70.
      for (const r of rows.filter((row) => row.ground === 'perch')) expect(onSide(side, r.x), `${side.name} k ${r.k}`).toBeLessThanOrEqual(64 + 6);
    }
    expect(mirrored(table[0]!, table[1]!), 'mirrored').toBe(true);
  });

  it('GDD-BOS-04 3-4 moves: held into a glide, every takeoff of the ride from the second step lands on the perch (unhurt)', () => {
    // As the plain jump out, with jump held from the press to the landing (the glide once he falls).
    const table = SIDES.map((side) =>
      Array.from({ length: 33 }, (_, n) => {
        const k = n + 1;
        const f = fly(inCartRun(unhurt(), side), (_r, i) => ({ move: side.dir, jumpHeld: i >= k }), k);
        return { k, ground: ground(f.end.player), x: round6(f.end.player.x), y: f.end.player.y, step: f.step };
      }),
    );
    for (const [s, rows] of table.entries()) for (const r of rows) out(`GDD-BOS-04 held jump out, ${SIDES[s]!.name}, k ${r.k}: ${r.ground} at (${r.x}, ${r.y}) step ${r.step}`);
    for (const [s, side] of SIDES.entries()) {
      const rows = table[s]!;
      // k 2 to 33 land on the perch; k 1 (jumping from the cart's first step) glides past the perch and lands on the floor against the wall (x 6).
      expect(runs(rows.filter((r) => r.ground === 'perch').map((r) => r.k)), `${side.name}: perch`).toBe('2-33');
      expect([rows[0]!.ground, onSide(side, rows[0]!.x), rows[0]!.y], `${side.name}: k 1`).toEqual(['floor', 6, 224]);
      // From k 28 on he stops against the wall (x 6); before that he lands short of it (k 2 at 69, k 27 at 6.89).
      expect(runs(rows.filter((r) => onSide(side, r.x) === 6 && r.ground === 'perch').map((r) => r.k)), `${side.name}: against the wall`).toBe('28-33');
      expect([Math.round(onSide(side, rows[1]!.x)), round6(onSide(side, rows[26]!.x))], `${side.name}: k 2 and k 27`).toEqual([69, 6.888889]);
    }
    expect(mirrored(table[0]!, table[1]!), 'mirrored').toBe(true);
  });

  it('GDD-BOS-04 3-4 moves: from the perch a glide released past x 200 lands on home (unhurt)', () => {
    // Standing on each perch tile's middle (x 8, 24, 40, 56; y 96), jump held, moving toward home until his middle passes 240, jump let go on the first
    // step his middle is at or past `rel`, for rel 100 to 260 in steps of 4.
    const REL = Array.from({ length: 41 }, (_, i) => 100 + 4 * i);
    const STARTS = [8, 24, 40, 56];
    const table = SIDES.map((side) =>
      STARTS.map((sx) =>
        REL.map((rel) => {
          let released = false;
          const from = { ...unhurt(), player: { ...spawn(onSide(side, sx), 96), grounded: true } };
          const f = fly(from, (r) => {
            const pos = onSide(side, r.player.x);
            if (pos >= rel) released = true;
            return { move: pos <= 240 ? side.toHome : 0, jumpHeld: !released };
          });
          const next = stepRun(f.end, { move: 0, jumpHeld: false }, LEVEL_3_4);
          const cart = (i: number) => f.end.carts[i]!.phase === 'rolling' && next.carts[i]!.phase === 'rolling';
          return { rel, ground: ground(f.end.player), x: round6(onSide(side, f.end.player.x)), y: f.end.player.y, cartLeft: cart(0), cartRight: cart(1) };
        }),
      ),
    );
    /** home, floor or the cart landed in; a landing in a cart boards it (the cart rolling on that state and the next, the GDD's "a glide that comes down in a standing cart boards it"). */
    const outcome = (r: (typeof table)[0][0][0]): 'home' | 'floor' | 'left cart' | 'right cart' => {
      if (r.ground === 'cart') {
        expect(r.cartLeft || r.cartRight, `rel ${r.rel}: a landing in a cart boards it`).toBe(true);
        return r.cartLeft ? 'left cart' : 'right cart';
      }
      expect(r.cartLeft || r.cartRight, `rel ${r.rel}: a cart rolls only if he landed in it`).toBe(false);
      if (r.ground !== 'home' && r.ground !== 'floor') throw new Error(`rel ${r.rel}: landed on ${r.ground}`);
      return r.ground;
    };
    // Per start, the rel values that land on home (y 160), on the floor, and in each cart (rel 100 to 260), the left side's; the right is the same mirrored.
    const EXPECTED: Record<number, { home: number[][]; floor: number[][]; left: number[][]; right: number[][] }> = {
      8: { home: [[100, 124], [192, 228]], floor: [[128, 132], [232, 260]], left: [[136, 188]], right: [] },
      24: { home: [[100, 120], [192, 220]], floor: [[124, 132], [224, 260]], left: [[136, 188]], right: [] },
      40: { home: [[100, 116], [184, 220]], floor: [[120, 128], [224, 252]], left: [[132, 180]], right: [[256, 260]] },
      56: { home: [[100, 112], [180, 216]], floor: [[116, 120], [220, 248]], left: [[124, 176]], right: [[252, 260]] },
    };
    for (const [s, side] of SIDES.entries()) {
      for (const [t, rows] of table[s]!.entries()) {
        const sx = STARTS[t]!;
        const of = (o: string) => spans(rows.filter((r) => outcome(r) === o).map((r) => r.rel));
        const homeX = rows.filter((r) => r.ground === 'home').map((r) => r.x);
        out(`GDD-BOS-04 glide home, ${side.name}, from ${sx}: home ${JSON.stringify(of('home'))} (x ${Math.min(...homeX)} to ${Math.max(...homeX)}), floor ${JSON.stringify(of('floor'))}, left cart ${JSON.stringify(of('left cart'))}, right cart ${JSON.stringify(of('right cart'))}`);
        // The cart on his own side is the left cart of the left side's table, the right cart of the right side's.
        const own = side.rail === 0 ? 'left cart' : 'right cart';
        const other = side.rail === 0 ? 'right cart' : 'left cart';
        const want = EXPECTED[sx]!;
        expect(of('home'), `${side.name} from ${sx}: home`).toEqual(want.home);
        expect(of('floor'), `${side.name} from ${sx}: floor`).toEqual(want.floor);
        expect(of(own), `${side.name} from ${sx}: the cart on his side`).toEqual(want.left);
        expect(of(other), `${side.name} from ${sx}: the cart across`).toEqual(want.right);
        // Home's two tiles are x 224 to 256 and his box is 12 wide: every landing on it has his middle in 218 to 262.
        expect(Math.min(...homeX) >= 218 && Math.max(...homeX) <= 262, `${side.name} from ${sx}: home's x`).toBe(true);
        // The plan's two figures: rel 200 lands on home from every tile; rel 220 from all but x 56 (it lands on the floor there).
        expect(rows.find((r) => r.rel === 200)!.ground, `${side.name} from ${sx}: rel 200`).toBe('home');
        expect(rows.find((r) => r.rel === 220)!.ground, `${side.name} from ${sx}: rel 220`).toBe(sx === 56 ? 'floor' : 'home');
      }
    }
  });

  it('GDD-BOS-04 3-4 moves: the springs (unhurt)', () => {
    // The plain launch: standing on the floor at x 160 (left; 320 right), walking toward the spring (column 12, x 192 to 208; column 17, x 272 to 288) and
    // holding the move to the landing, steered toward the middle.
    const plain = SIDES.map((side) => {
      const f = fly({ ...unhurt(), player: { ...spawn(onSide(side, 160), 224), facing: side.toHome } }, () => ({ move: side.toHome, jumpHeld: false }));
      return { ground: ground(f.end.player), x: round6(f.end.player.x), y: f.end.player.y, peak: round6(peakOf(f)) };
    });
    for (const [s, r] of plain.entries()) out(`GDD-BOS-04 spring, plain, ${SIDES[s]!.name}: ${r.ground} at (${r.x}, ${r.y}), peak ${r.peak}`);
    // The timed launch (GDD-WLD-05): a plain press on the floor takes the jump before he is on the spring, so the timed press is a hop onto the spring with
    // jump pressed again on the step he lands on it (the step a lookahead says he would be thrown), then held while rising, moving toward the cart. The hop is
    // pressed on step `j` (1 to 30: from step 31 on he is already past the spring) from a start at x 96 (mirrored 384), moving toward the spring and let go at once.
    const timed = SIDES.map((side) =>
      Array.from({ length: 30 }, (_, n) => {
        const j = n + 1;
        let thrown = false;
        const f = fly({ ...unhurt(), player: { ...spawn(hopFrom(side), 224), facing: side.toHome } }, (r, i) => {
          if (thrown) return { move: side.dir, jumpHeld: !r.player.grounded && r.player.vy < 0 };
          if (i === j) return { move: side.toHome, jumpHeld: true };
          if (i > j && !r.player.grounded && stepRun(r, { move: side.toHome, jumpHeld: false }, LEVEL_3_4).player.bounced) {
            thrown = true;
            return { move: side.toHome, jumpHeld: true };
          }
          return { move: side.toHome, jumpHeld: false };
        });
        return { j, thrown, ground: ground(f.end.player), x: round6(f.end.player.x), y: f.end.player.y, peak: round6(peakOf(f)), boards: f.end.carts[side.rail]!.phase === 'rolling' };
      }),
    );
    for (const [s, rows] of timed.entries()) for (const r of rows) out(`GDD-BOS-04 spring, timed, ${SIDES[s]!.name}, hop on step ${r.j}: thrown ${r.thrown}, ${r.ground} at (${r.x}, ${r.y}), peak ${r.peak}, cart rolling ${r.boards}`);
    for (const [s, side] of SIDES.entries()) {
      // The plain launch, steered toward the middle, lands him on home (y 160), 64 px up: its peak is 77.1 px, about 13 px to spare (the GDD's "about 77 px").
      expect([plain[s]!.ground, plain[s]!.y, plain[s]!.peak, round6(onSide(side, plain[s]!.x))], `${side.name}: plain launch`).toEqual(['home', 160, 77.083333, 242.083333]);
      const rows = timed[s]!;
      // A hop on steps 1 to 20 comes down on the floor short of the spring; from step 21 the press lands the throw (peak 120.2 px, the GDD's "about 120 px").
      expect(runs(rows.filter((r) => r.thrown).map((r) => r.j)), `${side.name}: hops that land on the spring`).toBe('21-30');
      for (const r of rows.filter((row) => row.thrown)) expect(r.peak, `${side.name} hop ${r.j}`).toBe(120.208333);
      // Hops on steps 21 to 25 reach the cart's floor (y 120, 104 px up, 16 px to spare) and board it; 26 to 30 sail over it onto the floor beyond (x 110 to 98 left).
      expect(runs(rows.filter((r) => r.ground === 'cart' && r.boards).map((r) => r.j)), `${side.name}: boards the cart`).toBe('21-25');
      for (const r of rows.filter((row) => row.boards)) expect([r.x, r.y], `${side.name} hop ${r.j}`).toEqual([onSide(side, 192), 120]);
      expect(rows.filter((r) => r.j > 25 && r.thrown).map((r) => [r.ground, round6(onSide(side, r.x))]), `${side.name}: over the cart`).toEqual([110, 107, 101, 98, 98].map((x) => ['floor', x]));
    }
  });

  it('GDD-BOS-04 3-4 moves: a held jump clears her phase 3 charge from the floor', () => {
    // Not unhurt: a touch must cost the life. Poncho on the floor at x, facing her; she is in phase 3 (catorceStart) and runs from her start at the right
    // stop, charging left. C is the step her box would first touch his hurtbox if he stood still (found in a run with the Chile Fantasma). For every press step
    // P from C - 40 to C: jump pressed on step P, held to the top of the rise, then (glide) held on while he is over her, or (plain) let go at the top; no
    // move. Cleared: no life lost before her box's back edge is past his box.
    const STILL: PlayerInput = { move: 0, jumpHeld: false };
    const result = (x: number) => {
      let r = phase3(x, 1e9);
      let C = 0;
      for (let i = 1; i <= 400 && !C; i++) {
        r = stepRun(r, STILL, LEVEL_3_4);
        if (overlaps(ponchoBox(r.player), catorceBox(DEF, r.catorce!))) C = i;
      }
      const clear = (glide: boolean): number[] => {
        const cleared: number[] = [];
        for (let P = C - 40; P <= C; P++) {
          let s = phase3(x, 0);
          for (let i = 1; i <= 400 && s.phase === 'playing'; i++) {
            if (i > 1 && catorceBox(DEF, s.catorce!).x1 <= ponchoBox(s.player).x0) break;
            const aloft = !s.player.grounded;
            s = stepRun(s, { move: 0, jumpHeld: i === P || (i > P && (glide ? aloft || s.player.vy < 0 : aloft && s.player.vy < 0)) }, LEVEL_3_4);
          }
          if (s.lives.lives === 7) cleared.push(P - C);
        }
        return cleared;
      };
      // The same jump with nothing in the way (no her at that step), held to the glide: how high his feet rise at this x.
      let free: RunState = { ...phase3(x, 1e9), catorce: catorceStart(DEF, 0) };
      let top = 224;
      for (let i = 1; i <= 60; i++) {
        free = stepRun(free, { move: 0, jumpHeld: true }, LEVEL_3_4);
        top = Math.min(top, free.player.y);
      }
      return { x, C, glide: clear(true), plain: clear(false), rise: 224 - top };
    };
    const rows = [120, 240, 360].map(result);
    for (const r of rows) out(`GDD-BOS-04 phase 3 jump over her, x ${r.x}: C ${r.C}, glide clears at press C+(${runs(r.glide)}) (${r.glide.length}), plain clears (${r.plain.length}), free held jump rises ${r.rise}`);
    const WINDOW = [-12, -11, -10, -9, -8, -7, -6, -5];
    // At x 120 and 360: the held jump (the glide) clears her for exactly the presses from 12 to 5 steps before the step she would touch him standing, an unbroken
    // run of 8, the GDD's "at least 8 steps of press window at 150 px/s" met with nothing to spare; the plain jump, let go at the top, clears her for none.
    for (const r of [rows[0]!, rows[2]!]) {
      expect(r.glide, `x ${r.x}: the held jump's presses`).toEqual(WINDOW);
      expect(r.plain, `x ${r.x}: the plain jump's presses`).toEqual([]);
      expect(r.rise, `x ${r.x}: a held jump's rise`).toBe(56.4375);
    }
    expect([rows[0]!.C, rows[2]!.C], 'the step she would touch him standing, at x 120 and 360').toEqual([147, 51]);
    // At x 240 nothing clears her: (the free held jump there rises only 16 px): a gap in the GDD's claim.
    expect([rows[1]!.C, rows[1]!.glide, rows[1]!.plain, rows[1]!.rise], 'x 240').toEqual([99, [], [], 16]);
  });
});
