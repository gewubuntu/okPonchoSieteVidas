// The Cacomixtle, 3-3's new enemy (GDD-ENM-04): the ringtail (Bassariscus astutus), tlahcomiztli in Nahuatl, "half mountain lion", the miners'
// cat. It rides its own vagoneta, so it is drawn to sit in one: a tall ringed tail standing over the cart's rim like a flag, big rounded
// ears, ochre light fur, white rings round huge dark eyes, a cheeky grin, paws on the rim. No lantern and no lit lamp colour (GDD-ART-06).
// Drawn in code (GDD-ART-01) in World 3's colours and the outline (GDD-ART-05), in drawing px (2 x 2 art px, half a game px), with World 2's
// kit, like the Armadillo. Facing right (the way a rail with `dir: 1` rolls; the game mirrors it for `dir: -1`); the frame's bottom row is
// the cart's floor line.
//
// L-059: the scene draws it between the cart's back layer and its front layer (`scripts/art/rails.mjs`, `cartCells`), so whatever of it
// lies at or below the front layer's rim is hidden (`RIM_ROW`). Its body is low in the cart; its head, ears and tail stand over the rim.
import { ellipse, Grid, or, polygon, rect } from '../raster.mjs';
import { flashed, OUTLINE, shaded } from '../enemies2/kit.mjs';
import { FLASH } from '../enemies1/kit.mjs';

/** The colours of World 3 the ringtail is drawn in (GDD-ART-06): its fur, its tail's rings, its ears' insides, its eyes and its grin. */
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

// Materials as [light, base, shadow], light from the upper left.
const FUR = [W3.ochreLight, W3.ochreLight, W3.ochre];
const FUR_DEEP = [W3.ochre, W3.ochre, W3.ochreShade];
const BELLY = [W3.mist, W3.mist, W3.ochreLight];
const EAR_IN = [W3.rust, W3.rust, W3.rust];

/** The shadow colours that turn the telegraph's darker red (GDD-ENM-01, World 1's flash kept by every world). */
const DARKS = [W3.ochre, W3.ochreShade, W3.ironDark, W3.rust, W3.rockDeep];

/** Paints `test` with `mat` on `g` (light upper left, shadow lower right). */
const paint = (g, test, mat) => shaded(g, test, mat);

/** The distance from (x, y) to the segment a-b, and how far along the segment (0 to 1) its nearest point is. */
function onSegment(x, y, [ax, ay], [bx, by]) {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
  return { d: Math.hypot(x - ax - t * dx, y - ay - t * dy), t };
}

/**
 * The tail: a bushy ribbon along the path `pts`, `widths` drawing px across at each point (between them it tapers), ringed: from its tip
 * back, rings of `ring` px along it, the tip's iron dark, then mist white, and so on, the root's first 3 px ochre light like the fur.
 * Flat colours: the outline round it is its edge. Returns the test for its shape, so a pose can draw over it.
 */
function tail(g, pts, widths, ring = 4.5) {
  const segs = pts.slice(1).map((p, i) => ({ a: pts[i], b: p, len: Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]) }));
  const total = segs.reduce((n, s) => n + s.len, 0);
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
  const shape = (x, y) => {
    const p = at(x, y);
    return p.d <= p.w / 2;
  };
  // The root is fur; from 3 px along, rings counted from the tip: iron dark, mist white, iron dark, ...
  g.fill(shape, W3.ochreLight);
  g.fill((x, y) => {
    const p = at(x, y);
    return p.d <= p.w / 2 && p.s >= 3 && Math.floor((total - p.s) / ring) % 2 === 1;
  }, W3.mist, true);
  g.fill((x, y) => {
    const p = at(x, y);
    return p.d <= p.w / 2 && p.s >= 3 && Math.floor((total - p.s) / ring) % 2 === 0;
  }, W3.ironDark, true);
  return shape;
}

/** An ear: a big rounded one at (cx, cy), `rx` x `ry`, turned `rot`, its inside rust. */
function ear(g, cx, cy, rx, ry, rot = 0) {
  paint(g, ellipse(cx, cy, rx, ry, rot), FUR);
  paint(g, ellipse(cx + 0.3, cy + 0.6, rx * 0.5, ry * 0.62, rot), EAR_IN);
}

/** An open eye: a mist white ring round a huge iron dark one, its pupil looking `look` px across. */
function eye(g, cx, cy, r, look = 0.6) {
  paint(g, ellipse(cx, cy, r, r * 1.08), [W3.mist, W3.mist, W3.mist]);
  g.fill(ellipse(cx + look, cy + 0.3, r * 0.58, r * 0.7), W3.ironDark);
}

/** A closed eye: the white ring with a dark lid line across it. */
function sleepy(g, cx, cy, r) {
  g.fill(ellipse(cx, cy, r, r * 0.8), W3.mist);
  g.fill((x, y) => Math.abs(x - cx) <= r - 0.3 && Math.abs(y - (cy + 0.4 + 0.6 * (Math.abs(x - cx) / r) ** 2)) <= 0.7, W3.ironDark);
}

