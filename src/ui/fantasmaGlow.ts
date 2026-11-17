// GDD-PWR-04: the glow round Poncho while the Chile Fantasma runs, drawn from the user's reference strip
// (assets/characters/poncho/fantasma/glow.jpg): a gold outline round his silhouette (the scene draws four tinted copies of his frame, one drawing
// pixel off in each direction), sparkles and flames floating near him, speed streaks behind him as he runs. For the last 2 s the outline dims
// to pale gold and the sparkles and flames go (the strip's fourth frame, "use the dimmed glow for the warning flash"), held steady, no blinking.
// Pure, no Phaser: the scene draws what this says.
import { FANTASMA, PONCHO_ART } from '../config/tuning';
import type { PlayerState } from '../sim/movement';
import type { GlowLook } from './ponchoLooks';
import { PONCHO_FRAME } from './ponchoFrames';

/** How the glow reads: bright, or dim for the last FANTASMA.warnSteps. */
export type GlowTone = 'bright' | 'dim';

/** What Poncho is doing, for what floats round him: standing, running on the ground, or in the air. */
export type GlowMotion = 'stand' | 'run' | 'air';

/** `left` is `RunState.fantasma`, the steps left: none at 0, dim from 1 to FANTASMA.warnSteps, bright above. */
export const glowLook = (left: number): GlowTone | null => (left <= 0 ? null : left <= FANTASMA.warnSteps ? 'dim' : 'bright');

/**
 * The glow's colours (GDD-ART-03). The bright one is Poncho's gold; the dim one is the pale gold measured on the outline of glow.jpg's fourth
 * frame (`FANTASMA_COLOURS.P` in scripts/art/poncho/items.mjs; a test compares them).
 */
export const glowColour = (look: GlowTone): string => (look === 'bright' ? '#F9D24C' : '#D3C193');

/** The most things `glowFx` draws at once: the scene keeps this many images for them. */
export const GLOW_FX_MAX = 4;

/** One drawing pixel of his sprite in game px: his frame is `PONCHO_ART.frame` game px across and `PONCHO_FRAME.w` drawing px. */
export const GLOW_PX = PONCHO_ART.frame / PONCHO_FRAME.w;

/** The four copies' offsets from his body's image, one drawing pixel left, right, up and down. */
export const glowOffsets = (px: number = GLOW_PX): readonly { readonly x: number; readonly y: number }[] => [
  { x: -px, y: 0 },
  { x: px, y: 0 },
  { x: 0, y: -px },
  { x: 0, y: px },
];

/** In the air, running (on the ground at any speed), or standing. */
export const glowMotion = (p: Pick<PlayerState, 'grounded' | 'vx'>): GlowMotion => (!p.grounded ? 'air' : Math.abs(p.vx) > 0 ? 'run' : 'stand');

export interface GlowFx {
  readonly look: GlowLook;
  /** Where it is drawn, in game px from the middle of his body box. */
  readonly x: number;
  readonly y: number;
  /** Mirrored: a streak trailing to the right of a Poncho facing left. */
  readonly flip: boolean;
}

/** The places sparkles float, from the middle of his body, as the strip scatters them: and which kind. */
const SPARKLES: readonly { readonly look: 'sparkleStar' | 'sparklePlus'; readonly x: number; readonly y: number }[] = [
  { look: 'sparkleStar', x: -17, y: -22 },
  { look: 'sparklePlus', x: 18, y: -12 },
  { look: 'sparklePlus', x: -19, y: 4 },
  { look: 'sparkleStar', x: 17, y: 9 },
  { look: 'sparklePlus', x: 5, y: -29 },
];
/** Steps a set of sparkles holds before the next spot comes in. */
const SPARKLE_STEPS = 12;
/** The flame flicker's two spots, from the middle of his body, and the steps it stays at one. */
const FLAMES = [{ x: -14, y: -2 }, { x: 14, y: -2 }] as const;
const FLAME_STEPS = 30;
/** The two speed streaks behind a runner: how far behind his middle and how high. */
const STREAKS = [{ back: 20, y: -4 }, { back: 24, y: -11 }] as const;

/**
 * What is drawn round him at the run's clock `clock` (steps), the same for the same clock. Bright: three sparkles (the next of five spots
 * comes in every SPARKLE_STEPS, the oldest goes), a flame flicker besides when he stands, and two streaks behind him (the side opposite
 * `facing`) instead of the flame and with two sparkles when he runs; in the air, the sparkles alone. Dim or none: nothing.
 */
export function glowFx(clock: number, look: GlowTone | null, motion: GlowMotion, facing: 1 | -1): readonly GlowFx[] {
  if (look !== 'bright') return [];
  const first = Math.floor(clock / SPARKLE_STEPS);
  const count = motion === 'run' ? 2 : 3;
  const out: GlowFx[] = Array.from({ length: count }, (_, k) => {
    const s = SPARKLES[(first + k) % SPARKLES.length]!;
    return { look: s.look, x: s.x, y: s.y, flip: false };
  });
  if (motion === 'stand') {
    const f = FLAMES[Math.floor(clock / FLAME_STEPS) % FLAMES.length]!;
    out.push({ look: 'flame', x: f.x, y: f.y, flip: false });
  }
  if (motion === 'run') for (const s of STREAKS) out.push({ look: 'streak', x: -facing * s.back, y: s.y, flip: facing < 0 });
  return out;
}
