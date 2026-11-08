// Poncho's action poses (GDD-ART-04, GDD-ART-02, GDD-CMB-02, GDD-CMB-03, GDD-PWR-02, GDD-PWR-03): the claw swipe, hurt, eating,
// the Fuego spit and the victory cheer, built with the pose rig from the user's drawing. Facing right; the game mirrors them.
// `hand` is where a held item's middle goes (frame drawing px); `holds` says how the game draws a held taco or chile on the frame:
// 'paw' (no paw here: the game draws a paw holding it at `hand`), 'food' (his own paw is drawn: the food alone goes at `hand`, in
// the paw's grip) or 'none'. The eat and spit frames also give `mouth` (where the crumbs and the flame burst go). The victory frames
// are the front view: they give `sparkle` (the celebration's stars, drawn on top) and `mirror: false` (not flipped for the left).
import { Grid } from '../raster.mjs';
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

/**
 * Mouth patches over the drawing's snout and jaw (its columns 41 to 50, rows 32 to 42), placed by the rig's mouth anchor: '.'
 * keeps the drawing's pixel, '_' clears it. They reach past the drawing's chin, so each brings its own outline there.
 */
const MOUTH_PATCH = {
  /** Cheeks puffed full of fire: the jaw bulges forward and down round a tight little mouth. */
  puffed: [
    '..........',
    '..........',
    '......ww#.',
    '....nwwww#',
    '.....wwww#',
    '....wwwwp#',
    '...wwwwpp#',
    '..wwwppp#_',
    'ppppppp##_',
    '#######...',
    '..........',
  ],
  /** Wide open forward, the fire's way out: the upper lip under the nose, the jaw dropped, the tongue. */
  gape: [
    '..........',
    '..........',
    'wwwwwww##_',
    'wwwnnnnnn#',
    'wwnnnnnnn#',
    'wwwnccccn#',
    'wwwwnnccn#',
    'pwwwwwnnn#',
    'ppwwwwww#_',
    '#ppppppp#_',
    '.#######__',
  ],
};
// The patch's top left against the rig's mouth anchor (the drawing's (47, 35)).
const MOUTH_PATCH_AT = { dx: -6, dy: -3 };

