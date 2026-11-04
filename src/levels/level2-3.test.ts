import { describe, expect, it } from 'vitest';
import { AWNING, TILE } from '../config/tuning';
import { enemyBox, feetOf, isStunned, kindOf, type Enemy } from '../sim/enemy';
import { touchesHilo } from '../sim/hilo';
import { loseLife, startWorld } from '../sim/lives';
import { spawn, type PlayerInput, type PlayerState } from '../sim/movement';
import { bundleBox, rolloLength } from '../sim/papel';
import { startRun, stepRun, touchesExit, type Level, type RunState } from '../sim/run';
import { veladoraUsed } from '../sim/veladora';
import { AWNINGS_2_3, CORDELES_2_3, ENEMIES_2_3, LEVEL_2_3, ROLLOS_2_3, ROOF } from './level2-3';
import { gaps, openGaps, validateLevel } from './validate';

const level = LEVEL_2_3;
const world = level.world;
const entry = { id: '2-3', world: 2, test: false, level } as const;
const mid = (col: number) => col * TILE + TILE / 2;
const quiet: Level = { ...level, enemies: [] };
const standing = (x: number, y: number): PlayerState => ({ ...spawn(x, y), grounded: true });
const idle: PlayerInput = { move: 0, jumpHeld: false };
/** The awnings by name: their positions in `AWNINGS_2_3` (GDD-WLD-14). */
const T1 = 1;
const T2 = 2;
const T3 = 3;
const T4 = 4;
const A2 = 5;
const T5 = 8;
/** The rollos: the Fuego pit's, the alley's and the exam's. */
const R2 = 0;
const R1 = 1;
const R4 = 2;
/** The high roof F1's top and the exit roof's top (row 8). */
const HIGH = 8 * TILE;

/** Plays `steps` steps from `run` with `input(run, i)`, returning every state. */
function play(lv: Level, run: RunState, steps: number, input: (r: RunState, i: number) => PlayerInput): RunState[] {
  const out: RunState[] = [];
  let r = run;
  for (let i = 0; i < steps; i++) {
    r = stepRun(r, input(r, i), lv);
    out.push(r);
  }
  return out;
}

/** The rebound speeds, in order: the vy of each step on which a new awning rebound began. */
const rebounds = (states: readonly RunState[]): number[] => states.flatMap((s, i) => (i > 0 && s.awningBounce !== states[i - 1]!.awningBounce && s.awningBounce ? [s.player.vy] : []));

/** Holds right while left of `target` (counting the braking distance in the air), else lets go: never presses left, so he keeps facing right. */
const towards = (p: PlayerState, target: number): number => (p.x + (p.vx * Math.abs(p.vx)) / 600 < target ? 1 : 0);

/** A far-post rollo crossing: the bot jumps for it from `from`, steers its rebounds to `aim`, and claws `rollo`'s bundle. */
interface Crossing {
  readonly from: number;
  readonly to: number;
  readonly aim: number;
  readonly rollo: number;
}

/** The two far-post rollo crossings of 2-3: the alley's (R1) and the exam's (R4). */
const CROSSINGS: readonly Crossing[] = [
  { from: 1672, to: 1800, aim: 1786, rollo: R1 },
  { from: 2600, to: 2700, aim: 2680, rollo: R4 },
];

/**
 * The bot (L-048: it lets go of jump for at least a step before pressing it again). It holds right and:
 * - jumps (held 20 steps) at a wall in the row of its feet within 14 px of its front, at a drop of three tiles or more within 10 px of
 *   it, and under a closed piñata 48 px over its feet; before such a jump it waits while an Alacrán, a Tlacuache or a spinning Trompo at
 *   its height is ahead within 90 px, or coming its way within 160 px;
 * - claws an Alacrán, a Tlacuache, a Paloma, a Chapulín or a spinning Trompo on its level whose near edge is within 26 px of its front,
 *   and hops (held 4 steps) onto a stunned Trompo within 18 px of its front, which stomps it;
 * - over the torn chain, from the roof's edge (x 1004 to 1030), holds jump and right until it stands anywhere past x = 1240;
 * - at each far-post rollo, from `from`: holds jump, steers its rebounds to `aim` (never pressing left), claws once while rising with its
 *   claw's reach over the bundle and its feet 20 to 56 px under the line's top, and once it stands on the strung line walks right, where
 *   the wall rule jumps it onto the roof;
 * - on the roof before the cordel's pit it waits at x = 2304, out of the Paloma's sight, until the Paloma walks back towards the roof (or
 *   telegraphs), then walks up to the edge, where the claw rule claws it.
 * It returns the run, the steps it took, the lives lost (step and place) and every state.
 */
