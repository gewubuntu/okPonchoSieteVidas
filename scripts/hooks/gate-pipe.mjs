#!/usr/bin/env node
// PreToolUse hook for Bash (see .claude/settings.json), the automated check for L-012.
// Denies a command that runs the gate and then commits when anything but `&&` joins them: a pipe (`| tail`) keeps only the
// last command's exit status, and `;`, `||` or a new line go on after a failure, so a failing gate could be committed.
// It never fails: any problem prints nothing and exits 0.

import { pathToFileURL } from 'node:url';

// A run of the gate, by path or by its npm alias; a mention in `echo`, `grep` or `sed` is not a run.
const GATE = /\bnode\s+(?:-\S+\s+)*(?:[^\s;&|<>()]*\/)?scripts\/check\.mjs\b|\bnpm\s+(?:-\S+\s+)*run(?:-script)?\s+(?:-\S+\s+)*check\b/g;
// `git commit`, also with options before it (`git -C <dir> commit`, `git -c key=value commit`).
const COMMIT = /\bgit(?:\s+-[cC]\s+[^\s-]\S*|\s+--?[^\s-][^\s=]*(?:=\S*)?)*\s+commit\b/g;
// A here-document's body is text, not commands, unless a shell reads it.
const HEREDOC = /<<-?\s*(['"]?)([A-Za-z_]\w*)\1([^\n]*)\n[\s\S]*?\n[ \t]*\2[ \t]*(?=\n|$)/g;

/** The reason to deny a shell command, or null when it is fine. */
export function gateProblem(command) {
  if (typeof command !== 'string') return null;
  const text = command.replace(HEREDOC, (m, _q, _tag, rest, at, all) =>
    // A shell named on the here-document's own line, before it (`bash <<EOF`) or after it (`cat <<EOF | bash`), runs the body.
    /\b(?:ba|z|da|k)?sh\b/.test(all.slice(all.lastIndexOf('\n', at) + 1, at) + rest) ? m : `<<${rest}`,
  );
  for (const commit of text.matchAll(COMMIT)) {
    const gate = [...text.slice(0, commit.index).matchAll(GATE)].at(-1);
    if (!gate) continue;
    // Redirections such as `2>&1` and `&> log` are fine, and so is a pipe after `set -o pipefail`; every other `|`, `;`,
    // `&` on its own or new line between them is not.
    let between = text.slice(gate.index, commit.index).replace(/\d?>&\d|&>>?|&&/g, '');
    if (/\bset\s+-[a-z]*o\s+pipefail\b/.test(text.slice(0, gate.index))) between = between.replace(/(?<!\|)\|(?!\|)/g, '');
    if (/[|;&\n]/.test(between)) {
      return (
        'L-012: this command commits after the gate with something other than `&&` between them, so a failing gate could be ' +
        'committed (a pipe keeps only the last exit status; `;`, `||` and new lines go on after a failure). Run ' +
        '`node scripts/check.mjs && git commit ...` with no pipe (or after `set -o pipefail`), and read the output from a separate run if needed.'
      );
    }
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
