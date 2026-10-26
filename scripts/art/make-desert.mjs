// Writes World 1's backdrop and ground to assets/sprites/desierto/ (GDD-ART-06): sky-strips.png (three 1920 x 2 dither strips), sun.png,
// cloud-0.png to cloud-3.png (one per cloud), mountains.png (the ridge band, 1920 x 488) and ground.png (four 64 x 64 frames: top tile
// versions 0 and 1, earth tile versions 0 and 1). The flat sky bands and the mountains' foot are drawn flat by the game.
// The PNGs are committed, so only run this after changing the drawing (scripts/art/desert.test.mjs checks they match).
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { drawCloudImages, drawGround, drawMountains, drawSkyStrips, drawSun } from './desert.mjs';
import { encodePng } from './png.mjs';

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'assets', 'sprites', 'desierto');

const png = (grid) => encodePng(grid.width, grid.height, grid.toRgba());

/** The PNG bytes of every image, by file name. */
export function buildDesert() {
  const clouds = Object.fromEntries(drawCloudImages().map((grid, i) => [`cloud-${i}.png`, png(grid)]));
  return {
    'sky-strips.png': png(drawSkyStrips()),
    'sun.png': png(drawSun()),
    ...clouds,
    'mountains.png': png(drawMountains()),
    'ground.png': png(drawGround()),
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  mkdirSync(outDir, { recursive: true });
  for (const [name, bytes] of Object.entries(buildDesert())) {
    writeFileSync(join(outDir, name), bytes);
    console.log(`wrote ${join(outDir, name)}`);
  }
}
