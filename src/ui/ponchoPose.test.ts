import { describe, expect, it } from 'vitest';
import { IDLE_CLAW, type ClawState } from '../sim/claw';
import type { Fireball } from '../sim/fireball';
import { spawn, type PlayerState } from '../sim/movement';
import { flipLook, pickupLook, ponchoParts, startPose, stepPose, type PonchoPose, type PoseRun } from './ponchoPose';

// GDD-ART-04: the expected values are the plan's numbers: hurt 6 + 18 steps, the follow-through 10 (swipe2 3, swipe3 3), the spit 2 + 8
// (flame0 4, flame1 4), eating 10 + 14 (crumbs0 6, crumbs1 6), the take-off 4, rising under -120 px/s, the apex under 60, the fall under 250,
// landing 6 steps from 150 px/s, the skid from 40 px/s, a blink the last 6 of every 180 idle steps, a glance 40 of every 360.

const player = (o: Partial<PlayerState> = {}): PlayerState => ({ ...spawn(100, 200), ...o });
const run = (o: Partial<PoseRun> = {}): PoseRun => ({ phase: 'playing', wait: 0, player: player(), invulnerable: 0, claw: IDLE_CLAW, fireballs: [], power: 'base', items: [], ...o });
const fireball = (age: number): Fireball => ({ x: 0, y: 0, vx: 0, vy: 0, age });
const claw = (phase: ClawState['phase'], steps: number, dir: 1 | -1 = 1): ClawState => ({ phase, steps, cooldown: 10, dir, held: true });

/** The poses after each run in turn, each stepped from the run before it (the first from `first`, by default itself). */
function poses(runs: PoseRun[], first: PoseRun = runs[0]!, from: PonchoPose = startPose(100)): PonchoPose[] {
  const out: PonchoPose[] = [];
  let pose = from;
  let before = first;
  for (const r of runs) {
    pose = stepPose(pose, before, r);
    out.push(pose);
    before = r;
  }
  return out;
}
const looks = (ps: PonchoPose[]) => ps.map((p) => p.look);
/** `n` copies of a run. */
const times = (n: number, r: PoseRun): PoseRun[] => Array.from({ length: n }, () => r);
/** A run of `n` repeats of `look`. */
const rep = <T>(n: number, v: T): T[] => Array.from({ length: n }, () => v);
/** The look while respawning with `wait` steps left. */
const flipAt = (wait: number) => stepPose(startPose(100), run(), run({ phase: 'respawning', wait })).look;
/** A run in Fuego with these fireballs. */
const fuego = (fb: Fireball[]) => run({ power: 'fuego', fireballs: fb });
/** A run in the air at vertical speed `vy`. */
const air = (vy: number, o: Partial<PlayerState> = {}) => run({ player: player({ grounded: false, vy, ...o }) });
/** The look in the air at a steady `vy`. */
const airAt = (vy: number) => stepPose(startPose(100), air(vy), air(vy)).look;
/** A run on the ground at `vx`, facing `facing`, one step's travel from x = 100. */
const ground = (vx: number, facing: 1 | -1) => run({ player: player({ vx, facing, x: 100 + vx / 60 }) });
/** The look on the ground at `vx`, facing `facing`, from standing. */
const groundAt = (vx: number, facing: 1 | -1) => stepPose(startPose(100), run(), ground(vx, facing)).look;
/** What a paw-holding frame holds in `power`. */
const heldIn = (power: PoseRun['power']) => stepPose(startPose(100), run({ power }), run({ power })).held;

