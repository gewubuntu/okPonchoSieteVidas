// El Cuate, World 1's cactus buddy (GDD-ENM-02): a chubby little cactus who naps in the sun. Drawn in code (GDD-ART-01) in World 1's
// colours (GDD-ART-06) with the outline (GDD-ART-05), on a grid of drawing pixels, facing right.
import { Grid, or, stroke } from '../raster.mjs';
import { OUTLINE, W1, px, shaded, shifted } from './kit.mjs';

/** 16 x 24 game px. */
export const FRAME = { w: 32, h: 48 };
/** His box, 12 x 16 game px, standing on the frame's bottom row. */
export const BOX = { x0: 4, y0: 16, x1: 28, y1: 48 };
export const LOOKS = ['doze0', 'doze1', 'peek', 'alarm0', 'alarm1'];

const SKIN = [W1.grassLight, W1.grass, W1.grassDark];
const CX = 16;
const TOP = 17; // his head's top row

/** The trunk: a column with a round head, `half` wide each side of the middle. `belly` swells it 1 px each side round the face. */
function trunk(belly, half = 7) {
  return (x, y) => {
    if (y > 47 || y < TOP) return false;
    const headY = TOP + 7;
    let hw = half;
    if (y < headY) hw = half * Math.sqrt(Math.max(0, 1 - ((headY - y) / 7.6) ** 2));
    if (belly && y > 36 && y < 46) hw += 1;
    return Math.abs(x - CX) <= hw;
  };
}

/** An arm: out from the trunk at `elbowY`, then up to `topY`, its middle at `armX`. */
const arm = (side, armX, elbowY, topY) => stroke([[CX + side * 4, elbowY], [armX, elbowY], [armX, topY]], 4);

const edgeL = (test, y) => { for (let x = 0; x < 32; x++) if (test(x + 0.5, y + 0.5)) return x; return -1; };
const edgeR = (test, y) => { for (let x = 31; x >= 0; x--) if (test(x + 0.5, y + 0.5)) return x; return -1; };
const edgeT = (test, x) => { for (let y = 0; y < 48; y++) if (test(x + 0.5, y + 0.5)) return y; return -1; };

/** The claret cup's flower (Echinocereus, red-flowered in the Chihuahuan desert): r red petals, o orange heart, y its glint, e shade. */
const FLOWER = ['r.rr.r', 'rroyrr', '.rore.', '..ee..'];

