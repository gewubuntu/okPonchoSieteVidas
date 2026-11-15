// GDD-TEC-04: the level validator. Pure, no Phaser. It checks what the GDD says every level must have (GDD-MOV-09: its sand slopes
// have ground under them and hold nothing else), so a level that breaks a rule fails a test instead of being found in play.
import { ARMADILLO, AWNING, BASE_WIDTH, CACOMIXTLE, CART, COVER, ESTRELLA, LEVEL_RULES, MURCIELAGO, RAIL_RULES, ROLLO, TILE } from '../config/tuning';
import { rollPath } from '../sim/armadillo';
import { bossStart } from '../sim/boss';
import { bottomRowAt, type Bottom } from '../sim/bottoms';
import { cartFloor, railGround, railLength, type Rail } from '../sim/cart';
import { estrellaStart } from '../sim/estrella';
import { isBossLevel } from '../sim/bossLevel';
import { freshCrumbles, withCrumbles } from '../sim/crumble';
import { freshEnemies, kindOf, overlaps, stepEnemy, type Box, type Enemy } from '../sim/enemy';
import { spawn } from '../sim/movement';
import { murcielagoAt } from '../sim/murcielago';
import { groundTop } from '../sim/slope';
import type { Level } from '../sim/run';
import type { TileGrid } from '../sim/tilemap';
import type { LevelEntry } from './index';

export interface Gap {
  readonly col: number;
  readonly width: number;
}

/** Runs of adjacent columns whose bottom row is empty, left to right: GDD-WLD-03, a raised bottom's row in its span of `bottoms`, else the last row. */
export function gaps(world: TileGrid, bottoms?: readonly Bottom[]): readonly Gap[] {
  const found: Gap[] = [];
  let start = -1;
  for (let col = 0; col < world.width; col++) {
    const pit = !world.solidTile(col, bottomRowAt({ world, bottoms }, col));
    if (pit && start < 0) start = col;
    if (!pit && start >= 0) {
      found.push({ col: start, width: col - start });
      start = -1;
    }
  }
  if (start >= 0) found.push({ col: start, width: world.width - start });
  return found;
}

/** The top of the ground at a gap's edge: the highest tile of the solid run that stands on the bottom row there (a gap's edge is never a pit). */
function groundTopAt(world: TileGrid, bottoms: readonly Bottom[] | undefined, col: number): number {
  let row = bottomRowAt({ world, bottoms }, col);
  while (row > 0 && world.solidTile(col, row - 1)) row--;
  return row * TILE;
}

/**
 * GDD-TEC-04, GDD-WLD-10, GDD-WLD-11: the gaps that count, runs of pit columns left uncovered. A pit column is covered by a whole awning
 * (not a torn one), a cordel or a rollo (its whole line: the claw is always there to unroll it) spanning the column, whose top is at most
 * COVER.abovePx above the ground at the pit's nearer edge (the left one when both are as near), and not below it.
 */
export function openGaps(level: Level): readonly Gap[] {
  const { world } = level;
  const covers = [...(level.awnings ?? []).filter((a) => a.torn !== true), ...(level.cordeles ?? []), ...(level.rollos ?? [])];
  return gaps(world, level.bottoms).flatMap((g) => {
    const left = g.col - 1;
    const right = g.col + g.width;
    const open: Gap[] = [];
    let start = -1;
    for (let col = g.col; col <= right; col++) {
      let covered = false;
      if (col < right) {
        const edge = left >= 0 && (right >= world.width || col - left <= right - col) ? left : right;
        const ground = groundTopAt(world, level.bottoms, edge);
        covered = covers.some((c) => c.x <= col * TILE && c.x + c.w >= (col + 1) * TILE && c.y <= ground && ground - c.y <= COVER.abovePx);
      }
      const pit = col < right && !covered;
      if (pit && start < 0) start = col;
      if (!pit && start >= 0) {
        open.push({ col: start, width: col - start });
        start = -1;
      }
    }
    return open;
  });
}

