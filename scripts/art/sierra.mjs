// World 3's (Sierra) art for the canyon, 3-1 La Barranca: the backdrop, the ground, the decor and the rock ledge, drawn in code like
// World 2's (GDD-ART-01, GDD-ART-06; designed from the GDD's art direction without reference images, "Design it, show me", user,
// 2026-11-10). What Poncho cannot touch is cool and quiet (the grey-blue sky, the green-grey peaks, the pines); what he stands on is warm
// ochre rock; the near-black outline only on the rock ledge, which he touches (GDD-ART-05). The GDD's 24 colours, light from the upper
// left, whole game pixels (4 x 4 art pixels) except the sky's dither and the ledge's outline. The mine, the heights and the shed come
// with their levels.
import { Cells, leaf, noise, S, shade, stamp, wrapDelta } from './cells.mjs';
import { ellipse, Grid, or } from './raster.mjs';
import { cutSlope, SLOPE_ORDER, slopeTopRow } from './slopes.mjs';

export { SLOPE_ORDER, slopeTopRow };

/** GDD-ART-06: World 3's 24 colours by their role, in the GDD's order. */
export const SIERRA_PALETTE = {
  skyTop: '#527391',
  skyMiddle: '#8AA5B8',
  skyHorizon: '#BFCDD2',
  mistWhite: '#EEF1EA',
  peakLit: '#A9B8AC',
  peakBase: '#7F9488',
  peakShade: '#5B7067',
  pineDeep: '#24403A',
  pineGreen: '#3F6350',
  zacate: '#A3A85A',
  ochreLight: '#EDCB86',
  ochre: '#CC983F',
  ochreShade: '#9A6A2C',
  rockDeep: '#5A3B28',
  timberLit: '#A89480',
  timber: '#75614F',
  timberDark: '#43362F',
  steel: '#93A0AE',
  ironDark: '#353A48',
  rust: '#B0562E',
  galleryDeep: '#221D2E',
  galleryBase: '#3D3650',
  galleryLit: '#5C5269',
  lampAmber: '#F0A23A',
};
/** The outline of what can be touched (GDD-ART-05), Poncho's; in this set only the rock ledge carries it. */
export const OUTLINE = '#070509';

const {
  skyTop: SKY_TOP, skyMiddle: SKY_MID, skyHorizon: SKY_HORIZON, mistWhite: MIST, peakLit: PEAK_LIT, peakBase: PEAK, peakShade: PEAK_SHADE,
  pineDeep: PINE_DEEP, pineGreen: PINE, zacate: ZACATE, ochreLight: OCHRE_LIGHT, ochre: OCHRE, ochreShade: OCHRE_SHADE, rockDeep: ROCK_DEEP,
  timberLit: TIMBER_LIT, timber: TIMBER, timberDark: TIMBER_DARK, rust: RUST,
} = SIERRA_PALETTE;

const WIDTH = 480 * S;
const HEIGHT = 270 * S;

/** Cells from rows of characters, one character a cell: '.' is empty, any other is looked up in `legend`. */
function fromRows(rows, legend) {
  const c = new Cells(rows[0].length, rows.length);
  rows.forEach((row, y) => {
    if (row.length !== c.w) throw new Error(`row ${y} is ${row.length} wide, not ${c.w}: ${row}`);
    [...row].forEach((ch, x) => {
      if (ch === '.') return;
      if (!(ch in legend)) throw new Error(`no colour for '${ch}'`);
      c.set(x, y, legend[ch]);
    });
  });
  return c;
}
/** The letters the hand-drawn pieces use. */
const INK = {
  M: MIST, l: PEAK_LIT, b: PEAK, s: PEAK_SHADE, D: PINE_DEEP, P: PINE, Z: ZACATE, L: OCHRE_LIGHT, O: OCHRE, o: OCHRE_SHADE, K: ROCK_DEEP,
  T: TIMBER_LIT, t: TIMBER, d: TIMBER_DARK, R: RUST,
};

/** Sets a cell on the strip that repeats every 480 game px, wrapping its column. */
const wrapSet = (c, x, y, colour) => c.set(((x % c.w) + c.w) % c.w, y, colour);

// ---------------------------------------------------------------------------------------------------- sky

/** Where the sky's first two bands end (art y from the top, game y 60 and 110); the horizon band runs on and is the camera's background. */
export const SKY_ENDS = [240, 440];
/** The height of the dither strip at the end of a band (art px). */
export const STRIP = 2;
const BANDS = [SKY_TOP, SKY_MID, SKY_HORIZON];

/** The dither strips between the sky's bands, 1920 x 4 art px: frame n sits at the end of band n, a checker of 2 px cells (GDD-ART-05). */
export function drawSkyStrips() {
  const g = new Grid(WIDTH, STRIP * SKY_ENDS.length);
  SKY_ENDS.forEach((_, i) => {
    for (let y = 0; y < STRIP; y++) for (let x = 0; x < WIDTH; x++) g.set(x, i * STRIP + y, Math.floor(x / 2) % 2 === 0 ? BANDS[i] : BANDS[i + 1]);
  });
  return g;
}

