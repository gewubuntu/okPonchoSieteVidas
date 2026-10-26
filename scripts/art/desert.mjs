// World 1's backdrop and ground, drawn in code like Poncho's sprite (GDD-ART-01, GDD-ART-06): the sky with its sun, the clouds, the
// far mountains and the ground tiles, in 20 colours and no outline (GDD-ART-05). The look follows the user's desert scene
// (assets/worlds/desierto/reference-scene.jpg) with a warmer golden sky. Everything is drawn on a grid of game pixels, 4 x 4 art
// pixels each, so the shapes are as chunky as the game; only the sky's dither is finer (2 art pixels, GDD-ART-05).
import { Grid } from './raster.mjs';

/** GDD-ART-06: the palette, grouped as the GDD lists it (sky from the top to the horizon). */
export const PALETTE = {
  sky: ['#E39A48', '#EDB15A', '#F4C66E', '#F9DA8E'],
  sun: ['#FFF6D0', '#FFD25A'],
  clouds: ['#FFF4DC', '#E9B98A'],
  mountains: ['#8E6A96', '#A65B5B', '#4D5A9C', '#3A4580'],
  grass: ['#9CC24E', '#6FA03A', '#4E7A2C'],
  sand: ['#F4D29C', '#E8B87A', '#D19A5E'],
  earth: ['#A0472F', '#7A3326'],
};
const [SKY_TOP, SKY_2, SKY_3, SKY_HORIZON] = PALETTE.sky;
const [SUN_DISC, SUN_RING] = PALETTE.sun;
const [CLOUD_TOP, CLOUD_UNDER] = PALETTE.clouds;
const [PURPLE, RUST, BLUE, SHADOW] = PALETTE.mountains;
const [GRASS_LIGHT, GRASS_BASE, GRASS_DARK] = PALETTE.grass;
const [SAND_LIGHT, SAND_BASE, SAND_DARK] = PALETTE.sand;
const [EARTH_BASE, EARTH_DARK] = PALETTE.earth;

/** Art pixels per game pixel (GDD-ART-01). */
const S = 4;
/** The screen in art pixels (1920 x 1080). */
const WIDTH = 480 * S;
const HEIGHT = 270 * S;

/** A grid of game-pixel cells, `w` by `h`, that `scaled()` blows up to art pixels. */
class Cells {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.cells = new Array(w * h).fill(null);
  }

  get(x, y) {
    return x >= 0 && y >= 0 && x < this.w && y < this.h ? this.cells[y * this.w + x] : null;
  }

  set(x, y, colour) {
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.cells[y * this.w + x] = colour;
  }

  /** The cells `w` by `h` from (x0, y0) as new cells. */
  crop(x0, y0, w, h) {
    const c = new Cells(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) c.cells[y * w + x] = this.get(x0 + x, y0 + y);
    return c;
  }

  /** The cells as a pixel Grid, each one S x S art pixels. */
  scaled() {
    const g = new Grid(this.w * S, this.h * S);
    for (let y = 0; y < this.h * S; y++) {
      for (let x = 0; x < this.w * S; x++) g.cells[y * g.width + x] = this.cells[Math.floor(y / S) * this.w + Math.floor(x / S)];
    }
    return g;
  }
}

