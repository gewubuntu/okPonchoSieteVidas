// GDD-BOS-01, GDD-BOS-02: Don Zopilote, World 1's boss: his flight, his cactus fruit and the rocks of his arena. He follows a fixed
// pattern, with nothing left to chance: the only thing that varies is where Poncho is. Pure logic, no Phaser (GDD-TEC-02).
import { BOSS, BOSS_ART, BOSS_DEFEAT, FRUIT, ROCK, STEP, TILE } from '../config/tuning';
import { approach, type Box } from './enemy';
import { hurtbox } from './hazards';
import { squareBlocked } from './item';
import type { PlayerState } from './movement';
import type { TileGrid } from './tilemap';

/** Where a level's boss flies: the middle of the ellipse he laps, and the y of the floor his dives and sweeps run along (his box's bottom there). */
export interface Boss {
  readonly x: number;
  readonly y: number;
  readonly floor: number;
}

/**
 * 'lap' circling, 'telegraph' frozen before an attack, 'dive' to the floor (phases 1 and 3), 'stuck' in the sand after it, 'drop' straight
 * down and 'sweep' across the floor (phase 2), 'climb' back to an end of his lap, 'hurt' after a hit, 'defeated' after the last one.
 */
export type BossMode = 'lap' | 'telegraph' | 'dive' | 'stuck' | 'drop' | 'sweep' | 'climb' | 'hurt' | 'defeated';

export interface BossState {
  /** The middle of his box. */
  readonly x: number;
  readonly y: number;
  readonly dir: 1 | -1;
  /** Hits taken, 0 to BOSS.hits. He is in phase `hits + 1`. */
  readonly hits: number;
  readonly mode: BossMode;
  /** Steps in this mode: 0 on the step it starts, one more on each step after. In a lap, where he is on it. */
  readonly age: number;
  /** The end of his lap it starts and ends at: 1 the right end, -1 the left. */
  readonly side: 1 | -1;
  /** Where a dive, a drop, a sweep or a climb takes the middle of his box. */
  readonly tx: number;
  readonly ty: number;
}

/** A cactus fruit: the middle of it and the y of its bottom, like Poncho's own position. Falling, or lying where it landed (phase 3). */
export interface Fruit {
  readonly x: number;
  readonly y: number;
  readonly landed: boolean;
  /** Steps since it landed; 0 while it falls. */
  readonly age: number;
}

/** A rock of the arena: the middle of it and the y of its bottom. Resting on its spot, flying after a claw swipe, or gone after it broke. */
export interface RockState {
  readonly x: number;
  readonly y: number;
  readonly vx: number;
  readonly vy: number;
  readonly mode: 'rest' | 'flying' | 'gone';
  /** Steps since it broke, while gone. */
  readonly age: number;
}

const EDGE = 1e-6;

/** He is in phase 1 until his first hit, then 2, then 3. */
export const phaseOf = (b: BossState): number => b.hits + 1;

/** The y of his middle with his box's bottom on the floor. */
const floorLine = (def: Boss): number => def.floor - BOSS.height / 2;

/** Where he is `age` steps into a lap from `side`'s end: along the lower half first from the right end, the upper half first from the left. */
export function lapPoint(def: Boss, side: 1 | -1, age: number): { x: number; y: number } {
  const phi = (2 * Math.PI * age) / BOSS.lapSteps;
  return { x: def.x + side * BOSS.rx * Math.cos(phi), y: def.y + side * BOSS.ry * Math.sin(phi) };
}

/** At the start of a fight, or of the phase he is in after a lost life (GDD-BOS-01): the right end of his lap, a lap about to start, facing left. */
export const bossStart = (def: Boss, hits: number): BossState => ({ x: def.x + BOSS.rx, y: def.y, dir: -1, hits, mode: 'lap', age: 0, side: 1, tx: def.x + BOSS.rx, ty: def.y });

/** The way he faces after moving to `x`: the way he moved across, or as before if he did not. */
const towards = (b: BossState, x: number): 1 | -1 => (x > b.x ? 1 : x < b.x ? -1 : b.dir);

/** A climb back to the nearer end of his lap (the right one from the middle); the next lap starts there. */
function climbBack(def: Boss, b: BossState): BossState {
  const side = b.x < def.x ? -1 : 1;
  return { ...b, mode: 'climb', age: 0, side, tx: def.x + side * BOSS.rx, ty: def.y };
}

/** Moves him towards his target at `speed` px/s, facing the way he moves across. */
function fly(b: BossState, speed: number): { boss: BossState; arrived: boolean } {
  const at = approach(b.x, b.y, b.tx, b.ty, speed * STEP);
  return { boss: { ...b, x: at.x, y: at.y, dir: towards(b, at.x), age: b.age + 1 }, arrived: at.arrived };
}

