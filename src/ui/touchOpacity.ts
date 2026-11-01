// GDD-CTL-03: the Button opacity setting's effect on the touch controls. Pure, no Phaser.
import { TOUCH_OPACITY } from '../config/tuning';
import type { ButtonOpacity } from '../sim/settings';

/** An alpha the touch controls draw, scaled by the Button opacity step and capped at 1. */
export const touchAlpha = (base: number, opacity: ButtonOpacity): number => Math.min(1, base * TOUCH_OPACITY[opacity]);
