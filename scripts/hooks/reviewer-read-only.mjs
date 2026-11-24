#!/usr/bin/env node
// PreToolUse hook for Bash (see .claude/settings.json), the automated check for L-100: the pr-reviewer is read-only, and its
// tool list cannot scope `Bash`. It acts only on a call made inside that subagent (the input's `agent_type`), and denies
//   - a command that publishes or decides: `git push`, a git command that makes a commit, `gh pr merge|close|review|ready|edit`,
//     a merge through `gh api`;
//   - a command that changes a working tree (`git checkout|switch|reset|restore|stash|clean|apply`) or runs mutants
//     (`scripts/mutate.mjs`) and does not begin with `cd <its worktree> &&`: every call starts in the main checkout.
// It does not read what a command writes by other means (a redirection, `sed -i`, a script): that stays the agent's rule.
// It never fails: any problem prints nothing and exits 0.

import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { commandText, WORD } from './command-text.mjs';

/** The subagent the hook acts on. */
export const REVIEWER = 'pr-reviewer';

// A command word's place: the start, or after a separator, with env assignments before it.
const AT = String.raw`(?:^|[;&|\n(]\s*)(?:[A-Za-z_]\w*=(?:${WORD})?\s+)*`;
// git with its own options before the subcommand (`-C <dir>`, `-c k=v`, `--git-dir=...`), as in stale-main.mjs.
const git = (subs) => new RegExp(String.raw`${AT}git\s+(?:-[Cc]\s+${WORD}\s+|-${WORD}\s+)*(?:${subs})(?![\w-])`);
const PUBLISHES = git('push|commit|cherry-pick|merge|revert|am|rebase');
const GH = new RegExp(String.raw`${AT}gh\s+(?:pr\s+(?:merge|close|review|ready|edit)\b|api\b[^\n]*\/pulls\/\d+\/merge\b)`);
const CHANGES_TREE = git('checkout|switch|reset|restore|stash|clean|apply');
const MUTANTS = /\bnode\s+(?:-\S+\s+)*(?:[^\s;&|<>()]*\/)?scripts\/mutate\.mjs\b/;
const LEADING_CD = new RegExp(String.raw`^\s*cd\s+(${WORD})\s*&&`);

/** Whether the command begins with `cd <dir> &&` for a folder other than the main checkout at `root`. */
function leavesMain(text, root) {
  const dir = LEADING_CD.exec(text)?.[1].replace(/^(["'])(.*)\1$/, '$2');
  return dir !== undefined && resolve(root, dir) !== resolve(root);
}

/** The reason to deny a tool call of the pr-reviewer, or null when it is fine or is not its call. `root` is the main checkout. */
export function readOnlyProblem(input, root = '/') {
  if (input?.agent_type !== REVIEWER || input.tool_name !== 'Bash' || typeof input.tool_input?.command !== 'string') return null;
  // Here-document bodies no shell reads are text (commandText, shared with the other hooks).
  const text = commandText(input.tool_input.command);
  if (PUBLISHES.test(text) || GH.test(text)) {
    return 'L-100: the pr-reviewer is read-only. It never commits, pushes, merges, closes or approves; it posts one review with the GitHub tools, and the human decides.';
  }
  if ((CHANGES_TREE.test(text) || MUTANTS.test(text)) && !leavesMain(text, root)) {
    return (
      'L-100: this command changes a working tree or runs mutants, and every Bash call of the pr-reviewer starts in the main ' +
      'checkout, which it never writes to. Begin the command with `cd <the temporary worktree> &&`.'
    );
  }
  return null;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let raw = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => (raw += chunk));
  process.stdin.on('end', () => {
    try {
      const input = JSON.parse(raw);
      const reason = readOnlyProblem(input, process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd());
      if (reason) {
        process.stdout.write(
          JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason } }),
        );
      }
    } catch {
      // Never break the session over a malformed input.
    }
    process.exit(0);
  });
}
