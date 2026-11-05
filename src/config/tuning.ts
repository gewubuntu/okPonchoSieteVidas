// Every gameplay number lives here, each tagged with its GDD ID (GDD-TEC-05).
// Change a number here and in docs/GDD.md in the same commit.
// Units are game pixels (GDD-ART-01: 480 x 270 on screen) and seconds. The vertical axis points down, so rising means negative velocity.

/** GDD-TEC-02: fixed simulation rate. */
export const TICK_HZ = 60;
export const STEP = 1 / TICK_HZ;

/** GDD-ART-01: the screen in game pixels and the tile grid. */
export const BASE_WIDTH = 480;
export const BASE_HEIGHT = 270;
export const TILE = 16;
/** GDD-ART-01: art pixels per game pixel, so the canvas is 1920 x 1080 (BASE_WIDTH * ART_SCALE by BASE_HEIGHT * ART_SCALE). */
export const ART_SCALE = 4;

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

/**
 * GDD-MOV-07: holding jump while falling caps the fall at `fallSpeed`; not within `stompLockSteps` (150 ms) of a stomp bounce,
 * and only once jump has been held for more than `holdSteps`, the jump buffer (GDD-MOV-03), so a press just before landing
 * stays a buffered jump.
 */
export const GLIDE = { fallSpeed: 70, stompLockSteps: Math.round(0.15 * TICK_HZ), holdSteps: FORGIVENESS.bufferSteps } as const;

/**
 * GDD-MOV-08: pressing toward a wall while falling caps the slide at `slideSpeed`. Jump beside a wall in the air (or within
 * `graceSteps`, the coyote time, of leaving it) kicks away at `kickX` across and `kickY` up, then sideways control is locked
 * for `lockSteps` (120 ms).
 */
export const WALL = { slideSpeed: 60, kickX: 130, kickY: 380, lockSteps: Math.round(0.12 * TICK_HZ), graceSteps: FORGIVENESS.coyoteSteps } as const;

/**
 * GDD-MOV-09: on the ground a body steps up and down a sand slope by up to `stepPx` in one step without leaving it; a higher rise is a
 * wall (a slope's high side) and a deeper drop a fall. At the run speed a 45-degree slope rises 2 px a step.
 */
export const SLOPE = { stepPx: 4 } as const;

/** GDD-MOV-06: body hitbox for ground and walls, hurtbox for enemies and hazards, sprite frame. */
export const HITBOX = { width: 12, height: 32 } as const;
export const HURTBOX = { width: 10, height: 30 } as const;
export const SPRITE_FRAME = 40;
/** GDD-ART-04: the run frames play on the ground at `runMinSpeed` px/s or more, one frame for every `runFramePx` px run, `runFrames` of them. */
export const ANIM = { runMinSpeed: 10, runFramePx: 8, runFrames: 4 } as const;

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

/** GDD-WLD-03: the level exit is one tile wide and three tiles tall (16 x 48 px), standing on the floor. Reaching it ends the level. */
export const EXIT = { width: TILE, height: 3 * TILE } as const;

/** GDD-LIFE-03: a veladora pickup is a 12 x 12 px square in the middle of its tile. */
export const VELADORA = { size: 12 } as const;

/** GDD-UI-04: the camera stands still while Poncho is inside a dead zone this many px wide, in the middle of the screen. */
export const CAMERA = { deadZone: 32 } as const;

/** GDD-CTL-03: touch buttons, in game pixels except `minCssPx`. */
export const TOUCH = {
  /** Left, right and jump button sizes (jump is larger), and the space around them. */
  size: 40,
  jumpSize: 56,
  margin: 6,
  gap: 4,
  /** A button is never smaller than this on the player's screen, in CSS pixels (GDD-CTL-03). */
  minCssPx: 48,
  /** GDD-UI-02: the pause button in the top-right corner (it grows like the others to 48 CSS px). */
  pauseSize: 24,
  /** Slide stick: the share of the half-track around its centre that does nothing (same 0.2 as the gamepad, GDD-CTL-02). */
  stickDeadZone: 0.2,
  /** GDD-CTL-03: a short vibration on every life lost, where the platform supports it, in milliseconds. */
  vibrateMs: 50,
} as const;