function bot(lv: Level, maxSteps: number, wait = 0): { run: RunState; steps: number; lost: { step: number; x: number; y: number }[]; states: RunState[] } {
  let run = startRun(lv);
  for (let i = 0; i < wait; i++) run = stepRun(run, idle, lv);
  const states: RunState[] = [];
  const lost: { step: number; x: number; y: number }[] = [];
  const w = lv.world;
  let hold = 0;
  let jumpBefore = false;
  let clawBefore = false;
  let steps = 0;
  let chain = false;
  while (run.phase !== 'clear' && steps < maxSteps) {
    if (run.phase !== 'playing') chain = false;
    const p = run.player;
    const { x, y, grounded } = p;
    const front = x + 6;
    let move = 1;
    let claw = false;
    let jump = false;
    let hop = false;
    let held: boolean | null = null;
    if (run.phase === 'playing') {
      lv.enemies.forEach((e, i) => {
        const s = run.enemies[i]!;
        if (!s.alive) return;
        const k = kindOf(e);
        const box = enemyBox(e, s);
        const near = box.x0 - front;
        const onLevel = Math.abs(feetOf(e, s) - y) <= 20 && box.y1 > y - 32 && box.y0 < y;
        if (k !== 'trompo' || !isStunned(s)) {
          if (onLevel && near >= -6 && near <= 26 && p.facing === 1) claw = true;
        } else if (grounded && Math.abs(feetOf(e, s) - y) < 1 && near >= 0 && near <= 18) hop = true;
      });
      if (!chain && grounded && y === ROOF && x >= 1004 && x < 1030) chain = true;
      if (chain) {
        if (grounded && x > 1240) chain = false;
        else held = true;
      }
      for (const c of CROSSINGS) {
        if (x < c.from || x >= c.to) continue;
        const strung = run.rollos[c.rollo]!.steps !== null;
        const line = lv.rollos![c.rollo]!;
        if ((grounded && Math.abs(y - line.y) < 1e-6) || (strung && y <= line.y)) break;
        if (y > ROOF || !grounded) move = towards(p, c.aim);
        held = true;
        const b = bundleBox(line);
        if (!strung && p.vy < 0 && y > b.y0 + 20 && y < b.y1 + 44 && front + 26 > b.x0 && front < b.x0 && p.facing === 1) claw = true;
        break;
      }
      lv.enemies.forEach((e, i) => {
        const s = run.enemies[i]!;
        if (kindOf(e) !== 'paloma' || !s.alive || held !== null || !grounded || y !== ROOF || x < 2280 || x > 2360) return;
        const reach = enemyBox(e, s).x0 - front <= 26;
        const coming = (s.wing!.phase === 'walk' && s.dir < 0 && s.x < 2390) || s.wing!.phase === 'telegraph';
        move = reach ? 0 : coming ? (x < 2350 ? 1 : 0) : x > 2304 ? -1 : 0;
      });
    }
    if (run.phase === 'playing' && grounded && hold === 0 && held === null && move === 1) {
      const feetRow = Math.floor((y - 1) / TILE);
      for (let d = 0; d <= 14; d++) if (w.solidTile(Math.floor((front + d) / TILE), feetRow) && y - feetRow * TILE > 4) jump = true;
      for (let d = 0; d <= 10; d++) {
        const col = Math.floor((front + d) / TILE);
        let empty = 0;
        while (feetRow + 1 + empty < w.height && !w.solidTile(col, feetRow + 1 + empty)) empty++;
        if (empty >= 3) jump = true;
      }
      lv.pinatas.forEach((pt, i) => {
        if (!run.pinatasOpen[i] && (pt.row + 4) * TILE === y && pt.col * TILE - x >= -12 && pt.col * TILE - x <= -2) jump = true;
      });
      if (jump) {
        lv.enemies.forEach((e, i) => {
          const s = run.enemies[i]!;
          const k = kindOf(e);
          if (!s.alive || (k === 'trompo' && isStunned(s)) || k === 'paloma' || k === 'chapulin') return;
          const feet = feetOf(e, s);
          if (feet >= y - 8 && feet <= y + 16 && s.x > x && (s.x < x + 90 || (s.dir < 0 && s.x < x + 160))) {
            jump = false;
            move = 0;
          }
        });
      }
    }
    if (jump && hold === 0 && !jumpBefore && grounded) hold = 20;
    else if (hop && hold === 0 && !jumpBefore && grounded) hold = 4;
    // L-048: standing with jump still held, it lets go for a step before the next press.
    const input: PlayerInput = { move, jumpHeld: (held ?? hold > 0) && !(grounded && jumpBefore && hold < 19), claw: claw && !clawBefore };
    jumpBefore = input.jumpHeld;
    clawBefore = input.claw === true;
    if (hold > 0) hold--;
    const before = run.lives.lives;
    run = stepRun(run, input, lv);
    if (run.lives.lives < before) lost.push({ step: steps, x: run.player.x, y: run.player.y });
    states.push(run);
    steps++;
  }
  return { run, steps, lost, states };
}

const played = bot(level, 3000);

