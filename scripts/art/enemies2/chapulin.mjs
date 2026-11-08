// The Chapulín, World 2's grasshopper (GDD-ENM-03): the chapulín of Chapultepec, "hill of the grasshopper", whose glyph in the Codex
// Mendoza is a green grasshopper with a red mouth. Wingless (a little wing pad on its back), so it can only hop: a short blunt head with a
// big round eye and a rosa mouth, the saddle of the pronotum, a fat segmented abdomen tapering to a rounded tip with a yellow-striped belly,
// and the big hind legs, a fat green drumstick thigh up to a dark knee high over the back and the rosa shin folded back down from it.
// Drawn in code (GDD-ART-01) in World 2's colours, its darkened leaf and the outline (GDD-ART-05, GDD-ART-06). Facing right, in drawing
// pixels (2 x 2 art px): hand-placed pixel maps for the body, the small legs, the face and the knocked and stomped bodies; the long legs
// painted row by row as clean 2 to 6 px spans between hand-placed joints.
import { Grid } from '../raster.mjs';
import { flashed, OUTLINE, W2 } from './kit.mjs';

/** 20 x 16 game px. */
export const FRAME = { w: 40, h: 32 };
/** The 12 x 10 game px hit box (tuning CHAPULIN), feet on the frame's bottom row. */
export const BOX = { x0: 8, y0: 12, x1: 32, y1: 32 };
export const LOOKS = ['crouch0', 'crouch1', 'tele', 'teleRed', 'rise', 'fall', 'boing', 'squash', 'hit'];

/** The maps' letters: G green (light), L leaf (the body, its dominant colour), I iron (shadow), Y yellow (the belly's segments),
 * R rosa (shins, mouth), P plasterShade (the rosa's shadow), W glaze (eye, spines), k the outline (X eyes). */
const KEY = { G: W2.green, L: W2.leaf, I: W2.iron, Y: W2.yellow, R: W2.rosa, P: W2.plasterShade, W: W2.glaze, k: OUTLINE };

/** Paints a map with its top left at (ox, oy); `dy(x)` moves column x down (a shear), `map` renames letters. */
function stamp(g, rows, ox, oy, { dy = () => 0, map = {} } = {}) {
  rows.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch !== '.') g.set(ox + x, oy + y + dy(ox + x), KEY[map[ch] ?? ch]);
  }));
}

/**
 * The crouched body, facing right, top left at (6, 15): the abdomen tapering to its rounded tip with the yellow segments under it, the
 * saddle of the pronotum between two dark seams, the green wing pad on it, and the big blunt head. 26 x 13, about 1.8 long to tall.
 */
// prettier-ignore
const BODY = [
  '...................GGGGG..',
  '.................GGGLLLLI.',
  '................GGLLLLLLLI',
  '...........GGGGIGLLLLLLLLI',
  '....GGGGGGIGGGLIGLLLLLLLLI',
  '..GGLLILLLIGLLLIGLLLLLLLLI',
  '.GLLLLILLLIGLLLIGLLLLLLLLI',
  'GLLLLLLLLLIGLLLIGLLLLLLLLI',
  'GLLLLLLLLLIGLLLIILLLLLLLII',
  'ILLLLLLLLLILLLLLIILLLLLLI.',
  '.IIYYIYYIYYILLLLLIIILLLII.',
  '...IYYIYYIYIILLLIIIIIIII..',
  '.....IIIIIIIIIII..........',
];
const BODY_AT = [6, 15];

/** The eyes, 6 x 7, top left at the eye's place ('.' leaves the head; W glaze, I iron, k the outline). */
// prettier-ignore
const EYES = {
  open: ['.WWWW.', 'WWWWWW', 'WWWIII', 'WWWIWI', 'WWWIII', 'WWWIII', '.WWWW.'],
  wide: ['.WWWW.', 'WWWWWW', 'WWWWWW', 'WWWIIW', 'WWWIIW', 'WWWWWW', '.WWWW.'],
  narrow: ['II....', '.IIII.', '...III', 'WWWIWI', 'WWWIII', 'WWWIII', '.WWWW.'],
  x: ['.WWWW.', 'WkWWkW', 'WWkkWW', 'WWkkWW', 'WkWWkW', '.WWWW.'],
};
/** The mouth parts, rosa (the glyph's red mouth): shut, mid-chew, and open in surprise. */
// prettier-ignore
const MOUTHS = { shut: ['.RR', 'RRR', 'PR.'], chew: ['.RR', 'RIR', 'RRP'], gasp: ['.RR', 'RIR', 'RIR', '.RP'] };
/** Where the face goes on the crouched body: the eye's and the mouth's top left, the antenna's root. */
const FACE = { eye: [25, 16], mouth: [29, 24], antenna: [27, 15] };