/** GDD-CTL-02: the gamepad's left stick. */
export const GAMEPAD = {
  /** The share of the stick's push that does nothing (the slide stick's is the same, `TOUCH.stickDeadZone`). */
  deadZone: 0.2,
  /** A push past this, along the larger axis, is a direction in the menus. */
  menuThreshold: 0.5,
} as const;

/** GDD-UI-02: the pause menu's rows, in game pixels; each grows so it is never under TOUCH.minCssPx tall. */
export const PAUSE_MENU = { width: 160, rowHeight: 28, top: 136, textSize: 12 } as const;

/**
 * GDD-UI-02: the title menu's rows ("Continue" while a run is saved, "Start", "Tutorial", "Settings"), in game pixels; each grows like the pause
 * menu's. The text size is `PAUSE_MENU.textSize`. The first row's top is 112, right under "Siete Vidas", so the four rows end above the bottom of
 * a landscape phone (34 px each, at 248).
 */
export const TITLE_MENU = { width: 160, rowHeight: 28, top: 112 } as const;

/** GDD-UI-02: Poncho beside the title: his feet are level with the bottom of "Siete Vidas" (`feetY`), and `gap` px lie between his right edge and the wider title line's left edge. */
export const TITLE_PONCHO = { feetY: 104, gap: 8 } as const;

/**
 * GDD-UI-02: the results menu's rows ("Next level", "Retry", "Quit to title"), in game pixels; each grows like the pause menu's. The
 * first row's top is 162, under the medal line. `greyed` is the colour of "Next level" where the level names no next level.
 */
export const RESULTS_MENU = { width: 160, rowHeight: 28, top: 162, greyed: 0x5c6178 } as const;

/**
 * GDD-UI-02: the settings screen, in game pixels. Rows grow like the pause menu's. A volume row has its label `labelInset`
 * from its left edge, "<" and ">" `arrowInset` inside its edges, and its bars (`barWidth` wide, `barGap` apart) ending
 * `barsInset` inside its right edge.
 */
export const SETTINGS_MENU = { width: 260, rowHeight: 28, top: 62, titleY: 44, labelInset: 20, arrowInset: 8, barWidth: 5, barHeight: 10, barGap: 2, barsInset: 20 } as const;

/** GDD-CTL-03: the factor each Button opacity step puts on every alpha the touch controls draw (capped at 1); medium is the look as it was. */
export const TOUCH_OPACITY = { low: 0.5, medium: 1, high: 1.5 } as const;

/** GDD-UI-02, GDD-AUD-01: a volume is a whole number of `steps` shares, and starts at `default`. */
export const VOLUME = { steps: 10, default: 10 } as const;

/**
 * GDD-LIFE-05: the "Siete vidas gastadas" screen after the last life waits for a press of any button, but ignores presses for its
 * first `lockoutSteps` (1.0 s).
 */
export const GAME_OVER = { lockoutSteps: Math.round(1.0 * TICK_HZ) } as const;

/** GDD-UI-02: the level clear screen's hilo, time and medal lines appear 0.25, 0.5 and 0.75 s after it comes up. */
export const RESULTS = { revealSteps: [Math.round(0.25 * TICK_HZ), Math.round(0.5 * TICK_HZ), Math.round(0.75 * TICK_HZ)] } as const; // 15, 30, 45
/** GDD-PRG-03: Gold needs every hilo and at most `goldLivesLost` lives lost in the level; the medal colours on the clear screen (GDD-UI-02, placeholders). */
export const MEDAL = { goldLivesLost: 3, colours: { bronze: 0xc7834a, silver: 0xc9cfdc, gold: 0xf2c14e }, discPx: 10, gapPx: 6 } as const;

