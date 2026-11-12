// GDD-ENM-02, GDD-ENM-03, GDD-ENM-04, GDD-ART-05: which frame of its sheet each enemy shows, and where. Pure, no Phaser: the scene draws what this says.
import { ARMADILLO, CACTUS, CHAPULIN, ENEMY_ART, PALOMA, TILE, TLACUACHE, TROMPO } from '../config/tuning';
import { kick, tuckLeft, tuckRed } from '../sim/armadillo';
import { feetOf, kindOf, type Enemy, type EnemyState } from '../sim/enemy';
import type { World } from '../sim/movement';
import type { RunState } from '../sim/run';
import { surfaceY } from '../sim/slope';
import { ARMADILLO_BOTTOMS, lookFrame, type EnemyLook, type EnemySheet } from './enemyLooks';

/**
 * What a pose is picked from: the run's clock (the cactus buddy's breathing and shiver) and the middle of Poncho's hurtbox (`centre`); and
 * the level's tiles, which an Armadillo's drawing is kept out of (GDD-ENM-04). Left out, nothing is kept out.
 */
export interface PoseContext {
  readonly clock: number;
  readonly poncho: { readonly x: number; readonly y: number };
  readonly world?: World;
}

export interface EnemyPose {
  readonly look: EnemyLook;
  /** The frame of `look` in the kind's sheet. */
  readonly frame: number;
  /** The middle of its box across; down, a walker's feet and the middle of a Zopilote's box (its flight y) or a Murciélago's (its loop y). */
  readonly x: number;
  readonly y: number;
  /** Mirrored: it faces left (the art faces right). */
  readonly flip: boolean;
}

/** `n` mod `m`, never negative (a walker's x can be). */
const mod = (n: number, m: number): number => ((n % m) + m) % m;

/** Every `steps`, the next of `count` frames. */
const cycle = (age: number, steps: number, count: number): number => mod(Math.floor(age / steps), count);

const WALK = ['walk0', 'walk1', 'walk2', 'walk3'] as const;
const RUN = ['run0', 'run1', 'run2', 'run3'] as const;
const FLAP = ['flap0', 'flap1', 'flap2', 'flap3'] as const;
const CLIMB = ['climb0', 'climb1'] as const;
const DOZE = ['doze0', 'doze1'] as const;
const ALARM = ['alarm0', 'alarm1'] as const;
const CROUCH = ['crouch0', 'crouch1'] as const;
const SPIN = ['spin0', 'spin1', 'spin2', 'spin3'] as const;
const ROLL = ['roll0', 'roll1', 'roll2', 'roll3'] as const;

/** The telegraph's red flash (GDD-ENM-01): red for flashSteps, plain for as many. */
const flash = (age: number): EnemyLook => (Math.floor(age / ENEMY_ART.flashSteps) % 2 === 0 ? 'teleRed' : 'tele');

/** How far above its feet a Paloma has flown, drawn lower by PALOMA.bobPx on every other bobSteps block while it hovers. */
function liftOf(state: EnemyState): number {
  const w = state.wing;
  if (!w) return 0;
  const bob = w.phase === 'hover' && Math.floor(w.age / ENEMY_ART.bobSteps) % 2 === 1 ? PALOMA.bobPx : 0;
  return w.lift - bob;
}