/** The whole sky, 1920 x 1080: the three flat bands with the dither strips, no sun. The game draws it from its pieces. */
export function drawSky() {
  const g = new Grid(WIDTH, HEIGHT);
  for (let y = 0; y < HEIGHT; y++) {
    const band = SKY_ENDS.filter((e) => y >= e).length;
    for (let x = 0; x < WIDTH; x++) g.set(x, y, BANDS[band]);
  }
  const strips = drawSkyStrips();
  SKY_ENDS.forEach((end, i) => {
    for (let y = 0; y < STRIP; y++) for (let x = 0; x < WIDTH; x++) g.set(x, end - STRIP + y, strips.get(x, i * STRIP + y));
  });
  return g;
}

// ---------------------------------------------------------------------------------------------------- clouds

/** The cloud layer's height in game px (screen y 0 to 72; the streaks lie between 20 and 58, on the sky's top band). */
export const CLOUD_LAYER_H = 72;
/**
 * The three streaks of high cloud, about 60 x 8, 44 x 6 and 72 x 10: centre column, flat base row and flat puffs [dx, dy, rx, ry] from
 * the centre and the base, in game px. Their places keep them clear of the HUD's lives (x 8 to 100) and the hilo counter's corner.
 */
const CLOUDS = [
  { cx: 148, base: 32, puffs: [[-17, -2, 13, 2], [-3, -4, 14, 4], [13, -3, 12, 3], [0, -1, 30, 2]] },
  { cx: 228, base: 52, puffs: [[-11, -2, 11, 2], [2, -3, 11, 3], [0, -1, 22, 2]] },
  { cx: 328, base: 40, puffs: [[-21, -3, 15, 3], [-4, -5, 16, 5], [15, -4, 14, 4], [0, -1, 36, 2]] },
];

function cloudParts() {
  return CLOUDS.map(({ cx, base, puffs }) => {
    const c = new Cells(480, CLOUD_LAYER_H);
    const inside = (x, y) => y < base && puffs.some(([dx, dy, rx, ry]) => ((x + 0.5 - cx - dx) / rx) ** 2 + ((y + 0.5 - base - dy) / ry) ** 2 <= 1);
    let x0 = 480, y0 = CLOUD_LAYER_H, x1 = -1, y1 = -1;
    for (let y = 0; y < CLOUD_LAYER_H; y++) {
      for (let x = 0; x < 480; x++) {
        if (!inside(x, y)) continue;
        // Mist white on top, the sky's middle blue on the flat underside and the lower right (light from the upper left).
        const rim = !inside(x + 2, y + 1) || !inside(x + 1, y + 1);
        c.set(x, y, y >= base - 1 || (rim && y >= base - 4) ? SKY_MID : MIST);
        x0 = Math.min(x0, x);
        y0 = Math.min(y0, y);
        x1 = Math.max(x1, x);
        y1 = Math.max(y1, y);
      }
    }
    return { x: x0, y: y0, cells: c.crop(x0, y0, x1 - x0 + 1, y1 - y0 + 1) };
  });
}
const PARTS = cloudParts();

/** Where each cloud's picture sits in the cloud layer (screen game px at no scroll): its top left and size. */
export const CLOUD_BOXES = PARTS.map(({ x, y, cells }) => ({ x, y, w: cells.w, h: cells.h }));

/** The clouds' pictures, one per streak, in whole game pixels. */
export function drawCloudImages() {
  return PARTS.map(({ cells }) => cells.scaled());
}

/** The clouds as one layer, 1920 x 288 art px, which repeats sideways (no cloud touches its sides). The game draws them one by one. */
export function drawClouds() {
  const c = new Cells(480, CLOUD_LAYER_H);
  for (const { x, y, cells } of PARTS) stamp(c, cells, x, y);
  return c.scaled();
}

// ---------------------------------------------------------------------------------------------------- far: the two ranges

/** The far band: screen game y 84 to 200, 480 x 116 game px, scrolling at 0.3; below it the flat foot in pine deep. */
export const FAR = { top: 84, w: 480, h: 116 };
/** The flat foot below the far band: pine deep, so a chasm shows the forest far below and reads as a drop. */
export const FOOT_COLOUR = PINE_DEEP;

/**
 * Peaks as [centre x, top y (screen), half plateau, left slope, right slope (px down per px across)]. The farther range's crest is near
 * y 96 and its peaks are unevenly spaced and pitched, so the ranges never read as a zigzag; its flat stretch at x 366 to 394 carries the
 * mine. The nearer range's crests lie between y 120 and 150; its plateau at x 61 to 109 is the rim the hill town stands on.
 */
const FAR_PEAKS = [
  [22, 108, 1, 0.55, 0.3], [70, 114, 4, 0.4, 0.5], [118, 96, 1, 0.45, 0.72], [160, 110, 2, 0.6, 0.35], [214, 102, 0, 0.5, 0.42], [262, 113, 3, 0.35, 0.6],
  [302, 104, 1, 0.68, 0.5], [380, 108, 14, 0.5, 0.6], [440, 99, 1, 0.55, 0.4],
];
const NEAR_PEAKS = [
  [18, 137, 2, 0.6, 0.5], [85, 131, 24, 0.75, 0.55], [148, 134, 1, 0.5, 0.32], [172, 122, 1, 0.6, 0.8], [238, 141, 4, 0.65, 0.5], [282, 136, 1, 0.4, 0.62],
  [318, 126, 2, 0.45, 0.68], [362, 141, 0, 0.5, 0.5], [400, 147, 3, 0.55, 0.42], [452, 128, 1, 0.72, 0.5],
];

