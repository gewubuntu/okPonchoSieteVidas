import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { readOnlyProblem } from './reviewer-read-only.mjs';

const ROOT = '/repo';
const by = (agent_type, command) => readOnlyProblem({ agent_type, tool_name: 'Bash', tool_input: { command } }, ROOT);
const reviewer = (command) => by('pr-reviewer', command);
const READ_ONLY = /L-100: the pr-reviewer is read-only/;
const TREE = /L-100: this command changes a working tree/;
const MUTANTS = /L-100: scripts\/mutate\.mjs mutates the tree its own file is in/;

describe('L-100 reviewer-read-only hook', () => {
  it('denies the reviewer a git command that publishes or commits, from any folder', () => {
    for (const command of [
      'git push',
      ' git push',
      '\tgit commit -m x',
      'git push -u origin x',
      'cd /tmp/pr-5 && git push',
      'git -C /tmp/pr-5 push',
      'git --no-pager push',
      'GIT_TRACE=1 git -c user.name=x commit -m y',
      'cd /tmp/pr-5 && git commit -am probe',
      'git fetch origin main; git merge FETCH_HEAD',
      'git pull origin main',
      'cd /tmp/pr-5 && git pull --rebase',
      'git cherry-pick abc',
      'git revert abc',
      'git am x.patch',
      'git rebase origin/main',
      "bash <<'EOF'\ngit push\nEOF",
      'git \\\n  push',
    ]) expect(reviewer(command), command).toMatch(READ_ONLY);
  });

  it('reads a command word after a pipe, in a substitution, a group, a condition, `time`, `!` and `sh -c`', () => {
    for (const command of [
      'git log | git push',
      'echo $(git push)',
      '{ git push; }',
      'if true; then git push; fi',
      'for r in a b; do git push $r; done',
      'true || { false; } else git push',
      'time git push',
      '! git push',
      '(time git push)',
      'true;! git push',
      'if git pull origin main; then echo ok; fi',
      'true; elif git push; then :; fi',
      'while git push; do sleep 1; done',
      'until git push; do sleep 1; done',
      "bash -c 'git push'",
      "zsh -c 'git push'",
      "dash -c 'git push'",
      "ksh -c 'git push'",
      'sh -ec "git push"',
      // A mention after such a word is denied too: the hook cannot tell it from a call, and the reviewer words it otherwise.
      'echo then git push',
    ]) expect(reviewer(command), command).toMatch(READ_ONLY);
  });

  it('denies a decision made with gh: its pr commands, and through the API a merge, an approval, a request for changes and a close', () => {
    for (const command of [
      'gh pr merge 5 --merge',
      ' gh pr merge 5',
      ' gh api -X PUT repos/o/r/pulls/5/merge',
      'gh api repos/o/r/pulls/5; gh api -X PUT repos/o/r/pulls/5/merge',
      'gh api -Xpatch repos/o/r/pulls/5',
      'gh api -X "PATCH" repos/o/r/pulls/5',
      'gh api repos/o/r/merges -f base=main -f head=x',
      'gh pr close 5',
      'gh pr review 5 --approve',
      'gh pr ready 5',
      'gh pr edit 5 --title x',
      'gh api -X PUT repos/o/r/pulls/5/merge',
      'gh api repos/o/r/pulls/5/merge -f merge_method=merge',
      'gh api -X POST repos/o/r/pulls/5/reviews -f event=APPROVE',
      "gh api repos/o/r/pulls/5/reviews -f event='REQUEST_CHANGES' -f body=x",
      'gh api -X PATCH repos/o/r/pulls/5 -f state=closed',
      'gh api --method PATCH repos/o/r/pulls/5 -f state=closed',
      'gh api --method=DELETE repos/o/r/git/refs/heads/x',
      'gh api -XPUT repos/o/r/contents/a.txt',
    ]) expect(reviewer(command), command).toMatch(READ_ONLY);
  });

  it('denies a command that changes a tree and does not first leave the main checkout', () => {
    for (const command of [
      'git checkout pr-5',
      ' git reset --hard',
      'git bisect start HEAD origin/main',
      'if git checkout pr-5; then :; fi',
      // The leading `cd` counts only while `&&` alone chains the command: a failed `cd` leaves what follows a `;` or `||` here.
      'cd /tmp/gone && ls; git checkout -- .',
      'cd /tmp/gone && ls || git checkout -- .',
      'cd /tmp/gone && ls\ngit stash',
      'git --git-dir=/x/.git checkout y',
      'git switch -c x',
      'git reset --hard origin/main',
      'git restore src/a.ts',
      'git stash',
      'git clean -fd',
      'git apply x.patch',
      'git diff origin/main...HEAD | git apply',
      'git rm src/a.ts',
      'git mv a b',
      'gh pr checkout 5',
      'ls && git checkout -- src/a.ts',
      'cd /tmp/pr-5; git checkout x',
    ]) expect(reviewer(command), command).toMatch(TREE);
  });

  it('takes a folder inside the main checkout, or one not written out, for not leaving it', () => {
    for (const command of [
      'cd . && git checkout pr-5',
      'cd "/repo" && git stash',
      "cd '/repo' && git stash",
      'cd /repo/ && git reset --hard',
      'cd docs && git reset --hard',
      'cd /repo/scripts && git stash',
      'cd src/../docs && git checkout -- a.md',
      'cd "$PWD" && git stash',
      'cd ~/repo && git stash',
      'cd - && git stash',
      'cd `pwd` && git stash',
    ]) expect(reviewer(command), command).toMatch(TREE);
  });

  it('lets a tree change through once the command begins in a folder outside the main checkout', () => {
    expect(reviewer('cd /tmp/pr-5 && git checkout -- src/a.ts')).toBeNull();
    expect(reviewer("cd '/tmp/pr-5' && git stash && git stash pop")).toBeNull();
    expect(reviewer('  cd ../pr-5 && git reset --hard')).toBeNull();
    expect(reviewer('cd /repo-5 && git rm a.ts')).toBeNull();
    expect(reviewer('cd /tmp/pr-5&& git stash')).toBeNull();
    expect(reviewer('cd "/tmp/pr 5" && gh pr checkout 5')).toBeNull();
  });

  it('denies a run of the main checkout\'s mutant runner, whatever folder the command starts in', () => {
    for (const command of [
      'node scripts/mutate.mjs m.json',
      'node --no-warnings scripts/mutate.mjs m.json',
      'node ./scripts/mutate.mjs --suggest',
      'node /repo/scripts/mutate.mjs --restore',
      'cd /tmp/pr-5 && node /repo/scripts/mutate.mjs m.json',
      'cd /tmp/pr-5 && node "/repo/scripts/mutate.mjs" m.json',
      'cd /repo && node scripts/mutate.mjs m.json',
      'cd docs && node ../scripts/mutate.mjs m.json',
      'cd /tmp/pr-5 && node ../../repo/scripts/mutate.mjs m.json',
      'cd "$W" && node scripts/mutate.mjs m.json',
      'node $W/scripts/mutate.mjs m.json',
      'cd /tmp/pr-5 && node scripts/check.mjs; node /repo/scripts/mutate.mjs m.json',
      'node /tmp/pr-5/scripts/mutate.mjs m.json; node scripts/mutate.mjs m.json',
      'cd /tmp/gone && npm ci; node scripts/mutate.mjs m.json',
    ]) expect(reviewer(command), command).toMatch(MUTANTS);
  });

  it('lets a run of a worktree\'s own mutant runner through', () => {
    expect(reviewer('cd /tmp/pr-5 && node scripts/mutate.mjs m.json')).toBeNull();
    expect(reviewer('cd "/tmp/pr 5" && node scripts/mutate.mjs m.json')).toBeNull();
    expect(reviewer('node /tmp/pr-5/scripts/mutate.mjs m.json')).toBeNull();
    expect(reviewer('cd ../pr-5 && node ./scripts/mutate.mjs --suggest')).toBeNull();
  });

  it('lets through what reads or comments, and a mention', () => {
    for (const command of [
      'git fetch origin main && git fetch origin pull/5/head && git worktree add --detach /tmp/pr-5 FETCH_HEAD',
      'git worktree remove --force /tmp/pr-5',
      'git diff origin/main...HEAD -- docs/GDD.md',
      'git log --oneline -5',
      'git merge-base origin/main HEAD',
      'git show HEAD:scripts/mutate.mjs',
      'git checkout-index --help',
      'git mergetool --tool-help',
      'gh api repos/o/r/pulls/5/comments; echo -X PUT',
      'gh api repos/o/r/pulls/5/comments\necho -X PUT',
      'git rm-cached-like --help',
      'cd /tmp/pr-5 && node scripts/check.mjs',
      'grep -rn "git push" docs',
      'grep -c "git push" docs/HARNESS.md',
      'echo git push',
      'cat scripts/mutate.mjs',
      'gh pr view 5',
      'gh pr checks 5',
      'gh api repos/o/r/pulls/5',
      'gh api -X POST repos/o/r/pulls/5/reviews -f event=COMMENT -f body=fine',
      "gh api repos/o/r/pulls/5/reviews --input - <<'EOF'\n{\"event\":\"COMMENT\",\"body\":\"Do not chain\\ngit push after the gate; event=APPROVE is not this\"}\nEOF",
      "cat > /tmp/notes.md <<'EOF'\ngit push\ngh pr merge 5\nnode scripts/mutate.mjs\nEOF",
    ]) expect(reviewer(command), command).toBeNull();
  });

  it('acts on the reviewer alone, and on Bash alone', () => {
    expect(by(undefined, 'git push')).toBeNull();
    expect(by('implementer', 'node scripts/mutate.mjs m.json')).toBeNull();
    expect(by('general-purpose', 'git stash')).toBeNull();
    expect(by('pr-reviewer-2', 'git push')).toBeNull();
    expect(readOnlyProblem({ agent_type: 'pr-reviewer', tool_name: 'Read', tool_input: { command: 'git push' } }, ROOT)).toBeNull();
    expect(readOnlyProblem({ agent_type: 'pr-reviewer', tool_name: 'Bash' }, ROOT)).toBeNull();
    expect(readOnlyProblem({ agent_type: 'pr-reviewer', tool_name: 'Bash', tool_input: {} }, ROOT)).toBeNull();
    expect(readOnlyProblem(null, ROOT)).toBeNull();
  });

  it('answers deny as a hook, with the main checkout from CLAUDE_PROJECT_DIR, and nothing on bad input', () => {
    const run = (stdin, env = { CLAUDE_PROJECT_DIR: ROOT }) => {
      const { CLAUDE_PROJECT_DIR: _unset, ...rest } = process.env;
      return spawnSync('node', [fileURLToPath(new URL('./reviewer-read-only.mjs', import.meta.url))], { input: stdin, encoding: 'utf8', env: { ...rest, ...env } });
    };
    const call = (command) => JSON.stringify({ agent_type: 'pr-reviewer', tool_name: 'Bash', cwd: '/elsewhere', tool_input: { command } });
    const denied = run(call('git push'));
    expect(denied.status).toBe(0);
    expect(JSON.parse(denied.stdout).hookSpecificOutput).toMatchObject({ hookEventName: 'PreToolUse', permissionDecision: 'deny' });
    expect(JSON.parse(run(call('cd /repo && git stash')).stdout).hookSpecificOutput.permissionDecisionReason).toMatch(TREE);
    expect(run(call('cd /tmp/pr-5 && git stash')).stdout).toBe('');
    // With no CLAUDE_PROJECT_DIR every folder counts as the main checkout: the hook denies, it does not guess.
    expect(JSON.parse(run(call('cd /tmp/pr-5 && git stash'), {}).stdout).hookSpecificOutput.permissionDecisionReason).toMatch(TREE);
    expect(run('not json')).toMatchObject({ status: 0, stdout: '' });
    expect(run(JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'git push' } })).stdout).toBe('');
  });
});
