// GDD-TEC-10 ("The HTTP API"): "A log that cannot be written stops the server with one line that names only the error's code, a file
// that fills up in the middle of a line included (that cut line is its last), and a server that is stopped writes every line first, a
// second signal changing nothing."
// Run by `npm run server:check` on the bundle it has just built (server/main.ts wires the rules in: guardLogs, server/boot.ts; its own
// byte-for-byte writes to a file; exitAfterLog). Each case below must hold, or the check fails:
//   - --check with its stdout a pipe whose reader is gone before the first line: exit 1 with exactly the one line, no stack trace;
//   - --check with its stdout read for six lines and then left, so its last line (its seventh) cannot be written: the same, so --check
//     never exits 0 before that line is out;
//   - --check with its stdout a file that fills up in the middle of its last line (a 1 KiB size limit, the file already holding the
//     rest): node's own stream for a file drops the count of a short write, so the line must come out as EFBIG, exit 1;
//   - --check that finds a problem (its site's origin set to the one its probe asks from as another): exit 1 with that one problem;
//   - the server whose log's reader goes away while it serves, then asked once: exit 1 with the one line;
//   - the server whose log is a file that fills up in the middle of its fourth request line while it serves, asked once at a time: it
//     answers those four and stops on the line it could not write, exit 1 with the one line, EFBIG (one that lets node's file stream
//     drop the short write serves a fifth);
//   - --check with its log a directory, which node takes for a stream that drops every line: exit 1 with the one line, EBADF;
//   - --check with its log /dev/null, a device node writes as a file: it passes;
//   - the server with its log a unix socket whose reader read every line and left, then stopped: exit 0 with nothing on stderr;
//   - the server on a SQLite store, stopped by SIGTERM and again by SIGINT, each signal sent twice 100 ms apart while its log's reader
//     has stalled: every request's line still reaches the reader, and it exits 0 with nothing on stderr. Node's warning that SQLite
//     is experimental is turned off for that run.
// Each run's environment holds nothing of this one but PATH (and the port, and the store), so no other PONCHO_ variable changes the
// boot. Each runs in a process group of its own, and at its limit the group is killed and the case fails, also when a process it left
// behind still holds its pipes. Each run takes the entry it starts, so scripts/server-log-check.test.mjs can hand it entries that break
// each rule.
import { spawn } from 'node:child_process';
import { once as onceOf } from 'node:events';
import { closeSync, mkdtempSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { connect, createServer } from 'node:net';
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
 * Starts `command args` in a process group of its own, stdin closed, stdout `stdout`, stderr read, and hands the child to `start` with
 * a signal for its requests. Resolves once it and every holder of its pipes are done, or at `limitMs`, when the whole group is killed,
 * this end of its pipes is closed and its requests are given up, so that a process that left the group holds up nothing, and
 * `timedOut` is set.
 */
function launch(command, args, { env, stdout = 'pipe', limitMs = LIMIT_MS }, start = () => undefined) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd: ROOT, env, stdio: ['ignore', stdout, 'pipe'], detached: true });
    const requests = new AbortController();
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
      child.stdout?.destroy();
      child.stderr.destroy();
      requests.abort();
      end(null, 'SIGKILL', true);
    }, limitMs);
    child.on('close', (code, signal) => { end(code, signal, false); });
    // The requests' own limit too: an entry may be done while a process it left holds the server and never answers. A case's own
    // work may still be going when its entry has ended and the case has returned (a read of a log it has removed): that work is no
    // part of the verdict, so its failure ends it and nothing more (L-107).
    Promise.resolve()
      .then(() => start(child, AbortSignal.any([requests.signal, AbortSignal.timeout(limitMs)])))
      .catch(() => undefined);
  });
}
/** How a run ended, as a case reports it. */
const endOf = (r) => (r.timedOut ? `no end within ${LIMIT_MS / 1000} s or its limit` : `exit ${r.code ?? r.signal}`);

/** The problem --check finds when the site's origin is the one its probe asks the nonce route from as another. */
const FAILED = 'the nonce route does not refuse another origin\n';

/** How many times a run whose reader left after some lines is made again when it ends with exit 0 and nothing on stderr. */
const TRIES = 10;

