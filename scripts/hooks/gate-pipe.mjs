#!/usr/bin/env node
// PreToolUse hook for Bash (see .claude/settings.json), the automated check for L-012.
// Denies a command that runs the gate and then commits when anything but `&&` joins them: a pipe (`| tail`) keeps only the
// last command's exit status, and `;`, `||` or a new line go on after a failure, so a failing gate could be committed.
// It never fails: any problem prints nothing and exits 0.

import { pathToFileURL } from 'node:url';

/** The reason to deny a shell command, or null when it is fine. */
export function gateProblem(command) {
  if (typeof command !== 'string') return null;
  const gate = command.indexOf('scripts/check.mjs');
  if (gate === -1) return null;
  const commit = command.indexOf('git commit', gate);
  if (commit === -1) return null;
  // Redirections such as `2>&1` are fine; every other `|`, `;`, `&` on its own or new line between them is not.
  const between = command.slice(gate, commit).replace(/\d?>&\d/g, '').replace(/&&/g, '');
  if (!/[|;&\n]/.test(between)) return null;
  return (
    'L-012: this command commits after the gate with something other than `&&` between them, so a failing gate could be ' +
    'committed (a pipe keeps only the last exit status; `;`, `||` and new lines go on after a failure). Run ' +
    '`node scripts/check.mjs && git commit ...` with no pipe, and read the output from a separate run if needed.'
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let raw = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => (raw += chunk));
  process.stdin.on('end', () => {
    try {
      const input = JSON.parse(raw);
      const reason = input?.tool_name === 'Bash' ? gateProblem(input.tool_input?.command) : null;
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
