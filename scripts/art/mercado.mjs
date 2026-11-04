// World 2's (Mercado) backdrop, ground, decor and signature objects, drawn in code like World 1's (GDD-ART-01, GDD-ART-06; the art
// director's spec for World 2, drawn from the spec without reference images, "Design it, show me", user, 2026-11-04). Cool, pale and
// soft for what Poncho cannot touch (sky, the far hill town, the mid rooftops); warm, saturated and crisp for what he can (the roofs
// he runs on, the market's things); the near-black outline only on the awnings, the cordeles' flags and the rollos, the touchable world
// objects (D6). 24 colours, light from the upper left, whole game pixels (4 x 4 art pixels) except the sky's dither and the outlines.
import { Cells, noise, S, shade, stamp, within, wrapDelta } from './cells.mjs';
import { ellipse, Grid } from './raster.mjs';
import { cutSlope, SLOPE_ORDER, slopeTopRow } from './slopes.mjs';

export { SLOPE_ORDER, slopeTopRow };

/** The 24 colours, grouped as the spec lists them (2.1): sky, far town, mid roofs (with the street), tejas, plaster, talavera, market. */
export const PALETTE = {
  sky: ['#86BEE0', '#A9D3EA', '#CFE8F1'],
  far: ['#C3C6DE', '#9AA6CD', '#7C86B5'],
  mid: ['#E6C2B8', '#C99A9E', '#E4CC9E', '#4E4A78'],
  teja: ['#E07A52', '#C45E3E', '#8A3B30'],
  plaster: ['#F2B0A6', '#E07F8E', '#B85E6E'],
  talavera: ['#1C3F9E', '#F4EFE2', '#E9B53F'],
  market: ['#D9327E', '#2AA198', '#4F8F4C', '#3B2B3C', '#7E5A3E'],
};
/** The outline of everything that can be touched (GDD-ART-05), Poncho's; the touchable world objects carry it too (D6). */
export const OUTLINE = '#070509';

const [SKY_TOP, SKY_MID, SKY_HORIZON] = PALETTE.sky;
const [FAR_LIT, FAR_BASE, FAR_SHADE] = PALETTE.far;
const [MID_ROSE, MID_SHADE, MID_OCHRE, STREET] = PALETTE.mid;
const [TEJA_LIT, TEJA, TEJA_DARK] = PALETTE.teja;
const [PL_LIT, PLASTER, PL_SHADE] = PALETTE.plaster;
const [COBALT, GLAZE, YELLOW] = PALETTE.talavera;
const [ROSA, TEAL, LEAF, IRON, WOOD] = PALETTE.market;

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
const INK = { W: GLAZE, B: COBALT, Y: YELLOW, P: ROSA, T: TEAL, G: LEAF, I: IRON, D: WOOD, L: TEJA_LIT, R: TEJA, K: TEJA_DARK, l: PL_LIT, p: PLASTER, s: PL_SHADE };

/**
 * A ring `thickness` art px wide round the shape in `grid`, only where the empty pixel can be reached from the picture's border: holes
 * inside a shape (papel picado's cut-outs) stay see-through (GDD-ART-05: the outline is on the outside).
 */
export function outlineOutside(grid, colour, thickness) {
  const { width: w, height: h } = grid;
  const outside = new Uint8Array(w * h);
  const stack = [];
  for (let x = 0; x < w; x++) stack.push([x, 0], [x, h - 1]);
  for (let y = 0; y < h; y++) stack.push([0, y], [w - 1, y]);
  while (stack.length) {
    const [x, y] = stack.pop();
    if (x < 0 || y < 0 || x >= w || y >= h || outside[y * w + x] || grid.get(x, y) !== null) continue;
    outside[y * w + x] = 1;
    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
  for (let pass = 0; pass < thickness; pass++) {
    const add = [];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (!outside[y * w + x] || grid.get(x, y) !== null) continue;
        if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => grid.get(x + dx, y + dy) !== null)) add.push([x, y]);
      }
    }
    for (const [x, y] of add) grid.set(x, y, colour);
  }
  return grid;
}

// ---------------------------------------------------------------------------------------------------- sky

/** Where the sky's first two bands end (art y from the top, 2.2); the horizon band runs on from the last and is the camera's background. */
export const SKY_ENDS = [240, 440];
/** The height of the dither strip at the end of a band (art px). */
export const STRIP = 2;
const BANDS = PALETTE.sky;

/** The dither strips between the sky's bands, 1920 x 4 art px: frame n sits at the end of band n, a checker of 2 px cells (GDD-ART-05). */
export function drawSkyStrips() {
  const g = new Grid(WIDTH, STRIP * SKY_ENDS.length);
  SKY_ENDS.forEach((_, i) => {
    for (let y = 0; y < STRIP; y++) for (let x = 0; x < WIDTH; x++) g.set(x, i * STRIP + y, Math.floor(x / 2) % 2 === 0 ? BANDS[i] : BANDS[i + 1]);
  });
  return g;
}

/** The whole sky, 1920 x 1080: the three flat bands with the dither strips (no sun, D3). The game draws it from its pieces. */
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

/** The cloud layer's height in game px (screen y 0 to 72; the clouds sit between 14 and 64). */
export const CLOUD_LAYER_H = 72;
/** The three clouds: centre column, flat base row and puffs [dx, dy, rx, ry] from the centre and the base, in game px (2.2). */
const CLOUDS = [
  { cx: 90, base: 32, puffs: [[-10, -3, 8, 4], [-1, -6, 9, 6], [9, -4, 8, 4], [0, -1, 17, 3]] },
  { cx: 250, base: 36, puffs: [[-14, -4, 9, 5], [-3, -8, 11, 8], [10, -6, 10, 6], [17, -3, 7, 4], [0, -1, 23, 3]] },
  { cx: 410, base: 58, puffs: [[-7, -3, 7, 3], [1, -5, 7, 5], [8, -3, 6, 3], [0, -1, 14, 3]] },
];