/** The grid with a mouth patch painted over its snout and jaw. */
function withMouth(grid, name) {
  const { x, y } = grid.anchors.mouth;
  MOUTH_PATCH[name].forEach((row, j) => [...row].forEach((ch, i) => {
    const px = x + MOUTH_PATCH_AT.dx + i, py = y + MOUTH_PATCH_AT.dy + j;
    if (ch === '_') grid.set(px, py, null);
    else if (ch !== '.') grid.set(px, py, COLOURS[ch]);
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

// ---- The front view, for the victory cheer (GDD-ART-02: the sprite references guide the poses the main drawing does not show). It
// follows the user's front views (assets/characters/poncho/front/, 06-standing-front.jpg the main one; the raised fist of 14, 15 and
// 17) in the side drawing's palette, outline and three-shade shading, its rows lined up with the side's (the crown's top, the brim's
// underside at the face, the chin, the poncho's hem, the feet):
//   the sombrero: a tall egg of a crown, red with a blue band; the wide brim seen a little from below, the side's tan rim, blue,
//     red teeth (the side's 5 px period) rising into it from the red underside band, crimson under; the right side in shade;
//   the ears: the side drawing's near ear and its mirror, standing up beside the crown;
//   the face: wide and shield-shaped, its cheeks angling in to a rounded chin; ginger, tan patches round big round dark eyes with
//     glints under furrowed brows, a cream blaze and lower face, blush, a small nose and a "w" mouth; the brim's shadow, the right
//     side and the jaw in shade;
//   the poncho: a V neck, a red chevron of white and blue triangles, a blue field of white triangles and red dots, the red hem
//     band of triangles along its V hem, side panels over his arms ending in red fringe, the badge on his right chest (fur
//     colours: there is no gold in his palette); the right third in shade, a fold where each side panel hangs;
//   cream paws at his sides under the side panels, short ginger legs with cream feet, the tail curling up to one side.
// Local px: the figure's middle is between columns 29 and 30, his feet on row 70. Each part is outlined over the parts behind it.
// The front view is not mirrored for a run to the left.
const FRONT = {
  crown: { x: 20, y: 1, rows: [
    '.......rrccc.......',
    '.....rrrrrrccc.....',
    '....kkrrrrrrccc....',
    '...rkkrrrrrrrccc...',
    '..rrkkrrrrrrccccc..',
    '..rrkkrrrrrrrcccc..',
    '.rrrrrrrrrrrrccccc.',
    '.rrrrrrrrrrrrrcccc.',
    '.rrrrrrrrrrrrrcccc.',
    'bbbbbbbbbbbbbbddddd',
    'bbbbbbbbbbbbbbddddd',
    'rrrrrrrrrrrrrrccccc',
    'rrrrrrrrrrrrrrrcccc',
    'rrrrrrrrrrrrrrrcccc',
    'rrrrrrrrrrrrrrrcccc',
  ] },
  ears: { x: 8, y: 4, rows: [
    '.....ff..............................ff.....',
    '....Ffff............................fffF....',
    '...Fffcwf..........................fwcffF...',
    '...fffckw..........................wkcfff...',
    '..Fffckkwf........................fwkkcffF..',
    '..Fffckkkw........................wkkkcffF..',
    '.FFfckkkkwf......................fwkkkkcfFF.',
    '.Fffckkkkkw......................wkkkkkcffF.',
    'cFffckkkkk........................kkkkkcffFc',
    'FFffckkc............................ckkcffFF',
    'FFffF..................................FffFF',
    'FF........................................FF',
  ] },
  brim: { x: 0, y: 15, rows: [
    '....................sssssssssssssssssss.....................',
    '................ssssbbbbbbbbbbbbbbbbbbbssss.................',
    '.............sssbbbbbbbbbbbbbbbbbbbbbbbbbbbsss..............',
    '...........ssbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbss............',
    '........sssbbbbbbbbbrbbbrrbbbrrbbbrrbbbbbbbbbbbbsss.........',
    '......ssbbbbbbbbbbbrrbbbrrbbbrrbbbrrbbbrrbbbbbbbbbbss.......',
    '....ssbbbbbbbbrrbbbrrrbrrrrbrrrrbrrrrbrrrbbbrrbbbbbddss.....',
    '...sbbbbbbrbbbrrrbrrrrrrrrrrrrrrrrrrrrrrrrbbrrbbbbbdddds....',
    '.ssbbbbbbrrbbrrrrrrrcccccccccccccccccccrrrrrrrrbbrrdddddss..',
    'sbbbbrbbbrrrrrrrcccc...................ccccrrrrbrrrddddddds.',
    'bbbbrrbbrrrrcccc...........................ccccrrrrdddccddds',
    'bbbbrrrbrrcc...................................ccrrcdcccdddd',
    'rbbrrrrrcc.......................................cccccccdddd',
    'rbbrrccc...........................................ccccccddc',
    'rrrcc.................................................cccdcc',
    'rrc.....................................................cccc',
    'cc.......................................................ccc',
    '...........................................................c',
  ] },
  head: { x: 8, y: 19, rows: [
    '.FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF.',
    '.FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF.',
    '.FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF.',
    '.FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF.',
    '.FFFFFFFFFFFFFFFFFFFpppFFFFFFFFFFFFFFFFFFF.',
    '.FFFFFFFFFFFFFFFFFFFpppFFFFFFFFFFFFFFFFFFF.',
    '.FFFFFFFFFFFFFFFFFFFpwpFFFFFFFFFFFFFFFFFFF.',
    '.FFFFFFFFFFFsssssssfwwwfsssssssFFFFFFFFFFF.',
    '.FFFFFFFsssssssssssswwwssssssssssssFFFFFFF.',
    '.FFFffffsssssssssssswwwssssssssssssffffFFF.',
    '.FffffffsssssssssssswwwssssssssssssffffssF.',
    '.sfffffsssssssssssswwwwwssssssssssssfffssF.',
    'sfffffffssssssssssswwwwwsssssssssssfffffssF',
    'sfffffffssssssssssswwwwwsssssssssssfffffssF',
    '..sfffffssssssssswwwwwwwwwsssssssssffssFF..',
    '...ssffffssssswwwwwwwwwwwwwwwsssssffssFF...',
    '....ssfffffswwwwwwwwwwwwwwwwwwwsfffssFF....',
    '......sfffwwwwwwwwwwwwwwwwwwwwwwwfssF......',
    '.......swwwwwwwwwwwwwwwwwwwwwwwwwwpF.......',
    '.........wwwwwwwwwwwwwwwwwwwwwwwpp.........',
    '...........wwwwwwwwwwwwwwwwwwwpp...........',
    '..............ppppppppppppppp..............',
    '.....................p.....................',
  ] },
  poncho: { x: 9, y: 41, rows: [
    '............WrrbbdFFFFFFdbbrrW............',
    '..........dbWWWrbbdFFFFdbbrWWWdd..........',
    '........ccrbbWWWrrbdssdbrrWWWddrcc........',
    '.......nbbcrrWWWWbrrddrrbWWWWrrcddn.......',
    '.....dbnbbbccrrbbbWWrrWWbbbrrccdddndd.....',
    '...dbbbnbbbbbccrbbbWWWWbbbrccdddddndddd...',
    '.dbbbbbnbbbbbbbcrrbbWWbbrrcbddddddndddddd.',
    'dbbbbrbnbbbbbbbbccrrWWrrccbbddddddndrddddd',
    'dbbbbbbnbbbbbbbbbbccrrccbbbbddddddnddddddd',
    'dbbbbbbnbbbWbbbbbbbbccbbbbbbddWdddnddddddd',
    'dbbbbbbnbbWWWbbbbbbbbbbbbbbbdWWWddnddddddd',
    'rrrrrrrrrWWWWWbbrbbbbbbbbrbbWWWWWrrrrccccc',
    'WbbbbbWWbrWWWWWbbbbbbbbbbbbWWWWWrdWWdddddW',
    'WWbbbWWWWbrrbbbbbbbbWWbbbbbbddrrdWWWWdddWW',
    'WWWbWWWWWbbbrrbbbbbWWWWbbbbbrrdddWWWWWdWWW',
    'rrrrrrrrrWbbbWrbbbWWWWWWbbbrWdddWrrrrccccc',
    'cccccccccrbWWWWrrWWWWWWWWrrWWWWdrccccccccc',
    '.c.r.c...crrWWWbbrbbbbbbrbbWWWrrc...c.r.c.',
    '.c.r.c....ccrrWWbbrrbbrrbbWWrrcc....c.r.c.',
    '.c.r.c......ccrWWbbbrrbbbWWrcc......c.r.c.',
    '...r..........crrbbWWWWbbrrc..........r...',
    '...............ccrWWWWWWrcc...............',
    '.................crrWWrrc.................',
    '..................ccrrcc..................',
    '....................cc....................',
  ] },
  ponchoLift: { x: 9, y: 41, rows: [
    '............WrrbbdFFFFFFdbbrrW..............',
    '..........dbWWWrbbdFFFFdbbrWWWdd............',
    '........ccrbbWWWrrbdssdbrrWWWddrcc..........',
    '.......nbbcrrWWWWbrrddrrbWWWWrrcddn.........',
    '.....dbnbbbccrrbbbWWrrWWbbbrrccdddndd.......',
    '...dbbbnbbbbbccrbbbWWWWbbbrccddddrrrrcc.....',
    '.dbbbbbnbbbbbbbcrrbbWWbbrrcbddddddWWdddddW..',
    'dbbbbrbnbbbbbbbbccrrWWrrccbbddddrWWWWdddWWW.',
    'dbbbbbbnbbbbbbbbbbccrrccbbbbdddddWWWWWdWWWWW',
    'dbbbbbbnbbbWbbbbbbbbccbbbbbbddWddrrrrccccccc',
    'dbbbbbbnbbWWWbbbbbbbbbbbbbbbdWWrWccccccccccc',
    'rrrrrrrrrWWWWWbbrbbbbbbbbrbbWWWdr...c.r.c.r.',
    'WbbbbbWWbrWWWWWbbbbbbbbbbbbWWWrdc...c.r.c.r.',
    'WWbbbWWWWbrrbbbbbbbbWWbbbbbbdddd....c.r.c.r.',
    'WWWbWWWWWbbbrrbbbbbWWWWbbbbbrrdr......r...r.',
    'rrrrrrrrrWbbbWrbbbWWWWWWbbbrWdWc............',
    'cccccccccrbWWWWrrWWWWWWWWrrWWWr.............',
    '.c.r.c...crrWWWbbrbbbbbbrbbWWWc.............',
    '.c.r.c....ccrrWWbbrrbbrrbbWWrr..............',
    '.c.r.c......ccrWWbbbrrbbbWWrcc..............',
    '...r..........crrbbWWWWbbrrc................',
    '...............ccrWWWWWWrcc.................',
    '.................crrWWrrc...................',
    '..................ccrrcc....................',
    '....................cc......................',
  ] },
  legs: { x: 21, y: 59, rows: [
    'fffffsF....Fsfffff',
    'fffffsF....Fsfffff',
    'fffffsF....Fsfffff',
    'fffffsF....Fsfffff',
    'fffffsF....Fsfffff',
    'fffffsF....Fsfffff',
    'fffffsF....Fsfffff',
    'ffffssF....Fssffff',
    'wwwwwwp....pwwwwww',
    'wpwwpwp....pwpwwpw',
    'wpwwpwp....pwpwwpw',
    'ppppppp....ppppppp',
  ] },
  paws: { x: 14, y: 58, rows: [
    '.wwwww....................wwwww.',
    'wwwwwwp..................wwwwwww',
    'wwwwwwp..................wwwwwww',
    'pwpwpwp..................wwpwpwp',
    '.ppppp....................ppppp.',
  ] },
  tailRight: { x: 38, y: 43, rows: [
    '...........w......',
    '.........wwwww....',
    '.........wwwwp....',
    '.........wwwppw...',
    '.........wwpppww..',
    '...........pwwwws.',
    '.............wwfs.',
    '.............wffs.',
    '..............ffs.',
    '..............fffs',
    '..............fffs',
    '..............fffs',
    '..............ffs.',
    '.............fffs.',
    '.............fffs.',
    '.............ffs..',
    '...........ffffs..',
    '.ffs......fffffs..',
    'FFFFFFFFFFFFFFF...',
    'FFFFFFFFFFFFF.....',
    '.FFFFFFFFFFF......',
    '.......FFF........',
  ] },
  tailUpLeft: { x: 5, y: 37, rows: [
    '...www..........',
    '..wwwww.........',
    '..wwwwp.........',
    '..wwwpp.........',
    '.wwwpp..........',
    '.wwww...........',
    'fwww............',
    'fffs............',
    'fffs............',
    'fffs............',
    'fffs............',
    'fffs............',
    'fffs............',
    'fffs............',
    'fffs............',
    'fffs............',
    '.ffs............',
    '.ffs............',
    '.ffs............',
    '.fffs...........',
    '.fffs...........',
    '.ffffs..........',
    '..ffffs.........',
    '...fffffffffffs.',
    '....FFFFFFFFFFFF',
    '.....FFFFFFFFFFF',
    '......FFFFFFFFF.',
  ] },
};
/** Face, badge and fist stamps on the front view (local px). The eyes keep their glints up left in both eyes. */
// The viewer's left eye and its brow: a 2 px brow slanting down toward the nose, cutting the eye's top on a slope (half-lidded,
// determined, as the user's front views and the side drawing's furrowed brow have it); the dark eye 7 px wide and 5 tall under it,
// a glint at its upper left and a small one low right. The other eye mirrors it, its glints kept at the upper left (the light).
const FRONT_EYE_L = [
  'nn.........',
  'nnnn.......',
  '..nnnnn....',
  '...nnnnnnn.',
  '...nwwnnnnn',
  '...nwwnnnn.',
  '...nnnnnwn.',
  '....nnnnn..',
];
const FRONT_EYE_R = FRONT_EYE_L.map((r) => [...r.replace(/w/g, 'n')].reverse().join(''))
  .map((r, j) => (j === 4 || j === 5 ? `${r.slice(0, 2)}ww${r.slice(4)}` : j === 6 ? `${r.slice(0, 5)}w${r.slice(6)}` : r));
const FRONT_NOSE = ['nnnn', '.nn.'];
const FRONT_MOUTHS = {
  stern: ['nn..nn', '..nn..'],
  smile: ['n......n', '.nn..nn.', '...nn...'],
};
const FRONT_BADGE = ['######', '#wfff#', '#fFFf#', '######'];
const FRONT_FIST = [
  '.wwwww.',
  'wwpwpww',
  'wwpwpww',
  'wwwwwwp',
  'pwwwwpp',
  '.ppppp.',
];
const FRONT_X = 18, FRONT_Y = 24; // local to frame px: his middle on the frame's middle, his feet on its bottom row
const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const pxKey = (x, y) => `${x},${y}`;
const pxAt = (k) => k.split(',').map(Number);

/** A part's pixels {"x,y": colour} in local px, only the columns `keep` accepts, moved `dx` across. */
function frontPart({ x: px = 0, y: py, rows }, keep = () => true, dx = 0) {
  const m = new Map();
  rows.forEach((r, j) => [...r].forEach((ch, i) => {
    if (ch !== '.' && keep(px + i)) m.set(pxKey(px + i + dx, py + j), ch === '#' ? OUTLINE : COLOURS[ch]);
  }));
  return m;
}
function stampPx(m, rows, x0, y0) {
  rows.forEach((r, j) => [...r].forEach((ch, i) => { if (ch !== '.') m.set(pxKey(x0 + i, y0 + j), ch === '#' ? OUTLINE : COLOURS[ch]); }));
}
/** A raised arm along `path` (local px), 5 px thick at the shoulder to 4 at the wrist: fur, lit cream on its left, shaded right. */
function frontArm(path) {
  const m = new Map();
  const segs = path.slice(1).map((b, i) => ({ a: path[i], b }));
  let total = 0;
  for (const s of segs) { s.from = total; s.len = Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]); total += s.len; }
  const xs = path.map((p) => p[0]), ys = path.map((p) => p[1]);
  for (let y = Math.floor(Math.min(...ys)) - 3; y <= Math.max(...ys) + 3; y++) for (let x = Math.floor(Math.min(...xs)) - 3; x <= Math.max(...xs) + 3; x++) {
    const px = x + 0.5, py = y + 0.5;
    let best = null;
    for (const s of segs) {
      const dx = s.b[0] - s.a[0], dy = s.b[1] - s.a[1];
      const k = Math.max(0, Math.min(1, ((px - s.a[0]) * dx + (py - s.a[1]) * dy) / (s.len * s.len)));
      const d = Math.hypot(px - s.a[0] - k * dx, py - s.a[1] - k * dy);
      if (!best || d < best.d) best = { d, t: (s.from + k * s.len) / total, ox: px - s.a[0] - k * dx };
    }
    const r = 2.7 - 0.5 * best.t;
    if (best.d > r) continue;
    m.set(pxKey(x, y), best.ox > r - 1.3 ? COLOURS.s : best.ox < -(r - 1.1) ? COLOURS.w : COLOURS.f);
  }
  return m;
}

/**
 * The front view posed: `lift` px up (a hop), `squash` local rows taken out of everything above the legs, the legs 'stand',
 * 'tuck' (3 rows shorter) or 'apart' (2 px out each, bent 2 rows shorter), the tail 'tailRight' or 'tailUpLeft', a mouth from
 * FRONT_MOUTHS, `sway` px across. With `fist` ({ path, at }: the arm from under the poncho to the wrist, the fist's middle; local
 * px) his left arm (the viewer's right) is raised, the poncho's side panel lifted over it; otherwise both paws are at his sides.
 */
function frontPose({ lift = 0, squash = [], legs = 'stand', tail = 'tailRight', mouth = 'stern', fist = null, sway = 0 }) {
  const drop = { tuck: 3, apart: 2 }[legs] ?? 0, spread = legs === 'apart' ? 2 : 0;
  const body = (y) => (squash.includes(y) ? null : y + squash.filter((r) => r > y).length + drop);
  const head = frontPart(FRONT.head);
  stampPx(head, FRONT_EYE_L, 16, 27); stampPx(head, FRONT_EYE_R, 33, 27);
  stampPx(head, ['kkk', 'kkk'], 13, 35); stampPx(head, ['kkk', 'kkk'], 44, 35);
  stampPx(head, FRONT_NOSE, 28, 35);
  const mo = FRONT_MOUTHS[mouth];
  stampPx(head, mo, 30 - mo[0].length / 2, 37);
  const poncho = frontPart(fist ? FRONT.ponchoLift : FRONT.poncho);
  stampPx(poncho, FRONT_BADGE, 34, 43);
  const legRows = { ...FRONT.legs, y: FRONT.legs.y + drop, rows: FRONT.legs.rows.slice(drop) };
  const fistMap = new Map();
  if (fist) stampPx(fistMap, FRONT_FIST, fist.at[0] - 3, fist.at[1] - 3);
  // Back to front: [pixels, is it the legs].
  const layers = [
    [frontPart(FRONT[tail]), false],
    [frontPart(legRows, (x) => x < 30, -spread), true],
    [frontPart(legRows, (x) => x >= 30, spread), true],
    [frontPart(FRONT.paws, (x) => !fist || x < 30), false],
    [frontPart(FRONT.ears), false],
    [fist ? frontArm(fist.path) : new Map(), false],
    [poncho, false],
    [head, false],
    [frontPart(FRONT.crown), false],
    [frontPart(FRONT.brim), false],
    [fistMap, false],
  ];
  const grid = new Grid(POSE_FRAME.w, POSE_FRAME.h);
  const oy = FRONT_Y - lift;
  for (const [m0, isLegs] of layers) {
    // The body sits on the legs, sways and squashes by whole rows before it is outlined.
    const m = new Map();
    for (const [k, c] of m0) {
      const [x, y] = pxAt(k), ny = isLegs ? y : body(y);
      if (ny !== null) m.set(pxKey(x + (isLegs ? 0 : sway), ny), c);
    }
    const ring = new Map(m);
    for (const k of m.keys()) { const [x, y] = pxAt(k); for (const [dx, dy] of N4) if (!m.has(pxKey(x + dx, y + dy))) ring.set(pxKey(x + dx, y + dy), OUTLINE); }
    for (const [k, c] of ring) { const [x, y] = pxAt(k); grid.set(x + FRONT_X, y + oy, c); }
  }
  // The hand anchor: the raised fist's middle, or in front of his chest.
  const at = fist ? fist.at : [29, 50];
  grid.hand = { x: at[0] + sway + FRONT_X, y: body(at[1]) + oy };
  return grid;
}

/**
 * The celebration's sparkles, a grid of their own drawn over him: four-point stars at frame px [x, y, arm], a white heart (a
 * 3 x 3 diamond) and thin white points with cream tips, ringed in his crimson so they read on the gold and on the pale blue.
 */
function sparkles(stars) {
  const g = new Grid(POSE_FRAME.w, POSE_FRAME.h);
  for (const [x, y, arm] of stars) {
    const pts = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]];
    for (let i = 2; i <= arm; i++) pts.push([i, 0], [-i, 0], [0, i], [0, -i]);
    for (const [dx, dy] of pts) for (const [ex, ey] of N4) if (!g.get(x + dx + ex, y + dy + ey)) g.set(x + dx + ex, y + dy + ey, COLOURS.c);
    for (const [dx, dy] of pts) g.set(x + dx, y + dy, arm > 1 && Math.abs(dx) + Math.abs(dy) === arm ? COLOURS.w : COLOURS.W);
    if (arm > 1) for (const [dx, dy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) g.set(x + dx, y + dy, COLOURS.w);
  }
  return g;
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
  // GDD-PWR-02, GDD-PWR-03, eating: a little hop up, stretched, reaching for the bite with the mouth open and eyes wide; then the
  // chomp, a deep squash with the mouth shut on it and eyes happily shut. The game draws the whole taco at `hand` in eat0, the
  // bitten one in eat1, and the crumbs at `mouth`.
  eat0: {
    spec: {
      body: { squash: -2 },
      head: { dy: -1 },
      hat: { dy: 1 },
      face: { eyes: 'wide', mouth: 'open' },
      legs: 'tuck',
      tail: 'up',
    },
    arm: ({ x, y }) => ({ path: [[69, y + 13], [75, y + 13], [78, y + 8]], paw: [79, y + 5], dir: 'up' }),
    holds: 'food',
  },
  eat1: {
    spec: {
      body: { squash: 4, widen: 2 },
      head: { dy: 1 },
      hat: { dy: -2 },
      face: { eyes: 'happy', mouth: 'puff' },
      legs: 'splay',
      tail: 'up',
    },
    arm: ({ x, y }) => ({ path: [[71, y + 11], [77, y + 11], [80, y + 7]], paw: [81, y + 4], dir: 'up' }),
    holds: 'food',
  },
  // GDD-PWR-03, the Fuego spit, two frames: the wind-up, leaning well back with his cheeks puffed full and eyes squeezed; then the
  // blast, leaning in with the mouth wide open forward, the hat blown back. The game draws the paw and the chile at `hand` and the
  // flame burst at `mouth` (the front of the open mouth).
  spit0: {
    spec: {
      body: { dx: -3, squash: 1 },
      head: { dx: -2, dy: -1 },
      hat: { dx: 1, dy: 0, tilt: 8 },
      face: { eyes: 'squeeze', mouth: 'closed' },
      legs: 'stand',
      tail: 'low',
      hand: { dx: -4, dy: 4 },
    },
    mouthPatch: 'puffed',
    mouthAt: { dx: 2, dy: 1 },
    holds: 'paw',
  },
  spit1: {
    spec: {
      body: { dx: 3, squash: -1 },
      head: { dx: 2, dy: 0 },
      hat: { dx: -3, dy: -3, tilt: -16 },
      face: { eyes: 'squeeze', mouth: 'closed' },
      legs: 'splay',
      tail: 'back',
      hand: { dx: 0, dy: 4 },
    },
    mouthPatch: 'gape',
    mouthAt: { dx: 3, dy: 2 },
    holds: 'paw',
  },
  // The victory cheer, in the front view (FRONT): a confident fist raised beside his head on a short bent arm, as the user's front
  // views have it. A hop (legs tucked, the tail up, his poncho's side panel lifted with the arm), then the landing (a squash, feet
  // apart, the fist a beat higher, the tail swung over); a confident smile and bright determined eyes. Sparkles twinkle round him.
  victory0: {
    front: { lift: 6, legs: 'tuck', tail: 'tailUpLeft', mouth: 'smile', fist: { path: [[45, 47], [51, 46], [51.5, 38]], at: [51, 34] } },
    stars: [[8, 26, 3], [86, 22, 2], [9, 58, 2], [86, 60, 3]],
    holds: 'none',
  },
  victory1: {
    front: { squash: [52, 38, 17], legs: 'apart', tail: 'tailRight', mouth: 'smile', fist: { path: [[45, 47], [51, 46], [51.5, 36]], at: [51, 32] } },
    stars: [[86, 30, 3], [10, 38, 2], [12, 18, 2], [8, 66, 3]],
    holds: 'none',
  },
  // The front view standing, for checking it against the side view and the user's front views (not played by the game).
  frontStand: { front: {}, stars: [], holds: 'none' },
};

export const LOOKS = Object.keys(SPECS);

export function drawFrames() {
  return Object.entries(SPECS).map(([look, { spec, front, stars, eyes, mouthPatch, mouthAt, arm, after, holds }]) => {
    if (front) {
      // The front view: drawn as it is for both directions (no mirroring); `sparkle` is drawn on top.
      const grid = frontPose(front);
      const sparkle = sparkles(stars);
      const problems = [...check(grid), ...check(sparkle).filter((p) => !p.startsWith('open'))];
      if (problems.length) throw new Error(`${look}: ${problems.slice(0, 3).join('; ')}`);
      return { look, grid, hand: grid.hand, holds, sparkle, mirror: false };
    }
    const grid = pose(spec);
    if (eyes) withEyes(grid, eyes);
    if (mouthPatch) withMouth(grid, mouthPatch);
      if (arm) drawArm(grid, typeof arm === 'function' ? arm(grid.anchors.mouth) : arm);
    after?.(grid);
    const problems = check(grid);
    if (problems.length) throw new Error(`${look}: ${problems.slice(0, 3).join('; ')}`);
    const m = grid.anchors.mouth;
    const frame = { look, grid, hand: grid.hand, holds };
    // Where the crumbs (eating) and the flame burst (the spit) are drawn.
    if (/^(eat|spit)/.test(look)) frame.mouth = { x: m.x + (mouthAt?.dx ?? 0), y: m.y + (mouthAt?.dy ?? 0) };
    return frame;
  });
}