describe('GDD-ART-04 the respawn flip', () => {
  it('GDD-ART-04 the flip frame is the nearest 45-degree step of the turn', () => {
    const deg = Math.PI / 180;
    expect(flipLook(0)).toBe('flip0');
    expect(flipLook(22.4 * deg)).toBe('flip0');
    expect(flipLook(22.6 * deg)).toBe('flip1');
    expect(flipLook(180 * deg)).toBe('flip4');
    expect(flipLook(337.4 * deg)).toBe('flip7');
    expect(flipLook(337.6 * deg)).toBe('flip0');
    expect(flipLook(360 * deg)).toBe('flip0');
  });

  it('GDD-ART-04 while respawning the flip frames show by the wait, and nothing before the flip shows', () => {
    // The 21-step flip turns 360 degrees * (22 - wait) / 21: wait 21 is 17 degrees, 20 is 34, 19 is 51, 11 is 189, 1 is 360.
    expect([flipAt(21), flipAt(20), flipAt(19), flipAt(11), flipAt(1)]).toEqual(['flip0', 'flip1', 'flip1', 'flip4', 'flip0']);
    expect(flipAt(22)).toBe('idle');
  });

  it('GDD-ART-04 the flip beats all, and holds nothing', () => {
    const busy = run({ phase: 'respawning', wait: 11, invulnerable: 120, claw: claw('windup', 1), fireballs: [fireball(0)], power: 'taco', player: player({ grounded: false, vy: 300 }) });
    const p = stepPose(startPose(100), run(), busy);
    expect(p.look).toBe('flip4');
    expect(p.held).toBeNull();
  });

  it('GDD-ART-04 outside play and the flip he stands, holding nothing', () => {
    const p = stepPose(startPose(100), run({ power: 'taco' }), run({ phase: 'clear', power: 'taco', player: player({ vx: 120 }) }));
    expect([p.look, p.held]).toEqual(['idle', null]);
  });
});

describe('GDD-ART-04 hurt', () => {
  const hit = run({ invulnerable: 120 });
  const after = (n: number) => rep(n, 0).map((_, i) => run({ invulnerable: 119 - i }));

  it('GDD-ART-04 a hit that leaves him playing shows hurt0 for 6 steps, then hurt1 for 18', () => {
    expect(looks(poses([hit, ...after(24)], run()))).toEqual([...rep(6, 'hurt0'), ...rep(18, 'hurt1'), 'idle']);
  });

  it('GDD-ART-04 the invulnerability after a respawn is no hurt', () => {
    expect(stepPose(startPose(100), run({ phase: 'respawning', wait: 0 }), hit).look).toBe('idle');
  });

  it('GDD-ART-04 a hurt during a claw shows hurt', () => {
    expect(stepPose(startPose(100), run(), run({ invulnerable: 120, claw: claw('windup', 1) })).look).toBe('hurt0');
  });

  it('GDD-ART-04 hurt holds nothing, even in Taco', () => {
    expect(stepPose(startPose(100), run({ power: 'fuego' }), run({ invulnerable: 120, power: 'taco' })).held).toBeNull();
  });
});

describe('GDD-ART-04 the claw', () => {
  const swing = [run({ claw: claw('windup', 1) }), run({ claw: claw('windup', 2) }), run({ claw: claw('swing', 1) }), run({ claw: claw('swing', 2) }), run({ claw: claw('swing', 3) })];

  it('GDD-ART-04 the wind-up shows clawWind, the swing clawSwipe with swipe0 then swipe1', () => {
    const ps = poses(swing, run());
    expect(looks(ps)).toEqual(['clawWind', 'clawWind', 'clawSwipe', 'clawSwipe', 'clawSwipe']);
    expect(ps.map((p) => p.swipe)).toEqual([null, null, 'swipe0', 'swipe1', 'swipe1']);
  });

  it('GDD-ART-04 after the swing clawFollow shows for 10 steps, swipe2 on the first 3, swipe3 on the next 3', () => {
    const ps = poses([...swing, ...times(11, run())], run()).slice(5);
    expect(looks(ps)).toEqual([...rep(10, 'clawFollow'), 'idle']);
    expect(ps.map((p) => p.swipe)).toEqual([...rep(3, 'swipe2'), ...rep(3, 'swipe3'), ...rep(5, null)]);
  });

  it('GDD-ART-04 a claw in the air shows the claw', () => {
    const high = player({ grounded: false, vy: 300 });
    expect(stepPose(startPose(100), run({ player: high }), run({ player: high, claw: claw('windup', 1) })).look).toBe('clawWind');
  });

  it('GDD-ART-04 the claw faces the way it swings, and holds nothing', () => {
    const p = stepPose(startPose(100), run({ power: 'taco' }), run({ power: 'taco', claw: claw('swing', 1, -1) }));
    expect([p.flip, p.held]).toEqual([true, null]);
  });

  it('GDD-ART-04 a claw beats a spit', () => {
    expect(stepPose(startPose(100), run({ power: 'fuego' }), run({ power: 'fuego', claw: claw('windup', 1), fireballs: [fireball(0)] })).look).toBe('clawWind');
  });
});

