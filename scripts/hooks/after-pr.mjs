#!/usr/bin/env node
// PostToolUse hook for mcp__github__create_pull_request (see .claude/settings.json).
// Reads the hook input from stdin and tells Claude, as context, that the new PR still needs its review.
// It never blocks and never fails: any problem prints nothing and exits 0.

import { pathToFileURL } from 'node:url';

/** Finds the pull request number in whatever shape the tool response has. Returns null if there is none. */
export function findPullNumber(toolResponse) {
  const text = typeof toolResponse === 'string' ? toolResponse : JSON.stringify(toolResponse ?? '');
  const m = /\/pull\/(\d+)/.exec(text) ?? /"number"\s*:\s*(\d+)/.exec(text);
  return m ? Number(m[1]) : null;
}

/** Builds the context text for a hook input, or null when the event is not a created pull request. */
export function buildContext(input) {
  if (!input || input.tool_name !== 'mcp__github__create_pull_request') return null;
  const n = findPullNumber(input.tool_response);
  const which = n === null ? 'A pull request' : `Pull request #${n}`;
  return (
    `${which} was just created. CLAUDE.md requires every new pull request to be reviewed by the pr-reviewer subagent ` +
    'before it is reported as ready, and that review has not run yet. The subagent is launched with the Agent tool ' +
    `(subagent_type pr-reviewer) and the PR number${n === null ? '' : ` ${n}`}. Its blocking findings are fixed with a push, ` +
    'and the review result is part of the report to the user.'
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let raw = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => (raw += chunk));
  process.stdin.on('end', () => {
    try {
      const context = buildContext(JSON.parse(raw));
      if (context) {
        process.stdout.write(
          JSON.stringify({ hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: context } }),
        );
      }
    } catch {
      // Never break the session over a reminder.
    }
    process.exit(0);
  });
}
