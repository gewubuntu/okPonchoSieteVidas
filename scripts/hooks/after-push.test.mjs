import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildContext } from './after-push.mjs';

const push = (stderr, extra = {}) => ({ tool_name: 'Bash', tool_input: { command: 'git push -u origin feature' }, tool_response: { stdout: '', stderr, ...extra } });

describe('L-043 after-push hook', () => {
  it('reminds of the draft PR and the re-review after a push that sent commits', () => {
    const text = buildContext(push('To https://github.com/o/r\n   1eddb6b..0ab0e17  feature -> feature\n'));
    expect(text).toContain('draft PR');
    expect(text).toContain('re-review');
    expect(text).toContain('L-043');
  });

  it('says nothing after a rejected, failed, interrupted or empty push', () => {
    expect(buildContext(push(' ! [rejected]        feature -> feature (fetch first)\nerror: failed to push some refs\n'))).toBeNull();
    expect(buildContext(push('fatal: unable to access the remote\n'))).toBeNull();
    expect(buildContext(push('', { interrupted: true }))).toBeNull();
    expect(buildContext(push('Everything up-to-date\n'))).toBeNull();
  });

  it('says nothing for other commands, other tools or bad input', () => {
    expect(buildContext({ tool_name: 'Bash', tool_input: { command: 'echo git push' }, tool_response: { stdout: '' } })).toBeNull();
    expect(buildContext({ tool_name: 'mcp__github__create_pull_request', tool_response: {} })).toBeNull();
    expect(buildContext(null)).toBeNull();
  });

  it('prints a PostToolUse additionalContext after a push and nothing for other commands', () => {
    const run = (input) =>
      spawnSync(process.execPath, [fileURLToPath(new URL('./after-push.mjs', import.meta.url))], { input: JSON.stringify(input), encoding: 'utf8' });
    const out = run(push('To https://github.com/o/r\n * [new branch]      feature -> feature\n'));
    expect(out.status).toBe(0);
    expect(JSON.parse(out.stdout).hookSpecificOutput).toMatchObject({ hookEventName: 'PostToolUse' });
    expect(run({ tool_name: 'Bash', tool_input: { command: 'ls' } }).stdout).toBe('');
  });
});
