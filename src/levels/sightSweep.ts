// GDD-WLD-03's sight rule as a probe (L-014): fly the flights a level invites and find each one that loses a life to something that was
// off screen at its take-off. Test support for the level tests, pure, no Phaser: the camera is the pure camera of `src/ui/camera.ts`,
// stepped along each flight as the scene steps it.
import { BASE_HEIGHT, BASE_WIDTH, HITBOX, RUN, TILE } from '../config/tuning';
import { bottomRowAt } from '../sim/bottoms';
import { enemyBox, harmlessFromBelow, kindOf, touchesEnemy, type Box } from '../sim/enemy';
import { touchesSpike } from '../sim/hazards';
import { spawn, type PlayerInput, type PlayerState } from '../sim/movement';
import { isInPit, startRun, stepRun, type Level, type Point, type RunState } from '../sim/run';
import { cameraLimitsAt, followCamera, placeCameraY, stepCameraY, type CameraY } from '../ui/camera';

/** What the screen shows: the level point at its top-left corner. The view is BASE_WIDTH x BASE_HEIGHT (480 x 270). */
export interface View {
  readonly x: number;
  readonly y: number;
}

/** The camera of a flight as the scene keeps it: the scroll left and right (`followCamera`) and the camera up and down (`stepCameraY`). */
export interface SightCamera {
  readonly scrollX: number;
  readonly y: CameraY;
}

/**
 * GDD-UI-04: the camera at a take-off at level x `x` with his feet at `feetY`, settled as after an approach of 3 tiles in the flight's
 * direction `dir` on level ground. Left and right: `followCamera` from the scroll that has him at the screen's middle 3 tiles back (where a
 * cut puts him) to the take-off; 3 tiles are longer than the dead zone (32 px), so he stands on its leading edge, 256 px from the screen's
 * left edge going right and 224 px going left, or the scroll stops at the level's edge. Up and down: `placeCameraY` with the limits of his
 * column (his feet 136 px down, the middle of the ground band, where a walk on level ground leaves the camera).
 */
export function approachCamera(level: Level, x: number, feetY: number, dir: 1 | -1): SightCamera {
  const back = x - dir * 3 * TILE;
  return { scrollX: followCamera(back - BASE_WIDTH / 2, x, level.world.width * TILE), y: placeCameraY(feetY, cameraLimitsAt(level, x)) };
}

/** GDD-UI-04: the camera after the run's step from `before` to `after`, as the scene follows the body (`followCamera`, `stepCameraY`). */
export function stepSightCamera(camera: SightCamera, before: RunState, after: RunState, level: Level): SightCamera {
  return { scrollX: followCamera(camera.scrollX, after.player.x, level.world.width * TILE), y: stepCameraY(camera.y, before, after, level).camera };
}

export const viewOf = (camera: SightCamera): View => ({ x: camera.scrollX, y: camera.y.y });

/** Whether any of `box` is inside the view: a box that only shares an edge with it is not. */
export const onScreen = (box: Box, view: View): boolean => box.x0 < view.x + BASE_WIDTH && box.x1 > view.x && box.y0 < view.y + BASE_HEIGHT && box.y1 > view.y;

/**
 * The view after each of `states`, a flight in direction `dir` from `from`: `views[k]` is the screen after the step that gave `states[k]`,
 * the camera starting settled at `from` (`approachCamera`).
 */
export function viewsAlong(level: Level, from: RunState, states: readonly RunState[], dir: 1 | -1): View[] {
  let camera = approachCamera(level, from.player.x, from.player.y, dir);
  let before = from;
  return states.map((r) => {
    camera = stepSightCamera(camera, before, r, level);
    before = r;
    return viewOf(camera);
  });
}

/** The tile (`col`, `row`) as a box. */
export const tileBox = (col: number, row: number): Box => ({ x0: col * TILE, x1: (col + 1) * TILE, y0: row * TILE, y1: (row + 1) * TILE });

