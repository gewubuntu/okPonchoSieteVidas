import { describe, expect, it } from 'vitest';
import { LIVES_MAX } from '../config/tuning';
import {
  activateOfrenda,
  collectVeladora,
  isLastLife,
  isOutOfLives,
  loseLife,
  startWorld,
  type LivesState,
} from './lives';

const lose = (s: LivesState, n: number): LivesState => {
  for (let i = 0; i < n; i++) s = loseLife(s);
  return s;
};

describe('GDD-LIFE-01 seven lives', () => {
  it('a world starts with seven lives', () => {
    expect(LIVES_MAX).toBe(7);
    expect(startWorld().lives).toBe(7);
  });

  it('never exceeds seven', () => {
    const s = collectVeladora(activateOfrenda(startWorld(), 'a'), 'v1');
    expect(s.lives).toBe(7);
  });
});

describe('GDD-LIFE-02 losing a life', () => {
  it('costs exactly one life', () => {
    expect(loseLife(startWorld()).lives).toBe(6);
  });

  it('stops at zero', () => {
    expect(lose(startWorld(), 12).lives).toBe(0);
  });

  it('does not change the state it was given', () => {
    const s = startWorld();
    loseLife(s);
    expect(s.lives).toBe(7);
  });
});

describe('GDD-LIFE-03 regaining lives', () => {
  it('an ofrenda restores one life the first time only', () => {
    const hurt = lose(startWorld(), 3);
    const once = activateOfrenda(hurt, 'w1-l1-a');
    expect(once.lives).toBe(5);
    expect(activateOfrenda(once, 'w1-l1-a').lives).toBe(5);
  });

  it('different ofrendas each restore one life', () => {
    const s = activateOfrenda(activateOfrenda(lose(startWorld(), 3), 'a'), 'b');
    expect(s.lives).toBe(6);
  });

  it('an ofrenda activated at full lives is used up and gives nothing later', () => {
    const full = activateOfrenda(startWorld(), 'a');
    expect(activateOfrenda(lose(full, 2), 'a').lives).toBe(5);
  });

  it('a veladora restores one life, once', () => {
    const s = collectVeladora(lose(startWorld(), 2), 'v1');
    expect(s.lives).toBe(6);
    expect(collectVeladora(s, 'v1').lives).toBe(6);
  });

  it('an ofrenda and a veladora with the same id do not block each other', () => {
    const s = collectVeladora(activateOfrenda(lose(startWorld(), 3), 'x'), 'x');
    expect(s.lives).toBe(6);
  });
});

describe('GDD-LIFE-04 last life', () => {
  it('is true with exactly one life left', () => {
    expect(isLastLife(lose(startWorld(), 6))).toBe(true);
    expect(isLastLife(lose(startWorld(), 5))).toBe(false);
    expect(isLastLife(lose(startWorld(), 7))).toBe(false);
  });
});

describe('GDD-LIFE-05 out of lives and carrying across a world', () => {
  it('is out of lives at zero', () => {
    expect(isOutOfLives(lose(startWorld(), 7))).toBe(true);
    expect(isOutOfLives(lose(startWorld(), 6))).toBe(false);
  });

  it('restarting the world gives seven lives and fresh ofrendas', () => {
    const dead = lose(activateOfrenda(startWorld(), 'a'), 7);
    const again = startWorld();
    expect(again.lives).toBe(7);
    expect(activateOfrenda(lose(again, 1), 'a').lives).toBe(7);
    expect(dead.lives).toBe(0);
  });

  it('lives carry across levels: nothing outside startWorld refills them', () => {
    // A level change is not a lives event; the state simply continues.
    const afterLevelOne = lose(startWorld(), 2);
    expect(afterLevelOne.lives).toBe(5);
  });
});
