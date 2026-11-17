// The taco and the chile, as pickups in the level and held in Poncho's paw, and the claw swipe (GDD-PWR-02, GDD-PWR-03, GDD-CMB-02,
// GDD-ART-04). Drawn in code (GDD-ART-01) on a grid of drawing pixels, each 2 x 2 art pixels (half a game pixel), in Poncho's 13
// colours and the few added here (GDD-ART-03), with the outline (GDD-ART-05) and the light from the upper left. Facing right.
import { Grid } from '../raster.mjs';
import { COLOURS } from '../poncho-pixels.mjs';

/** The colours the items add to Poncho's 13 (GDD-ART-03: at most 16 in all). */
export const ITEM_COLOURS = {
  g: '#9CCB4A', // leaf: the lettuce and the stems, lit
  G: '#4B8A34', // leafDark: their shade
};

/**
 * GDD-ART-03: the three colours the Chile Fantasma adds (the cap goes from 16 to 19 for it alone, user, 2026-11-10: "Raise the cap for it"),
 * used only by the pepper and the glow. Each is the median of the colour's pixels in the user's references
 * (assets/characters/poncho/fantasma/, measured 2026-11-10, L-072): `l`, the pepper's lavender-white, the body colour of all three frames of
 * pickup.jpg (about 3400 pixels within 10 of the cluster); `v`, its lavender shade, the shadow side of the same frames (about 1900 pixels);
 * `P`, the pale gold of the warning glow, the ring just outside the near-black outline of glow.jpg's fourth frame (x 785 to 1010, y 150 to 420).
 * The bright gold of the glow and of the pepper's outline is the victory frame's gold, `GOLD`.
 */
export const FANTASMA_COLOURS = {
  l: '#E4E9FC',
  v: '#BEC3F7',
  P: '#D3C193',
};

/** The gold of the glow and of the pepper's outline: Poncho's gold (GDD-ART-03), the same as `VICTORY_COLOURS.y` (a test compares them). */
export const GOLD = '#F9D24C';

const KEY = { ...COLOURS, ...ITEM_COLOURS, ...FANTASMA_COLOURS, y: GOLD };
const OUTLINE = COLOURS['#'];

/** Paints a map of rows (one character a pixel, '.' left as it is) with its top left at (ox, oy). */
function stamp(g, rows, ox, oy) {
  rows.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch !== '.') g.set(ox + x, oy + y, KEY[ch]);
  }));
}

/** `src` painted onto `dst` at (ox, oy); empty pixels leave `dst` as it is. */
function paste(dst, src, ox, oy) {
  for (let y = 0; y < src.height; y++) for (let x = 0; x < src.width; x++) {
    const c = src.get(x, y);
    if (c) dst.set(ox + x, oy + y, c);
  }
}

/** A map as rows: every row the same length, checked. */
function rows(lines) {
  const w = lines[0].length;
  lines.forEach((l, i) => { if (l.length !== w) throw new Error(`row ${i} is ${l.length} wide, not ${w}: ${l}`); });
  return lines;
}

/**
 * A folded hard-shell taco seen side on and tipped up to the front (the illustration's, reference.jpg): a golden half-moon of a shell
 * whose top edge is the rim, the fillings heaped above it. `spans` per row are the shell's [from, to] columns. The shell is shaded by
 * its shape (GDD-ART-05): the rim, lit from above, cream; the fur colour; the shade 2 px deep along the lower right, the dark fur on
 * its very edge there.
 */
function shell(w, h, spans) {
  const isS = (x, y) => (spans[y] ?? []).some(([a, b]) => x >= a && x <= b);
  const out = Array.from({ length: h }, () => Array(w).fill('.'));
  const edge = (x, y, d) => !isS(x + d, y + d) || !isS(x, y + d) || !isS(x + d, y);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!isS(x, y)) continue;
    let c = 'f';
    if (edge(x, y, 2)) c = 's';
    if (edge(x, y, 1)) c = x > w * 0.45 ? 'F' : 's';
    if (!isS(x, y - 1)) c = 'w';
    out[y][x] = c;
  }
  return out;
}

