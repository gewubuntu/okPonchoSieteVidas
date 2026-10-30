// The tutorial 0-1, World 0 (GDD-WLD-06, GDD-WLD-01): three screens, 90 x 17 tiles (1440 x 272 px), teaching running and jumping, gaps, walls, the
// Alacrán (stomp and claw), a piñata with a taco and spikes. `#` is solid, `.` is empty. The floor's top is row 14 (y = 224).
// Gaps of 1, 2, 3 and 3 tiles (columns 16, 19 and 20, 53 to 55, 71 to 73), walls of 2, 3, 3 and 2 tiles, a raised platform
// (row 10, columns 62 to 68) and a ledge for the veladora (row 7, columns 70 and 71). No glide and no wall cling yet.
import { TILE } from '../config/tuning';
import type { Spike } from '../sim/hazards';
import type { Enemy } from '../sim/enemy';
import type { Pinata } from '../sim/pinata';
import type { Hilo } from '../sim/hilo';
import type { Veladora } from '../sim/veladora';
import type { Level, Ofrenda } from '../sim/run';
import { parseTiles } from '../sim/tilemap';
import type { Tip } from '../ui/tips';

export const LEVEL_0_1_ROWS: readonly string[] = [
  '..........................................................................................',
  '..........................................................................................',
  '..........................................................................................',
  '..........................................................................................',
  '..........................................................................................',
  '..........................................................................................',
  '..........................................................................................',
  '......................................................................##..................',
  '..........................................................................................',
  '..........................................................................................',
  '..............................................................#######.....................',
  '..........................................................##..............................',
  '...........##.............................................##.......................##.....',
  '.......##..##..............#.........#....................##..................#....##.....',
  '################.##..################################...###############...################',
  '################.##..################################...###############...################',
  '################.##..################################...###############...################',
];

/** Where Poncho starts: the middle of tile column 3, standing on the floor. */
const SPAWN = { x: 3 * TILE + TILE / 2, y: 14 * TILE } as const;

/** GDD-WLD-03, GDD-WLD-06: tile columns 23, 49 and 76, about 26%, 55% and 85% of the width, standing on the floor. */
const OFRENDAS: readonly Ofrenda[] = [23, 49, 76].map((col, i) => ({ id: `0-1-${i + 1}`, x: col * TILE + TILE / 2, y: SPAWN.y }));

/** GDD-WLD-05: two spikes before the second ofrenda (columns 43 and 44) and three under the raised platform (64 to 66). */
const SPIKES: readonly Spike[] = [43, 44, 64, 65, 66].map((col) => ({ col, row: 13 }));

/** GDD-PWR-05: a piñata at column 40, row 10, 48 px above the floor; its taco is for the spikes after it. */
const PINATAS: readonly Pinata[] = [{ col: 40, row: 10 }];

/** GDD-ENM-02: Alacranes on the floor from column 32, on the raised platform from column 65, and on the floor from column 81. */
const ENEMIES: readonly Enemy[] = [
  { x: 32 * TILE + 8, y: 14 * TILE },
  { x: 65 * TILE + 8, y: 10 * TILE },
  { x: 81 * TILE + 8, y: 14 * TILE },
];

/** GDD-WLD-04: 50 hilos as (column, row) tiles, in trails along the path, in the order the serape colours cycle through them. */
const HILOS: readonly Hilo[] = [
  [2, 13], [4, 13], [5, 13], [6, 13], [7, 11], [8, 11], [10, 13], [11, 10], [12, 10], [14, 13],
  [16, 11], [19, 11], [20, 11], [22, 13], [24, 13], [25, 13], [29, 12], [31, 12], [33, 12], [35, 12],
  [38, 11], [41, 9], [43, 11], [44, 11], [46, 13], [47, 13], [51, 13], [53, 12], [54, 11], [55, 12],
  [58, 9], [59, 9], [61, 12], [62, 8], [64, 8], [66, 8], [68, 8], [71, 6], [72, 11], [73, 12],
  [75, 13], [77, 13], [79, 12], [80, 12], [81, 12], [82, 12], [83, 10], [84, 10], [85, 13], [86, 13],
].map(([col, row]) => ({ col: col!, row: row! }));

/** GDD-LIFE-03, GDD-WLD-03: the veladora on the ledge at columns 70 and 71, high over the second 3-tile gap. */
const VELADORA: Veladora = { col: 70, row: 6 };

/** GDD-WLD-03: 0-1 as a level, the data the scene plays and the validator checks (GDD-TEC-04). The exit stands at column 87. */
export const LEVEL_0_1: Level = {
  world: parseTiles(LEVEL_0_1_ROWS),
  spawn: SPAWN,
  ofrendas: OFRENDAS,
  spikes: SPIKES,
  crumbles: [],
  springs: [],
  platforms: [],
  tacos: [],
  pinatas: PINATAS,
  doors: [],
  keys: [],
  fragiles: [],
  enemies: ENEMIES,
  hilos: HILOS,
  veladora: VELADORA,
  exit: { x: 87 * TILE + 8, y: 14 * TILE },
};

/** GDD-UI-05, GDD-UI-02: a tip with one text for every device, in each language. */
const same = (en: string, es: string, de: string): Tip['text'] => ({
  en: { keyboard: en, touch: en, pad: en },
  es: { keyboard: es, touch: es, pad: es },
  de: { keyboard: de, touch: de, pad: de },
});
/**
 * GDD-UI-05: the twelve tips, in the order he meets them: one stretch of tile columns each, the thing it highlights (col, row, w, h in
 * tiles), the touch button outlined with it and, for the three about a thing that can be done, when it is.
 */