/** A range's first row at column x (screen game y), its peak and the column's distance from that peak's centre, with a ragged crest. */
function ridgeAt(peaks, x, seed) {
  let best = Infinity, which = 0, d = 0;
  peaks.forEach(([cx, top, half, l, r], i) => {
    const dd = wrapDelta(x, cx);
    const y = top + (dd < -half ? l * (-dd - half) : dd > half ? r * (dd - half) : 0);
    if (y < best) [best, which, d] = [y, i, dd];
  });
  // A crest broken here and there by a rock or a notch, never on a plateau, where the town and the mine stand.
  const flat = Math.abs(d) <= peaks[which][2];
  const jag = flat ? 0 : noise(x, seed) < 0.18 ? -1 : noise(x, seed + 1) < 0.12 ? 1 : 0;
  return { y: Math.round(best) + jag, which, d };
}

/** A small pine of the forest fringe, its tip at (x, tip), `h` rows tall, in pine green: one cell, then rows widening by one each side every two rows. */
function fringePine(c, x, tip, h, at) {
  for (let r = 0; r < h; r++) {
    const half = r >> 1;
    for (let i = -half; i <= half; i++) wrapSet(c, x + i, tip + r - at, PINE);
  }
}

/** The hill town on the rim at x 61 to 109 (where Poncho has just come from): a dozen blocks and one bell tower 6 px tall, in the peak colours. */
function drawTown(c, rim, at) {
  // Blocks as [left x, width, height above the rim]: fronts lit, their right sides in shade, a dark window here and there.
  const blocks = [[62, 4, 2], [66, 3, 3], [70, 5, 2], [76, 3, 4], [80, 4, 2], [88, 4, 3], [92, 3, 2], [96, 5, 3], [102, 3, 2], [105, 4, 3], [73, 3, 3], [99, 2, 4]];
  for (const [x0, w, h] of blocks) {
    for (let y = rim - h; y < rim; y++) for (let x = x0; x < x0 + w; x++) c.set(x, y - at, x === x0 + w - 1 ? PEAK_SHADE : PEAK_LIT);
    if (w > 3) c.set(x0 + 1, rim - h + 1 - at, PEAK_SHADE);
  }
  // The bell tower at x 84 to 86: three tiers of lit stone with its shaded right side, a bell opening, a cap.
  for (let y = rim - 5; y < rim; y++) for (let x = 84; x < 87; x++) c.set(x, y - at, x === 86 ? PEAK_SHADE : PEAK_LIT);
  c.set(85, rim - 4 - at, PEAK_SHADE);
  c.set(85, rim - 6 - at, PEAK);
}

/** The mine on the far ridge at x 370 to 400 (where he is going): a chimney and the hoist frame over its shaft, 8 px tall, with its shed. */
function drawMine(c, ridge, at) {
  const set = (x, y, colour) => c.set(x, y - at, colour);
  // The chimney, 2 px wide, its left side lit.
  for (let y = ridge - 8; y < ridge; y++) {
    set(372, y, PEAK);
    set(373, y, PEAK_SHADE);
  }
  // The hoist frame: two legs leaning in to a sheave at its top, a brace across, and the back leg to the right.
  for (let k = 0; k < 8; k++) {
    set(386 + (k >> 2), ridge - 1 - k, PEAK_SHADE);
    set(393 - (k >> 2), ridge - 1 - k, PEAK_SHADE);
  }
  for (let x = 387; x < 393; x++) set(x, ridge - 4, PEAK_SHADE);
  for (let x = 388; x < 392; x++) set(x, ridge - 8, PEAK_SHADE);
  for (let k = 0; k < 6; k++) set(394 + (k >> 1), ridge - 7 + k, PEAK_SHADE);
  // The engine shed beside it, lit front, shaded side.
  for (let y = ridge - 3; y < ridge; y++) for (let x = 376; x < 383; x++) set(x, y, x >= 381 ? PEAK_SHADE : PEAK);
  for (let x = 375; x < 383; x++) set(x, ridge - 4, PEAK_SHADE);
}

/**
 * The far band's cells, 480 x 116 (screen game y 84 to 200): the farther range in peak lit with its shaded sides in peak base and the haze
 * at its feet, the mine on its flat stretch; in front of it the nearer range in peak base, its faces to the upper left lit, its right sides
 * in shade, a ragged fringe of pines on its shoulders and the hill town on its rim; its foot goes into pine deep through a checker.
 */
