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
    expect(buildContext(null)).toBeNull();
  });
});
