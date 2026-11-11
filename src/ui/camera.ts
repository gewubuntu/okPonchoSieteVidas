// GDD-UI-04: the camera follows Poncho left and right, with a small dead zone in the middle of the screen, and up and down in a level
// taller than one screen. Pure logic, no Phaser.
import { ART_SCALE, BASE_HEIGHT, BASE_WIDTH, CAMERA, STEP, TILE } from '../config/tuning';
import { floorYAt } from '../sim/bottoms';
import { isOutOfLives } from '../sim/lives';
import { flipPose } from '../sim/respawnFlip';
import { respawnPoint, type Level, type RunState } from '../sim/run';

/**
 * The camera's new scroll (the level x at the screen's left edge), given where it is, the middle of Poncho's drawn body (null while
 * he is hidden) and the level's width. It stands still while he is inside the dead zone; past either side it moves so he stays on
 * that side. It never shows past the level's edges, and it stands at whole art pixels.
 */
export function followCamera(scrollX: number, targetX: number | null, levelWidthPx: number): number {
  if (targetX === null) return scrollX;
  const left = (BASE_WIDTH - CAMERA.deadZone) / 2;
  const right = left + CAMERA.deadZone;
  const on = targetX - scrollX;
  const wanted = on > right ? targetX - right : on < left ? targetX - left : scrollX;
  const clamped = Math.min(Math.max(0, levelWidthPx - BASE_WIDTH), Math.max(0, wanted));
  return Math.round(clamped * ART_SCALE) / ART_SCALE;
}

/** GDD-UI-04: the camera up and down: `y`, the level y at the screen's top edge (game px), and `lead`, whether it is looking down a fall. */
export interface CameraY {
  readonly y: number;
  readonly lead: boolean;
}

/** What the camera reads of Poncho after a step: his feet's level y, whether he stands on anything, his speed down (px/s, negative rising), whether he is hidden. */
export interface CameraYInput {
  readonly feetY: number;
  readonly grounded: boolean;
  readonly vy: number;
  readonly hidden: boolean;
}

/** The camera's highest and lowest y. */
export interface CameraLimits {
  readonly top: number;
  readonly bottom: number;
}

/**
 * GDD-UI-04: the camera's top edge is never above the level's top, and its bottom edge never below 2 px above the floor line `floorY` (the
 * level's bottom, or a raised bottom), where a 17-row level (272 px) has it: that level has no room to move.
 */
export const cameraLimits = (levelHeightPx: number, floorY: number = levelHeightPx): CameraLimits => ({ top: 0, bottom: Math.max(0, floorY - CAMERA.bottomCutPx - BASE_HEIGHT) });

/**
 * GDD-UI-04: one simulation step of the camera up and down. Hidden, it holds. On the ground it stands still while his feet are in the
 * band and otherwise pans towards its nearer edge, 3 px a step at most. In the air it goes up with him past the air's top line; in a fall
 * that takes his feet below the band (and on while it lasts) it looks down, at his fall speed plus `leadSpeed` until his feet are on the
 * band's top edge, then at his fall speed; landing or rising ends that. Never more than `maxSpeed` a step, never past the limits, but for a
 * bottom limit that has just risen above it, which it pans up to at `panSpeed`. Not rounded: `cameraDrawY` rounds what is drawn.
 */