/**
 * GDD-WLD-03: World 3's gaps, the open gaps read left to right. In a level whose ledges come back (GDD-WLD-05) a pit column holding a
 * crumbling tile is a bank at its highest crumbling tile's row, not a pit column. A gap's banks are the columns either side of it, each at
 * that row or else at its ground's top, and its limit is set by the drop from the left bank to the right: `base` plus a tile per tile of
 * drop up to `maxDropTiles`, `byRise` for a rise of 1 to 3 tiles, and a higher rise not allowed. Its headroom, the fewest empty tiles over
 * the left bank's top in the left bank's column and every column of the gap (not the right bank's, so a rise is no roof), takes
 * `perMissingRoofTile` off for each tile under `roofTiles`, never under 1; under `minHeadroomLevel` with no drop it is not allowed. A gap at
 * the level's edge has a bank on one side only: the same-height limit, with no roof reading. Not checked here: the one-way direction, rails
 * and the sight rules.
 */
function world3GapProblems(level: Level): string[] {
  const { world } = level;
  const rule = LEVEL_RULES.world3Gap;
  const ledges = new Map<number, number>();
  for (const t of level.crumblesReturn === true ? level.crumbles : []) {
    if (!world.solidTile(t.col, bottomRowAt(level, t.col))) ledges.set(t.col, Math.min(t.row, ledges.get(t.col) ?? t.row));
  }
  const top = (col: number): number => ledges.get(col) ?? groundTopAt(world, level.bottoms, col) / TILE;
  const problems: string[] = [];
  for (const open of openGaps(level)) {
    const end = open.col + open.width;
    let start = -1;
    for (let col = open.col; col <= end; col++) {
      const pit = col < end && !ledges.has(col);
      if (pit && start < 0) start = col;
      if (pit || start < 0) continue;
      const [left, right, width] = [start - 1, col, col - start];
      start = -1;
      const at = `columns ${left + 1} to ${right - 1}`;
      if (left < 0 || right >= world.width) {
        if (width > rule.base) problems.push(`gap of ${width} tiles at ${at}, World 3 allows ${rule.base}`);
        continue;
      }
      const drop = top(right) - top(left);
      if (drop < -rule.byRise.length) {
        problems.push(`gap at ${at} rises ${-drop} tiles over a pit, World 3 allows ${rule.byRise.length}`);
        continue;
      }
      let headroom: number = rule.roofTiles;
      for (let c = left; c < right; c++) {
        let empty = 0;
        while (empty < headroom && !world.solidTile(c, top(left) - 1 - empty)) empty++;
        headroom = empty;
      }
      if (drop <= 0 && headroom < rule.minHeadroomLevel) {
        problems.push(`gap at ${at} has ${headroom} tiles of headroom over its left bank, World 3 needs ${rule.minHeadroomLevel} where it does not drop`);
        continue;
      }
      const byDrop = drop >= 0 ? rule.base + rule.perDropTile * Math.min(drop, rule.maxDropTiles) : rule.byRise[-drop - 1]!;
      const limit = Math.max(1, byDrop - rule.perMissingRoofTile * (rule.roofTiles - headroom));
      if (width <= limit) continue;
      const slope = drop > 0 ? ` with a drop of ${drop} tile${drop === 1 ? '' : 's'}` : drop < 0 ? ` with a rise of ${-drop} tile${drop === -1 ? '' : 's'}` : '';
      const roof = headroom < rule.roofTiles ? ` under a roof ${headroom} tiles over its left bank` : '';
      problems.push(`gap of ${width} tiles at ${at}${slope}${roof}, World 3 allows ${limit}`);
    }
  }
  return problems;
}

/** GDD-WLD-15: a rail's stretches as lines on the screen: the px columns each covers (from x0 up to x1) and its y = c + k * x. */
function railLines(rail: Rail): { x0: number; x1: number; k: number; c: number }[] {
  let across = 0;
  return rail.segments.map((s) => {
    const from = across;
    across += s.tiles * TILE;
    const [xa, xb] = [rail.x + rail.dir * from, rail.x + rail.dir * across];
    const k = (railGround(rail, across) - railGround(rail, from)) / (xb - xa);
    return { x0: Math.min(xa, xb), x1: Math.max(xa, xb), k, c: railGround(rail, from) - k * xa };
  });
}

/**
 * GDD-WLD-15: a broken end comes after at least RAIL_RULES.levelBeforeEnd tiles of level rail (its trailing level stretches, one or more in a
 * row) and is at least RAIL_RULES.minBrokenTiles tiles from its cart's start; a buffer rail needs neither, and a boss level is exempt from
 * both (GDD-BOS-04). In every level no two rails share a stretch: no px column of one's line lies on the other's line (level or sloped)
 * at the same height; two lines that only cross share none; and no rail starts within CART.width across of another rail's end at the same
 * ground height. Not checked here, but by each level's own tests: the far bank within 5 tiles plus the drop, the 7 tiles of headroom over a
 * cart jump, and a hanging beam's place.
 */