function overlay(base, top) {
  return base.map((row, y) => row.map((ch, x) => (top[y]?.[x] && top[y][x] !== '.' ? top[y][x] : ch)).join(''));
}

// ---- The taco pickup: 22 x 20 drawing px (11 x 10 game px), in a 32 x 32 frame (16 x 16 game px). -----------------------------

// The shell: a half moon tipped up to the front, its rim a clean 2:1 line from the lower left to the upper right.
const TACO_SPANS = {
  3: [[20, 20]], 4: [[18, 20]], 5: [[16, 20]], 6: [[14, 21]], 7: [[12, 21]], 8: [[10, 21]], 9: [[8, 21]], 10: [[6, 21]], 11: [[4, 20]],
  12: [[2, 20]], 13: [[0, 20]], 14: [[1, 19]], 15: [[2, 18]], 16: [[2, 18]], 17: [[4, 16]], 18: [[5, 15]], 19: [[8, 12]],
};
// Heaped along the rim: g G the lettuce on top, k r c the tomato, F s c the meat; on the shell, w its lit belly and s F its toasted
// speckles; a leaf hangs over the rim.
const TACO_FILL = rows([
  '................gggg..',
  '............gggGgGGgg.',
  '............gGGGGGFGG.',
  '........gggGGGFFkrrF..',
  '........gGGGkrscrr....',
  '......ggGGFFrrFc......',
  '....ggGgGFcsFc........',
  '....gGGkrsFcg.........',
  '..ggGGFrrF..g.........',
  '.gGGFsFF..............',
  'ggkrrF.........s......',
  'GGrc.g.....s..........',
  'cF...g................',
  '...ww..s..............',
  '..w.............F.....',
  '..........s...........',
  '.....s.......F........',
  '......................',
  '......................',
  '......................',
]);
const TACO = overlay(shell(22, 20, TACO_SPANS), TACO_FILL);

/** A sparkle on the shell's lit left side. */
const GLINT = ['...W...', '...W...', '..wWw..', 'WWWWWWW', '..wWw..', '...W...', '...W...'];

/** Rows `drop` taken out of a map (a squash by whole rows) and columns `wide` doubled (a stretch by whole columns). */
function squash(map, drop, wide) {
  const kept = map.filter((_, y) => !drop.includes(y));
  return kept.map((row) => [...row].map((ch, x) => (wide.includes(x) ? ch + ch : ch)).join(''));
}

/** A map with round bites (circles [x, y, radius] in its pixels) taken out; the shell along the cut shows its pale broken edge. */
function bitten(map, bites) {
  const gone = (x, y) => bites.some(([cx, cy, r]) => Math.hypot(x + 0.5 - cx, y + 0.5 - cy) <= r);
  const was = (x, y) => (map[y]?.[x] ?? '.') !== '.';
  return map.map((row, y) => [...row].map((ch, x) => {
    if (gone(x, y)) return '.';
    const cut = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => was(x + dx, y + dy) && gone(x + dx, y + dy));
    return cut && 'fsF'.includes(ch) ? 'w' : ch;
  }).join(''));
}

function frameOf(w, h, draw) {
  const g = new Grid(w, h);
  draw(g);
  g.outline(OUTLINE, 1);
  return g;
}

export const taco = {
  FRAME: { w: 32, h: 32 },
  LOOKS: ['tacoBob0', 'tacoBob1', 'tacoBob2', 'tacoBob3', 'tacoGlint', 'tacoBitten'],
  draw() {
    const at = (dy, map = TACO, dx = 0) => frameOf(32, 32, (g) => stamp(g, map, 5 + dx, 6 + dy));
    // The float: rest, up 2 drawing px, rest, down 2 with a squash 2 rows shorter and 2 columns wider.
    const squashed = squash(TACO, [11, 15], [6, 13]);
    return [
      { look: 'tacoBob0', grid: at(0) },
      { look: 'tacoBob1', grid: at(-2) },
      { look: 'tacoBob2', grid: at(0) },
      { look: 'tacoBob3', grid: at(4, squashed, -1) },
      { look: 'tacoGlint', grid: frameOf(32, 32, (g) => { stamp(g, TACO, 5, 6); stamp(g, GLINT, 5 + 3, 6 + 11); }) },
      // The chomp: a round bite out of the top front edge, two tooth marks wide; the outline closes round the cut.
      { look: 'tacoBitten', grid: frameOf(32, 32, (g) => { stamp(g, bitten(TACO, [[18.6, 1.2, 3.8], [21.6, 5.6, 3.7]]), 5, 6); }) },
    ];
  },
};

