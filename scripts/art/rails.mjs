// World 3's railway things (GDD-ART-06 "Things", GDD-WLD-15): the rail on its sleepers, the trestle under it where it has no ground, the
// buffer, the broken end, the warning post, the vagoneta in two layers and the low beam (viga), drawn in code like the Sierra's canyon set
// (GDD-ART-01) in World 3's 24 colours (`scripts/art/sierra.mjs`) at 4 x 4 art pixels per game pixel, light from the upper left. Iron on
// timber means the railway. What Poncho touches carries the outline, 2 art px inside its drawing as on the rock ledge (GDD-ART-05): the
// buffer, the cart, the beam and the post's board and lantern; the rail, the trestle, the broken end and the post's pole do not.
import { Cells, S } from './cells.mjs';
import { Grid } from './raster.mjs';
import { OUTLINE, SIERRA_PALETTE } from './sierra.mjs';

const {
  mistWhite: MIST, peakLit: PEAK_LIT, ochreLight: OCHRE_LIGHT, rockDeep: ROCK_DEEP, timberLit: TIMBER_LIT, timber: TIMBER, timberDark: TIMBER_DARK,
  steel: STEEL, ironDark: IRON, rust: RUST, lampAmber: AMBER,
} = SIERRA_PALETTE;

/** Cells from rows of characters, one character a game px: '.' is empty, any other is looked up in `legend` (sierra.mjs's `fromRows`). */
function fromRows(rows, legend) {
  const c = new Cells(rows[0].length, rows.length);
  rows.forEach((row, y) => {
    if (row.length !== c.w) throw new Error(`row ${y} is ${row.length} wide, not ${c.w}: ${row}`);
    [...row].forEach((ch, x) => {
      if (ch === '.') return;
      if (!(ch in legend)) throw new Error(`no colour for '${ch}'`);
      c.set(x, y, legend[ch]);
    });
  });
  return c;
}

/** The letters the hand-drawn things use. */
const INK = { M: MIST, p: PEAK_LIT, L: OCHRE_LIGHT, K: ROCK_DEEP, T: TIMBER_LIT, t: TIMBER, d: TIMBER_DARK, S: STEEL, I: IRON, R: RUST, A: AMBER };

const SIDES = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/**
 * Cells blown up to art px with the outline drawn inside their silhouette: the ring 2 art px wide along the outside of what is painted (the
 * picture's edges counting as outside) turns to the outline, as on the rock ledge (sierra.mjs's `eroded`), so the drawing is no bigger
 * than its cells. `open` lists the picture's edges ('left', 'right') that do not count as outside, for a piece that goes on there.
 */
function outlined(cells, open = []) {
  const g = cells.scaled();
  const outside = (x, y) => {
    if (x < 0 && open.includes('left')) return false;
    if (x >= g.width && open.includes('right')) return false;
    return g.get(x, y) === null;
  };
  const ring = new Set();
  for (let pass = 0; pass < 2; pass++) {
    const add = [];
    for (let y = 0; y < g.height; y++) {
      for (let x = 0; x < g.width; x++) {
        if (g.get(x, y) === null || ring.has(y * g.width + x)) continue;
        if (SIDES.some(([dx, dy]) => outside(x + dx, y + dy) || ring.has((y + dy) * g.width + x + dx))) add.push(y * g.width + x);
      }
    }
    for (const i of add) ring.add(i);
  }
  for (const i of ring) g.cells[i] = OUTLINE;
  return g;
}

/** Frames side by side (or `columns` to a row) in one sheet, in art px; each frame `w` x `h` art px. */
function sheetOf(frames, w, h, columns = frames.length) {
  const g = new Grid(w * columns, h * Math.ceil(frames.length / columns));
  frames.forEach((f, i) => {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (f.get(x, y) !== null) g.set((i % columns) * w + x, Math.floor(i / columns) * h + y, f.get(x, y));
  });
  return g;
}

// ---------------------------------------------------------------------------------------------------- the rail and the trestle

