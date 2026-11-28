// GDD-TEC-10: scripts/server-log-check.mjs, the check `npm run server:check` runs on the built server, run here against fake entries
// that each keep or break one of its rules, so a check that passes a server breaking a rule fails here (L-010).
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { CONFIG_LINE, discarded, drained, failed, filled, main, nowhere, run, served, servedFilled, stopped } from './server-log-check.mjs';

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
 * A fake server: a note, then (later) the listening line, then the config line of each request. `onStop`: what it does on SIGTERM and
 * SIGINT ('flush', exit 0 once every line is out; 'one', the same with exit 1; 'say', a line to stderr first; 'cut', exit 0 at once;
 * 'cut-on-int', 'flush' on SIGTERM and 'cut' on SIGINT). `onBroken`: what it does when a line cannot be written ('line', the one line
 * and exit 1, as guardLogs does; 'crash', node's own; 'ignore', it serves on).
 */
function fakeServer(name, onStop, onBroken = 'line') {
  const path = join(dir, `${name}.mjs`);
  writeFileSync(path, `
import { createServer } from 'node:http';
const onStop = ${JSON.stringify(onStop)};
const onBroken = ${JSON.stringify(onBroken)};
if (onBroken === 'line') process.stdout.on('error', (e) => { process.stderr.write('the log cannot be written (' + e.code + ')\\n'); process.exit(1); });
if (onBroken === 'ignore') process.stdout.on('error', () => undefined);
if (onBroken === 'zero') process.stdout.on('error', (e) => { process.stderr.write('the log cannot be written (' + e.code + ')\\n'); process.exit(0); });
process.stdout.write('{"event":"boot","note":"a note before listening"}\\n');
const server = createServer((req, res) => { res.end('{}'); process.stdout.write(${JSON.stringify(`${CONFIG_LINE}\n`)}); });
setTimeout(() => {
  server.listen(Number(process.env.PONCHO_SERVER_PORT), '127.0.0.1', () => { process.stdout.write('{"event":"listening","port":' + server.address().port + '}\\n'); });
}, 100);
const stop = (signal) => {
  server.close();
  server.closeAllConnections();
  if (onStop === 'cut' || (onStop === 'cut-on-int' && signal === 'SIGINT')) process.exit(0);
  if (onStop === 'say') process.stderr.write('stopping\\n');
  process.stdout.write('', (e) => { if (!e) process.exit(onStop === 'one' ? 1 : 0); });
};
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
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

/**
 * A fake --check that writes ten lines of 40 bytes to stdout, a file. 'loop' writes each byte with writeSync and, when one fails,
 * writes the line and exits 1, as the server does; 'zero' does the same but exits 0; 'crash' lets the failure throw (node's own stack,
 * exit 1); 'stream' writes with process.stdout, which drops a short write's count, and exits 0; 'alone' is 'loop' but exits 3 when
 * its file is empty, as the run that measures it is.
 */
function fakeFileCheck(name, mode) {
  const path = join(dir, `${name}.mjs`);
  writeFileSync(path, `
import { fstatSync, writeSync } from 'node:fs';
const mode = ${JSON.stringify(mode)};
if (mode === 'alone' && fstatSync(1).size === 0) process.exit(3);
const line = '{"event":"check","n":"' + 'x'.repeat(16) + '"}\\n';
for (let n = 0; n < 10; n += 1) {
  if (mode === 'stream') process.stdout.write(line);
  else {
    const bytes = Buffer.from(line);
    try {
      for (let at = 0; at < bytes.length;) at += writeSync(1, bytes, at);
    } catch (e) {
      if (mode === 'crash') throw e;
      process.stderr.write('the log cannot be written (' + e.code + ')\\n');
      process.exit(mode === 'zero' ? 0 : 1);
    }
  }
}
process.exit(0);
`);
  return path;
}

describe('GDD-TEC-10 server-log-check: a log on a file that fills up', () => {
  it('passes a --check that writes each byte and stops with the one line when the file is full', async () => {
    expect(await filled(fakeFileCheck('file-loop', 'loop'))).toBeNull();
  }, 30000);

  it('fails a --check that lets node\'s file stream drop a short write and exits 0', async () => {
    expect(await filled(fakeFileCheck('file-stream', 'stream'))).toMatch(/^exit 0, stderr ""/);
  }, 30000);

  it('fails a --check that writes the line but exits 0, one that crashes with exit 1, and one that fails with room to write', async () => {
    expect(await filled(fakeFileCheck('file-zero', 'zero'))).toMatch(/^exit 0, stderr "the log cannot be written \(EFBIG\)\\n"/);
    expect(await filled(fakeFileCheck('file-crash', 'crash'))).toMatch(/^exit 1, stderr ".*EFBIG/);
    expect(await filled(fakeFileCheck('file-alone', 'alone'))).toBe('with its log a file with room, exit 3, expected exit 0');
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

describe('GDD-TEC-10 server-log-check: a server whose log\'s reader leaves while it serves', () => {
  it('passes a server that writes the one line and exits 1', async () => {
    expect(await served(fakeServer('serving-line', 'flush'))).toBeNull();
  }, 30000);

  it('fails a server that writes the line but exits 0', async () => {
    expect(await served(fakeServer('serving-zero', 'flush', 'zero'))).toMatch(/^exit 0, stderr "the log cannot be written \(EPIPE\)\\n"/);
  }, 30000);

  it('fails a server whose request is never answered, and one that never listens', async () => {
    const gone = join(dir, 'serving-gone.mjs');
    writeFileSync(gone, `
import { createServer } from 'node:http';
process.stdout.on('error', (e) => { process.stderr.write('the log cannot be written (' + e.code + ')\\n'); process.exit(1); });
const server = createServer(() => { process.stdout.write('{}\\n'); });
server.listen(0, '127.0.0.1', () => { process.stdout.write('{"event":"listening","port":' + server.address().port + '}\\n'); });
`);
    expect(await served(gone)).toMatch(/its request never answered$/);
    const never = join(dir, 'serving-never.mjs');
    writeFileSync(never, `process.stdout.write('{"event":"boot"}\\n'); setTimeout(() => { process.stdout.write('{"event":"boot"}\\n'); }, 200);
`);
    expect(await served(never, 2000)).toMatch(/its request never answered$/);
  }, 30000);

  it('fails a server that crashes with node\'s own stack, and one that serves on', async () => {
    expect(await served(fakeServer('serving-crash', 'flush', 'crash'))).toMatch(/^exit 1, stderr ".*EPIPE/);
    expect(await served(fakeServer('serving-ignore', 'flush', 'ignore'), 3000)).toMatch(/^no end within/);
  }, 30000);
});

describe('GDD-TEC-10 server-log-check: a run held past its limit', () => {
  it('kills the whole group at the limit: a process the entry started and left running is gone too', async () => {
    const entry = join(dir, 'check-hung.mjs');
    const pidFile = join(dir, 'hung.pid');
    writeFileSync(entry, `
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const sleeper = spawn('sleep', ['30'], { stdio: 'ignore' });
writeFileSync(${JSON.stringify(pidFile)}, String(sleeper.pid));
setInterval(() => undefined, 1000);
`);
    expect(await run(entry, 1, 1500)).toMatch(/^no end within/);
    const pid = Number(readFileSync(pidFile, 'utf8'));
    await new Promise((done) => { setTimeout(done, 200); });
    // A killed process its dead parent left is a zombie until something reaps it: its state, not its pid, says it is gone (Linux).
    let state = 'gone';
    try {
      state = readFileSync(`/proc/${pid}/stat`, 'utf8').replace(/^.*\) /, '').charAt(0);
    } catch {
      // No such process at all.
    }
    if (state !== 'gone' && state !== 'Z') process.kill(pid, 'SIGKILL');
    expect(['gone', 'Z']).toContain(state);
  }, 30000);

  it.each([['stays', 'setInterval(() => undefined, 1000);'], ['exits at once', 'process.exit(0);']])('gives up its request at the limit, though the server that took it left the group and never answers, and the entry %s', async (_how, after) => {
    const pidFile = join(dir, `mute-${_how.length}.pid`);
    const entry = join(dir, `serving-mute-${_how.length}.mjs`);
    writeFileSync(entry, `
import { spawn } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
const portFile = ${JSON.stringify(join(dir, `mute-${_how.length}.port`))};
const listener = "const s = require('node:net').createServer(() => undefined); s.listen(0, '127.0.0.1', () => { require('node:fs').writeFileSync(" + JSON.stringify(portFile) + ", String(s.address().port)); });";
const mute = spawn(process.execPath, ['-e', listener], { stdio: 'ignore', detached: true });
mute.unref();
require_pid: { (await import('node:fs')).writeFileSync(${JSON.stringify(pidFile)}, String(mute.pid)); }
const wait = () => new Promise((done) => { setTimeout(done, 20); });
while (!existsSync(portFile)) await wait();
process.stdout.write('{"event":"listening","port":' + readFileSync(portFile, 'utf8') + '}\\n');
${after}
`);
    const started = Date.now();
    try {
      expect(await served(entry, 1500)).toMatch(/its request never answered$/);
      expect(Date.now() - started).toBeLessThan(8000);
    } finally {
      try {
        process.kill(Number(readFileSync(pidFile, 'utf8')), 'SIGKILL');
      } catch {
        // Gone already.
      }
    }
  }, 30000);

  it('lets the check itself end at the limit, though a process that left the group still holds the pipes', () => {
    const entry = join(dir, 'check-holder.mjs');
    writeFileSync(entry, `
import { spawn } from 'node:child_process';
spawn('sleep', ['20'], { stdio: ['ignore', 'inherit', 'inherit'], detached: true }).unref();
setInterval(() => undefined, 1000);
`);
    const script = `const { run } = await import(${JSON.stringify(new URL('./server-log-check.mjs', import.meta.url).href)}); console.log(await run(${JSON.stringify(entry)}, 1, 1500));`;
    const started = Date.now();
    const r = spawnSync(process.execPath, ['--input-type=module', '-e', script], { encoding: 'utf8', timeout: 15000 });
    expect(r.stdout).toMatch(/^no end within/);
    expect(Date.now() - started).toBeLessThan(8000);
  }, 30000);

  it('fails a --check that leaves a process holding its pipes, at the limit and not when that process ends', async () => {
    const entry = join(dir, 'check-left.mjs');
    writeFileSync(entry, `
import { spawn } from 'node:child_process';
spawn('sleep', ['10'], { stdio: 'inherit', detached: true }).unref();
process.stdout.on('error', (e) => { process.stderr.write('the log cannot be written (' + e.code + ')\\n'); process.exit(1); });
process.stdout.write('{"event":"check","ok":true}\\n');
`);
    const started = Date.now();
    expect(await run(entry, 0, 2000)).toMatch(/^no end within/);
    expect(Date.now() - started).toBeLessThan(6000);
  }, 30000);
});

describe('GDD-TEC-10 server-log-check: a server stopped while its log\'s reader stalls', () => {
  it('passes a server that writes every line, then exits 0 with nothing on stderr, stopped by SIGTERM or SIGINT', async () => {
    expect(await stopped(fakeServer('server-flush', 'flush'))).toBeNull();
    expect(await stopped(fakeServer('server-flush-int', 'flush'), 'SIGINT')).toBeNull();
  }, 60000);

  it('fails a server that loses the lines still waiting when SIGINT stops it', async () => {
    expect(await stopped(fakeServer('server-cut-int', 'cut-on-int'))).toBeNull();
    const wrong = await stopped(fakeServer('server-cut-int-2', 'cut-on-int'), 'SIGINT');
    expect(wrong).toMatch(/^exit 0, \d+ of 2000 /);
    expect(wrong).not.toMatch(/^exit 0, 2000 of 2000 /);
  }, 60000);

  it('fails a server that exits 1 once its lines are out', async () => {
    expect(await stopped(fakeServer('server-one', 'one'))).toMatch(/^exit 1, 2000 of 2000 /);
  }, 60000);

  it('fails a server that writes to stderr when it stops', async () => {
    expect(await stopped(fakeServer('server-say', 'say'))).toMatch(/^exit 0, 2000 of 2000 request lines read, stderr "stopping\\n/);
  }, 60000);

  it('fails a server that the second signal breaks, as a store closed twice would', async () => {
    const entry = join(dir, 'server-twice.mjs');
    writeFileSync(entry, readFileSync(fakeServer('server-twice-base', 'flush'), 'utf8').replace("const stop = (signal) => {", "let stops = 0;\nconst stop = (signal) => {\n  stops += 1;\n  if (stops === 2) throw new Error('database is not open');"));
    expect(await stopped(entry)).toMatch(/^exit 1, .*database is not open/);
  }, 60000);

  it('fails a server that exits at once and loses the lines still waiting', async () => {
    const wrong = await stopped(fakeServer('server-cut', 'cut'));
    expect(wrong).toMatch(/^exit 0, \d+ of 2000 /);
    expect(wrong).not.toMatch(/^exit 0, 2000 of 2000 /);
  }, 60000);

  it.each(['SIGTERM', 'SIGINT'])('fails a server that ends by itself before its stop, though its every line is out: %s is never tested on it', async (signal) => {
    const entry = join(dir, 'server-ends-first.mjs');
    writeFileSync(entry, `
import { createServer } from 'node:http';
const server = createServer(() => { process.exit(0); });
server.listen(Number(process.env.PONCHO_SERVER_PORT), '127.0.0.1', () => {
  process.stdout.write('{"event":"listening","port":' + server.address().port + '}\\n' + ${JSON.stringify(`${CONFIG_LINE}
`)}.repeat(2000));
});
const broken = () => { process.stderr.write('stopped badly\\n'); process.exit(1); };
process.on('SIGTERM', broken);
process.on('SIGINT', broken);
`);
    expect(await stopped(entry, signal)).toMatch(/^exit 0 before it was stopped \(its requests ended first\), 2000 of 2000 request lines read/);
  }, 60000);

  it('counts only the lines that come after the listening line: lines written before any request is sent are no request\'s', async () => {
    const entry = join(dir, 'server-lines-first.mjs');
    writeFileSync(entry, readFileSync(fakeServer('server-lines-first-base', 'flush'), 'utf8')
      .replace(`res.end('{}'); process.stdout.write(${JSON.stringify(`${CONFIG_LINE}
`)});`, "res.end('{}');")
      .replace("setTimeout(() => {\n  server.listen", `process.stdout.write(${JSON.stringify(`${CONFIG_LINE}
`)}.repeat(2000));\nsetTimeout(() => {\n  server.listen`));
    expect(readFileSync(entry, 'utf8')).toContain('.repeat(2000)');
    expect(await stopped(entry)).toMatch(/^exit 0, 0 of 2000 request lines read/);
  }, 60000);

  it('fails a server that dies part way through the requests, and goes on: a request it refuses ends the asking, not the check', async () => {
    const entry = join(dir, 'server-dies.mjs');
    writeFileSync(entry, `
import { createServer } from 'node:http';
let answered = 0;
const server = createServer((req, res) => {
  res.on('finish', () => { process.stdout.write(${JSON.stringify(`${CONFIG_LINE}\n`)}); answered += 1; if (answered === 50) process.exit(1); });
  res.end('{}');
});
server.listen(Number(process.env.PONCHO_SERVER_PORT), '127.0.0.1', () => { process.stdout.write('{"event":"listening","port":' + server.address().port + '}\\n'); });
`);
    // A write to a pipe or a file is synchronous on Linux, so the 50th line is out before the exit.
    expect(await stopped(entry)).toMatch(/^exit 1 before it was stopped \(its requests ended first\), 50 of 2000 request lines read/);
  }, 60000);
});

/**
 * A fake entry that keeps every rule the check holds it to, as the bundle does: --check writes seven lines (each byte of each when stdout
 * is a file), the seventh after a pause, and fails with the one problem when its site's origin is another; the server writes its lines
 * once their answers are out, and a stop writes every line and exits 0, once. `onInt`: 'cut' exits at once on SIGINT instead.
 * `prelude` is a line run first, to break one rule alone; `lineDelay` writes each request's line that many ms after its answer.
 */
function fakeEntry(name, onInt = 'flush', { prelude = '', lineDelay = 0 } = {}) {
  const path = join(dir, `${name}.mjs`);
  const line = `say(${JSON.stringify(`${CONFIG_LINE}\n`)});`;
  writeFileSync(path, `
import { createServer } from 'node:http';
import { fstatSync, writeSync } from 'node:fs';
import { Socket } from 'node:net';
${prelude}
const complain = (e) => { process.stderr.write('the log cannot be written (' + e.code + ')\\n'); process.exit(1); };
process.stdout.on('error', complain);
const writes = (() => { try { const k = fstatSync(1); if (k.isFile() || k.isCharacterDevice()) return true; } catch { return false; } return process.stdout instanceof Socket; })();
if (!writes) complain({ code: 'EBADF' });
const file = (() => { try { return fstatSync(1).isFile(); } catch { return false; } })();
const say = (text) => {
  if (!file) { process.stdout.write(text); return; }
  const bytes = Buffer.from(text);
  try { for (let at = 0; at < bytes.length;) at += writeSync(1, bytes, at); } catch (e) { complain(e); }
};
const exitAfter = (code) => { setImmediate(() => { if (process.stdout.writableLength === 0) process.exit(code); process.stdout.write('', (e) => { if (!e) process.exit(code); }); }); };
if (process.argv.includes('--check')) {
  for (let n = 1; n <= 6; n += 1) say('{"event":"check","n":' + n + '}\\n');
  setTimeout(() => {
    if (process.env.PONCHO_SITE_ORIGIN === 'http://elsewhere.invalid') {
      process.stderr.write('the nonce route does not refuse another origin\\n');
      exitAfter(1);
    } else {
      say('{"event":"check","ok":true}\\n');
      exitAfter(0);
    }
  }, 300);
} else {
  say('{"event":"boot","note":"a note before listening"}\\n');
  const server = createServer((req, res) => { res.on('finish', () => { ${lineDelay > 0 ? `setTimeout(() => { ${line} }, ${lineDelay});` : line} }); res.end('{}'); });
  setTimeout(() => {
    server.listen(Number(process.env.PONCHO_SERVER_PORT), '127.0.0.1', () => { say('{"event":"listening","port":' + server.address().port + '}\\n'); });
  }, 100);
  let stopping = false;
  const stop = (signal) => {
    if (stopping) return;
    stopping = true;
    server.close();
    server.closeAllConnections();
    if (${JSON.stringify(onInt)} === 'cut' && signal === 'SIGINT') process.exit(0);
    exitAfter(0);
  };
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
}
`);
  return path;
}

describe('GDD-TEC-10 server-log-check: every case, as npm run server:check runs them', () => {
  it('passes an entry that keeps every rule, each case on an ok line of its own, and warns of nothing', async () => {
    const said = { ok: [], fail: [] };
    const warned = [];
    const onWarning = (warning) => { warned.push(warning.name); };
    process.on('warning', onWarning);
    try {
      const code = await main(fakeEntry('entry-good'), { ok: (line) => said.ok.push(line), fail: (line) => said.fail.push(line) });
      expect(said.fail).toEqual([]);
      expect(code).toBe(0);
      expect(said.ok).toHaveLength(11);
      await new Promise((done) => { setImmediate(done); });
      // Node 22 warns once a signal has more listeners than its limit; 2000 requests share the cases' signal.
      expect(warned.filter((name) => name === 'MaxListenersExceededWarning')).toEqual([]);
    } finally {
      process.off('warning', onWarning);
    }
  }, 120000);

  it('fails an entry that breaks one rule, on that case\'s line alone: losing its lines when SIGINT stops it', async () => {
    const said = { ok: [], fail: [] };
    expect(await main(fakeEntry('entry-cut-int', 'cut'), { ok: (line) => said.ok.push(line), fail: (line) => said.fail.push(line) })).toBe(1);
    expect(said.fail).toHaveLength(1);
    expect(said.fail[0]).toMatch(/^FAIL  a server stopped twice by SIGINT /);
    expect(said.ok).toHaveLength(10);
  }, 120000);
});

/** Preludes that break one rule of a case alone: its exit code, or what it says on stderr. */
const EXITS_0 = "process.on('exit', () => { process.exitCode = 0; });";
const EXITS_1 = "process.on('exit', () => { process.exitCode = 1; });";
const SAYS_MORE = "process.stderr.write('a stray line\\n');";

describe('GDD-TEC-10 server-log-check: a log node writes nowhere, and one whose reader read it all', () => {
  it('fails an entry that writes only the EBADF line but exits 0, and one that exits 1 but says more', async () => {
    expect(await nowhere(fakeEntry('nowhere-exits-0', 'flush', { prelude: EXITS_0 }))).toMatch(/^exit 0, stderr "the log cannot be written \(EBADF\)\\n"/);
    expect(await nowhere(fakeEntry('nowhere-says-more', 'flush', { prelude: SAYS_MORE }))).toMatch(/^exit 1, stderr "a stray line\\nthe log cannot be written \(EBADF\)\\n"/);
  }, 30000);

  it('fails a check whose log is /dev/null that says nothing but exits 1, and one that exits 0 but says something', async () => {
    expect(await discarded(fakeEntry('discarded-exits-1', 'flush', { prelude: EXITS_1 }))).toMatch(/^exit 1, stderr ""/);
    expect(await discarded(fakeEntry('discarded-says-more', 'flush', { prelude: SAYS_MORE }))).toMatch(/^exit 0, stderr "a stray line\\n"/);
  }, 30000);

  it('fails a server whose log was read whole that says nothing but exits 1, and one that exits 0 but says something', async () => {
    expect(await drained(fakeEntry('drained-exits-1', 'flush', { prelude: EXITS_1 }))).toMatch(/^exit 1, stderr ""/);
    expect(await drained(fakeEntry('drained-says-more', 'flush', { prelude: SAYS_MORE }))).toMatch(/^exit 0, stderr "a stray line\\n"/);
  }, 30000);

  it('passes a server whose lines come late: the reader reads every line before it leaves', async () => {
    expect(await drained(fakeEntry('drained-late', 'flush', { lineDelay: 150 }))).toBeNull();
  }, 30000);

  it('passes an entry that stops at once with the EBADF line when its log is a directory', async () => {
    expect(await nowhere(fakeEntry('nowhere-good'))).toBeNull();
  }, 30000);

  it('fails an entry that writes its lines to a directory and exits 0', async () => {
    const entry = join(dir, 'nowhere-blind.mjs');
    writeFileSync(entry, readFileSync(fakeEntry('nowhere-blind-base'), 'utf8').replace("if (!writes) complain({ code: 'EBADF' });", ''));
    expect(await nowhere(entry)).toMatch(/^exit 0, stderr ""/);
  }, 30000);

  it('passes a check whose log is /dev/null, and fails one that takes that device for nowhere', async () => {
    expect(await discarded(fakeEntry('discarded-good'))).toBeNull();
    const entry = join(dir, 'discarded-blind.mjs');
    writeFileSync(entry, readFileSync(fakeEntry('discarded-blind-base'), 'utf8').replace('k.isFile() || k.isCharacterDevice()', 'k.isFile()'));
    expect(await discarded(entry)).toMatch(/^exit 1, stderr "the log cannot be written \(EBADF\)\\n"/);
  }, 30000);

  it('fails a server that exits 0 by itself once its reader has left, before the stop is sent: the stop is never tested on it', async () => {
    const entry = join(dir, 'drained-ends-first.mjs');
    writeFileSync(entry, `
import { createServer } from 'node:http';
let answered = 0;
const server = createServer((req, res) => {
  res.end('{}');
  process.stdout.write(${JSON.stringify(`${CONFIG_LINE}
`)});
  answered += 1;
  if (answered === 3) setTimeout(() => { process.exit(0); }, 50);
});
server.listen(Number(process.env.PONCHO_SERVER_PORT), '127.0.0.1', () => { process.stdout.write('{"event":"listening","port":' + server.address().port + '}\\n'); });
`);
    expect(await drained(entry)).toMatch(/^exit 0 before it was stopped/);
  }, 30000);

  it('passes a server that exits 0 when its log\'s reader read every line and left', async () => {
    expect(await drained(fakeEntry('drained-good'))).toBeNull();
  }, 30000);

  it('fails a server whose stop writes nothing and so finds the reader gone', async () => {
    const entry = join(dir, 'drained-marker.mjs');
    writeFileSync(entry, readFileSync(fakeEntry('drained-marker-base'), 'utf8').replace('if (process.stdout.writableLength === 0) process.exit(code); ', ''));
    expect(readFileSync(entry, 'utf8')).not.toContain('writableLength');
    expect(await drained(entry)).toMatch(/^exit 1, stderr "the log cannot be written \(EPIPE\)\\n"/);
  }, 30000);
});

describe('GDD-TEC-10 server-log-check: a reader that leaves after five lines, on a busy machine', () => {
  it('runs a case again that proves nothing (exit 0, nothing said), and fails an entry that never proves it', async () => {
    // It exits 0 whether or not its sixth line could be written, so no run proves anything, however the reads fall.
    const entry = join(dir, 'check-together.mjs');
    writeFileSync(entry, "process.stdout.on('error', () => undefined);\nfor (let n = 1; n <= 6; n += 1) process.stdout.write('{\"n\":' + n + '}\\n');\n");
    const started = Date.now();
    expect(await run(entry, 5)).toMatch(/^exit 0, stderr ""/);
    // Ten runs of a node that starts and ends at once.
    expect(Date.now() - started).toBeGreaterThan(10 * 20);
  }, 60000);
});

describe('GDD-TEC-10 server-log-check: a server whose answers break part way', () => {
  // Its listening line, then to each request a head that promises 100 bytes, 10 of them, and the connection closed.
  const cutEntry = () => {
    const entry = join(dir, 'cut-body.mjs');
    writeFileSync(entry, `
import { createServer } from 'node:net';
const server = createServer((socket) => {
  socket.once('data', () => { socket.end('HTTP/1.1 200 OK\\r\\nContent-Type: application/json\\r\\nContent-Length: 100\\r\\n\\r\\n0123456789'); });
  socket.on('error', () => undefined);
});
server.listen(Number(process.env.PONCHO_SERVER_PORT), '127.0.0.1', () => { process.stdout.write('{"event":"listening","port":' + server.address().port + '}\\n'); });
`);
    return entry;
  };
  it.each([['drained', drained, /^exit SIGTERM, stderr ""/], ['servedFilled', servedFilled, /^exit SIGTERM after 0 answers, expected 4/]])('fails it in the %s case, and goes on: a body that breaks ends the asking, not the check', async (_name, check, said) => {
    expect(await check(cutEntry())).toMatch(said);
  }, 60000);
});

describe('GDD-TEC-10 server-log-check: a server that ends before it listens', () => {
  it('is failed in the filled-file case, and the check goes on: the case\'s wait for its listening line ends with it', async () => {
    const entry = join(dir, 'ends-unlistening.mjs');
    writeFileSync(entry, "process.stderr.write('boot failed\\n'); process.exit(1);\n");
    expect(await servedFilled(entry)).toBe('with its log a file with room, it never wrote its listening line');
    // The case's own wait reads its log once more after the entry is gone; that read failing must not reach this process.
    await new Promise((done) => { setTimeout(done, 200); });
  }, 30000);
});

describe('GDD-TEC-10 server-log-check: a server whose log is a file that fills up', () => {
  it('fails a server that answers one of the four with a 500 before it stops on the cut line', async () => {
    const entry = join(dir, 'filled-500.mjs');
    writeFileSync(entry, readFileSync(fakeEntry('filled-500-base'), 'utf8').replace("res.end('{}');", "served += 1; res.statusCode = served === 2 ? 500 : 200; res.end('{}');").replace('let stopping = false;', 'let stopping = false;\nlet served = 0;'));
    expect(await servedFilled(entry)).toMatch(/after 4 answers, expected 4: \[200,500,200,200/);
  }, 60000);

  it('passes a server that writes each byte and stops with the one line, every request before answered', async () => {
    expect(await servedFilled(fakeEntry('filled-good'))).toBeNull();
  }, 60000);

  it('fails a server that lets node\'s file stream drop a short write and serves on', async () => {
    const entry = join(dir, 'filled-stream.mjs');
    writeFileSync(entry, readFileSync(fakeEntry('filled-stream-base'), 'utf8').replace('if (!file) { process.stdout.write(text); return; }', 'process.stdout.write(text); return;'));
    // The cut line passes unseen and the server answers once more before the next line fails.
    expect(await servedFilled(entry)).toMatch(/^exit 1 after 5 answers, expected 4/);
  }, 60000);

  it('fails a server that stops on the cut line but exits 0, and one that crashes with node\'s own stack', async () => {
    const base = readFileSync(fakeEntry('filled-variants-base'), 'utf8');
    const zero = join(dir, 'filled-zero.mjs');
    writeFileSync(zero, base.replace('catch (e) { complain(e); }', 'catch (e) { process.stderr.write(\'the log cannot be written (\' + e.code + \')\\n\'); process.exit(0); }'));
    expect(await servedFilled(zero)).toMatch(/^exit 0 after 4 answers, stderr "the log cannot be written \(EFBIG\)\\n"/);
    const crash = join(dir, 'filled-crash.mjs');
    writeFileSync(crash, base.replace('catch (e) { complain(e); }', 'catch (e) { throw e; }'));
    expect(await servedFilled(crash)).toMatch(/^exit 1 after 4 answers, stderr ".*EFBIG/);
  }, 60000);
});
