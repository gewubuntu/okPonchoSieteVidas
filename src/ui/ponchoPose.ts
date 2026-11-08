// GDD-ART-04: which of Poncho's frames shows, step by step, and what is drawn with it (the taco or chile he holds, the claw swipe,
// the flame of the spit and the crumbs of a bite), and where. Pure, no Phaser: the scene feeds it each simulation step and draws what it says.
import { HIT, PONCHO_ART, TACO } from '../config/tuning';
import { clawBox, type ClawState } from '../sim/claw';
import type { PlayerState } from '../sim/movement';
import { flipPose } from '../sim/respawnFlip';
import type { RunState } from '../sim/run';
import type { Power } from '../sim/taco';
import { startAnim, stepAnim, STAND, type PonchoAnim } from './ponchoAnim';
import { FX_MOUTH, HELD_HAND, ITEM_FRAMES, PONCHO_BOX, PONCHO_FRAME, PONCHO_FRAMES, SWIPE_BOX } from './ponchoFrames';
import { ITEM_LOOKS, ponchoFrame, type FxLook, type HeldLook, type PickupLook, type PonchoLook, type SwipeLook } from './ponchoLooks';

/** What a pose is picked from: the run before and after a step. */
export type PoseRun = Pick<RunState, 'phase' | 'wait' | 'player' | 'invulnerable' | 'claw' | 'fireballs' | 'power' | 'items'>;

/** What was eaten, for the food in his paw while he eats it. */
export type Food = 'taco' | 'chile';

export interface PonchoPose {
  readonly look: PonchoLook;
  /** The frame of `look` in his sheet. */
  readonly frame: number;
  /** Mirrored: he faces left (the art faces right); in a claw swipe the way the swipe faces. */
  readonly flip: boolean;
  /** The held item's look, drawn at the frame's hand, or null. */
  readonly held: HeldLook | null;
  /** The claw swipe's look, drawn on the claw's box, or null. */
  readonly swipe: SwipeLook | null;
  /** The flame of the spit or the crumbs of a bite, drawn at the frame's mouth, or null. */
  readonly fx: FxLook | null;
  /** The run frames' state (`ponchoAnim.ts`). */
  readonly anim: PonchoAnim;
  /** Steps since each timed pose began, the step it began on being 1; 0 while it is not going on. */
  readonly hurt: number;
  readonly follow: number;
  readonly spit: number;
  readonly eat: number;
  readonly food: Food;
  readonly takeoff: number;
  readonly land: number;
  /** Steps in a row he has stood idle, this one included. */
  readonly idle: number;
}

/** The pose before any step: standing, facing right. */
export function startPose(x: number): PonchoPose {
  return { look: 'idle', frame: ponchoFrame('idle'), flip: false, held: null, swipe: null, fx: null, anim: startAnim(x), hurt: 0, follow: 0, spit: 0, eat: 0, food: 'taco', takeoff: 0, land: 0, idle: 0 };
}

const RANK: Record<Power, number> = { base: 0, taco: 1, fuego: 2 };
const sum = (steps: readonly number[]): number => steps.reduce((a, b) => a + b, 0);

/** The age of a timed pose `total` steps long: 1 on the step it starts, then counting, 0 once it is over. */
const age = (start: boolean, prev: number, total: number): number => (start ? 1 : prev > 0 && prev < total ? prev + 1 : 0);

/** On step `n` (from 1) of a pose that shows `a` for `steps[0]` steps and then `b` for `steps[1]`: which, or null after both. */
const twoOf = <L>(n: number, steps: readonly [number, number], a: L, b: L): L | null => (n <= steps[0] ? a : n <= steps[0] + steps[1] ? b : null);

const FLIP = ['flip0', 'flip1', 'flip2', 'flip3', 'flip4', 'flip5', 'flip6', 'flip7'] as const;
const RUN = ['run0', 'run1', 'run2', 'run3'] as const;

/** The look of the respawn flip's frame for a turn of `angle` radians: the nearest of its eight 45-degree steps. */
export const flipLook = (angle: number): PonchoLook => FLIP[((Math.round(angle / (Math.PI / 4)) % 8) + 8) % 8]!;

/**
 * The pose after a step from `before` to `after`. Priority, the first that applies wins: the respawn flip; hurt (a hit that cost his
 * power, not a life); the claw (its wind-up, its swing and the follow-through after it); the spit (a fireball spat this step); eating (a
 * taco or chile that raised his power); in the air (the take-off, then by his vertical speed); landing from a fall; the skid; the run
 * frames; standing (with a blink, and a glance at the taco in Taco or Fuego). Every timed pose keeps counting while one before it shows.
 */
