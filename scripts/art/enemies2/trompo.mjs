// The Trompo, World 2's heavy enemy (GDD-ENM-03): the wooden top of the market's toy stall, the one every Mexican kid winds with la
// piola and throws to play la troya. Turned wood, pear-shaped (widest in its upper third, tapering to the iron clavo), with lacquered
// rings, a turned botón on top and a painted face that goes round as it spins. While it spins three pale tacks stand on its crown, the
// not-stompable mark (GDD-CMB-01); toppled and stunned it shows none. Drawn in code (GDD-ART-01) in World 2's colours and the outline
// (GDD-ART-05, GDD-ART-06), in drawing pixels (2 x 2 art px), facing right.
import { Grid } from '../raster.mjs';
import { OUTLINE, W2, px } from './kit.mjs';

/** 20 x 20 game px. */
export const FRAME = { w: 40, h: 40 };
/** The 14 x 14 game px hit box (tuning TROMPO), the clavo's tip on the frame's bottom row while it spins. */
export const BOX = { x0: 6, y0: 12, x1: 34, y1: 40 };
export const LOOKS = ['spin0', 'spin1', 'spin2', 'spin3', 'stun', 'stunWobble', 'squash'];

// Materials as [light, base, shadow], light from the upper left.
const WOOD = [W2.midOchre, W2.tejaLit, W2.wood];
const ROSA = [W2.plaster, W2.rosa, W2.tejaDark];
const TEAL = [W2.skyTop, W2.teal, W2.cobalt];
const YELLOW = [W2.midOchre, W2.yellow, W2.tejaLit];
const COBALT = [W2.far, W2.cobalt, W2.iron];
const IRON = [W2.far, W2.iron, W2.iron];

/**
 * The top's turned profile, crown to tip: [row, width, material], each row centred on the frame's middle (x 20). The botón, the crown's
 * dome, a cobalt ring, the rosa band that carries the face, a yellow ring, the teal band on the taper, the wood cone and the iron clavo.
 */
// prettier-ignore
const PROFILE = [
  [12, 6, YELLOW], [13, 8, YELLOW],
  [14, 12, WOOD], [15, 18, WOOD], [16, 22, WOOD],
  [17, 24, COBALT],
  [18, 26, ROSA], [19, 26, ROSA], [20, 26, ROSA], [21, 26, ROSA], [22, 26, ROSA], [23, 26, ROSA], [24, 26, ROSA], [25, 24, ROSA],
  [26, 22, YELLOW],
  [27, 20, TEAL], [28, 18, TEAL],
  [29, 16, WOOD], [30, 14, WOOD], [31, 12, WOOD], [32, 10, WOOD], [33, 8, WOOD],
  [34, 6, IRON], [35, 4, IRON], [36, 4, IRON], [37, 2, IRON], [38, 2, IRON],
];
const CX = 20;

/** The not-stompable mark (GDD-CMB-01): a pale tack, 4 x 6 drawing px (2 x 3 game px), its shade on the right. */
// prettier-ignore
const TACK = ['.GG.', '.GG.', '.GGs', 'GGGs', 'GGGs', 'GGss'];

/**
 * A spinning frame. `face` is the face's place round the band in degrees (0 the front, +90 the right edge), `lean` moves the upper
 * body 1 px sideways (the precession), `dust` puffs at the clavo.
 */