/** The look and the facing of each kind (see `enemyPose`). */
function lookOf(kind: EnemySheet, def: Enemy, state: EnemyState, ctx: PoseContext): { look: EnemyLook; flip: boolean } {
  const left = state.dir < 0;
  switch (kind) {
    case 'alacran':
      return { look: WALK[cycle(state.x, ENEMY_ART.walkPx, 4)]!, flip: left };
    case 'zopilote': {
      const f = state.flight!;
      if (f.phase === 'telegraph') return { look: flash(f.age), flip: left };
      if (f.phase === 'dive') {
        const steep = Math.abs(f.aimY - f.y) >= ENEMY_ART.steepRatio * Math.abs(f.aimX - state.x);
        return { look: steep ? 'diveSteep' : 'diveShallow', flip: f.aimX === state.x ? left : f.aimX < state.x };
      }
      if (f.phase === 'return') return { look: CLIMB[cycle(f.age, ENEMY_ART.climbSteps, 2)]!, flip: left };
      return { look: FLAP[cycle(f.age, ENEMY_ART.flapSteps, 4)]!, flip: left };
    }
    case 'cactus': {
      // It faces Poncho while it peeks or is alarmed, and dozes facing right.
      const dx = ctx.poncho.x - state.x;
      const dy = ctx.poncho.y - (feetOf(def, state) - CACTUS.height / 2);
      const within = (r: { x: number; y: number }) => Math.abs(dx) <= r.x && Math.abs(dy) <= r.y;
      if (within(ENEMY_ART.alarm)) return { look: ALARM[cycle(ctx.clock, ENEMY_ART.shiverSteps, 2)]!, flip: dx < 0 };
      if (within(ENEMY_ART.peek)) return { look: 'peek', flip: dx < 0 };
      return { look: DOZE[cycle(ctx.clock, ENEMY_ART.dozeSteps, 2)]!, flip: false };
    }
    case 'tlacuache': {
      const g = state.gait!;
      if (g.phase === 'telegraph') return { look: flash(g.age), flip: left };
      if (g.phase === 'charge') return { look: RUN[cycle(state.x, ENEMY_ART.chargePx, 4)]!, flip: left };
      if (g.phase === 'dead') {
        // Its feet curl in the last twitchSteps before it wakes, every other 4 steps (the placeholder's twitch).
        const twitch = g.age >= TLACUACHE.playDeadSteps - TLACUACHE.twitchSteps && Math.floor(g.age / 4) % 2 === 0;
        return { look: twitch ? 'deadTwitch' : 'dead', flip: left };
      }
      return { look: WALK[cycle(state.x, ENEMY_ART.walkPx, 4)]!, flip: left };
    }
    case 'paloma': {
      const w = state.wing!;
      if (w.phase === 'telegraph') return { look: flash(w.age), flip: left };
      if (w.phase === 'rise') return { look: FLAP[cycle(w.age, ENEMY_ART.riseFlapSteps, 4)]!, flip: left };
      if (w.phase === 'hover') return { look: FLAP[cycle(w.age, ENEMY_ART.hoverFlapSteps, 4)]!, flip: left };
      if (w.phase === 'descend') return { look: 'glide', flip: left };
      return { look: WALK[cycle(state.x, ENEMY_ART.walkPx, 4)]!, flip: left };
    }
    case 'chapulin': {
      const h = state.hop!;
      if (h.phase === 'crouch') {
        // The telegraph is the last CHAPULIN.flashSteps of the crouch (GDD-ENM-01); before it, it chews.
        const calm = CHAPULIN.crouchSteps - CHAPULIN.flashSteps;
        return { look: h.age >= calm ? flash(h.age - calm) : CROUCH[cycle(h.age, ENEMY_ART.chewSteps, 2)]!, flip: left };
      }
      // Only an awning's throw rises faster than its own hop can.
      return { look: h.vy < -CHAPULIN.hopUp ? 'boing' : h.vy < 0 ? 'rise' : 'fall', flip: left };
    }
    case 'trompo': {
      const s = state.spin!;
      if (s.phase === 'spin') return { look: SPIN[cycle(s.age, ENEMY_ART.spinSteps, 4)]!, flip: left };
      // It rocks on every other block of rockSteps in the stun's last wobbleSteps.
      const rock = s.age >= TROMPO.stunSteps - TROMPO.wobbleSteps && Math.floor(s.age / ENEMY_ART.rockSteps) % 2 === 0;
      return { look: rock ? 'stunWobble' : 'stun', flip: left };
    }
    case 'murcielago':
      return { look: FLAP[cycle(state.loop!.steps, ENEMY_ART.batFlapSteps, 4)]!, flip: left };
    case 'armadillo': {
      const s = state.shell!;
      if (s.phase === 'tuck') return { look: tuckRed(tuckLeft(s)) ? 'tuckRed' : 'tuck', flip: left };
      // Rolling, the frames advance with the px it rolls its own way (x times its facing), and it is mirrored rolling left: the drawn
      // bands and ear turn clockwise rolling right, so mirrored and in the same order they turn anticlockwise.
      if (s.phase === 'roll') return { look: ROLL[cycle(state.x * state.dir, ENEMY_ART.rollPx, 4)]!, flip: left };
      if (s.phase === 'dazed') return { look: kick(s) && Math.floor(s.age / ENEMY_ART.kickFlipSteps) % 2 === 0 ? 'dazedKick' : 'dazed', flip: left };
      return { look: WALK[cycle(state.x, ENEMY_ART.walkPx, 4)]!, flip: left };
    }
    default:
      return kind satisfies never;
  }
}

