// GDD-TEC-10, docs/decisions/0004-game-server.md ("How it runs"): the server's entry, which `npm run server:build` bundles into server/dist/main.js.
// It has no test of its own: `npm run server:check` (`--check`, the CI step) builds, boots, reads its own config and exits.
// A log line is one JSON object with fixed fields, written with process.stdout.write; a boot problem goes to stderr. No line holds an IP,
// a cookie, a body, a token, a wallet or an error's text.
import { readFileSync } from 'node:fs';
import { codeOf, guardLogs, selfCheck, settingsOf, wire } from './boot';
import { serve } from './http/node';

/** The server's own setting, not a GDD value: how long `--check` may take before CI is not left waiting. */
const CHECK_TIMEOUT_MS = 10000;

const say = (line: object): void => {
  process.stdout.write(`${JSON.stringify(line)}\n`);
};
const complain = (text: string): void => {
  process.stderr.write(`${text}\n`);
};

async function main(): Promise<void> {
  guardLogs(process.stdout, process.stderr, complain, (code) => process.exit(code));
  const settled = settingsOf(process.env, (path) => readFileSync(path, 'utf8'));
  if ('problems' in settled) {
    for (const problem of settled.problems) complain(problem);
    process.exit(1);
  }
  const { settings } = settled;
  for (const note of settings.notes) say({ event: 'boot', note });
  const wired = await wire(settings, say);

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
    process.exit(problems.length === 0 ? 0 : 1);
  }

  const server = await serve(wired.app, settings.port, say);
  say({ event: 'listening', port: server.port });
  const stop = (): void => {
    server.close().then(() => {
      wired.close();
      process.exit(0);
    }, () => process.exit(1));
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

main().catch((error: unknown) => {
  complain(`the server did not start (${codeOf(error)})`);
  process.exit(1);
});
