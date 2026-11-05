// Poncho's pose rig (GDD-ART-02, GDD-ART-04, GDD-ART-05): builds his animation frames from the user's own drawing.
//
// README, the pose spec. `pose(spec)` returns a POSE_FRAME (96 x 96 drawing px) Grid facing right, with `grid.hand` (where a held
// item's middle goes) and `grid.anchors` ({ hand, mouth, eye }), all in frame drawing px. Every field is optional; `pose({})` and
// `pose(STANDING)` are today's standing frame and `pose(RUN[i])` today's run frame i, pixel for pixel. Numbers are drawing px,
// +x right, +y down; offsets nest (body > head > hat).
//   x, y        the whole figure in the frame (legs included).
//   body        { dx, dy, squash, widen }: the poncho with all above it and the tail. squash n > 0 removes n whole rows from the
//               face and the poncho (SQUASH_ROWS, in order), n < 0 doubles -n of them (a stretch); widen n > 0 doubles n whole
//               columns (WIDEN_COLS), n < 0 removes them. The legs keep their size; the feet stay put.
//   head        { dx, dy }: the face and the ears (and the hat with them) against the poncho. Moving it up shows the neck's shadow.
//   hat         { dx, dy, tilt, off, lit }: the sombrero against the head. tilt is degrees clockwise (> 0 tips the front brim down), any
//               angle, rotated RotSprite-style and cleaned; HAT_TILTS are the ones reviewed. Lifted, it shows his bare head
//               and both ears (drawn under the hat, where the drawing hides them). off: true leaves the hat out. lit: the
//               brim's shadow on his face is gone (default when the hat is off or lifted 5 px or more).
//   face        'normal' | 'blink' | 'squeeze' | 'wide' | 'open' | 'happy' | 'glance', or { eyes, mouth } with eyes from EYES
//               and mouth from MOUTHS ('closed', 'open', 'smile', 'puff').
//   legs        'stand' | 'run0'..'run3' | 'tuck' | 'splay', or { set, dx, dy }, or custom { rows, lift, dx, dy }: rows are
//               56-wide strings in the drawing's colour letters from the drawing's row LEG_TOP down (as poncho-run-legs.mjs),
//               without their outer outline (added here); lift is how many rows higher the body sits than standing (default
//               rows.length - 8: the feet on the frame's bottom row).
//   tail        'rest' | 'swayR' | 'swayL' (the run's) | 'up' | 'low' | 'back', or { name, dx, dy }, or { path, tip }: path is
//               six points from the root (under the poncho) to the tip, tip the cream tip's centre, in the drawing's px.
//   paw         null (hidden) or { x, y, from, front, behind, claws }: the front paw (cream, outlined, cut from the drawing's
//               own paw) centred at frame px (x, y), on an arm from the shoulder (`from`, frame px; default under the poncho's
//               front). The arm goes behind the poncho unless front; behind puts the paw there too; claws adds three claws.
//   hand        { dx, dy } nudges the hand anchor (default: the paw's middle, or in front of his chest when the paw is hidden).
// Example: pose({ body: { squash: 3, widen: 2 }, hat: { dy: -2, tilt: 8 }, face: 'squeeze', legs: 'splay', tail: 'low' }).
// Also: rotated(grid, degrees, { pivot }) for the respawn flip, cleaned (no holes, no strays, the outline closed); check(grid)
// lists problems (colours outside the palette, pixels on the frame's edge, an open outline). The run legs meet the poncho's hem
// open in a pixel or two, as today's run frames do, so check() reports those when the run legs are used.
// Limits: parts move by whole px and turn only through `rotated`; the face and poncho are the drawing's (one side view, no
// turned head); arms are a fur stroke with the drawing's paw at 45-degree steps; squash and widen stop at SQUASH_ROWS and
// WIDEN_COLS; the bare head, the far ear and the crown behind the near ear are drawn in (hidden while the hat is on).
import { and, ellipse, Grid, stroke } from '../raster.mjs';
import { COLOURS, ROWS } from '../poncho-pixels.mjs';
import { RUN_LEGS } from '../poncho-run-legs.mjs';

/** The frame, in drawing px (48 x 48 game px). */
export const POSE_FRAME = { w: 96, h: 96 };
/** Poncho's body box (12 x 32 game px) in the frame: centred, on the bottom row. x1 and y1 are exclusive. */
export const BOX = { x0: 36, y0: 32, x1: 60, y1: 96 };
/** Where the drawing's top-left pixel sits in the standing frame (today's 40 x 40 frame, placed the same way on his box). */
export const ORIGIN = { x: 24, y: 25 };
/** The drawing's rows from here down are the legs (poncho.mjs). */
export const LEG_TOP = 63;
/** The standing frame and the four run frames as pose specs. */
export const STANDING = Object.freeze({});
export const RUN = Object.freeze(['rest', 'swayR', 'rest', 'swayL'].map((tail, i) => Object.freeze({ legs: `run${i}`, tail })));
/** Rows removed (squash) or doubled (stretch), in this order: the poncho's middle and the face below the eye. */
export const SQUASH_ROWS = [49, 37, 53, 45, 34, 57];
/** Columns doubled (widen) or removed, in this order. Columns from 30 right move right, those left of it move left. */
export const WIDEN_COLS = [31, 23, 35, 27];
/** The hat tilts reviewed for cleanliness, in degrees (others work, unreviewed). */
export const HAT_TILTS = [-32, -24, -16, -8, 8, 16, 24, 32];

