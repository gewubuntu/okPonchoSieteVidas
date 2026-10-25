// Poncho's sprite frames, 128 x 128 art pixels, facing right, feet on the bottom row (GDD-ART-01, GDD-ART-02).
// Traced from the right-hand side view in assets/characters/poncho/sprite-side.jpg, mirrored to face right, with the
// palette of GDD-ART-03 and the pixel rules of GDD-ART-05 (plum outline, light from the upper left, three shades).
import { and, ellipse, Grid, not, or, polygon, stroke } from './raster.mjs';

export const FRAME = 128;

export const PALETTE = {
  outline: '#301830',
  blue: '#1F4ACB',
  blueLight: '#4A78F0',
  blueDark: '#1A1C5A',
  red: '#E44536',
  redLight: '#F2705A',
  redDark: '#B3302C',
  crimson: '#A83048',
  crimsonDark: '#7E2238',
  fur: '#F0BC6F',
  furLight: '#F8D498',
  furDark: '#D9934A',
  cream: '#F1F3E3',
  creamDark: '#D9D7C4',
  earInner: '#C99A84',
  blush: '#EE8A70',
  eye: '#342240',
  white: '#FFFFFF',
};
const P = PALETTE;

// The shapes are traced in the coordinates of a 3x enlargement of the left-hand side view, mirrored (the figure runs
// from x -10 to 740 and y 45 to 990 there), and scaled into the frame, so each shape can be checked against the
// reference by its numbers.
const K = 128 / 945;
const X = (x) => (x + 10) * K + 13;
const Y = (y) => (y - 45) * K;
const pt = ([x, y]) => [X(x), Y(y)];
const pts = (list) => list.map(pt);
const el = (cx, cy, rx, ry, rot = 0) => ellipse(X(cx), Y(cy), rx * K, ry * K, rot);
/** A point's x and y back in the reference's coordinates. */
const refX = (x) => (x - 13) / K - 10;
const refY = (y) => y / K + 45;

/** Paints a 1 px line along the inside edge of a shape: the inner lines of GDD-ART-05. */
function edge(g, test, colour) {
  const inside = (x, y) => test(x + 0.5, y + 0.5);
  for (let y = 0; y < g.height; y++) {
    for (let x = 0; x < g.width; x++) {
      if (inside(x, y) && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => !inside(x + dx, y + dy))) g.set(x, y, colour);
    }
  }
}

const BRIM_TILT = 0.17; // the brim dips towards the front

