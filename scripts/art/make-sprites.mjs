// Writes Poncho's sprite sheet to assets/sprites/poncho.png (GDD-ART-01, GDD-ART-02, GDD-ART-03, GDD-ART-04): rows of SHEET_COLUMNS frames (so the
// image stays under a phone's 4096 px texture limit), each
// POSE_FRAME (96 x 96 drawing px, 2 x 2 art px each: 192 x 192 art px, 48 x 48 game px) from his pose rig (scripts/art/poncho/).
// Frame 0 is the standing frame, frames 1 to 4 the run cycle in order, then the movement poses (poncho/moves.mjs, after its idle)
// and the action poses (poncho/actions.mjs), then the victory frames last (poncho/victory.mjs), in their LOOKS' order: PONCHO_LOOKS, which the game reads from src/ui/ponchoLooks.ts.
// The PNG is committed, so only run this after changing a frame (scripts/art/poncho.test.mjs checks they match).
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sheet } from './enemies1/kit.mjs';
import { encodePng } from './png.mjs';
import * as actions from './poncho/actions.mjs';
import * as moves from './poncho/moves.mjs';
import { pose, POSE_FRAME, RUN, STANDING } from './poncho/rig.mjs';
import * as victory from './poncho/victory.mjs';

const outFile = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'assets', 'sprites', 'poncho.png');

/** Frames a row: 8 x 192 = 1536 art px wide, well inside the 4096 px texture size every WebGL phone supports (GDD-TEC-03). */
export const SHEET_COLUMNS = 8;

/** The run frames' names, frames 1 to 4. */
export const RUN_LOOKS = ['run0', 'run1', 'run2', 'run3'];
/** The sheet's looks in frame order: the standing frame (moves' idle), the run cycle, the other movement poses, the action poses, the victory. */
export const PONCHO_LOOKS = ['idle', ...RUN_LOOKS, ...moves.LOOKS.filter((l) => l !== 'idle'), ...actions.LOOKS, ...victory.LOOKS];

/**
 * Every frame in sheet order: `{ look, grid, hand, holds, mouth? }` (`holds` and `mouth` as actions.mjs says). The run frames hold
 * like the standing frame: a held taco or chile at the hand, nudged from the rig's default as the standing frame's is.
 */
export function ponchoFrames() {
  const m = moves.drawFrames(), a = actions.drawFrames(), v = victory.drawFrames();
  const idle = m.find((f) => f.look === 'idle');
  const standing = pose(STANDING);
  const nudge = { dx: idle.hand.x - standing.hand.x, dy: idle.hand.y - standing.hand.y };
  const run = RUN.map((spec, i) => {
    const grid = pose({ ...spec, hand: nudge });
    return { look: RUN_LOOKS[i], grid, hand: grid.hand, holds: idle.holds };
  });
  const byLook = new Map([...m, ...run, ...a, ...v].map((f) => [f.look, f]));
  return PONCHO_LOOKS.map((look) => byLook.get(look));
}

/** The sheet's PNG bytes. */
export function buildSheet(frames = ponchoFrames()) {
  const s = sheet(frames.map((f) => f.grid), POSE_FRAME, SHEET_COLUMNS);
  return encodePng(s.width, s.height, s.toRgba());
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  mkdirSync(dirname(outFile), { recursive: true });
  writeFileSync(outFile, buildSheet());
  console.log(`wrote ${outFile}`);
}
