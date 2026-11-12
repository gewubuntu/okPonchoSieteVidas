import { describe, expect, it } from 'vitest';
import { ARMADILLO, STEP } from '../config/tuning';
import { kick, tuckLeft, tuckRed, type Shell } from './armadillo';
import type { Rail } from './cart';
import { enemyBox, enemyPhase, freshEnemies, stepEnemy, type Enemy, type EnemyState } from './enemy';
import type { Fireball } from './fireball';
import { spawn, type PlayerInput, type PlayerState } from './movement';
import { startRun, stepRun, type Level, type RunState } from './run';
import { parseTiles, type TileGrid } from './tilemap';

// GDD-ENM-04: the Armadillo. The expected numbers are the GDD's: a 16 x 12 px box standing on its feet; it walks at 20 px/s; it is startled
// within 80 px across, either side, and 24 px up or down; it tucks for 30 steps, flashing 4 on and 4 off; it rolls at 130 px/s on the level,
// 160 downhill and 100 uphill, measured along the ground; a wall leaves it dazed 60 steps, kicking in the last 30; it falls as Poncho falls
// (GDD-MOV-04: 2250 px/s², halved under 40 px/s, at most 360 px/s); a stomp bounces at 260 px/s, 410 with jump held (GDD-CMB-01).
const idle: PlayerInput = { move: 0, jumpHeld: false };
const hold: PlayerInput = { move: 0, jumpHeld: true };

const armadillo = (x: number, y: number): Enemy => ({ x, y, kind: 'armadillo' });
const shell = (o: Partial<Shell> = {}): Shell => ({ phase: 'walk', age: 0, vy: 0, vx: 0, ...o });
/** An Armadillo's state at x, its feet at y, facing `dir`, with the shell given. */
const at = (x: number, y: number, dir: 1 | -1, o: Partial<Shell> = {}): EnemyState => ({ x, y, dir, alive: true, shell: shell(o) });
const standing = (x: number, y = 160): PlayerState => ({ ...spawn(x, y), grounded: true });
const falling = (x: number, y: number, vy = 150): PlayerState => ({ ...spawn(x, y), vy, grounded: false });
/** Poncho far from everything: he never startles it. */
const away = standing(5000, 5000);
const steps = (def: Enemy, s: EnemyState, world: TileGrid, n: number, p: PlayerState = away): EnemyState[] => {
  const out: EnemyState[] = [];
  for (let i = 0; i < n; i++) out.push((s = stepEnemy(def, s, world, p)));
  return out;
};
const last = <T>(xs: readonly T[]): T => xs[xs.length - 1]!;
/** How far it went along the ground, in a straight line, from `a` to where it is in `b`. */
const along = (a: { x: number; y: number }, b: EnemyState): number => Math.hypot(b.x - a.x, b.y! - a.y);
/** Rows of tiles from a function of (column, row). */
const grid = (cols: number, rows: number, f: (c: number, r: number) => string): TileGrid =>
  parseTiles(Array.from({ length: rows }, (_row, r) => Array.from({ length: cols }, (_col, c) => f(c, r)).join('')));

// A floor at row 10 (its top y = 160) from column 0 to 19, so its right end (a ledge) is at x = 320; below it open air to the level's
// bottom (row 12, y = 192). A wall in column 2, rows 8 and 9 (x 32 to 48).
const pen = grid(24, 12, (c, r) => (r >= 10 && c < 20 ? '#' : (r === 8 || r === 9) && c === 2 ? '#' : '.'));
const DEF = armadillo(100, 160);

describe('GDD-ENM-04 the Armadillo walks', () => {
  it('GDD-ENM-04 the Armadillo walks at 20 px/s, turns at a wall and at a ledge\'s end, follows a slope', () => {
    expect(freshEnemies([DEF])).toEqual([{ x: 100, dir: 1, alive: true, shell: { phase: 'walk', age: 0, vy: 0, vx: 0 } }]);
    expect(enemyBox(DEF, freshEnemies([DEF])[0]!)).toEqual({ x0: 92, x1: 108, y0: 148, y1: 160 });
    expect(last(steps(DEF, freshEnemies([DEF])[0]!, pen, 30)).x).toBeCloseTo(100 + 10, 9);
    // Back and forth: its leading edge never passes the ledge at x = 320, and it turns flush against the wall's right face (48).
    const walked = steps(DEF, freshEnemies([DEF])[0]!, pen, 4000);
    expect(Math.max(...walked.map((s) => s.x))).toBeLessThanOrEqual(320 - 8 + 1e-6);
    expect(Math.max(...walked.map((s) => s.x))).toBeGreaterThan(320 - 8 - 0.34);
    expect(Math.min(...walked.map((s) => s.x))).toBe(48 + 8);
    expect(walked.every((s) => s.y === 160 && s.alive && s.shell!.phase === 'walk')).toBe(true);
    // A 45 degree slope rising right in column 10 (x 160 to 176) from the floor at y = 160 to a plateau at y = 144: the middle of its feet
    // on the slope's surface, y = 160 - (x - 160), all the way up, and on the plateau after it.
    const hill = grid(30, 12, (c, r) => (r >= 10 || (r === 9 && c > 10) ? '#' : r === 9 && c === 10 ? '/' : '.'));
    const climb = steps(armadillo(140, 160), at(140, 160, 1), hill, 150);
    const onSlope = climb.filter((s) => s.x > 160 && s.x < 176);
    expect(onSlope.length).toBeGreaterThan(40);
    for (const s of onSlope) expect(s.y!).toBeCloseTo(160 - (s.x - 160), 9);
    expect(last(climb).y).toBe(144);
    expect(last(climb).x).toBeCloseTo(140 + 50, 9);
  });
});

/** Its first step on `pen` (or a step from `s`) with Poncho at `p`, and whether that step startles it. */
const after = (p: PlayerState, s: EnemyState = freshEnemies([DEF])[0]!): EnemyState => stepEnemy(DEF, s, pen, p);
const startled = (p: PlayerState, s?: EnemyState): boolean => after(p, s).shell!.phase === 'tuck';