function railProblems(rails: readonly Rail[], boss: boolean): string[] {
  const problems: string[] = [];
  for (const r of boss ? [] : rails) {
    if (r.end !== 'broken') continue;
    let levelTiles = 0;
    for (let i = r.segments.length - 1; i >= 0 && r.segments[i]!.kind === 'level'; i--) levelTiles += r.segments[i]!.tiles;
    if (levelTiles < RAIL_RULES.levelBeforeEnd) problems.push(`broken rail at ${r.x},${r.y} ends after ${levelTiles} tiles of level rail, expected at least ${RAIL_RULES.levelBeforeEnd}`);
    const tiles = railLength(r) / TILE;
    if (tiles < RAIL_RULES.minBrokenTiles) problems.push(`broken rail at ${r.x},${r.y} is ${tiles} tiles long, expected at least ${RAIL_RULES.minBrokenTiles}`);
  }
  const lines = rails.map(railLines);
  rails.forEach((a, i) => {
    for (let j = i + 1; j < rails.length; j++) {
      const b = rails[j]!;
      if (lines[i]!.some((s) => lines[j]!.some((t) => s.k === t.k && s.c === t.c && Math.max(s.x0, t.x0) < Math.min(s.x1, t.x1)))) problems.push(`rails at ${a.x},${a.y} and ${b.x},${b.y} share a stretch`);
    }
  });
  // No rail starts within a cart's width across of another rail's end at the same ground height, so he drops to the ground between the two
  // carts: walking off one stopped cart onto the next one's floor would start it.
  for (const a of rails) {
    const end = { x: a.x + a.dir * railLength(a), y: railGround(a, railLength(a)) };
    for (const b of rails) {
      const d = Math.abs(b.x - end.x);
      if (b !== a && b.y === end.y && d < CART.width) problems.push(`rail at ${b.x},${b.y} starts ${d} px from the end of the rail at ${a.x},${a.y}, under ${CART.width}`);
    }
  }
  return problems;
}

/** GDD-ENM-04: the middle of a Murciélago at each of the MURCIELAGO.periodSteps steps of its loop. */
const loopOf = (def: Enemy): { x: number; y: number }[] => Array.from({ length: MURCIELAGO.periodSteps }, (_, n) => murcielagoAt(def, n));

/**
 * GDD-ENM-04, GDD-TEC-04: a Murciélago's loop is 0 to MURCIELAGO.maxRx px across and 0 to maxRy px up and down, its phase a whole step of the
 * loop, and at every step of it its box touches no solid tile, no spike's tile and no crumbling tile. Boxes that only share an edge with a
 * tile do not touch it.
 */
function murcielagoProblems(level: Level, def: Enemy): string[] {
  const at = `murciélago at ${def.x},${def.y}`;
  const problems: string[] = [];
  const rx = def.rx ?? 0;
  const ry = def.ry ?? 0;
  const phase = def.phase ?? 0;
  if (rx < 0 || rx > MURCIELAGO.maxRx) problems.push(`${at} has rx ${rx}, expected 0 to ${MURCIELAGO.maxRx}`);
  if (ry < 0 || ry > MURCIELAGO.maxRy) problems.push(`${at} has ry ${ry}, expected 0 to ${MURCIELAGO.maxRy}`);
  if (!Number.isInteger(phase) || phase < 0 || phase >= MURCIELAGO.periodSteps) problems.push(`${at} has phase ${phase}, expected a whole step from 0 to ${MURCIELAGO.periodSteps - 1}`);
  const tiles = new Set([...level.spikes, ...level.crumbles].map((t) => `${t.col},${t.row}`));
  const touches = (col: number, row: number): boolean => level.world.solidTile(col, row) || tiles.has(`${col},${row}`);
  const hit = loopOf(def).some(({ x, y }) => {
    const [x0, x1, y0, y1] = [x - MURCIELAGO.width / 2, x + MURCIELAGO.width / 2, y - MURCIELAGO.height / 2, y + MURCIELAGO.height / 2];
    for (let row = Math.floor(y0 / TILE); row * TILE < y1; row++) {
      for (let col = Math.floor(x0 / TILE); col * TILE < x1; col++) if (touches(col, row)) return true;
    }
    return false;
  });
  if (hit) problems.push(`${at} touches a tile on its loop`);
  return problems;
}

