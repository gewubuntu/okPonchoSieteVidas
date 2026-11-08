// Review sheet for one World 2 enemy (not committed output): `node scripts/art/enemies2/preview.mjs <kind> <out.png> [--box]`.
// Imports `./<kind>.mjs`, which exports FRAME ({ w, h } in drawing px), BOX ({ x0, y0, x1, y1 } in drawing px within the frame: the
// enemy's hit box) and drawFrames() → [{ look, grid }]. Draws Poncho's standing frame and World 1's approved Alacrán and Tlacuache first,
// for scale and style (L-066), then every frame, each with its bottom on the ground line, on three grounds: World 2's sky over a teja
// roof, its pink plaster wall, and its street; with --box, the hit box as a 1 px magenta frame. Every game pixel is 8 x 8 screen px.
import { writeFileSync } from 'node:fs';
import { Grid } from '../raster.mjs';
import { encodePng } from '../png.mjs';
import { drawIdle } from '../poncho.mjs';
import * as alacran from '../enemies1/alacran.mjs';
import * as tlacuache from '../enemies1/tlacuache.mjs';
import { paste, scaled } from './kit.mjs';

const [kind, out, flag] = process.argv.slice(2);
const mod = await import(`./${kind}.mjs`);
const frames = mod.drawFrames();
const { FRAME, BOX } = mod;
const pad = 4;
const poncho = drawIdle(); // 160 x 160 art px, feet on the bottom row
const refs = [alacran.drawFrames()[0].grid, tlacuache.drawFrames()[0].grid].map((g) => scaled(g, 2));
const refW = refs.reduce((s, r) => s + r.width + pad * 2, 0);
const cellW = FRAME.w * 2 + pad * 2;
const cellH = Math.max(FRAME.h * 2, 160) + pad * 2;
const grounds = [['#A9D3EA', '#E07A52'], ['#E07F8E', '#C45E3E'], ['#4E4A78', '#E4CC9E']];
const g = new Grid(160 + pad * 2 + refW + cellW * frames.length, cellH * grounds.length);
grounds.forEach(([bg, floor], row) => {
  const top = row * cellH;
  const line = top + cellH - pad;
  for (let y = top; y < top + cellH; y++) for (let x = 0; x < g.width; x++) g.set(x, y, y >= line ? floor : bg);
  paste(g, poncho, pad, line - 160);
  let ox = 160 + pad * 2;
  for (const r of refs) { paste(g, r, ox + pad, line - r.height); ox += r.width + pad * 2; }
  frames.forEach((f, i) => {
    const big = scaled(f.grid, 2);
    const fx = ox + i * cellW + pad;
    const fy = line - FRAME.h * 2;
    paste(g, big, fx, fy);
    if (flag === '--box' && BOX) {
      const [x0, y0, x1, y1] = [fx + BOX.x0 * 2, fy + BOX.y0 * 2, fx + BOX.x1 * 2 - 1, fy + BOX.y1 * 2 - 1];
      for (let x = x0; x <= x1; x++) { g.set(x, y0, '#FF00FF'); g.set(x, y1, '#FF00FF'); }
      for (let y = y0; y <= y1; y++) { g.set(x0, y, '#FF00FF'); g.set(x1, y, '#FF00FF'); }
    }
  });
});
const big = scaled(g, 2);
writeFileSync(out, encodePng(big.width, big.height, big.toRgba()));
console.log(`wrote ${out}: ${frames.map((f) => f.look).join(', ')}`);
