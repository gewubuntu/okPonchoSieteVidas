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
  });

  it('says nothing for other tools or bad input', () => {
    expect(mergeQuestion({ tool_name: 'mcp__github__disable_pr_auto_merge' })).toBeNull();
    expect(mergeQuestion({ tool_name: 'mcp__github__merge_pull_request_extra' })).toBeNull();
    expect(mergeQuestion({ tool_name: 'Bash', tool_input: { command: 'gh pr view 62' } })).toBeNull();
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
