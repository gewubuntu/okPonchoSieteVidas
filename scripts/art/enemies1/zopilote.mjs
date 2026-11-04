// The Zopilote, World 1's flier (GDD-ENM-02): a black vulture of Don Zopilote's court, drawn in code (GDD-ART-01) with the same wing
// language as its king (scripts/art/boss.mjs): coverts, flight feathers and five spread finger feathers, here with the black vulture's
// pale hand patches. One cholla joint with three pale spines on its back says it cannot be stomped (GDD-CMB-01). Facing right, in
// drawing pixels (2 x 2 art px), World 1's colours and the outline only (GDD-ART-05, GDD-ART-06).
import { ellipse, Grid, or, polygon, stroke } from '../raster.mjs';
import { flashed, OUTLINE, paste, shaded, shifted, W1 } from './kit.mjs';

/** 32 x 24 game px, centred on the box's middle both ways. */
export const FRAME = { w: 64, h: 48 };
/** The 16 x 10 game px hit box (tuning ZOPILOTE). */
export const BOX = { x0: 16, y0: 14, x1: 48, y1: 34 };
export const LOOKS = ['flap0', 'flap1', 'flap2', 'flap3', 'tele', 'teleRed', 'diveSteep', 'diveShallow', 'climb0', 'climb1', 'hit'];

// Materials as [light, base, shadow], light from the upper left. Nothing in World 1 is darker than navy but the outline, so the black
// plumage is navy lit with blue, and the near wing is a step lighter (blue lit with purple) to stand off the body.
const PLUME = [W1.blue, W1.navy, W1.navy];
const NEAR_WING = [W1.purple, W1.blue, W1.navy];
const FAR = [W1.navy, W1.navy, W1.navy];
const PALE = [W1.sunDisc, W1.cloudTop, W1.cloudUnder];
const FAR_PALE = [W1.purple, W1.purple, W1.purple]; // the far wing's pale patch, in its shadow

const rad = (d) => (d * Math.PI) / 180;

/** A pose's frame of reference: bird space (turned upside down first when `flip`) turned by `rot` degrees (clockwise, nose down) about `pivot`. */
function space(rot, [cx, cy], flip = false) {
  const a = rad(rot), c = Math.cos(a), s = Math.sin(a);
  return {
    /** A shape in bird space as a test in frame space. */
    T: (test) => (x, y) => {
      const dx = x - cx, dy = y - cy;
      const by = cy - dx * s + dy * c;
      return test(cx + dx * c + dy * s, flip ? 2 * cy - by : by);
    },
    /** A bird-space point in frame space, rounded to the pixel it lands on. */
    P: ([x, y]) => {
      const dx = x - cx, dy = (flip ? 2 * cy - y : y) - cy;
      return [Math.floor(cx + dx * c - dy * s), Math.floor(cy + dx * s + dy * c)];
    },
  };
}

/** A clean 2 px pixel-art line from a to b (whole pixels): `light` on its upper left pixel, `dark` on the other. */
function line2(g, [x0, y0], [x1, y1], light, dark) {
  const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  const steep = dy > dx;
  let err = dx - dy, x = x0, y = y0;
  for (;;) {
    g.set(x, y, light);
    if (steep) g.set(x + 1, y, dark);
    else g.set(x, y + 1, dark);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x += sx; }
    if (e2 < dx) { err += dx; y += sy; }
  }
}

/**
 * One wing in bird space: `a` degrees from straight back (+ up, - down), `len` from the shoulder to the longest finger's tip, `spread`
 * the fan between fingers (degrees), `curl` how far the finger tips bend (+ towards the leading edge), `chord` the wing's depth.
 * Returns the coverts (arm), the flight feathers, the five primaries (fingers, as point paths) and the pale wedge at their base.
 */
