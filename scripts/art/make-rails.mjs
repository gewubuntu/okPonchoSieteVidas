// Writes World 3's railway things to assets/sprites/sierra/ (GDD-ART-06 "Things", GDD-WLD-15): rail.png (the rail level, up and down, the
// broken end and the trestle's pieces, 16 x 24 game px frames), buffer.png (16 x 16), post.png (the warning post, 8 x 24), vagoneta.png (the
// cart's four looks, its back layers over its front layers, 32 x 16 each) and viga.png (the low beam's four pieces, 16 x 16 each).
// The PNGs are committed, so only run this after changing the drawing (scripts/art/rails.test.mjs checks they match).
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodePng } from './png.mjs';
import { drawBuffer, drawPost, drawRail, drawVagoneta, drawViga } from './rails.mjs';

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'assets', 'sprites', 'sierra');

const png = (grid) => encodePng(grid.width, grid.height, grid.toRgba());

/** The PNG bytes of every image, by file name. */
export function buildRails() {
  return {
    'rail.png': png(drawRail()),
    'buffer.png': png(drawBuffer()),
    'post.png': png(drawPost()),
    'vagoneta.png': png(drawVagoneta()),
    'viga.png': png(drawViga()),
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  mkdirSync(outDir, { recursive: true });
  for (const [name, bytes] of Object.entries(buildRails())) {
    writeFileSync(join(outDir, name), bytes);
    console.log(`wrote ${join(outDir, name)}`);
  }
}
