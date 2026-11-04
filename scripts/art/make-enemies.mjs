// Writes World 1's enemy sprites to assets/sprites/enemies/ (GDD-ENM-02, GDD-ART-05): alacran.png, zopilote.png, cactus.png,
// tlacuache.png and poof.png, each one row of its frames in the order of its module's LOOKS, each frame FRAME.w x FRAME.h drawing px
// (2 x 2 art px each). The drawings are in scripts/art/enemies1/. The PNGs are committed, so only run this after changing a drawing
// (scripts/art/enemies1.test.mjs checks they match).
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as alacran from './enemies1/alacran.mjs';
import * as cactus from './enemies1/cactus.mjs';
import { sheet } from './enemies1/kit.mjs';
import * as poof from './enemies1/poof.mjs';
import * as tlacuache from './enemies1/tlacuache.mjs';
import * as zopilote from './enemies1/zopilote.mjs';
import { encodePng } from './png.mjs';

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'assets', 'sprites', 'enemies');

/** The drawing modules, by the name of their sheet. */
export const KINDS = { alacran, zopilote, cactus, tlacuache, poof };

const png = (grid) => encodePng(grid.width, grid.height, grid.toRgba());

/** A kind's sheet in art px: its frames in one row. */
export const enemySheet = (m, frames = m.drawFrames()) => sheet(frames.map((f) => f.grid), m.FRAME, m.LOOKS.length);

/** The PNG bytes of every sheet, by file name. */
export function buildEnemies() {
  return Object.fromEntries(Object.entries(KINDS).map(([name, m]) => [`${name}.png`, png(enemySheet(m))]));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  mkdirSync(outDir, { recursive: true });
  for (const [name, bytes] of Object.entries(buildEnemies())) {
    writeFileSync(join(outDir, name), bytes);
    console.log(`wrote ${join(outDir, name)}`);
  }
}
