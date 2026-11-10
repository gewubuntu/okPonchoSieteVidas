// La Estrella de Siete Picos, World 2's boss (GDD-BOS-03), her tejocotes, her trolley and her rope, drawn in code like Don Zopilote
// (scripts/art/boss.mjs, GDD-ART-01) from the design the user approved (assets/characters/la-estrella/). A posada star piñata on a clay
// pot, on a grid of drawing pixels, each 2 x 2 art pixels (half a game pixel), outlined (GDD-ART-05), in World 2's colours only
// (GDD-ART-06) plus the outline and the flash reds. scripts/art/estrella.test.mjs pins every frame to the approved drawing.
import { ellipse, Grid, polygon, stroke } from './raster.mjs';
import { FLASH, OUTLINE, paste, scaled, shaded, W2 } from './enemies2/kit.mjs';

/** A frame: 144 x 144 drawing px (72 x 72 game px, 288 x 288 art px). Her box's middle is the frame's middle. */
export const FRAME = { w: 144, h: 144 };
/** Her 32 x 32 game px box (the clay pot) in drawing px: columns 40..103, rows 40..103. */
export const BOX = { x0: 40, y0: 40, x1: 104, y1: 104 };
const [CX, CY] = [72, 72];
/** ESTRELLA.coneTip, 28 game px, in drawing px. */
const TIP = 56;
/** Cone order (GDD-BOS-03): 0 points up, the rest clockwise; torn bottom first, the three pale ones last. */
export const TEAR_ORDER = [3, 4, 2, 5, 1, 6, 0];
export const PALE = [0, 1, 6];
/** Cones left after each hit (ESTRELLA.cones). */
export const CONES_LEFT = [7, 5, 3, 0];

// Materials [light, base, shadow], light from the upper left (GDD-ART-05).
const CLAY = [W2.tejaLit, W2.teja, W2.tejaDark];
const PAPER = {
  rosa: [W2.plaster, W2.rosa, W2.tejaDark],
  teal: [W2.teal, W2.teal, W2.cobalt],
  yellow: [W2.glaze, W2.yellow, W2.tejaLit],
  cobalt: [W2.far, W2.cobalt, W2.iron],
  pale: [W2.glaze, W2.glaze, W2.midOchre],
};
/** Each cone's paper, symmetric about the top cone. */
const CONE_PAPER = ['rosa', 'teal', 'yellow', 'cobalt', 'cobalt', 'yellow', 'teal'];
/** Each cone's three streamer strands (left, middle, right). */
const STRANDS = {
  rosa: [W2.yellow, W2.glaze, W2.teal],
  teal: [W2.rosa, W2.glaze, W2.yellow],
  yellow: [W2.teal, W2.glaze, W2.rosa],
  cobalt: [W2.yellow, W2.glaze, W2.rosa],
};