// ---------------------------------------------------------------------------------------------------------------------------------
// The flights.

/**
 * The inputs a take-off is flown with, the way the take-off's direction is held all along: `walk` walks off or on with no jump (90 steps,
 * or on to the landing once he is in the air); `held` presses jump and holds it to the landing; `tap` releases it after 4 steps; `again`
 * holds it, lets go at the top of the jump and presses it again 10 steps later, held to the landing; `walk-glide` walks with no jump until
 * he is in the air off an edge, then holds jump to the landing (the walk-off glide).
 */
export type SightInput = 'walk' | 'held' | 'tap' | 'again' | 'walk-glide';
export const SIGHT_INPUTS: readonly SightInput[] = ['walk', 'held', 'tap', 'again', 'walk-glide'];

/** GDD-ENM-04: the start times, 6 phases of the enemies' 240-step clock (the Murciélago's loop). */
export const SIGHT_STARTS: readonly number[] = [0, 40, 80, 120, 160, 200];

/** The flights' limits: `walk` and `walk-glide` walk at most `walkSteps`; a flight ends `idleSteps` after he stands, or after `maxSteps`. */
export const SIGHT_FLIGHT = { walkSteps: 90, idleSteps: 30, maxSteps: 600, tapSteps: 4, againSteps: 10 } as const;

/** The take-offs in a tile: its eighths 1, 3, 5 and 7. */
const EIGHTHS = [1, 3, 5, 7] as const;

/** A place he can stand: a tile column and its ground's top y (px). */
export interface Place {
  readonly col: number;
  readonly y: number;
}

/** One flight: from a place, at x, the way `dir` says, from a standstill or at run speed, with an input, at a start time. */
export interface Takeoff {
  readonly place: Place;
  readonly x: number;
  readonly dir: 1 | -1;
  readonly speed: 'stand' | 'run';
  readonly input: SightInput;
  readonly start: number;
}

/** A flight that lost a life: to what, where it was then, and whether it was on screen at the take-off. */
export interface Loss {
  readonly takeoff: Takeoff;
  /**
   * What took the life: an enemy by its kind and the column it starts in (`murcielago at 225`), a spike by its tile (`spike 12,9`), a pit by
   * its columns (`pit 222-226`).
   */
  readonly cause: string;
  /** Where it was at the loss: an enemy's box, the spike's tile, the pit's near lip (its first column at the bank's ground row). */
  readonly where: Box;
  /** The state of the take-off (the step jump is pressed, or the step he leaves the ground for `walk` and `walk-glide`) and of the loss. */
  readonly takeoffStep: number;
  readonly lossStep: number;
  /** How many steps before the loss it first came on screen, from the take-off on (0: only at the loss; null: never). */
  readonly seenBefore: number | null;
  /** Whether it was off screen at the take-off. */
  readonly blind: boolean;
}

export interface SightFlight {
  readonly from: RunState;
  readonly states: readonly RunState[];
  /** The places he stood on before any life was lost. */
  readonly stood: readonly Place[];
  readonly loss: Loss | null;
}

/** Whether tile (`col`, `row`) is something he stands on: a solid tile, a crumbling ledge (whole) or a piñata. */
const standOn = (level: Level, col: number, row: number): boolean =>
  level.world.solidTile(col, row) || level.crumbles.some((c) => c.col === col && c.row === row) || level.pinatas.some((p) => p.col === col && p.row === row);

/** The place he stands on with his feet's middle at (x, y): the column of his middle, or the one beside it his feet are on. */
export function placeAt(level: Level, x: number, y: number): Place | undefined {
  const row = y / TILE;
  if (!Number.isInteger(row)) return undefined;
  const cols = [Math.floor(x / TILE), Math.floor((x - HITBOX.width / 2) / TILE), Math.floor((x + HITBOX.width / 2 - 0.001) / TILE)];
  const col = cols.find((c) => standOn(level, c, row));
  return col === undefined ? undefined : { col, y };
}