describe('GDD-WLD-14 level 2-3 layout', () => {
  it('GDD-WLD-14 2-3 is 180 by 17 tiles and passes the validator with World 2 rules', () => {
    expect([world.width, world.height]).toEqual([180, 17]);
    expect(validateLevel(entry)).toEqual([]);
    expect(level.abilities).toBeUndefined();
    expect(level.spawn).toEqual({ x: mid(3), y: ROOF });
    expect(level.exit).toEqual({ x: mid(176), y: HIGH });
    expect(world.solidTile(176, 8)).toBe(true);
    expect(world.solidTile(176, 7)).toBe(false);
  });

  it('GDD-WLD-03 2-3 ofrendas stand on the roof at columns 45, 99 and 153, about 25, 55 and 85 percent', () => {
    expect(level.ofrendas.map((o) => [o.id, o.x, o.y])).toEqual([
      ['2-3-1', mid(45), ROOF],
      ['2-3-2', mid(99), ROOF],
      ['2-3-3', mid(153), ROOF],
    ]);
    [0.25, 0.55, 0.85].forEach((share, i) => expect(Math.abs(level.ofrendas[i]!.x / 2880 - share)).toBeLessThan(0.01));
  });

  it('GDD-WLD-14 2-3 has the roofs, walls, chimneys and high roofs of its plan, and its pits', () => {
    const expected = new Set<string>();
    const add = (c0: number, c1: number, r0: number) => {
      for (let c = c0; c <= c1; c++) for (let r = r0; r < 14; r++) expected.add(`${c},${r}`);
    };
    add(29, 29, 12); // the Trompo pen's walls, 2 tiles
    add(36, 36, 12);
    add(57, 57, 12); // the wall between the two Trompos
    add(68, 68, 10); // the chimneys, 4 tiles above the roof (top y = 160)
    add(73, 73, 10);
    add(83, 83, 12); // the wall before the second piñata
    add(113, 118, 8); // the high roof F1 (top y = 128)
    add(169, 179, 8); // the exit roof (top y = 128)
    const found = new Set<string>();
    for (let c = 0; c < world.width; c++) for (let r = 0; r < 14; r++) if (world.solidTile(c, r)) found.add(`${c},${r}`);
    expect(found).toEqual(expected);
    const pits = [[20, 22], [49, 51], [64, 67], [69, 72], [74, 77], [90, 93], [105, 112], [119, 122], [134, 137], [147, 150], [163, 168]];
    for (let c = 0; c < world.width; c++) {
      const pit = pits.some(([a, b]) => c >= a! && c <= b!);
      for (let r = 14; r < 17; r++) expect(world.solidTile(c, r), `${c},${r}`).toBe(!pit);
    }
  });

  it('GDD-WLD-03 GDD-WLD-10 2-3 gaps: the alley and the exam pit are wide, covered by their rollos up to 4 open tiles; torn awnings cover nothing', () => {
    expect(gaps(world).map((g) => [g.col, g.width])).toEqual([[20, 3], [49, 3], [64, 4], [69, 4], [74, 4], [90, 4], [105, 8], [119, 4], [134, 4], [147, 4], [163, 6]]);
    expect(openGaps(level).map((g) => [g.col, g.width])).toEqual([[20, 3], [49, 3], [64, 4], [69, 4], [74, 4], [109, 4], [119, 4], [166, 3]]);
    expect(Math.max(...openGaps(level).map((g) => g.width))).toBe(4);
    // Made whole, the chain's torn awnings would cover some of its pits' columns: torn, they cover none (GDD-WLD-03).
    const whole: Level = { ...level, awnings: AWNINGS_2_3.map((a) => ({ x: a.x, y: a.y, w: a.w })) };
    expect(openGaps(whole).filter((g) => g.col >= 64 && g.col <= 77).map((g) => [g.col, g.width])).toEqual([[64, 1], [66, 2], [69, 4], [74, 2]]);
  });

  it('GDD-WLD-10 GDD-WLD-11 2-3 awnings, cordel, rollos and piñatas', () => {
    expect(AWNINGS_2_3.map((a) => [a.x / TILE, a.w / TILE, a.y, a.torn === true])).toEqual([
      [6, 3, 192, false],
      [11, 3, 192, true],
      [65, 3, 208, true],
      [70, 3, 208, true],
      [75, 3, 208, true],
      [109, 3, 256, false],
      [119, 2, 208, false],
      [134, 4, 208, false],
      [166, 2, 240, true],
    ]);
    expect(CORDELES_2_3).toEqual([{ x: 147 * TILE, y: 208, w: 4 * TILE }]);
    expect(ROLLOS_2_3.map((r) => [r.x / TILE, r.w / TILE, r.y, r.post])).toEqual([
      [90, 4, 224, 'right'],
      [105, 8, 176, 'right'],
      [163, 6, 176, 'right'],
    ]);
    expect(level.pinatas).toEqual([
      { col: 38, row: 10 },
      { col: 85, row: 10 },
    ]);
    expect(level.veladora).toEqual({ col: 109, row: 6 });
    expect([level.spikes, level.crumbles, level.springs, level.platforms, level.tacos, level.doors, level.keys, level.fragiles]).toEqual([[], [], [], [], [], [], [], []]);
  });

  it('GDD-WLD-10 2-3 each awning is 2 to 6 tiles, its top a multiple of 8 and no higher than y = 160, at least a tile from any level tile at its height', () => {
    for (const a of AWNINGS_2_3) {
      expect(a.w / TILE).toBeGreaterThanOrEqual(2);
      expect(a.w / TILE).toBeLessThanOrEqual(6);
      expect(a.y % 8).toBe(0);
      expect(a.y).toBeGreaterThanOrEqual(AWNING.minTopY);
      const row = a.y / TILE;
      for (let c = a.x / TILE - 1; c <= (a.x + a.w) / TILE; c++) {
        const top = Number.isInteger(row) && world.solidTile(c, row) && !world.solidTile(c, row - 1);
        expect(top, `awning at ${a.x}: column ${c}`).toBe(false);
      }
    }
  });

  it('GDD-WLD-11 2-3 each rollo lies after the ofrenda Poncho respawns at before its pit, and its line has clear air of 2 tiles or more over any awning', () => {
    ROLLOS_2_3.forEach((r) => {
      const before = level.ofrendas.filter((o) => o.x < r.x);
      expect(before.length, `rollo at ${r.x}`).toBeGreaterThan(0);
      expect(level.ofrendas.some((o) => o.x > r.x && o.x < r.x + r.w)).toBe(false);
      for (const a of AWNINGS_2_3) if (a.x < r.x + r.w && a.x + a.w > r.x) expect(a.y - (r.y + 2), `rollo at ${r.x}`).toBeGreaterThanOrEqual(2 * TILE);
    });
  });

  it('GDD-ENM-03 2-3 enemies: an Alacrán, four Trompos, a Tlacuache, a Chapulín and a Paloma', () => {
    expect(ENEMIES_2_3.map((e) => [kindOf(e), e.x, e.y])).toEqual([
      ['alacran', mid(26), ROOF],
      ['trompo', mid(32), ROOF],
      ['trompo', mid(55), ROOF],
      ['trompo', mid(61), ROOF],
      ['tlacuache', mid(116), HIGH],
      ['trompo', mid(128), ROOF],
      ['chapulin', mid(142), ROOF],
      ['paloma', mid(148), 208],
    ]);
  });
});

