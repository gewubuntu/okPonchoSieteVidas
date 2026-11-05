// Poncho's action poses (GDD-ART-04, GDD-ART-02, GDD-CMB-02, GDD-CMB-03, GDD-PWR-02, GDD-PWR-03): the claw swipe, hurt, eating,
// the Fuego spit and the victory cheer, built with the pose rig from the user's drawing. Facing right; the game mirrors them.
// `hand` is where a held item's middle goes (frame drawing px); `holds` says how the game draws a held taco or chile on the frame:
// 'paw' (no paw here: the game draws a paw holding it at `hand`), 'food' (his own paw is drawn: the food alone goes at `hand`, in
// the paw's grip) or 'none'.
import { COLOURS } from '../poncho-pixels.mjs';
import { check, pose, POSE_FRAME } from './rig.mjs';

export { POSE_FRAME };

/** Eye patches over the drawing's eye (its columns 35 to 43, rows 25 to 31), as the rig's EYES: '.' keeps the drawing's pixel. */
const EYE_PATCH = {
  /** Narrowed with intent: the brow pulled down to a lid line, the eye a two-row slit keeping its glint. */
  narrow: [
    'fffffwwwf',
    'fnnnnffwf',
    'fffnnnnnf',
    'ffFnnwnff',
    'fffFnnfff',
    'ffffffffw',
    '.........',
  ],
};
// The patch's top left against the rig's eye anchor (EYE minus EYE_AT in rig.mjs).
const EYE_PATCH_AT = { dx: -5, dy: -3 };

/** The grid with an eye patch painted over its eye. */
function withEyes(grid, name) {
  const { x, y } = grid.anchors.eye;
  EYE_PATCH[name].forEach((row, j) => [...row].forEach((ch, i) => {
    if (ch !== '.') grid.set(x + EYE_PATCH_AT.dx + i, y + EYE_PATCH_AT.dy + j, COLOURS[ch]);
  }));
  return grid;
}

/** Bristled with the shock: stiff and straight up from behind him, the tip high. */
const STIFF_TAIL = { path: [[22, 65], [14, 67], [8, 64], [5, 56], [4, 47], [4, 39]], tip: [4.2, 39.5] };

const OUTLINE = COLOURS['#'];
/**
 * The upright tail's fur standing on end: on rows y0 to y1 (every `step`th), its outline in columns x0 to x1 pushed out 1 px on
 * each side, the fur filling in behind it, so both edges go jagged. Only where the outside is empty, so the outline stays closed.
 */
function bristled(grid, { x0, x1, y0, y1, step = 3 }) {
  for (let y = y0; y <= y1; y += step) {
    const xs = [];
    for (let x = x0; x <= x1; x++) if (grid.get(x, y)) xs.push(x);
    if (xs.length < 4) continue;
    const [l, r] = [xs[0], xs[xs.length - 1]];
    for (const [edge, out] of [[l, -1], [r, 1]]) {
      const fur = grid.get(edge - out, y);
      if (grid.get(edge, y) !== OUTLINE || !fur || fur === OUTLINE) continue;
      if (grid.get(edge + out, y) || grid.get(edge + out, y - 1) || grid.get(edge + out, y + 1)) continue;
      grid.set(edge, y, fur);
      grid.set(edge + out, y, OUTLINE);
    }
  }
  return grid;
}

// ---- The front arm: short, tapered and bent, with a big paw (drawn here on top of pose()'s output, its root under the poncho).
// The paw is the drawing's paw (cream, its shade, toe lines) made bigger, 7 x 5, in three facings; '.' is empty. Its middle is
// PAW_MID; the claws are three white points, 2 px long, fanned out from its toes.
const PAWS = {
  fwd: { rows: ['.wwwww.', 'wwwwwpw', 'wwwwwww', 'wwwwwpw', '.ppppp.'], claws: [[7, 0], [8, -1], [7, 2], [8, 2], [7, 4], [8, 5]] },
  up: { rows: ['.wpwpw.', 'wwwwwww', 'wwwwwww', 'wwwwwwp', '.wwwpp.'], claws: [[1, -1], [0, -2], [3, -1], [3, -2], [5, -1], [6, -2]] },
  down: { rows: ['.wwwww.', 'wwwwwww', 'wwwwwwp', 'wwpwpwp', '.wpwpp.'], claws: [[1, 5], [0, 6], [3, 5], [3, 6], [5, 5], [6, 6]] },
};
const PAW_MID = [3, 2];
// What the arm goes under: the poncho's colours, and the outline along its edge.
const PONCHO = new Set(['b', 'd', 'r', 'c', 'W'].map((k) => COLOURS[k]));

