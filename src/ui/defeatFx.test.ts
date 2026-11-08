import { describe, expect, it } from 'vitest';
import { freshEnemies, type Enemy, type EnemyState } from '../sim/enemy';
import { defeatLook, stepDefeats, type DefeatFx } from './defeatFx';

// One of each kind. The Alacran's box is 14 x 10 px on its feet, the Zopilote's 16 x 10 px on its flight y, the Tlacuache's 16 x 10 px.
const LEVEL: { enemies: readonly Enemy[] } = {
  enemies: [
    { x: 100, y: 160 },
    { x: 200, y: 80, kind: 'zopilote' },
    { x: 184, y: 192, kind: 'cactus' },
    { x: 440, y: 96, kind: 'tlacuache' },
    { x: 40, y: 224, kind: 'paloma' },
    { x: 60, y: 224, kind: 'chapulin' },
    { x: 80, y: 224, kind: 'trompo' },
  ],
};
const ALIVE = freshEnemies(LEVEL.enemies);
type After = { enemies: readonly EnemyState[]; stomped: boolean; phase: 'playing' | 'respawning' };
/** The enemies with those at `defeated` defeated, the Alacrán (0) facing left. */
const without = (from: readonly EnemyState[], ...defeated: number[]): readonly EnemyState[] => from.map((e, i) => ({ ...e, dir: i === 0 ? -1 : e.dir, alive: e.alive && !defeated.includes(i) }));
const after = (enemies: readonly EnemyState[], stomped = false): After => ({ enemies, stomped, phase: 'playing' });
/** `n` more steps with nothing defeated. */
function age(fx: readonly DefeatFx[], enemies: readonly EnemyState[], n: number): readonly DefeatFx[] {
  let out = fx;
  for (let i = 0; i < n; i++) out = stepDefeats(out, { enemies }, after(enemies), LEVEL);
  return out;
}
/** The effect of the enemy `i` defeated alone, by a stomp (`squashed`) or by the claw (`swiped`). */
const squashed = (i: number): DefeatFx => stepDefeats([], { enemies: ALIVE }, after(without(ALIVE, i), true), LEVEL)[0]!;
const swiped = (i: number): DefeatFx => stepDefeats([], { enemies: ALIVE }, after(without(ALIVE, i)), LEVEL)[0]!;
const stompedAlacran = (): readonly DefeatFx[] => stepDefeats([], { enemies: ALIVE }, after(without(ALIVE, 0), true), LEVEL);

