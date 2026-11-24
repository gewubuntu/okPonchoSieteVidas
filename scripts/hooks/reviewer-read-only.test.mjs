import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { readOnlyProblem } from './reviewer-read-only.mjs';

const ROOT = '/repo';
const by = (agent_type, command) => readOnlyProblem({ agent_type, tool_name: 'Bash', tool_input: { command } }, ROOT);
const reviewer = (command) => by('pr-reviewer', command);

describe('L-100 reviewer-read-only hook', () => {
  it('denies the reviewer a command that publishes or decides, from any folder', () => {
    for (const command of [
      'git push',
      'git push -u origin x',
      'cd /tmp/pr-5 && git push',
      'git -C /tmp/pr-5 push',
      'GIT_TRACE=1 git -c user.name=x commit -m y',
      'cd /tmp/pr-5 && git commit -am probe',
      'git fetch origin main; git merge FETCH_HEAD',
      'git cherry-pick abc',
      'git revert abc',
      'git am x.patch',
      'git rebase origin/main',
      'gh pr merge 5 --merge',
      'gh pr close 5',
      'gh pr review 5 --approve',
      'gh pr ready 5',
      'gh pr edit 5 --title x',
      'gh api -X PUT repos/o/r/pulls/5/merge',
      "bash <<'EOF'\ngit push\nEOF",
      'git \\\n  push',
    ]) expect(reviewer(command), command).toMatch(/L-100: the pr-reviewer is read-only/);
  });

  it('denies a command that changes a tree or runs mutants and does not first leave the main checkout', () => {
    for (const command of [
      'git checkout pr-5',
      'git switch -c x',
      'git reset --hard origin/main',
      'git restore src/a.ts',
      'git stash',
      'git clean -fd',
      'git apply x.patch',
      'node scripts/mutate.mjs m.json',
      'node /repo/scripts/mutate.mjs --restore',
      'ls && git checkout -- src/a.ts',
      'cd . && git checkout pr-5',
      'cd /repo && node scripts/mutate.mjs m.json',
      'cd "/repo" && git stash',
      'cd /repo/ && git reset --hard',
      'cd /tmp/pr-5; git checkout x',
    ]) expect(reviewer(command), command).toMatch(/L-100: this command changes a working tree or runs mutants/);
  });

  it('lets the same through once the command begins in another folder', () => {
    expect(reviewer('cd /tmp/pr-5 && git checkout -- src/a.ts')).toBeNull();
    expect(reviewer('cd "/tmp/pr 5" && node scripts/mutate.mjs m.json')).toBeNull();
    expect(reviewer("cd '/tmp/pr-5' && git stash && git stash pop")).toBeNull();
    expect(reviewer('  cd ../pr-5 && git reset --hard')).toBeNull();
  });

  it('lets through what reads, and a mention', () => {
    for (const command of [
      'git fetch origin main && git fetch origin pull/5/head && git worktree add --detach /tmp/pr-5 FETCH_HEAD',
      'git worktree remove --force /tmp/pr-5',
      'git diff origin/main...HEAD -- docs/GDD.md',
      'git log --oneline -5',
      'git merge-base origin/main HEAD',
      'git show HEAD:scripts/mutate.mjs',
      'git checkout-index --help',
      'cd /tmp/pr-5 && node scripts/check.mjs',
      'grep -rn "git push" docs',
      'echo git push',
      'cat scripts/mutate.mjs',
      'gh pr view 5',
      'gh api repos/o/r/pulls/5',
      "cat > /tmp/notes.md <<'EOF'\ngit push\ngh pr merge 5\nnode scripts/mutate.mjs\nEOF",
    ]) expect(reviewer(command), command).toBeNull();
  });

  it('acts on the reviewer alone, and on Bash alone', () => {
    expect(by(undefined, 'git push')).toBeNull();
    expect(by('implementer', 'node scripts/mutate.mjs m.json')).toBeNull();
    expect(by('pr-reviewer-2', 'git push')).toBeNull();
    expect(readOnlyProblem({ agent_type: 'pr-reviewer', tool_name: 'Read', tool_input: { command: 'git push' } }, ROOT)).toBeNull();
    expect(readOnlyProblem({ agent_type: 'pr-reviewer', tool_name: 'Bash' }, ROOT)).toBeNull();
    expect(readOnlyProblem(null, ROOT)).toBeNull();
  });

  it('answers deny as a hook, and nothing on bad input', () => {
    const run = (stdin) => spawnSync('node', [fileURLToPath(new URL('./reviewer-read-only.mjs', import.meta.url))], { input: stdin, encoding: 'utf8', env: { ...process.env, CLAUDE_PROJECT_DIR: ROOT } });
    const denied = run(JSON.stringify({ agent_type: 'pr-reviewer', tool_name: 'Bash', tool_input: { command: 'git push' } }));
    expect(denied.status).toBe(0);
    expect(JSON.parse(denied.stdout).hookSpecificOutput).toMatchObject({ hookEventName: 'PreToolUse', permissionDecision: 'deny' });
    const fromMain = run(JSON.stringify({ agent_type: 'pr-reviewer', tool_name: 'Bash', tool_input: { command: 'cd /repo && git stash' } }));
    expect(JSON.parse(fromMain.stdout).hookSpecificOutput.permissionDecisionReason).toMatch(/changes a working tree/);
    expect(run('not json')).toMatchObject({ status: 0, stdout: '' });
    expect(run(JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'git push' } })).stdout).toBe('');
  });
});