/** GDD-LIFE-04: with one life left, the last triangle on the HUD grows to `pulseScale` and back every `pulseSteps` (0.8 s). */
export const LAST_LIFE = { pulseSteps: Math.round(0.8 * TICK_HZ), pulseScale: 1.4 } as const;

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

/**
 * GDD-WLD-10: awnings. Landing on one with jump held (or pressed in the jump buffer) throws Poncho up at the next of `tiers` (480 is
 * SPRING.velocity, 600 SPRING.boostVelocity) over held rebounds in a row; without, he rebounds at `plainFactor` of his landing speed,
 * or stands on it when that is under `settleSpeed`. A torn awning's plain rebound is at least `tornMinSpeed`. A jump pressed in the
 * `lateSteps` (the jump buffer, 0.1 s) after a plain landing counts as held at it. The cloth is `height` px thick and its top at least
 * `minTopY` (a tier 3 rebound stays on screen). Drawing: it sags `sagPx[tier]` px (0 is a plain rebound) for `sagSteps`, then is
 * `liftPx` above rest for `liftSteps`; a held rebound's sound is raised `reboundSemitones[tier - 1]`.
 */
export const AWNING = {
  tiers: [480, 540, 600],
  plainFactor: 0.5,
  settleSpeed: 150,
  tornMinSpeed: 180,
  lateSteps: FORGIVENESS.bufferSteps,
  height: 8,
  minTopY: 160,
  sagPx: [2, 2, 4, 6],
  sagSteps: 4,
  liftPx: 1,
  liftSteps: 4,
  reboundSemitones: [0, 2, 4],
} as const;

/**
 * GDD-WLD-11: papel picado. A rollo's bundle is a `size` px square by its post; a claw swipe or a fireball that touches it unrolls it
 * at `unrollSpeed` px/s (above RUN.maxSpeed). A cordel's line, which is all of it that collides, is `linePx` thick.
 */
export const ROLLO = { size: 12, unrollSpeed: 160, linePx: 2 } as const;

/**
 * GDD-TEC-04, GDD-WLD-10, GDD-WLD-11: a pit column under a whole awning, a cordel or a rollo whose top is at most `abovePx` (3 tiles)
 * above the ground at the pit's nearer edge does not count towards a gap.
 */
export const COVER = { abovePx: 3 * TILE } as const;

/** GDD-WLD-05: moving blocks travel at this speed (px/s), like the platforms. */
export const BLOCK = { speed: 40 } as const;

/** GDD-CMB-03: a hit that leaves Poncho alive gives 2.0 s of invulnerability and pushes him away from the source (px/s). */
export const HIT = { invulnerableSteps: Math.round(2.0 * TICK_HZ), knockback: 80 } as const;

/** GDD-PWR-02: a taco is a square this many px wide (a pickup sits centred in its tile); one released from a piñata walks at `walkSpeed` px/s. */
export const TACO = { size: 12, walkSpeed: 40 } as const;

/** GDD-WLD-04: a hilo pickup is an 8 x 8 px square in the middle of its tile. A hilo saved in an earlier run is drawn at `savedAlpha` (35 %) opacity. */
export const HILO = { size: 8, savedAlpha: 0.35 } as const;

/** GDD-WLD-05: a key pickup is a square this many px wide, centred in its tile. A door touches Poncho from the side within `doorReachPx`. */
export const KEY = { size: 12, doorReachPx: 1 } as const;

/**
 * GDD-CMB-02: the claw swipe. A press starts a 2-step wind-up, then a 3-step swing that hits a box `reach` px long and
 * `height` px tall, level with the body and starting at the body's front edge. The next swing may start `cooldownSteps`
 * (0.25 s) after the press that started the last one.
 */
