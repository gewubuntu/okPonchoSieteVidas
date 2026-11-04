// The Tlacuache, World 1's opossum (GDD-ENM-02), the trickster who stole fire and carried it in its tail: grizzled purple fur with a
// frosted back, a white pointed face with a sly eye and a smirk, round dark ears, and the long bare tail with the fire's scorch near its
// tip. Drawn from hand-placed pixel maps (one letter a drawing pixel), composed per frame and outlined (GDD-ART-05), in World 1's
// colours only (GDD-ART-06). Facing right; the frame's bottom row is left empty for the outline, the hands stand on row 29.
import { Grid } from '../raster.mjs';
import { W1, OUTLINE, flashed, shifted } from './kit.mjs';

export const FRAME = { w: 56, h: 32 };
export const BOX = { x0: 12, y0: 12, x1: 44, y1: 32 };
export const LOOKS = ['walk0', 'walk1', 'walk2', 'walk3', 'tele', 'teleRed', 'run0', 'run1', 'run2', 'run3', 'dead', 'deadTwitch', 'squash', 'hit'];

/** The pixel maps' letters: k outline (pupils, mouths, X eyes), W/S the face and eye whites, c frost and the bare tail, p fur, n shade and
 * ears, b the near legs' lit edge, r nose and shade, e mouth inside and scorch, R tongue. */
const KEY = {
  k: OUTLINE, W: W1.cloudTop, S: W1.sunDisc, c: W1.cloudUnder, p: W1.purple, n: W1.navy, b: W1.blue, r: W1.rust, e: W1.earthDark, R: W1.red,
};

/** Paints a pixel map (rows of KEY letters, '.' empty) with its top left at (ox, oy), column x moved down by dy(x). */
function stamp(g, rows, ox, oy, dy = () => 0) {
  rows.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch !== '.') g.set(ox + x, oy + y + dy(x), KEY[ch]);
  }));
}

/** The walking body, head and ear, facing right; legs and tail are added per frame. Top left at (10, 11). */
const BODY_WALK = [
  '.....................ccn',
  '....................cnnnn',
  '.........cccccc.....cnnnnn',
  '......ccccccccccc...nnnnnnWW',
  '....cccccccccccccpppnnnnnWWWW',
  '..ccccpccccpcccppppppnnnWWWWWW',
  '.cccppppccppccpppppppnWWWWWWWW',
  'cccppppppppppppppppppWWWWnnnnWWW',
  'ccpppppppppppppppppppWWWnSSkkWWWW',
  'cpppppppppppppppppppWWWWnSkkkWWWWWW',
  'cppppppppppppppppppppcWWWWkkWWWWWrr',
  'pppppppppppppppppppnnpccWWWWWkkkkkrr',
  '.ppnnnnnnnnnnnnnnnnnnnnccWWWWWWW',
  '...nnnnnnnnnnnnnnnnnnnnnnccc',
];

/** A map made longer by repeating its column `col` `n` more times (a clean stretch). */
const widen = (rows, col, n) => rows.map((r) => (r.length > col ? r.slice(0, col) + r[col].repeat(n) + r.slice(col) : r));

/** A leg from its hip (hx, hy) to its hand on the floor at fx (the hand's back pixel), lifted `lift` px; near legs have a blue lit edge. */
function leg(g, hx, hy, fx, lift, near) {
  const fy = 29 - lift;
  for (let y = hy; y < fy; y++) {
    const x = Math.round(hx + ((fx - hx) * (y - hy)) / Math.max(1, fy - 1 - hy));
    g.set(x, y, KEY[near ? 'b' : 'n']);
    g.set(x + 1, y, KEY.n);
  }
  const hand = near ? ['c', 'c', 'c'] : ['r', 'r', 'r'];
  hand.forEach((ch, i) => g.set(fx + i, fy, KEY[ch]));
}

