#!/usr/bin/env node
// PreToolUse hook for merging a pull request (see .claude/settings.json), the automated check for L-043.
// Every merge Claude starts asks the user first, and the permission prompt says why: a PR is merged only after the
// pr-reviewer has posted its review on its current head, or when the user chooses to merge without it.
// It never fails: any problem prints nothing and exits 0.

import { pathToFileURL } from 'node:url';

// The GitHub MCP merge tools under any server name, or `gh pr merge` in a shell.
const MERGE_TOOL = /^mcp__.*github.*__(merge_pull_request|enable_pr_auto_merge)$/;

/** The reason shown in the permission prompt before a merge, or null when the call is not a merge. */
export function mergeQuestion(input) {
  // A here-document's body is text, not commands (a commit message may name `gh pr merge`).
  const raw = String(input?.tool_input?.command ?? '').replace(/<<-?\s*(['"]?)([A-Za-z_]\w*)\1([^\n]*)\n[\s\S]*?\n[ \t]*\2[ \t]*(?=\n|$)/g, '<<$3');
  // `gh pr merge`, or a REST merge through `gh api` (`.../pulls/<n>/merge`, which works where `gh pr` is refused), read in the
  // command as written: quoted text is not emptied, because quotes inside quotes, comments and operators in arguments made
  // that hide real merges. A quoted mention after a separator asks too; an extra question costs a click where a missed one
  // costs an unreviewed merge (L-008, L-043).
  const merge = /(?:^|[;&|\n(]\s*)(?:[A-Za-z_]\w*=\S*\s+)*gh\s+(?:pr\s+merge\b|api\b[^\n]*\/pulls\/\d+\/merge\b)/;
  const viaGh = input?.tool_name === 'Bash' && merge.test(raw);
  if (!input || !(MERGE_TOOL.test(input.tool_name ?? '') || viaGh)) return null;
  return (
    'L-043: a pull request is merged only after the pr-reviewer subagent has posted its review on its current head commit. ' +
    'Approve if that review is posted, or if you choose to merge without it.'
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let raw = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => (raw += chunk));
  process.stdin.on('end', () => {
    try {
      const reason = mergeQuestion(JSON.parse(raw));
      if (reason) {
        process.stdout.write(
          JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'ask', permissionDecisionReason: reason } }),
        );
      }
    } catch {
      // Never break the session over a malformed input.
    }
    process.exit(0);
  });
}