/**
 * Each enemy alone, Poncho idle at the start, for 4000 steps: its least and greatest x and feet, whether it stayed alive and left every
 * awning whole, and the first step on which its box was in an awning's cloth or the space under it, down to the level's bottom (-1: none).
 */
interface Stretch {
  readonly range: number[];
  readonly alive: boolean;
  readonly torn: boolean;
  readonly under: number;
}
function walkAlone(e: Enemy): Stretch {
  const lv: Level = { ...level, enemies: [e] };
  let r = startRun(lv);
  let [lo, hi, low, high] = [Infinity, -Infinity, Infinity, -Infinity];
  let alive = true;
  let under = -1;
  for (let i = 0; i < 4000; i++) {
    r = stepRun(r, idle, lv);
    const s = r.enemies[0]!;
    alive &&= s.alive;
    lo = Math.min(lo, s.x);
    hi = Math.max(hi, s.x);
    low = Math.min(low, feetOf(e, s));
    high = Math.max(high, feetOf(e, s));
    const box = enemyBox(e, s);
    if (under < 0 && AWNINGS_2_3.some((a) => box.x0 < a.x + a.w && box.x1 > a.x && box.y1 > a.y)) under = i + 1;
  }
  return { range: [lo, hi, low, high].map((v) => Math.round(v * 10) / 10), alive, torn: r.awningsGone.some(Boolean), under };
}
const alone = new Map<Enemy, Stretch>(ENEMIES_2_3.map((e) => [e, walkAlone(e)]));
const stretch = (e: Enemy): number[] => {
  const w = alone.get(e)!;
  expect([w.alive, w.torn]).toEqual([true, false]);
  return w.range;
};

describe('GDD-ENM-03 2-3 the enemies keep to their stretches', () => {
  it('GDD-ENM-03 2-3 each walker keeps to its roof and the Paloma to its cordel', () => {
    expect(ENEMIES_2_3.filter((e) => kindOf(e) !== 'chapulin').map(stretch)).toEqual([
      [375, 457, 224, 224],
      [487, 569, 224, 224],
      [839.7, 905, 224, 224],
      [935, 1016.7, 224, 224],
      [1816, 1896, 128, 128],
      [1975.5, 2136.5, 224, 224],
      [2359, 2409, 208, 208],
    ]);
  });

  it('GDD-WLD-10 2-3 no walker or the Paloma walks through or under an awning while Poncho is away', () => {
    expect(ENEMIES_2_3.filter((e) => kindOf(e) !== 'chapulin').map((e) => alone.get(e)!.under)).toEqual([-1, -1, -1, -1, -1, -1, -1]);
  });

  it('GDD-ENM-03 2-3 the Chapulín hops over the roofs M and K1 and is thrown high by A4 between them, and never falls or tears an awning', () => {
    expect(stretch(ENEMIES_2_3.find((e) => kindOf(e) === 'chapulin')!)).toEqual([1975, 2355, 130.9, 224]);
  });
});

