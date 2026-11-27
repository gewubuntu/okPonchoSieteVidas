// GDD-TEC-10, docs/decisions/0004-game-server.md ("How it runs"): the server's entry, which `npm run server:build` bundles into server/dist/main.js.
// It has no test of its own: `npm run server:check` (`--check`, the CI step) builds, boots, reads its own config and exits, and then
// scripts/server-log-check.mjs checks its log rules through the bundle.
// A log line is one JSON object with fixed fields, written with process.stdout.write; a boot problem goes to stderr. No line holds an IP,
// a cookie, a body, a token, a wallet or an error's text.
import { fstatSync, readFileSync, writeSync } from 'node:fs';
import { Socket } from 'node:net';
import { codeOf, guardLogs, selfCheck, settingsOf, wire } from './boot';
import { serve } from './http/node';

/** The server's own setting, not a GDD value: how long `--check` may take before CI is not left waiting. */
const CHECK_TIMEOUT_MS = 10000;

const complain = (text: string): void => {
  process.stderr.write(`${text}\n`);
};
/** Whether stdout is a regular file, which node writes with a stream that drops the count of a short write (on a full disk, past a size limit). */
const stdoutIsFile = ((): boolean => {
  try {
    return fstatSync(1).isFile();
  } catch {
    return false;
  }
})();
/**
 * Whether node writes stdout anywhere: a file or a device, or a pipe, a stream socket or a terminal, which it writes as a socket. For
 * any other kind (a directory, a datagram socket) it makes a stream that drops every line.
 */
const stdoutWrites = ((): boolean => {
  try {
    const kind = fstatSync(1);
    if (kind.isFile() || kind.isCharacterDevice()) return true;
  } catch {
    return false;
  }
  return process.stdout instanceof Socket;
})();
const say = (line: object): void => {
  const text = `${JSON.stringify(line)}\n`;
  if (!stdoutIsFile) {
    process.stdout.write(text);
    return;
  }
  // On a file each line is written to its last byte here: a write the kernel cuts short is followed by one that fails, and that ends the
  // server as guardLogs does for a stream. A write of one byte or more never writes none (L-025).
  const bytes = Buffer.from(text);
  try {
    for (let at = 0; at < bytes.length;) at += writeSync(1, bytes, at);
  } catch (error) {
    complain(`the log cannot be written (${codeOf(error)})`);
    process.exit(1);
  }
};
/**
 * Exits with `code` once every line written so far has reached stdout. A line that could not be written ends the process through
 * guardLogs instead, with exit 1. It waits one turn of the loop first: a write that failed at once says so on the next tick, and
 * guardLogs ends the server then. With nothing left to write after that it exits at once, since the empty write that waits for the
 * rest would itself fail on a socket whose reader read everything and left.
 */
const exitAfterLog = (code: number): void => {
  setImmediate(() => {
    if (process.stdout.writableLength === 0) process.exit(code);
    process.stdout.write('', (error) => {
      if (!(error instanceof Error)) process.exit(code);
    });
  });
};

async function main(): Promise<void> {
  guardLogs(process.stdout, process.stderr, complain, (code) => process.exit(code));
  if (!stdoutWrites) {
    complain('the log cannot be written (EBADF)');
    process.exit(1);
  }
  const settled = settingsOf(process.env, (path) => readFileSync(path, 'utf8'));
  if ('problems' in settled) {
    for (const problem of settled.problems) complain(problem);
    process.exit(1);
  }
  const { settings } = settled;
  for (const note of settings.notes) say({ event: 'boot', note });
  const wired = await wire(settings);

  if (process.argv.includes('--check')) {
    // An unref'd timer: it ends a hung check, and never keeps a finished one alive.
    setTimeout(() => {
      complain('the check took too long');
      process.exit(1);
    }, CHECK_TIMEOUT_MS).unref();
    const server = await serve(wired.app, 0, say);
    const problems = await selfCheck(fetch, `http://127.0.0.1:${server.port}`, settings.site.origin);
    await server.close();
    wired.close();
    for (const problem of problems) complain(problem);
    if (problems.length === 0) say({ event: 'check', ok: true });
    exitAfterLog(problems.length === 0 ? 0 : 1);
    return;
  }

  const server = await serve(wired.app, settings.port, say);
  say({ event: 'listening', port: server.port });
  let stopping = false;
  // A second signal while stopping changes nothing: the store is closed once.
  const stop = (): void => {
    if (stopping) return;
    stopping = true;
    server.close().then(() => {
      wired.close();
      exitAfterLog(0);
    }, () => process.exit(1));
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

main().catch((error: unknown) => {
  complain(`the server did not start (${codeOf(error)})`);
  process.exit(1);
});
