// Level 3-1, "La Barranca", the first level of World 3 (GDD-WLD-16, GDD-WLD-01): eight screens wide and three tall, 240 x 51 tiles
// (3840 x 816 px). The path leaves the hill town and goes down a canyon of the Sierra Madre to the mine's mouth, one descent with no climb
// but 1-tile steps. It is the first level made for the glide (GDD-MOV-07, GDD-PRG-01), in four beats (kishōtenketsu):
// - Ki, columns 0 to 63: the glide where nothing can go wrong. A flat rim with the tip and four hilos on a glided jump's line; a trench he
//   cannot glide into for good (a step at its near side lets him out); a stone lip over solid ground 5 tiles down, where height buys
//   distance and a held jump lands 17 tiles on.
// - Shō, columns 64 to 135: real pits. A 7-tile chasm only the glide crosses; a pen whose Alacrán a rock-to-rock glide passes over; the
//   first Murciélago alone over flat ground, half its loop in his way; a 9-tile chasm with a bat down in it, under every flight across.
// - Ten, columns 136 to 186: the ledges fall, and the path folds back down a cliff face. Two crumbling ledges over a floor (F1) that
//   catches a miss, where a held glide overshoots and he learns to let go; a glide along F1 into a shaft; the middle gallery right to left
//   over a crumbling floor that drops him into the lower gallery, the way on; a second pen there; then two crumbling ledges as the only
//   floor over an 18-tile pit, with a price for a glide held too long.
// - Ketsu, columns 187 to 239: all of it. A crumbling ledge between two 4-tile gaps, a bat patrolling the ledge after it, and the last
//   glide to the canyon floor past two bats, one to pass or stomp and one to read. Under the last lip, a pillar holds the veladora.
// A ground stretch is solid from its top row down to the level's last row; a pit is open to its raised bottom (GDD-WLD-03), and the last
// pit to the level's last row. Its crumbled ledges come back (GDD-WLD-05).
import { TILE } from '../config/tuning';
import type { Bottom } from '../sim/bottoms';
import type { Crumble } from '../sim/crumble';
import type { Enemy } from '../sim/enemy';
import type { Hilo } from '../sim/hilo';
import type { Pinata } from '../sim/pinata';
import type { Level, Ofrenda } from '../sim/run';
import { parseTiles } from '../sim/tilemap';
import type { Veladora } from '../sim/veladora';
import type { Tip } from '../ui/tips';

const WIDTH = 240;
const HEIGHT = 51;

/** The middle of tile column `col`, in px. */
const mid = (col: number) => col * TILE + TILE / 2;

/** A stretch of columns `col0` to `col1` (both included) whose ground's top is `row`. */
export interface Stretch {
  readonly col0: number;
  readonly col1: number;
  readonly row: number;
}

const stretch = (col0: number, col1: number, row: number): Stretch => ({ col0, col1, row });

/** GDD-WLD-16: the second pen's rocks in the lower gallery (row 37), its Alacrán between them. */
const LOWER_PEN = { rock0: 153, rock1: 161 } as const;

/**
 * GDD-WLD-16: the ground, left to right: each stretch solid from its top row down to the level's last row. The columns no stretch holds
 * are the five pits. The rim (row 9) with the trench's step and floor; the stone over the long glide; the first chasm's banks and the pen's
 * rocks (row 14); the second chasm's far bank and its stone; the lower gallery's floor (row 38) with its pen's rocks; the rest past the
 * pit of Ten; the ledge of the third ofrenda, the pillar and the canyon floor.
 */
export const LEVEL_3_1_GROUND: readonly Stretch[] = [
  stretch(0, 17, 9),
  stretch(18, 18, 11),
  stretch(19, 23, 13),
  stretch(24, 37, 9),
  stretch(38, 39, 8),
  stretch(40, 63, 13),
  stretch(71, 77, 15),
  stretch(78, 79, 14),
  stretch(80, 85, 15),
  stretch(86, 87, 14),
  stretch(88, 103, 15),
  stretch(113, 133, 19),
  stretch(134, 135, 18),
  stretch(136, LOWER_PEN.rock0 - 1, 38),
  stretch(LOWER_PEN.rock0, LOWER_PEN.rock0, 37),
  stretch(LOWER_PEN.rock0 + 1, LOWER_PEN.rock1 - 1, 38),
  stretch(LOWER_PEN.rock1, LOWER_PEN.rock1, 37),
  stretch(LOWER_PEN.rock1 + 1, 168, 38),
  stretch(187, 194, 41),
  stretch(206, 216, 43),
  stretch(217, 221, 47),
  stretch(227, 239, 48),
];