/** An eye crossed out by the blow: an X in iron dark on the mist ring. */
function cross(g, cx, cy, r) {
  g.fill(ellipse(cx, cy, r, r), W3.mist);
  for (let i = -2; i <= 2; i++) {
    g.set(Math.floor(cx + i * 0.8), Math.floor(cy + i * 0.8), W3.ironDark);
    g.set(Math.floor(cx + i * 0.8), Math.floor(cy - i * 0.8), W3.ironDark);
  }
}

/**
 * The haunches and feet down in the cart: ochre, from the rim's row to the frame's last drawing row but one (the outline is the last), x 14
 * to 34, behind the cart's front wall. Every look has its feet on the cell's bottom row, the cart's floor line (L-059).
 */
function floor(g, x0 = 14, x1 = 34) {
  paint(g, rect(x0, 46, x1 - x0, 9), FUR_DEEP);
}

/** The muzzle at (cx, cy): a mist white snout with an iron dark nose at its tip (`dir` 1, facing right) and a cheeky grin under it. */
function muzzle(g, cx, cy, grin = true) {
  paint(g, ellipse(cx, cy, 4, 3), BELLY);
  g.fill(ellipse(cx + 3.6, cy - 1.2, 1.5, 1.2), W3.ironDark);
  if (grin) {
    for (let i = 0; i < 5; i++) g.set(Math.floor(cx - 1 + i), Math.floor(cy + 1.6 - (i === 0 || i === 4 ? 1 : 0)), W3.rockDeep);
  }
}

/**
 * Standing tall (the telegraph's base): up on its hind legs in the cart, its paws on the rim, the tail straight up over it like a flag, its
 * big ears up, its eyes wide and its grin cheeky. The torso's lower part is behind the cart's front wall.
 */
function drawStand() {
  const g = new Grid(FRAME.w, FRAME.h);
  tail(g, [[14, 52], [11, 42], [9, 30], [9, 18], [10, 6]], [5, 7, 9, 9, 7]);
  floor(g, 16, 32);
  paint(g, ellipse(24, 42, 8.5, 11), FUR);
  paint(g, ellipse(27, 43, 4.5, 8), BELLY);
  // The arms down to the rim, the paws on it.
  paint(g, or(ellipse(31, 40, 2, 5, -0.4), ellipse(33.5, 44.5, 3, 2.2)), FUR);
  paint(g, ellipse(17, 44, 3, 2.2), FUR);
  ear(g, 19, 15.5, 4.5, 6, -0.15);
  ear(g, 31, 14.5, 4.5, 6, 0.15);
  paint(g, ellipse(25.5, 25, 8.5, 7.5), FUR);
  eye(g, 22.5, 24.5, 3.7);
  eye(g, 29.5, 24.5, 3.4, 0.9);
  muzzle(g, 31.5, 29.5);
  g.outline(OUTLINE, 1);
  return g;
}

/**
 * Dozing in the waiting cart: curled low behind the rim, the head down on its paws at the front, the ringed tail curled along the rim over
 * its back (still seen), the ears up, its eyes shut.
 */
function drawDoze() {
  const g = new Grid(FRAME.w, FRAME.h);
  floor(g, 10, 30);
  paint(g, ellipse(19, 47, 11.5, 7.5), FUR_DEEP);
  tail(g, [[8, 50], [5, 43], [8, 37], [15, 34], [23, 34], [29, 36]], [6, 7, 8, 8, 8, 7], 4);
  paint(g, ellipse(18, 47, 7, 3.5), FUR);
  ear(g, 28.5, 34.5, 3.4, 4.6, -0.2);
  ear(g, 37, 35.5, 3.2, 4.4, 0.25);
  paint(g, ellipse(32.5, 42, 8, 6.2), FUR);
  sleepy(g, 30, 41, 2.9);
  sleepy(g, 36, 41.5, 2.6);
  muzzle(g, 36, 45, false);
  paint(g, or(ellipse(26, 47.5, 3.5, 2), ellipse(38, 49, 3, 2)), FUR);
  g.outline(OUTLINE, 1);
  return g;
}

/**
 * Riding, leaning forward: the body low and stretched, the head thrust ahead, the ears flat back, the paws gripping the rim, the tail
 * streaming back and up behind it like a pennant. `step` 0 and 1 are the two frames: the tail's wave and the head's bob differ.
 */