describe('GDD-ENM-04 the Armadillo is startled', () => {
  // After one step it is at x1, its feet at y = 160. Poncho's hurtbox centre is at his x.
  const x1 = 100 + 20 * STEP;

  it('GDD-ENM-04 the Armadillo is startled within 80 px across and 24 px up or down, from either side, and not from 81 px or 25 px', () => {
    // Across, on either side.
    expect(startled(standing(x1 + 80))).toBe(true);
    expect(startled(standing(x1 + 81))).toBe(false);
    expect(startled(standing(x1 - 80))).toBe(true);
    expect(startled(standing(x1 - 81))).toBe(false);
    // Up and down, his feet against its feet.
    expect(startled(standing(x1 + 40, 160 - 24))).toBe(true);
    expect(startled(standing(x1 + 40, 160 - 25))).toBe(false);
    expect(startled(standing(x1 + 40, 160 + 24))).toBe(true);
    expect(startled(standing(x1 + 40, 160 + 25))).toBe(false);
    // A Poncho 32 px above it on a ledge does not startle it.
    expect(startled(standing(x1 + 40, 160 - 32))).toBe(false);
    // It stops and turns to face him: behind it (it heads right) it turns left; in front it keeps facing right.
    const behind = after(standing(x1 - 40));
    expect(behind).toMatchObject({ x: x1, dir: -1, shell: { phase: 'tuck', age: 0 } });
    expect(after(standing(x1 + 40))).toMatchObject({ x: x1, dir: 1, shell: { phase: 'tuck', age: 0 } });
    // It is still while it tucks.
    expect(stepEnemy(DEF, behind, pen, standing(x1 - 40)).x).toBe(x1);
    // Not while it rolls or lies dazed: only a walking one is startled.
    expect(after(standing(140), at(100, 160, 1, { phase: 'roll', vx: 130 })).shell!.phase).toBe('roll');
    expect(after(standing(140), at(100, 160, 1, { phase: 'dazed', age: 5 })).shell!.phase).toBe('dazed');
    expect(enemyPhase(behind)).toBe('tuck');
  });
});

