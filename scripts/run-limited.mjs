// Runs a shell command with a time limit that ends everything it started (L-064). The command gets a process group of its
// own, and when the limit passes the whole group is killed: killing the shell alone leaves what it started running, at full
// CPU for a mutant that made a loop endless.
import { spawn } from 'node:child_process';

/**
 * Runs `command` in a shell. Resolves with `{ status, output, stopped }`: the exit status (null when it was killed), what
 * it wrote to stdout and stderr together, and whether the limit of `seconds` ended it.
 */
export function runLimited(command, { cwd, env, seconds }) {
  return new Promise((resolve) => {
    const child = spawn(command, { cwd, env, shell: true, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    let stopped = false;
    child.stdout.on('data', (chunk) => (output += chunk));
    child.stderr.on('data', (chunk) => (output += chunk));
    const timer = setTimeout(() => {
      stopped = true;
      // The negative id is the group: the shell and everything it started. It may be gone already.
      try { process.kill(-child.pid, 'SIGKILL'); } catch { /* nothing left to stop */ }
    }, seconds * 1000);
    child.on('error', () => { clearTimeout(timer); resolve({ status: null, output, stopped }); });
    child.on('close', (status) => { clearTimeout(timer); resolve({ status, output, stopped }); });
  });
}
