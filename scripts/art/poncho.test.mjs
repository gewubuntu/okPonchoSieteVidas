import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ART_SCALE, PONCHO_ART, SPRITE_FRAME } from '../../src/config/tuning';
import { PONCHO_BOX, PONCHO_FRAME, PONCHO_FRAMES } from '../../src/ui/ponchoFrames';
import { PONCHO_LOOKS } from '../../src/ui/ponchoLooks';
import { sheet } from './enemies1/kit.mjs';
import { drawIdle, drawRun, FRAME, LEG_TOP, SCALE, TAIL_ROOM } from './poncho.mjs';
import { COLOURS, ROWS } from './poncho-pixels.mjs';
import { RUN_LEGS } from './poncho-run-legs.mjs';
import { buildSheet, PONCHO_LOOKS as SHEET_LOOKS, ponchoFrames, SHEET_COLUMNS } from './make-sprites.mjs';
import * as actions from './poncho/actions.mjs';
import * as moves from './poncho/moves.mjs';
import { BOX, check, pose, POSE_FRAME, RUN, STANDING } from './poncho/rig.mjs';

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

});

// Drawing the frames takes a moment, so they are drawn once.
const FRAMES = ponchoFrames();
const grids = (g) => Array.from({ length: g.height }, (_, y) => Array.from({ length: g.width }, (_, x) => g.get(x, y)));

describe('GDD-ART-04 Poncho\'s sheet: his animation frames', { timeout: 60_000 }, () => {
  it('GDD-ART-04 the committed sheet is the one the script makes', () => {
    expect(buildSheet(FRAMES).equals(readFileSync(sheetFile))).toBe(true);
  });

  it('GDD-ART-04 the sheet is rows of 8 frames of 192 x 192 art px (under 4096 px wide), in the order the game picks them', () => {
    expect(SHEET_LOOKS).toEqual([...PONCHO_LOOKS]);
    expect(PONCHO_LOOKS.slice(0, 5)).toEqual(['idle', 'run0', 'run1', 'run2', 'run3']);
    expect(PONCHO_LOOKS).toEqual(['idle', 'run0', 'run1', 'run2', 'run3', ...moves.LOOKS.filter((l) => l !== 'idle'), ...actions.LOOKS]);
    expect(FRAMES.map((f) => f.look)).toEqual([...PONCHO_LOOKS]);
    expect([SPRITE_FRAME, PONCHO_ART.frame]).toEqual([48, 48]);
    const s = sheet(FRAMES.map((f) => f.grid), POSE_FRAME, SHEET_COLUMNS);
    expect([s.width, s.height]).toEqual([8 * 192, Math.ceil(PONCHO_LOOKS.length / 8) * 192]);
    expect(s.width).toBeLessThanOrEqual(4096);
    expect(POSE_FRAME.w * 2).toBe(SPRITE_FRAME * ART_SCALE);
    expect(PONCHO_FRAME).toEqual(POSE_FRAME);
    expect(PONCHO_BOX).toEqual(BOX);
  });

  it('GDD-ART-04 the standing frame is frame 0 and the run frames 1 to 4, as before, in the bigger frame', () => {
    // The rig's test proves pose(STANDING) and pose(RUN[i]) are today's frames, pixel for pixel (rig.test.mjs).
    expect(grids(FRAMES[0].grid)).toEqual(grids(pose(STANDING)));
    RUN.forEach((spec, i) => expect(grids(FRAMES[1 + i].grid), `run${i}`).toEqual(grids(pose(spec))));
  });

  it('GDD-ART-04 each frame\'s hand, holds and mouth are the ones the game reads', () => {
    for (const f of FRAMES) {
      const want = { hand: f.hand, holds: f.holds, ...(f.mouth ? { mouth: f.mouth } : {}) };
      expect(PONCHO_FRAMES[f.look], f.look).toEqual(want);
    }
    expect(Object.keys(PONCHO_FRAMES)).toEqual([...PONCHO_LOOKS]);
  });

  it('GDD-ART-03 his frames use only his 13 colours', () => {
    const palette = Object.values(COLOURS);
    expect(palette).toHaveLength(13);
    for (const f of FRAMES) {
      const off = new Set(f.grid.cells.filter((c) => c !== null && !palette.includes(c)));
      expect([...off], f.look).toEqual([]);
    }
  });

  it('GDD-ART-05 every frame is outlined and clear of the frame\'s edge but the feet\'s row', () => {
    // The run legs meet the poncho's hem open in a pixel or two, as today's run frames do (rig.mjs): only that is let pass, there.
    for (const f of FRAMES) {
      const problems = check(f.grid).filter((p) => !(/^run/.test(f.look) && p.startsWith('open outline')));
      expect(problems, f.look).toEqual([]);
    }
  });

  // L-059: the frames of assets/sprites/poncho.png (and of assets/sprites/poncho/, items.test.mjs); scripts/art/poncho.levels.test.mjs
  // fits every frame he shows over the real levels.
  it('GDD-ART-04 each frame reaches past his body box exactly as far as PONCHO_ART.reach says (L-059)', () => {
    // How far its painted pixels (the outline included) stand behind, in front of, above and below his box, facing right, in game px.
    for (const f of FRAMES) {
      const reach = { behind: 0, front: 0, above: 0, below: 0 };
      for (let y = 0; y < f.grid.height; y++) {
        for (let x = 0; x < f.grid.width; x++) {
          if (f.grid.get(x, y) === null) continue;
          reach.behind = Math.max(reach.behind, (BOX.x0 - x) / 2);
          reach.front = Math.max(reach.front, (x + 1 - BOX.x1) / 2);
          reach.above = Math.max(reach.above, (BOX.y0 - y) / 2);
          reach.below = Math.max(reach.below, (y + 1 - BOX.y1) / 2);
        }
      }
      expect(reach, f.look).toEqual(PONCHO_ART.reach[f.look]);
    }
    expect(Object.keys(PONCHO_ART.reach)).toEqual([...PONCHO_LOOKS]);
  });

  it('GDD-ART-04 no frame reaches below his feet but the respawn flip\'s, drawn in the air (L-059)', () => {
    for (const look of PONCHO_LOOKS) if (!/^flip/.test(look)) expect(PONCHO_ART.reach[look].below, look).toBe(0);
  });
});
