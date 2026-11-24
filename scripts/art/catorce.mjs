// La Catorce, World 3's boss (GDD-BOS-04): a squat narrow-gauge mine engine, number 14, after the user's model
// (assets/characters/la-catorce/reference-model.jpg), drawn in code (GDD-ART-01) like La
// Estrella (scripts/art/estrella.mjs), on a grid of drawing pixels, each 2 x 2 art pixels (half a game pixel), outlined (GDD-ART-05), in
// World 3's colours (GDD-ART-06) plus the outline, the flash reds and her cold flame. Facing right; `drawLook` mirrors her for the left-facing frames and puts her digits back unmirrored, so the game never flips her.
// Everything of her, outline included, lies inside her 64 x 32 game px box, her wheels' outline on its bottom row.
import { ellipse, Grid, polygon, rect, stroke } from './raster.mjs';
import { FLASH, OUTLINE, paste, px, scaled, shaded } from './enemies1/kit.mjs';

/** A frame: 144 x 72 drawing px (72 x 36 game px). Her box is BOX within it, its bottom the frame's bottom. */
export const FRAME = { w: 144, h: 72 };
/** Her 64 x 32 game px box (CATORCE.width, height) in drawing px. */
export const BOX = { x0: 8, y0: 8, x1: 136, y1: 72 };

/** World 3's colours she is drawn in (GDD-ART-06), and her cold flame, the 25th, hers alone (GDD-BOS-04). */
export const W3 = {
  mist: '#EEF1EA', steel: '#93A0AE', ironDark: '#353A48', galleryDeep: '#221D2E', galleryBase: '#3D3650', lampAmber: '#F0A23A',
  ochreLight: '#EDCB86', ochre: '#CC983F', ochreShade: '#9A6A2C', rockDeep: '#5A3B28',
};
export const COLD_FLAME = '#63E6C4';
export const COLD_FLAME_DEEP = '#2E9E96';

// Materials [light, base, shadow], light from the upper left (GDD-ART-05).
const IRON = [W3.steel, W3.ironDark, W3.galleryDeep];
const IRON_FLAT = [W3.galleryBase, W3.ironDark, W3.galleryDeep];
const BRASS = [W3.ochreLight, W3.lampAmber, W3.ochreShade];
const STEEL = [W3.mist, W3.steel, W3.ironDark];

/** The white flash of a hit: mist white, its shadows steel. The red flash is every world's (GDD-ENM-01). */
const WHITE = { colour: W3.mist, shade: W3.steel };
const DARKS = [W3.ironDark, W3.galleryDeep, W3.galleryBase, W3.ochreShade, W3.rockDeep, COLD_FLAME_DEEP];

/** The wheels' middles across (box px) and their middle's row; each 16 px across. Three, as on the user's model. */
export const WHEELS = [30, 55, 80];
const WHEEL_Y = 55;
const WHEEL_R = 8;
/** The three hit lamps along her boiler (box px), rear to front; the front one goes out first. */
export const LAMPS = [[49, 30], [66, 30], [83, 30]];
/** Her eye's middle (box px): the big lens in her smokebox front, under its hood. */
export const HEADLAMP = [113, 31];
/** The three pale steam-valve studs on her boiler's top, close together on their block: the mark that she cannot be stomped (GDD-CMB-01). */
export const STUDS = [61, 66, 71];
/** The studs' top row (box px); each stud is 3 px wide from its `STUDS` column less 1, and 5 tall. */
export const STUD_TOP = 8;

// prettier-ignore
const DIGITS = {
  1: ['.#.', '##.', '.#.', '.#.', '.#.', '.#.', '###'],
  4: ['#.#', '#.#', '#.#', '###', '..#', '..#', '..#'],
};

/** Where her plate's digits sit in her box (drawing px), facing right; 9 x 7. */
export const DIGITS_AT = { x: 14, y: 32, w: 9, h: 7 };

/** The digits "14" alone, iron on nothing, 9 x 7 drawing px. */
export function drawDigits() {
  const g = new Grid(DIGITS_AT.w, DIGITS_AT.h);
  [1, 4].forEach((d, i) => DIGITS[d].forEach((row, r) => [...row].forEach((ch, c) => ch === '#' && g.set(i * 6 + c, r, W3.galleryDeep))));
  return g;
}

const P = (x, y) => [BOX.x0 + x, BOX.y0 + y];
const at = (test) => (x, y) => test(x - BOX.x0, y - BOX.y0);

