// GDD-BOS-04: which frame of her sheet La Catorce is drawn with in each mode, and the plume of her armour. Pure, no Phaser: the scene draws
// what this says.
import { CATORCE, CATORCE_ART } from '../config/tuning';
import { catorceBox, catorcePhaseIndex, type Catorce, type CatorceState } from '../sim/catorce';
import type { Box } from '../sim/enemy';
import { CATORCE_LEFT, CATORCE_LOOKS, type CatorceLook } from './catorceLooks';

export interface CatorcePose {
  /** Her box (`catorceBox`). */
  readonly body: Box;
  /** The look of her frame (`CATORCE_LOOKS`). */
  readonly look: CatorceLook;
  /** Whether she faces left: the way she runs. */
  readonly left: boolean;
  /** Her frame's place in her sheet: the look's, the left-facing ones `CATORCE_LEFT` on. */
  readonly frame: number;
  /** The white plume while her armour holds, over her middle stud, and its frame; none once she is hurt or defeated. */
  readonly plume: { readonly box: Box; readonly frame: 0 | 1 } | null;
}

/** The look named `name`: every name the rules below build is one of her looks (`level3-4.sprite.test.ts` checks it at every step of the fight). */
const named = (name: string): CatorceLook => CATORCE_LOOKS[(CATORCE_LOOKS as readonly string[]).indexOf(name)]!;

/** Her look in `c`: by her mode, the lamps still lit, her flash (on for `CATORCE.flashSteps` and off for as many) and her wheels' turn. */
function lookOf(c: CatorceState, left: boolean): CatorceLook {
  const p = catorcePhaseIndex(c.hits);
  const lamps = CATORCE.hits - c.hits;
  const on = Math.floor(c.age / CATORCE.flashSteps) % 2 === 0;
  // Just slammed: her rest starts with her slam; in phase 3, which has no rest, so does her telegraph, but not the armoured first one of the
  // phase (no slam came before it).
  const slammed = c.age < CATORCE_ART.slamSteps && (c.mode === 'rest' || (c.mode === 'telegraph' && CATORCE.restSteps[p] === 0 && !c.armoured));
  switch (c.mode) {
    case 'rest':
      return named(slammed ? `slam${lamps}` : `rest${lamps}`);
    case 'telegraph':
      if (slammed) return named(on ? `slamRed${lamps}` : `slam${lamps}`);
      return named(`${on ? 'spinRed' : 'spin'}${lamps}_${Math.floor(c.age / CATORCE_ART.spinSteps) % 4}`);
    case 'charge': {
      // Her wheels roll the way she runs; the left-facing frames are mirrored, so their turn runs backwards.
      const q = Math.floor(c.x / CATORCE_ART.turnPx);
      return named(`run${lamps}_${(((left ? -q : q) % 4) + 4) % 4}`);
    }
    case 'hurt':
      return named(`${on ? 'hurtWhite' : 'hurt'}${lamps}`);
  }
  // Defeated.
  return c.age < CATORCE_ART.defeatFlashSteps ? 'defeatedWhite' : c.age < 2 * CATORCE_ART.defeatFlashSteps ? 'defeated' : 'wreck';
}

/**
 * GDD-BOS-04: her pose in `c`, the design's frame choices: at rest parked, in her telegraph her wheels spinning and her red flash, in her
 * charge her wheels rolling, squashed for `CATORCE_ART.slamSteps` after a slam, hurt with the lamps left and her white flash, defeated white,
 * plain and then a wreck; facing the way she runs. Her plume stands over her middle stud (`CATORCE_ART.plume.ahead` ahead of her box's middle) while her
 * armour holds.
 */
export function catorcePose(def: Catorce, c: CatorceState): CatorcePose {
  const body = catorceBox(def, c);
  const left = c.dir < 0;
  const look = lookOf(c, left);
  const { w, h, ahead, rise, steps } = CATORCE_ART.plume;
  const mid = c.x + (left ? -ahead : ahead);
  const plumeFrame: 0 | 1 = Math.floor(c.age / steps) % 2 === 0 ? 0 : 1;
  const plume = c.armoured && c.mode !== 'hurt' && c.mode !== 'defeated' ? { box: { x0: mid - w / 2, x1: mid + w / 2, y0: body.y0 + rise - h, y1: body.y0 + rise }, frame: plumeFrame } : null;
  return { body, look, left, frame: CATORCE_LOOKS.indexOf(look) + (left ? CATORCE_LEFT : 0), plume };
}
