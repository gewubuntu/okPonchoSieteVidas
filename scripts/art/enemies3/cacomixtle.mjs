// The Cacomixtle, 3-3's new enemy (GDD-ENM-04): the ringtail (Bassariscus astutus), tlahcomiztli in Nahuatl, "half mountain lion", the miners'
// cat. It rides its own vagoneta, so it is drawn to sit in one: a slender cat-like body, a pointed fox-like muzzle with a dark nose, big
// rounded ears set back on the head, one huge dark eye ringed with white, a cheeky grin, and a ringed tail longer than its body standing over
// the cart's rim like a flag. Ochre fur in three tones lit from the upper left, the belly and the muzzle lighter. No lantern and no lit lamp
// colour (GDD-ART-06). Drawn in code (GDD-ART-01) in World 3's colours and the outline (GDD-ART-05), in drawing px (2 x 2 art px, half a game
// px), with World 2's kit, like the Armadillo. In profile, facing right (the way a rail with `dir: 1` rolls; the game mirrors it for
// `dir: -1`), like every other enemy; the frame's bottom row is the cart's floor line.
//
// L-059: the scene draws it between the cart's back layer and its front layer (`scripts/art/rails.mjs`, `cartCells`), so whatever of it
// lies at or below the front layer's rim is hidden (`RIM_ROW`). Its body is low in the cart; its head, ears and tail stand over the rim. What
// lies under the rim is still drawn as the body's rounded underside and its hind feet, not a block.
import { and, ellipse, Grid, or, polygon, stroke } from '../raster.mjs';
import { flashed, OUTLINE, shaded } from '../enemies2/kit.mjs';
import { FLASH } from '../enemies1/kit.mjs';

/** The colours of World 3 the ringtail is drawn in (GDD-ART-06): its fur, its tail's rings, its ears' insides, its eye and its grin. */
export const W3 = {
  mist: '#EEF1EA', ochreLight: '#EDCB86', ochre: '#CC983F', ochreShade: '#9A6A2C', ironDark: '#353A48', rust: '#B0562E', rockDeep: '#5A3B28',
};

/** Every cell of the sheet is 24 x 28 game px. */
export const FRAME = { w: 48, h: 56 };
/** The 14 x 14 game px hit box (tuning CACOMIXTLE, GDD-ENM-04), its feet on the frame's bottom row, in the middle across. */
export const BOX = { x0: 10, y0: 28, x1: 38, y1: 56 };
export const LOOKS = ['doze', 'stand', 'standRed', 'ride0', 'ride1', 'parked', 'squash', 'hit'];

/**
 * The first row of a cell that lies behind the cart's front layer (measured on `drawCartFrames()`, `scripts/art/enemies3.test.mjs`): the
 * front layer's rim is its row 3 (game px) in the standing, rolling0 and stopped looks and row 4 in rolling1, which is 5 game px (4) over the
 * floor line, so a cell's last 10 rows (8) are hidden. The worst case, 46, is the one every look is held to.
 */
export const RIM_ROW = 46;

// Materials as [light, base, shadow], light from the upper left: the fur's three ochres, the belly's and the muzzle's lighter fur, the tail's
// rings with a shade on their lower edge.
const FUR = [W3.ochreLight, W3.ochre, W3.ochreShade];
const BELLY = [W3.mist, W3.ochreLight, W3.ochre];
const RING_LIGHT = [W3.mist, W3.mist, W3.ochreLight];
const RING_DARK = [W3.ironDark, W3.ironDark, OUTLINE];

/** The shadow colours that turn the telegraph's darker red (GDD-ENM-01, World 1's flash kept by every world); the fur's base turns red. */
const DARKS = [W3.ochreShade, W3.ironDark, W3.rust, W3.rockDeep];

/** Paints `test` with `mat` on `g` (light upper left, shadow lower right), the light `lit` px deep. */
const paint = (g, test, mat, lit = 1) => shaded(g, test, mat, { lightDepth: lit });

