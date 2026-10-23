// GDD-AUD-02: which sound effects a simulation step asks for, worked out from the states before and after it. Pure logic,
// no Phaser (GDD-TEC-02). The scene plays them.
import { SFX } from '../config/tuning';
import { hilosCollected } from './hilo';
import { isOutOfLives } from './lives';
import { flipPose } from './respawnFlip';
import type { RunState } from './run';

export type SfxName = 'lifeLost' | 'meow' | 'jump' | 'land' | 'claw' | 'stomp' | 'hilo';

export interface Sfx {
  readonly name: SfxName;
  /** For 'hilo': semitones above the root G5. */
  readonly semitones?: number;
}

/** The climb of the hilo notes: the last note played and how long ago. */
export interface HiloCombo {
  /** Position in `SFX.hiloScale` of the last note, or -1 before the first hilo. */
  readonly degree: number;
  /** Steps since the last hilo was collected. */
  readonly since: number;
}

export const NO_COMBO: HiloCombo = { degree: -1, since: 0 };

const TOP = SFX.hiloScale.length - 1;

/**
 * Advances the combo by one simulation step in which `collected` hilos were collected. A hilo within 0.75 s of the previous
 * one plays the next note up the scale, two in one step move on by two; after a longer pause it starts at the root again.
 * The note stays on the octave. Returns the note (semitones above the root) if a hilo was collected.
 */
export function stepHiloCombo(combo: HiloCombo, collected: number): { combo: HiloCombo; semitones: number | null } {
  if (collected === 0) return { combo: { degree: combo.degree, since: combo.since + 1 }, semitones: null };
  const climbs = combo.degree >= 0 && combo.since + 1 <= SFX.hiloWindowSteps;
  const degree = Math.min(TOP, climbs ? combo.degree + collected : collected - 1);
  return { combo: { degree, since: 0 }, semitones: SFX.hiloScale[degree]! };
}

/** Whether Poncho is on screen: playing, or in the flip of a respawn that is not the wait after the last life (GDD-LIFE-02, GDD-LIFE-05). */
export const shown = (run: RunState): boolean =>
  run.phase === 'playing' || (run.phase === 'respawning' && !isOutOfLives(run.lives) && flipPose(run.wait).visible);

/**
 * The sounds a step asks for, in the order lifeLost, meow, jump, land, claw, stomp, hilo, and the combo after it. Everything
 * but the meow is for a step that starts in play (GDD-AUD-02: sounds play only while Poncho is in play).
 */
export function stepSounds(before: RunState, after: RunState, combo: HiloCombo): { sounds: Sfx[]; combo: HiloCombo } {
  const playing = before.phase === 'playing';
  // Hilos and lives change only on a step that starts in play (GDD-WLD-04, GDD-LIFE-02), so these two need no gate of their own.
  const note = stepHiloCombo(combo, hilosCollected(after.hilosTaken) - hilosCollected(before.hilosTaken));
  const sounds: Sfx[] = [];
  if (after.lives.lives < before.lives.lives) sounds.push({ name: 'lifeLost' });
  if (!shown(before) && shown(after)) sounds.push({ name: 'meow' });
  if (playing) {
    if (after.player.takeoff !== undefined) sounds.push({ name: 'jump' });
    // From the air: a body on the ground has no downward speed, so the 60 px/s fall speed covers "was not grounded".
    if (after.phase === 'playing' && after.player.grounded && before.player.vy >= SFX.landMinSpeed) sounds.push({ name: 'land' });
    if (before.claw.phase === 'idle' && after.claw.phase === 'windup') sounds.push({ name: 'claw' });
    if (after.stomped) sounds.push({ name: 'stomp' });
    if (note.semitones !== null) sounds.push({ name: 'hilo', semitones: note.semitones });
  }
  return { sounds, combo: note.combo };
}