function drawCuate({ breath = 0, eyes = 'sleep', alarm = false } = {}) {
  const g = new Grid(FRAME.w, FRAME.h);
  // In the alarm he tenses: the trunk pulled in 1 px each side, the arms shot straight up beside it.
  const left = alarm ? arm(-1, 7, 30, 17) : arm(-1, 6, 34 - breath, 24 - breath);
  const right = alarm ? arm(1, 25, 29, 16) : arm(1, 26, 33 - breath, 22 - breath);
  const body = trunk(breath, alarm ? 6 : 7);
  const fo = alarm ? -1 : 0; // the face's shift, to stay on the narrower trunk
  const all = or(body, left, right);
  shaded(g, left, SKIN);
  shaded(g, right, SKIN);
  shaded(g, body, SKIN);
  // A second shade column down his right side, under his round head.
  for (let y = TOP + 4; y < 46; y++) { const x = edgeR(body, y) - 1; if (g.get(x, y) === W1.grass) g.set(x, y, W1.grassDark); }
  // A shadow crease where each arm meets the trunk.
  for (const [test, side] of [[left, -1], [right, 1]]) {
    for (let y = 20; y < 40; y++) {
      const x = (side < 0 ? edgeL(body, y) : edgeR(body, y)) + side;
      if (test(x + 0.5, y + 0.5)) { g.set(x, y, W1.grassDark); g.set(x - side, y, W1.grassDark); break; }
    }
  }
  // Ribs: grooves down the column above his face, a lit ridge left of each on his lit side.
  for (const [rx, y0, y1, lit] of [[11, TOP + 4, 33, true], [15, TOP + 1, 31, true], [alarm ? 18 : 19, TOP + 3, 33, false]]) {
    for (let y = y0; y <= y1; y++) {
      if (g.get(rx, y) === W1.grass) g.set(rx, y, W1.grassDark);
      if (lit && y < y1 && g.get(rx - 1, y) === W1.grass) g.set(rx - 1, y, W1.grassLight);
    }
  }
  // Face, low on the trunk, turned a little to the front.
  const fy = 38;
  const L = 12 + fo, R = 18 + fo; // left columns of the two eyes, each 4 wide
  const closed = (x) => px(g, [[x, fy], [x + 1, fy + 1], [x + 2, fy + 1], [x + 3, fy]], OUTLINE);
  // An open eye from a map: W the white, # the pupil; its bottom row is the closed eye's bottom row.
  const stamp = (rows, x) => rows.forEach((row, j) => [...row].forEach((ch, i) => {
    if (ch !== '.') g.set(x + i, fy + 2 - rows.length + j, ch === '#' ? OUTLINE : W1.sunDisc);
  }));
  const wide = (x) => stamp(['.WW.', 'WWWW', 'WW#W', 'WW#W', '.WW.'], x); // a fright: wide open, the pupils shrunk to dots
  const glance = (x) => stamp(['.WW.', 'WW##', 'WW##', '.WW.'], x); // looking to the front
  if (eyes === 'sleep') { closed(L); closed(R); }
  // Rosy cheeks while he is calm.
  if (eyes !== 'wide') px(g, [[L, fy + 2], [L + 1, fy + 2], [R + 2, fy + 2], [R + 3, fy + 2]], W1.cloudUnder);
  if (eyes === 'peek') { closed(L); glance(R); }
  if (eyes === 'wide') { wide(L); wide(R); }
  const my = fy + 3;
  const mx = 15 + fo;
  if (eyes === 'sleep') px(g, [[mx, my], [mx + 1, my + 1], [mx + 2, my + 1], [mx + 3, my]], OUTLINE);
  if (eyes === 'peek') px(g, [[mx + 1, my + 1], [mx + 2, my + 1]], OUTLINE);
  if (eyes === 'wide') {
    px(g, [[mx + 1, my], [mx + 2, my], [mx, my + 1], [mx + 3, my + 1], [mx, my + 2], [mx + 3, my + 2], [mx + 1, my + 3], [mx + 2, my + 3]], OUTLINE);
    px(g, [[mx + 1, my + 1], [mx + 2, my + 1], [mx + 1, my + 2], [mx + 2, my + 2]], W1.rust);
  }
  // Spines: pale clusters on his outline: a light base on the skin and a tip out of it, longer in the alarm. Big ones on his sides,
  // needles on the arm tops and the head.
  const reach = alarm ? 2 : 1;
  const spine = (x, y, dx, dy) => {
    for (const k of [-1, 0, 1]) g.set(x + k * dy, y + k * dx, W1.cloudTop);
    for (let i = 1; i <= reach; i++) g.set(x + dx * i, y + dy * i, W1.sunDisc);
  };
  const needle = (x, y, dx, dy) => {
    g.set(x, y, W1.cloudTop);
    for (let i = 1; i <= reach; i++) g.set(x + dx * i, y + dy * i, W1.sunDisc);
  };
  for (const y of [alarm ? 22 : 28, 43]) spine(edgeL(all, y), y, -1, 0);
  for (const y of [alarm ? 21 : 26, 43]) spine(edgeR(all, y), y, 1, 0);
  for (const [test, side] of [[left, -1], [right, 1]]) { const x = edgeL(test, 26) + (side < 0 ? 1 : 2); needle(x, edgeT(test, x), 0, -1); }
  for (const x of [11, 13, 20]) needle(x, edgeT(body, x), 0, -1);
  // The flower on his head. It nods forward as he breathes.
  const fx = 14 + breath, fyy = TOP - 4;
  FLOWER.forEach((row, j) => [...row].forEach((ch, i) => {
    const c = { r: W1.red, o: W1.orange, y: W1.sunRing, e: W1.earth }[ch];
    if (c) g.set(fx + i + (breath && j < 2 ? 1 : 0), fyy + j, c);
  }));
  g.outline(OUTLINE, 1);
  return g;
}

export function drawFrames() {
  return [
    { look: 'doze0', grid: drawCuate() },
    { look: 'doze1', grid: drawCuate({ breath: 1 }) },
    { look: 'peek', grid: drawCuate({ eyes: 'peek' }) },
    { look: 'alarm0', grid: drawCuate({ eyes: 'wide', alarm: true }) },
    // The shiver: the same pose 1 px over.
    { look: 'alarm1', grid: shifted(drawCuate({ eyes: 'wide', alarm: true }), 1, 0) },
  ];
}