/** Whether he can stand with his feet's middle at (x, y): his body box in no tile he stands on, his feet on one. */
function canStand(level: Level, x: number, y: number): boolean {
  const [c0, c1] = [Math.floor((x - HITBOX.width / 2) / TILE), Math.floor((x + HITBOX.width / 2 - 0.001) / TILE)];
  const [r0, r1] = [Math.floor((y - HITBOX.height) / TILE), Math.floor((y - 0.001) / TILE)];
  for (let c = c0; c <= c1; c++) for (let r = r0; r <= r1; r++) if (standOn(level, c, r)) return false;
  return placeAt(level, x, y) !== undefined;
}

/** The level's idle runs from its start (Poncho waiting at the spawn), kept between flights: the enemies at each start time. */
const warmRuns = new WeakMap<Level, RunState[]>();
function warmRun(level: Level, steps: number): RunState {
  let runs = warmRuns.get(level);
  if (!runs) warmRuns.set(level, (runs = [startRun(level)]));
  while (runs.length <= steps) runs.push(stepRun(runs[runs.length - 1]!, { move: 0, jumpHeld: false }, level));
  return runs[steps]!;
}

/** The run a take-off starts from: the level's enemies `start` steps into their walks and loops, Poncho standing at the take-off (as the level tests' `at`). */
export function takeoffRun(level: Level, t: Takeoff): RunState {
  const vx = t.speed === 'run' ? t.dir * RUN.maxSpeed : 0;
  const player: PlayerState = { ...spawn(t.x, t.place.y), grounded: true, vx, facing: t.dir };
  return { ...warmRun(level, t.start), player, clock: 0 };
}

/**
 * What took the life on the step from `before` to `after`, as `stepRun` decides it: a pit, a spike, then the first enemy that touches him;
 * anything else is a crush (by a moving block), whose place is his own body.
 */
function causeOf(level: Level, before: RunState, after: RunState): { cause: string; enemy?: number; spike?: { col: number; row: number } } {
  if (isInPit(after.player, level.world, level.bottoms)) return { cause: 'pit' };
  const spike = level.spikes.find((s) => touchesSpike(after.player, s));
  if (spike) return { cause: `spike ${spike.col},${spike.row}`, spike };
  const enemy = level.enemies.findIndex((d, i) => touchesEnemy(after.player, d, after.enemies[i]!) && !harmlessFromBelow(before.player, after.player, d, after.enemies[i]!));
  if (enemy >= 0) return { cause: `${kindOf(level.enemies[enemy]!)} at ${Math.floor(level.enemies[enemy]!.x / TILE)}`, enemy };
  return { cause: 'crush' };
}

/** A pit column: no ground in its bottom row (GDD-WLD-03). */
const pitColumn = (level: Level, col: number): boolean => col >= 0 && col < level.world.width && !level.world.solidTile(col, bottomRowAt(level, col));

/**
 * The pit he was lost in at level x `x`, by its columns, and its near lip: scanning from the take-off's column towards `x`, the first pit
 * column with no crumbling ledge (a ledge is a bank in World 3, GDD-WLD-05), as a tile at the ground row of the bank before it (the first
 * tile he stands on in that column from 3 rows over the take-off's ground down).
 */
function pitLip(level: Level, t: Takeoff, x: number): { cause: string; where: Box } {
  const col = Math.floor(x / TILE);
  let [a, b] = [col, col];
  while (pitColumn(level, a - 1)) a--;
  while (pitColumn(level, b + 1)) b++;
  const open = (c: number) => pitColumn(level, c) && !level.crumbles.some((k) => k.col === c);
  const way = Math.sign(col - t.place.col) || t.dir;
  let lip = col;
  for (let c = t.place.col; way * (col - c) >= 0; c += way) {
    if (open(c)) {
      lip = c;
      break;
    }
  }
  const bank = lip - way;
  const top = t.place.y / TILE;
  let row = top;
  for (let r = Math.max(0, top - 3); r < level.world.height; r++) {
    if (standOn(level, bank, r)) {
      row = r;
      break;
    }
  }
  return { cause: `pit ${a}-${b}`, where: tileBox(lip, row) };
}

