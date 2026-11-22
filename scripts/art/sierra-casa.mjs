// World 3's (Sierra) art for La Catorce's arena, 3-4 La Casa de Máquinas (GDD-ART-06, GDD-BOS-04): the engine shed's back wall, drawn in
// code beside the canyon's and the mine's (`sierra.mjs`, `sierra-mina.mjs`) in the same 24 colours, light from the upper left, whole game
// pixels (4 x 4 art pixels), no outline. One screen, since the arena's camera does not move: dressed stone in peak base with peak lit
// courses, three tall round-arched openings through which the sky and the ridges show, the roof's boards and its timber truss above, a
// round water tank on a timber stand and a coal bunker against the wall. The stone is pale behind her whole run, so a black engine reads.
import { Cells, noise, S } from './cells.mjs';
import { SIERRA_PALETTE } from './sierra.mjs';

const {
  mistWhite: MIST, peakLit: PEAK_LIT, peakBase: PEAK, peakShade: PEAK_SHADE, timberLit: TIMBER_LIT, timber: TIMBER, timberDark: TIMBER_DARK,
  steel: STEEL, ironDark: IRON_DARK, galleryDeep: GALLERY_DEEP, galleryBase: GALLERY_BASE, rockDeep: ROCK_DEEP,
} = SIERRA_PALETTE;

/** The shed's back wall: screen game y 0 to 224 (the floor's top, row 14), 480 px wide; it does not scroll. */
export const MID_CASA = { top: 0, w: 480, h: 224 };
/** The roof's boards run down to here; the truss's tie beam lies under them. */
export const ROOF = { bottom: 40, beam: 5 };
/** The three arched openings: [left, right) in x, round-headed, from the sill line up; see-through. */
export const ARCHES = [[60, 140], [200, 280], [340, 420]];
/** The arches' sill (the opening's bottom) and the line their round heads spring from. */
export const SILL = 184;
export const SPRING = 104;
/** The water tank on its timber stand, at the right wall under the perch; the coal bunker at the left wall, its coal heaped above y 192, her top. */
export const TANK = { x0: 434, x1: 476, top: 122, bottom: 158 };
export const BUNKER = { x0: 4, x1: 50, top: 191 };
/** The two iron rods the gantry (home, columns 14 and 15, row 10) hangs from. */
export const RODS = [227, 252];
export const HOME_TOP = 160;

/** Whether (x, y) lies in an arched opening. */
export function inArch(x, y) {
  return ARCHES.some(([x0, x1]) => {
    if (x < x0 || x >= x1 || y >= SILL) return false;
    if (y >= SPRING) return true;
    const r = (x1 - x0) / 2;
    return Math.hypot(x + 0.5 - (x0 + r), y + 0.5 - SPRING) <= r;
  });
}

