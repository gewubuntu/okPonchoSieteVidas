// A mockup of one World 2 (Mercado) level screen for the user's early look at the art (GDD-ART-06, the World 2 art spec), not loaded
// by the game: 480 x 270 game px drawn at 4x (1920 x 1080), the way the scene stacks the layers: the sky, the clouds, the far hill town
// at 0.3 and the mid rooftops at 0.5 of a camera scroll, the dark foot, a stretch of roof tiles with a pit and a pitched roof, some decor,
// two awnings (one at rest, one sagging mid-bounce) on their posts, a cordel with flags over the pit, a rollo on its post, and Poncho's
// standing frame. Also a phone view: the game pillarboxed in an 844 x 390 screen, as the approved phone screenshots show it.
//   node scripts/art/preview-mercado.mjs [out-dir] [camera-x]
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';
import { blit, S } from './cells.mjs';
import {
  AWNING_ART, CLOUD_BOXES, CORDEL_ART, drawAwning, drawCloudImages, drawCordel, drawDecor, drawFarTown, drawGround, drawMidRoofs, drawRollo,
  drawSky, DECOR_FRAME, FAR, FOOT_COLOUR, MID, ROLLO_ART, SLOPE_ORDER,
} from './mercado.mjs';
import { encodePng } from './png.mjs';
import { Grid } from './raster.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const TILE = 16;

/** Reads an 8-bit RGBA, non-interlaced PNG (what encodePng and the committed sprites are) into a Grid of '#RRGGBB' cells. */
export function readPng(path) {
  const buf = readFileSync(path);
  let at = 8, width = 0, height = 0;
  const idat = [];
  while (at < buf.length) {
    const len = buf.readUInt32BE(at), type = buf.toString('ascii', at + 4, at + 8), data = buf.subarray(at + 8, at + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      if (data[8] !== 8 || data[9] !== 6 || data[12] !== 0) throw new Error(`${path}: only 8-bit RGBA, non-interlaced`);
    } else if (type === 'IDAT') idat.push(data);
    at += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * 4, px = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y++) {
    const f = raw[y * (stride + 1)];
    for (let x = 0; x < stride; x++) {
      const v = raw[y * (stride + 1) + 1 + x];
      const a = x >= 4 ? px[y * stride + x - 4] : 0, b = y > 0 ? px[(y - 1) * stride + x] : 0, c = x >= 4 && y > 0 ? px[(y - 1) * stride + x - 4] : 0;
      const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
      const pred = [0, a, b, (a + b) >> 1, pa <= pb && pa <= pc ? a : pb <= pc ? b : c][f];
      px[y * stride + x] = (v + pred) & 255;
    }
  }
  const g = new Grid(width, height);
  for (let i = 0; i < width * height; i++) {
    if (px[i * 4 + 3] < 128) continue;
    g.cells[i] = `#${[0, 1, 2].map((k) => px[i * 4 + k].toString(16).padStart(2, '0')).join('').toUpperCase()}`;
  }
  return g;
}

/** The frame `n` (w x h art px, laid out in a row, or on `row` of a grid of frames) cut out of a sheet. */
function frameOf(sheet, n, w, h, row = 0) {
  const g = new Grid(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) g.set(x, y, sheet.get(n * w + x, row * h + y));
  return g;
}

/** A layer `band` that repeats every 480 game px, drawn at screen y `top` and shifted by `offset` game px (a tileSprite's tilePosition). */
function tiled(screen, band, top, offset) {
  const shift = (((Math.round(offset * S) % band.width) + band.width) % band.width);
  for (let y = 0; y < band.height; y++) {
    for (let x = 0; x < screen.width; x++) {
      const c = band.get((x + shift) % band.width, y);
      if (c !== null) screen.set(x, top * S + y, c);
    }
  }
}

// The level on screen: 30 columns, rows 0 to 16 (row 16 is cut by the screen's bottom). '#' a roof tile, '/' and '\' the pitched roof.
const LEVEL = [
  ...Array.from({ length: 12 }, () => '.'.repeat(30)),
  '................/####\\........',
  '.............../######\\.......',
  '#########...##################',
  '#########...##################',
  '#########...##################',
];