describe('GDD-ENM-04 the Armadillo tucks and rolls', () => {
  it('GDD-ENM-04 the Armadillo tucks for exactly 30 steps, flashing 4 on and 4 off, then rolls the way it faced', () => {
    // Startled by a Poncho 40 px in front of it (to its right). Then he moves to its other side, 40 px behind it, for the whole tuck.
    const x1 = 100 + 20 * STEP;
    const tucked = stepEnemy(DEF, freshEnemies([DEF])[0]!, pen, standing(x1 + 40));
    const run = [tucked, ...steps(DEF, tucked, pen, 40, standing(x1 - 40))];
    const phases = run.map((s) => s.shell!.phase);
    expect(phases.slice(0, 30).every((p) => p === 'tuck')).toBe(true);
    expect(phases.slice(30).every((p) => p === 'roll')).toBe(true);
    expect(run.slice(0, 30).every((s) => s.x === x1 && s.dir === 1)).toBe(true);
    // The flash, from the steps of the tuck left (30 on its first step): red on steps 0 to 3, plain 4 to 7, red 8 to 11, and so on.
    expect(run.slice(0, 30).map((s) => tuckLeft(s.shell!))).toEqual(Array.from({ length: 30 }, (_, i) => 30 - i));
    expect(run.slice(0, 30).map((s) => tuckRed(tuckLeft(s.shell!)))).toEqual(Array.from({ length: 30 }, (_, i) => Math.floor(i / 4) % 2 === 0));
    // It rolls the way it faced when the tuck began (right), from the step after the tuck, at 130 px/s, though he is behind it.
    expect(run[30]!.x).toBeCloseTo(x1 + 130 * STEP, 9);
    expect(run.slice(30).every((s) => s.dir === 1)).toBe(true);
    expect(run[40]!.x).toBeCloseTo(x1 + 11 * 130 * STEP, 9);
  });

  // Hand trace (L-077): the Armadillo starts at x = 100 walking right, Poncho stands at x = 180 (his hurtbox x 175 to 185). Step 1 walks it
  // to 100.33, 79.67 px from him: startled, the first flash (count 0). Steps 1 to 30 are its 30 tuck steps; from step 31 it rolls 130/60 =
  // 2.1667 px a step, so after step 30 + j it is at 100.33 + 2.1667 j, its front edge at 108.33 + 2.1667 j. It touches his hurtbox (x 175)
  // once 2.1667 j > 66.67, j = 31: step 61, 60 steps after the first flash (1.0 s; the GDD's 1.1 s is 0.5 s and 80 px at 130 px/s middle to
  // middle, and the boxes meet 13 px sooner).
  it('GDD-ENM-04 the Armadillo hits a standing Poncho 80 px away 60 steps after its first flash', () => {
    const level = levelOn(flat, [DEF]);
    let r = withPlayer(level, standing(180));
    let flash = -1;
    let hit = -1;
    for (let i = 1; i <= 200 && hit < 0; i++) {
      r = stepRun(r, idle, level);
      if (flash < 0 && r.enemies[0]!.shell!.phase === 'tuck') flash = i;
      if (r.lives.lives < 7) hit = i;
    }
    expect(flash).toBe(1);
    expect(hit - flash).toBe(60);
  });

  it('GDD-ENM-04 the Armadillo rolls at 130 px/s on the level, 160 down a slope and 100 up it, measured along the ground', () => {
    // On the level: 130 px over 60 steps.
    const level = steps(DEF, at(60, 160, 1, { phase: 'roll' }), flat, 60);
    expect(along({ x: 60, y: 160 }, last(level))).toBeCloseTo(130, 6);
    expect(level.every((s) => s.y === 160)).toBe(true);
    // A 45 degree descent going right from a plateau at y = 48 (columns 0 to 9) down to y = 176 (from column 18): its surface y = 48 + (x - 160)
    // for x 160 to 288. Started on it at x = 161, 60 steps down it: 160 px along; and 60 steps back up it from x = 274: 100 px along.
    const down = steps(armadillo(161, 49), at(161, 49, 1, { phase: 'roll' }), steep, 60);
    expect(down.every((s) => Math.abs(s.y! - (48 + (s.x - 160))) < 1e-6)).toBe(true);
    expect(along({ x: 161, y: 49 }, last(down))).toBeCloseTo(160, 6);
    const up = steps(armadillo(274, 162), at(274, 162, -1, { phase: 'roll' }), steep, 60);
    expect(up.every((s) => Math.abs(s.y! - (48 + (s.x - 160))) < 1e-6)).toBe(true);
    expect(along({ x: 274, y: 162 }, last(up))).toBeCloseTo(100, 6);
    // A gentle descent (half a tile down per tile across) from y = 48 at x = 160: its surface y = 48 + (x - 160) / 2. Down from x = 161 and
    // back up from x = 300, 60 steps each: 160 and 100 px along.
    const gdown = steps(armadillo(161, 48.5), at(161, 48.5, 1, { phase: 'roll' }), gentle, 60);
    expect(gdown.every((s) => Math.abs(s.y! - (48 + (s.x - 160) / 2)) < 1e-6)).toBe(true);
    expect(along({ x: 161, y: 48.5 }, last(gdown))).toBeCloseTo(160, 6);
    const gup = steps(armadillo(300, 118), at(300, 118, -1, { phase: 'roll' }), gentle, 60);
    expect(gup.every((s) => Math.abs(s.y! - (48 + (s.x - 160) / 2)) < 1e-6)).toBe(true);
    expect(along({ x: 300, y: 118 }, last(gup))).toBeCloseTo(100, 6);
    // Across the joins, from the plateau onto the descent and from its foot onto the level again: on each step it moves across at the speed
    // of the ground under the middle of its feet at the step's start, the level's 130 px/s or the descent's 160 / sqrt 2 = 113.14 px/s.
    let prev = at(120, 48, 1, { phase: 'roll' });
    const path = steps(armadillo(120, 48), prev, steep, 120);
    let onIt = 0;
    for (const s of path) {
      const slope = prev.x > 160 && prev.x < 288;
      onIt += slope ? 1 : 0;
      expect((s.x - prev.x) / STEP).toBeCloseTo(slope ? 160 / Math.SQRT2 : 130, 6);
      prev = s;
    }
    expect(onIt).toBeGreaterThan(60);
    expect(last(path).x).toBeGreaterThan(288 + 60);
    expect(last(path).y).toBe(176);
  });

  it('GDD-ENM-04 the Armadillo dazed by a wall 60 steps, kicking in the last 30, then walks away from the wall', () => {
    // Rolling left at the wall in column 2 (its right face at x = 48): it stops flush against it, its middle at 56.
    const run = steps(DEF, at(70, 160, -1, { phase: 'roll' }), pen, 100);
    const hitAt = run.findIndex((s) => s.shell!.phase === 'dazed');
    expect(run[hitAt]!.x).toBe(56);
    const dazed = run.slice(hitAt, hitAt + 60);
    expect(dazed.every((s) => s.shell!.phase === 'dazed' && s.x === 56)).toBe(true);
    expect(dazed.map((s) => kick(s.shell!))).toEqual(Array.from({ length: 60 }, (_, i) => i >= 30));
    // Then it walks, away from the wall (right), at 20 px/s.
    expect(run[hitAt + 60]!.shell!.phase).toBe('walk');
    expect(run[hitAt + 60]!.dir).toBe(1);
    expect(run[hitAt + 60]!.x).toBeCloseTo(56 + 20 * STEP, 9);
    // A Poncho in its reach is ignored while it lies dazed, and startles it on its first walking step.
    const last59 = run[hitAt + 59]!;
    expect(stepEnemy(DEF, run[hitAt + 58]!, pen, standing(100)).shell!.phase).toBe('dazed');
    expect(stepEnemy(DEF, last59, pen, standing(100))).toMatchObject({ dir: 1, shell: { phase: 'tuck', age: 0 } });
  });

  // Hand trace (L-077): a ledge 3 tiles over the floor, its top y = 112 to x = 160, the floor at y = 160. Rolling right from x = 100, 2.1667
  // px a step, it rolls on while its box is over the ledge (x - 8 < 160): after step n it is at 100 + 2.1667 n, and step 32 (x = 169.33) is
  // the first with its box clear of it, so it falls from that step: 18.75 px/s after it (gravity halved under 40 px/s), then 37.5, 56.25,
  // 93.75 and on by 37.5 a step to 360. Its feet drop 0.16, 0.47, 0.78, 1.25, 1.88, 2.5, 3.13, 3.75, 4.38, 5, 5.63, 5.97, 6, 6 px: 46.88 px
  // after 14 steps (step 45), and step 46 would take them to 52.88: it lands on the floor (y = 160) on step 46, at x = 100 + 46 x 2.1667 =
  // 199.67, still rolling right.
  it('GDD-ENM-04 the Armadillo rolls off a ledge\'s end, falls keeping its speed across, and rolls on where it lands', () => {
    const run = steps(armadillo(100, 112), at(100, 112, 1, { phase: 'roll' }), ledge, 80);
    const air = run.map((s, i) => (s.y! > 112 && s.y! < 160 ? i + 1 : 0)).filter(Boolean);
    expect(air[0]).toBe(32);
    expect(last(air)).toBe(45);
    expect(run[45]).toMatchObject({ y: 160, dir: 1, alive: true, shell: { phase: 'roll', vy: 0 } });
    expect(run[45]!.x).toBeCloseTo(100 + 46 * 130 * STEP, 9);
    // Across it keeps 130 px/s all the way, in the air too, and on along the floor.
    for (let i = 1; i < 80; i++) expect((run[i]!.x - run[i - 1]!.x) / STEP).toBeCloseTo(130, 6);
    expect(run.slice(45).every((s) => s.y === 160 && s.shell!.phase === 'roll')).toBe(true);
    // Off the level's bottom (row 12, y = 192): the same ledge over a pit. Gone once its box is wholly below y = 192, and still gone 600 steps on.
    const out = steps(armadillo(100, 112), at(100, 112, 1, { phase: 'roll' }), cliff, 700);
    const gone = out.findIndex((s) => !s.alive);
    expect(gone).toBeGreaterThan(31);
    expect(out[gone]!.y! - 12).toBeGreaterThan(192);
    expect(out[gone - 1]!.y! - 12).toBeLessThanOrEqual(192);
    expect(out.slice(gone).every((s) => !s.alive)).toBe(true);
  });
});

