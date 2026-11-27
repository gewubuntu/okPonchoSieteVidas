import { execFile } from 'node:child_process';
import { request as httpRequest, type IncomingHttpHeaders } from 'node:http';
import { connect } from 'node:net';
import { networkInterfaces } from 'node:os';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setTimeout as wait } from 'node:timers/promises';
import { promisify } from 'node:util';
import { isMainThread } from 'node:worker_threads';
import { settingsOf, wire } from '../boot';
import { BODY_LIMIT, json, readBody, refuse, withLine, type RequestLog } from './boundary';
import { serve, SOCKET_LIMITS, targetOf, UNANSWERED_LIMIT, unreadable, type App, type SocketLimits } from './node';

const run = promisify(execFile);

// L-106: a listener the adapter adds for what a client sends, and does not take off, shows as node's MaxListenersExceededWarning
// once one connection holds more than ten. None may come while these tests run, so a guard that bounds such listeners can fail here.
const listenerWarnings: string[] = [];
const onWarning = (warning: Error): void => { if (warning.name === 'MaxListenersExceededWarning') listenerWarnings.push(warning.message); };
beforeAll(() => { process.on('warning', onWarning); });
afterAll(() => {
  process.off('warning', onWarning);
  expect(listenerWarnings).toEqual([]);
});

describe('GDD-TEC-10 adapter: the request target', () => {
  it.each(['/api/v1/config', '/api/v1/lives?pal=7', '/', '/a//b', '/api/v1/config?x=1&y=2', '/api/v1/config%2F', '/a?b=c/d'])('%s is accepted as written', (raw) => {
    expect(targetOf(raw)).toBe(raw);
  });

  it.each([
    ['an absolute-form target', 'http://evil/api/v1/config'],
    ['a dot segment', '/api/v1/../config'],
    ['a dot segment, percent-encoded', '/api/v1/%2e%2e/config'],
    ['a dot segment, percent-encoded in capitals', '/api/v1/%2E%2E/config'],
    ['a single dot segment', '/api/./v1/config'],
    ['backslashes', '/api\\v1\\config'],
    ['a backslash after the slash', '/\\evil/api'],
    ['the asterisk form', '*'],
    ['a network-path reference', '//x/api'],
    ['three slashes', '///x/api'],
    ['a fragment', '/api/v1/config#x'],
    ['an empty target', ''],
    ['no leading slash', 'api/v1/config'],
    ['a space', '/api/v1/con fig'],
    ['a non-ASCII letter', '/api/v1/é'],
    ['an empty query', '/api/v1/config?'],
    ['a scheme and no host', 'mailto:x@y'],
    ['a host that does not parse', 'http://[::1'],
  ])('%s is refused', (_name, raw) => {
    expect(targetOf(raw)).toBeNull();
  });
});

interface Answer { readonly status: number; readonly headers: IncomingHttpHeaders; readonly text: string }

/** One request on 127.0.0.1:`port`, written as given; `chunks` are written one by one (chunked), and a write that fails once the answer is in is ignored. */
function ask(port: number, options: { method: string; path: string; headers?: Record<string, string>; chunks?: readonly Buffer[] }): Promise<Answer> {
  return new Promise((resolve, reject) => {
    const req = httpRequest({ host: '127.0.0.1', port, method: options.method, path: options.path, headers: options.headers, agent: false }, (res) => {
      const parts: Buffer[] = [];
      res.on('data', (part: Buffer) => parts.push(part));
      res.on('end', () => { resolve({ status: res.statusCode ?? 0, headers: res.headers, text: Buffer.concat(parts).toString() }); });
      res.on('error', reject);
    });
    let answered = false;
    req.on('response', () => { answered = true; });
    req.on('error', (error) => { if (!answered) reject(error); });
    for (const chunk of options.chunks ?? []) req.write(chunk);
    req.end();
  });
}

/** The size of /big's answer: more than the kernel's buffers of a loopback connection hold, so a client that reads nothing stalls it. */
const BIG = 24 << 20;
/** The paths the stub was called with, in order. */
const calls: string[] = [];
/** What /limited's readBody gave, in order: 'ok', or the refusal's status. */
const reads: (string | number)[] = [];
/**
 * What the adapter hands its requests to: /echo gives back what reached it, /limited reads the body under the limit, /slow answers after
 * 100 ms, /slower after 600 ms and /held after 2.5 s, /big answers BIG bytes, /bignope refuses BIG bytes unread, /nope-late refuses unread after a wait,
 * /throw rejects and /throw-late rejects after 200 ms, /lined answers after 200 ms with a line of its own, and /biglined answers BIG
 * bytes with one, and /cancel-big gives up on its body and answers BIG bytes with one. Only those three carry a line, so the log
 * holds the adapter's lines and theirs. /framed answers with every header that frames an answer or concerns its connection, and
 * /badhdr with a header before one node refuses. /error and /error-late (after 100 ms) answer Response.error(), /s204 a 204 and
 * /s304 a 304 that names a length of its own.
 */
const stub: App = async (request) => {
  const path = new URL(request.url).pathname;
  calls.push(path);
  if (path === '/echo') {
    const text = await request.text();
    return json(200, { url: request.url, method: request.method, text }, ['a=1; Path=/api', 'b=2']);
  }
  if (path === '/limited') {
    const read = await readBody(request, BODY_LIMIT);
    reads.push(read.ok ? 'ok' : read.status);
    return read.ok ? json(200, {}) : refuse(read.status, read.reason);
  }
  if (path === '/slow') {
    await wait(100);
    return json(200, {});
  }
  if (path === '/slower') {
    await wait(600);
    return json(200, {});
  }
  if (path === '/held') {
    await wait(2500);
    return json(200, {});
  }
  if (path === '/big') return new Response(new Uint8Array(BIG), { status: 200 });
  if (path === '/bignope') return new Response(new Uint8Array(BIG), { status: 404 });
  if (path === '/nope-late') {
    await wait(20);
    return refuse(404, 'no such route');
  }
  if (path === '/throw') throw new Error('zz-thrown');
  if (path === '/throw-late') {
    await wait(200);
    throw new Error('zz-thrown');
  }
  if (path === '/lined') {
    await wait(200);
    return withLine(json(200, {}), { method: 'GET', route: '/lined', status: 200 });
  }
  if (path === '/biglined') return withLine(new Response(new Uint8Array(BIG), { status: 200 }), { method: 'GET', route: '/biglined', status: 200 });
  if (path === '/framed') {
    return new Response('hello', { headers: { connection: 'keep-alive', 'keep-alive': 'timeout=99', 'proxy-connection': 'zz-app', te: 'zz-app', trailer: 'x-zz-app', 'transfer-encoding': 'chunked', upgrade: 'zz-app', 'content-length': '999', 'x-kept': 'yes' } });
  }
  if (path === '/error') return Response.error();
  if (path === '/error-late') {
    await wait(100);
    return Response.error();
  }
  if (path === '/s204') return new Response(null, { status: 204 });
  if (path === '/s304') return new Response(null, { status: 304, headers: { 'content-length': '5' } });
  if (path === '/badhdr') return new Response('hello', { headers: { 'a-kept': 'zz-app-value', 'z-bad': 'x\u0001y' } });
  if (path === '/cancel-big') {
    await request.body?.cancel();
    return withLine(new Response(new Uint8Array(BIG), { status: 200 }), { method: 'POST', route: '/cancel-big', status: 200 });
  }
  return refuse(404, 'no such route');
};

interface Exchanged { readonly text: string; readonly closedByServer: boolean; readonly ms: number }
/**
 * One raw connection: `writes` are written `gap` ms apart, and every byte answered is kept until the server closes the connection, or
 * until `ms` have passed (then it is closed here). `paused`: nothing is read for that long first, as from a client that reads no answers.
 */
function exchange(port: number, writes: readonly string[], options: { gap?: number; ms?: number; paused?: number } = {}): Promise<Exchanged> {
  const { gap = 0, ms = 1500, paused = 0 } = options;
  return new Promise((resolve) => {
    const started = Date.now();
    const socket = connect({ host: '127.0.0.1', port });
    const parts: Buffer[] = [];
    let mine = false;
    const timer = setTimeout(() => { mine = true; socket.destroy(); }, ms);
    socket.on('data', (part: Buffer) => parts.push(part));
    socket.on('error', () => { /* a reset is read as the server's close */ });
    socket.on('close', () => {
      clearTimeout(timer);
      resolve({ text: Buffer.concat(parts).toString('latin1'), closedByServer: !mine, ms: Date.now() - started });
    });
    if (paused > 0) {
      socket.pause();
      setTimeout(() => { socket.resume(); }, paused);
    }
    writes.forEach((text, i) => { setTimeout(() => { if (!socket.destroyed) socket.write(text); }, i * gap); });
  });
}
/** The status of each answer in `text`, in order: a pipelined answer's status line follows the body before it with no line break. */
const statuses = (text: string): number[] => [...text.matchAll(/HTTP\/1\.1 (\d{3}) /g)].map((match) => Number(match[1]));

/** The adapter on `app` with a log kept here. */
async function served(app: App = stub, limits?: SocketLimits) {
  calls.length = 0;
  reads.length = 0;
  const log: RequestLog[] = [];
  const server = await serve(app, 0, (line) => { log.push(line); }, limits);
  return { server, log };
}

