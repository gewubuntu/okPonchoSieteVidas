import { request as httpRequest, type IncomingHttpHeaders } from 'node:http';
import { connect } from 'node:net';
import { networkInterfaces } from 'node:os';
import { describe, expect, it } from 'vitest';
import { setTimeout as wait } from 'node:timers/promises';
import { BODY_LIMIT, json, readBody, refuse, type RequestLog } from './boundary';
import { serve, targetOf, type App, type SocketLimits } from './node';

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
/**
 * What the adapter hands its requests to: /echo gives back what reached it, /limited reads the body under the limit, /slow answers after
 * 100 ms, /big answers BIG bytes, /throw rejects.
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
    return read.ok ? json(200, {}) : refuse(read.status, read.reason);
  }
  if (path === '/slow') {
    await wait(100);
    return json(200, {});
  }
  if (path === '/big') return new Response(new Uint8Array(BIG), { status: 200 });
  if (path === '/throw') throw new Error('zz-thrown');
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

  it('an app that rejects gets the adapter\'s own 500, with the fixed headers, nothing of why, and the connection closed', async () => {
    const { server } = await served();
    try {
      const answer = await ask(server.port, { method: 'GET', path: '/throw' });
      expect(answer.status).toBe(500);
      expect(answer.text).toBe('{"error":"server error"}');
      expect(answer.headers['content-type']).toBe('application/json; charset=utf-8');
      expect(answer.headers['cache-control']).toBe('no-store');
      // On a connection the client asks to keep, too: the adapter closes it.
      const kept = await exchange(server.port, ['GET /throw HTTP/1.1\r\nHost: x\r\n\r\n'], { ms: 1000 });
      expect(statuses(kept.text)).toEqual([500]);
      expect(kept.text).toContain('connection: close');
      expect(kept.closedByServer).toBe(true);
    } finally {
      await server.close();
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
      // HTTP/1.0: node closes the connection after its answer, whatever the client asked.
      const answered = await exchange(server.port, ['GET /echo HTTP/1.0\r\nHost: x\r\nConnection: keep-alive\r\n\r\nGET /throw HTTP/1.0\r\nHost: x\r\nConnection: keep-alive\r\n\r\n']);
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

/** Limits small enough for a test to wait them out: the headers, a request, node's check of the two, and a connection's idling. */
const SMALL: SocketLimits = { requestMs: 800, headersMs: 400, checkMs: 50, idleMs: 300 };

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

  it('a client that reads none of its answer is cut off once the connection has made no progress for the idle limit', async () => {
    const { server } = await served(stub, SMALL);
    try {
      // Nothing is read for four idle limits; then the rest is read, until the server's close or 2 s more.
      const answered = await exchange(server.port, ['GET /big HTTP/1.1\r\nHost: x\r\n\r\n'], { paused: SMALL.idleMs * 4, ms: SMALL.idleMs * 4 + 2000 });
      expect(answered.closedByServer).toBe(true);
      expect(statuses(answered.text)).toEqual([200]);
      expect(answered.text.length).toBeLessThan(BIG);
    } finally {
      await server.close();
    }
  }, 5000);

  it('a client that reads its answers as they come is not cut off by the idle limit', async () => {
    const { server } = await served(stub, SMALL);
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