// Worlds for the rolls. `flat`: a floor at row 10 (y = 160) across 40 columns, walls at both ends of the level.
const flat = grid(40, 12, (_c, r) => (r >= 10 ? '#' : '.'));
// `steep`: a plateau at row 3 (y = 48) for columns 0 to 9, a 45 degree descent going right in columns 10 to 17 ('\' in rows 3 to 10, each on
// solid tiles), then a floor at row 11 (y = 176).
const steep = grid(40, 13, (c, r) => {
  if (c < 10) return r >= 3 ? '#' : '.';
  if (c < 18) return r === 3 + (c - 10) ? '\\' : r > 3 + (c - 10) ? '#' : '.';
  return r >= 11 ? '#' : '.';
});
// `gentle`: the same plateau, then a gentle descent, 'F' then 'f' in each row from row 3, for columns 10 to 21 (x 160 to 352), y = 48 + (x - 160) / 2.
const gentle = grid(40, 13, (c, r) => {
  if (c < 10) return r >= 3 ? '#' : '.';
  if (c < 22) {
    const row = 3 + Math.floor((c - 10) / 2);
    return r === row ? ((c - 10) % 2 === 0 ? 'F' : 'f') : r > row ? '#' : '.';
  }
  return r >= 9 ? '#' : '.';
});
// `ledge`: a block 3 tiles over the floor, columns 0 to 9, rows 7 to 9 (its top y = 112, its face x = 160), on a floor at row 10 (y = 160).
const ledge = grid(40, 12, (c, r) => (r >= 10 || (r >= 7 && c < 10) ? '#' : '.'));
// `cliff`: the same block with nothing under its right, open to the level's bottom (12 rows, y = 192).
const cliff = grid(40, 12, (c, r) => (r >= 7 && c < 10 ? '#' : '.'));

const levelOn = (world: TileGrid, enemies: readonly Enemy[], o: Partial<Level> = {}): Level => ({
  world,
  spawn: { x: 24, y: 160 },
  ofrendas: [],
  spikes: [],
  crumbles: [],
  springs: [],
  platforms: [],
  tacos: [],
  pinatas: [],
  doors: [],
  keys: [],
  fragiles: [],
  enemies,
  abilities: { glide: false, wallCling: false },
  ...o,
});
const withPlayer = (level: Level, player: PlayerState, extra: Partial<RunState> = {}): RunState => ({ ...startRun(level), player, ...extra });
const play = (level: Level, r: RunState, n: number, input: PlayerInput = idle): RunState => {
  for (let i = 0; i < n; i++) r = stepRun(r, input, level);
  return r;
};

describe('GDD-ENM-04 the Armadillo and the level', () => {
  it('GDD-ENM-04 a lost life brings the Armadillo back at its start, walking right, also one that rolled out of the level', () => {
    // It rolls off the cliff and out of the level while Poncho stands behind it on the cliff top; then he steps on a spike at column 2.
    const def = armadillo(100, 112);
    const level = levelOn(cliff, [def], { spawn: { x: 40, y: 112 }, spikes: [{ col: 2, row: 6 }] });
    let r = withPlayer(level, standing(70, 112), { enemies: [at(120, 112, 1, { phase: 'roll' })] });
    r = play(level, r, 120);
    expect(r.lives.lives).toBe(7);
    expect(r.enemies[0]!.alive).toBe(false);
    r = play(level, { ...r, player: standing(40, 112) }, 1);
    expect(r.phase).toBe('respawning');
    // While he is lost, nothing steps: it stays gone.
    expect(r.enemies[0]!.alive).toBe(false);
    for (let i = 0; i < 600 && r.phase === 'respawning'; i++) r = play(level, r, 1);
    expect(r.phase).toBe('playing');
    expect(r.enemies[0]).toEqual({ x: 100, dir: 1, alive: true, shell: { phase: 'walk', age: 0, vy: 0, vx: 0 } });
    // And one stomped while dazed stays defeated until then too.
    const lvl = levelOn(flat, [DEF], { spikes: [{ col: 30, row: 9 }] });
    let s = withPlayer(lvl, falling(100, 147, 150), { enemies: [at(100, 160, -1, { phase: 'dazed' })] });
    s = play(lvl, s, 2);
    expect(s.enemies[0]!.alive).toBe(false);
    s = play(lvl, { ...s, player: standing(488) }, 1);
    for (let i = 0; i < 600 && s.phase === 'respawning'; i++) s = play(lvl, s, 1);
    expect(s.enemies[0]).toEqual({ x: 100, dir: 1, alive: true, shell: { phase: 'walk', age: 0, vy: 0, vx: 0 } });
  });

  it('GDD-ENM-04 the Armadillo does not set off a crumbling tile, walking or rolling, and falls when its tile goes', () => {
    // A row of crumbling tiles in row 10, columns 8 to 15 (x 128 to 256), in the floor. It walks and rolls across them: none is set off.
    const crumbles = Array.from({ length: 8 }, (_, i) => ({ col: 8 + i, row: 10 }));
    const floor = grid(40, 12, (c, r) => (r >= 10 && !(r === 10 && c >= 8 && c < 16) ? '#' : '.'));
    const walker = levelOn(floor, [armadillo(140, 160)], { crumbles });
    const walked = play(walker, withPlayer(walker, standing(600)), 900);
    expect(walked.crumbles.every((c) => c.phase === 'idle')).toBe(true);
    expect(walked.enemies[0]!.y ?? 160).toBe(160);
    const rolled = play(walker, withPlayer(walker, standing(600), { enemies: [at(100, 160, 1, { phase: 'roll' })] }), 80);
    expect(rolled.crumbles.every((c) => c.phase === 'idle')).toBe(true);
    expect(rolled.enemies[0]!.x).toBeGreaterThan(256);
    // A tile gone under it: the one it walks on (column 9, x 144 to 160) goes on this step, the others with it, and it falls.
    const going = crumbles.map(() => ({ phase: 'warning' as const, steps: 1 }));
    const fell = play(walker, withPlayer(walker, standing(600), { crumbles: going, enemies: [at(152, 160, 1)] }), 10);
    expect(fell.enemies[0]!.y!).toBeGreaterThan(160);
    expect(fell.enemies[0]!.x).toBeCloseTo(152 + 20 * STEP, 9); // it walked on the step the tile went, then only falls
    // Rolling, it drops into the hole the gone tiles leave, onto row 11 (y = 176), and the hole's far side (x = 256) stops it there.
    const hole = play(walker, withPlayer(walker, standing(600), { crumbles: going, enemies: [at(100, 160, 1, { phase: 'roll' })] }), 100);
    expect(hole.enemies[0]).toMatchObject({ x: 256 - 8, y: 176, alive: true, shell: { phase: 'dazed' } });
  });

  it('GDD-ENM-04 the Armadillo passes a buffer and rolls under or through a cart that stands', () => {
    // A rail on the floor from x = 160, 6 tiles, ending in a buffer at x = 256 (its block in column 16); its cart stands at its start (x 160
    // to 192). The ball rolls right from x = 100 through the cart and past the buffer, to the level's right wall (x = 640).
    const rail: Rail = { x: 160, y: 160, dir: 1, segments: [{ kind: 'level', tiles: 6 }], end: 'buffer' };
    const level = levelOn(flat, [armadillo(100, 160)], { rails: [rail] });
    let r = withPlayer(level, standing(30), { enemies: [at(100, 160, 1, { phase: 'roll' })] });
    const xs: number[] = [];
    for (let i = 0; i < 400 && r.enemies[0]!.shell!.phase === 'roll'; i++) {
      r = stepRun(r, idle, level);
      xs.push(r.enemies[0]!.x);
    }
    for (let i = 1; i < xs.length - 1; i++) expect((xs[i]! - xs[i - 1]!) / STEP).toBeCloseTo(130, 6);
    expect(r.enemies[0]).toMatchObject({ x: 640 - 8, alive: true, shell: { phase: 'dazed' } });
    expect(r.carts[0]).toEqual({ phase: 'waiting', m: 16 });
    expect(r.lives.lives).toBe(7);
  });
});


