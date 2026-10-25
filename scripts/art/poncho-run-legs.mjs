// The legs of Poncho's four run frames as the user drew them (assets/characters/poncho/sprite-run.jpg, 2026-10-25).
// Each frame was scaled so its brim spans the standing drawing's 56 pixels, read cell by cell into the drawing's
// colours, and cleaned: only the legs are kept (from the drawing's row 63 down), the noise removed. The body above
// them is the standing drawing itself (poncho-pixels.mjs), so the run and the standing frames match pixel for pixel.
// The drawing's lines between the legs are kept; the outline around them is drawn again in code.
// '.' is transparent; the colours are the drawing's.

export const RUN_LEGS = [
  [
    '............F....#FFF...FFFFFFFFFFF#F#fF#...............',
    '............F...#FFFFFF..FFFFFFFFFsfffffF...............',
    '...............#FFFFFFFFF..FFFFFFFfffffff...............',
    '...............sssFFFFFFFFF#.#FFFFfffffff...............',
    '...............sssFFFFFFFF#...#FFFffffffF...............',
    '...............ssssFFFFF#......#FFFfffFFwww#............',
    '...............#ssssFF#.........#FFFFFwwwwFw............',
    '................#ssssss#.........#FFwwwwFwFp............',
    '.................sssFFss..........pppppp................',
  ],
  [
    '...........F......FFFsssFFFFFFFsFF....F.................',
    '...........F...FFFFFsfffffffsFFsssp.F##.................',
    '..............pFFFFFffffffffFFFFFFF##FFFF...............',
    '.............FppFFFFffffffffF#.....FFFFFF...............',
    '.............FpwFFFFffffffff#..FFFFFFFFFF...............',
    '.............FwwwFFFFfffffF#...#FFFFFFFFF...............',
    '.............FwwwpFFFFsffF#.....FFFFFFFF#...............',
    '.............FwFwwFFFFFFF#......FFFFFFFF................',
    '..............Fpww#.............FFFFFFFF................',
    '..............pwpw..............FFFFFFFF#...............',
    '..............Fpp#..............Fpppppppp#..............',
    '................................sppppppFpp..............',
    '................................FFFssFFFFF..............',
  ],
  [
    '...............FFFfffffffffFFFppppp#..F#................',
    '............#pFFFffffffffffFFFFFFFFF.#FFF...............',
    '............ppFFFfffffffffFFFFFFFFF.FFFFF...............',
    '............ppsFFffffffffFF#.......FFFFFFF..............',
    '............pppFFFffffffFF#......FFFFFFFFFF.............',
    '............pwwsFFFffffsF#.......#FFFFFFFFFF#...........',
    '............wwwpFFFFFsFF#.........#FFFFFFFFFpppp........',
    '............wppwF..................#FFFFFFspppps........',
    '............FFww#...................#FFFFpppFFpF........',
    '............#wwF.......................pppppF#..........',
    '.......................................#pp..............',
  ],
  [
    '..............#FFFFFFFFFFFFFFFFpppp...F#................',
    '..............sFFFFF..FFFFFFFFFFFFF....FF...............',
    '..............ppFFFFFF...FFFFFFFFFFF..FFF...............',
    '..............pppFFFFFFF#..........FFFFFF...............',
    '..............ppppFFFFFFF.......FFFFFFFF................',
    '..............ppppsF#...........FFFFFFFF................',
    '..............ppFpp.............FFFFFFFF#...............',
    '..............FFppF.............FFFFppppp#..............',
    '..............#ppFF.............ppppppFFpp..............',
    '................................pppppppFpF..............',
  ],
];
