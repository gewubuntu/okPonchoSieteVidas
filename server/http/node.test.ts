import { request as httpRequest, type IncomingHttpHeaders } from 'node:http';
import { connect } from 'node:net';
import { networkInterfaces } from 'node:os';
import { describe, expect, it } from 'vitest';
import { setTimeout as wait } from 'node:timers/promises';
import { BODY_LIMIT, json, readBody, refuse, type RequestLog } from './boundary';
import { serve, SOCKET_LIMITS, targetOf, UNANSWERED_LIMIT, unreadable, type App, type SocketLimits } from './node';

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
 * 100 ms and /slower after 600 ms, /big answers BIG bytes, /throw rejects.
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

  it('an app that rejects gets the adapter\'s own 500, with the fixed headers, nothing of why, a line, and the connection closed', async () => {
    const { server, log } = await served();
    try {
      const answer = await ask(server.port, { method: 'GET', path: '/throw' });
      expect(answer.status).toBe(500);
      expect(answer.text).toBe('{"error":"server error"}');
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

  it('bad bytes after requests: the one being answered is sent first, those still waiting are never run, then the 400', async () => {
    const { server, log } = await served();
    try {
      // The bad bytes 50 ms later, while /slow is being answered and /echo waits.
      const answered = await exchange(server.port, ['GET /slow HTTP/1.1\r\nHost: x\r\n\r\nGET /echo HTTP/1.1\r\nHost: x\r\n\r\n', 'NOT A REQUEST\r\n\r\n'], { gap: 50 });
      expect(statuses(answered.text)).toEqual([200, 400]);
      expect(calls).toEqual(['/slow']);
      expect(log).toEqual([{ method: '(other)', route: '(none)', status: 400 }]);
    } finally {
      await server.close();
    }
  }, 5000);

  it('bad bytes in the same read as requests: each request that was run is answered, the one waiting is never run, and the 400 comes last', async () => {
    const { server } = await served();
    try {
      // Whether the POST has started when node gives up depends on how node parses one read; either way it is answered if it ran.
      const answered = await exchange(server.port, ['POST /echo HTTP/1.1\r\nHost: x\r\nContent-Length: 2\r\n\r\n{}GET /slow HTTP/1.1\r\nHost: x\r\n\r\nNOT A REQUEST\r\n\r\n']);
      await wait(150);
      const answers = statuses(answered.text);
      expect(answers.at(-1)).toBe(400);
      expect(answers.slice(0, -1)).toEqual(calls.map(() => 200));
      expect(calls).not.toContain('/slow');
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