/** The mockup at camera x `camX`: a 1920 x 1080 Grid. */
export function composeMockup(camX = 0) {
  const screen = drawSky();
  // Clouds at 0.1, wrapped round the 480 px strip.
  drawCloudImages().forEach((img, i) => {
    const { x, y } = CLOUD_BOXES[i];
    for (const at of [x - camX * 0.1, x - camX * 0.1 + 480]) blit(screen, img, Math.round(at * S), y * S);
  });
  for (let y = (FAR.top + FAR.h) * S; y < screen.height; y++) for (let x = 0; x < screen.width; x++) screen.set(x, y, FOOT_COLOUR);
  tiled(screen, drawFarTown(), FAR.top, camX * 0.3);
  tiled(screen, drawMidRoofs(), MID.top, camX * 0.5);

  const solid = (tx, ty) => LEVEL[ty]?.[tx] === '#';
  const slope = (tx, ty) => {
    const ch = LEVEL[ty]?.[tx];
    return ch === '/' || ch === '\\' ? ch : null;
  };
  const at = (gx, gy, img) => blit(screen, img, Math.round((gx - camX) * S), Math.round(gy * S));

  // Decor, rooted 1 px into the top tile, behind the ground: [kind, column, top row].
  const decor = drawDecor();
  for (const [kind, col, row] of [[4, 0, 14], [2, 3, 14], [5, 7, 14], [0, 17, 12], [6, 20, 12], [1, 23, 14], [3, 25, 14]]) {
    at(col * TILE + TILE / 2 - DECOR_FRAME.w / 2, row * TILE + 1 - DECOR_FRAME.h, frameOf(decor, kind, DECOR_FRAME.w * S, DECOR_FRAME.h * S));
  }

  // Awnings: posts behind, from under the canvas to the floor; then the canvas. [left column, tiles, top y, sheet row].
  const awnings = drawAwning();
  const awningFrame = (col, row) => frameOf(awnings, col, AWNING_ART.frame * S, AWNING_ART.frame * S, row);
  const postRow = AWNING_ART.rows.indexOf('posts');
  for (const [col0, tiles, top, row] of [[2, 4, 176, AWNING_ART.rows.indexOf('rest')], [24, 3, 184, AWNING_ART.rows.indexOf('sag4')]]) {
    for (let y = top - AWNING_ART.canvasTop; y < 224; y += TILE) {
      at(col0 * TILE, y, awningFrame(0, postRow));
      at((col0 + tiles - 1) * TILE, y, awningFrame(2, postRow));
    }
    for (let i = 0; i < tiles; i++) at((col0 + i) * TILE, top - AWNING_ART.canvasTop, awningFrame(i === 0 ? 0 : i === tiles - 1 ? 2 : 1, row));
  }

  // The cordel over the pit (columns 8 to 12, its line's top at y 168), its posts in columns 7 and 13; a rollo by a post in column 27.
  const cordel = drawCordel();
  const cw = CORDEL_ART.frameW * S, ch = CORDEL_ART.frameH * S;
  const cordelFrame = (n) => frameOf(cordel, n, cw, ch);
  const post = (col, side, lineTop) => {
    at(col * TILE - CORDEL_ART.margin, lineTop - CORDEL_ART.lineTop, cordelFrame(side === 'left' ? 6 : 8));
    for (let y = lineTop - CORDEL_ART.lineTop + TILE; y < 224; y += TILE) at(col * TILE - CORDEL_ART.margin, y, cordelFrame(side === 'left' ? 7 : 9));
  };
  post(7, 'left', 168);
  post(13, 'right', 168);
  [0, 4, 2, 3, 1].forEach((n, i) => at((8 + i) * TILE - CORDEL_ART.margin, 168 - CORDEL_ART.lineTop, cordelFrame(n)));
  post(27, 'left', 176);
  const rollo = drawRollo();
  at(28 * TILE - ROLLO_ART.margin, 176 - CORDEL_ART.lineTop, frameOf(rollo, 0, ROLLO_ART.frame * S, ROLLO_ART.frame * S));

  // The ground tiles, as groundFrame picks them (a slope's frame, the frame under a slope, a top tile or a wall tile, version (7c + 3r) mod 2).
  const ground = drawGround();
  const version = (tx, ty) => (7 * tx + 3 * ty) % 2;
  const chars = SLOPE_ORDER.map(([c]) => c);
  for (let ty = 0; ty < LEVEL.length; ty++) {
    for (let tx = 0; tx < 30; tx++) {
      const s = slope(tx, ty);
      if (!solid(tx, ty) && s === null) continue;
      let frame;
      if (s !== null) frame = 4 + 2 * chars.indexOf(s) + version(tx, ty);
      else if (slope(tx, ty - 1) !== null) frame = 16 + 2 * chars.indexOf(slope(tx, ty - 1)) + version(tx, ty - 1);
      else frame = (solid(tx, ty - 1) ? 2 : 0) + version(tx, ty);
      at(tx * TILE, ty * TILE, frameOf(ground, frame, TILE * S, TILE * S));
    }
  }

  // Poncho's standing frame, bottom centre at his feet, on the floor right of the pit.
  const poncho = readPng(join(here, '..', '..', 'assets', 'sprites', 'poncho.png'));
  at(232 - 20, 224 - 40, frameOf(poncho, 0, 160, 160));
  return screen;
}

/** The phone view: the game scaled to the screen's height (nearest pixel) in an 844 x 390 screen, pillarboxed. */
export function phoneView(screen) {
  const g = new Grid(844, 390);
  const w = Math.round((390 * 16) / 9), left = Math.floor((844 - w) / 2);
  for (let y = 0; y < 390; y++) {
    for (let x = 0; x < 844; x++) {
      const gx = x - left;
      g.set(x, y, gx < 0 || gx >= w ? '#1B1E2E' : screen.get(Math.floor((gx * screen.width) / w), Math.floor((y * screen.height) / 390)));
    }
  }
  return g;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const outDir = process.argv[2] ?? join(here, '..', '..', '.plans', 'world2');
  const screen = composeMockup(Number(process.argv[3] ?? 0));
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'mercado-mockup.png'), encodePng(screen.width, screen.height, screen.toRgba()));
  const phone = phoneView(screen);
  writeFileSync(join(outDir, 'mercado-mockup-phone.png'), encodePng(phone.width, phone.height, phone.toRgba()));
  console.log(`wrote ${join(outDir, 'mercado-mockup.png')} and mercado-mockup-phone.png`);
}
