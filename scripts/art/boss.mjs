// Don Zopilote, World 1's boss (GDD-BOS-02), his cactus fruit and the arena's rocks, drawn in code like Poncho's sprite (GDD-ART-01) from
// the design the user approved (assets/characters/don-zopilote/). Drawn on a grid of drawing pixels, each 2 x 2 art pixels (half a game
// pixel), the scale of Poncho's drawing; outlined (GDD-ART-05) and in World 1's colours only (GDD-ART-06), plus the shared outline.
import { ellipse, Grid, or, polygon, rect, stroke } from './raster.mjs';

/** The outline every character has (GDD-ART-05). */
export const OUTLINE = '#070509';
const [SKY_TOP] = ['#E39A48'];
const [SUN_DISC, SUN_RING] = ['#FFF6D0', '#FFD25A'];
const [CLOUD_TOP, CLOUD_UNDER] = ['#FFF4DC', '#E9B98A'];
const [PURPLE, RUST, BLUE, NAVY] = ['#8E6A96', '#A65B5B', '#4D5A9C', '#3A4580'];
const [GRASS_LIGHT, GRASS_BASE, GRASS_DARK] = ['#9CC24E', '#6FA03A', '#4E7A2C'];
const [SAND_LIGHT, SAND_BASE, SAND_DARK] = ['#F4D29C', '#E8B87A', '#D19A5E'];
const [EARTH_BASE, EARTH_DARK] = ['#A0472F', '#7A3326'];
const [RED, ORANGE, DEEP] = ['#D8473A', '#F08A3C', '#2F5A3A'];

// Materials as [light, base, shadow]: light from the upper left (GDD-ART-05).
const PLUME = [EARTH_BASE, EARTH_DARK, NAVY]; // brown plumage with a cool shadow
const HEAD = [ORANGE, RED, EARTH_BASE]; // the bare red head of a turkey vulture
const BEAK = [SUN_DISC, CLOUD_TOP, CLOUD_UNDER];
const GOLD = [SUN_DISC, SUN_RING, SKY_TOP]; // the crown, hammered gold tin
const CHOLLA = [GRASS_LIGHT, GRASS_BASE, GRASS_DARK];
const FOOT = [CLOUD_UNDER, SAND_DARK, RUST];

/** A frame, in drawing pixels: 75 x 62 game px. His box's middle is the frame's middle (75, 62), so a flipped frame stays on his box. */
export const FRAME = { w: 150, h: 124 };
/** Drawing pixels from the frame's top to the floor in the stuck frame: his box's bottom (62 + 30, his box being 60 drawing px tall). */
export const STUCK_FLOOR = 92;
/** Sheet columns. */
export const COLUMNS = 7;
/** The looks of each crown (3, 2, 1 points), in order; frame = (3 - crown) * LOOKS.length + index. Then DEFEAT_LOOKS, crown 0. */
export const LOOKS = ['flapUp', 'flapDown', 'climbUp', 'climbDown', 'telegraph', 'telegraphRed', 'dive', 'stuck', 'sweep', 'hurt', 'hurtWhite'];
export const DEFEAT_LOOKS = ['defeat', 'defeatWhite'];

/** Paints a material: `light` along its upper left edge, `dark` along its lower right, `depth` pixels deep. */
function shaded(g, test, [light, base, dark], { lightDepth = 1, darkDepth = 2 } = {}) {
  const inside = (x, y) => test(x + 0.5, y + 0.5);
  for (let y = 0; y < g.height; y++) {
    for (let x = 0; x < g.width; x++) {
      if (!inside(x, y)) continue;
      let c = base;
      for (let d = 1; d <= darkDepth; d++) if (!inside(x + d, y + d) || !inside(x, y + d)) c = dark;
      if (c === base) for (let d = 1; d <= lightDepth; d++) if (!inside(x - d, y - d) || !inside(x, y - d)) c = light;
      g.set(x, y, c);
    }
  }
}
const px = (g, pts, colour) => pts.forEach(([x, y]) => g.set(x, y, colour));
const flipY = (test, axis) => (x, y) => test(x, 2 * axis - y);

