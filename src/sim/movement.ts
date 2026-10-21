// GDD-MOV-01 to GDD-MOV-04 and GDD-MOV-06: Poncho's movement and tile collision. Pure logic, no Phaser (GDD-TEC-02).
// The stomp bounce (GDD-MOV-03) arrives with combat.
import { FORGIVENESS, GRAVITY, HITBOX, JUMP, RUN, STEP, TILE } from '../config/tuning';

export interface PlayerState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  grounded: boolean;
  facing: 1 | -1;
  /** Steps left in which a jump is still allowed after leaving the ground (GDD-MOV-03). */
  coyote: number;
  /** Steps left in which an early jump press is remembered (GDD-MOV-03). */
  jumpBuffer: number;
  jumpWasHeld: boolean;
  /** Launched by a spring and still rising: releasing jump does not cut it short (GDD-WLD-05). */
  bounced: boolean;
}

export interface PlayerInput {
  /** -1 to 1. Keyboard is digital, gamepad and touch stick may be analog. */
  move: number;
  jumpHeld: boolean;
}

export interface World {
  /** Is tile (tx, ty) solid? Tile (0, 0) covers x and y from 0 to 16. */
  solidTile(tx: number, ty: number): boolean;
}

/** An endless flat floor whose top is at y = floorY (a multiple of the tile size). */
export const flatWorld = (floorY: number): World => ({ solidTile: (_tx, ty) => ty >= Math.floor(floorY / TILE) });

const HALF_WIDTH = HITBOX.width / 2;
/** Keeps a box that only touches a tile edge from counting as inside it. */
const EDGE = 1e-6;

/** Does Poncho's body box, centred on x with its feet at y (GDD-MOV-06), overlap a solid tile? */
function blocked(world: World, x: number, y: number): boolean {
  const left = Math.floor((x - HALF_WIDTH) / TILE);
  const right = Math.floor((x + HALF_WIDTH - EDGE) / TILE);
  const top = Math.floor((y - HITBOX.height) / TILE);
  const bottom = Math.floor((y - EDGE) / TILE);
  for (let ty = top; ty <= bottom; ty++) {
    for (let tx = left; tx <= right; tx++) if (world.solidTile(tx, ty)) return true;
  }
  return false;
}

export function spawn(x: number, y: number): PlayerState {
  return { x, y, vx: 0, vy: 0, grounded: true, facing: 1, coyote: 0, jumpBuffer: 0, jumpWasHeld: false, bounced: false };
}

/**
 * GDD-MOV-03 corner correction. Poncho has just moved up into a block, and only one side of his box is inside it, by
 * FORGIVENESS.cornerPx or less: the horizontal shift that clears the corner, or 0 if there is none (a ceiling over his
 * whole width, or more than the allowed clip). His box is narrower than a tile, so it spans at most two columns, and
 * after the shift it lies in the one column that was free, which cannot hold anything new. A box inside one column is
 * either all blocked or all free, so it never gets a nudge.
 */
function cornerNudge(world: World, x: number, y: number): number {
  const left = Math.floor((x - HALF_WIDTH) / TILE);
  const right = Math.floor((x + HALF_WIDTH - EDGE) / TILE);
  const top = Math.floor((y - HITBOX.height) / TILE);
  const bottom = Math.floor((y - EDGE) / TILE);
  const columnBlocked = (tx: number) => {
    for (let ty = top; ty <= bottom; ty++) if (world.solidTile(tx, ty)) return true;
    return false;
  };
  const leftBlocked = columnBlocked(left);
  const rightBlocked = columnBlocked(right);
  if (leftBlocked === rightBlocked) return 0;
  // His left side is in a block: shift right until it is at the block's right edge. His right side: shift left.
  const shift = leftBlocked ? (left + 1) * TILE - (x - HALF_WIDTH) : right * TILE - (x + HALF_WIDTH);
  return Math.abs(shift) <= FORGIVENESS.cornerPx ? shift : 0;
}