/** One wheel on `g`, its crank pin at `turn` quarter turns: a steel-lit tyre, a dark web, two spokes, a counterweight opposite the pin, the hub. */
function drawWheel(g, cx, turn) {
  const a = (turn * Math.PI) / 2;
  const [x, y] = P(cx, WHEEL_Y);
  const web = ellipse(x, y, WHEEL_R - 2, WHEEL_R - 2);
  shaded(g, ellipse(x, y, WHEEL_R, WHEEL_R), IRON);
  g.fill(web, W3.galleryDeep);
  // The counterweight: a third of the web, iron, opposite the pin.
  g.fill((u, v) => web(u, v) && (u - x) * Math.cos(a) + (v - y) * Math.sin(a) < -2, W3.galleryBase);
  // The spoke through the pin, steel, and the one across it, iron.
  const spoke = (b, w) => (u, v) => web(u, v) && stroke([[x - Math.cos(b) * WHEEL_R, y - Math.sin(b) * WHEEL_R], [x + Math.cos(b) * WHEEL_R, y + Math.sin(b) * WHEEL_R]], w)(u, v);
  g.fill(spoke(a + Math.PI / 2, 1.5), W3.ironDark);
  g.fill((u, v) => spoke(a, 1.5)(u, v) && (u - x) * Math.cos(a) + (v - y) * Math.sin(a) > -1, W3.steel);
  g.fill(ellipse(x, y, 1.6, 1.6), W3.mist);
  return [x + Math.cos(a) * 4, y + Math.sin(a) * 4];
}

/**
 * Her frame. `turn`: the wheels' quarter turn (0 to 3). `lamps`: how many of her three hit lamps burn. `eye`: her headlamp, 'dim' (rest),
 * 'full' (telegraph and charge), 'squint' (hurt), 'amber' (defeated) or 'out'. `dx`, `dy`: her body moved on her springs, her wheels
 * staying on the rail (rock back -2, squash +2 and +4, sag 0 and +3). `open`: her firebox door open, the cold flame through her cab
 * (phase 3). `plate`: her number plate on her cab (gone when defeated); `digits`: its "14" drawn on it.
 */
