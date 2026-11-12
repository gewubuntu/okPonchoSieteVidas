// Writes World 3's (Sierra) canyon art to assets/sprites/sierra/ (GDD-ART-06): sky-strips.png (two 1920 x 2 dither strips), cloud-0.png
// to cloud-2.png (one per streak), far-barranca.png (the two ranges, 1920 x 464), mid-barranca.png (the canyon's far wall, 1920 x 304),
// ground.png (28 frames of 64 x 64 in World 1's layout: top tile and rock tile in two versions each, the six slopes as a scree slope in two
// versions each, the tiles under them), decor.png (seven frames of 64 x 160, the pine-oak forest) and ledge.png (the rock ledge at rest
// and in its pale flash, 64 x 64 each). The flat sky bands and the foot (#24403A) are drawn flat by the game.
// The PNGs are committed, so only run this after changing the drawing (scripts/art/sierra.test.mjs checks they match).
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { drawCloudImages, drawDecor, drawFarBarranca, drawGround, drawLedge, drawMidBarranca, drawSkyStrips } from './sierra.mjs';
import { encodePng } from './png.mjs';

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'assets', 'sprites', 'sierra');

const png = (grid) => encodePng(grid.width, grid.height, grid.toRgba());

/** The PNG bytes of every image, by file name. */
export function buildSierra() {
  const clouds = Object.fromEntries(drawCloudImages().map((grid, i) => [`cloud-${i}.png`, png(grid)]));
  return {
    'sky-strips.png': png(drawSkyStrips()),
    ...clouds,
    'far-barranca.png': png(drawFarBarranca()),
    'mid-barranca.png': png(drawMidBarranca()),
    'ground.png': png(drawGround()),
    'decor.png': png(drawDecor()),
    'ledge.png': png(drawLedge()),
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  mkdirSync(outDir, { recursive: true });
  for (const [name, bytes] of Object.entries(buildSierra())) {
    writeFileSync(join(outDir, name), bytes);
    console.log(`wrote ${join(outDir, name)}`);
  }
}
