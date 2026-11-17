// Writes the taco, the chile, what Poncho holds, the claw swipe, the effects at his mouth, the Chile Fantasma and its glow's effects to
// assets/sprites/poncho/ (GDD-ART-04, GDD-PWR-02, GDD-PWR-03, GDD-PWR-04, GDD-CMB-02): taco.png, chile.png, held.png, swipe.png, fx.png,
// fantasma.png and glow.png, each one row of its frames in the order of
// its sheet's LOOKS in scripts/art/poncho/items.mjs, each frame FRAME.w x FRAME.h drawing px (2 x 2 art px each). The PNGs are
// committed, so only run this after changing a drawing (scripts/art/poncho/items.test.mjs checks they match).
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sheet } from './enemies1/kit.mjs';
import { encodePng } from './png.mjs';
import { chile, fantasma, fx, glowSheet, held, swipe, taco } from './poncho/items.mjs';

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'assets', 'sprites', 'poncho');

/** The item sheets, by the name of their file. */
export const ITEM_SHEETS = { taco, chile, held, swipe, fx, fantasma, glow: glowSheet };

/** A sheet in art px: its frames in one row. */
export const itemSheet = (m, frames = m.draw()) => sheet(frames.map((f) => f.grid), m.FRAME, m.LOOKS.length);

/** The PNG bytes of every sheet, by file name. */
export function buildItems() {
  return Object.fromEntries(Object.entries(ITEM_SHEETS).map(([name, m]) => {
    const s = itemSheet(m);
    return [`${name}.png`, encodePng(s.width, s.height, s.toRgba())];
  }));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  mkdirSync(outDir, { recursive: true });
  for (const [name, bytes] of Object.entries(buildItems())) {
    writeFileSync(join(outDir, name), bytes);
    console.log(`wrote ${join(outDir, name)}`);
  }
}
