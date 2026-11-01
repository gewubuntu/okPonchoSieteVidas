import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { mergeQuestion } from './before-merge.mjs';

describe('L-043 before-merge hook', () => {
  it('asks before a merge by the GitHub tools, under any server name, or by gh', () => {
    expect(mergeQuestion({ tool_name: 'mcp__github__merge_pull_request' })).toMatch(/L-043/);
    expect(mergeQuestion({ tool_name: 'mcp__github__enable_pr_auto_merge' })).toMatch(/L-043/);
    expect(mergeQuestion({ tool_name: 'mcp__plugin_engineering_github__merge_pull_request' })).toMatch(/L-043/);
    expect(mergeQuestion({ tool_name: 'Bash', tool_input: { command: 'gh pr merge 62 --merge' } })).toMatch(/L-043/);
    expect(mergeQuestion({ tool_name: 'Bash', tool_input: { command: 'cd x && GH_REPO=o/r gh pr merge 62' } })).toMatch(/L-043/);
    expect(mergeQuestion({ tool_name: 'Bash', tool_input: { command: 'gh api -X PUT repos/o/r/pulls/3/merge -f merge_method=merge' } })).toMatch(/L-043/);
    expect(mergeQuestion({ tool_name: 'Bash', tool_input: { command: "gh api -X PUT 'repos/o/r/pulls/3/merge'" } })).toMatch(/L-043/);
    expect(mergeQuestion({ tool_name: 'Bash', tool_input: { command: 'gh api --method PUT "repos/o/r/pulls/3/merge"' } })).toMatch(/L-043/);
    expect(mergeQuestion({ tool_name: 'Bash', tool_input: { command: 'git log | tr -d \'"\'; gh pr merge 3 --subject "Merge PR 3"' } })).toMatch(/L-043/);
    expect(mergeQuestion({ tool_name: 'Bash', tool_input: { command: 'echo "it\'s"; gh pr merge 3; echo \'a b\'' } })).toMatch(/L-043/);
    expect(mergeQuestion({ tool_name: 'Bash', tool_input: { command: "gh api --jq '.merged|tostring' -X PUT repos/o/r/pulls/3/merge" } })).toMatch(/L-043/);
    expect(mergeQuestion({ tool_name: 'Bash', tool_input: { command: "gh api -X PUT -f commit_title='R&D' repos/o/r/pulls/3/merge" } })).toMatch(/L-043/);
    expect(mergeQuestion({ tool_name: 'Bash', tool_input: { command: "# merge once it's reviewed\ngh pr merge 3 --subject 'x y'" } })).toMatch(/L-043/);
    expect(mergeQuestion({ tool_name: 'Bash', tool_input: { command: "echo don\\'t; gh pr merge 3; echo 'x y'" } })).toMatch(/L-043/);
    expect(mergeQuestion({ tool_name: 'Bash', tool_input: { command: 'gh api -X PUT \\\n  repos/o/r/pulls/3/merge' } })).toMatch(/L-043/);
    expect(mergeQuestion({ tool_name: 'Bash', tool_input: { command: "bash <<'EOF'\ngh pr merge 3\nEOF" } })).toMatch(/L-043/);
    expect(mergeQuestion({ tool_name: 'Bash', tool_input: { command: 'GH_TOKEN="$(cat tok)" gh pr merge 3' } })).toMatch(/L-043/);
    expect(mergeQuestion({ tool_name: 'Bash', tool_input: { command: 'GH_DEBUG= gh pr merge 3' } })).toMatch(/L-043/);
    expect(mergeQuestion({ tool_name: 'Bash', tool_input: { command: "cat <<'EOF' | bash>log\ngh pr merge 3\nEOF" } })).toMatch(/L-043/);
    // When unsure it asks: a quoted mention after a separator reads as a merge (an extra question, never a missed one).
    expect(mergeQuestion({ tool_name: 'Bash', tool_input: { command: 'git commit -m "x; gh pr merge 62 later"' } })).toMatch(/L-043/);
  });

  it('says nothing for other tools or bad input', () => {
    expect(mergeQuestion({ tool_name: 'mcp__github__disable_pr_auto_merge' })).toBeNull();
    expect(mergeQuestion({ tool_name: 'mcp__github__merge_pull_request_extra' })).toBeNull();
    expect(mergeQuestion({ tool_name: 'Bash', tool_input: { command: 'gh pr view 62' } })).toBeNull();
    expect(mergeQuestion({ tool_name: 'Bash', tool_input: { command: 'gh api repos/o/r/pulls/3' } })).toBeNull();
    expect(mergeQuestion({ tool_name: 'Bash', tool_input: { command: 'echo gh pr merge' } })).toBeNull();
    expect(mergeQuestion({ tool_name: 'Bash', tool_input: { command: "cat > notes.md <<'EOF'\ngh pr merge 62\nEOF" } })).toBeNull();
    expect(mergeQuestion({ tool_name: 'Bash', tool_input: { command: 'grep -rn "gh pr merge" docs' } })).toBeNull();
    expect(mergeQuestion({ tool_name: 'Bash', tool_input: { command: "git commit -m \"$(cat <<'EOF'\nchore: the hook asks before gh pr merge\nEOF\n)\"" } })).toBeNull();
    expect(mergeQuestion({ tool_name: 'Bash' })).toBeNull();
    expect(mergeQuestion(null)).toBeNull();
  });

  it('prints a PreToolUse ask for a merge and nothing for other tools', () => {
    const run = (input) =>
      spawnSync(process.execPath, [fileURLToPath(new URL('./before-merge.mjs', import.meta.url))], { input: JSON.stringify(input), encoding: 'utf8' });
    const out = run({ tool_name: 'mcp__github__merge_pull_request', tool_input: { pullNumber: 62 } });
    expect(out.status).toBe(0);
    expect(JSON.parse(out.stdout).hookSpecificOutput).toMatchObject({ hookEventName: 'PreToolUse', permissionDecision: 'ask' });
    expect(run({ tool_name: 'Bash', tool_input: { command: 'ls' } }).stdout).toBe('');
  });
});