/**
 * One step of his pattern (GDD-BOS-02). `player` is Poncho at the start of the step, which he faces in his telegraph and aims a dive at.
 * `drop` is a cactus fruit he lets go of this step, which starts to fall on the next.
 */
export function stepBoss(def: Boss, b: BossState, player: PlayerState): { boss: BossState; drop: Fruit | null } {
  const age = b.age + 1;
  switch (b.mode) {
    case 'lap': {
      const p = lapPoint(def, b.side, age);
      const drop: Fruit | null = BOSS.dropAt.some((a) => a === age) ? { x: p.x, y: p.y + BOSS.height / 2 + FRUIT.size, landed: false, age: 0 } : null;
      const moved: BossState = { ...b, x: p.x, y: p.y, dir: towards(b, p.x), age };
      return { boss: age >= BOSS.lapSteps ? { ...moved, mode: 'telegraph', age: 0 } : moved, drop };
    }
    case 'telegraph': {
      const h = hurtbox(player);
      const aim = h.x + h.w / 2;
      const dir = towards(b, aim);
      if (age < BOSS.telegraphSteps) return { boss: { ...b, dir, age }, drop: null };
      if (phaseOf(b) === 2) return { boss: { ...b, dir, mode: 'drop', age: 0, tx: b.x, ty: floorLine(def) }, drop: null };
      return { boss: { ...b, dir, mode: 'dive', age: 0, tx: Math.max(def.x - BOSS.rx, Math.min(def.x + BOSS.rx, aim)), ty: floorLine(def) }, drop: null };
    }
    case 'dive': {
      const { boss, arrived } = fly(b, phaseOf(b) === 3 ? BOSS.fastDiveSpeed : BOSS.diveSpeed);
      return { boss: arrived ? { ...boss, mode: 'stuck', age: 0 } : boss, drop: null };
    }
    case 'stuck': {
      const steps = phaseOf(b) === 3 ? BOSS.fastStuckSteps : BOSS.stuckSteps;
      return { boss: age < steps ? { ...b, age } : climbBack(def, b), drop: null };
    }
    case 'drop': {
      const { boss, arrived } = fly(b, BOSS.dropSpeed);
      return { boss: arrived ? { ...boss, mode: 'sweep', age: 0, tx: 2 * def.x - b.x, ty: floorLine(def) } : boss, drop: null };
    }
    case 'sweep': {
      const { boss, arrived } = fly(b, BOSS.sweepSpeed);
      return { boss: arrived ? { ...boss, mode: 'climb', age: 0, side: boss.x < def.x ? -1 : 1, tx: boss.x, ty: def.y } : boss, drop: null };
    }
    case 'climb': {
      const { boss, arrived } = fly(b, BOSS.climbSpeed);
      return { boss: arrived ? { ...boss, mode: 'lap', age: 0 } : boss, drop: null };
    }
    case 'hurt':
      return { boss: age < BOSS.hurtSteps ? { ...b, age } : climbBack(def, b), drop: null };
  }
  // Defeated: he falls to the floor and lies there.
  return { boss: { ...b, y: Math.min(floorLine(def), b.y + BOSS.fallSpeed * STEP), age }, drop: null };
}

/** His box, BOSS.width x BOSS.height, centred on him. */
export const bossBox = (b: BossState): Box => ({ x0: b.x - BOSS.width / 2, x1: b.x + BOSS.width / 2, y0: b.y - BOSS.height / 2, y1: b.y + BOSS.height / 2 });

/** The modes in which touching him does no harm. */
const HARMLESS: readonly BossMode[] = ['stuck', 'climb', 'hurt', 'defeated'];

/** Does touching him hurt Poncho (GDD-CMB-03)? While he laps, telegraphs, dives, drops or sweeps. */
export const bossHarms = (b: BossState): boolean => !HARMLESS.includes(b.mode);

/** Can a rock hit him? Unless he is hurt or defeated. */
export const bossHittable = (b: BossState): boolean => b.mode !== 'hurt' && b.mode !== 'defeated';

/**
 * A hit: hurt, or defeated by the last one (BOSS.hits). The hit that defeats him keeps where it hit him in `tx`, `ty`, where his crown
 * starts (nothing else reads them once he is defeated); a hurt hit leaves them as they were.
 */
export const hitBoss = (b: BossState): BossState => {
  const defeated = b.hits + 1 >= BOSS.hits;
  return { ...b, hits: b.hits + 1, mode: defeated ? 'defeated' : 'hurt', age: 0, tx: defeated ? b.x : b.tx, ty: defeated ? b.y : b.ty };
};

/** Where his crown is and which frame it shows: its bottom middle, whether it lies on the floor for good, and whether it is turned. */
export interface Crown {
  readonly x: number;
  readonly y: number;
  readonly resting: boolean;
  readonly tilted: boolean;
}

