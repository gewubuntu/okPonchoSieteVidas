#!/usr/bin/env node
// PostToolUse hook for mcp__github__create_pull_request (see .claude/settings.json).
// Reads the hook input from stdin and tells Claude, as context, that the new PR still needs its review.
// It never blocks and never fails: any problem prints nothing and exits 0.

import { pathToFileURL } from 'node:url';

/** Calls visit(key, value) for every key and string or number in a value. Strings that hold JSON are opened too. */
function walk(value, visit, key = '') {
  if (typeof value === 'string') {
    visit(key, value);
    if (/^\s*[[{]/.test(value)) {
      try { walk(JSON.parse(value), visit, key); } catch { /* not JSON, the plain string was already visited */ }
    }
  } else if (typeof value === 'number') {
    visit(key, value);
  } else if (Array.isArray(value)) {
    for (const item of value) walk(item, visit, key);
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) walk(v, visit, k);
  }
}

/**
 * Finds the number of the created pull request in whatever shape the tool response has, or null.
 * The PR's own URL fields win over a number that appears in free text, because a PR body may link other PRs.
 */
export function findPullNumber(toolResponse) {
  const found = { html_url: null, url: null, number: null, text: null };
  walk(toolResponse, (key, value) => {
    if (typeof value === 'number' && key === 'number') found.number ??= value;
    if (typeof value !== 'string') return;
    const m = /\/pull\/(\d+)/.exec(value);
    if (!m) return;
    if (key === 'html_url' || key === 'url') found[key] ??= Number(m[1]);
    else found.text ??= Number(m[1]);
  });
  return found.html_url ?? found.url ?? found.number ?? found.text;
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