// His parts, facing right, before the frame's 5 px shift that centres his box.
const BODY = ellipse(68, 68, 24, 15.5, -0.08);
const BELLY = ellipse(70, 75, 16, 7, -0.05);
const TAIL = polygon([[50, 62], [22, 64], [15, 69], [21, 71], [16, 75], [25, 76], [50, 76]]);
const RUFF = or(ellipse(88, 58, 11, 10), polygon([[78, 50], [80, 44], [84, 49], [87, 42], [90, 48], [94, 43], [96, 50], [100, 48], [99, 56], [78, 56]]));
const HEAD_SHAPE = ellipse(104, 45, 10.5, 9.5, -0.1);
const BEAK_SHUT = polygon([[110, 40], [119, 40], [124, 43], [125, 50], [122, 48], [119, 46.5], [110, 47.5]]);
const CROWN_BAND = polygon([[95, 34], [111, 31], [112, 35], [96, 38]]);
/** One point for each hit he has left (GDD-BOS-02). */
const CROWN_POINTS = [polygon([[95.5, 35], [96.5, 24], [101, 34]]), polygon([[100.5, 34], [103, 20.5], [106.5, 33]]), polygon([[106, 33], [110, 22.5], [111.5, 32]])];
/** Cholla joints stuck in his back, with pale spines: why he cannot be stomped (GDD-CMB-01, GDD-ART-05). */
const CHOLLA_JOINTS = [[52, 54.5, 4.4, 3.6, -0.6], [61, 52.5, 4.4, 3.6, -0.15], [70, 53, 4.2, 3.4, 0.4]];

function wingRaised(ox, oy) {
  const t = (p) => p.map(([x, y]) => [x + ox, y + oy]);
  const coverts = polygon(t([[84, 62], [80, 40], [74, 24], [68, 20], [63, 28], [66, 46], [70, 62]]));
  const flight = polygon(t([[70, 62], [66, 46], [63, 28], [58, 24], [50, 28], [46, 40], [52, 54], [58, 62]]));
  const fingers = [[[70, 22], [70, 6]], [[66, 22], [62, 4]], [[62, 24], [53, 6]], [[58, 26], [45, 11]], [[54, 29], [40, 19]]].map((s) => stroke(t(s), 4.4));
  return { coverts, flight: or(flight, ...fingers) };
}

