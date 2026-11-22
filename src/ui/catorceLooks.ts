// GDD-BOS-04: La Catorce's looks, in the order of her sheet, and what a frame of it shows. Pure, no Phaser.
import { CATORCE_ART } from '../config/tuning';

/**
 * Her looks, in the order of `scripts/art/catorce.mjs` (a test compares them): `rest`, `spin` (her telegraph), `spinRed` (its red flash),
 * `run` (her charge) and `slam`, each with the lamps still lit (3, 2 or 1) and, where her wheels turn, the quarter turn (0 to 3); `hurt`
 * with the lamps left after the hit and its white flash; then defeated, its white flash and the wreck.
 */
export const CATORCE_LOOKS = [
  'rest3', 'rest2',
  'spin3_0', 'spinRed3_0', 'spin3_1', 'spinRed3_1', 'spin3_2', 'spinRed3_2', 'spin3_3', 'spinRed3_3',
  'spin2_0', 'spinRed2_0', 'spin2_1', 'spinRed2_1', 'spin2_2', 'spinRed2_2', 'spin2_3', 'spinRed2_3',
  'spin1_0', 'spinRed1_0', 'spin1_1', 'spinRed1_1', 'spin1_2', 'spinRed1_2', 'spin1_3', 'spinRed1_3',
  'run3_0', 'run3_1', 'run3_2', 'run3_3', 'run2_0', 'run2_1', 'run2_2', 'run2_3', 'run1_0', 'run1_1', 'run1_2', 'run1_3',
  'slam3', 'slam2', 'slam1', 'slamRed1',
  'hurt2', 'hurtWhite2', 'hurt1', 'hurtWhite1', 'defeated', 'defeatedWhite', 'wreck',
] as const;
export type CatorceLook = (typeof CATORCE_LOOKS)[number];

/** Where the left-facing looks start in her sheet: the right-facing ones fill whole rows of `CATORCE_ART.columns` first (56). */
export const CATORCE_LEFT = Math.ceil(CATORCE_ART.looks / CATORCE_ART.columns) * CATORCE_ART.columns;

/**
 * What frame `frame` of her sheet shows, to read back what was drawn (L-010): its look, whether it faces left, the lamps it shows lit (the
 * digit in the look's name; none defeated) and its flash ('red' or 'white' by the look's name).
 */
export function lookInfo(frame: number): { look: CatorceLook; left: boolean; lamps: number; flash: 'red' | 'white' | null } {
  const look = CATORCE_LOOKS[frame % CATORCE_LEFT]!;
  const digit = /\d/.exec(look);
  return { look, left: frame >= CATORCE_LEFT, lamps: digit ? Number(digit[0]) : 0, flash: look.includes('Red') ? 'red' : look.includes('White') ? 'white' : null };
}
