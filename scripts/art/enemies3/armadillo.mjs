// The Armadillo, 3-2's new enemy (GDD-ENM-04): the nine-banded armadillo (Dasypus novemcinctus), the ayotochtli, "turtle-rabbit" in
// Nahuatl. A low dome with long mule ears and a tapering ringed tail walking; a plain disc with one ear tip and the tail's end rolling (the
// roll is a cartoon's, GDD-ENM-04). Its shell timber lit with mist white bands, so it never melts into the ochre rock. Drawn in code
// (GDD-ART-01) in World 3's colours (GDD-ART-06) and the outline (GDD-ART-05), in drawing px (2 x 2 art px, half a game px), with World 2's
// kit, like the bat. Facing right; feet on the frame's bottom row in every frame.
import { ellipse, Grid, or, polygon, rect, stroke } from '../raster.mjs';
import { flashed, OUTLINE, shaded } from '../enemies2/kit.mjs';
import { FLASH } from '../enemies1/kit.mjs';

/** World 3's colours the Armadillo is drawn in (GDD-ART-06). */
export const W3 = {
  mist: '#EEF1EA', timberLit: '#A89480', timber: '#75614F', timberDark: '#43362F', rust: '#B0562E', ironDark: '#353A48', peakLit: '#A9B8AC',
  lampAmber: '#F0A23A', ochreLight: '#EDCB86',
};

/** Every cell of the sheet is 28 x 16 game px. */
export const FRAME = { w: 56, h: 32 };
/** The 16 x 12 game px hit box (tuning ARMADILLO, GDD-ENM-04), feet on the frame's bottom row. */
export const BOX = { x0: 12, y0: 8, x1: 44, y1: 32 };
export const LOOKS = ['walk0', 'walk1', 'walk2', 'walk3', 'tuck', 'tuckRed', 'roll0', 'roll1', 'roll2', 'roll3', 'dazed', 'dazedKick', 'squash'];
/**
 * The box each look is drawn in, in game px within its 28 x 16 cell: walking, dazed and squashed the whole cell, the tuck and the roll the
 * 20 x 16 middle (GDD-ENM-04's frames). `src/ui/enemyLooks.ts` has the same table for the game (a test compares them).
 */
const WIDE = { x: 0, y: 0, w: 28, h: 16 };
const BALL = { x: 4, y: 0, w: 20, h: 16 };
export const LOOK_BOXES = { walk0: WIDE, walk1: WIDE, walk2: WIDE, walk3: WIDE, tuck: BALL, tuckRed: BALL, roll0: BALL, roll1: BALL, roll2: BALL, roll3: BALL, dazed: WIDE, dazedKick: WIDE, squash: WIDE };

// Materials as [light, base, shadow], light from the upper left.
const SHELL = [W3.mist, W3.timberLit, W3.timber];
const SKIN = [W3.timberLit, W3.timber, W3.timberDark];

/** The shadow colours that turn the telegraph's darker red (GDD-ENM-01, World 1's flash kept by every world). */
const DARKS = [W3.timber, W3.timberDark, W3.ironDark, W3.rust];

/** Paints `test` with `mat` on `g` (light upper left, shadow lower right). */
const paint = (g, test, mat) => shaded(g, test, mat);

/** The mist white bands across a shell, `n` of them, vertical stripes 1 px wide every `step` px from `x0`, inside `test`. */
function bands(g, test, x0, step, n) {
  for (let i = 0; i < n; i++) g.fill((x, y) => test(x, y) && Math.floor(x) === x0 + i * step, W3.mist, true);
}

/**
 * Walking, facing right: the shell a low dome over the body, banded; the head forward with a pointed snout and a long upright mule ear; the
 * tail tapering back, ringed; four short legs, their feet on row 30 (the outline's row 31 is the frame's last). `step` 0 to 3 moves the
 * legs through a trot and the body a px up on the passing frames.
 */
function drawWalk(step) {
  const g = new Grid(FRAME.w, FRAME.h);
  const bob = step % 2 === 1 ? -1 : 0;
  const [a, b] = [[-2, 2], [-1, 1], [2, -2], [1, -1]][step];
  // The legs behind the shell: front pair at x 38, back pair at 18; each 3 px wide from under the shell down to the feet.
  for (const [lx, d] of [[18, a], [24, b], [33, b], [38, a]]) paint(g, rect(lx + d, 23 + bob, 3, 31 - (23 + bob)), SKIN);
  // The tail: from under the shell's back, tapering down and back, ringed timber dark.
  const tail = polygon([[16, 20 + bob], [16, 25 + bob], [4, 28], [3, 27]]);
  paint(g, tail, SKIN);
  for (const rx of [6, 9, 12]) g.fill((x, y) => tail(x, y) && Math.floor(x) === rx, W3.timberDark, true);
  // The head: a small skull forward of the shell, a pointed snout, a round eye; the long ear upright over it, its inside rust.
  const head = or(ellipse(43, 20 + bob, 5, 4), polygon([[44, 17 + bob], [52, 22 + bob], [51, 24 + bob], [43, 24 + bob]]));
  paint(g, head, SKIN);
  const ear = polygon([[40, 18 + bob], [39, 8 + bob], [42, 8 + bob], [44, 17 + bob]]);
  paint(g, ear, SKIN);
  g.fill((x, y) => ear(x, y) && x > 40.5 && x < 42.5 && y > 10 + bob && y < 17 + bob, W3.rust, true);
  g.set(46, 19 + bob, OUTLINE);
  // The shell: a low dome, timber lit with its light rim, five mist white bands across its middle.
  const shell = ellipse(28, 24 + bob, 14, 13);
  const dome = (x, y) => shell(x, y) && y < 25 + bob;
  paint(g, dome, SHELL);
  bands(g, dome, 22, 3, 5);
  g.outline(OUTLINE, 1);
  return g;
}

