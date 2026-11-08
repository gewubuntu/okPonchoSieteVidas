// The shared kit for World 2's enemy sprites (GDD-ENM-03, GDD-ART-05, GDD-ART-06): World 2's 24 colours, the Chapulín's darkened leaf
// (user, 2026-11-04: "Darken it"), the outline and the telegraph's red, which every world keeps (GDD-ENM-01). Drawn like World 1's, on a
// grid of drawing pixels, each 2 x 2 art pixels (half a game pixel), the scale of Poncho's drawing; the helpers are World 1's.
import { Grid } from '../raster.mjs';
import { PALETTE } from '../mercado.mjs';
import { FLASH as W1_FLASH } from '../enemies1/kit.mjs';

export { OUTLINE } from '../mercado.mjs';
export { paste, px, scaled, shaded, sheet, shifted } from '../enemies1/kit.mjs';
import { OUTLINE } from '../mercado.mjs';

/** World 2's 24 colours (GDD-ART-06), by name, as `scripts/art/mercado.mjs` groups them. */
const [skyTop, sky, skyPale] = PALETTE.sky;
const [farLit, far, farShade] = PALETTE.far;
const [midRose, midShade, midOchre, street] = PALETTE.mid;
const [tejaLit, teja, tejaDark] = PALETTE.teja;
const [plasterLit, plaster, plasterShade] = PALETTE.plaster;
const [cobalt, glaze, yellow] = PALETTE.talavera;
const [rosa, teal, green, iron, wood] = PALETTE.market;
export const W2 = {
  skyTop, sky, skyPale, farLit, far, farShade, midRose, midShade, midOchre, street,
  tejaLit, teja, tejaDark, plasterLit, plaster, plasterShade, cobalt, glaze, yellow,
  rosa, teal, green, iron, wood,
  /** The Chapulín's leaf, darkened from `green` so it reads on the pink walls (GDD-ENM-03, Open Question 34). */
  leaf: '#3E7A3C',
};

/** The telegraph's red flash (GDD-ENM-01), World 1's: every pixel but the outline goes red, shadows a darker red. */
export const FLASH = W1_FLASH;

/** Every colour a World 2 enemy may use: World 2's 24, the leaf, the outline and the flash's two reds. */
export const ENEMY_COLOURS = [...Object.values(W2), OUTLINE, FLASH.colour, FLASH.shade];

/** The colours that turn the flash's darker red (the shadows); the rest turn its red. */
export const DARKS = [W2.street, W2.farShade, W2.iron, W2.tejaDark, W2.plasterShade, W2.wood, W2.cobalt, W2.leaf];

/** Every painted pixel but the outline recoloured for the telegraph: `shade` for the colours in `darks`, `colour` for the rest. */
export function flashed(src, { colour, shade } = FLASH, darks = DARKS) {
  const g = new Grid(src.width, src.height);
  src.cells.forEach((c, i) => {
    if (c) g.cells[i] = c === OUTLINE ? OUTLINE : darks.includes(c) ? shade : colour;
  });
  return g;
}
