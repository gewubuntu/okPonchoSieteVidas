// World 3's (Sierra) art for the mine, 3-2 La Mina: the backdrop underground, its floor, its decor, and the rock back wall that stands
// behind a gallery cut into a cliff (GDD-ART-06, GDD-WLD-16, GDD-WLD-17), drawn in code beside the canyon's (`sierra.mjs`) in the same 24
// colours, light from the upper left, whole game pixels (4 x 4 art pixels) but the sky's dither, no outline. What Poncho cannot touch is the
// violet-grey gallery wall; what he stands on is the ochre rock of the canyon's tiles; gallery deep only above y = 40 (the roof band, behind
// the HUD), in the side tunnels and in the foot below the floor, so his near-black outline always has a lighter wall behind it.
import { Cells, noise, S, stamp } from './cells.mjs';
import { Grid } from './raster.mjs';
import { DECOR_FRAME, drawTile, groundSheet, SIERRA_PALETTE } from './sierra.mjs';

const {
  mistWhite: MIST, ochreLight: OCHRE_LIGHT, ochre: OCHRE, ochreShade: OCHRE_SHADE, rockDeep: ROCK_DEEP, timberLit: TIMBER_LIT, timber: TIMBER,
  timberDark: TIMBER_DARK, steel: STEEL, ironDark: IRON_DARK, galleryDeep: GALLERY_DEEP, galleryBase: GALLERY_BASE, galleryLit: GALLERY_LIT,
  lampAmber: LAMP_AMBER,
} = SIERRA_PALETTE;

const WIDTH = 480 * S;

/** Cells from rows of characters, one character a cell: '.' is empty, any other is looked up in `INK`. */
function fromRows(rows) {
  const c = new Cells(rows[0].length, rows.length);
  rows.forEach((row, y) => {
    if (row.length !== c.w) throw new Error(`row ${y} is ${row.length} wide, not ${c.w}: ${row}`);
    [...row].forEach((ch, x) => {
      if (ch === '.') return;
      if (!(ch in INK)) throw new Error(`no colour for '${ch}'`);
      c.set(x, y, INK[ch]);
    });
  });
  return c;
}
/** The letters the hand-drawn pieces use. */
const INK = {
  M: MIST, L: OCHRE_LIGHT, O: OCHRE, o: OCHRE_SHADE, K: ROCK_DEEP, T: TIMBER_LIT, t: TIMBER, d: TIMBER_DARK, S: STEEL, i: IRON_DARK,
  g: GALLERY_BASE, G: GALLERY_LIT, a: LAMP_AMBER,
};

/** Sets a cell on a strip that repeats every 480 game px, wrapping its column. */
const wrapSet = (c, x, y, colour) => c.set(((x % c.w) + c.w) % c.w, y, colour);

// ---------------------------------------------------------------------------------------------------- the sky slot: the roof band

/** Where the roof band ends (art y from the top, game y 40); gallery base runs on below it and is the camera's background. */
export const MINA_SKY_END = 160;
/** The height of the dither strip at the roof band's end (art px). */
export const MINA_STRIP = 2;

/** The dither strip at the roof band's end, 1920 x 2 art px: a checker of 2 px cells, gallery deep and gallery base (GDD-ART-05). */
export function drawMinaSkyStrip() {
  const g = new Grid(WIDTH, MINA_STRIP);
  for (let y = 0; y < MINA_STRIP; y++) for (let x = 0; x < WIDTH; x++) g.set(x, y, Math.floor(x / 2) % 2 === 0 ? GALLERY_DEEP : GALLERY_BASE);
  return g;
}

// ---------------------------------------------------------------------------------------------------- far: the old workings

/** The far band underground: screen game y 40 to 200, 480 x 160 game px, scrolling at 0.3; below it the flat foot in gallery deep. */
export const FAR_MINA = { top: 40, w: 480, h: 160 };
/** The flat foot below the far band: gallery deep, so a pit is a black shaft. */
export const MINA_FOOT = GALLERY_DEEP;

/**
 * The two dark side tunnels of the far strip, the only gallery deep in it: their openings' boxes in screen game px, every bound included.
 * Each has a small timber frame round it, outside the box.
 */
export const TUNNELS = [
  { x0: 96, x1: 123, y0: 168, y1: 199 },
  { x0: 320, x1: 345, y0: 173, y1: 199 },
];