/**
 * The rail sheet's frames, 16 x 24 game px each (64 x 96 art px), one row. A rail tile's frame is placed with its top `ground` px over the
 * lower of the rail's grounds at the tile's two edges, so that ground is at row `ground`: the rail fills the 4 px over it (the bottom of its
 * tile) and on a slope steps 1 px per px up to 16 px higher, which a 16 px tall frame cannot hold. The stringer frames go at the same place;
 * a bent's at the stringer's underside (`bentTop`). Frames: the rail level, up (rising to the right on the screen) and down, the broken end
 * (level, rolling right), the stringer level, up and down, a bent's top level, up and down, and the leg that carries a bent on downwards.
 */
export const RAIL_ART = { w: 16, h: 24, ground: 20 };
export const RAIL_FRAMES = ['level', 'slopeUp', 'slopeDown', 'broken', 'stringerLevel', 'stringerUp', 'stringerDown', 'bentLevel', 'bentUp', 'bentDown', 'leg'];
/** Where a bent's frame goes, over the lower ground of its tile: a level one 2 px under it (the stringer's underside), a sloped one 13 px over it. */
export const BENT_TOP = { level: 2, slope: -13 };
/** The sleepers' columns in a tile: 4 px wide every 8 px, the same mirrored, so a broken end drawn facing left keeps them in step. */
const SLEEPERS = [2, 3, 4, 5, 10, 11, 12, 13];

/** The rail's ground at column `x` of a tile, as a row of its frame: level, up (1 px higher a px to the right) or down. */
const groundRow = (kind, x) => RAIL_ART.ground - (kind === 'up' ? x : kind === 'down' ? 15 - x : 0);

/** A rail frame: steel over iron dark in the 2 rows 4 and 3 px over the ground, on timber sleepers in the 2 rows under them. No outline. */
function railCells(kind) {
  const c = new Cells(RAIL_ART.w, RAIL_ART.h);
  for (let x = 0; x < RAIL_ART.w; x++) {
    const g = groundRow(kind, x);
    c.set(x, g - 4, STEEL);
    c.set(x, g - 3, IRON);
    if (SLEEPERS.includes(x)) {
      c.set(x, g - 2, TIMBER);
      c.set(x, g - 1, TIMBER);
    }
  }
  return c;
}

/**
 * The broken end, level, rolling right: over the tile's last 6 px the steel row bends up 1 px a px and the iron dark row 1 px every 2,
 * apart, their last 2 px torn and mist white (GDD-ART-05: a hazard's pale tip); the last sleeper hangs down by its near end; nothing past
 * the tips. No outline.
 */
function brokenCells() {
  const c = new Cells(RAIL_ART.w, RAIL_ART.h);
  const g = RAIL_ART.ground;
  for (let x = 0; x < RAIL_ART.w; x++) {
    const k = x - 10;
    if (k < 0) {
      c.set(x, g - 4, STEEL);
      c.set(x, g - 3, IRON);
      if (SLEEPERS.includes(x)) {
        c.set(x, g - 2, TIMBER);
        c.set(x, g - 1, TIMBER);
      }
      continue;
    }
    c.set(x, g - 5 - k, k >= 4 ? MIST : STEEL);
    c.set(x, g - 3 - Math.floor(k / 2), k >= 4 ? MIST : IRON);
  }
  // The last sleeper, hanging by its near end from under the bend: 2 px wide, 4 tall, down past the ground.
  for (let y = g - 2; y < g + 2; y++) for (const x of [10, 11]) c.set(x, y, TIMBER);
  c.set(11, g + 1, TIMBER_DARK);
  return c;
}

/** The stringer: timber dark, 2 px tall, under the sleepers along the rail. Scenery, no outline. */
function stringerCells(kind) {
  const c = new Cells(RAIL_ART.w, RAIL_ART.h);
  for (let x = 0; x < RAIL_ART.w; x++) for (const dy of [0, 1]) c.set(x, groundRow(kind, x) + dy, TIMBER_DARK);
  return c;
}

/** A bent post's left column at `r` rows under the bent's top: 2 px wide, leaning in, from column 5 at the top out to 2 over 12 px. */
const postX = (r) => 5 - Math.min(3, Math.max(0, Math.floor(r / 4)));

/**
 * A bent's top under a stringer of `kind`: two posts 2 px wide in timber dark, leaning in, and one cross brace between them, each post cut
 * along the stringer's underside (the frame's row 0 on the level, its top at the slope's high end otherwise). Scenery, no outline.
 */
