// GDD-WLD-04: hilo pickups, the threads scattered through a level. Pure logic, no Phaser (GDD-TEC-02).
// A hilo, once collected, stays collected: a lost life and the restart after the last life leave it alone (see `run.ts`).
import { HILO } from '../config/tuning';
import type { PlayerState } from './movement';
import { touchesPickup } from './taco';

/** The tile a hilo sits in. */
export interface Hilo {
  readonly col: number;
  readonly row: number;
}

/** Whether Poncho's body box overlaps the hilo's 8 x 8 box. Boxes that only share an edge do not touch (GDD-PWR-06). */
export const touchesHilo = (player: PlayerState, hilo: Hilo): boolean => touchesPickup(player, hilo.col, hilo.row, HILO.size);

/** One flag per hilo, none collected yet. */
export const freshHilos = (hilos: readonly Hilo[]): readonly boolean[] => hilos.map(() => false);

/** The flags after one step: every hilo already collected, or touched now. */
export const collectHilos = (hilos: readonly Hilo[], taken: readonly boolean[], player: PlayerState): readonly boolean[] =>
  hilos.map((h, i) => taken[i]! || touchesHilo(player, h));

/** How many hilos are collected. */
export const hilosCollected = (taken: readonly boolean[]): number => taken.filter(Boolean).length;
