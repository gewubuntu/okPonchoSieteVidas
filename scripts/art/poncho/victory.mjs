// Poncho's victory pose (GDD-ART-04, GDD-ART-02): the user's victory drawing (victory-pixels.mjs) and the user's four-frame strip
// (assets/characters/poncho/victory/strip.jpg): a ready stance with both fists up, then the taco raised higher and higher, ending
// stretched tall. The drawing is the third frame as it is; the others move and stretch its own pixels by whole rows and columns,
// never repainted, as the pose rig does with the side drawing. Front view: the game does not mirror these frames for the left.
// Each frame stands on the frame's bottom row with the middle between his feet on his body box's middle, like every frame.
import { Grid } from '../raster.mjs';
import { COLOURS } from '../poncho-pixels.mjs';
import { ITEM_COLOURS } from './items.mjs';
import { check, POSE_FRAME } from './rig.mjs';
import { ROWS } from './victory-pixels.mjs';

export { POSE_FRAME };

const KEY = { ...COLOURS, ...ITEM_COLOURS };
const H = ROWS.length, W = ROWS[0].length;
/** The column between his feet, in the drawing's px: it goes on the body box's middle (frame column 48). */
const MIDDLE = 34;
const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const N8 = [...N4, [1, 1], [-1, 1], [1, -1], [-1, -1]];

const at = (x, y) => (x >= 0 && y >= 0 && x < W && y < H ? ROWS[y][x] : '.');
const key = (x, y) => y * 1000 + x;

/**
 * The raised arm with the paw and the taco: the drawing's pixels left of his face (columns up to 17) above his shoulder (row 47),
 * joined by colour other than the outline to the arm's middle (column 10, row 32) or to the taco (column 6, row 15), with the
 * outline round them.
 */
const ARM = (() => {
  const inside = new Set(), stack = [[10, 32], [6, 15]];
  while (stack.length) {
    const [x, y] = stack.pop();
    if (x < 0 || y < 0 || x > 17 || y > 47 || inside.has(key(x, y)) || '.#'.includes(at(x, y))) continue;
    inside.add(key(x, y));
    for (const [dx, dy] of N4) stack.push([x + dx, y + dy]);
  }
  const arm = new Set(inside);
  for (const k of inside) {
    const x = k % 1000, y = Math.floor(k / 1000);
    for (const [dx, dy] of N8) if (at(x + dx, y + dy) === '#' && x + dx <= 17) arm.add(key(x + dx, y + dy));
  }
  return arm;
})();
const inArm = (x, y) => ARM.has(key(x, y));

/** A layer: [x, y, letter] cells in the drawing's px. */
const cells = (keep) => {
  const out = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (at(x, y) !== '.' && keep(x, y)) out.push([x, y, at(x, y)]);
  return out;
};

/**
 * Rows in `doubled` drawn twice, each row at or above it moving up one; `from` and `to` limit it to a block of rows.
 * Returns the cells moved.
 */
function stretch(layer, doubled) {
  const out = [];
  for (const [x, y, c] of layer) {
    const up = doubled.filter((d) => y <= d).length;
    out.push([x, y - up, c]);
    if (doubled.includes(y)) out.push([x, y - up + 1, c]);
  }
  return out;
}

/** The frame: the layers painted in order (later in front), stood on the bottom row, the outline closed where parts moved. */
function frame(layers) {
  const g = new Grid(POSE_FRAME.w, POSE_FRAME.h);
  const ox = POSE_FRAME.w / 2 - MIDDLE, oy = POSE_FRAME.h - H;
  for (const layer of layers) for (const [x, y, c] of layer) g.set(x + ox, y + oy, KEY[c]);
  closeOutline(g);
  return g;
}

/** Colour next to an empty pixel gets an outline; an outline pixel with no colour beside it goes. */
function closeOutline(g) {
  const OUTLINE = COLOURS['#'];
  const add = [];
  for (let y = 0; y < g.height; y++) for (let x = 0; x < g.width; x++) {
    if (g.get(x, y) !== null) continue;
    if (N4.some(([dx, dy]) => { const c = g.get(x + dx, y + dy); return c !== null && c !== OUTLINE; })) add.push([x, y]);
  }
  for (const [x, y] of add) g.set(x, y, OUTLINE);
  for (let y = 0; y < g.height; y++) for (let x = 0; x < g.width; x++) {
    if (g.get(x, y) === OUTLINE && N8.every(([dx, dy]) => g.get(x + dx, y + dy) === null || g.get(x + dx, y + dy) === OUTLINE)) g.set(x, y, null);
  }
}

