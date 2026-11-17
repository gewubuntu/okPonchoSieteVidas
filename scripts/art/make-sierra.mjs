// Writes World 3's (Sierra) canyon art to assets/sprites/sierra/ (GDD-ART-06): sky-strips.png (two 1920 x 2 dither strips), cloud-0.png
// to cloud-2.png (one per streak), far-barranca.png (the two ranges, 1920 x 464), mid-barranca.png (the canyon's far wall, 1920 x 304),
// ground.png (28 frames of 64 x 64 in World 1's layout: top tile and rock tile in two versions each, the six slopes as a scree slope in two
// versions each, the tiles under them), decor.png (seven frames of 64 x 160, the pine-oak forest) and ledge.png (the rock ledge at rest
// and in its pale flash, 64 x 64 each). The flat sky bands and the foot (#24403A) are drawn flat by the game.
// The mine's (3-2 La Mina, `sierra-mina.mjs`): sky-mina.png (the roof band's dither strip, 1920 x 2), far-mina.png (the old workings,
// 1920 x 640), mid-mina.png (the timbering, 1920 x 496), ground-mina.png (the outdoor sheet's layout, no grass, and the mine's 7 frames
// after its 28: the underside, deep rock, the one-tile ledge, the rock tile with no ore), decor-mina.png (seven frames of 64 x 160) and
// backwall.png (the rock back wall, four versions of 64 x 64). The roof band and the foot (#221D2E) are drawn flat.
// The PNGs are committed, so only run this after changing the drawing (scripts/art/sierra.test.mjs checks they match).
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { drawCloudImages, drawDecor, drawFarBarranca, drawGround, drawLedge, drawMidBarranca, drawSkyStrips } from './sierra.mjs';
import { drawBackwall, drawDecorMina, drawFarMina, drawGroundMina, drawMidMina, drawMinaSkyStrip } from './sierra-mina.mjs';
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

/** The PNG bytes of the mine's images and the back wall, by file name. */
export function buildMina() {
  return {
    'sky-mina.png': png(drawMinaSkyStrip()),
    'far-mina.png': png(drawFarMina()),
    'mid-mina.png': png(drawMidMina()),
    'ground-mina.png': png(drawGroundMina()),
    'decor-mina.png': png(drawDecorMina()),
    'backwall.png': png(drawBackwall()),
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  mkdirSync(outDir, { recursive: true });
  for (const [name, bytes] of Object.entries({ ...buildSierra(), ...buildMina() })) {
    writeFileSync(join(outDir, name), bytes);
    console.log(`wrote ${join(outDir, name)}`);
  }
}
