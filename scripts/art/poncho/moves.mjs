// Poncho's movement poses (GDD-ART-04, GDD-ART-02, GDD-ART-05), built with his pose rig (rig.mjs) from the user's drawing:
// the idle with a blink and a glance at the taco, the jump (take-off, rising), the apex, the fall (and the fast fall), the
// landing squash, the skid and the eight frames of the respawn flip. Review sheet:
//   node scripts/art/poncho/preview.mjs moves <out.png> --box
// Only the legs below are newly drawn (in the drawing's colours, widths and outline, like the run legs); everything else is the
// drawing's own pixels, moved, squashed or turned by the rig.
import { clean, LEGS, pose, POSE_FRAME, rotated, STANDING } from './rig.mjs';
import { Grid } from '../raster.mjs';

export { POSE_FRAME };

// The two rows under the hem (the fringe's tassels and the legs' tops) as the drawing has them; every leg set below starts
// with them so the hem meets the legs as it does standing.
const [HEM0, HEM1] = LEGS.stand.rows;
/**
 * A leg set from the rows under the hem: 42-wide rows of drawing columns 8 to 49 in the drawing's colour letters, padded to its
 * 56. Like the run legs they leave out their outline, which the rig draws round them; the row under the feet is its outline.
 */
function legRows(rows, { hemDx = 0 } = {}) {
  rows.forEach((r) => { if (r.length !== 42) throw new Error(`leg row ${r.length} wide: ${r}`); });
  const padded = rows.map((r) => `........${r}......`);
  const sole = [...padded.at(-1)].map((ch) => (ch === '.' ? '.' : '#')).join('');
  // The hem's tassels follow the poncho when the body moves against the legs.
  const hem = (row) => (hemDx < 0 ? row.slice(-hemDx) + '.'.repeat(-hemDx) : '.'.repeat(hemDx) + row.slice(0, row.length - hemDx));
  return [hem(HEM0), hem(HEM1), ...padded, sole];
}

/** The legs pushing off (the take-off): the standing legs straightened, the shins two rows longer, the feet still flat down. */
const PUSH = legRows([
  '............FFffffffF...ccFFFFF...........',
  '............FFffffffF...cFFFFFF...........',
  '............FFffffffF...FFFFFFF...........',
  '............FFfFFFFFn...cFFFFFc...........',
  '............FFFwwwwww...FFFFpppp..........',
  '............ppwwwFwwFw..ppppppFpp.........',
  '............pppwwcwwcw..ppppppcpc.........',
]);

/** Tucked up under the poncho (rising, the apex): the knees drawn up and forward, the soles turned down, their pads showing. */
const TUCK = legRows([
  '.............FFffffffF...cFFFFFF..........',
  '.............pFFFFFFFF...pFFFFFFF.........',
  '.............wwpwwpwwp...ppwppwpp.........',
]);

/** Reaching down for the ground (the fall): the legs long and a little apart, the feet hanging, toes down. */
const REACH = legRows([
  '...........FFffffffF.....ccFFFFF..........',
  '...........FFffffffF.....cFFFFFF..........',
  '...........FFffffffF.....FFFFFFF..........',
  '...........FFfFFFFFn.....cFFFFFc..........',
  '...........pFFwwwwwF.....pFFFppp..........',
  '...........ppwwwwwwF.....ppppppF..........',
  '............pwwFwwF.......pppppp..........',
  '............pwwcwwc.......ppcppc..........',
]);

/** How far the skid leans his body back over his braced legs. */
const SKID_LEAN = -2;
/** Braced ahead (the skid): both legs slanting forward, the heels dug in. */
const BRACE = legRows([
  '............FFffffffF...ccFFFFF...........',
  '.............FFfffffFF...cFFFFFFF.........',
  '..............FFwwwwwwF...FFFFFpppp.......',
  '..............ppwwwFwwFw...pppppppFpp.....',
  '..............pppwwcwwcw...pppppppcpc.....',
], { hemDx: SKID_LEAN });

/** Where the game draws a held taco or chile: in front of his chest, where the illustration holds the taco. */
const HAND = { dx: 0, dy: -3 };

/** The tail streaming up as he falls; in the fast fall straighter and higher. */
const FALL_TAIL = { path: [[22, 65], [14, 67], [8, 64], [4, 58], [2, 51], [-1, 45]], tip: [-1.4, 44.6] };
const FAST_TAIL = { path: [[22, 65], [14, 67], [8, 63], [4, 57], [2, 49], [0, 43]], tip: [-0.3, 42.5] };