function bentCells(kind) {
  const c = new Cells(RAIL_ART.w, RAIL_ART.h);
  // The stringer's underside at column x, as a row of this frame, and the bent's top, the underside at its middle.
  const under = (x) => (kind === 'level' ? 0 : kind === 'up' ? 15 - x : x);
  const top = kind === 'level' ? 0 : 8;
  for (let y = 0; y < RAIL_ART.h; y++) {
    const x0 = postX(y - top);
    for (const x of [x0, x0 + 1, 15 - x0, 14 - x0]) if (y >= under(x)) c.set(x, y, TIMBER_DARK);
  }
  // The cross brace: one diagonal from the left post high up to the right post lower down.
  for (let i = 0; i <= 8; i++) {
    const y = top + 3 + i;
    const x = Math.round(postX(3) + 2 + (i * (13 - postX(11) - (postX(3) + 2))) / 8);
    if (y >= under(x)) c.set(x, y, TIMBER_DARK);
  }
  return c;
}

/** The leg: a bent's two posts straight down at their widest, repeated under its top as far as it goes. */
function legCells() {
  const c = new Cells(RAIL_ART.w, RAIL_ART.h);
  for (let y = 0; y < RAIL_ART.h; y++) for (const x of [2, 3, 12, 13]) c.set(x, y, TIMBER_DARK);
  return c;
}

/** Every rail frame, in RAIL_FRAMES order, as cells (game px). */
export function railFrameCells() {
  return [
    railCells('level'), railCells('up'), railCells('down'), brokenCells(),
    stringerCells('level'), stringerCells('up'), stringerCells('down'),
    bentCells('level'), bentCells('up'), bentCells('down'), legCells(),
  ];
}

/** The rail sheet, 704 x 96 art px: RAIL_FRAMES in one row. */
export function drawRail() {
  return sheetOf(railFrameCells().map((c) => c.scaled()), RAIL_ART.w * S, RAIL_ART.h * S);
}

// ---------------------------------------------------------------------------------------------------- the buffer

/** The buffer's frame, 16 x 16 game px, standing on the ground past the rail's end, for a cart rolling right (the plate on its left). */
export const BUFFER_ART = { w: 16, h: 16 };

/**
 * The buffer (tope): three squared timbers laid one on another between two short posts, lit on top and on their left ends, the end grain
 * on the right; an iron plate with two steel bolts on the side the cart comes from. A square block: "the ride ends here, safely". Outlined.
 */
// prettier-ignore
const BUFFER = [
  '................',
  '................',
  '..dd........dd..',
  'IIddTTTTTTTTddT.',
  'ISddttttttttddt.',
  'IIddttttttttddT.',
  'IIddddddddddddd.',
  'IIddTTTTTTTTddT.',
  'ISddttttttttddt.',
  'IIddttttttttddT.',
  'IIddddddddddddd.',
  'IIddTTTTTTTTddT.',
  'IIddttttttttddt.',
  'ISddttttttttddT.',
  'IIddddddddddddd.',
  '..dd........dd..',
];

/** The buffer sheet, 64 x 64 art px. */
export function drawBuffer() {
  return outlined(fromRows(BUFFER, INK));
}

// ---------------------------------------------------------------------------------------------------- the warning post

/** The warning post's frame, 8 x 24 game px, its pole's foot on the ground at the frame's bottom middle. */
export const POST_ART = { w: 8, h: 24, board: 8, lantern: { x: 2, y: 9, w: 4, h: 5 } };

/**
 * The warning post: a diamond board 8 x 8 at the top, lamp amber inside a mist white rim with a dark broken line across it (a rail with a
 * gap), outlined; under it a lit lantern 4 x 5, its iron dark cage round an amber light with an ochre light core, outlined; a timber pole
 * 2 px wide down to the ground, lit on its left, not outlined. The only lit lamp in the play layer (GDD-ART-06).
 */
// prettier-ignore
const BOARD = [
  '...MM...',
  '..MAAM..',
  '.MAAAAM.',
  'MIIAAIIM',
  'MIIAAIIM',
  '.MAAAAM.',
  '..MAAM..',
  '...MM...',
];
// prettier-ignore
const LANTERN = [
  'IIII',
  'IAAI',
  'ALLA',
  'IAAI',
  'IIII',
];