const W = 56, TAIL_ROOM = 8;
const OUTLINE = COLOURS['#'];
const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const N8 = [...N4, [1, 1], [-1, 1], [1, -1], [-1, -1]];

// The drawing cut into parts, one letter a pixel: C the sombrero's crown, B its brim (in front of the near ear), E the near ear,
// e the far ear, A the face, P the poncho (with its fringe and the hanging paw), L the legs (as poncho.mjs cuts them). An outline
// pixel between two parts belongs to the one in front.
const PART_MAP = [
  '.....................CCCCCC.............................',
  '...................CCCCCCCCCC...........................',
  '..................CCCCCCCCCCCC..........................',
  '.................CCCCCCCCCCCCCC....ee...................',
  '................CCCCCCCCEECCCCCC..eeee..................',
  '................CCCCCCCEEEECCCCCCCeeee..................',
  '................CCCCCCEEEEEECCCCCCeeee.............BBBB.',
  '...............CCCCCCEEEEEEEECCCCCCeeee.......BBBBBBBBBB',
  '...............CCCCCCEEEEEEEECCCCCCeeee...BBBBBBBBBBBBBB',
  '...............CCCCCEEEEEEEEEECCCCCCeeeBBBBBBBBBBBBBBBBB',
  '...............CCCCCEEEEEEEEEECCCCCCCBBBBBBBBBBBBBBBBBBB',
  '...............CCCCEEEEEEEEEEEECCCBBBBBBBBBBBBBBBBBBBBBB',
  '...............CCCCEEEEEEEEEEEECBBBBBBBBBBBBBBBBBBBBBBBB',
  '...............CCCEEEEEEEEEEEBBBBBBBBBBBBBBBBBBBBBBBBBB.',
  '...............CCCEEEEEEEEEBBBBBBBBBBBBBBBBBBBBBBBBBBBB.',
  '...............CCCEEEEEEBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB..',
  '...............CCCEEEBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB....',
  '...............CCCBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB.......',
  '..............BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB..........',
  '...........BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBAA............',
  '........BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBAAAAAA...........',
  '......BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBAAAAAAAAA...........',
  '...BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBAAAAAAAAAAAAA..........',
  '.BBBBBBBBBBBBBBBBBBBBBBBBBBBBBAAAAAAAAAAAAAAAA..........',
  'BBBBBBBBBBBBBBBBBBBBBBBBBBBBAAAAAAAAAAAAAAAAAA..........',
  'BBBBBBBBBBBBBBBBBBBBBBBBBAAAAAAAAAAAAAAAAAAAAAA.........',
  'BBBBBBBBBBBBBBBBBBBBBBAAAAAAAAAAAAAAAAAAAAAAAAA.........',
  '.BBBBBBBBBBBBBBBBBBBAAAAAAAAAAAAAAAAAAAAAAAAAAA.........',
  '..BBBBBBBBBBBBBBBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA........',
  '...BBBBBBBBBBBBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA.......',
  '....BBBBBBB...AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA......',
  '..............AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA......',
  '..............AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA......',
  '..............AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA......',
  '...............AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA.......',
  '...............AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA.......',
  '................AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA........',
  '.................AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA.........',
  '..................AAAAAAAAAAAAAAAAAAAAAAAAAAAA..........',
  '...................AAAAAAAAAAAAAAAAAAAAAAAAAA...........',
  '..................PPPAAAAAAAAAAAAAAAAAAAAAA.............',
  '.................PPPPPPPAAAAAAAAAAAAAAAAA...............',
  '.................PPPPPPPPPPPPPPPPPPPPPPPPP..............',
  '................PPPPPPPPPPPPPPPPPPPPPPPPPPP.............',
  '................PPPPPPPPPPPPPPPPPPPPPPPPPPP.............',
  '...............PPPPPPPPPPPPPPPPPPPPPPPPPPPPP............',
  '...............PPPPPPPPPPPPPPPPPPPPPPPPPPPPP............',
  '..............PPPPPPPPPPPPPPPPPPPPPPPPPPPPPP............',
  '..............PPPPPPPPPPPPPPPPPPPPPPPPPPPPPPP...........',
  '..............PPPPPPPPPPPPPPPPPPPPPPPPPPPPPPP...........',
  '.............PPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPP...........',
  '.............PPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPP..........',
  '.............PPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPP..........',
  '.............PPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPP..........',
  '............PPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPP..........',
  '............PPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPP.........',
  '............PPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPP.........',
  '............PPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPP.........',
  '............PPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPP.........',
  '............PPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPP.........',
  '............PPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPP.........',
  '............PPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPP.........',
  '............PPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPP.........',
  '............PPPLLLLLLLLLLLLLLLLLLLLLLLLLLLPPPP..........',
  '............PPP.L.LLLLLLLLLLLLLLLLLLLLLLLLPPPP..........',
  '.............PP....LLLLLLLLLLL.LLLLLLLLL.LPPPP..........',
  '...................LLLLLLLLLLL.LLLLLLLLL..P.P...........',
  '...................LLLLLLLLLLL.LLLLLLLLLL...............',
  '...................LLLLLLLLLLLLLLLLLLLLLLL..............',
  '...................LLLLLLLLLLLLLLLLLLLLLLL..............',
  '....................LLLLLLLLLLL.LLLLLLLLLL..............',
];