/** GDD-ENM-04: the steps an Armadillo's walk is played for at most, out to one end and back to the other, and each roll's. */
const WALK_STEPS = 20000;
const ROLL_STEPS = 600;

/** An Armadillo's box, its feet's middle at `p`. */
const box = (p: { x: number; y: number }): Box => ({ x0: p.x - ARMADILLO.width / 2, x1: p.x + ARMADILLO.width / 2, y0: p.y - ARMADILLO.height, y1: p.y });

/**
 * GDD-ENM-04, GDD-TEC-04: an Armadillo starts on the ground, the middle of its feet on a level tile's top or a slope's surface (its crumbling
 * tiles whole). Then its walk with no Poncho, out to one end and back to the other, and from every place on it a roll either way, played out
 * on the level's tiles (`rollPath`) until a wall stops it, it falls out of the level or ROLL_STEPS run out, never has its box overlap a
 * standing cart's start: the cart's box at its rail's start, on the rail's ground (GDD-WLD-15). Boxes that only share an edge do not touch.
 */
function armadilloProblems(level: Level, def: Enemy): string[] {
  const at = `armadillo at column ${Math.floor(def.x / TILE)}`;
  const world = withCrumbles(level.world, level.crumbles, freshCrumbles(level.crumbles));
  const top = groundTop(world, def.x, def.y + 1);
  if (top === null || Math.abs(top - def.y) > 1e-6) return [`${at} does not stand on the ground`];
  const carts = (level.rails ?? []).map((r) => {
    const x0 = Math.min(r.x, r.x + r.dir * CART.width);
    const ground = railGround(r, CART.width / 2);
    return { col: Math.floor(x0 / TILE), box: { x0, x1: x0 + CART.width, y0: ground - CART.height, y1: ground } };
  });
  const far = spawn(-1e9, -1e9);
  let s = freshEnemies([def])[0]!;
  const walk: { x: number; y: number }[] = [{ x: s.x, y: def.y }];
  for (let i = 0, turns = 0; i < WALK_STEPS && turns < 2; i++) {
    const next = stepEnemy(def, s, world, far);
    if (next.dir !== s.dir) turns++;
    s = next;
    walk.push({ x: s.x, y: s.y ?? def.y });
  }
  const walks = carts.map((c) => walk.some((p) => overlaps(box(p), c.box)));
  const rolls = carts.map(() => false);
  // Each roll is played once and read against every cart its walk does not already reach.
  if (walks.some((w) => !w)) {
    for (const p of walk) {
      for (const dir of [1, -1] as const) {
        for (const q of rollPath(world, p.x, p.y, dir, ROLL_STEPS).at) {
          carts.forEach((c, k) => {
            if (!walks[k] && overlaps(box(q), c.box)) rolls[k] = true;
          });
        }
      }
    }
  }
  return carts.flatMap((c, k) => (walks[k] ? [`${at} walks into the start of the cart at column ${c.col}`] : rolls[k] ? [`${at} rolls into the start of the cart at column ${c.col}`] : []));
}

/**
 * GDD-ENM-04, GDD-TEC-04: a Cacomixtle's rail and its sight stretch. (a) `rail` is a whole number that is a place in `level.rails`;
 * (b) that rail ends at a buffer, so its cart never falls; (c) no two Cacomixtles ride one rail; (d) `x` and `y` are its place at its cart's
 * start: the cart's middle and the cart's floor under it. The sight stretch is the rail from the cart's middle at its start, ahead along its
 * way, for CACOMIXTLE.sightX px across or to the buffer's middle-stop (the rail's length less half the cart), whichever is nearer: (e) no
 * descent segment overlaps it (a segment that only starts where it ends does not); (f) every standable top whose column it overlaps (a
 * solid tile with a non-solid tile over it, or a crumbling tile) is within sightY less a full jump (jumpPx) of the cart's floor at its start,
 * or more than sightY plus a jump from it, so a jump cannot hide him nor wake it early, and so is every one-way platform over those columns (a
 * moving one by the range of its distance over its path); `Enemy.sightException`, the GDD sentence that names
 * the exception, skips (f) alone and is never empty. Not checked here: the cart clear of the phone's buttons when first seen (needs the
 * camera of GDD-UI-04, built later).
 */
