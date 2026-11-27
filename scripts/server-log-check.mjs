// GDD-TEC-10 ("The HTTP API"): "A log that cannot be written stops the server with one line that names only the error's code, a file
// that fills up in the middle of a line included (that cut line is its last), and a server that is stopped writes every line first, a
// second signal changing nothing."
// Run by `npm run server:check` on the bundle it has just built (server/main.ts wires the rules in: guardLogs, server/boot.ts; its own
// byte-for-byte writes to a file; exitAfterLog). Each case below must hold, or the check fails:
//   - --check with its stdout a pipe whose reader is gone before the first line: exit 1 with exactly the one line, no stack trace;
//   - --check with its stdout read for five lines and then left, so its last line (its sixth) cannot be written: the same, so --check
//     never exits 0 before that line is out;
//   - --check with its stdout a file that fills up in the middle of its last line (a 1 KiB size limit, the file already holding the
//     rest): node's own stream for a file drops the count of a short write, so the line must come out as EFBIG, exit 1;
//   - --check that finds a problem (its site's origin set to the one its probe asks from as another): exit 1 with that one problem;
//   - the server whose log's reader goes away while it serves, then asked once: exit 1 with the one line;
//   - the server on a SQLite store, stopped by SIGTERM and again by SIGINT, each signal sent twice 100 ms apart while its log's reader
//     has stalled: every request's line still reaches the reader, and it exits 0 with nothing on stderr. Node's warning that SQLite
//     is experimental is turned off for that run.
// Each run's environment holds nothing of this one but PATH (and the port, and the store), so no other PONCHO_ variable changes the
// boot. Each runs in a process group of its own, and at its limit the group is killed and the case fails, also when a process it left
// behind still holds its pipes. Each run takes the entry it starts, so scripts/server-log-check.test.mjs can hand it entries that break
// each rule.
import { spawn, spawnSync } from 'node:child_process';
import { closeSync, mkdtempSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const EXPECTED = 'the log cannot be written (EPIPE)\n';
/** Long enough for a booting server on a busy machine; a server that never stops is a failure, not a wait. */
const LIMIT_MS = 15000;
/** PATH alone: the runs see nothing else of this environment. */
const PATH_ONLY = { PATH: process.env.PATH ?? '' };

/**
 * Starts `command args` in a process group of its own, stdin closed, stdout `stdout`, stderr read, and hands the child to `start`.
 * Resolves once it and every holder of its pipes are done, or at `limitMs`, when the whole group is killed and `timedOut` is set.
 */
function launch(command, args, { env, stdout = 'pipe', limitMs = LIMIT_MS }, start = () => undefined) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd: ROOT, env, stdio: ['ignore', stdout, 'pipe'], detached: true });
    let said = '';
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (part) => { said += part; });
    let ended = false;
    const end = (code, signal, timedOut) => {
      if (ended) return;
      ended = true;
      clearTimeout(timer);
      resolve({ code, signal, timedOut, said });
    };
    const timer = setTimeout(() => {
      try {
        process.kill(-child.pid, 'SIGKILL');
      } catch {
        // The group is gone already: only a process that left it still holds the pipes.
      }
      end(null, 'SIGKILL', true);
    }, limitMs);
    child.on('close', (code, signal) => { end(code, signal, false); });
    start(child);
  });
}
/** How a run ended, as a case reports it. */
const endOf = (r) => (r.timedOut ? `no end within ${LIMIT_MS / 1000} s or its limit` : `exit ${r.code ?? r.signal}`);

/** The problem --check finds when the site's origin is the one its probe asks the nonce route from as another. */
const FAILED = 'the nonce route does not refuse another origin\n';

/**
 * Runs `entry --check` with `env` added and stdout read for `lines` lines (0: none) and then left; resolves with what went wrong, or
 * null when it exits 1 having written exactly `expected` to stderr.
 */