// Drawn under the hat, so the standing frame never shows them: the crown behind the near ear (moves with the hat), and the bare
// head with the ears' roots (moves with the head). The neck's shadow under the chin (moves with the poncho).
const CROWN_BACK = [
  '........................................................',
  '........................................................',
  '........................................................',
  '........................................................',
  '........................rr..............................',
  '.......................rrrr.............................',
  '......................rrrrrb............................',
  '.....................rrbbbbbb...........................',
  '.....................ddbbbbbb...........................',
  '....................dddbbbbbbb..........................',
  '....................dddbbbbbbr..........................',
  '...................ddddbbrrrrrr.........................',
  '...................ddccrrrrrrrr.........................',
  '..................cccccrrrrrr...........................',
  '..................cccccrrrr.............................',
  '..................cccccr................................',
  '..................ccc...................................',
];
const HEAD_UNDER = [
  '........................................................',
  '........................................................',
  '........................................................',
  '...................................##...................',
  '..................................#FF#..................',
  '.................................#FFf#..................',
  '.................................#FFf#..................',
  '.................................#FFFf#.................',
  '................................#FFFFf#.................',
  '................................#FFFFf#.................',
  '................................#FFFFff#................',
  '...............................#FFFFFff#................',
  '...............................#FFFFFfff#...............',
  '.................##cFffckkkkkwfFFFFFffff#...............',
  '................#F#FFffckkcwfff#fffffffff#..............',
  '................#F#FFffFccfffffffffffffff#..............',
  '...............#FFFfffffffffffffffffffffff#.............',
  '...............#FFFfffffffffffffffffffffff#.............',
  '..............#FFFfffffffffffffffffffffffff#............',
  '..............#FFFfffffffffffffffffffffffff#............',
  '..............#FFFffffffffffffffffffffffffff............',
  '..............#FFFffffffffffffffffffffffffff............',
  '..............#FFFfffffffffffffffffffffffffff...........',
  '..............#FFFfffffffffffffffffffffffffff...........',
  '..............#FFFfffffffffffffffffffffffffff...........',
  '..............#FFFffffffffffffffffffffffffffff..........',
  '..............#FFFffffffffffffffffffffffffffff..........',
  '..............#FFFffffffffffffffffffffffffffff..........',
  '..............#FFFfffffffffffffffffffffffffffff.........',
  '..............#FFFffffffffffffffffffffffffffffff........',
  '........................................................',
];
const NECK = [
  '........................nnnnnnnnnnnnnnnnn...............',
  '........................nnnnnnnnnnnnnnnnn...............',
  '........................nnnnnnnnnnnnnnnnn...............',
  '........................nnnnnnnnnnnnnnnnn...............',
  '........................nnnnnnnnnnnnnnnnn...............',
];

/** A sparse layer of pixels in drawing px (x may be negative): Map key -> [x, y, colour]. */
class Layer {
  constructor() { this.px = new Map(); }
  static key(x, y) { return (y + 1024) * 4096 + x + 2048; }
  set(x, y, c) { this.px.set(Layer.key(x, y), [x, y, c]); return this; }
  get(x, y) { return this.px.get(Layer.key(x, y))?.[2] ?? null; }
  delete(x, y) { this.px.delete(Layer.key(x, y)); }
  [Symbol.iterator]() { return this.px.values(); }
  /** Each pixel moved to every [x, y] that `to` returns for it. */
  map(to) {
    const out = new Layer();
    for (const [x, y, c] of this) for (const [nx, ny] of to(x, y)) out.set(nx, ny, c);
    return out;
  }
  shifted(dx, dy) { return dx || dy ? this.map((x, y) => [[x + dx, y + dy]]) : this; }
  /** This layer with `top` painted over it. */
  under(top) {
    const out = new Layer();
    for (const [x, y, c] of this) out.set(x, y, c);
    for (const [x, y, c] of top) out.set(x, y, c);
    return out;
  }
  /** A 1 px outline ring around everything painted, on the outside only, never on rows from `floor` down. */
  outlined(floor = Infinity) {
    const out = this.under(new Layer());
    for (const [x, y] of this) for (const [dx, dy] of N4) if (!this.get(x + dx, y + dy) && y + dy < floor) out.set(x + dx, y + dy, OUTLINE);
    return out;
  }
  static fromGrid(g, ox = 0, oy = 0) {
    const l = new Layer();
    for (let y = 0; y < g.height; y++) for (let x = 0; x < g.width; x++) if (g.get(x, y)) l.set(x + ox, y + oy, g.get(x, y));
    return l;
  }
}

/** Rows of the drawing's letters as a layer, rows[0] at drawing row `top`, keeping the pixels `keep` accepts. */
function fromRows(rows, top = 0, keep = () => true, dx = 0) {
  const l = new Layer();
  rows.forEach((row, i) => [...row].forEach((ch, x) => {
    if (ch !== '.' && ch !== ' ' && keep(x, top + i, ch)) l.set(x + dx, top + i, COLOURS[ch]);
  }));
  return l;
}
const part = (code) => fromRows(ROWS, 0, (x, y) => PART_MAP[y][x] === code);

