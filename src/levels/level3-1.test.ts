import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BASE_HEIGHT, BASE_WIDTH, CAMERA, CRUMBLE, LEVEL_RULES, MURCIELAGO, TILE } from '../config/tuning';
import { bottomRowAt } from '../sim/bottoms';
import { standsOn } from '../sim/crumble';
import { enemyBox, feetOf, kindOf, type Box } from '../sim/enemy';
import { touchesHilo } from '../sim/hilo';
import { spawn, type PlayerInput, type PlayerState } from '../sim/movement';
import { murcielagoAt } from '../sim/murcielago';
import { startRun, stepRun, type Level, type RunState } from '../sim/run';
import { veladoraUsed } from '../sim/veladora';
import { cutCameraY } from '../ui/camera';
import { levelById } from './index';
import { LEVEL_3_1, LEVEL_3_1_ENEMIES, TIPS_3_1 } from './level3-1';
import { onScreen, tileBox, viewsAlong } from './sightSweep';
import { gaps, openGaps, validateLevel } from './validate';

// GDD-WLD-16: level 3-1, "La Barranca". Every number in these tests is the design's (GDD-WLD-16, measured in a scratch build before the
// bats, the ledges' return and the raised bottoms existed); where the real simulation gives another, the test pins the measured value
// with a comment "GDD says N" (L-003).

const L = LEVEL_3_1;
const world = L.world;
/** 3-1 as the game holds it (GDD-TEC-04, GDD-UI-02). */
const entry = () => levelById('3-1')!;
const mid = (col: number) => col * TILE + TILE / 2;
const quiet: Level = { ...L, enemies: [] };
/** The level with only enemy `i` (by its index in `LEVEL_3_1_ENEMIES`). */
const only = (...i: number[]): Level => ({ ...L, enemies: i.map((k) => L.enemies[k]!) });
const idle: PlayerInput = { move: 0, jumpHeld: false };
const standing = (x: number, y: number, vx = 0): PlayerState => ({ ...spawn(x, y), grounded: true, vx, facing: vx < 0 ? -1 : 1 });
/** A fresh run of `level` with its enemies `steps` steps into their walks and loops (none of them reacts to Poncho), Poncho at (x, y). */
function at(level: Level, x: number, y: number, vx = 0, steps = 0): RunState {
  let r = startRun(level);
  for (let i = 0; i < steps; i++) r = stepRun(r, idle, level);
  return { ...r, player: standing(x, y, vx), clock: 0 };
}

/** The enemies by name: their places in `LEVEL_3_1_ENEMIES` (GDD-WLD-16). */
const PEN_ALACRAN = 0;
const FIRST_BAT = 1;
const CHASM_BAT = 2;
const LOWER_ALACRAN = 3;
const PATROL_BAT = 4;
const LAST_BAT_1 = 5;
const LAST_BAT_2 = 6;

/** The first bat's column, and the two hilos over it (rows 8 and 7), as "col,row". */
const FIRST_COL = Math.floor(LEVEL_3_1_ENEMIES[FIRST_BAT]!.x / TILE);
const FIRST_HILOS = [`${FIRST_COL},8`, `${FIRST_COL},7`];

/** The y of the ground's top in rows (`row * TILE`). */
const Y = (row: number) => row * TILE;

/**
 * GDD-WLD-16's ground, column by column: [from, to, top row], the five pits left out. The lower gallery's floor (row 38) has its pen's
 * rocks at 153 and 161 (row 37).
 */
const GROUND: readonly (readonly [number, number, number])[] = [
  [0, 17, 9], [18, 18, 11], [19, 23, 13], [24, 37, 9], [38, 39, 8], [40, 63, 13], [71, 77, 15], [78, 79, 14], [80, 85, 15], [86, 87, 14],
  [88, 103, 15], [113, 133, 19], [134, 135, 18], [136, 152, 38], [153, 153, 37], [154, 160, 38], [161, 161, 37], [162, 168, 38],
  [187, 194, 41], [206, 216, 43], [217, 221, 47], [227, 239, 48],
];
const PITS: readonly (readonly [number, number])[] = [[64, 70], [104, 112], [169, 186], [195, 205], [222, 226]];
/** The solid pieces over the lower gallery: [from, to, first row, last row]: F1, its rock, F2 either side of its crumbling tiles, the buttress. */
const PIECES: readonly (readonly [number, number, number, number])[] = [[136, 157, 25, 26], [150, 150, 24, 24], [139, 145, 31, 31], [150, 160, 31, 31], [161, 164, 17, 31]];
/** The crumbling ledges: [from, to, row]: L1, L2, the middle gallery's floor, L3, L4, the Ketsu ledge. */
const LEDGES: readonly (readonly [number, number, number])[] = [[139, 141, 21], [145, 147, 22], [146, 149, 31], [172, 174, 39], [178, 181, 40], [199, 201, 42]];
const topOf = (col: number): number | undefined => GROUND.find(([a, b]) => col >= a && col <= b)?.[2];
/** The top row of the ground the level's tiles give in column `col`: the solid run that stands on its bottom row (none in a pit). */
const surface = (col: number): number | undefined => {
  let row = bottomRowAt(L, col);
  if (!world.solidTile(col, row)) return undefined;
  while (row > 0 && world.solidTile(col, row - 1)) row--;
  return row;
};

/** Columns `from` to `to` are level ground with its top at `row`: solid there, empty above. */
function levelGround(from: number, to: number, row: number): void {
  for (let col = from; col <= to; col++) expect([col, world.solidTile(col, row), world.solidTile(col, row - 1)]).toEqual([col, true, false]);
}
/** Every 4th step from `from` to `to`. */
const everyFourth = (from: number, to: number): number[] => Array.from({ length: (to - from) / 4 + 1 }, (_, i) => from + 4 * i);

/** Steps `level` from `run` with `input` until `done` or `max` steps (L-064), returning every state. */
function play(level: Level, run: RunState, max: number, input: (r: RunState, i: number) => PlayerInput, done: (r: RunState, i: number) => boolean = () => false): RunState[] {
  const out: RunState[] = [];
  let r = run;
  for (let i = 0; i < max && !done(r, i); i++) {
    r = stepRun(r, input(r, i), level);
    out.push(r);
  }
  return out;
}

/** The first state on which he stands again after leaving the ground, or undefined if a life goes first or none comes. */
function landing(states: readonly RunState[]): { x: number; y: number; step: number } | undefined {
  let air = false;
  for (const [i, s] of states.entries()) {
    if (s.phase !== 'playing') return undefined;
    if (!s.player.grounded) air = true;
    else if (air) return { x: s.player.x, y: s.player.y, step: i };
  }
  return undefined;
}

const lostAny = (states: readonly RunState[], from: RunState): boolean => states.some((s) => s.lives.lives < from.lives.lives || s.phase === 'respawning');

/**
 * A jump from (x, y) at a run (`vx` px/s), right held: pressed on the first step, then held all the way (`'held'`), let go once he stops
 * rising (`'top'`), or let go once his middle passes `until` px. Returns every state up to his landing or 400 steps.
 */
function jumpFrom(level: Level, run: RunState, hold: 'held' | 'top' | number, dir: 1 | -1 = 1): RunState[] {
  let rising = true;
  return play(level, run, 400, (r, i) => {
    if (r.player.vy >= 0 && i > 1) rising = false;
    const held = hold === 'held' ? true : hold === 'top' ? rising : dir * (r.player.x - hold) < 0;
    return { move: dir, jumpHeld: held };
  }, (r, i) => i > 2 && (r.player.grounded || r.phase !== 'playing'));
}

// ---------------------------------------------------------------------------------------------------------------------------------
// The bot (L-048: it lets go of jump for a step before pressing it again). Like 2-2's, it plays a list of controllers, each giving the
// input for a step and saying when it is done.

type Ctl = (r: RunState, t: number) => { input: PlayerInput; done: boolean };

/**
 * GDD-WLD-16's route step: runs the way `dir` says, jumps once it stands with its middle past column `jump` (in that direction), holds
 * jump until its middle is past column `until` (999: until it lands), then keeps running until it lands. Done on the landing, or on a
 * lost life.
 */
const leap = (jump: number, until: number, dir: 1 | -1 = 1): Ctl => {
  let air = false;
  let before = true;
  const past = (x: number, col: number) => dir * (x - col * TILE) >= 0;
  return (r) => {
    const p = r.player;
    if (r.phase !== 'playing') return { input: idle, done: true };
    if (!air) {
      const press = p.grounded && past(p.x, jump) && !before;
      before = press;
      if (press) air = true;
      return { input: { move: dir, jumpHeld: press }, done: false };
    }
    if (p.grounded && p.vy === 0 && !p.takeoff) return { input: { move: dir, jumpHeld: false }, done: true };
    return { input: { move: dir, jumpHeld: until === 999 ? true : !past(p.x, until) }, done: false };
  };
};
/** Runs the way `dir` says until `until` holds. */
const run = (dir: 1 | -1, until: (r: RunState) => boolean): Ctl => (r) => ({ input: { move: dir, jumpHeld: false }, done: until(r) || r.phase !== 'playing' });
/** Stands still until `until` holds. */
const wait = (until: (r: RunState) => boolean): Ctl => (r) => ({ input: idle, done: until(r) || r.phase !== 'playing' });
/** Stands still for `n` steps. */
const pause = (n: number): Ctl => (_r, t) => ({ input: idle, done: t >= n });
const standsAt = (row: number, fromCol: number, toCol: number) => (r: RunState) =>
  r.player.grounded && r.player.y === Y(row) && r.player.x >= fromCol * TILE && r.player.x < (toCol + 1) * TILE;

interface Played {
  readonly run: RunState;
  readonly states: readonly RunState[];
  /** The steps on which a life was lost. */
  readonly lost: readonly number[];
  /** The step each controller finished on. */
  readonly marks: readonly number[];
}

function drive(tasks: readonly Ctl[], level: Level = L, from: RunState = startRun(level), maxSteps = 4000): Played {
  let r = from;
  const states: RunState[] = [];
  const marks: number[] = [];
  const lost: number[] = [];
  let k = 0;
  let t = 0;
  while (k < tasks.length && r.phase !== 'clear' && states.length < maxSteps) {
    const { input, done } = tasks[k]!(r, t);
    if (done) {
      marks.push(states.length);
      k++;
      t = 0;
      continue;
    }
    t++;
    const before = r.lives.lives;
    r = stepRun(r, input, level);
    if (r.lives.lives < before) lost.push(states.length);
    states.push(r);
  }
  return { run: r, states, lost, marks };
}