export function stepPose(prev: PonchoPose, before: PoseRun, after: PoseRun): PonchoPose {
  const p = after.player;
  const playing = after.phase === 'playing';
  const anim = stepAnim(prev.anim, p, playing);
  const pose = (look: PonchoLook, flip: boolean, rest: Partial<PonchoPose> = {}): PonchoPose => ({
    ...startPose(p.x), anim, flip, ...rest, look, frame: ponchoFrame(look),
  });
  if (after.phase === 'respawning') {
    const flip = flipPose(after.wait);
    if (flip.visible) return pose(flipLook(flip.angle), p.facing < 0);
  }
  if (!playing) return pose('idle', p.facing < 0);

  const both = before.phase === 'playing';
  const hurt = age(both && after.invulnerable === HIT.invulnerableSteps, prev.hurt, sum(PONCHO_ART.hurtSteps));
  const follow = age(before.claw.phase === 'swing' && after.claw.phase === 'idle', prev.follow, PONCHO_ART.followSteps);
  const spit = age(after.fireballs.some((f) => f.age === 0), prev.spit, sum(PONCHO_ART.spitSteps));
  const ate = RANK[after.power] > RANK[before.power];
  const eat = age(ate, prev.eat, sum(PONCHO_ART.eatSteps));
  const chiles = (r: PoseRun) => r.items.filter((it) => it.kind === 'chile').length;
  const food: Food = ate ? (after.power === 'fuego' || chiles(after) < chiles(before) ? 'chile' : 'taco') : prev.food;
  const takeoff = age(p.takeoff !== undefined, prev.takeoff, PONCHO_ART.takeoffSteps);
  const land = age(both && !before.player.grounded && p.grounded && before.player.vy >= PONCHO_ART.landMinVy, prev.land, PONCHO_ART.landSteps);
  const counters = { hurt, follow, spit, eat, food, takeoff, land };
  const facingLeft = p.facing < 0;
  /** The held item for a frame by what it holds: a paw holding the taco (and the chile in Fuego), or the food he eats. */
  const held = (look: PonchoLook, foodLook: HeldLook | null = null): HeldLook | null => {
    const holds = PONCHO_FRAMES[look].holds;
    if (holds === 'food') return foodLook;
    if (holds === 'none' || after.power === 'base') return null;
    return after.power === 'fuego' ? 'chileHeld' : 'tacoHeld';
  };
  const show = (look: PonchoLook, rest: Partial<PonchoPose> = {}, flip = facingLeft): PonchoPose =>
    pose(look, flip, { held: held(look), ...counters, ...rest });

  if (hurt > 0) return show(hurt <= PONCHO_ART.hurtSteps[0] ? 'hurt0' : 'hurt1');
  const clawLeft = after.claw.dir < 0;
  if (after.claw.phase === 'windup') return show('clawWind', {}, clawLeft);
  if (after.claw.phase === 'swing') return show('clawSwipe', { swipe: after.claw.steps === 1 ? 'swipe0' : 'swipe1' }, clawLeft);
  if (follow > 0) return show('clawFollow', { swipe: twoOf(follow, PONCHO_ART.followSwipeSteps, 'swipe2', 'swipe3') }, clawLeft);
  if (spit > 0) {
    if (spit <= PONCHO_ART.spitSteps[0]) return show('spit0');
    return show('spit1', { fx: twoOf(spit - PONCHO_ART.spitSteps[0], PONCHO_ART.flameSteps, 'flame0', 'flame1') });
  }
  if (eat > 0) {
    if (eat <= PONCHO_ART.eatSteps[0]) return show('eat0', { held: held('eat0', food === 'chile' ? 'chileFood' : 'tacoFood') });
    const fx = twoOf(eat - PONCHO_ART.eatSteps[0], PONCHO_ART.crumbSteps, 'crumbs0', 'crumbs1');
    return show('eat1', { fx, held: held('eat1', food === 'chile' ? 'chileFood' : 'tacoBittenHeld') });
  }
  if (!p.grounded) {
    if (takeoff > 0) return show('jump0');
    return show(p.vy < PONCHO_ART.riseVy ? 'jump1' : p.vy < PONCHO_ART.apexVy ? 'apex' : p.vy < PONCHO_ART.fastFallVy ? 'fall0' : 'fall1');
  }
  if (land > 0) return show('land');
  if (Math.abs(p.vx) >= PONCHO_ART.skidMinSpeed && p.vx * p.facing < 0) return show('skid');
  if (anim.frame !== STAND) return show(RUN[anim.frame - 1]!);
  const idle = prev.idle + 1;
  const blink = (idle - 1) % PONCHO_ART.blinkEvery >= PONCHO_ART.blinkEvery - PONCHO_ART.blinkSteps;
  // The glance comes right after the first blink of every glanceEvery, so the two never meet.
  const inGlance = ((idle - 1) % PONCHO_ART.glanceEvery) - PONCHO_ART.blinkEvery;
  const glance = after.power !== 'base' && inGlance >= 0 && inGlance < PONCHO_ART.glanceSteps;
  return show(blink ? 'blink' : glance ? 'glance' : 'idle', { idle });
}