function farCells() {
  const { top, w, h } = FAR;
  const c = new Cells(w, h);
  // The farther range, and the haze at its feet: a checker of the sky's horizon colour from y 122, the horizon colour below 126.
  for (let x = 0; x < w; x++) {
    const { y: ridge, which, d } = ridgeAt(FAR_PEAKS, x, 3);
    const half = FAR_PEAKS[which][2];
    for (let y = ridge; y < top + h; y++) {
      // Its right sides in peak base from the crest down, widening as they fall, so each peak has a lit and a shaded face.
      let colour = d > half && y - ridge < 3 + (d - half) * 0.6 ? PEAK : PEAK_LIT;
      if (y >= 126 || (y >= 122 && (x + y) % 2 === 0)) colour = SKY_HORIZON;
      c.set(x, y - top, colour);
    }
  }
  drawMine(c, ridgeAt(FAR_PEAKS, 380, 3).y, top);
  // The nearer range.
  for (let x = 0; x < w; x++) {
    const { y: ridge, which, d } = ridgeAt(NEAR_PEAKS, x, 5);
    const half = NEAR_PEAKS[which][2];
    // The lit face and the shaded side are wedges that widen away from the crest's top, their lower edges a little ragged.
    const rag = Math.floor(noise(x >> 2, 11) * 2);
    for (let y = ridge; y < top + h; y++) {
      const depth = y - ridge;
      let colour = PEAK;
      if (d < -half) {
        if (depth < Math.min(12, 2 + (-d - half) * 0.3) + rag) colour = PEAK_LIT;
      } else if (d > half) {
        if (depth < Math.min(22, 3 + (d - half) * 0.55) + rag) colour = PEAK_SHADE;
      } else if (depth < 1) colour = PEAK_LIT;
      if (y >= 196 || (y >= 192 && (x + y) % 2 === 0)) colour = y >= 196 || y >= 194 ? PINE_DEEP : PEAK_SHADE;
      c.set(x, y - top, colour);
    }
  }
  // The pine fringe on the shoulders: small pines standing on the ridge where it is low, 3 to 5 rows tall, and their tops below it.
  for (let x = 0; x < w; x++) {
    const { y: ridge, which, d } = ridgeAt(NEAR_PEAKS, x, 5);
    if (ridge < 136 || Math.abs(d) <= NEAR_PEAKS[which][2]) continue;
    if (noise(x, 17) < 0.42) fringePine(c, x, ridge - 1 - Math.floor(noise(x, 19) * 3), 3 + Math.floor(noise(x, 23) * 3), top);
    if (noise(x, 29) < 0.5) fringePine(c, x, ridge + 3 + Math.floor(noise(x, 31) * 4), 3, top);
  }
  drawTown(c, ridgeAt(NEAR_PEAKS, 85, 5).y, top);
  return c;
}

/** The far band, 1920 x 464 art px: a tileSprite at 0.3, repeating every 480 game px. */
export function drawFarBarranca() {
  return farCells().scaled();
}

// ---------------------------------------------------------------------------------------------------- mid: the canyon's far wall

/** The mid band: screen game y 148 to 224, 480 x 76 game px, scrolling at 0.5. Its bottom is the floor's top (row 14). */
export const MID = { top: 148, w: 480, h: 76 };

/**
 * The canyon's far wall as stepped cliffs: [left x, width, top y (screen)]. The first and the last meet at the same height across the
 * strip's seam. Two clefts: the ravine the mule trail bridges (x 102 to 109) and the one the waterfall falls in (x 324 to 327).
 */
const CLIFFS = [
  [0, 34, 172], [34, 46, 164], [80, 22, 177], [102, 8, 176, 'ravine'], [110, 52, 168], [162, 40, 160], [202, 56, 174], [258, 34, 181],
  [292, 32, 166], [324, 4, 170, 'cleft'], [328, 46, 161], [374, 38, 176], [412, 38, 167], [450, 30, 172],
];
/** The strata lines' first row under a cliff's top and their spacing, by cliff: level lines a few px apart, never in step from cliff to cliff. */
const STRATA = [[5, 11], [7, 10], [4, 12], [0, 0], [6, 11], [8, 9], [5, 13], [4, 10], [7, 12], [0, 0], [6, 10], [5, 12], [7, 11], [5, 11]];
/** Ledges along the wall's face, [left x, right x, row], each with pines standing on it: [x, height]. */
const LEDGES = [
  [6, 30, 188, [[10, 8], [21, 6]]], [38, 76, 180, [[44, 9], [52, 7], [68, 10]]], [166, 198, 178, [[170, 7], [186, 9]]],
  [206, 252, 192, [[212, 10], [229, 6], [240, 8]]], [334, 370, 182, [[341, 9], [360, 7]]], [416, 446, 186, [[421, 6], [437, 10]]],
];
/** Pines on the wall's top, [x, height]: on the lower cliffs only, so none rises past y 158. */
const TOP_PINES = [[6, 8], [14, 6], [86, 9], [96, 7], [214, 10], [232, 7], [266, 9], [282, 6], [384, 10], [400, 8], [458, 7]];
/** The mule trail's switchbacks down the wall, as points it runs straight between; the bridge carries it over the ravine at row 190. */
const TRAIL = [[164, 162], [134, 174], [152, 183], [110, 190], [102, 190], [82, 200], [100, 209], [74, 216]];

/**
 * A pine `h` rows tall (6 to 10) standing with its foot on row `foot`: a pointed tip, then tiers of boughs that widen down each tier and
 * step in for the next, lit pine green on the left and in the middle, pine deep on the right; a trunk under them.
 */
function pine(c, x, foot, h, at) {
  const set = (px, py, colour) => wrapSet(c, px, py - at, colour);
  set(x, foot - 1, PINE_DEEP);
  const rows = h - 1;
  for (let r = 0; r < rows; r++) {
    const up = rows - 1 - r;
    const half = Math.min(r, Math.max(0, 3 - (up % 3) - Math.floor(up / 3)));
    for (let i = -half; i <= half; i++) set(x + i, foot - 1 - rows + r, i > 0 ? PINE_DEEP : PINE);
  }
}

