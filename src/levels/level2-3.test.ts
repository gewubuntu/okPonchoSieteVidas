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
const WA = 5;
const TB = 6;
const WC = 7;
const TD = 8;
const A2 = 9;
const T5 = 12;
/** The rollos: the Fuego pit's, the alley's and the exam's. */
const R2 = 0;
const R1 = 1;
const R4 = 2;
/** The Trompo on the roof L, past the mixed chain. */
const TROMPO_L = 4;
/** The high roof F1's top and the exit roof's top (row 8). */
const HIGH = 8 * TILE;
/** The mixed chain's tall chimney, column 101: its top read from the level, and its left and right edges. */
const TALL = { top: (() => { let row = 0; while (!world.solidTile(101, row)) row++; return row * TILE; })(), x0: 101 * TILE, x1: 102 * TILE } as const;

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
/** The awnings rebounded on, in order (-1 for a late press in the air). */
const bouncedOn = (states: readonly RunState[]): number[] =>
  states.flatMap((s, i) => (i > 0 && s.awningBounce !== states[i - 1]!.awningBounce && s.awningBounce ? [s.awningBounce.awning] : []));
const taken = (r: RunState, col: number, row: number): boolean => r.hilosTaken[level.hilos!.findIndex((h) => h.col === col && h.row === row)]!;

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
  { from: 2488, to: 2616, aim: 2602, rollo: R1 },
  { from: 3416, to: 3516, aim: 3496, rollo: R4 },
];

/** The bot goes on from Wa once the Trompo on L heads right short of this x: it has turned at the pit's edge. */
const TROMPO_TURNED = 1840;

/**
 * The bot (L-048: it lets go of jump for at least a step before pressing it again). It holds right and:
 * - jumps (held 20 steps) at a wall in the row of its feet within 14 px of its front, when the ground under the back of its body ends at a
 *   drop of three tiles or more (standing on a level tile; never off an awning or a cordel), and under a closed piñata 48 px over its feet;
 *   before such a jump, or a step down off a wall, it waits while an Alacrán, a Tlacuache or a spinning Trompo is where it would come down:
 *   for a jump at a wall at its height within 90 px ahead or 160 px coming its way, for a drop up to 112 px below within 110 or 200 px, for a
 *   step down up to 40 px below within 30 or 160 px;
 * - claws an Alacrán, a Tlacuache, a Paloma, a Chapulín (also in the air, up to 32 px above) or a spinning Trompo on its level whose near
 *   edge is within 26 px of its front, stands still while a spinning Trompo on its level heads away from it within 60 px, and hops (held 4
 *   steps) onto a stunned Trompo within 18 px of its front, which stomps it;
 * - over the torn chain, from the roof's edge (x 1004 to 1030), holds jump and right until it stands anywhere past x = 1240;
 * - in the air, holds jump while it rises from a held rebound and while it falls onto a torn awning within 48 px below;
 * - in the mixed chain: on Wa (landed or on its plain rebound) it hops in place holding jump; once a held rebound has begun it steers onto
 *   Tb's middle (x = 1592) holding jump, then holds right; falling past x = 1632 it lets go and steers onto Wc's middle, where it settles;
 *   standing on Wc it waits until the Trompo on L heads right short of x = 1840, having turned at the pit's edge;
 * - at each far-post rollo, from `from`: holds jump, steers its rebounds to `aim` (never pressing left), claws once while rising with its
 *   claw's reach over the bundle and its feet 20 to 56 px under the line's top, and once it stands on the strung line walks right, where
 *   the wall rule jumps it onto the roof;
 * - on the roof before the cordel's pit it waits at x = 3120, out of the Paloma's sight, until the Paloma walks back towards the roof (or
 *   telegraphs), then walks up to the edge, where the claw rule claws it.
 * It returns the run, the steps it took, the lives lost (step and place) and every state.
 */
