// GDD-ENM-02, GDD-ENM-03, GDD-ART-05: which frame of its sheet each enemy shows, and where. Pure, no Phaser: the scene draws what this says.
import { CACTUS, CHAPULIN, ENEMY_ART, PALOMA, TLACUACHE, TROMPO } from '../config/tuning';
import { feetOf, kindOf, type Enemy, type EnemyState } from '../sim/enemy';
import { lookFrame, type EnemyLook, type EnemySheet } from './enemyLooks';

/** What a pose is picked from: the run's clock (the cactus buddy's breathing and shiver) and the middle of Poncho's hurtbox (`centre`). */
export interface PoseContext {
  readonly clock: number;
  readonly poncho: { readonly x: number; readonly y: number };
}

export interface EnemyPose {
  readonly look: EnemyLook;
  /** The frame of `look` in the kind's sheet. */
  readonly frame: number;
  /** The middle of its box across; down, a walker's feet and the middle of a Zopilote's box (its flight y). */
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
 */
export function enemyPose(def: Enemy, state: EnemyState, ctx: PoseContext): EnemyPose {
  const kind = kindOf(def);
  const { look, flip } = lookOf(kind, def, state, ctx);
  return { look, frame: lookFrame(kind, look), x: state.x, y: state.flight?.y ?? feetOf(def, state) - liftOf(state), flip };
}