/** A front or middle leg, 2 px wide, its top left at the hip: lit edge leaf, shadow iron, the foot on the bottom row. */
// prettier-ignore
const SMALL_LEGS = {
  front: ['LI..', 'LI..', '.LI.', '.LLI'],
  mid: ['.LI', '.LI', 'LI.', 'LLI'],
  frontLow: ['LI..', '.LI.', '.LLI'],
  midLow: ['.LI', 'LI.', 'LLI'],
  frontReach: ['LLI...', '.LLLI.', '...LLI', '....LI'],
  frontTuck: ['LI', 'LLI', '.LI'],
  midTuck: ['LI', 'LI'],
  midTrail: ['LI..', '.LI.', '..LI'],
  frontUp: ['..LI', '.LI.', 'LI..'],
};

/**
 * A long leg segment from a to b (frame px, pixel centres), painted as one clean span per row (steep) or per column (flat), `wa` px wide
 * at a and `wb` at b, swelling by `bulge` a third of the way. The span's lit side (up, or upper left) takes `lit`, its far side `dark`,
 * the rest `base`; `stripe` paints a 1 px line one in from the dark side (the thigh's herringbone).
 */
function limb(g, [ax, ay], [bx, by], wa, wb, [lit, base, dark], { bulge = 0, stripe = null, litWidth = 1 } = {}) {
  const steep = Math.abs(by - ay) >= Math.abs(bx - ax);
  const [a0, a1, b0, b1] = steep ? [ay, ax, by, bx] : [ax, ay, bx, by];
  const lo = Math.round(Math.min(a0, b0)), hi = Math.round(Math.max(a0, b0));
  // Steep: the lit side is the one facing up (right when the leg leans right going down, else left). Flat: the top.
  const litLow = steep ? !((bx - ax) * (by - ay) > 0) : true;
  for (let u = lo; u <= hi; u++) {
    const t = Math.max(0, Math.min(1, (u - a0) / (b0 - a0 || 1)));
    const c = a1 + (b1 - a1) * t;
    const w = Math.max(1, Math.round(wa + (wb - wa) * t + bulge * Math.sin(Math.PI * Math.min(1, t * 1.5))));
    const v0 = Math.round(c - w / 2);
    for (let i = 0; i < w; i++) {
      const fromLit = litLow ? i : w - 1 - i;
      let col = base;
      if (w > 1 && fromLit === w - 1) col = dark;
      else if (fromLit < litWidth) col = lit;
      else if (stripe && w >= 4 && fromLit === w - 2) col = stripe;
      if (steep) g.set(v0 + i, u, col);
      else g.set(u, v0 + i, col);
    }
  }
}

const THIGH = [W2.green, W2.leaf, W2.iron];
const FAR_THIGH = [W2.leaf, W2.iron, W2.iron];
const SHIN = [W2.rosa, W2.rosa, W2.plasterShade];

/**
 * A hind leg, hip to knee to ankle to toe: the fat drumstick thigh with its light top band and dark stripe, the dark knee, the rosa shin
 * 2 px wide with glaze spines along its back, the rosa foot. `far` draws it darker, for the far side.
 */
function hindLeg(g, [hip, knee, ankle, toe], { far = false, thick = 1, seam = false } = {}) {
  limb(g, knee, ankle, 2, 2, far ? [W2.plasterShade, W2.plasterShade, W2.iron] : SHIN);
  if (!far) {
    // Three spines down the shin's back edge, each a glaze pixel in the shadow side.
    const n = Math.max(Math.abs(ankle[1] - knee[1]), Math.abs(ankle[0] - knee[0]));
    for (let i = 4; i < n - 1; i += 4) {
      const t = i / n, x = Math.round(knee[0] + (ankle[0] - knee[0]) * t), y = Math.round(knee[1] + (ankle[1] - knee[1]) * t);
      for (const [dx, dy] of [[0, 0], [-1, 0], [1, 0], [0, 1], [0, -1]]) if (g.get(x + dx, y + dy) === W2.plasterShade) { g.set(x + dx, y + dy, W2.glaze); break; }
    }
  }
  limb(g, ankle, toe, 1, 1, far ? [W2.plasterShade, W2.plasterShade, W2.plasterShade] : [W2.rosa, W2.rosa, W2.rosa]);
  // The thigh on its own layer; with `seam`, the body it lies over gets a dark rim along its edge, so the two stay apart.
  const thigh = new Grid(g.width, g.height);
  limb(thigh, hip, knee, 4 * thick, 2, far ? FAR_THIGH : THIGH, { bulge: 1.6 * thick, stripe: far ? null : W2.iron, litWidth: far ? 1 : 2 });
  if (seam) {
    for (let y = 0; y < g.height; y++) for (let x = 0; x < g.width; x++) {
      if (!thigh.get(x, y) || ![[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => !thigh.get(x + dx, y + dy) && g.get(x + dx, y + dy))) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!thigh.get(x + dx, y + dy) && g.get(x + dx, y + dy) && g.get(x + dx, y + dy) !== W2.rosa) g.set(x + dx, y + dy, W2.iron);
    }
  }
  thigh.cells.forEach((c, i) => { if (c) g.cells[i] = c; });
  // The dark knee, 2 x 2.
  const [kx, ky] = knee.map(Math.round);
  for (const [dx, dy] of [[-1, -1], [0, -1], [-1, 0], [0, 0]]) g.set(kx + dx, ky + dy, W2.iron);
}