describe('GDD-WLD-16 level 3-1 layout', () => {
  it('GDD-WLD-16 3-1 is 240 by 51 tiles, glides, and passes the validator as a World 3 level', () => {
    const e = entry();
    expect(e).toMatchObject({ world: 3, test: false });
    expect(e.level).toBe(L);
    expect([world.width, world.height]).toEqual([240, 51]);
    expect(L.abilities).toEqual({ glide: true });
    expect(validateLevel(e)).toEqual([]);
    // L-028 both ways: without its ledges' return World 3 refuses it, and as a World 2 level its gaps are too wide.
    const { crumblesReturn: _r, ...stays } = L;
    expect(validateLevel({ ...e, level: stays })).toContain("crumbling tiles that do not come back, World 3's do");
    const asWorld2 = validateLevel({ ...e, world: 2 });
    expect(asWorld2.filter((p) => p.startsWith('gap of')).length).toBeGreaterThan(0);
  });

  it('GDD-WLD-16 3-1 starts at column 3 on the rim (row 9) and its exit stands at column 234 on the canyon floor (row 48)', () => {
    expect(L.spawn).toEqual({ x: mid(3), y: Y(9) });
    expect(L.exit).toEqual({ x: mid(234), y: Y(48) });
    // GDD-WLD-03's sight rule: 4 tiles of level ground on each side of the exit and of the spawn. The spawn has only columns 0 to 2 on its
    // left, the level's edge after them.
    levelGround(0, 7, 9);
    levelGround(230, 238, 48);
  });

  it('GDD-WLD-03 3-1 ofrendas stand at columns 59, 131 and 208 (24.8, 54.8 and 86.9 percent), each on ground 3 tiles wide with 7 tiles of open air above', () => {
    expect(L.ofrendas.map((o) => [o.id, o.x, o.y])).toEqual([
      ['3-1-1', mid(59), Y(13)],
      ['3-1-2', mid(131), Y(19)],
      ['3-1-3', mid(208), Y(43)],
    ]);
    [24.8, 54.8, 86.9].forEach((share, i) => expect((L.ofrendas[i]!.x / (240 * TILE)) * 100).toBeCloseTo(share, 1));
    for (const o of L.ofrendas) {
      const [col, row] = [Math.floor(o.x / TILE), o.y / TILE];
      for (let c = col - 1; c <= col + 1; c++) {
        expect(world.solidTile(c, row), `${o.id} ground at ${c}`).toBe(true);
        for (let up = 1; up <= 7; up++) expect(world.solidTile(c, row - up), `${o.id} air at ${c},${row - up}`).toBe(false);
      }
    }
  });

  it("GDD-WLD-16 3-1 the ground is the map's: every stretch's top row", () => {
    const solid = (col: number, row: number) => {
      const top = topOf(col);
      return (top !== undefined && row >= top) || PIECES.some(([a, b, r0, r1]) => col >= a && col <= b && row >= r0 && row <= r1);
    };
    for (let col = 0; col < 240; col++) {
      for (let row = 0; row < 51; row++) expect(world.solidTile(col, row), `${col},${row}`).toBe(solid(col, row));
    }
    for (const [a, b] of PITS) for (let col = a; col <= b; col++) expect(topOf(col), `pit column ${col}`).toBeUndefined();
    // Counted from the tables: 5160 tiles of ground and 123 in the pieces (F1 44, its rock 1, F2 18, the buttress 60).
    const ground = GROUND.reduce((n, [a, b, row]) => n + (b - a + 1) * (51 - row), 0);
    const pieces = PIECES.reduce((n, [a, b, r0, r1]) => n + (b - a + 1) * (r1 - r0 + 1), 0);
    expect([ground, pieces]).toEqual([5160, 123]);
    let count = 0;
    for (let col = 0; col < 240; col++) for (let row = 0; row < 51; row++) if (world.solidTile(col, row)) count++;
    expect(count).toBe(5283);
  });

  it('GDD-WLD-03 3-1 gaps: 7, 9, 3, 3, 5, 4, 4 and 5 tiles with drops of 2, 4, 1, 1, 1, 1, 1 and 1, each within World 3 limit', () => {
    // The pits as the validator reads them (each column's bottom row), split at the crumbling tiles, which are banks in World 3 (GDD-WLD-05).
    expect(gaps(world, L.bottoms).map((g) => [g.col, g.col + g.width - 1])).toEqual(PITS);
    expect(openGaps(L).map((g) => [g.col, g.col + g.width - 1])).toEqual(PITS);
    const ledgeRow = (col: number) => L.crumbles.find((c) => c.col === col && !world.solidTile(col, bottomRowAt(L, col)))?.row;
    const bankTop = (col: number) => ledgeRow(col) ?? surface(col)!;
    const found: { from: number; width: number; drop: number }[] = [];
    for (const g of openGaps(L)) {
      let start = -1;
      for (let col = g.col; col <= g.col + g.width; col++) {
        const pit = col < g.col + g.width && ledgeRow(col) === undefined;
        if (pit && start < 0) start = col;
        if (!pit && start >= 0) {
          found.push({ from: start, width: col - start, drop: bankTop(col) - bankTop(start - 1) });
          start = -1;
        }
      }
    }
    expect(found.map((f) => f.width)).toEqual([7, 9, 3, 3, 5, 4, 4, 5]);
    expect(found.map((f) => f.drop)).toEqual([2, 4, 1, 1, 1, 1, 1, 1]);
    const rule = LEVEL_RULES.world3Gap;
    const limits = found.map((f) => rule.base + rule.perDropTile * f.drop);
    expect(limits).toEqual([8, 10, 7, 7, 7, 7, 7, 7]);
    found.forEach((f, i) => expect(f.width, `gap at ${f.from}`).toBeLessThanOrEqual(limits[i]!));
    // Every left bank has 6 tiles of open air over it across its gap (World 3's full limit, no roof).
    for (const f of found) {
      const top = bankTop(f.from - 1);
      for (let col = f.from - 1; col < f.from + f.width; col++) {
        for (let up = 1; up <= 6; up++) expect(world.solidTile(col, top - up), `air over the gap at ${f.from}: ${col},${top - up}`).toBe(false);
      }
    }
  });

  it('GDD-WLD-03 3-1 each raised bottom is 4 rows under the lower lip of its pit, and the last pit is open to the level last row', () => {
    expect(L.bottoms).toEqual([
      { fromCol: 64, toCol: 70, row: 19 },
      { fromCol: 104, toCol: 112, row: 23 },
      { fromCol: 169, toCol: 186, row: 45 },
      { fromCol: 195, toCol: 205, row: 47 },
    ]);
    for (const [a, b] of PITS.slice(0, 4)) {
      const lower = Math.max(topOf(a - 1)!, topOf(b + 1)!);
      for (let col = a; col <= b; col++) expect(bottomRowAt(L, col), `column ${col}`).toBe(lower + 4);
    }
    // The last pit: its lips at rows 47 and 48, 4 rows under the lower would be past the last row (50).
    for (let col = 222; col <= 226; col++) {
      expect(bottomRowAt(L, col), `column ${col}`).toBe(50);
      for (let row = 0; row < 51; row++) expect(world.solidTile(col, row), `${col},${row}`).toBe(false);
    }
  });

  it('GDD-WLD-05 3-1 has twenty crumbling tiles in six places, none holding an item, none under an enemy walk, and its ledges come back', () => {
    expect(L.crumbles).toHaveLength(20);
    expect(L.crumbles).toEqual(LEDGES.flatMap(([a, b, row]) => Array.from({ length: b - a + 1 }, (_, i) => ({ col: a + i, row }))));
    expect(L.crumblesReturn).toBe(true);
    const tiles = new Set(L.crumbles.map((c) => `${c.col},${c.row}`));
    // Nothing in a crumbling tile, and nothing that stands on the ground stands on one.
    for (const h of L.hilos!) expect(tiles.has(`${h.col},${h.row}`), `hilo ${h.col},${h.row}`).toBe(false);
    for (const p of L.pinatas) expect(tiles.has(`${p.col},${p.row}`)).toBe(false);
    expect(tiles.has(`${L.veladora!.col},${L.veladora!.row + 1}`)).toBe(false);
    for (const s of [L.spawn, L.exit!, ...L.ofrendas]) expect(tiles.has(`${Math.floor(s.x / TILE)},${s.y / TILE}`)).toBe(false);
    for (const c of L.crumbles) expect(world.solidTile(c.col, c.row), `${c.col},${c.row}`).toBe(false);
    // No enemy stands on one: over 600 steps no Alacrán's feet are on a crumbling tile's top with its box over the tile's column (the bats
    // touch none, test GDD-ART-05 below).
    let r = startRun(L);
    for (let i = 0; i < 600; i++) {
      r = stepRun(r, idle, L);
      L.enemies.forEach((e, k) => {
        if (kindOf(e) !== 'alacran') return;
        const b = enemyBox(e, r.enemies[k]!);
        for (const c of L.crumbles) expect(b.y1 === Y(c.row) && b.x1 > c.col * TILE && b.x0 < (c.col + 1) * TILE, `enemy ${k} at step ${i} on ${c.col},${c.row}`).toBe(false);
      });
    }
  });

  it('GDD-ENM-04 3-1 enemies: two Alacranes and five Murciélagos where the map puts them, none on or over F1', () => {
    expect(L.enemies).toBe(LEVEL_3_1_ENEMIES);
    expect(L.enemies).toEqual([
      { x: mid(82), y: Y(15) },
      { x: mid(95), y: 188, kind: 'murcielago', ry: 24 },
      { x: mid(108), y: 320, kind: 'murcielago', ry: 24 },
      { x: mid(157), y: Y(38) },
      { x: mid(214), y: 672, kind: 'murcielago', rx: 16 },
      { x: mid(220), y: 680, kind: 'murcielago', ry: 24 },
      { x: mid(225), y: 636, kind: 'murcielago', ry: 24, phase: 120 },
    ]);
    expect(L.enemies.map(kindOf).filter((k) => k === 'alacran')).toHaveLength(2);
    expect(L.enemies.map(kindOf).filter((k) => k === 'murcielago')).toHaveLength(5);
    // The five bats by column: the first, the second chasm's, the patrol bat and the last glide's two.
    expect(L.enemies.filter((e) => kindOf(e) === 'murcielago').map((e) => Math.floor(e.x / TILE))).toEqual([95, 108, 214, 220, 225]);
    // The two Alacranes by column: the first pen's and the lower pen's. None on F1 (columns 136 to 157, rows 25 and 26).
    expect(L.enemies.filter((e) => kindOf(e) === 'alacran').map((e) => Math.floor(e.x / TILE))).toEqual([82, 157]);
    // GDD-ENM-01: none starts within 3 tiles of a respawn, and no bat's loop comes within 80 px of one.
    const respawns = [L.spawn, ...L.ofrendas];
    for (const e of L.enemies) for (const p of respawns) expect(Math.hypot(e.x - p.x, e.y - p.y), `${e.x},${e.y}`).toBeGreaterThanOrEqual(48);
    let nearest = Infinity;
    for (const e of L.enemies.filter((d) => kindOf(d) === 'murcielago')) {
      for (let n = 0; n < MURCIELAGO.periodSteps; n++) {
        const b = murcielagoAt(e, n);
        for (const p of respawns) nearest = Math.min(nearest, Math.hypot(b.x - p.x, b.y - p.y));
      }
    }
    expect(nearest).toBeGreaterThanOrEqual(80);
  });

  it('GDD-ENM-02 3-1 while Poncho waits at the start each Alacrán keeps to its stretch', () => {
    const xs = [PEN_ALACRAN, LOWER_ALACRAN].map(() => [Infinity, -Infinity]);
    let r = startRun(L);
    for (let i = 0; i < 4000; i++) {
      r = stepRun(r, idle, L);
      [PEN_ALACRAN, LOWER_ALACRAN].forEach((k, j) => {
        const s = r.enemies[k]!;
        xs[j] = [Math.min(xs[j]![0]!, s.x), Math.max(xs[j]![1]!, s.x)];
        expect(feetOf(L.enemies[k]!, s), `enemy ${k} at step ${i}`).toBe(L.enemies[k]!.y);
        // None stands on a crumbling tile's column over a gap.
        for (const c of L.crumbles) expect(feetOf(L.enemies[k]!, s) === Y(c.row) && Math.abs(s.x - mid(c.col)) < (14 + TILE) / 2).toBe(false);
      });
    }
    expect(xs.map(([a, b]) => [Math.round(a!), Math.round(b!)])).toEqual([
      [1287, 1369],
      [2471, 2569],
    ]);
  });

  it('GDD-ART-05 3-1 no bat drawn frame, 32 by 24 px about its middle, overlaps a solid tile or a crumbling tile anywhere on its loop', () => {
    const tiles = new Set(L.crumbles.map((c) => `${c.col},${c.row}`));
    for (const e of L.enemies.filter((d) => kindOf(d) === 'murcielago')) {
      for (let n = 0; n < MURCIELAGO.periodSteps; n++) {
        const { x, y } = murcielagoAt(e, n);
        for (let row = Math.floor((y - 12) / TILE); row * TILE < y + 12; row++) {
          for (let col = Math.floor((x - 16) / TILE); col * TILE < x + 16; col++) {
            expect(world.solidTile(col, row) || tiles.has(`${col},${row}`), `bat at ${e.x},${e.y} step ${n}: ${col},${row}`).toBe(false);
          }
        }
      }
    }
  });

  it('GDD-WLD-04 3-1 has 50 hilos, each in an empty tile, none in a crumbling tile, none touched at a respawn', () => {
    const hilos = L.hilos!;
    expect(hilos).toHaveLength(50);
    expect(new Set(hilos.map((h) => `${h.col},${h.row}`)).size).toBe(50);
    const tiles = new Set([...L.crumbles, ...L.pinatas, L.veladora!].map((c) => `${c.col},${c.row}`));
    for (const h of hilos) {
      expect(world.solidTile(h.col, h.row), `${h.col},${h.row}`).toBe(false);
      expect(tiles.has(`${h.col},${h.row}`), `${h.col},${h.row}`).toBe(false);
    }
    for (const p of [L.spawn, ...L.ofrendas]) for (const h of hilos) expect(touchesHilo(standing(p.x, p.y), h), `${h.col},${h.row} at ${p.x}`).toBe(false);
  });

  it('GDD-PWR-05 3-1 the two piñatas hang 48 px over the ground with a stone to their right, and a waiting Poncho has the taco back 330 steps after the bump', () => {
    expect(L.pinatas).toEqual([
      { col: 30, row: 5 },
      { col: 126, row: 15 },
    ]);
    for (const [i, p] of L.pinatas.entries()) {
      const ground = surface(p.col)!;
      expect(Y(ground) - Y(p.row + 1), `piñata ${i}`).toBe(48);
      // A stone to its right, a tile higher than the ground under it, turns the taco back.
      const stone = [38, 134][i]!;
      expect(surface(stone), `piñata ${i}`).toBe(ground - 1);
      for (let col = p.col; col < stone; col++) expect(surface(col), `piñata ${i} column ${col}`).toBe(ground);
      // Under it, a jump bumps it; then he waits where he lands.
      const from = at(quiet, mid(p.col), Y(ground));
      const states = play(quiet, from, 900, (_r, k) => ({ move: 0, jumpHeld: k < 20 }), (r) => r.power === 'taco');
      const bump = states.findIndex((s) => s.pinatasOpen[i]);
      const back = states.findIndex((s) => s.power === 'taco');
      expect(bump, `piñata ${i}`).toBeGreaterThan(0);
      expect(back - bump, `piñata ${i}`).toBeGreaterThanOrEqual(330 - 6);
      expect(back - bump, `piñata ${i}`).toBeLessThanOrEqual(330 + 6);
    }
  });

  it('GDD-UI-05 3-1 has one tip over columns 0 to 23, its highlight the four hilos of the flat arc, its words the GDD in three languages and for three devices', () => {
    expect(entry().tips).toBe(TIPS_3_1);
    expect(TIPS_3_1).toHaveLength(1);
    const tip = TIPS_3_1[0]!;
    expect([tip.from, tip.to, tip.highlight, tip.button, tip.doneWhen]).toEqual([0, 23, { col: 7, row: 4, w: 7, h: 4 }, 'jump', undefined]);
    // The highlight holds the four hilos of the arc over the flat, and no other.
    const inside = L.hilos!.filter((h) => h.col >= 7 && h.col < 14 && h.row >= 4 && h.row < 8).map((h) => [h.col, h.row]);
    expect(inside).toEqual([[7, 4], [9, 5], [11, 6], [13, 7]]);
    expect(tip.text).toEqual({
      en: { keyboard: 'Hold Space in the air to glide. Let go to drop', touch: 'Hold the jump button in the air to glide. Let go to drop', pad: 'Hold the bottom button in the air to glide. Let go to drop' },
      es: {
        keyboard: 'Mantén Espacio en el aire para planear. Suéltalo para caer',
        touch: 'Mantén el botón de salto en el aire para planear. Suéltalo para caer',
        pad: 'Mantén el botón inferior en el aire para planear. Suéltalo para caer',
      },
      de: {
        keyboard: 'Leertaste in der Luft halten zum Gleiten. Loslassen zum Fallen',
        touch: 'Sprungknopf in der Luft halten zum Gleiten. Loslassen zum Fallen',
        pad: 'Untere Taste in der Luft halten zum Gleiten. Loslassen zum Fallen',
      },
    });
    // L-051: pinned against the GDD's own words, in "The tip of 3-1" of GDD-UI-05.
    const gdd = readFileSync(new URL('../../docs/GDD.md', import.meta.url), 'utf8');
    const start = gdd.indexOf('- **The tip of 3-1**', gdd.indexOf('### GDD-UI-05'));
    expect(start).toBeGreaterThan(-1);
    const section = gdd.slice(start, gdd.indexOf('\n- `TIPS`', start));
    for (const language of ['en', 'es', 'de'] as const) {
      for (const device of ['keyboard', 'touch', 'pad'] as const) expect(section.includes(`"${tip.text[language][device]}"`), `${language} ${device}`).toBe(true);
    }
  });
});

