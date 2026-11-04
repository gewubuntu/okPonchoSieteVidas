// GDD-AUD-02: which sound effects a simulation step asks for, worked out from the states before and after it. Pure logic,
// no Phaser (GDD-TEC-02). The scene plays them.
import { AWNING, SFX } from '../config/tuning';
import { isStunned } from './enemy';
import { hilosCollected } from './hilo';
import { isOutOfLives } from './lives';
import { flipPose } from './respawnFlip';
import { revealedLines } from './results';
import type { RunState } from './run';

export type SfxName = 'lifeLost' | 'meow' | 'jump' | 'land' | 'claw' | 'stomp' | 'hilo' | 'tick' | 'hiss' | 'grunt' | 'bossDefeat';

export interface Sfx {
  readonly name: SfxName;
  /** For 'hilo': semitones above the root G5. For 'jump' on an awning's held rebound: semitones above the jump sound (GDD-WLD-10). */
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

/** The playback rate that raises a sound by `semitones` (equal temperament): an octave, 12, doubles it. */
export const noteRate = (semitones: number): number => 2 ** (semitones / 12);

/** Whether Poncho is on screen: playing, or in the flip of a respawn that is not the wait after the last life (GDD-LIFE-02, GDD-LIFE-05). */
export const shown = (run: RunState): boolean =>
  run.phase === 'playing' || (run.phase === 'respawning' && !isOutOfLives(run.lives) && flipPose(run.wait).visible);

/**
 * The sounds a step asks for, in the order lifeLost, meow, jump, land, hiss, claw, stomp, grunt, bossDefeat, hilo, tick, and the combo after it.
 * Everything but the meow and the tick is for a step that starts in play (GDD-AUD-02: sounds play only while Poncho is in play).
 */
export function stepSounds(before: RunState, after: RunState, combo: HiloCombo): { sounds: Sfx[]; combo: HiloCombo } {
  const playing = before.phase === 'playing';
  // Hilos and lives change only on a step that starts in play (GDD-WLD-04, GDD-LIFE-02), so these two need no gate of their own.
  const note = stepHiloCombo(combo, hilosCollected(after.hilosTaken) - hilosCollected(before.hilosTaken));
  const sounds: Sfx[] = [];
  if (after.lives.lives < before.lives.lives) sounds.push({ name: 'lifeLost' });
  // GDD-AUD-02: Poncho meows as he appears again. GDD-BOS-03: and when La Estrella is defeated; a hit on her comes only on a step that
  // starts in play (stepRun), so her defeat needs no gate of its own (L-025). Don Zopilote's defeat has his own sound (GDD-BOS-02, below).
  const defeated = after.estrella?.mode === 'defeated' && before.estrella?.mode !== 'defeated';
  if ((!shown(before) && shown(after)) || defeated) sounds.push({ name: 'meow' });
  if (playing) {
    if (after.player.takeoff !== undefined) sounds.push({ name: 'jump' });
    // GDD-WLD-10: an awning's held rebound plays the jump sound, a step higher for each tier; a plain rebound the land sound (below).
    const rebound = after.awningBounce !== null && after.awningBounce.at === before.clock ? after.awningBounce : null;
    if (rebound !== null && rebound.tier > 0) sounds.push({ name: 'jump', semitones: AWNING.reboundSemitones[rebound.tier - 1]! });
    // From the air: a body on the ground has no downward speed, so the 60 px/s fall speed covers "was not grounded".
    // GDD-BOS-02: the boss's landing in the sand after a dive thumps too, once a step with Poncho's own.
    // GDD-BOS-03: so does La Estrella's landing at the end of her drop, the thud on the floor and the drop onto an awning.
    const slam = (before.boss?.mode === 'dive' && after.boss?.mode === 'stuck') || (before.estrella?.mode === 'drop' && (after.estrella?.mode === 'rest' || after.estrella?.mode === 'bounce'));
    if ((after.phase === 'playing' && after.player.grounded && before.player.vy >= SFX.landMinSpeed) || slam || rebound?.tier === 0) sounds.push({ name: 'land' });
    // GDD-BOS-02: a hiss at the start of every telegraph of his, a warning before each attack.
    if (before.boss?.mode !== 'telegraph' && after.boss?.mode === 'telegraph') sounds.push({ name: 'hiss' });
    if (before.claw.phase === 'idle' && after.claw.phase === 'windup') sounds.push({ name: 'claw' });
    // A stomp thuds. GDD-ENM-03: so does a Trompo the claw or a fireball topples. GDD-BOS-03: and a hit on La Estrella.
    const toppled = after.enemies.some((e, i) => isStunned(e) && !isStunned(before.enemies[i]!));
    const struck = (after.estrella?.hits ?? 0) > (before.estrella?.hits ?? 0);
    if (after.stomped || toppled || struck) sounds.push({ name: 'stomp' });
    // GDD-BOS-02: a hit on the boss grunts, the hit that defeats him gives his long deflating hiss instead; a hit comes only on a step
    // that starts in play (stepRun), once a step.
    if ((after.boss?.hits ?? 0) > (before.boss?.hits ?? 0)) sounds.push({ name: after.boss?.mode === 'defeated' ? 'bossDefeat' : 'grunt' });
    if (note.semitones !== null) sounds.push({ name: 'hilo', semitones: note.semitones });
  }
  // GDD-UI-02: a step of the clear screen that shows a new line ticks once, however many lines it shows (a skip shows several). The
  // step that reaches the exit starts in play with `wait` 0, which shows no line, and the press that leaves comes after all three are up.
  if (after.phase === 'clear' && revealedLines(after) > revealedLines(before)) sounds.push({ name: 'tick' });
  return { sounds, combo: note.combo };
}