/** A bare tail along hand-placed centre pixels from base to tip, 2 px thick then 1 px at the tip: furred dark for its first third,
 * then bare cloudUnder with a rust shade, and a 2 x 2 scorch (the fire it carried) just before the tip. */
function tail(g, pts) {
  const n = pts.length;
  pts.forEach(([x, y], i) => {
    const [nx, ny] = pts[Math.min(i + 1, n - 1)], [px0, py0] = pts[Math.max(i - 1, 0)];
    const horiz = Math.abs(nx - px0) >= Math.abs(ny - py0);
    const [sx, sy] = horiz ? [x, y + 1] : [x + 1, y];
    let top = 'c', shade = 'r';
    if (i < n * 0.3) [top, shade] = ['n', 'n'];
    else if (i === n - 5 || i === n - 4) [top, shade] = ['r', 'e'];
    g.set(x, y, KEY[top]);
    if (i < n - 3) g.set(sx, sy, KEY[shade]);
  });
}

/** The waddle, 4 frames: legs in diagonal pairs, the body up on the passing frames, a 1 px roll, the tail swinging a frame behind. */
function walk(i) {
  const g = new Grid(FRAME.w, FRAME.h);
  const bob = i % 2 ? 0 : 1;
  // The waddle: the rump rolls down on one step and the head on the next (a 1 px shear about the middle).
  const roll = [1, 0, -1, 0][i];
  // The tail swings once a stride, a frame behind the roll: its curl up, level, down, level.
  const swing = [0, -1, 0, 1][i];
  const TAIL_WALK = {
    [-1]: [[13, 20], [12, 21], [11, 21], [10, 22], [9, 22], [8, 22], [7, 22], [6, 22], [5, 21], [4, 20], [4, 19], [4, 18], [5, 17], [6, 17]],
    0: [[13, 20], [12, 21], [11, 21], [10, 22], [9, 22], [8, 23], [7, 23], [6, 23], [5, 23], [4, 22], [3, 21], [3, 20], [3, 19], [4, 18], [5, 18]],
    1: [[13, 20], [12, 21], [11, 22], [10, 22], [9, 23], [8, 23], [7, 24], [6, 24], [5, 24], [4, 24], [3, 23], [3, 22], [3, 21], [4, 20], [5, 20]],
  };
  tail(g, TAIL_WALK[swing].map(([x, y]) => [x, y + bob]));
  // Each leg's hand offset through the cycle (+2 forward .. -2 back), lifted while it swings forward; diagonal pairs move together.
  const STRIDE = [2, 0, -2, 0], LIFT = [0, 0, 0, 1];
  const at = (phase) => [STRIDE[(i + phase) % 4], LIFT[(i + phase) % 4]];
  const [ff, fl] = at(2), [bf, bl] = at(0); // far front, far back
  leg(g, 34, 23, 34 + ff, fl, false);
  leg(g, 19, 23, 19 + bf, bl, false);
  stamp(g, BODY_WALK, 10, 11 + bob, (x) => (roll > 0 && x < 13 ? 1 : roll < 0 && x > 20 ? 1 : 0));
  const [nf, nl] = at(0), [nb, nbl] = at(2); // near front, near back
  leg(g, 30, 23, 30 + nf, nl, true);
  leg(g, 15, 23, 15 + nb, nbl, true);
  g.outline(OUTLINE, 1);
  return g;
}

