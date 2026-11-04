// Writes World 2's (Mercado) art to assets/sprites/mercado/ (GDD-ART-06, the World 2 art spec): sky-strips.png (two 1920 x 2 dither
// strips), cloud-0.png to cloud-2.png (one per cloud), far-town.png (the hill town band, 1920 x 464), mid-roofs.png (the rooftops band,
// 1920 x 304), ground.png (28 frames of 64 x 64 in World 1's layout: top tile and wall tile in two versions each, the six slopes as a
// pitched roof in two versions each, the tiles under them), decor.png (seven frames of 64 x 160, one per market object), awning.png (the
// toldo's pieces and states), cordel.png (the papel picado line's pieces and posts), rollo.png (the rolled-up cordel) and plaza.png (the
// boss arena's mid layer with the kiosco, 1920 x 304). The flat sky bands and the foot (#4E4A78) are drawn flat by the game.
// The PNGs are committed, so only run this after changing the drawing (scripts/art/mercado.test.mjs checks they match).
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { drawAwning, drawCloudImages, drawCordel, drawDecor, drawFarTown, drawGround, drawMidRoofs, drawPlaza, drawRollo, drawSkyStrips } from './mercado.mjs';
import { encodePng } from './png.mjs';

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'assets', 'sprites', 'mercado');

const png = (grid) => encodePng(grid.width, grid.height, grid.toRgba());

/** The PNG bytes of every image, by file name. */
export function buildMercado() {
  const clouds = Object.fromEntries(drawCloudImages().map((grid, i) => [`cloud-${i}.png`, png(grid)]));
  return {
    'sky-strips.png': png(drawSkyStrips()),
    ...clouds,
    'far-town.png': png(drawFarTown()),
    'mid-roofs.png': png(drawMidRoofs()),
    'ground.png': png(drawGround()),
    'decor.png': png(drawDecor()),
    'awning.png': png(drawAwning()),
    'cordel.png': png(drawCordel()),
    'rollo.png': png(drawRollo()),
    'plaza.png': png(drawPlaza()),
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  mkdirSync(outDir, { recursive: true });
  for (const [name, bytes] of Object.entries(buildMercado())) {
    writeFileSync(join(outDir, name), bytes);
    console.log(`wrote ${join(outDir, name)}`);
  }
}
