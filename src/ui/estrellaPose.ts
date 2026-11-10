// GDD-BOS-03: which frame of her sheet La Estrella is drawn with in each mode, her rope, her trolley and her tejocotes. Pure, no Phaser: the
// scene draws what this says.
import { ESTRELLA, ESTRELLA_ART, TEJOCOTE } from '../config/tuning';
import { ponchoBox } from '../sim/boss';
import { aimAt, tejocoteOut, type Estrella, type EstrellaState, type Tejocote } from '../sim/estrella';
import type { PlayerState } from '../sim/movement';

/** The looks of one hit count in her sheet, in order (the order of `scripts/art/estrella.mjs`: a test compares them). */
export const ESTRELLA_LOOKS = ['glide', 'telegraphL', 'telegraphLRed', 'telegraphR', 'telegraphRRed', 'drop', 'land', 'bounce', 'rest', 'rise', 'hangL', 'hangR', 'yank', 'hurt', 'hurtWhite'] as const;
/** The looks of a defeated pot, last in her sheet (3 hits): falling without her rope, then lying on its side, each with its white flash. */
export const ESTRELLA_DEFEAT_LOOKS = ['fall', 'fallWhite', 'lie', 'lieWhite'] as const;
export type EstrellaLook = (typeof ESTRELLA_LOOKS)[number] | (typeof ESTRELLA_DEFEAT_LOOKS)[number];

export interface EstrellaPose {
  /** The middle of her box (the clay-pot core), shaken ESTRELLA.shakePx to either side in her telegraph: where her frame's middle is drawn. */
  readonly x: number;
  readonly y: number;
  /** The look of her frame, and its place in her sheet. */
  readonly look: EstrellaLook;
  readonly frame: number;
  /** Drawn mirrored: her glide, drawn going right with the tassels trailing left, going left. */
  readonly flipX: boolean;
  /** The body's flash: red in the telegraph (GDD-ENM-01), white hurt or defeated, on for ESTRELLA.flashSteps and off for as many. */
  readonly flash: 'red' | 'white' | null;
  /** The trolley on the cable her rope hangs from: above her middle, shaken with her in her telegraph, and its frame, which turns while she glides. It stays on the cable once she is defeated. */
  readonly trolley: { readonly x: number; readonly y: number; readonly frame: number };
  /** Her rope, straight from the trolley's eye (`top`) down to her top cone's tip (`end`, above `top` when she is too high for it to show). None once defeated (it snapped). */
  readonly rope: { readonly x: number; readonly top: number; readonly end: number } | null;
}

/** The index of her phase in the per-phase tuning arrays: 0, 1 or 2. */
const phaseIndex = (hits: number): 0 | 1 | 2 => (hits >= 2 ? 2 : hits === 1 ? 1 : 0);

const sine = (age: number): number => Math.sin((2 * Math.PI * age) / ESTRELLA.swayPeriodSteps);

/** The sign of her sway's velocity on this step of a hang: x = tx + swayPx * sin(2 pi age / swayPeriodSteps) (`moveEstrella`); 0 with no sway or on the hang's first step. */
function swaySign(e: EstrellaState): number {
  if (e.age < 1) return 0;
  return Math.sign(ESTRELLA.swayPx[phaseIndex(e.hits)] * (sine(e.age) - sine(e.age - 1)));
}

/** Where she is gliding to: the next spot of her phase, in phase 3 the tear's x and then the spot above Poncho (`moveEstrella`). */
function glideTarget(def: Estrella, e: EstrellaState, player: PlayerState): number {
  const p = phaseIndex(e.hits);
  return p === 2 ? (e.tore ? aimAt(player) : def.tear.x) : def.spots[p][e.spot]!;
}

/** The look of her frame: by her mode, her distance from the surface she drops onto or rises from, her sway, `blink` (a flash on-step) and Poncho's side of her. */
function lookOf(e: EstrellaState, def: Estrella, blink: boolean, ponchoLeft: boolean): EstrellaLook {
  switch (e.mode) {
    case 'glide':
      return 'glide';
    case 'telegraph':
      return `telegraph${ponchoLeft ? 'L' : 'R'}${blink ? 'Red' : ''}` as EstrellaLook;
    case 'drop':
      return e.ty - e.y <= ESTRELLA_ART.landLook ? 'rest' : 'drop';
    case 'bounce':
      return e.age === 0 ? 'land' : 'bounce';
    case 'rest':
      return e.age === 0 ? 'land' : 'rest';
    case 'rise':
      return def.floor - e.y <= ESTRELLA_ART.landLook ? 'rise' : 'yank';
    case 'hang': {
      const sway = swaySign(e);
      return (sway === 0 ? ponchoLeft : sway < 0) ? 'hangL' : 'hangR';
    }
    case 'yank':
      return 'yank';
    case 'hurt':
      return blink ? 'hurtWhite' : 'hurt';
    default:
      // Defeated.
      return `${def.floor - e.y < ESTRELLA_ART.fallBelow ? 'lie' : 'fall'}${blink ? 'White' : ''}` as EstrellaLook;
  }
}