/**
 * Runs `entry --check` with `env` added and stdout read for `lines` lines (0: none) and then left; resolves with what went wrong, or
 * null when it exits 1 having written exactly `expected` to stderr. A reader that leaves after some lines races the entry's next line
 * through the pipe, which on a busy machine may be written before the reader is gone: such a run, exit 0 with nothing on stderr,
 * proves nothing either way, and is made again, up to TRIES times.
 */
async function checked(entry, lines, env, expected, limitMs) {
  let r = await checkOnce(entry, lines, env, limitMs);
  for (let tries = 1; tries < TRIES && lines > 0 && Number.isFinite(lines) && r.code === 0 && r.said === ''; tries += 1) r = await checkOnce(entry, lines, env, limitMs);
  return r.code === 1 && r.said === expected ? null : `${endOf(r)}, stderr ${JSON.stringify(r.said.slice(0, 400))}, expected exit 1 and ${JSON.stringify(expected)}`;
}

/** One run of `entry --check` with `env` added and stdout read for `lines` lines (0: none) and then left. */
function checkOnce(entry, lines, env, limitMs) {
  return launch(process.execPath, [entry, '--check'], { env: { ...PATH_ONLY, ...env }, limitMs }, (child) => {
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
    const first = await launch(process.execPath, [entry, '--check'], { env: PATH_ONLY, stdout: once });
    closeSync(once);
    if (first.code !== 0) return `with its log a file with room, ${endOf(first)}, expected exit 0`;
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

/** The line every log that cannot be written gets when node would write it nowhere (a directory, a datagram socket). */
const NOWHERE = 'the log cannot be written (EBADF)\n';

/**
 * Runs `entry --check` with its log a directory, which node takes for a stream that drops every line; resolves with what went wrong,
 * or null when it exits 1 having written exactly the EBADF line to stderr.
 */
export async function nowhere(entry) {
  const dir = mkdtempSync(join(tmpdir(), 'poncho-log-check-'));
  const out = openSync(dir, 'r');
  try {
    const r = await launch(process.execPath, [entry, '--check'], { env: PATH_ONLY, stdout: out });
    return r.code === 1 && r.said === NOWHERE ? null : `${endOf(r)}, stderr ${JSON.stringify(r.said.slice(0, 400))}, expected exit 1 and ${JSON.stringify(NOWHERE)}`;
  } finally {
    closeSync(out);
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Runs `entry --check` with its log /dev/null, a device node writes as a file; resolves with what went wrong, or null when it passes. */
export async function discarded(entry) {
  const out = openSync('/dev/null', 'w');
  try {
    const r = await launch(process.execPath, [entry, '--check'], { env: PATH_ONLY, stdout: out });
    return r.code === 0 && r.said === '' ? null : `${endOf(r)}, stderr ${JSON.stringify(r.said.slice(0, 400))}, expected exit 0 and nothing`;
  } finally {
    closeSync(out);
  }
}

/** The requests the drained case sends before its reader leaves. */
const DRAINED_REQUESTS = 3;

/**
 * Runs `entry` as the server with its log a unix socket, reads every line up to the lines of DRAINED_REQUESTS requests, then leaves,
 * and stops it with SIGTERM; resolves with what went wrong, or null when it was still running then and exits 0 with nothing on
 * stderr. A log whose reader left after reading everything lost nothing, so the stop owes no line (a write of nothing would fail on
 * such a socket).
 */
export async function drained(entry) {
  const dir = mkdtempSync(join(tmpdir(), 'poncho-log-check-'));
  const listener = createServer();
  let signalled = false;
  try {
    listener.listen(join(dir, 'log.sock'));
    await onceOf(listener, 'listening');
    const accepted = onceOf(listener, 'connection');
    const writer = connect(join(dir, 'log.sock'));
    await onceOf(writer, 'connect');
    const [reader] = await accepted;
    const r = await launch(process.execPath, [entry], { env: { ...PATH_ONLY, PONCHO_SERVER_PORT: '0' }, stdout: writer }, (child, requests) => {
      // The entry holds its own copy of the socket: this one would keep its peer from seeing the entry's end.
      writer.destroy();
      let out = '';
      let asked = false;
      reader.setEncoding('utf8');
      reader.on('data', async (part) => {
        out += part;
        const port = portIn(out);
        if (port === undefined || asked) return;
        asked = true;
        // A body that breaks part way rejects as it is read, as a fetch the entry refuses does: either ends that request, not the check.
        for (let i = 0; i < DRAINED_REQUESTS; i += 1) await fetch(`http://127.0.0.1:${port}/api/v1/config`, { signal: requests }).then((response) => response.arrayBuffer()).catch(() => undefined);
        for (let i = 0; i < 100 && out.split(CONFIG_LINE).length - 1 < DRAINED_REQUESTS; i += 1) await new Promise((done) => { setTimeout(done, 20); });
        reader.end();
        reader.destroy();
        // kill is false for a child that has ended: a case that stops the entry passes only a run it stopped.
        setTimeout(() => { signalled = child.kill('SIGTERM'); }, 300);
      });
    });
    if (!signalled) return `${endOf(r)} before it was stopped, stderr ${JSON.stringify(r.said.slice(0, 400))}`;
    return r.code === 0 && r.said === '' ? null : `${endOf(r)}, stderr ${JSON.stringify(r.said.slice(0, 400))}, expected exit 0 and nothing`;
  } finally {
    listener.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

/** The port in the listening line of `out`, once it is there. */
const portIn = (out) => /"event":"listening","port":(\d+)/.exec(out)?.[1];

/** The most requests the file case sends before it takes the server for one that never stops. */
const FILL_REQUESTS = 40;
/** The request whose line the file case's limit cuts: the server must stop on it, after answering it. */
const CUT_LINE = 4;

/**
 * Runs `entry` as the server once with its log a file with room, to learn how much it writes up to its listening line, then again
 * with its log a file whose 1 KiB limit falls in the middle of request line CUT_LINE after that; reads the port from the file and asks
 * it once at a time until it stops. Resolves with what went wrong, or null when it answered exactly CUT_LINE requests, each 200, and
 * exits 1 with exactly the EFBIG line.
 */
export async function servedFilled(entry) {
  const dir = mkdtempSync(join(tmpdir(), 'poncho-log-check-'));
  const env = { ...PATH_ONLY, PONCHO_SERVER_PORT: '0' };
  /** Calls `ask(port)` once the listening line is in `file`, read from `from` on; stops the child if it is still running after. */
  const drive = (file, from, ask) => async (child, requests) => {
    let port;
    for (let i = 0; i < 300 && port === undefined && child.exitCode === null; i += 1) {
      await new Promise((done) => { setTimeout(done, 20); });
      port = portIn(readFileSync(file, 'latin1').slice(from));
    }
    if (port !== undefined) await ask(port, child, requests);
    if (child.exitCode === null) child.kill('SIGTERM');
  };
  try {
    const roomy = join(dir, 'roomy');
    const once = openSync(roomy, 'w');
    await launch(process.execPath, [entry], { env, stdout: once }, drive(roomy, 0, async () => undefined));
    closeSync(once);
    const booted = readFileSync(roomy, 'latin1');
    if (portIn(booted) === undefined) return 'with its log a file with room, it never wrote its listening line';
    const upToListening = booted.indexOf('\n', booted.indexOf('"event":"listening"')) + 1;
    const room = upToListening + Math.round((CONFIG_LINE.length + 1) * (CUT_LINE - 0.5));
    const log = join(dir, 'log');
    const prefill = Math.max(0, FILE_LIMIT - room);
    writeFileSync(log, '#'.repeat(prefill));
    const out = openSync(log, 'a');
    const statuses = [];
    const r = await launch('bash', ['-c', 'trap "" XFSZ; ulimit -f 1; exec "$0" "$@"', process.execPath, entry], { env, stdout: out }, drive(log, prefill, async (port, child, requests) => {
      for (let i = 0; i < FILL_REQUESTS && child.exitCode === null; i += 1) {
        // An answer whose body breaks part way was not answered (0), as one whose fetch the entry refused.
        statuses.push(await fetch(`http://127.0.0.1:${port}/api/v1/config`, { signal: requests }).then(async (response) => { await response.arrayBuffer(); return response.status; }).catch(() => 0));
      }
    }));
    closeSync(out);
    const answered = statuses.slice(0, statuses.indexOf(0) === -1 ? statuses.length : statuses.indexOf(0));
    if (answered.length !== CUT_LINE || answered.some((status) => status !== 200)) return `${endOf(r)} after ${answered.length} answers, expected ${CUT_LINE}: ${JSON.stringify(statuses)}`;
    const expected = 'the log cannot be written (EFBIG)\n';
    return r.code === 1 && r.said === expected ? null : `${endOf(r)} after ${answered.length} answers, stderr ${JSON.stringify(r.said.slice(0, 400))}, expected exit 1 and ${JSON.stringify(expected)}`;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * Runs `entry` as the server, reads it up to its listening line, then leaves its log and asks it once; resolves with what went wrong,
 * or null when that request is answered and it then exits 1 having written exactly the EPIPE line to stderr.
 */
export async function served(entry, limitMs = LIMIT_MS) {
  let asked = Promise.resolve(0);
  const r = await launch(process.execPath, [entry], { env: { ...PATH_ONLY, PONCHO_SERVER_PORT: '0' }, limitMs }, (child, requests) => {
    let out = '';
    child.stdout.setEncoding('utf8');
    // No data comes once the reader is gone, so the port is acted on once (L-025: no check of its own).
    child.stdout.on('data', (part) => {
      out += part;
      const port = portIn(out);
      if (port === undefined) return;
      child.stdout.destroy();
      asked = fetch(`http://127.0.0.1:${port}/api/v1/config`, { signal: requests }).then((response) => response.status, () => 0);
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
 * `signal` twice and reads on; resolves with what went wrong, or null when it was still running when the first signal came, wrote
 * every request's line after its listening line and exits 0 with nothing on stderr.
 */
export async function stopped(entry, signal = 'SIGTERM') {
  const dir = mkdtempSync(join(tmpdir(), 'poncho-log-check-'));
  let out = '';
  let signalled = false;
  try {
    const env = { ...PATH_ONLY, PONCHO_SERVER_PORT: '0', PONCHO_STORE: join(dir, 'store.db') };
    const r = await launch(process.execPath, ['--disable-warning=ExperimentalWarning', entry], { env, limitMs: LIMIT_MS * 2 }, (child, requests) => {
      let asked = false;
      child.stdout.setEncoding('utf8');
      child.stdout.on('data', async (part) => {
        out += part;
        const port = portIn(out);
        if (port === undefined || asked) return;
        asked = true;
        child.stdout.pause();
        const base = `http://127.0.0.1:${port}/api/v1/config`;
        // Each request has a signal of its own that follows the case's: on one signal 2000 would warn, since fetch raises its limit
        // only to 1500.
        try {
          for (let i = 0; i < REQUESTS; i += 8) await Promise.all(Array.from({ length: 8 }, () => fetch(base, { signal: AbortSignal.any([requests]) }).then((response) => response.arrayBuffer())));
        } catch {
          // A request given up at the case's limit, or refused by an entry that died: the case fails on the lines that came, and the
          // check goes on to the next case.
          return;
        }
        signalled = child.kill(signal);
        setTimeout(() => { child.kill(signal); }, 100);
        setTimeout(() => { child.stdout.resume(); }, 300);
      });
    });
    // Only the lines of requests: those after the listening line, which come before any request is sent.
    const lines = (out.split('"event":"listening"')[1] ?? '').split('\n').filter((line) => line.startsWith(CONFIG_LINE)).length;
    if (!signalled) return `${endOf(r)} before it was stopped (its requests ended first), ${lines} of ${REQUESTS} request lines read, stderr ${JSON.stringify(r.said.slice(0, 400))}`;
    return r.code === 0 && r.said === '' && lines === REQUESTS ? null : `${endOf(r)}, ${lines} of ${REQUESTS} request lines read, stderr ${JSON.stringify(r.said.slice(0, 400))}`;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Every case on `entry`, each reported on a line of its own through `print`; gives the exit code, 1 if any case failed. */
export async function main(entry, print = { ok: console.log, fail: console.error }) {
  const cases = [
    ['a log that cannot be written stops the server with one line: its log has no reader at all', () => run(entry, 0)],
    ['a log that cannot be written stops the server with one line: its log\'s reader leaves after six lines', () => run(entry, 6)],
    ['a log on a file that fills up in the middle of a line stops the server with one line', () => filled(entry)],
    ['a check that finds a problem exits 1 with that one line', () => failed(entry)],
    ['a server whose log\'s reader leaves while it serves stops with one line', () => served(entry)],
    ['a server whose log is a file that fills up while it serves stops on the line it could not write, with one line', () => servedFilled(entry)],
    ['a log node would write nowhere (a directory) stops the server at once with one line', () => nowhere(entry)],
    ['a check whose log is /dev/null passes, its lines thrown away', () => discarded(entry)],
    ['a server whose log\'s reader read every line and left exits 0 when stopped', () => drained(entry)],
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