export function followCameraY(state: CameraY, input: CameraYInput, limits: CameraLimits): CameraY {
  if (input.hidden) return state;
  const { feetY, vy } = input;
  const on = feetY - state.y;
  let wanted = state.y;
  let lead = false;
  if (input.grounded) {
    const edge = on < CAMERA.bandTop ? feetY - CAMERA.bandTop : on > CAMERA.bandBottom ? feetY - CAMERA.bandBottom : state.y;
    const pan = CAMERA.panSpeed * STEP;
    wanted = state.y + Math.max(-pan, Math.min(pan, edge - state.y));
  } else if (on < CAMERA.airTop) {
    wanted = feetY - CAMERA.airTop;
  } else if (vy > 0 && (state.lead || on > CAMERA.bandBottom)) {
    lead = true;
    wanted = Math.min(state.y + (vy + CAMERA.leadSpeed) * STEP, feetY - CAMERA.bandTop);
  }
  const most = CAMERA.maxSpeed * STEP;
  const moved = state.y + Math.max(-most, Math.min(most, wanted - state.y));
  // A bottom limit that has risen above the camera (he walked onto a raised bottom, GDD-WLD-03) is reached at the pan, never by a jump.
  const bottom = Math.max(limits.bottom, state.y - CAMERA.panSpeed * STEP);
  return { y: Math.min(bottom, Math.max(limits.top, moved)), lead };
}

/** GDD-UI-04: the cut (a level start, a respawn, a teleport): his feet at `spawnFeet`, or as near as the limits allow. */
export const placeCameraY = (feetY: number, limits: CameraLimits): CameraY => ({ y: Math.min(limits.bottom, Math.max(limits.top, feetY - CAMERA.spawnFeet)), lead: false });

/** GDD-UI-04, GDD-WLD-03: the camera's limits over the column level x `x` is in: its bottom edge 2 px above that column's floor line. */
export const cameraLimitsAt = (level: Level, x: number): CameraLimits => cameraLimits(level.world.height * TILE, floorYAt(level, x));

/** GDD-UI-04: whether Poncho is drawn in `run`, as the scene draws him: in play, on the clear screen, and in a respawn's flip once it shows him. */
export const ponchoShown = (run: RunState): boolean =>
  run.phase === 'playing' || run.phase === 'clear' || (run.phase === 'respawning' && !isOutOfLives(run.lives) && flipPose(run.wait).visible);

/**
 * GDD-UI-04: the cut (a level start, a respawn, a dev teleport, the quit to the title): his feet at 136 where he is, at the respawn point
 * while he waits there, with the limits of that column.
 */
export function cutCameraY(run: RunState, level: Level): CameraY {
  const at = run.phase === 'respawning' ? respawnPoint(run, level) : run.player;
  return placeCameraY(at.y, cameraLimitsAt(level, at.x));
}

/** The camera after a step, and the y it is drawn from towards it: the y before the step, or after a cut the new one, so nothing is drawn between. */
export interface CameraStepped {
  readonly camera: CameraY;
  readonly from: number;
}

/**
 * GDD-UI-04: one step of the camera up and down, after the run's step from `before` to `after`: the cut on the step he appears (at a respawn);
 * otherwise the rule (`followCameraY`), holding while he is not in play (waiting to respawn, or on a screen), with the limits of the column
 * his middle is in.
 */
export function stepCameraY(state: CameraY, before: RunState, after: RunState, level: Level): CameraStepped {
  if (ponchoShown(after) && !ponchoShown(before)) {
    const camera = cutCameraY(after, level);
    return { camera, from: camera.y };
  }
  const { player } = after;
  const camera = followCameraY(state, { feetY: player.y, grounded: player.grounded, vy: player.vy, hidden: after.phase !== 'playing' }, cameraLimitsAt(level, player.x));
  return { camera, from: state.y };
}

/** GDD-UI-04: the y drawn `alpha` of the way from the step before (`prev`) to the last one (`next`), at whole art pixels. */
export const cameraDrawY = (prev: number, next: number, alpha: number): number => Math.round((prev + (next - prev) * alpha) * ART_SCALE) / ART_SCALE;

/**
 * GDD-BOS-01: the y scroll drawn: the camera's y with a screen shake on top (a positive `shake` draws the world lower). Written so that with
 * the camera at 0, in every one-screen level, it is exactly `-shake` as before the camera moved up and down (no shake gives -0, not 0).
 */
export const cameraScroll = (cameraY: number, shake: number): number => -(shake - cameraY);