export const TIPS_0_1: readonly Tip[] = [
  {
    from: 0,
    to: 5,
    text: {
      en: { keyboard: 'Arrows or A/D to run', touch: 'Hold left or right to run', pad: 'Stick or D-pad to run' },
      es: { keyboard: 'Flechas o A/D para correr', touch: 'Mantén izquierda o derecha para correr', pad: 'Stick o cruceta para correr' },
      de: { keyboard: 'Pfeiltasten oder A/D zum Laufen', touch: 'Links oder rechts halten zum Laufen', pad: 'Stick oder Steuerkreuz zum Laufen' },
    },
    highlight: null,
    button: 'move',
  },
  {
    from: 6,
    to: 13,
    text: {
      en: { keyboard: 'Space to jump. Hold it to jump higher', touch: 'Tap the jump button. Hold it to jump higher', pad: 'Bottom button to jump. Hold it to jump higher' },
      es: { keyboard: 'Espacio para saltar. Mantenlo para saltar más alto', touch: 'Toca el botón de salto. Mantenlo para saltar más alto', pad: 'Botón inferior para saltar. Mantenlo para saltar más alto' },
      de: { keyboard: 'Leertaste zum Springen. Halten für höhere Sprünge', touch: 'Sprungknopf antippen. Halten für höhere Sprünge', pad: 'Untere Taste zum Springen. Halten für höhere Sprünge' },
    },
    highlight: { col: 11, row: 12, w: 2, h: 2 },
    button: 'jump',
  },
  { from: 14, to: 20, text: same('Jump over the gaps', 'Salta los huecos', 'Spring über die Lücken'), highlight: { col: 16, row: 14, w: 5, h: 1 } },
  {
    from: 21,
    to: 25,
    text: same('Ofrendas are checkpoints. The first touch gives back a life', 'Las ofrendas son puntos de control. El primer toque devuelve una vida', 'Ofrendas sind Kontrollpunkte. Die erste Berührung gibt ein Leben zurück'),
    highlight: { col: 23, row: 12, w: 1, h: 2 },
  },
  {
    from: 26,
    to: 38,
    text: {
      en: { keyboard: 'Jump on the Alacrán, or X to claw it', touch: 'Jump on the Alacrán, or tap the claw button', pad: 'Jump on the Alacrán, or left button to claw it' },
      es: { keyboard: 'Salta sobre el Alacrán, o presiona X para arañarlo', touch: 'Salta sobre el Alacrán, o toca el botón de zarpazo', pad: 'Salta sobre el Alacrán, o botón izquierdo para arañarlo' },
      de: { keyboard: 'Spring auf den Alacrán oder kratz ihn mit X', touch: 'Spring auf den Alacrán oder tipp auf den Krallenknopf', pad: 'Spring auf den Alacrán oder kratz ihn mit der linken Taste' },
    },
    highlight: { col: 28, row: 12, w: 9, h: 2 },
    button: 'claw',
    doneWhen: { enemy: 0 },
  },
  {
    from: 39,
    to: 41,
    text: same('Jump into the piñata from below', 'Salta contra la piñata desde abajo', 'Spring von unten gegen die Piñata'),
    highlight: { col: 40, row: 10, w: 1, h: 1 },
    doneWhen: { pinata: 0 },
  },
  {
    from: 42,
    to: 47,
    text: same('Spikes hurt. With a taco, a hit costs only the taco', 'Los picos hacen daño. Con un taco, un golpe solo cuesta el taco', 'Stacheln tun weh. Mit einem Taco kostet ein Treffer nur den Taco'),
    highlight: { col: 43, row: 13, w: 2, h: 1 },
  },
  {
    from: 48,
    to: 52,
    text: same('Hilos are threads to collect. Find all 50!', 'Los hilos son para coleccionar. ¡Encuentra los 50!', 'Hilos sind Fäden zum Sammeln. Finde alle 50!'),
    highlight: { col: 49, row: 12, w: 1, h: 2 },
  },
  {
    from: 53,
    to: 57,
    text: same('A running jump crosses 3 tiles', 'Un salto con impulso cruza 3 casillas', 'Ein Sprung mit Anlauf überquert 3 Felder'),
    highlight: { col: 53, row: 14, w: 3, h: 1 },
  },
  {
    from: 58,
    to: 61,
    text: same('A full jump climbs a wall 3 tiles high', 'Un salto completo sube un muro de 3 casillas', 'Ein voller Sprung erklimmt eine 3 Felder hohe Wand'),
    highlight: { col: 58, row: 11, w: 2, h: 3 },
  },
  {
    from: 62,
    to: 75,
    text: same('A veladora up there gives back a life', 'Una veladora ahí arriba devuelve una vida', 'Eine Veladora dort oben gibt ein Leben zurück'),
    highlight: { col: 70, row: 6, w: 1, h: 1 },
    doneWhen: 'veladora',
  },
  {
    from: 82,
    to: 89,
    text: same('Reach the arch to finish the level', 'Llega al arco para terminar el nivel', 'Erreiche den Bogen, um das Level zu beenden'),
    highlight: { col: 87, row: 11, w: 1, h: 3 },
  },
];