// ---- The face: expressions over the eye (columns 35 to 43, rows 25 to 31) and the mouth (columns 42 to 49, rows 33 to 39).
// '.' keeps the drawing's pixel, '_' clears it.
const EYE_AT = { x: 35, y: 25 };
export const EYES = {
  normal: null,
  blink: [
    'fffffwwwf',
    'ffffffwwf',
    'fffffffff',
    'ffnFFFFnf',
    'fffnnnnff',
    'ffffffffw',
    '.........',
  ],
  squeeze: [
    'fffffwwwf',
    'ffnnffwwf',
    'ffffnnfff',
    'ffffffnff',
    'ffffnnfff',
    'ffnnffffw',
    '.........',
  ],
  wide: [
    'fffnnnfwf',
    'ffnnnnnwf',
    'ffnnwwnnf',
    'ffnnwwnnf',
    'ffnnnnnff',
    'fffnnnffw',
    '.........',
  ],
  happy: [
    'fffffwwwf',
    'ffffnnwwf',
    'fffnffnff',
    'ffnffffnf',
    'fffffffff',
    'ffffffffw',
    '.........',
  ],
  glance: [
    'fffffwwwf',
    'fnnnffwwf',
    'ffFFFFFff',
    'ffFnnnnnf',
    'ffFnnwnnf',
    'fffFnnnfw',
    '.........',
  ],
};
const MOUTH_AT = { x: 42, y: 33 };
export const MOUTHS = {
  closed: null,
  open: [
    'wwwwwnn#',
    'wwwwnnn#',
    'wwwnnnn#',
    'wwwnccn#',
    'wwwwnnw#',
    'wwwpww#_',
    'pp####__',
  ],
  smile: [
    '........',
    '.n..n...',
    '..nn....',
    '........',
    '........',
    '........',
  ],
  puff: [
    '........',
    '......w#',
    '......w#',
    '.....ww#',
    '....ww#.',
    '........',
  ],
};
const FACES = {
  normal: { eyes: 'normal', mouth: 'closed' },
  blink: { eyes: 'blink', mouth: 'closed' },
  squeeze: { eyes: 'squeeze', mouth: 'closed' },
  wide: { eyes: 'wide', mouth: 'closed' },
  open: { eyes: 'normal', mouth: 'open' },
  happy: { eyes: 'happy', mouth: 'smile' },
  glance: { eyes: 'glance', mouth: 'closed' },
};

// The brim's shadow on the face (its F pixels under the brim, in front of the head's back rim): lit again when the hat is off.
const BRIM_SHADOW = (x, y, ch) => ch === 'F' && y <= 29 && x >= 19 && PART_MAP[y][x] === 'A';

function faceLayer(face, lit = false) {
  const f = typeof face === 'string' ? FACES[face] : { eyes: 'normal', mouth: 'closed', ...face };
  if (!f || !(f.eyes in EYES) || !(f.mouth in MOUTHS)) throw new Error(`unknown face ${JSON.stringify(face)}`);
  const l = fromRows(ROWS, 0, (x, y, ch) => PART_MAP[y][x] === 'A' && !(lit && BRIM_SHADOW(x, y, ch)));
  if (lit) for (const [x, y] of fromRows(ROWS, 0, BRIM_SHADOW)) l.set(x, y, FUR);
  for (const [patch, at] of [[EYES[f.eyes], EYE_AT], [MOUTHS[f.mouth], MOUTH_AT]]) {
    patch?.forEach((row, j) => [...row].forEach((ch, i) => {
      if (ch === '_') l.delete(at.x + i, at.y + j);
      else if (ch !== '.') l.set(at.x + i, at.y + j, COLOURS[ch]);
    }));
  }
  return l;
}

// ---- The legs.
const isLeg = (x, y) => y >= LEG_TOP && x >= 15 && x <= 41;
const STAND_LEGS = ROWS.slice(LEG_TOP).map((row, i) => [...row].map((ch, x) => (isLeg(x, LEG_TOP + i) ? ch : '.')).join(''));
/** The standing legs cut apart: the near leg (columns 15 to 30) `near` px right, the far leg `far` px right, `drop` rows gone. */
function cutLegs(near, far, drop) {
  return STAND_LEGS.filter((_, i) => !drop.includes(LEG_TOP + i)).map((row) => {
    const out = Array(W).fill('.');
    [...row].forEach((ch, x) => {
      if (ch === '.') return;
      const nx = x + (x <= 30 ? near : far);
      if (nx >= 0 && nx < W) out[nx] = ch;
    });
    return out.join('');
  });
}
const TUCK = cutLegs(2, -2, [65, 66, 67]);
const SPLAY = cutLegs(-2, 2, [66]);
export const LEGS = {
  stand: { rows: STAND_LEGS, lift: 0 },
  ...Object.fromEntries(RUN_LEGS.map((rows, i) => [`run${i}`, { rows, lift: rows.length - 8 }])),
  tuck: { rows: TUCK, lift: 0 },
  splay: { rows: SPLAY, lift: SPLAY.length - 8 },
};

function legsOf(spec) {
  const s = typeof spec === 'string' ? { set: spec } : spec;
  const base = s.rows ? { rows: s.rows, lift: s.lift ?? s.rows.length - 8 } : LEGS[s.set];
  if (!base) throw new Error(`unknown legs ${JSON.stringify(spec)}`);
  const layer = fromRows(base.rows, LEG_TOP).outlined(LEG_TOP + base.rows.length).shifted(s.dx ?? 0, s.dy ?? 0);
  return { layer, lift: base.lift, today: !s.rows && !s.dx && !s.dy && /^(stand|run\d)$/.test(s.set) };
}

// ---- The tail.
const FUR = COLOURS.f, FUR_DARK = COLOURS.F, FUR_SHADE = COLOURS.s, CREAM = COLOURS.w, CREAM_SHADE = COLOURS.p;