export const CLAW = { windupSteps: 2, activeSteps: 3, cooldownSteps: Math.round(0.25 * TICK_HZ), reach: 20, height: 32 } as const;

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
 * GDD-ENM-02, GDD-ART-05: World 1's enemy sprites. `frames` is each sheet's frame in game px (a walker's box's middle on the frame's middle
 * column and its feet on the bottom row; the Zopilote's and the poof's middle on the frame's middle). A walker shows the next walk frame every
 * `walkPx` px it walks, the Tlacuache the next run frame every `chargePx` px it charges; the Zopilote the next flap every `flapSteps` and the
 * next climb every `climbSteps`; a telegraph flashes red for `flashSteps` and plain for as many (GDD-ENM-01). A Zopilote dives steep while its
 * dive's drop is at least `steepRatio` times its run. The cactus buddy breathes every `dozeSteps`, peeks while Poncho's hurtbox centre is
 * within `peek` px of its box's middle (across and up or down), is alarmed within `alarm` px, and shivers every `shiverSteps`. A defeated
 * enemy shows its squash or hit frame for `defeatSteps`, the hit frame rising `hitRise` px, then the poof's four frames for `poofSteps` each.
 * `reach` is how far each kind's drawing reaches past its box at most, over all its frames, behind it, in front, above and below (L-059):
 * a tail, a claw, a wing, a flower or a spine; a walker never reaches below its feet. A tail, claw or wing beside the box may lie over a wall's
 * face or a slope's sand (user, 2026-11-05: "Allow it, pin it", "Allow beside the body"; checked over the real levels by
 * `scripts/art/enemies1.levels.test.mjs`).
 */
export const ENEMY_ART = {
  frames: { alacran: { w: 24, h: 16 }, zopilote: { w: 32, h: 24 }, cactus: { w: 16, h: 24 }, tlacuache: { w: 28, h: 16 }, poof: { w: 24, h: 24 } },
  reach: {
    alacran: { behind: 4.5, front: 1.5, above: 3, below: 0 },
    zopilote: { behind: 6, front: 0.5, above: 6.5, below: 3.5 },
    cactus: { behind: 1, front: 1.5, above: 2.5, below: 0 },
    tlacuache: { behind: 5.5, front: 3, above: 0.5, below: 0 },
  },
  walkPx: 2,
  chargePx: 5,
  flapSteps: 6,
  climbSteps: 4,
  flashSteps: 4,
  steepRatio: 1.3,
  dozeSteps: 45,
  peek: { x: 64, y: 48 },
  alarm: { x: 28, y: 32 },
  shiverSteps: 4,
  defeatSteps: 8,
  hitRise: 6,
  poofSteps: 4,
} as const;

/**
 * GDD-ENM-03: the Paloma (pigeon) is `width` x `height` px, standing on the ground or a cordel, and walks at `speed` px/s. When Poncho's
 * hurtbox centre is within `sightX` px of it across, on either side, and his feet within `sightY` px of its own, up or down, it freezes for
 * `telegraphSteps` (0.5 s, GDD-ENM-01), flies straight up `riseHeight` px at `riseSpeed` px/s, hovers for `hoverSteps` (1.0 s) bobbing
 * `bobPx` (drawn only), and comes back down at `descendSpeed` px/s.
 */
export const PALOMA = {
  width: 14,
  height: 12,
  speed: 20,
  sightX: 48,
  sightY: 24,
  telegraphSteps: Math.round(0.5 * TICK_HZ),
  riseHeight: 40,
  riseSpeed: 120,
  hoverSteps: Math.round(1.0 * TICK_HZ),
  bobPx: 2,
  descendSpeed: 60,
} as const;

/**
 * GDD-ENM-03: the Chapulín (grasshopper) is `width` x `height` px. It crouches for `crouchSteps` (0.6 s), flashing in the last `flashSteps`
 * (0.5 s, the telegraph of GDD-ENM-01), then hops `hopUp` px/s up and `hopAcross` px/s across the way it faces, falling as Poncho falls
 * (GDD-MOV-04). An awning's top it falls onto throws it up at `awningUp` px/s (the awnings' first tier, GDD-WLD-10) without a crouch.
 */
export const CHAPULIN = { width: 12, height: 10, crouchSteps: Math.round(0.6 * TICK_HZ), flashSteps: Math.round(0.5 * TICK_HZ), hopUp: 300, hopAcross: 60, awningUp: 480 } as const;