async function checked(entry, lines, env, expected, limitMs) {
  const r = await launch(process.execPath, [entry, '--check'], { env: { ...PATH_ONLY, ...env }, limitMs }, (child) => {
    let seen = 0;
    if (lines === 0) child.stdout.destroy();
    else {
      child.stdout.setEncoding('utf8');
      child.stdout.on('data', (part) => {
        seen += part.split('\n').length - 1;
        if (seen >= lines) child.stdout.destroy();
      });
    }
  });
  return r.code === 1 && r.said === expected ? null : `${endOf(r)}, stderr ${JSON.stringify(r.said.slice(0, 400))}, expected exit 1 and ${JSON.stringify(expected)}`;
}

/** Runs `entry --check` with stdout read for `lines` lines (0: none) and then left; resolves with what went wrong, or null. */
export const run = (entry, lines, limitMs = LIMIT_MS) => checked(entry, lines, {}, EXPECTED, limitMs);
/** Runs `entry --check` so that its check fails, stdout read to its end; resolves with what went wrong, or null. */
export const failed = (entry) => checked(entry, Infinity, { PONCHO_SITE_ORIGIN: 'http://elsewhere.invalid' }, FAILED, LIMIT_MS);

/** The size limit the file run gets: 1 KiB, bash's one block. */
const FILE_LIMIT = 1024;

/**
 * Runs `entry --check` once to a file to learn what it writes, which must pass, then again with stdout a file that already holds
 * enough that the size limit falls in the middle of the last line; resolves with what went wrong, or null when it exits 1 with exactly
 * the EFBIG line.
 */
