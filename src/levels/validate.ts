// GDD-TEC-04: the level validator. Pure, no Phaser. It checks what the GDD says every level must have (GDD-MOV-09: its sand slopes
// have ground under them and hold nothing else), so a level that breaks a rule fails a test instead of being found in play.
import { AWNING, BASE_WIDTH, COVER, ESTRELLA, LEVEL_RULES, ROLLO, TILE } from '../config/tuning';
import { bossStart } from '../sim/boss';
import { estrellaStart } from '../sim/estrella';
import { isBossLevel } from '../sim/bossLevel';
import { kindOf } from '../sim/enemy';
import type { Level } from '../sim/run';
import type { TileGrid } from '../sim/tilemap';
import type { LevelEntry } from './index';

export interface Gap {
  readonly col: number;
  readonly width: number;
}

/** Runs of adjacent columns whose bottom row is empty, left to right. */
export function gaps(world: TileGrid): readonly Gap[] {
  const found: Gap[] = [];
  let start = -1;
  for (let col = 0; col < world.width; col++) {
    const pit = !world.solidTile(col, world.height - 1);
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
function groundTopAt(world: TileGrid, col: number): number {
  let row = world.height - 1;
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
  return gaps(world).flatMap((g) => {
    const left = g.col - 1;
    const right = g.col + g.width;
    const open: Gap[] = [];
    let start = -1;
    for (let col = g.col; col <= right; col++) {
      let covered = false;
      if (col < right) {
        const edge = left >= 0 && (right >= world.width || col - left <= right - col) ? left : right;
        const ground = groundTopAt(world, edge);
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

    // GDD-WLD-03: 3 to 6 screens wide.
    const min = LEVEL_RULES.minScreens * screen;
    const max = LEVEL_RULES.maxScreens * screen;
    if (!entry.test && (width < min || width > max)) {
      problems.push(`${width} tiles wide, expected ${min} to ${max} (${LEVEL_RULES.minScreens} to ${LEVEL_RULES.maxScreens} screens)`);
    }
  }

  // GDD-WLD-03: gaps never exceed the world's limit.
  const limit = LEVEL_RULES.maxGapTiles[entry.world];
  if (limit === undefined) problems.push(`no gap limit for World ${entry.world}`);
  else {
    for (const g of openGaps(level)) {
      if (g.width > limit) problems.push(`gap of ${g.width} tiles at columns ${g.col} to ${g.col + g.width - 1}, World ${entry.world} allows ${limit}`);
    }
  }

  // GDD-ENM-01: no enemy starts within 3 tiles of a respawn.
  const respawns = [level.spawn, ...level.ofrendas];
  for (const e of level.enemies) {
    for (const r of respawns) {
      const d = Math.hypot(e.x - r.x, e.y - r.y);
      if (d < LEVEL_RULES.enemyClearance) problems.push(`${kindOf(e)} at ${e.x},${e.y} is ${Math.floor(d)} px from the respawn at ${r.x},${r.y}, under ${LEVEL_RULES.enemyClearance}`);
    }
  }

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
