// GDD-BOS-04: how La Catorce's stand-in is drawn from her state: her box, the stack on her roof at her front, the plume of her armour, the
// flash of her telegraph and her hurt time, and her three lamps (the art itself is a later phase). Pure, no Phaser: the scene draws what this says.
import { CATORCE } from '../config/tuning';
import { catorceBox, type Catorce, type CatorceState } from '../sim/catorce';
import type { Box } from '../sim/enemy';

/** The funnel stack: 10 x 8 px on her roof, its near edge 6 px in from her front edge. */
export const CATORCE_STACK = { w: 10, h: 8, inset: 6 } as const;
/** The armour's white plume over her roof's middle: 6 x 10 px. */
export const CATORCE_PLUME = { w: 6, h: 10 } as const;

/** Her three brass lamps: 4 x 4 px, the first 12 px from her box's left edge and 4 px under her roof, then every 12 px along it. */
export const CATORCE_LAMP = { size: 4, x: 12, y: 4, gap: 12 } as const;

/**
 * The stand-in's colours, from World 3's palette (GDD-ART-06): her body iron dark, a lit lamp lamp amber, the plume and the white flash mist
 * white, and the red flash the red every world's telegraph shares. The cold flame is not a colour yet (Open Question 40): the lamps burn amber.
 */
export const CATORCE_COLOURS = { iron: 0x353a48, amber: 0xf0a23a, mist: 0xeef1ea, red: 0xd8473a } as const;

export interface CatorcePose {
  /** Her box (`catorceBox`). */
  readonly body: Box;
  /** The funnel stack on her roof at her front, the way she faces. */
  readonly stack: Box;
  /** Her body's flash: red in her telegraph (GDD-ENM-01), white in her hurt time, on for `CATORCE.flashSteps` and off for as many. */
  readonly flash: 'red' | 'white' | null;
  /** The brass lamps still lit along her tank: one goes out with each hit (three, two, one, none). */
  readonly lampsLit: number;
  /** The white plume while her armour holds (GDD-BOS-04); none once she is hurt or defeated. */
  readonly plume: Box | null;
  /** Whether she faces left. */
  readonly flipX: boolean;
}

/** GDD-BOS-04: her pose in `c`. */
export function catorcePose(def: Catorce, c: CatorceState): CatorcePose {
  const body = catorceBox(def, c);
  const front = c.dir > 0 ? body.x1 - CATORCE_STACK.inset - CATORCE_STACK.w : body.x0 + CATORCE_STACK.inset;
  const on = Math.floor(c.age / CATORCE.flashSteps) % 2 === 0;
  const flash = on && c.mode === 'telegraph' ? 'red' : on && c.mode === 'hurt' ? 'white' : null;
  const plume = c.armoured && c.mode !== 'hurt' && c.mode !== 'defeated' ? { x0: c.x - CATORCE_PLUME.w / 2, x1: c.x + CATORCE_PLUME.w / 2, y0: body.y0 - CATORCE_PLUME.h, y1: body.y0 } : null;
  return {
    body,
    stack: { x0: front, x1: front + CATORCE_STACK.w, y0: body.y0 - CATORCE_STACK.h, y1: body.y0 },
    flash,
    lampsLit: CATORCE.hits - c.hits,
    plume,
    flipX: c.dir < 0,
  };
}
