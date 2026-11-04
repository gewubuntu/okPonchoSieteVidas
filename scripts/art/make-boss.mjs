// Writes Don Zopilote's art to assets/sprites/boss/ (GDD-BOS-02): don-zopilote.png (his frames, COLUMNS across, each 300 x 248 art px, in
// the order of `bossFrames`), fruit.png (two frames of 36 x 36: falling, lying), rock.png (52 x 52) and crown.png (two frames of 48 x 32: level, tilted).
// The PNGs are committed, so only run this after changing the drawing (scripts/art/boss.test.mjs checks they match).
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { drawBossSheet, drawCrownSheet, drawFruitSheet, drawRock } from './boss.mjs';
import { encodePng } from './png.mjs';

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'assets', 'sprites', 'boss');

const png = (grid) => encodePng(grid.width, grid.height, grid.toRgba());

/** The PNG bytes of every image, by file name. */
export function buildBoss() {
  return { 'don-zopilote.png': png(drawBossSheet()), 'fruit.png': png(drawFruitSheet()), 'rock.png': png(drawRock()), 'crown.png': png(drawCrownSheet()) };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  mkdirSync(outDir, { recursive: true });
  for (const [name, bytes] of Object.entries(buildBoss())) {
    writeFileSync(join(outDir, name), bytes);
    console.log(`wrote ${join(outDir, name)}`);
  }
}