export function drawCatorce({ turn = 0, lamps = 3, eye = 'dim', dx = 0, dy = 0, open = false, plate = true, digits = true } = {}) {
  const g = new Grid(FRAME.w, FRAME.h);
  const B = (test) => (x, y) => test(x - BOX.x0 - dx, y - BOX.y0 - dy);
  const bp = (x, y) => [BOX.x0 + x + dx, BOX.y0 + y + dy];

  // The rear buffer and the cab: tall, its long flat roof overhanging both ways.
  shaded(g, B(rect(1, 43, 5, 7)), IRON);
  shaded(g, B(rect(5, 10, 33, 34)), IRON);
  shaded(g, B(polygon([[1, 9], [3, 5], [40, 5], [43, 9], [43, 11], [1, 11]])), IRON, { lightDepth: 2 });
  // The window: the glow of her firebox low in the dark of the cab, or the cold flame filling it when her door is open (phase 3).
  g.fill(B(rect(10, 15, 16, 14)), W3.galleryDeep);
  g.fill(B(rect(10, 15, 4, 14)), W3.galleryBase);
  if (open) {
    g.fill(B(polygon([[14, 29], [16, 21], [19, 25], [21, 16], [24, 23], [26, 29]])), COLD_FLAME);
    g.fill(B(polygon([[18, 29], [21, 22], [23, 29]])), W3.mist);
    g.fill(B(polygon([[14, 29], [15, 25], [17, 29]])), COLD_FLAME_DEEP);
  } else if (plate) {
    // The glow dies with her: none once she is defeated (her plate gone).
    g.fill(B(polygon([[16, 29], [19, 23], [21, 26], [23, 21], [25, 29]])), COLD_FLAME_DEEP);
  }
  g.fill(B(rect(9, 14, 18, 1)), W3.steel);
  g.fill(B(rect(9, 29, 18, 1)), W3.galleryDeep);
  // The grab rails either side of her door, brass.
  g.fill(B(rect(7, 31, 1, 11)), W3.ochreShade);
  g.fill(B(rect(34, 31, 1, 11)), W3.lampAmber);
  // Her plate "14": lamp amber, its digits iron dark.
  if (plate) {
    shaded(g, B(rect(9, 31, 21, 10)), BRASS);
    // The digits can be left off: a left-facing frame is drawn without them, mirrored, and they are pasted back unmirrored (`drawLook`, DIGITS_AT).
    if (digits) paste(g, drawDigits(), ...bp(DIGITS_AT.x, DIGITS_AT.y));
  } else {
    px(g, [bp(10, 32), bp(28, 32), bp(10, 39), bp(28, 39)], W3.galleryDeep);
  }

  // The boiler, round shouldered, in three banded rings, and the smokebox ahead of it behind a brass joint.
  const boiler = (x, y) => rect(38, 22, 58, 22)(x, y) || ellipse(49, 27, 11, 10)(x, y) || ellipse(85, 27, 11, 10)(x, y) || rect(49, 17, 36, 8)(x, y);
  shaded(g, B(boiler), IRON, { lightDepth: 2, darkDepth: 2 });
  for (const x of [57, 75]) {
    g.fill((u, v) => B(boiler)(u, v) && B(rect(x, 19, 1, 24))(u, v), W3.galleryDeep);
    g.fill((u, v) => B(boiler)(u, v) && B(rect(x + 1, 19, 1, 6))(u, v), W3.steel);
  }
  shaded(g, B(rect(96, 20, 18, 24)), IRON, { lightDepth: 1, darkDepth: 2 });
  g.fill(B(rect(95, 21, 2, 22)), W3.lampAmber);
  g.fill(B(rect(95, 21, 2, 5)), W3.ochreLight);
  g.fill(B(rect(95, 37, 2, 6)), W3.ochreShade);

  // On her boiler's top: a brass whistle, the block with her three pale studs, and the sand dome.
  shaded(g, B(rect(50, 9, 3, 9)), BRASS);
  shaded(g, B(rect(58, 13, 17, 5)), IRON_FLAT);
  for (const x of STUDS) shaded(g, B(rect(x - 1, STUD_TOP, 3, 5)), [W3.mist, W3.mist, W3.steel]);
  shaded(g, B((x, y) => ellipse(84, 16, 6, 7)(x, y) && y < 19), IRON, { lightDepth: 2 });

  // The big funnel stack: a narrow waist under a wide flared top, with a brass band.
  shaded(g, B(polygon([[90, 1], [110, 1], [110, 4], [105, 12], [105, 21], [95, 21], [95, 12], [90, 4]])), IRON, { lightDepth: 2 });
  g.fill(B(rect(95, 13, 10, 2)), W3.lampAmber);
  g.fill(B(rect(95, 13, 3, 2)), W3.ochreLight);
  // The round brass lamp on her smokebox's top, ahead of the stack.
  shaded(g, B(rect(108, 17, 4, 4)), IRON_FLAT);
  shaded(g, B(ellipse(113, 13, 5, 5)), BRASS);
  g.fill(B(ellipse(113.5, 13.5, 2.5, 2.5)), eye === 'amber' || eye === 'out' ? W3.ochreShade : W3.ochreLight);

  // The hit lamps: a brass ring, the cold flame inside while it burns.
  LAMPS.forEach(([x, y], i) => {
    shaded(g, B(ellipse(x, y, 5, 5)), BRASS);
    g.fill(B(ellipse(x, y, 3, 3)), i < lamps ? COLD_FLAME : W3.galleryDeep);
    if (i < lamps) px(g, [bp(x - 1, y - 1), bp(x, y - 1)], W3.mist);
  });

  // Her eye: the smokebox door's big lens in its iron ring, a slanted hood over it for a brow.
  const [hx, hy] = HEADLAMP;
  shaded(g, B(ellipse(hx, hy, 9, 11)), IRON, { lightDepth: 1, darkDepth: 2 });
  g.fill(B(ellipse(hx + 0.5, hy + 0.5, 7, 9)), W3.galleryDeep);
  const lens = B(ellipse(hx + 1, hy + 1.5, 5, 6.5));
  g.fill(lens, { dim: COLD_FLAME_DEEP, full: COLD_FLAME, squint: W3.galleryDeep, amber: W3.rockDeep, out: W3.galleryDeep }[eye]);
  if (eye === 'dim') g.fill(B(ellipse(hx + 2, hy + 3, 2.6, 3.2)), COLD_FLAME);
  if (eye === 'full') g.fill(B(ellipse(hx + 2, hy + 1.5, 2.6, 3.4)), W3.mist);
  if (eye === 'amber') g.fill(B(ellipse(hx + 1.5, hy + 3, 2.6, 3)), W3.lampAmber);
  if (eye === 'squint') g.fill((x, y) => lens(x, y) && B(stroke([[hx - 3, hy - 3], [hx + 4, hy + 1.5], [hx - 3, hy + 6]], 1.5))(x, y), COLD_FLAME);
  // The brow: a hood over the lens, lower toward her front, so she frowns; level and heavy when she is defeated.
  const brow = eye === 'amber' || eye === 'out' ? [[hx - 9, hy - 9], [hx + 11, hy - 9], [hx + 11, hy - 2], [hx - 9, hy - 2]] : eye === 'full' ? [[hx - 10, hy - 13], [hx + 12, hy - 7], [hx + 12, hy - 3], [hx - 10, hy - 9]] : [[hx - 10, hy - 13], [hx + 12, hy - 5], [hx + 12, hy], [hx - 10, hy - 7]];
  shaded(g, B(polygon(brow)), IRON_FLAT);

  // The running board, the step under her cab, the cylinder and the cowcatcher, its slats steel.
  shaded(g, B(rect(3, 44, 116, 4)), IRON);
  shaded(g, B(rect(7, 48, 9, 9)), IRON_FLAT);
  g.fill(B(rect(9, 51, 5, 1)), W3.steel);
  shaded(g, B(rect(92, 47, 16, 9)), IRON, { darkDepth: 2 });
  g.fill(B(rect(94, 48, 2, 7)), W3.steel);
  g.fill(B(rect(104, 48, 2, 7)), W3.steel);
  const catcher = polygon([[108, 46], [118, 46], [126, 58], [108, 58]]);
  shaded(g, B(catcher), IRON_FLAT);
  for (let k = 0; k < 4; k++) g.fill((u, v) => B(catcher)(u, v) && B(stroke([[110 + k * 3, 48], [114 + k * 4, 58]], 1.2))(u, v), W3.steel);
  shaded(g, B(rect(108, 43, 12, 4)), IRON);
  // The ash pan's glow between her rear wheels.
  g.fill(B(rect(40, 48, 6, 3)), open ? COLD_FLAME : plate ? COLD_FLAME_DEEP : W3.galleryDeep);

  // The wheels stay on the rail; the coupling rod joins their pins, the piston rod reaches the leading pin.
  const pins = WHEELS.map((cx) => drawWheel(g, cx, turn));
  g.fill(stroke([pins[0], pins[2]], 2.2), W3.steel);
  g.fill(stroke([[pins[2][0], pins[2][1]], [BOX.x0 + 94 + dx, BOX.y0 + 52 + dy]], 1.4), W3.steel);
  for (const [x, y] of pins) g.fill(ellipse(x, y, 1.6, 1.6), W3.mist);

  g.outline(OUTLINE, 1);
  return g;
}

