// The poof a defeated World 1 enemy goes out in (GDD-ENM-02): a white star burst, then a round dust cloud that swells, thins and
// breaks into three little puffs. Drawn in code (GDD-ART-01) in World 1's colours (GDD-ART-06) with the outline (GDD-ART-05), on a grid
// of drawing pixels.
import { ellipse, Grid } from '../raster.mjs';
import { OUTLINE, W1, px, shaded } from './kit.mjs';

/** 24 x 24 game px, centred on the enemy. */
export const FRAME = { w: 48, h: 48 };
/** The whole frame. */
export const BOX = { x0: 0, y0: 0, x1: 48, y1: 48 };
export const LOOKS = ['poof0', 'poof1', 'poof2', 'poof3'];

const C = 24; // the middle
const CLOUD = [W1.sunDisc, W1.cloudTop, W1.cloudUnder];
/** The cloud thinning: its bright light gone. */
const THIN = [W1.cloudTop, W1.cloudTop, W1.cloudUnder];

/** The burst, four-way symmetric: long points straight out, short ones on the diagonals, a core between; white, tipped yellow. */
function burst() {
  const g = new Grid(FRAME.w, FRAME.h);
  for (let y = 0; y < FRAME.h; y++) for (let x = 0; x < FRAME.w; x++) {
    const ax = Math.abs(x + 0.5 - C) - 0.5, ay = Math.abs(y + 0.5 - C) - 0.5; // 0 on the two middle rows and columns
    const out = Math.max(ax, ay);
    let c = null;
    if (ax + ay <= 4) c = W1.sunDisc;
    else if (Math.min(ax, ay) === 0 && out <= 14) c = out <= 8 ? W1.sunDisc : W1.sunRing;
    else if (Math.min(ax, ay) === 1 && out <= 7) c = out <= 5 ? W1.sunDisc : W1.sunRing;
    else if (Math.abs(ax - ay) <= 1 && ax + ay <= 13) c = ax + ay <= 8 ? W1.sunDisc : W1.sunRing;
    if (c) g.set(x, y, c);
  }
  g.outline(OUTLINE, 1);
  return g;
}

/** A cloud of balls [x, y, r], drawn back to front so each ball's shaded rim shows where the next one overlaps it. */
function cloud(balls, specks = [], material = CLOUD) {
  const g = new Grid(FRAME.w, FRAME.h);
  for (const [x, y, r] of balls) shaded(g, ellipse(x, y, r, r), material, { darkDepth: 2 });
  px(g, specks, W1.sandLight);
  g.outline(OUTLINE, 1);
  return g;
}

/** Three clumps out from the middle (up left, up right, down), each two balls, and a small ball still joining them. */
const clumps = (d, r, joined) => {
  const balls = joined ? [[C, C, 5]] : [];
  for (const a of [-150, -30, 90]) {
    const t = (a * Math.PI) / 180, x = C + d * Math.cos(t), y = C + d * Math.sin(t);
    balls.push([x - r * 0.55, y + r * 0.2, r * 0.8], [x + r * 0.35, y - r * 0.15, r]);
  }
  return balls;
};
const POOF2 = clumps(9.5, 6, true);
const POOF3 = clumps(15.5, 3.8, false);

export function drawFrames() {
  return [
    { look: 'poof0', grid: burst() },
    // A round cloud: the back row of balls first, the big front one last.
    { look: 'poof1', grid: cloud([[C - 4, C - 5, 5.5], [C + 4, C - 6, 5.5], [C - 8, C + 2, 5.5], [C + 8, C + 2, 5.5], [C, C + 2, 8]], [[C - 2, C + 4], [C - 1, C + 4]]) },
    // Swelled and thinner, it opens out round the middle into three clumps, the ones that drift apart next.
    { look: 'poof2', grid: cloud(POOF2, [[C - 10, C - 5], [C - 9, C - 5], [C + 3, C + 11], [C + 4, C + 11]], THIN) },
    // Three little puffs drifting apart.
    { look: 'poof3', grid: cloud(POOF3, [[C + 2, C + 15], [C + 3, C + 15]], THIN) },
  ];
}
