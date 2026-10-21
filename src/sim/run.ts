// GDD-LIFE-02 and GDD-LIFE-05: one play-through of a level, tying movement, lives and respawn together.
// Pure logic, no Phaser (GDD-TEC-02). The cracking animation and the "Siete vidas gastadas" screen arrive with their
// own GDD IDs. Poncho respawns at the latest ofrenda he has reached, or at the start of the level (GDD-LIFE-02, GDD-LIFE-03).
import { HITBOX, OFRENDA, RESPAWN, TILE } from '../config/tuning';
import { freshCrumbles, stepCrumbles, withCrumbles, type Crumble, type CrumbleState } from './crumble';
import { bounce, withSprings, type Spring } from './spring';
import { touchesSpike, type Spike } from './hazards';
import { activateOfrenda, isOutOfLives, loseLife, startWorld, type LivesState } from './lives';
import { spawn, step, type PlayerInput, type PlayerState } from './movement';
import type { TileGrid } from './tilemap';

export interface Point {
  readonly x: number;
  readonly y: number;
}

/** GDD-WLD-05: a checkpoint. `x` is the middle and `y` the floor it stands on, like Poncho's own position. */
export interface Ofrenda extends Point {
  readonly id: string;
}

export interface Level {
  readonly world: TileGrid;
  /** Where Poncho appears: the middle of a tile, standing on the floor. */
  readonly spawn: Point;
  /** In the order the player meets them, which is the order they count as checkpoints (GDD-LIFE-03). */
  readonly ofrendas: readonly Ofrenda[];
  /** GDD-WLD-05: spikes. */
  readonly spikes: readonly Spike[];
  /** GDD-WLD-05: crumbling tiles. */
  readonly crumbles: readonly Crumble[];
  /** GDD-WLD-05: springs. */
  readonly springs: readonly Spring[];
}

export interface RunState {
  readonly player: PlayerState;
  readonly lives: LivesState;
  readonly phase: 'playing' | 'respawning';
  /** Steps left before Poncho respawns. Only used while respawning. */
  readonly wait: number;
  /** Steps of invulnerability left (GDD-LIFE-02, GDD-CMB-03). */
  readonly invulnerable: number;
  /** One state per `Level.crumbles` entry, in the same order (GDD-WLD-05). */
  readonly crumbles: readonly CrumbleState[];
  /** Where Poncho respawns: the level start, or the latest ofrenda he has reached (GDD-LIFE-02). */
  readonly checkpoint: Point;
  /** Position in `Level.ofrendas` of the ofrenda that is the checkpoint, or -1 for the level start. Only moves forward. */
  readonly checkpointIndex: number;
}

export function startRun(level: Level): RunState {
  return { player: spawn(level.spawn.x, level.spawn.y), lives: startWorld(), phase: 'playing', wait: 0, invulnerable: 0, checkpoint: level.spawn, checkpointIndex: -1, crumbles: freshCrumbles(level.crumbles) };
}

/** GDD-LIFE-02: Poncho has fallen into a pit once his whole body is below the bottom of the level. */
export function isInPit(player: PlayerState, world: TileGrid): boolean {
  return player.y - HITBOX.height > world.height * TILE;
}

/** GDD-WLD-05: whether Poncho's body box overlaps the ofrenda's box. Boxes that only share an edge do not touch. */
export function touchesOfrenda(player: PlayerState, o: Ofrenda): boolean {
  return (
    Math.abs(player.x - o.x) < (HITBOX.width + OFRENDA.width) / 2 &&
    player.y > o.y - OFRENDA.height &&
    player.y - HITBOX.height < o.y
  );
}

/**
 * Where Poncho appears when the wait ends: the latest ofrenda he reached, or the level start if he reached none or has
 * spent his last life (GDD-LIFE-02, GDD-LIFE-05). The respawn flip lands here too.
 */
export function respawnPoint(run: RunState, level: Level): Point {
  return isOutOfLives(run.lives) ? level.spawn : run.checkpoint;
}

/** Advances one fixed step. Returns a new state and never mutates its input. */
export function stepRun(run: RunState, input: PlayerInput, level: Level): RunState {
  if (run.phase === 'respawning') {
    // `elapsed` is the number of respawning steps taken including this one, so 0.3 s is step 18 and 0.8 s is step 48.
    const elapsed = RESPAWN.delaySteps - run.wait + 1;
    const skip = elapsed >= RESPAWN.skipAfterSteps && (input.move !== 0 || input.jumpHeld);
    const wait = skip ? 0 : run.wait - 1;
    if (wait > 0) return { ...run, wait };
    // GDD-LIFE-05: out of lives restarts the world with all seven and from the level start (the screen in between
    // comes later).
    const restart = isOutOfLives(run.lives);
    const back = respawnPoint(run, level);
    return {
      // Marked as already holding jump, so a button held through the respawn does not make Poncho jump at once.
      player: { ...spawn(back.x, back.y), jumpWasHeld: true },
      lives: restart ? startWorld() : run.lives,
      checkpoint: back,
      checkpointIndex: restart ? -1 : run.checkpointIndex,
      phase: 'playing',
      wait: 0,
      invulnerable: RESPAWN.invulnerableSteps,
      // GDD-WLD-05: the crumbled tiles come back with Poncho.
      crumbles: freshCrumbles(level.crumbles),
    };
  }

  const stepped = step(run.player, input, withCrumbles(withSprings(level.world, level.springs), level.crumbles, run.crumbles));
  // GDD-WLD-05: a spring throws Poncho up the step he stands on it.
  const player = bounce(stepped, level.springs);
  const crumbles = stepCrumbles(level.crumbles, run.crumbles, player);
  if (isInPit(player, level.world)) {
    // Invulnerability does not protect from pits (GDD-CMB-03), so a life is lost even while it lasts.
    return { ...run, player, crumbles, lives: loseLife(run.lives), phase: 'respawning', wait: RESPAWN.delaySteps, invulnerable: 0 };
  }
  // GDD-WLD-05, GDD-LIFE-02: touching a spike costs a life, unless Poncho is invulnerable (GDD-CMB-03).
  if (run.invulnerable === 0 && level.spikes.some((spike) => touchesSpike(player, spike))) {
    return { ...run, player, crumbles, lives: loseLife(run.lives), phase: 'respawning', wait: RESPAWN.delaySteps, invulnerable: 0 };
  }
  // GDD-LIFE-03: touching an ofrenda restores a life the first time only. It becomes the checkpoint only if it is later
  // in the level than the current one, so walking back never moves the respawn point backwards. `Level.ofrendas` is in
  // the order they are met.
  let { lives, checkpoint, checkpointIndex } = run;
  level.ofrendas.forEach((o, index) => {
    if (!touchesOfrenda(player, o)) return;
    lives = activateOfrenda(lives, o.id);
    if (index > checkpointIndex) {
      checkpoint = { x: o.x, y: o.y };
      checkpointIndex = index;
    }
  });
  return { ...run, player, crumbles, lives, checkpoint, checkpointIndex, invulnerable: Math.max(0, run.invulnerable - 1) };
}
