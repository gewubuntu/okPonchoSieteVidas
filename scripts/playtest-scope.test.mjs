import { describe, expect, it } from 'vitest';
import { needsPlaytests } from './playtest-scope.mjs';

describe('playtest-scope (L-077)', () => {
  it('skips the playtests for documents alone', () => {
    expect(needsPlaytests(['docs/GDD.md', 'docs/BACKLOG.md', 'docs/LESSONS.md'])).toBe(false);
    expect(needsPlaytests(['CLAUDE.md', '.claude/skills/harness-feature/SKILL.md', 'docs/screenshots/world4/overview.png'])).toBe(false);
  });

  it('runs them as soon as one file is not a document', () => {
    for (const other of ['src/config/tuning.ts', 'e2e/cart.spec.ts', 'index.html', 'package-lock.json', 'assets/sprites/poncho/idle.png', 'playwright.config.ts', '.github/workflows/check.yml', 'scripts/check.mjs']) {
      expect(needsPlaytests(['docs/GDD.md', other]), other).toBe(true);
    }
  });

  it('does not take a path that only looks like a document', () => {
    expect(needsPlaytests(['src/docs/level.ts'])).toBe(true);
    expect(needsPlaytests(['assets/readme.mdx'])).toBe(true);
    expect(needsPlaytests(['src/md'])).toBe(true);
  });

  it('runs them when it cannot tell what changed', () => {
    expect(needsPlaytests([])).toBe(true);
  });
});