// ---- The chile pickup (from a piñata): a glossy red chile with a green stem, glowing hot; 19 x 20 drawing px in a 32 x 32 frame. ---

// The stem and the cap's lobes over the shoulder, then the pod curling down and up to its tip: W k the gloss, r the red, c its shade.
const CHILE = rows([
  '........GG..............',
  '.......GG...............',
  '....gggGGg..............',
  '...gGGgGGGGg............',
  '...GrGGrGrGG............',
  '...rWkrrrrc.............',
  '...rWrrrrrc.............',
  '...rWrrrrrc.............',
  '...rWrrrrrcc............',
  '...rkWrrrrcc............',
  '....rWrrrrcc............',
  '....rkWrrrrcc...........',
  '....rrkrrrrcc...........',
  '.....rrrrrrccc..........',
  '.....rrrrrrrcc......kr..',
  '......rrrrrrrrrkkkkrrc..',
  '.......crrrrrrrrrrrrcc..',
  '........ccrrrrrrrrrcc...',
  '..........cccrrrrcc.....',
  '.............cccc.......',
]);

/** A ring of fur orange 1 px round the outline: the chile's heat, drawn as pixels (no transparency). */
function glow(g) {
  const add = [];
  for (let y = 0; y < g.height; y++) for (let x = 0; x < g.width; x++) {
    if (g.get(x, y) !== null) continue;
    if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => g.get(x + dx, y + dy) === OUTLINE)) add.push([x, y]);
  }
  for (const [x, y] of add) g.set(x, y, COLOURS.f);
}

/** A wisp of heat rising off the chile: a short wave of fur orange, its top `len` px above (x, y). */
function wisp(g, x, y, len) {
  for (let i = 0; i < len; i++) g.set(x + [0, 1, 1, 0, -1, -1][i % 6] * (i > 0 ? 1 : 0), y - i, COLOURS.f);
}

export const chile = {
  FRAME: { w: 32, h: 32 },
  LOOKS: ['chileBob0', 'chileBob1', 'chileBob2', 'chileBob3', 'chileGlint'],
  draw() {
    // `heat`: the two wisps' rise, in px (they climb a frame at a time and start again).
    const at = (dy, heat, map = CHILE, extra) => {
      const g = new Grid(32, 32);
      stamp(g, map, 4, 6 + dy);
      if (extra) extra(g);
      g.outline(OUTLINE, 1);
      glow(g);
      if (heat !== null) {
        wisp(g, 21, 15 + dy - heat, 6 - Math.max(0, heat - 1));
        wisp(g, 25, 16 + dy - ((heat + 2) % 4), 6 - Math.max(0, ((heat + 2) % 4) - 1));
      }
      return g;
    };
    const squashed = squash(CHILE, [9], [7]);
    return [
      { look: 'chileBob0', grid: at(0, 0) },
      { look: 'chileBob1', grid: at(-2, 1) },
      { look: 'chileBob2', grid: at(0, 2) },
      { look: 'chileBob3', grid: at(3, 3, squashed) },
      { look: 'chileGlint', grid: at(0, null, CHILE, (g) => stamp(g, GLINT, 4 + 2, 6 + 4)) },
    ];
  },
};

// ---- Held: the taco in Poncho's cream paw (as the illustration holds it), and the chile tucked beside it (Fuego). ----------------