/**
 * The pose of an enemy (GDD-ENM-02, GDD-ENM-03). An Alacrán and a walking Tlacuache show the next walk frame every ENEMY_ART.walkPx px they walk
 * (a charging Tlacuache the next run frame every chargePx), so their legs keep pace with the ground. A cruising Zopilote flaps, climbing back
 * it beats harder, and diving it shows the steep look when the dive's drop is at least steepRatio times its run. A telegraph flashes red
 * (GDD-ENM-01). The cactus buddy dozes, peeks when Poncho comes near and is alarmed when he is close. A Tlacuache playing dead twitches in
 * its last TLACUACHE.twitchSteps. Each faces the way it goes, a Zopilote the way it dives.
 *
 * World 2's (Proposed): a Paloma walks like the Alacrán, claps its wings every riseFlapSteps as it rises, flaps every hoverFlapSteps as it
 * hovers, glides down, and is drawn its flown height above its feet, PALOMA.bobPx lower on every other bobSteps while it hovers. A Chapulín
 * chews (crouch0, crouch1) every chewSteps for the first part of its crouch, flashes in the last CHAPULIN.flashSteps, and in the air boings
 * if thrown up faster than its own hop, else rises, else falls. A Trompo shows the next spin frame every spinSteps; stunned, it lies still
 * and rocks (stunWobble) on every other rockSteps block of the last TROMPO.wobbleSteps. Each stands on its feet, facing the way it goes.
 *
 * World 3's (GDD-ENM-04, Proposed): a Murciélago shows the next flap frame every batFlapSteps of its own steps, drawn at its box's middle,
 * facing the way it moves across. An Armadillo walks like the Alacrán; tucked it flashes red (`tuckRed`, its sheet's own red frame); rolling
 * it shows the next roll frame every rollPx px it rolls, its way, in the air too; dazed it lies on its back, kicking (dazedKick) on every other
 * kickFlipSteps block while `kick` says, drawn ENEMY_ART.dazedBack px back from the wall it faces. It stands on its feet, facing its way.
 */
export function enemyPose(def: Enemy, state: EnemyState, ctx: PoseContext): EnemyPose {
  const kind = kindOf(def);
  const { look, flip } = lookOf(kind, def, state, ctx);
  const y = state.flight?.y ?? state.loop?.y ?? feetOf(def, state) - liftOf(state);
  if (kind === 'armadillo' && state.shell!.phase === 'dazed') return { look, frame: lookFrame(kind, look), x: state.x - state.dir * ENEMY_ART.dazedBack, y, flip };
  if (kind === 'armadillo' && ctx.world) {
    const at = keptOut(ctx.world, ARMADILLO_BOTTOMS[look]!, state.x, y, flip);
    return { look, frame: lookFrame(kind, look), x: at.x, y: at.y, flip };
  }
  return { look, frame: lookFrame(kind, look), x: state.x, y, flip };
}

