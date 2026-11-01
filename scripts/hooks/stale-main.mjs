#!/usr/bin/env node
// PreToolUse hook for `git push` and for creating a pull request (see .claude/settings.json), the automated check for L-030
// and L-052: work published on an old main. Before the branch is published it fetches main and, when the branch does not
// contain it, asks the user first. It never fails: any problem (no network, no git) prints nothing and exits 0.

import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { commandText, WORD } from './command-text.mjs';

// The GitHub MCP tool that creates a pull request, under any server name.
const CREATE_TOOL = /^mcp__.*github.*__create_pull_request$/;

// `git push` at the start of a command, after env assignments and git's own options (`-C <dir>`, `-c k=v`, `--git-dir=...`),
// each option one shell word with its quoted parts.
const PUSH = new RegExp(String.raw`(?:^|[;&|\n(]\s*)(?:[A-Za-z_]\w*=(?:${WORD})?\s+)*git\s+(?:-[Cc]\s+${WORD}\s+|-${WORD}\s+)*push\b`);

/** Is this shell command a `git push` (also with options before `push`, or after `cd dir &&`)? A mention is not. */
export function isPush(command) {
  // Read as written but for here-document bodies (commandText): a quoted `; git push` counts too, as this hook asks when unsure.
  return PUSH.test(commandText(command));
}

/** Does this tool call publish the branch (a push, or a new PR)? */
export function publishes(input) {
  if (CREATE_TOOL.test(input?.tool_name ?? '')) return true;
  return input?.tool_name === 'Bash' && isPush(input.tool_input?.command);
}

/** Why to ask before publishing, or null when the branch already contains origin/main. */
export function staleReason(behind) {
  if (!(behind > 0)) return null;
  return (
    `L-052: origin/main has ${behind} commit(s) this branch does not contain. Merge it first, read its new GDD changelog ` +
    'lines for conventions this branch must follow, rerun the gate and the touched playtests, and retake the screenshots ' +
    'the merged change affects (harness-feature, Push and pull request). Approve only to publish without it.'
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let raw = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => (raw += chunk));
  process.stdin.on('end', () => {
    try {
      const input = JSON.parse(raw);
      if (publishes(input)) {
        const cwd = input.cwd || process.env.CLAUDE_PROJECT_DIR || process.cwd();
        spawnSync('git', ['fetch', '--quiet', 'origin', 'main'], { cwd, timeout: 15000 });
        const r = spawnSync('git', ['rev-list', '--count', 'HEAD..origin/main'], { cwd, encoding: 'utf8', timeout: 5000 });
        const reason = r.status === 0 ? staleReason(Number(r.stdout.trim())) : null;
        if (reason) {
          process.stdout.write(
            JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'ask', permissionDecisionReason: reason } }),
          );
        }
      }
    } catch {
      // Never break the session over a malformed input or a failed fetch.
    }
    process.exit(0);
  });
}