/** A repeatable pseudo-random number from two integers, so the art is the same on every run. */
function noise(a, b) {
  let h = (Math.imul(a, 374761393) + Math.imul(b, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// ---------------------------------------------------------------------------------------------------- sky

/** Where each of the sky's first three bands ends (art y from the top); the horizon band runs on from the last. */
export const SKY_ENDS = [200, 340, 480];
/** The height of the dither strip at the end of a band (art px). */
export const STRIP = 2;
const BANDS = [SKY_TOP, SKY_2, SKY_3, SKY_HORIZON];
/** The sun's centre (game px) and how many game px its image reaches from it on each side (GDD-ART-06: the centre is BACKDROP.sunX, sunY). */
export const SUN = { x: 104, y: 36, half: 19 };

/**
 * The dither strips between the sky's bands (GDD-ART-06, GDD-ART-05: a dither only in skies): three strips of 1920 x 2 art pixels one
 * above the other (frame n sits at the end of band n), a checker of 2 pixel cells in the two colours either side of the border.
 */
export function drawSkyStrips() {
  const g = new Grid(WIDTH, STRIP * SKY_ENDS.length);
  SKY_ENDS.forEach((_, i) => {
    for (let y = 0; y < STRIP; y++) for (let x = 0; x < WIDTH; x++) g.set(x, i * STRIP + y, Math.floor(x / 2) % 2 === 0 ? BANDS[i] : BANDS[i + 1]);
  });
  return g;
}

/**
 * The sun, a square of 38 x 38 game px (152 art px) around its centre, transparent outside the sun: a disc 24 game px across, a ring
 * 2 game px wide and 8 short rays, all in whole game pixels.
 */
export function drawSun() {
  const g = new Grid(SUN.half * 2 * S, SUN.half * 2 * S);
  const { x: cx, y: cy } = SUN;
  const put = (gx, gy, colour) => {
    for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) g.set((gx - (cx - SUN.half)) * S + i, (gy - (cy - SUN.half)) * S + j, colour);
  };
  for (let gy = cy - 20; gy < cy + 20; gy++) {
    for (let gx = cx - 20; gx < cx + 20; gx++) {
      const d = Math.hypot(gx + 0.5 - cx, gy + 0.5 - cy);
      if (d <= 12) put(gx, gy, SUN_DISC);
      else if (d <= 14) put(gx, gy, SUN_RING);
    }
  }
  // Rays: 3 x 2 game px blocks on the four axes, 2 x 2 blocks on the diagonals.
  for (const [sx, sy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    for (let along = 16; along < 19; along++) for (const side of [0, 1]) {
      const gx = sx !== 0 ? (sx > 0 ? cx + along : cx - along - 1) : side ? cx : cx - 1;
      const gy = sy !== 0 ? (sy > 0 ? cy + along : cy - along - 1) : side ? cy : cy - 1;
      put(gx, gy, SUN_RING);
    }
  }
  for (const [sx, sy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    for (const i of [12, 13]) for (const j of [12, 13]) put(sx > 0 ? cx + i : cx - i - 1, sy > 0 ? cy + j : cy - j - 1, SUN_RING);
  }
  return g;
}

/**
 * The whole sky as one picture, 1920 x 1080 (GDD-ART-06): the four flat bands, the dither strips and the sun on top. The game does not
 * load this: it draws the bands flat and the strips and the sun from their own small images (it is the same picture, cheaper to draw), and
 * the tests check that those pieces make this one.
 */
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
  const sun = drawSun();
  for (let y = 0; y < sun.height; y++) {
    for (let x = 0; x < sun.width; x++) {
      const c = sun.get(x, y);
      if (c) g.set((SUN.x - SUN.half) * S + x, (SUN.y - SUN.half) * S + y, c);
    }
  }
  return g;
}

// ---------------------------------------------------------------------------------------------------- clouds

/** One puffy cloud: ellipses (cx, cy, rx, ry) in cells, flat at `base`. Returns whether a cell is inside it. */
const cloudShape = (puffs, base) => (x, y) => y < base && puffs.some(([cx, cy, rx, ry]) => ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1);

/** The clouds: [centre column, base row, puffs as offsets from the centre and the base], in cells. */
const CLOUDS = (() => {
  const big = [[-18, -5, 10, 7], [-5, -10, 12, 11], [9, -8, 12, 9], [21, -5, 10, 6], [0, -2, 26, 5]];
  const small = [[-10, -4, 8, 5], [0, -7, 9, 8], [11, -4, 8, 5], [0, -2, 18, 4]];
  return [
    { cx: 56, base: 70, puffs: small },
    { cx: 168, base: 42, puffs: big },
    { cx: 300, base: 38, puffs: big },
    { cx: 420, base: 76, puffs: small },
  ];
})();

/**
 * Each cloud as its own small picture (GDD-ART-06): flat-bottomed puffs, cream on top with a warm shade on the underside and the lower
 * right, light from the upper left. Returns the cells cut to the cloud's box, and the box's top left in game px within the cloud layer
 * (game y 0 to 88; the layer puts them between 16 and 88).
 */
function cloudParts() {
  return CLOUDS.map(({ cx, base, puffs }) => {
    const c = new Cells(480, 88);
    const inside = cloudShape(puffs.map(([dx, dy, rx, ry]) => [cx + dx, base + dy, rx, ry]), base);
    let x0 = 480, y0 = 88, x1 = -1, y1 = -1;
    for (let y = 0; y < 88; y++) {
      for (let x = 0; x < 480; x++) {
        if (!inside(x, y)) continue;
        // Shade: the lowest rows, and any cell whose lower right neighbours (3 cells away) are outside the cloud.
        const rim = !inside(x + 3, y + 2) || !inside(x + 1, y + 3);
        c.set(x, y, y >= base - 3 || (rim && y >= base - 10) ? CLOUD_UNDER : CLOUD_TOP);
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

/** Where each cloud's picture sits in the cloud layer: its top left and size in game px. */
export const CLOUD_BOXES = PARTS.map(({ x, y, cells }) => ({ x, y, w: cells.w, h: cells.h }));

/** The clouds' pictures, one per cloud, each in whole game pixels (4 x 4 art pixels). */
export function drawCloudImages() {
  return PARTS.map(({ cells }) => cells.scaled());
}

/**
 * The clouds as one layer, 1920 x 352 art pixels (game y 0 to 88; GDD-ART-06 puts them between 16 and 88). No cloud touches the
 * sideways edges, so the layer repeats without a seam. The game draws the clouds one by one from their own images, each shifted by
 * its share of the camera's scroll and wrapped round 480 game px; the tests check they make this layer.
 */
export function drawClouds() {
  const g = new Grid(WIDTH, 352);
  for (const { x, y, cells } of PARTS) {
    const px = cells.scaled();
    for (let j = 0; j < px.height; j++) for (let i = 0; i < px.width; i++) if (px.get(i, j)) g.set(x * S + i, y * S + j, px.get(i, j));
  }
  return g;
}

// ---------------------------------------------------------------------------------------------------- mountains

/** The distance between two columns on the repeating 480 cell strip, with its sign: negative when `x` lies left of `at`. */
const wrapDelta = (x, at) => ((x - at + 720) % 480) - 240;

/**
 * The first (top) row of a range at column `x` (cells): the highest of its peaks' slopes (left and right slope per peak, rows per
 * column), with a little roughness; it repeats every 480.
 */
function ridge(peaks, x) {
  let best = Infinity, which = 0;
  peaks.forEach(([px, top, left, right], i) => {
    const d = wrapDelta(x, px);
    const y = top + (d < 0 ? left : right) * Math.abs(d);
    if (y < best) {
      best = y;
      which = i;
    }
  });
  // Roughness: stair steps in the slopes, none at the strip's sides so the two edges meet.
  const jag = x < 3 || x > 476 ? 0 : Math.floor(noise(x >> 1, 7) * 3) - 1;
  return { y: Math.max(0, Math.floor(best) + jag), which };
}

/** The row (cells) where the mountains' foot starts: from there down every column is the dark blue (GDD-ART-06: a pit shows mountains). */
export const FOOT_ROW = 122;

/**
 * The mountains, 1920 x 712 art pixels (178 cells; game y 92 to 270): a far purple range, then a near blue range in front with
 * rust-red light on the slopes that face the upper left and blue in shadow on the others (GDD-ART-06, GDD-ART-05). Below the peaks
 * everything is filled, so a pit shows mountains. The ridges repeat every 480 cells, so the image has no seam.
 */
function mountainCells() {
  const rows = 178;
  const c = new Cells(480, rows);
  // [centre column, top row, left slope, right slope in rows per column]
  const far = [[44, 16, 0.8, 0.7], [100, 34, 1.1, 1.0], [140, 0, 0.9, 0.85], [236, 24, 0.8, 0.8], [290, 40, 1.0, 1.1], [335, 8, 0.8, 0.9], [420, 28, 0.75, 0.7]];
  const near = [[22, 58, 0.9, 1.0], [84, 44, 1.0, 0.85], [132, 76, 1.2, 1.2], [196, 66, 0.8, 0.9], [250, 82, 1.0, 1.0], [290, 38, 0.95, 0.9], [345, 70, 1.1, 1.1], [380, 76, 0.8, 0.8], [448, 52, 0.9, 1.0]];
  for (let x = 0; x < 480; x++) {
    const f = ridge(far, x);
    for (let y = f.y; y < rows; y++) c.set(x, y, PURPLE);
    const n = ridge(near, x);
    const [px, top] = near[n.which];
    const dx = wrapDelta(x, px);
    for (let y = n.y; y < rows; y++) {
      const depth = y - n.y;
      // The sunlit face (left of the peak, facing the upper left) has rust streaks along its slope; the right face is in shadow, and
      // the foot of the range fades into shadow with a one-cell dither.
      const shaded = dx > -(y - top) * 0.12 || y >= FOOT_ROW || (y >= FOOT_ROW - 4 && (x + y) % 2 === 0);
      const streak = dx < 0 && depth < 34 && (x + 2 * y + (n.which % 3) * 5) % 13 < 4 && !shaded;
      c.set(x, y, streak ? RUST : shaded ? SHADOW : BLUE);
    }
  }
  return c;
}

/** The whole mountains picture, 1920 x 712. The game draws only the ridge band (`drawMountains`) and the foot as a flat colour. */
export function drawMountainsFull() {
  return mountainCells().scaled();
}

/** The ridge band, 1920 x 488 art pixels: the mountains down to where the foot starts, which the game draws as a flat colour (`FOOT_ROW`). */
export function drawMountains() {
  return mountainCells().crop(0, 0, 480, FOOT_ROW).scaled();
}

// ---------------------------------------------------------------------------------------------------- ground

/** One ground tile, 16 x 16 cells (64 x 64 art pixels): a top tile (grass, sand, earth) or an earth tile. `version` 0 or 1 moves the details. */
function drawTile(top, version) {
  const c = new Cells(16, 16);
  // The ragged lines: the row where the grass ends and where the sand ends at each column. The two outer columns are fixed, so
  // neighbouring tiles of either version meet without a seam (GDD-ART-06).
  const edge = (salt, lo, span, mid) => Array.from({ length: 16 }, (_, x) => (x === 0 || x === 15 ? mid : lo + Math.floor(noise(x + 16 * version, salt) * span)));
  const grassEnd = edge(1, 3, 3, 3);
  const sandEnd = edge(2, 7, 3, 8);
  // Specks: [x, y, width] in cells, a few per tile.
  const dots = (salt, count, rowFrom, rowTo) => {
    const out = [];
    for (let i = 0; i < count; i++) out.push([1 + Math.floor(noise(i + 16 * version, salt) * 13), rowFrom + Math.floor(noise(i, salt + 50 + 16 * version) * (rowTo - rowFrom)), 1 + Math.floor(noise(i + 5, salt) * 2)]);
    return out;
  };
  if (top) {
    for (let x = 0; x < 16; x++) {
      for (let y = 0; y < 16; y++) {
        if (y < grassEnd[x]) c.set(x, y, GRASS_BASE);
        else if (y === grassEnd[x]) c.set(x, y, GRASS_DARK); // the ragged lower edge of the grass
        else if (y < sandEnd[x] - 1) c.set(x, y, SAND_BASE);
        else if (y < sandEnd[x]) c.set(x, y, SAND_DARK); // the sand's shade along the earth
        else c.set(x, y, EARTH_BASE);
      }
    }
    // Tufts: highlight on the upper left, a shade on the right and below.
    for (const tx of version === 0 ? [2, 8, 12] : [4, 9, 13]) {
      c.set(tx, 0, GRASS_LIGHT);
      c.set(tx + 1, 0, GRASS_LIGHT);
      c.set(tx, 1, GRASS_LIGHT);
      c.set(tx + 2, 1, GRASS_DARK);
      c.set(tx + 1, 2, GRASS_DARK);
    }
    for (const [x, y, w] of dots(3, 4, 3, 7)) for (let i = 0; i < w; i++) if (c.get(x + i, y) === SAND_BASE) c.set(x + i, y, i === 0 ? SAND_LIGHT : SAND_DARK);
    for (const [x, y, w] of dots(4, 5, 9, 15)) for (let i = 0; i < w; i++) if (c.get(x + i, y) === EARTH_BASE) c.set(x + i, y, EARTH_DARK);
  } else {
    for (let i = 0; i < 256; i++) c.cells[i] = EARTH_BASE;
    for (const [x, y, w] of dots(6, 9, 1, 15)) for (let i = 0; i < w; i++) c.set(x + i, y, EARTH_DARK);
  }
  return c;
}

/** The ground sheet, 256 x 64: frames 0 and 1 are the top tile's two versions, frames 2 and 3 the earth tile's. */
export function drawGround() {
  const g = new Grid(256, 64);
  [drawTile(true, 0), drawTile(true, 1), drawTile(false, 0), drawTile(false, 1)].forEach((tile, n) => {
    const px = tile.scaled();
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) g.set(n * 64 + x, y, px.get(x, y));
  });
  return g;
}