const SMALL_SPANS = {
  1: [[13, 14]], 2: [[11, 15]], 3: [[9, 15]], 4: [[7, 15]], 5: [[5, 15]], 6: [[3, 15]], 7: [[1, 15]], 8: [[0, 14]], 9: [[0, 13]],
  10: [[1, 13]], 11: [[2, 12]], 12: [[4, 10]],
};
const SMALL_FILL = rows([
  '.......ggggggggg',
  '.....ggGgGkcF..G',
  '....gGGrGsr.....',
  '.ggGgGkcF.......',
  '.gkrGcr.........',
  'gGrcF...........',
  'GFF...s.........',
  'c.........s.....',
  '.ww.........F...',
  '.w......s.......',
  '................',
  '................',
  '................',
]);
const SMALL_TACO = overlay(shell(16, 13, SMALL_SPANS), SMALL_FILL);

/** The paw, gripping the shell's belly: a cream mitten, its curled fingers the two bumps down its front (right) side. */
const PAW = rows([
  '.wwwww..',
  'wwwwwwwp',
  'wwwwwwp.',
  'wwwwwwpp',
  '.pwwwpp.',
  '..pppp..',
]);

/** Fuego: a chile tucked in the paw beside the taco, standing in front of its low back end. */
const FUEGO = rows([
  '...G..',
  '..G...',
  '.gGg..',
  'gGrGg.',
  'rWrrc.',
  'rWrrc.',
  'rkrrc.',
  '.rrrc.',
  '.rrcc.',
  '..rcc.',
  '...rc.',
  '....c.',
]);

/** A layer: `map` stamped at (ox, oy) and outlined on its own, so it reads over what is under it. */
function layer(w, h, map, ox, oy) {
  const g = new Grid(w, h);
  stamp(g, map, ox, oy);
  g.outline(OUTLINE, 1);
  return g;
}

export const held = {
  FRAME: { w: 24, h: 24 },
  /** Where the paw's middle is: the frame's middle (between pixels 11 and 12 each way), in drawing px. */
  HAND: { x: 12, y: 12 },
  LOOKS: ['tacoHeld', 'chileHeld', 'tacoFood', 'chileFood', 'tacoBittenHeld'],
  draw() {
    const make = (fuego) => {
      const g = new Grid(24, 24);
      paste(g, layer(24, 24, SMALL_TACO, 5, 2), 0, 0);
      if (fuego) {
        // In front of the taco's low back end, its glow only where it is clear of the taco.
        const c = layer(24, 24, FUEGO, 3, 3);
        glow(c);
        for (let y = 0; y < 24; y++) for (let x = 0; x < 24; x++) {
          const v = c.get(x, y);
          if (v && (v !== COLOURS.f || !g.get(x, y))) g.set(x, y, v);
        }
      }
      paste(g, layer(24, 24, PAW, 8, 9), 0, 0);
      return g;
    };
    // The food alone, where it sits in the paw (the paw's middle at HAND), for the frames that draw his own paw: eating, victory.
    const chileAlone = () => { const c = layer(24, 24, FUEGO, 3, 3); glow(c); return c; };
    return [
      { look: 'tacoHeld', grid: make(false) },
      { look: 'chileHeld', grid: make(true) },
      { look: 'tacoFood', grid: layer(24, 24, SMALL_TACO, 5, 2) },
      { look: 'chileFood', grid: chileAlone() },
      { look: 'tacoBittenHeld', grid: layer(24, 24, bitten(SMALL_TACO, [[0.2, 4.6, 3.0], [-0.2, 8.4, 2.9]]), 5, 2) },
    ];
  },
};

// ---- The claw swipe: three pale claw streaks curving through an arc in front of him. ----------------------------------------------

const SW = 64;
/**
 * The arc: a tall ellipse (`k` stretches it upright) round a centre at his chest, so it sweeps down in front of his snout and his
 * brim, not across them. The three claws, the leading (outer) one first: its radius, its full width at its thickest (the leading
 * claw heaviest, so they read as claws of different weights) and the angles (radians, 0 straight ahead, down positive) where its
 * streak starts and ends in swipe1. The starts line up just in front of the brim's tip, the paw's leading edge; every streak
 * keeps at least 2 px clear of his snout, his brim and his body (drawIdle()) on its rows.
 */