describe('GDD-ART-04 the spit', () => {
  const spat = [fuego([fireball(0)]), ...rep(10, 0).map((_, i) => fuego([fireball(i + 1)]))];

  it('GDD-ART-04 a fireball spat shows spit0 for 2 steps, then spit1 for 8 with flame0 for 4 and flame1 for 4', () => {
    const ps = poses(spat, fuego([]));
    expect(looks(ps)).toEqual([...rep(2, 'spit0'), ...rep(8, 'spit1'), 'idle']);
    expect(ps.map((p) => p.fx)).toEqual([null, null, ...rep(4, 'flame0'), ...rep(4, 'flame1'), null]);
  });

  it('GDD-ART-04 the spit holds the chile in Fuego', () => {
    expect(stepPose(startPose(100), fuego([]), spat[0]!).held).toBe('chileHeld');
  });

  it('GDD-ART-04 a spit beats eating', () => {
    expect(stepPose(startPose(100), run({ power: 'taco' }), run({ power: 'fuego', fireballs: [fireball(0)] })).look).toBe('spit0');
  });
});

describe('GDD-ART-04 eating', () => {
  it('GDD-ART-04 a taco eaten shows eat0 with the taco for 10 steps, then eat1 with the bitten taco for 14, crumbs0 for 6 and crumbs1 for 6', () => {
    const ps = poses([run({ power: 'taco' }), ...times(24, run({ power: 'taco' }))], run());
    expect(looks(ps)).toEqual([...rep(10, 'eat0'), ...rep(14, 'eat1'), 'idle']);
    expect(ps.map((p) => p.held)).toEqual([...rep(10, 'tacoFood'), ...rep(14, 'tacoBittenHeld'), 'tacoHeld']);
    expect(ps.map((p) => p.fx)).toEqual([...rep(10, null), ...rep(6, 'crumbs0'), ...rep(6, 'crumbs1'), null, null, null]);
  });

  it('GDD-ART-04 a chile eaten in Taco shows the chile in both frames', () => {
    const ps = poses([run({ power: 'fuego' }), ...times(23, run({ power: 'fuego' }))], run({ power: 'taco' }));
    expect(ps.map((p) => p.held)).toEqual(rep(24, 'chileFood'));
  });

  it('GDD-ART-04 a chile eaten in Base shows the chile too', () => {
    const chile = { x: 100, y: 200, vx: 0, vy: 0, kind: 'chile' as const };
    const p = stepPose(startPose(100), run({ items: [chile] }), run({ power: 'taco' }));
    expect([p.look, p.held]).toEqual(['eat0', 'chileFood']);
  });

  it('GDD-ART-04 losing a power is no eating', () => {
    expect(stepPose(startPose(100), run({ power: 'fuego' }), run({ power: 'taco' })).look).toBe('idle');
  });

  it('GDD-ART-04 eating beats the air', () => {
    const high = player({ grounded: false, vy: 300 });
    expect(stepPose(startPose(100), run({ player: high }), run({ player: high, power: 'taco' })).look).toBe('eat0');
  });
});

describe('GDD-ART-04 in the air', () => {

  it('GDD-ART-04 a take-off shows jump0 for 4 steps, then the frame for his speed', () => {
    const ps = poses([air(-410, { takeoff: 'jump' }), air(-385), air(-360), air(-335), air(-310)], run());
    expect(looks(ps)).toEqual(['jump0', 'jump0', 'jump0', 'jump0', 'jump1']);
  });

  it('GDD-ART-04 rising faster than 120 px/s is jump1, then the apex under 60, the fall under 250, the fast fall from 250', () => {
    expect([airAt(-121), airAt(-120), airAt(59.9), airAt(60), airAt(249.9), airAt(250)]).toEqual(['jump1', 'apex', 'apex', 'fall0', 'fall0', 'fall1']);
  });

  it('GDD-ART-04 in the air beats the landing: a jump soon after a landing shows the jump', () => {
    const ps = poses([run(), air(-410, { takeoff: 'jump' })], air(300));
    expect(looks(ps)).toEqual(['land', 'jump0']);
  });
});