// Meeting it, by state (GDD-ENM-04, GDD-CMB-01 to GDD-CMB-03, GDD-PWR-03, GDD-WLD-15). It stands on the floor of `flat` at x = 200 (its box
// x 192 to 208, y 148 to 160). From below it cannot be met: it stands on a floor a tile thick, and a ball in the air is met from the side or
// from above. A Poncho near enough to touch, stomp or claw a walking one startles it in that same step (its step comes first), so those meet
// its tuck's first step, which the GDD treats alike; a fireball and a rolling cart reach it walking, with Poncho far off.
const DEF2 = armadillo(200, 160);
const onFlat = (o: Partial<Level> = {}): Level => levelOn(flat, [DEF2], o);
/** A rail on the floor from x = 32, 20 tiles, ending in a buffer; its cart's box x 16 px either side of its middle, y 144 to 160. */
const RAIL: Rail = { x: 32, y: 160, dir: 1, segments: [{ kind: 'level', tiles: 20 }], end: 'buffer' };
/** Plays `n` steps with `input`, and the lowest lives seen. */
function watch(level: Level, r: RunState, n: number, input: PlayerInput = idle): { r: RunState; lives: number } {
  let lives = r.lives.lives;
  for (let i = 0; i < n; i++) {
    r = stepRun(r, input, level);
    lives = Math.min(lives, r.lives.lives);
  }
  return { r, lives };
}
const claw: PlayerInput = { move: 0, jumpHeld: false, claw: true };
/** A fireball over its box (x 193 to 199, y 152 to 158), flying right. */
const FB: Fireball = { x: 196, y: 158, vx: 180, vy: 0, age: 1 };
/** Lying dazed where it stands, `age` steps into its daze. */
const dazed = (age = 0): EnemyState => at(200, 160, 1, { phase: 'dazed', age });
/** A run with a rolling cart coming at it along RAIL, its middle at x = 152 (its front 40 px from its box), Poncho far off. */
const cartAt = (s: EnemyState): RunState => withPlayer(onFlat({ rails: [RAIL] }), standing(600), { enemies: [s], carts: [{ phase: 'rolling', m: 120 }] });

/** The checks shared by walking and tucking: a touch from either side is a hit; a stomp, the claw, a fireball and a rolling cart defeat it. */
function softChecks(s: EnemyState, label: string): void {
  const level = onFlat();
  // A touch from the left (his hurtbox x 183 to 193) and from the right (207 to 217).
  for (const px of [188, 212]) {
    const r = play(level, withPlayer(level, standing(px), { enemies: [s] }), 1);
    expect(r.lives.lives, `${label} touched at ${px}`).toBe(6);
    expect(r.enemies[0]!.alive, `${label} touched at ${px}`).toBe(true);
  }
  // A stomp at its left edge, its middle and its right edge, falling at 150 px/s from 1 px over its top: the usual bounce, and it is gone.
  for (const px of [188.5, 200, 212]) {
    for (const [input, vy] of [[idle, -260], [hold, -410]] as const) {
      const r = play(level, withPlayer(level, falling(px, 147), { enemies: [s] }), 1, input);
      const where = `${label} stomped at ${px}, jump ${input.jumpHeld ? 'held' : 'up'}`;
      expect(r.enemies[0]!.alive, where).toBe(false);
      expect(r.lives.lives, where).toBe(7);
      expect(r.player.vy, where).toBe(vy);
    }
  }
  // The claw, swung from 24 px off (its box x 182 to 202): it swings on the third step.
  const clawed = watch(level, withPlayer(level, standing(176), { enemies: [s] }), 3, claw);
  expect(clawed.r.enemies[0]!.alive, `${label} clawed`).toBe(false);
  expect(clawed.lives, `${label} clawed`).toBe(7);
  // A fireball: it is gone, and so is the fireball.
  const burnt = play(level, withPlayer(level, standing(600), { enemies: [s], fireballs: [FB] }), 1);
  expect(burnt.enemies[0]!.alive, `${label} burnt`).toBe(false);
  expect(burnt.fireballs, `${label} burnt`).toEqual([]);
  // A rolling cart.
  const cart = watch(onFlat({ rails: [RAIL] }), cartAt(s), 60);
  expect(cart.r.enemies[0]!.alive, `${label} run over`).toBe(false);
  expect(cart.lives, `${label} run over`).toBe(7);
}

