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
 * the limit of `seconds` ended it. `start` starts the process (`spawn` unless given, for the tests).
 */
export function runLimited(command, { cwd, env, seconds }, start = spawn) {
  return new Promise((resolve) => {
    let child;
    try {
      child = start(command, { cwd, env, shell: true, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
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
    // With no file handle left to give, the child has no pipes; its `error` follows.
    child.stdout?.on('data', (chunk) => (output += chunk));
    child.stderr?.on('data', (chunk) => (output += chunk));
    child.on('error', () => { end(); resolve({ started: false, status: null, output, stopped: false }); });
    child.on('close', (status) => { end(); resolve({ started: true, status, output, stopped }); });
  });
}

/**
 * What a mutant's test run says about the mutant: 'not started' (the command could not be run, or the shell could not run
 * or find it: its exit status 126 or 127), 'stopped' (the limit ended
 * it), 'no test' (the filter matched no test: Playwright exits 1 on "No tests found", Vitest on a missing file), 'caught'
 * (the test went red) or 'survived'. Only 'caught' counts as a kill (L-034: each mutant names the one test that must kill it).
 */
export function verdict(run) {
  if (!run.started || run.status === 126 || run.status === 127) return 'not started';
  if (run.stopped) return 'stopped';
  // At the start of a line, as the two tools print it (colour codes aside): a failing test that only quotes the words is a
  // failing test.
  if (/^(Error: No tests found|No test files found)/m.test(run.output.replace(/\x1b\[[0-9;]*m/g, ''))) return 'no test';
  return run.status !== 0 ? 'caught' : 'survived';
}

/**
 * The tests a Vitest or Playwright run reports it ran (passed, failed or flaky), summed over every summary in `output`; null when
 * it holds no summary of either, as the gate's harness checks or a script's own output do not.
 */
export function testsRun(output) {
  const text = output.replace(/\x1b\[[0-9;]*m/g, '');
  let total = null;
  // Vitest: "Tests  1 failed | 4221 passed | 2 skipped (4224)", skipped tests not run.
  for (const [, counts] of text.matchAll(/^\s*Tests\s+(.+)$/gm)) {
    total = (total ?? 0) + [...counts.matchAll(/(\d+) (?:passed|failed)/g)].reduce((n, [, k]) => n + Number(k), 0);
  }
  // Playwright: one count to a line, as "  3 passed (2.1s)", "  1 failed" or "  1 flaky".
  for (const [, k] of text.matchAll(/^\s+(\d+) (?:passed|failed|flaky)\b/gm)) total = (total ?? 0) + Number(k);
  return total;
}

/**
 * Why `run`, a mutant's test command run on the unmutated code, cannot be that mutant's test, or null when it can (L-026): it must
 * start, end in time, pass, and run the one test that must kill the mutant, since a run of more counts a kill by any test in it. A
 * run that reports no tests at all is a command of its own (the gate on a bad input, a check script) and is taken as it stands.
 */
export function baselineProblem(run) {
  const said = verdict(run);
  if (said === 'not started' || said === 'stopped' || said === 'no test') return said;
  if (run.status !== 0) return 'fails on the unmutated code';
  const ran = testsRun(run.output);
  if (ran === null || ran === 1) return null;
  return ran === 0 ? 'runs no test' : `runs ${ran} tests, not the one that must kill it`;
}