/**
 * The legs' rows taken out (whole rows, as the rig's squash), so he stands as tall as his side frames: the front view's legs are
 * longer than the side drawing's.
 */
export const LEG_ROWS_OUT = [65, 68, 71];
/** Each kept row moves down by the rows taken out below it; the feet stay on the bottom row. */
const squashed = (layer) => layer.filter(([, y]) => !LEG_ROWS_OUT.includes(y)).map(([x, y, c]) => [x, y + LEG_ROWS_OUT.filter((r) => r > y).length, c]);
const body = squashed(cells((x, y) => !inArm(x, y)));
const arm = squashed(cells(inArm));
/** The arm moved by (dx, dy), the part that would come below his shoulder hidden behind the poncho. */
const armAt = (dx, dy) => arm.map(([x, y, c]) => [x + dx, y + dy, c]).filter(([, y]) => y <= 47 + LEG_ROWS_OUT.length);

/** Cells joined to (sx, sy) by colour other than the outline, within `bounds`, with the outline round them. */
function region(sx, sy, bounds) {
  const inside = new Set(), stack = [[sx, sy]];
  while (stack.length) {
    const [x, y] = stack.pop();
    if (!bounds(x, y) || inside.has(key(x, y)) || '.#'.includes(at(x, y))) continue;
    inside.add(key(x, y));
    for (const [dx, dy] of N4) stack.push([x + dx, y + dy]);
  }
  const out = new Set(inside);
  for (const k of inside) {
    const x = k % 1000, y = Math.floor(k / 1000);
    for (const [dx, dy] of N8) if (at(x + dx, y + dy) === '#' && bounds(x + dx, y + dy)) out.add(key(x + dx, y + dy));
  }
  return cells((x, y) => out.has(key(x, y)));
}

/** His left fist (the viewer's right), from the wrist out. */
const FIST = region(57, 54, (x, y) => x >= 52 && y >= 44 && y <= 62);
/** The column the fist is mirrored about: his face's middle, between the nose's two columns. */
const MIRROR_AXIS = 36.5;
/**
 * The poncho's left side panel where the raised arm hid it, from his shoulder (row 26) out to the side panel's edge (column 11 at
 * row 41), as the drawing's panel is below the arm: blue at its outer edge, navy in its shadow, the outline at the seam with the
 * front panel (column 17).
 */
const PANEL = (() => {
  const out = [];
  for (let y = 26; y <= 47; y++) {
    const edge = Math.max(11, Math.round(17 - ((y - 26) * 6) / 15));
    for (let x = edge; x <= 17; x++) if (at(x, y) === '.' || inArm(x, y)) out.push([x, y, x === 17 ? '#' : x === edge ? 'd' : 'n']);
  }
  return out;
})();

const FRAMES = {
  // Ready: the taco not up yet, both fists up in front of him (the strip's first frame): the raised arm gone, the side panel it
  // hid, and his left fist mirrored for his right.
  victory0: () => frame([body, squashed(PANEL), squashed(FIST.map(([x, y, c]) => [Math.round(2 * MIRROR_AXIS - x), y, c]))]),
  // The taco on its way up: the arm 8 rows lower, its elbow behind the poncho.
  victory1: () => frame([body, armAt(1, 8)]),
  // The user's drawing as it is.
  victory2: () => frame([body, arm]),
  // Stretched tall: the legs a row longer and the arm two rows longer, the taco three rows higher than in the drawing.
  victory3: () => frame([stretch(body, [72]), stretch(arm, [72, 39, 33])]),
};

export const LOOKS = Object.keys(FRAMES);

export function drawFrames() {
  return LOOKS.map((look) => {
    const grid = FRAMES[look]();
    const problems = check(grid, { palette: Object.values(KEY) });
    if (problems.length) throw new Error(`${look}: ${problems.slice(0, 3).join('; ')}`);
    return { look, grid, hand: null, holds: 'none', mirror: false };
  });
}