/** Where a list of controllers first lands him after its last jump: the landing's x in tiles, its y, and its steps from the takeoff. */
function landsAt(p: Played, from = 0): { col: number; y: number; air: number } | undefined {
  const states = p.states.slice(from);
  const off = states.findIndex((s) => !s.player.grounded);
  const land = landing(states);
  return land && { col: land.x / TILE, y: land.y, air: land.step - off };
}
/** Takes the steps of `p` from its controller `k` on (the states after controller `k - 1` finished). */
const after = (p: Played, k: number): number => (k === 0 ? 0 : p.marks[k - 1]!);

describe('GDD-WLD-16 3-1 Ki: the glide with no way to fail', () => {
  it('GDD-WLD-16 3-1 on the flat a held jump lands 8.5 tiles on and one let go at the top 4.3', () => {
    const from = at(quiet, mid(4), Y(9), 120);
    const held = landing(jumpFrom(quiet, from, 'held'))!;
    const top = landing(jumpFrom(quiet, from, 'top'))!;
    expect([held.y, top.y]).toEqual([Y(9), Y(9)]);
    expect(Math.abs((held.x - from.player.x) / TILE - 8.5)).toBeLessThanOrEqual(0.1);
    expect(Math.abs((top.x - from.player.x) / TILE - 4.3)).toBeLessThanOrEqual(0.1);
  });

  it('GDD-WLD-16 3-1 the trench: held from the lip he lands at column 26.2; without the glide he lands in the trench, loses no life and climbs out by the step at column 18', () => {
    const held = drive([leap(17.6, 999)], quiet);
    const land = landsAt(held)!;
    expect(land.y).toBe(Y(9));
    expect(Math.abs(land.col - 26.2)).toBeLessThanOrEqual(0.1);
    const plain: Level = { ...quiet, abilities: {} };
    const fell = drive([leap(17.6, 999)], plain);
    const inTrench = landsAt(fell)!;
    expect(inTrench.y).toBe(Y(13));
    expect(inTrench.col).toBeGreaterThanOrEqual(19);
    expect(inTrench.col).toBeLessThan(24);
    // Out by the step: a jump onto it (row 11), a jump from it onto the rim (row 9), back on the near side.
    const out = drive([leap(19.6, 999, -1), leap(18.6, 999, -1)], plain, fell.run);
    expect(out.lost).toEqual([]);
    expect(fell.lost).toEqual([]);
    expect(out.states.map((s) => s.player.grounded && s.player.y === Y(11) && Math.floor(s.player.x / TILE) === 18).some(Boolean)).toBe(true);
    expect([out.run.player.y, out.run.player.x < 18 * TILE]).toEqual([Y(9), true]);
  });

  it('GDD-WLD-16 3-1 the long glide: held from the stone he lands at column 56.8 after 136 steps (2.3 s), on solid ground all the way', () => {
    const p = drive([leap(36.4, 37.0), leap(39.6, 999)], quiet, at(quiet, mid(33), Y(9), 120));
    expect(p.lost).toEqual([]);
    const land = landsAt(p, after(p, 1))!;
    expect(land.y).toBe(Y(13));
    expect(Math.abs(land.col - 56.8)).toBeLessThanOrEqual(0.2);
    // GDD says 2.4 s (144 steps); measured from the first step in the air to the landing, 136 (2.27 s).
    expect(land.air).toBe(136);
    for (const s of p.states.slice(after(p, 1))) expect(topOf(Math.floor(s.player.x / TILE)), `${s.player.x}`).toBeDefined();
  });
});

/** Every take-off at a run from x = `lip` - 40 to `lip` (1 px apart) on ground at `row`, a full jump let go at the top, without the glide. */
const plainJumps = (lip: number, row: number): RunState[][] => {
  const plain: Level = { ...quiet, abilities: {} };
  return Array.from({ length: 41 }, (_, i) => play(plain, at(plain, lip - 40 + i, Y(row), 120), 300, (r, k) => ({ move: 1, jumpHeld: k === 0 || (k > 0 && r.player.vy < 0) }), (r, k) => k > 2 && (r.player.grounded || r.phase !== 'playing')));
};
/** The 24 start times of a bat's 4 s loop: 0 to 230 steps, 10 apart. */
const STARTS = Array.from({ length: 24 }, (_, i) => i * 10);
/** Whether bat `i` was stomped in these states (it went from alive to defeated on a step he was bounced up). */
const stompedBat = (states: readonly RunState[], i: number): boolean => states.some((s, k) => k > 0 && s.stomped && states[k - 1]!.enemies[i]!.alive && !s.enemies[i]!.alive);
/**
 * L-014: the start times at which a drive measured on `quiet` or `only(...)` loses a life when played on the real level, with every enemy:
 * `go(s)` plays it from start time `s` and returns its states.
 */
const lostOnL = (go: (s: number) => readonly RunState[]): number[] => STARTS.filter((s) => {
  const states = go(s);
  return lostAny(states, states[0]!);
});

/** The level's idle runs from its start, kept from one `atWarm` to the next. */
const warmRuns = new Map<Level, RunState[]>();
/** `at`, with the level's idle start run kept between calls: the sweeps below start thousands of flights. */
function atWarm(level: Level, x: number, y: number, vx: number, steps: number): RunState {
  let runs = warmRuns.get(level);
  if (!runs) warmRuns.set(level, (runs = [startRun(level)]));
  while (runs.length <= steps) runs.push(stepRun(runs[runs.length - 1]!, idle, level));
  return { ...runs[steps]!, player: standing(x, y, vx), clock: 0 };
}
/**
 * A flight right: right held all the way; jump pressed once he stands with his middle at `takeoff` px or past it (`'jump'`), or not until
 * he is in the air (`'walk'`, off a ledge), and held from then on. With `release`, jump is let go `release` steps after the take-off or the
 * last stomp's bounce and pressed again 10 steps later (a second glide). Ends on the landing or a lost life, at most 500 steps.
 */
function flight(level: Level, from: RunState, takeoff: number, way: 'jump' | 'walk', release: number | null = null): RunState[] {
  let anchor = -1;
  return play(level, from, 500, (r, i) => {
    if (anchor < 0 && !r.player.grounded) anchor = i;
    if (r.stomped) anchor = i;
    const off = anchor >= 0 && release !== null && i - anchor >= release && i - anchor < release + 10;
    return { move: 1, jumpHeld: anchor < 0 ? way === 'jump' && r.player.grounded && r.player.x >= takeoff : !off };
  }, (r, i) => anchor >= 0 && i > anchor && (r.player.grounded || r.phase !== 'playing'));
}
/** Every other step of the bats' 4 s loop: 0 to 238. */
const STARTS_2 = Array.from({ length: 120 }, (_, i) => i * 2);
/** From `a` to `b` tiles, `by` apart. */
const spaced = (a: number, b: number, by: number): number[] => Array.from({ length: Math.round((b - a) / by) + 1 }, (_, i) => Math.round((a + i * by) * 10) / 10);
/**
 * GDD-WLD-16: the flights over the second chasm, take-offs `by` tiles apart: held jumps from 96.0 to 103.9 tiles along its near bank at the
 * 24 start times; the first bat's held-stomp bounces, jumps from 4.5 to 1.5 tiles before its column at every other step of its loop, run up
 * from 5 tiles before it; held
 * jumps and walks off with jump pressed in the air from the pen's second rock (86.0 to 87.9) at the 24 start times; each held, and let go
 * 20, 40 and 60 steps after the take-off or the bounce for a second glide.
 */
function chasmFlights(by: number): { name: string; go: (level: Level) => RunState[] }[] {
  const out: { name: string; go: (level: Level) => RunState[] }[] = [];
  for (const release of [null, 20, 40, 60]) {
    for (const t of spaced(96, 103.9, by)) for (const s of STARTS) out.push({ name: `bank ${t} start ${s} release ${release}`, go: (lv) => flight(lv, atWarm(lv, t * TILE, Y(15), 120, s), t * TILE, 'jump', release) });
    for (const t of spaced(FIRST_COL - 4.5, FIRST_COL - 1.5, by)) for (const s of STARTS_2) out.push({ name: `first bat ${t} start ${s} release ${release}`, go: (lv) => flight(lv, atWarm(lv, mid(FIRST_COL - 5), Y(15), 120, s), t * TILE, 'jump', release) });
    for (const t of spaced(86, 87.9, by)) {
      for (const s of STARTS) for (const way of ['jump', 'walk'] as const) out.push({ name: `rock ${way} ${t} start ${s} release ${release}`, go: (lv) => flight(lv, atWarm(lv, t * TILE, Y(14), 120, s), t * TILE, way, release) });
    }
  }
  return out;
}
/** Whether a flight ended standing on the second chasm's far bank (row 19) with every life. */
const onFarBank = (states: readonly RunState[]): boolean => {
  const end = states[states.length - 1]!;
  return !lostAny(states, states[0]!) && end.phase === 'playing' && end.player.grounded && end.player.y === Y(19);
};

/** Jump let go `off` steps after a stomp's bounce and pressed again `back` steps after that. */
interface Again {
  readonly off: number;
  readonly back: number;
}
/** Let go 20 steps after the bounce, pressed again 10 steps later. */
const AGAIN: Again = { off: 20, back: 10 };
/**
 * A flight right as `flight` makes it, but for what jump does once a stomp has bounced him (`bounce`): `'held'` held on, `'drop'` let go for good,
 * or let go and pressed again (`Again`, `AGAIN` for 20 and 10 steps). With `release`, jump is let go `release` steps after the take-off and
 * pressed again 10 steps later, before any stomp. Once landed he stands still for `idleAfter` steps. The input of step `i` is read from the
 * state before it, so the step that lets go after a stomp is `off` steps after the step that follows the first stomped state.
 */