function cacomixtleProblems(level: Level): string[] {
  const problems: string[] = [];
  const rails = level.rails ?? [];
  const taken = new Set<number>();
  const hides = CACOMIXTLE.sightY - CACOMIXTLE.jumpPx;
  const wakes = CACOMIXTLE.sightY + CACOMIXTLE.jumpPx;
  for (const def of level.enemies) {
    if (kindOf(def) !== 'cacomixtle') continue;
    const at = `cacomixtle at ${def.x},${def.y}`;
    // A place that is no whole number, is under 0 or past the list's end finds no rail: that one lookup is check (a).
    const index = def.rail ?? -1;
    const rail = rails[index];
    if (!rail) {
      problems.push(`${at} has rail ${def.rail}, expected a whole number from 0 to ${rails.length - 1}`);
      continue;
    }
    if (rail.end !== 'buffer') problems.push(`${at} rides a rail that ends ${rail.end}, expected a buffer`);
    if (taken.has(index)) problems.push(`${at} rides rail ${index}, which another cacomixtle rides`);
    taken.add(index);
    const middle = CART.width / 2;
    const floor = cartFloor(rail, { phase: 'waiting', m: middle });
    const [x, y] = [rail.x + rail.dir * middle, floor.y];
    if (def.x !== x || def.y !== y) problems.push(`${at} is not at its cart's start, expected ${x},${y}`);
    const end = Math.min(middle + CACOMIXTLE.sightX, railLength(rail) - middle);
    let from = 0;
    for (const s of rail.segments) {
      const to = from + s.tiles * TILE;
      if (s.kind === 'descent' && from < end && to > middle) problems.push(`${at} has a descent in its sight stretch, ${from} to ${to} px across`);
      from = to;
    }
    if (def.sightException === '') problems.push(`${at} has an empty sight exception, expected the GDD sentence that names it`);
    if (def.sightException) continue;
    // The stretch's columns. One past the level's edge reads as a wall (`solidTile`), which has no top, so no clamp to the level is needed (L-025).
    const [lo, hi] = [Math.min(x, rail.x + rail.dir * end), Math.max(x, rail.x + rail.dir * end)];
    const [first, last] = [Math.floor(lo / TILE), Math.ceil(hi / TILE)];
    const tops = new Map<string, { col: number; row: number }>();
    for (let col = first; col < last; col++) {
      for (let row = 0; row < level.world.height; row++) if (level.world.solidTile(col, row) && !level.world.solidTile(col, row - 1)) tops.set(`${col},${row}`, { col, row });
      for (const c of level.crumbles) if (c.col === col) tops.set(`${col},${c.row}`, { col, row: c.row });
    }
    for (const { col, row } of tops.values()) {
      const d = Math.abs(row * TILE - floor.y);
      if (d > hides && d <= wakes) problems.push(`${at} has ground at column ${col}, row ${row}, ${d} px from its cart's floor in its sight stretch, expected within ${hides} or over ${wakes}`);
    }
    // A one-way platform is ground too (GDD-WLD-05): one whose x span (the whole path's, for a moving one) overlaps those columns, and whose
    // distances from the cart's floor over its path's y interval (`near` to `far`) meet the band, for a still one the one distance.
    for (const p of level.platforms) {
      if (Math.min(p.x0, p.x1) >= last * TILE || Math.max(p.x0, p.x1) + p.w <= first * TILE) continue;
      const [top, bottom] = [Math.min(p.y0, p.y1), Math.max(p.y0, p.y1)];
      const near = top <= floor.y && floor.y <= bottom ? 0 : Math.min(Math.abs(top - floor.y), Math.abs(bottom - floor.y));
      const far = Math.max(Math.abs(top - floor.y), Math.abs(bottom - floor.y));
      if (far > hides && near <= wakes) {
        const where = p.x0 === p.x1 && p.y0 === p.y1 ? `at ${p.x0},${p.y0}, ${far} px` : `moving from ${p.x0},${p.y0} to ${p.x1},${p.y1}, ${near} to ${far} px`;
        problems.push(`${at} has a platform ${where} from its cart's floor in its sight stretch, expected within ${hides} or over ${wakes}`);
      }
    }
  }
  return problems;
}