function drawSpin({ face, lean, dust }) {
  const g = new Grid(FRAME.w, FRAME.h);
  const rows = new Map(PROFILE.map(([y, w, m]) => [y, { w, m, c: CX + (y <= 26 ? lean : 0) }]));
  const inside = (x, y) => {
    const r = rows.get(y);
    return !!r && x >= r.c - r.w / 2 && x < r.c + r.w / 2;
  };
  for (const [y, { w, m, c }] of rows) {
    for (let x = c - w / 2; x < c + w / 2; x++) {
      const s = (x + 0.5 - c) / (w / 2);
      let tone = 1;
      if (s > (y >= 26 ? 0.4 : 0.66) || !inside(x, y + 1)) tone = 2;
      else if (s < -0.7 || (!inside(x, y - 1) && s < 0.4)) tone = 0;
      g.set(x, y, m[tone]);
    }
  }
  /** Where a mark painted round the band at `deg` (relative to the face) lands on row y, and whether it faces us. */
  const at = (deg, y) => {
    const a = ((face + deg) * Math.PI) / 180;
    const r = rows.get(y);
    return { x: Math.floor(r.c + Math.sin(a) * (r.w / 2 - 1)), seen: Math.cos(a) > 0.2, edge: Math.cos(a) };
  };
  // The grain of the turned wood on the cone: three light streaks round it that slide as it turns.
  for (const deg of [50, 170, 290]) {
    for (const y of [29, 30, 31]) {
      const p = at(deg, y);
      if (p.seen && g.get(p.x, y) === W2.tejaLit) g.set(p.x, y, W2.wood);
    }
  }
  // The lacquer's gloss, where the light from the upper left catches the rosa band and the teal one.
  const left = (y) => rows.get(y).c - rows.get(y).w / 2;
  px(g, [[left(19) + 2, 19], [left(19) + 3, 19], [left(20) + 2, 20]], W2.plasterLit);
  px(g, [[left(27) + 2, 27], [left(27) + 3, 27]], W2.skyPale);
  // The clavo's steel: a lit streak down its left side, so the nail reads as metal.
  px(g, [[CX - 3, 34], [CX - 1, 34], [CX - 1, 35], [CX - 2, 36], [CX - 1, 36], [CX - 1, 37]], W2.far);
  px(g, [[CX - 2, 34], [CX - 2, 35]], W2.farLit);
  // The painted face (two big eyes, stern brows) or, on the back, a yellow star; placed by hand per frame (FACES).
  const f = FACES[face];
  for (const [rowsMap, ox, oy] of f) stamp(g, rowsMap, ox + lean, oy);
  // The three tacks on the crown (GDD-CMB-01): the middle one on the botón.
  for (const [x, y] of [[11, 9], [18, 6], [25, 9]]) stamp(g, TACK, x + lean, y);
  if (dust) for (const [rowsMap, ox, oy] of dust) stamp(g, rowsMap, ox, oy);
  g.outline(OUTLINE, 1);
  return g;
}

const KEY = {
  G: W2.glaze, s: W2.farLit, W: W2.glaze, w: W2.farLit, K: W2.iron, Y: W2.yellow, y: W2.midOchre, d: W2.farLit, D: W2.far, R: W2.rosa, P: W2.plaster,
  T: W2.tejaDark, X: OUTLINE,
};
function stamp(g, rows, ox, oy) {
  rows.forEach((row, j) => [...row].forEach((ch, i) => { if (ch !== '.') g.set(ox + i, oy + j, KEY[ch]); }));
}

// The eyes, painted big: pale whites (farLit, so glaze stays the tacks' alone) round a 2 px pupil looking ahead, under a thick stern
// brow slanting down toward the middle; foreshortened near the band's edges.
// prettier-ignore
const EYE_L = ['KKK..', '.KKKK', '.www.', 'wwKKw', 'wwKKw', 'wwKKw', 'wwwww', '.www.'];
// prettier-ignore
const EYE_R = ['..KKK', 'KKKK.', '.www.', 'wwKKw', 'wwKKw', 'wwKKw', 'wwwww', '.www.'];
// prettier-ignore
const EYE_L4 = ['KK..', '.KKK', '.ww.', 'wKKw', 'wKKw', 'wKKw', 'wwww', '.ww.'];
// prettier-ignore
const EYE_R4 = ['..KK', 'KKK.', '.ww.', 'wKKw', 'wKKw', 'wKKw', 'wwww', '.ww.'];
// prettier-ignore
const EYE_L2 = ['.K', 'KK', 'ww', 'KK', 'KK', 'KK', 'ww', '.w'];
// prettier-ignore
const EYE_R2 = ['KK', 'K.', 'ww', 'KK', 'KK', 'KK', 'ww', 'w.'];
// prettier-ignore
const STAR = ['..Y..', '.YYY.', 'YYYYY', '.YYY.', '.Y.Y.'];

/** Per face angle: the pieces [rows, x, y]. */
const FACES = {
  20: [[EYE_L, 16, 18], [EYE_R, 23, 18]],
  70: [[EYE_L4, 25, 18], [EYE_R2, 30, 18]],
  200: [[STAR, 20, 20]],
  290: [[EYE_L2, 8, 18], [EYE_R4, 11, 18]],
};