/** The back wall's cells, 480 x 224. */
function midCasaCells() {
  const { w, h } = MID_CASA;
  const c = new Cells(w, h);
  // The stone: peak base, in courses 12 px tall of blocks 24 px long, each course half a block off the one above; the joints in peak
  // shade, broken, and a lit upper edge on some blocks.
  for (let y = ROOF.bottom; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const course = Math.floor((y - ROOF.bottom) / 12);
      const inCourse = (y - ROOF.bottom) % 12;
      const bx = x + (course % 2) * 12;
      const block = Math.floor(bx / 24);
      const inBlock = bx % 24;
      let colour = PEAK;
      if (inCourse === 0 && noise(block, course) < 0.5) colour = PEAK_LIT;
      if (inCourse === 11 && noise(block + 50, course) < 0.7) colour = PEAK_SHADE;
      if (inBlock === 23 && inCourse > 0 && noise(block + 90, course) < 0.6) colour = PEAK_SHADE;
      c.set(x, y, colour);
    }
  }
  // Two string courses in peak lit: at the arches' springing line and at their sill.
  for (const y of [SPRING, SILL]) {
    for (let x = 0; x < w; x++) {
      c.set(x, y, PEAK_LIT);
      c.set(x, y + 1, PEAK_LIT);
      c.set(x, y + 2, PEAK_SHADE);
    }
  }
  // Soot low on the wall, where she runs: specks of peak shade under the sill.
  for (let y = SILL + 4; y < h; y++) for (let x = 0; x < w; x++) if (noise(x * 7 + 3, y * 13 + 1) < 0.035) c.set(x, y, PEAK_SHADE);
  // The arches: the opening see-through, a ring of pale voussoirs round its head, the jambs lit, the reveal's shade inside the upper left.
  for (let y = ROOF.bottom; y < SILL + 3; y++) {
    for (let x = 0; x < w; x++) {
      if (inArch(x, y)) {
        c.set(x, y, null);
        continue;
      }
      const near = [[1, 0], [-1, 0], [0, 1], [0, -1], [2, 0], [-2, 0], [0, 2], [0, -2], [3, 0], [-3, 0], [0, -3], [1, 1], [-1, 1], [1, -1], [-1, -1], [2, 2], [-2, 2], [2, -2], [-2, -2]];
      if (y < SILL && near.some(([dx, dy]) => inArch(x + dx, y + dy))) c.set(x, y, PEAK_LIT);
    }
  }
  for (const [x0, x1] of ARCHES) {
    const cx = (x0 + x1) / 2;
    const r = (x1 - x0) / 2;
    // The voussoirs' joints, every 15 degrees round the head, and the keystone.
    for (let a = 15; a < 180; a += 15) {
      const t = (a * Math.PI) / 180;
      for (let d = r; d < r + 4; d++) {
        const x = Math.floor(cx - Math.cos(t) * d), y = Math.floor(SPRING - Math.sin(t) * d);
        if (!inArch(x, y)) c.set(x, y, PEAK_SHADE);
      }
    }
    for (let y = SPRING - r - 6; y < SPRING - r; y++) for (let x = cx - 3; x < cx + 3; x++) c.set(x, Math.floor(y), y < SPRING - r - 5 || x < cx - 2 ? MIST : PEAK_LIT);
    // The reveal: the wall's thickness seen inside the opening's left and top, in peak shade.
    for (let y = ROOF.bottom; y < SILL; y++) {
      for (let x = x0; x < x1; x++) {
        if (inArch(x, y) && (!inArch(x - 1, y) || !inArch(x - 2, y) || !inArch(x, y - 1) || !inArch(x - 1, y - 1))) c.set(x, y, PEAK_SHADE);
      }
    }
    // The sill's slab, a little wider than the opening.
    for (let x = x0 - 3; x < x1 + 3; x++) {
      c.set(x, SILL, MIST);
      c.set(x, SILL + 1, PEAK_LIT);
      c.set(x, SILL + 2, PEAK_SHADE);
    }
  }
  // The roof: boards in timber dark with their gaps in gallery deep, the purlins' ends, and under them the truss: a tie beam the whole
  // width with a row of braces up to the ridge.
  for (let y = 0; y < ROOF.bottom; y++) {
    for (let x = 0; x < w; x++) c.set(x, y, y % 8 === 7 ? GALLERY_DEEP : TIMBER_DARK);
  }
  // The truss is shallow, 16 px under the boards, so the HUD above it lies on plain boards: a top chord, and braces in a row of Ws.
  for (let x = 0; x < w; x++) {
    c.set(x, ROOF.bottom - 18, TIMBER_LIT);
    c.set(x, ROOF.bottom - 17, TIMBER);
    c.set(x, ROOF.bottom - 16, TIMBER_DARK);
  }
  for (let x0 = 0; x0 < w; x0 += 32) {
    for (let i = 0; i < 15; i++) {
      for (let t = 0; t < 3; t++) {
        c.set(x0 + i + t, ROOF.bottom - 1 - i, t === 0 ? TIMBER_LIT : TIMBER);
        c.set(x0 + 16 + i + t, ROOF.bottom - 15 + i, t === 0 ? TIMBER_LIT : TIMBER);
      }
    }
  }
  for (let x = 0; x < w; x++) {
    for (let t = 0; t < ROOF.beam; t++) c.set(x, ROOF.bottom + t, t === 0 ? TIMBER_LIT : t === ROOF.beam - 1 ? TIMBER_DARK : TIMBER);
    if (!inArch(x, ROOF.bottom + ROOF.beam)) c.set(x, ROOF.bottom + ROOF.beam, PEAK_SHADE);
  }
  for (let x0 = 0; x0 < w; x0 += 32) for (let t = 0; t < 3; t++) for (let y = ROOF.bottom; y < ROOF.bottom + ROOF.beam; y++) if (t !== 1) c.set(x0 + t, y, IRON_DARK);
  // The gantry's rods: iron, 1 px, from the tie beam down to home's top.
  for (const x of RODS) for (let y = ROOF.bottom + ROOF.beam; y < HOME_TOP; y++) c.set(x, y, y % 16 === 0 ? STEEL : IRON_DARK);
  // The water tank: timber staves between iron hoops, round-ended, on a stand of four legs with a cross brace; a spout towards the room.
  const { x0: tx0, x1: tx1, top: tt, bottom: tb } = TANK;
  for (let y = tt; y < tb; y++) {
    for (let x = tx0; x < tx1; x++) {
      const edge = x === tx0 || x === tx1 - 1;
      if (edge && (y === tt || y === tb - 1)) continue;
      const hoop = y === tt + 4 || y === tt + 5 || y === tb - 6 || y === tb - 5 || y === Math.floor((tt + tb) / 2);
      const stave = (x - tx0) % 6 === 5;
      c.set(x, y, hoop ? IRON_DARK : x < tx0 + 5 ? TIMBER_LIT : x >= tx1 - 6 ? TIMBER_DARK : stave ? TIMBER_DARK : TIMBER);
    }
  }
  for (let x = tx0 - 2; x < tx1 + 2; x++) {
    c.set(x, tt - 2, TIMBER_LIT);
    c.set(x, tt - 1, TIMBER);
    c.set(x, tb, TIMBER_LIT);
    c.set(x, tb + 1, TIMBER);
    c.set(x, tb + 2, TIMBER_DARK);
  }
  for (const lx of [tx0 + 2, tx0 + 14, tx1 - 17, tx1 - 5]) {
    for (let y = tb + 3; y < h; y++) for (let t = 0; t < 3; t++) c.set(lx + t, y, t === 0 ? TIMBER_LIT : t === 2 ? TIMBER_DARK : TIMBER);
  }
  for (let i = 0; i < tx1 - tx0 - 6; i++) {
    const y = tb + 8 + Math.floor((i * (h - tb - 20)) / (tx1 - tx0 - 6));
    c.set(tx0 + 3 + i, y, TIMBER);
    c.set(tx0 + 3 + i, y + 1, TIMBER_DARK);
    c.set(tx1 - 4 - i, y, TIMBER);
    c.set(tx1 - 4 - i, y + 1, TIMBER_DARK);
  }
  for (let i = 0; i < 12; i++) {
    c.set(tx0 - 1 - i, tb - 9 + Math.floor(i / 3), IRON_DARK);
    c.set(tx0 - 1 - i, tb - 8 + Math.floor(i / 3), IRON_DARK);
  }
  // The coal bunker: three timber boards between posts, the coal heaped above them in gallery deep with gallery base glints.
  const { x0: bx0, x1: bx1, top: bt } = BUNKER;
  for (let x = bx0 + 2; x < bx1 - 2; x++) {
    const rise = Math.round(7 * Math.sin((Math.PI * (x - bx0)) / (bx1 - bx0)) + 2 * noise(x, 77));
    for (let y = bt - rise; y < bt; y++) c.set(x, y, noise(x * 3, y * 5) < 0.18 ? GALLERY_BASE : noise(x * 5, y * 3) < 0.06 ? STEEL : GALLERY_DEEP);
  }
  for (let y = bt; y < h; y++) {
    for (let x = bx0; x < bx1; x++) {
      const post = x < bx0 + 3 || x >= bx1 - 3;
      const row = (y - bt) % 9;
      c.set(x, y, post ? (x === bx0 || x === bx1 - 3 ? TIMBER_LIT : TIMBER_DARK) : row === 0 ? TIMBER_LIT : row === 8 ? ROCK_DEEP : TIMBER);
    }
  }
  return c;
}

/** The engine shed's back wall, 1920 x 896 art px: one image the width of the screen, see-through in its arches. */
export function drawMidCasa() {
  return midCasaCells().scaled();
}

export { S };
