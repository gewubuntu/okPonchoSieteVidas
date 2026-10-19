import { describe, expect, it } from 'vitest';
import { classify } from './pr-screenshots.mjs';

describe('pr-screenshots', () => {
  it('treats scenes, ui, index.html and art as visible', () => {
    const { visible } = classify(['src/scenes/PlayScene.ts', 'src/ui/livesLayout.ts', 'index.html', 'assets/sprites/poncho.png']);
    expect(visible).toHaveLength(4);
  });

  it('does not treat tests, sim code, docs or asset READMEs as visible', () => {
    const { visible } = classify([
      'src/ui/livesLayout.test.ts',
      'src/sim/movement.ts',
      'docs/GDD.md',
      'assets/characters/poncho/README.md',
      'e2e/shots/hud.spec.ts',
    ]);
    expect(visible).toEqual([]);
  });

  it('finds approved screenshots only under docs/screenshots', () => {
    const { shots } = classify(['docs/screenshots/lives-hud/hud-7-lives-phone.png', 'shots/hud.png', 'assets/a.png']);
    expect(shots).toEqual(['docs/screenshots/lives-hud/hud-7-lives-phone.png']);
  });
});
