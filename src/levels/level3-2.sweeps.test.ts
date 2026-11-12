import { describe, expect, it } from 'vitest';
import { ARMADILLO, TILE } from '../config/tuning';
import { rollPath } from '../sim/armadillo';
import { enemyBox } from '../sim/enemy';
import { groundTop } from '../sim/slope';
import { startRun, type RunState } from '../sim/run';
import { LEVEL_3_2_FAR_WALL, LEVEL_3_2_GALLERY, LEVEL_3_2_ISLAND, LEVEL_3_2_PILLAR, LEVEL_3_2_PITS } from './level3-2';
import {
  apart,
  at,
  atT,
  ball,
  bot,
  type Bot,
  brokenSweep,
  CAREFUL_READ,
  CAREFUL_TEN,
  carefulDrop,
  cartIn,
  cartOf,
  causeOf,
  type Ctl,
  drivingState,
  DROPS,
  endOf,
  enemiesAt,
  every,
  type Flight,
  fly,
  FOLLOWS,
  GALLERY_BALL,
  hopIn,
  hopInto,
  idle,
  inCart,
  jumpAt,
  jumper,
  jumpFromCart,
  JUMPS,
  K2_BEAM_FACE,
  K_LIP,
  ketsu,
  L,
  ledgeF,
  type Letter,
  lostIn,
  mid,
  middleOf,
  OFRENDA_2,
  ONTO_SEAT,
  passed,
  pastBeam,
  PEN_BALL,
  PEN_HI,
  PEN_LO,
  penBot,
  penDrop,
  penFollow,
  penHilos,
  periodOf,
  play,
  RIDE_KETSU,
  RIDE_KI,
  RIDE_SHO,
  RIDE_TEN,
  rideF,
  right,
  runUntil,
  SEAT_EDGE,
  SEAT_TOP,
  span,
  standsOnFloor,
  states0,
  sweep,
  tally,
  TEN,
  TEN_ON_FOOT,
  TEN_TO_ISLAND,
  took,
  toRamp,
  waitFor,
  WALK_KETSU,
  WALK_KI,
  WALK_SHO,
  WALK_TEN,
  world,
  Y,
} from './level3-2.drive';

// GDD-WLD-17: level 3-2's longest sweeps and its whole-level bots, apart from `level3-2.test.ts` so that the two run side by side.
// The drivers they share are in `level3-2.drive.ts`.

describe('GDD-WLD-17 level 3-2 Ten: dropping into the pen', () => {
  it('GDD-ENM-04 3-2 the pen: each way of dropping in at every 4th step of the Armadillo\'s walk, then each way of meeting it: lives lost, where the ball ends, and it never leaves the pen', () => {
    const period = periodOf(PEN_BALL);
    const lost: Record<string, number> = {};
    const worst: Record<string, string> = {};
    const dazedAt = new Set<number>();
    const hilos: Record<string, Set<string>> = {};
    let runs = 0;
    let outOfPen = 0;
    let hitOnSeat = 0;
    /** The drops that cost the life before he has stood in the pen (he comes down on the tucked ball's side), counted once per drop. */
    const inDrop: Record<string, number> = {};
    for (const t of every(4, period)) {
      for (const drop of DROPS) {
        const down = penDrop(t, drop);
        const landed = down[down.length - 1]!;
        const start = atT(SEAT_EDGE, SEAT_TOP, t);
        for (const follow of FOLLOWS) {
          const key = `${drop} ${follow}`;
          runs++;
          const after = lostIn(down, start) ? [] : penFollow(landed, follow);
          const all = [...down, ...after];
          for (const st of all) {
            const b = enemyBox(L.enemies[PEN_BALL]!, ball(st));
            if (ball(st).alive && (b.x0 < PEN_LO - 1e-6 || b.x1 > PEN_HI + 1e-6)) outOfPen++;
            if (ball(st).alive && ball(st).shell!.phase === 'dazed' && ball(st).shell!.age === 0) dazedAt.add(Math.round(ball(st).x));
          }
          (hilos[key] ??= new Set()).add(penHilos(all[all.length - 1]!));
          const hit = all.findIndex((st) => st.lives.lives < start.lives.lives);
          if (hit < 0) continue;
          lost[key] = (lost[key] ?? 0) + 1;
          if (hit < down.length) {
            if (follow === 'stand') inDrop[drop] = (inDrop[drop] ?? 0) + 1;
            continue;
          }
          if (hit > 0 && all[hit - 1]!.player.grounded && all[hit - 1]!.player.y === SEAT_TOP && all[hit - 1]!.player.x < SEAT_EDGE + 6) hitOnSeat++;
          // The worst case after a landing: the fewest steps between his landing in the pen and the hit.
          const steps = hit - (down.length - 1);
          const record = `t ${t}: landed at x ${landed.player.x.toFixed(1)}, ball at ${ball(landed).x.toFixed(1)} ${ball(landed).shell!.phase}, hit ${steps} steps after`;
          const was = worst[drop];
          if (was === undefined || steps < Number(/hit (-?\d+) steps/.exec(was)![1])) worst[drop] = record;
        }
      }
    }
    expect(runs).toBe(241 * DROPS.length * FOLLOWS.length);
    expect(outOfPen).toBe(0);
    expect(hitOnSeat).toBe(0);
    const got = { lost, inDrop, worst, dazedAt: [...dazedAt], hilos: Object.fromEntries(Object.entries(hilos).map(([k, v]) => [k, [...v].join(' | ')])) };
    // Measured under the pen's roof one row higher and its ball starting at 126 (lives lost of 241): the plain jump at the flash's end now
    // clears it from about 92% of drops (C2: 59%), the glide at the flash's end about 91% (C2: 90%), the glide at the first flash about 97%
    // (C2: 66%); standing and the hop at the rolling ball lose as before; going back onto the seat after the held drop loses more (141,
    // C2: 89). A few drops still come down on the tucked ball's side (the drop's own count), and the worst case after a landing is still a
    // hit on the next step.
    expect(got).toEqual({
      lost: {
        'walk stand': 179,
        'walk hop': 199,
        'tap stand': 190,
        'tap hop': 201,
        'top stand': 192,
        'top hop': 203,
        'held stand': 183,
        'held hop': 197,
        'again stand': 197,
        'again hop': 203,
        'held seat': 141,
        'held topAtEnd': 84,
        'held heldAtEnd': 36,
        'held heldAtFirst': 27,
        'again topAtEnd': 24,
        'again heldAtEnd': 24,
        'tap topAtEnd': 20,
        'tap heldAtEnd': 20,
        'top topAtEnd': 18,
        'top heldAtEnd': 18,
        'again heldAtFirst': 15,
        'again seat': 34,
        'tap seat': 26,
        'top seat': 28,
        'walk topAtEnd': 17,
        'walk heldAtEnd': 17,
        'tap heldAtFirst': 8,
        'top heldAtFirst': 6,
        'walk seat': 16,
        'walk heldAtFirst': 6,
      },
      inDrop: {
        held: 22,
        again: 10,
        tap: 6,
        top: 4,
        walk: 3,
      },
      worst: {
        walk: 't 456: landed at x 1916.9, ball at 1931.3 tuck, hit 1 steps after',
        tap: 't 436: landed at x 1922.6, ball at 1936.3 tuck, hit 1 steps after',
        top: 't 436: landed at x 1922.6, ball at 1936.3 tuck, hit 1 steps after',
        held: 't 172: landed at x 2002.6, ball at 2016.3 tuck, hit 1 steps after',
        again: 't 424: landed at x 1926.6, ball at 1940.3 tuck, hit 1 steps after',
      },
      dazedAt: [1896, 2056],
      hilos: {
        'walk stand': 'none | 121',
        'walk topAtEnd': 'none | 121',
        'walk heldAtEnd': 'none | 121',
        'walk heldAtFirst': 'none | 121',
        'walk hop': 'none | 125 | 123 | 121',
        'walk seat': 'none | 121',
        'tap stand': 'none | 121',
        'tap topAtEnd': 'none | 121',
        'tap heldAtEnd': 'none | 121',
        'tap heldAtFirst': 'none | 121',
        'tap hop': 'none | 125 | 123 | 121',
        'tap seat': 'none | 121',
        'top stand': 'none | 121',
        'top topAtEnd': 'none | 121',
        'top heldAtEnd': 'none | 121',
        'top heldAtFirst': 'none | 121',
        'top hop': 'none | 125 | 123 | 121',
        'top seat': 'none | 121',
        'held stand': '121 123 | 121 123 125',
        'held topAtEnd': '121 123 125 | 121 123',
        'held heldAtEnd': '121 123 125 | 121 123',
        'held heldAtFirst': '121 123 125 | 121 123',
        'held hop': '121 123 | 121 123 125',
        'held seat': '121 123 | 121 123 125',
        'again stand': 'none | 121 125',
        'again topAtEnd': 'none | 121 125',
        'again heldAtEnd': 'none | 121 125',
        'again heldAtFirst': 'none | 121 | 121 125',
        'again hop': 'none | 125 | 123 | 121 125',
        'again seat': 'none | 121 125',
      },
    });
  }, 600_000);
});