/** A player's reaction during a flight: from step `at` on he holds `input` in place of the take-off's own, until he stands. */
export interface Reaction {
  readonly at: number;
  readonly input: PlayerInput;
}

/**
 * Flies one take-off on `level` from `from` (`takeoffRun` by default): the states, the places he stood on and the loss, if any. With a
 * `reaction` the flight is the same up to its step and his from there.
 */
export function flySight(level: Level, t: Takeoff, from: RunState = takeoffRun(level, t), reaction?: Reaction): SightFlight {
  const F = SIGHT_FLIGHT;
  const states: RunState[] = [];
  const stood: Place[] = [];
  let r = from;
  let [left, landed, top] = [-1, -1, -1];
  for (let i = 0; i < F.maxSteps && r.phase === 'playing'; i++) {
    if (landed >= 0 && i > landed + F.idleSteps) break;
    const walking = t.input === 'walk' || t.input === 'walk-glide';
    if (walking && left < 0 && i >= F.walkSteps) break;
    if (t.input === 'again' && top < 0 && i > 1 && r.player.vy >= 0) top = i;
    const jump =
      t.input === 'held' ? true
      : t.input === 'tap' ? i < F.tapSteps
      : t.input === 'again' ? top < 0 || i >= top + F.againSteps
      : t.input === 'walk-glide' && left >= 0;
    const input: PlayerInput = landed >= 0 ? { move: 0, jumpHeld: false } : reaction && i >= reaction.at ? reaction.input : { move: t.dir, jumpHeld: jump };
    const before = r;
    r = stepRun(r, input, level);
    states.push(r);
    // GDD-WLD-03: reaching the exit ends the level, and the flight.
    if (r.phase === 'clear') break;
    if (r.phase !== 'playing') return { from, states, stood, loss: lossOf(level, t, from, states, walking ? Math.max(0, left) : 0, before) };
    if (left < 0 && !r.player.grounded) left = i;
    else if (left >= 0 && landed < 0 && r.player.grounded) landed = i;
    if (r.player.grounded) {
      const place = placeAt(level, r.player.x, r.player.y);
      if (place) stood.push(place);
    }
  }
  return { from, states, stood, loss: null };
}

/** The loss that ends `states` (its last state), the take-off at `takeoffStep`, with what took it and when it was first on screen. */
function lossOf(level: Level, t: Takeoff, from: RunState, states: readonly RunState[], takeoffStep: number, before: RunState): Loss {
  const lossStep = states.length - 1;
  const after = states[lossStep]!;
  const found = causeOf(level, before, after);
  const pit = found.cause === 'pit' ? pitLip(level, t, after.player.x) : undefined;
  const boxAt = (k: number): Box =>
    found.enemy !== undefined ? enemyBox(level.enemies[found.enemy]!, states[k]!.enemies[found.enemy]!) : found.spike ? tileBox(found.spike.col, found.spike.row) : (pit?.where ?? bodyOf(states[k]!.player));
  const views = viewsAlong(level, from, states, t.dir);
  const first = views.findIndex((v, k) => k >= takeoffStep && onScreen(boxAt(k), v));
  return {
    takeoff: t,
    cause: pit?.cause ?? found.cause,
    where: boxAt(lossStep),
    takeoffStep,
    lossStep,
    seenBefore: first < 0 ? null : lossStep - first,
    blind: !onScreen(boxAt(takeoffStep), views[takeoffStep]!),
  };
}

// ---------------------------------------------------------------------------------------------------------------------------------
// The sweep.

/** A run of standable tile tops in one row that no flight reached. */
export interface Unreached {
  readonly row: number;
  readonly from: number;
  readonly to: number;
}