/**
 * GDD-ENM-03, GDD-CMB-02: the Trompo (spinning top), the first heavy enemy, is `width` x `height` px, standing on the ground, and spins
 * along at `speed` px/s. A claw swipe or a fireball stuns it for `stunSteps` (1.0 s); it wobbles in the last `wobbleSteps` (0.5 s).
 */
export const TROMPO = { width: 14, height: 14, speed: 70, stunSteps: Math.round(1.0 * TICK_HZ), wobbleSteps: Math.round(0.5 * TICK_HZ) } as const;

/**
 * GDD-BOS-02: Don Zopilote, World 1's boss, a `width` x `height` px box (three times the Zopilote). He laps an ellipse `rx` px either
 * side and `ry` px above and below the middle the level gives in `lapSteps` (4.0 s), dropping a cactus fruit at the lap steps in `dropAt`,
 * then freezes for his telegraph, `telegraphSteps` (0.5 s, GDD-ENM-01). Phases 1 and 3 dive at `diveSpeed` and `fastDiveSpeed` px/s and
 * stick in the sand for `stuckSteps` (1.0 s) and `fastStuckSteps` (0.6 s); phase 2 drops at `dropSpeed` and sweeps the floor at
 * `sweepSpeed`. He climbs back at `climbSpeed`. A hit leaves him hurt for `hurtSteps` (1.0 s); the hit that leaves him none of his
 * `hits` defeats him: he falls at `fallSpeed` and the level is clear `defeatSteps` (1.0 s) after that hit. His body flashes (red in his
 * telegraph, white when hurt or defeated) on for `flashSteps` and off for as many; his wings flap up for `flapSteps` and down for as many.
 */
export const BOSS = {
  width: 48,
  height: 30,
  rx: 152,
  ry: 16,
  lapSteps: Math.round(4.0 * TICK_HZ),
  dropAt: [40, 100, 160, 220],
  telegraphSteps: Math.round(0.5 * TICK_HZ),
  diveSpeed: 180,
  fastDiveSpeed: 300,
  stuckSteps: Math.round(1.0 * TICK_HZ),
  fastStuckSteps: Math.round(0.6 * TICK_HZ),
  dropSpeed: 180,
  sweepSpeed: 150,
  climbSpeed: 120,
  hurtSteps: Math.round(1.0 * TICK_HZ),
  defeatSteps: Math.round(1.0 * TICK_HZ),
  fallSpeed: 120,
  hits: 3,
  flashSteps: 4,
  flapSteps: 8,
} as const;

/** GDD-BOS-02: a cactus fruit is a `size` px square that falls at `fallSpeed` px/s; in phase 3 one that lands lies there for `lieSteps` (3.0 s). */
export const FRUIT = { size: 8, fallSpeed: 120, lieSteps: Math.round(3.0 * TICK_HZ) } as const;

/**
 * GDD-BOS-02: a rock of a boss arena is a `size` px square. A claw swipe knocks it at `knockX` px/s across and `knockY` px/s up; it falls
 * at `gravity` (px/s squared) and is back on its spot `backSteps` (2.0 s) after it breaks.
 */
export const ROCK = { size: 12, knockX: 90, knockY: 150, gravity: 1500, backSteps: Math.round(2.0 * TICK_HZ) } as const;