describe('GDD-TEC-10 adapter: the socket', () => {
  it('a body reaches the app, two Set-Cookie lines come back, and a refused target, TRACE and an over-long chunked body get their answers', async () => {
    const { server, log } = await served();
    try {
      const { port } = server;
      // A POST body reaches the app; the host is the adapter's own, not the client's Host or X-Forwarded-Host; two cookies are two lines.
      const echoed = await ask(port, { method: 'POST', path: '/echo?q=1', headers: { host: 'evil.example', 'x-forwarded-host': 'evil2.example', 'content-type': 'application/json' }, chunks: [Buffer.from('{"a":'), Buffer.from('1}')] });
      expect(echoed.status).toBe(200);
      expect(JSON.parse(echoed.text)).toEqual({ url: 'http://api.invalid/echo?q=1', method: 'POST', text: '{"a":1}' });
      expect(echoed.headers['set-cookie']).toEqual(['a=1; Path=/api', 'b=2']);
      expect(echoed.headers['content-type']).toBe('application/json; charset=utf-8');
      expect(echoed.headers['cache-control']).toBe('no-store');
      // An answer goes out whole, its length given, never in chunks (writeWhole).
      expect(echoed.headers['content-length']).toBe(String(Buffer.byteLength(echoed.text)));
      expect(echoed.headers['transfer-encoding']).toBeUndefined();
      // A GET and a HEAD have no body to read: they reach the app too.
      const got = await ask(port, { method: 'GET', path: '/echo' });
      expect(got.status).toBe(200);
      expect(JSON.parse(got.text)).toEqual({ url: 'http://api.invalid/echo', method: 'GET', text: '' });
      const head = await ask(port, { method: 'HEAD', path: '/echo' });
      expect(head.status).toBe(200);
      expect(head.text).toBe('');
      expect(head.headers['content-type']).toBe('application/json; charset=utf-8');
      // An answer with no cookie has no Set-Cookie line.
      expect((await ask(port, { method: 'POST', path: '/limited', headers: { 'content-type': 'application/json' }, chunks: [Buffer.from('{}')] })).headers['set-cookie']).toBeUndefined();
      // An absolute-form target is refused before the app, and its line names no route and nothing of the target.
      log.length = 0;
      const absolute = await ask(port, { method: 'GET', path: 'http://evil.example/echo' });
      expect(absolute.status).toBe(400);
      expect(JSON.parse(absolute.text)).toEqual({ error: 'no such route' });
      expect(absolute.headers['content-type']).toBe('application/json; charset=utf-8');
      expect(absolute.headers['cache-control']).toBe('no-store');
      // A dot segment, too.
      expect((await ask(port, { method: 'GET', path: '/a/../echo' })).status).toBe(400);
      // TRACE is a method Request refuses.
      const trace = await ask(port, { method: 'TRACE', path: '/echo' });
      expect(trace.status).toBe(405);
      expect(JSON.parse(trace.text)).toEqual({ error: 'no such method' });
      expect(trace.headers['allow']).toBe('GET, POST');
      expect(log).toEqual([
        { method: 'GET', route: '(none)', status: 400 },
        { method: 'GET', route: '(none)', status: 400 },
        { method: '(other)', route: '(none)', status: 405 },
      ]);
      expect(Object.keys(log[0] ?? {})).toEqual(['method', 'route', 'status']);
      expect(JSON.stringify(log)).not.toMatch(/evil|echo|\.\./);
      // A body of 70000 bytes in chunks, over the limit: 413, and the connection is not kept.
      const chunks = Array.from({ length: 10 }, () => Buffer.alloc(7000, 97));
      const large = await ask(port, { method: 'POST', path: '/limited', headers: { 'content-type': 'application/json', 'transfer-encoding': 'chunked', connection: 'keep-alive' }, chunks });
      expect(large.status).toBe(413);
      expect(JSON.parse(large.text)).toEqual({ error: 'the body is too large' });
      expect(large.headers['connection']).toBe('close');
      // A short body that was read to its end keeps the connection open.
      const small = await ask(port, { method: 'POST', path: '/limited', headers: { 'content-type': 'application/json', connection: 'keep-alive' }, chunks: [Buffer.from('{}')] });
      expect(small.status).toBe(200);
      expect(small.headers['connection']).toBe('keep-alive');
    } finally {
      await server.close();
    }
  }, 5000);
});

/** Whether a connection to `host:port` is accepted. */
const reachable = (host: string, port: number): Promise<boolean> =>
  new Promise((resolve) => {
    const socket = connect({ host, port });
    socket.once('connect', () => { socket.destroy(); resolve(true); });
    socket.once('error', () => { resolve(false); });
  });

describe('GDD-TEC-10 adapter: CONNECT, a throw, a log that throws', () => {
  it('a CONNECT gets the answer TRACE gets, its line is logged, the connection is closed, and the server goes on serving', async () => {
    const { server, log } = await served();
    try {
      const answered = await exchange(server.port, ['CONNECT api.invalid:443 HTTP/1.1\r\nHost: api.invalid:443\r\nCookie: s=zz-secret\r\n\r\n']);
      expect(answered.closedByServer).toBe(true);
      const [head = '', body] = answered.text.split('\r\n\r\n');
      const [statusLine, ...headerLines] = head.split('\r\n');
      expect(statusLine).toBe('HTTP/1.1 405 Method Not Allowed');
      expect(Object.fromEntries(headerLines.map((line) => line.split(': ')))).toEqual({
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
        allow: 'GET, POST',
        connection: 'close',
        'content-length': '26',
      });
      expect(body).toBe('{"error":"no such method"}');
      expect(log).toEqual([{ method: '(other)', route: '(none)', status: 405 }]);
      expect(calls).toEqual([]);
      expect((await ask(server.port, { method: 'GET', path: '/echo' })).status).toBe(200);
    } finally {
      await server.close();
    }
  }, 5000);

  it('a CONNECT whose client resets the connection at once ends nothing but that connection', async () => {
    const { server } = await served();
    try {
      for (let i = 0; i < 20; i += 1) {
        await new Promise<void>((resolve) => {
          const socket = connect({ host: '127.0.0.1', port: server.port });
          socket.on('error', () => { /* the reset is this end's own */ });
          socket.on('close', () => { resolve(); });
          socket.write('CONNECT api.invalid:443 HTTP/1.1\r\nHost: x\r\n\r\n', () => { socket.resetAndDestroy(); });
        });
      }
      await wait(50);
      expect((await ask(server.port, { method: 'GET', path: '/echo' })).status).toBe(200);
    } finally {
      await server.close();
    }
  }, 5000);

  it('a CONNECT waits its turn: the answers to the requests before it on the connection are sent first, then its 405', async () => {
    const { server, log } = await served();
    try {
      const behindPost = await exchange(server.port, ['POST /echo HTTP/1.1\r\nHost: x\r\nContent-Length: 2\r\n\r\n{}CONNECT x:443 HTTP/1.1\r\nHost: x\r\n\r\n']);
      expect(statuses(behindPost.text)).toEqual([200, 405]);
      expect(behindPost.closedByServer).toBe(true);
      const behindSlow = await exchange(server.port, ['GET /slow HTTP/1.1\r\nHost: x\r\n\r\nCONNECT x:443 HTTP/1.1\r\nHost: x\r\n\r\n']);
      expect(statuses(behindSlow.text)).toEqual([200, 405]);
      expect(calls).toEqual(['/echo', '/slow']);
      expect(log).toEqual([{ method: '(other)', route: '(none)', status: 405 }, { method: '(other)', route: '(none)', status: 405 }]);
    } finally {
      await server.close();
    }
  }, 5000);

  it('a CONNECT behind an answer its client never reads is cut with the connection at the idle limit, and never answered', async () => {
    const { server, log } = await served(stub, IDLE);
    try {
      const answered = await exchange(server.port, ['GET /big HTTP/1.1\r\nHost: x\r\n\r\nCONNECT x:443 HTTP/1.1\r\nHost: x\r\n\r\n'], { paused: IDLE.idleMs * 4, ms: IDLE.idleMs * 4 + 2000 });
      expect(answered.closedByServer).toBe(true);
      expect(answered.text.length).toBeLessThan(BIG);
      expect(statuses(answered.text)).toEqual([200]);
      expect(log).toEqual([]);
    } finally {
      await server.close();
    }
  }, 5000);

  it('an app\'s headers that frame the answer or concern its connection are dropped: the adapter alone frames it and keeps or closes it', async () => {
    const { server } = await served();
    try {
      const kept = await exchange(server.port, [`GET /framed HTTP/1.1\r\nHost: x\r\n\r\n${GET_ECHO}`], { ms: 1500 });
      expect(statuses(kept.text)).toEqual([200, 200]);
      const head = kept.text.slice(0, kept.text.indexOf('\r\n\r\n')).toLowerCase();
      expect(head).toContain('x-kept: yes');
      expect(head).toContain('content-length: 5');
      for (const gone of ['zz-app', 'timeout=99', 'transfer-encoding', 'trailer']) expect(head).not.toContain(gone);
      expect(kept.text).toContain('\r\n\r\nhelloHTTP/1.1 200 ');
      // HTTP/1.0 with no keep-alive of its own: the app's connection header keeps nothing, so the bytes after it are never read.
      const closed = await exchange(server.port, ['GET /framed HTTP/1.0\r\n\r\nGET /echo HTTP/1.0\r\n\r\n'], { ms: 1500 });
      expect(statuses(closed.text)).toEqual([200]);
      expect(closed.closedByServer).toBe(true);
    } finally {
      await server.close();
    }
  }, 5000);

  it('an app\'s network error is answered with the adapter\'s 500, and its client gone first ends nothing', async () => {
    const { server, log } = await served();
    try {
      const answered = await exchange(server.port, ['GET /error HTTP/1.1\r\nHost: x\r\n\r\n'], { ms: 1500 });
      expect(statuses(answered.text)).toEqual([500]);
      expect(log).toEqual([{ method: 'GET', route: '(none)', status: 500 }]);
      // The client leaves 30 ms in, before the app answers at 100 ms: no answer is written, no line, and the server serves on.
      await new Promise<void>((resolve) => {
        const socket = connect({ host: '127.0.0.1', port: server.port });
        socket.on('error', () => { /* this end's own */ });
        socket.write('GET /error-late HTTP/1.1\r\nHost: x\r\n\r\n', () => { setTimeout(() => { socket.destroy(); resolve(); }, 30); });
      });
      await wait(300);
      expect(log).toHaveLength(1);
      expect((await ask(server.port, { method: 'GET', path: '/echo' })).status).toBe(200);
    } finally {
      await server.close();
    }
  }, 5000);

  it('a 204 and a 304 carry no length, the app\'s own neither, and their connection is kept', async () => {
    const { server } = await served();
    try {
      for (const path of ['/s204', '/s304']) {
        const answered = await exchange(server.port, [`GET ${path} HTTP/1.1\r\nHost: x\r\n\r\n${GET_ECHO}`], { ms: 1500 });
        expect(statuses(answered.text), path).toEqual([Number(path.slice(2)), 200]);
        expect(answered.text.slice(0, answered.text.indexOf('\r\n\r\n')).toLowerCase(), path).not.toContain('content-length');
      }
    } finally {
      await server.close();
    }
  }, 5000);

  it('a GET and a HEAD that declare a body are answered by the app, which is handed no body', async () => {
    const { server } = await served();
    try {
      const got = await exchange(server.port, ['GET /echo HTTP/1.1\r\nHost: x\r\nContent-Length: 2\r\nConnection: close\r\n\r\n{}'], { ms: 1500 });
      expect(statuses(got.text)).toEqual([200]);
      expect(got.text).toContain('"method":"GET","text":""');
      const head = await exchange(server.port, ['HEAD /echo HTTP/1.1\r\nHost: x\r\nContent-Length: 2\r\nConnection: close\r\n\r\n{}'], { ms: 1500 });
      expect(statuses(head.text)).toEqual([200]);
    } finally {
      await server.close();
    }
  }, 5000);

  it('a request that declares no body is refused unread with its connection kept: nothing of it lies unread', async () => {
    const { server } = await served();
    try {
      for (const head of ['POST /zz HTTP/1.1\r\nHost: x\r\nContent-Length: 0\r\n\r\n', 'DELETE /zz HTTP/1.1\r\nHost: x\r\n\r\n']) {
        const answered = await exchange(server.port, [`${head}${GET_ECHO}`], { ms: 1500 });
        expect(statuses(answered.text), head).toEqual([404, 200]);
        expect(answered.text, head).not.toContain('connection: close');
      }
      // One that declares a body it never sends is still closed when refused: what follows would be read as that body.
      const declared = await exchange(server.port, [`POST /zz HTTP/1.1\r\nHost: x\r\nContent-Length: 2\r\n\r\n`], { ms: 1500 });
      expect(declared.text).toContain('connection: close');
    } finally {
      await server.close();
    }
  }, 5000);

  it('the adapter\'s own 500 carries none of the headers the failed answer had set', async () => {
    const { server, log } = await served();
    try {
      const answered = await exchange(server.port, ['GET /badhdr HTTP/1.1\r\nHost: x\r\n\r\n'], { ms: 1500 });
      expect(statuses(answered.text)).toEqual([500]);
      expect(answered.text).not.toContain('zz-app-value');
      expect(log).toEqual([{ method: 'GET', route: '(none)', status: 500 }]);
    } finally {
      await server.close();
    }
  }, 5000);

  it('an app that rejects gets the adapter\'s own 500, with the fixed headers, nothing of why, a line, and the connection closed', async () => {
    const { server, log } = await served();
    try {
      const answer = await ask(server.port, { method: 'GET', path: '/throw' });
      expect(answer.status).toBe(500);
      expect(answer.text).toBe('{"error":"server error"}');
      expect(answer.headers['content-length']).toBe(String(answer.text.length));
      expect(answer.headers['content-type']).toBe('application/json; charset=utf-8');
      expect(answer.headers['cache-control']).toBe('no-store');
      expect(log).toEqual([{ method: 'GET', route: '(none)', status: 500 }]);
      expect(JSON.stringify(log)).not.toContain('zz-thrown');
      // On a connection the client asks to keep, too: the adapter closes it.
      const kept = await exchange(server.port, ['GET /throw HTTP/1.1\r\nHost: x\r\n\r\n'], { ms: 1000 });
      expect(statuses(kept.text)).toEqual([500]);
      expect(kept.text).toContain('connection: close');
      expect(kept.closedByServer).toBe(true);
    } finally {
      await server.close();
    }
  }, 5000);

  it('a log that throws changes none of the real app\'s answers', async () => {
    const settled = settingsOf({}, () => { throw new Error('no config file is read'); });
    if (!('settings' in settled)) throw new Error('the default settings do not read');
    const wired = await wire(settled.settings);
    const server = await serve(wired.app, 0, () => { throw new Error('zz-log'); });
    try {
      const config = await ask(server.port, { method: 'GET', path: '/api/v1/config' });
      expect(config.status).toBe(200);
      expect(config.headers['content-type']).toBe('application/json; charset=utf-8');
      expect(config.text).not.toContain('zz-log');
      expect((await ask(server.port, { method: 'GET', path: '/nope' })).status).toBe(404);
    } finally {
      await server.close();
      wired.close();
    }
  }, 5000);

  it('a log that throws changes none of the adapter\'s answers', async () => {
    const server = await serve(stub, 0, () => { throw new Error('zz-log'); });
    try {
      expect((await ask(server.port, { method: 'TRACE', path: '/echo' })).status).toBe(405);
      expect((await ask(server.port, { method: 'GET', path: '/a/../echo' })).status).toBe(400);
      expect(statuses((await exchange(server.port, ['CONNECT x:443 HTTP/1.1\r\nHost: x\r\n\r\n'])).text)).toEqual([405]);
      expect((await ask(server.port, { method: 'GET', path: '/echo' })).status).toBe(200);
    } finally {
      await server.close();
    }
  }, 5000);
});