const ARC = {
  cx: 21, cy: 32, k: 1.3,
  claws: [
    { R: 26.5, w: 7.6, a0: -1.04, a1: 1.0 },
    { R: 19, w: 6.2, a0: -0.84, a1: 1.08 },
    { R: 13, w: 3.2, a0: -0.46, a1: 1.15 },
  ],
};

/**
 * One smear frame: each claw's streak over the part `from` to `to` (0 its start, 1 its end in swipe1) of its arc, `scale` times its
 * width at its thickest, which is `peak` of the way along (the head, where the paw is): thin at the tail, a round blunt head. Pixel by
 * pixel from the outside of the curve in: a crimson edge, the white core (`core` px, none when 0), cream, and on the heavier streaks
 * a crimson inner edge. `broken` cuts the streaks into dashes.
 */
function smear(from, to, { scale = 1, peak = 0.6, core = 2, broken = false } = {}) {
  const g = new Grid(SW, SW);
  ARC.claws.forEach(({ R, w, a0, a1 }, i) => {
    const s0 = a0 + (a1 - a0) * from, s1 = a0 + (a1 - a0) * to;
    const half = (x, y) => {
      const u = x - ARC.cx, v = (y - ARC.cy) / ARC.k;
      const a = Math.atan2(v, u), t = (a - s0) / (s1 - s0);
      if (t < 0 || t > 1) return -1;
      const prof = t < peak ? Math.pow(t / peak, 0.6) : Math.sqrt(Math.max(0, 1 - ((t - peak) / (1 - peak)) ** 2));
      if (broken && ((t * 2.2 + i * 0.37) % 1) > 0.72) return -1;
      return { d: Math.hypot(u, v) - R, h: (w * scale * prof) / 2 };
    };
    const inside = (x, y) => { const q = half(x + 0.5, y + 0.5); return q !== -1 && q.h >= 0.5 && Math.abs(q.d) <= q.h; };
    for (let y = 1; y < SW - 1; y++) for (let x = 1; x < SW - 1; x++) {
      if (!inside(x, y)) continue;
      // The outward normal of the ellipse here, in pixels, to count how deep a pixel is from the outside and from the inside.
      const nx = x + 0.5 - ARC.cx, ny = (y + 0.5 - ARC.cy) / (ARC.k * ARC.k), n = Math.hypot(nx, ny);
      const depth = (sign) => { let k = 1; while (k < 9 && inside(Math.round(x + (sign * k * nx) / n), Math.round(y + (sign * k * ny) / n))) k++; return k; };
      const out = depth(1), inn = depth(-1);
      let c = COLOURS.w;
      if (out === 1) c = COLOURS.c;
      else if (out <= 1 + (core && w * scale >= 7 ? core + 1 : core) && inn > 1) c = COLOURS.W; // the heaviest claw's core 1 px wider
      if (inn === 1 && out > 1 && w * scale >= 3) c = COLOURS.c;
      g.set(x, y, c);
    }
  });
  return g;
}

/** Clears every clump of fewer than `min` pixels (8-connected), so a broken streak leaves no crumbs. */
function sweep(g, min) {
  const seen = new Set();
  for (let i = 0; i < g.cells.length; i++) {
    if (!g.cells[i] || seen.has(i)) continue;
    const clump = [i];
    seen.add(i);
    for (let k = 0; k < clump.length; k++) {
      const x = clump[k] % g.width, y = Math.floor(clump[k] / g.width);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const j = (y + dy) * g.width + x + dx;
        if (g.get(x + dx, y + dy) && !seen.has(j)) { seen.add(j); clump.push(j); }
      }
    }
    if (clump.length < min) for (const j of clump) g.cells[j] = null;
  }
  return g;
}

