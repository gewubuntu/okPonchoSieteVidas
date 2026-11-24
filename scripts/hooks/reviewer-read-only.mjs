#!/usr/bin/env node
// PreToolUse hook for Bash (see .claude/settings.json), the automated check for L-100: the pr-reviewer is read-only, and its
// tool list cannot scope `Bash`. It acts only on a call made inside that subagent (the input's `agent_type`), and denies
//   - a command that publishes or decides, from any folder: `git push`, a git command that makes a commit (`pull` among
//     them), `gh pr merge|close|review|ready|edit`, and through `gh api` a merge, an approval or a request for changes, and
//     any call with the method PATCH, PUT or DELETE (a close is one);
//   - a command that changes a working tree (`git checkout|switch|reset|restore|stash|clean|apply|rm|mv|bisect`, `gh pr checkout`)
//     and does not begin with `cd <dir> &&` for a folder outside the main checkout: every call starts in it. The `cd`
//     counts only while `&&` alone chains the command: after `;`, `||` or a new line a failed `cd` leaves the shell there;
//   - a run of a `scripts/mutate.mjs` that lies in the main checkout, whatever folder the command starts in: the runner
//     mutates the tree its own file is in.
// A command word is read at the start, after a separator, after `if`, `elif`, `while`, `until`, `then`, `do`, `else`, `time`
// or `!`, and as the text of `sh -c`. Quoted text is read as written, so a review's body goes in a here-document or a file, never in the command.
// It does not read what a command writes by other means (a redirection, `sed -i`, a script, a `cd` later in the command,
// git's `-C <dir>` or `--work-tree`), nor a flag between `gh pr` and its verb (`gh pr -R o/r merge`):
// that stays the agent's rule. It never fails: any problem prints nothing and exits 0.

import { relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { commandText, WORD } from './command-text.mjs';

/** The subagent the hook acts on. */
export const REVIEWER = 'pr-reviewer';

// A command word's place, with env assignments before it.
const AT = String.raw`(?:^\s*|[;&|\n({]\s*|(?:^|[\s;&|(])(?:if|elif|while|until|then|do|else|time|!)\s+|\b(?:ba|z|da|k)?sh\s+-\w*c\s+["'])(?:[A-Za-z_]\w*=(?:${WORD})?\s+)*`;
// git with its own options before the subcommand (`-C <dir>`, `-c k=v`, `--git-dir=...`), as in stale-main.mjs.
const git = (subs) => new RegExp(String.raw`${AT}git\s+(?:-[Cc]\s+${WORD}\s+|-${WORD}\s+)*(?:${subs})(?![\w-])`);
const PUBLISHES = git('push|pull|commit|cherry-pick|merge|revert|am|rebase');
const GH_PR = new RegExp(String.raw`${AT}gh\s+pr\s+(?:merge|close|review|ready|edit)\b`);
// One `gh api` call, up to the next separator or new line; what it does is read from its arguments.
const GH_API = new RegExp(String.raw`${AT}gh\s+api\b((?:${WORD}|[^\S\n])*)`, 'g');
const DECIDES = /\/pulls\/\d+\/merge\b|\/merges\b|\bevent=["']?(?:APPROVE|REQUEST_CHANGES)\b|(?:-X\s*|--method[\s=]+)["']?(?:PATCH|PUT|DELETE)\b/i;
const CHANGES_TREE = new RegExp(`${git('checkout|switch|reset|restore|stash|clean|apply|rm|mv|bisect').source}|${AT}gh\\s+pr\\s+checkout\\b`);
// A run of the mutant runner, with the path written before `scripts/mutate.mjs`.
const MUTANTS = /\bnode\s+(?:-\S+\s+)*["']?([^\s;&|<>()"']*\/)?scripts\/mutate\.mjs\b/g;
const LEADING_CD = new RegExp(String.raw`^\s*cd\s+(${WORD})\s*&&`);

/** Whether `dir` lies in the main checkout at `root`, or is the checkout itself. */
const inside = (root, dir) => !relative(root, dir).startsWith('..');

/**
 * The folder of a leading `cd <dir> &&`, its quotes taken off; undefined when the command does not begin with one, or goes on
 * after a `;`, a `||` or a new line, where a `cd` that failed leaves the rest in the main checkout.
 */
const leadingCd = (text) => (/;|\|\||\n/.test(text.trim()) ? undefined : LEADING_CD.exec(text)?.[1].replace(/^(["'])(.*)\1$/, '$2'));

/**
 * Whether the command begins with `cd <dir> &&` for a folder outside the main checkout at `root`. A folder is read as written,
 * so `$PWD`, `~/x`, `-` or a backtick is a relative name and lies inside; one that climbs out through a variable
 * (`/tmp/$X`, `../$X`) is taken at its word.
 */
function leavesMain(text, root) {
  const dir = leadingCd(text);
  return dir !== undefined && !inside(root, resolve(root, dir));
}

/** Whether the command runs a `scripts/mutate.mjs` that lies in the main checkout, its path read as written, as a folder is. */
function mutatesMain(text, root) {
  const cd = leadingCd(text);
  return [...text.matchAll(MUTANTS)].some(([, before = '']) => {
    return inside(root, resolve(root, cd ?? '.', before));
  });
}

/** The reason to deny a tool call of the pr-reviewer, or null when it is fine or is not its call. `root` is the main checkout. */
export function readOnlyProblem(input, root = '/') {
  if (input?.agent_type !== REVIEWER || input.tool_name !== 'Bash' || typeof input.tool_input?.command !== 'string') return null;
  // Here-document bodies no shell reads are text (commandText, shared with the other hooks).
  const text = commandText(input.tool_input.command);
  if (PUBLISHES.test(text) || GH_PR.test(text) || [...text.matchAll(GH_API)].some((call) => DECIDES.test(call[1]))) {
    return 'L-100: the pr-reviewer is read-only. It never commits, pulls, pushes, merges, closes, approves or asks for changes; it posts one review as a comment, and the human decides.';
  }
  if (CHANGES_TREE.test(text) && !leavesMain(text, root)) {
    return (
      'L-100: this command changes a working tree, and every Bash call of the pr-reviewer starts in the main checkout, which ' +
      'it never writes to. Begin the command with `cd <the temporary worktree> &&`, its path written out.'
    );
  }
  if (mutatesMain(text, root)) {
    return (
      'L-100: scripts/mutate.mjs mutates the tree its own file is in, and this one is the main checkout\'s, which the ' +
      'pr-reviewer never writes to. Run the temporary worktree\'s copy: `cd <worktree> && node scripts/mutate.mjs ...`.'
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
      // The hook's own path in .claude/settings.json is built from CLAUDE_PROJECT_DIR; without it every folder counts as the main checkout.
      const reason = readOnlyProblem(input, process.env.CLAUDE_PROJECT_DIR ?? '/');
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