/** The whole bird, facing right. wings 'raised' | 'lowered' | 'tucked'; crown 0 to 3 points; eye 'grump' | 'wide' | 'x'; feet 'tucked' | 'out' | 'none'. */
function drawBird({ wings = 'raised', crown = 3, beakOpen = false, eye = 'grump', feet = 'tucked' } = {}) {
  const g = new Grid(FRAME.w, FRAME.h);
  const pick = (w) => (wings === 'lowered' ? { coverts: flipY(w.coverts, 60), flight: flipY(w.flight, 60) } : w);
  if (wings !== 'tucked') {
    const far = pick(wingRaised(8, 2));
    shaded(g, far.flight, [BLUE, NAVY, NAVY]);
    shaded(g, far.coverts, [EARTH_DARK, NAVY, NAVY]);
  }
  shaded(g, TAIL, PLUME);
  px(g, [[24, 69], [28, 70], [32, 69], [36, 70], [40, 69], [24, 73], [28, 74], [32, 73]], NAVY);
  if (feet === 'tucked') {
    shaded(g, stroke([[62, 80], [57, 86]], 3.2), FOOT);
    shaded(g, stroke([[72, 81], [68, 87]], 3.2), FOOT);
  } else if (feet === 'out') {
    for (const [x0, y0] of [[62, 80], [73, 80]]) {
      shaded(g, stroke([[x0, y0], [x0 + 2, y0 + 8]], 3.2), FOOT);
      shaded(g, stroke([[x0 + 1, y0 + 9], [x0 + 8, y0 + 10]], 2.4), FOOT);
      shaded(g, stroke([[x0 + 1, y0 + 9], [x0 - 4, y0 + 10]], 2.4), FOOT);
    }
  }
  shaded(g, BODY, PLUME);
  shaded(g, BELLY, [EARTH_BASE, EARTH_DARK, EARTH_DARK], { lightDepth: 0, darkDepth: 1 });
  for (let i = 0; i < 7; i++) px(g, [[50 + i * 5, 66 + (i % 2) * 2], [51 + i * 5, 67 + (i % 2) * 2]], EARTH_BASE);
  for (let i = 0; i < 5; i++) px(g, [[60 + i * 5, 77 + (i % 2)]], NAVY);
  if (wings !== 'tucked') {
    const near = pick(wingRaised(0, 0));
    shaded(g, near.flight, [PURPLE, PURPLE, BLUE]);
    shaded(g, near.coverts, PLUME);
    for (const l of [[[63, 34], [50, 36]], [[64, 44], [48, 46]], [[66, 54], [52, 57]]]) g.fill(wings === 'raised' ? stroke(l, 1) : flipY(stroke(l, 1), 60), BLUE, true);
  } else {
    shaded(g, polygon([[88, 60], [66, 56], [40, 60], [18, 68], [44, 69], [72, 70]]), PLUME);
    shaded(g, polygon([[46, 62], [18, 68], [46, 68]]), [PURPLE, PURPLE, BLUE]);
  }
  for (const [x, y, rx, ry, a] of CHOLLA_JOINTS) {
    shaded(g, ellipse(x, y, rx, ry, a), CHOLLA);
    for (const [sx, sy] of [[x - 1, y - 5], [x + 2.5, y - 4.5], [x - 4.5, y - 3], [x + 4.5, y - 2]]) g.set(Math.floor(sx), Math.floor(sy), CLOUD_TOP);
    px(g, [[Math.floor(x), Math.floor(y - 1)], [Math.floor(x - 2), Math.floor(y + 1)], [Math.floor(x + 2), Math.floor(y + 1)]], DEEP);
  }
  shaded(g, RUFF, [EARTH_BASE, EARTH_DARK, NAVY], { darkDepth: 1 });
  px(g, [[80, 46], [84, 50], [87, 44], [90, 49], [94, 45], [97, 51], [82, 55], [86, 57], [90, 55], [94, 58]], EARTH_BASE);
  px(g, [[83, 60], [88, 63], [93, 61], [85, 65]], NAVY);
  shaded(g, HEAD_SHAPE, HEAD);
  px(g, [[97, 48], [98, 49], [100, 50], [96, 45], [99, 46], [101, 51], [103, 52]], EARTH_BASE);
  if (beakOpen) {
    shaded(g, polygon([[110, 39], [119, 38], [125, 41], [125, 46], [121, 44], [110, 44]]), BEAK);
    shaded(g, polygon([[110, 47], [120, 49], [122, 53], [110, 50.5]]), BEAK);
    g.fill(polygon([[111, 44], [121, 44], [120, 49], [111, 47]]), EARTH_DARK);
  } else {
    shaded(g, BEAK_SHUT, BEAK, { darkDepth: 1 });
    px(g, [[115, 42], [116, 42]], OUTLINE);
    px(g, [[110, 46], [111, 46], [112, 46]], CLOUD_UNDER);
  }
  if (eye === 'x') {
    px(g, [[104, 42], [108, 46], [105, 43], [106, 44], [107, 45], [108, 42], [107, 43], [105, 45], [104, 46]], OUTLINE);
  } else {
    g.fill(rect(103, 41, 6, 5), SUN_DISC);
    px(g, [[106, 42], [107, 42], [106, 43], [107, 43], [106, 44], [107, 44]], OUTLINE);
    if (eye === 'wide') px(g, [[103, 40], [104, 40], [105, 40], [106, 40], [107, 40], [108, 40]], SUN_DISC);
    else px(g, [[101, 39], [102, 39], [103, 40], [104, 40], [105, 40], [106, 41], [107, 41], [108, 41], [109, 42], [103, 41], [104, 41], [105, 41]], EARTH_DARK);
  }
  if (crown > 0) {
    shaded(g, CROWN_BAND, GOLD, { darkDepth: 1 });
    for (let i = 0; i < crown; i++) shaded(g, CROWN_POINTS[i], GOLD, { darkDepth: 1 });
    px(g, [[97, 36], [100, 35], [108, 33], [110, 33]], SKY_TOP);
    px(g, [[103, 34], [104, 34], [103, 35], [104, 35]], RED); // a tuna as the jewel
    px(g, [[103, 33]], ORANGE);
    px(g, [[103, 32], [104, 32]], GRASS_BASE);
  }
  g.outline(OUTLINE, 1);
  return g;
}