// Dust kicked up behind the clavo as it spins, big then fading, on alternate frames.
// prettier-ignore
const PUFF_BIG = [[['.dd..', 'ddDd.', 'dDDDd'], 13, 36]];
// prettier-ignore
const PUFF_SMALL = [[['.d.', 'dDd'], 14, 37], [['d'], 24, 38]];

const SPIN = [
  { face: 20, lean: 0, dust: PUFF_BIG },
  { face: 70, lean: 1, dust: null },
  { face: 200, lean: 0, dust: PUFF_SMALL },
  { face: 290, lean: -1, dust: null },
];

/**
 * Lying stunned on its side (GDD-CMB-02): the profile turned so the crown lies toward the back and the clavo toward the front, a little
 * tilted, the rings now upright. `roll` turns it 1 px about its axis (the face slides up) and lifts its tip, `flat` squashes it.
 */
function drawLying({ roll = 0, squash = false } = {}) {
  const g = new Grid(FRAME.w, FRAME.h);
  const k = squash ? 0.5 : 0.72; // the radius's scale: the side view is shortened, and stomped it is flattened
  const x0 = squash ? 5 : 6; // the crown's end
  const len = squash ? 1.04 : 1;
  const body = PROFILE.filter(([y]) => y >= 12);
  const bottom = 38;
  const half = Math.max(...body.map(([, w]) => w)) * k / 2;
  const axis = bottom + 1 - half; // the widest part rests on the ground
  // Column by column from the crown: the profile row it shows, the axis tilting down toward the tip.
  const cols = [];
  for (let i = 0; ; i++) {
    const t = i / len;
    const p = body[Math.floor(t)];
    if (!p) break;
    const x = x0 + i;
    const tilt = squash ? 0 : Math.max(0, (x - 18) * (0.16 - roll * 0.06));
    cols.push({ x, w: p[1] * k, m: p[2], c: axis + tilt, row: p[0] });
  }
  const colAt = new Map(cols.map((c) => [c.x, c]));
  const inside = (x, y) => {
    const c = colAt.get(x);
    return !!c && y >= c.c - c.w / 2 && y + 1 <= c.c + c.w / 2 + 0.5 && y <= bottom;
  };
  for (const { x, w, m, c } of cols) {
    for (let y = Math.ceil(c - w / 2 - 0.5); y <= bottom; y++) {
      if (!inside(x, y)) continue;
      const s = (y + 0.5 - c) / (w / 2);
      let tone = 1;
      if (s > 0.45 || !inside(x + 1, y)) tone = 2;
      else if (s < -0.55 || !inside(x - 1, y)) tone = 0;
      g.set(x, y, m[tone]);
    }
  }
  // The band's columns, to place the face on.
  const band = cols.filter((c) => c.row >= 18 && c.row <= 24);
  const bx = band[0].x, bw = band.length;
  const mid = Math.round(band[Math.floor(bw / 2)].c) - roll;
  if (squash) {
    // Stomped: X eyes, stacked as the face lies, and a crack split into the crown.
    stamp(g, X_EYE, bx + 1, mid - 6);
    stamp(g, X_EYE, bx + 1, mid + 1);
    px(g, [[x0 + 3, mid - 2], [x0 + 3, mid - 1], [x0 + 4, mid], [x0 + 4, mid + 1]], OUTLINE);
  } else {
    // Dizzy: the eyes, stacked as the face lies, turned into spirals.
    stamp(g, SPIRAL, bx, mid - 7);
    stamp(g, SPIRAL, bx, mid + 1);
  }
  g.outline(OUTLINE, 1);
  return g;
}

// prettier-ignore
const X_EYE = ['XX..XX', '.XXXX.', '..XX..', '.XXXX.', 'XX..XX'];
// prettier-ignore
const SPIRAL = ['.wwwww.', 'wwKKKww', 'wKwwwKw', 'wKwKwKw', 'wKwwKKw', 'wwKwwww', '.wwwww.'];

export function drawFrames() {
  return [
    ...SPIN.map((pose, i) => ({ look: `spin${i}`, grid: drawSpin(pose) })),
    { look: 'stun', grid: drawLying() },
    { look: 'stunWobble', grid: drawLying({ roll: 1 }) },
    { look: 'squash', grid: drawLying({ squash: true }) },
  ];
}
