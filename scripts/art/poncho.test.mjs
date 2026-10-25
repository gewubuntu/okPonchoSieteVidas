import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { drawIdle, drawRun, FRAME, LEG_TOP, SCALE, TAIL_ROOM } from './poncho.mjs';
import { COLOURS, ROWS } from './poncho-pixels.mjs';
import { RUN_LEGS } from './poncho-run-legs.mjs';
import { buildSheet } from './make-sprites.mjs';

const sheetFile = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'assets', 'sprites', 'poncho.png');
const frames = () => [drawIdle(), ...drawRun()];
/** Where the drawing's left edge lies in a frame: the drawing plus the tail's room is centred (GDD-ART-02: 2 x 2 art pixels each). */
const left = Math.floor((FRAME - (56 + TAIL_ROOM) * 2) / 2);
/** Whether a cream pixel lies in the body rows of a frame (top row `top`) on a cell the drawing leaves empty. */
function tailCream(frame, top) {
  for (let y = top; y < top + LEG_TOP * 2; y++) {
    for (let x = 0; x < FRAME; x++) {
      if (frame.get(x, y) !== COLOURS.w) continue;
      const col = Math.floor((x - left) / 2) - TAIL_ROOM, row = Math.floor((y - top) / 2);
      if ((ROWS[row]?.[col] ?? '.') === '.') return true;
    }
  }
  return false;
}

/** Every pixel of the drawing above `LEG_TOP` (or all of it, `rowsTo` 71) must sit in the frame, 2 x 2, with its colour. */
function expectDrawing(frame, top, rowsTo) {
  ROWS.forEach((row, y) => {
    if (y >= rowsTo) return;
    [...row].forEach((ch, x) => {
      if (ch === '.') return;
      for (let j = 0; j < SCALE; j++) {
        for (let i = 0; i < SCALE; i++) {
          expect(frame.get(left + (x + TAIL_ROOM) * 2 + i, top + y * 2 + j), `drawing pixel (${x}, ${y}) at ${i},${j}`).toBe(COLOURS[ch]);
        }
      }
    });
  });
}

describe('GDD-ART-02 Poncho sprite frames', () => {
  it('GDD-ART-02 the standing frame is the user\'s drawing, each pixel 2 x 2', () => {
    expect(left).toBe(16);
    expectDrawing(drawIdle(), FRAME - 71 * 2, ROWS.length);
  });

  it('GDD-ART-04 every frame stands on the frame\'s bottom row', () => {
    const all = frames();
    expect(all).toHaveLength(5);
    for (const frame of all) {
      expect(frame.width).toBe(160);
      expect(frame.height).toBe(160);
      expect(Array.from({ length: FRAME }, (_, x) => frame.get(x, 159)).some((c) => c !== null)).toBe(true);
    }
  });

  it('GDD-ART-04 the run frames keep the standing drawing\'s body', () => {
    drawRun().forEach((frame, i) => {
      const h = LEG_TOP + RUN_LEGS[i].length;
      expectDrawing(frame, FRAME - h * 2, LEG_TOP);
    });
  });

  it('GDD-ART-02 the tail is added behind him', () => {
    // The drawing's brim is as wide as the figure, so the tail's cream tip hangs under it, not left of it: a cream pixel
    // in the body rows where the user's drawing has no pixel can only be the tail.
    drawRun().forEach((frame, i) => {
      const top = FRAME - (LEG_TOP + RUN_LEGS[i].length) * 2;
      expect(tailCream(frame, top)).toBe(true);
    });
    expect(tailCream(drawIdle(), FRAME - 71 * 2)).toBe(true);
  });

  it('GDD-ART-04 the committed sheet is the one the script makes', () => {
    expect(buildSheet().equals(readFileSync(sheetFile))).toBe(true);
  });
});