function bot(lv: Level, maxSteps: number, wait = 0): { run: RunState; steps: number; lost: { step: number; x: number; y: number }[]; states: RunState[] } {
  let run = startRun(lv);
  for (let i = 0; i < wait; i++) run = stepRun(run, idle, lv);
  const states: RunState[] = [];
  const lost: { step: number; x: number; y: number }[] = [];
  const w = lv.world;
  const wa = lv.awnings![WA]!;
  const wc = lv.awnings![WC]!;
  let hold = 0;
  let jumpBefore = false;
  let clawBefore = false;
  let steps = 0;
  let chain = false;
  let mixed: 'off' | 'hop' | 'go' | 'settle' = 'off';
  while (run.phase !== 'clear' && steps < maxSteps) {
    if (run.phase !== 'playing') {
      chain = false;
      mixed = 'off';
    }
    const p = run.player;
    const { x, y, grounded } = p;
    const front = x + 6;
    let move = 1;
    let claw = false;
    let jump = false;
    let hop = false;
    let held: boolean | null = null;
    if (run.phase === 'playing') {
      let trompoAhead = false;
      lv.enemies.forEach((e, i) => {
        const s = run.enemies[i]!;
        if (!s.alive) return;
        const k = kindOf(e);
        const box = enemyBox(e, s);
        const near = box.x0 - front;
        const onLevel = Math.abs(feetOf(e, s) - y) <= (k === 'chapulin' ? 32 : 20) && box.y1 > y - 32 && box.y0 < y;
        if (k !== 'trompo' || !isStunned(s)) {
          if (onLevel && near >= -6 && near <= 26 && p.facing === 1) claw = true;
          if (k === 'trompo' && grounded && onLevel && s.dir > 0 && near > 0 && near <= 60) trompoAhead = true;
        } else if (grounded && Math.abs(feetOf(e, s) - y) < 1 && near >= 0 && near <= 18) hop = true;
      });
      if (trompoAhead) move = 0;
      if (!chain && grounded && y === ROOF && x >= 1004 && x < 1030) chain = true;
      if (chain) {
        if (grounded && x > 1240) chain = false;
        else held = true;
      }
      if (!grounded && p.vy < 0 && (p.awningChain ?? 0) > 0) held = true;
      if (!grounded && p.vy > 0 && lv.awnings!.some((a, i) => a.torn && !run.awningsGone[i] && x + 6 > a.x && x - 6 < a.x + a.w && a.y >= y && a.y - y < 48)) held = true;
      const onWa = grounded && y === wa.y && x > wa.x - 6 && x < wa.x + wa.w + 6;
      if (mixed === 'off' && (onWa || (run.awningBounce?.awning === WA && run.awningBounce.tier === 0 && p.vy < 0))) mixed = 'hop';
      if (mixed === 'hop' && (p.awningChain ?? 0) >= 1 && !grounded) mixed = 'go';
      if (mixed === 'go' && p.vy > 0 && x > TALL.x1) mixed = 'settle';
      if (mixed === 'settle' && grounded) mixed = 'off';
      if (mixed === 'hop') {
        move = 0;
        held = true;
      } else if (mixed === 'go') {
        move = run.awningBounce?.awning === TB ? 1 : towards(p, 1592);
        held = true;
      } else if (mixed === 'settle') {
        move = towards(p, wc.x + wc.w / 2);
        held = false;
      }
      const t = run.enemies[TROMPO_L]!;
      if (grounded && y === wc.y && x > wc.x && x < wc.x + wc.w + 6 && t.alive && !(t.dir > 0 && t.x < TROMPO_TURNED)) move = 0;
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
        if (kindOf(e) !== 'paloma' || !s.alive || held !== null || !grounded || y !== ROOF || x < 3096 || x > 3176) return;
        const reach = enemyBox(e, s).x0 - front <= 26;
        const coming = (s.wing!.phase === 'walk' && s.dir < 0 && s.x < 3206) || s.wing!.phase === 'telegraph';
        move = reach ? 0 : coming ? (x < 3166 ? 1 : 0) : x > 3120 ? -1 : 0;
      });
    }
    if (run.phase === 'playing' && grounded && hold === 0 && held === null && move === 1) {
      const feetRow = Math.floor((y - 1) / TILE);
      for (let d = 0; d <= 14; d++) if (w.solidTile(Math.floor((front + d) / TILE), feetRow) && y - feetRow * TILE > 4) jump = true;
      const onTile = w.solidTile(Math.floor((x - 6) / TILE), feetRow + 1) || w.solidTile(Math.floor((x + 5.99) / TILE), feetRow + 1);
      let drop = false;
      for (let d = 2; d <= 4; d++) {
        const col = Math.floor((x + d) / TILE);
        let empty = 0;
        while (feetRow + 1 + empty < w.height && !w.solidTile(col, feetRow + 1 + empty)) empty++;
        if (onTile && empty >= 3) drop = true;
      }
      lv.pinatas.forEach((pt, i) => {
        if (!run.pinatasOpen[i] && (pt.row + 4) * TILE === y && pt.col * TILE - x >= -12 && pt.col * TILE - x <= -2) jump = true;
      });
      const stepDown = !w.solidTile(Math.floor((front + 2) / TILE), feetRow + 1);
      // Where it would come down: the lowest feet below its own, the reach ahead, the reach for one coming its way.
      const zone = drop ? [112, 110, 200] : jump ? [16, 90, 160] : stepDown ? [40, 30, 160] : null;
      jump ||= drop;
      if (zone) {
        lv.enemies.forEach((e, i) => {
          const s = run.enemies[i]!;
          const k = kindOf(e);
          if (!s.alive || (k === 'trompo' && isStunned(s)) || k === 'paloma' || k === 'chapulin') return;
          const feet = feetOf(e, s);
          if (feet >= y - 8 && feet <= y + zone[0]! && s.x > x && (s.x < x + zone[1]! || (s.dir < 0 && s.x < x + zone[2]!))) {
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

const played = bot(level, 4000);

describe('GDD-WLD-14 level 2-3 layout', () => {
  it('GDD-WLD-14 2-3 is 240 by 17 tiles and passes the validator with World 2 rules', () => {
    expect([world.width, world.height]).toEqual([240, 17]);
    expect(validateLevel(entry)).toEqual([]);
    expect(level.abilities).toBeUndefined();
    expect(level.spawn).toEqual({ x: mid(3), y: ROOF });
    expect(level.exit).toEqual({ x: mid(227), y: HIGH });
    expect(world.solidTile(227, 8)).toBe(true);
    expect(world.solidTile(227, 7)).toBe(false);
  });

  it('GDD-WLD-03 2-3 ofrendas stand on the roof at columns 60, 132 and 204, about 25, 55 and 85 percent', () => {
    expect(level.ofrendas.map((o) => [o.id, o.x, o.y])).toEqual([
      ['2-3-1', mid(60), ROOF],
      ['2-3-2', mid(132), ROOF],
      ['2-3-3', mid(204), ROOF],
    ]);
    [0.25, 0.55, 0.85].forEach((share, i) => expect(Math.abs(level.ofrendas[i]!.x / 3840 - share)).toBeLessThan(0.01));
  });

  it('GDD-WLD-14 2-3 has the roofs, walls, chimneys and high roofs of its plan, and its pits', () => {
    const expected = new Set<string>();
    const add = (c0: number, c1: number, r0: number) => {
      for (let c = c0; c <= c1; c++) for (let r = r0; r < 14; r++) expected.add(`${c},${r}`);
    };
    add(29, 29, 12); // the Trompo pen's walls, 2 tiles
    add(36, 36, 12);
    add(52, 52, 12); // the walls that pen the two Trompos
    add(58, 58, 12);
    add(68, 68, 10); // the torn chain's chimneys, 4 tiles above the roof (top y = 160)
    add(73, 73, 10);
    add(83, 83, 12); // the wall before the second piñata
    add(101, 101, 8); // the mixed chain's tall chimney, 6 tiles (top y = 128)
    add(106, 106, 10); // and its chimney, 4 tiles
    add(121, 126, 12); // the step R that pens the Trompo on L
    add(164, 169, 8); // the high roof F1 (top y = 128)
    add(220, 239, 8); // the exit roof (top y = 128)
    const found = new Set<string>();
    for (let c = 0; c < world.width; c++) for (let r = 0; r < 14; r++) if (world.solidTile(c, r)) found.add(`${c},${r}`);
    expect(found).toEqual(expected);
    const pits = [[20, 22], [44, 46], [64, 67], [69, 72], [74, 77], [92, 100], [102, 105], [107, 110], [140, 143], [156, 163], [170, 173], [185, 188], [198, 201], [214, 219]];
    for (let c = 0; c < world.width; c++) {
      const pit = pits.some(([a, b]) => c >= a! && c <= b!);
      for (let r = 14; r < 17; r++) expect(world.solidTile(c, r), `${c},${r}`).toBe(!pit);
    }
  });

  it('GDD-WLD-03 GDD-WLD-10 2-3 gaps: the reading pit, the alley and the exam pit are wide, covered up to 4 open tiles; torn awnings cover nothing', () => {
    expect(gaps(world).map((g) => [g.col, g.width])).toEqual([
      [20, 3], [44, 3], [64, 4], [69, 4], [74, 4], [92, 9], [102, 4], [107, 4], [140, 4], [156, 8], [170, 4], [185, 4], [198, 4], [214, 6],
    ]);
    expect(openGaps(level).map((g) => [g.col, g.width])).toEqual([
      [20, 3], [44, 3], [64, 4], [69, 4], [74, 4], [92, 1], [97, 4], [102, 4], [107, 4], [160, 4], [170, 4], [217, 3],
    ]);
    expect(Math.max(...openGaps(level).map((g) => g.width))).toBe(4);
    // Made whole, the torn awnings would cover some of their pits' columns: torn, they cover none (GDD-WLD-03).
    const whole: Level = { ...level, awnings: AWNINGS_2_3.map((a) => ({ x: a.x, y: a.y, w: a.w })) };
    expect(openGaps(whole).filter((g) => g.col >= 64 && g.col <= 110).map((g) => [g.col, g.width])).toEqual([
      [64, 1], [66, 2], [69, 4], [74, 2], [92, 1], [97, 4], [102, 4], [107, 2],
    ]);
  });

  it('GDD-WLD-10 GDD-WLD-11 2-3 awnings, cordel, rollos and piñatas', () => {
    expect(AWNINGS_2_3.map((a) => [a.x / TILE, a.w / TILE, a.y, a.torn === true])).toEqual([
      [6, 3, 192, false],
      [11, 3, 192, true],
      [65, 3, 208, true],
      [70, 3, 208, true],
      [75, 3, 208, true],
      [93, 4, 208, false],
      [98, 3, 208, true],
      [103, 3, 208, false],
      [108, 3, 208, true],
      [160, 3, 256, false],
      [170, 2, 208, false],
      [185, 4, 208, false],
      [217, 2, 240, true],
    ]);
    expect(CORDELES_2_3).toEqual([{ x: 198 * TILE, y: 208, w: 4 * TILE }]);
    expect(ROLLOS_2_3.map((r) => [r.x / TILE, r.w / TILE, r.y, r.post])).toEqual([
      [140, 4, 224, 'right'],
      [156, 8, 176, 'right'],
      [214, 6, 176, 'right'],
    ]);
    expect(level.pinatas).toEqual([
      { col: 38, row: 10 },
      { col: 85, row: 10 },
    ]);
    expect(level.veladora).toEqual({ col: 160, row: 6 });
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

  it('GDD-ENM-03 2-3 enemies: an Alacrán, five Trompos, a Tlacuache, a Chapulín and a Paloma', () => {
    expect(ENEMIES_2_3.map((e) => [kindOf(e), e.x, e.y])).toEqual([
      ['alacran', mid(26), ROOF],
      ['trompo', mid(32), ROOF],
      ['trompo', mid(49), ROOF],
      ['trompo', mid(55), ROOF],
      ['trompo', mid(116), ROOF],
      ['tlacuache', mid(167), HIGH],
      ['trompo', mid(179), ROOF],
      ['chapulin', mid(193), ROOF],
      ['paloma', mid(199), 208],
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
      [759.7, 825, 224, 224],
      [855, 921, 224, 224],
      [1783.2, 1929, 224, 224],
      [2632, 2712, 128, 128],
      [2791.5, 2952.5, 224, 224],
      [3175, 3225, 208, 208],
    ]);
  });

  it('GDD-WLD-10 2-3 no walker or the Paloma walks through or under an awning while Poncho is away', () => {
    expect(ENEMIES_2_3.filter((e) => kindOf(e) !== 'chapulin').map((e) => alone.get(e)!.under)).toEqual([-1, -1, -1, -1, -1, -1, -1, -1]);
  });

  it('GDD-ENM-03 2-3 the Chapulín hops over the roofs M and K1 and is thrown high by A4 between them, and never falls or tears an awning', () => {
    expect(stretch(ENEMIES_2_3.find((e) => kindOf(e) === 'chapulin')!)).toEqual([2791, 3171, 130.9, 224]);
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
    const r = states.at(-1)!;
    expect([taken(r, 12, 6), taken(r, 12, 4), taken(r, 12, 3)]).toEqual([true, false, false]);
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
    for (const [col, row] of [[8, 10], [8, 6], [8, 4], [12, 6], [12, 4], [12, 3]] as const) expect(taken(r, col, row), `${col},${row}`).toBe(true);
    expect(r.awningsGone[T1]).toBe(true);
  });
});

/** Standing on the roof 39 px before the torn chain's edge; the chain tests hold jump from their 10th step. */
const edge = (): RunState => ({ ...startRun(quiet), player: standing(985, ROOF) });

describe('GDD-WLD-14 2-3 the torn chain over the chimneys (the Shō)', () => {
  it('GDD-WLD-10 2-3 holding jump and right from the roof edge rebounds on T2, T3 and T4 at tiers 1, 2, 3, tears each, and lands on the roof', () => {
    const states = play(quiet, edge(), 240, (_r, i) => ({ move: 1, jumpHeld: i >= 10 }));
    expect(rebounds(states)).toEqual([-480, -540, -600]);
    expect(bouncedOn(states)).toEqual([T2, T3, T4]);
    const r = states.at(-1)!;
    expect([r.awningsGone[T2], r.awningsGone[T3], r.awningsGone[T4]]).toEqual([true, true, true]);
    expect(r.player).toMatchObject({ grounded: true, y: ROOF });
    expect(r.player.x).toBeGreaterThan(78 * TILE);
    expect(states.every((s) => s.lives.lives === 7)).toBe(true);
    for (const [col, row] of [[67, 9], [68, 7], [71, 9], [73, 5], [76, 10], [79, 4]] as const) expect(taken(r, col, row), `${col},${row}`).toBe(true);
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

/** Standing on Wa under its hilo column (x = 1528), a jump held for `tiers` held rebounds in place and through the last one's rise. */
const hopsOnWa = (tiers: number): RunState =>
  play(quiet, { ...startRun(quiet), player: standing(1528, 208) }, 200, (r) => {
    const chain = r.player.awningChain ?? 0;
    return { move: 0, jumpHeld: chain < tiers || (chain === tiers && r.player.vy < 0) };
  }).at(-1)!;

/** Standing on the roof 39 px before the mixed chain's edge (column 91's right side, x = 1472). */
const mixedEdge = (): RunState => ({ ...startRun(quiet), player: standing(1433, ROOF) });

describe('GDD-WLD-14 2-3 the mixed chain: stripes to stop on, patches to bounce on (the Shō)', () => {
  it('GDD-WLD-10 2-3 a jump from the edge onto Wa, let go, rebounds once and settles: the whole awning is a place to stop over the pit', () => {
    const states = play(quiet, mixedEdge(), 120, (r, i) => ({ move: towards(r.player, 1512), jumpHeld: i >= 10 && i < 20 }));
    expect(rebounds(states)).toEqual([-180]);
    expect(bouncedOn(states)).toEqual([WA]);
    expect(states.at(-1)!.player).toMatchObject({ grounded: true, y: 208 });
    expect(states.at(-1)!.lives.lives).toBe(7);
  });

  it('GDD-WLD-10 2-3 a jump from Wa that comes down on Tb is a tier 1 rebound that peaks 2.9 px under the tall chimney and costs a life', () => {
    const peaks: number[] = [];
    const onTb: number[] = [];
    for (let x = 1484; x <= 1556; x += 2) {
      const states = play(quiet, { ...startRun(quiet), player: standing(x, 208) }, 160, (r) => ({ move: r.awningBounce?.awning === TB ? 1 : towards(r.player, 1592), jumpHeld: true }));
      // From further back the jump comes down on Wa again: a held rebound there starts the chain (below).
      if (bouncedOn(states)[0] === WA) continue;
      // Every other jump costs a life: into the open column before Tb, or onto Tb at tier 1.
      expect(states.at(-1)!.lives.lives, `x ${x}`).toBe(6);
      expect(states.some((s) => s.player.x > TALL.x1 + 6 && s.lives.lives === 7), `x ${x}`).toBe(false);
      if (bouncedOn(states).length === 0) continue;
      onTb.push(x);
      expect(bouncedOn(states), `x ${x}`).toEqual([TB]);
      expect(rebounds(states), `x ${x}`).toEqual([-480]);
      peaks.push(Math.min(...states.filter((s) => s.lives.lives === 7).map((s) => s.player.y)));
    }
    expect([onTb[0], onTb.at(-1), onTb.length]).toEqual([1506, 1556, 26]);
    expect(Math.round(Math.min(...peaks) * 10) / 10).toBe(130.9);
    expect(TALL.top).toBe(128);
  });

  it('GDD-WLD-10 2-3 a plain landing on Tb rebounds once, tears it and he falls into the pit', () => {
    for (const target of [1576, 1592, 1608]) {
      const states = play(quiet, { ...startRun(quiet), player: standing(1520, 208) }, 160, (r, i) => ({ move: towards(r.player, target), jumpHeld: i < 10 }));
      expect(bouncedOn(states), `target ${target}`).toEqual([TB]);
      expect(rebounds(states), `target ${target}`).toEqual([-180]);
      expect(states.at(-1)!.lives.lives, `target ${target}`).toBe(6);
    }
  });

  it('GDD-WLD-10 2-3 hopping in place on Wa starts the chain: Wa tier 1, then Tb tier 2 over the tall chimney; let go past it, he settles on Wc', () => {
    const clearances: number[] = [];
    for (let x = 1496; x <= 1556; x += 4) {
      // A hop in place holding jump; once the tier 1 rebound has begun, steered onto Tb's middle, then right; falling past the tall
      // chimney, jump let go for good and steered onto Wc's middle.
      let letGo = false;
      const states = play(quiet, { ...startRun(quiet), player: standing(x, 208) }, 200, (r) => {
        const p = r.player;
        letGo ||= p.vy > 0 && p.x > TALL.x1;
        return { move: letGo ? towards(p, 1672) : r.awningBounce?.awning === TB ? 1 : (p.awningChain ?? 0) >= 1 ? towards(p, 1592) : 0, jumpHeld: !letGo };
      });
      expect(bouncedOn(states).slice(0, 2), `x ${x}`).toEqual([WA, TB]);
      expect(rebounds(states).slice(0, 2), `x ${x}`).toEqual([-480, -540]);
      expect(states.at(-1)!.awningsGone[TB], `x ${x}`).toBe(true);
      expect(states.every((s) => s.lives.lives === 7), `x ${x}`).toBe(true);
      const wc = AWNINGS_2_3[WC]!;
      expect(states.at(-1)!.player, `x ${x}`).toMatchObject({ grounded: true, y: wc.y });
      expect(states.at(-1)!.player.x, `x ${x}`).toBeGreaterThan(wc.x);
      expect(states.at(-1)!.player.x, `x ${x}`).toBeLessThan(wc.x + wc.w);
      // How far his feet are above the tall chimney's top as his centre crosses its middle.
      clearances.push(TALL.top - states.find((s) => s.player.x >= TALL.x0 + TILE / 2)!.player.y);
    }
    expect(Math.round(Math.min(...clearances) * 10) / 10).toBe(4.5);
  });

  it('GDD-WLD-04 2-3 hopping in place on Wa takes its column: the jump the lowest, tier 1 the next, tier 2 the top', () => {
    expect([0, 1, 2].map((tiers) => [taken(hopsOnWa(tiers), 95, 11), taken(hopsOnWa(tiers), 95, 6), taken(hopsOnWa(tiers), 95, 5)])).toEqual([
      [true, false, false],
      [true, true, false],
      [true, true, true],
    ]);
  });

  it('GDD-WLD-10 2-3 holding jump and right from the roof edge flows through Wa and Tb over the tall chimney, and on to the roof L', () => {
    const states = play(quiet, mixedEdge(), 300, (_r, i) => ({ move: 1, jumpHeld: i >= 10 }));
    expect(bouncedOn(states).slice(0, 2)).toEqual([WA, TB]);
    expect(rebounds(states).slice(0, 2)).toEqual([-480, -540]);
    const r = states.at(-1)!;
    expect(r.player).toMatchObject({ grounded: true, y: ROOF });
    expect(r.player.x).toBeGreaterThan(111 * TILE);
    expect(states.every((s) => s.lives.lives === 7)).toBe(true);
  });

  it('GDD-WLD-10 2-3 from standing on Wc, holding jump and right reaches the roof L, through Td or over it', () => {
    for (let x = 1656; x <= 1688; x += 8) {
      const states = play(quiet, { ...startRun(quiet), player: standing(x, 208) }, 200, () => ({ move: 1, jumpHeld: true }));
      const r = states.at(-1)!;
      expect(r.player, `x ${x}`).toMatchObject({ grounded: true, y: ROOF });
      expect(r.player.x, `x ${x}`).toBeGreaterThan(111 * TILE);
      expect(states.every((s) => s.lives.lives === 7), `x ${x}`).toBe(true);
    }
  });

  it('GDD-ENM-03 2-3 the Trompo on L never reaches Poncho waiting on Wc; going as it turns at the pit edge lands him behind it', () => {
    const lv: Level = { ...level, enemies: [ENEMIES_2_3[TROMPO_L]!] };
    expect(play(lv, { ...startRun(lv), player: standing(1672, 208) }, 1200, () => idle).every((s) => s.lives.lives === 7)).toBe(true);
    // From Wc, a takeoff after k steps of waiting, holding jump and right until he lands on L, then standing still for half a second.
    const hits: number[] = [];
    let safe = 0;
    for (let k = 0; k < 250; k++) {
      let s: RunState = { ...startRun(lv), player: standing(1672, 208) };
      for (let i = 0; i < k; i++) s = stepRun(s, idle, lv);
      const t = s.enemies[0]!;
      const turned = t.dir > 0 && t.x < TROMPO_TURNED;
      let landed = -1;
      for (let i = 0; i < 200 && s.lives.lives === 7 && (landed < 0 || i <= landed + 30); i++) {
        if (landed < 0 && s.player.grounded && s.player.y === ROOF) landed = i;
        s = stepRun(s, { move: landed < 0 ? 1 : 0, jumpHeld: landed < 0 }, lv);
      }
      if (s.lives.lives < 7) hits.push(k);
      if (turned) {
        safe++;
        expect(s.lives.lives, `k ${k}`).toBe(7);
      }
    }
    expect(safe).toBeGreaterThan(40);
    expect(hits.length).toBe(HITS_FROM_WC);
  });
});

/** Of the 250 steps of the Trompo's round on L, the takeoffs from Wc that land Poncho in it (measured). */
const HITS_FROM_WC = 112;

describe('GDD-WLD-14 2-3 the rollo on the far post (the Ten)', () => {
  it('GDD-WLD-11 2-3 without R1, no rebound on A2 reaches the high roof F1: its tier 3 peak is 8 px short', () => {
    const bare: Level = { ...quiet, rollos: [] };
    const peaks: number[] = [];
    for (let target = 2562; target <= 2606; target += 4) {
      let r: RunState = { ...startRun(bare), player: { ...standing(2576, 256), x: target } };
      let peak = Infinity;
      for (let i = 0; i < 400; i++) {
        // Steered to `target` for two tiers, then pressing right, into the wall, on the third.
        r = stepRun(r, { move: (r.player.awningChain ?? 0) >= 3 ? 1 : towards(r.player, target), jumpHeld: i > 0 }, bare);
        peak = Math.min(peak, r.player.y);
        expect(r.player.grounded && r.player.x > 164 * TILE - 6, `target ${target}, step ${i}`).toBe(false);
      }
      peaks.push(peak);
    }
    expect(Math.round(Math.min(...peaks) * 10) / 10).toBe(135.8);
  });

  it('GDD-WLD-11 2-3 no claw from the near roof reaches R1 bundle, nor a fireball spat there', () => {
    const b = bundleBox(ROLLOS_2_3[R1]!);
    expect(b.x0 - (155 * TILE + 16 + 6)).toBeGreaterThan(20 + 6); // the claw reaches 20 px past his front, which is at most 6 px past the roof's edge
    let r: RunState = { ...startRun(quiet), power: 'fuego', player: standing(2500, ROOF) };
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
    expect(states.some((s) => s.player.grounded && s.player.y === ROLLOS_2_3[R1]!.y && s.player.x > 156 * TILE && s.player.x < 164 * TILE)).toBe(true);
    expect(states.some((s) => s.player.grounded && s.player.y === HIGH && s.player.x > 164 * TILE && s.player.x < 170 * TILE)).toBe(true);
  });

  it('GDD-LIFE-03 2-3 the veladora over A2 is reached by a tier 3 rebound and not by tier 2', () => {
    for (const tiers of [2, 3]) {
      let r: RunState = { ...startRun(quiet), lives: loseLife(startWorld()), player: { ...standing(2568, 256) } };
      for (let i = 0; i < 300; i++) {
        const chain = r.player.awningChain ?? 0;
        r = stepRun(r, { move: towards(r.player, 2568), jumpHeld: i > 0 && (chain < tiers || (chain === tiers && r.player.vy < 0)) }, quiet);
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
    expect([from[0], from.at(-2), from.at(-1), from.length]).toEqual([2188, 2208, 2245, 22]);
    let r: RunState = { ...startRun(quiet), power: 'fuego', player: standing(2200, ROOF) };
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
    for (const [col, row] of [[141, 13], [142, 13]] as const) expect(taken(r, col, row)).toBe(true);
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
    expect([taken(played.run, 141, 13), taken(played.run, 142, 13)]).toEqual([false, false]);
  });
});

describe('GDD-WLD-14 2-3 the exam (the Ketsu)', () => {
  it('GDD-WLD-11 2-3 without R4, T5 one bounce never reaches the exit roof, wherever it is steered', () => {
    const bare: Level = { ...quiet, rollos: [] };
    for (let target = 3476; target <= 3516; target += 4) {
      const states = play(bare, { ...startRun(bare), player: standing(3376, ROOF) }, 200, (r, i) => ({ move: r.player.x < 3416 || r.awningsGone[T5] ? 1 : towards(r.player, target), jumpHeld: i > 0 && r.player.x > 3410 }));
      expect(states.some((s) => s.player.grounded && s.player.x > 220 * TILE - 6), `target ${target}`).toBe(false);
      expect(states.at(-1)!.lives.lives, `target ${target}`).toBe(6);
    }
  });

  it('GDD-WLD-11 2-3 the claw unrolls R4 bundle pressed against the exit roof wall (his body over it) and 18 px back (the swipe over it)', () => {
    const b = bundleBox(ROLLOS_2_3[R4]!);
    for (const [x, unrolls] of [[b.x1 - 6, true], [b.x1 - 24, true]] as const) {
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

  it('GDD-WLD-04 2-3 the playthrough takes 40 hilos: all but the Ki two columns and the top of Wa column (the ladder and the chain take them) and the Fuego pair', () => {
    const missed = level.hilos!.filter((_, i) => !played.run.hilosTaken[i]).map((h) => `${h.col},${h.row}`);
    expect(missed).toEqual(['8,10', '8,6', '8,4', '12,6', '12,4', '12,3', '95,6', '95,5', '141,13', '142,13']);
  });
});

describe('GDD-WLD-14 playing 2-3', () => {
  it('GDD-WLD-14 2-3 the bot plays from the start through every ofrenda to the exit with all seven lives, in under 2700 steps', () => {
    const { run, steps, lost } = played;
    expect(run.phase).toBe('clear');
    expect(lost).toEqual([]);
    expect(steps).toBeLessThan(2700);
    expect(run.lives.lives).toBe(7);
    expect(run.checkpointIndex).toBe(2);
    expect(touchesExit(run.player, level.exit!)).toBe(true);
    expect([T2, T3, T4, TB, TD, T5].map((i) => run.awningsGone[i])).toEqual([true, true, true, true, true, true]);
    expect([R1, R4].map((i) => rolloLength(ROLLOS_2_3[i]!, run.rollos[i]!))).toEqual([ROLLOS_2_3[R1]!.w, ROLLOS_2_3[R4]!.w]);
  });

  it('GDD-WLD-14 2-3 the bot settles on Wc, a whole awning, and never stands on a torn one; it defeats the Trompo on L', () => {
    const states = played.states;
    const stood = (a: number) => states.some((s) => s.player.grounded && s.player.y === 208 && s.player.x > AWNINGS_2_3[a]!.x - 6 && s.player.x < AWNINGS_2_3[a]!.x + AWNINGS_2_3[a]!.w + 6);
    expect([TB, WC, TD].map(stood)).toEqual([false, true, false]);
    expect(played.run.enemies[TROMPO_L]!.alive).toBe(false);
  });

  it('GDD-WLD-14 2-3 the bot also clears it losing no life after waiting 60, 120, 180 or 240 steps at the start', () => {
    for (const wait of [60, 120, 180, 240]) {
      const { run, lost } = bot(level, 4000, wait);
      expect(run.phase, `wait ${wait}`).toBe('clear');
      expect(lost, `wait ${wait}`).toEqual([]);
    }
  });
});