/**
 * Tucked nose to tail (the telegraph's base): a ball not yet round, the shell pulled down over the head, the ear tip and the tail's end
 * showing, in the 20 x 16 middle of its cell.
 */
function drawTuck() {
  const g = new Grid(FRAME.w, FRAME.h);
  paint(g, polygon([[16, 27], [13, 30], [17, 30]]), SKIN); // the tail's end
  paint(g, polygon([[35, 13], [37, 9], [39, 12]]), SKIN); // the ear's tip
  const ball = ellipse(28, 22, 12, 9.5);
  paint(g, ball, SHELL);
  for (const bx of [22, 25, 28, 31, 34]) g.fill((x, y) => ball(x, y) && Math.floor(x) === bx && y > 13, W3.mist, true);
  paint(g, ellipse(37, 28, 3, 2.5), SKIN); // the snout tucked in under the shell's front
  g.outline(OUTLINE, 1);
  return g;
}

/**
 * Rolling: a plain ball 14 x 12 game px with its outline (1 px inside its box on each side, touching its top and its feet), its bands as
 * hoops round it, one ear tip and the tail's end painted on its rim (inside the ball, so it stays whole), and 2 or 3 px of dust behind it,
 * not outlined. Frame `k` turns it a quarter turn on from the last, clockwise as it rolls right: the ear tip at 12, 3, 6 and 9 o'clock and
 * the tail's end opposite, so four frames make one whole turn; the bands slide a quarter of their spacing forward each frame.
 */
function drawRoll(k) {
  const g = new Grid(FRAME.w, FRAME.h);
  const [cx, cy, rx, ry] = [28, 20, 13, 11];
  const disc = ellipse(cx, cy, rx, ry);
  paint(g, disc, SHELL);
  // A hard shell, not a pale egg: its lower half timber, its lowest rim timber dark, under the bands.
  g.fill((x, y) => disc(x, y) && y > cy + 1, W3.timber, true);
  g.fill((x, y) => disc(x, y) && y > cy + 6, W3.timberDark, true);
  const turn = (k * Math.PI) / 2;
  // The bands: hoops round the ball seen side on, upright stripes that slide forward across it as it turns and crowd together at its edges
  // (a hoop at angle a round it is at cx + rx sin a), a quarter of their spacing on every frame, so they come back to their place after four.
  for (let i = 0; i < 8; i++) {
    const a = (k * Math.PI) / 16 + (i * Math.PI) / 4 - Math.PI;
    if (Math.cos(a) <= 0.2) continue;
    const bx = cx + (rx - 1) * Math.sin(a);
    g.fill((x, y) => disc(x, y) && Math.abs(x - bx) < 0.75 + 0.25 * Math.cos(a) && Math.abs(y - cy) < ry - 2, W3.mist, true);
  }
  // The ear tip and the tail's end on the rim, opposite each other, a quarter turn on each frame.
  const at = (a) => [cx + Math.cos(a) * (rx - 1.5), cy + Math.sin(a) * (ry - 1.5)];
  const [ex, ey] = at(turn - Math.PI / 2);
  g.fill((x, y) => disc(x, y) && Math.hypot(x - ex, y - ey) <= 2, W3.rust, true);
  const [tx, ty] = at(turn + Math.PI / 2);
  g.fill((x, y) => disc(x, y) && Math.hypot(x - tx, y - ty) <= 2, W3.ironDark, true); // iron dark: apart from the rim's timber dark
  g.outline(OUTLINE, 1);
  // The dust behind it: a puff of three clumps of 2 x 2 game px (4 x 4 drawing px), mist white and ochre light, kicked up behind the ball
  // and drifting back and up from frame to frame, inside the ball's 20 x 16 look box and clear of the ball.
  const puffs = [
    [[14, 28, W3.mist], [9, 25, W3.ochreLight], [8, 20, W3.mist]],
    [[13, 28, W3.ochreLight], [9, 24, W3.mist], [9, 19, W3.ochreLight]],
    [[14, 28, W3.mist], [8, 26, W3.ochreLight], [10, 21, W3.mist]],
    [[12, 28, W3.ochreLight], [10, 24, W3.mist], [8, 19, W3.mist]],
  ][k];
  for (const [px, py, c] of puffs) for (let y = py; y < py + 4; y++) for (let x = px; x < px + 4; x++) if (g.get(x, y) === null) g.set(x, y, c);
  return g;
}