describe('GDD-WLD-14 2-3 the torn awning (the Ki)', () => {
  it('GDD-WLD-10 2-3 a plain landing on T1 rebounds once at 180 px/s, tears it, and he falls back on the safe roof', () => {
    // A jump from the roof, let go at once, steered onto T1's middle.
    const states = play(quiet, { ...startRun(quiet), player: standing(150, ROOF) }, 120, (r, i) => ({ move: towards(r.player, 200), jumpHeld: i < 12 }));
    expect(rebounds(states)).toEqual([-180]);
    const tore = states.findIndex((s) => s.awningsGone[T1]);
    expect(states[tore]!.awningBounce!.awning).toBe(T1);
    expect(states.at(-1)!.player).toMatchObject({ grounded: true, y: ROOF });
    expect(states.every((s) => s.phase === 'playing' && s.lives.lives === 7)).toBe(true);
  });

  it('GDD-WLD-10 2-3 held, T1 gives one tier 1 rebound: it takes the lowest hilo of its column and not the next', () => {
    const states = play(quiet, { ...startRun(quiet), player: standing(150, ROOF) }, 150, (r) => ({ move: towards(r.player, 200), jumpHeld: true }));
    expect(rebounds(states)).toEqual([-480]);
    const taken = (col: number, row: number) => states.at(-1)!.hilosTaken[level.hilos!.findIndex((h) => h.col === col && h.row === row)];
    expect([taken(12, 6), taken(12, 4), taken(12, 3)]).toEqual([true, false, false]);
  });

  it('GDD-WLD-10 2-3 the chain carries: two rebounds on W1, then T1 gives tier 3 and the whole column; W1 takes its own column', () => {
    let target = 136;
    const states = play(quiet, { ...startRun(quiet), player: standing(80, ROOF) }, 300, (r) => {
      if ((r.player.awningChain ?? 0) >= 2 && r.player.y < 100) target = 200;
      return { move: towards(r.player, target), jumpHeld: true };
    });
    expect(rebounds(states).slice(0, 3)).toEqual([-480, -540, -600]);
    expect(states.find((s) => s.awningBounce?.tier === 3)!.awningBounce!.awning).toBe(T1);
    const r = states.at(-1)!;
    for (const [col, row] of [[8, 10], [8, 6], [8, 4], [12, 6], [12, 4], [12, 3]] as const) expect(r.hilosTaken[level.hilos!.findIndex((h) => h.col === col && h.row === row)], `${col},${row}`).toBe(true);
    expect(r.awningsGone[T1]).toBe(true);
  });
});

/** Standing on the roof 39 px before the chain's edge; the chain tests hold jump from their 10th step. */
const edge = (): RunState => ({ ...startRun(quiet), player: standing(985, ROOF) });

describe('GDD-WLD-14 2-3 the torn chain over the chimneys (the Shō)', () => {
  it('GDD-WLD-10 2-3 holding jump and right from the roof edge rebounds on T2, T3 and T4 at tiers 1, 2, 3, tears each, and lands on the roof', () => {
    const states = play(quiet, edge(), 240, (_r, i) => ({ move: 1, jumpHeld: i >= 10 }));
    expect(rebounds(states)).toEqual([-480, -540, -600]);
    const bounced = states.flatMap((s, i) => (i > 0 && s.awningBounce !== states[i - 1]!.awningBounce ? [s.awningBounce!.awning] : []));
    expect(bounced).toEqual([T2, T3, T4]);
    const r = states.at(-1)!;
    expect([r.awningsGone[T2], r.awningsGone[T3], r.awningsGone[T4]]).toEqual([true, true, true]);
    expect(r.player).toMatchObject({ grounded: true, y: ROOF });
    expect(r.player.x).toBeGreaterThan(78 * TILE);
    expect(states.every((s) => s.lives.lives === 7)).toBe(true);
    for (const [col, row] of [[67, 9], [68, 7], [71, 9], [73, 5], [76, 10], [79, 4]] as const) expect(r.hilosTaken[level.hilos!.findIndex((h) => h.col === col && h.row === row)], `${col},${row}`).toBe(true);
  });

  for (const after of [1, 2]) {
    it(`GDD-WLD-10 2-3 letting go after rebound ${after} of the chain cuts the rise: he does not clear the next chimney and falls into the pit`, () => {
      let seen = 0;
      const states = play(quiet, edge(), 240, (r, i) => {
        if (r.awningBounce && r.awningBounce.tier >= after) seen = after;
        return { move: 1, jumpHeld: i >= 10 && seen < after };
      });
      expect(states.at(-1)!.lives.lives).toBe(6);
    });
  }

  it('GDD-WLD-10 2-3 without the torn awnings a running jump from the edge meets the first chimney and falls', () => {
    const bare: Level = { ...quiet, awnings: [] };
    const states = play(bare, { ...startRun(bare), player: standing(960, ROOF) }, 120, (_r, i) => ({ move: 1, jumpHeld: i >= 30 && i < 50 }));
    expect(states.at(-1)!.lives.lives).toBe(6);
  });
});

