// Runs a shell command with a time limit that ends what it started (L-064). The command gets a process group of its own, and
// when the limit passes the whole group is killed: killing the shell alone leaves what it started running, at full CPU for a
// mutant that made a loop endless. A signal that ends this process (Ctrl-C, a kill) no longer reaches that group by itself,
// so while the command runs the group is killed on the signal too. A process that takes a group of its own, such as the
// dev server the playtests start, is in neither case stopped.
import { spawn } from 'node:child_process';

const SIGNALS = ['SIGINT', 'SIGTERM', 'SIGHUP'];

/**
 * Runs `command` in a shell. Resolves with `{ started, status, output, stopped }`: whether the command could be started at
 * all, its exit status (null when it was killed or never started), what it wrote to stdout and stderr together, and whether
 * the limit of `seconds` ended it.
 */
export function runLimited(command, { cwd, env, seconds }) {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(command, { cwd, env, shell: true, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
    } catch {
      resolve({ started: false, status: null, output: '', stopped: false });
      return;
    }
    let output = '';
    let stopped = false;
    // The negative id is the group: the shell and everything it started. It may be gone already.
    const killGroup = () => { try { process.kill(-child.pid, 'SIGKILL'); } catch { /* nothing left to stop */ } };
    const timer = setTimeout(() => { stopped = true; killGroup(); }, seconds * 1000);
    const onSignal = (signal) => {
      killGroup();
      end();
      // With the handlers off, the signal does what it would have done to this process.
      process.kill(process.pid, signal);
    };
    const end = () => {
      clearTimeout(timer);
      for (const signal of SIGNALS) process.off(signal, onSignal);
    };
    for (const signal of SIGNALS) process.on(signal, onSignal);
    child.stdout?.on('data', (chunk) => (output += chunk));
    child.stderr?.on('data', (chunk) => (output += chunk));
    child.on('error', () => { end(); resolve({ started: false, status: null, output, stopped: false }); });
    child.on('close', (status) => { end(); resolve({ started: true, status, output, stopped }); });
  });
}

/**
 * What a mutant's test run says about the mutant: 'not started' (the command could not be run), 'stopped' (the limit ended
 * it), 'no test' (the filter matched no test: Playwright exits 1 on "No tests found", Vitest on a missing file), 'caught'
 * (the test went red) or 'survived'. Only 'caught' counts as a kill (L-034: each mutant names the one test that must kill it).
 */
export function verdict(run) {
  if (!run.started) return 'not started';
  if (run.stopped) return 'stopped';
  // At the start of a line, as the two tools print it: a failing test that only quotes the words is a failing test.
  if (/^(Error: No tests found|No test files found)/m.test(run.output)) return 'no test';
  return run.status !== 0 ? 'caught' : 'survived';
}
