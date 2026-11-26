// GDD-TEC-10 ("The HTTP API"): "A log that cannot be written stops the server with one line that names only the error's code."
// Run by `npm run server:check` on the bundle it has just built (server/main.ts wires the rule in with guardLogs, server/boot.ts).
// Two runs of the bundle's --check, each of which must exit 1 having written exactly the one line to stderr, no stack trace:
//   - its stdout a pipe whose reader is gone before the first line;
//   - its stdout read for five lines and then left, so the check's last line (its sixth) cannot be written: --check must not exit 0
//     before that line is out.
// One run of --check that finds a problem, its site's origin set to the one its probe asks from as another: it must exit 1 with that one
// problem, so a check that fails never ends as one that passed.
// And one run of the server itself, stopped with SIGTERM while its log's reader has stalled: every request's line still reaches the
// reader, and it exits 0, so no line is lost to a stop.
// Their environment holds nothing of this one but PATH (and the port), so no PONCHO_ variable changes the boot.
// Each run takes the entry it starts, so scripts/server-log-check.test.mjs can hand it entries that break each rule.
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const EXPECTED = 'the log cannot be written (EPIPE)\n';
/** Long enough for a booting server on a busy machine; a server that never stops is a failure, not a wait. */
const LIMIT_MS = 15000;

/** The problem --check finds when the site's origin is the one its probe asks the nonce route from as another. */
const FAILED = 'the nonce route does not refuse another origin\n';

/**
 * Runs `entry --check` with `env` added and stdout read for `lines` lines (0: none) and then left; resolves with what went wrong, or
 * null when it exits 1 having written exactly `expected` to stderr.
 */
function checked(entry, lines, env, expected) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [entry, '--check'], { cwd: ROOT, env: { PATH: process.env.PATH ?? '', ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
    let seen = 0;
    if (lines === 0) child.stdout.destroy();
    else {
      child.stdout.setEncoding('utf8');
      child.stdout.on('data', (part) => {
        seen += part.split('\n').length - 1;
        if (seen >= lines) child.stdout.destroy();
      });
    }
    let said = '';
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (part) => { said += part; });
    const timer = setTimeout(() => { child.kill('SIGKILL'); }, LIMIT_MS);
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      resolve(code === 1 && said === expected ? null : `exit ${code ?? signal}, stderr ${JSON.stringify(said.slice(0, 400))}, expected exit 1 and ${JSON.stringify(expected)}`);
    });
  });
}

/** Runs `entry --check` with stdout read for `lines` lines (0: none) and then left; resolves with what went wrong, or null. */
export const run = (entry, lines) => checked(entry, lines, {}, EXPECTED);
/** Runs `entry --check` so that its check fails, stdout read to its end; resolves with what went wrong, or null. */
export const failed = (entry) => checked(entry, Infinity, { PONCHO_SITE_ORIGIN: 'http://elsewhere.invalid' }, FAILED);

/** More request lines than an OS pipe holds (64 KiB, at about 55 bytes a line), so some wait in the server when it is stopped. */
export const REQUESTS = 2000;
/** The line each request to the config leaves. */
export const CONFIG_LINE = '{"method":"GET","route":"/api/v1/config","status":200}';

/** Runs `entry` as the server, stalls its log's reader, sends REQUESTS requests, stops it with SIGTERM and reads on; resolves with what went wrong, or null. */
export function stopped(entry) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [entry], { cwd: ROOT, env: { PATH: process.env.PATH ?? '', PONCHO_SERVER_PORT: '0' }, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let asked = false;
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', async (part) => {
      out += part;
      const listening = /"event":"listening","port":(\d+)/.exec(out);
      if (listening === null || asked) return;
      asked = true;
      child.stdout.pause();
      const base = `http://127.0.0.1:${listening[1]}/api/v1/config`;
      for (let i = 0; i < REQUESTS; i += 8) await Promise.all(Array.from({ length: 8 }, () => fetch(base).then((r) => r.arrayBuffer())));
      child.kill('SIGTERM');
      setTimeout(() => { child.stdout.resume(); }, 300);
    });
    let said = '';
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (part) => { said += part; });
    const timer = setTimeout(() => { child.kill('SIGKILL'); }, LIMIT_MS * 2);
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      const lines = out.split('\n').filter((line) => line.startsWith(CONFIG_LINE)).length;
      resolve(code === 0 && said === '' && lines === REQUESTS ? null : `exit ${code ?? signal}, ${lines} of ${REQUESTS} request lines read, stderr ${JSON.stringify(said.slice(0, 400))}`);
    });
  });
}

/** Every case on `entry`, each reported on a line of its own; gives the exit code, 1 if any case failed. */
async function main(entry) {
  let code = 0;
  const cases = [[0, 'its log has no reader at all'], [5, 'its log\'s reader leaves after five lines']];
  for (const [lines, what] of cases) {
    const wrong = await run(entry, lines);
    if (wrong === null) console.log(`ok    a log that cannot be written stops the server with one line: ${what}`);
    else {
      console.error(`FAIL  a log that cannot be written, when ${what}: ${wrong}`);
      code = 1;
    }
  }
  const wrong = await failed(entry);
  if (wrong === null) console.log('ok    a check that finds a problem exits 1 with that one line');
  else {
    console.error(`FAIL  a check that finds a problem: ${wrong}`);
    code = 1;
  }
  const lost = await stopped(entry);
  if (lost === null) console.log('ok    a server stopped while its log\'s reader stalls writes every line first, and exits 0');
  else {
    console.error(`FAIL  a server stopped while its log's reader stalls: ${lost}`);
    code = 1;
  }
  return code;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = await main(join(ROOT, 'server', 'dist', 'main.js'));