/** Where an image is drawn: its look and its middle, in game px. */
export interface Placed<L> {
  readonly look: L;
  readonly x: number;
  readonly y: number;
}

/**
 * Where the held item, the claw swipe and the effect at his mouth go for `pose`, with `player` where his feet are drawn and the claw
 * swinging the way `claw.dir` says (`clawBox`): the held frame's paw on the frame's hand, the effects frame's mouth on the frame's mouth, the swipe
 * frame's box on the claw's box (`clawBox`), each mirrored with what it goes with.
 */
export function ponchoParts(pose: PonchoPose, player: PlayerState, claw: ClawState): { held: Placed<HeldLook> | null; swipe: Placed<SwipeLook> | null; fx: Placed<FxLook> | null } {
  const { x, y } = player;
  const side = pose.flip ? -1 : 1;
  const data = PONCHO_FRAMES[pose.look];
  // A point of his frame (drawing px, facing right) where `anchor` of an item frame `w` x `h` wide goes: that frame's middle, in game px.
  const at = (point: { x: number; y: number }, anchor: { x: number; y: number }, w: number, h: number) => ({
    x: x + (side * (point.x - anchor.x + w / 2 - PONCHO_FRAME.w / 2)) / 2,
    y: y + (point.y - anchor.y + h / 2 - PONCHO_BOX.y1) / 2,
  });
  const held = pose.held ? { look: pose.held, ...at(data.hand, HELD_HAND, ITEM_FRAMES.held.w, ITEM_FRAMES.held.h) } : null;
  const fx = pose.fx && data.mouth ? { look: pose.fx, ...at(data.mouth, FX_MOUTH, ITEM_FRAMES.fx.w, ITEM_FRAMES.fx.h) } : null;
  let swipe: Placed<SwipeLook> | null = null;
  if (pose.swipe) {
    const box = clawBox(player, { ...claw, phase: 'swing' })!;
    // The swipe frame's box on the claw's box, its bottom row on his feet. The box is as far in from the frame's right edge as from its
    // left (scripts/art/poncho/items.test.mjs), so the frame mirrored for the left lies the same way about it.
    const { w, h } = ITEM_FRAMES.swipe;
    const left = box.x0 - SWIPE_BOX.x0 / 2;
    swipe = { look: pose.swipe, x: left + w / 4, y: box.y1 - (SWIPE_BOX.y1 - h / 2) / 2 };
  }
  return { held, swipe, fx };
}

/**
 * A taco or chile pickup's look at the run's clock `clock` (steps): its four bob frames in turn, `PONCHO_ART.pickup.bobSteps` each, and
 * its glint for the last `glintSteps` of every `glintEvery`.
 */
export function pickupLook(kind: 'taco' | 'chile', clock: number): PickupLook {
  const { bobSteps, glintEvery, glintSteps } = PONCHO_ART.pickup;
  const looks: readonly PickupLook[] = ITEM_LOOKS[kind];
  if (clock % glintEvery >= glintEvery - glintSteps) return looks[4]!;
  return looks[Math.floor(clock / bobSteps) % 4]!;
}

/**
 * Where a taco or chile out of a piñata is drawn, standing with its feet at (`x`, `feet`) (GDD-PWR-02, GDD-PWR-03): the middle of its frame,
 * in game px. Its square's middle, lifted by how far its frames reach below the square (`PONCHO_ART.pickup.reach`), so that no bob frame
 * reaches below its feet (L-059).
 */
export function itemAt(kind: 'taco' | 'chile', x: number, feet: number): { x: number; y: number } {
  return { x, y: feet - TACO.size / 2 - PONCHO_ART.pickup.reach[kind].below };
}