/**
 * The wall's strata: long lines of gallery lit that slant gently up and down across the strip, one wave every 480 px so they run on over
 * the seam, at uneven heights (screen y at the strip's left edge) so they never read as ruled lines; each is broken into pieces.
 */
export const STRATA_MINA = [33, 57, 79, 98, 124, 146, 169, 193, 214];

/** A stratum's row at column x: its height, a slow wave 14 px deep that runs once across the strip, and a second, smaller one. */
export const strataRow = (y0, x, k) => Math.round(y0 + 14 * Math.sin((2 * Math.PI * x) / 480) + (3 + (k % 3)) * Math.sin((4 * Math.PI * x) / 480 + k));

/** The ore vein's course at column x (screen y), before its jagged steps: a slow wave across the strip and back, one every 480 px. */
export const veinRow = (x) => Math.round(118 + 22 * Math.sin((2 * Math.PI * x) / 480 + 2.2) + 6 * Math.sin((6 * Math.PI * x) / 480));

/** The far band's cells, 480 x 160 (screen game y 40 to 200). */
function farMinaCells() {
  const { top, w, h } = FAR_MINA;
  const c = new Cells(w, h);
  for (let i = 0; i < w * h; i++) c.cells[i] = GALLERY_BASE;
  const set = (x, y, colour) => wrapSet(c, x, y - top, colour);
  // The strata: pieces 6 to 33 px long with gaps of 5 to 24, now and then a row up or down; a piece's left end lit a row higher, where the
  // bed's lip catches the light. Each bed's pieces start somewhere of its own, so no piece ends at the seam.
  STRATA_MINA.forEach((y0, k) => {
    const start = 10 + Math.floor(noise(k, 305) * 60);
    for (let x = start; x < start + w; ) {
      const len = 6 + Math.floor(noise(x, 300 + k) * 28);
      const dy = noise(x, 320 + k) < 0.2 ? 1 : 0;
      for (let i = 0; i < len && x + i < start + w; i++) set(x + i, strataRow(y0, x + i, k) + dy, GALLERY_LIT);
      set(x, strataRow(y0, x, k) + dy - 1, GALLERY_LIT);
      x += len + 5 + Math.floor(noise(x, 340 + k) * 20);
    }
  });
  // The ore vein: a broken, jagged line of steel that wanders across the strip and back over the seam, swelling to two rows in places, a
  // mist white glint every 20 px or so.
  const vein = (x) => veinRow(x) + Math.floor(noise(x >> 2, 363) * 3) - 1;
  for (let x = 0; x < w; x++) {
    if (noise(x >> 2, 360) < 0.3) continue;
    set(x, vein(x), STEEL);
    if (noise(x >> 3, 361) < 0.3) set(x, vein(x) + 1, STEEL);
  }
  for (let block = 0; block < w / 20; block++) {
    const x = block * 20 + 4 + Math.floor(noise(block, 362) * 12);
    set(x, vein(x), MIST);
  }
  // The side tunnels: dark openings with rounded top corners, each in a small frame of timber dark, its posts' left edges and its cap's top
  // lit in gallery lit.
  for (const { x0, x1, y0, y1 } of TUNNELS) {
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const cut = [4, 2, 1][y - y0] ?? 0;
        const corner = x < x0 + cut || x > x1 - cut;
        if (!corner) set(x, y, GALLERY_DEEP);
      }
    }
    for (let y = y0 - 1; y <= y1; y++) {
      for (const px of [x0 - 3, x1 + 1]) {
        set(px, y, GALLERY_LIT);
        set(px + 1, y, TIMBER_DARK);
        set(px + 2, y, TIMBER_DARK);
      }
    }
    for (let x = x0 - 5; x <= x1 + 5; x++) {
      set(x, y0 - 4, GALLERY_LIT);
      set(x, y0 - 3, TIMBER_DARK);
      set(x, y0 - 2, TIMBER_DARK);
    }
  }
  return c;
}

/** The far band underground, 1920 x 640 art px: a tileSprite at 0.3, repeating every 480 game px. */
export function drawFarMina() {
  return farMinaCells().scaled();
}

// ---------------------------------------------------------------------------------------------------- mid: the gallery's timbering