describe('GDD-WLD-14 2-3 the rollo on the far post (the Ten)', () => {
  it('GDD-WLD-11 2-3 without R1, no rebound on A2 reaches the high roof F1: its tier 3 peak is 8 px short', () => {
    const bare: Level = { ...quiet, rollos: [] };
    const peaks: number[] = [];
    for (let target = 1746; target <= 1790; target += 4) {
      let r: RunState = { ...startRun(bare), player: { ...standing(1760, 256), x: target } };
      let peak = Infinity;
      for (let i = 0; i < 400; i++) {
        // Steered to `target` for two tiers, then pressing right, into the wall, on the third.
        r = stepRun(r, { move: (r.player.awningChain ?? 0) >= 3 ? 1 : towards(r.player, target), jumpHeld: i > 0 }, bare);
        peak = Math.min(peak, r.player.y);
        expect(r.player.grounded && r.player.x > 113 * TILE - 6, `target ${target}, step ${i}`).toBe(false);
      }
      peaks.push(peak);
    }
    expect(Math.round(Math.min(...peaks) * 10) / 10).toBe(135.8);
  });

  it('GDD-WLD-11 2-3 no claw from the near roof reaches R1 bundle, nor a fireball spat there', () => {
    const b = bundleBox(ROLLOS_2_3[R1]!);
    expect(b.x0 - (104 * TILE + 16 + 6)).toBeGreaterThan(20 + 6); // the claw reaches 20 px past his front, which is at most 6 px past the roof's edge
    let r: RunState = { ...startRun(quiet), power: 'fuego', player: standing(1684, ROOF) };
    for (let i = 0; i < 120; i++) r = stepRun(r, { move: 0, jumpHeld: false, fuego: i % 20 === 0 }, quiet);
    expect(r.rollos[R1]!.steps).toBeNull();
  });

  it('GDD-WLD-11 2-3 a claw from a rebound on A2 unrolls R1 towards him, and the next rebound lands him on it; from it a jump reaches F1', () => {
    const states = played.states;
    const unrolled = states.findIndex((s) => s.rollos[R1]!.steps !== null);
    expect(unrolled).toBeGreaterThan(0);
    const at = states[unrolled]!.player;
    expect(at.x).toBeGreaterThan(AWNINGS_2_3[A2]!.x);
    expect(at.y).toBeGreaterThan(ROLLOS_2_3[R1]!.y);
    expect(states.some((s) => s.player.grounded && s.player.y === ROLLOS_2_3[R1]!.y && s.player.x > 105 * TILE && s.player.x < 113 * TILE)).toBe(true);
    expect(states.some((s) => s.player.grounded && s.player.y === HIGH && s.player.x > 113 * TILE && s.player.x < 119 * TILE)).toBe(true);
  });

  it('GDD-LIFE-03 2-3 the veladora over A2 is reached by a tier 3 rebound and not by tier 2', () => {
    for (const tiers of [2, 3]) {
      let r: RunState = { ...startRun(quiet), lives: loseLife(startWorld()), player: { ...standing(1752, 256) } };
      for (let i = 0; i < 300; i++) {
        const chain = r.player.awningChain ?? 0;
        r = stepRun(r, { move: towards(r.player, 1752), jumpHeld: i > 0 && (chain < tiers || (chain === tiers && r.player.vy < 0)) }, quiet);
      }
      expect(veladoraUsed(r.lives, level.veladora!), `${tiers} tiers`).toBe(tiers === 3);
    }
  });

  it('GDD-WLD-11 GDD-PWR-03 2-3 in Fuego a fireball spat 2 to 3 tiles back from the Fuego pit, or at its edge, unrolls R2; walking it takes its two hilos', () => {
    const line = ROLLOS_2_3[R2]!;
    const unrolls = (x: number): boolean => {
      let s: RunState = { ...startRun(quiet), power: 'fuego', player: standing(x, ROOF) };
      s = stepRun(s, idle, quiet);
      s = stepRun(s, { ...idle, fuego: true }, quiet);
      for (let i = 0; i < 120; i++) s = stepRun(s, idle, quiet);
      return s.rollos[R2]!.steps !== null;
    };
    const from: number[] = [];
    for (let x = line.x - 80; x <= line.x + 5; x++) if (unrolls(x)) from.push(x);
    expect([from[0], from.at(-2), from.at(-1), from.length]).toEqual([1388, 1408, 1445, 22]);
    let r: RunState = { ...startRun(quiet), power: 'fuego', player: standing(1400, ROOF) };
    r = stepRun(r, idle, quiet);
    r = stepRun(r, { ...idle, fuego: true }, quiet);
    let k = 0;
    while (r.rollos[R2]!.steps === null && k++ < 60) r = stepRun(r, idle, quiet);
    expect(k).toBeLessThan(60);
    for (let i = 0; i < 90; i++) {
      r = stepRun(r, { move: 1, jumpHeld: false }, quiet);
      expect(r.player.y).toBe(ROOF);
    }
    expect(rolloLength(line, r.rollos[R2]!)).toBe(line.w);
    expect(r.player.x).toBeGreaterThan(line.x + line.w);
    for (const [col, row] of [[91, 13], [92, 13]] as const) expect(r.hilosTaken[level.hilos!.findIndex((h) => h.col === col && h.row === row)]).toBe(true);
  });

  it('GDD-WLD-11 2-3 R2 bundle is out of the claw from either edge, and a running jump across the Fuego pit misses its two hilos', () => {
    const line = ROLLOS_2_3[R2]!;
    for (const [x, facing] of [[line.x + 5.9, 1], [line.x + line.w + 6, -1]] as const) {
      let r: RunState = { ...startRun(quiet), player: { ...standing(x, ROOF), facing } };
      r = stepRun(r, { move: 0, jumpHeld: false }, quiet);
      r = stepRun(r, { move: 0, jumpHeld: false, claw: true }, quiet);
      for (let i = 0; i < 10; i++) r = stepRun(r, idle, quiet);
      expect(r.rollos[R2]!.steps, `x ${x}`).toBeNull();
    }
    const i91 = level.hilos!.findIndex((h) => h.col === 91);
    const i92 = level.hilos!.findIndex((h) => h.col === 92);
    expect([played.run.hilosTaken[i91], played.run.hilosTaken[i92]]).toEqual([false, false]);
  });
});

