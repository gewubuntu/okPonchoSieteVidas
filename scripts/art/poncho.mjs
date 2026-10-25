// Poncho's sprite frames, facing right, feet on the bottom row (GDD-ART-01, GDD-ART-02).
// The standing frame is the user's pixel drawing (poncho-pixels.mjs) with a tail added behind him. Each of its pixels
// is drawn as 2 x 2 art pixels, so the figure keeps the user's pixels exactly.
import { and, ellipse, Grid, stroke } from './raster.mjs';
import { COLOURS, ROWS } from './poncho-pixels.mjs';

/** One of the drawing's pixels is this many art pixels across. */
export const SCALE = 2;
/** The frame, in art pixels: 40 x 40 game pixels. */
export const FRAME = 160;
/** Room left of the drawing for the tail, in the drawing's pixels. */
const TAIL_ROOM = 8;

const OUTLINE = COLOURS['#'];
const FUR = COLOURS.f;
const FUR_DARK = COLOURS.F;
const FUR_SHADE = COLOURS.s;
const CREAM = COLOURS.w;
const CREAM_SHADE = COLOURS.p;

/** The tail in the drawing's pixels: out from behind the legs, back, then up, with a cream tip. */
function drawTail(width, height) {
  const g = new Grid(width, height);
  const at = (x, y) => [x + TAIL_ROOM, y];
  const path = [at(22, 65), at(14, 67), at(8, 65), at(4, 59), at(3, 51), at(5, 44)];
  const tail = stroke(path, 3.6);
  g.fill(tail, FUR);
  g.fill(and(tail, (x, y) => y > 64.5), FUR_DARK); // the underside, in shadow
  g.fill(and(tail, (x, y) => x < at(4.2, 0)[0] && y > 50 && y <= 64.5), FUR_SHADE);
  g.fill(and(tail, (x, y) => y < 50), CREAM);
  g.fill(ellipse(...at(5.2, 45.5), 2.6, 3), CREAM);
  g.fill(and(ellipse(...at(5.2, 45.5), 2.6, 3), (x, y) => x < at(4.6, 0)[0]), CREAM_SHADE);
  g.outline(OUTLINE, 1);
  return g;
}

/** The standing frame. */
export function drawIdle() {
  const w = ROWS[0].length + TAIL_ROOM, h = ROWS.length;
  const small = drawTail(w, h);
  ROWS.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch !== '.') small.set(x + TAIL_ROOM, y, COLOURS[ch]);
  }));
  // Scale up and stand him on the frame's bottom row, centred.
  const g = new Grid(FRAME, FRAME);
  const left = Math.floor((FRAME - w * SCALE) / 2), top = FRAME - h * SCALE;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = small.get(x, y);
      if (c) for (let j = 0; j < SCALE; j++) for (let i = 0; i < SCALE; i++) g.set(left + x * SCALE + i, top + y * SCALE + j, c);
    }
  }
  return g;
}
