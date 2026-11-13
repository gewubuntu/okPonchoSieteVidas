import { describe, expect, it } from 'vitest';
import type { Hop } from '../sim/chapulin';
import type { Shell } from '../sim/armadillo';
import { kindOf, type Enemy, type EnemyState, type Flight, type Gait } from '../sim/enemy';
import type { Wing } from '../sim/paloma';
import { surfaceY } from '../sim/slope';
import { parseTiles } from '../sim/tilemap';
import type { Spin } from '../sim/trompo';
import { ARMADILLO_BOTTOMS, ENEMY_LOOKS } from './enemyLooks';
import { enemyPose, stepRang, type PoseContext } from './enemyPose';

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

// World 3's Armadillo (GDD-ENM-04): its start at (300, 208); `shelled` its state at x, its feet at y = 208 unless given, facing `dir`.
const ARMADILLO: Enemy = { x: 300, y: 208, kind: 'armadillo' };
const shelled = (o: Partial<Shell>, x = 300, dir: 1 | -1 = 1, y = 208): EnemyState => ({ x, y, dir, alive: true, shell: { phase: 'walk', age: 0, vy: 0, vx: 0, ...o } });
const aLook = (o: Partial<Shell>, x = 300, dir: 1 | -1 = 1) => look(ARMADILLO, shelled(o, x, dir));

describe('GDD-ENM-04 which frame the Armadillo shows', () => {
  it('GDD-ENM-04 the Armadillo walk shows the next trot frame every 2 px walked, not by time, facing its way', () => {
    expect([0, 2, 4, 6, 8].map((x) => aLook({}, x))).toEqual(['walk0', 'walk1', 'walk2', 'walk3', 'walk0']);
    expect([1.9, 3.9, 5.9, 7.9].map((x) => aLook({}, x))).toEqual(['walk0', 'walk1', 'walk2', 'walk3']);
    // From its x alone: standing still (a paused step, any age) it keeps its frame.
    expect([0, 1, 7, 30, 59].map((age) => aLook({ age }, 2))).toEqual(['walk1', 'walk1', 'walk1', 'walk1', 'walk1']);
    expect([0, 2].map((x) => enemyPose(ARMADILLO, shelled({}, x), FAR).frame)).toEqual([0, 1]);
    expect(enemyPose(ARMADILLO, shelled({}, 4), FAR)).toEqual({ look: 'walk2', frame: 2, x: 4, y: 208, flip: false });
    expect(flip(ARMADILLO, shelled({}, 304, -1))).toBe(true);
    expect(enemyPose(ARMADILLO, shelled({}, 304, 1, 200), FAR).y).toBe(200); // where it walked up a ramp to
  });

  it('GDD-ENM-01 the Armadillo tuck flashes red on its first 4 steps, plain 4, red 4, facing Poncho', () => {
    // Its tuck's age 0 is its first step (30 left): red at ages 0 to 3, 8 to 11, 16 to 19, 24 to 27, plain between and at 28 and 29.
    const red = Array.from({ length: 30 }, (_, age) => aLook({ phase: 'tuck', age }) === 'tuckRed');
    expect(red).toEqual(Array.from({ length: 30 }, (_, age) => Math.floor(age / 4) % 2 === 0));
    expect(Array.from({ length: 30 }, (_, age) => aLook({ phase: 'tuck', age })).every((l) => l === 'tuck' || l === 'tuckRed')).toBe(true);
    expect(enemyPose(ARMADILLO, shelled({ phase: 'tuck', age: 0 }), FAR).frame).toBe(5);
    expect(enemyPose(ARMADILLO, shelled({ phase: 'tuck', age: 4 }), FAR).frame).toBe(4);
    expect(flip(ARMADILLO, shelled({ phase: 'tuck' }, 300, -1))).toBe(true);
    expect(flip(ARMADILLO, shelled({ phase: 'tuck' }, 300, 1))).toBe(false);
  });

  it('GDD-ENM-04 the rolling Armadillo shows the next roll frame every 6 px it rolls, either way, mirrored rolling left', () => {
    // Rolling right the frames go roll0 to roll3 as x grows; rolling left, mirrored, they go roll0 to roll3 as x falls, so the mirrored
    // bands and ear go round the other way (anticlockwise), as a ball rolling left turns.
    expect([0, 5.9, 6, 12, 18, 24].map((x) => aLook({ phase: 'roll', vx: 130 }, x, 1))).toEqual(['roll0', 'roll0', 'roll1', 'roll2', 'roll3', 'roll0']);
    expect([24, 18, 12, 6, 0].map((x) => aLook({ phase: 'roll', vx: 130 }, x, -1))).toEqual(['roll0', 'roll1', 'roll2', 'roll3', 'roll0']);
    expect(flip(ARMADILLO, shelled({ phase: 'roll' }, 300, -1))).toBe(true);
    expect(flip(ARMADILLO, shelled({ phase: 'roll' }, 300, 1))).toBe(false);
    // In the air too, while it falls, the frames follow its x.
    expect([0, 6].map((x) => aLook({ phase: 'roll', vx: 130, vy: 200 }, x, 1))).toEqual(['roll0', 'roll1']);
    expect([6, 12, 18, 24].map((x) => enemyPose(ARMADILLO, shelled({ phase: 'roll' }, x), FAR).frame)).toEqual([7, 8, 9, 6]);
  });

  it('GDD-ENM-04 the tucked and rolling ball is drawn standing on its feet, at its middle', () => {
    for (const o of [{ phase: 'tuck' }, { phase: 'roll', vx: 130 }, { phase: 'roll', vx: 130, vy: 100 }] as const) {
      expect(enemyPose(ARMADILLO, shelled(o, 312, 1, 190), FAR), o.phase).toMatchObject({ x: 312, y: 190 });
      expect(enemyPose(ARMADILLO, shelled(o, 312, -1, 190), FAR), o.phase).toMatchObject({ x: 312, y: 190 });
    }
  });

  it('GDD-ENM-04 the dazed Armadillo lies on its back, kicking on every other 4 steps of its last 30 only', () => {
    // Dazed 60 steps, kicking in the last 30 (ages 30 to 59), on the blocks of 4 steps whose number is even, as the Tlacuache twitches.
    const looks = Array.from({ length: 60 }, (_, age) => aLook({ phase: 'dazed', age }));
    expect(looks.slice(0, 30).every((l) => l === 'dazed')).toBe(true);
    expect(looks.slice(30).map((l, k) => [30 + k, l]).filter(([, l]) => l === 'dazedKick').map(([age]) => age)).toEqual([32, 33, 34, 35, 40, 41, 42, 43, 48, 49, 50, 51, 56, 57, 58, 59]);
    expect([0, 32].map((age) => enemyPose(ARMADILLO, shelled({ phase: 'dazed', age }), FAR).frame)).toEqual([10, 11]);
  });

  it('GDD-ENM-04 the dazed Armadillo is drawn back from the wall it faces by its front reach, at its feet', () => {
    // It lies facing the wall that stopped it; its drawing reaches 5 px past its box's front (scripts/art/enemies3.test.mjs), so it is drawn
    // that far back, off the wall's face: its front on its box's front.
    expect(enemyPose(ARMADILLO, shelled({ phase: 'dazed', age: 3 }, 296, 1), FAR)).toEqual({ look: 'dazed', frame: 10, x: 291, y: 208, flip: false });
    expect(enemyPose(ARMADILLO, shelled({ phase: 'dazed', age: 3 }, 296, -1), FAR)).toEqual({ look: 'dazed', frame: 10, x: 301, y: 208, flip: true });
    expect(enemyPose(ARMADILLO, shelled({ phase: 'dazed', age: 40 }, 296, -1), FAR)).toMatchObject({ look: 'dazedKick', x: 301 });
  });
});