function wing([sx, sy], { a, len, spread = 13, curl = 0, chord = 1 }) {
  const r = rad(a);
  const d = [-Math.cos(r), -Math.sin(r)];
  const t = a >= 0 ? [d[1], -d[0]] : [-d[1], d[0]]; // towards the trailing edge: backwards for a raised or a lowered wing
  const L = (u, v) => [sx + u * d[0] + v * t[0] * chord, sy + u * d[1] + v * t[1] * chord];
  const h = len * 0.42;
  const arm = polygon([L(-1, -2.4), L(h, -2.4), L(h, 2), L(-1, 3)]);
  const flight = polygon([L(-1, 2.4), L(h, 1.6), L(h + 0.6, 6.4), L(h * 0.75, 7.6), L(h * 0.55, 6.8), L(h * 0.35, 7.8), L(h * 0.15, 7), L(-1, 7.6)]);
  const lens = [1, 0.97, 0.9, 0.8, 0.68];
  const reach = len - h - 0.5;
  const fingers = lens.map((k, i) => {
    const base = [h + 0.5, -1.4 + i * 1.8];
    const f = rad(i * spread), g = f - rad(curl);
    const l = reach * k;
    const mid = [base[0] + Math.cos(f) * l * 0.55, base[1] + Math.sin(f) * l * 0.55];
    const tip = [mid[0] + Math.cos(g) * l * 0.45, mid[1] + Math.sin(g) * l * 0.45];
    /** The point a fraction q of the way from the finger's base to its tip. */
    const along = (q) => {
      const [p0, p1, k0] = q <= 0.55 ? [base, mid, q / 0.55] : [mid, tip, (q - 0.55) / 0.45];
      return L(p0[0] + (p1[0] - p0[0]) * k0, p0[1] + (p1[1] - p0[1]) * k0);
    };
    return { along, mid: L(...mid), tip: L(...tip) };
  });
  // The black vulture's field mark: a pale wedge on the base of the five primaries, fanning out with them.
  const patch = polygon([L(h, -1.4), ...fingers.map((f) => f.along(0.32)), L(h, 5.8)]);
  const scallops = [0.25, 0.5, 0.75].map((q) => [L(h * q, -1.3), L(h * q, -0.3)]);
  const seam = stroke([L(0, 1.9), L(h, 1.7)], 1); // where the coverts overlap the flight feathers
  const paleZone = (x, y) => Math.hypot(x - sx, y - sy) < h + reach * 0.5; // the pale fan ends in an arc round the shoulder
  return { arm, flight, fingers, patch, scallops, seam, paleZone };
}

/** Paints a wing: navy flight feathers, coverts a step lighter with three scallops, five fingers pale at the base and dark at the tip. */
function paintWing(g, T, P, w, far) {
  // The fingers on their own layer: dark, then pale inside an arc round the shoulder, so every finger's base is pale, every tip dark
  // and the pale fan is one clean cluster that follows the fingers. They go on last, over the wing's edge.
  const fingers = new Grid(g.width, g.height);
  for (const f of w.fingers) {
    const [b, m, t] = [f.along(0), f.mid, f.tip].map(P);
    line2(fingers, b, m, far ? W1.navy : W1.blue, W1.navy);
    line2(fingers, m, t, far ? W1.navy : W1.blue, W1.navy);
  }
  fingers.recolour(W1.blue, far ? W1.purple : W1.cloudTop, T(w.paleZone));
  fingers.recolour(W1.navy, far ? W1.purple : W1.cloudUnder, T(w.paleZone));
  // One light rim round the whole wing, then a seam and three scallops in navy inside it.
  shaded(g, T(or(w.arm, w.flight)), far ? FAR : NEAR_WING);
  if (!far) {
    g.recolour(W1.blue, W1.navy, T(w.seam));
    for (const pts of w.scallops) for (const [x, y] of pts.map(P)) if (g.get(x, y) === W1.blue) g.set(x, y, W1.navy);
  }
  shaded(g, T(w.patch), far ? FAR_PALE : PALE);
  paste(g, fingers, 0, 0);
}

