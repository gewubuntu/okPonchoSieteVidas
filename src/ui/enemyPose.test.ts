import { describe, expect, it } from 'vitest';
import type { Hop } from '../sim/chapulin';
import { kindOf, type Enemy, type EnemyState, type Flight, type Gait } from '../sim/enemy';
import type { Wing } from '../sim/paloma';
import type { Spin } from '../sim/trompo';
import { ENEMY_LOOKS } from './enemyLooks';
import { enemyPose, type PoseContext } from './enemyPose';

const ALACRAN: Enemy = { x: 100, y: 160 };
const ZOPILOTE: Enemy = { x: 200, y: 50, kind: 'zopilote' };
// A cactus buddy whose feet are at y = 192: its box (12 x 16 px) has its middle at y = 184.
const CACTUS: Enemy = { x: 184, y: 192, kind: 'cactus' };
const TLACUACHE: Enemy = { x: 440, y: 96, kind: 'tlacuache' };
const FAR: PoseContext = { clock: 0, poncho: { x: 1000, y: 1000 } };

const walker = (x: number, dir: 1 | -1 = 1): EnemyState => ({ x, dir, alive: true });
const flying = (flight: Partial<Flight>, x = 100, dir: 1 | -1 = 1): EnemyState => ({ x, dir, alive: true, flight: { y: 50, phase: 'cruise', age: 0, aimX: 0, aimY: 0, ...flight } });
const opossum = (gait: Partial<Gait>, x = 440, dir: 1 | -1 = 1): EnemyState => ({ x, dir, alive: true, gait: { phase: 'walk', age: 0, playedDead: false, ...gait } });
const look = (def: Enemy, state: EnemyState, ctx = FAR) => enemyPose(def, state, ctx).look;
const flip = (def: Enemy, state: EnemyState, ctx = FAR) => enemyPose(def, state, ctx).flip;
/** Poncho's hurtbox centre `dx` px across from the cactus buddy's box's middle and `dy` px down from it, at clock `clock`. */
const near = (dx: number, dy: number, clock = 0): PoseContext => ({ clock, poncho: { x: 184 + dx, y: 184 + dy } });
/** The way a Zopilote at (100, 50) heading `dir` faces, diving at a point `aimX` across. */
const facing = (aimX: number, dir: 1 | -1) => flip(ZOPILOTE, flying({ phase: 'dive', aimX, aimY: 90 }, 100, dir));
/** A Tlacuache's look `age` steps into playing dead. */
const dead = (age: number) => look(TLACUACHE, opossum({ phase: 'dead', age, playedDead: true }));