/** A sparkle: a white cross `arm` px each way, cream at its tips, ringed in crimson so it reads on the gold and on the pale blue. */
function sparkle(g, x, y, arm) {
  const pts = [[0, 0]];
  for (let i = 1; i <= arm; i++) pts.push([i, 0], [-i, 0], [0, i], [0, -i]);
  for (const [dx, dy] of pts) for (const [ex, ey] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    if (!g.get(x + dx + ex, y + dy + ey)) g.set(x + dx + ex, y + dy + ey, COLOURS.c);
  }
  for (const [dx, dy] of pts) g.set(x + dx, y + dy, Math.abs(dx) + Math.abs(dy) === arm && arm > 1 ? COLOURS.w : COLOURS.W);
  if (arm > 1) for (const [dx, dy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) g.set(x + dx, y + dy, COLOURS.w);
}

/**
 * The swipe frame, 32 x 32 game px, for a swipe to the right (mirrored for the left). BOX is the claw's box in it (20 x 32 game px,
 * CLAW in tuning.ts): its left edge on his body's front, the frame's bottom row his feet's. The paw swats from just in front of his
 * brim's tip down in front of his snout, never across him: swipe0 the leading edge high up, swipe1 the full crescent, swipe2 its lower half breaking up, swipe3 sparkles where
 * it ended.
 */
export const swipe = {
  FRAME: { w: SW, h: SW },
  BOX: { x0: 12, y0: 0, x1: 52, y1: 64 },
  LOOKS: ['swipe0', 'swipe1', 'swipe2', 'swipe3'],
  draw() {
    // The sparkles where the claws ended, at the lower end of each streak.
    const s3 = new Grid(SW, SW);
    const end = ({ R, a1 }, back) => [Math.round(ARC.cx + R * Math.cos(a1 - back)), Math.round(ARC.cy + ARC.k * R * Math.sin(a1 - back))];
    sparkle(s3, ...end(ARC.claws[0], 0.2), 3);
    sparkle(s3, ...end(ARC.claws[1], 0.05), 1);
    sparkle(s3, ...end(ARC.claws[2], 0.3), 1);
    return [
      // The first frame already hits: a short thick wedge, its blunt head leading.
      { look: 'swipe0', grid: sweep(smear(0, 0.42, { scale: 1.1, peak: 0.8 }), 6) },
      { look: 'swipe1', grid: sweep(smear(0, 1), 6) },
      { look: 'swipe2', grid: sweep(smear(0.45, 1, { scale: 0.75, core: 0, broken: true }), 6) },
      { look: 'swipe3', grid: s3 },
    ];
  },
};

// ---- Effects at his mouth: the fire burst of the spit (Fuego) and the crumbs of the chomp. ----------------------------------------

/**
 * A burst of fire from the mouth at (x0, y0) toward +x: a body `len` px long whose tip rises `rise` px, `width` px at its widest,
 * with flames licking up off its top and leaning forward (`licks`: [where along the body 0 to 1, height, base width]). Hottest at the
 * mouth and down the middle: a white-hot core, cream, fur orange, red at the edges, crimson along the underside. Nothing behind the
 * mouth. Outlined.
 */
function flame(x0, y0, { len, rise, width, licks }) {
  const g = new Grid(32, 32);
  const at = (t) => [x0 + len * t, y0 - rise * t * t];
  const half = (t) => (width / 2) * (t < 0.3 ? 0.6 + (1.33 * t) : Math.pow((1 - t) / 0.7, 0.8));
  for (let y = 1; y < 31; y++) for (let x = x0; x < 31; x++) {
    const px = x + 0.5, py = y + 0.5;
    let best = 1e9, bt = 0;
    for (let k = 0; k <= 80; k++) { const [cx, cy] = at(k / 80); const d = Math.hypot(px - cx, py - cy); if (d < best) { best = d; bt = k / 80; } }
    const hw = half(bt);
    let heat = best <= hw && hw >= 0.6 ? Math.max(best / hw, bt * 1.05) : 9;
    const underside = heat < 9 && py > at(bt)[1] && best > hw - 1.3 && bt > 0.06;
    // The licks: tapered flames from the body's top edge, up and a little forward.
    for (const [t, h, wb] of licks) {
      const [bx, by0] = at(t), by = by0 - half(t) * 0.5;
      const tx = bx + h * 0.6, ty = by - h;
      const dx = tx - bx, dy = ty - by, l2 = dx * dx + dy * dy;
      const s = Math.max(0, Math.min(1, ((px - bx) * dx + (py - by) * dy) / l2));
      const d = Math.hypot(px - bx - s * dx, py - by - s * dy), w = (wb / 2) * Math.pow(1 - s, 0.9);
      if (d <= w && w >= 0.45) heat = Math.min(heat, Math.max(0.5 + 0.5 * s, Math.max(t * 1.05, d / w)));
    }
    if (heat > 1) continue;
    let c = heat < 0.27 ? COLOURS.W : heat < 0.46 ? COLOURS.w : heat < 0.72 ? COLOURS.f : COLOURS.r;
    if (underside && heat > 0.46) c = COLOURS.c;
    g.set(x, y, c);
  }
  g.outline(OUTLINE, 1);
  return sweep(g, 4);
}

/** Bits of the chomp: a corner of shell, a curl of lettuce, a cube of tomato; each a few pixels, outlined on its own. */
const BITS = {
  shell: ['ww.', 'wfs'],
  shellB: ['.wf', 'fss'],
  leaf: ['gg.', '.Gg'],
  leafB: ['.gg', 'gG.'],
  tomato: ['kr', 'rc'],
};

export const fx = {
  FRAME: { w: 32, h: 32 },
  /** Where his mouth goes; the effects leave it toward +x (mirrored for the left). */
  MOUTH: { x: 3, y: 17 },
  LOOKS: ['flame0', 'flame1', 'crumbs0', 'crumbs1'],
  draw() {
    const { x, y } = this.MOUTH;
    // The crumbs fly out of the mouth and fall: each bit's top left in the two frames (the second later, further out and lower).
    const flying = [
      ['shell', [x + 4, y - 5], [x + 9, y - 4]],
      ['shellB', [x + 10, y - 7], [x + 19, y - 6]],
      ['leaf', [x + 12, y - 2], [x + 22, y + 1]],
      ['tomato', [x + 5, y + 1], [x + 11, y + 7]],
      ['leafB', [x + 10, y + 3], [x + 17, y + 9]],
    ];
    const crumbs = (f) => {
      const g = new Grid(32, 32);
      flying.forEach(([kind, ...at], i) => {
        const map = f && i % 2 ? BITS[kind].map((row) => [...row].reverse().join('')) : BITS[kind]; // they tumble
        paste(g, layer(32, 32, map, ...at[f]), 0, 0);
      });
      return g;
    };
    return [
      { look: 'flame0', grid: flame(x, y, { len: 12, rise: 2, width: 12, licks: [[0.3, 5, 5], [0.62, 4, 4]] }) },
      { look: 'flame1', grid: flame(x, y, { len: 26, rise: 6, width: 14, licks: [[0.16, 8, 6], [0.4, 10, 6], [0.64, 7, 5]] }) },
      { look: 'crumbs0', grid: crumbs(0) },
      { look: 'crumbs1', grid: crumbs(1) },
    ];
  },
};

// ---- The Chile Fantasma pickup (GDD-PWR-04): the user's ghost pepper, three frames of a bob (assets/characters/poncho/fantasma/pickup.jpg). ----

// A plump pale lavender-white pepper (l, a lighter highlight W down its left, the lavender shade v down its right and underneath) under a
// short green stem curling over at the top, a cheeky face (two dot eyes and a small open smile, in the outline's near-black #), its lower body
// tapering into a wispy ghost tail that curls to the left. Its near-black outline and the gold one round it are added in `pepperAt`.
const PEPPER = rows([
  '.......gG.....',
  '......gGG.....',
  '.....gGg......',
  '....lllGll....',
  '...llllllllll.',
  '..WWlllllllllv',
  '..WWlllllllllv',
  '..WWl#lll#llvv',
  '..WWl#lll#llvv',
  '..Wlllllllllvv',
  '..Wll#lll#lvvv',
  '..Wlll###llvv.',
  '...Wlllllllvv.',
  '...Wllllllvvv.',
  '...Wlllllllvv.',
  '....llllllvvv.',
  '....lllllvvv..',
  '...lllllvvv...',
  '..llllvvvv....',
  '.llllvvv......',
  'lllvvv........',
  'llv...........',
]);

/** A 1 px ring of gold outside every painted pixel (the pepper's glow, as in pickup.jpg), 4-connected like the outline. */
function halo(g) {
  const add = [];
  for (let y = 0; y < g.height; y++) for (let x = 0; x < g.width; x++) {
    if (g.get(x, y) !== null) continue;
    if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => g.get(x + dx, y + dy) !== null)) add.push([x, y]);
  }
  for (const [x, y] of add) g.set(x, y, KEY.y);
}