export interface SightReport {
  /** Every place the closure reached, in the order it reached them. */
  readonly places: readonly Place[];
  /** The first flight that reached each place (by "column,y"), none for a respawn point. */
  readonly reachedBy: ReadonlyMap<string, Takeoff>;
  /** The flights flown, one per take-off and start time. */
  readonly flights: number;
  /** The losses whose cause was on screen at the take-off, counted per cause. */
  readonly inSight: Readonly<Record<string, number>>;
  /** The blind losses: each cause off screen at its take-off. */
  readonly blind: readonly Loss[];
  /** The tile tops he could stand on (2 tiles of air over them) that no flight reached, by rows and column ranges. */
  readonly unreached: readonly Unreached[];
}

/** A place as "column,y", the key of `SightReport.reachedBy`. */
export const placeKey = (p: Place) => `${p.col},${p.y}`;
/** The gap between two boxes: the larger of the horizontal and the vertical gap (0 or less when they touch). */
const gapBetween = (a: Box, b: Box): number => Math.max(a.x0 - b.x1, b.x0 - a.x1, a.y0 - b.y1, b.y0 - a.y1);
const bodyOf = (p: PlayerState): Box => ({ x0: p.x - HITBOX.width / 2, x1: p.x + HITBOX.width / 2, y0: p.y - HITBOX.height, y1: p.y });

/** Each enemy's swept box: every box it has over `steps` steps of the idle run from the level's start. */
function sweptBoxes(level: Level, steps: number): Box[] {
  const boxes: Box[] = level.enemies.map(() => ({ x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity }));
  for (let k = 0; k <= steps; k++) {
    const r = warmRun(level, k);
    level.enemies.forEach((d, i) => {
      const b = enemyBox(d, r.enemies[i]!);
      boxes[i] = { x0: Math.min(boxes[i]!.x0, b.x0), x1: Math.max(boxes[i]!.x1, b.x1), y0: Math.min(boxes[i]!.y0, b.y0), y1: Math.max(boxes[i]!.y1, b.y1) };
    });
  }
  return boxes;
}

/** How near (px) an enemy's swept box may come to a flight flown without enemies before it is flown again with them. */
const NEAR_PX = 40;

/**
 * GDD-WLD-03: the sight sweep of a level. From the spawn and each ofrenda, and then from every place reached, flies every take-off: the
 * tile's eighths 1, 3, 5 and 7, both ways, from a standstill and at run speed, with each of `SIGHT_INPUTS`, at each of `starts`. A place
 * is reached when he stands on it in a flight before any life is lost. Each loss is checked against the camera stepped along its flight.
 * For speed each take-off is flown once on the level without its enemies, and again at each start time with them only when an enemy's
 * swept box comes within 40 px of his body on that flight; one that never does flies the same at every start time (enemies act on him only
 * by touch, and none reacts to him in World 3).
 */