/** The mid band underground: screen game y 100 to 224, 480 x 124 game px, scrolling at 0.5. Its bottom is the floor's top (row 14). */
export const MID_MINA = { top: 100, w: 480, h: 124 };
/** Where the mid band's wall foot starts (screen y): from there to the floor it is filled, so the foot's gallery deep shows only in a pit. */
export const MID_MINA_FOOT = 200;

/**
 * The timber sets, one every 80 px: [left post's x, the gap between the posts, the cap's top (screen y), whether knee braces stiffen it],
 * a little uneven from set to set so they read as old timbering, not a fence.
 */
const SETS = [[24, 22, 114, false], [102, 24, 117, true], [184, 21, 112, false], [262, 23, 118, true], [343, 22, 115, false], [423, 24, 116, true]];
/** A set's post width and cap thickness (game px). */
const POST = 4;
const CAP = 5;
/** The sets the carbide lamps hang from: every second one. */
const LAMP_SETS = [0, 2, 4];
/** A carbide lamp, 6 x 8: an iron dark cage round an ochre light core in lamp amber. */
const LAMP = ['..ii..', '.iiii.', 'iaLLai', 'iLLLLi', 'iaLLai', 'iaaaai', '.iiii.', '..ii..'];

/** Where each lamp is drawn: its top left (screen game px) and its size, hanging on a hook 2 px under the middle of its set's cap. */
export const LAMPS = LAMP_SETS.map((i) => {
  const [x, gap, cap] = SETS[i];
  return { x: x + POST + Math.floor(gap / 2) - 3, y: cap + CAP + 2, w: 6, h: 8 };
});

/**
 * The pool of light round each lamp, on the wall: an eight-sided patch about 42 px across, gallery lit, solid in its middle and fading out
 * through a checker and then a sparser dither over its outer `rim` px.
 */
const POOL = { rx: 21, ry: 18, rim: 7, sparse: 3 };

