// GDD-CTL-03: the short vibration a simulation step asks for, worked out from the states before and after it. Pure logic, no
// Phaser (GDD-TEC-02). The scene hands it to the browser where the platform supports it.
import { TOUCH } from '../config/tuning';
import type { RunState } from './run';

/** The vibration, in milliseconds, for a step that loses a life (any cause: a hit, a pit, a crush), or null for any other step. */
export const stepVibration = (before: RunState, after: RunState): number | null => (after.lives.lives < before.lives.lives ? TOUCH.vibrateMs : null);