/** The post sheet, 32 x 96 art px. */
export function drawPost() {
  const pole = new Cells(POST_ART.w, POST_ART.h);
  for (let y = POST_ART.board; y < POST_ART.h; y++) {
    pole.set(3, y, TIMBER_LIT);
    pole.set(4, y, TIMBER);
  }
  const g = pole.scaled();
  const board = new Cells(POST_ART.w, POST_ART.h);
  BOARD.forEach((row, y) => [...row].forEach((ch, x) => ch !== '.' && board.set(x, y, INK[ch])));
  const lantern = new Cells(POST_ART.w, POST_ART.h);
  const { x: lx, y: ly } = POST_ART.lantern;
  LANTERN.forEach((row, y) => [...row].forEach((ch, x) => ch !== '.' && lantern.set(lx + x, ly + y, INK[ch])));
  for (const part of [outlined(board), outlined(lantern)]) part.cells.forEach((c, i) => c !== null && (g.cells[i] = c));
  return g;
}

// ---------------------------------------------------------------------------------------------------- the vagoneta

/**
 * The cart's frames, 32 x 16 game px, its box (CART): the floor's line at row 8 (CART.floorPx over the rail's ground, its bottom), its
 * wheels' bottoms on the rail's steel (row 11, the rail's top row 12). Each look in two layers: the back (its back wall's rim and the dark
 * inside) behind Poncho and the front (the front wall and the wheels) before him, so its front hides his feet and shins. The sheet's first
 * row is the back layers, its second the front ones, each in CART_LOOKS order; drawn rolling right (the game mirrors a cart rolling left).
 */
export const CART_ART = { w: 32, h: 16, floor: 8 };
export const CART_LOOKS = ['standing', 'rolling0', 'rolling1'];

/** The tub's left edge at each row from its rim down: 30 px wide at the rim (rows 0 to 4), 24 at the floor (row 10). */
const TUB_LEFT = [1, 1, 1, 1, 1, 2, 2, 3, 3, 4, 4];
/** The rows of the front wall: its 2 px steel rim, the rock deep seam, rust under it. */
const FRONT_TOP = 3;
const RIVET_ROW = 7;
const RIVETS = [12, 16, 20];
/** Each wheel's columns (6 px across, its middle 9 px from the cart's middle, `WHEEL_OFFSET`) and rows. */
const WHEELS = [4, 22];
const WHEEL_ROWS = 6;
// prettier-ignore
const WHEEL = [
  '.IIII.',
  'IIIIII',
  'IISSII',
  'IISSII',
  'IIIIII',
  '.IIII.',
];
/** The hubs' glint, a mist white px on the hub (2 x 2 from its wheel's column 2, row 2), turning: the standing and rolling looks. */
const GLINT = { standing: [0, 0], rolling0: [1, 0], rolling1: [1, 1] };
/** The chock wedged under the leading wheel while it stands: timber, its slope lit. */
// prettier-ignore
const CHOCK = ['T...', 'Tt..', 'Ttt.', 'tttt'];
const CHOCK_AT = { x: 28, y: 8 };
/** The dust behind the rear wheel while it rolls: 2 px of timber lit on the rail, not outlined. */
const DUST = { rolling0: [[1, 11], [2, 10]], rolling1: [[0, 10], [2, 11]] };

/** The tub's two layers for a look, `drop` px lower (the rolling bounce), as cells. */
function cartCells(look) {
  const drop = look === 'rolling1' ? 1 : 0;
  const back = new Cells(CART_ART.w, CART_ART.h);
  const front = new Cells(CART_ART.w, CART_ART.h);
  TUB_LEFT.forEach((left, r) => {
    const y = r + drop;
    for (let x = left; x <= 31 - left; x++) {
      // The back: its rim, steel, over the dark inside down to the floor (hidden behind the front wall but for the row over it).
      back.set(x, y, r < 2 ? STEEL : ROCK_DEEP);
      if (r < FRONT_TOP) continue;
      const k = r - FRONT_TOP;
      front.set(x, y, k < 2 ? STEEL : k === 2 ? ROCK_DEEP : RUST);
    }
  });
  for (const x of RIVETS) front.set(x, RIVET_ROW + drop, STEEL);
  for (const wx of WHEELS) {
    WHEEL.forEach((row, y) => [...row].forEach((ch, x) => ch !== '.' && front.set(wx + x, WHEEL_ROWS + y, INK[ch])));
    const [gx, gy] = GLINT[look];
    front.set(wx + 2 + gx, WHEEL_ROWS + 2 + gy, MIST);
  }
  if (look === 'standing') CHOCK.forEach((row, y) => [...row].forEach((ch, x) => ch !== '.' && front.set(CHOCK_AT.x + x, CHOCK_AT.y + y, INK[ch])));
  return { back, front };
}

