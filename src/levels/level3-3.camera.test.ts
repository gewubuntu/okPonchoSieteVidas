import { describe, expect, it } from 'vitest';
import { CAMERA, CART, STEP, TILE } from '../config/tuning';
import { enemyBox, type Box } from '../sim/enemy';
import { railGround } from '../sim/cart';
import { platformAt, standsOnPlatform } from '../sim/platform';
import type { RunState } from '../sim/run';
import { cameraLimitsAt, cutCameraY, ponchoShown } from '../ui/camera';
import { span, tally } from './bots';
import {
  bodyBox,
  bot,
  camerasOf,
  CAREFUL,
  cartOf,
  clocks,
  E,
  endOf,
  inCart,
  last,
  LOSS_K2_RUN,
  LOSS_K3_WALK,
  LOSS_PLANK_STOP,
  LOSS_R3_PLAIN,
  LOSS_R3_STAY,
  LOSS_VULTURE_STAND,
  playLoss,
  L,
  type Name,
  railOf,
  RIDER,
  SECRET,
  startAt,
  velaTaken,
  WALKER,
  whollyOnScreen,
  Y,
  zopilote,
} from './level3-3.drive';
import { LEVEL_3_3_AT, LEVEL_3_3_PITS, LEVEL_3_3_PLATFORM } from './level3-3';
import { onScreen, tileBox, viewOf, type View } from './sightSweep';

// GDD-WLD-18, phase B2d: the camera (GDD-UI-04, `src/ui/camera.ts`) along the four whole-level bots of B2a and B2b, as the scene steps it (`stepSightCamera`, at
// alpha 1), over the real level with every enemy, lift and cart at the start clock they are stood at (`startAt`, L-014). The level is registered after 3-2 (`src/levels/index.ts`). "On screen" is
// measured both ways, a box that overlaps the view (`onScreen`) and one wholly inside it (`whollyOnScreen`). A step n is the state after n steps from the start
// (`[from, ...bot.states]`, so the state `k` of the other files' bots is step k + 1 here).

/**
 * Shares no factor with the bats' period (240), the lifts' rounds (MP0 432, MP1 192, MP2 384), the Armadillo's walk (1,058) or the Zopilote's (7,200): the 75
 * start clocks meet 75 different phases of each, not every phase of each (L-092; 249 clocks, step 29, would take three times as long).
 */
const STEP_CLOCKS = 97;
const COUNT = clocks(7200, STEP_CLOCKS).length;

const BOTS = { rider: RIDER, careful: CAREFUL, walker: WALKER, secret: SECRET } as const;
type BotName = keyof typeof BOTS;

const px = (n: number) => Math.round(n * 10) / 10;
/** `[onScreen, whollyOnScreen]` of a box in a view, as a word. */
const seen = (box: Box, view: View) => `${onScreen(box, view) ? 'overlaps' : 'off'}, ${whollyOnScreen(box, view) ? 'whole' : 'not whole'}`;

/** A cart's box in run `r` (waiting, rolling or stopped): CART.width x CART.height around its middle, its bottom on the rail's ground under it. */
const cartBoxOf = (r: RunState, name: Name): Box => {
  const rail = railOf(name);
  const c = r.carts[cartOf(name)]!;
  const middle = rail.x + rail.dir * c.m;
  const bottom = railGround(rail, c.m);
  return { x0: middle - CART.width / 2, x1: middle + CART.width / 2, y0: bottom - CART.height, y1: bottom };
};
/** A level rail's box: from its start to its end, from the ground up to a cart's height. */
const railBoxOf = (name: Name): Box => {
  const rail = railOf(name);
  const end = endOf(name);
  return { x0: Math.min(rail.x, end), x1: Math.max(rail.x, end), y0: rail.y - CART.height, y1: rail.y };
};

/** One flight: the last state he stood on anything (`off`) to the first he stands again (`on`), or to the run's last state (`landed` false). */
interface Flt {
  readonly off: number;
  readonly on: number;
  readonly landed: boolean;
}
function flightsOf(st: readonly RunState[]): Flt[] {
  const out: Flt[] = [];
  let off = -1;
  for (let k = 1; k < st.length; k++) {
    // A life lost ends the flight: nothing of a respawn's wait is one.
    if (st[k]!.phase === 'respawning' || st[k]!.phase === 'gameover') {
      off = -1;
      continue;
    }
    const was = st[k - 1]!.phase === 'playing' && st[k - 1]!.player.grounded;
    const is = st[k]!.player.grounded;
    if (was && !is) off = k - 1;
    else if (!was && is && off >= 0) {
      out.push({ off, on: k, landed: true });
      off = -1;
    }
  }
  if (off >= 0) out.push({ off, on: st.length - 1, landed: false });
  return out;
}

const PIT_NAMES = ['chasm', 'afterP3', 'exit'] as const;
const PITS = { chasm: LEVEL_3_3_PITS.chasm, afterP3: LEVEL_3_3_PITS.afterP3, exit: LEVEL_3_3_PITS.exit } as const;
/** The row of the ground each pit's far bank stands on (its first column is the bank's near edge). */
const BANK_ROW = { chasm: LEVEL_3_3_AT.L1.row, afterP3: LEVEL_3_3_AT.P4.row, exit: LEVEL_3_3_AT.bank.row } as const;
/** Standing on P6: grounded on its ground's top with his middle over its columns. */
const onP6Now = (r: RunState) => r.player.grounded && r.player.y === Y(LEVEL_3_3_AT.P6.row) && r.player.x >= LEVEL_3_3_AT.P6.col0 * TILE && r.player.x < (LEVEL_3_3_AT.P6.col1 + 1) * TILE;
const colOf = (r: RunState) => Math.floor(r.player.x / TILE);
/** The first and last index of `st` where `when` holds, or null. */
function spanOf(st: readonly RunState[], when: (r: RunState, k: number) => boolean): { from: number; to: number } | null {
  const from = st.findIndex(when);
  if (from < 0) return null;
  let to = from;
  for (let k = from; k < st.length; k++) if (when(st[k]!, k)) to = k;
  return { from, to };
}
const rolling = (r: RunState, name: Name) => inCart(r, name) && r.carts[cartOf(name)]!.phase === 'rolling';
const onLift = (name: 'MP0' | 'MP1' | 'MP2') => (r: RunState) => standsOnPlatform(r.player, platformAt(LEVEL_3_3_PLATFORM[name], r.platformTick));

/** The climbs of a rail's cart: each climb segment's span across (px from the rail's start to the cart's middle), named by the column its foot is in. */
function climbsOf(name: Name): { label: string; m0: number; m1: number }[] {
  const rail = railOf(name);
  const out: { label: string; m0: number; m1: number }[] = [];
  let m = 0;
  for (const s of rail.segments) {
    if (s.kind === 'climb') out.push({ label: `${name} climb at ${Math.round(rail.x / TILE + m / TILE)}`, m0: m, m1: m + s.tiles * TILE });
    m += s.tiles * TILE;
  }
  return out;
}