/** `src` turned by `a` radians (clockwise on screen) about (cx, cy). */
function rotated(src, a, cx = 72, cy = 60) {
  const out = new Grid(FRAME.w, FRAME.h);
  const c = Math.cos(a), s = Math.sin(a);
  for (let y = 0; y < out.height; y++) {
    for (let x = 0; x < out.width; x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
      const v = src.get(Math.floor(cx + dx * c + dy * s), Math.floor(cy - dx * s + dy * c));
      if (v) out.set(x, y, v);
    }
  }
  out.outline(OUTLINE, 1); // turning resamples the grid and opens gaps in the outline: close them (GDD-ART-05)
  return out;
}

/** The flash of GDD-BOS-02 (red in his telegraph, white hurt or defeated): every pixel but the outline in `colour`, shadows in `shade`. */
function flashed(src, colour, shade) {
  const g = new Grid(src.width, src.height);
  src.cells.forEach((c, i) => {
    if (c) g.cells[i] = c === OUTLINE ? OUTLINE : [NAVY, BLUE, GRASS_DARK, RUST, SKY_TOP].includes(c) ? shade : colour;
  });
  return g;
}

/** Copies `src` onto `dst` at (ox, oy), skipping empty cells. */
function paste(dst, src, ox, oy) {
  for (let y = 0; y < src.height; y++) {
    for (let x = 0; x < src.width; x++) {
      const v = src.get(x, y);
      if (v) dst.set(ox + x, oy + y, v);
    }
  }
}

/** Three pale dots over him while he is stuck (GDD-BOS-02), outlined. */
function dazed(g, cx, cy) {
  for (const [dx, dy] of [[-9, 0], [0, -4], [9, 0]]) {
    const ox = cx + dx, oy = cy + dy;
    for (const [x, y] of [[0, 0], [1, 0], [0, 1], [1, 1]]) g.set(ox + x, oy + y, CLOUD_TOP);
    for (const [x, y] of [[-1, 0], [-1, 1], [2, 0], [2, 1], [0, -1], [1, -1], [0, 2], [1, 2]]) if (!g.get(ox + x, oy + y)) g.set(ox + x, oy + y, OUTLINE);
  }
}

/** Stuck head first in the sand after a dive: tail up, wings drooped, a sand mound over his beak on the floor line, three dots. */
function drawStuck(crown) {
  const g = new Grid(FRAME.w, FRAME.h);
  paste(g, rotated(drawBird({ wings: 'lowered', feet: 'none', crown }), 0.95), 0, STUCK_FLOOR - 110);
  for (let y = 0; y < STUCK_FLOOR; y++) {
    for (let x = 0; x < FRAME.w; x++) {
      const bump = 18 * Math.exp(-(((x - 108) / 16) ** 2));
      if (bump > 1.5 && y > STUCK_FLOOR - 6 - bump) g.set(x, y, y > STUCK_FLOOR - 4 - bump * 0.4 ? SAND_DARK : (x + y) % 5 === 0 ? SAND_LIGHT : SAND_BASE);
    }
  }
  dazed(g, 58, STUCK_FLOOR - 82);
  return g;
}

/** One look of his at a crown of `crown` points, before the frame shift. */
function drawLook(look, crown) {
  switch (look) {
    case 'flapUp': return drawBird({ wings: 'raised', crown });
    case 'flapDown': return drawBird({ wings: 'lowered', crown });
    case 'climbUp': return rotated(drawBird({ wings: 'raised', crown }), -0.3);
    case 'climbDown': return rotated(drawBird({ wings: 'lowered', crown }), -0.3);
    case 'telegraph': return drawBird({ wings: 'raised', beakOpen: true, eye: 'wide', feet: 'out', crown });
    case 'telegraphRed': return flashed(drawLook('telegraph', crown), RED, EARTH_BASE);
    case 'dive': return rotated(drawBird({ wings: 'tucked', feet: 'none', eye: 'wide', crown }), 0.75);
    case 'stuck': return drawStuck(crown);
    case 'sweep': return drawBird({ wings: 'tucked', feet: 'out', beakOpen: true, crown });
    case 'hurt': return drawBird({ wings: 'tucked', eye: 'x', crown }); // tucked: he is hurt on the floor too, where lowered wings would hang below it
    case 'hurtWhite': return flashed(drawLook('hurt', crown), SUN_DISC, CLOUD_UNDER);
    case 'defeat': return rotated(drawBird({ wings: 'tucked', eye: 'x', crown: 0, feet: 'out' }), Math.PI * 0.9); // he lies on the floor
    case 'defeatWhite': return flashed(drawLook('defeat', 0), SUN_DISC, CLOUD_UNDER);
    default: throw new Error(`no look ${look}`);
  }
}

