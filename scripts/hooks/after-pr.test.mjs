import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildContext, findPullNumber } from './after-pr.mjs';

describe('after-pr hook', () => {
  it('finds the PR number from a URL in the tool response', () => {
    expect(findPullNumber({ id: '4927884279', url: 'https://github.com/o/r/pull/4' })).toBe(4);
    expect(findPullNumber('{"url":"https://github.com/o/r/pull/12"}')).toBe(12);
  });

  it('prefers the PR url over a PR linked in free text', () => {
    const response = { body: 'follows https://github.com/o/r/pull/2', url: 'https://github.com/o/r/pull/9' };
    expect(findPullNumber(response)).toBe(9);
  });

  it('reads an MCP content array whose text is JSON', () => {
    const response = [{ type: 'text', text: JSON.stringify({ id: '1', number: 9 }) }];
    expect(findPullNumber(response)).toBe(9);
    expect(findPullNumber([{ type: 'text', text: '{"url":"https://github.com/o/r/pull/11"}' }])).toBe(11);
  });

  it('ignores a number nested inside another object, and reads the pulls form of the URL', () => {
    expect(findPullNumber({ milestone: { number: 3 }, number: 9 })).toBe(9);
    expect(findPullNumber({ milestone: { number: 3, url: 'https://api.github.com/o/r/pull/2' }, url: 'https://api.github.com/repos/o/r/pulls/9' })).toBe(9);
    expect(findPullNumber([{ type: 'text', text: JSON.stringify({ milestone: { number: 3 }, number: 9 }) }])).toBe(9);
    expect(findPullNumber({ milestone: { number: 3 } })).toBeNull();
  });

  it('reads a response wrapped as { content: [{ type: text, text }] }', () => {
    const wrap = (o) => ({ content: [{ type: 'text', text: JSON.stringify(o) }] });
    expect(findPullNumber(wrap({ number: 9, milestone: { number: 3 } }))).toBe(9);
    expect(findPullNumber(wrap({ body: 'follows https://github.com/o/r/pull/2', number: 9 }))).toBe(9);
    expect(findPullNumber({ body: '{"number":5}', number: 9 })).toBe(9);
  });

  it('falls back to a number field, and to null when there is none', () => {
    expect(findPullNumber({ number: 7 })).toBe(7);
    expect(findPullNumber({})).toBeNull();
    expect(findPullNumber(undefined)).toBeNull();
  });

  it('asks for the pr-reviewer review after a pull request is created', () => {
    const text = buildContext({
      tool_name: 'mcp__github__create_pull_request',
      tool_response: { url: 'https://github.com/o/r/pull/5' },
    });
    expect(text).toContain('Pull request #5');
    expect(text).toContain('pr-reviewer');
    expect(text).toContain('has not run yet');
  });

  it('says nothing for other tools or bad input', () => {
    expect(buildContext({ tool_name: 'Bash' })).toBeNull();
    expect(buildContext({ tool_name: 'Bash', tool_input: { command: 'gh pr view 5' }, tool_response: { stdout: 'https://github.com/o/r/pull/5' } })).toBeNull();
    expect(buildContext({ tool_name: 'mcp__github__create_pull_request_with_copilot', tool_response: { url: 'https://github.com/o/r/pull/5' } })).toBeNull();
    expect(buildContext(null)).toBeNull();
  });

  it('also fires for a renamed GitHub server and for gh pr create, and names the fallback agent and L-043', () => {
    const renamed = buildContext({ tool_name: 'mcp__plugin_engineering_github__create_pull_request', tool_response: { url: 'https://github.com/o/r/pull/6' } });
    expect(renamed).toContain('Pull request #6');
    const gh = buildContext({ tool_name: 'Bash', tool_input: { command: 'gh pr create --fill' }, tool_response: { stdout: 'https://github.com/o/r/pull/8\n', stderr: '' } });
    expect(gh).toContain('Pull request #8');
    expect(gh).toContain('general-purpose agent');
    expect(gh).toContain('L-043');
  });

  it('prints a PostToolUse additionalContext for a created PR and nothing for other tools', () => {
    const run = (input) =>
      spawnSync(process.execPath, [fileURLToPath(new URL('./after-pr.mjs', import.meta.url))], { input: JSON.stringify(input), encoding: 'utf8' });
    const out = run({ tool_name: 'mcp__github__create_pull_request', tool_response: { url: 'https://github.com/o/r/pull/5' } });
    expect(out.status).toBe(0);
    expect(JSON.parse(out.stdout).hookSpecificOutput).toMatchObject({ hookEventName: 'PostToolUse' });
    expect(JSON.parse(out.stdout).hookSpecificOutput.additionalContext).toContain('#5');
    expect(run({ tool_name: 'Bash', tool_input: { command: 'ls' } }).stdout).toBe('');
  });
});