const SPECS = {
  idle: { ...STANDING, hand: HAND },
  blink: { face: 'blink', hand: HAND },
  // A look down at the taco in his paw, the head nodding a px to it.
  glance: { face: 'glance', head: { dy: 1 }, hand: HAND },
  // The take-off: stretched three rows and a column thinner, the legs pushing, the tail swept low, the hat lagging a px low.
  jump0: { body: { squash: -3, widen: -1 }, hat: { dy: 1 }, legs: { rows: PUSH }, tail: 'low', hand: { dx: HAND.dx, dy: HAND.dy + 1 } }, // the paw lags a px low
  // Rising: still a little stretched, the legs tucking, the tail trailing, the ears and the hat up.
  jump1: { y: -3, body: { squash: -1 }, head: { dy: -1 }, hat: { dy: -1 }, legs: { rows: TUCK, lift: 0 }, tail: 'back', hand: HAND },
  // The float at the top: neutral, tucked, the tail curling up, the hat settled.
  apex: { y: -3, legs: { rows: TUCK, lift: 0 }, tail: 'up', hand: HAND },
  // Falling: the legs reach down, the hat lifted off his head (air under it), the tail streaming up; the fast fall lifts the hat
  // higher and stretches him two rows.
  fall0: { hat: { dy: -2 }, legs: { rows: REACH }, tail: FALL_TAIL, hand: HAND },
  fall1: { body: { squash: -2, widen: -1 }, hat: { dy: -3 }, legs: { rows: REACH }, tail: FAST_TAIL, hand: HAND },
  // The landing squash: four rows shorter and three columns wider, the legs splayed, the hat pressed down, the tail low.
  land: { body: { squash: 4, widen: 3 }, hat: { dy: 1 }, legs: 'splay', tail: 'low', hand: HAND },
  // The skid: leaning back against the run (the hat tipped back with him, sliding a px forward on his head), the legs braced
  // ahead, the tail flung forward over his back.
  skid: {
    body: { dx: SKID_LEAN }, head: { dx: -2 }, hat: { dx: 1, tilt: -8 }, legs: { rows: BRACE },
    tail: { path: [[22, 65], [14, 66], [6, 62], [2, 54], [2, 45], [7, 38]], tip: [7.5, 37.8] }, hand: HAND,
  },
};

/** The ball he tucks into for the respawn flip: legs tucked, the tail wrapped round, eyes squeezed shut in a happy grin. */
const BALL = {
  body: { squash: 4 }, hat: { tilt: 8 }, legs: { rows: TUCK, lift: 0 }, face: 'happy',
  tail: { path: [[22, 65], [15, 67], [10, 64], [8, 58], [9, 51], [12, 46]], tip: [11.6, 46] },
};
/** The flip's pivot (frame px) and where the ball is placed so every turn fits the frame. */
const FLIP = { x: 0, y: -6, pivot: [50, 56] };

export const LOOKS = [...Object.keys(SPECS), ...Array.from({ length: 8 }, (_, i) => `flip${i}`)];

export function drawFrames() {
  const frames = Object.entries(SPECS).map(([look, spec]) => {
    const grid = pose(spec);
    return { look, grid, hand: grid.hand, holds: 'paw' };
  });
  const ball = pose({ ...BALL, x: FLIP.x, y: FLIP.y });
  for (let i = 0; i < 8; i++) {
    const grid = i ? rotated(ball, i * 45, { pivot: FLIP.pivot }) : clean(copy(ball));
    // Nothing held is drawn in the flip; the anchor turns with him all the same.
    const a = (i * Math.PI) / 4, [px, py] = FLIP.pivot, dx = ball.hand.x + 0.5 - px, dy = ball.hand.y + 0.5 - py;
    grid.hand = { x: Math.floor(px + dx * Math.cos(a) - dy * Math.sin(a)), y: Math.floor(py + dx * Math.sin(a) + dy * Math.cos(a)) };
    frames.push({ look: `flip${i}`, grid, hand: grid.hand, holds: 'none' });
  }
  return frames;
}

function copy(g) {
  const out = new Grid(g.width, g.height);
  for (let y = 0; y < g.height; y++) for (let x = 0; x < g.width; x++) out.set(x, y, g.get(x, y));
  out.hand = g.hand;
  out.anchors = g.anchors;
  return out;
}

