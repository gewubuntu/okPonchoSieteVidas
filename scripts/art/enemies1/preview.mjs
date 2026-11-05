// Review sheet for one World 1 enemy (not committed output): `node scripts/art/enemies1/preview.mjs <kind> <out.png> [--box]`.
// Imports `./<kind>.mjs`, which exports FRAME ({ w, h } in drawing px), BOX ({ x0, y0, x1, y1 } in drawing px within the frame: the
// enemy's hit box) and drawFrames() → [{ look, grid }]. Draws every frame, Poncho's standing frame first for scale, on three grounds:
// World 1's sky, its sand, and World 2's plaster; with --box, the hit box as a 1 px magenta frame. Every game pixel is 8 x 8 screen px.
import { writeFileSync } from 'node:fs';
import { Grid } from '../raster.mjs';
import { encodePng } from '../png.mjs';
import { drawIdle } from '../poncho.mjs';
import { paste, scaled } from './kit.mjs';

const [kind, out, flag] = process.argv.slice(2);
const mod = await import(`./${kind}.mjs`);
const frames = mod.drawFrames();
const { FRAME, BOX } = mod;
const pad = 4;
const poncho = drawIdle(); // 160 x 160 art px, feet on the bottom row
// Work in art px: an enemy drawing px is 2 art px.
const cellW = Math.max(FRAME.w * 2, 0) + pad * 2;
const cellH = Math.max(FRAME.h * 2, 160) + pad * 2;
const grounds = [['#F4C66E', '#6FA03A'], ['#E8B87A', '#A0472F'], ['#F2B0A6', '#E07A52']];
const cols = frames.length + 1;
const g = new Grid(160 + pad * 2 + cellW * frames.length, cellH * grounds.length);
grounds.forEach(([bg, floor], row) => {
  const top = row * cellH;
  for (let y = top; y < top + cellH; y++) for (let x = 0; x < g.width; x++) g.set(x, y, y >= top + cellH - pad ? floor : bg);
  paste(g, poncho, pad, top + cellH - pad - 160);
  frames.forEach((f, i) => {
    const big = scaled(f.grid, 2);
    const ox = 160 + pad * 2 + i * cellW + pad;
    // A ground walker's feet are the frame's bottom row; a flier is shown with the frame's bottom on the line too.
    const oy = top + cellH - pad - FRAME.h * 2;
    paste(g, big, ox, oy);
    if (flag === '--box' && BOX) {
      const [x0, y0, x1, y1] = [ox + BOX.x0 * 2, oy + BOX.y0 * 2, ox + BOX.x1 * 2 - 1, oy + BOX.y1 * 2 - 1];
      for (let x = x0; x <= x1; x++) { g.set(x, y0, '#FF00FF'); g.set(x, y1, '#FF00FF'); }
      for (let y = y0; y <= y1; y++) { g.set(x0, y, '#FF00FF'); g.set(x1, y, '#FF00FF'); }
    }
  });
});
void cols;
const big = scaled(g, 2);
writeFileSync(out, encodePng(big.width, big.height, big.toRgba()));
console.log(`wrote ${out}: ${frames.map((f) => f.look).join(', ')}`);