/** The standing frame. */
export function drawIdle() {
  const g = new Grid(FRAME, FRAME);

  // Tail, behind everything: out of the back of the body, back and up, with a big white tip.
  const tail = stroke(pts([[230, 868], [140, 878], [80, 852], [50, 800], [45, 745]]), 56 * K);
  g.fill(tail, P.fur);
  g.fill(and(tail, (x, y) => refY(y) > 860), P.furDark);
  edge(g, tail, P.outline);
  const tip = el(40, 700, 50, 42, 0.3);
  g.fill(tip, P.cream);
  g.fill(and(tip, (x, y) => refY(y) > 710), P.creamDark);
  edge(g, tip, P.outline);

  // Legs, the far one darker, cream paws pointing forward.
  for (const [x0, far] of [[290, true], [420, false]]) {
    const leg = polygon(pts([[x0, 840], [x0 + 72, 840], [x0 + 72, 960], [x0, 960]]));
    g.fill(leg, far ? P.furDark : P.fur);
    edge(g, leg, P.outline);
    const paw = el(x0 + 50, 965, 52, 24);
    g.fill(paw, far ? P.creamDark : P.cream);
    edge(g, paw, P.outline);
  }

  // Poncho: from the neck down, flaring to the back, its bands parallel to the hem, which dips to the front.
  const ponchoShape = polygon(pts([[300, 556], [520, 556], [550, 620], [578, 740], [602, 880], [480, 866], [360, 850], [250, 836], [148, 822], [188, 720], [248, 630]]));
  const band = (x, y) => refY(y) - (refX(x) - 180) * 0.15;
  g.fill(ponchoShape, P.blue);
  g.fill(and(ponchoShape, (x, y) => band(x, y) < 590 || (band(x, y) > 665 && band(x, y) < 722)), P.crimson);
  const hem = and(ponchoShape, (x, y) => band(x, y) > 778);
  g.fill(hem, P.crimson);
  g.recolour(P.blue, P.blueDark, (x) => refX(x) < 240); // the back of the poncho is in shadow
  g.recolour(P.crimson, P.crimsonDark, (x) => refX(x) < 240);
  g.recolour(P.blue, P.blueLight, (x, y) => refX(x) > 520 && band(x, y) < 665);
  edge(g, ponchoShape, P.outline);

  // The front paw hangs below the poncho, over the legs.
  const hand = el(365, 818, 40, 40);
  g.fill(hand, P.cream);
  edge(g, hand, P.outline);

  // Head: wide and round, below the brim, a big cream muzzle and cheek at the front.
  const head = or(el(420, 452, 210, 128), el(600, 455, 42, 58));
  g.fill(head, P.fur);
  g.fill(and(head, not(el(442, 432, 208, 128))), P.furDark); // shadow along the chin and the back of the head
  const muzzle = and(head, el(560, 512, 128, 82));
  g.fill(muzzle, P.cream);
  g.fill(and(muzzle, (x, y) => refY(y) > 535), P.creamDark);
  edge(g, head, P.outline);

  // Brim: a wide ellipse seen from the side: blue top with a dark back edge and a light rim, a red band with blue
  // zigzag teeth, a darker red underside.
  const brim = el(390, 232, 352, 90, BRIM_TILT);
  const top = el(390, 180, 340, 38, BRIM_TILT);
  g.fill(brim, P.red);
  g.fill(and(brim, top), P.blue);
  g.fill(and(brim, top, not(el(390, 188, 340, 34, BRIM_TILT))), P.blueDark);
  g.fill(and(brim, el(390, 184, 340, 42, BRIM_TILT), not(top)), P.blueLight);
  g.fill(and(brim, not(el(390, 220, 348, 92, BRIM_TILT))), P.redDark);
  // Zigzag: blue triangles hanging into the red band, 14 px apart.
  const lowestTop = [];
  for (let x = 0; x < FRAME; x++) {
    lowestTop[x] = -1;
    for (let y = 0; y < 60; y++) if ([P.blue, P.blueLight].includes(g.get(x, y)) && g.get(x, y + 1) === P.red) lowestTop[x] = y;
  }
  for (let x = 0; x < FRAME; x++) {
    if (lowestTop[x] < 0) continue;
    const tooth = Math.round(6 - Math.abs((x % 14) - 7) * (6 / 7));
    for (let k = 1; k <= tooth; k++) if (g.get(x, lowestTop[x] + k) === P.red) g.set(x, lowestTop[x] + k, P.blue);
  }
  edge(g, brim, P.outline);
  // The brim's shadow on the head just under it.
  g.fill(and(head, not(brim), el(390, 262, 336, 100, BRIM_TILT)), P.furDark);

  // Crown: a red dome rising from the brim, lit on the upper left, with a blue band.
  const crownBase = (x, y) => refY(y) < 238 + (refX(x) - 290) * 0.03;
  const crown = and(el(410, 162, 108, 122), crownBase);
  g.fill(crown, P.red);
  g.fill(and(crown, el(365, 95, 48, 40)), P.redLight);
  g.fill(and(crown, (x) => refX(x) > 490), P.redDark);
  g.fill(and(crown, (x, y) => refY(y) > 160 && refY(y) < 200), P.blue);
  g.fill(and(crown, (x, y) => refY(y) > 160 && refY(y) < 200 && refX(x) > 490), P.blueDark);
  edge(g, crown, P.outline);

  // The ear in front of the crown: fur outside, pink-brown inside.
  const ear = and(polygon(pts([[282, 240], [338, 88], [425, 240]])), crownBase);
  g.fill(ear, P.fur);
  g.fill(and(polygon(pts([[305, 240], [341, 128], [400, 240]])), crownBase), P.earInner);
  edge(g, ear, P.outline);

  // Face: a big dark eye with a white highlight, blush, nose tip and a smile line.
  g.fill(el(553, 412, 24, 46), P.eye);
  g.fill(el(544, 388, 9, 13), P.white);
  g.fill(el(470, 458, 32, 14), P.blush);
  g.fill(stroke(pts([[588, 478], [600, 490], [616, 490], [632, 482]]), 1.4), P.outline);
  g.fill(el(632, 430, 9, 9), P.outline);

  // Poncho pattern: white squares on the crimson bands, red dots in the blue bands, white triangles on the hem.
  const reds = [P.crimson, P.crimsonDark];
  const blues = [P.blue, P.blueDark, P.blueLight];
  const mark = (x, y, size, onto, colour) => {
    const cx = Math.round(X(x)), cy = Math.round(Y(y));
    for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) if (onto.includes(g.get(cx + i, cy + j))) g.set(cx + i, cy + j, colour);
  };
  for (const [x, y] of [[300, 590], [350, 585], [400, 590], [450, 600], [500, 605], [255, 708], [310, 722], [370, 730], [430, 740], [490, 752], [540, 760]]) mark(x, y, 3, reds, P.white);
  for (const [x, y] of [[270, 650], [330, 655], [390, 662], [450, 672], [510, 680], [300, 790], [420, 806], [520, 820]]) mark(x, y, 2, blues, P.crimson);
  for (let x = 190; x < 575; x += 42) {
    const cx = Math.round(X(x)), base = Math.round(Y(822 + (x - 180) * 0.15)) - 1;
    for (let j = 0; j < 4; j++) for (let i = -j; i <= j; i++) if (reds.includes(g.get(cx + i, base - 3 + j))) g.set(cx + i, base - 3 + j, P.white);
  }

  g.outline(P.outline, 2);
  return g;
}