export async function filled(entry) {
  const dir = mkdtempSync(join(tmpdir(), 'poncho-log-check-'));
  try {
    const measured = join(dir, 'measured');
    const once = openSync(measured, 'w');
    const first = spawnSync(process.execPath, [entry, '--check'], { cwd: ROOT, env: PATH_ONLY, stdio: ['ignore', once, 'ignore'], timeout: LIMIT_MS });
    closeSync(once);
    if (first.status !== 0) return `with its log a file with room, exit ${first.status ?? first.signal}, expected 0`;
    const text = readFileSync(measured, 'latin1');
    const last = text.length - 1 - text.lastIndexOf('\n', text.length - 2);
    const log = join(dir, 'log');
    writeFileSync(log, '#'.repeat(Math.max(0, FILE_LIMIT - (text.length - Math.ceil(last / 2)))));
    const out = openSync(log, 'a');
    // bash's 'ulimit -f 1' is 1 KiB; SIGXFSZ is ignored, so the write past it fails with EFBIG instead of killing the process.
    const r = await launch('bash', ['-c', 'trap "" XFSZ; ulimit -f 1; exec "$0" "$@"', process.execPath, entry, '--check'], { env: PATH_ONLY, stdout: out });
    closeSync(out);
    const expected = 'the log cannot be written (EFBIG)\n';
    return r.code === 1 && r.said === expected ? null : `${endOf(r)}, stderr ${JSON.stringify(r.said.slice(0, 400))}, expected exit 1 and ${JSON.stringify(expected)}`;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** The port in the listening line of `out`, once it is there. */
const portIn = (out) => /"event":"listening","port":(\d+)/.exec(out)?.[1];

/**
 * Runs `entry` as the server, reads it up to its listening line, then leaves its log and asks it once; resolves with what went wrong,
 * or null when that request is answered and it then exits 1 having written exactly the EPIPE line to stderr.
 */
export async function served(entry, limitMs = LIMIT_MS) {
  let asked = Promise.resolve(0);
  const r = await launch(process.execPath, [entry], { env: { ...PATH_ONLY, PONCHO_SERVER_PORT: '0' }, limitMs }, (child) => {
    let out = '';
    child.stdout.setEncoding('utf8');
    // No data comes once the reader is gone, so the port is acted on once (L-025: no check of its own).
    child.stdout.on('data', (part) => {
      out += part;
      const port = portIn(out);
      if (port === undefined) return;
      child.stdout.destroy();
      asked = fetch(`http://127.0.0.1:${port}/api/v1/config`).then((response) => response.status, () => 0);
    });
  });
  const status = await asked;
  if (status !== 200) return `${endOf(r)}, its request ${status === 0 ? 'never answered' : `answered ${status}`}`;
  return r.code === 1 && r.said === EXPECTED ? null : `${endOf(r)}, stderr ${JSON.stringify(r.said.slice(0, 400))}, expected exit 1 and ${JSON.stringify(EXPECTED)}`;
}

/** More request lines than an OS pipe holds (64 KiB, at about 55 bytes a line), so some wait in the server when it is stopped. */
export const REQUESTS = 2000;
/** The line each request to the config leaves. */
export const CONFIG_LINE = '{"method":"GET","route":"/api/v1/config","status":200}';

/**
 * Runs `entry` as the server on a SQLite store in a folder of its own, stalls its log's reader, sends REQUESTS requests, sends
 * `signal` twice and reads on; resolves with what went wrong, or null.
 */
export async function stopped(entry, signal = 'SIGTERM') {
  const dir = mkdtempSync(join(tmpdir(), 'poncho-log-check-'));
  let out = '';
  try {
    const env = { ...PATH_ONLY, PONCHO_SERVER_PORT: '0', PONCHO_STORE: join(dir, 'store.db') };
    const r = await launch(process.execPath, ['--disable-warning=ExperimentalWarning', entry], { env, limitMs: LIMIT_MS * 2 }, (child) => {
      let asked = false;
      child.stdout.setEncoding('utf8');
      child.stdout.on('data', async (part) => {
        out += part;
        const port = portIn(out);
        if (port === undefined || asked) return;
        asked = true;
        child.stdout.pause();
        const base = `http://127.0.0.1:${port}/api/v1/config`;
        for (let i = 0; i < REQUESTS; i += 8) await Promise.all(Array.from({ length: 8 }, () => fetch(base).then((response) => response.arrayBuffer())));
        child.kill(signal);
        setTimeout(() => { child.kill(signal); }, 100);
        setTimeout(() => { child.stdout.resume(); }, 300);
      });
    });
    const lines = out.split('\n').filter((line) => line.startsWith(CONFIG_LINE)).length;
    return r.code === 0 && r.said === '' && lines === REQUESTS ? null : `${endOf(r)}, ${lines} of ${REQUESTS} request lines read, stderr ${JSON.stringify(r.said.slice(0, 400))}`;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Every case on `entry`, each reported on a line of its own through `print`; gives the exit code, 1 if any case failed. */
export async function main(entry, print = { ok: console.log, fail: console.error }) {
  const cases = [
    ['a log that cannot be written stops the server with one line: its log has no reader at all', () => run(entry, 0)],
    ['a log that cannot be written stops the server with one line: its log\'s reader leaves after five lines', () => run(entry, 5)],
    ['a log on a file that fills up in the middle of a line stops the server with one line', () => filled(entry)],
    ['a check that finds a problem exits 1 with that one line', () => failed(entry)],
    ['a server whose log\'s reader leaves while it serves stops with one line', () => served(entry)],
    ['a server stopped twice by SIGTERM while its log\'s reader stalls writes every line first, and exits 0', () => stopped(entry, 'SIGTERM')],
    ['a server stopped twice by SIGINT while its log\'s reader stalls writes every line first, and exits 0', () => stopped(entry, 'SIGINT')],
  ];
  let code = 0;
  for (const [what, check] of cases) {
    const wrong = await check();
    if (wrong === null) print.ok(`ok    ${what}`);
    else {
      print.fail(`FAIL  ${what}: ${wrong}`);
      code = 1;
    }
  }
  return code;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = await main(join(ROOT, 'server', 'dist', 'main.js'));