/** What the camera showed along one bot's run from the start clock `t`, item by item (the plan's numbering). */
function facts(tasks: ReturnType<(typeof BOTS)[BotName]>, t: number) {
  const from = startAt(t);
  const b = bot(tasks, from, 8000, true);
  const st = [from, ...b.states];
  const cams = camerasOf(st);
  const view = (k: number) => viewOf(cams[k]!);
  const cut = (k: number) => k > 0 && ponchoShown(st[k]!) && !ponchoShown(st[k - 1]!);

  // 1 and 3 and 4: the start, the pictures' jumps, the limits.
  let maxDy = 0;
  let maxDx = 0;
  let outside = 0;
  let firstMove = -1;
  for (let k = 1; k < st.length; k++) {
    if (firstMove < 0 && cams[k]!.y.y !== cams[0]!.y.y) firstMove = k;
    if (cut(k)) continue;
    // Not in play (the wait to respawn) the camera is held (at the cut's y for the respawn point once the flip shows him), while `player.x` is still the column he fell in,
    // whose limits are not the respawn point's: a state of the wait is outside its own column's limits (y 312 over a bottom of 272 in the chasm), by design.
    maxDy = Math.max(maxDy, Math.abs(cams[k]!.y.y - cams[k - 1]!.y.y));
    maxDx = Math.max(maxDx, Math.abs(cams[k]!.scrollX - cams[k - 1]!.scrollX));
    const limits = cameraLimitsAt(L, st[k]!.player.x);
    if (st[k]!.phase === 'playing' && (cams[k]!.y.y < limits.top - 1e-9 || cams[k]!.y.y > Math.max(limits.bottom, cams[k - 1]!.y.y - CAMERA.panSpeed * STEP) + 1e-9)) outside++;
  }
  const start = { y: cams[0]!.y.y, bottom: cameraLimitsAt(L, st[0]!.player.x).bottom };

  // 2: P6.
  const onP6 = spanOf(st, onP6Now);
  const p6ys = st.flatMap((r, k) => (onP6Now(r) ? [cams[k]!.y.y] : []));
  const p6 = { on: onP6, states: p6ys.length, off: p6ys.filter((y) => y !== 0).length, first: p6ys[0] ?? null, toZero: p6ys.length === 0 ? null : p6ys.findIndex((y) => y === 0) };

  // 5: the lead in each of his carts he rode.
  const rides: Record<string, { from: number; to: number; lead: number; reached: number; yAtBoarding: number }> = {};
  for (const name of ['R1', 'R3', 'R4', 'R7'] as const) {
    const s = spanOf(st, (r) => rolling(r, name));
    if (s === null) continue;
    let lead = 0;
    for (let k = s.from; k <= s.to; k++) if (Math.abs(cams[k]!.lead) > Math.abs(lead)) lead = cams[k]!.lead;
    let reached = -1;
    for (let k = s.from; k <= s.to && reached < 0; k++) if (Math.abs(cams[k]!.lead) >= CAMERA.cartLead) reached = k;
    rides[name] = { from: s.from, to: s.to, lead, reached, yAtBoarding: cams[s.from]!.y.y };
  }

  // 6: the climbs.
  const flights = flightsOf(st);
  const climbs: Record<string, { from: number; to: number; up: boolean; upAt: number; yEnd: number }> = {};
  const climb = (label: string, s: { from: number; to: number } | null) => {
    if (s === null) return;
    const upAt = cams.findIndex((c, k) => k >= s.from && k <= s.to && c.y.look === 'up');
    climbs[label] = { from: s.from, to: s.to, up: upAt >= 0, upAt, yEnd: cams[s.to]!.y.y };
  };
  for (const lift of ['MP0', 'MP1', 'MP2'] as const) climb(lift, spanOf(st, onLift(lift)));
  for (const name of ['R1', 'R3'] as const) for (const c of climbsOf(name)) climb(c.label, spanOf(st, (r) => rolling(r, name) && r.carts[cartOf(name)]!.m >= c.m0 && r.carts[cartOf(name)]!.m < c.m1));
  // The spring throws him up at 480 px/s: from the state before the first state moving up faster than a jump does (400) to where he first stands on MP1.
  const launch = st.findIndex((r) => r.player.vy < -400);
  const mp1 = spanOf(st, onLift('MP1'));
  if (launch > 0 && mp1) climb('spring throw', { from: launch - 1, to: mp1.from });
  const stairs = spanOf(st, (r, k) => r.player.grounded && r.player.y === Y(15) && r.player.x >= 204 * TILE && k > 0);
  if (stairs) {
    const top = st.findIndex((r, k) => k > stairs.from && r.player.grounded && r.player.y <= Y(LEVEL_3_3_AT.P6.row) && r.player.x >= LEVEL_3_3_AT.P6.col0 * TILE);
    climb('stairs', { from: stairs.from, to: top });
  }

  // 7 and 8: the glides and every descent.
  const landing = (f: Flt) => ({ body: bodyBox(st[f.on]!), view: view(f.off) });
  const glides: Record<string, { off: number; on: number; landed: boolean; view: View; viewAtLanding: View; landing: Box; seen: string; x: number; y: number; bank: string }[]> = {};
  for (const name of PIT_NAMES) {
    const pit = PITS[name];
    for (const f of flights) {
      if (colOf(st[f.off]!) > pit.col0 || colOf(st[f.on]!) <= pit.col1) continue;
      const { body, view: v } = landing(f);
      const bank = tileBox(pit.col1 + 1, BANK_ROW[name]);
      (glides[name] ??= []).push({ off: f.off, on: f.on, landed: f.landed, view: v, viewAtLanding: view(f.on), landing: body, seen: seen(body, v), x: st[f.on]!.player.x - v.x, y: st[f.on]!.player.y - v.y, bank: seen(bank, v) });
    }
  }
  const descents = flights
    .filter((f) => st[f.on]!.player.y - st[f.off]!.player.y >= 2 * TILE)
    .map((f) => ({ off: f.off, on: f.on, landed: f.landed, col: colOf(st[f.off]!), seen: seen(landing(f).body, landing(f).view) }));

  // 9 and 10: K2's rail and K3's cart and the vulture, the step before the ringtail's first flash.
  const before = (e: number) => st.findIndex((r) => r.enemies[e]!.ride!.phase !== 'waiting') - 1;
  const k2 = before(E.K2);
  const k3 = before(E.K3);
  const k2Facts =
    k2 < 0
      ? null
      : { step: k2, view: view(k2), x: st[k2]!.player.x, feet: st[k2]!.player.y, boxes: { rail: railBoxOf('R5'), cart: cartBoxOf(st[k2]!, 'R5') }, rail: seen(railBoxOf('R5'), view(k2)), cart: seen(cartBoxOf(st[k2]!, 'R5'), view(k2)), ends: [railOf('R5').x - view(k2).x, endOf('R5') - view(k2).x] };
  const k3Facts =
    k3 < 0
      ? null
      : { step: k3, view: view(k3), x: st[k3]!.player.x, feet: st[k3]!.player.y, boxes: { cart: cartBoxOf(st[k3]!, 'R6'), vulture: enemyBox(L.enemies[E.ZOPILOTE]!, zopilote(st[k3]!)) }, cart: seen(cartBoxOf(st[k3]!, 'R6'), view(k3)), vulture: seen(enemyBox(L.enemies[E.ZOPILOTE]!, zopilote(st[k3]!)), view(k3)) };

  // 11: the veladora's tile.
  const tile = tileBox(L.veladora!.col, L.veladora!.row);
  const states = { overlap: st.filter((_, k) => onScreen(tile, view(k))).length, whole: st.filter((_, k) => whollyOnScreen(tile, view(k))).length };
  const taken = st.findIndex((r) => velaTaken(r));
  let off = -1;
  for (let k = taken - 1; k >= 0 && off < 0; k--) if (st[k]!.player.grounded) off = k;
  const vela = { states, taken, takeoff: taken < 0 ? null : { step: off, view: view(off), x: st[off]!.player.x, feet: st[off]!.player.y, seen: seen(tile, view(off)) } };

  return { st, cams, b, start, firstMove, p6, maxDy, maxDx, outside, rides, climbs, glides, descents, k2: k2Facts, k3: k3Facts, vela };
}


/** The tallies and ranges of one bot over the sweep: each topic is a tally of what was seen, or a range (`span`) of a number. */
class Pins {
  private tallies: Record<string, Record<string, number>> = {};
  private numbers: Record<string, number[]> = {};
  tally(topic: string, key: string | number | boolean) {
    tally((this.tallies[topic] ??= {}), String(key));
  }
  num(topic: string, n: number) {
    (this.numbers[topic] ??= []).push(px(n));
  }
  out() {
    return { ...this.tallies, ...Object.fromEntries(Object.entries(this.numbers).map(([k, v]) => [k, span(v)])) };
  }
}