/** GDD-WLD-03: 17 to 51 rows tall; a boss level one screen tall, 17 rows (GDD-BOS-01). */
function heightProblems(level: Level): string[] {
  const rows = level.world.height;
  if (isBossLevel(level)) return rows === LEVEL_RULES.minRows ? [] : [`${rows} rows tall, a boss level is ${LEVEL_RULES.minRows}`];
  return rows < LEVEL_RULES.minRows || rows > LEVEL_RULES.maxRows ? [`${rows} rows tall, expected ${LEVEL_RULES.minRows} to ${LEVEL_RULES.maxRows}`] : [];
}

/**
 * GDD-WLD-03, GDD-TEC-04: the raised bottoms. Each span's row is inside the level and above its last row (a span on the last row is no raised
 * bottom), its columns run left to right inside the level, and no two spans share a column. Under each, every column is solid all the way
 * down from the span's row to the last, or empty all the way: its bottom-row tile decides which, and every tile below it is the same (what
 * is under a raised bottom is never seen, and a pit column never has ground under its floor line to stand on). The spawn, every
 * ofrenda and the exit stand on or above their column's bottom row.
 */
function bottomProblems(level: Level): string[] {
  const { world } = level;
  const spans = level.bottoms ?? [];
  const last = world.height - 1;
  const problems: string[] = [];
  for (const b of spans) {
    const at = `raised bottom at columns ${b.fromCol} to ${b.toCol}`;
    if (b.row < 0 || b.row > last) problems.push(`${at} has its row ${b.row} outside the level`);
    if (b.row === last) problems.push(`${at} is on the level's last row (${last})`);
    if (b.fromCol > b.toCol) problems.push(`${at} runs backwards`);
    if (b.fromCol < 0 || b.toCol >= world.width) problems.push(`${at} reaches outside the level`);
  }
  spans.forEach((a, i) => {
    for (const b of spans.slice(i + 1)) {
      if (a.fromCol <= b.toCol && b.fromCol <= a.toCol) problems.push(`raised bottoms at columns ${a.fromCol} to ${a.toCol} and ${b.fromCol} to ${b.toCol} overlap`);
    }
  });
  for (const b of spans) {
    for (let col = b.fromCol; col <= b.toCol; col++) {
      const under = new Set(Array.from({ length: Math.max(0, last - b.row + 1) }, (_, i) => world.solidTile(col, b.row + i)));
      if (under.size > 1) problems.push(`column ${col} under the raised bottom at row ${b.row} is neither solid nor empty all the way down`);
    }
  }
  const standing: (readonly [string, { readonly x: number; readonly y: number }])[] = [
    ['the spawn', level.spawn],
    ...level.ofrendas.map((o) => [`ofrenda ${o.id}`, o] as const),
    ...(level.exit ? [['the exit', level.exit] as const] : []),
  ];
  for (const [name, p] of standing) {
    const row = bottomRowAt(level, Math.floor(p.x / TILE));
    if (p.y > row * TILE) problems.push(`${name} at ${p.x},${p.y} is below its column's bottom row (${row})`);
  }
  return problems;
}

/** GDD-WLD-17: the back walls' problems: any outside World 3, and each one outside the level, with its corners out of order, or overlapping another. */
function backWallProblems(level: Level, world: number): string[] {
  const walls = level.backWalls ?? [];
  if (walls.length === 0) return [];
  if (world !== 3) return ['back walls, only World 3 has them'];
  const problems: string[] = [];
  const name = (w: (typeof walls)[number]) => `columns ${w.col0} to ${w.col1}, rows ${w.row0} to ${w.row1}`;
  for (const w of walls) {
    if (w.col0 > w.col1 || w.row0 > w.row1) problems.push(`back wall at ${name(w)} has its corners out of order`);
    else if (w.col0 < 0 || w.row0 < 0 || w.col1 >= level.world.width || w.row1 >= level.world.height) problems.push(`back wall at ${name(w)} reaches outside the level`);
  }
  walls.forEach((a, i) => {
    for (const b of walls.slice(i + 1)) {
      if (Math.max(a.col0, b.col0) <= Math.min(a.col1, b.col1) && Math.max(a.row0, b.row0) <= Math.min(a.row1, b.row1)) problems.push(`back walls at ${name(a)} and ${name(b)} overlap`);
    }
  });
  return problems;
}

