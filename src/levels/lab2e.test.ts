import { describe, expect, it } from 'vitest';
import { LIVES_MAX, TILE } from '../config/tuning';
import { isStunned, kindOf } from '../sim/enemy';
import type { PlayerInput } from '../sim/movement';
import { startRun, stepRun, type RunState } from '../sim/run';
import { levelById, startLevel } from './index';
import { LAB_2E_ENEMIES, LAB_2E_ID, LAB_2E_LEVEL, LAB_2E_WALLS } from './lab2e';
import { validateLevel } from './validate';

const level = LAB_2E_LEVEL;
/** A press: down now and up on the step before. */
const press = (held: boolean, was: boolean): boolean => held && !was;

/**
 * A bot that beats lab-2e's three enemies in turn, left to right. It walks right, jumps each pen's wall, and in each pen: claws the Paloma
 * as it telegraphs (GDD-ENM-03: its 0.5 s freeze leaves time to swipe), claws the Chapulín while it crouches, and claws the Trompo as it
 * comes at him, then hops onto it while it lies stunned. It lets go of every button for at least a step before pressing it again (L-048).
 */
function bot(): (r: RunState) => PlayerInput {
  let clawWas = false;
  let jumpWas = false;
  let hopSteps = 0;
  return (r) => {
    const p = r.player;
    const i = r.enemies.findIndex((e) => e.alive);
    let move = 1;
    let jump = false;
    let claw = false;
    // A wall within 24 px ahead, on the floor: a full jump over it.
    const wallAhead = LAB_2E_WALLS.some((c) => c * TILE - (p.x + 6) >= 0 && c * TILE - (p.x + 6) < 24);
    if (i >= 0) {
      const e = r.enemies[i]!;
      const kind = kindOf(level.enemies[i]!);
      const gap = e.x - p.x;
      const sameSide = !LAB_2E_WALLS.some((c) => c * TILE > p.x && c * TILE < e.x);
      if (sameSide && kind === 'trompo') {
        if (isStunned(e)) {
          // A short hop onto it: jump held a few steps, moving towards it until over it.
          move = gap > 0 ? 1 : -1;
          if (p.grounded && hopSteps === 0) hopSteps = 1;
          jump = hopSteps > 0 && hopSteps <= 4;
          if (hopSteps > 0) hopSteps++;
        } else {
          hopSteps = 0;
          move = gap > 70 ? 1 : 0;
          claw = gap > 0 && gap <= 30 && e.dir < 0;
        }
      } else if (sameSide && gap <= 34) {
        move = 0;
        claw = kind !== 'chapulin' || e.hop?.phase === 'crouch';
      }
    }
    if (wallAhead && p.grounded) jump = true;
    if (!p.grounded && p.vy < 0 && jumpWas && hopSteps === 0) jump = true;
    const input: PlayerInput = { move, jumpHeld: jump, claw: press(claw, clawWas) };
    clawWas = input.claw ?? false;
    jumpWas = input.jumpHeld;
    return input;
  };
}

describe('GDD-ENM-03 lab-2e, World 2\'s enemy test level', () => {
  it('is a World 2 test level that passes the validator, with a Paloma, a Chapulín and a Trompo', () => {
    const entry = levelById(LAB_2E_ID)!;
    expect(entry).toMatchObject({ world: 2, test: true, level: LAB_2E_LEVEL });
    expect(validateLevel(entry)).toEqual([]);
    expect(LAB_2E_ENEMIES.map((e) => e.kind)).toEqual(['paloma', 'chapulin', 'trompo']);
  });

  it('GDD-UI-02 its address opens it, with seven lives, whatever the save', () => {
    const pick = startLevel('?level=lab-2e', { tutorialPlayed: true, levels: {}, worldLives: { '1': 3 }, worldAt: {} });
    expect(pick).toMatchObject({ entry: { id: LAB_2E_ID }, lives: LIVES_MAX });
  });

  it('a bot beats each enemy in turn without losing a life: claw the Paloma and the Chapulín, claw then stomp the Trompo', () => {
    const play = bot();
    let r = startRun(level);
    let stomped = false;
    for (let t = 0; t < 3000 && r.enemies.some((e) => e.alive); t++) {
      r = stepRun(r, play(r), level);
      stomped ||= r.stomped;
      expect(r.lives.lives, `step ${t}`).toBe(LIVES_MAX);
    }
    expect(r.enemies.map((e) => e.alive)).toEqual([false, false, false]);
    expect(stomped).toBe(true);
  });
});