describe('GDD-ENM-04 meeting the Armadillo, by state', () => {
  it('GDD-ENM-04 walking: a touch is a hit; a stomp, the claw, a fireball and a rolling cart each defeat it', () => {
    softChecks(at(200, 160, 1), 'walking');
    // The fireball and the cart met it walking: with Poncho far off it stays walking.
    expect(stepEnemy(DEF2, at(200, 160, 1), flat, standing(600)).shell!.phase).toBe('walk');
  });

  it('GDD-ENM-04 tucking: the same', () => {
    softChecks(at(200, 160, 1, { phase: 'tuck', age: 5 }), 'tucking');
  });

  it('GDD-ENM-04 rolling: a touch from the side is a hit; a stomp bounces him 260 px/s, 410 with jump held, and neither is harmed; a stomp from a glide gives the high bounce; the claw does not defeat it; a fireball is used up and does nothing; a rolling cart defeats it; a standing cart does not', () => {
    const level = onFlat();
    // Rolling right into a Poncho standing in its way (his left side), and rolling left into him (his right side).
    for (const [x, dir, px] of [[200, 1, 240], [280, -1, 240]] as const) {
      const r = watch(level, withPlayer(level, standing(px), { enemies: [at(x, 160, dir, { phase: 'roll' })] }), 30);
      expect(r.lives, `rolling ${dir}`).toBe(6);
      expect(r.r.enemies[0]!.alive).toBe(true);
    }
    // A stomp at its left edge, middle and right edge, from a 360 px/s fall 4 px into its top (the stomp's limit): its box after its step
    // is x 194.17 to 210.17. He bounces from its top, his feet put there; it rolls on, and over the next 60 steps nobody is harmed.
    for (const px of [189.5, 202, 214.5]) {
      for (const [input, vy] of [[idle, -260], [hold, -410]] as const) {
        const start = withPlayer(level, falling(px, 152, 360), { enemies: [at(200, 160, 1, { phase: 'roll' })] });
        const r = play(level, start, 1, input);
        const label = `stomped at ${px}, jump ${input.jumpHeld ? 'held' : 'up'}`;
        expect(r.stomped, label).toBe(true);
        expect(r.player.vy, label).toBe(vy);
        expect(r.player.y, label).toBe(148);
        expect(r.lives.lives, label).toBe(7);
        expect(r.enemies[0], label).toMatchObject({ alive: true, shell: { phase: 'roll' } });
        const later = watch(level, r, 60, input);
        expect(later.lives, label).toBe(7);
        expect(later.r.enemies[0], label).toMatchObject({ alive: true, shell: { phase: 'roll' } });
        expect(later.r.enemies[0]!.x, label).toBeCloseTo(200 + 61 * 130 * STEP, 6);
      }
    }
    // Gliding down onto it, jump held all the while: the high bounce.
    const glide = onFlat({ abilities: { glide: true, wallCling: false } });
    const glider: PlayerState = { ...falling(202, 150, 70), gliding: true, jumpWasHeld: true, jumpHeldSteps: 30 };
    const glided = play(glide, withPlayer(glide, glider, { enemies: [at(200, 160, 1, { phase: 'roll' })] }), 1, hold);
    expect(glided.stomped).toBe(true);
    expect(glided.player.vy).toBe(-410);
    expect(glided.enemies[0]).toMatchObject({ alive: true, shell: { phase: 'roll' } });
    // The claw, swung at it from behind as it rolls away (his claw's box x 182 to 202, its box from x 192): the swing rings off it on the
    // steps they overlap, and it rolls on.
    let r = withPlayer(level, standing(176), { enemies: [at(200, 160, 1, { phase: 'roll' })] });
    let rang = 0;
    for (let i = 0; i < 8; i++) {
      r = stepRun(r, i === 0 ? claw : idle, level);
      if (r.enemies[0]!.shell!.rang === true) rang++;
    }
    expect(rang).toBe(2);
    expect(r.enemies[0]).toMatchObject({ alive: true, shell: { phase: 'roll' } });
    expect(r.enemies[0]!.shell!.rang).toBeUndefined();
    expect(r.lives.lives).toBe(7);
    // A fireball: used up, and it rolls on.
    const burnt = play(level, withPlayer(level, standing(30), { enemies: [at(200, 160, -1, { phase: 'roll' })], fireballs: [FB] }), 1);
    expect(burnt.fireballs).toEqual([]);
    expect(burnt.enemies[0]).toMatchObject({ alive: true, shell: { phase: 'roll' } });
    // A rolling cart, coming at it as it rolls at the cart.
    const cart = watch(onFlat({ rails: [RAIL] }), cartAt(at(200, 160, -1, { phase: 'roll' })), 30);
    expect(cart.r.enemies[0]!.alive).toBe(false);
    // A standing cart: it rolls through it, and on.
    const still = onFlat({ rails: [RAIL] });
    const through = watch(still, withPlayer(still, standing(600), { enemies: [at(120, 160, -1, { phase: 'roll' })] }), 45);
    expect(through.r.enemies[0]).toMatchObject({ alive: true, shell: { phase: 'roll' } });
    expect(through.r.enemies[0]!.x).toBeLessThan(32);
  });

  it('GDD-ENM-04 dazed: a touch is no hit; a stomp, the claw, a fireball and a rolling cart each defeat it; a Poncho inside it when it gets up is hit', () => {
    const level = onFlat();
    // Standing in it, at its left edge, middle and right edge, for 30 steps: no hit.
    for (const px of [188, 200, 212]) {
      const r = watch(level, withPlayer(level, standing(px), { enemies: [dazed()] }), 30);
      expect(r.lives, `touched at ${px}`).toBe(7);
      expect(r.r.enemies[0]!.shell!.phase).toBe('dazed');
    }
    // A stomp at its edges and middle, jump up and held.
    for (const px of [188.5, 200, 211.5]) {
      for (const [input, vy] of [[idle, -260], [hold, -410]] as const) {
        const r = play(level, withPlayer(level, falling(px, 147), { enemies: [dazed()] }), 1, input);
        expect(r.enemies[0]!.alive, `stomped at ${px}`).toBe(false);
        expect(r.player.vy).toBe(vy);
        expect(r.lives.lives).toBe(7);
      }
    }
    const clawed = watch(level, withPlayer(level, standing(176), { enemies: [dazed()] }), 3, claw);
    expect(clawed.r.enemies[0]!.alive).toBe(false);
    expect(clawed.lives).toBe(7);
    const burnt = play(level, withPlayer(level, standing(600), { enemies: [dazed()], fireballs: [FB] }), 1);
    expect(burnt.enemies[0]!.alive).toBe(false);
    expect(burnt.fireballs).toEqual([]);
    expect(watch(onFlat({ rails: [RAIL] }), cartAt(dazed()), 60).r.enemies[0]!.alive).toBe(false);
    // On its last dazed step Poncho stands in it: the step it gets up, he is hit.
    const up = play(level, withPlayer(level, standing(200), { enemies: [dazed(59)] }), 1);
    expect(up.lives.lives).toBe(6);
    expect(up.enemies[0]!.alive).toBe(true);
  });

  it('GDD-ENM-04 the Chile Fantasma touch defeats the Armadillo walking, tucking, rolling and dazed', () => {
    const level = onFlat();
    const states: [string, EnemyState][] = [
      ['walking', at(200, 160, 1)],
      ['tucking', at(200, 160, 1, { phase: 'tuck', age: 5 })],
      ['rolling', at(200, 160, -1, { phase: 'roll' })],
      ['dazed', at(200, 160, 1, { phase: 'dazed', age: 5 })],
    ];
    for (const [label, s] of states) {
      for (const px of [188, 200, 210]) {
        const r = play(level, withPlayer(level, standing(px), { enemies: [s], fantasma: 100 }), 1);
        expect(r.enemies[0]!.alive, `${label} at ${px}`).toBe(false);
        expect(r.lives.lives).toBe(7);
      }
    }
    // A stomp on the rolling ball with the Chile Fantasma on is a touch too, though the stomp puts his feet on its top.
    const stomp = play(level, withPlayer(level, falling(202, 152, 360), { enemies: [at(200, 160, 1, { phase: 'roll' })], fantasma: 100 }), 1);
    expect(stomp.stomped).toBe(true);
    expect(stomp.enemies[0]!.alive).toBe(false);
  });

  it('GDD-ENM-04 with a taco a hit from the ball costs the taco, not a life', () => {
    const level = onFlat();
    let r = withPlayer(level, standing(240), { enemies: [at(200, 160, 1, { phase: 'roll' })], power: 'taco' });
    let hit = -1;
    for (let i = 0; i < 30 && hit < 0; i++) {
      r = stepRun(r, idle, level);
      if (r.power === 'base') hit = i;
    }
    expect(hit).toBeGreaterThan(0);
    expect(r.lives.lives).toBe(7);
    // The ball rolls on, through him (he is invulnerable now) and away.
    const x = r.enemies[0]!.x;
    r = play(level, r, 30);
    expect(r.enemies[0]).toMatchObject({ alive: true, shell: { phase: 'roll' } });
    expect(r.enemies[0]!.x).toBeCloseTo(x + 30 * 130 * STEP, 6);
    expect(r.lives.lives).toBe(7);
  });
});

