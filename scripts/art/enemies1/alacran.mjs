// The Alacrán, World 1's scorpion (GDD-ENM-02): the Durango scorpion, drawn in code (GDD-ART-01) in World 1's colours and the
// outline (GDD-ART-05, GDD-ART-06). Facing right; drawing px, each 2 x 2 art px.
import { Grid } from '../raster.mjs';
import { OUTLINE, W1 } from './kit.mjs';

export const FRAME = { w: 48, h: 32 };
export const BOX = { x0: 10, y0: 12, x1: 38, y1: 32 };
export const LOOKS = ['walk0', 'walk1', 'walk2', 'walk3', 'squash', 'hit'];

const KEY = {
  R: W1.red, E: W1.earth, D: W1.earthDark, K: OUTLINE, W: W1.sunDisc,
  Y: W1.skyTop, O: W1.orange, C: W1.cloudTop, U: W1.cloudUnder,
};
const SEAM = { [W1.red]: W1.earthDark, [W1.earth]: W1.earthDark, [W1.orange]: W1.earth, [W1.skyTop]: W1.earth, [W1.cloudTop]: W1.cloudUnder };

/** A layer of pixel rows at (ox, oy); with `seam`, what it covers gets a darker rim where it meets the layer, so parts stay apart. */
function stamp(g, rows, ox, oy, { seam = false, map = {} } = {}) {
  const pts = [];
  rows.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== '.') pts.push([ox + x, oy + y, KEY[map[ch] ?? ch]]); }));
  if (seam) {
    const mine = new Set(pts.map(([x, y]) => `${x},${y}`));
    for (const [x, y] of pts) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const c = g.get(x + dx, y + dy);
      if (c && !mine.has(`${x + dx},${y + dy}`) && SEAM[c]) g.set(x + dx, y + dy, SEAM[c]);
    }
  }
  for (const [x, y, c] of pts) g.set(x, y, c);
}

// The tail's five beads, base to tip, each at its top left (drawing px) in the standing pose; the stinger after them.
// prettier-ignore
const BEADS = [
  [11, 19, ['.RRRE.', 'RRREEE', 'REEEDD', 'EEEEDD', '.EDDD.']],
  [10, 15, ['.RRE.', 'RREEE', 'EEEDD', '.EDD.']],
  [11, 11, ['.RRE.', 'RREEE', 'REEDD', '.EDD.']],
  [16, 10, ['.RRE.', 'RREEE', 'REEED', 'EEEDD', '.DDD.']],
  [21, 11, ['.RE.', 'REEE', 'EEDD', '.DD.']],
];
/** The cream stinger, curved forward and down: the hazard mark (GDD-ART-05). */
// prettier-ignore
const STING = ['.CC..', 'CCCU.', 'CCUUU', '.UU.C', '....C'];

// The body from column 11, row 20: the segmented back with its two dark stripes, the low domed head with the eyes and the brow.
// prettier-ignore
const BODY = [
  '.........RRDDRRR..',
  '..RRRERRERWWDDRDD.',
  '.DDDDDDDDRWKWKEWKE',
  'EEEEEEEEEEWKKKEWKD',
  'EDDDDDDDDEWKKKEWWD',
  'EEEEEEEEEEEWWWEEED',
  '.DDDDDDDDDDDDDDDD.',
];
/** The eyes crossed out (stomped or knocked), over the body at the same place. */
// prettier-ignore
const X_EYES = [
  '.........RRRRRRR..',
  '..........RRRRRRR.',
  '..........KEKEKEKE',
  '..........EKEEEKED',
  '..........KEKEKEKD',
  '..........EEEEEEED',
];

// The near claw, honey: open (the fingers apart) and shut.
// prettier-ignore
const CLAW_OPEN = [
  '..YYYY..',
  '.YOOOOYY',
  'YOOOED..',
  'YOOE....',
  'YOOOE...',
  '.OOOOOOE',
  '..EEEEE.',
];
// prettier-ignore
const CLAW_SHUT = [
  '........',
  '..YYYY..',
  '.YOOOOYY',
  'YOOOEEED',
  'YOOOOOOE',
  '.EOOOOE.',
  '..EEE...',
];
/** The far claw, lower and behind: a shade darker. */
const FAR_CLAW = { Y: 'O', O: 'O', E: 'E' };
/**
 * A near leg, 2 px wide with a light top and a knee: [column offset from the hip, rows down from under the body]. The back legs
 * bend back and the front legs forward; `reach` and `push` are the two ends of a stride, `plant` and `lift` the passing poses (the
 * body is 1 px lower then, so the legs are a row shorter, and a lifted foot is off the ground).
 */
// prettier-ignore
const NEAR_LEGS = {
  back: {
    reach: [0, ['RE', 'EE', 'EE', 'EE']], push: [-1, ['.RE', '.EE', 'EE.', 'EE.']],
    plant: [-1, ['.RE', 'EE.', 'EE.']], lift: [0, ['RE.', '.EE']],
  },
  front: {
    reach: [0, ['RE.', 'EE.', '.EE', '.EE']], push: [0, ['RE', 'EE', 'EE', 'EE']],
    plant: [0, ['RE.', '.EE', '.EE']], lift: [0, ['RE.', '.EE']],
  },
};
/** A far leg: a shorter, darker stub between the near ones. */
const FAR_LEG = { up: ['D', 'D'], down: ['D'] };

