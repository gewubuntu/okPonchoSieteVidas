// GDD-LIFE-03: the veladora pickup, a candle that restores a life once. Pure logic, no Phaser (GDD-TEC-02).
import { VELADORA } from '../config/tuning';
import type { LivesState } from './lives';
import type { PlayerState } from './movement';
import { touchesPickup } from './taco';

/** The tile a veladora sits in. */
export interface Veladora {
  readonly col: number;
  readonly row: number;
}

/** Whether Poncho's body box overlaps the veladora's 12 x 12 box. Boxes that only share an edge do not touch. */
export const touchesVeladora = (player: PlayerState, v: Veladora): boolean => touchesPickup(player, v.col, v.row, VELADORA.size);

/** The id it is used up under in `LivesState.used` (after `veladora:`). */
export const veladoraId = (v: Veladora): string => `${v.col},${v.row}`;

/** Whether it has been collected in this world. */
export const veladoraUsed = (lives: LivesState, v: Veladora): boolean => lives.used.has(`veladora:${veladoraId(v)}`);