// Fair to read (GDD-ENM-04), measured on the real jump. On `flat`, the Armadillo at x = 100 heading right and Poncho standing at x = 180:
// startled on step 1, the first flash (count 0); it rolls from count 30 and, if he does nothing, hits him at count 60. A press "at count c"
// is the input of the step c + 1. Each run is watched until count 150 (the ball dazes against the right wall far later).
const FAIR_DEF = armadillo(100, 160);
type Bot = (count: number, p: PlayerState) => PlayerInput;
/** Plays a bot from the first flash: the count it is hit at (or -1), and whether the Armadillo was defeated. */
function fairRun(bot: Bot, glide = false): { hit: number; defeated: boolean; bounced: boolean } {
  const level = levelOn(flat, [FAIR_DEF], { abilities: { glide, wallCling: false } });
  let r = withPlayer(level, standing(180));
  let bounced = false;
  for (let count = 0; count < 150; count++) {
    r = stepRun(r, bot(count, r.player), level);
    bounced ||= r.stomped;
    if (count === 0) expect(r.enemies[0]!.shell!.phase).toBe('tuck');
    if (r.lives.lives < 7) return { hit: count, defeated: !r.enemies[0]!.alive, bounced };
  }
  return { hit: -1, defeated: !r.enemies[0]!.alive, bounced };
}
/** A jump pressed at count `c`, held until he is on the ground again (`hold` true), or only on that step (a tap, the smallest hop). */
const jumpAt = (c: number, held: boolean, move = 0, moveFrom = 0): Bot => {
  let left = false;
  let done = false;
  return (n, p) => {
    if (n > c && !p.grounded) left = true;
    if (left && p.grounded) done = true;
    const press = held ? n >= c && !done : n === c;
    return { move: n >= moveFrom ? move : 0, jumpHeld: press };
  };
};
/** The counts from `from` to `to` at which a bot `at(c)` gets through with no hit. */
const window_ = (bot: (c: number) => Bot, from: number, to: number, glide = false): { through: number[]; clear: number[] } => {
  const runs = Array.from({ length: to - from + 1 }, (_, i) => ({ c: from + i, o: fairRun(bot(from + i), glide) }));
  return { through: runs.filter((r) => r.o.hit < 0).map((r) => r.c), clear: runs.filter((r) => r.o.hit < 0 && !r.o.bounced).map((r) => r.c) };
};
/** Both of a window's ranges (`range`). */
const show = (w: { through: number[]; clear: number[] }) => ({ clear: range(w.clear), through: range(w.through) });
/** A window's first and last count, how many counts it has, and whether it has no holes. */
const range = (cs: number[]) => ({ first: cs[0], last: cs[cs.length - 1], count: cs.length, unbroken: cs.length === cs[cs.length - 1]! - cs[0]! + 1 });