type Facts = ReturnType<typeof facts>;
/** One run's `facts` into the sweep's tallies, topic by topic as the plan's numbering has it. */
function pinRun(p: Pins, f: Facts) {
  p.tally('01 the start is on the level bottom', f.start.y === f.start.bottom);
  p.num('01 the start y', f.start.y);
  p.tally('02 stood on P6', f.p6.states > 0);
  if (f.p6.states > 0) {
    p.num('02 states on P6', f.p6.states);
    p.num('02 states on P6 with the camera under the top', f.p6.off);
    p.num('02 the camera y on the first state on P6', f.p6.first!);
    p.num('02 states on P6 before the camera is on the top', f.p6.toZero!);
  }
  p.num('03 the largest y step', f.maxDy);
  p.num('03 the largest scroll step', f.maxDx);
  p.num('04 states outside the limits', f.outside);
  for (const [name, r] of Object.entries(f.rides)) {
    p.tally('05 the largest lead in a ride', `${name} ${r.lead}`);
    p.num(`05 ${name} steps to the full lead`, r.reached - r.from);
    p.num(`05 ${name} camera y at the boarding`, r.yAtBoarding);
  }
  for (const [label, c] of Object.entries(f.climbs)) {
    p.tally('06 the look-up on a climb', `${label}: ${c.up ? 'up' : 'never up'}`);
    if (c.up) p.num(`06 ${label}, steps from the start of the climb to the look-up`, c.upAt - c.from);
    p.num(`06 ${label}, camera y at the end`, c.yEnd);
  }
  for (const pit of Object.keys(PITS)) {
    const gs = f.glides[pit] ?? [];
    p.tally(`07 flights over the ${pit} pit`, gs.length);
    for (const g of gs) {
      p.tally(`07 the ${pit} glide, his landing`, `${g.seen}, ${g.landed ? 'landed' : 'cleared in the air'}`);
      p.tally(`07 the ${pit} glide, the far bank near edge`, g.bank);
      p.num(`07 the ${pit} glide, the landing's screen x`, g.x);
      p.num(`07 the ${pit} glide, the landing's screen y`, g.y);
    }
  }
  for (const d of f.descents) {
    p.tally('08 every descent of 2 tiles or more, his landing', `${d.seen}${d.landed ? '' : ', cleared in the air'}`);
    if (!d.seen.startsWith('overlaps')) p.tally('08 take-off columns off screen', d.col);
  }
  if (f.k2) {
    p.tally('09 K2 before its first flash', `rail ${f.k2.rail}; cart ${f.k2.cart}`);
    p.num('09 the rail start, screen x', f.k2.ends[0]!);
    p.num('09 the rail end, screen x', f.k2.ends[1]!);
  }
  if (f.k3) p.tally('10 K3 before its first flash', `cart ${f.k3.cart}; vulture ${f.k3.vulture}`);
  p.num('11 states with the veladora tile overlapping the view', f.vela.states.overlap);
  p.num('11 states with the veladora tile whole in the view', f.vela.states.whole);
  p.tally('11 the veladora taken', f.vela.taken >= 0);
  if (f.vela.takeoff) p.tally('11 the veladora tile at the take-off of the jump that takes it', f.vela.takeoff.seen);
}

