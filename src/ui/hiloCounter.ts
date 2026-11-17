// GDD-UI-01 and GDD-WLD-04: the hilo counter in the top right of the HUD, and the serape colours the hilos take. Pure data,
// no Phaser, so it can be unit tested. The scene draws whatever this returns.
import { BASE_WIDTH, HILO } from '../config/tuning';
import { LIVES_HUD } from './livesLayout';

/** Placeholder serape stripes (GDD-WLD-04): red, yellow, green, blue, pink. The blue is lighter than the poncho's so it shows on the blue tiles. */
export const HILO_COLOURS = [0xb94842, 0xe8b83a, 0x4e9a4a, 0x6f8fd8, 0xe07aa8] as const;

/** The colour of the hilo at `index` in the level's list: the stripes in turn. */
export const hiloColour = (index: number): number => HILO_COLOURS[index % HILO_COLOURS.length]!;

/**
 * GDD-UI-01: the counter's right edge is `margin` from the screen's right edge, or `pauseGap` left of the pause button on touch;
 * its top is level with the lives; the icon is `iconSize` wide, `iconGap` left of the text. The text and the icon have the lives' dark
 * outline, `outline.px` wide just outside their edge (`LIVES_HUD.outline`).
 */
export const HILO_HUD = {
  margin: 8,
  pauseGap: 6,
  top: LIVES_HUD.top,
  iconSize: HILO.size,
  iconGap: 3,
  outline: { colour: LIVES_HUD.outline.colour, px: LIVES_HUD.outline.px },
} as const;

/** "collected/total", e.g. "12/20". */
export const hiloCounterText = (taken: number, total: number): string => `${taken}/${total}`;

/** Where the counter's right edge is: against the pause button when there is one, else against the screen's edge. */
export const hiloCounterRight = (pause: { x: number } | undefined): number => (pause ? pause.x - HILO_HUD.pauseGap : BASE_WIDTH - HILO_HUD.margin);

/** The text stroke that draws an outline `px` wide outside each glyph: a stroke lies half outside the glyph's edge. */
export const hiloStroke = (px: number): number => 2 * px;

/**
 * Where the counter's text object goes (its origin is its top right) so that its glyphs' right edge is at `right` and their top at
 * `HILO_HUD.top`, drawn with a stroke `stroke` px thick: Phaser pads the text's box by the stroke, half of it on each side of the glyphs.
 */
export const hiloTextPlace = (right: number, stroke: number): { x: number; y: number } => ({ x: right + stroke / 2, y: HILO_HUD.top - stroke / 2 });