/** The mid band's cells, 480 x 76 (screen game y 148 to 224). */
function midCells() {
  const { top, w, h } = MID;
  const c = new Cells(w, h);
  const set = (x, y, colour) => wrapSet(c, x, y - top, colour);
  const cliffTop = (x) => CLIFFS.find(([x0, cw]) => x >= x0 && x < x0 + cw)[2];
  CLIFFS.forEach(([x0, cw, cTop, kind], i) => {
    const [first, step] = STRATA[i];
    const left = cliffTop((x0 + w - 1) % w);
    const right = cliffTop((x0 + cw) % w);
    for (let x = x0; x < x0 + cw; x++) {
      for (let y = cTop; y < top + h; y++) {
        // The face in shade, its top a lit lip, level strata lines broken here and there; a ravine is deep shade.
        let colour = PEAK_SHADE;
        if (kind === 'ravine') colour = y === cTop ? PEAK : PINE_DEEP;
        // The cliff's top catches the light: its lip and a ragged band under it.
        else if (y < cTop + 1 + (noise(x >> 1, 41) < 0.35 ? 1 : 0)) colour = PEAK;
        // A cliff higher than its left neighbour faces the light down that step; one higher than its right neighbour, its right edge in shade.
        if (!kind && x === x0 && cTop < left && y < left) colour = PEAK;
        if (!kind && x === x0 + cw - 1 && cTop < right && y < right && y > cTop) colour = PINE_DEEP;
        set(x, y, colour);
      }
    }
    // The strata: short uneven ledges along the bedding, 3 to 10 px long with gaps between them, each a row higher or lower than its
    // neighbours now and then, so no line runs ruled across the wall.
    if (kind) return;
    for (let row = cTop + first; step > 0 && row < 214; row += step) {
      for (let x = x0 + 2; x < x0 + cw - 2; ) {
        const len = 3 + Math.floor(noise(x, row) * 6);
        const dy = Math.floor(noise(x, row + 7) * 3) - 1;
        for (let k = 0; k < len && x + k < x0 + cw - 2; k++) set(x + k, row + dy, PEAK);
        x += len + 4 + Math.floor(noise(x, row + 13) * 8);
      }
    }
  });
  // The ledges: a lit shelf with its shadow under it, pines standing on it.
  for (const [x0, x1, row, pines] of LEDGES) {
    for (let x = x0; x <= x1; x++) {
      set(x, row, PEAK);
      set(x, row + 1, PINE_DEEP);
    }
    for (const [x, ph] of pines) pine(c, x, row, ph, top);
  }
  for (const [x, ph] of TOP_PINES) pine(c, x, cliffTop(x), ph, top);
  // The mule trail: a pale line zigzagging down the face, and the stone arch bridge over the ravine.
  for (let k = 0; k + 1 < TRAIL.length; k++) {
    const [ax, ay] = TRAIL[k], [bx, by] = TRAIL[k + 1];
    const n = Math.max(Math.abs(bx - ax), Math.abs(by - ay));
    for (let i = 0; i <= n; i++) set(Math.round(ax + ((bx - ax) * i) / n), Math.round(ay + ((by - ay) * i) / n), PEAK);
  }
  for (let x = 100; x <= 111; x++) {
    set(x, 190, PEAK);
    set(x, 191, PEAK);
    for (let y = 192; y < 197; y++) {
      // Two piers and the arch between them, its opening showing the ravine's dark.
      const u = (x + 0.5 - 105.5) / 4.5, v = (y + 0.5 - 197) / 5;
      set(x, y, u * u + v * v <= 1 ? PINE_DEEP : x <= 101 || x >= 110 ? PEAK : PEAK_SHADE);
    }
  }
  // The waterfall: 2 px of mist white from the cleft's lip down the wall, a third column broken along its right edge, its foot a small
  // splash of mist rising from the forest.
  for (let y = 171; y < 210; y++) {
    set(324, y, MIST);
    set(325, y, MIST);
    if (noise(y, 67) < 0.45) set(326, y, MIST);
  }
  const splash = ['..M.M..', '.MMMMM.', 'MMbMMbM'];
  splash.forEach((row, j) => [...row].forEach((ch, i) => ch !== '.' && set(322 + i, 208 + j, ch === 'M' ? MIST : PEAK)));
  // The forest at the canyon's bottom: pines standing close along the foot, their tops ragged.
  // None in front of the waterfall's foot, which falls into the forest unseen.
  for (let x = 1; x < w; x += 3 + Math.floor(noise(x, 53) * 3)) if (Math.abs(x - 325) > 7) pine(c, x, 219 + Math.floor(noise(x, 59) * 3), 6 + Math.floor(noise(x, 61) * 5), top);
  // The foot: the last six rows go into pine deep through a checker.
  for (let y = h - 6; y < h; y++) for (let x = 0; x < w; x++) if (y >= h - 4 || (x + y) % 2 === 0) c.set(x, y, PINE_DEEP);
  return c;
}

/** The mid band, 1920 x 304 art px: a tileSprite at 0.5, repeating every 480 game px. */
export function drawMidBarranca() {
  return midCells().scaled();
}

// ---------------------------------------------------------------------------------------------------- ground

/** The rows of the top tile's strata line and of the rock tile's two, the same in both versions. */
export const TOP_STRATA = 11;
export const ROCK_STRATA = [5, 12];

/**
 * One ground tile, 16 x 16 cells: a top tile (the walk line of ochre light, a strip of zacate 3 px deep along it with a ragged lower edge,
 * shaded pine green on the right of each tuft, a pale ledge of ochre light 2 px thick, then ochre rock with one strata line) or a rock tile
 * (ochre with two thin broken strata of ochre shade and a few small specks). The top tile's patterns repeat every 8 columns and the rock
 * tile's strata end on their rows at both edges, so tiles of either version meet without a seam; `version` 0 or 1 moves the details only,
 * inside the tile.
 */