describe('GDD-ENM-02 which frame World 1\'s enemies show', () => {
  it('GDD-ENM-02 the Alacran walk advances a frame every 2 px and wraps after 4', () => {
    expect([0, 2, 4, 6, 8].map((x) => look(ALACRAN, walker(x)))).toEqual(['walk0', 'walk1', 'walk2', 'walk3', 'walk0']);
    expect([1.9, 3.9, 5.9, 7.9].map((x) => look(ALACRAN, walker(x)))).toEqual(['walk0', 'walk1', 'walk2', 'walk3']);
    expect(look(ALACRAN, walker(-1))).toBe('walk3');
    expect(look(ALACRAN, walker(-3))).toBe('walk2');
    expect([0, 2, 4, 6].map((x) => enemyPose(ALACRAN, walker(x), FAR).frame)).toEqual([0, 1, 2, 3]);
  });

  it('GDD-ENM-02 the Alacran stands at its x and its feet and faces left when it heads left', () => {
    expect(enemyPose(ALACRAN, walker(104), FAR)).toEqual({ look: 'walk0', frame: 0, x: 104, y: 160, flip: false });
    expect(enemyPose(ALACRAN, walker(104, -1), FAR)).toMatchObject({ x: 104, y: 160, flip: true });
    expect(enemyPose(ALACRAN, { ...walker(104), y: 170 }, FAR).y).toBe(170); // where it walked down a slope to
  });

  it('GDD-ENM-02 the Zopilote flaps a frame every 6 steps while it cruises', () => {
    expect([0, 5, 6, 12, 18, 24].map((age) => look(ZOPILOTE, flying({ age })))).toEqual(['flap0', 'flap0', 'flap1', 'flap2', 'flap3', 'flap0']);
    expect([0, 6, 12, 18].map((age) => enemyPose(ZOPILOTE, flying({ age }), FAR).frame)).toEqual([0, 1, 2, 3]);
    expect(enemyPose(ZOPILOTE, flying({ age: 0, y: 61.5 }, 130), FAR)).toMatchObject({ x: 130, y: 61.5 }); // its box's middle: its flight y
    expect(flip(ZOPILOTE, flying({}, 100, -1))).toBe(true);
    expect(flip(ZOPILOTE, flying({}, 100, 1))).toBe(false);
  });

  it('GDD-ENM-01 the Zopilote telegraph flashes red on steps 0 to 3 and not 4 to 7', () => {
    const looks = [0, 1, 2, 3, 4, 5, 6, 7, 8].map((age) => look(ZOPILOTE, flying({ phase: 'telegraph', age })));
    expect(looks).toEqual(['teleRed', 'teleRed', 'teleRed', 'teleRed', 'tele', 'tele', 'tele', 'tele', 'teleRed']);
    expect(enemyPose(ZOPILOTE, flying({ phase: 'telegraph', age: 0 }), FAR).frame).toBe(5);
    expect(enemyPose(ZOPILOTE, flying({ phase: 'telegraph', age: 4 }), FAR).frame).toBe(4);
    expect(flip(ZOPILOTE, flying({ phase: 'telegraph' }, 100, -1))).toBe(true);
  });

  it('GDD-ENM-02 the Zopilote dives steep when the drop is at least 1.3 times the run, else shallow', () => {
    // From (100, 50): 10 px across, a drop of 13 px is 1.3 times it.
    const dive = (aimX: number, aimY: number) => look(ZOPILOTE, flying({ phase: 'dive', aimX, aimY }));
    expect(dive(110, 63)).toBe('diveSteep');
    expect(dive(110, 62.9)).toBe('diveShallow');
    expect(dive(110, 80)).toBe('diveSteep');
    expect(dive(110, 55)).toBe('diveShallow');
    expect(dive(100, 90)).toBe('diveSteep'); // straight down
    expect(dive(90, 63)).toBe('diveSteep');
    expect(dive(90, 62)).toBe('diveShallow');
    expect(enemyPose(ZOPILOTE, flying({ phase: 'dive', aimX: 110, aimY: 80 }), FAR).frame).toBe(6);
    expect(enemyPose(ZOPILOTE, flying({ phase: 'dive', aimX: 110, aimY: 55 }), FAR).frame).toBe(7);
  });

  it('GDD-ENM-02 the Zopilote faces the way it dives', () => {
    expect(facing(80, 1)).toBe(true); // aiming left, though it cruised right
    expect(facing(120, -1)).toBe(false); // aiming right, though it cruised left
    expect(facing(80, -1)).toBe(true);
    expect(facing(120, 1)).toBe(false);
    expect(facing(100, -1)).toBe(true); // straight down: the way it was heading
    expect(facing(100, 1)).toBe(false);
  });

  it('GDD-ENM-02 the Zopilote climbs back a frame every 4 steps', () => {
    expect([0, 3, 4, 8, 12].map((age) => look(ZOPILOTE, flying({ phase: 'return', age })))).toEqual(['climb0', 'climb0', 'climb1', 'climb0', 'climb1']);
    expect([0, 4].map((age) => enemyPose(ZOPILOTE, flying({ phase: 'return', age }), FAR).frame)).toEqual([8, 9]);
    expect(flip(ZOPILOTE, flying({ phase: 'return' }, 100, -1))).toBe(true);
  });

  it('GDD-ENM-02 the cactus buddy dozes facing right while Poncho is far, breathing every 45 steps', () => {
    const doze = (clock: number) => enemyPose(CACTUS, walker(184), { clock, poncho: { x: 1000, y: 184 } });
    expect([0, 44, 45, 89, 90].map((c) => doze(c).look)).toEqual(['doze0', 'doze0', 'doze1', 'doze1', 'doze0']);
    expect([0, 45].map((c) => doze(c).frame)).toEqual([0, 1]);
    expect(doze(0)).toMatchObject({ x: 184, y: 192, flip: false });
    expect(look(CACTUS, walker(184), { clock: 0, poncho: { x: -1000, y: 184 } })).toBe('doze0');
    expect(flip(CACTUS, walker(184), { clock: 0, poncho: { x: -1000, y: 184 } })).toBe(false); // far to its left: still facing right
  });

  it('GDD-ENM-02 the cactus buddy peeks within 64 px across and 48 px up or down', () => {
    expect(look(CACTUS, walker(184), near(64, 0))).toBe('peek');
    expect(look(CACTUS, walker(184), near(65, 0))).toBe('doze0');
    expect(look(CACTUS, walker(184), near(-64, 0))).toBe('peek');
    expect(look(CACTUS, walker(184), near(-65, 0))).toBe('doze0');
    expect(look(CACTUS, walker(184), near(40, 48))).toBe('peek');
    expect(look(CACTUS, walker(184), near(40, 49))).toBe('doze0');
    expect(look(CACTUS, walker(184), near(40, -48))).toBe('peek');
    expect(look(CACTUS, walker(184), near(40, -49))).toBe('doze0');
    expect(enemyPose(CACTUS, walker(184), near(64, 0)).frame).toBe(2);
  });

  it('GDD-ENM-02 the cactus buddy is alarmed within 28 px across and 32 px up or down, shivering every 4 steps', () => {
    expect(look(CACTUS, walker(184), near(28, 0))).toBe('alarm0');
    expect(look(CACTUS, walker(184), near(29, 0))).toBe('peek');
    expect(look(CACTUS, walker(184), near(-28, 0))).toBe('alarm0');
    expect(look(CACTUS, walker(184), near(-29, 0))).toBe('peek');
    expect(look(CACTUS, walker(184), near(10, 32))).toBe('alarm0');
    expect(look(CACTUS, walker(184), near(10, 33))).toBe('peek');
    expect(look(CACTUS, walker(184), near(10, -32))).toBe('alarm0');
    expect(look(CACTUS, walker(184), near(10, -33))).toBe('peek');
    expect([0, 3, 4, 7, 8].map((c) => look(CACTUS, walker(184), near(0, 0, c)))).toEqual(['alarm0', 'alarm0', 'alarm1', 'alarm1', 'alarm0']);
    expect([0, 4].map((c) => enemyPose(CACTUS, walker(184), near(0, 0, c)).frame)).toEqual([3, 4]);
  });

  it('GDD-ENM-02 the cactus buddy faces Poncho on either side while it peeks or is alarmed', () => {
    expect(flip(CACTUS, walker(184), near(-50, 0))).toBe(true); // peeking at him on its left
    expect(flip(CACTUS, walker(184), near(50, 0))).toBe(false);
    expect(flip(CACTUS, walker(184), near(-20, 0))).toBe(true); // alarmed by him on its left
    expect(flip(CACTUS, walker(184), near(20, 0))).toBe(false);
  });

  it('GDD-ENM-02 the Tlacuache walks a frame every 2 px, flashes in its telegraph and faces the way it goes', () => {
    expect([0, 2, 4, 6, 8].map((x) => look(TLACUACHE, opossum({}, x)))).toEqual(['walk0', 'walk1', 'walk2', 'walk3', 'walk0']);
    expect(look(TLACUACHE, opossum({}, -1))).toBe('walk3');
    expect([0, 3, 4, 7, 8].map((age) => look(TLACUACHE, opossum({ phase: 'telegraph', age })))).toEqual(['teleRed', 'teleRed', 'tele', 'tele', 'teleRed']);
    expect(enemyPose(TLACUACHE, opossum({}, 448), FAR)).toEqual({ look: 'walk0', frame: 0, x: 448, y: 96, flip: false });
    expect(flip(TLACUACHE, opossum({}, 444, -1))).toBe(true);
    expect(flip(TLACUACHE, opossum({ phase: 'charge' }, 444, -1))).toBe(true);
  });

  it('GDD-ENM-02 the Tlacuache charge shows a run frame every 5 px', () => {
    expect([0, 4.9, 5, 10, 15, 20].map((x) => look(TLACUACHE, opossum({ phase: 'charge' }, x)))).toEqual(['run0', 'run0', 'run1', 'run2', 'run3', 'run0']);
    expect(look(TLACUACHE, opossum({ phase: 'charge' }, -1))).toBe('run3');
    expect(enemyPose(TLACUACHE, opossum({ phase: 'charge' }, 5), FAR).frame).toBe(7);
  });

  it('GDD-ENM-02 the Tlacuache playing dead twitches only from 90 steps on, every other 4 steps', () => {
    // It plays dead for 120 steps and twitches in the last 30: from age 90, on the blocks of 4 steps whose number is even.
    expect([0, 1, 88, 89].map(dead)).toEqual(['dead', 'dead', 'dead', 'dead']);
    expect([90, 91].map(dead)).toEqual(['deadTwitch', 'deadTwitch']);
    expect([92, 95].map(dead)).toEqual(['dead', 'dead']);
    expect([96, 99, 100, 119].map(dead)).toEqual(['deadTwitch', 'deadTwitch', 'dead', 'dead']);
    expect([10, 90].map((age) => enemyPose(TLACUACHE, opossum({ phase: 'dead', age }), FAR).frame)).toEqual([10, 11]);
  });
});

