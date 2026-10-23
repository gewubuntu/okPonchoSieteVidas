// GDD-WLD-05, GDD-LIFE-02: moving blocks. A block is solid on every side and travels back and forth between two ends like a
// moving platform: Poncho lands on its top and is carried, bumps his head on its underside, is stopped by its sides, and is
// pushed along when it moves into him. If a push, or carrying him up, would force him into a solid tile he is crushed.
// Where it is depends only on the step count. Pure logic, no Phaser (GDD-TEC-02).
import { BLOCK, HITBOX, TICK_HZ } from '../config/tuning';
import { blocked, type PlayerState, type World } from './movement';
import { along } from './platform';

/** A block's two ends, as the top-left corner of the block, and its size in px (whole tiles). */
export interface MovingBlock {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
  readonly w: number;
  readonly h: number;
}

export interface BlockPos {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** Keeps floating point noise from deciding whether feet are on a surface. */
const EPS = 1e-6;
const HALF = HITBOX.width / 2;

/** Where the block is after `tick` steps: it starts at its first end and turns round at each end without stopping. */
export function blockAt(b: MovingBlock, tick: number): BlockPos {
  return { ...along(b.x0, b.y0, b.x1, b.y1, BLOCK.speed, tick), w: b.w, h: b.h };
}

const overlapsX = (player: PlayerState, at: BlockPos): boolean => player.x + HALF > at.x + EPS && player.x - HALF < at.x + at.w - EPS;
const overlapsY = (player: PlayerState, at: BlockPos): boolean => player.y > at.y + EPS && player.y - HITBOX.height < at.y + at.h - EPS;
const overlaps = (player: PlayerState, at: BlockPos): boolean => overlapsX(player, at) && overlapsY(player, at);

/**
 * Poncho before a step, with the blocks at `tick` about to move to `tick + 1`. If he stands on a block he is carried with it:
 * sideways unless that would put him in a wall (he stays against it and the block slides on), then up or down. If the block
 * then moves into his body it pushes him out in the direction it moves, on the axis where it moved (the smaller overlap if
 * both). If carrying him up, or a push, would put his body box into a solid tile, he is crushed: the result is then Poncho
 * as he was, and `crushed` is true. `solid` is the run's combined solid world, so doors, piñatas and the like count.
 */
export function moveBlocks(player: PlayerState, blocks: readonly MovingBlock[], tick: number, solid: World): { player: PlayerState; crushed: boolean } {
  let p = player;
  for (const b of blocks) {
    const from = blockAt(b, tick);
    const to = blockAt(b, tick + 1);
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    if (p.grounded && Math.abs(p.y - from.y) < EPS && overlapsX(p, from)) {
      const x = blocked(solid, p.x + dx, p.y) ? p.x : p.x + dx;
      // Carried down he moves away from any ceiling, so only carrying him up can crush him.
      if (dy < 0 && blocked(solid, x, p.y + dy)) return { player, crushed: true };
      p = { ...p, x, y: p.y + dy };
      continue;
    }
    if (!overlaps(p, to)) continue;
    const overlapX = dx > 0 ? to.x + to.w - (p.x - HALF) : p.x + HALF - to.x;
    const overlapY = dy > 0 ? to.y + to.h - (p.y - HITBOX.height) : p.y - to.y;
    const sideways = dx !== 0 && (dy === 0 || overlapX <= overlapY);
    let pushed: PlayerState;
    if (sideways) pushed = { ...p, x: dx > 0 ? to.x + to.w + HALF : to.x - HALF, vx: 0 };
    else if (dy > 0) pushed = { ...p, y: to.y + to.h + HITBOX.height, vy: Math.max(p.vy, dy * TICK_HZ) };
    else pushed = { ...p, y: to.y, vy: 0, grounded: true };
    if (blocked(solid, pushed.x, pushed.y)) return { player, crushed: true };
    p = pushed;
  }
  return { player: p, crushed: false };
}

/**
 * Poncho after a step, with the blocks at `tick + 1` and `before` being Poncho before the step but after `moveBlocks`. If the
 * step took him into a block, he is put back on the side he came from: on top if his feet were at or above its top (he
 * stands on it), against its underside if his head was at or below it, otherwise against its side. A side is not a wall to
 * cling to (GDD-MOV-08): movement only clings to solid tiles, which a block is not, so there is nothing to switch off here.
 */
export function collideBlocks(before: PlayerState, stepped: PlayerState, blocks: readonly MovingBlock[], tick: number): PlayerState {
  let p = stepped;
  for (const b of blocks) {
    const at = blockAt(b, tick + 1);
    if (!overlaps(p, at)) continue;
    if (before.y <= at.y + EPS) {
      p = { ...p, y: at.y, vy: 0, grounded: true, bounced: false, gliding: false, clinging: false };
    } else if (before.y - HITBOX.height >= at.y + at.h - EPS) {
      p = { ...p, y: at.y + at.h + HITBOX.height, vy: Math.max(p.vy, 0) };
    } else {
      p = { ...p, x: before.x < at.x + at.w / 2 ? at.x - HALF : at.x + at.w + HALF, vx: 0 };
    }
  }
  return p;
}