describe('GDD-WLD-18 level 3-3 the camera along the four bots runs', () => {
  it(`GDD-WLD-18 3-3 the camera along the four bots' runs, from the start at every ${STEP_CLOCKS}th clock (step ${STEP_CLOCKS}, ${COUNT} clocks)`, () => {
    const out: Record<string, unknown> = {};
    const worst = { dy: 0, outside: 0 };
    for (const [name, make] of Object.entries(BOTS)) {
      const p = new Pins();
      for (const t of clocks(7200, STEP_CLOCKS)) {
        const f = facts(make(), t);
        pinRun(p, f);
        worst.dy = Math.max(worst.dy, f.maxDy);
        worst.outside += f.outside;
        p.tally('00 the run ends', f.b.lost.length > 0 ? `a life lost at column ${colOf(last(f.st))}, measured to there` : f.b.end.phase);
      }
      out[name] = p.out();
    }
    // GDD-UI-04's hard limit: the picture never jumps (CAMERA.maxSpeed, 480 px/s, 8 px a step), and no step in play is outside the camera's limits (but for the pan
    // up to a risen bottom). Not in play (the wait to respawn) the camera is held, and `player.x` is the column he fell in, so those states are left out (test 3 pins the cut).
    expect(worst.dy).toBeLessThanOrEqual(CAMERA.maxSpeed * STEP + 1e-9);
    expect(worst.outside).toBe(0);
    // Measured, from the start at the 75 clocks (a run that loses a life is measured up to the loss: the rider's line loses one at 31 of its 75 clocks, at columns 107, 108
    // and 111, and the other three bots clear every clock). Item by item, as the plan numbers them (the topics' numbers):
    // 01 the camera rests on the level's bottom at the start (y 320: his feet at 544, the cut wants 408, the bottom of a 37-row level is 320).
    // 02 only the walker stands on P6, and the camera is not on its top while he does: it is at 45.6 on his first state there, pans 3 px a step to 0 in 16 steps, and he
    // stands there 41 states. The rider, the careful bot and the secret bot board C4 from the stairs' last jump and never stand on P6; as C4 starts (05) the camera is at 60.6.
    // 03 the largest step of the picture is 8 px (the hard limit) in the careful, walker and secret runs, 4.8 in the rider's; the scroll 4.5 (the walker 2).
    // 04 no state in play outside the limits. 05 every ride of his carts (R1, R3, R4, R7) reaches the lead 64, the way the rail rolls (right), 31 steps after its first
    // state (the lead is 2 px by then, 64 over 2 px a step is 32 steps). 06 the look-up on every climb but R1's 1-tile one at column 7 (a rise of 16 px, under the 32 px
    // that starts it); the lifts MP0 (47 or 48 steps) and MP2 (48) start it that many steps after he steps on (32 px at 40 px/s), MP1 and the stairs on the first state.
    // 07 the chasm landing is off the screen at the take-off at every clock of every bot: the bank's near edge (column 99) is in the view, but his landing is at the screen's
    // x 517 (the walker's 501.9), 37 (22) px past its right edge. The pit after P3 and the exit pit are whole on screen: x 448.3 to 448.8 and 394.5 (the walker 392.7), the exit's
    // flight ends at the exit, in the air ("cleared in the air"). 08 every descent of 2 tiles or more is on screen but the chasm's. 09 K2's rail and cart are whole in the
    // view the step before its first flash, the rail's two ends 471 and 135 px from the left. 10 K3's cart and the vulture are whole too.
    // 11 the veladora's tile is on screen in 270 of the rider's and the careful bot's states, in 517 to 941 of the walker's and 780 to 1211 of the secret bot's (it
    // takes it, and the tile is whole in the view at the take-off of the jump that takes it); a bot that passes by sees it, none but the secret bot takes it.
    expect(out).toEqual({
      rider: {
        '00 the run ends': {
          clear: 44,
          'a life lost at column 111, measured to there': 8,
          'a life lost at column 107, measured to there': 13,
          'a life lost at column 108, measured to there': 10,
        },
        '01 the start is on the level bottom': { true: 75 },
        '01 the start y': '320 to 320',
        '02 stood on P6': { false: 75 },
        '03 the largest scroll step': '4.5 to 4.5',
        '03 the largest y step': '4.8 to 4.8',
        '04 states outside the limits': '0 to 0',
        '05 R1 camera y at the boarding': '320 to 320',
        '05 R1 steps to the full lead': '31 to 31',
        '05 R3 camera y at the boarding': '320 to 320',
        '05 R3 steps to the full lead': '31 to 31',
        '05 R4 camera y at the boarding': '284.6 to 284.6',
        '05 R4 steps to the full lead': '31 to 31',
        '05 R7 camera y at the boarding': '60.6 to 60.6',
        '05 R7 steps to the full lead': '31 to 31',
        '05 the largest lead in a ride': { 'R1 64': 75, 'R3 64': 75, 'R4 64': 44, 'R7 64': 44 },
        '06 MP1, camera y at the end': '190 to 190',
        '06 MP1, steps from the start of the climb to the look-up': '0 to 0',
        '06 MP2, camera y at the end': '110 to 110',
        '06 MP2, steps from the start of the climb to the look-up': '48 to 48',
        '06 R1 climb at 11, camera y at the end': '311.2 to 311.2',
        '06 R1 climb at 11, steps from the start of the climb to the look-up': '17 to 17',
        '06 R1 climb at 17, camera y at the end': '247.1 to 247.1',
        '06 R1 climb at 17, steps from the start of the climb to the look-up': '0 to 0',
        '06 R1 climb at 7, camera y at the end': '320 to 320',
        '06 R3 climb at 72, camera y at the end': '250.7 to 250.7',
        '06 R3 climb at 72, steps from the start of the climb to the look-up': '16 to 16',
        '06 spring throw, camera y at the end': '317 to 317',
        '06 spring throw, steps from the start of the climb to the look-up': '22 to 113',
        '06 stairs, camera y at the end': '60.6 to 60.6',
        '06 stairs, steps from the start of the climb to the look-up': '0 to 0',
        '06 the look-up on a climb': {
          'MP1: up': 75,
          'MP2: up': 44,
          'R1 climb at 7: never up': 75,
          'R1 climb at 11: up': 75,
          'R1 climb at 17: up': 75,
          'R3 climb at 72: up': 75,
          'spring throw: up': 75,
          'stairs: up': 44,
        },
        '07 flights over the afterP3 pit': { '0': 31, '1': 44 },
        '07 flights over the chasm pit': { '1': 75 },
        '07 flights over the exit pit': { '0': 31, '1': 44 },
        '07 the afterP3 glide, his landing': { 'overlaps, whole, landed': 44 },
        '07 the afterP3 glide, the far bank near edge': { 'overlaps, whole': 44 },
        '07 the afterP3 glide, the landing\'s screen x': '448.3 to 448.8',
        '07 the afterP3 glide, the landing\'s screen y': '204 to 204',
        '07 the chasm glide, his landing': { 'off, not whole, landed': 75 },
        '07 the chasm glide, the far bank near edge': { 'overlaps, whole': 75 },
        '07 the chasm glide, the landing\'s screen x': '517 to 517',
        '07 the chasm glide, the landing\'s screen y': '228 to 228',
        '07 the exit glide, his landing': { 'overlaps, whole, cleared in the air': 44 },
        '07 the exit glide, the far bank near edge': { 'overlaps, whole': 44 },
        '07 the exit glide, the landing\'s screen x': '394.5 to 394.5',
        '07 the exit glide, the landing\'s screen y': '123.2 to 123.2',
        '08 every descent of 2 tiles or more, his landing': { 'overlaps, whole': 119, 'off, not whole': 75 },
        '08 take-off columns off screen': { '84': 75 },
        '09 K2 before its first flash': { 'rail overlaps, whole; cart overlaps, whole': 44 },
        '09 the rail end, screen x': '135 to 135',
        '09 the rail start, screen x': '471 to 471',
        '10 K3 before its first flash': { 'cart overlaps, whole; vulture overlaps, whole': 44 },
        '11 states with the veladora tile overlapping the view': '270 to 270',
        '11 states with the veladora tile whole in the view': '264 to 264',
        '11 the veladora taken': { false: 75 },
      },
      careful: {
        '00 the run ends': { clear: 75 },
        '01 the start is on the level bottom': { true: 75 },
        '01 the start y': '320 to 320',
        '02 stood on P6': { false: 75 },
        '03 the largest scroll step': '4.5 to 4.5',
        '03 the largest y step': '8 to 8',
        '04 states outside the limits': '0 to 0',
        '05 R1 camera y at the boarding': '320 to 320',
        '05 R1 steps to the full lead': '31 to 31',
        '05 R3 camera y at the boarding': '300 to 300',
        '05 R3 steps to the full lead': '31 to 31',
        '05 R4 camera y at the boarding': '284.6 to 284.6',
        '05 R4 steps to the full lead': '31 to 31',
        '05 R7 camera y at the boarding': '60.6 to 60.6',
        '05 R7 steps to the full lead': '31 to 31',
        '05 the largest lead in a ride': { 'R1 64': 75, 'R3 64': 75, 'R4 64': 75, 'R7 64': 75 },
        '06 MP1, camera y at the end': '190 to 190',
        '06 MP1, steps from the start of the climb to the look-up': '0 to 0',
        '06 MP2, camera y at the end': '110 to 110',
        '06 MP2, steps from the start of the climb to the look-up': '48 to 48',
        '06 R1 climb at 11, camera y at the end': '311.2 to 311.2',
        '06 R1 climb at 11, steps from the start of the climb to the look-up': '17 to 17',
        '06 R1 climb at 17, camera y at the end': '247.1 to 247.1',
        '06 R1 climb at 17, steps from the start of the climb to the look-up': '0 to 0',
        '06 R1 climb at 7, camera y at the end': '320 to 320',
        '06 R3 climb at 72, camera y at the end': '264.7 to 264.7',
        '06 R3 climb at 72, steps from the start of the climb to the look-up': '27 to 27',
        '06 spring throw, camera y at the end': '317 to 317',
        '06 spring throw, steps from the start of the climb to the look-up': '26 to 153',
        '06 stairs, camera y at the end': '60.6 to 60.6',
        '06 stairs, steps from the start of the climb to the look-up': '0 to 0',
        '06 the look-up on a climb': {
          'MP1: up': 75,
          'MP2: up': 75,
          'R1 climb at 7: never up': 75,
          'R1 climb at 11: up': 75,
          'R1 climb at 17: up': 75,
          'R3 climb at 72: up': 75,
          'spring throw: up': 75,
          'stairs: up': 75,
        },
        '07 flights over the afterP3 pit': { '1': 75 },
        '07 flights over the chasm pit': { '1': 75 },
        '07 flights over the exit pit': { '1': 75 },
        '07 the afterP3 glide, his landing': { 'overlaps, whole, landed': 75 },
        '07 the afterP3 glide, the far bank near edge': { 'overlaps, whole': 75 },
        '07 the afterP3 glide, the landing\'s screen x': '448.8 to 448.8',
        '07 the afterP3 glide, the landing\'s screen y': '204 to 204',
        '07 the chasm glide, his landing': { 'off, not whole, landed': 75 },
        '07 the chasm glide, the far bank near edge': { 'overlaps, whole': 75 },
        '07 the chasm glide, the landing\'s screen x': '517 to 517',
        '07 the chasm glide, the landing\'s screen y': '228 to 228',
        '07 the exit glide, his landing': { 'overlaps, whole, cleared in the air': 75 },
        '07 the exit glide, the far bank near edge': { 'overlaps, whole': 75 },
        '07 the exit glide, the landing\'s screen x': '394.5 to 394.5',
        '07 the exit glide, the landing\'s screen y': '123.2 to 123.2',
        '08 every descent of 2 tiles or more, his landing': { 'overlaps, whole': 150, 'off, not whole': 75 },
        '08 take-off columns off screen': { '84': 75 },
        '09 K2 before its first flash': { 'rail overlaps, whole; cart overlaps, whole': 75 },
        '09 the rail end, screen x': '135 to 135',
        '09 the rail start, screen x': '471 to 471',
        '10 K3 before its first flash': { 'cart overlaps, whole; vulture overlaps, whole': 75 },
        '11 states with the veladora tile overlapping the view': '270 to 270',
        '11 states with the veladora tile whole in the view': '264 to 264',
        '11 the veladora taken': { false: 75 },
      },
      walker: {
        '00 the run ends': { clear: 75 },
        '01 the start is on the level bottom': { true: 75 },
        '01 the start y': '320 to 320',
        '02 states on P6': '41 to 41',
        '02 states on P6 before the camera is on the top': '16 to 16',
        '02 states on P6 with the camera under the top': '16 to 16',
        '02 stood on P6': { true: 75 },
        '02 the camera y on the first state on P6': '45.6 to 45.6',
        '03 the largest scroll step': '2 to 2',
        '03 the largest y step': '8 to 8',
        '04 states outside the limits': '0 to 0',
        '06 MP0, camera y at the end': '254 to 254',
        '06 MP0, steps from the start of the climb to the look-up': '47 to 48',
        '06 MP1, camera y at the end': '190 to 190',
        '06 MP1, steps from the start of the climb to the look-up': '0 to 0',
        '06 MP2, camera y at the end': '110 to 110',
        '06 MP2, steps from the start of the climb to the look-up': '48 to 48',
        '06 spring throw, camera y at the end': '317 to 317',
        '06 spring throw, steps from the start of the climb to the look-up': '29 to 153',
        '06 stairs, camera y at the end': '45.6 to 45.6',
        '06 stairs, steps from the start of the climb to the look-up': '0 to 0',
        '06 the look-up on a climb': { 'MP0: up': 75, 'MP1: up': 75, 'MP2: up': 75, 'spring throw: up': 75, 'stairs: up': 75 },
        '07 flights over the afterP3 pit': { '1': 75 },
        '07 flights over the chasm pit': { '1': 75 },
        '07 flights over the exit pit': { '1': 75 },
        '07 the afterP3 glide, his landing': { 'overlaps, whole, landed': 75 },
        '07 the afterP3 glide, the far bank near edge': { 'overlaps, whole': 75 },
        '07 the afterP3 glide, the landing\'s screen x': '448.8 to 448.8',
        '07 the afterP3 glide, the landing\'s screen y': '204 to 204',
        '07 the chasm glide, his landing': { 'off, not whole, landed': 75 },
        '07 the chasm glide, the far bank near edge': { 'overlaps, whole': 75 },
        '07 the chasm glide, the landing\'s screen x': '501.9 to 501.9',
        '07 the chasm glide, the landing\'s screen y': '220 to 220',
        '07 the exit glide, his landing': { 'overlaps, whole, cleared in the air': 75 },
        '07 the exit glide, the far bank near edge': { 'overlaps, whole': 75 },
        '07 the exit glide, the landing\'s screen x': '392.7 to 392.7',
        '07 the exit glide, the landing\'s screen y': '119 to 119',
        '08 every descent of 2 tiles or more, his landing': { 'overlaps, whole': 150, 'off, not whole': 75 },
        '08 take-off columns off screen': { '89': 75 },
        '09 K2 before its first flash': { 'rail overlaps, whole; cart overlaps, whole': 75 },
        '09 the rail end, screen x': '134.3 to 134.3',
        '09 the rail start, screen x': '470.3 to 470.3',
        '10 K3 before its first flash': { 'cart overlaps, whole; vulture overlaps, whole': 75 },
        '11 states with the veladora tile overlapping the view': '517 to 941',
        '11 states with the veladora tile whole in the view': '509 to 933',
        '11 the veladora taken': { false: 75 },
      },
      secret: {
        '00 the run ends': { clear: 75 },
        '01 the start is on the level bottom': { true: 75 },
        '01 the start y': '320 to 320',
        '02 stood on P6': { false: 75 },
        '03 the largest scroll step': '4.5 to 4.5',
        '03 the largest y step': '8 to 8',
        '04 states outside the limits': '0 to 0',
        '05 R1 camera y at the boarding': '320 to 320',
        '05 R1 steps to the full lead': '31 to 31',
        '05 R3 camera y at the boarding': '300 to 300',
        '05 R3 steps to the full lead': '31 to 31',
        '05 R4 camera y at the boarding': '284.6 to 284.6',
        '05 R4 steps to the full lead': '31 to 31',
        '05 R7 camera y at the boarding': '60.6 to 60.6',
        '05 R7 steps to the full lead': '31 to 31',
        '05 the largest lead in a ride': { 'R1 64': 75, 'R3 64': 75, 'R4 64': 75, 'R7 64': 75 },
        '06 MP0, camera y at the end': '254 to 254',
        '06 MP0, steps from the start of the climb to the look-up': '47 to 48',
        '06 MP1, camera y at the end': '190 to 190',
        '06 MP1, steps from the start of the climb to the look-up': '0 to 0',
        '06 MP2, camera y at the end': '110 to 110',
        '06 MP2, steps from the start of the climb to the look-up': '48 to 48',
        '06 R1 climb at 11, camera y at the end': '311.2 to 311.2',
        '06 R1 climb at 11, steps from the start of the climb to the look-up': '17 to 17',
        '06 R1 climb at 17, camera y at the end': '247.1 to 247.1',
        '06 R1 climb at 17, steps from the start of the climb to the look-up': '0 to 0',
        '06 R1 climb at 7, camera y at the end': '320 to 320',
        '06 R3 climb at 72, camera y at the end': '264.7 to 264.7',
        '06 R3 climb at 72, steps from the start of the climb to the look-up': '27 to 27',
        '06 spring throw, camera y at the end': '317 to 317',
        '06 spring throw, steps from the start of the climb to the look-up': '28 to 153',
        '06 stairs, camera y at the end': '60.6 to 60.6',
        '06 stairs, steps from the start of the climb to the look-up': '0 to 0',
        '06 the look-up on a climb': {
          'MP0: up': 75,
          'MP1: up': 75,
          'MP2: up': 75,
          'R1 climb at 7: never up': 75,
          'R1 climb at 11: up': 75,
          'R1 climb at 17: up': 75,
          'R3 climb at 72: up': 75,
          'spring throw: up': 75,
          'stairs: up': 75,
        },
        '07 flights over the afterP3 pit': { '1': 75 },
        '07 flights over the chasm pit': { '1': 75 },
        '07 flights over the exit pit': { '1': 75 },
        '07 the afterP3 glide, his landing': { 'overlaps, whole, landed': 75 },
        '07 the afterP3 glide, the far bank near edge': { 'overlaps, whole': 75 },
        '07 the afterP3 glide, the landing\'s screen x': '448.8 to 448.8',
        '07 the afterP3 glide, the landing\'s screen y': '204 to 204',
        '07 the chasm glide, his landing': { 'off, not whole, landed': 75 },
        '07 the chasm glide, the far bank near edge': { 'overlaps, whole': 75 },
        '07 the chasm glide, the landing\'s screen x': '517 to 517',
        '07 the chasm glide, the landing\'s screen y': '228 to 228',
        '07 the exit glide, his landing': { 'overlaps, whole, cleared in the air': 75 },
        '07 the exit glide, the far bank near edge': { 'overlaps, whole': 75 },
        '07 the exit glide, the landing\'s screen x': '394.5 to 394.5',
        '07 the exit glide, the landing\'s screen y': '123.2 to 123.2',
        '08 every descent of 2 tiles or more, his landing': { 'overlaps, whole': 300, 'off, not whole': 75 },
        '08 take-off columns off screen': { '84': 75 },
        '09 K2 before its first flash': { 'rail overlaps, whole; cart overlaps, whole': 75 },
        '09 the rail end, screen x': '135 to 135',
        '09 the rail start, screen x': '471 to 471',
        '10 K3 before its first flash': { 'cart overlaps, whole; vulture overlaps, whole': 75 },
        '11 states with the veladora tile overlapping the view': '780 to 1211',
        '11 states with the veladora tile whole in the view': '758 to 1189',
        '11 the veladora taken': { true: 75 },
        '11 the veladora tile at the take-off of the jump that takes it': { 'overlaps, whole': 75 },
      },
    });
  }, 300_000);
});

