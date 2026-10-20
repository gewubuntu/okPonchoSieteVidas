// Every gameplay number lives here, each tagged with its GDD ID (GDD-TEC-05).
// Change a number here and in docs/GDD.md in the same commit.
// Units are virtual pixels and seconds. The vertical axis points down, so rising means negative velocity.

/** GDD-TEC-02: fixed simulation rate. */
export const TICK_HZ = 60;
export const STEP = 1 / TICK_HZ;

/** GDD-ART-01: base resolution and tile grid. */
export const BASE_WIDTH = 480;
export const BASE_HEIGHT = 270;
export const TILE = 16;

/** GDD-LIFE-01: lives per world. */
export const LIVES_MAX = 7;

/** GDD-MOV-01 */
export const RUN = {
  maxSpeed: 120,
  groundAccel: 800,
  groundDecel: 1000,
  turnAccel: 1600,
  airAccel: 600,
  airDecel: 300,
} as const;

/** GDD-MOV-02 */
export const JUMP = {
  /** Takeoff speed, upwards. */
  velocity: 410,
  /** Upward speed is multiplied by this when jump is released while rising. */
  cutMultiplier: 0.4,
} as const;

/** GDD-MOV-03 (corner correction and stomp bounce buffer arrive with tile collision and combat). */
export const FORGIVENESS = {
  coyoteSteps: Math.round(0.1 * TICK_HZ),
  bufferSteps: Math.round(0.1 * TICK_HZ),
} as const;

/** GDD-MOV-04 */
export const GRAVITY = {
  rising: 1500,
  falling: 2250,
  terminalVelocity: 360,
  /** Below this speed magnitude, gravity is scaled by hangMultiplier in both directions. */
  hangSpeed: 40,
  hangMultiplier: 0.5,
} as const;

/** GDD-MOV-06: body hitbox for ground and walls, hurtbox for enemies and hazards, sprite frame. */
export const HITBOX = { width: 12, height: 14 } as const;
export const HURTBOX = { width: 10, height: 12 } as const;
export const SPRITE_FRAME = 32;

/** GDD-LIFE-02: after a life is lost, wait, then respawn; any input skips the wait after a short while. */
export const RESPAWN = {
  delaySteps: Math.round(0.8 * TICK_HZ),
  skipAfterSteps: Math.round(0.3 * TICK_HZ),
  /** Invulnerability after respawning, 2.0 s (GDD-LIFE-02, GDD-CMB-03). */
  invulnerableSteps: Math.round(2.0 * TICK_HZ),
} as const;

/** GDD-WLD-05: an ofrenda checkpoint is one tile wide and two tiles tall, standing on the floor. Touching it activates it. */
export const OFRENDA = { width: TILE, height: 2 * TILE } as const;

/** GDD-CTL-03: touch buttons, in virtual pixels except `minCssPx`. */
export const TOUCH = {
  /** Left, right and jump button sizes (jump is larger), and the space around them. */
  size: 40,
  jumpSize: 56,
  margin: 6,
  gap: 4,
  /** A button is never smaller than this on the player's screen, in CSS pixels (GDD-CTL-03). */
  minCssPx: 48,
} as const;

/** GDD-LIFE-02: the lost triangle on the HUD cracks and fades to an outline in 0.4 s. */
export const LIFE_LOSS = { crackSteps: Math.round(0.4 * TICK_HZ) } as const;

/** GDD-LIFE-02 and GDD-MOV-05: in the last 0.35 s of the wait Poncho drops in 48 px above the respawn point, turning once, and lands feet-first. */
export const FLIP = { steps: Math.round(0.35 * TICK_HZ), height: 48, turns: 1 } as const;
