// GDD-UI-05: tutorial tips, texts and highlights that pop up while Poncho is in a stretch of the level. Pure logic, no Phaser.
import { TILE, TIPS } from '../config/tuning';
import type { Level, RunState } from '../sim/run';
import type { Language } from '../sim/settings';
import { veladoraUsed } from '../sim/veladora';

/** The device used last, which decides the words (GDD-UI-05). */
export type Device = 'keyboard' | 'touch' | 'pad';

/** An area of the level in tiles. */
export interface TileRect {
  readonly col: number;
  readonly row: number;
  readonly w: number;
  readonly h: number;
}

export interface Tip {
  /** The stretch of tile columns it shows in, both included. */
  readonly from: number;
  readonly to: number;
  /** The words in each language, by the device used last (GDD-UI-05, GDD-UI-02). */
  readonly text: Readonly<Record<Language, { readonly keyboard: string; readonly touch: string; readonly pad: string }>>;
  /** The thing it teaches, outlined; null for none. */
  readonly highlight: TileRect | null;
  /** The touch button outlined with it. */
  readonly button?: 'move' | 'jump' | 'claw';
  /** When the thing is done the tip goes for good: that enemy defeated, that piñata open, or the veladora used. */
  readonly doneWhen?: { readonly enemy: number } | { readonly pinata: number } | 'veladora';
}

/** Before any device is used: touch on a device that reports touch, else the keyboard. */
export const initialDevice = (touchDevice: boolean): Device => (touchDevice ? 'touch' : 'keyboard');

/** The index of the tip whose stretch holds Poncho's middle, only while he plays and when its thing is not done; else null. */
export function activeTip(tips: readonly Tip[], x: number, phase: RunState['phase'], done: readonly boolean[]): number | null {
  if (phase !== 'playing') return null;
  const col = Math.floor(x / TILE);
  const i = tips.findIndex((t) => col >= t.from && col <= t.to);
  return i >= 0 && !done[i] ? i : null;
}

/** The tip last shown and how opaque it is, 0 to 1 in steps of 1 / `TIPS.fadeSteps`. */
export interface TipFade {
  readonly index: number | null;
  readonly alpha: number;
}

export const NO_TIP: TipFade = { index: null, alpha: 0 };

/** One step of the fade towards `active`: in over `TIPS.fadeSteps`, out over as many, and the old tip goes at once for a new one. */
export function stepTipFade(f: TipFade, active: number | null): TipFade {
  const n = TIPS.fadeSteps;
  const k = Math.round(f.alpha * n);
  if (active === null) return { index: f.index, alpha: Math.max(0, k - 1) / n };
  if (active !== f.index) return { index: active, alpha: 1 / n };
  return { index: active, alpha: Math.min(n, k + 1) / n };
}

/**
 * Which tips are done, after a step: a flag stays set once set, and all are cleared on the step the run restarts after the last life.
 * A respawn clears none: the enemy is alive and the piñata closed again, but the player knows.
 */
export function tipsDone(done: readonly boolean[], tips: readonly Tip[], before: RunState, after: RunState, level: Level): boolean[] {
  if (before.phase === 'gameover' && after.phase !== 'gameover') return tips.map(() => false);
  return tips.map((t, i) => {
    if (done[i]) return true;
    const w = t.doneWhen;
    if (w === undefined) return false;
    if (w === 'veladora') return level.veladora !== undefined && veladoraUsed(after.lives, level.veladora);
    if ('enemy' in w) return !after.enemies[w.enemy]!.alive;
    return after.pinatasOpen[w.pinata]!;
  });
}

export const tipText = (tip: Tip, device: Device, language: Language): string => tip.text[language][device];

/** 0 to 1 and back to 0 every `TIPS.pulseSteps` steps, smoothly. */
export const pulse = (steps: number): number => (1 - Math.cos((2 * Math.PI * steps) / TIPS.pulseSteps)) / 2;

/** The outline's box in level px: the tiles and `TIPS.marginPx` all round. */
export const highlightBox = (r: TileRect): { x: number; y: number; w: number; h: number } => ({
  x: r.col * TILE - TIPS.marginPx,
  y: r.row * TILE - TIPS.marginPx,
  w: r.w * TILE + 2 * TIPS.marginPx,
  h: r.h * TILE + 2 * TIPS.marginPx,
});