/** The mid band's cells, 480 x 124 (screen game y 100 to 224). */
function midMinaCells() {
  const { top, w, h } = MID_MINA;
  const c = new Cells(w, h);
  const set = (x, y, colour) => wrapSet(c, x, y - top, colour);
  const get = (x, y) => c.get(((x % w) + w) % w, y - top);
  // The wall's foot, from y 200 to the floor, filled: gallery base with a few broken beds of gallery lit and a row of rubble against the
  // floor, its stones lit on their upper left.
  for (let y = MID_MINA_FOOT; y < top + h; y++) for (let x = 0; x < w; x++) set(x, y, GALLERY_BASE);
  for (const [row, salt] of [[205, 401], [213, 402]]) {
    for (let x = 0; x < w; ) {
      const len = 5 + Math.floor(noise(x, salt) * 20);
      for (let i = 0; i < len && x + i < w; i++) set(x + i, row + (noise(x, salt + 10) < 0.3 ? 1 : 0), GALLERY_LIT);
      x += len + 4 + Math.floor(noise(x, salt + 20) * 14);
    }
  }
  for (let x = 0; x < w; x += 3 + Math.floor(noise(x, 410) * 5)) {
    if (noise(x, 411) < 0.35) continue;
    set(x, 221, GALLERY_LIT);
    set(x + 1, 221, GALLERY_LIT);
    set(x, 222, GALLERY_LIT);
  }
  // The pools of light, painted on the wall behind the timbering, crossed by the wall's beds in gallery base so they read as lit rock, not
  // as a disc or a hole.
  for (const { x: lx, y: ly } of LAMPS) {
    const cx = lx + 3, cy = ly + 6;
    for (let y = cy - POOL.ry; y <= cy + POOL.ry; y++) {
      for (let x = cx - POOL.rx; x <= cx + POOL.rx; x++) {
        const dx = Math.abs(x + 0.5 - cx), dy = Math.abs(y + 0.5 - cy);
        const d = Math.max(dx / POOL.rx, dy / POOL.ry, (dx / POOL.rx + dy / POOL.ry) / 1.42);
        if (d > 1 || y >= MID_MINA_FOOT) continue;
        if (d > 1 - POOL.sparse / POOL.rx ? (x + 2 * y) % 4 !== 0 : d > 1 - POOL.rim / POOL.rx && (x + y) % 2 !== 0) continue;
        set(x, y, GALLERY_LIT);
      }
    }
    for (const [dy, x0, x1] of [[-8, -15, -4], [-6, 3, 13], [2, -18, -7], [4, -2, 10], [11, -12, 3], [12, 8, 16]]) {
      for (let x = cx + x0; x <= cx + x1; x++) {
        const y = cy + dy + Math.round((x - cx) * 0.12);
        if (get(x, y) === GALLERY_LIT) set(x, y, GALLERY_BASE);
      }
    }
  }
  // The ore chute between the second and third sets: a trough of timber dark slanting down to the right, its lip lit, lumps of ore in it,
  // on two legs, a board across its low end.
  const chute = (x) => 146 + Math.round((x - 140) * 1.15);
  for (let x = 140; x <= 171; x++) {
    set(x, chute(x) - 1, GALLERY_LIT);
    for (let k = 0; k < 4; k++) set(x, chute(x) + k, TIMBER_DARK);
  }
  for (let x = 141; x <= 168; x += 4 + (x % 3)) {
    set(x, chute(x) - 2, STEEL);
    set(x + 1, chute(x + 1) - 2, STEEL);
    set(x + 1, chute(x + 1) - 3, STEEL);
    set(x + 2, chute(x + 2) - 2, IRON_DARK);
  }
  for (let y = chute(171) - 4; y < chute(171) + 4; y++) {
    set(171, y, GALLERY_LIT);
    set(172, y, TIMBER_DARK);
    set(173, y, TIMBER_DARK);
  }
  for (const lx of [145, 164]) {
    for (let y = chute(lx + 1) + 4; y < MID_MINA_FOOT + 22; y++) {
      set(lx, y, GALLERY_LIT);
      set(lx + 1, y, TIMBER_DARK);
      set(lx + 2, y, TIMBER_DARK);
    }
  }
  // The ladder between the fifth and sixth sets: two rails 2 px wide, rungs every 6 px, standing on the floor against the wall.
  for (let y = 128; y < top + h; y++) {
    for (const rx of [389, 399]) {
      set(rx, y, GALLERY_LIT);
      set(rx + 1, y, TIMBER_DARK);
    }
    if ((y - 130) % 6 === 0) for (let x = 391; x < 399; x++) set(x, y, TIMBER_DARK);
  }
  // The timber sets: two posts 4 px wide, their left edges lit, under a cap 5 px thick that overhangs them, its top and left end lit; every
  // second set without a lamp stiffened by knee braces from its posts up to its cap.
  for (const [x0, gap, cap, braced] of SETS) {
    const posts = [x0, x0 + POST + gap];
    for (let y = cap + CAP; y < top + h; y++) {
      for (const px of posts) {
        set(px, y, GALLERY_LIT);
        for (let k = 1; k < POST; k++) set(px + k, y, TIMBER_DARK);
      }
    }
    for (let x = x0 - 3; x <= posts[1] + POST + 2; x++) {
      for (let y = cap; y < cap + CAP; y++) set(x, y, y === cap || x === x0 - 3 ? GALLERY_LIT : TIMBER_DARK);
    }
    if (!braced) continue;
    for (let k = 0; k < 5; k++) {
      for (const [px, dir] of [[posts[0] + POST, 1], [posts[1] - 1, -1]]) {
        set(px + dir * k, cap + CAP + 4 - k, TIMBER_DARK);
        set(px + dir * (k + 1), cap + CAP + 4 - k, TIMBER_DARK);
      }
    }
  }
  // The lamps, each on a short hook of iron dark under its cap.
  for (const { x, y } of LAMPS) {
    set(x + 2, y - 2, IRON_DARK);
    set(x + 3, y - 2, IRON_DARK);
    set(x + 2, y - 1, IRON_DARK);
    const lamp = fromRows(LAMP);
    for (let j = 0; j < lamp.h; j++) for (let i = 0; i < lamp.w; i++) if (lamp.get(i, j) !== null) set(x + i, y + j, lamp.get(i, j));
  }
  return c;
}

/** The mid band underground, 1920 x 496 art px: a tileSprite at 0.5, repeating every 480 game px, see-through between its pieces. */
export function drawMidMina() {
  return midMinaCells().scaled();
}

// ---------------------------------------------------------------------------------------------------- ground underground

/**
 * One ground tile underground: the canyon's top tile with no grass (the same walk line and pale ledge over a trodden floor with two chips
 * of ochre shade and one of steel) or its rock tile with a streak of ore (steel, one mist white pixel) where the canyon's has lichen.
 */
