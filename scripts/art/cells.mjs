// The tools every world's art script draws with (GDD-ART-01, GDD-ART-06): a grid of game-pixel cells that blows up to art pixels, a
// repeatable noise, and the shading helpers that keep the light coming from the upper left (GDD-ART-05). Moved out of desert.mjs
// unchanged, so World 1's pictures stay the same pixel for pixel (scripts/art/desert.test.mjs checks the committed PNGs).
import { Grid } from './raster.mjs';

/** Art pixels per game pixel (GDD-ART-01). */
export const S = 4;

/** A grid of game-pixel cells, `w` by `h`, that `scaled()` blows up to art pixels. */
export class Cells {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.cells = new Array(w * h).fill(null);
  }

  get(x, y) {
    return x >= 0 && y >= 0 && x < this.w && y < this.h ? this.cells[y * this.w + x] : null;
  }

  set(x, y, colour) {
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.cells[y * this.w + x] = colour;
  }

  /** The cells `w` by `h` from (x0, y0) as new cells. */
  crop(x0, y0, w, h) {
    const c = new Cells(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) c.cells[y * w + x] = this.get(x0 + x, y0 + y);
    return c;
  }

  /** The cells as a pixel Grid, each one S x S art pixels. */
  scaled() {
    const g = new Grid(this.w * S, this.h * S);
    for (let y = 0; y < this.h * S; y++) {
      for (let x = 0; x < this.w * S; x++) g.cells[y * g.width + x] = this.cells[Math.floor(y / S) * this.w + Math.floor(x / S)];
    }
    return g;
  }
}

/** A repeatable pseudo-random number from two integers, so the art is the same on every run. */
export function noise(a, b) {
  let h = (Math.imul(a, 374761393) + Math.imul(b, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** The distance between two columns on the repeating 480 cell strip, with its sign: negative when `x` lies left of `at`. */
export const wrapDelta = (x, at) => ((x - at + 720) % 480) - 240;

/** A shape from tests on cell centres (`raster.mjs` shapes, in cell units) as a reader of cells `c` that says whether (x, y) is inside it. */
export const within = (c, test) => (x, y) => x >= 0 && y >= 0 && x < c.w && y < c.h && test(x + 0.5, y + 0.5);

/**
 * Paints the cells of a shape `base`, with `light` along its upper left edge and `dark` along its lower right (GDD-ART-05: light from the
 * upper left); where both the lower and the right neighbour are outside, `deep` (the corner in shadow).
 */
export function shade(c, test, base, light, dark, deep = dark) {
  const has = within(c, test);
  for (let y = 0; y < c.h; y++) {
    for (let x = 0; x < c.w; x++) {
      if (!has(x, y)) continue;
      const lowerRight = !has(x + 1, y) || !has(x, y + 1);
      c.set(x, y, !has(x + 1, y) && !has(x, y + 1) ? deep : lowerRight ? dark : !has(x - 1, y) || !has(x, y - 1) ? light : base);
    }
  }
}

/**
 * A pointed leaf from a base of half-width `half` at (bx, by) to the tip (tx, ty), in two tones: `lit` on the side that faces the upper
 * left and `shadow` on the side that faces the lower right.
 */
export function leaf(c, bx, by, tx, ty, half, lit, shadow) {
  const dx = tx - bx, dy = ty - by, len = Math.hypot(dx, dy);
  let nx = -dy / len, ny = dx / len;
  if (nx + ny < 0 || (nx + ny === 0 && nx < 0)) [nx, ny] = [-nx, -ny];
  for (let y = 0; y < c.h; y++) {
    for (let x = 0; x < c.w; x++) {
      const px = x + 0.5 - bx, py = y + 0.5 - by;
      const along = (px * dx + py * dy) / len;
      const across = px * nx + py * ny;
      if (along < -0.6 || along > len || Math.abs(across) > half * (1 - Math.max(0, along) / len) + 0.4) continue;
      c.set(x, y, across > 0.2 ? shadow : lit);
    }
  }
}

/** The cells of a shape on cells `c` that have all four neighbours inside it too, for spines and spots that stay off the edge. */
export function interior(c, test, f) {
  const has = within(c, test);
  for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) if (has(x, y) && has(x - 1, y) && has(x + 1, y) && has(x, y - 1) && has(x, y + 1)) f(x, y);
}

/** The cells a quadratic curve from `p0` through the control point `p1` to `p2` passes, each a cell once, in order. */
export function curve(p0, p1, p2) {
  const out = [];
  for (let i = 0; i <= 80; i++) {
    const t = i / 80, u = 1 - t;
    const cell = [Math.floor(u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0]), Math.floor(u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1])];
    if (!out.some(([x, y]) => x === cell[0] && y === cell[1])) out.push(cell);
  }
  return out;
}

/** Copies cells `from` onto `to` with their top left at (x0, y0), skipping empty cells. */
export function stamp(to, from, x0, y0) {
  for (let y = 0; y < from.h; y++) for (let x = 0; x < from.w; x++) if (from.get(x, y) !== null) to.set(x0 + x, y0 + y, from.get(x, y));
}

/** Copies a pixel Grid `from` onto the Grid `to` with its top left at (x0, y0), skipping empty pixels. */
export function blit(to, from, x0, y0) {
  for (let y = 0; y < from.height; y++) for (let x = 0; x < from.width; x++) if (from.get(x, y) !== null) to.set(x0 + x, y0 + y, from.get(x, y));
}