/**
 * Her frame and where her parts go (GDD-BOS-03, the design's frame choices): her telegraph looks left or right by Poncho's side of her, her
 * glide trails its tassels against her way, her hang leans with her sway (to Poncho when it has none), and she shows her landing look, the
 * bottom cones splayed so nothing reaches below her box, from ESTRELLA_ART.landLook px above the surface she drops onto (the surface she
 * aims at: an awning, or the floor in phase 3 as she tears through), squashed on the step she lands, through her rest and her rise until she
 * is more than that clear of the floor, and in her bounce. Hurt or defeated she flashes white; defeated she falls and then lies on the floor
 * (from the step she is less than ESTRELLA_ART.fallBelow px above it, so the falling pot's frame never goes into it).
 * Her telegraph (GDD-ENM-01) shakes her: her rope has no length while she telegraphs high under the cable, so her body and the trolley jump
 * ESTRELLA.shakePx to the right and to the left in turn, every flashSteps, in time with the red flash.
 */
export function estrellaPose(e: EstrellaState, player: PlayerState, def: Estrella): EstrellaPose {
  const blink = Math.floor(e.age / ESTRELLA.flashSteps) % 2 === 0;
  const box = ponchoBox(player);
  const ponchoLeft = (box.x0 + box.x1) / 2 < e.x;
  const x = e.mode === 'telegraph' ? e.x + (blink ? ESTRELLA.shakePx : -ESTRELLA.shakePx) : e.x;
  const y = e.y - ESTRELLA.height / 2;
  const flipX = e.mode === 'glide' && glideTarget(def, e, player) < e.x;
  const look = lookOf(e, def, blink, ponchoLeft);
  const frame = (ESTRELLA_DEFEAT_LOOKS as readonly string[]).includes(look)
    ? ESTRELLA.hits * ESTRELLA_ART.looks + (ESTRELLA_DEFEAT_LOOKS as readonly string[]).indexOf(look)
    : Math.min(e.hits, ESTRELLA.hits - 1) * ESTRELLA_ART.looks + (ESTRELLA_LOOKS as readonly string[]).indexOf(look);
  // The wheel rolls along the cable as she glides: a frame for each eighth turn of its ESTRELLA_ART.trolleyWheel px radius.
  const roll = Math.floor((x * 4) / (Math.PI * ESTRELLA_ART.trolleyWheel));
  return {
    x,
    y,
    look,
    frame,
    flipX,
    flash: look.endsWith('Red') ? 'red' : look.endsWith('White') ? 'white' : null,
    trolley: { x, y: ESTRELLA.cableY, frame: e.mode === 'glide' ? roll % 2 : 0 },
    rope: e.mode === 'defeated' ? null : { x, top: ESTRELLA.cableY + ESTRELLA_ART.ropeFrom, end: y - ESTRELLA.coneTip + ESTRELLA_ART.ropeTie },
  };
}

/** What a frame of her sheet shows, to read back what was drawn (L-010): the inverse of the frame `estrellaPose` picks, with the cones left and the flash. */
export function estrellaFrameInfo(frame: number): { look: EstrellaLook; hits: number; cones: number; flash: 'red' | 'white' | null } {
  const living = ESTRELLA.hits * ESTRELLA_ART.looks;
  const look: EstrellaLook = frame >= living ? ESTRELLA_DEFEAT_LOOKS[frame - living]! : ESTRELLA_LOOKS[frame % ESTRELLA_ART.looks]!;
  const hits = frame >= living ? ESTRELLA.hits : Math.floor(frame / ESTRELLA_ART.looks);
  return { look, hits, cones: ESTRELLA.cones[hits]!, flash: look.endsWith('Red') ? 'red' : look.endsWith('White') ? 'white' : null };
}

/** The tejocotes out of her and rolling, as boxes to draw (left, top, size) and the frame of the calyx: a quarter turn for each quarter of its circumference rolled. */
export const tejocoteBoxes = (tejocotes: readonly Tejocote[]): { x: number; y: number; w: number; h: number; frame: number }[] =>
  tejocotes.filter(tejocoteOut).map((t) => ({ x: t.x - TEJOCOTE.size / 2, y: t.y - TEJOCOTE.size, w: TEJOCOTE.size, h: TEJOCOTE.size, frame: Math.floor((t.x * 4) / (Math.PI * TEJOCOTE.size)) % 4 }));