function drawMinaTile(top, version) {
  const c = drawTile(top, version);
  if (top) {
    for (let y = 1; y < 4; y++) for (let x = 0; x < 16; x++) c.set(x, y, OCHRE);
    const chips = version === 0 ? [[3, 2, OCHRE_SHADE], [4, 2, OCHRE_SHADE], [11, 1, OCHRE_SHADE], [8, 3, STEEL]] : [[6, 1, OCHRE_SHADE], [12, 3, OCHRE_SHADE], [13, 3, OCHRE_SHADE], [2, 3, STEEL]];
    for (const [x, y, colour] of chips) c.set(x, y, colour);
    return c;
  }
  if (version === 1) {
    for (const [x, y] of [[7, 2], [8, 2], [8, 3]]) c.set(x, y, OCHRE);
    for (const [x, y, colour] of [[6, 3, STEEL], [7, 3, STEEL], [8, 2, MIST], [9, 2, STEEL]]) c.set(x, y, colour);
  }
  return c;
}

/** The ground sheet underground, 1792 x 64, in the outdoor sheet's layout: top and rock tiles, the six slopes (a ramp) and the tiles under them. */
export function drawGroundMina() {
  return groundSheet(drawMinaTile);
}

// ---------------------------------------------------------------------------------------------------- decor underground

/** The seven decor kinds underground, in game px: ore heap, timber stack, barrel, pick and shovel, ore bucket, lantern on a peg post, ore sacks. */
export const MINA_DECOR_SIZES = [[14, 8], [16, 10], [10, 12], [12, 16], [10, 10], [8, 24], [14, 10]];

/** A heap of ore, 14 x 8: angular grey stones, steel lit on their upper left and iron dark in shade, with two silver glints. */
const ORE_HEAP = [
  '......SS......',
  '.....SMSi.....',
  '...SSSSiiS....',
  '..SSiSSSiSSi..',
  '.SSSSiiSSSSii.',
  'SSMSSSiiSSiSii',
  'SSSiSSSiSSSiii',
  'iiiKiiiiiiKiii',
];

/** A stack of spare timbers lying flat, 16 x 10, staggered so it reads as a pile: lit tops, timber faces, dark undersides, end grain on the left. */
const TIMBER_STACK = [
  '....TTTTTTTTT...',
  '....dTtttttttd..',
  '....ddddddddddd.',
  '.TTTTTTTTTTTTT..',
  '.dTtttttttttttd.',
  '.ddddddddddddddd',
  'TTTTTTTTTTTTTTTT',
  'dTttttttttttttdd',
  'tdtttttttttttttd',
  'dddddddddddddddd',
];

/** A barrel, 10 x 12: staves of timber with a lit left side, three iron dark hoops, a lid lit on top. */
const BARREL = [
  '..TTTTTT..',
  '.iiiiiiii.',
  '.Tttttttd.',
  'tTtttttttd',
  'tTtttttttd',
  'iiiiiiiiii',
  'tTtttttttd',
  'tTtttttttd',
  '.Tttttttd.',
  '.iiiiiiii.',
  '.Tttttttd.',
  '..dddddd..',
];

/** A pick and a shovel leaning together, 12 x 16: timber handles, the pick's iron head across the top, the shovel's steel blade at the foot. */
const PICK_SHOVEL = [
  '.TTT........',
  '.T.T..iiii..',
  '..T..iSSSSi.',
  '..T.i..t...i',
  '...T...t....',
  '...T...t....',
  '...T....t...',
  '....T...t...',
  '....T....t..',
  '...STS...t..',
  '..SSSSi..t..',
  '..SMSSi...t.',
  '..SSSSi...t.',
  '..SSSSi...t.',
  '...SSi....tt',
  '....i.....tt',
];

/** An ore bucket with its rope coiled, 10 x 10: an iron bucket with a steel rim and bail, the rope beside it in loose loops. */
const BUCKET = [
  '...iii....',
  '..i...i...',
  '.i.....i..',
  'SSSSSSSS..',
  'iSiiiiii..',
  'iSiiiiii..',
  'iSiiiiiiT.',
  '.Siiiii.tT',
  '.SiiiiiTtT',
  '..iiiiiTTt',
];