describe('GDD-WLD-14 2-3 the exam (the Ketsu)', () => {
  it('GDD-WLD-11 2-3 without R4, T5 one bounce never reaches the exit roof, wherever it is steered', () => {
    const bare: Level = { ...quiet, rollos: [] };
    for (let target = 2660; target <= 2700; target += 4) {
      const states = play(bare, { ...startRun(bare), player: standing(2560, ROOF) }, 200, (r, i) => ({ move: r.player.x < 2600 || r.awningsGone[T5] ? 1 : towards(r.player, target), jumpHeld: i > 0 && r.player.x > 2594 }));
      expect(states.some((s) => s.player.grounded && s.player.x > 169 * TILE - 6), `target ${target}`).toBe(false);
      expect(states.at(-1)!.lives.lives, `target ${target}`).toBe(6);
    }
  });

  it('GDD-WLD-11 2-3 pressed against the exit roof wall, the claw misses R4 bundle (its box starts at the wall); 18 px back it unrolls it', () => {
    const b = bundleBox(ROLLOS_2_3[R4]!);
    for (const [x, unrolls] of [[b.x1 - 6, false], [b.x1 - 24, true]] as const) {
      let r: RunState = { ...startRun(quiet), player: { ...standing(x, 210), grounded: false, vy: -300 } };
      r = stepRun(r, { move: 0, jumpHeld: true, claw: true }, quiet);
      for (let i = 0; i < 6; i++) r = stepRun(r, { move: 0, jumpHeld: true }, quiet);
      expect(r.rollos[R4]!.steps !== null, `x ${x}`).toBe(unrolls);
    }
  });

  it('GDD-WLD-14 2-3 the exam: T5 tears under one rebound, the claw on the way up unrolls R4, he lands on it and jumps to the exit roof', () => {
    const states = played.states;
    const torn = states.findIndex((s) => s.awningsGone[T5]);
    const unrolled = states.findIndex((s) => s.rollos[R4]!.steps !== null);
    expect(torn).toBeGreaterThan(0);
    expect(unrolled).toBeGreaterThan(torn);
    expect(states.some((s) => s.player.grounded && s.player.y === ROLLOS_2_3[R4]!.y)).toBe(true);
  });
});

