// Poncho's victory pose (GDD-ART-04, GDD-ART-02): the user's four-frame strip as they drew it (victory-pixels.mjs), only mapped
// to his palette (user, 2026-11-08: "Just take thie sprite for the victory and adapt it minimal to fit our colour palett"): ready
// with both fists up, then the taco raised higher in each frame. One pixel of the strip is one drawing px (2 x 2 art px). Front
// view: the game does not mirror these frames for the left. Each frame stands on the frame's bottom row with the middle of its
// feet on his body box's middle (frame column 48), like every frame.
import { Grid } from '../raster.mjs';
import { COLOURS } from '../poncho-pixels.mjs';
import { ITEM_COLOURS } from './items.mjs';
import { check, POSE_FRAME } from './rig.mjs';
import { STRIP } from './victory-pixels.mjs';

export { POSE_FRAME };

/**
 * The colour the victory adds: the badge's gold (user, 2026-11-08: "Add gold"), Poncho's 16th and last colour (GDD-ART-03); the
 * taco's shell in the strip is the same gold.
 */
export const VICTORY_COLOURS = { y: '#F9D24C' };
const KEY = { ...COLOURS, ...ITEM_COLOURS, ...VICTORY_COLOURS };
/** Every colour these frames may use: his 13, the taco's two greens and the gold. */
export const PALETTE = Object.values(KEY);

export const LOOKS = ['victory0', 'victory1', 'victory2', 'victory3'];

/** The middle of a frame's feet: halfway across the colour in its lowest row inside the outline (the soles), in the strip's px. */
function feetMiddle(rows) {
  const soles = [...rows[rows.length - 2]];
  const lit = soles.flatMap((ch, x) => (ch === '.' || ch === '#' ? [] : [x]));
  return (Math.min(...lit) + Math.max(...lit) + 1) / 2;
}

function frame(rows) {
  const g = new Grid(POSE_FRAME.w, POSE_FRAME.h);
  const ox = Math.round(POSE_FRAME.w / 2 - feetMiddle(rows)), oy = POSE_FRAME.h - rows.length;
  rows.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch !== '.') g.set(ox + x, oy + y, KEY[ch]);
  }));
  return g;
}

export function drawFrames() {
  return LOOKS.map((look, i) => {
    const grid = frame(STRIP[i]);
    const problems = check(grid, { palette: PALETTE });
    if (problems.length) throw new Error(`${look}: ${problems.slice(0, 3).join('; ')}`);
    return { look, grid, hand: null, holds: 'none', mirror: false };
  });
}