/** Recolours every painted pixel that matches none of its eight neighbours to its neighbours' commonest colour: no stray pixels. */
function tidy(g) {
  const fix = [];
  for (let y = 0; y < g.height; y++) for (let x = 0; x < g.width; x++) {
    const c = g.get(x, y);
    if (!c) continue;
    const n = [];
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if (i || j) n.push(g.get(x + i, y + j));
    const painted = n.filter(Boolean);
    if (painted.length < 5 || painted.includes(c)) continue;
    const count = new Map();
    for (const v of painted) count.set(v, (count.get(v) ?? 0) + 1);
    fix.push([x, y, [...count].sort((p, q) => q[1] - p[1])[0][0]]);
  }
  for (const [x, y, c] of fix) g.set(x, y, c);
}

// Hand-placed pixel maps. Key: N navy, B blue, P purple, U cloudUnder, C cloudTop, S sunDisc, E earthDark, G grassLight, g grass,
// d grassDark, D deep, k outline (pupils, the open mouth's dark and X eyes only).
const KEY = { N: W1.navy, B: W1.blue, P: W1.purple, U: W1.cloudUnder, C: W1.cloudTop, S: W1.sunDisc, E: W1.earthDark, R: W1.rust,
  G: W1.grassLight, g: W1.grass, d: W1.grassDark, D: W1.deep, k: OUTLINE };
function stamp(g, rows, ox, oy) {
  rows.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch !== '.') g.set(ox + x, oy + y, KEY[ch]);
  }));
}

/** The bare grey head, its hooked beak and the bare neck below it: 15 x 11, its top left at the head's anchor. The eye goes on after. */
const HEADS = {
  shut: [
    '...UUUPP.......',
    '..UUPPPPPP.....',
    '.UUPPPPPPPP....',
    '.UPPPPPPPPSCC..',
    'UUPPPPPPPCCCCC.',
    'UPPPPPPPPCCCCCC',
    'PPPPPPPPPUUUUCC',
    'PNPPPPPPP...CCU',
    'PPNPPPPP....CU.',
    '.PPNPPP........',
    '..PPPP.........',
  ],
  hiss: [
    '...UUUPP.......',
    '..UUPPPPPPSC...',
    '.UUPPPPPPCCCCC.',
    '.UPPPPPPPCCCCCC',
    'UUPPPPPPPEEE.CC',
    'UPPPPPPPPEEEE.U',
    'PPPPPPPPPEEE...',
    'PNPPPPPPPUCCC..',
    'PPNPPPPP..UUU..',
    '.PPNPPP........',
    '..PPPP.........',
  ],
};
/** The eyes, at `at` in the head ('.' leaves the head as it is): drawn after any turn, so the pupil and its glint stay whole. */
const EYES = {
  sly: { at: [4, 3], rows: ['NNNN', 'SSSk', 'SSkk'] }, // a dark brow over a 2 px eye: sneaky, a bit dim
  wide: { at: [4, 3], rows: ['SSSS', 'SSSk', 'SSkk'] },
  hiss: { at: [4, 2], rows: ['NN..', 'SSNN', 'SSSk', 'SSkk'] }, // wide, under a brow that slants down to the beak
  x: { at: [4, 2], rows: ['k..k', '.kk.', '.kk.', 'k..k'] },
};
const FACES = { sly: ['shut', 'sly'], wide: ['shut', 'wide'], hiss: ['hiss', 'hiss'], x: ['shut', 'x'] };

/** The cholla joint stuck on its back (GDD-CMB-01): an oval pad lit from the upper left, two areoles, three pale spines up. 9 x 7. */
const CHOLLA_JOINT = [
  '.C..C..C.',
  '.C..C..C.',
  '.GGGGGGg.',
  'GGgDggggd',
  'GggggDgdd',
  '.ggggddd.',
  '..ddddd..',
];

/** A foot with its talons spread, reaching (the telegraph and the hit). */
const TALONS = ['.CU.', '.CU.', 'CCCU', 'C..U'];

/** A feather knocked loose in the hit, drifting down. */
const LOOSE_FEATHER = ['....BB', '...BBN', '..BNN.', '.BNN..', 'CN....'];

