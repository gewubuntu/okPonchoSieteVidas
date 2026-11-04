import { describe, expect, it } from 'vitest';
import type { Enemy, EnemyState, Flight, Gait } from '../sim/enemy';
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
const look = (def: Enemy, state: EnemyState, ctx = FAR) => enemyPose(def, state, ctx)!.look;
const flip = (def: Enemy, state: EnemyState, ctx = FAR) => enemyPose(def, state, ctx)!.flip;
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
    expect([0, 2, 4, 6].map((x) => enemyPose(ALACRAN, walker(x), FAR)!.frame)).toEqual([0, 1, 2, 3]);
  });

  it('GDD-ENM-02 the Alacran stands at its x and its feet and faces left when it heads left', () => {
    expect(enemyPose(ALACRAN, walker(104), FAR)).toEqual({ look: 'walk0', frame: 0, x: 104, y: 160, flip: false });
    expect(enemyPose(ALACRAN, walker(104, -1), FAR)).toMatchObject({ x: 104, y: 160, flip: true });
    expect(enemyPose(ALACRAN, { ...walker(104), y: 170 }, FAR)!.y).toBe(170); // where it walked down a slope to
  });

  it('GDD-ENM-02 the Zopilote flaps a frame every 6 steps while it cruises', () => {
    expect([0, 5, 6, 12, 18, 24].map((age) => look(ZOPILOTE, flying({ age })))).toEqual(['flap0', 'flap0', 'flap1', 'flap2', 'flap3', 'flap0']);
    expect([0, 6, 12, 18].map((age) => enemyPose(ZOPILOTE, flying({ age }), FAR)!.frame)).toEqual([0, 1, 2, 3]);
    expect(enemyPose(ZOPILOTE, flying({ age: 0, y: 61.5 }, 130), FAR)).toMatchObject({ x: 130, y: 61.5 }); // its box's middle: its flight y
    expect(flip(ZOPILOTE, flying({}, 100, -1))).toBe(true);
    expect(flip(ZOPILOTE, flying({}, 100, 1))).toBe(false);
  });

  it('GDD-ENM-01 the Zopilote telegraph flashes red on steps 0 to 3 and not 4 to 7', () => {
    const looks = [0, 1, 2, 3, 4, 5, 6, 7, 8].map((age) => look(ZOPILOTE, flying({ phase: 'telegraph', age })));
    expect(looks).toEqual(['teleRed', 'teleRed', 'teleRed', 'teleRed', 'tele', 'tele', 'tele', 'tele', 'teleRed']);
    expect(enemyPose(ZOPILOTE, flying({ phase: 'telegraph', age: 0 }), FAR)!.frame).toBe(5);
    expect(enemyPose(ZOPILOTE, flying({ phase: 'telegraph', age: 4 }), FAR)!.frame).toBe(4);
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
    expect(enemyPose(ZOPILOTE, flying({ phase: 'dive', aimX: 110, aimY: 80 }), FAR)!.frame).toBe(6);
    expect(enemyPose(ZOPILOTE, flying({ phase: 'dive', aimX: 110, aimY: 55 }), FAR)!.frame).toBe(7);
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
    expect([0, 4].map((age) => enemyPose(ZOPILOTE, flying({ phase: 'return', age }), FAR)!.frame)).toEqual([8, 9]);
    expect(flip(ZOPILOTE, flying({ phase: 'return' }, 100, -1))).toBe(true);
  });

  it('GDD-ENM-02 the cactus buddy dozes facing right while Poncho is far, breathing every 45 steps', () => {
    const doze = (clock: number) => enemyPose(CACTUS, walker(184), { clock, poncho: { x: 1000, y: 184 } })!;
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
    expect(enemyPose(CACTUS, walker(184), near(64, 0))!.frame).toBe(2);
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
    expect([0, 4].map((c) => enemyPose(CACTUS, walker(184), near(0, 0, c))!.frame)).toEqual([3, 4]);
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
    expect(enemyPose(TLACUACHE, opossum({ phase: 'charge' }, 5), FAR)!.frame).toBe(7);
  });

  it('GDD-ENM-02 the Tlacuache playing dead twitches only from 90 steps on, every other 4 steps', () => {
    // It plays dead for 120 steps and twitches in the last 30: from age 90, on the blocks of 4 steps whose number is even.
    expect([0, 1, 88, 89].map(dead)).toEqual(['dead', 'dead', 'dead', 'dead']);
    expect([90, 91].map(dead)).toEqual(['deadTwitch', 'deadTwitch']);
    expect([92, 95].map(dead)).toEqual(['dead', 'dead']);
    expect([96, 99, 100, 119].map(dead)).toEqual(['deadTwitch', 'deadTwitch', 'dead', 'dead']);
    expect([10, 90].map((age) => enemyPose(TLACUACHE, opossum({ phase: 'dead', age }), FAR)!.frame)).toEqual([10, 11]);
  });

  it('GDD-ENM-03 World 2\'s kinds have no World 1 pose', () => {
    for (const kind of ['paloma', 'chapulin', 'trompo'] as const) expect(enemyPose({ x: 0, y: 0, kind }, walker(0), FAR), kind).toBeNull();
  });
});