/** Every number in `v` to 0.1 px (as `px`), the rest as it is. */
const round = (v: unknown): unknown =>
  typeof v === 'number' ? px(v) : Array.isArray(v) ? v.map(round) : v !== null && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, round(x)])) : v;

/** One bot's run at the start clock 0, step by step (test 2). */
function atClock0(f: Facts) {
  return round({
    steps: f.st.length - 1,
    start: { y: f.start.y, bottom: f.start.bottom, firstMove: f.firstMove },
    p6: f.p6.states === 0 ? 'never stood on P6' : { from: f.p6.on!.from, to: f.p6.on!.to, first: f.p6.first, underTheTop: f.p6.off, toZero: f.p6.toZero },
    rides: f.rides,
    climbs: f.climbs,
    glides: f.glides,
    descents: f.descents,
    k2: f.k2,
    k3: f.k3,
    vela: f.vela,
  });
}

describe('GDD-WLD-18 level 3-3 the camera at the start clock 0', () => {
  it('GDD-WLD-18 3-3 the camera at the start clock 0, step by step', () => {
    const out: Record<string, unknown> = {};
    for (const [name, make] of Object.entries(BOTS)) out[name] = atClock0(facts(make(), 0));
    // The four bots at the start clock 0, to 0.1 px, a step n being the state after n steps. The camera rests on the bottom (320) until the first pan (step 109 in
    // the rider's, careful and secret runs, 550 in the walker's). Each ride's lead reaches 64
    // 31 steps after its first state, and each look-up starts where 06 of the sweep puts it (MP0 and MP2: 48 steps after he steps on, as 32 px at 40 px/s). The
    // chasm's take-off view is {1153.8, 236} (his x 1345.8 in the cart, at the screen's x 192 with the lead 64) for the rider, careful and secret bots, and the landing
    // (x 1664.8 to 1676.8) is past the view's right edge (1633.8). The walker takes off at the lip. The step before K2's first flash the view is {2393, 224} (the walker's {2393.8, 224})
    // and the rail (x 2528 to 2864, 384 to 400) and K2's cart (2832 to 2864) are in it; K3's cart (3136 to 3168) and the vulture are, at {2697.3, 244}.
    expect(out).toEqual({
      rider: {
        steps: 2750,
        start: { y: 320, bottom: 320, firstMove: 109 },
        p6: 'never stood on P6',
        rides: {
          R1: { from: 34, to: 282, lead: 64, reached: 65, yAtBoarding: 320 },
          R3: { from: 563, to: 674, lead: 64, reached: 594, yAtBoarding: 320 },
          R4: { from: 1460, to: 1568, lead: 64, reached: 1491, yAtBoarding: 284.6 },
          R7: { from: 2614, to: 2669, lead: 64, reached: 2645, yAtBoarding: 60.6 },
        },
        climbs: {
          MP1: { from: 917, to: 1056, up: true, upAt: 917, yEnd: 190 },
          MP2: { from: 2304, to: 2496, up: true, upAt: 2352, yEnd: 110 },
          'R1 climb at 7': { from: 41, to: 51, up: false, upAt: -1, yEnd: 320 },
          'R1 climb at 11': { from: 71, to: 115, up: true, upAt: 88, yEnd: 311.2 },
          'R1 climb at 17': { from: 129, to: 173, up: true, upAt: 129, yEnd: 247.1 },
          'R3 climb at 72': { from: 583, to: 615, up: true, upAt: 599, yEnd: 250.7 },
          'spring throw': { from: 813, to: 917, up: true, upAt: 917, yEnd: 317 },
          stairs: { from: 2531, to: 2614, up: true, upAt: 2531, yEnd: 60.6 },
        },
        glides: {
          chasm: [
            {
              off: 674,
              on: 804,
              landed: true,
              view: { x: 1153.8, y: 236 },
              viewAtLanding: { x: 1476.8, y: 320 },
              landing: { x0: 1664.8, x1: 1676.8, y0: 432, y1: 464 },
              seen: 'off, not whole',
              x: 517,
              y: 228,
              bank: 'overlaps, whole',
            },
          ],
          afterP3: [
            {
              off: 1265,
              on: 1375,
              landed: true,
              view: { x: 1657.3, y: 196 },
              viewAtLanding: { x: 1850, y: 292 },
              landing: { x0: 2100, x1: 2112, y0: 368, y1: 400 },
              seen: 'overlaps, whole',
              x: 448.8,
              y: 204,
              bank: 'overlaps, whole',
            },
          ],
          exit: [
            {
              off: 2669,
              on: 2750,
              landed: false,
              view: { x: 3345.3, y: 76 },
              viewAtLanding: { x: 3360, y: 48 },
              landing: { x0: 3733.8, x1: 3745.8, y0: 167.2, y1: 199.2 },
              seen: 'overlaps, whole',
              x: 394.5,
              y: 123.2,
              bank: 'overlaps, whole',
            },
          ],
        },
        descents: [
          { off: 384, on: 480, landed: true, col: 50, seen: 'overlaps, whole' },
          { off: 674, on: 804, landed: true, col: 84, seen: 'off, not whole' },
          { off: 1265, on: 1375, landed: true, col: 119, seen: 'overlaps, whole' },
        ],
        k2: {
          step: 1658,
          view: { x: 2393, y: 224 },
          x: 2649,
          feet: 400,
          boxes: { rail: { x0: 2528, x1: 2864, y0: 384, y1: 400 }, cart: { x0: 2832, x1: 2864, y0: 384, y1: 400 } },
          rail: 'overlaps, whole',
          cart: 'overlaps, whole',
          ends: [471, 135],
        },
        k3: {
          step: 1940,
          view: { x: 2697.3, y: 244 },
          x: 2953.2,
          feet: 400,
          boxes: { cart: { x0: 3136, x1: 3168, y0: 384, y1: 400 }, vulture: { x0: 2970.7, x1: 2986.7, y0: 270.1, y1: 280.1 } },
          cart: 'overlaps, whole',
          vulture: 'overlaps, whole',
        },
        vela: { states: { overlap: 270, whole: 264 }, taken: -1, takeoff: null },
      },
      careful: {
        steps: 2750,
        start: { y: 320, bottom: 320, firstMove: 109 },
        p6: 'never stood on P6',
        rides: {
          R1: { from: 34, to: 282, lead: 64, reached: 65, yAtBoarding: 320 },
          R3: { from: 701, to: 812, lead: 64, reached: 732, yAtBoarding: 300 },
          R4: { from: 1460, to: 1568, lead: 64, reached: 1491, yAtBoarding: 284.6 },
          R7: { from: 2614, to: 2669, lead: 64, reached: 2645, yAtBoarding: 60.6 },
        },
        climbs: {
          MP1: { from: 981, to: 1056, up: true, upAt: 981, yEnd: 190 },
          MP2: { from: 2304, to: 2496, up: true, upAt: 2352, yEnd: 110 },
          'R1 climb at 7': { from: 41, to: 51, up: false, upAt: -1, yEnd: 320 },
          'R1 climb at 11': { from: 71, to: 115, up: true, upAt: 88, yEnd: 311.2 },
          'R1 climb at 17': { from: 129, to: 173, up: true, upAt: 129, yEnd: 247.1 },
          'R3 climb at 72': { from: 721, to: 753, up: true, upAt: 748, yEnd: 264.7 },
          'spring throw': { from: 951, to: 981, up: true, upAt: 981, yEnd: 317 },
          stairs: { from: 2531, to: 2614, up: true, upAt: 2531, yEnd: 60.6 },
        },
        glides: {
          chasm: [
            {
              off: 812,
              on: 942,
              landed: true,
              view: { x: 1153.8, y: 236 },
              viewAtLanding: { x: 1476.8, y: 320 },
              landing: { x0: 1664.8, x1: 1676.8, y0: 432, y1: 464 },
              seen: 'off, not whole',
              x: 517,
              y: 228,
              bank: 'overlaps, whole',
            },
          ],
          afterP3: [
            {
              off: 1265,
              on: 1375,
              landed: true,
              view: { x: 1657.3, y: 196 },
              viewAtLanding: { x: 1850, y: 292 },
              landing: { x0: 2100, x1: 2112, y0: 368, y1: 400 },
              seen: 'overlaps, whole',
              x: 448.8,
              y: 204,
              bank: 'overlaps, whole',
            },
          ],
          exit: [
            {
              off: 2669,
              on: 2750,
              landed: false,
              view: { x: 3345.3, y: 76 },
              viewAtLanding: { x: 3360, y: 48 },
              landing: { x0: 3733.8, x1: 3745.8, y0: 167.2, y1: 199.2 },
              seen: 'overlaps, whole',
              x: 394.5,
              y: 123.2,
              bank: 'overlaps, whole',
            },
          ],
        },
        descents: [
          { off: 488, on: 501, landed: true, col: 44, seen: 'overlaps, whole' },
          { off: 812, on: 942, landed: true, col: 84, seen: 'off, not whole' },
          { off: 1265, on: 1375, landed: true, col: 119, seen: 'overlaps, whole' },
        ],
        k2: {
          step: 1658,
          view: { x: 2393, y: 224 },
          x: 2649,
          feet: 400,
          boxes: { rail: { x0: 2528, x1: 2864, y0: 384, y1: 400 }, cart: { x0: 2832, x1: 2864, y0: 384, y1: 400 } },
          rail: 'overlaps, whole',
          cart: 'overlaps, whole',
          ends: [471, 135],
        },
        k3: {
          step: 1940,
          view: { x: 2697.3, y: 244 },
          x: 2953.2,
          feet: 400,
          boxes: { cart: { x0: 3136, x1: 3168, y0: 384, y1: 400 }, vulture: { x0: 2970.7, x1: 2986.7, y0: 270.1, y1: 280.1 } },
          cart: 'overlaps, whole',
          vulture: 'overlaps, whole',
        },
        vela: { states: { overlap: 270, whole: 264 }, taken: -1, takeoff: null },
      },
      walker: {
        steps: 3961,
        start: { y: 320, bottom: 320, firstMove: 550 },
        p6: { from: 3772, to: 3812, first: 45.6, underTheTop: 16, toZero: 16 },
        rides: {},
        climbs: {
          MP0: { from: 432, to: 648, up: true, upAt: 480, yEnd: 254 },
          MP1: { from: 2111, to: 2208, up: true, upAt: 2111, yEnd: 190 },
          MP2: { from: 3456, to: 3648, up: true, upAt: 3504, yEnd: 110 },
          'spring throw': { from: 1958, to: 2111, up: true, upAt: 2111, yEnd: 317 },
          stairs: { from: 3683, to: 3772, up: true, upAt: 3683, yEnd: 45.6 },
        },
        glides: {
          chasm: [
            {
              off: 1258,
              on: 1381,
              landed: true,
              view: { x: 1169.8, y: 244 },
              viewAtLanding: { x: 1415.8, y: 320 },
              landing: { x0: 1665.7, x1: 1677.7, y0: 432, y1: 464 },
              seen: 'off, not whole',
              x: 501.9,
              y: 220,
              bank: 'overlaps, whole',
            },
          ],
          afterP3: [
            {
              off: 2417,
              on: 2527,
              landed: true,
              view: { x: 1657.3, y: 196 },
              viewAtLanding: { x: 1850, y: 292 },
              landing: { x0: 2100, x1: 2112, y0: 368, y1: 400 },
              seen: 'overlaps, whole',
              x: 448.8,
              y: 204,
              bank: 'overlaps, whole',
            },
          ],
          exit: [
            {
              off: 3893,
              on: 3961,
              landed: false,
              view: { x: 3360, y: 73 },
              viewAtLanding: { x: 3360, y: 48 },
              landing: { x0: 3746.7, x1: 3758.7, y0: 160, y1: 192 },
              seen: 'overlaps, whole',
              x: 392.7,
              y: 119,
              bank: 'overlaps, whole',
            },
          ],
        },
        descents: [
          { off: 887, on: 900, landed: true, col: 44, seen: 'overlaps, whole' },
          { off: 1258, on: 1381, landed: true, col: 89, seen: 'off, not whole' },
          { off: 2417, on: 2527, landed: true, col: 119, seen: 'overlaps, whole' },
        ],
        k2: {
          step: 2820,
          view: { x: 2393.8, y: 224 },
          x: 2649.7,
          feet: 400,
          boxes: { rail: { x0: 2528, x1: 2864, y0: 384, y1: 400 }, cart: { x0: 2832, x1: 2864, y0: 384, y1: 400 } },
          rail: 'overlaps, whole',
          cart: 'overlaps, whole',
          ends: [470.3, 134.3],
        },
        k3: {
          step: 3102,
          view: { x: 2698, y: 244 },
          x: 2953.9,
          feet: 400,
          boxes: { cart: { x0: 3136, x1: 3168, y0: 384, y1: 400 }, vulture: { x0: 2972, x1: 2988, y0: 264.1, y1: 274.1 } },
          cart: 'overlaps, whole',
          vulture: 'overlaps, whole',
        },
        vela: { states: { overlap: 703, whole: 695 }, taken: -1, takeoff: null },
      },
      secret: {
        steps: 3902,
        start: { y: 320, bottom: 320, firstMove: 109 },
        p6: 'never stood on P6',
        rides: {
          R1: { from: 34, to: 282, lead: 64, reached: 65, yAtBoarding: 320 },
          R3: { from: 1532, to: 1643, lead: 64, reached: 1563, yAtBoarding: 300 },
          R4: { from: 2612, to: 2720, lead: 64, reached: 2643, yAtBoarding: 284.6 },
          R7: { from: 3766, to: 3821, lead: 64, reached: 3797, yAtBoarding: 60.6 },
        },
        climbs: {
          MP0: { from: 864, to: 1080, up: true, upAt: 912, yEnd: 254 },
          MP1: { from: 2108, to: 2208, up: true, upAt: 2108, yEnd: 190 },
          MP2: { from: 3456, to: 3648, up: true, upAt: 3504, yEnd: 110 },
          'R1 climb at 7': { from: 41, to: 51, up: false, upAt: -1, yEnd: 320 },
          'R1 climb at 11': { from: 71, to: 115, up: true, upAt: 88, yEnd: 311.2 },
          'R1 climb at 17': { from: 129, to: 173, up: true, upAt: 129, yEnd: 247.1 },
          'R3 climb at 72': { from: 1552, to: 1584, up: true, upAt: 1579, yEnd: 264.7 },
          'spring throw': { from: 1956, to: 2108, up: true, upAt: 2108, yEnd: 317 },
          stairs: { from: 3683, to: 3766, up: true, upAt: 3683, yEnd: 60.6 },
        },
        glides: {
          chasm: [
            {
              off: 1643,
              on: 1773,
              landed: true,
              view: { x: 1153.8, y: 236 },
              viewAtLanding: { x: 1476.8, y: 320 },
              landing: { x0: 1664.8, x1: 1676.8, y0: 432, y1: 464 },
              seen: 'off, not whole',
              x: 517,
              y: 228,
              bank: 'overlaps, whole',
            },
          ],
          afterP3: [
            {
              off: 2417,
              on: 2527,
              landed: true,
              view: { x: 1657.3, y: 196 },
              viewAtLanding: { x: 1850, y: 292 },
              landing: { x0: 2100, x1: 2112, y0: 368, y1: 400 },
              seen: 'overlaps, whole',
              x: 448.8,
              y: 204,
              bank: 'overlaps, whole',
            },
          ],
          exit: [
            {
              off: 3821,
              on: 3902,
              landed: false,
              view: { x: 3345.3, y: 76 },
              viewAtLanding: { x: 3360, y: 48 },
              landing: { x0: 3733.8, x1: 3745.8, y0: 167.2, y1: 199.2 },
              seen: 'overlaps, whole',
              x: 394.5,
              y: 123.2,
              bank: 'overlaps, whole',
            },
          ],
        },
        descents: [
          { off: 354, on: 491, landed: true, col: 35, seen: 'overlaps, whole' },
          { off: 514, on: 531, landed: true, col: 25, seen: 'overlaps, whole' },
          { off: 1319, on: 1332, landed: true, col: 44, seen: 'overlaps, whole' },
          { off: 1643, on: 1773, landed: true, col: 84, seen: 'off, not whole' },
          { off: 2417, on: 2527, landed: true, col: 119, seen: 'overlaps, whole' },
        ],
        k2: {
          step: 2810,
          view: { x: 2393, y: 224 },
          x: 2649,
          feet: 400,
          boxes: { rail: { x0: 2528, x1: 2864, y0: 384, y1: 400 }, cart: { x0: 2832, x1: 2864, y0: 384, y1: 400 } },
          rail: 'overlaps, whole',
          cart: 'overlaps, whole',
          ends: [471, 135],
        },
        k3: {
          step: 3092,
          view: { x: 2697.3, y: 244 },
          x: 2953.2,
          feet: 400,
          boxes: { cart: { x0: 3136, x1: 3168, y0: 384, y1: 400 }, vulture: { x0: 2970.7, x1: 2986.7, y0: 267.2, y1: 277.2 } },
          cart: 'overlaps, whole',
          vulture: 'overlaps, whole',
        },
        vela: { states: { overlap: 1071, whole: 1049 }, taken: 488, takeoff: { step: 354, view: { x: 342.5, y: 272.4 }, x: 566.6, feet: 416, seen: 'overlaps, whole' } },
      },
    });
  });
});

