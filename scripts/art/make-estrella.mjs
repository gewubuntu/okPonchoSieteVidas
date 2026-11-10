// Writes La Estrella's art to assets/sprites/boss/ (GDD-BOS-03): la-estrella.png (her frames, COLUMNS across, each 288 x 288 art px, in the
// order of `estrellaFrames`), tejocote.png (four frames of 32 x 32: the calyx a quarter turn on each), trolley.png (two frames of 64 x 64: the
// spokes an eighth turn apart) and rope.png (the 4 x 8 tile her rope repeats)
// and cable.png (the 64 x 4 tile her cable repeats across the arena).
// The PNGs are committed, so only run this after changing the drawing (scripts/art/estrella.test.mjs checks they match).
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { drawCableTile, drawEstrellaSheet, drawRopeTile, drawTejocoteSheet, drawTrolleySheet } from './estrella.mjs';
import { encodePng } from './png.mjs';

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'assets', 'sprites', 'boss');

const png = (grid) => encodePng(grid.width, grid.height, grid.toRgba());

/** The PNG bytes of every image, by file name. */
export function buildEstrella() {
  return { 'la-estrella.png': png(drawEstrellaSheet()), 'tejocote.png': png(drawTejocoteSheet()), 'trolley.png': png(drawTrolleySheet()), 'rope.png': png(drawRopeTile()), 'cable.png': png(drawCableTile()) };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  mkdirSync(outDir, { recursive: true });
  for (const [name, bytes] of Object.entries(buildEstrella())) {
    writeFileSync(join(outDir, name), bytes);
    console.log(`wrote ${join(outDir, name)}`);
  }
}