/** A gold sparkle centred on (x, y): a plus `arm` px each way, or when `star` its four points one step longer and a pixel thick. */
function twinkle(g, x, y, arm, star = false) {
  g.set(x, y, KEY.y);
  for (let i = 1; i <= arm; i++) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) g.set(x + dx * i, y + dy * i, KEY.y);
  if (star) for (const [dx, dy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) g.set(x + dx, y + dy, KEY.y);
}

export const fantasma = {
  FRAME: { w: 32, h: 32 },
  LOOKS: ['fantasmaBob0', 'fantasmaBob1', 'fantasmaBob2'],
  draw() {
    // Each frame a little lower than the one before: the pepper 0, 2 and 4 drawing px down; its sparkles in different places.
    const at = (dy, sparkles) => {
      const g = new Grid(32, 32);
      stamp(g, PEPPER, 8, 3 + dy);
      g.outline(OUTLINE, 1);
      halo(g);
      for (const [x, y, arm, star] of sparkles) twinkle(g, x, y + dy, arm, star);
      return g;
    };
    return [
      { look: 'fantasmaBob0', grid: at(0, [[4, 8, 1], [27, 5, 1], [27, 19, 2, true]]) },
      { look: 'fantasmaBob1', grid: at(2, [[5, 17, 1], [26, 9, 1], [27, 22, 1]]) },
      { look: 'fantasmaBob2', grid: at(4, [[4, 10, 1], [25, 6, 1], [26, 17, 2, true]]) },
    ];
  },
};