describe('GDD-ART-04 landing', () => {

  it('GDD-ART-04 landing from 150 px/s shows land for 6 steps', () => {
    expect(looks(poses(times(7, run()), air(150)))).toEqual([...rep(6, 'land'), 'idle']);
  });

  it('GDD-ART-04 landing from under 150 px/s shows no land', () => {
    expect(stepPose(startPose(100), air(149.9), run()).look).toBe('idle');
  });

  it('GDD-ART-04 a run takes over only when the land frames end', () => {
    const ps = poses(rep(7, 0).map((_, i) => run({ player: player({ x: 102 + 2 * i, vx: 120 }) })), air(300));
    expect(looks(ps)).toEqual([...rep(6, 'land'), 'run1']);
  });

  it('GDD-ART-04 the respawn is no landing', () => {
    const dead = run({ phase: 'respawning', wait: 0, player: player({ grounded: false, vy: 400 }) });
    expect(stepPose(startPose(100), dead, run({ invulnerable: 119 })).look).toBe('idle');
  });

  it('GDD-ART-04 landing beats the skid', () => {
    expect(stepPose(startPose(100), air(300), run({ player: player({ vx: -100 }) })).look).toBe('land');
  });
});

describe('GDD-ART-04 the skid and the run', () => {

  it('GDD-ART-04 the skid needs 40 px/s against the way he faces', () => {
    expect([groundAt(-40, 1), groundAt(-39.9, 1), groundAt(40, -1), groundAt(40, 1)]).toEqual(['skid', 'run0', 'skid', 'run0']);
  });

  it('GDD-ART-04 the skid beats the run frames', () => {
    expect(stepPose(startPose(100), ground(-120, -1), ground(-120, 1)).look).toBe('skid');
  });

  it('GDD-ART-04 the run frames play as before, one for every 8 px', () => {
    const ps = poses(rep(9, 0).map((_, i) => run({ player: player({ x: 102 + 2 * i, vx: 120 }) })), run());
    expect(looks(ps)).toEqual([...rep(4, 'run0'), ...rep(4, 'run1'), 'run2']);
  });
});

describe('GDD-ART-04 standing', () => {
  it('GDD-ART-04 he blinks on the last 6 of every 180 idle steps', () => {
    const ps = looks(poses(times(360, run()), run()));
    expect(ps.slice(0, 174)).toEqual(rep(174, 'idle'));
    expect(ps.slice(174, 180)).toEqual(rep(6, 'blink'));
    expect(ps[180]).toBe('idle');
    expect(ps.slice(353, 360)).toEqual(['idle', ...rep(6, 'blink')]);
  });

  it('GDD-ART-04 in Taco he glances at the taco for 40 of every 360 idle steps, after the blink, and not in Base', () => {
    const taco = looks(poses(times(541, run({ power: 'taco' })), run({ power: 'taco' })));
    expect(taco.slice(174, 180)).toEqual(rep(6, 'blink'));
    expect(taco.slice(180, 220)).toEqual(rep(40, 'glance'));
    expect(taco[220]).toBe('idle');
    expect(taco.slice(354, 360)).toEqual(rep(6, 'blink'));
    expect(taco[540]).toBe('glance');
    expect(looks(poses(times(181, run()), run()))[180]).toBe('idle');
    expect(looks(poses(times(181, run({ power: 'fuego' })), run({ power: 'fuego' })))[180]).toBe('glance');
  });

  it('GDD-ART-04 the idle count starts again after he moves', () => {
    const moved = run({ player: player({ x: 102, vx: 120 }) });
    const ps = looks(poses([...times(170, run()), moved, ...times(175, run())], run()));
    expect(ps[170]).toBe('run0');
    expect(ps.slice(171, 345)).toEqual(rep(174, 'idle'));
    expect(ps[345]).toBe('blink');
  });
});

