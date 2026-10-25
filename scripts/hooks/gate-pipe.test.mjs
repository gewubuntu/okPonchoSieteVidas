import { describe, expect, it } from 'vitest';
import { gateProblem } from './gate-pipe.mjs';

describe('L-012 gate-pipe hook', () => {
  it('lets the gate and a commit joined by && through', () => {
    expect(gateProblem('node scripts/check.mjs && git commit -m "x"')).toBeNull();
    expect(gateProblem('node scripts/check.mjs 2>&1 && git add -A && git commit -m "a; b | c"')).toBeNull();
  });

  it('denies a pipe between the gate and the commit', () => {
    expect(gateProblem('node scripts/check.mjs | tail -1 && git commit -m x')).toMatch(/L-012/);
    expect(gateProblem('node scripts/check.mjs 2>&1 | tail -1 && git commit -m x')).toMatch(/L-012/);
  });

  it('denies ;, ||, & and a new line between them', () => {
    for (const join of ['; ', ' || ', ' & ', '\n']) expect(gateProblem(`node scripts/check.mjs${join}git commit -m x`)).toMatch(/L-012/);
  });

  it('ignores commands without both the gate and a commit after it', () => {
    expect(gateProblem('node scripts/check.mjs | tail -1')).toBeNull();
    expect(gateProblem('git commit -m x; node scripts/check.mjs | tail')).toBeNull();
    expect(gateProblem(undefined)).toBeNull();
  });
});