/**
 * GDD-BOS-03: La Estrella, World 2's boss, a `width` x `height` px box (her clay-pot core). Each array has one entry per phase. She glides
 * along the cable with her box's bottom at `highBottom` at `glideSpeed` px/s, telegraphs for `telegraphSteps` (0.5 s, GDD-ENM-01), drops at
 * `dropSpeed` px/s onto the awning or the floor under her (in a phase whose `tearsAwnings` is true she tears through the awnings to the
 * floor); an awning throws her up at `awningThrow` px/s, the floor holds her for
 * `restSteps` (0.3 s) before she is pulled up at `riseSpeed`. She hangs with her bottom at `lowBottom` for `hangSteps`, swaying `swayPx` to
 * either side on a `swayPeriodSteps` (1.0 s) sine, then is yanked up to `highBottom` at `yankSpeed`. In phase 3 she aims at Poncho, kept
 * between `aimMinX` and `aimMaxX`. A hit leaves her hurt for `hurtSteps` (1.0 s); the last of her `hits` defeats her: she falls at
 * `fallSpeed` and the level is clear `defeatSteps` (1.0 s) after that hit. `cones` are the paper cones she has left after 0, 1, 2 and 3
 * hits. Placeholder drawing: her cones' tips `coneTip` px from her middle (a star about 56 px across), her rope hangs from the cable at
 * `cableY` from a trolley; in her telegraph her body and the trolley shake `shakePx` to either side, flipping every `flashSteps` (her rope
 * has no length up there); her body flashes (red in the telegraph, white hurt or defeated) on for `flashSteps` and off for as many.
 */
export const ESTRELLA = {
  width: 32,
  height: 32,
  highBottom: 40,
  lowBottom: [112, 72, 72],
  glideSpeed: [80, 100, 120],
  telegraphSteps: Math.round(0.5 * TICK_HZ),
  dropSpeed: [300, 300, 360],
  awningThrow: 240,
  tearsAwnings: [false, false, true],
  restSteps: Math.round(0.3 * TICK_HZ),
  riseSpeed: 120,
  hangSteps: [Math.round(2.0 * TICK_HZ), Math.round(1.5 * TICK_HZ), Math.round(1.0 * TICK_HZ)],
  swayPx: [0, 8, 16],
  swayPeriodSteps: Math.round(1.0 * TICK_HZ),
  yankSpeed: 180,
  hurtSteps: BOSS.hurtSteps,
  defeatSteps: Math.round(1.0 * TICK_HZ),
  fallSpeed: 120,
  hits: 3,
  aimMinX: 56,
  aimMaxX: 424,
  cones: [7, 5, 3, 0],
  coneTip: 28,
  cableY: 8,
  shakePx: 2,
  flashSteps: 4,
} as const;

/**
 * GDD-BOS-03: a tejocote, La Estrella's filling, is a `size` px square that rolls along the floor at `rollSpeed` px/s. Each time she thuds on
 * the floor `pairs` of them (one entry per phase) roll out, one each way per pair, a pair every `secondPairSteps` (0.4 s).
 */
export const TEJOCOTE = { size: 8, rollSpeed: 90, secondPairSteps: Math.round(0.4 * TICK_HZ), pairs: [1, 1, 2] } as const;

/** GDD-UI-01: the boss bar at the top middle: the name's middle `nameY` px from the top, and pips `pipSize` px square, `pipGap` apart, their top `pipTop` px from the top. */
export const BOSS_BAR = { nameY: 10, pipTop: 18, pipSize: 6, pipGap: 4, nameStroke: '#2a1f2e', nameStrokePx: 2 } as const;

/**
 * GDD-BOS-02, GDD-ART-01: the size of Don Zopilote's art in game px: one frame of his sheet (`frameW` x `frameH`, `columns` across; his box's
 * middle is the frame's middle), one frame of the fruit sheet (`fruitFrame` square, over its 8 x 8 box), the rock (`rock` square, over its 12 x 12)
 * and one frame of the crown sheet (`crownW` x `crownH`). His head, where the crown starts, is at `headTumble` in the frame he falls in
 * (tumbleA) and at `headLying` in the one he lies in: its middle's x towards the side he faces and its top's y below his middle, in px (an art
 * test measures them from the frames). His lowered wings reach `wingsBelow` px below his box's bottom, his tumbling frames `tumbleABelow` and
 * `tumbleBBelow` px (shown only while he has that much room above the floor); no other frame reaches below it.
 */
export const BOSS_ART = { frameW: 75, frameH: 62, columns: 7, fruitFrame: 9, rock: 13, wingsBelow: 14, tumbleABelow: 7, tumbleBBelow: 12, crownW: 12, crownH: 8, headTumble: { x: 15, y: 4.5 }, headLying: { x: -11, y: 5 } } as const;