/** Scale2x (EPX): doubles a grid, keeping edges crisp. */
function scale2x(src) {
  const g = new Grid(src.width * 2, src.height * 2);
  for (let y = 0; y < src.height; y++) for (let x = 0; x < src.width; x++) {
    const p = src.get(x, y), a = src.get(x, y - 1), b = src.get(x + 1, y), c = src.get(x - 1, y), d = src.get(x, y + 1);
    g.set(2 * x, 2 * y, c === a && c !== d && a !== b ? a : p);
    g.set(2 * x + 1, 2 * y, a === b && a !== c && b !== d ? b : p);
    g.set(2 * x, 2 * y + 1, d === c && d !== b && c !== a ? c : p);
    g.set(2 * x + 1, 2 * y + 1, b === d && b !== a && d !== c ? d : p);
  }
  return g;
}

/** `src` turned by `deg` degrees (clockwise, nose down) about (cx, cy), RotSprite style: scaled up 8 times, turned, sampled back. */
function turned(src, deg, [cx, cy]) {
  const big = scale2x(scale2x(scale2x(src)));
  const out = new Grid(src.width, src.height);
  const a = rad(deg), c = Math.cos(a), s = Math.sin(a);
  for (let y = 0; y < out.height; y++) for (let x = 0; x < out.width; x++) {
    const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
    const sx = cx + dx * c + dy * s, sy = cy - dx * s + dy * c;
    const v = big.get(Math.floor(sx * 8), Math.floor(sy * 8));
    if (v) out.set(x, y, v);
  }
  return out;
}

/**
 * The whole bird, facing right. near / far: wing poses (null hides one); rot: degrees nose down, about `pivot`; dy: the body's bob;
 * head: the head's offset from its place; face: a HEADS key; feet 'tucked' | 'out' | 'none'.
 */
function drawBird({ near, far = null, rot = 0, pivot = [30, 24], dy = 0, head = [0, 0], face = 'sly', feet = 'tucked', upsideDown = false, bomb = false } = {}) {
  const g = new Grid(FRAME.w, FRAME.h);
  // The wings are drawn straight in the turned frame, so their fingers stay clean lines; the body and the head are drawn level and
  // turned as pixel art (RotSprite style).
  const { T, P } = space(rot, pivot, upsideDown);
  const level = (paint, flip = upsideDown) => {
    let l = new Grid(FRAME.w, FRAME.h);
    paint(l);
    if (flip) {
      const f = new Grid(l.width, l.height);
      for (let y = 0; y < l.height; y++) for (let x = 0; x < l.width; x++) f.set(x, 2 * pivot[1] - 1 - y, l.get(x, y));
      l = f;
    }
    paste(g, rot ? turned(l, rot, pivot) : l, 0, 0);
  };
  const shoulder = [25, 21 + dy];
  const H = [33 + head[0], 14 + dy + head[1]];

  if (far) paintWing(g, T, P, wing([shoulder[0] + 3, shoulder[1] - 1], far), true);
  // The body is shaded where it lands (upside down too), so its light stays on the upper left; the hand-placed parts are flipped.
  const F = (test) => (upsideDown ? (x, y) => test(x, 2 * pivot[1] - y) : test);
  const fy = (y) => (upsideDown ? 2 * pivot[1] - 1 - y : y);
  level((l) => {
    // The short square tail, folded shorter in the dive's bomb pose.
    shaded(l, F(polygon(bomb ? [[23, 22.5 + dy], [20, 23.5 + dy], [20, 28 + dy], [23, 28.6 + dy]] : [[23, 22.5 + dy], [17, 23.5 + dy], [16.6, 28 + dy], [23, 28.6 + dy]])), PLUME);
    if (feet === 'tucked') {
      line2(l, [28, fy(29 + dy)], [25, fy(31 + dy)], W1.cloudTop, W1.cloudUnder);
      line2(l, [32, fy(29 + dy)], [29, fy(31 + dy)], W1.cloudTop, W1.cloudUnder);
    }
    shaded(l, F(bomb ? ellipse(30, 25 + dy, 8.6, 6, -0.1) : ellipse(28.5, 25 + dy, 10.6, 5.8, -0.1)), PLUME);
    shaded(l, F(ellipse(H[0] + 1.5, 22 + dy + head[1] * 0.4, 3.6, 3.6)), PLUME); // the feathered collar under the bare neck
  }, false);
  if (feet === 'out') level((l) => { for (const x0 of [26, 31]) stamp(l, TALONS, x0, 29 + dy); });
  if (near) paintWing(g, T, P, wing(shoulder, near), false);
  level((l) => {
    stamp(l, CHOLLA_JOINT, 25, 14 + dy);
    stamp(l, HEADS[FACES[face][0]], H[0], H[1]);
  });
  tidy(g);
  const eye = EYES[FACES[face][1]];
  const [ew, eh] = [eye.rows[0].length, eye.rows.length];
  const [ex, ey] = P([H[0] + eye.at[0] + ew / 2, H[1] + eye.at[1] + eh / 2]);
  stamp(g, eye.rows, ex - Math.floor(ew / 2), ey - Math.floor(eh / 2));
  g.outline(OUTLINE, 1);
  return g;
}

