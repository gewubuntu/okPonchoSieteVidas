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
  // At the start of a line, as the two tools print it (colour codes aside), in a run that reports no test run: a failing test that
  // only quotes the words is a failing test, and a test that prints them at the start of a line of its own output still ran.
  if (/^(Error: No tests found|No test files found)/m.test(run.output.replace(/\x1b\[[0-9;]*m/g, '')) && !((testsRun(run.output) ?? 0) > 0)) return 'no test';
  return run.status !== 0 ? 'caught' : 'survived';
}

/**
 * What a mutant's run says (`verdict`), with one answer more: 'ran more' for a red run that reports more than one test. A mutant
 * that renames the tests a filter matches, or builds more of them from its data, makes the filter match others than the one it
 * names, and a red among them is not that test's kill (L-026): the baseline, on the unmutated code, cannot see it.
 */
export function mutantVerdict(run) {
  const said = verdict(run);
  return said === 'caught' && (testsRun(run.output) ?? 0) > 1 ? 'ran more' : said;
}

/**
 * The tests a Vitest or Playwright run reports it ran, summed over every summary in `output`; null when it holds no summary of
 * either, as the gate's harness checks or a script's own output do not. Every summary counts, so one printed twice (two reporters,
 * a test whose own output holds summary lines) counts twice.
 */
export function testsRun(output) {
  const text = output.replace(/\x1b\[[0-9;]*m/g, '');
  let total = null;
  // Vitest: "Tests  1 failed | 4221 passed | 1 expected fail | 2 skipped (4224)". An expected fail (`it.fails`) ran. A skipped test
  // is one the filter left out or one that skipped itself, which the summary does not tell apart, so one that skips itself after
  // its checks (`ctx.skip()`) is counted as not run.
  for (const [, counts] of text.matchAll(/^\s*Tests\s+(.+)$/gm)) {
    total = (total ?? 0) + [...counts.matchAll(/(\d+) (?:passed|failed|expected fail)/g)].reduce((n, [, k]) => n + Number(k), 0);
  }
  // Playwright, each run on its own: "Running 2 tests using 2 workers", then one count to a line, as "  3 passed (2.1s)", "  1 failed",
  // "  1 flaky" or "  1 skipped". Its "Running" count is every test the filter matched in the projects run, skipped ones included,
  // so a test that skips itself after its checks counts as run, and so does a skipped test the filter matched beside the named one
  // (the filter must match the one test alone). A run with none passed, failed or flaky ran no test; any other ran the larger of
  // the two counts.
  for (const run of text.split(/^(?=Running \d+ tests? using)/m)) {
    // Text before a run's "Running" line is no run's: a Vitest failure's diff can hold a line such as "  2 passed (1.0s)".
    if (!run.startsWith('Running')) continue;
    let ran = null;
    for (const [, k, kind] of run.matchAll(/^\s+(\d+) (passed|failed|flaky|skipped|did not run|interrupted)\b/gm)) {
      ran = (ran ?? 0) + (kind === 'passed' || kind === 'failed' || kind === 'flaky' ? Number(k) : 0);
    }
    if (ran === null) continue;
    const started = Number(/^Running (\d+) tests? using/.exec(run)?.[1] ?? 0);
    total = (total ?? 0) + (ran === 0 ? 0 : Math.max(ran, started));
  }
  return total;
}

// The forms a mutant's test is written in (L-026, harness-feature step 7): one Vitest test of one file, under the default config or
// one of the three the gate runs too (a rule only every ability on, the glide or the sight sweep tests); one playtest in one
// project; the server's check, which rebuilds the bundle (server/main.ts is tested only there, L-010); or a check script with plain
// arguments. A name is in single quotes, which the shell reads as written; anything else of the shell (a redirect, a pipe, a second
// command, a substitution, another quote) is outside these forms, so no command written in them can hide its own run's summary or
// chain a second command. A test in the named file could still start a run of its own: the guard is for the command written by
// mistake.
const NAME = "'[^']*'";
const FORMS = [
  new RegExp(`^npx vitest run( -c vitest\\.(abilities|glide|sight)\\.config\\.ts)? [\\w./-]+\\.test\\.(ts|mjs) -t ${NAME}$`),
  new RegExp(`^npx playwright test [\\w./-]+\\.spec\\.ts -g ${NAME} --project [\\w-]+$`),
  /^npm run server:check$/,
  /^node scripts\/[\w-]+\.mjs( [\w./=:@-]+)*$/,
];

/** Why `command` cannot be a mutant's test as written, or null when it is one of the forms above. */
export function commandProblem(command) {
  return FORMS.some((form) => form.test(command))
    ? null
    : "is none of the forms a mutant's test is written in: npx vitest run [-c vitest.<abilities|glide|sight>.config.ts] <file> -t '<name>', npx playwright test <spec> -g '<name>' --project <project>, npm run server:check, or node scripts/<check>.mjs with plain arguments";
}

/**
 * Why `run`, the run of `command` on the unmutated code, cannot be a mutant's test, or null when it can (L-026): it must start, end
 * in time, pass, and run the one test that must kill the mutant, since a run of more counts a kill by any test in it. A run that
 * reports no tests at all is a check script, as `node scripts/server-log-check.mjs`, and is taken as it stands; the gate prints its
 * test runs' summaries, so it is refused. A runner's command is one of the forms `commandProblem` takes, which print the runner's
 * own summary, so a run of one shows as one.
 */
export function baselineProblem(run) {
  const said = verdict(run);
  if (said === 'not started' || said === 'stopped' || said === 'no test') return said;
  if (run.status !== 0) return 'fails on the unmutated code';
  const ran = testsRun(run.output);
  if (ran === null) return null;
  if (ran === 1) return null;
  if (ran === 0) return 'runs no test';
  // Playwright runs a test once in each project, so a name unique in its file runs twice unless the project is named; said only
  // when the run's lines name more than one project ("[desktop] › ..."), not for a filter that matches two tests in one.
  const projects = new Set([...run.output.replace(/\x1b\[[0-9;]*m/g, '').matchAll(/\[([^\]\n]+)\] › /g)].map(([, name]) => name));
  const hint = projects.size > 1 ? ' (Playwright runs each test once in each project: name one with --project)' : '';
  return `runs ${ran} tests, not the one that must kill it${hint}`;
}
