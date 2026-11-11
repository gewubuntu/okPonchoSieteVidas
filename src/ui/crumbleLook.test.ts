import { describe, expect, it } from 'vitest';
import { crumbleLook } from './crumbleLook';

describe('GDD-WLD-05 a crumbling tile as drawn', () => {
  it('GDD-WLD-05 a crumbling tile\'s drawing: still at rest, shaking 1 px and flashing pale in its warning, not drawn once gone', () => {
    // At rest: in place, frame 0 (the rock ledge at rest, the placeholder's sand), drawn.
    expect(crumbleLook({ phase: 'idle', steps: 0 })).toEqual({ dx: 0, frame: 0, visible: true });
    // The warning counts its 30 steps down to 1: 1 px left and right in turn, 2 steps each way, and the pale flash (frame 1) for 4 steps
    // of every 8, written out step by step from 30 down to 1.
    const steps = Array.from({ length: 30 }, (_, i) => 30 - i);
    const looks = steps.map((s) => crumbleLook({ phase: 'warning', steps: s }));
    expect(looks.map((l) => l.dx)).toEqual([1, -1, -1, 1, 1, -1, -1, 1, 1, -1, -1, 1, 1, -1, -1, 1, 1, -1, -1, 1, 1, -1, -1, 1, 1, -1, -1, 1, 1, -1]);
    expect(looks.map((l) => l.frame)).toEqual([0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1]);
    expect(looks.every((l) => l.visible)).toBe(true);
    // Gone: not drawn.
    expect(crumbleLook({ phase: 'gone', steps: 0 }).visible).toBe(false);
  });
});
