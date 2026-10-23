// GDD-MOV-01 to GDD-MOV-04 and GDD-MOV-06: Poncho's movement and tile collision. Pure logic, no Phaser (GDD-TEC-02).
// The stomp bounce (GDD-MOV-03) arrives with combat. GDD-MOV-07 and GDD-MOV-08: the glide and the wall cling and kick,
// where the level allows them.
import { FORGIVENESS, GLIDE, GRAVITY, HITBOX, JUMP, RUN, STEP, TILE, WALL } from '../config/tuning';

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
  /** GDD-MOV-07: gliding on the spread poncho this step. Left out means no. */
  gliding?: boolean;
  /** GDD-MOV-07: steps left in which a glide cannot start, after a stomp bounce. Left out means none. */
  glideLock?: number;
  /** GDD-MOV-07: how many steps in a row jump has been held, this one included. Left out means none. */
  jumpHeldSteps?: number;
  /** GDD-MOV-08: sliding down a wall this step. Left out means no. */
  clinging?: boolean;
  /** GDD-MOV-08: the side of the wall last touched in the air (-1 left, 1 right) and the steps left to kick off it. */
  wallSide?: -1 | 1;
  wallGrace?: number;
  /** GDD-MOV-08: steps left in which sideways control is locked after a wall kick. */
  kickLock?: number;
  /** GDD-AUD-02: set on the step a jump (GDD-MOV-02) or a wall kick (GDD-MOV-08) takes off. Left out means neither. */
  takeoff?: 'jump' | 'kick';
}

/** Abilities unlocked by progression (GDD-PRG-01). Left out means none. */
export interface Abilities {
  readonly glide?: boolean;
  readonly wallCling?: boolean;
}

export interface PlayerInput {
  /** -1 to 1. Keyboard is digital, gamepad and touch stick may be analog. */
  move: number;
  jumpHeld: boolean;
  /** The claw button is down (GDD-CMB-02). A swing starts on the press. Left out means not pressed. */
  claw?: boolean;
  /** The Fuego button is down (GDD-PWR-03). A fireball is spat on the press. Left out means not pressed. */
  fuego?: boolean;
  /**
   * The left and right buttons, before they are combined into `move` (where holding both cancels out). The screen after the
   * last life counts a press of either (GDD-LIFE-05). Left out, they are read from the sign of `move`.
   */
  left?: boolean;
  right?: boolean;
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
/** How far beside his box a wall still counts as touching it (GDD-MOV-08), in px. */
const WALL_PROBE = 0.01;

/** Does Poncho's body box, centred on x with its feet at y (GDD-MOV-06), overlap a solid tile? */
export function blocked(world: World, x: number, y: number): boolean {
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
export function step(prev: PlayerState, input: PlayerInput, world: World, abilities: Abilities = {}): PlayerState {
  const s: PlayerState = { ...prev };
  delete s.takeoff;
  const vx0 = prev.vx;
  const move = Math.max(-1, Math.min(1, input.move));

  // GDD-MOV-08: a wall right beside him, checked where he starts the step. On the ground it changes nothing: a jump there is a
  // normal jump, and standing ends a slide. Running into a wall snaps him flush against it
  // (GDD-MOV-06), so his box moved a hair that way overlaps a tile only while he touches it.
  const touching: -1 | 0 | 1 = blocked(world, prev.x - WALL_PROBE, prev.y) ? -1 : blocked(world, prev.x + WALL_PROBE, prev.y) ? 1 : 0;
  if (touching !== 0) {
    s.wallSide = touching;
    s.wallGrace = WALL.graceSteps;
  }
  s.kickLock = Math.max(0, (prev.kickLock ?? 0) - 1);

  // GDD-MOV-01: horizontal movement. Locked for a moment after a wall kick (GDD-MOV-08).
  if ((prev.kickLock ?? 0) > 0) {
    // keep the kick's speed
  } else if (move === 0) {
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
    s.takeoff = 'jump';
  } else if (pressed && abilities.wallCling === true && !s.bounced && (s.wallGrace ?? 0) > 0 && s.wallSide !== undefined) {
    // GDD-MOV-08: a jump press in the air beside a wall, or just after leaving it, kicks away from it (on the ground the
    // press is a normal jump, above). Not while rising from a spring: that launch is fixed once it starts (GDD-WLD-05; user,
    // 2026-10-23). Only a press the
    // simulation saw counts, so a jump held through a respawn or a pause (GDD-UI-02) does not kick.
    const away = s.wallSide === -1 ? 1 : -1;
    s.vx = away * WALL.kickX;
    s.vy = -WALL.kickY;
    s.facing = away;
    s.kickLock = WALL.lockSteps;
    s.takeoff = 'kick';
    s.wallGrace = 0; // one kick per touch: a second press on the way out does not kick off the same wall again
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

  // GDD-MOV-07: holding jump while falling glides: the fall is capped, sideways movement is as in any fall. It cannot start
  // until jump has been held longer than the jump buffer, nor until the lock after a stomp bounce has run out.
  s.glideLock = Math.max(0, (prev.glideLock ?? 0) - 1);
  // Counted only from a press this simulation saw: a button marked as already held (after a respawn, or pressed while paused,
  // GDD-UI-02) does not glide until it is pressed again.
  const heldFor = prev.jumpHeldSteps ?? 0;
  s.jumpHeldSteps = input.jumpHeld && (pressed || heldFor > 0) ? heldFor + 1 : 0;
  // GDD-MOV-08: pressing toward a wall while falling slides down it slowly. The cling wins over the glide.
  s.clinging = abilities.wallCling === true && touching !== 0 && move * touching > 0 && s.vy > 0;
  if (s.clinging) s.vy = Math.min(s.vy, WALL.slideSpeed);
  s.gliding = abilities.glide === true && !s.clinging && s.jumpHeldSteps > GLIDE.holdSteps && s.vy > 0 && s.glideLock === 0;
  if (s.gliding) s.vy = Math.min(s.vy, GLIDE.fallSpeed);

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
  if (landed) {
    s.gliding = false; // GDD-MOV-07: standing (or landing) ends a glide
    s.clinging = false; // GDD-MOV-08: and a wall slide
  }
  s.wallGrace = Math.max(0, (s.wallGrace ?? 0) - 1);
  if (!landed) s.coyote = Math.max(0, s.coyote - 1);

  s.jumpWasHeld = input.jumpHeld;
  return s;
}
