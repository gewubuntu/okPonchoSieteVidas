// Review sheet for World 3's Murciélago (not committed output): `node scripts/art/enemies3/preview.mjs <out.png>`.
// Every frame of the bat next to the approved Zopilote's flap frames and the Paloma's (L-066), each band twice: at game size (a game px
// one screen px, the drawing averaged down) and at 4x (a game px 4 x 4 screen px), on three of World 3's grounds: the sky's middle band,
// the canyon's far wall (peak shade) and the mine's gallery wall (GDD-ART-06).
import { writeFileSync } from 'node:fs';
import { hexToRgba, Grid } from '../raster.mjs';
import { encodePng } from '../png.mjs';
import * as zopilote from '../enemies1/zopilote.mjs';
import * as paloma from '../enemies2/paloma.mjs';
import { paste, scaled } from '../enemies2/kit.mjs';
import * as murcielago from './murcielago.mjs';

const [out] = process.argv.slice(2);
const hex = (r, g, b) => `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;

/** A drawing (2 drawing px a game px) at game size: each 2 x 2 block averaged over its painted pixels, empty if fewer than 2 are. */
function gameSize(src) {
  const g = new Grid(Math.ceil(src.width / 2), Math.ceil(src.height / 2));
  for (let y = 0; y < g.height; y++) for (let x = 0; x < g.width; x++) {
    const cs = [src.get(2 * x, 2 * y), src.get(2 * x + 1, 2 * y), src.get(2 * x, 2 * y + 1), src.get(2 * x + 1, 2 * y + 1)].filter(Boolean);
    if (cs.length < 2) continue;
    const rgb = cs.map(hexToRgba).reduce((s, c) => [s[0] + c[0], s[1] + c[1], s[2] + c[2]], [0, 0, 0]);
    g.set(x, y, hex(rgb[0] / cs.length, rgb[1] / cs.length, rgb[2] / cs.length));
  }
  return g;
}

const bands = [
  ['murciélago', murcielago.drawFrames()],
  ['zopilote', zopilote.drawFrames().filter((f) => f.look.startsWith('flap'))],
  ['paloma', paloma.drawFrames().filter((f) => f.look.startsWith('flap'))],
];
const grounds = ['#8AA5B8', '#5B7067', '#3D3650'];
const pad = 8;
// Each band: the frames at game size in one row, then at 4x in the next, each cell as big as the largest frame at that scale.
const cellW = (k) => 32 * k + pad;
const cellH = (k) => 24 * k + pad;
const rowsH = bands.length * (cellH(1) + cellH(4));
const width = Math.max(...bands.map(([, fs]) => fs.length)) * cellW(4) + pad;
const g = new Grid(width * grounds.length, rowsH + pad);
grounds.forEach((bg, gi) => {
  const ox = gi * width;
  for (let y = 0; y < g.height; y++) for (let x = ox; x < ox + width; x++) g.set(x, y, bg);
  let oy = pad;
  for (const [, frames] of bands) {
    frames.forEach((f, i) => {
      const small = gameSize(f.grid);
      paste(g, small, ox + pad + i * cellW(1) + (32 - small.width) / 2, oy + (24 - small.height) / 2);
      const big = scaled(f.grid, 2);
      paste(g, big, ox + pad + i * cellW(4) + (128 - big.width) / 2, oy + cellH(1) + (96 - big.height) / 2);
    });
    oy += cellH(1) + cellH(4);
  }
});
writeFileSync(out, encodePng(g.width, g.height, g.toRgba()));
console.log(`wrote ${out}: ${bands.map(([n, fs]) => `${n} ${fs.map((f) => f.look).join(' ')}`).join('; ')}`);