// The four wing poses of the flap, and the swept wing of the dives.
const UP = { a: 80, len: 19, spread: 14, curl: -8 };
const MID_DOWN = { a: 12, len: 20, spread: 12, curl: 8 };
const DOWN = { a: -60, len: 18, spread: 13, curl: 6 };
const MID_UP = { a: 40, len: 15, spread: 8, curl: -10, chord: 0.8 };
const SWEPT = { a: 22, len: 16, spread: 10, curl: -4, chord: 0.8 };

function drawLook(look) {
  switch (look) {
    case 'flap0': return drawBird({ near: UP, far: { ...UP, a: 88, len: 16 } });
    case 'flap1': return drawBird({ near: MID_DOWN, dy: -1, head: [0, 1] }); // the head lags the body's rise by a frame
    case 'flap2': return drawBird({ near: DOWN, far: { ...DOWN, a: -52 }, dy: -1 });
    case 'flap3': return drawBird({ near: MID_UP, head: [0, -1] });
    case 'tele': return drawBird({ near: { a: 98, len: 19, spread: 17, curl: -4 }, far: { a: 112, len: 17, spread: 16 }, head: [0, 3], face: 'hiss', feet: 'out' });
    case 'teleRed': return flashed(drawLook('tele'));
    case 'diveSteep': return drawBird({ near: { ...SWEPT, len: 14 }, rot: 70, pivot: [31, 23], head: [-5, 2], face: 'wide', feet: 'none', bomb: true });
    case 'diveShallow': return drawBird({ near: SWEPT, rot: 35, head: [-1, 1], face: 'wide', feet: 'none' });
    case 'climb0': return drawBird({ near: { ...UP, a: 95 }, far: { ...UP, a: 85 }, rot: -20 });
    case 'climb1': return drawBird({ near: { ...DOWN, a: -75 }, far: { ...DOWN, a: -65 }, rot: -20, dy: -1 });
    case 'hit': {
      const g = drawBird({ near: { ...DOWN, a: -72, len: 17 }, rot: 10, face: 'x', upsideDown: true });
      const feather = new Grid(FRAME.w, FRAME.h);
      stamp(feather, LOOSE_FEATHER, 40, 5);
      feather.outline(OUTLINE, 1);
      paste(g, feather, 0, 0);
      return shifted(g, 0, -2); // up 2, so the tumbling body stays on its box
    }
    default: throw new Error(`no look ${look}`);
  }
}

/** Every frame in LOOKS order: [{ look, grid }], each FRAME.w x FRAME.h drawing px. */
export function drawFrames() {
  return LOOKS.map((look) => ({ look, grid: drawLook(look) }));
}