describe('GDD-TEC-10 adapter: the requests of one connection take turns', () => {
  it('a request pipelined behind an answer that closes the connection never reaches the app', async () => {
    const { server } = await served();
    try {
      // HTTP/1.0 that does not ask to keep the connection: node closes it after its answer.
      const answered = await exchange(server.port, ['GET /echo HTTP/1.0\r\nHost: x\r\n\r\nGET /throw HTTP/1.0\r\nHost: x\r\n\r\n']);
      expect(statuses(answered.text)).toEqual([200]);
      expect(answered.closedByServer).toBe(true);
      await wait(50);
      expect(calls).toEqual(['/echo']);
    } finally {
      await server.close();
    }
  }, 5000);

  it('pipelined requests the connection is kept for are all answered, in order, one after the other', async () => {
    const { server } = await served();
    try {
      const answered = await exchange(server.port, ['GET /slow HTTP/1.1\r\nHost: x\r\n\r\nGET /echo HTTP/1.1\r\nHost: x\r\n\r\nGET /nope HTTP/1.1\r\nHost: x\r\nConnection: close\r\n\r\n']);
      expect(statuses(answered.text)).toEqual([200, 200, 404]);
      expect(calls).toEqual(['/slow', '/echo', '/nope']);
    } finally {
      await server.close();
    }
  }, 5000);

  it('a request pipelined behind one whose client reset the connection never reaches the app', async () => {
    const { server } = await served();
    try {
      await new Promise<void>((resolve) => {
        const socket = connect({ host: '127.0.0.1', port: server.port });
        socket.on('error', () => { /* the reset is this end's own */ });
        socket.on('close', () => { resolve(); });
        socket.write('GET /slow HTTP/1.1\r\nHost: x\r\n\r\nGET /echo HTTP/1.1\r\nHost: x\r\n\r\n', () => { setTimeout(() => { socket.resetAndDestroy(); }, 20); });
      });
      await wait(250);
      expect(calls).toEqual(['/slow']);
    } finally {
      await server.close();
    }
  }, 5000);

  it('a POST refused unread behind a slow answer closes the connection too, though its body came whole before its turn', async () => {
    const { server } = await served();
    try {
      const answered = await exchange(server.port, ['GET /slow HTTP/1.1\r\nHost: x\r\n\r\nPOST /nope HTTP/1.1\r\nHost: x\r\nContent-Length: 2\r\n\r\n{}GET /echo HTTP/1.1\r\nHost: x\r\n\r\n']);
      expect(statuses(answered.text)).toEqual([200, 404]);
      expect(answered.text).toContain('connection: close');
      await wait(50);
      expect(calls).toEqual(['/slow', '/nope']);
    } finally {
      await server.close();
    }
  }, 5000);

  it('a GET with a body, which the app is never handed, closes the connection, first or behind a slow answer', async () => {
    const { server } = await served();
    try {
      const withBody = 'GET /echo HTTP/1.1\r\nHost: x\r\nContent-Length: 2\r\n\r\n{}';
      expect(statuses((await exchange(server.port, [`${withBody}${GET_ECHO}`])).text)).toEqual([200]);
      expect(statuses((await exchange(server.port, [`GET /slow HTTP/1.1\r\nHost: x\r\n\r\n${withBody}${GET_ECHO}`])).text)).toEqual([200, 200]);
      await wait(50);
      expect(calls).toEqual(['/echo', '/slow', '/echo']);
    } finally {
      await server.close();
    }
  }, 5000);

  it('a request pipelined behind a POST the app refused unread never reaches the app: that answer closes the connection', async () => {
    const { server } = await served();
    try {
      // /nope answers 404 without reading its body, so its answer closes the connection (send).
      const answered = await exchange(server.port, ['POST /nope HTTP/1.1\r\nHost: x\r\nContent-Length: 2\r\n\r\n{}GET /echo HTTP/1.1\r\nHost: x\r\n\r\n']);
      expect(statuses(answered.text)).toEqual([404]);
      expect(answered.text).toContain('connection: close');
      await wait(50);
      expect(calls).toEqual(['/nope']);
    } finally {
      await server.close();
    }
  }, 5000);
});

/**
 * Limits small enough for a test to wait them out: the headers, a request, node's check of the two, a connection's idling and a kept
 * connection's wait. The idle limit is far over the 100 ms between a trickling client's writes, so a busy machine never cuts one early;
 * IDLE has a short one, for the tests of a client that reads nothing.
 */
const SMALL: SocketLimits = { requestMs: 1200, headersMs: 400, checkMs: 50, idleMs: 2000, keptMs: 400 };
const IDLE: SocketLimits = { ...SMALL, idleMs: 300 };

const GET_ECHO = 'GET /echo HTTP/1.1\r\nHost: x\r\n\r\n';
/** An error as node gives it, with a code and a text no answer may hold. */
const coded = (code: string): Error => Object.assign(new Error('zz-secret'), { code });
/** The head of an answer in `text` (its status line and headers) as an object, and its body; `text` holds that one answer. */
function headOf(text: string): { readonly status: string; readonly headers: Record<string, string>; readonly body: string } {
  const [head = '', body = ''] = text.split('\r\n\r\n');
  const [status = '', ...lines] = head.split('\r\n');
  return { status, headers: Object.fromEntries(lines.map((line) => { const at = line.indexOf(': '); return [line.slice(0, at).toLowerCase(), line.slice(at + 2)]; })), body };
}