/** The tail of poncho.mjs (out from behind the legs, back, then up, a cream tip), exactly; `sway` moves the tip. */
function classicTail(sway) {
  const t = new Grid(64, 80);
  const at = (x, y) => [x + TAIL_ROOM, y];
  const path = [at(22, 65), at(14, 67), at(8, 65), at(4 + sway * 0.5, 59), at(3 + sway, 51), at(5 + sway, 44)];
  const tail = stroke(path, 3.6);
  t.fill(tail, FUR);
  t.fill(and(tail, (x, y) => y > 64.5), FUR_DARK);
  t.fill(and(tail, (x, y) => x < at(4.2 + sway, 0)[0] && y > 50 && y <= 64.5), FUR_SHADE);
  t.fill(and(tail, (x, y) => y < 50), CREAM);
  const tip = ellipse(...at(5.2 + sway, 45.5), 2.6, 3);
  t.fill(tip, CREAM);
  t.fill(and(tip, (x) => x < at(4.6 + sway, 0)[0]), CREAM_SHADE);
  t.outline(OUTLINE, 1);
  return Layer.fromGrid(t, -TAIL_ROOM, 0);
}

/** A tail along `path` (six points, root to tip) with its cream tip at `tip`: the same stroke, shading and outline. */
function pathTail(path, tip) {
  const OX = 40, t = new Grid(140, 110);
  const p = path.map(([x, y]) => [x + OX, y]);
  const [tx, ty] = [tip[0] + OX, tip[1]];
  const tail = stroke(p, 3.6);
  // Which side of the path a point is on: the outer side (left of a rising tail, under a tail going back) is shaded.
  const outer = (x, y) => {
    let best = Infinity, side = 0;
    for (let i = 0; i < p.length - 1; i++) {
      const [ax, ay] = p[i], [bx, by] = p[i + 1], dx = bx - ax, dy = by - ay;
      const k = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
      const d = Math.hypot(x - ax - k * dx, y - ay - k * dy);
      if (d < best) { best = d; side = dx * (y - ay) - dy * (x - ax); }
    }
    return side < -0.3;
  };
  const end = p[p.length - 1];
  const cream = (x, y) => Math.hypot(x - end[0], y - end[1]) < 4.5;
  t.fill(tail, FUR);
  t.fill(and(tail, (x, y) => (y > 64.5 && outer(x, y)) || y > 67), FUR_DARK);
  t.fill(and(tail, (x, y) => y <= 64.5 && outer(x, y)), FUR_SHADE);
  t.fill(and(tail, cream), CREAM);
  // The tip's long axis follows the last stretch of the path, as the upright tail's does.
  const [lx, ly] = p[p.length - 2];
  const tipShape = ellipse(tx, ty, 3, 2.6, Math.atan2(end[1] - ly, end[0] - lx));
  t.fill(tipShape, CREAM);
  // The tip's shade: one clean crescent on its outer side (the side away from the light), as the upright tail has it.
  const [ux, uy] = [end[0] - lx, end[1] - ly], ul = Math.hypot(ux, uy);
  t.fill(and(tipShape, (x, y) => (ux * (y - ty) - uy * (x - tx)) / ul < -1), CREAM_SHADE);
  t.outline(OUTLINE, 1);
  return Layer.fromGrid(t, -OX, 0);
}

export const TAILS = {
  rest: () => classicTail(0),
  swayR: () => classicTail(1),
  swayL: () => classicTail(-1),
  /** Raised, the tip curled forward (happy, victory). */
  up: () => pathTail([[22, 65], [14, 67], [8, 65], [4, 58], [4, 48], [8, 41]], [8.6, 41.5]),
  /** Arched back, the tip drooping (hurt, a landing). */
  low: () => pathTail([[22, 65], [14, 67], [7, 64], [2, 59], [-3, 57], [-7, 60]], [-7.3, 61]),
  /** Streaming out behind (a jump, a fall). */
  back: () => pathTail([[22, 65], [14, 67], [7, 66], [1, 64], [-4, 61], [-8, 56]], [-8.4, 55.4]),
};

function tailOf(spec) {
  const s = typeof spec === 'string' ? { name: spec } : spec;
  const layer = s.path ? pathTail(s.path, s.tip ?? s.path[s.path.length - 1]) : TAILS[s.name ?? 'rest']?.();
  if (!layer) throw new Error(`unknown tail ${JSON.stringify(spec)}`);
  return layer.shifted(s.dx ?? 0, s.dy ?? 0);
}

// ---- Squash and stretch by whole rows, wider and narrower by whole columns.
function rowMapOf(n) {
  const rows = SQUASH_ROWS.slice(0, Math.abs(n));
  if (n > SQUASH_ROWS.length || -n > SQUASH_ROWS.length) throw new Error(`squash ${n}: at most ${SQUASH_ROWS.length} rows`);
  const drop = n > 0 ? rows : [], dup = n < 0 ? rows : [];
  const at = (y) => y + drop.filter((r) => r > y).length - dup.filter((r) => r > y).length;
  return {
    rows: (y) => (drop.includes(y) ? [] : dup.includes(y) ? [at(y), at(y) - 1] : [at(y)]),
    point: (y) => at(Math.round(y)) + (y - Math.round(y)),
  };
}
function colMapOf(n) {
  const cols = WIDEN_COLS.slice(0, Math.abs(n));
  if (Math.abs(n) > WIDEN_COLS.length) throw new Error(`widen ${n}: at most ${WIDEN_COLS.length} columns`);
  const s = Math.sign(n);
  const at = (x) => x + s * (cols.filter((c) => c >= 30 && c < x).length - cols.filter((c) => c < 30 && c > x).length);
  return {
    cols: (x) => {
      if (!cols.includes(x)) return [at(x)];
      if (s < 0) return [];
      return [at(x), at(x) + (x >= 30 ? 1 : -1)];
    },
    point: (x) => at(Math.round(x)) + (x - Math.round(x)),
  };
}