/** An unlit lantern on a peg post, 8 x 24: a post of timber, a peg, the lantern hanging from it dark (steel glass, no flame). */
const LANTERN_POST = [
  '.Td.....',
  '.Td.....',
  '.Tdttt..',
  '.Td..i..',
  '.Td.iii.',
  '.Td.iSi.',
  '.Td.iSi.',
  '.Td.iii.',
  '.Td.....',
  '.Td.....',
  '.Td.....',
  '.Td.....',
  '.Td.....',
  '.Td.....',
  '.Td.....',
  '.Td.....',
  '.Td.....',
  '.Td.....',
  '.Td.....',
  '.Td.....',
  '.Td.....',
  '.Td.....',
  'TTdd....',
  'tddd....',
];

/** A pile of ore sacks, 14 x 10: burlap in timber lit and timber, tied at their necks in timber dark. */
const SACKS = [
  '..TT......T...',
  '..dd.....TT...',
  '.TTtt....dd...',
  'TTTtt...TTtt..',
  'TTTttt.TTTttt.',
  'TTTTttdTTTtttt',
  'TTTTttdTTTtttt',
  'TTTttttTTTtttt',
  'TTttttdTTttttd',
  '.ddddd..ddddd.',
];

/** The seven decor items underground, in the order of their kind. */
function minaDecorCells() {
  return [ORE_HEAP, TIMBER_STACK, BARREL, PICK_SHOVEL, BUCKET, LANTERN_POST, SACKS].map(fromRows);
}

/** The decor sheet underground, 448 x 160 art px: seven frames of 16 x 40 game px, each item bottom-aligned and centred. Frame n is kind n. */
export function drawDecorMina() {
  const g = new Grid(DECOR_FRAME.w * S * MINA_DECOR_SIZES.length, DECOR_FRAME.h * S);
  minaDecorCells().forEach((cells, n) => {
    const frame = new Cells(DECOR_FRAME.w, DECOR_FRAME.h);
    stamp(frame, cells, (DECOR_FRAME.w - cells.w) >> 1, DECOR_FRAME.h - cells.h);
    const px = frame.scaled();
    for (let y = 0; y < px.height; y++) for (let x = 0; x < px.width; x++) g.set(n * DECOR_FRAME.w * S + x, y, px.get(x, y));
  });
  return g;
}

// ---------------------------------------------------------------------------------------------------- the rock back wall

/**
 * The back wall's marks on ochre shade, [x, y, colour] by version: short broken pieces of bedding and a small crack in rock deep, a few
 * ochre specks. None touches the tile's edges, so tiles of either version meet on every side without a seam, and no bed runs through a
 * whole tile, so a tall wall of them never reads as stripes.
 */
const BACKWALL_MARKS = [
  [[2, 4, 'K'], [3, 4, 'K'], [4, 4, 'K'], [5, 5, 'K'], [6, 5, 'K'], [10, 11, 'K'], [11, 11, 'K'], [12, 11, 'K'], [13, 12, 'K'], [9, 7, 'K'], [9, 8, 'K'], [8, 9, 'K'], [5, 12, 'O'], [12, 3, 'O']],
  [[7, 3, 'K'], [8, 3, 'K'], [9, 3, 'K'], [10, 4, 'K'], [1, 10, 'K'], [2, 10, 'K'], [3, 10, 'K'], [4, 11, 'K'], [5, 11, 'K'], [12, 8, 'K'], [12, 9, 'K'], [13, 10, 'K'], [4, 6, 'O'], [10, 13, 'O']],
];

/**
 * One back wall tile, 16 x 16 cells: the rock in shade behind a gallery cut into a cliff: ochre shade with a few short pieces of rock deep
 * bedding, a small crack and a few ochre specks, darker and quieter than the rock tile and with no walk line.
 */
function drawBackwallTile(version) {
  const c = new Cells(16, 16);
  for (let i = 0; i < 256; i++) c.cells[i] = OCHRE_SHADE;
  for (const [x, y, ink] of BACKWALL_MARKS[version]) c.set(x, y, INK[ink]);
  return c;
}

/** The back wall sheet, 128 x 64 art px: its two versions, a tile each. */
export function drawBackwall() {
  const g = new Grid(2 * 64, 64);
  [0, 1].forEach((v) => {
    const px = drawBackwallTile(v).scaled();
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) g.set(v * 64 + x, y, px.get(x, y));
  });
  return g;
}
