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

/** GDD-MOV-03 (the stomp bounce buffer arrives with combat). */
export const FORGIVENESS = {
  coyoteSteps: Math.round(0.1 * TICK_HZ),
  bufferSteps: Math.round(0.1 * TICK_HZ),
  /** Corner correction: a head that clips a block corner by this many px or less is nudged around it (px). */
  cornerPx: 4,
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

/** GDD-WLD-05: a spike tile hurts only in its lower half, the full tile wide, so a graze over the points is safe. */
export const SPIKE = { height: TILE / 2 } as const;

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
  /** Slide stick: the share of the half-track around its centre that does nothing (same 0.2 as the gamepad, GDD-CTL-02). */
  stickDeadZone: 0.2,
} as const;

/** GDD-LIFE-02: the lost triangle on the HUD cracks and fades to an outline in 0.4 s. */
export const LIFE_LOSS = { crackSteps: Math.round(0.4 * TICK_HZ) } as const;

/** GDD-LIFE-02 and GDD-MOV-05: in the last 0.35 s of the wait Poncho drops in 48 px above the respawn point, turning once, and lands feet-first. */
export const FLIP = { steps: Math.round(0.35 * TICK_HZ), height: 48, turns: 1 } as const;

/** GDD-WLD-05: a crumbling tile gives 0.5 s of warning from the step Poncho lands on it, then is gone. */
export const CRUMBLE = { warningSteps: Math.round(0.5 * TICK_HZ) } as const;

/**
 * GDD-WLD-05: a spring launches Poncho upwards at `velocity` (a jump takes off at 410). A jump pressed in the 0.1 s
 * before he lands on it launches him at `boostVelocity` instead.
 */
export const SPRING = { velocity: 480, boostVelocity: 600 } as const;

/** GDD-WLD-05: a moving platform travels back and forth along its path at this speed (px/s) and is a one-way floor. */
export const PLATFORM = { speed: 40 } as const;

/** GDD-CMB-03: a hit that leaves Poncho alive gives 2.0 s of invulnerability and pushes him away from the source (px/s). */
export const HIT = { invulnerableSteps: Math.round(2.0 * TICK_HZ), knockback: 80 } as const;

/** GDD-PWR-02: a taco is a square this many px wide (a pickup sits centred in its tile); one released from a piñata walks at `walkSpeed` px/s. */
export const TACO = { size: 12, walkSpeed: 40 } as const;

/** GDD-WLD-05: a key pickup is a square this many px wide, centred in its tile. A door touches Poncho from the side within `doorReachPx`. */
export const KEY = { size: 12, doorReachPx: 1 } as const;

/**
 * GDD-CMB-02: the claw swipe. A press starts a 2-step wind-up, then a 3-step swing that hits a box `reach` px long and
 * `height` px tall, level with the body and starting at the body's front edge. The next swing may start `cooldownSteps`
 * (0.25 s) after the press that started the last one.
 */
export const CLAW = { windupSteps: 2, activeSteps: 3, cooldownSteps: Math.round(0.25 * TICK_HZ), reach: 20, height: 14 } as const;

/**
 * GDD-PWR-03: a salsa fireball. It leaves Poncho's front at `speed` px/s, falls and bounces along the ground so each bounce
 * climbs `bounceHeight` px, and vanishes on a wall, a ceiling, below the level or after `lifeSteps` (3 s). At most
 * `maxActive` exist at once. `size` is the width of its square box and `gravity` how fast it falls (px/s squared).
 */
export const FIREBALL = { speed: 180, bounceHeight: 20, gravity: 1500, lifeSteps: 3 * TICK_HZ, maxActive: 2, size: 6 } as const;

/**
 * GDD-ENM-02: the Alacrán (scorpion) is `width` x `height` px, standing on the ground, and patrols at `speed` px/s.
 */
export const ENEMY = { width: 14, height: 10, speed: 30 } as const;

/** GDD-ENM-02: the cactus buddy is a static, spiky `width` x `height` px enemy standing on the ground. */
export const CACTUS = { width: 12, height: 16 } as const;

/**
 * GDD-ENM-02: the Tlacuache (opossum) is `width` x `height` px, standing on the ground, and walks at `speed` px/s. When
 * Poncho's feet are within `sightY` px of its own, up or down, and his hurtbox centre is up to `sightX` px in front of it, it
 * freezes for `telegraphSteps` (0.5 s, GDD-ENM-01), then charges at `chargeSpeed` px/s. The first stomp makes it play dead for
 * `playDeadSteps` (2.0 s); it twitches in the last `twitchSteps` (0.5 s) of that.
 */
export const TLACUACHE = {
  width: 16,
  height: 10,
  speed: 24,
  sightX: 80,
  sightY: 16,
  telegraphSteps: Math.round(0.5 * TICK_HZ),
  chargeSpeed: 150,
  playDeadSteps: Math.round(2.0 * TICK_HZ),
  twitchSteps: Math.round(0.5 * TICK_HZ),
} as const;

/**
 * GDD-ENM-02: the Zopilote (vulture) is `width` x `height` px. It cruises at `speed` px/s between `range` px either side of
 * its start, bobbing `amplitude` px up and down with a period of `periodSteps` (2.5 s). When Poncho is within `triggerX` px
 * to either side and between 0 and `triggerY` px below it, it freezes for `telegraphSteps` (0.5 s, GDD-ENM-01), then dives
 * at `diveSpeed` px/s to where he was, and climbs back to its cruise line at `returnSpeed` px/s.
 */
export const ZOPILOTE = {
  width: 16,
  height: 10,
  speed: 40,
  range: 48,
  amplitude: 12,
  periodSteps: Math.round(2.5 * TICK_HZ),
  triggerX: 96,
  triggerY: 80,
  telegraphSteps: Math.round(0.5 * TICK_HZ),
  diveSpeed: 150,
  returnSpeed: 60,
} as const;

/**
 * GDD-CMB-01: landing on top of a stompable enemy bounces Poncho up at `bounce` px/s, or at `boostBounce` (the jump
 * velocity) if jump is held or was pressed in the buffer window. A stomp counts if his feet were no more than `tolerance`
 * px below the enemy's top on the step before.
 */
export const STOMP = { bounce: 260, boostBounce: 410, tolerance: 4 } as const;