/** A rolling Armadillo, the claw ringing off it this step or not; and a run's enemies after a step, in play or respawning. */
const ringing = (rang: boolean): EnemyState => ({ ...shelled({ phase: 'roll', vx: 130, ...(rang ? { rang: true } : {}) }) });
const run = (enemies: readonly EnemyState[], phase: 'playing' | 'respawning' = 'playing') => ({ enemies, phase });

describe('GDD-ENM-04 the claw ringing off the ball', () => {

  it('GDD-ENM-04 the claw ringing off the rolling ball flashes it white for 2 steps', () => {
    // The flag lasts the step it rang; the flash, counted in steps left, shows on that step and the next.
    let left = stepRang([0], run([ringing(true)]));
    expect(left).toEqual([2]);
    left = stepRang(left, run([ringing(false)]));
    expect(left).toEqual([1]);
    left = stepRang(left, run([ringing(false)]));
    expect(left).toEqual([0]);
    expect(stepRang(left, run([ringing(false)]))).toEqual([0]);
    // A ring on a step it is still flashing starts the 2 steps again; other enemies are left alone.
    expect(stepRang([1, 0], run([ringing(true), walker(10)]))).toEqual([2, 0]);
  });

  it('GDD-ENM-04 a lost life clears the rang flash', () => {
    expect(stepRang([2], run([ringing(false)], 'respawning'))).toEqual([0]);
    expect(stepRang([2], run([{ ...ringing(false), alive: false }]))).toEqual([0]);
  });
});