function bounceFlight(level: Level, from: RunState, takeoff: number, way: 'jump' | 'walk', bounce: 'held' | 'drop' | Again, release: number | null = null, idleAfter = 0): RunState[] {
  let [air, stomp, landed] = [-1, -1, -1];
  return play(level, from, 600, (r, i) => {
    if (air < 0 && !r.player.grounded) air = i;
    if (stomp < 0 && r.stomped) stomp = i;
    if (landed < 0 && air >= 0 && i > air && r.player.grounded) landed = i;
    if (landed >= 0) return idle;
    if (air < 0) return { move: 1, jumpHeld: way === 'jump' && r.player.grounded && r.player.x >= takeoff };
    if (stomp >= 0) return { move: 1, jumpHeld: bounce === 'held' || (bounce !== 'drop' && (i - stomp < bounce.off || i - stomp >= bounce.off + bounce.back)) };
    return { move: 1, jumpHeld: release === null || i - air < release || i - air >= release + 10 };
  }, (r, i) => r.phase !== 'playing' || (landed >= 0 && i >= landed + idleAfter));
}
/** A held jump that came down on the first bat: its name, where it starts, its take-off and every state of its flight. */
interface HeldStomp {
  readonly name: string;
  readonly from: RunState;
  readonly takeoff: number;
  readonly way: 'jump' | 'walk';
  readonly states: RunState[];
}
/**
 * GDD-WLD-16: every held jump on `level` that comes down on its first bat (at column `col`), from the pen's second rock (86.0 tiles, a held
 * jump and a walk off it with jump pressed in the air) to a tile before the bat's column, take-offs 0.2 tile apart (0.1 runs about 36 s),
 * from a stand (1 px before the take-off) and at a run, at every 4th step of the bats' loop; `each` sees every flight, stomp or not.
 */
function heldStomps(level: Level, col: number, each: (name: string, states: readonly RunState[]) => void = () => {}): HeldStomp[] {
  const found: HeldStomp[] = [];
  for (const t of spaced(86, col - 1, 0.2)) {
    const row = t < 88 ? 14 : 15;
    const starts: [string, number, number, 'jump' | 'walk'][] = [['stand', t * TILE - 1, 0, 'jump'], ['run', t * TILE, 120, 'jump']];
    if (row === 14) starts.push(['walk off', t * TILE, 120, 'walk']);
    for (const [kind, x, vx, way] of starts) {
      for (let s = 0; s < MURCIELAGO.periodSteps; s += 4) {
        const from = atWarm(level, x, Y(row), vx, s);
        const states = bounceFlight(level, from, t * TILE, way, 'held');
        each(`${kind} from ${t}, start ${s}`, states);
        if (stompedBat(states, FIRST_BAT)) found.push({ name: `${kind} from ${t}, start ${s}`, from, takeoff: t * TILE, way, states });
      }
    }
  }
  return found;
}
/** `heldStomps` on the real level, none of whose flights touches the chasm's bat, worked out once for the tests that use them. */
const firstBatStomps = (() => {
  let found: HeldStomp[] | undefined;
  return () => (found ??= heldStomps(L, FIRST_COL, (name, states) => expect(chasmBatTouched(states), name).toBe(false)));
})();
/** How many held stomps there are, and how many of them do not reach the second chasm's far bank with every life. */
const fallShort = (stomps: readonly HeldStomp[]): [number, number] => [stomps.length, stomps.filter((f) => !onFarBank(f.states)).length];
/** 3-1 with its first bat and the two hilos over it moved to column `col` (GDD-WLD-16: first built at 93, moved to 95). */
const firstBatAt = (col: number): Level => ({
  ...L,
  enemies: L.enemies.map((e, k) => (k === FIRST_BAT ? { ...e, x: mid(col) } : e)),
  hilos: L.hilos!.map((h) => (h.col === FIRST_COL && (h.row === 8 || h.row === 7) ? { ...h, col } : h)),
});

/** Whether he touched the second chasm's bat in these states (came down on it or into its side). */
const chasmBatTouched = (states: readonly RunState[]): boolean =>
  states.some((r) => !r.enemies[CHASM_BAT]!.alive || gapBetween(bodyAt(r.player.x, r.player.y), enemyBox(L.enemies[CHASM_BAT]!, r.enemies[CHASM_BAT]!)) <= 0);

describe('GDD-WLD-16 3-1 Sho: real pits, the bat alone, the bat down in the chasm', () => {
  it('GDD-WLD-16 3-1 the first chasm cannot be crossed without the glide, and held from the lip he lands at column 75.7', () => {
    for (const states of plainJumps(64 * TILE, 13)) expect(states[states.length - 1]!.phase, `from ${states[0]!.player.x}`).toBe('respawning');
    const held = drive([leap(63.6, 999)], quiet, at(quiet, mid(58), Y(13), 120));
    const land = landsAt(held)!;
    expect(held.lost).toEqual([]);
    expect(land.y).toBe(Y(15));
    expect(Math.abs(land.col - 75.7)).toBeLessThanOrEqual(0.1);
  });

  it('GDD-WLD-16 3-1 the pen: a held jump from the first rock lands on or past the second, over the Alacrán, at every point of its walk', () => {
    const lv = only(PEN_ALACRAN);
    for (let k = 0; k < 340; k += 2) {
      const p = drive([leap(79.6, 999)], lv, at(lv, mid(78), Y(14), 120, k));
      const land = landsAt(p)!;
      expect(p.lost, `walk step ${k}`).toEqual([]);
      expect(land.col * TILE + 6, `walk step ${k}`).toBeGreaterThan(86 * TILE);
    }
  });

  it('GDD-ENM-04 3-1 the first bat: walking under it without looking is a hit in 8 of 24 start times; waiting for the upper half of its loop never is', () => {
    const lv = only(FIRST_BAT);
    const blind = STARTS.map((s) => play(lv, at(lv, mid(FIRST_COL - 5), Y(15), 0, s), 120, () => ({ move: 1, jumpHeld: false })));
    expect(blind.filter((states) => states.some((r) => r.phase === 'respawning')).length).toBe(8);
    // Waiting where he landed until its upper half begins (step 120 of its loop), then walking under it.
    for (const s of STARTS) {
      const p = drive([wait((r) => r.enemies[0]!.loop!.steps % MURCIELAGO.periodSteps === 120), run(1, (r) => r.player.x > mid(FIRST_COL + 5))], lv, at(lv, mid(FIRST_COL - 5), Y(15), 0, s));
      expect(p.lost, `start ${s}`).toEqual([]);
    }
    // On the real level: the same 8 hits, and none for the wait.
    expect(lostOnL((s) => play(L, at(L, mid(FIRST_COL - 5), Y(15), 0, s), 120, () => ({ move: 1, jumpHeld: false })))).toEqual([0, 10, 20, 30, 40, 50, 220, 230]);
    expect(lostOnL((s) => drive([wait((r) => r.enemies[FIRST_BAT]!.loop!.steps % MURCIELAGO.periodSteps === 120), run(1, (r) => r.player.x > mid(FIRST_COL + 5))], L, at(L, mid(FIRST_COL - 5), Y(15), 0, s)).states)).toEqual([]);
  });

  it('GDD-WLD-16 3-1 the second chasm: held from the lip he lands at column 119.0, over its bat, at every one of 24 start times with no life lost', () => {
    const land = landsAt(drive([leap(103.6, 999)], quiet, at(quiet, mid(98), Y(15), 120)))!;
    expect(land.y).toBe(Y(19));
    expect(Math.abs(land.col - 119.0)).toBeLessThanOrEqual(0.1);
    // On the real level the bat is down in the chasm, under the glide: the same landing at every start time, the bat untouched.
    for (const s of STARTS) {
      const p = drive([leap(103.6, 999)], L, at(L, mid(98), Y(15), 120, s));
      expect([p.lost, landsAt(p)!.y, landsAt(p)!.col, stompedBat(p.states, CHASM_BAT)], `start ${s}`).toEqual([[], Y(19), land.col, false]);
    }
  });

  it('GDD-WLD-16 3-1 no flight that crosses the second chasm touches its bat', { timeout: 300000 }, () => {
    // Its place: column 108, its loop's middle at y 320, 24 px up and down, under every flight that crosses (measured over the set below
    // with the bat left out, take-offs 0.1 tile apart: his feet's lowest at columns 107 to 109 is y 282.4; the bat's box top at the top of
    // its loop, 291, is 8.6 px under it). Its drawn frame at the bottom of the loop (to y 356) is on screen from the lip, where the camera's
    // cut has its bottom edge at 374.
    const bat = L.enemies[CHASM_BAT]!;
    expect(bat).toEqual({ x: mid(108), y: 320, kind: 'murcielago', ry: 24 });
    const lip = cutCameraY({ ...startRun(L), player: standing(mid(103), Y(15)) }, L);
    expect([lip.y + BASE_HEIGHT, bat.y + bat.ry! + 12]).toEqual([374, 356]);
    // Every flight of the set on the real level, take-offs 0.2 tile apart (0.1 runs about 50 s). The bat acts on him only by touch, so a
    // flight that never touches it flies as it would without it: each that ends on the far bank does so with every life. One that touches it
    // (a short flight coming down on it, or into its side) is one that does not reach the bank with the bat left out.
    const noBat: Level = { ...L, enemies: L.enemies.filter((_, k) => k !== CHASM_BAT) };
    let [crossed, rescued, near] = [0, 0, Infinity];
    for (const f of chasmFlights(0.2)) {
      const states = f.go(L);
      let [gap, touched] = [Infinity, false];
      for (const r of states) {
        const e = r.enemies[CHASM_BAT]!;
        const g = e.alive ? gapBetween(bodyAt(r.player.x, r.player.y), enemyBox(bat, e)) : -Infinity;
        gap = Math.min(gap, g);
        touched ||= g <= 0;
      }
      if (!touched) {
        if (onFarBank(states)) [crossed, near] = [crossed + 1, Math.min(near, gap)];
        continue;
      }
      expect(onFarBank(f.go(noBat)), f.name).toBe(false);
      if (onFarBank(states)) rescued++;
    }
    // Measured: the crossing flights, those a stomp on the bat saves (the next test), and the nearest any crossing flight comes to it.
    expect([crossed, rescued, Math.round(near * 10) / 10]).toEqual([1552, 462, 11]);
  });

  it('GDD-WLD-16 3-1 the held stomp on the first bat carries him over the second chasm with every life', { timeout: 300000 }, () => {
    // Every held jump that comes down on the first bat (column 95), from the pen's second rock to a tile before the bat, standing and running:
    // the held bounce carries him over the chasm onto its far bank, every life kept, and no flight touches the chasm's bat. At the stomp
    // he is past x 1440, so the chasm's lip (x 1664) is on screen: the camera keeps him 224 to 256 px from the screen's left edge, so its
    // right edge is 224 px or more ahead of him.
    const stomps = firstBatStomps();
    for (const f of stomps) expect(onFarBank(f.states), f.name).toBe(true);
    const lands = stomps.map((f) => landing(f.states)!.x / TILE);
    const stompX = stomps.map((f) => f.states.find((r) => r.stomped)!.player.x);
    expect(Math.min(...stompX)).toBeGreaterThan(104 * TILE - (BASE_WIDTH - CAMERA.deadZone) / 2);
    // Measured: the stomps, where they land (columns 113.1 to 117.4), and where he is when he stomps (x 1515 to 1541).
    expect([stomps.length, ...[Math.min(...lands), Math.max(...lands)].map((c) => Math.round(c * 10) / 10), Math.round(Math.min(...stompX)), Math.round(Math.max(...stompX))]).toEqual([842, 113.1, 117.4, 1515, 1541]);
    // The two hilos over the first bat: the held stomp the hilo census plays (a jump 4 tiles before the bat, run up from 5 tiles before it,
    // at every other start time), on the real level.
    const census = STARTS_2.map((s) => drive([leap(FIRST_COL - 4, 999)], L, at(L, mid(FIRST_COL - 5), Y(15), 120, s))).filter((p) => stompedBat(p.states, FIRST_BAT));
    expect([census.length, census.filter((p) => FIRST_HILOS.every((h) => takenHilos(p.run).includes(h))).length]).toEqual([47, 9]);
  });

  it('GDD-WLD-16 3-1 the held stomp on the first bat let go at the stomp he comes down on the flat', { timeout: 300000 }, () => {
    // The same stomps, jump let go at the stomp: he drops onto the flat before the chasm and stands there 60 steps with every life.
    const drop = firstBatStomps().map((f) => bounceFlight(L, f.from, f.takeoff, f.way, 'drop', null, 60));
    for (const states of drop) expect([lostAny(states, states[0]!), landing(states)?.y], `${states[0]!.player.x}`).toEqual([false, Y(15)]);
    const lands = drop.map((states) => landing(states)!.x / TILE);
    // Measured: he comes down at columns 97.3 to 99.4, short of the lip at 104.
    expect([Math.min(...lands), Math.max(...lands)].map((c) => Math.round(c * 10) / 10)).toEqual([97.3, 99.4]);
    // Jump let go 20 steps after the stomp and pressed again 10 later: measured, all come down on the flat (columns 100.1 to 104.4, the
    // last on the lip's edge) with every life, none on the far bank. With take-offs 0.1 tile apart, 1 of 1657 falls into the chasm.
    const again = firstBatStomps().map((f) => bounceFlight(L, f.from, f.takeoff, f.way, AGAIN));
    const ends = { flat: 0, bank: 0, lost: 0 };
    const flat: number[] = [];
    for (const states of again) {
      if (lostAny(states, states[0]!)) ends.lost++;
      else if (landing(states)!.y === Y(19)) ends.bank++;
      else {
        ends.flat++;
        flat.push(landing(states)!.x / TILE);
      }
    }
    expect([ends, ...[Math.min(...flat), Math.max(...flat)].map((c) => Math.round(c * 10) / 10)]).toEqual([{ flat: 842, bank: 0, lost: 0 }, 100.1, 104.4]);
  });

  it('GDD-WLD-16 3-1 the held stomp on the first bat, let go in the air and pressed again, can come down in the second chasm, which is on screen from the stomp', { timeout: 300000 }, () => {
    // The same stomps, jump let go `off` steps after the stomp and pressed again `back` steps later, at the timings the review of PR #97
    // found falling into the chasm: where each comes down. For each that is lost, the chasm's lip (column 104 at the near bank's ground,
    // row 15) was on screen at the step jump was let go: the pure camera stepped along the run, settled at the start as after an approach
    // to the take-off (`viewsAlong`), not a distance.
    const lip = tileBox(104, 15);
    const timings: readonly Again[] = [{ off: 5, back: 3 }, { off: 10, back: 5 }, { off: 20, back: 3 }, AGAIN, { off: 30, back: 1 }];
    const counts = timings.map((t) => {
      const ends = { flat: 0, bank: 0, lost: 0 };
      for (const f of firstBatStomps()) {
        const states = bounceFlight(L, f.from, f.takeoff, f.way, t);
        if (!lostAny(states, states[0]!)) {
          if (landing(states)!.y === Y(19)) ends.bank++;
          else if (landing(states)!.y === Y(15)) ends.flat++;
          else expect.unreachable(`${f.name} let go ${t.off}, again ${t.back} lands at ${landing(states)!.y}`);
          continue;
        }
        ends.lost++;
        const end = states[states.length - 1]!;
        expect([end.phase, Math.floor(end.player.x / TILE) >= 104 && Math.floor(end.player.x / TILE) <= 112], f.name).toEqual(['respawning', true]);
        const letGo = states.findIndex((r) => r.stomped) + 1 + t.off;
        const view = viewsAlong(L, f.from, states, 1)[letGo];
        expect(view && onScreen(lip, view), `${f.name} let go ${t.off}, again ${t.back}`).toBe(true);
      }
      return ends;
    });
    // Measured over the 842 stomps (take-offs 0.2 tile apart), in the order of `timings`.
    expect(counts).toEqual([
      { flat: 423, bank: 153, lost: 266 },
      { flat: 0, bank: 458, lost: 384 },
      { flat: 94, bank: 264, lost: 484 },
      { flat: 842, bank: 0, lost: 0 },
      { flat: 3, bank: 398, lost: 441 },
    ]);
  });

  it("GDD-WLD-16 3-1 the first bat's column: at 93 and 94 some held stomps fall short, at 95 none", { timeout: 300000 }, () => {
    // The first bat and its two hilos moved in a copy of the level, the held stomps swept as above (take-offs 0.2 tile apart, standing and
    // running, the rock, every 4th start time): how many stomp it, and how many of those do not reach the far bank with every life.
    expect(FIRST_COL).toBe(95);
    // Measured: at 93, 305 of 1065 stomps fall short; at 94, 84 of 1100; at 95, none of 842.
    expect([...[93, 94].map((col) => fallShort(heldStomps(firstBatAt(col), col))), fallShort(firstBatStomps())]).toEqual([[1065, 305], [1100, 84], [842, 0]]);
  });

  it('GDD-WLD-16 3-1 a glide that falls short of the second chasm can come down on its bat, and the bounce carries him out', () => {
    // A held jump from 100.0 tiles, let go 40 steps after the take-off and pressed again 10 steps later, at 24 start times: it falls short;
    // where it comes down on the bat, the held bounce and a second glide carry him onto the far bank.
    let [stomps, out, lost] = [0, 0, 0];
    for (const s of STARTS) {
      const states = flight(L, atWarm(L, 100 * TILE, Y(15), 120, s), 100 * TILE, 'jump', 40);
      if (stompedBat(states, CHASM_BAT)) {
        stomps++;
        if (onFarBank(states)) out++;
      }
      if (lostAny(states, states[0]!)) lost++;
    }
    // Measured: 10 of 24 come down on it and all 10 get out; the other 14 fall into the chasm.
    expect({ stomps, out, lost }).toEqual({ stomps: 10, out: 10, lost: 14 });
    // The same flights, with jump let go for good at the stomp, or held on through the bounce with no second press: of the 10 stomps, those
    // that reach the bank.
    const reach = (['drop', 'held'] as const).map((mode) =>
      STARTS.map((s) => bounceFlight(L, atWarm(L, 100 * TILE, Y(15), 120, s), 100 * TILE, 'jump', mode, 40)).filter((states) => stompedBat(states, CHASM_BAT)).map(onFarBank),
    );
    expect(reach.map((r) => [r.length, r.filter(Boolean).length])).toEqual([[10, 0], [10, 10]]);
  });

  it('GDD-WLD-16 3-1 no jump without the glide crosses the second chasm', () => {
    for (const states of plainJumps(104 * TILE, 15)) expect(states[states.length - 1]!.phase, `from ${states[0]!.player.x}`).toBe('respawning');
  });
});