const norm = ([x, y]) => {
  const l = Math.hypot(x, y) || 1;
  return [x / l, y / l];
};
const rot = ([x, y], a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
const coneDir = (i) => [Math.sin((2 * Math.PI * i) / 7), -Math.cos((2 * Math.PI * i) / 7)];

/** Paints `test` with `mat` on its own layer, then lays it over `g`, drawing `ring` on what it covers all round it (an inner outline). */
function layer(g, test, mat, { ring = OUTLINE, ...opt } = {}) {
  const l = new Grid(g.width, g.height);
  shaded(l, test, mat, opt);
  if (ring) {
    for (let y = 0; y < g.height; y++) for (let x = 0; x < g.width; x++) {
      if (!l.get(x, y)) continue;
      for (const [dx, dy] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
        const c = g.get(x + dx, y + dy);
        if (c && c !== OUTLINE && !l.get(x + dx, y + dy)) g.set(x + dx, y + dy, ring);
      }
    }
  }
  for (let i = 0; i < l.cells.length; i++) if (l.cells[i]) g.cells[i] = l.cells[i];
  return l;
}

// ---------------------------------------------------------------- the cones

/**
 * One paper cone on its own grid: from under the pot out to `tipR` along `u` (unit), centre (cx, cy). The lit half faces the upper left.
 * `torn`: only the ragged stub left by a tear, a paper rim just past the pot. `crumple`: the bottom cones splayed flat by a thud.
 */
function drawCone(i, { u, cx = CX, cy = CY, tipR = TIP, torn = false, crumple = false }) {
  const g = new Grid(FRAME.w, FRAME.h);
  const n = [-u[1], u[0]]; // across the cone
  const paper = PAPER[CONE_PAPER[i]];
  const pale = PALE.includes(i);
  const base = 18, hwBase = 16;
  const tri = (v) => Math.abs((((v % 2) + 2) % 2) - 1); // 0..1..0, period 2
  const cut = (a) => 33 + 3.5 * tri(a / 2.6); // the torn rim, ragged, about 31 to 34 px out
  const coords = (x, y) => {
    const vx = x - cx, vy = y - cy;
    return [vx * u[0] + vy * u[1], vx * n[0] + vy * n[1]];
  };
  const inside = (x, y) => {
    const [along, across] = coords(x, y);
    if (along < base - 4 || along > tipR) return false;
    let hw = (hwBase * (tipR - along)) / (tipR - base);
    if (crumple) hw *= 1 + 0.22 * Math.sin(along * 0.8);
    if (Math.abs(across) > hw) return false;
    return !(torn && along > cut(across));
  };
  shaded(g, inside, paper, { lightDepth: 1, darkDepth: 2 });
  for (let y = 0; y < g.height; y++) for (let x = 0; x < g.width; x++) {
    const c = g.get(x, y);
    if (!c) continue;
    const [along, across] = coords(x + 0.5, y + 0.5);
    const edge = c !== paper[1];
    // The crepe paper's fringed layers: two zigzag bands across the cone.
    if (!torn && !edge && [33, 42].some((k) => Math.abs(along - k - 1.2 * tri(across / 2)) < 0.8)) g.set(x, y, paper[2]);
    if (pale && !torn && along > tipR - 12.5) g.set(x, y, c === paper[2] ? PAPER.pale[2] : PAPER.pale[1]);
    // The torn rim: the paper's dark inside showing along the tear.
    if (torn && along > cut(across) - 1.5) g.set(x, y, Math.abs(across) < 3.5 && along > cut(across) - 0.8 ? W2.iron : paper[2]);
  }
  return g;
}

/** A streamer tassel at a tip: three strands of tissue fringe, each a short curve from the tip, bent by `wind` (x, y). */
function drawTassel(g, tip, u, wind, strands, { len = 9, spread = 0.95, mid = 5 } = {}) {
  [-1, 0, 1].forEach((k, s) => {
    const f = rot(u, k * spread);
    const d = norm([f[0] + wind[0], f[1] + wind[1]]);
    const L = k === 0 ? mid : len;
    const p1 = [tip[0] + f[0] * 2.5, tip[1] + f[1] * 2.5];
    const p2 = [p1[0] + d[0] * (L - 2.5), p1[1] + d[1] * (L - 2.5)];
    g.fill(stroke([[tip[0] - u[0], tip[1] - u[1]], p1, p2], 1.9), strands[s]);
  });
}

// ---------------------------------------------------------------- the pot

const lerp = (a, b, t) => a + (b - a) * t;

/**
 * The clay pot on `g`, through `toLocal` (world drawing px -> the upright pot's own px, centre (72, 75)): its body, neck and lip in
 * terracotta, the painted talavera band, the two cut-out eyes and the cracks. Returns the eye pixels (kept dark through a flash).
 */
function drawPot(g, toLocal, { eyes = 'neutral', crack = 0, clip = null } = {}) {
  const T = (test) => (x, y) => (clip && !clip(x, y) ? false : test(...toLocal(x, y)));
  const body = ellipse(72, 75, 29.5, 28);
  const neck = polygon([[62.5, 52], [63.5, 45], [80.5, 45], [81.5, 52]]);
  const lip = ellipse(72, 44.6, 12.4, 3.6);
  const mouth = ellipse(72, 44.1, 8.4, 1.6);
  const pot = (x, y) => body(x, y) || neck(x, y) || lip(x, y);
  layer(g, T(pot), CLAY, { lightDepth: 3, darkDepth: 5 });
  // The neck's shadow under the lip and the lip itself.
  shaded(g, T(lip), [W2.tejaLit, W2.tejaLit, W2.teja], { lightDepth: 1, darkDepth: 1 });
  g.fill(T(mouth), W2.iron);
  g.fill(T((x, y) => neck(x, y) && y < 48.5 && !lip(x, y)), W2.tejaDark, true);

  // The band, painted round the belly: it bows down in the middle, as round a ball seen from a little above.
  const bandTop = (x) => 81 + 4.5 * Math.sqrt(Math.max(0, 1 - ((x - 72) / 29.5) ** 2));
  const inShadow = (x, y) => !body(x + 4, y + 4); // the pot's own shadow side
  for (let y = 0; y < g.height; y++) for (let x = 0; x < g.width; x++) {
    const [lx, ly] = toLocal(x + 0.5, y + 0.5);
    if (clip && !clip(x + 0.5, y + 0.5)) continue;
    if (!body(lx, ly)) continue;
    const t = ly - bandTop(lx);
    if (t < 0 || t >= 8) continue;
    const dark = inShadow(lx, ly);
    let c = t < 1 || t >= 7 ? (dark ? W2.tejaLit : W2.yellow) : dark ? W2.iron : W2.cobalt;
    // Glaze dots on the cobalt, every 7 px round.
    const ft = Math.floor(t), ph = ((Math.floor(lx) - 69) % 7 + 7) % 7;
    if ((ft === 3 || ft === 4) && ph < 2 && Math.abs(lx - 72) < 26) c = dark ? W2.far : W2.glaze;
    g.set(x, y, c);
  }

  // Cracks: hairlines of iron with a lit lower lip, more with each hit (0, 1, 2), split open when she is broken (3).
  const CRACKS = [
    [[66.5, 49], [64.5, 52.5], [66.5, 55.5], [63.5, 58.5], [64.5, 61]],
    [[90.5, 98], [87.5, 94], [90.5, 89.5], [88.5, 85], [91.5, 80.5], [89.5, 76.5]],
    [[87.5, 94], [83, 97.5]],
    [[72.5, 51.5], [74.5, 56], [71.5, 60], [73.5, 64], [70.5, 70], [73.5, 76], [71.5, 81], [74.5, 90], [72.5, 101]],
    [[49.5, 68], [53.5, 71], [51.5, 75], [55.5, 79]],
  ];
  const lines = crack >= 3 ? CRACKS : crack === 2 ? CRACKS.slice(0, 3) : crack === 1 ? CRACKS.slice(0, 1) : [];
  for (const l of lines) {
    const t = T(stroke(l, crack >= 3 && l === CRACKS[3] ? 1.6 : 1.0));
    for (let y = 0; y < g.height; y++) for (let x = 0; x < g.width; x++) {
      if (!t(x + 0.5, y + 0.5) || !g.get(x, y) || g.get(x, y) === OUTLINE) continue;
      g.set(x, y, W2.iron);
      const c = g.get(x + 1, y + 1);
      if (c === W2.teja || c === W2.tejaDark) g.set(x + 1, y + 1, W2.tejaLit);
    }
  }
  if (crack >= 3) {
    // A shard broken out of her shoulder: the dark hollow inside.
    const chip = T(polygon([[82, 50], [91, 53.5], [89, 59], [84, 58.5], [83.5, 55]]));
    g.fill(chip, W2.iron, true);
  }

  // The eyes, cut into the clay: dark holes with a shadowed top and a lit lower lip; a curse-light pupil that glances.
  const eyeKeep = [];
  for (const [ex, side] of [[61, -1], [83, 1]]) {
    const ey = 66.5;
    let hole;
    let pupil = null;
    if (eyes === 'squint') {
      // Squeezed shut in pain: '>' and '<'.
      const s = -side;
      hole = stroke([[ex - 3.5 * s, ey - 3], [ex + 3 * s, ey], [ex - 3.5 * s, ey + 3]], 2.1);
    } else if (eyes === 'x') {
      hole = (x, y) => stroke([[ex - 3.5, ey - 3.5], [ex + 3.5, ey + 3.5]], 2.2)(x, y) || stroke([[ex + 3.5, ey - 3.5], [ex - 3.5, ey + 3.5]], 2.2)(x, y);
    } else if (eyes === 'wide') {
      hole = ellipse(ex, ey, 5, 4.6);
      pupil = [ex - 1, ey];
    } else {
      // An almond, its top slanting down towards the middle: wary, a little menacing.
      const e = ellipse(ex, ey + 0.3, 5.8, 3.8);
      hole = (x, y) => e(x, y) && y > ey - 2.7 + 0.42 * side * -(x - ex);
      const look = eyes === 'left' ? -2.6 : eyes === 'right' ? 2.2 : -0.2;
      pupil = [ex + look - 1, ey + 0.2];
    }
    const H = T(hole);
    const cells = [];
    for (let y = 0; y < g.height; y++) for (let x = 0; x < g.width; x++) if (H(x + 0.5, y + 0.5) && g.get(x, y)) cells.push([x, y]);
    const isHole = (x, y) => cells.some(([a, b]) => a === x && b === y);
    for (const [x, y] of cells) {
      // The lip of the cut: lit below the hole, in shadow above it.
      if (!isHole(x, y + 1) && g.get(x, y + 1) && !isHole(x, y + 2)) g.set(x, y + 1, W2.tejaLit);
      if (!isHole(x, y - 1) && g.get(x, y - 1)) g.set(x, y - 1, W2.tejaDark);
    }
    for (const [x, y] of cells) {
      g.set(x, y, isHole(x, y - 1) ? W2.iron : OUTLINE);
      eyeKeep.push([x, y]);
    }
    if (pupil) {
      // 2 x 2 drawing px: one game px of glow.
      const [px0, py0] = toLocalInverse(toLocal, pupil[0], pupil[1], g, H);
      if (px0 !== null) {
        for (const [dx, dy, c] of [[0, 0, W2.glaze], [1, 0, W2.yellow], [0, 1, W2.yellow], [1, 1, W2.yellow]]) {
          if (isHole(px0 + dx, py0 + dy)) {
            g.set(px0 + dx, py0 + dy, c);
            eyeKeep.push([px0 + dx, py0 + dy]);
          }
        }
      }
    }
  }
  return eyeKeep;
}

/** The world pixel whose centre maps nearest to the local point (lx, ly), among those passing `inside`. */
function toLocalInverse(toLocal, lx, ly, g, inside) {
  let best = null, bd = Infinity;
  for (let y = 0; y < g.height; y++) for (let x = 0; x < g.width; x++) {
    const [a, b] = toLocal(x + 0.5, y + 0.5);
    const d = (a - lx - 0.5) ** 2 + (b - ly - 0.5) ** 2;
    if (d < bd && inside(x + 0.5, y + 0.5)) [bd, best] = [d, [x, y]];
  }
  return best ?? [null, null];
}

// ---------------------------------------------------------------- the whole star

/** The streamers' wind per look: where the tassels blow. */
const WIND = {
  still: () => [0, 0.85],
  glide: () => [-1.5, 0.45], // moving right: they trail left
  drop: () => [0, -1.8], // falling fast: they fly up
  up: () => [0, 1.8], // thrown or yanked up: they stream down
  swayL: () => [-0.9, 0.9],
  swayR: () => [0.9, 0.9],
};

/**
 * The star: her `hits` decide the cones left and the cracks. Options: eyes, wind (a key of WIND), squash (the thud's squash),
 * splay (the bottom cones splayed flat on a surface), rope (the knot of rope on the top cone's tip).
 */
function drawStar({ hits = 0, eyes = 'neutral', wind = 'still', squash = false, splay = false, crack = null } = {}) {
  const g = new Grid(FRAME.w, FRAME.h);
  const kept = TEAR_ORDER.slice(7 - CONES_LEFT[Math.min(hits, 3)]);
  const sq = squash ? { sx: 31.5 / 29.5, sy: 25.5 / 28 } : { sx: 1, sy: 1 };
  // The squash keeps her bottom on the box's bottom (row 103) and widens her 2 px each side.
  const toLocal = (x, y) => [72 + (x - 72) / sq.sx, 103 - (103 - y) / sq.sy];
  const cy = squash ? CY + 2.5 : CY;
  const cones = [];
  for (let i = 0; i < 7; i++) {
    let u = coneDir(i), tipR = TIP, crumple = false;
    if (splay && (i === 3 || i === 4)) {
      // Splayed by the thud: swung out to the sides and crushed short, so nothing reaches below her box.
      u = coneDir(i === 3 ? 2.36 : 7 - 2.36);
      tipR = 43;
      crumple = true;
    }
    cones.push({ i, u, tipR, crumple, torn: !kept.includes(i) });
  }
  // Streamers first (behind the cones), then the cones, side cones over bottom ones, then the pot over them all.
  const w = WIND[wind]();
  for (const c of cones) {
    if (c.torn) continue;
    const tip = [CX + c.u[0] * (c.tipR - 1), cy + c.u[1] * (c.tipR - 1)];
    let cw = w;
    if (splay && (c.i === 3 || c.i === 4)) cw = [Math.sign(c.u[0]) * 1.6, -1.1]; // lying out along the surface
    else if (splay && (c.i === 2 || c.i === 5)) cw = [Math.sign(c.u[0]) * 1.2, -0.3];
    drawTassel(g, tip, c.u, cw, STRANDS[CONE_PAPER[c.i]]);
  }
  const order = [3, 4, 2, 5, 1, 6, 0];
  for (const i of order) {
    const c = cones[i];
    const cg = drawCone(i, { u: c.u, cy, tipR: c.tipR, torn: c.torn, crumple: c.crumple });
    // Lay it on with an inner outline round it.
    const l = new Grid(FRAME.w, FRAME.h);
    paste(l, cg, 0, 0);
    for (let y = 0; y < g.height; y++) for (let x = 0; x < g.width; x++) {
      if (!l.get(x, y)) continue;
      for (const [dx, dy] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
        const v = g.get(x + dx, y + dy);
        if (v && v !== OUTLINE && !l.get(x + dx, y + dy)) g.set(x + dx, y + dy, OUTLINE);
      }
    }
    paste(g, l, 0, 0);
  }
  const keep = drawPot(g, toLocal, { eyes, crack: crack ?? hits });
  g.outline(OUTLINE, 1);
  return { grid: g, keep };
}

/** The defeated pot: no rope, all seven cones torn, X eyes, broken. Lying: toppled onto its side on the floor, its neck to the right. */
function drawBroken({ lying = false } = {}) {
  const g = new Grid(FRAME.w, FRAME.h);
  // Lying: the upright pot turned a quarter clockwise about its centre, its centre put at (66, 73.5) so it rests on row 103.
  const [wx, wy] = lying ? [66, 73.5] : [72, 75];
  const toLocal = lying ? (x, y) => [72 + (y - wy), 75 - (x - wx)] : (x, y) => [x, y];
  const clip = lying ? (x, y) => y < 103 : null; // its stubs squashed flat under it: nothing below the floor
  for (const i of [3, 4, 2, 5, 1, 6, 0]) {
    const u0 = coneDir(i);
    // The stubs, in the pot's own frame (centre 72, 72 upright), carried round with it.
    const cg = drawCone(i, { u: u0, torn: true });
    const l = new Grid(FRAME.w, FRAME.h);
    for (let y = 0; y < g.height; y++) for (let x = 0; x < g.width; x++) {
      if (clip && !clip(x + 0.5, y + 0.5)) continue;
      const [lx, ly] = toLocal(x + 0.5, y + 0.5);
      const v = cg.get(Math.floor(lx), Math.floor(ly));
      if (v) l.set(x, y, v);
    }
    paste(g, l, 0, 0);
  }
  const keep = drawPot(g, toLocal, { eyes: 'x', crack: 3, clip });
  g.outline(OUTLINE, 1);
  // Lying, nothing is on row 104: the `y < 103` clip above already keeps the pot and its stubs off it, and so off its outline (L-025).
  return { grid: g, keep };
}

/** The flash (GDD-BOS-01, GDD-ENM-01): every pixel but the outline and her eye holes in `colour`, the shadows in `shade`. */
const DARKS = [W2.iron, W2.tejaDark, W2.cobalt, W2.street, W2.teja];
function flashed({ grid, keep }, { colour, shade }) {
  const g = new Grid(grid.width, grid.height);
  grid.cells.forEach((c, i) => {
    if (c) g.cells[i] = c === OUTLINE ? OUTLINE : DARKS.includes(c) ? shade : colour;
  });
  for (const [x, y] of keep) g.set(x, y, grid.get(x, y));
  return g;
}
/** The white flash of a hit: World 2's glaze white, its shadows the far town's pale lilac. */
const WHITE = { colour: W2.glaze, shade: W2.farLit };

/** Every look, by name, at `hits` hits taken (0, 1, 2): the cones and cracks follow the hits. */
export const LOOKS = [
  'glide', 'telegraphL', 'telegraphLRed', 'telegraphR', 'telegraphRRed', 'drop', 'land', 'bounce', 'rest', 'rise', 'hangL', 'hangR', 'yank', 'hurt', 'hurtWhite',
];
export const DEFEAT_LOOKS = ['fall', 'fallWhite', 'lie', 'lieWhite'];

export function drawLook(look, hits = 0) {
  switch (look) {
    case 'glide': return drawStar({ hits, eyes: 'right', wind: 'glide' }).grid;
    case 'telegraphL': return drawStar({ hits, eyes: 'left', wind: 'still' }).grid;
    case 'telegraphR': return drawStar({ hits, eyes: 'right', wind: 'still' }).grid;
    case 'telegraphLRed': return flashed(drawStar({ hits, eyes: 'left', wind: 'still' }), FLASH);
    case 'telegraphRRed': return flashed(drawStar({ hits, eyes: 'right', wind: 'still' }), FLASH);
    case 'drop': return drawStar({ hits, eyes: 'wide', wind: 'drop' }).grid;
    case 'land': return drawStar({ hits, eyes: 'squint', wind: 'still', squash: true, splay: true }).grid;
    case 'bounce': return drawStar({ hits, eyes: 'wide', wind: 'up', splay: true }).grid;
    case 'rest': return drawStar({ hits, eyes: 'neutral', wind: 'still', splay: true }).grid;
    case 'rise': return drawStar({ hits, eyes: 'neutral', wind: 'up', splay: true }).grid;
    case 'hangL': return drawStar({ hits, eyes: 'left', wind: 'swayL' }).grid;
    case 'hangR': return drawStar({ hits, eyes: 'right', wind: 'swayR' }).grid;
    case 'yank': return drawStar({ hits, eyes: 'wide', wind: 'up' }).grid;
    case 'hurt': return drawStar({ hits, eyes: 'squint', wind: 'still' }).grid;
    case 'hurtWhite': return flashed(drawStar({ hits, eyes: 'squint', wind: 'still' }), WHITE);
    case 'fall': return drawBroken().grid;
    case 'fallWhite': return flashed(drawBroken(), WHITE);
    case 'lie': return drawBroken({ lying: true }).grid;
    case 'lieWhite': return flashed(drawBroken({ lying: true }), WHITE);
    default: throw new Error(`no look ${look}`);
  }
}

/** Extra looks for the canvas: one eye state on the hang pose, and the star at each cone count. */
export const drawEyes = (eyes, hits = 0) => drawStar({ hits, eyes, wind: 'still' }).grid;
export const drawAtHits = (hits) => (hits >= 3 ? drawBroken().grid : drawStar({ hits, eyes: hits ? 'squint' : 'neutral', wind: 'still' }).grid);

/** How far a frame reaches past her box, in game px: above, below, left, right (0 when inside). */
export function reach(grid) {
  let [x0, y0, x1, y1] = [Infinity, Infinity, -1, -1];
  for (let y = 0; y < grid.height; y++) for (let x = 0; x < grid.width; x++) if (grid.get(x, y)) {
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
  }
  const g = (v) => Math.max(0, v) / 2;
  return { above: g(BOX.y0 - y0), below: g(y1 + 1 - BOX.y1), left: g(BOX.x0 - x0), right: g(x1 + 1 - BOX.x1), edge: x0 === 0 || y0 === 0 || x1 === grid.width - 1 || y1 === grid.height - 1 };
}

// ---------------------------------------------------------------- tejocotes, trolley, rope, cable

/** A tejocote (GDD-BOS-03): 8 x 8 game px = 16 x 16 drawing px, the fruit filling its box. Rolling: 4 frames, the calyx turning. */
export function drawTejocote(frame = 0) {
  const g = new Grid(16, 16);
  shaded(g, ellipse(8, 8, 7, 7), [W2.yellow, W2.tejaLit, W2.teja], { lightDepth: 2, darkDepth: 2 });
  // A pale glint on the upper left (the hazard's pale edge, GDD-ART-05), fixed: the light does not roll.
  for (const [x, y] of [[4, 3], [5, 3], [3, 4], [3, 5]]) g.set(x, y, W2.glaze);
  // The dried calyx, a dark four-point star, carried round as it rolls (a quarter turn a frame).
  const a = (frame * Math.PI) / 2 + 0.35;
  const [cx, cy] = [8 + Math.cos(a) * 4.2, 8 + Math.sin(a) * 4.2];
  const fx = Math.floor(cx), fy = Math.floor(cy);
  for (const [dx, dy, c] of [[0, 0, W2.iron], [1, 0, W2.iron], [0, 1, W2.iron], [1, 1, W2.wood], [-1, 0, W2.wood], [0, -1, W2.wood], [2, 1, W2.wood], [1, 2, W2.wood]]) {
    if (g.get(fx + dx, fy + dy)) g.set(fx + dx, fy + dy, c);
  }
  // Its outline goes inside the 16 x 16 box: the fruit is 14 px across.
  const o = new Grid(16, 16);
  paste(o, g, 0, 0);
  o.outline(OUTLINE, 1);
  return o;
}

/**
 * The trolley (scenery): an iron pulley riding on top of the cable, its fork coming down past the cable to an eye for the rope.
 * 16 x 16 game px = 32 x 32 drawing px; the cable's middle on row 16 (y = 8 when the frame's top is at y = 0); the rope's eye's
 * bottom at row 23. `turn` 0 or 1: the spokes, turned an eighth while it rolls.
 */
export function drawTrolley(turn = 0) {
  const g = new Grid(32, 32);
  const [wx, wy] = [16, 10];
  // The fork's two plates, behind the wheel, from its axle down past the cable.
  g.fill(polygon([[13, 8], [19, 8], [18.5, 22], [13.5, 22]]), W2.street);
  g.fill(polygon([[14.5, 8], [15.5, 8], [15.5, 21], [14.5, 21]]), W2.farShade);
  shaded(g, ellipse(wx, wy, 7.2, 7.2), [W2.farShade, W2.street, W2.iron], { lightDepth: 1, darkDepth: 2 });
  // The groove the cable runs in, and the spokes.
  g.fill(ellipse(wx, wy, 4.6, 4.6), W2.iron);
  for (let k = 0; k < 4; k++) {
    const a = (k * Math.PI) / 2 + (turn * Math.PI) / 4;
    g.fill(stroke([[wx + 0.5, wy + 0.5], [wx + 0.5 + Math.cos(a) * 4, wy + 0.5 + Math.sin(a) * 4]], 1.2), W2.street);
  }
  g.fill(ellipse(wx + 0.5, wy + 0.5, 1.6, 1.6), W2.farLit); // the axle's bolt
  // The eye the rope is tied to, below the cable.
  const ring = ellipse(16, 21.5, 2.6, 2.2), hole = ellipse(16, 21.5, 1.1, 0.9);
  g.fill((x, y) => ring(x, y) && !hole(x, y), W2.street);
  g.fill(hole, null);
  return g;
}

/** The cable (scenery): twisted iron, 1 game px thick; a 16 game px tile (32 x 2 drawing px), its rows 15 and 16 of the trolley's frame. */
export function drawCable() {
  const g = new Grid(32, 2);
  for (let x = 0; x < 32; x++) {
    g.set(x, 0, x % 4 === 0 ? W2.farShade : W2.iron);
    g.set(x, 1, x % 4 === 2 ? W2.street : W2.iron);
  }
  return g;
}

/** Her rope (scenery): ixtle, 1 game px wide; a 4 drawing px tall tile that repeats down, twisted. */
export function drawRope() {
  const g = new Grid(2, 4);
  [[W2.midOchre, W2.wood], [W2.midOchre, W2.midOchre], [W2.wood, W2.midOchre], [W2.wood, W2.wood]].forEach(([a, b], y) => {
    g.set(0, y, a);
    g.set(1, y, b);
  });
  return g;
}

/** The colours she uses (the outline first). */
export function coloursUsed(grids) {
  const s = new Set();
  for (const g of grids) for (const c of g.cells) if (c) s.add(c);
  return [...s];
}

/** Sheet columns. */
export const COLUMNS = 8;
/**
 * Every frame in sheet order: [{ look, hits, grid }], the grid in drawing pixels, her box's middle at the frame's middle. Frame = hits *
 * LOOKS.length + the look's index in LOOKS for hits 0, 1, 2 (the cones and cracks follow the hits), then DEFEAT_LOOKS, hits 3, after them.
 */
export function estrellaFrames() {
  const frames = [];
  for (const hits of [0, 1, 2]) for (const look of LOOKS) frames.push({ look, hits, grid: drawLook(look, hits) });
  for (const look of DEFEAT_LOOKS) frames.push({ look, hits: 3, grid: drawLook(look, 3) });
  return frames;
}

/** The sheet in art pixels: COLUMNS frames across (8 x 7 frames of 288 x 288, 2304 x 2016, under the phone's texture limit, L-068). */
export function drawEstrellaSheet() {
  const frames = estrellaFrames();
  const rows = Math.ceil(frames.length / COLUMNS);
  const g = new Grid(FRAME.w * COLUMNS, FRAME.h * rows);
  frames.forEach((f, i) => paste(g, f.grid, (i % COLUMNS) * FRAME.w, Math.floor(i / COLUMNS) * FRAME.h));
  return scaled(g, 2);
}

/** `count` frames of `draw(k)`, side by side, each `size` drawing px wide, in art pixels. */
function strip(count, size, draw) {
  const g = new Grid(size.w * count, size.h);
  for (let k = 0; k < count; k++) paste(g, draw(k), k * size.w, 0);
  return scaled(g, 2);
}

/** The tejocote's four frames, the calyx a quarter turn on each (16 x 16 drawing px, 32 x 32 art px a frame). */
export const drawTejocoteSheet = () => strip(4, { w: 16, h: 16 }, drawTejocote);
/** The trolley's two frames, the spokes an eighth turn apart (32 x 32 drawing px, 64 x 64 art px a frame). */
export const drawTrolleySheet = () => strip(2, { w: 32, h: 32 }, drawTrolley);
/** The rope's tile in art pixels (4 x 8), repeated down from the trolley's eye to her top cone. */
export const drawRopeTile = () => scaled(drawRope(), 2);
/** The cable's tile in art pixels (64 x 4: 16 game px wide, 1 high), repeated across the arena at y = 8. */
export const drawCableTile = () => scaled(drawCable(), 2);