export function sightSweep(level: Level, starts: readonly number[] = SIGHT_STARTS): SightReport {
  const calm: Level = { ...level, enemies: [] };
  const swept = sweptBoxes(level, Math.max(...starts) + SIGHT_FLIGHT.maxSteps + 1);
  const reached = new Map<string, Place>();
  const reachedBy = new Map<string, Takeoff>();
  const queue: Place[] = [];
  const reach = (p: Place | undefined, by?: Takeoff) => {
    if (p && !reached.has(placeKey(p))) {
      reached.set(placeKey(p), p);
      if (by) reachedBy.set(placeKey(p), by);
      queue.push(p);
    }
  };
  const respawns: Point[] = [level.spawn, ...level.ofrendas];
  for (const p of respawns) reach(placeAt(level, p.x, p.y));
  let flights = 0;
  const inSight: Record<string, number> = {};
  const blind: Loss[] = [];
  const count = (loss: Loss | null) => {
    if (!loss) return;
    if (loss.blind) blind.push(loss);
    else inSight[loss.cause] = (inSight[loss.cause] ?? 0) + 1;
  };
  for (let q = 0; q < queue.length; q++) {
    const place = queue[q]!;
    for (const e of EIGHTHS) {
      const x = place.col * TILE + (e * TILE) / 8;
      if (!canStand(level, x, place.y)) continue;
      for (const dir of [1, -1] as const) {
        for (const speed of ['stand', 'run'] as const) {
          for (const input of SIGHT_INPUTS) {
            const base: Takeoff = { place, x, dir, speed, input, start: starts[0]! };
            const plain = flySight(calm, base, { ...takeoffRun(level, base), enemies: [] });
            const near = [plain.from, ...plain.states].some((r) => swept.some((b) => gapBetween(bodyOf(r.player), b) <= NEAR_PX));
            for (const start of starts) {
              flights++;
              const f = near ? flySight(level, { ...base, start }) : plain;
              for (const p of f.stood) reach(p, { ...base, start });
              count(f.loss && !near ? { ...f.loss, takeoff: { ...f.loss.takeoff, start } } : f.loss);
            }
          }
        }
      }
    }
  }
  return { places: [...reached.values()], reachedBy, flights, inSight, blind, unreached: unreachedTops(level, reached) };
}

/** The standable tile tops (a tile he stands on, 2 tiles of air over it) that are not among `reached`, by rows and column ranges. */
function unreachedTops(level: Level, reached: ReadonlyMap<string, Place>): Unreached[] {
  const out: Unreached[] = [];
  for (let row = 0; row < level.world.height; row++) {
    for (let col = 0; col < level.world.width; col++) {
      const standable = standOn(level, col, row) && !standOn(level, col, row - 1) && !standOn(level, col, row - 2);
      if (!standable || reached.has(placeKey({ col, y: row * TILE }))) continue;
      const last = out[out.length - 1];
      if (last && last.row === row && last.to === col - 1) out[out.length - 1] = { ...last, to: col };
      else out.push({ row, from: col, to: col });
    }
  }
  return out;
}

/** A family of blind losses: one cause, one input, take-offs from a run of adjacent columns. */
export interface SightFamily {
  readonly cause: string;
  readonly from: number;
  readonly to: number;
  readonly input: SightInput;
}

/** The blind losses grouped by what took the life and the input (in the order first met), each by runs of adjacent take-off columns. */
export function sightFamilies(blind: readonly Loss[]): SightFamily[] {
  const groups = new Map<string, { cause: string; input: SightInput; cols: Set<number> }>();
  for (const l of blind) {
    const k = `${l.cause}|${l.takeoff.input}`;
    const group = groups.get(k) ?? { cause: l.cause, input: l.takeoff.input, cols: new Set<number>() };
    group.cols.add(l.takeoff.place.col);
    groups.set(k, group);
  }
  const out: SightFamily[] = [];
  const all = blind.map((l) => l.takeoff.place.col);
  for (const { cause, input, cols } of groups.values()) {
    for (let c = Math.min(...all); c <= Math.max(...all); c++) {
      if (!cols.has(c)) continue;
      const last = out[out.length - 1];
      if (last && last.cause === cause && last.input === input && last.to === c - 1) out[out.length - 1] = { ...last, to: c };
      else out.push({ cause, from: c, to: c, input });
    }
  }
  return out;
}

/** A blind loss as a line for a failing test's message. */
export const describeLoss = (l: Loss): string => {
  const t = l.takeoff;
  const where = `x ${Math.round(l.where.x0)} to ${Math.round(l.where.x1)}, y ${Math.round(l.where.y0)} to ${Math.round(l.where.y1)}`;
  return `${l.cause} (${where}) from column ${t.place.col} y ${t.place.y} x ${t.x}, ${t.dir > 0 ? 'right' : 'left'}, ${t.speed}, ${t.input}, start ${t.start}: lost at step ${l.lossStep}, take-off step ${l.takeoffStep}, on screen ${l.seenBefore ?? 'never'} steps before`;
};