/** The gap between two boxes: the larger of the horizontal and the vertical gap (0 or less when they touch). */
const gapBetween = (a: Box, b: Box): number => Math.max(a.x0 - b.x1, b.x0 - a.x1, a.y0 - b.y1, b.y0 - a.y1);
/** His body box standing with his feet's middle at (x, y). */
const bodyAt = (x: number, y: number): Box => ({ x0: x - 6, x1: x + 6, y0: y - 32, y1: y });
/** The nearest any live enemy comes to `box` while Poncho waits at the start, over `steps` steps (every bat's loop and every Alacrán's walk). */
function nearestHurt(box: Box, steps = 800): number {
  let r = startRun(L);
  let near = Infinity;
  for (let i = 0; i < steps; i++) {
    r = stepRun(r, idle, L);
    L.enemies.forEach((e, k) => (near = Math.min(near, gapBetween(box, enemyBox(e, r.enemies[k]!)))));
  }
  return near;
}
/** The x walked by enemy `k` while Poncho waits at the start, over 800 steps: its box's left and right edges at their extremes. */
function walked(k: number): { x0: number; x1: number } {
  let r = startRun(L);
  let [x0, x1] = [Infinity, -Infinity];
  for (let i = 0; i < 800; i++) {
    r = stepRun(r, idle, L);
    const b = enemyBox(L.enemies[k]!, r.enemies[k]!);
    [x0, x1] = [Math.min(x0, b.x0), Math.max(x1, b.x1)];
  }
  return { x0, x1 };
}
/** The crumbling tiles of ledge `[from, to, row]`, by their indices in `LEVEL_3_1.crumbles`. */
const tilesOf = ([a, b, row]: readonly [number, number, number]): number[] => L.crumbles.flatMap((c, i) => (c.row === row && c.col >= a && c.col <= b ? [i] : []));
const MIDDLE = LEDGES[2]!;
/**
 * The careful bot's wait for the last glide's second bat (`i`, its index in the level played): standing before the lip, it goes as the bat
 * reaches the bottom of its loop (a quarter of the loop past its middle, GDD-ENM-04), or at once if it is gone.
 */
const atLoopBottom = (i: number) => (r: RunState): boolean => {
  const bat = r.enemies[i]!;
  return !bat.alive || (bat.loop!.steps + (L.enemies[LAST_BAT_2]!.phase ?? 0)) % MURCIELAGO.periodSteps === MURCIELAGO.periodSteps / 4;
};
const L3 = LEDGES[3]!;