// World 2's kinds (GDD-ENM-03). A Paloma whose feet are at y = 224, a Chapulín and a Trompo the same.
const PALOMA: Enemy = { x: 40, y: 224, kind: 'paloma' };
const CHAPULIN: Enemy = { x: 60, y: 224, kind: 'chapulin' };
const TROMPO: Enemy = { x: 80, y: 224, kind: 'trompo' };
const pigeon = (wing: Partial<Wing>, x = 40, dir: 1 | -1 = 1): EnemyState => ({ x, dir, alive: true, wing: { phase: 'walk', age: 0, lift: 0, ...wing } });
const grasshopper = (hop: Partial<Hop>, dir: 1 | -1 = 1, y?: number): EnemyState => ({ x: 60, dir, alive: true, hop: { phase: 'crouch', age: 0, vy: 0, ...hop }, ...(y === undefined ? {} : { y }) });
const top = (spin: Partial<Spin>, dir: 1 | -1 = 1): EnemyState => ({ x: 80, dir, alive: true, spin: { phase: 'spin', age: 0, ...spin } });
/** A hovering Paloma's y `age` steps into the hover, 40 px up. */
const hoverY = (age: number) => enemyPose(PALOMA, pigeon({ phase: 'hover', age, lift: 40 }), FAR).y;
/** A Chapulín's look in the air at vertical speed `vy`. */
const air = (vy: number) => look(CHAPULIN, grasshopper({ phase: 'air', vy }));
/** A stunned Trompo's look `age` steps into the stun. */
const stunned = (age: number) => look(TROMPO, top({ phase: 'stunned', age }));