/** Recolours every lone body pixel (leaf, green, iron or yellow with no neighbour of its colour) to its neighbours' commonest colour, so
 * the body is clusters only; the deliberate single pixels (the shins' spines, the eye's shine, the mouth's shadow) are other colours. */
function tidy(g) {
  const fix = [];
  for (let y = 0; y < g.height; y++) for (let x = 0; x < g.width; x++) {
    const c = g.get(x, y);
    if (![W2.leaf, W2.green, W2.iron, W2.yellow].includes(c)) continue;
    const n = [];
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if (i || j) n.push(g.get(x + i, y + j));
    if (n.includes(c)) continue;
    const count = new Map();
    for (const v of n) if (v) count.set(v, (count.get(v) ?? 0) + 1);
    const best = [...count].sort((p, q) => q[1] - p[1])[0];
    if (best) fix.push([x, y, best[0]]);
  }
  for (const [x, y, c] of fix) g.set(x, y, c);
}

/** A thin antenna: 1 px iron through its points. */
function antenna(g, pts) {
  for (let s = 1; s < pts.length; s++) {
    const [[ax, ay], [bx, by]] = [pts[s - 1], pts[s]];
    const n = Math.max(Math.abs(bx - ax), Math.abs(by - ay), 1);
    for (let i = 0; i <= n; i++) g.set(Math.round(ax + ((bx - ax) * i) / n), Math.round(ay + ((by - ay) * i) / n), W2.iron);
  }
}

/**
 * One chapulín on its feet or in the air. `at` moves the body, `tilt` shears it nose up (< 0) or down (> 0) by that many px per 10
 * columns about its middle; legs are frame px: `hind` and `farHind` [hip, knee, ankle, toe], `front` and `mid` [map, x, y];
 * `ant` the antenna's points after its root; `eye`, `mouth` keys.
 */
function drawBug({ at = [0, 0], tilt = 0, seam = false, hind, farHind = null, front, mid, farFront = null, ant, eye = 'open', mouth = 'shut' }) {
  const g = new Grid(FRAME.w, FRAME.h);
  const dy = (x) => Math.round(((x - 19) * tilt) / 10);
  const P = ([x, y]) => [x + at[0], y + at[1] + dy(x + at[0])];
  if (farHind) hindLeg(g, farHind, { far: true });
  if (farFront) stamp(g, SMALL_LEGS[farFront[0]], farFront[1], farFront[2], { map: { L: 'I' } });
  stamp(g, BODY, BODY_AT[0] + at[0], BODY_AT[1] + at[1], { dy });
  stamp(g, SMALL_LEGS[mid[0]], mid[1], mid[2]);
  stamp(g, SMALL_LEGS[front[0]], front[1], front[2]);
  hindLeg(g, hind, { seam });
  tidy(g);
  antenna(g, [P(FACE.antenna), ...ant]);
  const [ex, ey] = P(FACE.eye);
  stamp(g, EYES[eye], ex, ey);
  const [mx, my] = P(FACE.mouth);
  stamp(g, MOUTHS[mouth], mx, my);
  g.outline(OUTLINE, 1);
  return g;
}

// The crouch: hip at the pronotum's rear bottom, knee high over the back, the shin folded back down to a foot behind the abdomen's tip.
const CROUCH = {
  hind: [[18, 25], [11, 9], [5, 29], [2, 30]],
  front: ['front', 26, 27],
  mid: ['mid', 19, 27],
};