const LOSS_BOTS = {
  'R3 staying in': LOSS_R3_STAY,
  'R3 a plain jump from the post': LOSS_R3_PLAIN,
  'bridge B stopped on a plank': LOSS_PLANK_STOP,
  'bridge B run, K2 on the second span': LOSS_K2_RUN,
  "K3's cart met with no jump": LOSS_K3_WALK,
  'the vulture, standing after a plain jump under it': LOSS_VULTURE_STAND,
} as const;

describe('GDD-WLD-18 level 3-3 the camera cuts at a respawn', () => {
  it('GDD-WLD-18 3-3 the camera cuts at a respawn: his feet at 136, no lead, nothing panned between', () => {
    const out: Record<string, unknown> = {};
    for (const [name, make] of Object.entries(LOSS_BOTS)) {
      // The vulture takes the life at clock 194 (`level3-3.losses.test.ts`); the others lose it at every clock, at 0 here.
      const from = startAt(make === LOSS_VULTURE_STAND ? 194 : 0);
      const l = playLoss(make(), from);
      const st = [from, ...l.bot.states];
      const cams = camerasOf(st);
      const lostAt = l.losses[0]!.step + 1;
      const back = l.respawn!.step + 1;
      const cuts = st.flatMap((r, k) => (k > 0 && ponchoShown(r) && !ponchoShown(st[k - 1]!) ? [k] : []));
      // The cut is the step he appears (`ponchoShown`), the flip's 21 steps (`flipPose`) before the first state of play.
      const cutAt = cuts.find((k) => k > lostAt)!;
      let off = 0;
      for (let k = 1; k < st.length; k++) if (!cuts.includes(k)) off = Math.max(off, Math.abs(cams[k]!.y.y - cams[k - 1]!.y.y));
      const camAt = (k: number) => ({ y: cams[k]!.y.y, lead: cams[k]!.lead, look: cams[k]!.y.look });
      // GDD-UI-04's cut: at the step he appears, and at the first state of play, the camera is the cut's (his feet at 136 on the screen, the band's look, no lead), and
      // nothing else moves the picture by more than the hard limit of 8 px a step.
      for (const k of [cutAt, back]) expect(camAt(k)).toEqual({ y: cutCameraY(st[k]!, L).y, lead: 0, look: 'band' });
      expect(st[back]!.player.y - cams[back]!.y.y).toBe(136);
      expect(off).toBeLessThanOrEqual(CAMERA.maxSpeed * STEP + 1e-9);
      out[name] = round({
        lostAt,
        cuts,
        cutAt,
        respawnAt: back,
        before: camAt(lostAt - 1),
        atCut: camAt(cutAt),
        cutWants: { y: cutCameraY(st[cutAt]!, L).y, look: cutCameraY(st[cutAt]!, L).look },
        atRespawn: camAt(back),
        respawnWants: { y: cutCameraY(st[back]!, L).y, look: cutCameraY(st[back]!, L).look },
        feetOnScreen: st[back]!.player.y - cams[back]!.y.y,
        largestStepOffTheCut: off,
        heldUntilTheCut: cams.slice(lostAt - 1, cutAt).every((c) => c.y.y === cams[lostAt - 1]!.y.y && c.lead === cams[lostAt - 1]!.lead),
      });
    }
    // The six loss bots of `level3-3.losses.test.ts`, at the clock 0 (the vulture's at 194, where it takes the life). The camera holds from the losing step (its y and lead
    // as they were: 272 and 64 in the chasm's fall, 224 on bridge B's planks, 244 on P5) to the cut, 21 steps before the first state of play; at the cut it is his feet at 136
    // (T1's ofrenda, feet 448: y 312; P4's, feet 400: y 264, `spawnFeet` 136) with no lead, and from then on nothing but the 8 px step moves it.
    expect(out).toEqual({
      'R3 staying in': {
        lostAt: 886,
        cuts: [913],
        cutAt: 913,
        respawnAt: 934,
        before: { y: 272, lead: 64, look: 'band' },
        atCut: { y: 312, lead: 0, look: 'band' },
        cutWants: { y: 312, look: 'band' },
        atRespawn: { y: 312, lead: 0, look: 'band' },
        respawnWants: { y: 312, look: 'band' },
        feetOnScreen: 136,
        largestStepOffTheCut: 8,
        heldUntilTheCut: true,
      },
      'R3 a plain jump from the post': {
        lostAt: 886,
        cuts: [913],
        cutAt: 913,
        respawnAt: 934,
        before: { y: 272, lead: 64, look: 'band' },
        atCut: { y: 312, lead: 0, look: 'band' },
        cutWants: { y: 312, look: 'band' },
        atRespawn: { y: 312, lead: 0, look: 'band' },
        respawnWants: { y: 312, look: 'band' },
        feetOnScreen: 136,
        largestStepOffTheCut: 8,
        heldUntilTheCut: true,
      },
      'bridge B stopped on a plank': {
        lostAt: 1677,
        cuts: [1704],
        cutAt: 1704,
        respawnAt: 1725,
        before: { y: 224, lead: 0, look: 'band' },
        atCut: { y: 264, lead: 0, look: 'band' },
        cutWants: { y: 264, look: 'band' },
        atRespawn: { y: 264, lead: 0, look: 'band' },
        respawnWants: { y: 264, look: 'band' },
        feetOnScreen: 136,
        largestStepOffTheCut: 8,
        heldUntilTheCut: true,
      },
      'bridge B run, K2 on the second span': {
        lostAt: 1717,
        cuts: [1744],
        cutAt: 1744,
        respawnAt: 1765,
        before: { y: 224, lead: 0, look: 'band' },
        atCut: { y: 264, lead: 0, look: 'band' },
        cutWants: { y: 264, look: 'band' },
        atRespawn: { y: 264, lead: 0, look: 'band' },
        respawnWants: { y: 264, look: 'band' },
        feetOnScreen: 136,
        largestStepOffTheCut: 8,
        heldUntilTheCut: true,
      },
      'K3\'s cart met with no jump': {
        lostAt: 1999,
        cuts: [2026],
        cutAt: 2026,
        respawnAt: 2047,
        before: { y: 244, lead: 0, look: 'band' },
        atCut: { y: 264, lead: 0, look: 'band' },
        cutWants: { y: 264, look: 'band' },
        atRespawn: { y: 264, lead: 0, look: 'band' },
        respawnWants: { y: 264, look: 'band' },
        feetOnScreen: 136,
        largestStepOffTheCut: 8,
        heldUntilTheCut: true,
      },
      'the vulture, standing after a plain jump under it': {
        lostAt: 3180,
        cuts: [3207],
        cutAt: 3207,
        respawnAt: 3228,
        before: { y: 244, lead: 0, look: 'band' },
        atCut: { y: 264, lead: 0, look: 'band' },
        cutWants: { y: 264, look: 'band' },
        atRespawn: { y: 264, lead: 0, look: 'band' },
        respawnWants: { y: 264, look: 'band' },
        feetOnScreen: 136,
        largestStepOffTheCut: 8,
        heldUntilTheCut: true,
      },
    });
  });
});