describe('GDD-ENM-03 which frame World 2\'s enemies show', () => {
  it('GDD-ENM-03 the Paloma walk advances a frame every 2 px and wraps after 4', () => {
    expect([0, 2, 4, 6, 8].map((x) => look(PALOMA, pigeon({}, x)))).toEqual(['walk0', 'walk1', 'walk2', 'walk3', 'walk0']);
    expect([1.9, 3.9, 5.9, 7.9].map((x) => look(PALOMA, pigeon({}, x)))).toEqual(['walk0', 'walk1', 'walk2', 'walk3']);
    expect(look(PALOMA, pigeon({}, -1))).toBe('walk3');
    expect(look(PALOMA, pigeon({}, -3))).toBe('walk2');
  });

  it('GDD-ENM-01 the Paloma telegraph flashes red on steps 0 to 3 and not 4 to 7', () => {
    const looks = [0, 1, 2, 3, 4, 5, 6, 7, 8, 29].map((age) => look(PALOMA, pigeon({ phase: 'telegraph', age })));
    expect(looks).toEqual(['teleRed', 'teleRed', 'teleRed', 'teleRed', 'tele', 'tele', 'tele', 'tele', 'teleRed', 'tele']);
    expect(enemyPose(PALOMA, pigeon({ phase: 'telegraph', age: 0 }), FAR).frame).toBe(5);
    expect(enemyPose(PALOMA, pigeon({ phase: 'telegraph', age: 4 }), FAR).frame).toBe(4);
  });

  it('GDD-ENM-03 the Paloma claps a flap frame every 4 steps while it rises', () => {
    expect([0, 3, 4, 8, 12, 16, 19].map((age) => look(PALOMA, pigeon({ phase: 'rise', age, lift: 10 })))).toEqual(['flap0', 'flap0', 'flap1', 'flap2', 'flap3', 'flap0', 'flap0']);
    expect([0, 4, 8, 12].map((age) => enemyPose(PALOMA, pigeon({ phase: 'rise', age, lift: 10 }), FAR).frame)).toEqual([6, 7, 8, 9]);
  });

  it('GDD-ENM-03 the Paloma flaps a frame every 6 steps while it hovers', () => {
    expect([0, 5, 6, 12, 18, 24].map((age) => look(PALOMA, pigeon({ phase: 'hover', age, lift: 40 })))).toEqual(['flap0', 'flap0', 'flap1', 'flap2', 'flap3', 'flap0']);
  });

  it('GDD-ENM-03 the Paloma glides down while it descends', () => {
    expect([0, 5, 6, 39].map((age) => look(PALOMA, pigeon({ phase: 'descend', age, lift: 20 })))).toEqual(['glide', 'glide', 'glide', 'glide']);
    expect(enemyPose(PALOMA, pigeon({ phase: 'descend', age: 0, lift: 20 }), FAR).frame).toBe(10);
  });

  it('GDD-ENM-03 the Paloma is drawn at its feet less the height it has flown', () => {
    expect(enemyPose(PALOMA, pigeon({}, 44), FAR)).toEqual({ look: 'walk2', frame: 2, x: 44, y: 224, flip: false });
    expect(enemyPose(PALOMA, pigeon({ phase: 'rise', age: 5, lift: 10 }, 44), FAR)).toMatchObject({ x: 44, y: 214 });
    expect(enemyPose(PALOMA, pigeon({ phase: 'descend', age: 5, lift: 33 }), FAR).y).toBe(191);
    expect(enemyPose(PALOMA, { ...pigeon({}, 44), y: 200 }, FAR).y).toBe(200); // where it walked up a slope or a cordel to
    expect(enemyPose(PALOMA, { ...pigeon({ phase: 'hover', age: 0, lift: 40 }, 44), y: 200 }, FAR).y).toBe(160);
  });

  it('GDD-ENM-03 the hovering Paloma is drawn 2 px lower on every other 15 steps, and nothing else bobs', () => {
    expect([0, 14, 30, 44].map(hoverY)).toEqual([184, 184, 184, 184]);
    expect([15, 29, 45, 59].map(hoverY)).toEqual([186, 186, 186, 186]);
    for (const phase of ['walk', 'telegraph', 'rise', 'descend'] as const) expect(enemyPose(PALOMA, pigeon({ phase, age: 15, lift: 10 }), FAR).y, phase).toBe(214);
  });

  it('GDD-ENM-03 the Paloma faces left when it heads left', () => {
    for (const phase of ['walk', 'telegraph', 'rise', 'hover', 'descend'] as const) {
      expect(flip(PALOMA, pigeon({ phase }, 40, -1)), phase).toBe(true);
      expect(flip(PALOMA, pigeon({ phase }, 40, 1)), phase).toBe(false);
    }
  });

  it('GDD-ENM-03 the Chapulín chews a frame every 3 steps while it crouches, before its telegraph', () => {
    expect([0, 1, 2, 3, 4, 5].map((age) => look(CHAPULIN, grasshopper({ age })))).toEqual(['crouch0', 'crouch0', 'crouch0', 'crouch1', 'crouch1', 'crouch1']);
    expect([0, 3].map((age) => enemyPose(CHAPULIN, grasshopper({ age }), FAR).frame)).toEqual([0, 1]);
  });

  it('GDD-ENM-01 the Chapulín telegraphs in the last 30 steps of its crouch, red first, 4 steps on and 4 off', () => {
    const looks = [6, 9, 10, 13, 14, 35].map((age) => look(CHAPULIN, grasshopper({ age })));
    expect(looks).toEqual(['teleRed', 'teleRed', 'tele', 'tele', 'teleRed', 'tele']);
    expect(enemyPose(CHAPULIN, grasshopper({ age: 6 }), FAR).frame).toBe(3);
    expect(enemyPose(CHAPULIN, grasshopper({ age: 10 }), FAR).frame).toBe(2);
  });

  it('GDD-ENM-03 the Chapulín in the air boings above its own hop, rises, then falls', () => {
    expect(air(-480)).toBe('boing'); // an awning's throw
    expect(air(-301)).toBe('boing');
    expect(air(-300)).toBe('rise'); // exactly the hop's launch is not faster
    expect(air(-1)).toBe('rise');
    expect(air(0)).toBe('fall');
    expect(air(100)).toBe('fall');
    expect([-480, -300, 0].map((vy) => enemyPose(CHAPULIN, grasshopper({ phase: 'air', vy }), FAR).frame)).toEqual([6, 4, 5]);
  });

  it('GDD-ENM-03 the Chapulín is drawn at its x and its feet and faces left when it heads left', () => {
    expect(enemyPose(CHAPULIN, grasshopper({}), FAR)).toEqual({ look: 'crouch0', frame: 0, x: 60, y: 224, flip: false });
    expect(enemyPose(CHAPULIN, grasshopper({ phase: 'air', vy: -100 }, 1, 190), FAR)).toMatchObject({ x: 60, y: 190 }); // its feet in the air
    for (const hop of [{ age: 0 }, { age: 10 }, { phase: 'air', vy: -100 }, { phase: 'air', vy: 100 }] as const) {
      expect(flip(CHAPULIN, grasshopper(hop, -1))).toBe(true);
      expect(flip(CHAPULIN, grasshopper(hop, 1))).toBe(false);
    }
  });

  it('GDD-ENM-03 the Trompo spins a frame every 3 steps', () => {
    expect([0, 2, 3, 6, 9, 12, 15].map((age) => look(TROMPO, top({ age })))).toEqual(['spin0', 'spin0', 'spin1', 'spin2', 'spin3', 'spin0', 'spin1']);
    expect([0, 3, 6, 9].map((age) => enemyPose(TROMPO, top({ age }), FAR).frame)).toEqual([0, 1, 2, 3]);
    expect(enemyPose(TROMPO, top({}), FAR)).toEqual({ look: 'spin0', frame: 0, x: 80, y: 224, flip: false });
  });

  it('GDD-ENM-03 a stunned Trompo lies still, then rocks on every other 4 steps of its last 30', () => {
    expect([0, 1, 2, 3, 20, 24, 25, 26, 27, 29, 30, 31].map(stunned)).toEqual(Array(12).fill('stun'));
    expect([32, 33, 34, 35].map(stunned)).toEqual(['stunWobble', 'stunWobble', 'stunWobble', 'stunWobble']);
    expect([36, 37, 38, 39].map(stunned)).toEqual(['stun', 'stun', 'stun', 'stun']);
    expect([40, 43, 44, 47].map(stunned)).toEqual(['stunWobble', 'stunWobble', 'stun', 'stun']);
    expect([48, 52, 56, 59].map(stunned)).toEqual(['stunWobble', 'stun', 'stunWobble', 'stunWobble']);
    expect([0, 32].map((age) => enemyPose(TROMPO, top({ phase: 'stunned', age }), FAR).frame)).toEqual([4, 5]);
  });

  it('GDD-ENM-03 the Trompo faces left when it heads left', () => {
    for (const spin of [{ age: 0 }, { age: 5 }, { phase: 'stunned', age: 0 }, { phase: 'stunned', age: 40 }] as const) {
      expect(flip(TROMPO, top(spin, -1))).toBe(true);
      expect(flip(TROMPO, top(spin, 1))).toBe(false);
    }
  });

  it('GDD-ENM-03 every pose names the frame of its look in the kind\'s sheet', () => {
    const poses: [Enemy, EnemyState][] = [
      [PALOMA, pigeon({})], [PALOMA, pigeon({ phase: 'telegraph' })], [PALOMA, pigeon({ phase: 'telegraph', age: 4 })], [PALOMA, pigeon({ phase: 'rise', age: 8 })],
      [PALOMA, pigeon({ phase: 'hover', age: 18 })], [PALOMA, pigeon({ phase: 'descend' })],
      [CHAPULIN, grasshopper({})], [CHAPULIN, grasshopper({ age: 3 })], [CHAPULIN, grasshopper({ age: 6 })], [CHAPULIN, grasshopper({ age: 10 })],
      [CHAPULIN, grasshopper({ phase: 'air', vy: -400 })], [CHAPULIN, grasshopper({ phase: 'air', vy: -100 })], [CHAPULIN, grasshopper({ phase: 'air', vy: 100 })],
      [TROMPO, top({ age: 3 })], [TROMPO, top({ age: 9 })], [TROMPO, top({ phase: 'stunned', age: 0 })], [TROMPO, top({ phase: 'stunned', age: 32 })],
    ];
    for (const [def, state] of poses) {
      const pose = enemyPose(def, state, FAR);
      const kind = kindOf(def);
      if (kind === 'armadillo') continue; // it has no sheet yet (placeholder until armadillo.png, run B2)
      expect((ENEMY_LOOKS[kind] as readonly string[]).indexOf(pose.look), `${kind} ${pose.look}`).toBe(pose.frame);
    }
  });
});