describe('GDD-ENM-04 the Armadillo is fair to read', () => {
  // Measured, against the GDD's targets. The ball's top is safe to land on (a stomp bounces him off a rolling one), so a jump that comes down
  // on it gets through as well as one that clears it.
  it('GDD-ENM-04 a full jump taken in the window clears the ball', { timeout: 60000 }, () => {
    // Each window twice: the presses that clear the ball without touching it, comparable to the GDD's figures, and those that get through at
    // all, coming down on its top with a bounce (a stomp) included.
    // A full jump, held until he lands: clear at counts 41 to 59, 19 steps (the GDD: an 18-step window); through, with a bounce, 29 to 59.
    expect(show(window_((c) => jumpAt(c, true), 0, 100))).toEqual({ clear: { first: 41, last: 59, count: 19, unbroken: true }, through: { first: 29, last: 59, count: 31, unbroken: true } });
    // The smallest hop (a one-step press), standing: it never clears it (the GDD: enough only when he runs at it); it gets through at counts 46
    // to 57 only by coming down on the ball.
    expect(show(window_((c) => jumpAt(c, false), 0, 100))).toEqual({ clear: { first: undefined, last: undefined, count: 0, unbroken: false }, through: { first: 46, last: 57, count: 12, unbroken: true } });
    // Running at it from the step it starts rolling (count 30), the same hop: clear at counts 41 to 45, 5 steps (the GDD: 9 steps clear, 6 to
    // pass); through 34 to 45.
    expect(show(window_((c) => jumpAt(c, false, -1, 30), 30, 100))).toEqual({ clear: { first: 41, last: 45, count: 5, unbroken: true }, through: { first: 34, last: 45, count: 12, unbroken: true } });
    // A jump held into a glide: clear at counts 14 to 59, 46 steps (the GDD: 56 steps clear); through at every count from 0 to 59.
    expect(show(window_((c) => jumpAt(c, true), 0, 100, true))).toEqual({ clear: { first: 14, last: 59, count: 46, unbroken: true }, through: { first: 0, last: 59, count: 60, unbroken: true } });
  });

  it('GDD-ENM-04 a claw pressed during the tuck from 80 px away defeats it at 25 of the 30 steps', { timeout: 60000 }, () => {
    // He runs at it from the first flash and presses the claw once, at count c; its swing comes two steps later. A press at counts 23 to 27
    // defeats it, the first with its swing at count 25 (the GDD: 25 of the 30 steps); earlier ones swing short, later ones swing at the
    // rolling ball, and each of those is hit when the ball reaches him at count 33.
    const out = Array.from({ length: 30 }, (_, c) => fairRun((n) => ({ move: -1, jumpHeld: false, claw: n === c })));
    expect(out.flatMap((o, c) => (o.defeated && o.hit < 0 ? [c] : []))).toEqual([23, 24, 25, 26, 27]);
    expect(out.every((o) => (o.defeated ? o.hit < 0 : o.hit === 33))).toBe(true);
  });

  it('GDD-ENM-04 running into it in its tuck is a hit', () => {
    // From the first flash 80 px off he cannot reach it in its tuck: he runs into the ball at count 33, after it has started rolling.
    expect(fairRun(() => ({ move: -1, jumpHeld: false }))).toMatchObject({ hit: 33, defeated: false });
    // From 40 px, startled as he lands there, he runs into it while it is still tucked.
    const level = levelOn(flat, [FAIR_DEF]);
    let r = withPlayer(level, standing(140), { enemies: [at(100, 160, 1, { phase: 'tuck' })] });
    let hit = -1;
    for (let n = 0; n < 30 && hit < 0; n++) {
      r = stepRun(r, { move: -1, jumpHeld: false }, level);
      if (r.lives.lives < 7) hit = n;
    }
    expect(hit).toBeGreaterThanOrEqual(0);
    expect(r.enemies[0]!.shell!.phase).toBe('tuck');
  });
});

// L-075, L-014: a sweep over a pen like 3-2's: 11 tiles (x 160 to 336) between two walls 2 tiles tall (columns 9 and 21, their tops y = 192),
// on a floor at row 14 (y = 224), under a roof 5 tiles over the floor (row 8, its underside y = 144) from column 8 to column 22. The glide is on
// and the wall cling off, as in 3-2. Poncho drops in from the walls' height (his feet at y = 192) at 8 places across the pen, with the
// Armadillo at 6 points of its walk (walked 0, 160, ..., 800 steps from the pen's middle with nobody near: its walk there and back is 960
// steps). Then he plays one of five ways for 360 steps, and a run counts 1 if he loses a life in it.
const PEN = grid(40, 17, (c, r) => (r >= 14 || ((c === 9 || c === 21) && r >= 12) || (r === 8 && c >= 8 && c <= 22) ? '#' : '.'));
const PEN_DEF = armadillo(248, 224);
const DROPS = [170, 192, 214, 236, 258, 280, 302, 324];
const STARTS = [0, 160, 320, 480, 640, 800];
type Way = 'stand' | 'jump' | 'glide' | 'away' | 'hop';
/** One run: the lives he loses (0 or 1) playing `way` from a drop at `x`, the Armadillo walked `t` steps first. */
function penRun(way: Way, x: number, t: number): number {
  const level = levelOn(PEN, [PEN_DEF], { spawn: { x: 40, y: 224 }, abilities: { glide: true, wallCling: false } });
  let e = freshEnemies([PEN_DEF])[0]!;
  for (let i = 0; i < t; i++) e = stepEnemy(PEN_DEF, e, PEN, away);
  let r = withPlayer(level, falling(x, 192, 0), { enemies: [e] });
  let holding = false;
  let leftGround = false;
  for (let i = 0; i < 360; i++) {
    const ball = r.enemies[0]!;
    const p = r.player;
    // The flash ends: its tuck's last step is done, so this step it rolls. A jump is pressed on this step and held until he lands (a glide),
    // or until he starts to fall (a plain jump).
    if ((way === 'jump' || way === 'glide') && ball.shell!.phase === 'tuck' && ball.shell!.age === ARMADILLO.tuckSteps - 1) {
      holding = true;
      leftGround = false;
    }
    if (holding && !p.grounded) leftGround = true;
    if (holding && leftGround && p.grounded) holding = false;
    const toward: 1 | -1 = ball.x > p.x ? 1 : -1;
    // Running at it, a one-step hop when the rolling ball's box is 24 px or less from his hurtbox.
    const gap = Math.abs(ball.x - p.x) - ARMADILLO.width / 2 - 5;
    const input: PlayerInput =
      way === 'jump' ? { move: 0, jumpHeld: holding && !(leftGround && p.vy > 0) }
      : way === 'glide' ? { move: 0, jumpHeld: holding }
      : way === 'away' ? { move: -toward, jumpHeld: false }
      : way === 'hop' ? { move: toward, jumpHeld: ball.alive && ball.shell!.phase === 'roll' && p.grounded && gap <= 24 && !p.jumpWasHeld }
      : idle;
    r = stepRun(r, input, level);
    if (r.lives.lives < 7) return 1;
  }
  return 0;
}

describe('GDD-ENM-04 the Armadillo in a pen', () => {
  it('GDD-ENM-04 the Armadillo pen sweep: lives lost by each way of meeting it', { timeout: 120000 }, () => {
    const ways: Way[] = ['stand', 'jump', 'glide', 'away', 'hop'];
    const lost = Object.fromEntries(ways.map((w) => [w, DROPS.flatMap((x) => STARTS.filter((t) => penRun(w, x, t) > 0).map((t) => `${x}@${t}`))]));
    // Of the 48 runs each (measured): standing still loses a life in 38, a plain jump when the flash ends in 26, running away in 37, running
    // at it and hopping in 35.
    expect(Object.fromEntries(ways.map((w) => [w, lost[w]!.length]))).toEqual({ stand: 38, jump: 26, glide: 1, away: 37, hop: 35 });
    // A jump held into a glide when the flash ends loses one, the worst case: dropped in at x = 236 beside the Armadillo at its start, he
    // lands 1.67 px from its tucked box, and its roll reaches him on its first step, before his jump has lifted him clear of its 12 px.
    expect(lost.glide).toEqual(['236@0']);
  });
});