/** Every frame in sheet order: [{ look, crown, grid }], the grid in drawing pixels, his box's middle at the frame's middle. */
export function bossFrames() {
  const frames = [];
  for (const crown of [3, 2, 1]) for (const look of LOOKS) frames.push({ look, crown });
  for (const look of DEFEAT_LOOKS) frames.push({ look, crown: 0 });
  return frames.map((f) => {
    const grid = new Grid(FRAME.w, FRAME.h);
    // The stuck frame is placed by its floor line; the defeat looks 4 px up, so the bird lying on the floor stays above it, and the climb
    // looks 1 px up, so only lowered wings reach below his box (BOSS_ART.wingsBelow).
    paste(grid, drawLook(f.look, f.crown), f.look === 'stuck' ? 0 : 5, f.look.startsWith('defeat') ? -4 : f.look.startsWith('climb') ? -1 : 0);
    return { ...f, grid };
  });
}

/** A grid blown up `k` times. */
export function scaled(src, k) {
  const g = new Grid(src.width * k, src.height * k);
  for (let y = 0; y < g.height; y++) for (let x = 0; x < g.width; x++) g.cells[y * g.width + x] = src.cells[Math.floor(y / k) * src.width + Math.floor(x / k)];
  return g;
}

/** The sheet in art pixels: COLUMNS frames across, each 2 x 2 art pixels a drawing pixel. */
export function drawBossSheet() {
  const frames = bossFrames();
  const rows = Math.ceil(frames.length / COLUMNS);
  const sheet = new Grid(FRAME.w * COLUMNS, FRAME.h * rows);
  frames.forEach((f, i) => paste(sheet, f.grid, (i % COLUMNS) * FRAME.w, Math.floor(i / COLUMNS) * FRAME.h));
  return scaled(sheet, 2);
}

/** A cactus fruit, a red tuna with pale glochids (GDD-BOS-02): 18 x 18 drawing px, falling (frame 0) and lying (frame 1), in art pixels. */
export function drawFruitSheet() {
  const sheet = new Grid(36, 18);
  [false, true].forEach((landed, i) => {
    const g = new Grid(18, 18);
    shaded(g, landed ? ellipse(9, 10.5, 7, 6) : ellipse(9, 9.5, 6.5, 7.2), HEAD);
    g.fill(landed ? rect(6, 4, 6, 1.5) : rect(6, 2, 6, 1.5), GRASS_BASE);
    px(g, landed ? [[6, 8], [11, 9], [8, 12], [13, 12], [5, 12]] : [[6, 6], [11, 7], [8, 10], [12, 12], [5, 11], [9, 14]], CLOUD_TOP);
    g.outline(OUTLINE, 1);
    paste(sheet, g, i * 18, 0);
  });
  return scaled(sheet, 2);
}

/** A rock of the arena, red sandstone (GDD-BOS-02): 26 x 26 drawing px, in art pixels. */
export function drawRock() {
  const g = new Grid(26, 26);
  shaded(g, polygon([[3, 12], [6, 4], [14, 1.5], [21, 4], [24, 12], [22, 22], [13, 24.5], [4, 21]]), [CLOUD_UNDER, RUST, PURPLE], { lightDepth: 2, darkDepth: 3 });
  px(g, [[9, 9], [10, 9], [16, 15], [17, 15], [8, 17]], SAND_DARK);
  g.fill(stroke([[18, 6], [16, 10]], 1), EARTH_DARK, true);
  g.outline(OUTLINE, 1);
  return scaled(g, 2);
}