/** The telegraph: crouched and bunched up, rump up, fur bristling. Top left at (10, 13). */
const BODY_TELE = [
  '......p...p...p',
  '.....cp..cp..cp..p',
  '...cccccccccccccppp',
  '..ccccccccccccccpppp',
  '.cccccccppcccppppppp',
  'ccccccpppppppppppppp',
  'cccppppppppppppppppp',
  'ccpppppppppppppppppp',
  'cppppppppppppppppppp',
  '.ppppppppppppppppnnn',
  '..pppppppppppppnnnnn',
  '...nnnnpppppppnnnnnn',
  '.......nnnnnnnnnnnnn',
  '..........nnnnnnnnnn',
];
/** The hissing head: ear laid flat, brow down, jaws wide, two rows of little teeth. Top left at (25, 16). */
const HEAD_HISS = [
  '.nnnnn',
  'cnnnnnnWW',
  '.ccnnWWWWWW',
  '...WWWWWWWWWW',
  '..WWWnnWWWWWWWW',
  '..WWnSSnnWWWWWWWW',
  '..WWnSkkkWWWWWWWWWrr',
  '..cWWWkkWWWWWWWWWWrr',
  '..cWWWWWWkSeSeSeSeS',
  '...cWWWkeeeeeeeeee',
  '...ccWWkeeRRRRRe',
  '....cWWWSeSeSeS',
  '.....cccccccc',
];

function tele() {
  const g = new Grid(FRAME.w, FRAME.h);
  tail(g, [[11, 21], [10, 21], [9, 22], [8, 22], [7, 22], [6, 22], [5, 22], [4, 22], [3, 21], [3, 20], [4, 19]]);
  leg(g, 32, 25, 34, 0, false);
  leg(g, 18, 24, 18, 0, false);
  stamp(g, BODY_TELE, 10, 13);
  leg(g, 29, 25, 30, 0, true);
  leg(g, 14, 25, 13, 0, true);
  stamp(g, HEAD_HISS, 25, 16);
  g.outline(OUTLINE, 1);
  return g;
}

/** The charge's long low torso. Top left at (11, 15), stretched by `widen`. */
const BODY_RUN = [
  '.....cccccccccccc',
  '..ccccccccpccccccpp',
  '.ccccccccppccccppppp',
  'cccppppppppppppppppppp',
  'ccpppppppppppppppppppp',
  'cppppppppppppppppppppn',
  '.pppppppppppppppppnnnn',
  '..nnnnnnnnnnnnnnnnnnn',
  '....nnnnnnnnnnnnnnn',
];
/** The charging head: ears pinned back, brow down, a wicked grin. Top left at (29 + stretch, 13). */
const HEAD_RUN = [
  '.nnnn',
  'cnnnnnnWW',
  '.ccnnWWWWWW',
  '...nWWnnnWWWW',
  '...WWWnSkkWWWWW',
  '...WWWnSkkWWWWWWrr',
  '...cWWWWWWkWWWWkrr',
  '....cWWWWWWkkkkk',
  '.....cccccc',
];

/** The charge, a 4-frame gallop: extended, front legs land, gathered, back legs push. */
function run(i) {
  const g = new Grid(FRAME.w, FRAME.h);
  const stretch = [2, 1, 0, 1][i], bob = [0, 1, 0, 1][i];
  const wave = [0, -1, 0, 1][i];
  const tl = [[12, 18], [11, 18], [10, 18], [9, 18], [8, 18], [7, 18], [6, 18], [5, 18], [4, 18], [3, 18], [2, 18]];
  tail(g, tl.map(([x, y], k) => [x, y + bob + (k >= 6 ? wave : 0)]));
  // Hands as [x offset from the hip, lift]: near front, far front, near back, far back.
  const legs = [
    [[5, 2], [3, 1], [-5, 1], [-3, 2]],
    [[1, 0], [-1, 0], [-1, 2], [1, 3]],
    [[-2, 1], [-3, 0], [4, 1], [5, 2]],
    [[4, 2], [2, 2], [0, 0], [1, 0]],
  ][i];
  const fh = 29 + stretch, bh = 16;
  leg(g, fh + 2, 22 + bob, fh + 2 + legs[1][0], legs[1][1], false);
  leg(g, bh + 3, 22 + bob, bh + 3 + legs[3][0], legs[3][1], false);
  stamp(g, widen(BODY_RUN, 14, stretch), 11, 15 + bob);
  leg(g, fh, 22 + bob, fh + legs[0][0], legs[0][1], true);
  leg(g, bh, 22 + bob, bh + legs[2][0], legs[2][1], true);
  stamp(g, HEAD_RUN, 29 + stretch, 13 + bob);
  g.outline(OUTLINE, 1);
  return g;
}