/** Stomped (GDD-ENM-02): the body flattened to half height, X eye, the thigh flat along its back, the legs splayed. */
// prettier-ignore
const SQUASH_BODY = [
  '...........GGGGIGGGGGGGI..',
  '..GGGGGGGGIGLLLIGLLLLLLLI.',
  'GGLLLLLLLLIGLLLIGLLLLLLLLI',
  'ILLLLLLLLLILLLLLIILLLLLLLI',
  '.IIYYIYYIYYILLLLLIIIIIIII.',
  '...IIIIIIIIIIIII..........',
];
function drawSquash() {
  const g = new Grid(FRAME.w, FRAME.h);
  stamp(g, SQUASH_BODY, 6, 25);
  stamp(g, ['LI...', '.LLLI'], 26, 29);
  stamp(g, ['..LI', 'LLI.'], 17, 29);
  // The thigh lies flat along the back, the shin flat behind it on the ground.
  limb(g, [21, 24], [9, 23], 3, 2, THIGH, { bulge: 1, litWidth: 2 });
  limb(g, [7, 25], [3, 29], 2, 2, SHIN);
  limb(g, [3, 30], [2, 30], 1, 1, [W2.rosa, W2.rosa, W2.rosa]);
  for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) g.set(7 + dx, 23 + dy, W2.iron);
  tidy(g);
  stamp(g, ['.WWWW.', 'WkWWkW', 'WWkkWW', 'WkWWkW', '.WWWW.'], 24, 24);
  stamp(g, ['RRR', 'PR.'], 29, 28);
  antenna(g, [[27, 25], [30, 23], [33, 23]]);
  g.outline(OUTLINE, 1);
  return g;
}

/**
 * Knocked (GDD-ENM-02): on its back, yellow belly up, legs up: the body map turned upside down with its light and shadow swapped so the
 * light stays on the upper left, X eye.
 */
function drawHit() {
  const g = new Grid(FRAME.w, FRAME.h);
  const top = 30 - BODY.length + 1;
  stamp(g, [...BODY].reverse(), BODY_AT[0], top, { map: { G: 'I', I: 'G' } });
  stamp(g, SMALL_LEGS.frontUp, 26, 15);
  stamp(g, SMALL_LEGS.frontUp, 22, 15);
  hindLeg(g, [[18, 19], [13, 8], [18, 13], [20, 13]]);
  tidy(g);
  stamp(g, EYES.x, 25, top + 6);
  stamp(g, ['PR.', 'RRR', '.RR'], 29, top + 1);
  antenna(g, [[28, 30], [31, 30], [33, 29]]);
  g.outline(OUTLINE, 1);
  return g;
}

function drawLook(look) {
  switch (look) {
    case 'crouch0': return drawBug({ ...CROUCH, ant: [[29, 12], [32, 10]] });
    case 'crouch1': return drawBug({ ...CROUCH, ant: [[30, 13], [33, 12]], mouth: 'chew' });
    // The wind-up: the body 2 px lower, the knee higher, the shin tucked tight, the eye narrowed.
    case 'tele': return drawBug({
      at: [0, 2], hind: [[18, 27], [12, 8], [8, 29], [5, 30]], front: ['frontLow', 26, 28], mid: ['midLow', 19, 28],
      ant: [[29, 14], [32, 13]], eye: 'narrow',
    });
    case 'teleRed': return flashed(drawLook('tele'));
    // Going up: nose up, the hind legs flung straight back in one long line, the small legs tucked, antennae swept back.
    case 'rise': return drawBug({
      at: [1, -3], tilt: -2.5, seam: true, farHind: [[18, 24], [10, 26], [4, 27], [3, 27]], hind: [[19, 25], [11, 28], [4, 30], [2, 30]],
      front: ['frontTuck', 27, 21], mid: ['midTuck', 21, 24], ant: [[26, 7], [23, 6]],
    });
    // Coming down: nose down, the front legs out for the landing, the hind legs folding up behind.
    case 'fall': return drawBug({
      at: [-1, -1], tilt: 2.5, hind: [[17, 23], [10, 12], [6, 22], [4, 23]],
      front: ['frontReach', 27, 27], mid: ['midTrail', 20, 26], ant: [[31, 16], [34, 17]], eye: 'wide',
    });
    // Thrown up by an awning: every leg splayed, the eye wide, the mouth open.
    case 'boing': return drawBug({
      at: [0, -1], farHind: [[18, 23], [14, 10], [8, 7], [6, 6]], hind: [[18, 24], [10, 18], [4, 27], [2, 28]],
      front: ['frontReach', 27, 26], mid: ['midTrail', 18, 26], ant: [[28, 10], [28, 7]], eye: 'wide', mouth: 'gasp',
    });
    case 'squash': return drawSquash();
    case 'hit': return drawHit();
    default: throw new Error(`no look ${look}`);
  }
}

/** Every frame in LOOKS order: [{ look, grid }], each FRAME.w x FRAME.h drawing px. */
export function drawFrames() {
  return LOOKS.map((look) => ({ look, grid: drawLook(look) }));
}