export function drawTile(top, version) {
  const c = new Cells(16, 16);
  for (let i = 0; i < 256; i++) c.cells[i] = OCHRE;
  const strata = (row, specks) => {
    for (let x = 0; x < 16; x++) c.set(x, row, OCHRE_SHADE);
    for (const x of specks) c.set(x, row - 1, OCHRE_LIGHT);
  };
  if (top) {
    for (let x = 0; x < 16; x++) {
      const p = x % 8;
      // Tufts lit on their left, shaded on their right; the strip's ragged foot shows the pale ledge between them.
      const rows = [
        OCHRE_LIGHT,
        [ZACATE, ZACATE, PINE, ZACATE, ZACATE, ZACATE, ZACATE, PINE][p],
        [ZACATE, PINE, PINE, ZACATE, ZACATE, ZACATE, PINE, PINE][p],
        [ZACATE, PINE, OCHRE_LIGHT, OCHRE_LIGHT, ZACATE, PINE, PINE, OCHRE_LIGHT][p],
        OCHRE_LIGHT,
        OCHRE_LIGHT,
        // The ledge's shadow on the rock under it.
        p === 2 || p === 6 ? OCHRE : OCHRE_SHADE,
      ];
      rows.forEach((colour, y) => c.set(x, y, colour));
    }
    strata(TOP_STRATA, [3, 11]);
    // Version 0 has a tuft more, version 1 a pebble on the rock.
    if (version === 0) {
      c.set(10, 1, PINE);
      c.set(9, 2, ZACATE);
      c.set(10, 2, PINE);
      c.set(10, 3, PINE);
    } else {
      c.set(5, 13, OCHRE_LIGHT);
      c.set(6, 13, OCHRE_LIGHT);
      c.set(5, 14, OCHRE_SHADE);
      c.set(6, 14, OCHRE_SHADE);
    }
    return c;
  }
  // The rock tile, quiet: two thin strata of ochre shade, each broken by a gap or two and stepping down a row for a few columns, both ends
  // on their row so the bedding runs on into the next tile; where each breaks differs by version.
  ROCK_STRATA.forEach((row, k) => {
    const salt = 70 + 10 * k + version;
    const dipAt = 3 + Math.floor(noise(salt, 1) * 8);
    const gaps = [2 + Math.floor(noise(salt, 2) * 4), 9 + Math.floor(noise(salt, 3) * 4)];
    for (let x = 0; x < 16; x++) {
      if (gaps.includes(x)) continue;
      c.set(x, x >= dipAt && x < dipAt + 3 ? row + 1 : row, OCHRE_SHADE);
    }
  });
  // A few small specks, off the strata: a grain lit on its upper left, a pit in shade.
  const specks = version === 0 ? [[6, 2, OCHRE_LIGHT], [13, 9, OCHRE_SHADE], [2, 14, OCHRE_LIGHT]] : [[11, 2, OCHRE_SHADE], [4, 9, OCHRE_LIGHT], [12, 15, OCHRE_LIGHT]];
  for (const [x, y, colour] of specks) c.set(x, y, colour);
  if (version === 0) {
    // A small crack of rock deep, its far lip lit, its foot in shade.
    c.set(9, 8, ROCK_DEEP);
    c.set(10, 8, OCHRE_LIGHT);
    c.set(10, 9, OCHRE_SHADE);
  } else {
    // A small patch of lichen.
    for (const [x, y] of [[7, 2], [8, 2], [8, 3]]) c.set(x, y, PEAK);
  }
  return c;
}

/**
 * The ground sheet, 1792 x 64 (World 1's layout, so `groundFrame` is unchanged): frames 0 and 1 the top tile's versions, 2 and 3 the rock
 * tile's, 4 to 15 the slopes of SLOPE_ORDER, two versions each (a scree slope: the top tile over the rock tile cut along it), 16 to 27 the
 * tiles under them.
 */
export function drawGround() {
  return groundSheet(drawTile);
}

/** A ground sheet in World 1's layout from `tile(top, version)`, which draws a top tile or a rock tile as 16 x 16 cells (the mine's too). */
export function groundSheet(tile) {
  const pairs = SLOPE_ORDER.flatMap(([, left, right]) => [0, 1].map((v) => cutSlope(tile(true, v), tile(false, v), left, right)));
  const frames = [tile(true, 0), tile(true, 1), tile(false, 0), tile(false, 1), ...pairs.map((p) => p.slope), ...pairs.map((p) => p.foot)];
  const g = new Grid(frames.length * 64, 64);
  frames.forEach((tile, n) => {
    const px = tile.scaled();
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) g.set(n * 64 + x, y, px.get(x, y));
  });
  return g;
}

// ---------------------------------------------------------------------------------------------------- decor

/** The seven decor kinds' sizes in game px: pino, encino, madroño, maguey, sotol, tocón, zacatón. */
export const DECOR_SIZES = [[16, 40], [16, 28], [14, 24], [16, 12], [10, 32], [14, 8], [12, 8]];
/** The frame every decor item is drawn in, in game px (World 1's plants' frame): bottom-aligned and centred. */
export const DECOR_FRAME = { w: 16, h: 40 };

/**
 * A pino, 16 x 40: a rust-dark trunk under three tiers of pine green boughs, each wider than the one above, lit zacate tips on their upper
 * left, pine deep on their right and under each tier, the tips drooping.
 */