// World 3's Murciélago (GDD-ENM-04): its loop's middle at (300, 100); `steps` its own steps, its middle at (x, y).
const MURCIELAGO: Enemy = { x: 300, y: 100, rx: 16, ry: 24, kind: 'murcielago' };
const flyer = (steps: number, x = 300, y = 100, dir: 1 | -1 = 1): EnemyState => ({ x, dir, alive: true, loop: { steps, y } });

describe('GDD-ENM-04 which frame the Murciélago shows', () => {
  it('GDD-ENM-04 a Murciélago shows the next flap frame every 5 steps, is drawn at its box\'s middle and faces the way it moves', () => {
    expect([0, 4, 5, 9, 10, 15, 19, 20, 25].map((n) => look(MURCIELAGO, flyer(n)))).toEqual(['flap0', 'flap0', 'flap1', 'flap1', 'flap2', 'flap3', 'flap3', 'flap0', 'flap1']);
    expect([0, 5, 10, 15].map((n) => enemyPose(MURCIELAGO, flyer(n), FAR).frame)).toEqual([0, 1, 2, 3]);
    // Drawn at its box's middle, where it is on its loop: here 13 px left of and 23 px under the loop's middle.
    expect(enemyPose(MURCIELAGO, flyer(7, 287, 123), FAR)).toEqual({ look: 'flap1', frame: 1, x: 287, y: 123, flip: false });
    expect(flip(MURCIELAGO, flyer(7, 287, 123, -1))).toBe(true);
    expect(flip(MURCIELAGO, flyer(7, 287, 123, 1))).toBe(false);
  });
});