/** The distance from (x, y) to the segment a-b, and how far along the segment (0 to 1) its nearest point is. */
function onSegment(x, y, [ax, ay], [bx, by]) {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
  return { d: Math.hypot(x - ax - t * dx, y - ay - t * dy), t };
}

/**
 * The tail: a bushy ribbon along the path `pts` from its root to its tip, `widths` drawing px across at each point (between them it tapers),
 * ringed: from its tip back, `rings` iron dark rings with mist white between them, the tip dark, the root ochre like the fur. Each ring is
 * shaded on its own, so it has a shade on its lower edge. Every look's tail is about 45 px along, so its rings are the same size in every
 * look; where less of it shows, its root runs under the body, hidden.
 */
function tail(g, pts, widths, rings = 7) {
  const segs = pts.slice(1).map((p, i) => ({ a: pts[i], b: p, len: Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]) }));
  const total = segs.reduce((n, s) => n + s.len, 0);
  const band = (total - 3) / (2 * rings);
  const at = (x, y) => {
    let best = { d: Infinity, s: 0, w: 0 };
    let run = 0;
    segs.forEach((seg, i) => {
      const { d, t } = onSegment(x, y, seg.a, seg.b);
      if (d < best.d) best = { d, s: run + t * seg.len, w: widths[i] + (widths[i + 1] - widths[i]) * t };
      run += seg.len;
    });
    return best;
  };
  // Each pixel's band counted from the tip: even ones iron dark, odd ones mist white, past the last ring the root's fur.
  const bandOf = (x, y) => {
    const p = at(x, y);
    return p.d <= p.w / 2 ? Math.min(2 * rings, Math.floor((total - p.s) / band)) : -1;
  };
  paint(g, (x, y) => bandOf(x, y) === 2 * rings, FUR);
  for (let k = 0; k < 2 * rings; k++) paint(g, (x, y) => bandOf(x, y) === k, k % 2 === 0 ? RING_DARK : RING_LIGHT);
}

const KEY = { w: W3.mist, k: W3.ironDark };
/** Paints a pixel map (rows of KEY letters, '.' empty) with its top left at (ox, oy). */
function stamp(g, rows, ox, oy) {
  rows.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== '.') g.set(ox + x, oy + y, KEY[ch]); }));
}

/** The eye, 5 x 5: a huge dark eye ringed mist white, open; shut, a short dark line in the ring; or crossed out by the blow. */
const EYES = {
  open: ['.www.', 'wkkkw', 'wkkkw', 'wkkkw', '.www.'],
  shut: ['.....', '.www.', 'wkkkw', '.www.', '.....'],
  cross: ['.www.', 'wkwkw', 'wwkww', 'wkwkw', '.www.'],
};

/**
 * The head in profile, facing right, its skull's middle at (cx, cy): a rounded skull and a pointed fox-like muzzle, its cheek and underside
 * lighter, an iron dark nose at the tip, one big rounded ear set back on the head, one eye and the cheeky grin. `eye`: 'open' (a huge dark
 * eye ringed mist white), 'shut' (a short dark line) or 'cross' (knocked out). `ear`: 'up', 'back' (flat back along the neck, `flutter` px
 * up) or 'flat' (pressed out behind). `up` scales it up and down: -1 turns it over (on its back), under 1 squashes it flat.
 */
