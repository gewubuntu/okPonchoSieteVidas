// GDD-UI-04: the camera follows Poncho left and right, with a small dead zone in the middle of the screen. Pure logic, no Phaser.
import { ART_SCALE, BASE_WIDTH, CAMERA } from '../config/tuning';

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