describe('GDD-WLD-16 3-1 Ten: the ledges fall, and the path folds back', () => {
  it('GDD-WLD-16 3-1 from the stone, held and let go at column 138.4 he lands on L1 at 141.1', () => {
    const from = at(quiet, mid(134), Y(18), 120);
    const onL1 = drive([leap(135.6, 138.4)], quiet, from);
    const land = landsAt(onL1)!;
    expect(land.y).toBe(Y(21));
    expect(Math.abs(land.col - 141.1)).toBeLessThanOrEqual(0.1);
    const lit = onL1.states[onL1.states.length - 1]!.player;
    expect(L.crumbles.filter((c) => standsOn(lit, c))).toEqual([{ col: 140, row: 21 }, { col: 141, row: 21 }]);
  });

  it('GDD-WLD-16 3-1 held from the stone he overshoots both ledges and lands on F1 with every life, at every start time', () => {
    // Take-offs from the stone at a run, jump held to the landing, at 24 start times on the real level: he lands on F1 (row 25); then,
    // right held for 120 more steps, he walks off F1's end into the shaft and stands on the middle gallery's floor (F2, row 31).
    const cols: number[] = [];
    for (const off of [134.6, 135.0, 135.3, 135.6, 135.9]) {
      for (const s of STARTS) {
        const name = `from ${off}, start ${s}`;
        const p = drive([leap(off, 999), (_r, t) => ({ input: { move: 1, jumpHeld: false }, done: t >= 120 })], L, at(L, mid(134), Y(18), 120, s));
        const land = landsAt(p)!;
        expect(land.y, name).toBe(Y(25));
        cols.push(land.col);
        expect(p.lost, name).toEqual([]);
        expect([p.run.player.grounded, p.run.player.y], name).toEqual([true, Y(31)]);
      }
    }
    // Measured: he comes down on F1 between columns 155.1 and 156.5, past both ledges.
    expect([Math.min(...cols), Math.max(...cols)].map((c) => Math.round(c * 10) / 10)).toEqual([155.1, 156.5]);
  }, 30000);

  it('GDD-WLD-16 3-1 from L2 a held glide flies the length of F1 into the shaft, at every start time', () => {
    for (const s of STARTS) {
      const p = drive([leap(147.6, 999)], L, at(L, mid(145), Y(22), 120, s));
      expect(p.lost, `start ${s}`).toEqual([]);
      const land = landsAt(p)!;
      // Measured: on the middle gallery's floor at column 160.625, past the shaft's left edge at 158.
      expect([land.y, land.col], `start ${s}`).toEqual([Y(31), 160.625]);
    }
  });

  it('GDD-WLD-16 3-1 the middle gallery: at a run right to left he crosses its four crumbling tiles; standing on them he drops into the lower gallery 3 tiles or more from anything that hurts, and they are back over his head 2 s later', () => {
    // At a run from F2's right part, he is over them and on F2's left part with no step off the floor.
    const across = play(quiet, at(quiet, mid(152), Y(31), -120), 200, () => ({ move: -1, jumpHeld: false }), (r) => r.player.x < 144 * TILE);
    expect(across[across.length - 1]!.player.x).toBeLessThan(144 * TILE);
    for (const s of across) expect([s.player.grounded, s.player.y]).toEqual([true, Y(31)]);
    // Standing on them: he drops through onto the lower gallery's floor and loses nothing.
    const drop = play(L, at(L, mid(147), Y(31)), 400, () => idle);
    const tiles = tilesOf(MIDDLE).filter((i) => drop.some((s) => s.crumbles[i]!.phase === 'gone'));
    expect(tiles.length).toBeGreaterThan(0);
    const land = landing(drop)!;
    expect(land.y).toBe(Y(38));
    expect(lostAny(drop, drop[0]!)).toBe(false);
    // They are gone 0.5 s after he stood on them and back 2.0 s after that, over his head.
    const gone = drop.findIndex((s) => tiles.every((i) => s.crumbles[i]!.phase === 'gone'));
    const back = drop.findIndex((s, k) => k > gone && tiles.every((i) => s.crumbles[i]!.phase === 'idle'));
    expect(back - gone).toBe(CRUMBLE.returnSteps);
    expect(drop[back]!.player.y).toBe(Y(38));
    // 3 tiles: wherever he can come down from those four tiles (his middle from 146 * 16 - 5 to 150 * 16 + 5), his box is 48 px or more
    // across from the pen's Alacrán's at every step of its walk, and no bat comes within 48 px.
    const alacran = walked(LOWER_ALACRAN);
    let worst = Infinity;
    for (let x = 146 * TILE - 5; x <= 150 * TILE + 5; x++) {
      const box = bodyAt(x, Y(38));
      worst = Math.min(worst, Math.max(alacran.x0 - box.x1, box.x0 - alacran.x1));
      expect(Math.max(alacran.x0 - box.x1, box.x0 - alacran.x1), `from ${x}`).toBeGreaterThanOrEqual(48);
    }
    // Measured: 53 px at the worst (GDD-WLD-16).
    expect(Math.abs(worst - 53)).toBeLessThanOrEqual(0.5);
    const bats = { ...L, enemies: L.enemies.filter((e) => kindOf(e) === 'murcielago') };
    for (const e of bats.enemies) {
      for (let n = 0; n < MURCIELAGO.periodSteps; n++) {
        const b = murcielagoAt(e, n);
        const bat = { x0: b.x - 8, x1: b.x + 8, y0: b.y - 5, y1: b.y + 5 };
        expect(gapBetween({ x0: 146 * TILE - 11, x1: 150 * TILE + 11, y0: Y(38) - 32, y1: Y(38) }, bat)).toBeGreaterThanOrEqual(48);
      }
    }
  });

  it('GDD-WLD-03 3-1 both shafts drop him onto solid ground with no pit column within 4 tiles on the far side and nothing that hurts within 3 tiles', () => {
    // The drops' heights: F1 (row 25) to F2 (row 31), 6 tiles; F2 to the lower gallery's floor (row 38), 7.
    expect([31 - 25, 38 - 31]).toEqual([6, 7]);
    const pits = new Set(gaps(world, L.bottoms).flatMap((g) => Array.from({ length: g.width }, (_, i) => g.col + i)));
    const shafts = [
      { from: at(quiet, mid(155), Y(25), 120), dir: 1, row: 31 },
      { from: at(quiet, mid(141), Y(31), -120), dir: -1, row: 38 },
    ] as const;
    for (const { from, dir, row } of shafts) {
      const states = play(quiet, from, 300, () => ({ move: dir, jumpHeld: false }), (r, k) => k > 2 && r.player.grounded && r.player.y !== from.player.y);
      const land = states[states.length - 1]!.player;
      expect([land.grounded, land.y]).toEqual([true, Y(row)]);
      const col = Math.floor(land.x / TILE);
      for (let c = col; c !== col + dir * 5; c += dir) expect(pits.has(c), `column ${c} past the drop to row ${row}`).toBe(false);
      expect(nearestHurt(bodyAt(land.x, land.y)), `the drop to row ${row}`).toBeGreaterThanOrEqual(48);
    }
    // On the real level, at 24 start times, neither walk to a shaft loses a life (F1 has no enemy).
    const toShaft = (k: 0 | 1) => (s: number) => {
      const { dir, row } = shafts[k];
      const from = at(L, mid(k === 0 ? 155 : 141), Y(k === 0 ? 25 : 31), dir * 120, s);
      return play(L, from, 300, () => ({ move: dir, jumpHeld: false }), (r, n) => n > 2 && r.player.grounded && r.player.y === Y(row));
    };
    expect(lostOnL(toShaft(0))).toEqual([]);
    expect(lostOnL(toShaft(1))).toEqual([]);
  });

  it('GDD-WLD-16 3-1 the lower pen: a hop over the first rock and one held jump from inside land him on the far rock under the 6-tile roof; the stomp and the claw each defeat its Alacrán', () => {
    const lv = only(LOWER_ALACRAN);
    // The hop comes down inside the pen, past the first rock; the held jump from there lands on the far rock (column 161.75).
    const route = drive([leap(151.6, 152.4), leap(153.6, 999)], lv, at(lv, mid(140), Y(38), 120));
    expect(route.lost).toEqual([]);
    const hop = landsAt(route)!;
    expect([hop.y, hop.col > 154]).toEqual([Y(38), true]);
    const land = landsAt(route, after(route, 1))!;
    expect([land.y, Math.floor(land.col)]).toEqual([Y(37), 161]);
    // Measured over its walk (every 4 steps of 400 from the start): the same, but where the Alacrán is at the pen's left end as the hop
    // comes down (walk steps 140 to 152, a hit), and where the held jump comes down on it (156 to 212, a stomp whose bounce carries him
    // past the far rock onto the gallery's floor at column 166; 216 and 220, a hit on its side).
    const other: string[] = [];
    for (let k = 0; k < 400; k += 4) {
      const p = drive([leap(151.6, 152.4), leap(153.6, 999)], lv, at(lv, mid(140), Y(38), 120, k));
      const end = landsAt(p, after(p, 1));
      if (p.lost.length > 0) other.push(`${k} hit`);
      else if (end?.y !== Y(37) || Math.floor(end.col) !== 161) other.push(`${k} ${stompedBat(p.states, 0) ? 'stomp' : 'pass'} ${end && Math.floor(end.col)} ${end?.y}`);
    }
    expect(other).toEqual([...everyFourth(140, 152).map((k) => `${k} hit`), ...everyFourth(156, 212).map((k) => `${k} stomp 166 608`), '216 hit', '220 hit']);
    // The stomp: from the first rock, a hop onto it as it comes his way.
    const stomp = drive([wait((r) => r.enemies[0]!.dir < 0 && r.enemies[0]!.x - r.player.x < 56), (r, t) => ({ input: { move: 1, jumpHeld: t < 6 }, done: t > 3 && r.player.grounded })], lv, at(lv, mid(153), Y(37), 0, 100));
    expect(stomp.lost).toEqual([]);
    expect(stompedBat(stomp.states, 0)).toBe(true);
    // The claw: standing in the pen, as it comes within reach.
    let clawed = false;
    const claw = drive([(r) => {
      const b = enemyBox(lv.enemies[0]!, r.enemies[0]!);
      const press = !clawed && r.enemies[0]!.alive && b.x0 - (r.player.x + 6) <= 18;
      clawed ||= press;
      return { input: { ...idle, claw: press }, done: !r.enemies[0]!.alive };
    }], lv, at(lv, mid(155), Y(38)), 600);
    expect(claw.lost).toEqual([]);
    expect(claw.run.enemies[0]!.alive).toBe(false);
  });

  it('GDD-WLD-16 3-1 over the pit: short jumps ledge to ledge cross it; one held glide from the gallery edge skips L3 and lands on L4 at column 180.6; from L4 a held glide reaches the rest at 191.9; a held glide from L3 flies past L4 into the pit', () => {
    const edge = at(quiet, mid(165), Y(38), 120);
    const hops = drive([leap(168.6, 172.2), leap(174.6, 178.4), leap(181.6, 999)], quiet, edge);
    expect(hops.lost).toEqual([]);
    expect([0, 1, 2].map((k) => landsAt(hops, after(hops, k))!.y)).toEqual([Y(39), Y(40), Y(41)]);
    const skip = landsAt(drive([leap(168.6, 999)], quiet, edge))!;
    expect(skip.y).toBe(Y(40));
    // Measured: 180.625.
    expect(skip.col).toBe(180.625);
    const rest = landsAt(drive([leap(181.6, 999)], quiet, at(quiet, mid(178), Y(40), 120)))!;
    expect(rest.y).toBe(Y(41));
    expect(Math.abs(rest.col - 191.9)).toBeLessThanOrEqual(0.1);
    const past = drive([leap(174.6, 999)], quiet, at(quiet, mid(172), Y(39), 120));
    expect(past.lost.length).toBe(1);
  });

  it('GDD-WLD-05 3-1 a ledge he ruined is back 2.5 s after he landed on it: from L3 he hops back to the gallery, waits, and crosses', () => {
    const ledge = tilesOf(L3);
    const p = drive(
      [
        leap(168.6, 172.2),
        run(-1, (r) => r.player.vx < -60),
        leap(174, 999, -1),
        wait((r) => ledge.every((i) => r.crumbles[i]!.phase === 'idle')),
        run(1, (r) => r.player.x > 165 * TILE),
        leap(168.6, 172.2),
        leap(174.6, 178.4),
        leap(181.6, 999),
      ],
      quiet,
      at(quiet, mid(165), Y(38), 120),
    );
    expect(p.lost).toEqual([]);
    expect(p.run.player).toMatchObject({ grounded: true, y: Y(41) });
    const landed = landing(p.states)!.step;
    expect(landsAt(p)!.y).toBe(Y(39));
    // Back on the gallery (row 38) before the ledge goes; it is gone from 0.5 s after he landed and whole again from 2.5 s.
    expect(p.states[after(p, 3)]!.player.y).toBe(Y(38));
    // The tiles he landed on.
    const tiles = ledge.filter((i) => p.states.some((s) => s.crumbles[i]!.phase === 'gone'));
    expect(tiles.length).toBeGreaterThan(0);
    const gone = p.states.findIndex((s) => tiles.every((i) => s.crumbles[i]!.phase === 'gone'));
    const back = p.states.findIndex((s, k) => k > gone && tiles.every((i) => s.crumbles[i]!.phase === 'idle'));
    expect([gone - landed, back - landed]).toEqual([CRUMBLE.warningSteps, CRUMBLE.warningSteps + CRUMBLE.returnSteps]);
    // The wait ends on the step it is whole: at most 150 steps after he landed on it.
    expect(p.marks[3]! - 1 - landed).toBeLessThanOrEqual(150);
  });
});

/**
 * A plain running jump from a run along the pillar: jump pressed once his middle reaches `press`, let go at the top. Where he took off (NaN
 * if no jump took off: he had fallen past his coyote time), and the state it ends in (landed, or a life lost).
 */
const plainFrom = (lv: Level, from: RunState, press: number): { off: number; land: RunState } => {
  let k0 = -1;
  const states = play(lv, from, 400, (r, k) => {
    if (k0 < 0 && r.player.x >= press) k0 = k;
    return { move: 1, jumpHeld: k0 >= 0 && (k === k0 || r.player.vy < 0) };
  }, (r, k) => k0 >= 0 && k > k0 + 2 && (r.player.grounded || r.phase !== 'playing'));
  return { off: states[k0]!.player.takeoff === 'jump' ? states[k0]!.player.x : NaN, land: states[states.length - 1]! };
};