/** The ground's top row in column `col`, or undefined in a pit. */
const groundRow = (col: number): number | undefined => LEVEL_3_1_GROUND.find((s) => col >= s.col0 && col <= s.col1)?.row;

/** GDD-WLD-16: the pits, runs of columns with no ground: 64 to 70, 104 to 112, 169 to 186, 195 to 205 and 222 to 226. */
export const LEVEL_3_1_PITS: readonly { readonly col0: number; readonly col1: number }[] = (() => {
  const pits: { col0: number; col1: number }[] = [];
  for (let col = 0; col < WIDTH; col++) {
    if (groundRow(col) !== undefined) continue;
    const last = pits[pits.length - 1];
    if (last && last.col1 === col - 1) last.col1 = col;
    else pits.push({ col0: col, col1: col });
  }
  return pits;
})();

/** A solid block over columns `col0` to `col1` and rows `row0` to `row1` (all included). */
export interface Piece {
  readonly col0: number;
  readonly col1: number;
  readonly row0: number;
  readonly row1: number;
}

/**
 * GDD-WLD-16: the cliff face over the lower gallery: the upper floor F1 (rows 25 and 26) with its rock (column 150, row 24); the middle
 * gallery's floor F2 (row 31) either side of its crumbling tiles, with the shaft at 136 to 138 left of it; the buttress (columns 161 to
 * 164, rows 17 to 31), the right wall of both galleries. F1 ends at column 157, so 158 to 160 is the shaft from F1 down to F2.
 */
export const LEVEL_3_1_PIECES: readonly Piece[] = [
  { col0: 136, col1: 157, row0: 25, row1: 26 },
  { col0: 150, col1: 150, row0: 24, row1: 24 },
  { col0: 139, col1: 145, row0: 31, row1: 31 },
  { col0: 150, col1: 160, row0: 31, row1: 31 },
  { col0: 161, col1: 164, row0: 17, row1: 31 },
];

/** A crumbling ledge over columns `col0` to `col1`, one tile thick at `row`. */
const ledge = (col0: number, col1: number, row: number): Stretch => ({ col0, col1, row });

/**
 * GDD-WLD-05, GDD-WLD-16: the crumbling ledges, twenty tiles in six places: L1 and L2 down the cliff face over F1; the middle gallery's
 * floor; L3 and L4 over the pit of Ten; the Ketsu ledge between its two 4-tile gaps. They come back (`crumblesReturn`).
 */
export const LEVEL_3_1_LEDGES: readonly Stretch[] = [
  ledge(139, 141, 21),
  ledge(145, 147, 22),
  ledge(146, 149, 31),
  ledge(172, 174, 39),
  ledge(178, 181, 40),
  ledge(199, 201, 42),
];

const CRUMBLES: readonly Crumble[] = LEVEL_3_1_LEDGES.flatMap((l) => Array.from({ length: l.col1 - l.col0 + 1 }, (_, i) => ({ col: l.col0 + i, row: l.row })));

/**
 * GDD-WLD-03: the raised bottoms, each 4 rows under the lower of its pit's two lips: the first chasm (lips at rows 13 and 15), the second
 * (15 and 19), the pit of Ten (38 and 41) and the Ketsu pit (41 and 43). The last pit (lips at 47 and 48) is open to the level's last row.
 */
export const LEVEL_3_1_BOTTOMS: readonly Bottom[] = [
  { fromCol: 64, toCol: 70, row: 19 },
  { fromCol: 104, toCol: 112, row: 23 },
  { fromCol: 169, toCol: 186, row: 45 },
  { fromCol: 195, toCol: 205, row: 47 },
];

const inPiece = (col: number, row: number): boolean => LEVEL_3_1_PIECES.some((p) => col >= p.col0 && col <= p.col1 && row >= p.row0 && row <= p.row1);

export const LEVEL_3_1_ROWS: readonly string[] = Array.from({ length: HEIGHT }, (_, row) =>
  Array.from({ length: WIDTH }, (_tile, col) => {
    const top = groundRow(col);
    return (top !== undefined && row >= top) || inPiece(col, row) ? '#' : '.';
  }).join(''),
);

/** GDD-WLD-03: on the rim's flat at column 59 of the long glide's ground, at the rest before the cliff face (131), and on the Ketsu ledge (208). */
const OFRENDAS: readonly Ofrenda[] = [
  { id: '3-1-1', x: mid(59), y: 13 * TILE },
  { id: '3-1-2', x: mid(131), y: 19 * TILE },
  { id: '3-1-3', x: mid(208), y: 43 * TILE },
];