describe('GDD-WLD-17 level 3-2 Ten: rail F', () => {
  it("GDD-WLD-15 3-2 rail F to the ramp: boarded at every 4th step of the enemies' walks, ridden with nothing, right held or a plain jump every 20 steps: no life lost, the enemies run down, and the gallery Armadillo", () => {
    const period = periodOf(GALLERY_BALL);
    const lostRides: string[] = [];
    /** Per enemy (1 and 3 the Alacranes, 2 the Armadillo), way and outcome: how many rides, and the steps after the landing in F it went. */
    const downAt: Record<string, { n: number; first: number; last: number }> = {};
    const ballFate: Record<string, number> = {};
    const hilos: Record<string, number> = {};
    for (const t of every(4, period)) {
      const hop = hopIn(atT(mid(LEVEL_3_2_ISLAND.col0), Y(11), t), 'F');
      const landed = hop[hop.length - 1]!;
      for (const way of ['none', 'right', 'jump'] as const) {
        // The jump: a plain full jump pressed on each 20th step of the ride, held while he rises, nothing else held.
        let rising = false;
        const ride = play(
          landed,
          400,
          (r, i) => {
            if (way === 'right') return right;
            if (way === 'none') return idle;
            if (i % 20 === 19 && r.player.grounded) rising = true;
            else if (rising && (r.player.grounded || r.player.vy >= 0)) rising = false;
            return { move: 0, jumpHeld: rising };
          },
          (r) => toRamp(r) || r.phase !== 'playing',
        );
        const all = [...hop, ...ride];
        if (lostIn(all, atT(0, 0, t))) lostRides.push(`${t} ${way}`);
        const end = all[all.length - 1]!;
        for (const k of [1, 2, 3]) {
          const killed = all.findIndex((st) => !st.enemies[k]!.alive);
          const how = killed < 0 ? 'alive at the ramp' : all[killed]!.carts[cartOf('F')]!.phase === 'rolling' ? 'run down' : 'other';
          const key = `${k} ${way} ${how}`;
          downAt[key] ??= { n: 0, first: Infinity, last: -Infinity };
          const d = downAt[key];
          d.n++;
          if (killed >= 0) {
            d.first = Math.min(d.first, killed - (hop.length - 1));
            d.last = Math.max(d.last, killed - (hop.length - 1));
          }
        }
        // The gallery Armadillo: what it did on the ride, and where a ball still rolling at the ramp's top ends (on the level's tiles).
        const phases = [...new Set(all.map((st) => (st.enemies[GALLERY_BALL]!.alive ? st.enemies[GALLERY_BALL]!.shell!.phase : 'gone')))].join(' ');
        const b = end.enemies[GALLERY_BALL]!;
        const rest = b.alive && b.shell!.phase === 'roll' ? rollPath(world, b.x, b.y ?? Y(11), b.dir, 600) : undefined;
        const fate = `${phases}${rest ? ` then ${rest.end} at ${Math.floor(rest.at[rest.at.length - 1]!.x / TILE)}` : ''}`;
        ballFate[`${way}: ${fate}`] = (ballFate[`${way}: ${fate}`] ?? 0) + 1;
        hilos[way] = (hilos[way] ?? 0) + ([145, 150, 154, 158].every((c) => took(end, c, 8)) ? 1 : 0);
      }
    }
    expect(lostRides).toEqual([]);
    // Measured over 673 start times: every enemy still on the gallery is run down, 33 to 154 steps after the landing in F; those down the ramp
    // or in the cutting when he boards are alive at the ramp's top. The Armadillo tucks at the rider in two thirds of the rides and is run
    // down in its tuck: no ball ever rolls (no `roll` among its phases), so none reaches the ramp, the hollow or the pit rolling. All four
    // rider's hilos with nothing or right held; never all four with a jump every 20 steps.
    expect({ period, downAt: Object.fromEntries(Object.entries(downAt).map(([k, v]) => [k, Number.isFinite(v.first) ? `${v.n}: ${v.first} to ${v.last}` : `${v.n}`])), ballFate, hilos }).toEqual({
      period: 2690,
      downAt: {
        '1 none alive at the ramp': '296', '1 none run down': '377: 33 to 154', '1 right alive at the ramp': '296', '1 right run down': '377: 33 to 154', '1 jump alive at the ramp': '296', '1 jump run down': '377: 33 to 154',
        '2 none alive at the ramp': '233', '2 none run down': '440: 33 to 154', '2 right alive at the ramp': '233', '2 right run down': '440: 33 to 154', '2 jump alive at the ramp': '232', '2 jump run down': '441: 33 to 154',
        '3 none alive at the ramp': '315', '3 none run down': '358: 33 to 154', '3 right alive at the ramp': '315', '3 right run down': '358: 33 to 154', '3 jump alive at the ramp': '315', '3 jump run down': '358: 33 to 154',
      },
      ballFate: {
        'none: walk': 222, 'none: walk tuck': 11, 'none: walk tuck gone': 440,
        'right: walk': 222, 'right: walk tuck': 11, 'right: walk tuck gone': 440,
        'jump: walk': 226, 'jump: walk gone': 88, 'jump: walk tuck': 6, 'jump: walk tuck gone': 353,
      },
      hilos: { none: 673, right: 673, jump: 0 },
    });
  }, 600_000);
});

