// Writes La Catorce's art to assets/sprites/boss/ (GDD-BOS-04): la-catorce.png (her frames, COLUMNS across, each 288 x 144 art px: 7 rows
// of her looks facing right over 7 rows of the same looks facing left, in the order of `LOOKS`) and catorce-plume.png (her armour's plume,
// two frames of 24 x 40 art px).
// The PNGs are committed, so only run this after changing the drawing (scripts/art/catorce.test.mjs checks they match).
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { drawCatorceSheet, drawPlumeSheet } from './catorce.mjs';
import { encodePng } from './png.mjs';

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'assets', 'sprites', 'boss');

const png = (grid) => encodePng(grid.width, grid.height, grid.toRgba());

/** The PNG bytes of every image, by file name. */
export function buildCatorce() {
  return { 'la-catorce.png': png(drawCatorceSheet()), 'catorce-plume.png': png(drawPlumeSheet()) };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  mkdirSync(outDir, { recursive: true });
  for (const [name, bytes] of Object.entries(buildCatorce())) {
    writeFileSync(join(outDir, name), bytes);
    console.log(`wrote ${join(outDir, name)}`);
  }
}
