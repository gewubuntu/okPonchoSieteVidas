// GDD-TEC-04: the level validator. Pure, no Phaser. It checks what the GDD says every level must have, so a level that
// breaks a rule fails a test instead of being found in play.
import { BASE_WIDTH, LEVEL_RULES, TILE } from '../config/tuning';
import { kindOf } from '../sim/enemy';
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

/** Every problem with the level, as one sentence each; empty when it passes. */
export function validateLevel(entry: LevelEntry): readonly string[] {
  const { level } = entry;
  const problems: string[] = [];
  const screen = BASE_WIDTH / TILE;

  // GDD-WLD-03: 3 ofrenda checkpoints and an exit.
  if (level.ofrendas.length !== LEVEL_RULES.ofrendas) problems.push(`${level.ofrendas.length} ofrendas, expected ${LEVEL_RULES.ofrendas}`);
  if (!entry.test && !level.exit) problems.push('no exit');

  // GDD-WLD-03: 3 to 6 screens wide.
  const width = level.world.width;
  const min = LEVEL_RULES.minScreens * screen;
  const max = LEVEL_RULES.maxScreens * screen;
  if (!entry.test && (width < min || width > max)) {
    problems.push(`${width} tiles wide, expected ${min} to ${max} (${LEVEL_RULES.minScreens} to ${LEVEL_RULES.maxScreens} screens)`);
  }

  // GDD-WLD-03: gaps never exceed the world's limit.
  const limit = LEVEL_RULES.maxGapTiles[entry.world];
  if (limit === undefined) problems.push(`no gap limit for World ${entry.world}`);
  else {
    for (const g of gaps(level.world)) {
      if (g.width > limit) problems.push(`gap of ${g.width} tiles at columns ${g.col} to ${g.col + g.width - 1}, World ${entry.world} allows ${limit}`);
    }
  }

  // GDD-ENM-01: no enemy starts within 3 tiles of a respawn.
  const respawns = [level.spawn, ...level.ofrendas];
  for (const e of level.enemies) {
    for (const r of respawns) {
      const d = Math.hypot(e.x - r.x, e.y - r.y);
      if (d < LEVEL_RULES.enemyClearance) problems.push(`${kindOf(e)} at ${e.x},${e.y} is ${Math.round(d)} px from the respawn at ${r.x},${r.y}, under ${LEVEL_RULES.enemyClearance}`);
    }
  }
  return problems;
}