describe('GDD-WLD-17 level 3-2 Ten on foot', () => {
  it('GDD-ENM-04 3-2 the gallery Armadillo startled from the left at every 4th step of its walk, a plain jump or the glide at its flash end: lives, and where its roll ends', () => {
    const period = periodOf(GALLERY_BALL);
    const result: Record<string, number> = {};
    for (const t of every(4, period)) {
      const b0 = enemiesAt(t)[GALLERY_BALL]!;
      const x0 = Math.min(Math.max(b0.x - 100, LEVEL_3_2_GALLERY.col0 * TILE + 8), 2600);
      for (const kind of ['top', 'held'] as const) {
        let holding = false;
        let air = false;
        const start = atT(x0, Y(11), t);
        const states = play(start, 400, (r) => {
          const b = r.enemies[GALLERY_BALL]!;
          const p = r.player;
          if (holding) {
            if (!p.grounded) air = true;
            if (air && p.grounded) holding = false;
            return { move: 0, jumpHeld: holding && (kind === 'held' || !(air && p.vy > 0)) };
          }
          if (b.alive && b.shell!.phase === 'tuck') {
            if (b.shell!.age === ARMADILLO.tuckSteps - 1 && p.grounded && !p.jumpWasHeld) {
              holding = true;
              air = false;
              return { move: 0, jumpHeld: true };
            }
            return idle;
          }
          return b.alive && b.shell!.phase === 'walk' && !states0(r) ? right : idle;
        }, (r) => r.phase !== 'playing' || !r.enemies[GALLERY_BALL]!.alive || r.enemies[GALLERY_BALL]!.shell!.phase === 'dazed');
        const end = states[states.length - 1] ?? start;
        const b = end.enemies[GALLERY_BALL]!;
        const startled = states.some((st) => st.enemies[GALLERY_BALL]!.shell?.phase === 'tuck');
        const lostAt = states.findIndex((st) => st.lives.lives < start.lives.lives);
        const how = lostAt >= 0 ? `lost to ${causeOf(states, lostAt)}` : !startled ? 'not startled' : !b.alive ? 'gone' : b.shell!.phase === 'dazed' ? `dazed at ${Math.floor(b.x / TILE)}` : `${b.shell!.phase} at ${Math.floor(b.x / TILE)}`;
        result[`${kind} ${how}`] = (result[`${kind} ${how}`] ?? 0) + 1;
      }
    }
    // Measured over 673 start times: every roll that is startled ends dazed against the island's face down in pit F (column 144; it then
    // falls out of the level), never near cart F's start; the lives lost here are mostly to the Alacranes this simple approach walks into
    // (it does nothing about them), and 23 (glide) or 38 (plain jump) to the ball itself.
    expect(result).toEqual({
      'top dazed at 144': 430, 'top lost to alacran 1': 87, 'top lost to alacran 3': 118, 'top lost to armadillo 2': 38,
      'held dazed at 144': 452, 'held lost to alacran 1': 86, 'held lost to alacran 3': 112, 'held lost to armadillo 2': 23,
    });
  }, 600_000);

  it("GDD-WLD-17 3-2 Ten on foot: from the island past the gallery's enemies to the ofrenda at 181, at every 8th start time of their walks", () => {
    const period = periodOf(GALLERY_BALL);
    const result: Record<string, number> = {};
    const steps: number[] = [];
    for (const t of every(8, period)) {
      const run = bot(TEN_ON_FOOT(), atT(mid(LEVEL_3_2_ISLAND.col0), Y(11), t), 1500, true);
      const how = run.lost.length > 0 ? `lost to ${causeOf(run.states, run.lost[0]!)}` : run.end.checkpointIndex >= 2 ? 'ofrenda' : `stuck at ${Math.floor(run.end.player.x / TILE)}`;
      result[how] = (result[how] ?? 0) + 1;
      if (how === 'ofrenda') steps.push(run.states.length);
      expect(run.states.every((st) => st.carts.every((c) => c.phase === 'waiting')), `${t}`).toBe(true);
    }
    // Measured over 337 start times: the bot reaches the ofrenda at 181 with every life in 302 (334 to 500 steps); it loses one to the
    // first Alacrán in 12, to the second in 11, to the Armadillo in 11 and to the spikes in 1 (a glide over the ramp that comes down short).
    expect({ result, fastest: Math.min(...steps), slowest: Math.max(...steps) }).toEqual({
      fastest: 334,
      result: { 'lost to alacran 1': 12, 'lost to alacran 3': 11, 'lost to armadillo 2': 11, 'lost to spikes': 1, ofrenda: 302 },
      slowest: 500,
    });
  }, 600_000);
});