describe('GDD-ENM-02 the defeat poof', () => {
  it('GDD-ENM-02 a defeat adds one effect where the enemy was', () => {
    expect(stompedAlacran()).toEqual([{ kind: 'alacran', x: 100, y: 155, feet: 160, flip: true, stomped: true, age: 0 }]);
    const knocked = stepDefeats([], { enemies: ALIVE }, after(without(ALIVE, 3)), LEVEL);
    expect(knocked).toEqual([{ kind: 'tlacuache', x: 440, y: 91, feet: 96, flip: false, stomped: false, age: 0 }]);
  });

  it('GDD-ENM-02 a defeat is added once, when it goes from alive to defeated', () => {
    const dead = without(ALIVE, 0);
    const fx = stepDefeats(stompedAlacran(), { enemies: dead }, after(dead), LEVEL); // a step later it is still defeated
    expect(fx).toHaveLength(1);
    expect(fx[0]!.age).toBe(1);
    expect(stepDefeats([], { enemies: ALIVE }, after(ALIVE, true), LEVEL)).toEqual([]); // a stomp that defeated nothing (a Tlacuache playing dead)
  });

  it('GDD-CMB-01 a stomp squashes it and the claw or a fireball knocks it', () => {
    expect(defeatLook(stompedAlacran()[0]!)).toEqual({ sheet: 'alacran', look: 'squash', frame: 4, x: 100, y: 160, flip: true });
    const clawed = stepDefeats([], { enemies: ALIVE }, after(without(ALIVE, 0)), LEVEL);
    expect(clawed[0]!.stomped).toBe(false);
    expect(defeatLook(clawed[0]!)).toEqual({ sheet: 'alacran', look: 'hit', frame: 5, x: 100, y: 160, flip: true });
    const tlacuache = stepDefeats([], { enemies: ALIVE }, after(without(ALIVE, 3), true), LEVEL);
    expect(defeatLook(tlacuache[0]!)).toMatchObject({ sheet: 'tlacuache', look: 'squash', frame: 12 });
  });

  it('GDD-CMB-01 a Zopilote is never squashed, even in the step of a stomp', () => {
    // A stomp on the Alacrán and the claw on the Zopilote in one step: only the Alacrán is squashed.
    const fx = stepDefeats([], { enemies: ALIVE }, after(without(ALIVE, 0, 1), true), LEVEL);
    expect(fx.map((e) => [e.kind, e.stomped])).toEqual([['alacran', true], ['zopilote', false]]);
    expect(fx[1]).toMatchObject({ x: 200, y: 80, feet: 85 });
    expect(defeatLook(fx[1]!)).toEqual({ sheet: 'zopilote', look: 'hit', frame: 10, x: 200, y: 80, flip: false }); // its box's middle
  });

  it('GDD-ENM-02 an effect ages a step at a time and is gone after 24 steps', () => {
    const dead = without(ALIVE, 0);
    const fx = stompedAlacran();
    expect(age(fx, dead, 23).map((e) => e.age)).toEqual([23]);
    expect(age(fx, dead, 24)).toEqual([]);
  });

  it('GDD-ENM-02 the frames: squash or hit for 8 steps, then the poof a frame every 4 steps', () => {
    const [stomp] = stompedAlacran();
    const at = (a: number, e = stomp!) => defeatLook({ ...e, age: a });
    expect([0, 7].map((a) => at(a).look)).toEqual(['squash', 'squash']);
    expect([8, 11, 12, 16, 20, 23].map((a) => at(a).look)).toEqual(['poof0', 'poof0', 'poof1', 'poof2', 'poof3', 'poof3']);
    expect([8, 12, 16, 20].map((a) => at(a).frame)).toEqual([0, 1, 2, 3]);
    expect(at(8)).toEqual({ sheet: 'poof', look: 'poof0', frame: 0, x: 100, y: 155, flip: false }); // on its box's middle
    expect(at(23).sheet).toBe('poof');
    // The hit frame rises 6 px over its 8 steps, from its feet.
    const knocked = { ...stomp!, stomped: false };
    expect([0, 4, 7].map((a) => at(a, knocked).y)).toEqual([160, 157, 160 - 5.25]);
    expect([0, 7].map((a) => at(a, knocked).look)).toEqual(['hit', 'hit']);
    expect([0, 7].map((a) => at(a).y)).toEqual([160, 160]); // the squash stays on the ground
  });

  it('GDD-ENM-02 the cactus buddy adds no effect', () => {
    expect(stepDefeats([], { enemies: ALIVE }, after(without(ALIVE, 2), true), LEVEL)).toEqual([]);
  });

  it('GDD-ENM-03 a stomped Paloma, Chapulín or Trompo leaves its squash frame, then the poof', () => {
    // Their boxes (14 x 12, 12 x 10 and 14 x 14 px) stand on their feet at y = 224; the sheets' squash frames are 11, 7 and 6.
    const paloma = squashed(4), chapulin = squashed(5), trompo = squashed(6);
    expect(paloma).toEqual({ kind: 'paloma', x: 40, y: 218, feet: 224, flip: false, stomped: true, age: 0 });
    expect(chapulin).toEqual({ kind: 'chapulin', x: 60, y: 219, feet: 224, flip: false, stomped: true, age: 0 });
    expect(trompo).toEqual({ kind: 'trompo', x: 80, y: 217, feet: 224, flip: false, stomped: true, age: 0 });
    expect(defeatLook(paloma)).toEqual({ sheet: 'paloma', look: 'squash', frame: 11, x: 40, y: 224, flip: false });
    expect(defeatLook(chapulin)).toEqual({ sheet: 'chapulin', look: 'squash', frame: 7, x: 60, y: 224, flip: false });
    expect(defeatLook(trompo)).toEqual({ sheet: 'trompo', look: 'squash', frame: 6, x: 80, y: 224, flip: false });
    for (const e of [paloma, chapulin, trompo]) {
      expect(defeatLook({ ...e, age: 7 }).look, e.kind).toBe('squash');
      expect(defeatLook({ ...e, age: 8 }), e.kind).toMatchObject({ sheet: 'poof', look: 'poof0', x: e.x, y: e.y });
    }
  });

  it('GDD-ENM-03 a Paloma or a Chapulín knocked by the claw shows its hit frame rising 6 px', () => {
    const paloma = swiped(4), chapulin = swiped(5);
    expect(paloma.stomped).toBe(false);
    expect(defeatLook(paloma)).toEqual({ sheet: 'paloma', look: 'hit', frame: 12, x: 40, y: 224, flip: false });
    expect(defeatLook(chapulin)).toEqual({ sheet: 'chapulin', look: 'hit', frame: 8, x: 60, y: 224, flip: false });
    expect([0, 4, 7].map((a) => defeatLook({ ...paloma, age: a }).y)).toEqual([224, 221, 224 - 5.25]);
    expect([0, 4, 7].map((a) => defeatLook({ ...chapulin, age: a }).y)).toEqual([224, 221, 224 - 5.25]);
  });

  it('GDD-ENM-03 a Trompo is only ever stomped, so one that is not shows its squash frame anyway', () => {
    // It cannot happen in play: a stunned Trompo is defeated by a stomp, and a spinning one by nothing.
    const trompo = stepDefeats([], { enemies: ALIVE }, after(without(ALIVE, 6)), LEVEL)[0]!;
    expect(trompo.stomped).toBe(false);
    expect(defeatLook(trompo)).toEqual({ sheet: 'trompo', look: 'squash', frame: 6, x: 80, y: 224, flip: false });
    expect(defeatLook({ ...trompo, age: 7 }).y).toBe(224); // it does not rise
  });

  it('GDD-LIFE-02 a life lost empties the list', () => {
    const fx = stompedAlacran();
    const dead = without(ALIVE, 0);
    expect(stepDefeats(fx, { enemies: dead }, { ...after(dead), phase: 'respawning' }, LEVEL)).toEqual([]);
    // The enemies back at their start, alive, as after the respawn: a new list with the defeated one alive again.
    expect(stepDefeats(fx, { enemies: dead }, after(freshEnemies(LEVEL.enemies)), LEVEL)).toEqual([]);
  });
});
