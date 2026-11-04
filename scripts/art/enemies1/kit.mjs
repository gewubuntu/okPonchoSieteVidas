// The shared kit for World 1's enemy sprites (GDD-ENM-02, GDD-ART-05, GDD-ART-06): World 1's 24 colours and the outline, and the
// helpers every enemy is drawn with. Drawn on a grid of drawing pixels, each 2 x 2 art pixels (half a game pixel), the scale of
// Poncho's drawing and Don Zopilote's.
import { Grid } from '../raster.mjs';

/** The outline every character has (GDD-ART-05). */
export const OUTLINE = '#070509';

/** World 1's 24 colours (GDD-ART-06), by name. Enemies use only these and the outline. */
export const W1 = {
  skyTop: '#E39A48', sky2: '#EDB15A', sky3: '#F4C66E', sky4: '#F9DA8E',
  sunDisc: '#FFF6D0', sunRing: '#FFD25A',
  cloudTop: '#FFF4DC', cloudUnder: '#E9B98A',
  purple: '#8E6A96', rust: '#A65B5B', blue: '#4D5A9C', navy: '#3A4580',
  grassLight: '#9CC24E', grass: '#6FA03A', grassDark: '#4E7A2C',
  sandLight: '#F4D29C', sand: '#E8B87A', sandDark: '#D19A5E',
  earth: '#A0472F', earthDark: '#7A3326',
  red: '#D8473A', orange: '#F08A3C', agave: '#6F9C8E', deep: '#2F5A3A',
};
export const WORLD_1 = Object.values(W1);

/** The telegraph's red flash (GDD-ENM-01): every pixel but the outline goes red, shadows a darker red. */
export const FLASH = { colour: W1.red, shade: W1.earth };

/** Paints a material [light, base, dark]: `light` along its upper left edge, `dark` along its lower right (GDD-ART-05). */
export function shaded(g, test, [light, base, dark], { lightDepth = 1, darkDepth = 1 } = {}) {
  const inside = (x, y) => test(x + 0.5, y + 0.5);
  for (let y = 0; y < g.height; y++) {
    for (let x = 0; x < g.width; x++) {
      if (!inside(x, y)) continue;
      let c = base;
      for (let d = 1; d <= darkDepth; d++) if (!inside(x + d, y + d) || !inside(x, y + d) || !inside(x + d, y)) c = dark;
      if (c === base) for (let d = 1; d <= lightDepth; d++) if (!inside(x - d, y - d) || !inside(x, y - d) || !inside(x - d, y)) c = light;
      g.set(x, y, c);
    }
  }
}

/** Sets single pixels. */
export const px = (g, pts, colour) => pts.forEach(([x, y]) => g.set(x, y, colour));

/** Every painted pixel but the outline recoloured: `shade` for the colours in `darks`, `colour` for the rest. */
export function flashed(src, { colour, shade } = FLASH, darks = [W1.navy, W1.earthDark, W1.grassDark, W1.deep, W1.rust, W1.earth]) {
  const g = new Grid(src.width, src.height);
  src.cells.forEach((c, i) => {
    if (c) g.cells[i] = c === OUTLINE ? OUTLINE : darks.includes(c) ? shade : colour;
  });
  return g;
}

/** `src` painted onto `dst` with its top left at (ox, oy); empty pixels of `src` leave `dst` as it is. */
export function paste(dst, src, ox, oy) {
  for (let y = 0; y < src.height; y++) for (let x = 0; x < src.width; x++) {
    const c = src.get(x, y);
    if (c) dst.set(ox + x, oy + y, c);
  }
}

/** A grid moved by (dx, dy), same size. */
export function shifted(src, dx, dy) {
  const g = new Grid(src.width, src.height);
  paste(g, src, dx, dy);
  return g;
}

/** A grid blown up `k` times. */
export function scaled(src, k) {
  const g = new Grid(src.width * k, src.height * k);
  for (let y = 0; y < g.height; y++) for (let x = 0; x < g.width; x++) g.cells[y * g.width + x] = src.cells[Math.floor(y / k) * src.width + Math.floor(x / k)];
  return g;
}

/** A sheet in art pixels: `columns` frames across, in order, each 2 x 2 art pixels a drawing pixel. */
export function sheet(frames, frame, columns) {
  const rows = Math.ceil(frames.length / columns);
  const g = new Grid(frame.w * columns, frame.h * rows);
  frames.forEach((f, i) => paste(g, f, (i % columns) * frame.w, Math.floor(i / columns) * frame.h));
  return scaled(g, 2);
}