/** Playing dead: the body on its back, belly up (pale). Top left at (10, 20). */
const BODY_DEAD = [
  '.......cccccccccc',
  '....cccccccccccccccp',
  '..cccccccccccccccccppp',
  '.ccccccccccccccccppppppp',
  'cccccccccccccppppppppppp',
  'ppcccppppppppppppppppppn',
  'pppppppppppppppppppppnnn',
  '.pppppppppppppppppnnnnn',
  '..nnnnnnnnnnnnnnnnnnnn',
  '....nnnnnnnnnnnnnnnn',
];
/** The head lying on its cheek: ear flopped, an X eye, jaw dropped, the tongue lolling out onto the floor. Top left at (30, 19). */
const HEAD_DEAD = [
  '.cnnn',
  'cnnnnnWWW',
  '.nnnWWWWWWW',
  '..WWWWWWWWWWW',
  '.WWWkWkWWWWWWW',
  '.WWWWkWWWWWWWWWrr',
  '.cWWkWkWWWWWWWWrr',
  '..cWWWWWWWkkkkkk',
  '...ccWWWkeeRRk',
  '.....cccceRRRR',
  '..........rrrr',
];

/** A leg sticking up from the belly at x, leaning `lean` px at its top, a round hand on top; `curl` bends the hand over to one side. */
function legUp(g, x, top, bottom, near, lean = 0, curl = false) {
  for (let y = top + 1; y <= bottom; y++) {
    const lx = x + Math.round((lean * (bottom - y)) / (bottom - top - 1));
    g.set(lx, y, KEY[near ? 'b' : 'n']);
    g.set(lx + 1, y, KEY.n);
  }
  const hx = x + lean, hand = KEY[near ? 'c' : 'r'];
  const d = Math.sign(lean) || 1;
  const pts = curl ? [[hx, top + 1], [hx + 1, top + 1], [hx + (d > 0 ? 2 : -1), top + 1], [hx + (d > 0 ? 2 : -1), top + 2]] : [[hx, top], [hx + 1, top], [hx, top - 1], [hx + 1, top - 1]];
  pts.forEach(([px1, py]) => g.set(px1, py, hand));
}

/** Playing dead: on its back, legs stiff in the air, X eye, tongue out, the tail limp; `twitch` curls the hands. */
function dead(twitch) {
  const g = new Grid(FRAME.w, FRAME.h);
  tail(g, [[12, 27], [11, 28], [10, 28], [9, 28], [8, 28], [7, 28], [6, 28], [5, 28], [4, 28], [3, 27], [2, 26], [2, 25], [3, 24]]);
  const c = twitch ? 1 : 0;
  legUp(g, 18, 15 + c, 21, false, -1, twitch);
  legUp(g, 28, 15 + c, 21, false, 2, twitch);
  stamp(g, BODY_DEAD, 10, 20);
  legUp(g, 14, 16 + c, 22, true, -2, twitch);
  legUp(g, 24, 16 + c, 22, true, 1, twitch);
  stamp(g, HEAD_DEAD, 30, 19);
  g.outline(OUTLINE, 1);
  return g;
}

/** Squashed flat after playing dead: half height, legs splayed out, X eye, tongue out. Top left at (9, 24). */
const BODY_SQUASH = [
  '.....cccccccccccccccc',
  '..cccccccccccccccccccpppp',
  'cccccccpppppppppppppppppppp',
  'ppppppppppppppppppppppppppn',
  '.nnnnnnnnnnnnnnnnnnnnnnnnn',
  '...nnnnnnnnnnnnnnnnnnnnn',
];
/** The squashed head, flattened on its cheek. Top left at (31, 23). */
const HEAD_SQUASH = [
  '.cnnnWWWW',
  'cnnWWWWWWWWW',
  '.WWkWkWWWWWWWrr',
  '.WWWkWWWWWWWWrr',
  '.cWkWkWWWkkkkkk',
  '..cccWWkeeRRk',
  '......ccerrrr',
];

