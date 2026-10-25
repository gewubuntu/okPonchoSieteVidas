// Poncho's sprite frames, facing right, feet on the bottom row (GDD-ART-01, GDD-ART-02, GDD-ART-04).
// Every frame is the user's pixel drawing (poncho-pixels.mjs) with a tail added behind him. Each of its pixels is
// drawn as 2 x 2 art pixels, so the figure keeps the user's pixels exactly. The run frames put the legs of the
// user's run cycle (poncho-run-legs.mjs) under it.
import { and, ellipse, Grid, stroke } from './raster.mjs';
import { COLOURS, ROWS } from './poncho-pixels.mjs';
import { RUN_LEGS } from './poncho-run-legs.mjs';

/** One of the drawing's pixels is this many art pixels across. */
export const SCALE = 2;
/** The frame, in art pixels: 40 x 40 game pixels. */
export const FRAME = 160;
/** Room left of the drawing for the tail, in the drawing's pixels. */
export const TAIL_ROOM = 8;
/** The drawing's rows from here down are the legs; the poncho's fringe there stays with the body. */
export const LEG_TOP = 63;
/** The legs' columns: the near leg (lighter, drawn in front) and the far leg (darker). */
const NEAR_LEG = [15, 30];
const FAR_LEG = [31, 41];

const OUTLINE = COLOURS['#'];
const FUR = COLOURS.f;
const FUR_DARK = COLOURS.F;
const FUR_SHADE = COLOURS.s;
const CREAM = COLOURS.w;
const CREAM_SHADE = COLOURS.p;

/** The tail in the drawing's pixels: out from behind the legs, back, then up, with a cream tip. `sway` moves the tip. */
function drawTail(g, sway, dy) {
  const at = (x, y) => [x + TAIL_ROOM, y + dy];
  const path = [at(22, 65), at(14, 67), at(8, 65), at(4 + sway * 0.5, 59), at(3 + sway, 51), at(5 + sway, 44)];
  const tail = stroke(path, 3.6);
  const t = new Grid(g.width, g.height);
  t.fill(tail, FUR);
  t.fill(and(tail, (x, y) => y > 64.5 + dy), FUR_DARK); // the underside, in shadow
  t.fill(and(tail, (x, y) => x < at(4.2 + sway, 0)[0] && y > 50 + dy && y <= 64.5 + dy), FUR_SHADE);
  t.fill(and(tail, (x, y) => y < 50 + dy), CREAM);
  const tip = ellipse(...at(5.2 + sway, 45.5), 2.6, 3);
  t.fill(tip, CREAM);
  t.fill(and(tip, (x) => x < at(4.6 + sway, 0)[0]), CREAM_SHADE);
  t.outline(OUTLINE, 1);
  for (let y = 0; y < g.height; y++) for (let x = 0; x < g.width; x++) if (t.get(x, y)) g.set(x, y, t.get(x, y));
}

const isLeg = (x, y, [from, to]) => y >= LEG_TOP && x >= from && x <= to;

/** Copies the drawing's own legs, for the standing frame. */
function standingLegs() {
  return ROWS.slice(LEG_TOP).map((row) => [...row].map((ch, x) => (isLeg(x, LEG_TOP, NEAR_LEG) || isLeg(x, LEG_TOP, FAR_LEG) ? ch : '.')).join(''));
}

/**
 * One frame in the drawing's pixels: the tail, the legs (`legs`, rows from the drawing's row 63 down, each with a
 * 1 px outline of their own), and the drawing's body above them, standing on the frame's bottom row.
 */
function drawSmall(legs, { sway = 0 } = {}) {
  const w = ROWS[0].length + TAIL_ROOM, h = LEG_TOP + legs.length;
  const g = new Grid(w, h);
  drawTail(g, sway, 0);
  const legLayer = new Grid(w, h);
  legs.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch !== '.') legLayer.set(x + TAIL_ROOM, LEG_TOP + y, COLOURS[ch]);
  }));
  legLayer.outline(OUTLINE, 1);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (legLayer.get(x, y)) g.set(x, y, legLayer.get(x, y));
  ROWS.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch === '.' || isLeg(x, y, NEAR_LEG) || isLeg(x, y, FAR_LEG)) return;
    g.set(x + TAIL_ROOM, y, COLOURS[ch]);
  }));
  return g;
}

/** Scales a frame of the drawing's pixels up and stands it on the frame's bottom row, centred. */
function toFrame(small) {
  const g = new Grid(FRAME, FRAME);
  const left = Math.floor((FRAME - small.width * SCALE) / 2), top = FRAME - small.height * SCALE;
  for (let y = 0; y < small.height; y++) {
    for (let x = 0; x < small.width; x++) {
      const c = small.get(x, y);
      if (c) for (let j = 0; j < SCALE; j++) for (let i = 0; i < SCALE; i++) g.set(left + x * SCALE + i, top + y * SCALE + j, c);
    }
  }
  return g;
}

/** The standing frame: the drawing as it is. */
export function drawIdle() {
  return toFrame(drawSmall(standingLegs()));
}

/** The run cycle: the user's four run frames (their legs on the standing drawing's body), the tail tip swaying. */
export function drawRun() {
  const sways = [0, 1, 0, -1];
  return RUN_LEGS.map((legs, i) => toFrame(drawSmall(legs, { sway: sways[i] })));
}