function approach(value: number, target: number, delta: number): number {
  return value < target ? Math.min(value + delta, target) : Math.max(value - delta, target);
}

/** Advances one fixed step. Returns a new state and never mutates its input. */
export function step(prev: PlayerState, input: PlayerInput, world: World): PlayerState {
  const s: PlayerState = { ...prev };
  const vx0 = prev.vx;
  const move = Math.max(-1, Math.min(1, input.move));

  // GDD-MOV-01: horizontal movement
  if (move === 0) {
    s.vx = approach(s.vx, 0, (s.grounded ? RUN.groundDecel : RUN.airDecel) * STEP);
  } else {
    const turning = s.vx !== 0 && Math.sign(s.vx) !== Math.sign(move);
    const accel = s.grounded ? (turning ? RUN.turnAccel : RUN.groundAccel) : RUN.airAccel;
    s.vx = approach(s.vx, move * RUN.maxSpeed, accel * STEP);
    s.facing = move > 0 ? 1 : -1;
  }

  // GDD-MOV-03: forgiveness windows. A jump press is an edge: holding the button never rejumps (GDD-MOV-02).
  const pressed = input.jumpHeld && !prev.jumpWasHeld;
  if (s.grounded) s.coyote = FORGIVENESS.coyoteSteps;
  s.jumpBuffer = pressed ? FORGIVENESS.bufferSteps : Math.max(0, s.jumpBuffer - 1);

  // GDD-MOV-02: takeoff
  if (s.jumpBuffer > 0 && s.coyote > 0) {
    s.vy = -JUMP.velocity;
    s.jumpBuffer = 0;
    s.coyote = 0;
    s.grounded = false;
  }

  // GDD-MOV-02: variable jump height, cut once on release while rising
  if (prev.jumpWasHeld && !input.jumpHeld && s.vy < 0 && !prev.bounced) s.vy *= JUMP.cutMultiplier;

  // GDD-MOV-04: gravity, then terminal velocity, then move. Movement uses the average of the old and new
  // velocity (exact for constant acceleration), so jump height does not depend on the step rate.
  const vy0 = s.vy;
  let g = vy0 < 0 ? GRAVITY.rising : GRAVITY.falling;
  if (Math.abs(vy0) < GRAVITY.hangSpeed) g *= GRAVITY.hangMultiplier;
  s.vy = Math.min(vy0 + g * STEP, GRAVITY.terminalVelocity);
  if (s.vy >= 0) s.bounced = false;

  // GDD-MOV-06: move one axis at a time and snap to the tile edge that was hit. The fastest speed is the 410 px/s jump
  // takeoff, about 6.8 px per step and far less than a 16 px tile, so the box can never jump over a tile (a test
  // guards this against the tuning values).
  const dx = ((vx0 + s.vx) / 2) * STEP;
  const dy = ((vy0 + s.vy) / 2) * STEP;

  s.x += dx;
  if (blocked(world, s.x, s.y)) {
    s.x = dx > 0 ? Math.floor((s.x + HALF_WIDTH - EDGE) / TILE) * TILE - HALF_WIDTH
      : (Math.floor((s.x - HALF_WIDTH) / TILE) + 1) * TILE + HALF_WIDTH;
    s.vx = 0;
  }

  s.y += dy;
  let landed = false;
  if (blocked(world, s.x, s.y)) {
    if (dy > 0) {
      s.y = Math.floor((s.y - EDGE) / TILE) * TILE; // stand on top of the tile
      landed = true;
      s.vy = 0;
    } else {
      const nudge = cornerNudge(world, s.x, s.y);
      if (nudge !== 0) {
        s.x += nudge; // GDD-MOV-03: slide around the corner and keep rising
      } else {
        s.y = (Math.floor((s.y - HITBOX.height) / TILE) + 1) * TILE + HITBOX.height; // bump the underside
        s.vy = 0;
      }
    }
  }

  s.grounded = landed;
  if (!landed) s.coyote = Math.max(0, s.coyote - 1);

  s.jumpWasHeld = input.jumpHeld;
  return s;
}
