// Writes Poncho's sprite sheet to assets/sprites/poncho.png (GDD-ART-01, GDD-ART-02, GDD-ART-04): five frames side by
// side, each FRAME x FRAME art pixels. Frame 0 is the standing frame, frames 1 to 4 the run cycle in order.
// The PNG is committed, so only run this after changing a frame (scripts/art/poncho.test.mjs checks they match).
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { drawIdle, drawRun, FRAME } from './poncho.mjs';
import { encodePng } from './png.mjs';

const outFile = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'assets', 'sprites', 'poncho.png');

/** The sheet's PNG bytes. */
export function buildSheet() {
  const frames = [drawIdle(), ...drawRun()];
  const width = FRAME * frames.length;
  const rgba = new Uint8Array(width * FRAME * 4);
  frames.forEach((frame, n) => {
    const pixels = frame.toRgba();
    for (let y = 0; y < FRAME; y++) rgba.set(pixels.subarray(y * FRAME * 4, (y + 1) * FRAME * 4), (y * width + n * FRAME) * 4);
  });
  return encodePng(width, FRAME, rgba);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  mkdirSync(dirname(outFile), { recursive: true });
  writeFileSync(outFile, buildSheet());
  console.log(`wrote ${outFile}`);
}