describe('GDD-PWR-05 2-3 the piñatas (L-047)', () => {
  for (const [p, wall] of [[0, 36], [1, 83]] as const) {
    const pt = level.pinatas[p]!;
    it(`GDD-PWR-05 2-3 piñata ${p + 1}: in Base a jump from under it opens it, and holding right once the taco has dropped catches it`, () => {
      let r: RunState = { ...startRun(quiet), player: standing(mid(pt.col), ROOF) };
      let dropped = -1;
      for (let i = 0; i < 100 && r.power === 'base'; i++) {
        r = stepRun(r, { move: dropped >= 0 ? 1 : 0, jumpHeld: i < 10 }, quiet);
        if (dropped < 0 && r.items[0]?.y === ROOF) dropped = i;
      }
      expect(r.pinatasOpen[p]).toBe(true);
      expect(r.power).toBe('taco');
    });
    it(`GDD-PWR-05 2-3 piñata ${p + 1}: in Taco a claw from the right end of the wall at ${wall} opens it, and a hop onto it takes the chile`, () => {
      let r: RunState = { ...startRun(quiet), power: 'taco', player: standing(wall * TILE + 20, 192) };
      r = stepRun(r, idle, quiet);
      r = stepRun(r, { ...idle, claw: true }, quiet);
      for (let i = 0; i < 10; i++) r = stepRun(r, idle, quiet);
      expect(r.pinatasOpen[p]).toBe(true);
      expect(r.items.map((item) => [item.kind, item.x, item.y])).toEqual([['chile', mid(pt.col), pt.row * TILE]]);
      for (let i = 0; i < 40; i++) r = stepRun(r, { move: i < 8 ? 1 : 0, jumpHeld: i < 30 }, quiet);
      expect(r.power).toBe('fuego');
    });
  }
});

describe('GDD-ENM-03 2-3 the Trompo', () => {
  it('GDD-CMB-02 GDD-CMB-01 2-3 in its pen a claw topples the Trompo and a hop onto it then defeats it', () => {
    const lv: Level = { ...level, enemies: [ENEMIES_2_3[1]!] };
    let r: RunState = { ...startRun(lv), player: standing(500, ROOF) };
    let clawed = -1;
    let hopped = -1;
    let before = false;
    for (let i = 0; i < 300 && r.enemies[0]!.alive; i++) {
      const s = r.enemies[0]!;
      const near = enemyBox(ENEMIES_2_3[1]!, s).x0 - (r.player.x + 6);
      const claw: boolean = !isStunned(s) && near >= -6 && near <= 26 && !before;
      if (claw) clawed = i;
      before = claw;
      const hop = isStunned(s) && near <= 12;
      if (hop && hopped < 0) hopped = i;
      r = stepRun(r, { move: hopped >= 0 && i < hopped + 12 ? 1 : 0, jumpHeld: hopped >= 0 && i < hopped + 4, claw }, lv);
      expect(r.lives.lives).toBe(7);
    }
    expect(clawed).toBeGreaterThan(0);
    expect(r.enemies[0]!.alive).toBe(false);
  });
});

describe('GDD-WLD-04 2-3 hilos', () => {
  it('GDD-WLD-04 2-3 has 50 hilos, each in an empty tile outside every awning, none touched standing at the start or an ofrenda', () => {
    const hilos = level.hilos!;
    expect(hilos).toHaveLength(50);
    expect(new Set(hilos.map((h) => `${h.col},${h.row}`)).size).toBe(50);
    for (const h of hilos) {
      expect(world.solidTile(h.col, h.row), `${h.col},${h.row}`).toBe(false);
      for (const a of AWNINGS_2_3) expect(h.col * TILE >= a.x && h.col * TILE < a.x + a.w && h.row === Math.floor(a.y / TILE), `${h.col},${h.row}`).toBe(false);
      for (const at of [level.spawn, ...level.ofrendas]) expect(touchesHilo(spawn(at.x, at.y), h)).toBe(false);
    }
  });

  it('GDD-WLD-04 2-3 the playthrough takes 42 hilos: all but the Ki two columns (the ladder and the chain take them) and the Fuego pair', () => {
    const missed = level.hilos!.filter((_, i) => !played.run.hilosTaken[i]).map((h) => `${h.col},${h.row}`);
    expect(missed).toEqual(['8,10', '8,6', '8,4', '12,6', '12,4', '12,3', '91,13', '92,13']);
  });
});

describe('GDD-WLD-14 playing 2-3', () => {
  it('GDD-WLD-14 2-3 the bot plays from the start through every ofrenda to the exit with all seven lives, in under 2000 steps', () => {
    const { run, steps, lost } = played;
    expect(run.phase).toBe('clear');
    expect(lost).toEqual([]);
    expect(steps).toBeLessThan(2000);
    expect(run.lives.lives).toBe(7);
    expect(run.checkpointIndex).toBe(2);
    expect(touchesExit(run.player, level.exit!)).toBe(true);
    expect([T2, T3, T4, T5].map((i) => run.awningsGone[i])).toEqual([true, true, true, true]);
    expect([R1, R4].map((i) => rolloLength(ROLLOS_2_3[i]!, run.rollos[i]!))).toEqual([ROLLOS_2_3[R1]!.w, ROLLOS_2_3[R4]!.w]);
  });

  it('GDD-WLD-14 2-3 the bot also clears it losing no life after waiting 60, 120, 180 or 240 steps at the start', () => {
    for (const wait of [60, 120, 180, 240]) {
      const { run, lost } = bot(level, 3000, wait);
      expect(run.phase, `wait ${wait}`).toBe('clear');
      expect(lost, `wait ${wait}`).toEqual([]);
    }
  });
});
