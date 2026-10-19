// A one-screen test level, 30 x 17 tiles (480 x 272 px). A stand-in until levels are authored in Tiled (GDD-TEC-04).
// `#` is solid, `.` is empty. It has a floor, a floating platform to bump a head on, a wall 2 tiles high and a wall
// 3 tiles high, the tallest a full jump can climb (GDD-MOV-02, GDD-MOV-06). Pits and checkpoints come later.
import { TILE } from '../config/tuning';

export const SANDBOX_ROWS: readonly string[] = [
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '....#####.....................',
  '......................##......',
  '..........##..........##......',
  '..........##..........##......',
  '##############################',
  '##############################',
  '##############################',
];

/** Where Poncho starts: the middle of tile column 3, standing on the floor (the first solid row is 14). */
export const SANDBOX_SPAWN = { x: 3 * TILE + TILE / 2, y: 14 * TILE } as const;
