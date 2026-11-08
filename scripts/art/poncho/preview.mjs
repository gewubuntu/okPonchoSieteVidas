// Review sheet for one of Poncho's frame modules (not committed output): `node scripts/art/poncho/preview.mjs <module> <out.png> [--box]`.
// <module> is a path or a name in this folder (rig's `demo`, `moves`, `actions`, `items`); it exports POSE_FRAME or FRAME ({ w, h }
// in drawing px), LOOKS and drawFrames() → [{ look, grid, hand? }], or, like `items`, sheets that each have FRAME, LOOKS and draw()
// (all of them are drawn, one after the other, and checked with the colours it adds in ITEM_COLOURS). Draws Poncho's standing frame and then every frame, bottoms
// level, on three grounds (World 1's gold sky, its sand, World 2's pale blue), 8 screen px a game px (4 a drawing px). A frame's
// hand anchor is a 1 px magenta dot; --box draws his body box as a magenta frame. Prints each frame's check() problems.
import { writeFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { encodePng } from '../png.mjs';
import { COLOURS } from '../poncho-pixels.mjs';
import { Grid, hexToRgba } from '../raster.mjs';
import { BOX, check, pose, POSE_FRAME, STANDING } from './rig.mjs';

const [name, out, flag] = process.argv.slice(2);
if (!name || !out) {
  console.error('usage: node scripts/art/poncho/preview.mjs <module> <out.png> [--box]');
  process.exit(1);
}
// A file path, not a URL's pathname: a folder with a space in its name would otherwise be encoded twice.
const path = name.includes('/') || name.endsWith('.mjs') ? (isAbsolute(name) ? name : resolve(name)) : fileURLToPath(new URL(`./${name}.mjs`, import.meta.url));
const mod = await import(pathToFileURL(path).href);
// A module of sheets (items.mjs) has no drawFrames(): every export with FRAME and draw() is one of its sheets.
const sheets = mod.drawFrames ? [] : Object.values(mod).filter((v) => v && typeof v.draw === 'function' && v.FRAME);
const drawn = mod.drawFrames ? mod.drawFrames() : sheets.flatMap((s) => s.draw());
const FRAME = mod.POSE_FRAME ?? mod.FRAME ?? { w: Math.max(...sheets.map((s) => s.FRAME.w)), h: Math.max(...sheets.map((s) => s.FRAME.h)) };
const frames = [{ look: 'standing (reference)', grid: pose(STANDING), hand: null, box: true }, ...drawn];

const S = 4, PAD = 6, MAGENTA = '#FF00FF';
const GROUNDS = [['#F4C66E', '#C9933F'], ['#E8B87A', '#B9824A'], ['#CFE8F1', '#9CC3D2']];
const cellW = Math.max(POSE_FRAME.w, FRAME.w) + PAD, cellH = Math.max(POSE_FRAME.h, FRAME.h) + PAD;
const sheet = new Grid(cellW * frames.length + PAD, cellH * GROUNDS.length);
GROUNDS.forEach(([sky, floor], row) => {
  const top = row * cellH;
  for (let y = top; y < top + cellH; y++) for (let x = 0; x < sheet.width; x++) sheet.set(x, y, y >= top + cellH - PAD / 2 ? floor : sky);
  frames.forEach((f, i) => {
    const ox = PAD + i * cellW, oy = top + cellH - PAD / 2 - f.grid.height;
    for (let y = 0; y < f.grid.height; y++) for (let x = 0; x < f.grid.width; x++) if (f.grid.get(x, y)) sheet.set(ox + x, oy + y, f.grid.get(x, y));
    const hand = f.hand ?? f.grid.hand;
    if (hand && f.hand !== null) sheet.set(ox + hand.x, oy + hand.y, MAGENTA);
    if (flag === '--box' && f.grid.width === POSE_FRAME.w) {
      for (let x = BOX.x0; x < BOX.x1; x++) { sheet.set(ox + x, oy + BOX.y0, MAGENTA); }
      for (let y = BOX.y0; y < BOX.y1; y++) { sheet.set(ox + BOX.x0, oy + y, MAGENTA); sheet.set(ox + BOX.x1 - 1, oy + y, MAGENTA); }
    }
  });
});

const rgba = new Uint8Array(sheet.width * S * sheet.height * S * 4);
for (let y = 0; y < sheet.height * S; y++) {
  for (let x = 0; x < sheet.width * S; x++) {
    const c = sheet.get(Math.floor(x / S), Math.floor(y / S));
    if (c) rgba.set(hexToRgba(c), (y * sheet.width * S + x) * 4);
  }
}
writeFileSync(out, encodePng(sheet.width * S, sheet.height * S, rgba));
console.log(`wrote ${out}: ${sheet.width * S} x ${sheet.height * S}`);
const palette = mod.PALETTE ?? (mod.ITEM_COLOURS ? [...Object.values(COLOURS), ...Object.values(mod.ITEM_COLOURS)] : undefined);
frames.slice(1).forEach((f, i) => {
  const problems = check(f.grid, palette ? { palette } : {});
  console.log(`${String(i + 1).padStart(2)} ${f.look}: ${problems.length ? `${problems.length} problems: ${problems.slice(0, 4).join('; ')}` : 'clean'}`);
});
