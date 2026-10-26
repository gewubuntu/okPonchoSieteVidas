import { describe, expect, it } from 'vitest';
import { collectVeladora, startWorld } from '../sim/lives';
import { startRun, type RunState } from '../sim/run';
import { veladoraId } from '../sim/veladora';
import { LEVEL_0_1, TIPS_0_1 } from '../levels/level0-1';
import { activeTip, highlightBox, initialDevice, NO_TIP, pulse, stepTipFade, tipsDone, tipText, type TipFade } from './tips';

const none = TIPS_0_1.map(() => false);
const fade = (from: TipFade, active: number | null, steps: number): TipFade => {
  let f = from;
  for (let i = 0; i < steps; i++) f = stepTipFade(f, active);
  return f;
};

describe('GDD-UI-05 which tip shows', () => {
  it('GDD-UI-05 a tip shows while the middle of Poncho is in its stretch', () => {
    // Tip 1 is columns 0 to 5 (x 0 to 96), tip 2 columns 6 to 13 (x 96 to 224), tip 3 from column 14.
    expect(activeTip(TIPS_0_1, 95.9, 'playing', none)).toBe(0);
    expect(activeTip(TIPS_0_1, 96, 'playing', none)).toBe(1);
    expect(activeTip(TIPS_0_1, 223.9, 'playing', none)).toBe(1);
    expect(activeTip(TIPS_0_1, 224, 'playing', none)).toBe(2);
    // The gap between tips 11 (to column 75) and 12 (from column 82) has none.
    expect(activeTip(TIPS_0_1, 76 * 16, 'playing', none)).toBeNull();
    expect(activeTip(TIPS_0_1, 82 * 16 - 0.1, 'playing', none)).toBeNull();
    expect(activeTip(TIPS_0_1, 82 * 16, 'playing', none)).toBe(11);
  });

  it('GDD-UI-05 no tip while not playing', () => {
    for (const phase of ['respawning', 'gameover', 'clear'] as const) expect(activeTip(TIPS_0_1, 50, phase, none), phase).toBeNull();
  });

  it('GDD-UI-05 no tip once its thing is done', () => {
    const done = TIPS_0_1.map((_, i) => i === 4);
    expect(activeTip(TIPS_0_1, 30 * 16, 'playing', done)).toBeNull();
    expect(activeTip(TIPS_0_1, 30 * 16, 'playing', none)).toBe(4);
    // Only that tip: its neighbours still show.
    expect(activeTip(TIPS_0_1, 22 * 16, 'playing', done)).toBe(3);
  });
});

describe('GDD-UI-05 the fade', () => {
  it('GDD-UI-05 a tip fades in over 12 steps and out over 12', () => {
    expect(stepTipFade(NO_TIP, 0)).toEqual({ index: 0, alpha: 1 / 12 });
    expect(fade(NO_TIP, 0, 11).alpha).toBeLessThan(1);
    const full = fade(NO_TIP, 0, 12);
    expect(full).toEqual({ index: 0, alpha: 1 });
    expect(fade(full, 0, 30).alpha).toBe(1);
    expect(fade(full, null, 11).alpha).toBeGreaterThan(0);
    expect(fade(full, null, 12)).toEqual({ index: 0, alpha: 0 });
    expect(fade(full, null, 30).alpha).toBe(0);
  });

  it('GDD-UI-05 the next tip replaces the old one at once', () => {
    expect(stepTipFade({ index: 0, alpha: 1 }, 1)).toEqual({ index: 1, alpha: 1 / 12 });
  });
});

describe('GDD-UI-05 the words and the highlight', () => {
  it('GDD-UI-05 the text names the device used last', () => {
    const jump = TIPS_0_1[1]!;
    expect(tipText(jump, 'keyboard')).toBe('Space to jump. Hold it to jump higher');
    expect(tipText(jump, 'touch')).toBe('Tap the jump button. Hold it to jump higher');
    expect(tipText(jump, 'pad')).toBe('Bottom button to jump. Hold it to jump higher');
    for (const d of ['keyboard', 'touch', 'pad'] as const) expect(tipText(TIPS_0_1[2]!, d)).toBe('Jump over the gaps');
  });

  it('GDD-UI-05 the first device is touch on a touch device and the keyboard otherwise', () => {
    expect(initialDevice(true)).toBe('touch');
    expect(initialDevice(false)).toBe('keyboard');
  });

  it('GDD-UI-05 the highlight pulses every 48 steps', () => {
    expect(pulse(0)).toBeCloseTo(0, 9);
    expect(pulse(24)).toBeCloseTo(1, 9);
    expect(pulse(48)).toBeCloseTo(0, 9);
    expect(pulse(12)).toBeCloseTo(0.5, 9);
    expect(pulse(36)).toBeCloseTo(0.5, 9);
    expect(pulse(72)).toBeCloseTo(1, 9);
  });

  it('GDD-UI-05 the highlight box is 2 px outside its tiles', () => {
    expect(highlightBox({ col: 11, row: 12, w: 2, h: 2 })).toEqual({ x: 174, y: 190, w: 36, h: 36 });
  });
});

describe('GDD-UI-05 a thing that is done', () => {
  const start = startRun(LEVEL_0_1);

  it('GDD-UI-05 a done tip stays done through a respawn and clears on the restart after the last life', () => {
    const killed: RunState = { ...start, enemies: start.enemies.map((e, i) => (i === 0 ? { ...e, alive: false } : e)) };
    const done = tipsDone(none, TIPS_0_1, start, killed, LEVEL_0_1);
    expect(done.map((d, i) => (d ? i : -1)).filter((i) => i >= 0)).toEqual([4]);
    // A respawn: the Alacrán is alive again, and the flag stays.
    const respawned: RunState = { ...start, phase: 'playing' };
    expect(tipsDone(done, TIPS_0_1, { ...start, phase: 'respawning' }, respawned, LEVEL_0_1)[4]).toBe(true);
    // Another thing done on a later step keeps the first.
    const opened: RunState = { ...killed, pinatasOpen: [true] };
    expect(tipsDone(done, TIPS_0_1, killed, opened, LEVEL_0_1).map((d, i) => (d ? i : -1)).filter((i) => i >= 0)).toEqual([4, 5]);
    // The restart after the last life: every flag goes.
    expect(tipsDone(done, TIPS_0_1, { ...start, phase: 'gameover' }, { ...start, phase: 'respawning' }, LEVEL_0_1)).toEqual(none);
    // The screen itself, before the press, keeps them.
    expect(tipsDone(done, TIPS_0_1, { ...start, phase: 'gameover' }, { ...start, phase: 'gameover' }, LEVEL_0_1)[4]).toBe(true);
  });

  it('GDD-UI-05 the piñata and veladora tips are done when the piñata is open and the veladora used', () => {
    expect(tipsDone(none, TIPS_0_1, start, { ...start, pinatasOpen: [true] }, LEVEL_0_1)[5]).toBe(true);
    const used = collectVeladora(startWorld(), veladoraId(LEVEL_0_1.veladora!));
    const done = tipsDone(none, TIPS_0_1, start, { ...start, lives: used }, LEVEL_0_1);
    expect(done[10]).toBe(true);
    expect(done.filter(Boolean)).toHaveLength(1);
    expect(tipsDone(none, TIPS_0_1, start, start, LEVEL_0_1)).toEqual(none);
  });
});