/**
 * The standing scorpion. `dy` drops the body (the walk's bob), `tail` = [dx, dy] moves the tail's top (its lag), `claw` 'open' |
 * 'shut', `legs` = [pose of pair A, pose of pair B], `eyes` 'open' | 'x'.
 */
function drawStanding({ dy = 0, tail = [0, 0], claw = 'open', legs = ['reach', 'push'], eyes = 'open', relit = false } = {}) {
  const g = new Grid(FRAME.w, FRAME.h);
  const by = 20 + dy;
  const hand = claw === 'open' ? CLAW_OPEN : CLAW_SHUT;
  // `relit` swaps every material's light and shadow, for a frame that is then turned upside down: the light stays upper left.
  const shell = relit ? { R: 'D', D: 'R' } : {};
  const honey = relit ? { Y: 'E', E: 'Y' } : {};
  const sting = relit ? { C: 'U', U: 'C' } : {};
  const far = relit ? { Y: 'E', O: 'O', E: 'O' } : FAR_CLAW;
  // Near legs 1 to 4 from the back; pair A (legs 1 and 3) and pair B (2 and 4) step in turn.
  const legAt = (hx, [dx, rows]) => stamp(g, rows, hx + dx, by + 7, { map: shell });
  [14, 20, 26].forEach((hx) => stamp(g, FAR_LEG[dy ? 'down' : 'up'], hx, by + 7, { map: shell }));
  stamp(g, hand, 29, by + 1, { map: far });
  stamp(g, STING, 24 + tail[0], 12 + tail[1], { map: sting });
  BEADS.map(([x, y, rows], i) => [x + (i > 2 ? tail[0] : 0), y + (i > 2 ? tail[1] : dy), rows]).reverse().forEach(([x, y, rows]) => stamp(g, rows, x, y, { map: shell }));
  stamp(g, BODY, 11, by, { seam: true, map: shell });
  if (eyes === 'x') stamp(g, X_EYES, 11, by, { map: shell });
  [11, 17, 23, 29].forEach((hx, i) => legAt(hx, NEAR_LEGS[i < 2 ? 'back' : 'front'][legs[i % 2]]));
  stamp(g, ['..EE', '.EED', 'EDD.'], 27, by + 2, { map: shell });
  stamp(g, hand, 30, by - 4, { seam: true, map: honey });
  g.outline(OUTLINE, 1);
  return g;
}

/** The walk: legs in alternating pairs, the body bobbing down on frames 1 and 3, the tail one frame behind, the claws snipping. */
const WALK = [
  { dy: 0, tail: [0, 1], claw: 'open', legs: ['reach', 'push'] },
  { dy: 1, tail: [0, 0], claw: 'open', legs: ['plant', 'lift'] },
  { dy: 0, tail: [-1, 1], claw: 'shut', legs: ['push', 'reach'] },
  { dy: 1, tail: [-1, 0], claw: 'shut', legs: ['lift', 'plant'] },
];

/** Stomped (GDD-ENM-02): flattened to half height, X eyes, the tail flopped flat behind it, the claws flat in front. */
// prettier-ignore
const SQUASH_BODY = [
  '.........RRRRRRRR...',
  '.RRRERRERRRRRRRRRR..',
  'EDDDDDDDDKEKEKEKEEE.',
  'EEEEEEEEEEKEEEKEEED.',
  'EDDDDDDDDKEKEKEKEED.',
  '.DDDDDDDDDDDDDDDDDD.',
];
// prettier-ignore
const SQUASH_CLAW = ['.YYYY..', 'YOOOOYY', 'OOOE...', '.EEEEEE'];
// prettier-ignore
const SQUASH_BEAD = ['.RE.', 'REED', '.DD.'];
// prettier-ignore
const SQUASH_STING = ['C...', '.CCU', 'CCUU', '.UU.'];

function drawSquash() {
  const g = new Grid(FRAME.w, FRAME.h);
  stamp(g, SQUASH_STING, 2, 27);
  for (const x of [5, 8, 11]) stamp(g, SQUASH_BEAD, x, 28);
  stamp(g, SQUASH_BODY, 14, 25, { seam: true });
  stamp(g, SQUASH_CLAW, 33, 27, { seam: true });
  g.outline(OUTLINE, 1);
  return g;
}

export function drawFrames() {
  const frames = WALK.map((pose, f) => ({ look: `walk${f}`, grid: drawStanding(pose) }));
  const squash = drawSquash();
  // Knocked (GDD-ENM-02): flipped onto its back, legs up, X eyes; the frame turned over and moved down onto the box.
  const up = drawStanding({ eyes: 'x', claw: 'open', legs: ['push', 'push'], relit: true });
  const hit = new Grid(FRAME.w, FRAME.h);
  for (let y = 0; y < FRAME.h; y++) for (let x = 0; x < FRAME.w; x++) hit.set(x, FRAME.h - 1 - y + 6, up.get(x, y));
  frames.push({ look: 'squash', grid: squash }, { look: 'hit', grid: hit });
  return frames;
}