/** The hilos `want` as text. */
const names = (want: readonly (readonly [number, number])[]) => want.map(([c, r]) => `${c},${r}`).join(' ');
/** A flight that lands in cart `l`. */
const inTo = (l: Letter) => (f: Flight) => f.landed !== undefined && cartIn(f.landed) === l;
/** A flight that lands on the floor at `y`, past `past`, in no cart. */
const onY = (y: number, past: number) => (f: Flight) => f.landed !== undefined && !f.lost && cartIn(f.landed) === undefined && f.landed.player.y === y && f.landed.player.x > past;
/** Plays `tasks` from `from` and asserts no life is lost; where they end. */
const go = (tasks: Ctl[], from: RunState): RunState => {
  const b = bot(tasks, from, 3000);
  expect(b.lost, 'a bot piece').toEqual([]);
  return b.end;
};
/** How a bot's run ended, its lives lost and what took each, as text. */
const how = (b: Bot, head: Bot) => `${b.end.phase === 'clear' ? 'exit' : 'no exit'}, ${b.lost.length} lost${b.lost.length ? ` (${b.lost.map((i) => `${causeOf(b.states, i)} at ${Math.floor(b.states[Math.max(0, i - 1)]!.player.x / TILE)}`).join(', ')})` : ''}`.concat(head.lost.length ? ' (head)' : '');

/** A pen ball's x as tiles from the seat's right edge, to 0.001. */
const tilesFromSeat = (x: number) => Math.round(((x - SEAT_EDGE) / TILE) * 1000) / 1000;