function head(g, cx, cy, { eye = 'open', ear = 'up', flutter = 0, up = 1, grin = true } = {}) {
  const Y = (dy) => cy + dy * up;
  const ears = {
    up: [cx - 3, Y(-5.6), 3.7, 4.6, -0.3 * up],
    back: [cx - 6, Y(-3.6 - flutter), 4.6, 2.6, 0.4 * up],
    flat: [cx - 7, Y(-1.5), 4, 2.2, 0.15 * up],
  }[ear];
  const [ex, ey, erx, ery, erot] = ears;
  paint(g, ellipse(ex, ey, erx, ery * Math.abs(up), erot), FUR, 2);
  g.fill(ellipse(ex + 0.3, ey + 0.4 * up, erx * 0.5, ery * 0.6 * Math.abs(up), erot), W3.rust, true);
  const skull = ellipse(cx, cy, 6, 5.2 * Math.abs(up));
  const snout = polygon([[cx + 1, Y(-3.8)], [cx + 10, Y(0.9)], [cx + 9.7, Y(2.6)], [cx + 1, Y(5)]]);
  paint(g, or(skull, snout), FUR, 2);
  // The cheek and the muzzle's underside, lighter.
  paint(g, and(or(skull, snout), (x, y) => (y - cy) * up > 1.2 && x > cx - 2.5), BELLY);
  g.fill(ellipse(cx + 9.1, Y(1.4), 1.4, 1.4), W3.ironDark, true);
  stamp(g, EYES[eye], Math.round(cx + 0.4), Math.round(Y(-0.6)) - 2);
  if (grin) for (const [dx, dy] of [[3.5, 1.6], [4.5, 2.4], [5.5, 3], [6.5, 3.1], [7.5, 3], [8.5, 2.7]]) g.set(Math.floor(cx + dx), Math.floor(Y(dy)), W3.rockDeep);
}

/** A hind leg folded under the body: the haunch's round at (hx, hy) and the long foot flat on the floor, its toes at `toe`. */
function haunch(g, hx, hy, toe) {
  paint(g, ellipse(hx, hy, 6.5, 6), FUR);
  paint(g, ellipse((hx + toe) / 2, 53, (toe - hx) / 2 + 2, 1.8), FUR);
}

/** A front leg from the shoulder `s` down to its paw at `p`, the paw a small round. */
function foreleg(g, s, p) {
  paint(g, or(stroke([s, p], 3.2), ellipse(p[0] + 0.8, p[1], 2.4, 1.6)), FUR);
}

/**
 * Sitting up tall (the telegraph's base): up on its haunches in the cart, the chest up, the ears up, the eye wide, the forepaws on the rim,
 * the tail straight up behind it like a flag.
 */
function drawStand() {
  const g = new Grid(FRAME.w, FRAME.h);
  tail(g, [[16, 50], [11, 44], [9, 34], [9, 20], [10, 10], [11, 5.5]], [6, 7, 8, 8, 7, 5]);
  haunch(g, 19, 47, 28);
  paint(g, ellipse(24, 38, 6, 10.5, -0.18), FUR, 2);
  paint(g, stroke([[24.5, 33], [26.5, 25]], 8), FUR, 2);
  paint(g, ellipse(28.5, 38, 2.6, 7.5, -0.18), BELLY);
  foreleg(g, [28, 34], [31, 44.5]);
  head(g, 27.5, 22.5);
  g.outline(OUTLINE, 1);
  return g;
}

/**
 * Dozing in the waiting cart: curled low behind the rim, the back's arch over it, the head down on its forepaws at the front, the eye shut,
 * the ringed tail wrapped along the rim over its back (still seen).
 */
function drawDoze() {
  const g = new Grid(FRAME.w, FRAME.h);
  paint(g, ellipse(21, 46.5, 12, 8), FUR, 2);
  paint(g, ellipse(27, 53, 7, 1.8), FUR);
  paint(g, ellipse(38, 46, 4, 1.8), FUR);
  head(g, 32, 41.5, { eye: 'shut', grin: false });
  tail(g, [[11, 50], [6.5, 45], [7, 38.5], [11, 33.5], [19, 32.5], [27, 34.5], [31, 38]], [7, 9, 10, 11, 11, 9, 7]);
  g.outline(OUTLINE, 1);
  return g;
}

/**
 * Riding, crouched forward like a little driver: the body low and long, the head thrust ahead over the forepaws on the rim, the ears flat
 * back, the tail streaming back and up behind it in a curve. `step` 0 and 1 are the two frames: the tail's wave and the ears' flutter differ.
 */