describe('GDD-TEC-10 adapter: requests left unanswered', () => {
  it('16 requests pipelined at once are all answered, in order', async () => {
    const { server } = await served();
    try {
      const answered = await exchange(server.port, [GET_ECHO.repeat(UNANSWERED_LIMIT - 1) + 'GET /echo HTTP/1.1\r\nHost: x\r\nConnection: close\r\n\r\n']);
      expect(statuses(answered.text)).toEqual(Array.from({ length: UNANSWERED_LIMIT }, () => 200));
    } finally {
      await server.close();
    }
  }, 5000);

  it('a 17th request unanswered closes the connection, and none of them is run', async () => {
    const { server } = await served();
    try {
      const answered = await exchange(server.port, [GET_ECHO.repeat(UNANSWERED_LIMIT + 1)]);
      expect(answered.closedByServer).toBe(true);
      expect(statuses(answered.text)).toEqual([]);
      await wait(50);
      expect(calls).toEqual([]);
    } finally {
      await server.close();
    }
  }, 5000);

  it('requests sent one after another, each once the one before is answered, are all answered, however many there are', async () => {
    const { server } = await served();
    try {
      const count = UNANSWERED_LIMIT + 4;
      const writes = Array.from({ length: count }, (_, i) => (i === count - 1 ? 'GET /echo HTTP/1.1\r\nHost: x\r\nConnection: close\r\n\r\n' : GET_ECHO));
      const answered = await exchange(server.port, writes, { gap: 25, ms: 4000 });
      expect(statuses(answered.text)).toEqual(Array.from({ length: count }, () => 200));
      expect(answered.closedByServer).toBe(true);
    } finally {
      await server.close();
    }
  }, 8000);

  it('the limit is 16', () => {
    expect(UNANSWERED_LIMIT).toBe(16);
  });
});

