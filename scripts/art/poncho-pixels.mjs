// Poncho's standing frame as the user drew it (assets/characters/poncho/sprite-pixel.jpg, 2026-10-25): its 100 x 100
// pixel grid read cell by cell, the figure's 56 x 71 pixels kept, the JPEG noise mapped to the nearest of its colours.
// One character per pixel; '.' is transparent. The tail is added in code (poncho.mjs), as the user asked.

export const COLOURS = {
  'b': '#3F66B1', // blue
  'd': '#2C3F7A', // blueDark
  'k': '#F2957D', // blush
  'w': '#FBDAB7', // cream
  'c': '#823241', // crimson
  'f': '#F1A361', // fur
  'F': '#B06948', // furDark
  's': '#C58D62', // furShade
  'n': '#2D1E39', // navy
  '#': '#070509', // outline
  'p': '#CD9A86', // pawShade
  'r': '#D23F42', // red
  'W': '#ECE3D9', // white
};

export const ROWS = [
  '.....................######.............................',
  '...................##crrrrc##...........................',
  '..................#ccrrrrrrrc#..........................',
  '.................#ccrrrrrrrrrc#....##...................',
  '................#ccrrrrr##rrrrc#..#FF#..................',
  '................#ccrrrr#ff#rrrbd##FFf#..................',
  '................#ccrrr#Ffff#bbbbd#FFf#.............####.',
  '...............#cccrr#Fffcwf#bbbbd#FFf#.......#####csss#',
  '...............#ccccb#fffckw#bbbbb#FFf#...####ccsssssbb#',
  '...............#cccd#Fffckkwf#bbrrc#Ff#####cssssbbbbbbb#',
  '...............#dddd#Fffckkkw#rrrrrc####cssssbbbbbbbbbb#',
  '...............#ddd#FFfckkkkwf#rrr####csssbbbbbbbbbbbrb#',
  '...............#ddd#Fffckkkkkw#r###csssbbbbbbbbbrbbbrrc#',
  '...............#dd#cFffckkkkk###csssbbbbbbrbbbbrrrbrrr#.',
  '...............#dc#FFffckkc###ssssbbbbbbbbrrbbbrrrrrrc#.',
  '...............#cc#FFffF###csssbbbbbbrbbbrrrrbrrrccc##..',
  '...............#cc#FF###csssbbbbbbbbbrrbbrrrccccc###....',
  '...............#cc###csssbbbbbbbrbbbrrrrrccccc###.......',
  '..............####cssssbbbbbbbbbrrbrrrrcc#####..........',
  '...........####cssssbbbbbbrrbbbrrrrrccc###F#............',
  '........####cFFFbbbbbbbbbbrrrbrrrccc###FFFFF#...........',
  '......###cFFFdddbbbbbrbbbrrrrrccc###FFFFFffw#...........',
  '...####FFFdddddddbbbbrrFbrcccc###FFFFFFffffws#..........',
  '.###FFFddddddddccdbbrrcccccc##FFFFFFffffffffw#..........',
  '#FFFFddddddddddcccdcccccc###FFFFFFfffffwwwffw#..........',
  '#Fddddddddccdddccccccc###FFFFFFfffffffffwwwfws#.........',
  '#dddddddddcccdccccc###FFFFFFFfffffffnnnffwwfws#.........',
  '.#dddccddccccccc####FFFFFFfffffffffffFnnnnnfws#.........',
  '..#ddccccccccc###FFFFFFFfffffffffffffFnnwnffwws#........',
  '...#cccccc#####FFFFFFffffffffffffffffFnnnnffwwwF#.......',
  '....#######...#FFFFffffcFfffffffffffffFnnffwwwnnn#......',
  '..............#FFFffffcffffffffffkkkfffffffwwwwnn#......',
  '..............#FFFfffcfffffffffffkkkkfffffwwwwwwn#......',
  '..............#FFFffffcwwffffffffffffffffwwwwwwnn#......',
  '...............#FFFffffccwfffffffffffffwwwwwwwnw#.......',
  '...............#FFFFfffcwwwwwfffffffwwwwwwwwwnww#.......',
  '................#FFFFfffswwwwwwwwwwwwwwwwwwwwwp#........',
  '.................#FFFFfffpwwwwwwwwwwwwwwwwwwwp#.........',
  '..................#cFFFFffppwwwwwwwwwwwwwwwpp#..........',
  '...................##cFFFFFpppppwwwwwwwwwpp##...........',
  '..................#dd###cFFFFpppppppppppp##.............',
  '.................#ddWWccn##nFFFpppppppF##...............',
  '.................#ccccccrrrdnnnnnnnnnnpp##..............',
  '................#ccdddddbbbrrWWrrccddnnppn#.............',
  '................#cdddddbbbbbbrrrbWrrbbdnpn#.............',
  '...............#dddd#ddbkbbbbbbrrWrrrrbdnnd#............',
  '...............#ddd#ddbbbbbbWbbbbrrbbWrbbdb#............',
  '..............#dcdd#ddbrbbbbbbbbbbrrWWrrrbb#............',
  '..............#ddd#dddbrbbbbrbbdbbbbrrbbWrbr#...........',
  '..............#ddd#ddbbbbbbrrbbdbbbbbbrWWrrr#...........',
  '.............#dWdd#ddbbbbbbbbbbndbbrbbbrrrWb#...........',
  '.............#dWW#ddcrrrrrrrbbbndbrrrbbbbrWrc#..........',
  '.............#ddd#cccWbrrbWrrrbndbbbbbbbbbrrc#..........',
  '.............#ddd#WdcWrcrbWWrrrdnbrbbbWbbbbbc#..........',
  '............#dddc#Wccc###rrrrbWcnbbbbWWbbrbbb#..........',
  '............#ddcc#cc##FFF###brWrnrbbbbbbbbbbWd#.........',
  '............#ccWcd####Ffffff##rrnWrrbbbbrbbbWd#.........',
  '............#dWcd##c#F#fwwwwp###dWsrrrbbbbbWWW#.........',
  '............#Wcd#c#c#F#wwwwww####crbbWrrbbbbbd#.........',
  '............#d###c#c#F#wpwwpw##r##crWWrrrrbbbd#.........',
  '............#d#c#c##FFF#pwwp#F#r#r##rrrbbWrrbc#.........',
  '............###c###FFFFF####FFF##r#F##rcWWrbWd#.........',
  '............#c#cn#n#FFFFFFFFFFFFF#F#r###drrWWc#.........',
  '............#c##n#n#FFFffffffFcc####r#cc######..........',
  '............#c#.#.##FFfffffffF##cccc##Fc##r#r#..........',
  '.............##....#FFffffffF#.#ccFFFFF#.#r#r#..........',
  '...................#FFfFFFFFn#.#cFFFFFc#..#.#...........',
  '...................#FFFwwwwww#.#FFFFpppp#...............',
  '...................#ppwwwFwwFw##ppppppFpp#..............',
  '...................#pppwwcwwcw##ppppppcpc#..............',
  '....................###########.##########..............',
];
