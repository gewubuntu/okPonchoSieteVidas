import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
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

  it('denies the npm alias and git options before commit', () => {
    expect(gateProblem('npm run check | tail -1 && git commit -m x')).toMatch(/L-012/);
    expect(gateProblem('npm run -s check; git commit -m x')).toMatch(/L-012/);
    expect(gateProblem('npm --silent run check | tail; git commit -m x')).toMatch(/L-012/);
    expect(gateProblem('node scripts/check.mjs | tail -1; git -C /repo commit -m x')).toMatch(/L-012/);
    expect(gateProblem('node ./scripts/check.mjs | tail -1; git -c user.name=x commit -m x')).toMatch(/L-012/);
  });

  it('ignores a path that is only mentioned, a here-document body, &> and a pipe after set -o pipefail', () => {
    expect(gateProblem('echo scripts/check.mjs; echo git commit-dryrun-probe')).toBeNull();
    expect(gateProblem("cat > p.mjs <<'EOF'\nconst c = 'node scripts/check.mjs | tail; git commit';\nEOF\nnode p.mjs")).toBeNull();
    expect(gateProblem("bash <<'EOF'\nnode scripts/check.mjs | tail; git commit -m x\nEOF")).toMatch(/L-012/);
    expect(gateProblem("cat <<'EOF' | bash\nnode scripts/check.mjs | tail; git commit -m x\nEOF")).toMatch(/L-012/);
    expect(gateProblem('node scripts/check.mjs &> /tmp/gate.log && git commit -m x')).toBeNull();
    expect(gateProblem('set -o pipefail; node scripts/check.mjs | tail -1 && git commit -m x')).toBeNull();
    expect(gateProblem('set -o pipefail; node scripts/check.mjs | tail -1; git commit -m x')).toMatch(/L-012/);
  });

  it('judges each commit by the last gate run before it', () => {
    expect(gateProblem('node scripts/check.mjs | tail -1; node scripts/check.mjs && git commit -m x')).toBeNull();
    expect(gateProblem('node scripts/check.mjs && git commit -m a; node scripts/check.mjs | tail; git commit -m b')).toMatch(/L-012/);
    expect(gateProblem('git commit -m a; npm run check | tail -1; git commit -m b')).toMatch(/L-012/);
  });

  it('answers at once for a long run of git options (no regex backtracking)', () => {
    expect(gateProblem('node scripts/check.mjs | git ' + '-c -c '.repeat(40) + 'x')).toBeNull();
    expect(gateProblem('node scripts/check.mjs | git ' + '--a=b -c '.repeat(40) + 'x')).toBeNull();
  });

  it('prints a PreToolUse deny for a bad command and nothing for a good one', () => {
    const run = (command) =>
      spawnSync(process.execPath, [fileURLToPath(new URL('./gate-pipe.mjs', import.meta.url))], {
        input: JSON.stringify({ tool_name: 'Bash', tool_input: { command } }),
        encoding: 'utf8',
      });
    const bad = run('node scripts/check.mjs | tail -1; git commit -m x');
    expect(bad.status).toBe(0);
    expect(JSON.parse(bad.stdout).hookSpecificOutput).toMatchObject({ hookEventName: 'PreToolUse', permissionDecision: 'deny' });
    expect(run('node scripts/check.mjs && git commit -m x').stdout).toBe('');
  });
});