describe('GDD-ART-04 what he holds and which way he faces', () => {
  it('GDD-ART-04 a frame that holds with the paw shows the taco in Taco, the taco and chile in Fuego, nothing in Base', () => {
    expect([heldIn('taco'), heldIn('fuego'), heldIn('base')]).toEqual(['tacoHeld', 'chileHeld', null]);
  });

  it('GDD-ART-04 facing left mirrors him', () => {
    expect(stepPose(startPose(100), run(), run({ player: player({ facing: -1 }) })).flip).toBe(true);
    expect(stepPose(startPose(100), run(), run()).flip).toBe(false);
  });

  it('GDD-ART-04 the held item goes on the frame\'s hand, mirrored with him', () => {
    // idle's hand is drawing px (72, 73), the held frame 24 px square with its paw at (12, 12): its middle 12 game px in front of his
    // middle (72 - 48 = 24 drawing px) and 11.5 above his feet (96 - 73 = 23).
    const right = stepPose(startPose(100), run({ power: 'taco' }), run({ power: 'taco' }));
    expect(ponchoParts(right, player(), IDLE_CLAW).held).toEqual({ look: 'tacoHeld', x: 112, y: 188.5 });
    const left = stepPose(startPose(100), run({ power: 'taco' }), run({ power: 'taco', player: player({ facing: -1 }) }));
    expect(ponchoParts(left, player(), IDLE_CLAW).held).toEqual({ look: 'tacoHeld', x: 88, y: 188.5 });
  });

  it('GDD-ART-04 the flame goes on the frame\'s mouth, mirrored with him', () => {
    // spit1's mouth is drawing px (79, 62), the effects frame 32 px square with the mouth at (3, 17): its middle at 79 - 3 + 16 = 92
    // (22 game px in front) and 62 - 17 + 16 = 61 (17.5 above his feet).
    const p = poses([run({ power: 'fuego', fireballs: [fireball(0)] }), run({ power: 'fuego' }), run({ power: 'fuego' })], run({ power: 'fuego' }))[2]!;
    expect(ponchoParts(p, player(), IDLE_CLAW).fx).toEqual({ look: 'flame0', x: 122, y: 182.5 });
    expect(ponchoParts({ ...p, flip: true }, player(), IDLE_CLAW).fx).toEqual({ look: 'flame0', x: 78, y: 182.5 });
  });

  it('GDD-ART-04 the swipe frame\'s box sits on the claw\'s box, both ways', () => {
    // The claw's box starts at his front edge, 6 px out, and is 20 x 32; the frame is 32 x 32 with the box 6 px in from its back: its
    // middle 16 px in front of his middle and 16 above his feet.
    const right = stepPose(startPose(100), run(), run({ claw: claw('swing', 1) }));
    expect(ponchoParts(right, player(), claw('swing', 1)).swipe).toEqual({ look: 'swipe0', x: 116, y: 184 });
    const left = stepPose(startPose(100), run(), run({ claw: claw('swing', 1, -1) }));
    expect(ponchoParts(left, player(), claw('swing', 1, -1)).swipe).toEqual({ look: 'swipe0', x: 84, y: 184 });
    expect(ponchoParts(stepPose(startPose(100), run(), run()), player(), IDLE_CLAW)).toEqual({ held: null, swipe: null, fx: null });
  });
});

describe('GDD-ART-04 the taco and chile pickups', () => {
  it('GDD-ART-04 a pickup shows its four bob frames, 8 steps each, by the run\'s clock', () => {
    expect([0, 7, 8, 15, 16, 23, 24, 31, 32].map((c) => pickupLook('taco', c))).toEqual(['tacoBob0', 'tacoBob0', 'tacoBob1', 'tacoBob1', 'tacoBob2', 'tacoBob2', 'tacoBob3', 'tacoBob3', 'tacoBob0']);
    expect([111, 120].map((c) => pickupLook('taco', c))).toEqual(['tacoBob1', 'tacoBob3']);
    expect(pickupLook('chile', 8)).toBe('chileBob1');
  });

  it('GDD-ART-04 a pickup glints for the last 8 of every 120 steps', () => {
    expect([111, 112, 119, 120, 231, 232, 239, 240].map((c) => pickupLook('chile', c))).toEqual(['chileBob1', 'chileGlint', 'chileGlint', 'chileBob3', 'chileBob0', 'chileGlint', 'chileGlint', 'chileBob2']);
    expect(pickupLook('taco', 112)).toBe('tacoGlint');
  });
});