function squash() {
  const g = new Grid(FRAME.w, FRAME.h);
  tail(g, [[12, 27], [11, 28], [10, 28], [9, 28], [8, 28], [7, 28], [6, 28], [5, 28], [4, 28], [3, 28], [2, 28]]);
  // Legs splayed flat: little stubs poking out sideways, round hands.
  stamp(g, ['cc', 'cnn', '.nnn'], 9, 21);
  stamp(g, ['....rr', '..nnr', '.nnn'], 26, 21);
  stamp(g, BODY_SQUASH, 9, 24);
  stamp(g, ['cc', 'cbn', '.bnn'], 13, 22);
  stamp(g, ['...cc', '.bnc', 'bnn'], 22, 22);
  stamp(g, HEAD_SQUASH, 31, 23);
  g.outline(OUTLINE, 1);
  return g;
}

/** The knocked head, upside down: chin up, mouth open in a gasp, an X eye, the ear dangling. Top left at (30, 16). */
const HEAD_HIT = [
  '...ccccc',
  '..cWWWWWkk',
  '.cWWWWWkeek',
  'WWWWWWWWkkWWWrr',
  'WWWWkWkWWWWWWrr',
  'WWWWWkWWWWWW',
  'pWWWkWkWWW',
  'pnWWWWWWW',
  'nnnWWWW',
  '.nnnn',
  '..nn',
];

/** Knocked by the claw or a fireball: the walk turned upside down, legs in the air, with its own upside-down head (X eye, a gasp). */
function hit() {
  const g = new Grid(FRAME.w, FRAME.h);
  // The fur's light and shade swap so the light still comes from above once the body is turned over.
  // The frosted back goes to fur, the dark belly to frost, and the back's edge (now underneath) to shade; the ear is tucked away.
  const swap = { c: 'p', n: 'c' };
  const body = BODY_WALK.map((r, y) => [...r].map((ch, x) => {
    if (x >= 20) return y < 3 ? '.' : ch;
    const edge = y === 0 || BODY_WALK[y - 1][x] === undefined || BODY_WALK[y - 1][x] === '.' || BODY_WALK[y - 2]?.[x] === undefined || BODY_WALK[y - 2][x] === '.';
    return swap[ch] ? (edge && ch === 'c' ? 'n' : swap[ch]) : ch;
  }).join(''));
  tail(g, [[13, 19], [12, 20], [11, 20], [10, 21], [9, 21], [8, 22], [7, 22], [6, 22], [5, 21], [4, 20], [4, 19], [5, 18]]);
  leg(g, 35, 23, 37, 0, false);
  leg(g, 19, 23, 17, 0, false);
  stamp(g, body, 10, 11);
  leg(g, 31, 24, 34, 0, true);
  leg(g, 15, 23, 12, 0, true);
  const out = new Grid(FRAME.w, FRAME.h);
  for (let y = 0; y < FRAME.h; y++) for (let x = 0; x < FRAME.w; x++) if (!(x >= 32 && 40 - y >= 16)) out.set(x, 40 - y, g.get(x, y));
  stamp(out, HEAD_HIT, 30, 16);
  out.outline(OUTLINE, 1);
  return out;
}

export function drawFrames() {
  const looks = {};
  for (let i = 0; i < 4; i++) looks[`walk${i}`] = walk(i);
  looks.tele = tele();
  looks.teleRed = flashed(looks.tele);
  for (let i = 0; i < 4; i++) looks[`run${i}`] = run(i);
  looks.dead = dead(0);
  looks.deadTwitch = dead(1);
  looks.squash = squash();
  looks.hit = hit();
  // Drawn with an empty bottom row; moved down 1 px so the outline under the feet is the frame's bottom row, the ground line (as Poncho's).
  return LOOKS.map((look) => ({ look, grid: shifted(looks[look], 0, 1) }));
}