/**
 * Draws the arm along `path` (frame px: the shoulder, the elbow if bent, the wrist), 5 px thick at the shoulder tapering to 3 at
 * the wrist: fur, its upper edge lit cream where it is thick, its underside shaded; then the paw facing `dir` with its middle at
 * `paw`, claws out with `claws`; outlined. Where the arm lies over the poncho (below row `under`), it stays under it.
 */
function drawArm(grid, { path, paw, dir, claws = false, under = 60 }) {
  const W = grid.width, H = grid.height;
  const local = new Map();
  const segs = path.slice(1).map((b, i) => ({ a: path[i], b }));
  let total = 0;
  for (const s of segs) { s.from = total; s.len = Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]); total += s.len; }
  // The light comes from the upper left: a pixel's offset from the arm's middle along (-1, -1) says lit or shaded.
  const L = [-Math.SQRT1_2, -Math.SQRT1_2];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const px = x + 0.5, py = y + 0.5;
    let best = null;
    for (const s of segs) {
      const dx = s.b[0] - s.a[0], dy = s.b[1] - s.a[1];
      const k = Math.max(0, Math.min(1, ((px - s.a[0]) * dx + (py - s.a[1]) * dy) / (s.len * s.len)));
      const cx = s.a[0] + k * dx, cy = s.a[1] + k * dy, d = Math.hypot(px - cx, py - cy);
      if (!best || d < best.d) best = { d, t: (s.from + k * s.len) / total, ox: px - cx, oy: py - cy };
    }
    const r = 2.6 - 0.9 * best.t;
    if (best.d > r) continue;
    const lit = best.ox * L[0] + best.oy * L[1];
    let c = COLOURS.f;
    if (lit < -(r - 1.2)) c = COLOURS.F;
    else if (lit > r - 1 && r > 2) c = COLOURS.w;
    local.set(`${x},${y}`, c);
  }
  const p = PAWS[dir];
  const ox = Math.round(paw[0]) - PAW_MID[0], oy = Math.round(paw[1]) - PAW_MID[1];
  p.rows.forEach((row, j) => [...row].forEach((ch, i) => { if (ch !== '.') local.set(`${ox + i},${oy + j}`, COLOURS[ch]); }));
  if (claws) for (const [i, j] of p.claws) local.set(`${ox + i},${oy + j}`, COLOURS.W);
  // The outline ring, outside only.
  const ring = new Set();
  for (const k of local.keys()) {
    const [x, y] = k.split(',').map(Number);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!local.has(`${x + dx},${y + dy}`)) ring.add(`${x + dx},${y + dy}`);
  }
  for (const k of ring) local.set(k, OUTLINE);
  // Under the poncho: its colours, and its outline where it borders them.
  const ponchoAt = (x, y) => y >= under && PONCHO.has(grid.get(x, y));
  const hidden = (x, y) => ponchoAt(x, y)
    || (y >= under && grid.get(x, y) === OUTLINE && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => ponchoAt(x + dx, y + dy)));
  const hide = new Set([...local.keys()].filter((k) => hidden(...k.split(',').map(Number))));
  for (const [k, c] of local) {
    if (hide.has(k)) continue;
    const [x, y] = k.split(',').map(Number);
    // An outline pixel of the arm next to a hidden part of it would cut across the poncho: leave the poncho's pixel.
    if (c === OUTLINE && grid.get(x, y) && [[1, 0], [-1, 0], [0, 1], [0, -1]].every(([dx, dy]) => !local.has(`${x + dx},${y + dy}`) || hide.has(`${x + dx},${y + dy}`) || local.get(`${x + dx},${y + dy}`) === OUTLINE)) continue;
    grid.set(x, y, c);
  }
  grid.hand = { x: Math.round(paw[0]), y: Math.round(paw[1]) };
  return grid;
}