describe('GDD-TEC-10 adapter: what node cannot read, and what it hands over', () => {
  it('bytes that do not read as a request are answered 400 with the fixed headers and a line', async () => {
    const { server, log } = await served();
    try {
      const answered = await exchange(server.port, ['NOT A REQUEST\r\n\r\n']);
      const { status, headers, body } = headOf(answered.text);
      expect(status).toBe('HTTP/1.1 400 Bad Request');
      expect(headers).toEqual({ 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', connection: 'close', 'content-length': '37' });
      expect(body).toBe('{"error":"the request does not read"}');
      expect(answered.closedByServer).toBe(true);
      expect(log).toEqual([{ method: '(other)', route: '(none)', status: 400 }]);
    } finally {
      await server.close();
    }
  }, 5000);

  it('bad bytes after requests: the one being answered and those waiting, all read before them, are answered in turn, then the 400', async () => {
    const { server, log } = await served();
    try {
      // The bad bytes 50 ms later, while /slow is being answered and /echo waits.
      const answered = await exchange(server.port, ['GET /slow HTTP/1.1\r\nHost: x\r\n\r\nGET /echo HTTP/1.1\r\nHost: x\r\n\r\n', 'NOT A REQUEST\r\n\r\n'], { gap: 50 });
      expect(statuses(answered.text)).toEqual([200, 200, 400]);
      expect(calls).toEqual(['/slow', '/echo']);
      expect(log).toEqual([{ method: '(other)', route: '(none)', status: 400 }]);
    } finally {
      await server.close();
    }
  }, 5000);

  it('bad bytes in the same read as requests: every request before them is answered, in turn, and the 400 comes last', async () => {
    const { server } = await served();
    try {
      // Node may give up on the bytes before any turn has started; each request it read before them still gets its answer.
      const answered = await exchange(server.port, ['POST /echo HTTP/1.1\r\nHost: x\r\nContent-Length: 2\r\n\r\n{}GET /slow HTTP/1.1\r\nHost: x\r\n\r\nNOT A REQUEST\r\n\r\n']);
      await wait(150);
      expect(statuses(answered.text)).toEqual([200, 200, 400]);
      expect(calls).toEqual(['/echo', '/slow']);
    } finally {
      await server.close();
    }
  }, 5000);

  it('a body that breaks while it is read is answered 400 at once, and the app reads it as not whole', async () => {
    const { server } = await served();
    try {
      const answered = await exchange(server.port, ['POST /limited HTTP/1.1\r\nHost: x\r\nTransfer-Encoding: chunked\r\n\r\n2\r\n{}\r\nZZ\r\n']);
      expect(statuses(answered.text)).toEqual([400]);
      expect(answered.closedByServer).toBe(true);
      await wait(50);
      expect(reads).toEqual([408]);
    } finally {
      await server.close();
    }
  }, 5000);

  it('a client that resets in the middle of its headers is answered nothing and leaves no line, and the server goes on serving', async () => {
    const { server, log } = await served();
    try {
      await new Promise<void>((resolve) => {
        const socket = connect({ host: '127.0.0.1', port: server.port });
        socket.on('error', () => { /* the reset is this end's own */ });
        socket.on('close', () => { resolve(); });
        socket.write('GET /echo HTTP/1.1\r\nHost: x\r\nX-Half', () => { setTimeout(() => { socket.resetAndDestroy(); }, 20); });
      });
      await wait(100);
      expect(log).toEqual([]);
      expect((await ask(server.port, { method: 'GET', path: '/echo' })).status).toBe(200);
    } finally {
      await server.close();
    }
  }, 5000);

  it('a client that resets in the middle of a body is answered nothing and leaves no line of the adapter\'s own; the app reads the body as not whole', async () => {
    const { server, log } = await served();
    try {
      await new Promise<void>((resolve) => {
        const socket = connect({ host: '127.0.0.1', port: server.port });
        socket.on('error', () => { /* the reset is this end's own */ });
        socket.on('close', () => { resolve(); });
        socket.write('POST /limited HTTP/1.1\r\nHost: x\r\nContent-Length: 100\r\n\r\n{"a":', () => { setTimeout(() => { socket.resetAndDestroy(); }, 50); });
      });
      await wait(100);
      expect(reads).toEqual([408]);
      expect(log).toEqual([]);
      expect((await ask(server.port, { method: 'GET', path: '/echo' })).status).toBe(200);
    } finally {
      await server.close();
    }
  }, 5000);

  it('a waiting request node gave up on part way is never run: the one before it is answered, then the 408', async () => {
    const { server } = await served(stub, { ...SMALL, requestMs: 300, headersMs: 200 });
    try {
      // /slower takes 600 ms; the POST behind it never sends the rest of its body, so node gives up on it while /slower is answered.
      const answered = await exchange(server.port, ['GET /slower HTTP/1.1\r\nHost: x\r\n\r\nPOST /limited HTTP/1.1\r\nHost: x\r\nContent-Length: 100\r\n\r\n{'], { ms: 3000 });
      expect(statuses(answered.text)).toEqual([200, 408]);
      expect(calls).toEqual(['/slower']);
      expect(reads).toEqual([]);
    } finally {
      await server.close();
    }
  }, 5000);

  it('nothing is read once node gave up, though node resumes the socket once an answer it held back drains', async () => {
    const { server } = await served(stub, { ...SMALL, requestMs: 1200, headersMs: 400, idleMs: 4000 });
    try {
      // /big fills the socket's buffers while the client reads nothing, so node stops reading for it and resumes once the client
      // reads. The POST's 1.2 s run out while /slower waits behind /big; its rest, and 17 requests, come after the 408 is decided.
      const text = await new Promise<string>((resolve) => {
        const socket = connect({ host: '127.0.0.1', port: server.port });
        const parts: Buffer[] = [];
        socket.pause();
        socket.on('data', (part: Buffer) => parts.push(part));
        socket.on('error', () => { /* the server's close */ });
        socket.on('close', () => { resolve(Buffer.concat(parts).toString('latin1')); });
        socket.write('GET /big HTTP/1.1\r\nHost: x\r\n\r\n');
        setTimeout(() => { socket.write('GET /slower HTTP/1.1\r\nHost: x\r\n\r\nPOST /limited HTTP/1.1\r\nHost: x\r\nContent-Length: 10\r\n\r\n{'); }, 100);
        setTimeout(() => { socket.write(`"a":1234}${GET_ECHO.repeat(UNANSWERED_LIMIT + 1)}`); }, 1500);
        setTimeout(() => { socket.resume(); }, 1600);
        setTimeout(() => { socket.destroy(); }, 7000);
      });
      expect(statuses(text)).toEqual([200, 200, 408]);
      expect(calls).toEqual(['/big', '/slower']);
      expect(reads).toEqual([]);
    } finally {
      await server.close();
    }
  }, 10000);

  it.each([
    ['a body it held back is read', [[0, 'GET /held HTTP/1.1\r\nHost: x\r\n\r\nPOST /zz HTTP/1.1\r\nHost: x\r\nContent-Type: application/json\r\nContent-Length: 66000\r\n\r\n'], [100, ' '.repeat(60000)], [300, `${' '.repeat(6000)}BAD\x01 / HTTP/1.1\r\n\r\n`]]],
    ['it writes a 100 Continue behind an answer that will not drain', [[0, 'GET /big HTTP/1.1\r\nHost: x\r\n\r\n'], [300, 'POST /echo HTTP/1.1\r\nHost: x\r\nExpect: 100-continue\r\nContent-Length: 0\r\n\r\nBAD\x01 / HTTP/1.1\r\n\r\n']]],
  ] as const)('nothing is read once node gave up in the same read as it resumes the socket, as when %s', async (_how, writes) => {
    const { server } = await served(stub, { ...SMALL, requestMs: 4000, headersMs: 3000, idleMs: 6000 });
    try {
      // A client that reads nothing: once node gives up, what it sends after stays in its own buffer, past the kernel's few MiB.
      const unsent = await new Promise<number>((resolve) => {
        const socket = connect({ host: '127.0.0.1', port: server.port });
        socket.pause();
        socket.on('error', () => { /* the server's close */ });
        for (const [at, text] of writes) setTimeout(() => { socket.write(text); }, at);
        const chunk = Buffer.alloc(64 << 10, 0x78);
        setTimeout(() => { for (let i = 0; i < 512; i += 1) socket.write(chunk); }, 500);
        setTimeout(() => { resolve(socket.writableLength); socket.destroy(); }, 1500);
      });
      expect(unsent).toBeGreaterThan(16 << 20);
    } finally {
      await server.close();
    }
  }, 10000);

  it('a waiting request node gave up on is never run, though the rest of its body comes before its turn, nor one node reads after', async () => {
    const { server } = await served(stub, { ...SMALL, requestMs: 300, headersMs: 200 });
    try {
      // The POST's 10 s (here 300 ms) run out while /slower is answered; its last byte comes at 450 ms, before its turn at 600 ms.
      const answered = await exchange(server.port, ['GET /slower HTTP/1.1\r\nHost: x\r\n\r\nPOST /limited HTTP/1.1\r\nHost: x\r\nContent-Length: 2\r\n\r\n{', `}${GET_ECHO}`], { gap: 450, ms: 3000 });
      expect(statuses(answered.text)).toEqual([200, 408]);
      expect(calls).toEqual(['/slower']);
      expect(reads).toEqual([]);
    } finally {
      await server.close();
    }
  }, 5000);

  it('the body of a running request node gave up on never reaches the app, though its last byte comes after the 408', async () => {
    const { server } = await served(stub, { ...SMALL, requestMs: 300, headersMs: 200 });
    try {
      // The client keeps its side open after the 408 and the server's end, so it can still send the last byte of the body. Here the
      // 408 goes out at once and finish destroys the socket; a 408 held in a full send buffer, which a test here cannot set up, leaves
      // the socket open, and then only the pause keeps the byte from the app. This fails with neither (the app reads 'ok').
      const text = await new Promise<string>((resolve) => {
        const socket = connect({ host: '127.0.0.1', port: server.port, allowHalfOpen: true });
        const parts: Buffer[] = [];
        socket.on('data', (part: Buffer) => parts.push(part));
        socket.on('error', () => { /* the close is this end's own */ });
        socket.write('POST /limited HTTP/1.1\r\nHost: x\r\nContent-Length: 2\r\n\r\n{');
        setTimeout(() => { socket.write(`}${GET_ECHO}`); }, 600);
        setTimeout(() => { socket.destroy(); resolve(Buffer.concat(parts).toString('latin1')); }, 900);
      });
      expect(statuses(text)).toEqual([408]);
      expect(calls).toEqual(['/limited']);
      expect(reads).not.toContain('ok');
    } finally {
      await server.close();
    }
  }, 5000);

  it('bytes after a request that closes the connection get no answer of their own: that request is answered and the connection ends', async () => {
    const { server, log } = await served();
    try {
      const answered = await exchange(server.port, ['GET /echo HTTP/1.1\r\nHost: x\r\nConnection: close\r\n\r\nGET /echo HTTP/1.1\r\nHost: x\r\n\r\n']);
      expect(statuses(answered.text)).toEqual([200]);
      expect(answered.closedByServer).toBe(true);
      await wait(50);
      expect(calls).toEqual(['/echo']);
      expect(log).toEqual([]);
    } finally {
      await server.close();
    }
  }, 5000);

  it('bad bytes behind a slow answer whose client then resets leave no line: the 400 that waited for its turn was never sent', async () => {
    const { server, log } = await served();
    try {
      await new Promise<void>((resolve) => {
        const socket = connect({ host: '127.0.0.1', port: server.port });
        socket.on('error', () => { /* the reset is this end's own */ });
        socket.on('close', () => { resolve(); });
        socket.write('GET /slower HTTP/1.1\r\nHost: x\r\n\r\n');
        setTimeout(() => { socket.write('NOT A REQUEST\r\n\r\n'); }, 50);
        setTimeout(() => { socket.resetAndDestroy(); }, 150);
      });
      await wait(800);
      expect(calls).toEqual(['/slower']);
      expect(log).toEqual([]);
    } finally {
      await server.close();
    }
  }, 5000);

  it('bad bytes sent a segment at a time behind a slow answer queue one answer: the slow answer and the 400 go out, under the limit', async () => {
    const { server, log } = await served();
    try {
      const answered = await new Promise<string>((resolve) => {
        const socket = connect({ host: '127.0.0.1', port: server.port });
        socket.setNoDelay(true);
        const parts: Buffer[] = [];
        socket.on('data', (part: Buffer) => parts.push(part));
        socket.on('error', () => { /* the server's close */ });
        socket.on('close', () => { resolve(Buffer.concat(parts).toString('latin1')); });
        socket.write('GET /slower HTTP/1.1\r\nHost: x\r\n\r\n');
        // More reads of bad bytes than UNANSWERED_LIMIT, each one segment, while /slower is answered.
        setTimeout(() => { socket.write('BAD\x01 / HTTP/1.1\r\n\r\n'); }, 50);
        for (let i = 0; i < UNANSWERED_LIMIT + 14; i += 1) setTimeout(() => { if (!socket.destroyed) socket.write('x'); }, 70 + i * 12);
        setTimeout(() => { socket.destroy(); }, 3000);
      });
      expect(statuses(answered)).toEqual([200, 400]);
      expect(log).toEqual([{ method: '(other)', route: '(none)', status: 400 }]);
    } finally {
      await server.close();
    }
  }, 6000);

  it('nothing more is read once node gave up on bytes it could not read: what the client sends after them stays with the client', async () => {
    const { server } = await served();
    try {
      // Read on, node would say so again for each read, and each would queue work behind /slower (L-106); unread, the bytes fill the
      // socket's buffers on both ends, and the rest waits in the client's own.
      const left = await new Promise<{ text: string; unsent: number }>((resolve) => {
        const socket = connect({ host: '127.0.0.1', port: server.port });
        const parts: Buffer[] = [];
        let unsent = -1;
        socket.on('data', (part: Buffer) => parts.push(part));
        socket.on('error', () => { /* the server's close */ });
        socket.on('close', () => { resolve({ text: Buffer.concat(parts).toString('latin1'), unsent }); });
        socket.write('GET /slower HTTP/1.1\r\nHost: x\r\n\r\nBAD\x01 / HTTP/1.1\r\n\r\n');
        const chunk = Buffer.alloc(64 << 10, 0x78);
        setTimeout(() => { for (let i = 0; i < 512; i += 1) socket.write(chunk); }, 50);
        setTimeout(() => { unsent = socket.writableLength; }, 400);
        setTimeout(() => { socket.destroy(); }, 3000);
      });
      expect(statuses(left.text)).toEqual([200, 400]);
      // 32 MiB written; loopback's buffers hold a few MiB, so most of it is still the client's at 400 ms if the server reads none.
      expect(left.unsent).toBeGreaterThan(16 << 20);
    } finally {
      await server.close();
    }
  }, 6000);

  it('bad bytes that go on after node gave up are answered once, with one line', async () => {
    const { server, log } = await served();
    try {
      const answered = await exchange(server.port, ['GET /slow HTTP/1.1\r\nHost: x\r\n\r\n', 'BAD\x01 / HTTP/1.1\r\n\r\n', 'more', 'more'], { gap: 25 });
      expect(statuses(answered.text)).toEqual([200, 400]);
      expect(log).toEqual([{ method: '(other)', route: '(none)', status: 400 }]);
    } finally {
      await server.close();
    }
  }, 5000);

  it('a body that breaks after its answer is written gets no second answer: that answer closes the connection', async () => {
    const { server, log } = await served();
    try {
      // /bignope's 404 is written in full only as the client reads, so it is still going out when the bad chunk comes.
      const answered = await exchange(server.port, ['POST /bignope HTTP/1.1\r\nHost: x\r\nTransfer-Encoding: chunked\r\n\r\n2\r\n{}\r\n', 'ZZ\r\n'], { gap: 100, paused: 300, ms: 4000 });
      expect(statuses(answered.text)).toEqual([404]);
      expect(answered.closedByServer).toBe(true);
      expect(log).toEqual([]);
    } finally {
      await server.close();
    }
  }, 6000);

  it('a request whose declared body has not come when it is answered closes the connection: what comes next is never read as a request', async () => {
    const { server } = await served();
    try {
      for (const [head, status] of [['GET /echo', 200], ['TRACE /echo', 405], ['POST /echo', 417]] as const) {
        const expect417 = status === 417 ? 'Expect: zz\r\n' : '';
        const answered = await exchange(server.port, [`${head} HTTP/1.1\r\nHost: x\r\n${expect417}Content-Length: 40\r\n\r\n`, GET_ECHO], { gap: 100 });
        expect(statuses(answered.text), head).toEqual([status]);
        expect(answered.closedByServer, head).toBe(true);
      }
    } finally {
      await server.close();
    }
  }, 8000);

  it('a POST refused unread after a wait closes the connection, though its body has moved on to the stream the app was handed', async () => {
    const { server } = await served();
    try {
      const answered = await exchange(server.port, ['POST /nope-late HTTP/1.1\r\nHost: x\r\nContent-Length: 2\r\n\r\n{}GET /echo HTTP/1.1\r\nHost: x\r\n\r\n']);
      expect(statuses(answered.text)).toEqual([404]);
      expect(answered.text).toContain('connection: close');
      await wait(50);
      expect(calls).toEqual(['/nope-late']);
    } finally {
      await server.close();
    }
  }, 5000);

  it('a line is logged once its answer is written: a client that resets before a slow answer, or before the adapter\'s 500, leaves none', async () => {
    const { server, log } = await served();
    try {
      for (const path of ['/lined', '/throw-late']) {
        await new Promise<void>((resolve) => {
          const socket = connect({ host: '127.0.0.1', port: server.port });
          socket.on('error', () => { /* the reset is this end's own */ });
          socket.on('close', () => { resolve(); });
          socket.write(`GET ${path} HTTP/1.1\r\nHost: x\r\n\r\n`, () => { setTimeout(() => { socket.resetAndDestroy(); }, 50); });
        });
      }
      await wait(400);
      expect(calls).toEqual(['/lined', '/throw-late']);
      expect(log).toEqual([]);
      // Read whole, the same answers leave their lines.
      expect((await ask(server.port, { method: 'GET', path: '/lined' })).status).toBe(200);
      expect((await ask(server.port, { method: 'GET', path: '/throw-late' })).status).toBe(500);
      expect(log).toEqual([{ method: 'GET', route: '/lined', status: 200 }, { method: 'GET', route: '(none)', status: 500 }]);
    } finally {
      await server.close();
    }
  }, 5000);

  it('an answer cut off as it goes out leaves no line: by the deadline, by a reset, or by close()', async () => {
    const { server, log } = await served(stub, IDLE);
    try {
      // The client reads nothing for 1 s, so BIG bytes never go out whole; the deadline cuts them at 300 ms. Then it reads to the close.
      const cut = await exchange(server.port, ['GET /biglined HTTP/1.1\r\nHost: x\r\n\r\n'], { paused: 1000, ms: 4000 });
      expect(cut.closedByServer).toBe(true);
      expect(cut.text.length).toBeLessThan(BIG);
      await new Promise<void>((resolve) => {
        const socket = connect({ host: '127.0.0.1', port: server.port });
        socket.on('error', () => { /* the reset is this end's own */ });
        socket.on('close', () => { resolve(); });
        socket.pause();
        socket.write('GET /biglined HTTP/1.1\r\nHost: x\r\n\r\n', () => { setTimeout(() => { socket.resetAndDestroy(); }, 100); });
      });
      await wait(100);
      expect(log).toEqual([]);
    } finally {
      await server.close();
    }
    const { server: closing, log: closed } = await served();
    const held = connect({ host: '127.0.0.1', port: closing.port });
    held.on('error', () => { /* close() ends it */ });
    held.pause();
    held.write('GET /biglined HTTP/1.1\r\nHost: x\r\n\r\n');
    await wait(150);
    await closing.close();
    await wait(50);
    expect(closed).toEqual([]);
    // Read whole, the same answer leaves its line.
    const { server: whole, log: wholeLog } = await served();
    try {
      expect((await ask(whole.port, { method: 'GET', path: '/biglined' })).status).toBe(200);
      // The client may have all of it a few ms before the server's 'finish', and may close at once: the line still comes.
      await wait(100);
      expect(wholeLog).toEqual([{ method: 'GET', route: '/biglined', status: 200 }]);
    } finally {
      await whole.close();
    }
  }, 10000);

  it('an app that gives up on its body leaves the answer its socket: the deadline cuts it, and the server goes on serving', async () => {
    const { server, log } = await served(stub, IDLE);
    try {
      const cut = await exchange(server.port, ['POST /cancel-big HTTP/1.1\r\nHost: x\r\nContent-Length: 2\r\n\r\n{}'], { paused: 1000, ms: 4000 });
      expect(cut.closedByServer).toBe(true);
      expect(statuses(cut.text)).toEqual([200]);
      expect(cut.text).toContain('connection: close');
      expect(log).toEqual([]);
      expect((await ask(server.port, { method: 'GET', path: '/echo' })).status).toBe(200);
    } finally {
      await server.close();
    }
  }, 8000);

  it('an answer read whole by a client that resets at once leaves its line, however soon the reset comes', async () => {
    const { server, log } = await served();
    try {
      // With the end written in the same turn as the answer, node 24 lost a line in every run of eight (node 22 emits 'finish' all the same).
      for (let i = 0; i < 24; i += 1) {
        await new Promise<void>((resolve) => {
          const socket = connect({ host: '127.0.0.1', port: server.port });
          let got = 0;
          let length = -1;
          let head = '';
          socket.on('error', () => { /* the reset is this end's own */ });
          socket.on('close', () => { resolve(); });
          socket.on('data', (part: Buffer) => {
            if (length < 0) {
              head += part.toString('latin1');
              const end = head.indexOf('\r\n\r\n');
              if (end < 0) return;
              length = Number(/content-length: (\d+)/i.exec(head)?.[1] ?? 0);
              got = head.length - end - 4;
            } else got += part.length;
            if (length >= 0 && got >= length) socket.resetAndDestroy();
          });
          socket.write('GET /biglined HTTP/1.1\r\nHost: x\r\n\r\n');
        });
      }
      await wait(100);
      expect(log).toHaveLength(24);
    } finally {
      await server.close();
    }
  }, 20000);

  it('an Expect: 100-continue alone gets its 100 Continue; one that names it among other words gets none, and a 417', async () => {
    const { server } = await served();
    try {
      const exact = await exchange(server.port, ['POST /echo HTTP/1.1\r\nHost: x\r\nExpect: 100-Continue \r\nContent-Length: 2\r\nConnection: close\r\n\r\n{}']);
      expect(statuses(exact.text)).toEqual([100, 200]);
      const other = await exchange(server.port, ['POST /echo HTTP/1.1\r\nHost: x\r\nExpect: 100-continue=later\r\nContent-Length: 2\r\n\r\n{}']);
      expect(statuses(other.text)).toEqual([417]);
      await wait(50);
      expect(calls).toEqual(['/echo']);
    } finally {
      await server.close();
    }
  }, 5000);

  it('headers over node\'s size are answered 431 with the fixed headers', async () => {
    const { server, log } = await served();
    try {
      const answered = await exchange(server.port, [`GET /echo HTTP/1.1\r\nHost: x\r\nX-Big: ${'a'.repeat(20000)}\r\n\r\n`]);
      const { status, headers, body } = headOf(answered.text);
      expect(status).toBe('HTTP/1.1 431 Request Header Fields Too Large');
      expect(headers['content-type']).toBe('application/json; charset=utf-8');
      expect(body).toBe('{"error":"the headers are too large"}');
      expect(log).toEqual([{ method: '(other)', route: '(none)', status: 431 }]);
    } finally {
      await server.close();
    }
  }, 5000);

  it('node\'s errors are answered as node would: 408 for a slow client, 431 for large headers, 413 for chunk extensions, else 400', () => {
    expect(unreadable(coded('ERR_HTTP_REQUEST_TIMEOUT'))).toEqual({ status: 408, reason: 'the request took too long' });
    expect(unreadable(coded('HPE_HEADER_OVERFLOW'))).toEqual({ status: 431, reason: 'the headers are too large' });
    expect(unreadable(coded('HPE_CHUNK_EXTENSIONS_OVERFLOW'))).toEqual({ status: 413, reason: 'the body is too large' });
    expect(unreadable(coded('HPE_INVALID_METHOD'))).toEqual({ status: 400, reason: 'the request does not read' });
    expect(unreadable(new Error('zz-secret'))).toEqual({ status: 400, reason: 'the request does not read' });
  });

  it('an Expect the server does not meet is answered 417 in its turn, with the fixed headers and a line, and never reaches the app', async () => {
    const { server, log } = await served();
    try {
      const answered = await exchange(server.port, ['GET /slow HTTP/1.1\r\nHost: x\r\n\r\nPOST /echo HTTP/1.1\r\nHost: x\r\nExpect: zz-later\r\nContent-Length: 2\r\n\r\n{}']);
      expect(statuses(answered.text)).toEqual([200, 417]);
      expect(answered.text).toContain('{"error":"no such expectation"}');
      expect(calls).toEqual(['/slow']);
      expect(log).toEqual([{ method: 'POST', route: '(none)', status: 417 }]);
    } finally {
      await server.close();
    }
  }, 5000);

  it('a request that asks for an Upgrade is refused 400 in its turn and its connection closed: what follows it is never run', async () => {
    const { server, log } = await served();
    try {
      const upgrade = 'GET /echo HTTP/1.1\r\nHost: x\r\nConnection: Upgrade\r\nUpgrade: websocket\r\n\r\n';
      const answered = await exchange(server.port, [`GET /slow HTTP/1.1\r\nHost: x\r\n\r\n${upgrade}${GET_ECHO}`]);
      expect(statuses(answered.text)).toEqual([200, 400]);
      expect(answered.text).toContain('{"error":"no upgrade here"}');
      expect(answered.closedByServer).toBe(true);
      expect(calls).toEqual(['/slow']);
      expect(log).toEqual([{ method: 'GET', route: '(none)', status: 400 }]);
    } finally {
      await server.close();
    }
  }, 5000);

  it('a CONNECT\'s socket is destroyed once its answer is written, though its client keeps its own side open', async () => {
    const { server } = await served();
    try {
      const outcome = await new Promise<string>((resolve) => {
        const socket = connect({ host: '127.0.0.1', port: server.port, allowHalfOpen: true });
        // Read, so the server's end is seen.
        socket.resume();
        socket.on('error', (error: Error & { code?: string }) => { resolve(error.code ?? 'error'); });
        socket.on('end', () => {
          // The 405 and the server's end have come; a write now meets a socket the server has destroyed.
          setTimeout(() => { socket.write('more'); setTimeout(() => { socket.write('more'); }, 100); }, 100);
        });
        setTimeout(() => { socket.destroy(); resolve('still open'); }, 2000);
        socket.write('CONNECT x:443 HTTP/1.1\r\nHost: x\r\n\r\n');
      });
      expect(outcome).not.toBe('still open');
    } finally {
      await server.close();
    }
  }, 5000);

  it('close() destroys a socket node handed over, though its turn still waits behind a slow answer', async () => {
    const { server } = await served();
    const socket = connect({ host: '127.0.0.1', port: server.port });
    socket.on('error', () => { /* the close is this test's own */ });
    socket.write('GET /slower HTTP/1.1\r\nHost: x\r\n\r\nCONNECT x:443 HTTP/1.1\r\nHost: x\r\n\r\n');
    await wait(100);
    const started = Date.now();
    await server.close();
    expect(Date.now() - started).toBeLessThan(400);
    socket.destroy();
  }, 5000);

  // The adapter's own answers, each with the line it leaves (finish).
  const RAW: readonly (readonly [string, string, RequestLog])[] = [
    ['a CONNECT', 'CONNECT x:443 HTTP/1.1\r\nHost: x\r\n\r\n', { method: '(other)', route: '(none)', status: 405 }],
    ['a request that asks for an Upgrade', 'GET /echo HTTP/1.1\r\nHost: x\r\nConnection: upgrade\r\nUpgrade: zz\r\n\r\n', { method: 'GET', route: '(none)', status: 400 }],
    ['bytes node cannot read', 'GARBAGE\r\n\r\n', { method: '(other)', route: '(none)', status: 400 }],
  ];
  it.each(RAW)('%s answered in the turn the server is stopped in leaves its line: the client has the answer whole', async (_name, bytes, line) => {
    const { server, log } = await served();
    let stopped: Promise<void> = Promise.resolve();
    // The signal reaches this process alone: a test file runs in a process of its own (Vitest's forks), not a thread of the runner's.
    expect(isMainThread).toBe(true);
    const stop = (): void => { stopped = server.close(); };
    process.once('SIGUSR2', stop);
    try {
      const text = await new Promise<string>((resolve) => {
        const socket = connect({ host: '127.0.0.1', port: server.port });
        const parts: Buffer[] = [];
        socket.on('data', (part: Buffer) => parts.push(part));
        socket.on('error', () => { /* the stop may reset the connection; the bytes read before it are what counts */ });
        socket.on('close', () => { resolve(Buffer.concat(parts).toString('latin1')); });
        // Once the server holds the connection, the bytes and the signal are ready for its same next poll, the bytes first: the stop
        // then runs in the turn their answer is written in, before the end of that answer is through (a later turn's work).
        socket.on('connect', () => {
          setTimeout(() => { socket.write(bytes, () => { process.kill(process.pid, 'SIGUSR2'); }); }, 50);
        });
      });
      await stopped;
      const answer = headOf(text);
      expect(answer.status).toMatch(new RegExp(`^HTTP/1\\.1 ${String(line.status)} `));
      expect(Buffer.byteLength(answer.body)).toBe(Number(answer.headers['content-length']));
      expect(log).toEqual([line]);
    } finally {
      process.off('SIGUSR2', stop);
      await server.close();
    }
  }, 5000);

  // A client in a process of its own: its reset must come between the server's write of the answer and its next read of the socket.
  const RESETS = `
    const { connect } = require('node:net');
    const [port, request, count] = [Number(process.argv[1]), process.argv[2], Number(process.argv[3])];
    let whole = 0;
    const one = () => new Promise((resolve) => {
      const socket = connect({ host: '127.0.0.1', port });
      let text = '';
      const timer = setTimeout(() => { socket.destroy(); }, 2000);
      socket.on('error', () => {});
      socket.on('close', () => { clearTimeout(timer); resolve(); });
      socket.on('data', (part) => {
        text += part.toString('latin1');
        const end = text.indexOf('\\r\\n\\r\\n');
        const length = Number(/content-length: (\\d+)/i.exec(text)?.[1] ?? -1);
        if (end >= 0 && length >= 0 && text.length - end - 4 >= length) { whole += 1; socket.resetAndDestroy(); }
      });
      socket.write(request.padEnd(65536, 'a'));
    });
    (async () => { for (let i = 0; i < count; i += 1) await one(); process.stdout.write(String(whole)); })();
  `;
  it.each(RAW.slice(0, 2))('%s whose client resets as soon as it has the answer whole leaves its line, though the reset is read in the same read loop', async (_name, bytes, line) => {
    const { server, log } = await served();
    try {
      // 64 KiB fills node's read buffer, so libuv reads the socket again in the same loop, right after the answer is written: the
      // reset is read there, before the end of the answer is through. Of 200 connections, a line logged once the end was through was lost
      // in some, in every run.
      const { stdout } = await run(process.execPath, ['-e', RESETS, String(server.port), bytes, '200'], { timeout: 20000 });
      await wait(100);
      expect(stdout).toBe('200');
      expect(log).toEqual(Array.from({ length: 200 }, () => line));
    } finally {
      await server.close();
    }
  }, 25000);
});

describe('GDD-TEC-10 adapter: the limits as the GDD states them', () => {
  it('5 s for the headers, 10 s for a whole request, checked every second, 30 s with no progress, 5 s for a kept connection', () => {
    expect(SOCKET_LIMITS).toEqual({ requestMs: 10000, headersMs: 5000, checkMs: 1000, idleMs: 30000, keptMs: 5000 });
  });

  // The one socket test on the real limits, so the 5 s it waits is over the usual 5 s a test is given: it shows serve() takes them when given none.
  it('with no limits given, a connection that sends nothing gets 408 between 5 s and the 5 s plus a check', async () => {
    const server = await serve(stub, 0, () => undefined);
    try {
      const answered = await exchange(server.port, [], { ms: 9000 });
      expect(answered.closedByServer).toBe(true);
      expect(answered.text).toMatch(/^HTTP\/1\.1 408 /);
      expect(answered.ms).toBeGreaterThanOrEqual(SOCKET_LIMITS.headersMs - 50);
      expect(answered.ms).toBeLessThan(SOCKET_LIMITS.headersMs + SOCKET_LIMITS.checkMs + 1000);
    } finally {
      await server.close();
    }
  }, 12000);
});

describe('GDD-TEC-10 adapter: how long a client may take', () => {
  it('headers still coming after the headers\' limit get 408 and the connection is closed, soon after the limit', async () => {
    const { server } = await served(stub, SMALL);
    try {
      // A header line every 100 ms: the connection is never idle, and the headers never end.
      const writes = ['GET /echo HTTP/1.1\r\n', ...Array.from({ length: 20 }, () => 'x-a: b\r\n')];
      const answered = await exchange(server.port, writes, { gap: 100, ms: 2500 });
      expect(answered.closedByServer).toBe(true);
      expect(answered.text).toMatch(/^HTTP\/1\.1 408 /);
      expect(answered.ms).toBeGreaterThanOrEqual(SMALL.headersMs - 50);
      expect(answered.ms).toBeLessThan(SMALL.headersMs + 400);
    } finally {
      await server.close();
    }
  }, 5000);

  it('a body still coming after the request\'s limit gets 408 and the connection is closed, soon after the limit', async () => {
    const { server } = await served(stub, SMALL);
    try {
      // A byte of body every 100 ms, of 100 declared.
      const writes = ['POST /echo HTTP/1.1\r\nHost: x\r\nContent-Length: 100\r\n\r\n', ...Array.from({ length: 25 }, () => 'a')];
      const answered = await exchange(server.port, writes, { gap: 100, ms: 3000 });
      expect(answered.closedByServer).toBe(true);
      expect(answered.text).toMatch(/^HTTP\/1\.1 408 /);
      expect(answered.ms).toBeGreaterThanOrEqual(SMALL.requestMs - 50);
      expect(answered.ms).toBeLessThan(SMALL.requestMs + 400);
    } finally {
      await server.close();
    }
  }, 5000);

  it('a body that node\'s request limit cuts is read as not whole (408), the status node answers', async () => {
    const { server } = await served(stub, SMALL);
    try {
      const writes = ['POST /limited HTTP/1.1\r\nHost: x\r\nContent-Length: 100\r\n\r\n', ...Array.from({ length: 25 }, () => 'a')];
      const answered = await exchange(server.port, writes, { gap: 100, ms: 3000 });
      expect(answered.text).toMatch(/^HTTP\/1\.1 408 /);
      await wait(50);
      expect(reads).toEqual([408]);
    } finally {
      await server.close();
    }
  }, 5000);

  it('a kept connection that sends only blank lines after its answer is closed at the kept limit, though each byte is activity', async () => {
    const { server, log } = await served(stub, SMALL);
    try {
      // The answer, then a blank line every 100 ms: node skips them, so no request starts and no other limit runs out.
      const writes = ['GET /echo HTTP/1.1\r\nHost: x\r\n\r\n', ...Array.from({ length: 25 }, () => '\r\n')];
      const answered = await exchange(server.port, writes, { gap: 100, ms: 3000 });
      expect(statuses(answered.text)).toEqual([200]);
      expect(answered.closedByServer).toBe(true);
      expect(answered.ms).toBeGreaterThanOrEqual(SMALL.keptMs - 50);
      expect(answered.ms).toBeLessThan(SMALL.keptMs + 400);
      expect(log).toEqual([]);
    } finally {
      await server.close();
    }
  }, 5000);

  it('a request pipelined behind another is not cut by the kept wait, however long its answer takes', async () => {
    const { server } = await served(stub, SMALL);
    try {
      // /slower answers after 600 ms, past the kept limit: the wait starts only once no request is left.
      const answered = await exchange(server.port, ['GET /echo HTTP/1.1\r\nHost: x\r\n\r\nGET /slower HTTP/1.1\r\nHost: x\r\nConnection: close\r\n\r\n'], { ms: 3000 });
      expect(statuses(answered.text)).toEqual([200, 200]);
    } finally {
      await server.close();
    }
  }, 5000);

  it('a kept connection whose next request comes within the kept limit is answered again, and its wait starts over', async () => {
    const { server } = await served(stub, SMALL);
    try {
      // Three requests, each 300 ms after the one before: every gap is under the kept limit, though together they are not.
      const writes = ['GET /echo HTTP/1.1\r\nHost: x\r\n\r\n', 'GET /echo HTTP/1.1\r\nHost: x\r\n\r\n', 'GET /echo HTTP/1.1\r\nHost: x\r\nConnection: close\r\n\r\n'];
      const answered = await exchange(server.port, writes, { gap: 300, ms: 3000 });
      expect(statuses(answered.text)).toEqual([200, 200, 200]);
      expect(calls).toEqual(['/echo', '/echo', '/echo']);
    } finally {
      await server.close();
    }
  }, 5000);

  it('a client that reads none of its answer is cut off once the connection has made no progress for the idle limit', async () => {
    const { server } = await served(stub, IDLE);
    try {
      // Nothing is read for four idle limits; then the rest is read, until the server's close or 2 s more.
      const answered = await exchange(server.port, ['GET /big HTTP/1.1\r\nHost: x\r\n\r\n'], { paused: IDLE.idleMs * 4, ms: IDLE.idleMs * 4 + 2000 });
      expect(answered.closedByServer).toBe(true);
      expect(statuses(answered.text)).toEqual([200]);
      expect(answered.text.length).toBeLessThan(BIG);
    } finally {
      await server.close();
    }
  }, 5000);

  it('a client that reads none of its answer is cut off at the idle limit, though it keeps sending blank lines, and soon after the limit', async () => {
    const { server } = await served(stub, IDLE);
    try {
      // Each blank line is a byte read, which would put off node's own idle timer; the answer's own deadline is the idle limit once more.
      const writes = ['GET /big HTTP/1.1\r\nHost: x\r\n\r\n', ...Array.from({ length: 30 }, () => '\r\n')];
      const answered = await exchange(server.port, writes, { gap: 50, paused: 5000, ms: 5000 });
      expect(answered.closedByServer).toBe(true);
      expect(answered.ms).toBeLessThan(IDLE.idleMs * 2);
    } finally {
      await server.close();
    }
  }, 8000);

  it('a kept connection that asks again and again outlives the idle limit: each answer\'s deadline ends once it is out', async () => {
    const { server } = await served(stub, { ...SMALL, idleMs: 500 });
    try {
      const writes = [...Array.from({ length: 5 }, () => GET_ECHO), 'GET /echo HTTP/1.1\r\nHost: x\r\nConnection: close\r\n\r\n'];
      const answered = await exchange(server.port, writes, { gap: 300, ms: 4000 });
      expect(statuses(answered.text)).toEqual([200, 200, 200, 200, 200, 200]);
    } finally {
      await server.close();
    }
  }, 6000);

  it('a client that reads its answers as they come is not cut off by the idle limit', async () => {
    const { server } = await served(stub, IDLE);
    try {
      const answered = await exchange(server.port, ['GET /big HTTP/1.1\r\nHost: x\r\nConnection: close\r\n\r\n'], { ms: 4000 });
      expect(answered.closedByServer).toBe(true);
      expect(answered.text.length).toBeGreaterThan(BIG);
    } finally {
      await server.close();
    }
  }, 5000);
});

describe('GDD-TEC-10 adapter: where it listens', () => {
  it('serves on 127.0.0.1 and on none of the machine\'s other addresses', async () => {
    const { server } = await served();
    try {
      expect(await reachable('127.0.0.1', server.port)).toBe(true);
      // Every address a network interface has besides loopback (none, on a machine with no network, and then nothing is asked).
      const others = Object.values(networkInterfaces()).flatMap((list) => list ?? []).filter((entry) => !entry.internal && entry.family === 'IPv4');
      for (const entry of others.slice(0, 8)) expect(await reachable(entry.address, server.port)).toBe(false);
    } finally {
      await server.close();
    }
  }, 5000);
});

/** The adapter on the real app, as the bundle wires it (the memory store, the mock chain), with the app's lines and the adapter's in one log. */
async function servedReal(limits?: SocketLimits) {
  const settled = settingsOf({}, () => { throw new Error('no config file is read'); });
  if (!('settings' in settled)) throw new Error('the default settings do not read');
  const log: RequestLog[] = [];
  const wired = await wire(settled.settings);
  const server = await serve(wired.app, 0, (line) => { log.push(line); }, limits);
  return { server, log, close: async () => { await server.close(); wired.close(); } };
}
const NONCE_HEAD = 'POST /api/v1/sign-in/nonce HTTP/1.1\r\nHost: x\r\nOrigin: http://localhost:5173\r\nContent-Type: application/json\r\n';

/**
 * L-104's guard: every way a connection can be answered, on the real app, each on a connection of its own. The rule over every request,
 * "a request that is answered leaves one log line ...; one left unanswered leaves none" (GDD-TEC-10), holds when the log's statuses are
 * exactly the statuses the client received, in order. A new way the adapter or node answers gets a row here.
 */
const EVERY_ANSWER: readonly (readonly [string, string, readonly number[]])[] = [
  ['a whole GET', 'GET /api/v1/config HTTP/1.1\r\nHost: x\r\nConnection: close\r\n\r\n', [200]],
  ['two pipelined GETs', 'GET /api/v1/config HTTP/1.1\r\nHost: x\r\n\r\nGET /api/v1/config HTTP/1.1\r\nHost: x\r\nConnection: close\r\n\r\n', [200, 200]],
  ['a GET behind an answer that closes', 'GET /api/v1/config HTTP/1.1\r\nHost: x\r\nConnection: close\r\n\r\nGET /api/v1/config HTTP/1.1\r\nHost: x\r\n\r\n', [200]],
  ['an HTTP/1.0 GET with bytes after it', 'GET /api/v1/config HTTP/1.0\r\nHost: x\r\n\r\nGET /api/v1/config HTTP/1.0\r\nHost: x\r\n\r\n', [200]],
  ['a GET with an empty chunked body and a trailer, then another', 'GET /api/v1/config HTTP/1.1\r\nHost: x\r\nTransfer-Encoding: chunked\r\n\r\n0\r\nX-T: 1\r\n\r\nGET /api/v1/config HTTP/1.1\r\nHost: x\r\nConnection: close\r\n\r\n', [200, 200]],
  ['a target that reads two ways', 'GET /api/v1/x/../config HTTP/1.1\r\nHost: x\r\n\r\n', [400]],
  ['TRACE', 'TRACE /api/v1/config HTTP/1.1\r\nHost: x\r\n\r\n', [405]],
  ['CONNECT', 'CONNECT api.invalid:443 HTTP/1.1\r\nHost: x\r\n\r\n', [405]],
  ['an Upgrade', 'GET /api/v1/config HTTP/1.1\r\nHost: x\r\nConnection: Upgrade\r\nUpgrade: websocket\r\n\r\n', [400]],
  ['an Expect not met', `${NONCE_HEAD}Expect: something\r\nContent-Length: 2\r\n\r\n`, [417]],
  ['bytes that are no request', 'NOT A REQUEST\r\n\r\n', [400]],
  ['headers too large', `GET /api/v1/config HTTP/1.1\r\nHost: x\r\nX-Big: ${'a'.repeat(20000)}\r\n\r\n`, [431]],
  ['headers too slow', 'GET /api/v1/config HTTP/1.1\r\nHost: x\r\n', [408]],
  ['a nonce asked whole', `${NONCE_HEAD}Content-Length: 2\r\nConnection: close\r\n\r\n{}`, [200]],
  ['a nonce from another origin', 'POST /api/v1/sign-in/nonce HTTP/1.1\r\nHost: x\r\nOrigin: http://elsewhere.invalid\r\nContent-Type: application/json\r\nContent-Length: 2\r\n\r\n{}', [403]],
  ['a chunked body that breaks', `${NONCE_HEAD}Transfer-Encoding: chunked\r\n\r\n2\r\n{}\r\nZZ\r\n`, [400]],
  ['a body too slow', `${NONCE_HEAD}Content-Length: 100\r\n\r\n{`, [408]],
  ['bad bytes behind a GET', 'GET /api/v1/config HTTP/1.1\r\nHost: x\r\n\r\nNOT A REQUEST\r\n\r\n', [200, 400]],
  ['more than 16 unanswered', 'GET /api/v1/config HTTP/1.1\r\nHost: x\r\n\r\n'.repeat(UNANSWERED_LIMIT + 1), []],
  ['16 requests and bad bytes after them', `${'GET /api/v1/config HTTP/1.1\r\nHost: x\r\n\r\n'.repeat(UNANSWERED_LIMIT)}NOT A REQUEST\r\n\r\n`, [...Array.from({ length: UNANSWERED_LIMIT }, () => 200), 400]],
  ['an HTTP/1.1 request with no Host, between two', 'GET /api/v1/config HTTP/1.1\r\nHost: x\r\n\r\nGET /api/v1/config HTTP/1.1\r\n\r\nGET /api/v1/config HTTP/1.1\r\nHost: x\r\nConnection: close\r\n\r\n', [200, 400, 200]],
  ['an HTTP/1.0 request with no Host', 'GET /api/v1/config HTTP/1.0\r\n\r\n', [200]],
  ['an HTTP/1.0 Expect not met', `${NONCE_HEAD.replace('HTTP/1.1', 'HTTP/1.0')}Expect: zz\r\nContent-Length: 2\r\n\r\n{}`, [417]],
  ['an Expect that names 100-continue among other words', `${NONCE_HEAD}Expect: x-100-continue\r\nContent-Length: 2\r\n\r\n{}`, [417]],
  ['two Expects, one of them 100-continue', `${NONCE_HEAD}Expect: 100-continue\r\nExpect: zz\r\nContent-Length: 2\r\n\r\n{}`, [417]],
  ['an HTTP/1.0 Expect: 100-continue, passed on', `${NONCE_HEAD.replace('HTTP/1.1', 'HTTP/1.0')}Expect: 100-continue\r\nContent-Length: 2\r\n\r\n{}`, [200]],
  ['an Expect: 100-continue', `${NONCE_HEAD}Expect: 100-continue\r\nContent-Length: 2\r\nConnection: close\r\n\r\n{}`, [200]],
  ['bad bytes behind a POST refused unread', 'POST /api/v1/sign-in/nonce HTTP/1.1\r\nHost: x\r\nContent-Type: text/plain\r\nContent-Length: 2\r\n\r\n{}NOT A REQUEST\r\n\r\n', [415]],
];

describe('GDD-TEC-10 adapter on the real app: every answer a client receives leaves one line with its status (L-104)', () => {
  it.each(EVERY_ANSWER)('%s', async (_name, bytes, expected) => {
    const { server, log, close } = await servedReal(SMALL);
    try {
      const answered = await exchange(server.port, [bytes], { ms: 3000 });
      await wait(50);
      // A 100 Continue is no answer: it comes before the answer of the one request that asked for it.
      expect(statuses(answered.text).filter((status) => status !== 100)).toEqual(expected);
      expect(log.map((line) => line.status)).toEqual(expected);
    } finally {
      await close();
    }
  }, 6000);
});

describe('GDD-TEC-10 adapter on the real app: one line for a request answered, none for one left unanswered', () => {
  it('a nonce asked whole is answered 200 with the route\'s one line', async () => {
    const { server, log, close } = await servedReal();
    try {
      const answered = await exchange(server.port, [`${NONCE_HEAD}Content-Length: 2\r\nConnection: close\r\n\r\n{}`]);
      expect(statuses(answered.text)).toEqual([200]);
      await wait(50);
      expect(log).toEqual([{ method: 'POST', route: '/api/v1/sign-in/nonce', status: 200 }]);
    } finally {
      await close();
    }
  }, 5000);

  it('a chunked body that breaks is answered 400, as node answers it, and leaves that one line', async () => {
    const { server, log, close } = await servedReal();
    try {
      const answered = await exchange(server.port, [`${NONCE_HEAD}Transfer-Encoding: chunked\r\n\r\n2\r\n{}\r\nZZ\r\n`]);
      expect(statuses(answered.text)).toEqual([400]);
      await wait(50);
      expect(log).toEqual([{ method: '(other)', route: '(none)', status: 400 }]);
    } finally {
      await close();
    }
  }, 5000);

  it('a body still coming at the request\'s limit is answered 408 and leaves that one line', async () => {
    const { server, log, close } = await servedReal(SMALL);
    try {
      const answered = await exchange(server.port, [`${NONCE_HEAD}Content-Length: 100\r\n\r\n{`], { ms: 3000 });
      expect(statuses(answered.text)).toEqual([408]);
      await wait(50);
      expect(log).toEqual([{ method: '(other)', route: '(none)', status: 408 }]);
    } finally {
      await close();
    }
  }, 5000);

  it('a body its client resets part way is answered nothing and leaves no line', async () => {
    const { server, log, close } = await servedReal();
    try {
      await new Promise<void>((resolve) => {
        const socket = connect({ host: '127.0.0.1', port: server.port });
        socket.on('error', () => { /* the reset is this end's own */ });
        socket.on('close', () => { resolve(); });
        socket.write(`${NONCE_HEAD}Content-Length: 100\r\n\r\n{"a":`, () => { setTimeout(() => { socket.resetAndDestroy(); }, 50); });
      });
      await wait(100);
      expect(log).toEqual([]);
    } finally {
      await close();
    }
  }, 5000);
});