function drawPino() {
  const c = new Cells(16, 40);
  for (let y = 26; y < 40; y++) {
    c.set(7, y, RUST);
    c.set(8, y, ROCK_DEEP);
  }
  c.set(6, 39, RUST);
  c.set(9, 39, ROCK_DEEP);
  // Tiers as [top row, rows, widest half]: the lowest is the widest.
  for (const [t, rows, wide] of [[0, 12, 4], [8, 13, 6], [18, 14, 8]]) {
    for (let r = 0; r < rows; r++) {
      const half = Math.max(1, Math.round((wide * (r + 1)) / rows));
      const y = t + r;
      for (let x = 8 - half; x < 8 + half; x++) {
        const edge = x === 8 - half;
        let colour = x >= 8 ? PINE_DEEP : PINE;
        if (r === rows - 1) colour = edge ? PINE : PINE_DEEP;
        else if ((edge && r % 2 === 0) || (r === 0 && x === 7)) colour = ZACATE;
        c.set(x, y, colour);
      }
      // A drooping tip at the tier's outer ends.
      if (r === rows - 1) {
        c.set(8 - half, y + 1, PINE);
        c.set(7 + half, y + 1, PINE_DEEP);
      }
    }
  }
  return c;
}

/** An encino, 16 x 28: a short forked trunk under a wide round crown of pine green leaves in clumps, lit zacate on the upper left of each clump. */
function drawEncino() {
  const c = new Cells(16, 28);
  // The trunk and its fork, timber dark with its lit side.
  for (let y = 18; y < 28; y++) {
    c.set(7, y, TIMBER);
    c.set(8, y, TIMBER_DARK);
  }
  for (const [x, y, colour] of [[6, 27, TIMBER], [9, 27, TIMBER_DARK], [6, 18, TIMBER], [5, 17, TIMBER], [9, 18, TIMBER_DARK], [10, 17, TIMBER_DARK]]) c.set(x, y, colour);
  const crown = or(ellipse(8, 8, 7.8, 7.2), ellipse(4, 12.5, 4, 4.5), ellipse(12, 12.5, 4, 4.5));
  shade(c, (x, y) => y < 18 && crown(x, y), PINE, ZACATE, PINE_DEEP);
  // Clumps inside the crown: a lit cell over a shaded one.
  for (const [x, y] of [[5, 6], [9, 4], [11, 8], [4, 11], [8, 11], [12, 13], [6, 14]]) {
    c.set(x, y, ZACATE);
    c.set(x + 1, y + 1, PINE_DEEP);
  }
  return c;
}

/** A madroño, 14 x 24: a small tree with smooth rust-red bark curving up into two limbs, a tuft of leaves at their tops. */
function drawMadrono() {
  const c = new Cells(14, 24);
  const bark = [[6, 23], [6, 22], [6, 21], [6, 20], [7, 19], [7, 18], [7, 17], [6, 16], [6, 15], [5, 14], [5, 13], [4, 12], [8, 16], [9, 15], [9, 14], [10, 13], [10, 12]];
  for (const [x, y] of bark) {
    c.set(x, y, RUST);
    c.set(x + 1, y, ROCK_DEEP);
  }
  c.set(5, 23, RUST);
  c.set(8, 23, ROCK_DEEP);
  const tuft = or(ellipse(7, 6, 6.5, 4.6), ellipse(3.5, 9, 3.4, 3), ellipse(10.5, 9, 3.4, 3));
  shade(c, (x, y) => y < 12 && tuft(x, y), PINE, ZACATE, PINE_DEEP);
  for (const [x, y] of [[4, 4], [8, 3], [10, 7]]) c.set(x, y, ZACATE);
  return c;
}

/** A maguey, 16 x 12: a rosette of broad peak-base leaves from one point, their lit edges on the upper left, their shaded halves on the right. */
function drawMaguey() {
  const c = new Cells(16, 12);
  // Back leaves first, then the front ones over them.
  for (const [tx, ty, half] of [[1, 2, 1.6], [14, 1, 1.6], [5, 0, 1.7], [11, 0, 1.7], [8, 0, 1.4], [0, 8, 1.5], [15, 7, 1.5], [3, 5, 2], [13, 4, 2]]) {
    leaf(c, 8, 11.5, tx + 0.5, ty + 0.5, half, PEAK, PEAK_SHADE);
  }
  litEdges(c, PEAK, PEAK_LIT);
  return c;
}

/** The cells of `base` on a shape's upper or left edge, where the light falls, turned to `lit`. */
function litEdges(c, base, lit) {
  const edge = [];
  for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) if (c.get(x, y) === base && (c.get(x - 1, y) === null || c.get(x, y - 1) === null)) edge.push([x, y]);
  for (const [x, y] of edge) c.set(x, y, lit);
}

/** A sotol, 10 x 32: a low spiky rosette of narrow leaves, and from it one tall stalk with a plume of pale flowers. */
function drawSotol() {
  const c = new Cells(10, 32);
  // The stalk, timber lit, and its plume of florets in ochre light and timber lit, lit on the left.
  for (let y = 2; y < 26; y++) c.set(5, y, y < 14 ? TIMBER : TIMBER_LIT);
  for (let y = 0; y < 14; y++) {
    const half = y < 2 ? 0 : y < 11 ? 1 : 0;
    for (let x = 5 - half; x <= 5 + half; x++) c.set(x, y, x > 5 || (y % 3 === 2 && x === 5) ? TIMBER_LIT : OCHRE_LIGHT);
  }
  c.set(5, 0, TIMBER_LIT);
  // The rosette: narrow spiky leaves fanning from its base.
  for (const [tx, ty] of [[0, 25], [9, 24], [2, 22], [8, 21], [4, 21], [6, 22], [1, 28], [9, 28]]) {
    leaf(c, 5, 31.5, tx + 0.5, ty + 0.5, 0.9, PEAK, PEAK_SHADE);
  }
  litEdges(c, PEAK, PEAK_LIT);
  return c;
}