/** GDD-PWR-05: two piñatas, each 48 px over the ground with a stone to its right that turns the taco back: on the rim and at the rest. */
const PINATAS: readonly Pinata[] = [
  { col: 30, row: 5 },
  { col: 126, row: 15 },
];

/**
 * GDD-ENM-02, GDD-ENM-04: where the enemies start, in this order: the Alacrán of the first pen; the first Murciélago alone over flat
 * ground; the bat down in the second chasm, under every flight that crosses it (F1, under the ledges of Ten, has no enemy); the Alacrán of the lower pen; the patrol
 * bat at the Ketsu ledge's far end, at body height; the two bats of the last glide, the second half a loop behind.
 */
export const LEVEL_3_1_ENEMIES: readonly Enemy[] = [
  { x: mid(82), y: 15 * TILE },
  { x: mid(93), y: 188, kind: 'murcielago', ry: 24 },
  { x: mid(108), y: 320, kind: 'murcielago', ry: 24 },
  { x: mid(LOWER_PEN.rock0 + 4), y: 38 * TILE },
  { x: mid(214), y: 672, kind: 'murcielago', rx: 16 },
  { x: mid(220), y: 680, kind: 'murcielago', ry: 24 },
  { x: mid(225), y: 636, kind: 'murcielago', ry: 24, phase: 120 },
];

/** GDD-WLD-04: 50 hilos as (column, row) tiles, along the path, in the order the serape colours cycle through them. */
const HILOS: readonly Hilo[] = [
  [7, 4], [9, 5], [11, 6], [13, 7], [19, 4], [21, 5], [23, 6], [45, 5], [47, 6], [49, 7],
  [51, 8], [53, 10], [65, 8], [67, 9], [69, 10], [71, 11], [79, 13], [81, 9], [83, 10], [85, 11],
  [93, 8], [93, 7], [105, 10], [111, 13], [114, 15], [135, 17], [140, 20], [141, 20], [146, 21], [147, 21],
  [150, 17], [156, 21], [159, 22], [148, 30], [141, 30], [156, 33], [159, 34], [170, 33], [173, 38], [176, 34],
  [179, 39], [184, 35], [197, 36], [200, 41], [204, 37], [215, 42], [216, 42], [230, 46], [231, 46], [233, 47],
].map(([col, row]) => ({ col: col!, row: row! }));

/** GDD-LIFE-03, GDD-WLD-03: the secret, the veladora on the pillar under the last lip, in plain view. */
const VELADORA: Veladora = { col: 219, row: 46 };

/**
 * GDD-UI-05, GDD-WLD-16: one tip over the rim's flat and the trench, which teaches the glide; its highlight is the four hilos on a glided
 * jump's line over the flat, and on touch the jump button. It never goes for good.
 */
export const TIPS_3_1: readonly Tip[] = [
  {
    from: 0,
    to: 23,
    text: {
      en: { keyboard: 'Hold Space in the air to glide. Let go to drop', touch: 'Hold the jump button in the air to glide. Let go to drop', pad: 'Hold the bottom button in the air to glide. Let go to drop' },
      es: {
        keyboard: 'Mantén Espacio en el aire para planear. Suéltalo para caer',
        touch: 'Mantén el botón de salto en el aire para planear. Suéltalo para caer',
        pad: 'Mantén el botón inferior en el aire para planear. Suéltalo para caer',
      },
      de: {
        keyboard: 'Leertaste in der Luft halten zum Gleiten. Loslassen zum Fallen',
        touch: 'Sprungknopf in der Luft halten zum Gleiten. Loslassen zum Fallen',
        pad: 'Untere Taste in der Luft halten zum Gleiten. Loslassen zum Fallen',
      },
    },
    highlight: { col: 7, row: 4, w: 7, h: 4 },
    button: 'jump',
  },
];

/** GDD-WLD-16: 3-1 as a level, the data the scene plays and the validator checks (GDD-TEC-04). The exit stands at column 234 on the canyon floor. */
export const LEVEL_3_1: Level = {
  world: parseTiles(LEVEL_3_1_ROWS),
  spawn: { x: mid(3), y: 9 * TILE },
  ofrendas: OFRENDAS,
  spikes: [],
  crumbles: CRUMBLES,
  crumblesReturn: true,
  springs: [],
  platforms: [],
  tacos: [],
  pinatas: PINATAS,
  doors: [],
  keys: [],
  fragiles: [],
  enemies: LEVEL_3_1_ENEMIES,
  hilos: HILOS,
  veladora: VELADORA,
  exit: { x: mid(234), y: 48 * TILE },
  // GDD-PRG-01: World 3's levels are never played without the glide.
  abilities: { glide: true },
  bottoms: LEVEL_3_1_BOTTOMS,
};