describe('GDD-WLD-16 3-1 Ketsu: all of it, and the secret', () => {
  it('GDD-WLD-16 3-1 the last ledges: a held glide from the crumbling ledge lands at column 211.9, short of the patrol bat; one hop clears or stomps it at 24 start times, never a side hit', () => {
    const land = landsAt(drive([leap(201.6, 999)], quiet, at(quiet, mid(199), Y(42), 120)))!;
    expect(land.y).toBe(Y(43));
    expect(Math.abs(land.col - 211.9)).toBeLessThanOrEqual(0.1);
    // Short of the bat: his box is clear of its loop's left end.
    expect(land.col * TILE + 6).toBeLessThan(L.enemies[PATROL_BAT]!.x - (L.enemies[PATROL_BAT]!.rx ?? 0) - MURCIELAGO.width / 2);
    const lv = only(PATROL_BAT);
    const tries = STARTS.map((s) => drive([leap(201.6, 999), leap(212.2, 213.4), leap(216.6, 999)], lv, at(lv, mid(199), Y(42), 120, s)));
    for (const [i, p] of tries.entries()) {
      expect(p.lost, `start ${STARTS[i]}`).toEqual([]);
      expect(p.run.player.y, `start ${STARTS[i]}`).toBe(Y(48));
    }
    // The design: 10 stomps in 24.
    // GDD says 10 stomps in 24; measured 11.
    expect(tries.filter((p) => stompedBat(p.states, 0)).length).toBe(11);
    // On the real level: the glide onto the ledge loses nothing (the patrol bat comes within 12 px of it); the hop and then the last glide
    // with no look at its bats (the next test) is a hit at 19 of 24 start times.
    expect(lostOnL((s) => drive([leap(201.6, 999)], L, at(L, mid(199), Y(42), 120, s)).states)).toEqual([]);
    expect(lostOnL((s) => drive([leap(201.6, 999), leap(212.2, 213.4), leap(216.6, 999)], L, at(L, mid(199), Y(42), 120, s)).states)).toEqual([0, 10, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160, 180, 190, 200, 210, 220, 230]);
  });

  it('GDD-WLD-16 3-1 the last glide: held from the lip he lands at column 233.8 after 136 steps (2.3 s); the first bat is passed or stomped, never a side hit; the second is a hit in 8 of 24 start times and never when he waits for it', () => {
    // Measured with the exit left out: he reaches its arch in the air, before he lands.
    const { exit: _exit, ...open } = quiet;
    const land = landsAt(drive([leap(216.6, 999)], open, at(open, mid(214), Y(43), 120)))!;
    expect(land.y).toBe(Y(48));
    expect(Math.abs(land.col - 233.8)).toBeLessThanOrEqual(0.1);
    // GDD says 2.4 s (144 steps); measured from the first step in the air to the landing, 136 (2.27 s).
    expect(land.air).toBe(136);
    const first = only(LAST_BAT_1);
    for (const s of STARTS) expect(drive([leap(216.6, 999)], first, at(first, mid(214), Y(43), 120, s)).lost, `start ${s}`).toEqual([]);
    const second = only(LAST_BAT_2);
    // GDD says 9 of 24; measured 8, with the bat 4 px higher than the design's (y 636, not 640) so that neither bat reaches the line of a
    // plain jump from the pillar (the secret's test below).
    const hit = STARTS.filter((s) => drive([leap(216.6, 999)], second, at(second, mid(214), Y(43), 120, s)).lost.length > 0);
    expect(hit).toHaveLength(8);
    expect(hit).toEqual([60, 70, 80, 90, 100, 110, 120, 130]);
    // Waiting for it: standing on the ledge 3 columns before the lip, he goes as it reaches the bottom of its loop.
    for (const s of STARTS) {
      const p = drive([wait(atLoopBottom(0)), leap(216.6, 999)], second, at(second, mid(213), Y(43), 0, s));
      expect(p.lost, `start ${s}`).toEqual([]);
    }
    // On the real level he starts in the patrol bat's loop (columns 213 and 214 at body height), which a player has stomped or passed
    // first (the route bots): there it hits him where he stands, at 22 of 24 start times from 214 and at all 24 while he waits at 213.
    const glideOnL = lostOnL((s) => drive([leap(216.6, 999)], L, at(L, mid(214), Y(43), 120, s)).states);
    expect(glideOnL).toEqual(STARTS.filter((s) => s < 140 || s > 150));
    expect(lostOnL((s) => drive([wait(atLoopBottom(LAST_BAT_2)), leap(216.6, 999)], L, at(L, mid(213), Y(43), 0, s)).states)).toEqual(STARTS);
  });

  it('GDD-LIFE-03 3-1 the secret: from the pillar a plain jump reaches the floor only from its edge, x 3558 to 3568, the last px and coyote time: the way on is the glide', { timeout: 60000 }, () => {
    const plain: Level = { ...quiet, abilities: {} };
    // Every press from x = 3540 on, 1 px apart, at a run (2 px a step): those that reach the floor, by where he took off. The jumps that
    // take off from 3558 to 3568 land on the floor, the take-off at the pillar's edge (his box clear of it at 3558) and in his coyote time
    // after it (GDD-MOV-03); every one before falls into the pit, and after 3568 no jump takes off.
    const reach: number[] = [];
    const fall: number[] = [];
    for (let press = 3540; press <= 3575; press++) {
      const { off, land: end } = plainFrom(plain, at(plain, mid(218), Y(47), 120), press);
      if (Number.isNaN(off)) continue;
      if (end.phase === 'playing' && end.player.y === Y(48)) reach.push(off);
      else fall.push(off);
    }
    expect([Math.min(...reach), Math.max(...reach)]).toEqual([3558, 3568]);
    expect(Math.max(...fall)).toBe(3556);
    // On the real level, at 24 start times (the last glide's bats come within 1 px of these jumps): the same 12 take-offs reach the floor
    // but at start time 130, where the bats take 2 of them.
    const plainL: Level = { ...L, abilities: {} };
    const reachedOnL = STARTS.map((s) => {
      let n = 0;
      for (let press = 3540; press <= 3575; press++) {
        const { off, land: end } = plainFrom(plainL, at(plainL, mid(218), Y(47), 120, s), press);
        if (!Number.isNaN(off) && end.phase === 'playing' && end.player.y === Y(48)) n++;
      }
      return n;
    });
    expect(reachedOnL).toEqual(STARTS.map((s) => (s === 130 ? 10 : 12)));
  });

  it('GDD-ENM-04 3-1 a held jump from the last two tiles of the ledge passes or stomps the last glide first bat, never a side hit, at 24 start times', { timeout: 60000 }, () => {
    // Take-offs from x = 215.0 to 216.9 tiles, 0.1 tile apart, at a run, jump held; the second bat left out, so only the first is judged.
    const first = only(LAST_BAT_1);
    let stomps = 0;
    for (let tenth = 2150; tenth <= 2169; tenth++) {
      for (const s of STARTS) {
        const states = jumpFrom(first, at(first, (tenth / 10) * TILE, Y(43), 120, s), 'held');
        expect(states.some((r) => r.phase === 'respawning'), `from ${tenth / 10}, start ${s}`).toBe(false);
        if (stompedBat(states, 0)) stomps++;
      }
    }
    // Measured: 99 of the 480 jumps stomp it, the rest pass over it.
    expect(stomps).toBe(99);
    // On the real level the same jumps meet the second bat too (and the patrol bat over the take-offs): 172 of the 480 are hit, and the
    // first bat is still stomped in 99.
    let [hitOnL, stompsOnL] = [0, 0];
    for (let tenth = 2150; tenth <= 2169; tenth++) {
      for (const s of STARTS) {
        const states = jumpFrom(L, at(L, (tenth / 10) * TILE, Y(43), 120, s), 'held');
        if (states.some((r) => r.phase === 'respawning')) hitOnL++;
        if (stompedBat(states, LAST_BAT_1)) stompsOnL++;
      }
    }
    expect([hitOnL, stompsOnL]).toEqual([172, 99]);
  });

  it("GDD-WLD-16 3-1 the glide from the crumbling ledge lands short of the patrol bat from the ledge's whole last tile up to column 201.8", () => {
    // Held glides from the crumbling ledge, jump pressed at 199.6 to 202.8 tiles (0.2 apart, running from column 199), at 24 start times on
    // the real level, then standing still for 240 steps. Measured, by take-off: where he lands (the same at every start time), the lives lost
    // within 30 steps of the landing and within the 240.
    const found: string[] = [];
    for (const t of spaced(199.6, 202.8, 0.2)) {
      const lands = new Set<number>();
      let [soon, late] = [0, 0];
      for (const s of STARTS) {
        const p = drive([leap(t, 999), pause(240)], L, at(L, mid(199), Y(42), 120, s));
        const land = landsAt(p);
        if (land) lands.add(land.col);
        const landed = land ? p.states.findIndex((r, k) => k > 0 && r.player.grounded && !p.states[k - 1]!.player.grounded) : -1;
        if (p.lost.length > 0) [soon, late] = [soon + Number(landed < 0 || p.lost[0]! <= landed + 30), late + 1];
      }
      found.push(`${t}: ${[...lands].join()} ${soon} ${late}`);
    }
    // To 201.8 he lands at 209.9 to 212.1, short of the bat, and loses nothing. From 202.0 and 202.2 he lands in its loop. From 202.4 his
    // box is clear of the ledge before the press, so no jump takes off (this drive presses only standing) and he walks off into the gap.
    expect(found).toEqual([
      '199.6: 209.875 0 0', '199.8: 210.125 0 0', '200: 210.25 0 0', '200.2: 210.5 0 0', '200.4: 210.75 0 0', '200.6: 210.875 0 0',
      '200.8: 211.125 0 0', '201: 211.25 0 0', '201.2: 211.5 0 0', '201.4: 211.75 0 0', '201.6: 211.875 0 0', '201.8: 212.125 0 0',
      '202: 212.25 3 24', '202.2: 212.5 8 24', '202.4:  24 24', '202.6:  24 24', '202.8:  24 24',
    ]);
  });

  it('GDD-WLD-16 3-1 a stomp on the patrol bat with jump let go throws him onto the pillar, where he takes the veladora, and the glide from its right end reaches the floor, at every start time that stomps', () => {
    const lv = only(PATROL_BAT, LAST_BAT_1, LAST_BAT_2);
    let stomped = 0;
    for (let s = 0; s < MURCIELAGO.periodSteps; s += 5) {
      const hop = drive([leap(201.6, 999), leap(212.2, 213.4)], lv, at(lv, mid(199), Y(42), 120, s));
      expect(hop.lost, `start ${s}`).toEqual([]);
      if (!stompedBat(hop.states, 0)) continue;
      stomped++;
      expect([hop.run.player.grounded, hop.run.player.y], `start ${s}`).toEqual([true, Y(47)]);
      expect(veladoraUsed(hop.run.lives, L.veladora!), `start ${s}`).toBe(true);
      const on = drive([leap(221.6, 999)], lv, hop.run);
      expect(on.lost, `start ${s}`).toEqual([]);
      expect(on.run.phase === 'clear' || on.run.player.y === Y(48), `start ${s}`).toBe(true);
    }
    // Measured: the hop stomps it at 21 of the 48 start times, 5 steps apart.
    expect(stomped).toBe(21);
  });

  it('GDD-WLD-16 3-1 the last glide: without the glide he does not arrive', () => {
    for (const states of plainJumps(217 * TILE, 43)) {
      const end = states[states.length - 1]!;
      expect(end.phase === 'respawning' || (end.player.grounded && end.player.x < 227 * TILE), `from ${states[0]!.player.x}`).toBe(true);
    }
  });

  it('GDD-LIFE-03 3-1 the secret: walking off the last lip with jump up drops him onto the pillar at column 219.4 and takes the veladora; from the pillar a held glide lands at 231.9; neither bat reaches that line at 24 start times', () => {
    const off = play(quiet, { ...at(quiet, mid(214), Y(43), 120), lives: { ...startRun(quiet).lives, lives: 5 } }, 200, () => ({ move: 1, jumpHeld: false }), (r, k) => k > 2 && r.player.grounded && r.player.y !== Y(43));
    const down = off[off.length - 1]!;
    expect(down.player.y).toBe(Y(47));
    expect(Math.abs(down.player.x / TILE - 219.4)).toBeLessThanOrEqual(0.1);
    expect(veladoraUsed(down.lives, L.veladora!)).toBe(true);
    expect(down.lives.lives).toBe(6);
    const glide = landsAt(drive([leap(221.6, 999)], quiet, at(quiet, mid(218), Y(47), 120)))!;
    expect(glide.y).toBe(Y(48));
    expect(Math.abs(glide.col - 231.9)).toBeLessThanOrEqual(0.1);
    const bats = only(LAST_BAT_1, LAST_BAT_2);
    for (const s of STARTS) {
      expect(drive([leap(221.6, 999)], bats, at(bats, mid(218), Y(47), 120, s)).lost, `glide, start ${s}`).toEqual([]);
      // Nor the line of the plain running jumps that reach the floor (the tests below): pressed at 3556, 3561 and 3566.
      for (const press of [3556, 3561, 3566]) {
        const jump = plainFrom({ ...bats, abilities: {} }, at(bats, mid(218), Y(47), 120, s), press).land;
        expect([jump.phase, jump.player.y], `jump from ${press}, start ${s}`).toEqual(['playing', Y(48)]);
      }
      // Walking off the lip onto the pillar, then on with a glide from its right end, costs no life.
      const offLip = drive([run(1, standsAt(47, 217, 221)), leap(221.6, 999)], bats, at(bats, mid(214), Y(43), 120, s));
      expect(offLip.lost, `off the lip, start ${s}`).toEqual([]);
      expect(offLip.run.phase === 'clear' || offLip.run.player.y === Y(48), `off the lip, start ${s}`).toBe(true);
    }
    // On the real level: the glide from the pillar loses nothing (the patrol bat comes within 43 px); the walk off the lip starts in the
    // patrol bat's loop (column 214), which hits him at 17 of 24 start times, with the glide after it or without.
    expect(lostOnL((s) => drive([leap(221.6, 999)], L, at(L, mid(218), Y(47), 120, s)).states)).toEqual([]);
    const patrolled = [0, 10, 20, 30, 40, 50, 60, 70, 80, 160, 170, 180, 190, 200, 210, 220, 230];
    expect(lostOnL((s) => play(L, at(L, mid(214), Y(43), 120, s), 200, () => ({ move: 1, jumpHeld: false }), (r, k) => k > 2 && r.player.grounded && r.player.y !== Y(43)))).toEqual(patrolled);
    expect(lostOnL((s) => drive([run(1, standsAt(47, 217, 221)), leap(221.6, 999)], L, at(L, mid(214), Y(43), 120, s)).states)).toEqual(patrolled);
  });
});

/** The second ofrenda, where a life lost in Ten respawns him. */
const OFRENDA_2 = L.ofrendas[1]!;
/** The middle gallery, right to left, and down its shaft at 136 to 138 onto the lower gallery's floor. */
const throughMiddle = (): Ctl => run(-1, standsAt(38, 136, 152));
/** A hop from a stand towards level x `x`, braking past it, jump held for 12 steps; done once he stands still. */
const hopTo = (x: number): Ctl => (r, t) => ({ input: { move: r.player.x < x - 2 ? 1 : r.player.x > x + 2 ? -1 : 0, jumpHeld: t < 12 }, done: t > 3 && r.player.grounded && r.player.vx === 0 });
/**
 * The low road from F1 under L1: a run right, a stop before F1's rock (column 150, row 24) and a hop onto its middle; then on along F1, off
 * its end down the shaft onto F2, and the middle gallery.
 */