/** A tocón, 14 x 8: a pine stump, its saw-cut top lit with a ring, its bark in timber, and a fallen branch lying beside it. */
const TOCON = [
  '.TTTTT........',
  'tTtttTd.......',
  'tTTTTTdd......',
  'tttttddd...d..',
  'tttttddd..dtd.',
  'tttttdddtTtd..',
  'ttttdddtTtdd..',
  'tttdddddddd...',
];

/** A zacatón, 12 x 8: a clump of bunch grass, blades fanning up from its base, lit on the left, their tips pale. */
const ZACATON = [
  '..L....L....',
  '..Z.L.ZP.L..',
  '.LZ.ZPZP.ZP.',
  '.ZZPZZZPPZP.',
  'ZZPZZZPZPZPP',
  '.ZZZPZZPZPP.',
  '..ZZZPZPPP..',
  '...ZZZPPP...',
];

/** The seven decor items' cells in the order of their kind. */
function decorCells() {
  return [drawPino(), drawEncino(), drawMadrono(), drawMaguey(), drawSotol(), fromRows(TOCON, INK), fromRows(ZACATON, INK)];
}

/** The decor sheet, 448 x 160 art px: seven frames of 16 x 40 game px, each item bottom-aligned and centred. Frame n is kind n. */
export function drawDecor() {
  const g = new Grid(DECOR_FRAME.w * S * DECOR_SIZES.length, DECOR_FRAME.h * S);
  decorCells().forEach((cells, n) => {
    const frame = new Cells(DECOR_FRAME.w, DECOR_FRAME.h);
    stamp(frame, cells, (DECOR_FRAME.w - cells.w) >> 1, DECOR_FRAME.h - cells.h);
    const px = frame.scaled();
    for (let y = 0; y < px.height; y++) for (let x = 0; x < px.width; x++) g.set(n * DECOR_FRAME.w * S + x, y, px.get(x, y));
  });
  return g;
}

// ---------------------------------------------------------------------------------------------------- the rock ledge

/**
 * The rock ledge (World 3's crumbling tile on 3-1's cliff faces, GDD-WLD-05), frames of 16 x 16 game px: a slab `slab` px thick at the
 * tile's top, loose stones hanging under it to `hang` px, the rest of the tile empty. The outline lies inside the tile, so the drawing is
 * no wider than the tile and the slab's top is the tile's top edge, where he stands. Frame 0 at rest, frame 1 its pale flash.
 */
export const LEDGE_ART = { frame: 16, slab: 6, hang: 9 };

/** The slab: ochre light on its top and left, ochre below, two cracks of rock deep through it; a small loose pebble under each crack. */
const LEDGE = [
  'LLLLLLKLLLLLKLLL',
  'LOOOOOKOOOOOKOOO',
  'LOOOOOOKOOOOKOOO',
  'LOOOOOOKOOOOOKOO',
  'LOOOOOKOOOOOOKOO',
  'LOOOOOKOOOOOOOKO',
  '.....OO......Oo.',
  '......Oo.....o..',
];

/** The slab's pale flash: its fill colours lifted, the cracks and the outline as they are. */
const FLASH = { [OCHRE_LIGHT]: MIST, [OCHRE]: OCHRE_LIGHT };

/** The art pixels of a shape in `grid` (no wider than its frame) less a ring 2 art px wide on its outside, the frame's edges counting as outside. */
function eroded(grid) {
  let g = grid;
  for (let pass = 0; pass < 2; pass++) {
    const next = new Grid(g.width, g.height);
    for (let y = 0; y < g.height; y++) {
      for (let x = 0; x < g.width; x++) {
        const edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => g.get(x + dx, y + dy) === null);
        if (g.get(x, y) !== null && !edge) next.set(x, y, g.get(x, y));
      }
    }
    g = next;
  }
  return g;
}

/** The ledge sheet, 128 x 64 art px (LEDGE_ART): frame 0 at rest, frame 1 the same in its pale flash. */
export function drawLedge() {
  const rows = [...LEDGE, ...Array.from({ length: LEDGE_ART.frame - LEDGE.length }, () => '.'.repeat(16))];
  const frames = [0, 1].map((n) => {
    const cells = fromRows(rows, INK);
    if (n === 1) for (let y = 0; y < LEDGE_ART.slab; y++) for (let x = 0; x < 16; x++) if (FLASH[cells.get(x, y)]) cells.set(x, y, FLASH[cells.get(x, y)]);
    const px = eroded(cells.scaled());
    // The outline round the rest, 2 art px, inside the tile: where the eroded ring was.
    for (let pass = 0; pass < 2; pass++) {
      const add = [];
      for (let y = 0; y < px.height; y++) for (let x = 0; x < px.width; x++) if (px.get(x, y) === null && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => px.get(x + dx, y + dy) !== null)) add.push([x, y]);
      for (const [x, y] of add) px.set(x, y, OUTLINE);
    }
    return px;
  });
  const g = new Grid(2 * 64, 64);
  frames.forEach((f, n) => {
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) g.set(n * 64 + x, y, f.get(x, y));
  });
  return g;
}