/**
 * GDD-BOS-02: his defeat. He tumbles as he falls, turning to the other look every `tumbleSteps`. His crown pops off his head: it moves
 * `crownVx` px/s across, towards the arena's middle, starts `crownVy` px/s up under `crownGravity` (px/s squared), bounces once at
 * `crownBounce` of its speed and rests on the floor; it shows its tilted frame on every other `crownSpinSteps` steps while it is in the air.
 */
export const BOSS_DEFEAT = { tumbleSteps: 6, crownVx: 45, crownVy: 180, crownGravity: 1800, crownBounce: 0.3, crownSpinSteps: 4 } as const;

/**
 * GDD-CMB-01: landing on top of a stompable enemy bounces Poncho up at `bounce` px/s, or at `boostBounce` (the jump
 * velocity) if jump is held or was pressed in the buffer window. A stomp counts if his feet were no more than `tolerance`
 * px below the enemy's top on the step before.
 */
export const STOMP = { bounce: 260, boostBounce: 410, tolerance: 4 } as const;

/**
 * GDD-TEC-04: what the level validator checks. GDD-WLD-03: a level is `minScreens` to `maxScreens` (for its world: 6 in Worlds 0 and 1, 8 from
 * World 2 on, user, 2026-11-04) screens of BASE_WIDTH wide, has 3 ofrendas,
 * and its gaps never exceed `maxGapTiles` for its world (Worlds 1 and 2 have a limit so far, World 2 a tile more, and the tutorial 0-1, outside the seven worlds, follows World 1: GDD-WLD-01). GDD-ENM-01: no enemy starts
 * closer than 3 tiles to a respawn.
 */
export const LEVEL_RULES = {
  minScreens: 3,
  maxScreens: { 0: 6, 1: 6, 2: 8 } as Readonly<Record<number, number>>,
  ofrendas: 3,
  maxGapTiles: { 0: 3, 1: 3, 2: 4 } as Readonly<Record<number, number>>,
  enemyClearance: 3 * TILE,
} as const;

/**
 * GDD-AUD-02: the land sound needs a fall at `landMinSpeed` px/s or faster. Hilos within `hiloWindowSteps` (0.75 s) of the
 * previous one climb the major scale `hiloScale` (semitones above the root G5, up to the octave), where they stay.
 */
export const SFX = { landMinSpeed: 60, hiloWindowSteps: Math.round(0.75 * TICK_HZ), hiloScale: [0, 2, 4, 5, 7, 9, 11, 12] } as const;

/**
 * GDD-UI-05: tutorial tips. A tip fades in and out over `fadeSteps` (0.2 s); its highlight pulses every `pulseSteps` (0.8 s), growing
 * by up to `growPx` on each side while its arrow bobs `bobPx`, and stands `marginPx` outside its tiles with dashes of `dashPx` and
 * gaps of `gapPx` and an arrow `arrowPx` wide with its tip `arrowGapPx` above the outline. The text box's top is `boxTop` from the screen's top, with `boxPad` of room round the
 * text, wrapped at `wrapPx`.
 */
export const TIPS = { fadeSteps: Math.round(0.2 * TICK_HZ), pulseSteps: Math.round(0.8 * TICK_HZ), growPx: 2, bobPx: 2, marginPx: 2, dashPx: 4, gapPx: 3, arrowPx: 6, arrowGapPx: 6, boxTop: 26, boxPad: 4, wrapPx: 280 } as const;

/**
 * GDD-ART-06: World 1's backdrop. The clouds scroll at `cloudFactor` of the camera's scroll, the mountains at `mountainFactor` and the far
 * desert strip (the far plants) at `desertFactor`; the sun's centre and size (game px, on the screen) and the rows the layers sit in (game
 * px from the screen's top; the far desert strip runs from `desertTop` to the floor's top at 224).
 */