function drawRide(step) {
  const g = new Grid(FRAME.w, FRAME.h);
  const wave = step === 0
    ? [[20, 50], [14, 46], [8, 43], [6, 37], [6, 29], [8, 21], [12, 15]]
    : [[20, 50], [14, 46], [9, 44], [6.5, 38], [6, 30], [7, 22], [10, 15.5]];
  tail(g, wave, [6, 6, 7, 8, 8, 7, 5]);
  haunch(g, 17, 47, 26);
  paint(g, ellipse(24, 44, 11, 6, -0.22), FUR, 2);
  paint(g, stroke([[29, 41], [32, 38]], 7), FUR, 2);
  paint(g, ellipse(27, 48, 7, 2.4, -0.22), BELLY);
  foreleg(g, [31, 41], [36, 44.5]);
  head(g, 33, 37, { ear: 'back', flutter: step });
  g.outline(OUTLINE, 1);
  return g;
}

/**
 * Parked at the buffer: it peeks over the rim, the head just over it with the eye looking ahead, the ear up, the forepaws on the rim, and the
 * ringed tail up behind it in a curl.
 */
function drawParked() {
  const g = new Grid(FRAME.w, FRAME.h);
  tail(g, [[13, 49], [8, 43], [6.5, 34], [6.5, 24], [10, 17.5], [16, 16.5], [19, 20.5]], [7, 8, 9, 9, 9, 8, 6]);
  haunch(g, 18, 48, 27);
  paint(g, ellipse(24, 47, 9, 6.5), FUR, 2);
  paint(g, stroke([[26, 44], [28, 40]], 7), FUR, 2);
  foreleg(g, [30, 42], [35, 44.5]);
  head(g, 28, 39);
  foreleg(g, [27, 43], [31.5, 44.5]);
  g.outline(OUTLINE, 1);
  return g;
}

/**
 * Stomped: pressed flat in the cart, a long pancake of fur in profile, the head squashed at the front with the eye crossed out, the ear flat
 * out behind, the tail flung limp behind over the rim.
 */
function drawSquash() {
  const g = new Grid(FRAME.w, FRAME.h);
  tail(g, [[32, 51], [11, 48], [5.5, 44], [5.5, 38.5], [7, 34]], [6, 6, 7, 7, 5]);
  paint(g, ellipse(22, 47.4, 14.5, 7.3), FUR, 3);
  paint(g, ellipse(24, 52.5, 10, 1.8), BELLY);
  head(g, 34, 42.5, { eye: 'cross', ear: 'flat', up: 0.7, grin: false });
  g.outline(OUTLINE, 1);
  return g;
}

/**
 * Knocked over by the claw or a fireball: on its back in the cart, in profile, its four legs up in the air with their paws, the belly up,
 * the head turned over at the front with the eye crossed out, the tail limp behind. Its back is on the floor (the bottom row).
 */
function drawHit() {
  const g = new Grid(FRAME.w, FRAME.h);
  tail(g, [[31, 51], [12, 50], [6, 48], [5.5, 43], [5, 37], [7.5, 33]], [6, 6, 7, 7, 6, 5]);
  // The far legs, then the body, then the near legs: the hind pair leaning back, the fore pair forward, a paw at each tip.
  for (const [s, p] of [[[18, 45], [14, 35]], [[30, 45], [34, 36]]]) foreleg(g, s, p);
  paint(g, ellipse(23, 48.6, 12, 6.4), FUR, 2);
  paint(g, ellipse(23, 44.5, 9, 2.4), BELLY);
  for (const [s, p] of [[[16, 45], [19, 34]], [[26, 45], [27, 34]]]) foreleg(g, s, p);
  head(g, 36, 45, { eye: 'cross', ear: 'flat', up: -1, grin: false });
  g.outline(OUTLINE, 1);
  return g;
}

function drawLook(look) {
  switch (look) {
    case 'doze': return drawDoze();
    case 'stand': return drawStand();
    case 'standRed': return flashed(drawStand(), FLASH, DARKS);
    case 'ride0': return drawRide(0);
    case 'ride1': return drawRide(1);
    case 'parked': return drawParked();
    case 'squash': return drawSquash();
    case 'hit': return drawHit();
    default: throw new Error(`no look ${look}`);
  }
}

/** Every frame in LOOKS order: [{ look, grid }], each FRAME.w x FRAME.h drawing px. */
export function drawFrames() {
  return LOOKS.map((look) => ({ look, grid: drawLook(look) }));
}
