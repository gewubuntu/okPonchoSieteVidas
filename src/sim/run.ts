// GDD-LIFE-02 and GDD-LIFE-05: one play-through of a level, tying movement, lives and respawn together.
// Pure logic, no Phaser (GDD-TEC-02). The cracking animation, the "Siete vidas gastadas" screen and checkpoints
// arrive with their own GDD IDs; for now Poncho always respawns at the start of the level.
import { HITBOX, RESPAWN, TILE } from '../config/tuning';
import { isOutOfLives, loseLife, startWorld, type LivesState } from './lives';
import { spawn, step, type PlayerInput, type PlayerState } from './movement';
import type { TileGrid } from './tilemap';

export interface Level {
  readonly world: TileGrid;
  /** Where Poncho appears: the middle of a tile, standing on the floor. */
  readonly spawn: { readonly x: number; readonly y: number };
}

export interface RunState {
  readonly player: PlayerState;
  readonly lives: LivesState;
  readonly phase: 'playing' | 'respawning';
  /** Steps left before Poncho respawns. Only used while respawning. */
  readonly wait: number;
  /** Steps of invulnerability left (GDD-LIFE-02, GDD-CMB-03). */
  readonly invulnerable: number;
}

export function startRun(level: Level): RunState {
  return { player: spawn(level.spawn.x, level.spawn.y), lives: startWorld(), phase: 'playing', wait: 0, invulnerable: 0 };
}

/** GDD-LIFE-02: Poncho has fallen into a pit once his whole body is below the bottom of the level. */
export function isInPit(player: PlayerState, world: TileGrid): boolean {
  return player.y - HITBOX.height > world.height * TILE;
}

/** Advances one fixed step. Returns a new state and never mutates its input. */
export function stepRun(run: RunState, input: PlayerInput, level: Level): RunState {
  if (run.phase === 'respawning') {
    // `elapsed` is the number of respawning steps taken including this one, so 0.3 s is step 18 and 0.8 s is step 48.
    const elapsed = RESPAWN.delaySteps - run.wait + 1;
    const skip = elapsed >= RESPAWN.skipAfterSteps && (input.move !== 0 || input.jumpHeld);
    const wait = skip ? 0 : run.wait - 1;
    if (wait > 0) return { ...run, wait };
    return {
      // Marked as already holding jump, so a button held through the respawn does not make Poncho jump at once.
      player: { ...spawn(level.spawn.x, level.spawn.y), jumpWasHeld: true },
      // GDD-LIFE-05: out of lives restarts the world with all seven (the screen in between comes later).
      lives: isOutOfLives(run.lives) ? startWorld() : run.lives,
      phase: 'playing',
      wait: 0,
      invulnerable: RESPAWN.invulnerableSteps,
    };
  }

  const player = step(run.player, input, level.world);
  if (isInPit(player, level.world)) {
    // Invulnerability does not protect from pits (GDD-CMB-03), so a life is lost even while it lasts.
    return { player, lives: loseLife(run.lives), phase: 'respawning', wait: RESPAWN.delaySteps, invulnerable: 0 };
  }
  return { ...run, player, invulnerable: Math.max(0, run.invulnerable - 1) };
}
