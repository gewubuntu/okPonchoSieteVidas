// The Murciélago, World 3's basic enemy (GDD-ENM-04): the lesser long-nosed bat, el murciélago magueyero (Leptonycteris yerbabuenae),
// which flies up the Sierra each year and pollinates the agaves mezcal is made from; a friend of the land, no fangs. A wide scalloped M of
// wings with two tall ears and a long nose, a round friendly eye. Drawn in code (GDD-ART-01) in World 3's colours (GDD-ART-06) and the
// outline (GDD-ART-05), in drawing px (2 x 2 art px, half a game px), with World 2's kit. Facing right; every frame centred on its box.
import { ellipse, Grid, or, polygon, stroke } from '../raster.mjs';
import { OUTLINE, shaded } from '../enemies2/kit.mjs';

/** World 3's colours the bat is drawn in (GDD-ART-06): its rust fur and membranes, the rock deep shadow, the ochres and the mist white eye. */
export const W3 = { rust: '#B0562E', rockDeep: '#5A3B28', ochreLight: '#EDCB86', ochre: '#CC983F', mist: '#EEF1EA' };

/** 32 x 24 game px, centred on the box's middle both ways. */
export const FRAME = { w: 64, h: 48 };
/** The 16 x 10 game px hit box (tuning MURCIELAGO). */
export const BOX = { x0: 16, y0: 14, x1: 48, y1: 34 };
export const LOOKS = ['flap0', 'flap1', 'flap2', 'flap3', 'squash', 'hit'];

// Materials as [light, base, shadow], light from the upper left.
const FUR = [W3.ochre, W3.rust, W3.rockDeep];
const NEAR = [W3.rust, W3.rust, W3.rockDeep];
const FAR = [W3.rockDeep, W3.rockDeep, W3.rockDeep];

/** Mirrors a point about the body's middle column, for the far (left) wing. */
const mirror = (cx) => ([x, y]) => [2 * cx - x, y];

/**
 * A wing from the shoulder `s` to the hip `h`: the arm up to the wrist `w`, then three fingers from the wrist to the tips `tips` (the
 * outermost first). The membrane runs from the shoulder over the arm to the first tip and back along a scalloped trailing edge, each
 * scallop pulled in towards the wrist, to the hip. Returns the membrane's test and the bones as point pairs.
 */
function wingShape({ s, w, tips, h }) {
  const edge = [s, w, tips[0]];
  const ends = [...tips, h];
  for (let i = 1; i < ends.length; i++) {
    const [a, b] = [ends[i - 1], ends[i]];
    const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    edge.push([mid[0] + (w[0] - mid[0]) * 0.28, mid[1] + (w[1] - mid[1]) * 0.28], b);
  }
  return { membrane: polygon(edge), bones: [[s, w], ...tips.map((t) => [w, t])] };
}

/** Paints a wing: the membrane shaded, the bones 1 px lines of ochre light over it (the far wing's dark), and an outline ring if `ring`. */
function paintWing(g, wing, far) {
  const l = new Grid(g.width, g.height);
  shaded(l, wing.membrane, far ? FAR : NEAR);
  for (const [a, b] of wing.bones) l.fill((x, y) => wing.membrane(x, y) && stroke([a, b], 1)(x, y), far ? W3.rust : W3.ochreLight, true);
  for (let i = 0; i < l.cells.length; i++) if (l.cells[i]) g.cells[i] = l.cells[i];
}

/** Paints `test` on its own layer with `mat` and an outline ring round it on what it covers, so it stands off the wings under it. */
function layer(g, test, mat) {
  const l = new Grid(g.width, g.height);
  shaded(l, test, mat);
  for (let y = 0; y < g.height; y++) for (let x = 0; x < g.width; x++) {
    if (l.get(x, y)) continue;
    if (g.get(x, y) && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => l.get(x + dx, y + dy))) g.set(x, y, OUTLINE);
  }
  for (let i = 0; i < l.cells.length; i++) if (l.cells[i]) g.cells[i] = l.cells[i];
}

const KEY = { k: OUTLINE, w: W3.mist, L: W3.ochreLight, o: W3.ochre, r: W3.rust, d: W3.rockDeep };
/** Paints a pixel map (rows of KEY letters, '.' empty) with its top left at (ox, oy). */
function stamp(g, rows, ox, oy) {
  rows.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== '.') g.set(ox + x, oy + y, KEY[ch]); }));
}

/** The eye, 4 x 4: a round mist white eye with a big dark pupil looking forward and up, friendly; or knocked out, an X. */
const EYES = { round: ['.ww.', 'wwkk', 'wwkk', '.ww.'], x: ['k..k', '.kk.', '.kk.', 'k..k'] };

