// GDD-TEC-10: scripts/server-log-check.mjs, the check `npm run server:check` runs on the built server, run here against fake entries
// that each keep or break one of its rules, so a check that passes a server breaking a rule fails here (L-010).
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { CONFIG_LINE, failed, run, stopped } from './server-log-check.mjs';

const MODULE = new URL('./server-log-check.mjs', import.meta.url).href;

const dir = mkdtempSync(join(tmpdir(), 'poncho-log-check-'));
afterAll(() => { rmSync(dir, { recursive: true, force: true }); });

/**
 * A fake --check: six lines, the sixth after a pause, as the real one writes its last line after its probes. `onError`: what it does
 * when a line cannot be written ('line', the one line and exit 1, as guardLogs does; 'zero', the same line and exit 0; 'none', node's
 * own crash). `problem`: what it does once its lines are out when its site's origin is another ('one', that problem and exit 1;
 * 'zero', that problem and exit 0).
 */
function fakeCheck(name, onError, problem = 'one') {
  const path = join(dir, `${name}.mjs`);
  writeFileSync(path, `
const onError = ${JSON.stringify(onError)};
const failing = process.env.PONCHO_SITE_ORIGIN === 'http://elsewhere.invalid';
const say = (n) => process.stdout.write('{"event":"check","n":' + n + '}\\n');
if (onError !== 'none') process.stdout.on('error', (e) => { process.stderr.write('the log cannot be written (' + e.code + ')\\n'); process.exit(onError === 'line' ? 1 : 0); });
for (let n = 1; n <= 5; n += 1) say(n);
setTimeout(() => {
  if (failing) process.stderr.write('the nonce route does not refuse another origin\\n');
  else say(6);
  process.stdout.write('', (e) => { if (!e) process.exit(failing && ${JSON.stringify(problem)} === 'one' ? 1 : 0); });
}, 300);
`);
  return path;
}

/**
 * A fake server: a note, then (later) the listening line, then the config line of each request. `onStop`: what it does on SIGTERM
 * ('flush', exit 0 once every line is out; 'one', the same with exit 1; 'say', a line to stderr first; 'cut', exit 0 at once).
 */
function fakeServer(name, onStop) {
  const path = join(dir, `${name}.mjs`);
  writeFileSync(path, `
import { createServer } from 'node:http';
const onStop = ${JSON.stringify(onStop)};
process.stdout.write('{"event":"boot","note":"a note before listening"}\\n');
const server = createServer((req, res) => { res.end('{}'); process.stdout.write(${JSON.stringify(`${CONFIG_LINE}\n`)}); });
setTimeout(() => {
  server.listen(Number(process.env.PONCHO_SERVER_PORT), '127.0.0.1', () => { process.stdout.write('{"event":"listening","port":' + server.address().port + '}\\n'); });
}, 100);
process.on('SIGTERM', () => {
  server.close();
  server.closeAllConnections();
  if (onStop === 'cut') process.exit(0);
  if (onStop === 'say') process.stderr.write('stopping\\n');
  process.stdout.write('', (e) => { if (!e) process.exit(onStop === 'one' ? 1 : 0); });
});
`);
  return path;
}

describe('GDD-TEC-10 server-log-check: a log that cannot be written', () => {
  it('passes a --check that writes the one line and exits 1, whether its log has no reader or loses it after five lines', async () => {
    const entry = fakeCheck('check-line', 'line');
    expect(await run(entry, 0)).toBeNull();
    expect(await run(entry, 5)).toBeNull();
  }, 30000);

  it('fails a --check that exits 0 when its log cannot be written, though it writes the one line', async () => {
    const entry = fakeCheck('check-zero', 'zero');
    expect(await run(entry, 0)).toMatch(/^exit 0,/);
    expect(await run(entry, 5)).toMatch(/^exit 0,/);
  }, 30000);

  it('fails a --check that crashes with node\'s own stack trace, though it exits 1', async () => {
    const entry = fakeCheck('check-crash', 'none');
    expect(await run(entry, 0)).toMatch(/^exit 1, stderr ".*Error: write EPIPE/);
  }, 30000);
});

describe('GDD-TEC-10 server-log-check: a check that finds a problem', () => {
  it('passes a --check that writes that problem and exits 1', async () => {
    expect(await failed(fakeCheck('check-problem', 'line'))).toBeNull();
  }, 30000);

  it('fails a --check that writes that problem and exits 0', async () => {
    expect(await failed(fakeCheck('check-problem-zero', 'line', 'zero'))).toMatch(/^exit 0, stderr "the nonce route does not refuse another origin\\n"/);
  }, 30000);
});

describe('GDD-TEC-10 server-log-check: run as a script only', () => {
  it('imported by another script, it runs no check', () => {
    const importer = join(dir, 'importer.mjs');
    writeFileSync(importer, `await import(${JSON.stringify(MODULE)});\n`);
    expect(spawnSync(process.execPath, [importer], { encoding: 'utf8', timeout: 60000 })).toMatchObject({ status: 0, stdout: '', stderr: '' });
  }, 70000);

  it('imported with no script at all, as by node -e, it runs no check and throws nothing', () => {
    const r = spawnSync(process.execPath, ['--input-type=module', '-e', `await import(${JSON.stringify(MODULE)});`], { encoding: 'utf8', timeout: 60000 });
    expect(r).toMatchObject({ status: 0, stdout: '', stderr: '' });
  }, 70000);
});

describe('GDD-TEC-10 server-log-check: a server stopped while its log\'s reader stalls', () => {
  it('passes a server that writes every line, then exits 0 with nothing on stderr', async () => {
    expect(await stopped(fakeServer('server-flush', 'flush'))).toBeNull();
  }, 60000);

  it('fails a server that exits 1 once its lines are out', async () => {
    expect(await stopped(fakeServer('server-one', 'one'))).toMatch(/^exit 1, 2000 of 2000 /);
  }, 60000);

  it('fails a server that writes to stderr when it stops', async () => {
    expect(await stopped(fakeServer('server-say', 'say'))).toMatch(/^exit 0, 2000 of 2000 request lines read, stderr "stopping\\n"/);
  }, 60000);

  it('fails a server that exits at once and loses the lines still waiting', async () => {
    const wrong = await stopped(fakeServer('server-cut', 'cut'));
    expect(wrong).toMatch(/^exit 0, \d+ of 2000 /);
    expect(wrong).not.toMatch(/^exit 0, 2000 of 2000 /);
  }, 60000);
});