/** Every problem with the level, as one sentence each; empty when it passes. */
export function validateLevel(entry: LevelEntry): readonly string[] {
  const { level } = entry;
  const problems: string[] = [];
  const screen = BASE_WIDTH / TILE;

  const width = level.world.width;
  if (isBossLevel(level)) {
    // GDD-BOS-01: a boss level has no ofrendas (its checkpoint is the arena start) and no exit (beating the boss clears it), and is one screen wide.
    if (level.ofrendas.length !== 0) problems.push(`${level.ofrendas.length} ofrendas, a boss level has none`);
    if (level.exit) problems.push('an exit, a boss level has none');
    if (width !== screen) problems.push(`${width} tiles wide, a boss level is one screen (${screen})`);
  } else {
    // GDD-WLD-03: 3 ofrenda checkpoints and an exit.
    if (level.ofrendas.length !== LEVEL_RULES.ofrendas) problems.push(`${level.ofrendas.length} ofrendas, expected ${LEVEL_RULES.ofrendas}`);
    if (!entry.test && !level.exit) problems.push('no exit');

    // GDD-WLD-03: 3 screens wide at least, and at most the world's longest (6 in Worlds 0 and 1, 8 from World 2 on).
    const most = LEVEL_RULES.maxScreens[entry.world];
    if (most === undefined) problems.push(`no length limit for World ${entry.world}`);
    else {
      const min = LEVEL_RULES.minScreens * screen;
      const max = most * screen;
      if (!entry.test && (width < min || width > max)) problems.push(`${width} tiles wide, expected ${min} to ${max} (${LEVEL_RULES.minScreens} to ${most} screens)`);
    }
  }
  // GDD-WLD-15: a rail's limits (a boss level is exempt from the level run and the 12 tiles, GDD-BOS-04), no shared stretch and no rail
  // starting at another's end.
  problems.push(...railProblems(level.rails ?? [], isBossLevel(level)));

  // GDD-WLD-03: gaps never exceed the world's limit; World 3's depends on the drop and the roof.
  const limit = LEVEL_RULES.maxGapTiles[entry.world];
  if (entry.world === 3) problems.push(...world3GapProblems(level));
  else if (limit === undefined) problems.push(`no gap limit for World ${entry.world}`);
  else {
    for (const g of openGaps(level)) {
      if (g.width > limit) problems.push(`gap of ${g.width} tiles at columns ${g.col} to ${g.col + g.width - 1}, World ${entry.world} allows ${limit}`);
    }
  }

  // GDD-WLD-05: crumbled ledges come back in World 3's levels (test levels too), and in no other world's.
  if (level.crumblesReturn === true && entry.world !== 3) problems.push('crumbling tiles that come back, only World 3 has them');
  if (entry.world === 3 && level.crumbles.length > 0 && level.crumblesReturn !== true) problems.push("crumbling tiles that do not come back, World 3's do");

  // GDD-ART-06: a level chooses its place among World 3's, and only there.
  if (entry.place !== undefined && entry.world !== 3) problems.push(`a place (${entry.place}), only a World 3 level chooses one`);

  // GDD-WLD-17: the rock back walls, only in World 3, each inside the level with its corners in order, no two sharing a tile.
  problems.push(...backWallProblems(level, entry.world));

  // GDD-WLD-03, GDD-TEC-04: the level's height and its raised bottoms, a test level's too.
  problems.push(...heightProblems(level), ...bottomProblems(level));

  // GDD-ENM-01: no enemy starts within 3 tiles of a respawn; GDD-ENM-04: a Murciélago comes no nearer anywhere on its loop.
  const respawns = [level.spawn, ...level.ofrendas];
  for (const e of level.enemies) {
    const places = kindOf(e) === 'murcielago' ? loopOf(e) : [e];
    for (const r of respawns) {
      const d = Math.min(...places.map((p) => Math.hypot(p.x - r.x, p.y - r.y)));
      if (d < LEVEL_RULES.enemyClearance) problems.push(`${kindOf(e)} at ${e.x},${e.y} is ${Math.floor(d)} px from the respawn at ${r.x},${r.y}, under ${LEVEL_RULES.enemyClearance}`);
    }
  }

  // GDD-ENM-04: each Murciélago's loop; each Armadillo's ground, walk and rolls, and only World 3 has them.
  for (const e of level.enemies) if (kindOf(e) === 'murcielago') problems.push(...murcielagoProblems(level, e));
  for (const e of level.enemies) if (kindOf(e) === 'armadillo') problems.push(...armadilloProblems(level, e));
  for (const e of level.enemies) if (kindOf(e) === 'armadillo' && entry.world !== 3) problems.push(`armadillo at column ${Math.floor(e.x / TILE)} in World ${entry.world}, only World 3 has them`);
  // GDD-ENM-04: each Cacomixtle's rail, place and sight stretch, and only World 3 has them.
  problems.push(...cacomixtleProblems(level));
  for (const e of level.enemies) if (kindOf(e) === 'cacomixtle' && entry.world !== 3) problems.push(`cacomixtle at ${e.x},${e.y} in World ${entry.world}, only World 3 has them`);

  // GDD-ENM-01, GDD-BOS-01: the boss starts at least 3 tiles from the spawn, his only respawn.
  if (level.boss) {
    const start = bossStart(level.boss, 0);
    const d = Math.hypot(start.x - level.spawn.x, start.y - level.spawn.y);
    if (d < LEVEL_RULES.enemyClearance) problems.push(`the boss starts ${Math.floor(d)} px from the spawn, under ${LEVEL_RULES.enemyClearance}`);
  }
  // GDD-BOS-03: La Estrella too, by her box's middle, at the start of each phase: a lost life starts her phase again (GDD-BOS-01).
  if (level.estrella) {
    for (const hits of [0, 1, 2]) {
      const start = estrellaStart(level.estrella, hits);
      const d = Math.hypot(start.x - level.spawn.x, start.y - ESTRELLA.height / 2 - level.spawn.y);
      if (d < LEVEL_RULES.enemyClearance) problems.push(`La Estrella starts phase ${hits + 1} ${Math.floor(d)} px from the spawn, under ${LEVEL_RULES.enemyClearance}`);
    }
  }

  // GDD-MOV-09: every sand slope tile has a level tile directly under it (so none hangs in the air or sits in the bottom row) and holds
  // none of the level's other tiles.
  const held: (readonly [string, { readonly col: number; readonly row: number }])[] = [
    ...level.spikes.map((t) => ['spike', t] as const),
    ...level.springs.map((t) => ['spring', t] as const),
    ...level.crumbles.map((t) => ['crumbling tile', t] as const),
    ...level.pinatas.map((t) => ['piñata', t] as const),
    ...level.fragiles.map((t) => ['fragile wall', t] as const),
    ...level.doors.flatMap((d) => Array.from({ length: d.height }, (_, i) => ['door', { col: d.col, row: d.row + i }] as const)),
  ];
  for (let row = 0; row < level.world.height; row++) {
    for (let col = 0; col < level.world.width; col++) {
      if (level.world.slopeAt(col, row) === null) continue;
      if (!level.world.solidTile(col, row + 1)) problems.push(`slope at ${col},${row} has no level tile under it`);
      for (const [name, t] of held) if (t.col === col && t.row === row) problems.push(`${name} at ${col},${row} stands in a slope tile`);
    }
  }
  // GDD-WLD-10: an awning's top is at y = AWNING.minTopY or lower, so a tier 3 rebound stays on screen. GDD-WLD-10, GDD-WLD-11: no awning
  // (AWNING.height thick) and no cordel or rollo line (ROLLO.linePx) overlaps a solid tile.
  for (const a of level.awnings ?? []) if (a.y < AWNING.minTopY) problems.push(`awning at ${a.x},${a.y} has its top above y = ${AWNING.minTopY}`);
  const lines: (readonly [string, { readonly x: number; readonly y: number; readonly w: number }, number])[] = [
    ...(level.awnings ?? []).map((a) => ['awning', a, AWNING.height] as const),
    ...(level.cordeles ?? []).map((c) => ['cordel', c, ROLLO.linePx] as const),
    ...(level.rollos ?? []).map((r) => ['rollo', r, ROLLO.linePx] as const),
  ];
  for (const [name, t, h] of lines) {
    let hit = false;
    for (let row = Math.floor(t.y / TILE); row * TILE < t.y + h; row++) {
      for (let col = Math.floor(t.x / TILE); col * TILE < t.x + t.w; col++) hit ||= level.world.solidTile(col, row);
    }
    if (hit) problems.push(`${name} at ${t.x},${t.y} overlaps a solid tile`);
  }
  return problems;
}