/** Every painted pixel but the outline and her flames recoloured for a flash. */
function flash(src, tone) {
  const g = new Grid(src.width, src.height);
  src.cells.forEach((c, i) => {
    if (c) g.cells[i] = c === OUTLINE || c === COLD_FLAME ? c : DARKS.includes(c) ? tone.shade : tone.colour;
  });
  return g;
}

/**
 * The looks, in the sheet's order: `rest`, `spin` (her telegraph: wheels spinning on the spot), `spinRed` (its red flash), `run` (her
 * charge) and `slam` each with the number of lamps still lit (3, 2 or 1: phases 1, 2 and 3) and, where her wheels turn, the quarter turn
 * (0 to 3); `hurt` with the lamps left after the hit. Phase 3 has no rest, so no `rest1`; its slam falls in a telegraph, so `slamRed1`.
 */
export const LOOKS = [
  'rest3', 'rest2',
  ...[3, 2, 1].flatMap((l) => [0, 1, 2, 3].flatMap((t) => [`spin${l}_${t}`, `spinRed${l}_${t}`])),
  ...[3, 2, 1].flatMap((l) => [0, 1, 2, 3].map((t) => `run${l}_${t}`)),
  'slam3', 'slam2', 'slam1', 'slamRed1',
  'hurt2', 'hurtWhite2', 'hurt1', 'hurtWhite1', 'defeated', 'defeatedWhite', 'wreck',
];