describe('GDD-WLD-17 level 3-2 the whole level', () => {
  it("GDD-ENM-04 3-2 the careful read from the seat: at every step of the ball's walk, the drop and the glide at its flash end, and the window the read allows", () => {
    // From where the careful rider stands still on the seat, with the pen's ball at each of the 962 steps of its walk: he walks off into
    // the pen, then glides at the flash's end (or takes the plain jump), as `penBot` does, on to standing on the far wall.
    const period = periodOf(PEN_BALL);
    const seat = bot(ONTO_SEAT(), at(OFRENDA_2.x, OFRENDA_2.y)).end;
    const steps = Array.from({ length: period }, (_, p) => {
      const from = { ...seat, enemies: enemiesAt(p) };
      const meet = (kind: 'held' | 'top') => bot([TEN_TO_ISLAND()[2]!, penBot(kind), ...TEN_TO_ISLAND().slice(4, 6)], from, 1500, true);
      const held = meet('held');
      return { p, allowed: carefulDrop(from), x: ball(from).x, lost: held.lost.length > 0, onWall: standsOnFloor(11, LEVEL_3_2_FAR_WALL.col0, LEVEL_3_2_FAR_WALL.col1)(held.end), plainLost: carefulDrop(from) && meet('top').lost.length > 0 };
    });
    const allowed = steps.filter((st) => st.allowed);
    // The read: never a life lost, and on the far wall after, at every step it allows.
    expect(allowed.filter((st) => st.lost || !st.onWall).map((st) => st.p)).toEqual([]);
    // The longest wait on the seat for it, from any step of the walk.
    let longest = 0;
    for (let p = 0; p < period; p++) {
      let w = 0;
      while (w < period && !steps[(p + w) % period]!.allowed) w++;
      longest = Math.max(longest, w);
    }
    const got = {
      read: CAREFUL_READ,
      allowed: allowed.length,
      ballX: `${tilesFromSeat(Math.min(...allowed.map((st) => st.x)))} to ${tilesFromSeat(Math.max(...allowed.map((st) => st.x)))} tiles from the seat's edge`,
      longestWait: longest,
      lostAnywhere: steps.filter((st) => st.lost).length,
      plainLostInWindow: allowed.filter((st) => st.plainLost).length,
    };
    // Measured: the read (the ball walking toward him, its middle 4 tiles or more from the seat's edge, up to the pen's far end at 10.5)
    // allows 313 of the walk's 962 steps; dropping in at any of them loses no life, by the glide at the flash's end and by the plain jump;
    // the longest wait on the seat for it is 649 steps (10.8 s). (Over the whole walk, the glide loses one at 147 steps.)
    expect(got).toEqual({
      read: { heading: -1, tiles: 4 },
      allowed: 313,
      ballX: "4 to 10.5 tiles from the seat's edge",
      longestWait: 649,
      lostAnywhere: 147,
      plainLostInWindow: 0,
    });
  }, 300_000);

  it('GDD-WLD-04 3-2 a rider takes all 49 hilos of the main route and exits with every life', () => {
    const missed: string[] = [];
    /**
     * From `from`, riding cart `letter` with nothing held (and the 5 coyote steps after a broken end), the first take-off, in ride order and
     * by `top`, `held`, `again`, `tap`, nothing then right held, whose flight `ok` accepts and that has taken every hilo of `want` by its
     * landing; failing that, the accepted one that took the most, its misses listed.
     */
    function seek(from: RunState, letter: Letter, ok: (f: Flight) => boolean, want: readonly (readonly [number, number])[]): RunState {
      const ride = [from, ...play(from, 600, () => idle, (r) => !inCart(r, letter) || r.carts[cartOf(letter)]!.phase === 'stopped')];
      const last = ride[ride.length - 1]!;
      if (!inCart(last, letter)) ride.push(...play(last, 5, () => idle));
      let best: Flight | undefined;
      let most = -1;
      for (let k = 0; k < ride.length; k++) {
        for (const kind of ['top', 'held', 'again', 'tap'] as const) {
          for (const move of [0, 1] as const) {
            const f = fly(ride[k]!, kind, k, move);
            if (!ok(f)) continue;
            const end = f.landed!;
            const n = want.filter(([c, r]) => took(end, c, r)).length;
            if (n === want.length) return end;
            if (n > most) [best, most] = [f, n];
          }
        }
      }
      expect(best, `a flight from ${letter}`).toBeDefined();
      missed.push(`${letter}: ${names(want.filter(([c, r]) => !took(best!.landed!, c, r)))}`);
      return best!.landed!;
    }
    let r = go([runUntil(1, (st) => st.carts[cartOf('A')]!.phase !== 'waiting')], startRun(L));
    r = seek(r, 'A', inTo('B'), [[4, 7], [5, 7], [12, 6], [15, 6], [18, 6]]);
    r = seek(r, 'B', inTo('C'), [[26, 6], [31, 8], [32, 9], [33, 10], [37, 10], [40, 10]]);
    r = seek(r, 'C', onY(Y(13), endOf('C')), [[52, 10], [59, 9], [61, 8], [64, 11]]);
    r = go([runUntil(1, passed(0)), hopInto('D')], r);
    r = seek(r, 'D', onY(Y(13), endOf('D')), [[73, 10], [81, 9], [83, 8], [86, 11]]);
    r = go([hopInto('E')], r);
    r = seek(r, 'E', (f) => f.landed !== undefined && pastBeam(f.landed), [[93, 10], [97, 8]]);
    r = go([waitFor((st) => !inCart(st, 'E')), runUntil(1, passed(1))], r);
    // The seat and the pen: onto the seat, to its right edge, then the first wait there after which a glide off it takes the pen's three
    // hilos and the pen (as `penBot` meets it) is crossed onto the far wall with no life lost.
    r = go([...TEN_TO_ISLAND().slice(0, 2), runUntil(1, (st) => st.player.x >= SEAT_EDGE)], r);
    let pen: RunState | undefined;
    for (let w = 0; w < 1000 && pen === undefined; w += 4) {
      const waited = w === 0 ? r : play(r, w, () => idle)[w - 1]!;
      const drop = play(waited, 120, jumper('held', 1), (st, i) => i > 0 && st.player.grounded);
      const landed = drop[drop.length - 1]!;
      if (lostIn(drop, r) || ![121, 123, 125].every((c) => took(landed, c, 10))) continue;
      const on = bot([penBot(), ...TEN_TO_ISLAND().slice(4, 6)], landed, 1500);
      if (on.lost.length === 0 && standsOnFloor(11, LEVEL_3_2_FAR_WALL.col0, LEVEL_3_2_FAR_WALL.col1)(on.end)) pen = on.end;
    }
    expect(pen, 'a wait on the seat after which the glide takes the pen hilos').toBeDefined();
    r = pen!;
    // The hops: the first take-off over each whose landing (the pillar, the island) takes its hilo.
    for (const [col, xs, land] of [[132, apart(2066, 2093.6), LEVEL_3_2_PILLAR], [138, apart(2144, 2192), LEVEL_3_2_ISLAND]] as const) {
      let next: RunState | undefined;
      for (const x of xs) {
        for (const hold of ['top', x + 3 * TILE, x + 5 * TILE] as const) {
          if (next) break;
          const b = bot([jumpAt(x, hold)], r, 300);
          if (b.lost.length === 0 && took(b.end, col, 9) && standsOnFloor(11, land.col0, land.col1)(b.end) && b.end.carts.every((c) => c.phase === 'waiting')) next = b.end;
        }
      }
      if (next) r = next;
      else {
        missed.push(`hop to ${land === LEVEL_3_2_PILLAR ? 'the pillar' : 'the island'}: ${col},9`);
        r = go(land === LEVEL_3_2_PILLAR ? TEN_TO_ISLAND().slice(6, 8) : TEN_TO_ISLAND().slice(8), r);
      }
    }
    r = go([hopInto('F')], r);
    r = seek(r, 'F', (f) => !f.lost && ledgeF(f) === 'ledge', [[145, 8], [150, 8], [154, 8], [158, 8], [164, 8], [166, 6], [168, 7], [171, 9]]);
    r = go([runUntil(1, passed(2)), hopInto('K1')], r);
    r = seek(r, 'K1', inTo('K2'), [[188, 8], [191, 8], [197, 7], [199, 6], [202, 9]]);
    r = seek(r, 'K2', (f) => f.landed !== undefined && inCart(f.landed, 'K2') && f.landed.player.x - 6 > K2_BEAM_FACE + TILE, [[209, 6]]);
    r = seek(r, 'K2', inTo('K3'), [[217, 7], [219, 6], [223, 9]]);
    r = seek(r, 'K3', (f) => !f.lost && (ketsu(f) === 'ledge' || ketsu(f) === 'exit'), [[227, 8], [229, 6], [231, 7]]);
    if (r.phase !== 'clear') r = go([runUntil(1, (st) => st.phase === 'clear')], r);
    expect(r.phase).toBe('clear');
    expect(r.lives.lives).toBe(7);
    const taken = r.hilosTaken.filter(Boolean).length;
    // Measured at the level's first start time: all 49 of the main route, none missed, every life; the secret's stays.
    expect({ taken, secret: took(r, 236, 13), missed }).toEqual({ taken: 49, secret: false, missed: [] });
  }, 300_000);

  it('GDD-WLD-03 3-2 ofrendas flown over: a plain jump and the glide from each of the 6 tiles before each ofrenda, and the cart sweeps that land past one', () => {
    const over: Record<string, number> = {};
    L.ofrendas.forEach((o, i) => {
      for (const x of apart(o.x - 6 * TILE, o.x - 14)) {
        if (groundTop(world, x, o.y + 1) !== o.y) continue;
        for (const vx of [0, 120]) {
          for (const kind of ['top', 'held'] as const) {
            const f = fly({ ...at(x, o.y, vx), checkpointIndex: i - 1, checkpoint: i === 0 ? L.spawn : L.ofrendas[i - 1]! }, kind, 0, 1);
            const end = f.landed ?? f.states[f.states.length - 1]!;
            const key = `${o.id} ${vx === 0 ? 'standing' : 'running'} ${kind}`;
            over[`${key} take-offs`] = (over[`${key} take-offs`] ?? 0) + 1;
            if (end.player.x > o.x + 14 && end.checkpointIndex < i) over[key] = (over[key] ?? 0) + 1;
          }
        }
      }
    });
    // The cart sweeps: C's flights that land in D past the first ofrenda without it; F's that land past the third without it.
    const c = brokenSweep('C', mid(44), Y(13));
    const ride = rideF(0, () => idle, (r) => r.carts[cartOf('F')]!.phase === 'falling');
    const fRides = ride.slice(ride.findIndex((st) => middleOf(st, 'F') >= LEVEL_3_2_PITS.F.col0 * TILE));
    for (const move of [1, 0] as const) {
      const cs = sweep(c.rides, move);
      const fs = sweep(fRides, move);
      for (const kind of JUMPS) {
        over[`3-2-1 from cart C ${move ? 'right' : 'none'} ${kind}`] = cs[kind].filter((f) => f.landed && f.landed.player.x > L.ofrendas[0]!.x + 14 && f.landed.checkpointIndex < 0).length;
        over[`3-2-3 from cart F ${move ? 'right' : 'none'} ${kind}`] = fs[kind].filter((f) => f.landed && f.landed.player.x > L.ofrendas[2]!.x + 14 && f.landed.checkpointIndex < 2).length;
      }
    }
    // Measured: as C2's; the pen's and the hops' changes moved no flight over an ofrenda.
    expect(over).toEqual({
      '3-2-1 standing top take-offs': 8,
      '3-2-1 standing held take-offs': 8,
      '3-2-1 standing held': 7,
      '3-2-1 running top take-offs': 8,
      '3-2-1 running top': 5,
      '3-2-1 running held take-offs': 8,
      '3-2-1 running held': 5,
      '3-2-1 standing top': 4,
      '3-2-2 standing top take-offs': 26,
      '3-2-2 standing held take-offs': 26,
      '3-2-2 running top take-offs': 26,
      '3-2-2 running held take-offs': 26,
      '3-2-2 running held': 10,
      '3-2-2 standing held': 11,
      '3-2-2 running top': 6,
      '3-2-2 standing top': 4,
      '3-2-3 standing top take-offs': 26,
      '3-2-3 standing held take-offs': 26,
      '3-2-3 running top take-offs': 26,
      '3-2-3 running held take-offs': 26,
      '3-2-3 running held': 14,
      '3-2-3 standing held': 12,
      '3-2-3 running top': 6,
      '3-2-3 standing top': 4,
      '3-2-1 from cart C right tap': 0,
      '3-2-3 from cart F right tap': 0,
      '3-2-1 from cart C right top': 0,
      '3-2-3 from cart F right top': 0,
      '3-2-1 from cart C right held': 13,
      '3-2-3 from cart F right held': 0,
      '3-2-1 from cart C right again': 0,
      '3-2-3 from cart F right again': 0,
      '3-2-1 from cart C none tap': 0,
      '3-2-3 from cart F none tap': 0,
      '3-2-1 from cart C none top': 0,
      '3-2-3 from cart F none top': 0,
      '3-2-1 from cart C none held': 13,
      '3-2-3 from cart F none held': 0,
      '3-2-1 from cart C none again': 0,
      '3-2-3 from cart F none again': 0,
    });
  }, 300_000);

  it('GDD-WLD-17 3-2 the bots: one rides every cart, one never boards one, one stays in F, one stays in K3, a careful one; each at every 8th start time of the enemies', () => {
    const period = periodOf(GALLERY_BALL);
    // Ki and Sho hold no enemy: each route's is played once from the start, and the rest from its end with the enemies as they would be then.
    const rideHead = bot([...RIDE_KI(), ...RIDE_SHO()], startRun(L));
    const walkHead = bot([...WALK_KI(), ...WALK_SHO()], startRun(L));
    expect([rideHead.lost, walkHead.lost]).toEqual([[], []]);
    const result: Record<string, Record<string, number>> = { ride: {}, walk: {}, stayF: {}, stayK3: {}, careful: {} };
    const hilos: Record<string, Set<number>> = { ride: new Set(), stayK3: new Set() };
    const steps: Record<string, number[]> = { ride: [], walk: [], stayF: [], stayK3: [], careful: [] };
    const carefulLost: string[] = [];
    // The one that stays in F loses its life at the spikes, and its respawn puts every enemy and cart at its start: from there it is the same
    // run at every start time (its driving state is the same, asserted), played once.
    let afterF: { at: string; steps: number; end: RunState } | undefined;
    for (const t of every(8, period)) {
      const at0 = (head: Bot) => ({ ...head.end, enemies: enemiesAt(t + head.states.length) });
      // The rider to cart F, shared by the rider, the one that stays in F and the one that stays in K3.
      const toF = bot(TEN(), at0(rideHead), 3000, true);
      if (toF.lost.length > 0) {
        for (const name of ['ride', 'stayF', 'stayK3'] as const) tally(result[name]!, how(toF, rideHead));
      } else {
        const ride = bot([jumpFromCart((r) => r.player.x >= 2625, 'top'), runUntil(1, passed(2)), ...RIDE_KETSU()], toF.end, 3000, true);
        const n0 = rideHead.states.length + toF.states.length;
        tally(result.ride!, how(ride, rideHead));
        if (ride.end.phase === 'clear') steps.ride!.push(n0 + ride.states.length);
        hilos.ride!.add(ride.end.hilosTaken.filter(Boolean).length);
        // The one that stays in K3 goes on from the ride's landing in K3 (its sixth task's end).
        const inK3 = ride.states[ride.marks[5]! - 1]!;
        const k3 = bot([waitFor((r) => r.carts[cartOf('K3')]!.phase === 'stopped'), runUntil(1, (r) => r.player.grounded && r.player.x >= 238 * TILE + 2), runUntil(-1, (r) => r.player.x <= 227 * TILE + 8), jumpAt(227 * TILE + 8, K_LIP + TILE), runUntil(1, (r) => r.phase === 'clear')], inK3, 2000, true);
        tally(result.stayK3!, how(k3, rideHead));
        if (k3.end.phase === 'clear') {
          steps.stayK3!.push(n0 + ride.marks[5]! + k3.states.length);
          expect(k3.end.lives.used.has(`veladora:${L.veladora!.col},${L.veladora!.row}`)).toBe(true);
        }
        hilos.stayK3!.add(k3.end.hilosTaken.filter(Boolean).length);
        // The one that stays in F, to the first step he plays again after the life.
        const f = bot([waitFor((r) => r.lives.lives < 7)], toF.end, 1000);
        expect(f.lost.length, `${t}`).toBe(1);
        const cause = causeOf(f.states, f.lost[0]!);
        afterF ??= (() => {
          const rest = bot([...TEN(), jumpFromCart((r) => r.player.x >= 2625, 'top'), runUntil(1, passed(2)), ...RIDE_KETSU()], f.end, 6000);
          return { at: drivingState(f.end), steps: rest.states.length, end: rest.end };
        })();
        expect(drivingState(f.end), `${t}`).toBe(afterF.at);
        const exits = afterF.end.phase === 'clear';
        tally(result.stayF!, `${exits ? 'exit' : 'no exit'}, 1 lost (${cause})`);
        if (exits) steps.stayF!.push(n0 + f.states.length + afterF.steps);
      }
      const walk = bot([...WALK_TEN(), ...WALK_KETSU()], at0(walkHead), 6000, true);
      tally(result.walk!, how(walk, walkHead));
      if (walk.end.phase === 'clear') steps.walk!.push(walkHead.states.length + walk.states.length);
      expect(walk.states.some((st) => st.carts.some((c) => c.phase !== 'waiting')), `walk ${t}`).toBe(false);
      const careful = bot([...CAREFUL_TEN(), jumpFromCart((r) => r.player.x >= 2625, 'top'), runUntil(1, passed(2)), ...RIDE_KETSU()], at0(rideHead), 8000, true);
      tally(result.careful!, how(careful, rideHead));
      if (careful.end.phase === 'clear') steps.careful!.push(rideHead.states.length + careful.states.length);
      else carefulLost.push(`${t}: ${how(careful, rideHead)}`);
    }
    const out = { result, steps: Object.fromEntries(Object.entries(steps).map(([k, v]) => [k, span(v)])), hilos: Object.fromEntries(Object.entries(hilos).map(([k, v]) => [k, [...v]])), carefulLost };
    // Measured over 337 start times. The rider exits with every life in 302 (C2: 299; 27 to 32 s), losing one to the pen's ball in the
    // rest; the walker in 224 (C2: 210); the one that stays in F loses only that life, at the spikes; the one that stays in K3 takes the
    // veladora. The careful one (it stands on the seat until the careful read lets it drop: the ball walking toward it, 4 tiles or more
    // away) exits with every life at all 337, in 1759 to 2552 steps.
    expect(out).toEqual({
      result: {
        ride: {
          'exit, 0 lost': 302,
          'no exit, 1 lost (armadillo 0 at 124)': 8,
          'no exit, 1 lost (armadillo 0 at 123)': 6,
          'no exit, 1 lost (armadillo 0 at 122)': 6,
          'no exit, 1 lost (armadillo 0 at 121)': 2,
          'no exit, 1 lost (armadillo 0 at 120)': 5,
          'no exit, 1 lost (armadillo 0 at 119)': 8,
        },
        walk: {
          'exit, 0 lost': 224,
          'no exit, 1 lost (alacran 4 at 193)': 10,
          'no exit, 1 lost (alacran 4 at 192)': 4,
          'no exit, 1 lost (alacran 1 at 151)': 1,
          'no exit, 1 lost (alacran 1 at 149)': 4,
          'no exit, 1 lost (alacran 3 at 156)': 1,
          'no exit, 1 lost (alacran 3 at 157)': 5,
          'no exit, 1 lost (alacran 3 at 158)': 4,
          'no exit, 1 lost (armadillo 2 at 159)': 1,
          'no exit, 1 lost (armadillo 0 at 120)': 5,
          'no exit, 1 lost (armadillo 0 at 119)': 8,
          'no exit, 1 lost (armadillo 2 at 158)': 1,
          'no exit, 1 lost (alacran 3 at 159)': 1,
          'no exit, 1 lost (alacran 1 at 153)': 1,
          'no exit, 1 lost (alacran 1 at 154)': 3,
          'no exit, 1 lost (alacran 1 at 155)': 3,
          'no exit, 1 lost (armadillo 0 at 124)': 4,
          'no exit, 1 lost (armadillo 0 at 123)': 5,
          'no exit, 1 lost (armadillo 0 at 122)': 3,
          'no exit, 1 lost (armadillo 0 at 121)': 2,
          'no exit, 1 lost (armadillo 2 at 149)': 27,
          'no exit, 1 lost (alacran 4 at 194)': 14,
          'no exit, 1 lost (spikes at 177)': 1,
          'no exit, 1 lost (alacran 1 at 157)': 2,
          'no exit, 1 lost (armadillo 2 at 161)': 1,
          'no exit, 1 lost (alacran 3 at 172)': 2,
        },
        stayF: {
          'exit, 1 lost (spikes)': 302,
          'no exit, 1 lost (armadillo 0 at 124)': 8,
          'no exit, 1 lost (armadillo 0 at 123)': 6,
          'no exit, 1 lost (armadillo 0 at 122)': 6,
          'no exit, 1 lost (armadillo 0 at 121)': 2,
          'no exit, 1 lost (armadillo 0 at 120)': 5,
          'no exit, 1 lost (armadillo 0 at 119)': 8,
        },
        stayK3: {
          'exit, 0 lost': 302,
          'no exit, 1 lost (armadillo 0 at 124)': 8,
          'no exit, 1 lost (armadillo 0 at 123)': 6,
          'no exit, 1 lost (armadillo 0 at 122)': 6,
          'no exit, 1 lost (armadillo 0 at 121)': 2,
          'no exit, 1 lost (armadillo 0 at 120)': 5,
          'no exit, 1 lost (armadillo 0 at 119)': 8,
        },
        careful: {
          'exit, 0 lost': 337,
        },
      },
      steps: {
        ride: '1633 to 1946',
        walk: '1870 to 2318',
        stayF: '2480 to 2793',
        stayK3: '1832 to 2145',
        careful: '1759 to 2552',
      },
      hilos: {
        ride: [46, 48, 47],
        stayK3: [47, 49, 48],
      },
      carefulLost: [],
    });
  }, 900_000);

  it('GDD-LIFE-02 3-2 each respawn leads on: after a life lost at each place, he is back at the ofrenda before it with every cart at its start, and the rider goes on to the exit', () => {
    const o = L.ofrendas;
    const places: Record<string, { from: RunState; fail: Ctl[]; on: () => Ctl[]; ofrenda: number }> = {
      "rail D's end": { from: at(o[0]!.x, o[0]!.y), fail: [hopInto('D'), waitFor((r) => r.lives.lives < 7)], on: () => [...RIDE_SHO(), ...RIDE_TEN(), ...RIDE_KETSU()], ofrenda: 0 },
      'the second hop pit': { from: at(o[1]!.x, o[1]!.y), fail: [...TEN_TO_ISLAND().slice(0, 8), runUntil(1, (r) => r.lives.lives < 7)], on: () => [...RIDE_TEN(), ...RIDE_KETSU()], ofrenda: 1 },
      'the spike hollow': { from: at(o[1]!.x, o[1]!.y), fail: [...TEN(), waitFor((r) => r.lives.lives < 7)], on: () => [...RIDE_TEN(), ...RIDE_KETSU()], ofrenda: 1 },
      "K1's end": { from: at(o[2]!.x, o[2]!.y), fail: [hopInto('K1'), waitFor((r) => r.lives.lives < 7)], on: () => RIDE_KETSU(), ofrenda: 2 },
      "K2's jump to K3": { from: at(o[2]!.x, o[2]!.y), fail: [hopInto('K1'), jumpFromCart((r) => endOf('K1') - r.player.x <= 30, 'top'), jumpFromCart((r) => K2_BEAM_FACE - r.player.x <= 40, 'top'), jumpFromCart((r) => endOf('K2') - r.player.x <= 80, 'top'), waitFor((r) => r.lives.lives < 7)], on: () => RIDE_KETSU(), ofrenda: 2 },
    };
    const out: Record<string, string> = {};
    for (const [name, p] of Object.entries(places)) {
      const run = bot([...p.fail, ...p.on()], p.from, 6000);
      const back = run.states.findIndex((st, i) => i > (run.lost[0] ?? Infinity) && st.phase === 'playing');
      expect(run.lost.length, name).toBe(1);
      expect(run.states[back]!.player, name).toMatchObject({ x: o[p.ofrenda]!.x, y: o[p.ofrenda]!.y });
      expect(run.states[back]!.carts.every((c) => c.phase === 'waiting'), name).toBe(true);
      expect(run.end.phase, name).toBe('clear');
      out[name] = `${run.states.length - back} steps from the respawn to the exit`;
    }
    // Measured: from the respawn to the exit. (The first hop costs no life any more; K3's jumps cost none.)
    expect(out).toEqual({
      'rail D\'s end': '1342 steps from the respawn to the exit',
      'the second hop pit': '1177 steps from the respawn to the exit',
      'the spike hollow': '1177 steps from the respawn to the exit',
      'K1\'s end': '340 steps from the respawn to the exit',
      'K2\'s jump to K3': '340 steps from the respawn to the exit',
    });
  }, 300_000);
});