// ---- RotSprite: Scale2x three times (8x), rotate by nearest sample, back to 1x, then cleaned.
function scale2x(g) {
  const o = new Grid(g.width * 2, g.height * 2);
  for (let y = 0; y < g.height; y++) {
    for (let x = 0; x < g.width; x++) {
      const P = g.get(x, y), A = g.get(x, y - 1), B = g.get(x + 1, y), C = g.get(x - 1, y), D = g.get(x, y + 1);
      o.set(2 * x, 2 * y, C === A && C !== D && A !== B ? A : P);
      o.set(2 * x + 1, 2 * y, A === B && A !== C && B !== D ? B : P);
      o.set(2 * x, 2 * y + 1, D === C && D !== B && C !== A ? C : P);
      o.set(2 * x + 1, 2 * y + 1, B === D && B !== A && D !== C ? D : P);
    }
  }
  return o;
}

const isOutline = (c) => c === OUTLINE || (typeof c === 'string' && c.endsWith(OUTLINE));
const outlineLike = (c) => (typeof c === 'string' && c.includes('|') ? `${c.split('|')[0]}|${OUTLINE}` : OUTLINE);

/**
 * Cleans a rotated or sheared grid: strays and pin holes go, and the outside outline is drawn again, 1 px and closed.
 * Values may be tagged 'part|#RRGGBB' (the hat's crown and brim) and keep their tag.
 */
export function clean(g) {
  const painted = (x, y) => g.get(x, y) !== null;
  // Lone pixels and outline spurs.
  for (let pass = 0; pass < 2; pass++) {
    for (let y = 0; y < g.height; y++) for (let x = 0; x < g.width; x++) {
      if (!painted(x, y)) continue;
      const n = N4.filter(([dx, dy]) => painted(x + dx, y + dy)).length;
      if (n === 0 || (n === 1 && isOutline(g.get(x, y)))) g.set(x, y, null);
    }
  }
  // Pin holes: an empty pixel with three or four painted sides takes its neighbours' commonest colour (not the outline's).
  for (let y = 0; y < g.height; y++) for (let x = 0; x < g.width; x++) {
    if (painted(x, y)) continue;
    const ns = N4.map(([dx, dy]) => g.get(x + dx, y + dy)).filter((c) => c !== null);
    if (ns.length < 3) continue;
    const colours = ns.filter((c) => !isOutline(c));
    const pool = colours.length ? colours : ns;
    g.set(x, y, pool.toSorted((a, b) => pool.filter((c) => c === b).length - pool.filter((c) => c === a).length)[0]);
  }
  // The outside: strip the outline touching it, then draw it again around everything.
  const outside = new Uint8Array(g.width * g.height);
  const stack = [];
  for (let x = 0; x < g.width; x++) stack.push([x, 0], [x, g.height - 1]);
  for (let y = 0; y < g.height; y++) stack.push([0, y], [g.width - 1, y]);
  while (stack.length) {
    const [x, y] = stack.pop();
    if (x < 0 || y < 0 || x >= g.width || y >= g.height || outside[y * g.width + x] || painted(x, y)) continue;
    outside[y * g.width + x] = 1;
    for (const [dx, dy] of N4) stack.push([x + dx, y + dy]);
  }
  const touchesOutside = (x, y) => N4.some(([dx, dy]) => {
    const nx = x + dx, ny = y + dy;
    return nx < 0 || ny < 0 || nx >= g.width || ny >= g.height || outside[ny * g.width + nx];
  });
  const strip = [];
  for (let y = 0; y < g.height; y++) for (let x = 0; x < g.width; x++) if (isOutline(g.get(x, y)) && touchesOutside(x, y)) strip.push([x, y]);
  for (const [x, y] of strip) g.set(x, y, null);
  const ring = [];
  for (let y = 0; y < g.height; y++) for (let x = 0; x < g.width; x++) {
    if (painted(x, y)) continue;
    const n = N4.map(([dx, dy]) => g.get(x + dx, y + dy)).find((c) => c !== null);
    if (n) ring.push([x, y, outlineLike(n)]);
  }
  for (const [x, y, c] of ring) g.set(x, y, c);
  return g;
}

/**
 * The grid turned `degrees` clockwise about `pivot` (default its centre), RotSprite-style, then cleaned. A multiple of 90 is
 * turned exactly. Same size as `grid`; for the respawn flip.
 */
export function rotated(grid, degrees, { pivot = [grid.width / 2, grid.height / 2], cleanUp = true } = {}) {
  const turns = ((Math.round(degrees / 90) % 4) + 4) % 4;
  if (Math.abs(degrees / 90 - Math.round(degrees / 90)) < 1e-9) {
    const out = new Grid(grid.width, grid.height);
    const [px, py] = pivot;
    for (let y = 0; y < grid.height; y++) for (let x = 0; x < grid.width; x++) {
      const c = grid.get(x, y);
      if (!c) continue;
      let dx = x + 0.5 - px, dy = y + 0.5 - py;
      for (let t = 0; t < turns; t++) [dx, dy] = [-dy, dx];
      out.set(Math.floor(px + dx), Math.floor(py + dy), c);
    }
    return out;
  }
  let big = grid;
  for (let i = 0; i < 3; i++) big = scale2x(big);
  const a = (degrees * Math.PI) / 180, cos = Math.cos(a), sin = Math.sin(a);
  const out = new Grid(grid.width, grid.height);
  const [px, py] = pivot;
  for (let y = 0; y < out.height; y++) for (let x = 0; x < out.width; x++) {
    const dx = x + 0.5 - px, dy = y + 0.5 - py;
    // Inverse rotation: where this pixel's centre came from.
    const sx = px + dx * cos + dy * sin, sy = py - dx * sin + dy * cos;
    out.set(x, y, big.get(Math.floor(sx * 8), Math.floor(sy * 8)));
  }
  return cleanUp ? clean(out) : out;
}