// GDD-ENM-04, L-059: the Armadillo's drawing kept out of walls and the ground. `walled`: a floor at row 10 (y = 160) across 30 columns, a
// wall 2 tiles tall in column 2 (x 32 to 48) and one in column 10 (x 160 to 176). `ramp`: the same floor, a gentle ramp rising right
// ('r' then 'R', 8 px each) in columns 12 and 13 up to a step at row 9 (y = 144) from column 14 on.
const walled = parseTiles(Array.from({ length: 12 }, (_r, r) => Array.from({ length: 30 }, (_c, c) => (r >= 10 || ((c === 2 || c === 10) && r >= 8) ? '#' : '.')).join('')));
const ramp = parseTiles(
  Array.from({ length: 12 }, (_r, r) => Array.from({ length: 30 }, (_c, c) => (r >= 10 || (r === 9 && c >= 14) ? '#' : r === 9 && c === 12 ? 'r' : r === 9 && c === 13 ? 'R' : '.')).join('')),
);
const at160 = (x: number, dir: 1 | -1, o: Partial<Shell> = {}, y = 160) => enemyPose(ARMADILLO, shelled(o, x, dir, y), { ...FAR, world: walled });

describe('GDD-ENM-04 the Armadillo drawn out of walls and the ground', () => {
  it('GDD-ENM-04 a walking Armadillo against a wall is drawn shifted off it by its reach on that side', () => {
    // Its walk frames reach 4.5 px past its box in front (the snout) and 5 px behind (the tail) (scripts/art/enemies3.test.mjs).
    expect(at160(152, 1)).toMatchObject({ x: 147.5, y: 160, flip: false }); // flush against the wall at x = 160, heading into it: the snout
    expect(at160(152, -1)).toMatchObject({ x: 147, y: 160, flip: true }); // flush, heading away from it: the tail
    expect(at160(150, 1).x).toBe(147.5); // 2 px of room: shifted 2.5 px
    expect(at160(147, 1).x).toBe(147); // 5 px of room: not shifted
    expect(at160(56, -1).x).toBe(60.5); // flush against the wall at x = 48 on its left, heading into it
    expect(at160(56, 1).x).toBe(61); // the same, heading away: the tail
    expect(at160(100, 1).x).toBe(100);
    // Without the level's tiles (a pose with no world) it is not shifted.
    expect(enemyPose(ARMADILLO, shelled({}, 152, 1, 160), FAR).x).toBe(152);
  });

  it('GDD-ENM-04 on a slope the walk frame and the dust are drawn raised so no drawn pixel lies in the sand, and not on the level', () => {
    const ground = (x: number, y: number): boolean => {
      const tx = Math.floor(x / 16);
      const ty = Math.floor(y / 16);
      if (ramp.solidTile(tx, ty)) return true;
      const sl = ramp.slopeAt(tx, ty);
      return sl !== null && y > surfaceY(tx, ty, sl, x);
    };
    let raised = 0;
    for (const o of [{}, { phase: 'roll', vx: 130 }] as const) {
      for (const dir of [1, -1] as const) {
        // The middle of its feet on the ramp's surface (y = 160 - (x - 192) / 2) at every px across it.
        for (let x = 193; x < 224; x++) {
          const feet = 160 - (x - 192) / 2;
          const pose = enemyPose(ARMADILLO, shelled(o, x, dir, feet), { ...FAR, world: ramp });
          expect(pose.y, `${x}`).toBeLessThanOrEqual(feet);
          if (pose.y < feet) raised++;
          const cols = ARMADILLO_BOTTOMS[pose.look]!;
          for (let i = 0; i < cols.length; i++) {
            if (cols[i] === '.') continue;
            const dx = ((i + 0.5 - 28) / 2) * (pose.flip ? -1 : 1);
            const h = parseInt(cols[i]!, 36) / 2;
            expect(ground(pose.x + dx, pose.y - h - 0.25), `${pose.look} at ${x}, column ${i}`).toBe(false);
          }
        }
      }
    }
    expect(raised).toBeGreaterThan(50);
    // On the level, away from the ramp, nothing is raised.
    expect(enemyPose(ARMADILLO, shelled({}, 100, 1, 160), { ...FAR, world: ramp }).y).toBe(160);
    expect(enemyPose(ARMADILLO, shelled({ phase: 'roll', vx: 130 }, 100, -1, 160), { ...FAR, world: ramp }).y).toBe(160);
  });
});