const lowRoad = (): Ctl[] => [run(1, (r) => r.player.x >= 148 * TILE), wait((r) => r.player.vx === 0), hopTo(mid(150)), run(1, standsAt(31, 150, 160)), throughMiddle()];
/** GDD-WLD-16's route from the second ofrenda's rest to the lower gallery: the stone, L1, L2, the glide along F1 into the shaft, the middle gallery. */
const routeTen = (): Ctl[] => [leap(133.0, 133.6), leap(135.6, 138.4), leap(141.6, 144.4), leap(147.6, 999), throughMiddle()];
/** From the lower gallery on: the pen, the ledges over the pit, the Ketsu ledge, the patrol bat, the last glide. */
const routeLower = (): Ctl[] => [leap(151.6, 152.4), leap(153.6, 999), leap(168.6, 172.2), leap(174.6, 178.4), leap(181.6, 999)];
/** Runs to the exit, whichever side of it he is on, until the level is clear. */
const finish = (): Ctl => (r) => ({ input: { move: Math.sign(L.exit!.x - r.player.x) || 1, jumpHeld: false }, done: r.phase !== 'playing' });
/**
 * The route's rule on the pillar: whenever he stands on it (row 47), as after a stomp on the patrol bat whose bounce throws him off the
 * lip, he runs to its right end and holds a glide from x = 221.6 tiles; elsewhere `ctl` plays.
 */
const orPillar = (ctl: Ctl): Ctl => {
  let glide: Ctl | null = null;
  return (r, t) => {
    if (glide === null && r.phase === 'playing' && standsAt(47, 217, 221)(r)) glide = leap(221.6, 999);
    return (glide ?? ctl)(r, t);
  };
};
/** Ketsu: onto the crumbling ledge, the glide past the third ofrenda, the hop at the patrol bat, the last glide; `careful`, it waits first for the last glide's second bat. */
const routeKetsu = (careful = false): Ctl[] => [
  leap(194.6, 199.3),
  leap(201.6, 999),
  leap(212.2, 213.4),
  ...(careful ? [wait(atLoopBottom(LAST_BAT_2))] : []),
  orPillar(leap(216.6, 999)),
  orPillar(finish()),
];
/** Ki: the trench, the stone, the long glide. */
const routeKi = (): Ctl[] => [leap(17.6, 999), leap(36.4, 37.0), leap(39.6, 999)];
/** Shō: the first chasm, onto the pen's first rock and over the pen, the second chasm; `careful`, it waits where it lands past the pen for the first bat's upper half. */
const routeSho = (careful = false): Ctl[] => [
  leap(63.6, 999),
  leap(76.6, 77.6),
  leap(79.6, 999),
  ...(careful ? [wait((s: RunState) => s.enemies[FIRST_BAT]!.loop!.steps % MURCIELAGO.periodSteps === 120)] : []),
  leap(103.6, 999),
];
/**
 * GDD-WLD-16's route bot: it holds the way the path runs, glides the chasms and lets go over the ledges, as the design's list of
 * [jump once standing past this column, hold until past this column (999: until he lands)]; right to left in the middle gallery.
 */
const route = (): Ctl[] => [...routeKi(), ...routeSho(), ...routeTen(), ...routeLower(), ...routeKetsu()];
/** GDD-WLD-16's careful bot: the route, waiting for the two bats that must be read (the first bat, and the last glide's second). */
const careful = (): Ctl[] => [...routeKi(), ...routeSho(true), ...routeTen(), ...routeLower(), ...routeKetsu(true)];
/** The hilos a run has taken, as "col,row". */
const takenHilos = (r: RunState): string[] => L.hilos!.flatMap((h, i) => (r.hilosTaken[i] ? [`${h.col},${h.row}`] : []));
/** A run that starts after `waitSteps` steps standing at the spawn. */
const waited = (waitSteps: number): RunState => {
  let r = startRun(L);
  for (let i = 0; i < waitSteps; i++) r = stepRun(r, idle, L);
  return r;
};

describe('GDD-WLD-16 3-1 played through', () => {
  it('GDD-WLD-16 3-1 the route bot holds the way the path runs, glides the chasms, lets go over the ledges and reaches the exit with seven lives and three ofrendas', () => {
    const p = drive(route());
    expect(p.run.phase).toBe('clear');
    expect(p.lost).toEqual([]);
    expect(p.run.lives.lives).toBe(7);
    expect(p.run.checkpointIndex).toBe(2);
    expect(L.ofrendas.every((o) => p.run.lives.used.has(`ofrenda:${o.id}`))).toBe(true);
    // GDD says 2271 steps (37.9 s). At start time 0 it stomps the patrol bat with jump let go, the bounce throws him onto the pillar (the
    // veladora), and he goes on by the pillar's glide.
    expect(p.states.length).toBeLessThan(2400);
    expect(p.states.length).toBe(2338);
    expect(p.states.some((r) => r.player.grounded && r.player.y === Y(47))).toBe(true);
    expect(veladoraUsed(p.run.lives, L.veladora!)).toBe(true);
    expect(L.enemies.flatMap((_, i) => (stompedBat(p.states, i) ? [i] : []))).toEqual([PATROL_BAT]);
  });

  it('GDD-WLD-04 3-1 the route bot takes the hilos of its path, and every hilo is taken by one of the named runs', () => {
    const names = L.hilos!.map((h) => `${h.col},${h.row}`);
    const missed = (r: RunState) => names.filter((h) => !takenHilos(r).includes(h));
    const p = drive(route());
    // Measured at start time 0: the route bot's count and the hilos it misses.
    expect([takenHilos(p.run).length, missed(p.run)]).toEqual([43, ['7,4', '9,5', '11,6', ...FIRST_HILOS, '215,42', '216,42']]);
    // The route with a held jump on the flat first, from the spawn (the arc).
    const arc = drive([leap(3.9, 999), ...route()]);
    // The careful bot gliding from the last lip (never on the pillar), played with a stop of 2 s at the rest before the cliff face, past
    // the second chasm.
    const c = careful();
    const calm = drive([...c.slice(0, 8), pause(120), ...c.slice(8)]);
    expect([calm.run.phase, calm.lost, calm.states.some((r) => r.player.grounded && r.player.y === Y(47))]).toEqual(['clear', [], false]);
    // The held stomp on the first bat (the next test), on the real level: one that takes both hilos over it.
    const stomp = Array.from({ length: 120 }, (_, i) => i * 2)
      .map((s) => drive([leap(FIRST_COL - 4, 999)], L, at(L, mid(FIRST_COL - 5), Y(15), 120, s)))
      .find((q) => stompedBat(q.states, FIRST_BAT) && FIRST_HILOS.every((h) => takenHilos(q.run).includes(h)))!;
    const none = names.filter((h) => [p, arc, calm, stomp].every((q) => !takenHilos(q.run).includes(h)));
    expect(none).toEqual([]);
  });

  it('GDD-CMB-01 3-1 a held stomp bounce on the first bat takes both hilos over it', { timeout: 60000 }, () => {
    const lv = only(FIRST_BAT);
    const stomps = Array.from({ length: 120 }, (_, i) => i * 2)
      .map((s) => drive([leap(FIRST_COL - 4, 999)], lv, at(lv, mid(FIRST_COL - 5), Y(15), 120, s)))
      .filter((p) => stompedBat(p.states, 0));
    // Running jumps 4 tiles before the bat's column, held, at every other step of its loop: those that come down on it.
    const both = stomps.filter((p) => FIRST_HILOS.every((h) => takenHilos(p.run).includes(h)));
    expect(both.length).toBeGreaterThan(0);
    // Measured: 47 held stomps in 120 start times, 9 of which take both (those that come down on it furthest left; the later ones rise
    // past the bat's column before they reach the hilos' rows).
    expect([stomps.length, both.length]).toEqual([47, 9]);
    // On the real level: the same 47 and 9.
    const onL = Array.from({ length: 120 }, (_, i) => i * 2)
      .map((s) => drive([leap(FIRST_COL - 4, 999)], L, at(L, mid(FIRST_COL - 5), Y(15), 120, s)))
      .filter((p) => stompedBat(p.states, FIRST_BAT));
    expect([onL.length, onL.filter((p) => FIRST_HILOS.every((h) => takenHilos(p.run).includes(h))).length]).toEqual([47, 9]);
  });

  it('GDD-WLD-16 3-1 a careful bot that waits for the two bats that must be read reaches the exit with seven lives at every one of 24 start times', { timeout: 120000 }, () => {
    for (const s of STARTS) {
      const p = drive(careful(), L, waited(s));
      expect([p.run.phase, p.lost, p.run.lives.lives], `start ${s}`).toEqual(['clear', [], 7]);
    }
  });

  it('GDD-WLD-16 3-1 with three stops of 1 s it still arrives with seven lives', () => {
    const c = careful();
    // Stops of 60 steps: where the long glide lands, where the second chasm's glide lands, and on the lower gallery's floor.
    const stops = [...c.slice(0, 3), pause(60), ...c.slice(3, 8), pause(60), ...c.slice(8, 13), pause(60), ...c.slice(13)];
    const p = drive(stops);
    expect([p.run.phase, p.lost, p.run.lives.lives]).toEqual(['clear', [], 7]);
    // GDD says 2453 steps (40.9 s) with three stops; measured with the careful bot's waits for the two bats, 2725 (45.4 s).
    expect(p.states.length).toBe(2725);
  });

  it('GDD-WLD-16 3-1 no fall leaves him where he cannot go on', () => {
    // From the trench: out by the step, back for a run-up, and on.
    // Each bot waits for the two bats that must be read, as the careful bot does.
    const trench = drive([leap(19.6, 999, -1), leap(18.6, 999, -1), run(-1, (r) => r.player.x < 12 * TILE), ...careful()], L, at(L, mid(21), Y(13)));
    // From F1 under the ledges: the low road, onto F1's rock, into the shaft and the middle gallery (the next test).
    const f1 = drive([...lowRoad(), ...routeLower(), ...routeKetsu(true)], L, at(L, mid(140), Y(25)));
    // Through the middle gallery's floor: standing on it until it goes.
    const floor = drive([wait((r) => r.player.y === Y(38) && r.player.grounded), ...routeLower(), ...routeKetsu(true)], L, at(L, mid(147), Y(31)));
    // Down both shafts: the route itself drops from F1 onto F2 and from F2 onto the lower gallery's floor, as the low road does.
    for (const [name, p] of [['trench', trench], ['F1', f1], ['floor', floor]] as const) expect([p.run.phase, p.lost], name).toEqual(['clear', []]);
  });

  it('GDD-WLD-16 3-1 the low road under L1 and L2 reaches the lower gallery with every life', () => {
    // From a miss of L1 onto F1 (standing under it), at 24 start times: onto the rock at 150, off F1's end into the shaft, and on to the
    // lower gallery's floor, every life kept.
    for (const s of STARTS) {
      const p = drive(lowRoad(), L, at(L, mid(140), Y(25), 0, s));
      expect(p.lost, `start ${s}`).toEqual([]);
      expect(p.states.some((r) => r.player.grounded && r.player.y === Y(24) && Math.floor(r.player.x / TILE) === 150), `start ${s}`).toBe(true);
      expect(standsAt(38, 136, 152)(p.run), `start ${s}`).toBe(true);
    }
  });

  it('GDD-WLD-16 3-1 the longest replay: from the pit of Ten he respawns at the second ofrenda and is back at the gallery edge in 531 steps (8.9 s)', () => {
    const from: RunState = { ...at(L, mid(172), Y(39), 120), checkpoint: { x: OFRENDA_2.x, y: OFRENDA_2.y }, checkpointIndex: 1 };
    const p = drive([leap(174.6, 999), (r) => ({ input: idle, done: r.phase === 'playing' }), ...routeTen(), run(1, (r) => r.player.x >= 168 * TILE)], L, from);
    expect(p.lost).toHaveLength(1);
    // The step he is back in play, at the second ofrenda, and the step he reaches the gallery's edge.
    const back = p.marks[1]! - 1;
    expect([p.states[back]!.player.x, p.states[back]!.player.y]).toEqual([OFRENDA_2.x, OFRENDA_2.y]);
    const edge = p.marks[p.marks.length - 1]! - 1;
    expect(p.states[edge]!.player.y).toBe(Y(38));
    // GDD says 10.0 s; measured 531 steps (8.9 s).
    expect(edge - back).toBeLessThan(15 * 60);
    expect(edge - back).toBe(531);
  });

  it('GDD-PRG-01 3-1 is laid out for the glide: with the glide taken away the level cannot be finished', () => {
    // With its own abilities a held glide crosses the first chasm; without the glide no jump does (the first chasm's test), and the
    // careful bot never reaches the exit.
    expect(landsAt(drive([leap(63.6, 999)], L, at(L, mid(58), Y(13), 120)))!.y).toBe(Y(15));
    for (const states of plainJumps(64 * TILE, 13)) expect(states[states.length - 1]!.phase, `from ${states[0]!.player.x}`).toBe('respawning');
    expect(drive(careful(), { ...L, abilities: {} }).run.phase).not.toBe('clear');
  });
});