const box = (x0: number, x1: number, y0: number, y1: number): Box => ({ x0, x1, y0, y1 });
/** The start's state with his middle at x and his feet at y. */
const at = (x: number, y: number): RunState => ({ ...startAt(0), player: { ...startAt(0).player, x, y } });

describe('GDD-WLD-18 level 3-3 the camera helpers', () => {
  it('GDD-WLD-18 3-3 the camera helpers: whole on screen, his body box, a cart and a rail, worked by hand', () => {
    const view = { x: 100, y: 50 };
    // The view is 480 x 270: x 100 to 580, y 50 to 320. A box that touches an edge from inside is whole; one 1 px out on any side overlaps and is not whole; one beyond it is neither.
    const cases: [string, Box, boolean, boolean][] = [
      ['inside', box(200, 300, 100, 200), true, true],
      ['on every edge', box(100, 580, 50, 320), true, true],
      ['1 px out left', box(99, 300, 100, 200), true, false],
      ['1 px out right', box(200, 581, 100, 200), true, false],
      ['1 px out above', box(200, 300, 49, 200), true, false],
      ['1 px out below', box(200, 300, 100, 321), true, false],
      ['past the right edge', box(580, 600, 100, 200), false, false],
      ['under the bottom', box(200, 300, 320, 340), false, false],
    ];
    expect(cases.map(([name, b]) => [name, onScreen(b, view), whollyOnScreen(b, view)])).toEqual(cases.map(([name, , overlap, whole]) => [name, overlap, whole]));
    // His box: 12 wide and 32 high (`HITBOX`), his middle at x and his feet at y.
    expect(bodyBox(at(100, 200))).toEqual(box(94, 106, 168, 200));
    // The carts at the start (every one waiting, its back edge on its rail's start): C1 on R1 (x 80, ground 560), K2's cart on R5 (rolling left from x 2864, ground 400) and
    // K3's on R6 (from 3168); a rail's box from its start to its end, a cart's height (16) over its ground.
    const start = startAt(0);
    expect([cartBoxOf(start, 'R1'), cartBoxOf(start, 'R5'), cartBoxOf(start, 'R6')]).toEqual([box(80, 112, 544, 560), box(2832, 2864, 384, 400), box(3136, 3168, 384, 400)]);
    expect([railBoxOf('R5'), railBoxOf('R6')]).toEqual([box(2528, 2864, 384, 400), box(2912, 3168, 384, 400)]);
  });
});