/** The wings of each flap frame, the near (right) one; the far one is its mirror. `dy` moves the body with the beat. */
const POSES = {
  // Wings up: the wrists high over the ears, the fingers fanned up and out, the membrane a tall V each side: the M's two peaks.
  up: { dy: 1, s: [37, 22], w: [47, 7], tips: [[59, 5], [58, 15], [51, 24]], h: [38, 31] },
  // Level on the down-stroke: wide open, the wrists a little up, the tips out level: the widest M.
  level: { dy: 0, s: [37, 21], w: [49, 14], tips: [[60, 20], [56, 29], [47, 33]], h: [38, 31] },
  // Wings down: the arms swept down beside the body, the tips under it.
  down: { dy: -1, s: [37, 21], w: [49, 26], tips: [[57, 37], [50, 41], [43, 38]], h: [37, 31] },
  // Level on the up-stroke: the wings half folded and cupped, the tips trailing low.
  cupped: { dy: 0, s: [37, 21], w: [48, 17], tips: [[58, 26], [53, 32], [45, 34]], h: [38, 31] },
};

/**
 * The bat, facing right, its body in the box's middle. `pose`: a POSES key, or `wings` given directly; `eye`: an EYES key; `squash`: the
 * body flattened (stomped).
 */
function drawBat({ pose = 'level', eye = 'round', squash = false, wings = null } = {}) {
  const g = new Grid(FRAME.w, FRAME.h);
  const p = wings ?? POSES[pose];
  const dy = p.dy ?? 0;
  const cx = 32;
  const shift = ([x, y]) => [x, y + dy];
  const near = wingShape({ s: shift(p.s), w: shift(p.w), tips: p.tips.map(shift), h: shift(p.h) });
  const m = mirror(cx);
  const far = wingShape({ s: m(shift(p.s)), w: m(shift(p.w)), tips: p.tips.map((t) => m(shift(t))), h: m(shift(p.h)) });
  paintWing(g, far, true);
  paintWing(g, near, false);

  // The body: a round furry torso filling the box's middle, its chest lit; the head on top with two tall ears and the long nose.
  const by = (squash ? 29 : 25) + dy;
  const torso = ellipse(cx, by, squash ? 10 : 8.6, squash ? 4.6 : 8.6);
  const hy = (squash ? 25 : 15.5) + dy;
  const head = ellipse(cx + 1, hy, 6.2, squash ? 4 : 5.2);
  const earL = polygon([[cx - 4.5, hy - 1], [cx - 4.6, hy - (squash ? 6 : 11)], [cx - 0.6, hy - 3]]);
  const earR = polygon([[cx + 1.4, hy - 3], [cx + 4.4, hy - (squash ? 6.5 : 11.5)], [cx + 5.6, hy - 1]]);
  const nose = polygon([[cx + 5, hy - 1.6], [cx + 12, hy + 0.4], [cx + 11.6, hy + 1.6], [cx + 5, hy + 2.6]]);
  layer(g, or(torso, head, earL, earR, nose), FUR);
  // The chest's light fur, and the ears' insides.
  g.fill((x, y) => torso(x, y) && ellipse(cx + 1, by - (squash ? 0.5 : 1), squash ? 5 : 3.4, squash ? 2 : 4.4)(x, y), W3.ochre, true);
  g.fill((x, y) => earL(x, y) && polygon([[cx - 3.6, hy - 2], [cx - 3.8, hy - (squash ? 4.5 : 9)], [cx - 1.8, hy - 3]])(x, y), W3.ochreLight, true);
  g.fill((x, y) => earR(x, y) && polygon([[cx + 2.4, hy - 3], [cx + 4.2, hy - (squash ? 5 : 9.5)], [cx + 4.6, hy - 2]])(x, y), W3.ochreLight, true);
  // The nose's tip, a little leaf, lit.
  g.set(cx + 11, Math.floor(hy), W3.ochre);
  stamp(g, EYES[eye], cx + 2, Math.floor(hy) - 2);
  g.outline(OUTLINE, 1);
  return g;
}

/** Stomped: flattened, its wings spread flat and wide, eyes shut tight. */
function drawSquash() {
  return drawBat({ squash: true, eye: 'x', wings: { dy: 0, s: [38, 28], w: [50, 25], tips: [[60, 29], [55, 33], [47, 35]], h: [40, 33] } });
}

/** Knocked: turned over onto its back, belly up, the X eye; the level frame flipped top to bottom about the frame's middle. */
function drawHit() {
  const up = drawBat({ pose: 'level', eye: 'x' });
  const g = new Grid(FRAME.w, FRAME.h);
  for (let y = 0; y < FRAME.h; y++) for (let x = 0; x < FRAME.w; x++) {
    const c = up.get(x, y);
    if (c) g.set(x, FRAME.h - 1 - y, c);
  }
  return g;
}

function drawLook(look) {
  switch (look) {
    // The beat: wings up, level, down, level again on the way back up.
    case 'flap0': return drawBat({ pose: 'up' });
    case 'flap1': return drawBat({ pose: 'level' });
    case 'flap2': return drawBat({ pose: 'down' });
    case 'flap3': return drawBat({ pose: 'cupped' });
    case 'squash': return drawSquash();
    case 'hit': return drawHit();
    default: throw new Error(`no look ${look}`);
  }
}

/** Every frame in LOOKS order: [{ look, grid }], each FRAME.w x FRAME.h drawing px. */
export function drawFrames() {
  return LOOKS.map((look) => ({ look, grid: drawLook(look) }));
}