// ---- The hat, turned.
const HAT_PIVOT = [29, 18];
function hatLayers(tilt) {
  // The crown, with what the near ear hides of it filled in (CROWN_BACK), and the brim.
  const crown = fromRows(CROWN_BACK).under(part('C')), brim = part('B');
  if (!tilt) return { crown, brim };
  const M = 24, w = W + 2 * M, h = 40 + 2 * M;
  const g = new Grid(w, h);
  for (const [x, y, c] of crown) g.set(x + M, y + M, `C|${c}`);
  for (const [x, y, c] of brim) g.set(x + M, y + M, `B|${c}`);
  const r = rotated(g, tilt, { pivot: [HAT_PIVOT[0] + M, HAT_PIVOT[1] + M] });
  const out = { crown: new Layer(), brim: new Layer() };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const v = r.get(x, y);
    if (!v) continue;
    const [tag, c] = v.split('|');
    (tag === 'C' ? out.crown : out.brim).set(x - M, y - M, c);
  }
  return out;
}

// ---- The front paw: the drawing's own hanging paw (rows 57 to 61, columns 22 to 29), the wrist at the top.
const PAW_ROWS = [
  '#fwwwwp#',
  '#wwwwww#',
  '#wpwwpw#',
  '.#pwwp#.',
  '..####..',
];
const PAW_CENTRE = [4, 1.5];
const CLAWS = [[2, 5], [4, 5], [6, 4]];
const PAW_STAMPS = new Map();
/** The paw pointing `deg` degrees clockwise from straight down (a multiple of 45), as a layer centred on (0, 0). */
function pawStamp(deg, claws) {
  const k = `${deg}${claws}`;
  if (PAW_STAMPS.has(k)) return PAW_STAMPS.get(k);
  const M = 6, g = new Grid(8 + 2 * M, 6 + 2 * M);
  PAW_ROWS.forEach((row, y) => [...row].forEach((ch, x) => ch !== '.' && g.set(x + M, y + M, COLOURS[ch])));
  if (claws) for (const [x, y] of CLAWS) g.set(x + M, y + M, COLOURS.W);
  const pivot = [PAW_CENTRE[0] + M, PAW_CENTRE[1] + M + 0.5];
  const r = deg ? rotated(g, deg, { pivot }) : g;
  const l = Layer.fromGrid(r, -Math.floor(pivot[0]), -Math.floor(pivot[1]));
  PAW_STAMPS.set(k, l);
  return l;
}

/** The arm (fur, its underside dark) from `from` to `to`, and the paw at `to`; frame px. */
function pawLayers({ x, y, claws = false }, from) {
  const [fx, fy] = from;
  const ang = Math.atan2(y - fy, x - fx); // 0 = right, pi/2 = down
  const deg = Math.round(((ang * 180) / Math.PI - 90) / 45) * 45; // the stamp hangs down at 0
  const stamp = pawStamp(((deg % 360) + 360) % 360, claws);
  const reach = Math.hypot(x - fx, y - fy);
  const wx = x - (Math.cos(ang) * 2.5), wy = y - (Math.sin(ang) * 2.5);
  const arm = new Layer();
  if (reach > 2.5) {
    const g = new Grid(POSE_FRAME.w, POSE_FRAME.h);
    const line = stroke([[fx, fy], [wx, wy]], 5);
    g.fill(line, FUR);
    // The underside: the side away from the light (upper left).
    const nx = -Math.sin(ang), ny = Math.cos(ang);
    const shade = nx * -1 + ny * -1 < 0 ? 1 : -1;
    g.fill(and(line, (px, py) => ((px - fx) * nx + (py - fy) * ny) * shade > 0.6), FUR_DARK);
    for (const [ax, ay, c] of Layer.fromGrid(g)) arm.set(ax, ay, c);
  }
  const paw = stamp.shifted(Math.floor(x), Math.floor(y));
  return { arm: arm.outlined(), paw };
}

// ---- Composing.
const SHOULDER = [38, 49];
const DEFAULT_HAND = [48, 51];
const MOUTH = [47, 35];
const EYE = [40, 28];