const SPECS = {
  // GDD-CMB-02, the wind-up (2 steps): coiled and leaning back, the paw drawn back high behind his near shoulder, claws out.
  clawWind: {
    spec: {
      body: { dx: -3, squash: 2 },
      head: { dx: -1 },
      hat: { dx: 1, tilt: 8 },
      legs: 'stand',
      tail: 'low',
    },
    arm: { path: [[38, 71], [31, 70], [30, 65]], paw: [30, 61], dir: 'up', claws: true },
    eyes: 'narrow',
    holds: 'none',
  },
  // The strike (3 steps): lunging forward, the paw flung forward and down in front of his chest, claws out; the swipe goes over it.
  clawSwipe: {
    spec: {
      body: { dx: 3, squash: -1 },
      head: { dx: 1 },
      hat: { dx: -2, tilt: -8 },
      face: { eyes: 'normal', mouth: 'open' },
      legs: 'splay',
      tail: 'back',
    },
    arm: { path: [[71, 73], [79, 73]], paw: [82, 73], dir: 'fwd', claws: true },
    eyes: 'narrow',
    holds: 'none',
  },
  // The cooldown: the paw past the swing, low in front, settling; the hat a beat behind, still tipping forward.
  clawFollow: {
    spec: {
      body: { dx: 1, squash: 1 },
      hat: { dx: 1, tilt: 8 },
      legs: 'splay',
      tail: 'rest',
    },
    arm: { path: [[69, 78], [75, 83]], paw: [77, 86], dir: 'down', claws: true },
    holds: 'none',
  },
  // GDD-CMB-03, hurt: knocked back, eyes squeezed, a yelp, the tail up; the sombrero tips off.
  hurt0: {
    spec: {
      body: { dx: -3 },
      head: { dx: -2 },
      hat: { dx: -2, dy: -4, tilt: -16 },
      face: { eyes: 'squeeze', mouth: 'open' },
      legs: 'splay',
      tail: STIFF_TAIL,
    },
    after: (g) => bristled(g, { x0: 16, x1: 31, y0: 68, y1: 84 }),
    holds: 'none',
  },
  hurt1: {
    spec: {
      body: { dx: -4, squash: 1 },
      head: { dx: -2 },
      hat: { dx: -5, dy: -11, tilt: -32 },
      face: { eyes: 'squeeze', mouth: 'open' },
      legs: 'splay',
      tail: STIFF_TAIL,
    },
    after: (g) => bristled(g, { x0: 16, x1: 31, y0: 68, y1: 84 }),
    holds: 'none',
  },
  // GDD-PWR-02, GDD-PWR-03, eating: the paw brings the food up to his open mouth, eyes wide with delight; then the chomp.
  eat0: {
    spec: {
      head: { dy: -1 },
      face: { eyes: 'wide', mouth: 'open' },
      tail: 'up',
    },
    arm: { path: [[69, 72], [75, 72], [78, 67]], paw: [79, 64], dir: 'up' },
    holds: 'food',
  },
  eat1: {
    spec: {
      body: { squash: 2 },
      head: { dy: 1 },
      hat: { dy: -1 },
      face: { eyes: 'happy', mouth: 'puff' },
      tail: 'up',
    },
    arm: { path: [[69, 73], [75, 73], [78, 69]], paw: [79, 66], dir: 'up' },
    holds: 'food',
  },
  // GDD-PWR-03, the Fuego spit: leaning back a touch, the mouth open forward, eyes squeezed with the heat; the game draws the paw
  // and the chile at `hand`, in front of his chest.
  spit: {
    spec: {
      body: { dx: -2 },
      head: { dx: -1, dy: -1 },
      hat: { dx: -1, dy: -2, tilt: -16 },
      face: { eyes: 'squeeze', mouth: 'open' },
      tail: 'back',
      hand: { dx: -2, dy: 4 },
    },
    holds: 'paw',
  },
  // The victory cheer: the food thrust straight up over his head, a happy closed-eye smile, stretched up; then a squash bounce.
  victory0: {
    spec: {
      body: { squash: -3 },
      hat: { dx: -3, dy: 0, tilt: -16 },
      face: 'happy',
      legs: 'tuck',
      tail: 'up',
    },
    arm: { path: [[70, 70], [78, 69], [83, 57]], paw: [84, 53], dir: 'up' },
    holds: 'food',
  },
  victory1: {
    spec: {
      body: { squash: 2, widen: 1 },
      hat: { dx: -3, dy: 0, tilt: -16 },
      face: 'happy',
      legs: 'splay',
      tail: 'up',
    },
    arm: { path: [[71, 73], [79, 72], [84, 60]], paw: [85, 56], dir: 'up' },
    holds: 'food',
  },
};

export const LOOKS = Object.keys(SPECS);

export function drawFrames() {
  return Object.entries(SPECS).map(([look, { spec, eyes, arm, after, holds }]) => {
    const grid = pose(spec);
    if (eyes) withEyes(grid, eyes);
    if (arm) drawArm(grid, arm);
    after?.(grid);
    const problems = check(grid);
    if (problems.length) throw new Error(`${look}: ${problems.slice(0, 3).join('; ')}`);
    return { look, grid, hand: grid.hand, holds };
  });
}