/** An Armadillo look's bottom (`ARMADILLO_BOTTOMS`): each drawn column's middle across from the frame's middle and its bottom's height over the feet, in game px, mirrored when `flip`. */
function bottomOf(cols: string, flip: boolean): { dx: number; h: number }[] {
  const out: { dx: number; h: number }[] = [];
  for (let i = 0; i < cols.length; i++) {
    if (cols[i] === '.') continue;
    const dx = (i + 0.5 - cols.length / 2) / 2;
    out.push({ dx: flip ? -dx : dx, h: parseInt(cols[i]!, 36) / 2 });
  }
  return out;
}

/** A wall to an Armadillo's drawing: a level tile in column `tx` in the row just over its box, its feet at `feet`. */
const wallAt = (world: World, tx: number, feet: number): boolean => world.solidTile(tx, Math.floor((feet - ARMADILLO.height - 1) / TILE));

/**
 * GDD-ENM-04, L-059: where an Armadillo look, its bottom `cols`, is drawn so that nothing of it lies in a wall or in the ground, the middle of its feet at (x,
 * feet). Beside a wall (`wallAt`) it is shifted off the wall by as much as its drawing reaches past its box on that side beyond the room
 * there (walking flush against a wall: by its whole reach, the snout's 4.5 px or the tail's 5); then, where its bottom would lie in a
 * slope's sand or a step's tile, it is raised until no drawn pixel's middle does (the frame's lowest point at the ground under its uphill
 * side; its downhill feet hover). No turn.
 */
function keptOut(world: World, cols: string, x: number, feet: number, flip: boolean): { x: number; y: number } {
  const bottom = bottomOf(cols, flip);
  const half = ARMADILLO.width / 2;
  const right = Math.max(...bottom.map((b) => b.dx + 0.25)) - half;
  const left = -half - Math.min(...bottom.map((b) => b.dx - 0.25));
  let shift = 0;
  for (let tx = Math.floor((x + half) / TILE); tx * TILE < x + half + right; tx++) {
    if (wallAt(world, tx, feet) && tx * TILE >= x + half - 1e-6) {
      shift -= Math.max(0, right - (tx * TILE - (x + half)));
      break;
    }
  }
  for (let tx = Math.floor((x - half) / TILE) - (Number.isInteger((x - half) / TILE) ? 1 : 0); (tx + 1) * TILE > x - half - left; tx--) {
    if (wallAt(world, tx, feet) && (tx + 1) * TILE <= x - half + 1e-6) {
      shift += Math.max(0, left - (x - half - (tx + 1) * TILE));
      break;
    }
  }
  const x1 = x + shift;
  let lift = 0;
  for (const b of bottom) {
    const px = x1 + b.dx;
    const py = feet - b.h - 0.25; // the middle of its lowest pixel
    const tx = Math.floor(px / TILE);
    const ty = Math.floor(py / TILE);
    if (wallAt(world, tx, feet)) continue;
    const slope = world.slopeAt?.(tx, ty) ?? null;
    if (slope !== null) lift = Math.max(lift, py - surfaceY(tx, ty, slope, px));
    else if (world.solidTile(tx, ty)) {
      const on = world.slopeAt?.(tx, ty - 1) ?? null;
      lift = Math.max(lift, py - (on === null ? ty * TILE : surfaceY(tx, ty - 1, on, px)) + 0.25);
    }
  }
  return { x: x1, y: feet - lift };
}

/**
 * GDD-ENM-04: the steps left of each enemy's white flash after a step: ENEMY_ART.rangSteps on the step the claw rang off its ball (`rang`),
 * one fewer on each step after, to 0. A lost life (the run respawning) or a defeat clears it. Shown while above 0.
 */
export function stepRang(left: readonly number[], after: Pick<RunState, 'enemies' | 'phase'>): number[] {
  return after.enemies.map((e, i) => (after.phase === 'respawning' || !e.alive ? 0 : e.shell?.rang ? ENEMY_ART.rangSteps : Math.max(0, (left[i] ?? 0) - 1)));
}