/** The cart's frames: [{ look, back, front }], each layer FRAME art px (128 x 64), outlined, the dust added after the outline. */
export function drawCartFrames() {
  return CART_LOOKS.map((look) => {
    const { back, front } = cartCells(look);
    const f = outlined(front);
    for (const [x, y] of DUST[look] ?? []) for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) if (f.get(x * S + i, y * S + j) === null) f.set(x * S + i, y * S + j, TIMBER_LIT);
    return { look, back: outlined(back), front: f };
  });
}

/** The vagoneta sheet, 384 x 128 art px: the back layers in a row over the front layers. */
export function drawVagoneta() {
  const frames = drawCartFrames();
  return sheetOf([...frames.map((f) => f.back), ...frames.map((f) => f.front)], CART_ART.w * S, CART_ART.h * S, CART_LOOKS.length);
}

// ---------------------------------------------------------------------------------------------------- the low beam

/** The low beam's pieces, 16 x 16 game px: its left end, a middle that repeats and its right end; the beam is the tile's bottom 10 px. */
export const VIGA_ART = { w: 16, h: 16, thick: 10 };
export const VIGA_PIECES = ['left', 'middle', 'right'];

/**
 * The beam (viga), drawn as one strip of its three pieces so that only its ends and its top and bottom are outlined: a squared cap timber
 * 10 px thick against its tile's bottom edge, timber lit on top, timber, timber dark underneath, the saw-cut end grain as rings on each end,
 * an iron strap round it in the middle of every piece, and a row of mist white along its lower front edge, the edge he must clear.
 */
function vigaCells() {
  const w = VIGA_ART.w * VIGA_PIECES.length;
  const c = new Cells(w, VIGA_ART.h);
  const top = VIGA_ART.h - VIGA_ART.thick;
  for (let r = 0; r < VIGA_ART.thick; r++) {
    for (let x = 0; x < w; x++) {
      const y = top + r;
      let colour = r === 0 ? TIMBER_LIT : r < 7 ? TIMBER : r < 9 ? TIMBER_DARK : MIST;
      // The strap, iron dark with a steel bolt, round the middle of each piece.
      if (r >= 1 && r < 9 && (x % VIGA_ART.w === 7 || x % VIGA_ART.w === 8)) colour = r === 2 && x % VIGA_ART.w === 8 ? STEEL : IRON;
      // The end grain: rings round the middle of each end face, 4 px deep, timber lit and timber in turn.
      const end = x < 4 ? x : x >= w - 4 ? w - 1 - x : -1;
      if (end >= 0 && r >= 1 && r < 9) colour = Math.max(Math.abs(end - 1.5) * 2, Math.abs(r - 4.5)) > 2.5 ? TIMBER_LIT : Math.max(Math.abs(end - 1.5) * 2, Math.abs(r - 4.5)) > 1 ? TIMBER : TIMBER_DARK;
      c.set(x, y, colour);
    }
  }
  return c;
}

/** The beam's pieces: [{ piece, grid }], each 64 x 64 art px. */
export function drawVigaPieces() {
  const strip = outlined(vigaCells());
  return VIGA_PIECES.map((piece, n) => {
    const g = new Grid(VIGA_ART.w * S, VIGA_ART.h * S);
    for (let y = 0; y < g.height; y++) for (let x = 0; x < g.width; x++) g.set(x, y, strip.get(n * VIGA_ART.w * S + x, y));
    return { piece, grid: g };
  });
}

/** The viga sheet, 192 x 64 art px: VIGA_PIECES in a row. */
export function drawViga() {
  return sheetOf(drawVigaPieces().map((p) => p.grid), VIGA_ART.w * S, VIGA_ART.h * S);
}