export const BACKDROP = { cloudFactor: 0.1, mountainFactor: 0.3, sunX: 104, sunY: 36, sunSize: 24, cloudTop: 16, cloudBottom: 88, mountainTop: 92, desertFactor: 0.5, desertTop: 180 } as const;

/** GDD-ART-06: World 1's plants in the order of their kind (nopal, cholla, biznaga, palm yucca, ocotillo, agave, flowers), their size in game px. */
export const PLANTS = [
  { name: 'nopal', w: 16, h: 16 },
  { name: 'cholla', w: 12, h: 20 },
  { name: 'biznaga', w: 10, h: 10 },
  { name: 'palmYucca', w: 14, h: 36 },
  { name: 'ocotillo', w: 16, h: 40 },
  { name: 'agave', w: 16, h: 12 },
  { name: 'flowers', w: 12, h: 8 },
] as const;

/**
 * GDD-ART-06: how the backdrop is put together from `scripts/art/desert.mjs` (the numbers are checked against it in
 * `scripts/art/desert.test.mjs`). The sky's first three bands are drawn as flat colours, each ending `skyEnds` art px from the top (its
 * dither strip, `stripArt` px tall, is a small image over its last rows); the horizon band is the camera's background colour. The sun's
 * image reaches `sunHalf` game px from its centre. Each cloud is an image at `clouds` (game px in the cloud layer, with its size). The
 * mountains' ridge band is `mountainBandArt` art px tall, and below it the foot is drawn flat in `footColour`. The far desert strip is
 * `desertBandArt` art px tall (game y `BACKDROP.desertTop` to 224).
 */
export const BACKDROP_ART = {
  skyBands: [0xe39a48, 0xedb15a, 0xf4c66e, 0xf9da8e],
  skyEnds: [200, 340, 480],
  stripArt: 2,
  sunHalf: 19,
  clouds: [
    { x: 38, y: 55 },
    { x: 140, y: 21 },
    { x: 272, y: 17 },
    { x: 402, y: 61 },
  ],
  mountainBandArt: 488,
  desertBandArt: 176,
  footColour: 0x3a4580,
} as const;

/**
 * GDD-ART-06: World 2's (Mercado) backdrop and decor, from `scripts/art/mercado.mjs`, put together as World 1's: the clouds scroll at
 * `cloudFactor` of the camera's scroll, the far hill town at `farFactor` and the mid rooftops at `midFactor` (World 1's shares). The
 * sky's bands are flat colours (`skyBands`), the first two ending `skyEnds` art px from the top with a dither strip of `stripArt` px; the
 * last is the camera's background. There is no sun. Each cloud is an image at `clouds` (game px). The far band is `farBandArt` art px
 * tall from game y `farTop`, with the flat foot in `footColour` below it; the mid band (the boss arena's plaza in its place) is
 * `midBandArt` art px tall from `midTop` (down to the floor's top at 224). `decor` are the market's seven things (maceta de talavera,
 * bugambilia, huacal de fruta, ollas de barro, farol, rebozos, letrero de lotería), their size in game px, placed by World 1's plant rule.
 */
export const MERCADO = {
  cloudFactor: 0.1,
  farFactor: 0.3,
  midFactor: 0.5,
  skyBands: [0x86bee0, 0xa9d3ea, 0xcfe8f1],
  skyEnds: [240, 440],
  stripArt: 2,
  clouds: [
    { x: 72, y: 20 },
    { x: 227, y: 20 },
    { x: 396, y: 48 },
  ],
  farTop: 84,
  farBandArt: 464,
  midTop: 148,
  midBandArt: 304,
  footColour: 0x4e4a78,
  decor: [
    { name: 'maceta', w: 10, h: 12 },
    { name: 'bugambilia', w: 16, h: 20 },
    { name: 'huacal', w: 14, h: 10 },
    { name: 'ollas', w: 14, h: 14 },
    { name: 'farol', w: 8, h: 40 },
    { name: 'rebozos', w: 16, h: 24 },
    { name: 'loteria', w: 12, h: 16 },
  ],
} as const;