/** A pose: see the README at the top. Returns a POSE_FRAME Grid with `hand` and `anchors`. */
export function pose(spec = {}) {
  const body = { dx: 0, dy: 0, squash: 0, widen: 0, ...spec.body };
  const head = { dx: 0, dy: 0, ...spec.head };
  const hat = { dx: 0, dy: 0, tilt: 0, ...spec.hat };
  const legs = legsOf(spec.legs ?? 'stand');
  const rowMap = rowMapOf(body.squash), colMap = colMapOf(body.widen);
  const reshape = (l) => (body.squash || body.widen ? l.map((x, y) => colMap.cols(x).flatMap((nx) => rowMap.rows(y).map((ny) => [nx, ny]))) : l);
  const point = ([x, y], dx = 0, dy = 0) => [colMap.point(x) + body.dx + dx, rowMap.point(y) + body.dy + dy];
  const bodyMove = (l, dx = 0, dy = 0) => reshape(l).shifted(body.dx + dx, body.dy + dy);

  const { crown, brim } = hatLayers(hat.tilt);
  const hx = head.dx + hat.dx, hy = head.dy + hat.dy;
  const layers = {
    tail: bodyMove(tailOf(spec.tail ?? 'rest')),
    legs: legs.layer,
    poncho: bodyMove(fromRows(NECK, 37).under(part('P'))),
    skull: bodyMove(fromRows(HEAD_UNDER), head.dx, head.dy),
    farEar: bodyMove(part('e'), head.dx, head.dy),
    crown: bodyMove(crown, hx, hy),
    face: bodyMove(faceLayer(spec.face ?? 'normal', hat.lit ?? (hat.off || hat.dy <= -5)), head.dx, head.dy),
    nearEar: bodyMove(part('E'), head.dx, head.dy),
    brim: bodyMove(brim, hx, hy),
  };

  // Drawing px to frame px.
  const fx = ORIGIN.x + (spec.x ?? 0), fy = ORIGIN.y - legs.lift + (spec.y ?? 0);
  const toFrame = ([x, y]) => [x + fx, y + fy];
  let paw = null;
  if (spec.paw) {
    const from = spec.paw.from ?? toFrame(point(SHOULDER));
    paw = pawLayers(spec.paw, from);
  }

  const g = new Grid(POSE_FRAME.w, POSE_FRAME.h);
  const draw = (l, ox = fx, oy = fy) => { for (const [x, y, c] of l) g.set(x + ox, y + oy, c); };
  draw(layers.tail);
  draw(layers.legs);
  if (paw) draw(paw.arm, 0, 0);
  if (paw && spec.paw.behind) draw(paw.paw, 0, 0);
  draw(layers.poncho);
  for (const k of ['skull', 'farEar', 'crown', 'face', 'nearEar', 'brim']) if (!(hat.off && (k === 'crown' || k === 'brim'))) draw(layers[k]);
  if (paw && spec.paw.front) draw(paw.arm, 0, 0);
  if (paw && !spec.paw.behind) draw(paw.paw, 0, 0);
  // The poncho's hem meets the drawing's own legs and the run legs as today's frames have it (open in a few places); with
  // any other legs, or the body moved against them, it is closed.
  const hem = new Set();
  if (legs.today && !body.dx && !body.dy && !body.widen) for (const [x, y] of bodyMove(fromRows(ROWS, 0, (px, py) => py >= LEG_TOP - 1 && PART_MAP[py][px] === 'P'))) hem.add((y + fy) * 1000 + x + fx);
  closeOutline(g, (x, y) => hem.has(y * 1000 + x));

  const nudge = spec.hand ?? {};
  const hand = paw ? [spec.paw.x, spec.paw.y] : toFrame(point(DEFAULT_HAND));
  g.hand = { x: Math.round(hand[0] + (nudge.dx ?? 0)), y: Math.round(hand[1] + (nudge.dy ?? 0)) };
  const m = toFrame(point(MOUTH, head.dx, head.dy)), e = toFrame(point(EYE, head.dx, head.dy));
  g.anchors = { hand: g.hand, mouth: { x: Math.round(m[0]), y: Math.round(m[1]) }, eye: { x: Math.round(e[0]), y: Math.round(e[1]) } };
  return g;
}

/** Where parts moved apart, the colour they leave next to an empty pixel gets an outline; lone outline pixels go. */
function closeOutline(g, exempt = () => false) {
  const add = [];
  for (let y = 0; y < g.height; y++) for (let x = 0; x < g.width; x++) {
    if (g.get(x, y) !== null) continue;
    if (N4.some(([dx, dy]) => { const c = g.get(x + dx, y + dy); return c !== null && c !== OUTLINE && !exempt(x + dx, y + dy); })) add.push([x, y]);
  }
  for (const [x, y] of add) g.set(x, y, OUTLINE);
  for (let y = 0; y < g.height; y++) for (let x = 0; x < g.width; x++) {
    if (g.get(x, y) === OUTLINE && N8.every(([dx, dy]) => g.get(x + dx, y + dy) === null || g.get(x + dx, y + dy) === OUTLINE)
      && N4.every(([dx, dy]) => g.get(x + dx, y + dy) === null)) g.set(x, y, null);
  }
  return g;
}

/**
 * Problems with a frame: colours outside `palette` (default Poncho's 13), pixels on the frame's edge (the bottom row is
 * allowed), colour next to an empty pixel (an open outline). Returns a list of strings; empty is clean.
 */
export function check(grid, { palette = Object.values(COLOURS) } = {}) {
  const out = [];
  for (let y = 0; y < grid.height; y++) for (let x = 0; x < grid.width; x++) {
    const c = grid.get(x, y);
    if (c === null) continue;
    if (!palette.includes(c)) out.push(`colour ${c} at ${x},${y}`);
    if (x === 0 || y === 0 || x === grid.width - 1) out.push(`edge at ${x},${y}`);
    if (c !== OUTLINE && N4.some(([dx, dy]) => grid.get(x + dx, y + dy) === null && y + dy < grid.height)) out.push(`open outline at ${x},${y}`);
  }
  return out;
}

/** The parts' names and their z order, back to front, for the artists. */
export const PARTS = ['tail', 'legs', 'arm', 'poncho', 'skull', 'farEar', 'crown', 'face', 'nearEar', 'brim', 'paw'];