/** What `drawCatorce` is given for a look, and the flash laid over it. A lamp count of 1 is phase 3: her firebox open. */
function lookParts(look) {
  if (look === 'defeated') return [{ lamps: 0, eye: 'squint', dy: 2, plate: false }, null];
  if (look === 'defeatedWhite') return [{ lamps: 0, eye: 'squint', dy: 2, plate: false }, WHITE];
  if (look === 'wreck') return [{ lamps: 0, eye: 'amber', dy: 3, plate: false }, null];
  const m = /^(rest|spinRed|spin|run|slamRed|slam|hurtWhite|hurt)(\d)(?:_(\d))?$/.exec(look);
  if (!m) throw new Error(`no look ${look}`);
  const [, kind, l, t] = m;
  const lamps = Number(l);
  const turn = Number(t ?? 0);
  const open = lamps === 1;
  switch (kind) {
    case 'rest': return [{ lamps, eye: 'dim', open }, null];
    case 'spin': return [{ lamps, eye: 'full', turn, open }, null];
    case 'spinRed': return [{ lamps, eye: 'full', turn, open }, FLASH];
    case 'run': return [{ lamps, eye: 'full', turn, open, dy: turn % 2 }, null];
    // Squashed 2 px down and 1 px forward, the way she faces: she has turned round by then, so forward is into the room in every phase.
    case 'slam': return [{ lamps, eye: 'full', open, dx: 2, dy: 4 }, null];
    case 'slamRed': return [{ lamps, eye: 'full', open, dx: 2, dy: 4 }, FLASH];
    default: return [{ lamps, eye: 'squint', dy: 1 }, kind === 'hurtWhite' ? WHITE : null];
  }
}

/**
 * One look's frame, facing right, or facing left (`left`): the mirror image, but with the digits of her plate unmirrored, so "14" reads
 * the same both ways (the approved design).
 */
export function drawLook(look, left = false) {
  const [parts, tone] = lookParts(look);
  let g;
  if (!left) g = drawCatorce(parts);
  else {
    g = drawCatorce({ ...parts, digits: false }).flipped();
    if (parts.plate !== false) paste(g, drawDigits(), FRAME.w - (BOX.x0 + DIGITS_AT.x + (parts.dx ?? 0)) - DIGITS_AT.w, BOX.y0 + DIGITS_AT.y + (parts.dy ?? 0));
  }
  return tone ? flash(g, tone) : g;
}

/** Every frame: the looks facing right, then the same looks facing left. */
export const drawFrames = () => [false, true].flatMap((left) => LOOKS.map((look) => ({ look, left, grid: drawLook(look, left) })));

/** The sheet's columns: 7 rows of looks facing right over 7 facing left, 2304 x 2016 art px (L-068). */
export const COLUMNS = 8;

/** Her sheet in art px: each frame 288 x 144, `COLUMNS` across, the right-facing looks first, the left-facing ones from a new row. */
export function drawCatorceSheet() {
  const rows = Math.ceil(LOOKS.length / COLUMNS);
  const g = new Grid(FRAME.w * COLUMNS, FRAME.h * rows * 2);
  drawFrames().forEach(({ left, grid }, k) => {
    const i = k % LOOKS.length;
    paste(g, grid, (i % COLUMNS) * FRAME.w, (Math.floor(i / COLUMNS) + (left ? rows : 0)) * FRAME.h);
  });
  return scaled(g, 2);
}

/**
 * The armour's plume (GDD-BOS-04): white steam standing over her middle stud while her armour holds, harmless, not outlined. Two frames
 * of 12 x 20 drawing px (6 x 10 game px), its foot on the frame's bottom row.
 */
export const PLUME = { w: 12, h: 20, frames: 2 };
export function drawPlumeFrames() {
  return [0, 1].map((k) => {
    const g = new Grid(PLUME.w, PLUME.h);
    g.fill(rect(4, 12, 4, 8), W3.mist);
    g.fill(ellipse(6 + (k ? 1 : -1), 9, 4, 4), W3.mist);
    g.fill(ellipse(6 + (k ? -1.5 : 1.5), 4.5, 3.5, 3.5), W3.mist);
    g.fill(ellipse(7 + (k ? 1 : -1), 10, 2, 2), W3.steel);
    g.fill(ellipse(6 + (k ? -1 : 2), 5.5, 1.5, 1.5), W3.steel);
    return g;
  });
}

/** The plume's sheet in art px: its two frames side by side. */
export function drawPlumeSheet() {
  const g = new Grid(PLUME.w * PLUME.frames, PLUME.h);
  drawPlumeFrames().forEach((f, i) => paste(g, f, i * PLUME.w, 0));
  return scaled(g, 2);
}

/** Her plate "14" alone, 22 x 12 drawing px, for its tumble when she is defeated. */
export function drawPlate() {
  const g = new Grid(24, 14);
  shaded(g, rect(1, 1, 21, 10), BRASS);
  paste(g, drawDigits(), 6, 2);
  g.outline(OUTLINE, 1);
  return g;
}