function drawRide(step) {
  const g = new Grid(FRAME.w, FRAME.h);
  const bob = step === 0 ? 0 : 1;
  const wave = step === 0 ? [[14, 44], [11, 40], [8, 34], [6, 26], [7, 17]] : [[14, 44], [11, 41], [8, 36], [7, 28], [9, 20]];
  tail(g, wave, [6, 8, 9, 9, 7], 4.5);
  floor(g, 12, 32);
  paint(g, ellipse(23, 42 + bob * 0.5, 12.5, 6.5, 0.28), FUR);
  paint(g, ellipse(24, 44.5 + bob * 0.5, 8, 3), BELLY);
  // The paws on the rim, ahead of the head and behind it.
  paint(g, or(ellipse(17, 45, 3, 2), ellipse(34, 44 + bob, 3.2, 2.2)), FUR);
  // The ears flat back over the neck.
  paint(g, ellipse(29, 33.5 + bob, 5.2, 2.2, -0.35), FUR);
  g.fill(ellipse(29.5, 34 + bob, 3, 1), W3.rust);
  paint(g, ellipse(33.5, 38.5 + bob, 7.5, 6.4), FUR);
  eye(g, 34, 37 + bob, 3.2, 1.2);
  paint(g, ellipse(39.5, 41 + bob, 4, 3), BELLY);
  g.fill(ellipse(43, 40 + bob, 1.5, 1.2), W3.ironDark);
  for (let i = 0; i < 5; i++) g.set(37 + i, 43 + bob - (i === 0 || i === 4 ? 1 : 0), W3.rockDeep);
  g.outline(OUTLINE, 1);
  return g;
}

/**
 * Parked at the buffer: it peeks over the rim, the head just over it with the big eyes wide, the ears up, the paws on the rim, and the
 * ringed tail hooked up behind it like a question mark.
 */
function drawParked() {
  const g = new Grid(FRAME.w, FRAME.h);
  tail(g, [[12, 52], [9, 44], [7, 36], [9, 27], [14, 22], [20, 23]], [6, 7, 8, 8, 7, 6], 4);
  floor(g, 14, 34);
  ear(g, 18.5, 31, 3.8, 5.2, -0.2);
  ear(g, 31, 31, 3.8, 5.2, 0.2);
  paint(g, ellipse(24.5, 40.5, 9.5, 7.5), FUR);
  eye(g, 21, 38.5, 3.7, 0.8);
  eye(g, 29, 38.5, 3.7, 1.1);
  muzzle(g, 25.5, 44.5, false);
  paint(g, or(ellipse(16.5, 45, 3.4, 2.2), ellipse(33, 45, 3.4, 2.2)), FUR);
  g.outline(OUTLINE, 1);
  return g;
}

/**
 * Stomped: pressed flat in the cart, a pancake of fur with the head squashed wide over the rim, the ears flat out to the sides, the eyes
 * crossed out, the tail flung limp over the rim.
 */
function drawSquash() {
  const g = new Grid(FRAME.w, FRAME.h);
  floor(g, 10, 38);
  tail(g, [[12, 50], [7, 43], [5, 37], [7, 33]], [5, 6, 6, 5], 4);
  paint(g, ellipse(24, 47, 15, 7), FUR_DEEP);
  paint(g, ellipse(24, 44, 14, 4.5), FUR);
  paint(g, ellipse(11.5, 42, 3.6, 2.4, 0.3), FUR);
  paint(g, ellipse(37, 42, 3.6, 2.4, -0.3), FUR);
  g.fill(ellipse(11.5, 42.3, 2, 1.1, 0.3), W3.rust);
  g.fill(ellipse(36.8, 42.3, 2, 1.1, -0.3), W3.rust);
  paint(g, ellipse(24.5, 41.5, 9.5, 4.2), FUR);
  cross(g, 20.5, 41, 2.6);
  cross(g, 28.5, 41, 2.6);
  g.fill(rect(23, 44, 4, 1), W3.rockDeep);
  g.outline(OUTLINE, 1);
  return g;
}

/**
 * Knocked over by the claw or a fireball: on its back in the cart, its four legs up in the air with their paws, the head lolled to the
 * front with crossed eyes, the ears out, the tail standing stiff behind. Its back is on the floor (the bottom row).
 */
function drawHit() {
  const g = new Grid(FRAME.w, FRAME.h);
  floor(g, 12, 38);
  tail(g, [[13, 49], [9, 40], [8, 29], [9, 17]], [5, 7, 8, 7], 4.5);
  // The four legs up: a hind pair leaning back, a fore pair forward, each with an ochre shade paw at its tip.
  for (const [x0, y0, x1, y1] of [[17, 46, 13, 33], [22, 46, 21, 31], [29, 46, 31, 32], [34, 46, 38, 35]]) {
    const leg = polygon([[x0 - 1.5, y0], [x0 + 1.5, y0], [x1 + 1.5, y1], [x1 - 1.5, y1]]);
    paint(g, leg, FUR);
    paint(g, ellipse(x1, y1, 2.5, 2), FUR_DEEP);
  }
  paint(g, ellipse(25, 48, 13, 6.6), FUR);
  paint(g, ellipse(26, 50, 8, 3), BELLY);
  ear(g, 37.5, 36, 3.2, 4.2, 0.6);
  paint(g, ellipse(38, 43.5, 6.5, 5.2), FUR);
  cross(g, 36, 42.5, 2.4);
  g.fill(ellipse(41.5, 45, 1.4, 1.1), W3.ironDark);
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
