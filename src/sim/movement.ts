// GDD-MOV-01 to GDD-MOV-04: Poncho's movement. Pure logic, no Phaser (GDD-TEC-02).
// Tile collision, corner correction and the stomp bounce arrive with their own GDD IDs.
import { FORGIVENESS, GRAVITY, JUMP, RUN, STEP } from '../config/tuning';

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
}

export interface PlayerInput {
  /** -1 to 1. Keyboard is digital, gamepad and touch stick may be analog. */
  move: number;
  jumpHeld: boolean;
}

export interface World {
  /** Y of the floor under x. Infinity means a pit. */
  floorAt(x: number): number;
}

export const flatWorld = (floorY: number): World => ({ floorAt: () => floorY });

export function spawn(x: number, y: number): PlayerState {
  return { x, y, vx: 0, vy: 0, grounded: true, facing: 1, coyote: 0, jumpBuffer: 0, jumpWasHeld: false };
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
  if (prev.jumpWasHeld && !input.jumpHeld && s.vy < 0) s.vy *= JUMP.cutMultiplier;

  // GDD-MOV-04: gravity, then terminal velocity, then move. Movement uses the average of the old and new
  // velocity (exact for constant acceleration), so jump height does not depend on the step rate.
  const vy0 = s.vy;
  let g = vy0 < 0 ? GRAVITY.rising : GRAVITY.falling;
  if (Math.abs(vy0) < GRAVITY.hangSpeed) g *= GRAVITY.hangMultiplier;
  s.vy = Math.min(vy0 + g * STEP, GRAVITY.terminalVelocity);
  s.x += ((vx0 + s.vx) / 2) * STEP;
  s.y += ((vy0 + s.vy) / 2) * STEP;

  const floor = world.floorAt(s.x);
  if (s.y >= floor && s.vy >= 0) {
    s.y = floor;
    s.vy = 0;
    s.grounded = true;
  } else {
    s.grounded = false;
    s.coyote = Math.max(0, s.coyote - 1);
  }

  s.jumpWasHeld = input.jumpHeld;
  return s;
}