// ---- The glow's effects (GDD-PWR-04): what floats and trails round Poncho while the Chile Fantasma runs (assets/characters/poncho/fantasma/glow.jpg). ----

/** The glow's frames are drawn in gold and, for a soft edge, the pale gold; they are not outlined (the reference's sparkles, flames and streaks are not). */
const GLOW_FRAME = 16;

/** A map of the glow sheet, one character a pixel: `y` gold, `P` pale gold. */
const GLOW = {
  // Four-pointed star, 11 px across: thin arms, a plump middle.
  sparkleStar: rows([
    '................',
    '................',
    '.......y........',
    '.......y........',
    '.......y........',
    '......yyy.......',
    '...yyyyyyyyy....',
    '......yyy.......',
    '.......y........',
    '.......y........',
    '.......y........',
    '................',
    '................',
    '................',
    '................',
    '................',
  ]),
  // A small plus, 5 px across.
  sparklePlus: rows([
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '.......y........',
    '.......y........',
    '.....yyyyy......',
    '.......y........',
    '.......y........',
    '................',
    '................',
    '................',
    '................',
    '................',
  ]),
  // A flame flicker (glow.jpg frame 1): a teardrop leaning a little to the right, its tip pale.
  flame: rows([
    '................',
    '................',
    '.........P......',
    '........Py......',
    '........yy......',
    '.......yyy......',
    '.......yyyy.....',
    '......yyyyy.....',
    '......yyyyy.....',
    '......yyyyy.....',
    '.......yyy......',
    '.......PyP......',
    '................',
    '................',
    '................',
    '................',
  ]),
  // A speed streak (glow.jpg frame 2): a thin gold line trailing off to a point, a pale one under it.
  streak: rows([
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '.........yyyyy..',
    '..yyyyyyyyyyyyy.',
    '.....PPPPPPPP...',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
  ]),
};

export const glowSheet = {
  FRAME: { w: GLOW_FRAME, h: GLOW_FRAME },
  LOOKS: ['sparkleStar', 'sparklePlus', 'flame', 'streak'],
  draw() {
    return this.LOOKS.map((look) => {
      const g = new Grid(GLOW_FRAME, GLOW_FRAME);
      stamp(g, GLOW[look], 0, 0);
      return { look, grid: g };
    });
  },
};
