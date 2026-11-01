#!/usr/bin/env node
// PostToolUse hook for `git push` (see .claude/settings.json), the automated reminder for L-043: a review covers only the
// head commit it saw, so commits pushed after it need a re-review before the PR is reported ready or merged, and a pushed
// branch with no open PR gets a draft PR (CLAUDE.md). It never blocks and never fails: any problem prints nothing and exits 0.

import { pathToFileURL } from 'node:url';
import { isPush } from './stale-main.mjs';

/** Builds the context text after a shell command, or null when it was not a push that sent commits. */
export function buildContext(input) {
  if (input?.tool_name !== 'Bash' || !isPush(input.tool_input?.command)) return null;
  const r = input.tool_response ?? {};
  const out = typeof r === 'string' ? r : `${r.stdout ?? ''}\n${r.stderr ?? ''}`;
  // A rejected push, local or remote, always ends with "error: failed to push", so that line covers it (L-025).
  if (r.interrupted || /^fatal:|^error: failed to push|Everything up-to-date/m.test(out)) return null;
  return (
    'The branch was just pushed. Under CLAUDE.md (Pull requests): a branch with no open PR gets a draft PR now, and a PR ' +
    'that already has a pr-reviewer review gets a re-review of the new commits (the pr-reviewer subagent with the PR number), ' +
    'because a review covers only the head commit it saw (L-043). The PR is not reported ready or merged before that review.'
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
