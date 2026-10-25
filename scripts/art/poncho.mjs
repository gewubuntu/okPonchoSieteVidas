// Poncho's sprite frames, facing right, feet on the bottom row (GDD-ART-01, GDD-ART-02, GDD-ART-04).
// Every frame is the user's pixel drawing (poncho-pixels.mjs) with a tail added behind him. Each of its pixels is
// drawn as 2 x 2 art pixels, so the figure keeps the user's pixels exactly. The run frames move the drawing's own
// legs (sheared at the hip, lifted for a step) and bob the body, after the user's walk cycle (sprite-walk-a.jpg).
import { and, ellipse, Grid, stroke } from './raster.mjs';
import { COLOURS, ROWS } from './poncho-pixels.mjs';

/** One of the drawing's pixels is this many art pixels across. */
export const SCALE = 2;
/** The frame, in art pixels: 40 x 40 game pixels. */
export const FRAME = 160;
/** Room left of the drawing for the tail, in the drawing's pixels. */
const TAIL_ROOM = 8;
/** Room above the drawing for the body's bob, in the drawing's pixels. */
const HEADROOM = 2;
/** The drawing's rows from here down are the legs; the poncho's fringe there stays with the body. */
const LEG_TOP = 63;
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

/** Copies one leg, sheared so its top stays at the hip and its foot moves `dx` pixels, and raised `lift` pixels. */
function drawLeg(g, [from, to], { dx = 0, lift = 0 }) {
  const bottom = ROWS.length - 1;
  for (let y = LEG_TOP; y <= bottom; y++) {
    const shift = Math.round((dx * (y - LEG_TOP + 1)) / (bottom - LEG_TOP + 1));
    for (let x = from; x <= to; x++) {
      const ch = ROWS[y][x];
      if (ch === '.') continue;
      g.set(x + TAIL_ROOM + shift, y - lift + HEADROOM, COLOURS[ch]);
    }
  }
}

/**
 * One frame in the drawing's pixels. `bob` raises the body (and the tail) by whole pixels; the legs are placed by
 * their foot offsets and lifts.
 */
function drawSmall({ near = {}, far = {}, bob = 0, sway = 0 } = {}) {
  const w = ROWS[0].length + TAIL_ROOM, h = ROWS.length + HEADROOM;
  const g = new Grid(w, h);
  drawTail(g, sway, HEADROOM - bob);
  drawLeg(g, FAR_LEG, far);
  drawLeg(g, NEAR_LEG, near);
  ROWS.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch === '.' || isLeg(x, y, NEAR_LEG) || isLeg(x, y, FAR_LEG)) return;
    g.set(x + TAIL_ROOM, y - bob + HEADROOM, COLOURS[ch]);
  }));
  // Where the body was raised, close the gap above the legs with the poncho's underside line.
  if (bob > 0) {
    for (let x = 0; x < w; x++) {
      for (let y = LEG_TOP - bob + HEADROOM; y < LEG_TOP + HEADROOM; y++) {
        if (g.get(x, y) === null && g.get(x, y - 1) !== null && g.get(x, LEG_TOP + HEADROOM) !== null) g.set(x, y, OUTLINE);
      }
    }
  }
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

/** The standing frame. */
export function drawIdle() {
  return toFrame(drawSmall());
}

/**
 * The run cycle, four frames like the user's walk cycle: a stride with the near leg back, the legs passing with the
 * body up, a stride with the near leg forward, the legs passing again.
 */
export function drawRun() {
  return [
    { near: { dx: -5 }, far: { dx: 5 }, bob: 0, sway: 0 },
    { near: { dx: -1 }, far: { dx: 1, lift: 3 }, bob: 1, sway: 1 },
    { near: { dx: 5 }, far: { dx: -5 }, bob: 0, sway: 0 },
    { near: { dx: 1, lift: 3 }, far: { dx: -1 }, bob: 1, sway: -1 },
  ].map((pose) => toFrame(drawSmall(pose)));
}