function cloudParts() {
  return CLOUDS.map(({ cx, base, puffs }) => {
    const c = new Cells(480, CLOUD_LAYER_H);
    const inside = (x, y) => y < base && puffs.some(([dx, dy, rx, ry]) => ((x + 0.5 - cx - dx) / rx) ** 2 + ((y + 0.5 - base - dy) / ry) ** 2 <= 1);
    let x0 = 480, y0 = CLOUD_LAYER_H, x1 = -1, y1 = -1;
    for (let y = 0; y < CLOUD_LAYER_H; y++) {
      for (let x = 0; x < 480; x++) {
        if (!inside(x, y)) continue;
        // Glaze white on top, the horizon blue on the flat underside and the lower right (light from the upper left).
        const rim = !inside(x + 2, y + 1) || !inside(x + 1, y + 2);
        c.set(x, y, y >= base - 2 || (rim && y >= base - 7) ? SKY_HORIZON : GLAZE);
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

/** The clouds' pictures, one per cloud, in whole game pixels. */
export function drawCloudImages() {
  return PARTS.map(({ cells }) => cells.scaled());
}

/** The clouds as one layer, 1920 x 288 art px, which repeats sideways (no cloud touches its sides). The game draws them one by one. */
export function drawClouds() {
  const c = new Cells(480, CLOUD_LAYER_H);
  for (const { x, y, cells } of PARTS) stamp(c, cells, x, y);
  return c.scaled();
}

// ---------------------------------------------------------------------------------------------------- far town

/** The far band (2.3): screen game y 84 to 200, 480 x 116 game px, scrolling at 0.3; below it the flat foot. */
export const FAR = { top: 84, w: 480, h: 116 };
/** The hill's two rises: [centre x, top y (screen), half plateau, left slope, right slope (px down per px across)]. */
const HILL = [[150, 140, 28, 0.25, 0.35], [365, 128, 34, 0.3, 0.52]];

/** The hill's first row at column x (screen game y), which rise it belongs to, and the column's distance from that rise's centre. */
function hillTop(x) {
  let best = Infinity, which = 0, d = 0;
  HILL.forEach(([cx, top, half, l, r], i) => {
    const dd = wrapDelta(x, cx);
    const y = top + (dd < -half ? l * (-dd - half) : dd > half ? r * (dd - half) : 0);
    if (y < best) [best, which, d] = [y, i, dd];
  });
  return { y: Math.round(best), which, d };
}

/** The parish church (D2): the nave, the bell tower in three tiers with its cupola and cross, and the talavera dome, at x 126 to 176. */
function drawChurch(c, at) {
  const set = (x, y, colour) => c.set(x, y - at, colour);
  const box = (x0, y0, w, h, lit, base, dark, litCols = 1, darkCols = 1) => {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) set(x, y, x < x0 + litCols ? lit : x >= x0 + w - darkCols ? dark : base);
  };
  // The nave, 32 x 20: its long side lit, its far end in shade, a cornice along the top and three tall windows.
  box(140, 120, 32, 20, FAR_LIT, FAR_LIT, FAR_SHADE, 0, 4);
  for (let x = 140; x < 168; x++) set(x, 120, FAR_BASE);
  for (const wx of [144, 150, 162]) for (let y = 125; y < 130; y++) set(wx, y, FAR_SHADE);
  for (let y = 120; y < 140; y++) set(167, y, FAR_BASE);
  // The dome on its drum over the crossing: the drum 16 x 4, the dome a half ellipse 16 x 9, lit on its upper left, ribs, a glaze glint,
  // and a small lantern with a cross on top.
  box(150, 116, 16, 4, FAR_LIT, FAR_BASE, FAR_SHADE, 2, 3);
  for (const x of [153, 157, 161]) set(x, 117, FAR_SHADE);
  const dome = (x, y) => y < 116 && ((x - 158) / 8) ** 2 + ((y - 116) / 9) ** 2 <= 1;
  for (let y = 106; y < 116; y++) {
    for (let x = 150; x < 166; x++) {
      if (!dome(x + 0.5, y + 0.5)) continue;
      const u = x + 0.5 - 158, v = y + 0.5 - 116;
      // Lit towards the upper left, shaded towards the lower right: by the angle of the cell from the dome's centre.
      const facing = -(u / 8) * 0.8 - (v / 9) * 0.6;
      set(x, y, facing > 0.55 ? FAR_LIT : facing < -0.05 ? FAR_SHADE : FAR_BASE);
    }
  }
  for (const [x0, y0] of [[154, 109], [156, 107], [162, 108]]) for (let y = y0; y < 116; y++) if (c.get(x0, y - at) === FAR_LIT) set(x0, y, FAR_BASE);
  set(153, 109, SKY_HORIZON);
  set(154, 108, SKY_HORIZON);
  box(157, 103, 2, 3, FAR_LIT, FAR_BASE, FAR_SHADE, 1, 1);
  set(157, 101, FAR_SHADE);
  set(157, 102, FAR_SHADE);
  set(156, 101, FAR_SHADE);
  set(158, 101, FAR_SHADE);
  set(157, 100, FAR_SHADE);
  // The bell tower: three tiers (10, 8 and 6 wide), each with a ledge and a bell opening, a cupola and a cross whose tip is at y 84.
  box(130, 112, 10, 28, FAR_LIT, FAR_BASE, FAR_SHADE, 2, 2);
  for (let y = 126; y < 140; y++) set(134, y, FAR_BASE);
  box(129, 111, 12, 1, FAR_LIT, FAR_LIT, FAR_SHADE, 0, 1);
  box(131, 103, 8, 8, FAR_LIT, FAR_BASE, FAR_SHADE, 2, 2);
  box(130, 102, 10, 1, FAR_LIT, FAR_LIT, FAR_SHADE, 0, 1);
  box(132, 96, 6, 6, FAR_LIT, FAR_BASE, FAR_SHADE, 1, 1);
  for (const [y0, x0] of [[113, 134], [104, 134], [97, 134]]) for (let y = y0; y < y0 + 3; y++) for (let x = x0; x < x0 + 2; x++) set(x, y, FAR_SHADE);
  box(133, 93, 4, 3, FAR_LIT, FAR_BASE, FAR_SHADE, 1, 1);
  box(134, 92, 2, 1, FAR_BASE, FAR_BASE, FAR_BASE, 0, 0);
  for (let y = 84; y < 92; y++) set(134, y, FAR_SHADE);
  for (const x of [133, 135]) set(x, 86, FAR_SHADE);
}

/** The hilltop chapel (D2): a small chapel 12 x 8 with its espadaña (a bell gable with one opening) on the crest at x 356 to 372. */
function drawChapel(c, at) {
  const set = (x, y, colour) => c.set(x, y - at, colour);
  for (let y = 120; y < 130; y++) for (let x = 358; x < 372; x++) set(x, y, x >= 369 ? FAR_SHADE : FAR_LIT);
  for (let x = 358; x < 372; x++) set(x, 120, FAR_BASE);
  // The gable over the front: a stepped top, an opening with its bell.
  const gable = [[358, 113, 6], [359, 112, 4], [360, 111, 2]];
  for (const [x0, y, w] of gable) for (let x = x0; x < x0 + w; x++) set(x, y, FAR_BASE);
  for (let y = 114; y < 120; y++) for (let x = 358; x < 364; x++) set(x, y, x === 363 ? FAR_BASE : FAR_LIT);
  for (let y = 115; y < 118; y++) for (const x of [360, 361]) set(x, y, FAR_SHADE);
  set(360, 110, FAR_SHADE);
  set(360, 109, FAR_SHADE);
  // Its door, an arch.
  for (let y = 124; y < 130; y++) for (const x of [360, 361]) set(x, y, FAR_SHADE);
  set(366, 123, FAR_SHADE);
}

/**
 * The far band's cells, 480 x 116 (screen game y 84 to 200): the hill in three blues with its lit slopes in streaks, the houses that
 * climb it in rows, the church on the shoulder and the chapel on the crest, and a checker into shade at the foot (2.3).
 */
function farCells() {
  const { top, w, h } = FAR;
  const c = new Cells(w, h);
  for (let x = 0; x < w; x++) {
    const { y: ridge, which, d } = hillTop(x);
    const half = HILL[which][2];
    for (let y = ridge; y < top + h; y++) {
      const depth = y - ridge;
      let colour = FAR_BASE;
      if (d < -half) {
        // A slope that faces the upper left: a lit rim and long lit streaks down the slope.
        if (depth < 2 || (depth < 14 && (x + 3 * y) % 17 < 3 && depth > 3)) colour = FAR_LIT;
      } else if (d > half) {
        if (depth < 4) colour = FAR_SHADE;
      } else if (depth < 1) colour = FAR_LIT;
      if (y >= 194 || (y >= 191 && (x + y) % 2 === 0)) colour = FAR_SHADE;
      c.set(x, y - top, colour);
    }
  }
  drawChurch(c, top);
  drawChapel(c, top);
  // The houses: small cubes in terraces that follow the slope, side by side, the front lit, the right side in shade, a window dot on
  // every other one, the hill showing between the terraces; none within 6 px of the ridge above them, none over the landmarks.
  let n = 0;
  for (let tier = 0; tier < 5; tier++) {
    let x = 2 + ((tier * 13) % 11);
    while (x < w - 11) {
      const hw = 6 + Math.floor(noise(x, tier * 7 + 1) * 5);
      const hh = 5 + Math.floor(noise(x, tier * 7 + 2) * 4);
      let ground = 0;
      for (let i = 0; i < hw; i++) ground = Math.max(ground, hillTop(x + i).y);
      const foot = ground + 13 + tier * 9;
      const y0 = foot - hh;
      const nearChurch = x + hw > 124 && x < 178 && y0 < 141;
      const nearChapel = x + hw > 352 && x < 376 && y0 < 132;
      // Thinner near the top of the hill, a gap now and then.
      const keep = noise(x, tier + 31) < [0.45, 0.7, 0.85, 0.9, 0.9][tier];
      if (keep && !nearChurch && !nearChapel && foot < 192) {
        for (let y = y0; y < foot; y++) for (let i = 0; i < hw; i++) c.set(x + i, y - top, i === hw - 1 ? FAR_SHADE : FAR_LIT);
        if (n % 2 === 0) c.set(x + 2 + (n % 3), y0 + 2 - top, FAR_SHADE);
        n++;
        x += hw + 1 + Math.floor(noise(x, tier + 19) * 3);
      } else x += hw + 2;
    }
  }
  return c;
}

/** The far band, 1920 x 464 art px: a tileSprite at 0.3, repeating every 480 game px. */
export function drawFarTown() {
  return farCells().scaled();
}

// ---------------------------------------------------------------------------------------------------- mid roofs

/** The mid band (2.4): screen game y 148 to 224, 480 x 76 game px, scrolling at 0.5. Its bottom is the floor's top (row 14). */
export const MID = { top: 148, w: 480, h: 76 };
/** The flat foot below the far band, under the mid band: a pit shows this dark street (2.5). */
export const FOOT_COLOUR = STREET;

/**
 * The blocks of houses along the strip: [left x, width, roof y (screen), front colour]. The first and the last are one block across the
 * strip's seam, so it repeats without a step. The market hall (x 300 to 400) is drawn on its own.
 */
const BLOCKS = [
  [0, 36, 182, MID_OCHRE],
  [36, 44, 166, MID_ROSE],
  [80, 30, 186, MID_OCHRE],
  [110, 52, 176, MID_ROSE],
  [162, 34, 164, MID_OCHRE],
  [196, 44, 188, MID_ROSE],
  [240, 30, 172, MID_OCHRE],
  [270, 30, 190, MID_ROSE],
  [300, 100, 186, MID_OCHRE],
  [400, 36, 168, MID_ROSE],
  [436, 44, 182, MID_OCHRE],
];

/** A window 2 x 3 in the street's dark, with a sill under it in the other front colour. */
function window2x3(c, x, y, front) {
  for (let j = 0; j < 3; j++) for (let i = 0; i < 2; i++) c.set(x + i, y + j, STREET);
  const sill = front === MID_ROSE ? MID_OCHRE : MID_ROSE;
  for (let i = -1; i < 3; i++) c.set(x + i, y + 3, sill);
}

/** A mid-layer papel picado string from (x0, y0) to (x1, y1), sagging `sag` px, flags 3 x 4 every 4 px in the muted colours (2.4). */
function midString(c, x0, y0, x1, y1, sag, at) {
  const muted = [FAR_LIT, MID_OCHRE, MID_ROSE, FAR_BASE];
  const lineY = (x) => {
    const t = (x - x0) / (x1 - x0);
    return Math.round(y0 + (y1 - y0) * t + sag * 4 * t * (1 - t));
  };
  for (let x = x0; x <= x1; x++) c.set(x, lineY(x) - at, MID_SHADE);
  for (let i = 0, x = x0 + 2; x + 3 <= x1 - 1; i++, x += 4) {
    const y = lineY(x + 1) + 1;
    for (let dy = 0; dy < 4; dy++) for (let dx = 0; dx < 3; dx++) if (!(dy === 3 && dx === 1)) c.set(x + dx, y + dy - at, muted[i % 4]);
  }
}

/** A rooftop tinaco (water tank, 6 x 7): a plain pale cylinder, its left half lit and its right half in shade, a lid line; no logo. */
function tinaco(c, x, roof, at) {
  for (let y = roof - 7; y < roof; y++) for (let i = 0; i < 6; i++) c.set(x + i, y - at, i < 3 ? MID_ROSE : MID_SHADE);
  for (let i = 1; i < 5; i++) c.set(x + i, roof - 8 - at, i < 3 ? MID_ROSE : MID_SHADE);
  for (let i = 0; i < 6; i++) c.set(x + i, roof - 6 - at, MID_SHADE);
  // Its stand, two legs.
  c.set(x, roof - 1 - at, MID_SHADE);
  c.set(x + 5, roof - 1 - at, MID_SHADE);
  for (let i = 1; i < 5; i++) c.set(x + i, roof - 1 - at, null);
}

/** A washing line 20 px long on a roof: two posts, a sagging line, three garments 3 x 4 in the far colours (2.4). */
function tendedero(c, x, roof, at) {
  for (let y = roof - 8; y < roof; y++) {
    c.set(x, y - at, MID_SHADE);
    c.set(x + 19, y - at, MID_SHADE);
  }
  for (let i = 1; i < 19; i++) c.set(x + i, roof - 8 + (i > 4 && i < 15 ? 1 : 0) - at, MID_SHADE);
  [[3, FAR_LIT], [8, MID_OCHRE], [13, FAR_BASE]].forEach(([dx, colour], k) => {
    const y0 = roof - 7 + (dx > 4 && dx < 15 ? 1 : 0);
    for (let j = 0; j < 4 - (k === 1 ? 1 : 0); j++) for (let i = 0; i < 3; i++) c.set(x + dx + i, y0 + j - at, colour);
  });
}

/** A rooftop stair hut (cuarto de azotea) with an arched doorway 4 x 6, its right side in shade. */
function hut(c, x, w, roof, h, front, at) {
  for (let y = roof - h; y < roof; y++) for (let i = 0; i < w; i++) c.set(x + i, y - at, i >= w - 2 ? MID_SHADE : y === roof - h ? MID_SHADE : front);
  const dx = x + 2;
  for (let y = roof - 6; y < roof; y++) for (let i = 0; i < 4; i++) if (!(y === roof - 6 && (i === 0 || i === 3))) c.set(dx + i, y - at, STREET);
}

/** The market hall (mercado municipal), x 300 to 400: an ochre front with one big arched entrance, a clerestory of windows and a barrel-vaulted roof whose top is at y 170. */
function marketHall(c, at) {
  const set = (x, y, colour) => c.set(x, y - at, colour);
  // The vault: a shallow arch from y 178 at its ends to 170 in the middle, lit on its left half, its right half in shade, with ribs.
  for (let x = 306; x < 394; x++) {
    const t = (x + 0.5 - 350) / 44;
    const topY = Math.round(170 + 8 * t * t);
    for (let y = topY; y < 178; y++) set(x, y, x >= 356 ? MID_SHADE : y === topY ? MID_OCHRE : MID_ROSE);
  }
  for (let x = 314; x < 390; x += 8) for (let y = 172; y < 178; y++) if (c.get(x, y - at) !== null) set(x, y, MID_SHADE);
  for (let x = 358; x < 394; x += 8) for (let y = 172; y < 178; y++) if (c.get(x, y - at) !== null) set(x, y, MID_ROSE);
  // The clerestory: a rose band with a row of small windows.
  for (let y = 178; y < 186; y++) for (let x = 304; x < 396; x++) set(x, y, y === 178 || x >= 393 ? MID_SHADE : MID_ROSE);
  for (let x = 308; x < 392; x += 6) for (let y = 180; y < 184; y++) for (const i of [0, 1]) set(x + i, y, STREET);
  // The front, its top cornice, side windows and the big arch.
  for (let y = 186; y < 224; y++) for (let x = 300; x < 400; x++) set(x, y, y === 186 ? MID_SHADE : x >= 397 ? MID_SHADE : MID_OCHRE);
  for (let x = 300; x < 400; x++) set(x, 187, MID_ROSE);
  const arch = (x, y) => (y >= 202 && x >= 340 && x < 360) || ((x + 0.5 - 350) / 10) ** 2 + ((y + 0.5 - 202) / 10) ** 2 <= 1;
  for (let y = 190; y < 224; y++) {
    for (let x = 338; x < 362; x++) {
      if (arch(x + 0.5, y + 0.5)) set(x, y, STREET);
      else if (arch(x - 0.5, y + 0.5) || arch(x + 1.5, y + 0.5) || arch(x + 0.5, y + 1.5)) set(x, y, MID_ROSE);
    }
  }
  for (const wx of [308, 318, 328, 370, 380, 390]) for (const wy of [194, 206]) window2x3(c, wx, wy - at, MID_OCHRE);
}

/** The mid band's cells, 480 x 76 (screen game y 148 to 224). */
function midCells() {
  const { top, w, h } = MID;
  const c = new Cells(w, h);
  BLOCKS.forEach(([x0, bw, roof, front], i) => {
    for (let y = roof; y < top + h; y++) for (let x = x0; x < x0 + bw; x++) c.set(x, y - top, front);
    // The parapet, broken now and then.
    for (let x = x0; x < x0 + bw; x++) if (noise(x >> 2, i + 3) > 0.18) c.set(x, roof - top, MID_SHADE);
  });
  BLOCKS.forEach(([x0, bw, roof, front], i) => {
    if (i === 8) return;
    // Windows in rows, clear of the block's sides and of the street's dark at the foot.
    for (let wy = roof + 6; wy + 4 < 214; wy += 12) {
      for (let wx = x0 + 5; wx + 2 <= x0 + bw - 5; wx += 10) if (noise(wx, wy) < 0.62) window2x3(c, wx, wy - top, front);
    }
  });
  marketHall(c, top);
  // A block taller than its right-hand neighbour shows its right side in shade and casts a long shadow at 45 degrees across the top
  // of the neighbour's front, 12 px down at most (the "first long shadows").
  BLOCKS.forEach(([x0, bw, roof], i) => {
    const [nx, nw, nroof] = BLOCKS[(i + 1) % BLOCKS.length];
    if (nroof <= roof || nx === 0) return;
    const right = x0 + bw;
    for (let y = roof + 1; y < nroof; y++) for (let x = right - 3; x < right; x++) c.set(x, y - top, MID_SHADE);
    for (let y = nroof; y < Math.min(nroof + 12, 214); y++) {
      for (let x = right; x < Math.min(nx + nw, right + (y - roof)); x++) {
        const cell = c.get(x, y - top);
        if (cell === MID_ROSE || cell === MID_OCHRE) c.set(x, y - top, MID_SHADE);
        else if (cell === MID_SHADE && y === nroof) c.set(x, y - top, MID_SHADE);
      }
    }
  });
  // Rooftop life: four tinacos, two washing lines, two stair huts with arched doorways.
  for (const [x, roof] of [[12, 182], [124, 176], [214, 188], [416, 168]]) tinaco(c, x, roof, top);
  tendedero(c, 85, 186, top);
  tendedero(c, 274, 190, top);
  hut(c, 226, 10, 188, 9, MID_ROSE, top);
  hut(c, 446, 10, 182, 8, MID_OCHRE, top);
  // Two papel picado strings across the gaps between taller blocks, sagging 3 px.
  midString(c, 78, 168, 163, 166, 3, top);
  midString(c, 194, 167, 241, 174, 3, top);
  // The foot: the last rows go to the street's dark through a checker.
  for (let y = h - 6; y < h; y++) for (let x = 0; x < w; x++) if (y >= h - 4 || (x + y) % 2 === 0) c.set(x, y, STREET);
  return c;
}

/** The mid band, 1920 x 304 art px: a tileSprite at 0.5, repeating every 480 game px. */
export function drawMidRoofs() {
  return midCells().scaled();
}

// ---------------------------------------------------------------------------------------------------- ground

/**
 * One ground tile, 16 x 16 cells (2.6): a top tile (the walk line of the tejas, their channels and round ends, the scallop, the eave's
 * shadow, the talavera band, pink plaster) or a wall tile (pink plaster). Every pattern repeats every 4 columns, so tiles of either
 * version meet without a seam; `version` 0 or 1 moves the details only.
 */
function drawTile(top, version) {
  const c = new Cells(16, 16);
  for (let i = 0; i < 256; i++) c.cells[i] = PLASTER;
  if (top) {
    for (let x = 0; x < 16; x++) {
      const p = x % 4;
      const rows = [
        TEJA_LIT,
        [TEJA_LIT, TEJA, TEJA, TEJA_DARK][p],
        [TEJA_LIT, TEJA, TEJA, TEJA_DARK][p],
        p === 3 ? TEJA_DARK : TEJA,
        p === 1 || p === 2 ? TEJA_DARK : PL_SHADE,
        PL_SHADE,
        PL_SHADE,
        x % 2 === 0 ? PL_SHADE : PLASTER,
        COBALT,
        p === 1 ? COBALT : GLAZE,
        [COBALT, YELLOW, COBALT, GLAZE][p],
        p === 1 ? COBALT : GLAZE,
        COBALT,
        PL_SHADE,
        PLASTER,
        PLASTER,
      ];
      rows.forEach((colour, y) => c.set(x, y, colour));
    }
    if (version === 0) c.set(9, 2, TEJA_LIT);
    else c.set(10, 4, PL_SHADE);
    for (const [x, y] of version === 0 ? [[3, 15], [9, 14]] : [[6, 14], [13, 15]]) c.set(x, y, PL_SHADE);
    return c;
  }
  // A speck: a dent in the plaster, its upper left lip lit.
  const speck = (x, y) => {
    c.set(x, y, PL_SHADE);
    c.set(x - 1, y - 1, PL_LIT);
  };
  if (version === 0) {
    // A chip where the plaster has fallen off, showing two courses of adobe bricks; the recess's top and left in shade, its bottom and
    // right lit.
    const chip = [
      '.ssss.',
      'sRRlRl',
      'sRlRRl',
      '.llll.',
    ];
    chip.forEach((row, j) => [...row].forEach((ch, i) => ch !== '.' && c.set(3 + i, 6 + j, INK[ch])));
    for (const [x, y] of [[11, 3], [12, 12]]) speck(x, y);
  } else {
    // A hairline crack, five cells stepping down to the right, each with a lit cell to its right.
    for (const [x, y] of [[7, 3], [8, 4], [8, 5], [9, 6], [10, 7]]) {
      c.set(x, y, PL_SHADE);
      c.set(x + 1, y, PL_LIT);
    }
    for (const [x, y] of [[3, 10], [12, 13], [5, 2]]) speck(x, y);
  }
  return c;
}

/**
 * The ground sheet, 1792 x 64 (the World 1 layout, so `groundFrame` is unchanged): frames 0 and 1 the top tile's versions, 2 and 3 the
 * wall tile's, 4 to 15 the slopes of SLOPE_ORDER, two versions each (the tejas stepping down a pitched roof, D10), 16 to 27 the tiles under them.
 */
export function drawGround() {
  const pairs = SLOPE_ORDER.flatMap(([, left, right]) => [0, 1].map((v) => cutSlope(drawTile(true, v), drawTile(false, v), left, right)));
  const frames = [drawTile(true, 0), drawTile(true, 1), drawTile(false, 0), drawTile(false, 1), ...pairs.map((p) => p.slope), ...pairs.map((p) => p.foot)];
  const g = new Grid(frames.length * 64, 64);
  frames.forEach((tile, n) => {
    const px = tile.scaled();
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) g.set(n * 64 + x, y, px.get(x, y));
  });
  return g;
}

// ---------------------------------------------------------------------------------------------------- decor

/** The seven decor kinds' sizes in game px (2.7): maceta, bugambilia, huacal, ollas, farol, rebozos, letrero de lotería. */
export const DECOR_SIZES = [[10, 12], [16, 20], [14, 10], [14, 14], [8, 40], [16, 24], [12, 16]];
/** The frame every decor item is drawn in, in game px (World 1's plants' frame): bottom-aligned and centred. */
export const DECOR_FRAME = { w: 16, h: 40 };

/** A maceta de talavera, 10 x 12: a glazed pot with a cobalt band and a dot row, red-pink geraniums on a mound of leaves. */
const MACETA = [
  '...lP.....',
  '..lPPs.lP.',
  '.lPPsGlPPs',
  '.GPsGGPPsG',
  'GGGGIGGsGG',
  'GIGGGGIGGI',
  'WWWWWWWWWl',
  '.BBBBBBBB.',
  '.WBWWBWWl.',
  '.WWWWWWWl.',
  '..WBWWBl..',
  '..BBBBBB..',
];

/** A bugambilia, 16 x 20: a bougainvillea of rosa bracts on green, its lit clusters on the upper left, in a terracotta planter. */
const BUGAMBILIA = [
  '......pPP.......',
  '....pPPPPK.pP...',
  '...pPPGPPKpPPK..',
  '..pPPPKGGPPPPPK.',
  '..PPKGGIGPPKPPK.',
  '.pPPGGpPPGGIGK..',
  '.PPKGpPPPPKGGpP.',
  'pPPGGPPPPKGIpPPK',
  'PPKGIGPPKGGpPPPK',
  '.KGGDGGKGIGPPKK.',
  '..GIGDGGDGGPKG..',
  '...G.DGDG.GDG...',
  '.....DDD.D......',
  '......DDD.......',
  '..LLLLLRRRRRRK..',
  '...KKKKKKKKKK...',
  '...LRRRRRRRRK...',
  '...LRRRRRRRRK...',
  '....LRRRRRRK....',
  '....KKKKKKKK....',
];

/** A huacal de fruta, 14 x 10: a slatted wooden crate heaped with oranges and a few limes, the heap 3 px over its rim. */
const HUACAL = [
  '....YYLYL.....',
  '..YYLYGGLYYL..',
  '.YLYYLGIYYLYL.',
  'DDDDDDDDDDDDDD',
  'DIYLIYLIYLIYID',
  'DDDDDDDDDDDDDD',
  'DIIIIIIIIIIIID',
  'DDDDDDDDDDDDDD',
  'DIIIIIIIIIIIID',
  'DDDDDDDDDDDDDD',
];

/** One olla de barro, 7 x 7: a flared rim, a short neck in shade, a round belly lit on its upper left, a foot. */
const OLLA = [
  '.LLRRK.',
  '..KRK..',
  '.LLRRK.',
  'LLRRRRK',
  'LRRRRKK',
  '.RRRKK.',
  '..KKK..',
];
/** The top olla's belly with its white glaze squiggle. */
const OLLA_GLAZED = [OLLA[0], OLLA[1], OLLA[2], 'LWRWRWK', 'LRWRWKK', OLLA[5], OLLA[6]];

/** Ollas de barro, 14 x 14: three clay pots, two below and one on top. */
function drawOllas() {
  const c = new Cells(14, 14);
  stamp(c, fromRows(OLLA, INK), 0, 7);
  stamp(c, fromRows(OLLA, INK), 7, 7);
  stamp(c, fromRows(OLLA_GLAZED, INK), 3, 1);
  return c;
}

/** A farol, 8 x 40: a wrought-iron lamp post with a scroll bracket under a lantern with glaze panes and a yellow finial; unlit. */
const FAROL = [
  '...YY...',
  '...II...',
  '..IIII..',
  '.IIIIII.',
  '.IWWIlI.',
  '.IWWIlI.',
  '.IWWIlI.',
  '.IWWIlI.',
  '.IIIIII.',
  '..IIII..',
  '...II...',
  '.I.II.I.',
  'I..II..I',
  'I.IIII.I',
  '.II..II.',
  ...Array.from({ length: 10 }, () => '...II...'),
  '..IIII..',
  ...Array.from({ length: 11 }, () => '...II...'),
  '..IIII..',
  '..IIII..',
  '.IIIIII.',
];

/**
 * Rebozos, 16 x 24: a wooden A-frame rack with three folded rebozos over its bar, each a field with fine stripes 1 px wide (teal and
 * white, rosa and yellow, cobalt and white), the fold over the bar, a fringe of alternating cells.
 */
const REBOZOS = [
  '.D.TW..PY..BW.D.',
  'DDTTWTPPYPBBWBDD',
  '.DTTWTPPYPBBWBD.',
  '.DTTWTPPYPBBWBD.',
  '.DTTWTPPYPBBWBD.',
  '.DTTWTPPYPBBWBD.',
  '.DTTWTPPYPBBWBD.',
  '.DTTWTPPYPBBWBD.',
  '.DTTWTPPYPBBWBD.',
  '.DTTWTPPYPBBWBD.',
  'D.TTWTPPYPBBWB.D',
  'D.TTWTPPYPBBWB.D',
  'D.TTWTP.Y.BBWB.D',
  'D.TTWTP.Y.BBWB.D',
  'D.T.W.....BBWB.D',
  'D.T.W.....B.W..D',
  'D.........B.W..D',
  'D..............D',
  'D..............D',
  'D..............D',
  'D..............D',
  'D..............D',
  'D..............D',
  'D..............D',
];

/** A letrero de lotería, 12 x 16: a wooden easel holding a painted card, a glaze face in a yellow border with our own sun. No title, no number. */
const LOTERIA = [
  '.....DD.....',
  '.YYYYYYYYYY.',
  '.YWWWWWWWWY.',
  '.YWWWLLWWWY.',
  '.YWLWYYWLWY.',
  '.YWWYYYYWWY.',
  '.YLYYYYYYLY.',
  '.YLYYYYYYLY.',
  '.YWWYYYYWWY.',
  '.YWLWYYWLWY.',
  '.YWWWLLWWWY.',
  '.YWWWWWWWWY.',
  '.YYYYYYYYYY.',
  'DDDDDDDDDDDD',
  '..D..DD..D..',
  '.D...DD...D.',
];

/** The seven decor items' cells in the order of their kind. */
function decorCells() {
  const [maceta, bugambilia, huacal, farol, rebozos, loteria] = [MACETA, BUGAMBILIA, HUACAL, FAROL, REBOZOS, LOTERIA].map((rows) => fromRows(rows, INK));
  return [maceta, bugambilia, huacal, drawOllas(), farol, rebozos, loteria];
}

/** The decor sheet, 448 x 160 art px: seven frames of 16 x 40 game px, each item bottom-aligned and centred (2.7). Frame n is kind n. */
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

// ---------------------------------------------------------------------------------------------------- awnings (toldos)

/**
 * The awning sheet's layout (3.1, D5, D6), in game px: frames 16 x 16, three columns (the left end, a middle piece that repeats, the right
 * end), so an awning of any width from 2 tiles (the two ends) to 6 is put together from them. A frame's top is 1 px above the awning's
 * top (`canvasTop`), which is the bounce line. Rows: whole at rest and sagging 2, 4 and 6 px; the torn awning (faded, patched, frayed)
 * at rest and sagging; the torn halves; the two posts (left post in column 0, right post in column 2), which repeat downwards.
 */
export const AWNING_ART = {
  frame: 16,
  canvasTop: 1,
  rows: ['rest', 'sag2', 'sag4', 'sag6', 'tornRest', 'tornSag2', 'tornSag4', 'tornSag6', 'tornHalves', 'posts'],
  sags: [0, 2, 4, 6],
};
/** The awning's canvas: 6 px of stripes 4 px wide and a valance of scallops 2 px deep, 8 px in all (3.1). */
const CANVAS_ROWS = 6;

/** How far a column of a piece hangs below rest when the middle sags `d` px: the ends are fixed, the middle pieces hang the full `d`. */
function sagAt(piece, x, d) {
  if (piece === 1) return d;
  const t = (piece === 0 ? x + 0.5 : 16 - x - 0.5) / 16;
  return Math.round(d * (1 - (1 - t) ** 2));
}

/** The three pieces of an awning (left end, middle, right end) side by side as one 48 x 16 cell strip, sagging `d`, whole or torn. */
function awningCells(d, torn) {
  const c = new Cells(48, 16);
  // Whole: rosa mexicano and glaze white; torn: the rosa faded to the plaster's pink.
  const stripe = torn ? [PLASTER, GLAZE] : [ROSA, GLAZE];
  const dark = [PL_SHADE, PL_LIT];
  // The torn awning's frayed fringe: the scallops that are missing, by piece, and its two patches [piece, x, colour].
  const missing = [[2], [1, 3], [1]];
  const patches = [[0, 5, TEAL], [2, 7, YELLOW]];
  for (let x = 0; x < 48; x++) {
    const piece = Math.floor(x / 16), lx = x % 16, s = sagAt(piece, lx, d);
    const k = Math.floor(lx / 4) % 2, u = lx % 4;
    const lastColumn = x === 47;
    for (let r = 0; r < CANVAS_ROWS; r++) {
      // The top row is white all along (light from the upper left on the hem); the right end's last column is in shade.
      const colour = r === 0 ? GLAZE : stripe[k];
      c.set(x, AWNING_ART.canvasTop + r + s, lastColumn && r > 0 ? dark[k] : colour);
    }
    const tooth = Math.floor(lx / 4);
    const y7 = AWNING_ART.canvasTop + CANVAS_ROWS + s;
    if (torn && missing[piece].includes(tooth)) {
      if (u === 1) c.set(x, y7, stripe[k]);
      continue;
    }
    c.set(x, y7, lastColumn ? dark[k] : stripe[k]);
    if (u === 1) c.set(x, y7 + 1, stripe[k]);
    if (u === 2) c.set(x, y7 + 1, dark[k]);
  }
  if (torn) {
    for (const [piece, px, colour] of patches) {
      for (let x = px; x < px + 4; x++) {
        const s = sagAt(piece, x, d);
        for (let r = 1; r < 5; r++) c.set(piece * 16 + x, AWNING_ART.canvasTop + r + s, colour);
      }
    }
  }
  return c;
}

/** The torn halves: each end's half of the faded canvas hanging down from the top of its post, its torn edge ragged; scenery, no outline. */
function tornHalves() {
  const c = new Cells(48, 16);
  const widths = [7, 7, 7, 6, 6, 6, 6, 5, 5, 4, 4, 3, 2, 1];
  widths.forEach((w, i) => {
    const y = AWNING_ART.canvasTop + i;
    const band = Math.floor(i / 4) % 2 === 0 ? PLASTER : GLAZE;
    const edge = band === PLASTER ? PL_SHADE : PL_LIT;
    for (let j = 0; j < w; j++) {
      // The last row frays into threads.
      if (i === widths.length - 1 && j % 2 === 1) continue;
      c.set(j, y, j === w - 1 ? edge : band);
      c.set(47 - j, y, j === 0 ? edge : band);
    }
  });
  return c;
}

/** The awning sheet, 192 x 640 art px (AWNING_ART). The canvas carries the outline (D6); the halves and the posts are scenery. */
export function drawAwning() {
  const g = new Grid(3 * 64, AWNING_ART.rows.length * 64);
  const put = (strip, row) => {
    for (let y = 0; y < 64; y++) for (let x = 0; x < 192; x++) if (strip.get(x, y) !== null) g.set(x, row * 64 + y, strip.get(x, y));
  };
  const outlined = (cells) => {
    const px = cells.scaled();
    // The outline sits inside the awning's tiles at its two ends, so the drawing is exactly as wide as what Poncho lands on.
    for (let y = 0; y < px.height; y++) for (const x of [0, 1, 190, 191]) px.set(x, y, null);
    return outlineOutside(px, OUTLINE, 2);
  };
  [false, true].forEach((torn, t) => AWNING_ART.sags.forEach((d, i) => put(outlined(awningCells(d, torn)), t * 4 + i)));
  put(tornHalves().scaled(), 8);
  const posts = new Cells(48, 16);
  for (let y = 0; y < 16; y++) {
    posts.set(1, y, IRON);
    posts.set(46, y, IRON);
  }
  put(posts.scaled(), 9);
  return g;
}

// ---------------------------------------------------------------------------------------------------- papel picado: cordeles and rollos

/**
 * The cordel sheet's layout (3.2), in game px: frames 24 x 16, each a tile of line with a 4 px margin on both sides for the flags'
 * outline and sway, so a frame is drawn at (tile x - 4, line top - 2). The line is 2 px thick at rows 2 and 3; two flags 6 x 8 hang from
 * it, one every 8 px. Frames 0 to 2: the first tile colours (pink, gold) at rest and with the flags' lower halves swayed 1 px right and
 * left; 3 to 5: the second (teal, blue), so a cordel alternates them; 6 and 7: the left post's top and its pole, which repeats downwards;
 * 8 and 9: the right post's.
 */
export const CORDEL_ART = { frameW: 24, frameH: 16, margin: 4, lineTop: 2, flagTop: 4, sway: [0, 1, -1] };
/** A paper flag, 6 x 8: cut-outs (a 2 x 2 hole and four 1 x 1 round it) and a zigzag bottom edge. */
const FLAG = ['FFFFFF', 'FFFFFF', 'F.FF.F', 'FF..FF', 'FF..FF', 'F.FF.F', 'FFFFFF', 'F.FF.F'];

/** Paints a flag in `colour` with its top left at (x, y), its lower half moved `sway` px across. */
function flag(c, x, y, colour, sway) {
  FLAG.forEach((row, j) => [...row].forEach((ch, i) => ch === 'F' && c.set(x + i + (j >= 4 ? sway : 0), y + j, colour)));
}

/** The cordel's line across the cells from x0 to x1: iron, its lower row twisted with wood every third cell. */
function line(c, x0, x1, y) {
  for (let x = x0; x <= x1; x++) {
    c.set(x, y, IRON);
    c.set(x, y + 1, x % 3 === 1 ? WOOD : IRON);
  }
}

/** A post's pole down the frame at columns x (lit, wood) and x + 1 (iron, its shade), from row `from`. */
function pole(c, x, from) {
  for (let y = from; y < 16; y++) {
    c.set(x, y, WOOD);
    c.set(x + 1, y, IRON);
  }
}

/** Copies the painted pixels of `from` over `to` (the same size), where `onlyEmpty` keeps what `to` has. */
function over(to, from, onlyEmpty = false) {
  for (let y = 0; y < from.height; y++) for (let x = 0; x < from.width; x++) if (from.get(x, y) !== null && (!onlyEmpty || to.get(x, y) === null)) to.set(x, y, from.get(x, y));
}

/** Frames side by side in one sheet. */
function sheet(frames) {
  const g = new Grid(frames.reduce((sum, f) => sum + f.width, 0), frames[0].height);
  let at = 0;
  for (const f of frames) {
    for (let y = 0; y < f.height; y++) for (let x = 0; x < f.width; x++) if (f.get(x, y) !== null) g.set(at + x, y, f.get(x, y));
    at += f.width;
  }
  return g;
}

/** The cordel sheet, 960 x 64 art px (CORDEL_ART). The flags carry the outline; the line and the posts are scenery. */
export function drawCordel() {
  const { frameW, margin, lineTop, flagTop, sway } = CORDEL_ART;
  const frames = [];
  for (const pair of [[ROSA, YELLOW], [TEAL, COBALT]]) {
    for (const s of sway) {
      const flags = new Cells(frameW, 16);
      flag(flags, margin + 1, flagTop, pair[0], s);
      flag(flags, margin + 9, flagTop, pair[1], s);
      const px = outlineOutside(flags.scaled(), OUTLINE, 2);
      const cord = new Cells(frameW, 16);
      line(cord, margin, margin + 15, lineTop);
      over(px, cord.scaled());
      frames.push(px);
    }
  }
  // The posts: a pole with a cap, the line tied round it with a knot and a short tail.
  for (const side of ['left', 'right']) {
    const x = side === 'left' ? margin + 14 : margin;
    const top = new Cells(frameW, 16);
    pole(top, x, 1);
    top.set(x, 0, WOOD);
    top.set(x + 1, 0, WOOD);
    const knot = side === 'left' ? x - 1 : x + 2;
    for (const y of [lineTop, lineTop + 1]) for (const k of [x, x + 1, knot]) top.set(k, y, IRON);
    top.set(knot, lineTop + 2, IRON);
    top.set(knot, lineTop + 3, WOOD);
    const seg = new Cells(frameW, 16);
    pole(seg, x, 0);
    frames.push(top.scaled(), seg.scaled());
  }
  return sheet(frames);
}

/**
 * The rollo sheet's layout (3.2's look for a rolled-up cordel), in game px: frames 24 x 24, drawn at (tile x - 4, line top - 2) of the
 * line's end tile by the post, like the cordel's frames. Frames 0 to 2: a bundle by a left post (it unrolls to the right) at rest, swayed
 * 1 px, and flapping open; 3 to 5: the same by a right post (it unrolls to the left). The light stays on the upper left in both.
 */
export const ROLLO_ART = { frame: 24, size: 12, margin: 4, frames: ['restRight', 'swayRight', 'flapRight', 'restLeft', 'swayLeft', 'flapLeft'] };

/**
 * The rolled-up cordel by a left post, 12 x 10: a roll of the pink paper lying on its side, its cut-outs and its zigzag edge showing,
 * tied round with the cord, the spiral of the wound flags (gold, teal, blue) on its end towards the gap.
 */
const ROLL = [
  '...I........',
  '.WPIPPP.YYY.',
  'PPPIPPPYTTTY',
  'P.PIP.PYTBTY',
  'PP.I.PPYBIBY',
  'PP.I.PPYBIBY',
  'P.PIP.PYTBTY',
  'PPPIPPPYTTTY',
  '.PPIPPP.YYY.',
  '.P.P.P.P....',
];
/** The roll flapping open, 7 x 8: what is left of it as the strip flies out of its end. */
const ROLL_OPEN = [
  '..I....',
  '.WIP.Y.',
  'PPIPYTY',
  'P.IPYBY',
  'PPIPYBY',
  'P.IPYTY',
  '.PIP.Y.',
  '.P.P...',
];

/** Mirrors cells left to right. */
function mirrored(c) {
  const m = new Cells(c.w, c.h);
  for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) m.set(c.w - 1 - x, y, c.get(x, y));
  return m;
}

/** The rollo sheet, 576 x 96 art px (ROLLO_ART). The bundle and its paper carry the outline; the cord it hangs by does not. */
export function drawRollo() {
  const { frame, margin } = ROLLO_ART;
  const right = ['rest', 'sway', 'flap'].map((state) => {
    const c = new Cells(frame, frame);
    if (state === 'flap') {
      // Flapping open: the strip flung out towards the gap in a wave, two flags fluttering under it.
      stamp(c, fromRows(ROLL_OPEN, INK), margin, 2);
      for (let i = 0; i < 12; i++) c.set(margin + 7 + i, 4 + Math.round(1.3 * Math.sin(i / 1.9)), IRON);
      flag(c, margin + 7, 6, TEAL, 1);
      flag(c, margin + 13, 5, COBALT, -1);
    } else {
      const s = state === 'sway' ? 1 : 0;
      stamp(c, fromRows(ROLL, INK), margin + s, 2);
      // The loose end: the line hanging from under the roll's end, one gold flag on it.
      c.set(margin + 9 + s, 12, IRON);
      c.set(margin + 9 + s, 13, IRON);
      flag(c, margin + 7 + s, 14, YELLOW, s);
    }
    return c;
  });
  const left = right.map(mirrored);
  const frames = [...right, ...left].map((c, n) => {
    const px = outlineOutside(c.scaled(), OUTLINE, 2);
    // The cord it hangs by, from the post's knot to the tie round the roll.
    const cord = new Cells(frame, frame);
    const [from, to] = n < 3 ? [margin - 1, margin + 3] : [frame - margin - 4, frame - margin];
    for (let x = from; x <= to; x++) cord.set(x, 2, IRON);
    over(px, cord.scaled(), true);
    return px;
  });
  return sheet(frames);
}

// ---------------------------------------------------------------------------------------------------- the arena's plaza

/**
 * The boss arena's mid layer (D11, 3.4), 1920 x 304 art px like the rooftops (screen game y 148 to 224): the plaza with the kiosco (the
 * bandstand: a raised octagonal platform with railings, thin columns and a dome) in the middle at x 200 to 280, arcaded buildings (portales)
 * round it and papel picado strung from the kiosco to them, in the mid layer's colours.
 */
function plazaCells() {
  const { top, w, h } = MID;
  const c = new Cells(w, h);
  const set = (x, y, colour) => c.set(x, y - top, colour);
  // The buildings round the plaza: [left x, width, roof y, front], low in the middle so the kiosco stands against the far town.
  const blocks = [[0, 64, 180, MID_ROSE], [64, 50, 170, MID_OCHRE], [114, 46, 186, MID_ROSE], [160, 160, 196, MID_ROSE], [320, 46, 186, MID_ROSE], [366, 50, 170, MID_OCHRE], [416, 64, 180, MID_ROSE]];
  blocks.forEach(([x0, bw, roof, front], i) => {
    for (let y = roof; y < 224; y++) for (let x = x0; x < x0 + bw; x++) set(x, y, y === roof ? MID_SHADE : front);
    if (i === 3) return;
    // The portales: a row of arches along the bottom, in shade.
    for (let ax = x0 + 3; ax + 6 <= x0 + bw - 2; ax += 8) {
      for (let y = 208; y < 220; y++) for (let x = ax; x < ax + 6; x++) if (!(y === 208 && (x === ax || x === ax + 5))) set(x, y, MID_SHADE);
    }
    for (let x = x0; x < x0 + bw; x++) set(x, 205, MID_SHADE);
    for (let wy = roof + 6; wy + 4 < 202; wy += 10) for (let wx = x0 + 5; wx + 2 <= x0 + bw - 5; wx += 9) window2x3(c, wx, wy - top, front);
  });
  // The side of each taller block over its lower right-hand neighbour, and its long shadow, as on the rooftops.
  for (let i = 0; i + 1 < blocks.length; i++) {
    const [x0, bw, roof] = blocks[i];
    const [nx, nw, nroof] = blocks[i + 1];
    if (nroof <= roof) continue;
    for (let y = roof + 1; y < nroof; y++) for (let x = x0 + bw - 3; x < x0 + bw; x++) set(x, y, MID_SHADE);
    for (let y = nroof; y < nroof + 12; y++) for (let x = nx; x < Math.min(nx + nw, nx + (y - roof)); x++) if (c.get(x, y - top) !== STREET) set(x, y, MID_SHADE);
  }
  // The kiosco: the platform (its top lit, its right in shade, steps in the middle), the railing, six thin columns, the eave with a
  // scalloped trim, and the dome with ribs and a lantern.
  for (let y = 204; y < 218; y++) for (let x = 204; x < 276; x++) set(x, y, y === 204 ? MID_ROSE : x >= 262 ? MID_SHADE : MID_OCHRE);
  for (let x = 204; x < 276; x++) set(x, 205, MID_SHADE);
  for (let y = 208; y < 218; y++) for (let x = 230; x < 250; x++) set(x, y, (y - 208) % 3 === 2 ? MID_SHADE : MID_ROSE);
  for (let x = 206; x < 274; x++) set(x, 196, MID_SHADE);
  for (let x = 206; x < 274; x += 3) for (let y = 197; y < 204; y++) set(x, y, MID_SHADE);
  for (const x of [208, 222, 236, 243, 257, 271]) for (let y = 176; y < 204; y++) set(x, y, x >= 257 ? MID_SHADE : MID_ROSE);
  for (let y = 172; y < 176; y++) for (let x = 202; x < 278; x++) set(x, y, y === 172 ? MID_ROSE : x >= 262 ? MID_SHADE : MID_OCHRE);
  for (let x = 202; x < 278; x++) if (x % 4 !== 3) set(x, 176, x >= 262 ? MID_SHADE : MID_OCHRE);
  for (let y = 158; y < 172; y++) {
    for (let x = 208; x < 272; x++) {
      const u = (x + 0.5 - 240) / 32, v = (y + 0.5 - 172) / 14;
      if (u * u + v * v <= 1) set(x, y, u > 0.25 ? MID_SHADE : MID_ROSE);
    }
  }
  for (const rx of [-0.55, 0, 0.55]) {
    for (let y = 159; y < 172; y++) {
      const v = (y + 0.5 - 172) / 14;
      const x = Math.round(240 + rx * 32 * Math.sqrt(Math.max(0, 1 - v * v)) - 0.5);
      if (c.get(x, y - top) !== null) set(x, y, rx > 0.2 ? MID_ROSE : MID_SHADE);
    }
  }
  for (let y = 152; y < 158; y++) for (let x = 237; x < 243; x++) set(x, y, y === 152 ? MID_SHADE : x >= 241 ? MID_SHADE : MID_ROSE);
  for (let y = 149; y < 152; y++) set(240, y, MID_SHADE);
  // Papel picado from the kiosco's eave to the buildings on both sides.
  midString(c, 114, 186, 204, 172, 3, top);
  midString(c, 276, 172, 366, 172, 3, top);
  // The foot, into the street's dark as on the rooftops.
  for (let y = h - 6; y < h; y++) for (let x = 0; x < w; x++) if (y >= h - 4 || (x + y) % 2 === 0) c.set(x, y, STREET);
  return c;
}

/** The arena's plaza, 1920 x 304 art px, in place of the rooftops in the boss arena (D11). */
export function drawPlaza() {
  return plazaCells().scaled();
}
