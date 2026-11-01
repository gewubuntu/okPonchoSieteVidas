#!/usr/bin/env node
// PostToolUse hook for creating a pull request with the GitHub MCP tool (see .claude/settings.json); it also reads `gh pr create` output.
// Reads the hook input from stdin and tells Claude, as context, that the new PR still needs its review.
// It never blocks and never fails: any problem prints nothing and exits 0.

import { pathToFileURL } from 'node:url';

/**
 * Calls visit(key, value, depth) for every string and number in a value. `depth` is how many objects deep the value
 * sits, so the keys of the response's own top-level object are at depth 1. A string that holds JSON is opened too when
 * it is the whole value or a content block's `text` (how MCP results arrive); its object then counts as a new
 * response root, so its keys are at depth 1 whatever wrapper held it. Other strings, such as a PR body, stay text.
 */
function walk(value, visit, key = '', depth = 0) {
  if (typeof value === 'string') {
    visit(key, value, depth);
    if ((depth === 0 || key === 'text') && /^\s*[[{]/.test(value)) {
      try { walk(JSON.parse(value), visit, key, 0); } catch { /* not JSON, already visited */ }
    }
  } else if (typeof value === 'number') {
    visit(key, value, depth);
  } else if (Array.isArray(value)) {
    for (const item of value) walk(item, visit, key, depth);
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) walk(v, visit, k, depth + 1);
  }
}

/**
 * Finds the number of the created pull request in whatever shape the tool response has, or null.
 * Only the response's own top-level `html_url`, `url` and `number` count. A number or link nested inside another object
 * (a milestone, a linked PR) or in free text such as the PR body comes last, so it cannot win over the PR's own fields.
 */
export function findPullNumber(toolResponse) {
  const found = { html_url: null, url: null, number: null, text: null };
  walk(toolResponse, (key, value, depth) => {
    if (typeof value === 'number') {
      if (key === 'number' && depth === 1) found.number ??= value;
      return;
    }
    const m = /\/pulls?\/(\d+)/.exec(value);
    if (!m) return;
    if ((key === 'html_url' || key === 'url') && depth === 1) found[key] ??= Number(m[1]);
    else found.text ??= Number(m[1]);
  });
  return found.html_url ?? found.url ?? found.number ?? found.text;
}

// The GitHub MCP tool under any server name (a plugin's server is named differently), or `gh pr create` in a shell.
const CREATE_TOOL = /^mcp__.*github.*__create_pull_request$/;

/** Builds the context text for a hook input, or null when the event is not a created pull request. */
export function buildContext(input) {
  const viaGh = input?.tool_name === 'Bash' && /\bgh\s+pr\s+create\b/.test(input.tool_input?.command ?? '');
  if (!input || !(CREATE_TOOL.test(input.tool_name ?? '') || viaGh)) return null;
  const n = findPullNumber(input.tool_response);
  const which = n === null ? 'A pull request' : `Pull request #${n}`;
  return (
    `${which} was just created. CLAUDE.md requires every new pull request to be reviewed by the pr-reviewer subagent ` +
    'before it is reported as ready, and that review has not run yet. The subagent is launched with the Agent tool ' +
    `(subagent_type pr-reviewer) and the PR number${n === null ? '' : ` ${n}`}, or, if that type is not available, as a ` +
    'general-purpose agent told to follow .claude/agents/pr-reviewer.md exactly. Its blocking findings are fixed with a push, ' +
    'and the review result is part of the report to the user. The PR is not merged before the review is posted: if the user ' +
    'asks to merge first, say the review is still running and ask whether to wait (L-043).'
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