/**
 * His crown once he is defeated (GDD-BOS-02), null before. It pops off his head (BOSS_ART.headTumble or headLying), BOSS_DEFEAT.crownVx
 * px/s across towards the arena's middle and BOSS_DEFEAT.crownVy px/s up, falls under BOSS_DEFEAT.crownGravity and, stepped like the rocks one step at a time for `b.age` steps,
 * bounces once on the floor at BOSS_DEFEAT.crownBounce of its speed and rests there at the second touch.
 */
export function bossCrown(def: Boss, b: BossState): Crown | null {
  if (b.mode !== 'defeated') return null;
  const vx = (b.tx > def.x ? -1 : 1) * BOSS_DEFEAT.crownVx;
  // It starts at his head in the frame he shows on the hit step (bossPose's rule): falling (tumbleA) with room above the floor, else lying.
  const head = def.floor - (b.ty + BOSS.height / 2) >= BOSS_ART.tumbleABelow ? BOSS_ART.headTumble : BOSS_ART.headLying;
  let x = b.tx + head.x * b.dir;
  let y = b.ty + head.y;
  let vy = -BOSS_DEFEAT.crownVy;
  let bounced = false;
  for (let i = 0; i < b.age; i++) {
    vy += BOSS_DEFEAT.crownGravity * STEP;
    x += vx * STEP;
    y += vy * STEP;
    // Only a falling crown reaches the floor: it starts above it and the bounce lifts it clear on the next step (the bounce rule covers "while falling", L-025).
    if (y < def.floor) continue;
    y = def.floor;
    if (bounced) return { x, y, resting: true, tilted: false };
    vy *= -BOSS_DEFEAT.crownBounce;
    bounced = true;
  }
  return { x, y, resting: false, tilted: Math.floor(b.age / BOSS_DEFEAT.crownSpinSteps) % 2 === 1 };
}

/** Poncho's hurtbox (GDD-MOV-06) as a box. */
export function ponchoBox(player: PlayerState): Box {
  const h = hurtbox(player);
  return { x0: h.x, x1: h.x + h.w, y0: h.y, y1: h.y + h.h };
}

/** A fruit's square box. */
export const fruitBox = (f: Fruit): Box => ({ x0: f.x - FRUIT.size / 2, x1: f.x + FRUIT.size / 2, y0: f.y - FRUIT.size, y1: f.y });

/**
 * One step of a fruit, or null once it is gone. It falls at FRUIT.fallSpeed; when it touches a tile it bursts, except in phase 3, where
 * it lies on that tile's top for FRUIT.lieSteps.
 */
export function stepFruit(f: Fruit, world: TileGrid, phase: number): Fruit | null {
  if (f.landed) return f.age + 1 >= FRUIT.lieSteps ? null : { ...f, age: f.age + 1 };
  const y = f.y + FRUIT.fallSpeed * STEP;
  if (!squareBlocked(world, f.x, y, FRUIT.size)) return { ...f, y };
  return phase === 3 ? { ...f, y: Math.floor((y - EDGE) / TILE) * TILE, landed: true, age: 0 } : null;
}

/** Every rock resting on its spot, as at the start and after a lost life. */
export const freshRocks = (spots: readonly { readonly x: number; readonly y: number }[]): RockState[] =>
  spots.map((s) => ({ x: s.x, y: s.y, vx: 0, vy: 0, mode: 'rest', age: 0 }));

/** A rock's square box. */
export const rockBox = (r: RockState): Box => ({ x0: r.x - ROCK.size / 2, x1: r.x + ROCK.size / 2, y0: r.y - ROCK.size, y1: r.y });

/** A claw swipe facing `dir` knocks a resting rock: across that way and up. It moves from the next step. */
export const knock = (r: RockState, dir: 1 | -1): RockState => ({ ...r, vx: dir * ROCK.knockX, vy: -ROCK.knockY, mode: 'flying' });

/** A rock that broke. */
export const broken = (r: RockState): RockState => ({ ...r, mode: 'gone', age: 0 });

/**
 * One step of a rock. A flying one moves and falls, and breaks when it touches a tile or leaves the level; a gone one is back on its spot
 * ROCK.backSteps after it broke; a resting one stays.
 */
export function stepRock(r: RockState, spot: { readonly x: number; readonly y: number }, world: TileGrid): RockState {
  if (r.mode === 'rest') return r;
  if (r.mode === 'gone') return r.age + 1 >= ROCK.backSteps ? { x: spot.x, y: spot.y, vx: 0, vy: 0, mode: 'rest', age: 0 } : { ...r, age: r.age + 1 };
  const vy = r.vy + ROCK.gravity * STEP;
  const x = r.x + r.vx * STEP;
  const y = r.y + ((r.vy + vy) / 2) * STEP;
  if (squareBlocked(world, x, y, ROCK.size) || y - ROCK.size > world.height * TILE) return broken({ ...r, x, y });
  return { ...r, x, y, vy };
}