/**
 * Dazed on its back: the shell's dome down on the ground, the belly up with its four legs in the air, long enough to read as legs (still,
 * or kicking: the pairs apart), each with a dark paw; the head lolled back at the front with its pointed snout and its long ear flopped out
 * along the ground, an X eye; two small stars over the head. Its shell is on the bottom row.
 */
function drawDazed(kick) {
  const g = new Grid(FRAME.w, FRAME.h);
  // Each leg from the belly up and out, splayed: the hind pair leaning back, the fore pair forward, a dark paw at its tip. Kicking, the
  // outer legs fling wider and the inner two stand straight up.
  const lean = kick ? [-3, 0, 0, 2] : [-2, -1, 1, 2];
  [19, 24, 32, 37].forEach((lx, i) => {
    const tip = lx + 1 + lean[i] * 2;
    const leg = polygon([[lx, 19], [lx + 3, 19], [tip + 2, 8], [tip - 1, 8]]);
    paint(g, leg, SKIN);
    g.fill((x, y) => leg(x, y) && y < 10.5, W3.timberDark, true); // the paw
  });
  const ear = polygon([[42, 24], [44, 22], [50, 28], [47, 30]]);
  paint(g, ear, SKIN); // the long ear, flopped out along the ground
  g.fill((x, y) => ear(x, y) && x > 44 && x < 48.5 && y > 24.5 && y < 28.5, W3.rust, true);
  paint(g, polygon([[41, 18], [47, 17], [53, 21], [52, 23], [41, 24]]), SKIN); // the head, lolled back, and its pointed snout
  paint(g, polygon([[14, 22], [4, 19], [3, 21], [14, 26]]), SKIN); // the tail
  const shell = ellipse(28, 19, 14, 12.5);
  const bowl = (x, y) => shell(x, y) && y > 19;
  paint(g, bowl, SHELL);
  bands(g, bowl, 22, 3, 5);
  paint(g, ellipse(28, 19, 13, 1.6), SKIN); // the belly's edge
  g.outline(OUTLINE, 1);
  for (const [x, y] of [[44, 19], [46, 21], [46, 19], [44, 21]]) g.set(x, y, OUTLINE); // the X eye
  // The stars: small mist white crosses with a lamp amber heart over the head.
  for (const [sx, sy] of kick ? [[45, 12], [51, 15]] : [[46, 13], [51, 12]]) {
    for (const [dx, dy] of [[0, -1], [-1, 0], [1, 0], [0, 1]]) g.set(sx + dx, sy + dy, W3.mist);
    g.set(sx, sy, W3.lampAmber);
  }
  return g;
}

/**
 * Squashed by a stomp (GDD-ENM-02's defeat, GDD-ENM-04): the dazed pose pressed flat, on its back, the shell's bowl half as deep, the belly
 * and the four legs stubs over it, the head and the tail flat on the ground, the X eye; no stars. Its shell is on the bottom row.
 */
function drawSquash() {
  const g = new Grid(FRAME.w, FRAME.h);
  for (const lx of [19, 24, 32, 37]) paint(g, rect(lx, 22, 3, 4), SKIN);
  paint(g, polygon([[42, 25], [52, 27], [51, 30], [42, 30]]), SKIN); // the head, flat
  paint(g, polygon([[14, 26], [4, 26], [3, 28], [14, 30]]), SKIN); // the tail
  const shell = ellipse(28, 25, 15, 6.5);
  const bowl = (x, y) => shell(x, y) && y > 25;
  paint(g, bowl, SHELL);
  bands(g, bowl, 22, 3, 5);
  paint(g, ellipse(28, 25, 14, 1.4), SKIN); // the belly's edge
  g.outline(OUTLINE, 1);
  for (const [x, y] of [[45, 26], [47, 28], [47, 26], [45, 28]]) g.set(x, y, OUTLINE); // the X eye
  return g;
}

function drawLook(look) {
  switch (look) {
    case 'walk0': return drawWalk(0);
    case 'walk1': return drawWalk(1);
    case 'walk2': return drawWalk(2);
    case 'walk3': return drawWalk(3);
    case 'tuck': return drawTuck();
    case 'tuckRed': return flashed(drawTuck(), FLASH, DARKS);
    case 'roll0': return drawRoll(0);
    case 'roll1': return drawRoll(1);
    case 'roll2': return drawRoll(2);
    case 'roll3': return drawRoll(3);
    case 'dazed': return drawDazed(false);
    case 'dazedKick': return drawDazed(true);
    case 'squash': return drawSquash();
    default: throw new Error(`no look ${look}`);
  }
}

/** Every frame in LOOKS order: [{ look, grid }], each FRAME.w x FRAME.h drawing px. */
export function drawFrames() {
  return LOOKS.map((look) => ({ look, grid: drawLook(look) }));
}
