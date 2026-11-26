// GDD-TEC-10, docs/decisions/0004-game-server.md ("HTTP"): the only socket code. It turns a node:http request into a standard Request and
// a standard Response back into bytes; every rule is in app.ts, which a test calls with no socket.
// It never reads Host or X-Forwarded-*: the Request's URL has a host of its own that no client sets.
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { Socket } from 'node:net';
import { Readable, type Duplex } from 'node:stream';
import { FIXED_HEADERS, methodOf, quietly, refuse, REASON, type RequestLog } from './boundary';

/**
 * The server's own settings, not GDD values, in ms: how long a client may take to send a whole request and its headers; how often node
 * checks those two (by its default of 30 s a client could hold a socket that long past them); and how long a connection may make no
 * progress either way, as when a client reads none of its answers.
 */
export interface SocketLimits { readonly requestMs: number; readonly headersMs: number; readonly checkMs: number; readonly idleMs: number }
export const SOCKET_LIMITS: SocketLimits = { requestMs: 10000, headersMs: 5000, checkMs: 1000, idleMs: 30000 };
/** The host every Request's URL names: it is never a real host, and the app never reads it. */
const BASE = 'http://api.invalid';

export type App = (request: Request) => Promise<Response>;

/**
 * The request target as the client wrote it, if it is a plain path with an optional query: `/path?query`, and nothing the URL parser
 * would read differently. `new URL` folds '..', '%2e%2e' and '\' into another route's path, takes an absolute-form target
 * ('http://host/path') and '//host/path' for a host of their own, and drops a '#' fragment; each reads back as other than it was written.
 * The one check, that path and query read back exactly as written, covers a target that does not start with a single '/' and one with
 * a host of its own (L-025): a pathname starts with '/', and a host or scheme in the target is not part of it.
 */
export function targetOf(raw: string): string | null {
  try {
    const url = new URL(raw, BASE);
    return `${url.pathname}${url.search}` === raw ? raw : null;
  } catch {
    return null;
  }
}

/** The Request for a node request, or the status to answer with: 405 for a method `Request` refuses (TRACE; a CONNECT never comes here, see `serve`), 400 for a target or a header that does not read. */
export function toRequest(req: IncomingMessage): { readonly request: Request } | { readonly status: 400 | 405 } {
  const method = req.method ?? 'GET';
  try {
    new Request(BASE, { method });
  } catch {
    return { status: 405 };
  }
  const target = targetOf(req.url ?? '');
  if (target === null) return { status: 400 };
  try {
    const headers = new Headers();
    // rawHeaders is name, value, name, value: always of even length.
    for (let i = 0; i < req.rawHeaders.length; i += 2) headers.append(req.rawHeaders[i] ?? '', req.rawHeaders[i + 1] ?? '');
    // A GET and a HEAD have no body to read; any other method's body is read from the stream as the handler asks for it.
    if (method === 'GET' || method === 'HEAD') return { request: new Request(`${BASE}${target}`, { method, headers }) };
    return { request: new Request(`${BASE}${target}`, { method, headers, body: Readable.toWeb(req), duplex: 'half' }) };
  } catch {
    return { status: 400 };
  }
}

/**
 * Writes the Response: its status, every header with each Set-Cookie on its own line, and its bytes. A request body not read to its end
 * closes the connection. Known and not done: a client still sending then may lose the answer to the connection's reset (the lingering
 * close of RFC 9112, 9.6); the game's own client never sends a body that is refused unread.
 */
export async function send(res: ServerResponse, response: Response): Promise<void> {
  const bytes = Buffer.from(await response.arrayBuffer());
  res.statusCode = response.status;
  for (const [name, value] of response.headers) if (name !== 'set-cookie') res.setHeader(name, value);
  // An empty list writes no header, so an answer with no cookie needs no check of its own (L-025; the socket test reads none back).
  res.setHeader('set-cookie', response.headers.getSetCookie());
  // The client may still be sending a body the app refused unread: the connection is not kept for the next request.
  if (!res.req.complete) res.setHeader('connection', 'close');
  res.end(bytes);
}

/** The adapter's own refusal of a method: Allow names the methods the server serves at all, since no route is matched here. */
const noMethod = (): Response => refuse(405, REASON.noMethod, 'GET, POST');

async function handle(app: App, log: (line: RequestLog) => void, req: IncomingMessage, res: ServerResponse): Promise<void> {
  const made = toRequest(req);
  if ('status' in made) {
    await send(res, made.status === 405 ? noMethod() : refuse(400, REASON.noRoute));
    // No target was accepted, so the line names no route.
    log({ method: methodOf(req.method ?? ''), route: '(none)', status: made.status });
    return;
  }
  await send(res, await app(made.request));
}

/**
 * The adapter's own 500, when a request could not be answered: nothing is known of why, so nothing of it is said, and the connection is
 * not kept. Nothing has been sent by then: `send` writes the headers in its last call, `res.end`, and nothing after it can throw (L-025).
 */
function lastResort(res: ServerResponse): void {
  res.statusCode = 500;
  for (const [name, value] of Object.entries(FIXED_HEADERS)) res.setHeader(name, value);
  res.setHeader('connection', 'close');
  res.end(JSON.stringify({ error: REASON.serverError }));
}

/** A CONNECT's answer as bytes, the one a TRACE gets (`noMethod`), with the connection closed: node:http hands a CONNECT no response to write to. */
function connectAnswer(): Buffer {
  const body = JSON.stringify({ error: REASON.noMethod });
  const headers = { ...FIXED_HEADERS, allow: 'GET, POST', connection: 'close', 'content-length': String(Buffer.byteLength(body)) };
  return Buffer.from(`HTTP/1.1 405 Method Not Allowed\r\n${Object.entries(headers).map(([name, value]) => `${name}: ${value}\r\n`).join('')}\r\n${body}`);
}

/**
 * Serves `app` on 127.0.0.1 only (the dev routes are never on the network), at `port` (0: any free one). `log` gets the line of each
 * request the adapter answers itself, as the app's own lines are made; a log that throws changes no answer.
 */
export function serve(app: App, port: number, log: (line: RequestLog) => void, limits: SocketLimits = SOCKET_LIMITS): Promise<{ readonly port: number; close(): Promise<void> }> {
  const note = quietly(log);
  // The requests of one connection take turns: each waits until the answer before it is sent. A request pipelined behind an answer that
  // closed the connection is so never processed (RFC 9112, 9.6), where node would run it and drop its answer; and a client that reads
  // none of its answers is read no further.
  const turns = new WeakMap<Socket, Promise<void>>();
  const server = createServer({ requestTimeout: limits.requestMs, headersTimeout: limits.headersMs, connectionsCheckingInterval: limits.checkMs }, (req, res) => {
    const socket = req.socket;
    const turn = (turns.get(socket) ?? Promise.resolve()).then(async () => {
      if (socket.writableEnded || socket.destroyed) return;
      // Listened for before anything is written: node's own 'finish', which ends a connection the answer closes, has then run by the next turn.
      const answered = new Promise<void>((done) => {
        res.once('finish', done);
        res.once('close', done);
      });
      await handle(app, note, req, res).catch(() => { lastResort(res); });
      await answered;
    });
    turns.set(socket, turn);
  });
  // createServer's options do not take it: a socket with no bytes either way for this long is destroyed.
  server.timeout = limits.idleMs;
  // node:http hands a CONNECT to this event, never to the handler, and closes its socket unanswered when nothing listens. It gets the
  // answer a TRACE gets. Node takes its own error listener off the socket before this event, so one is put back.
  server.on('connect', (_req: IncomingMessage, socket: Duplex) => {
    socket.on('error', () => { socket.destroy(); });
    socket.end(connectAnswer());
    // CONNECT is no usual method.
    note({ method: '(other)', route: '(none)', status: 405 });
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => {
      const address = server.address();
      resolve({
        // For the type checker only: a server listening on a TCP port has an AddressInfo, never a pipe's name or null.
        port: typeof address === 'object' && address !== null ? address.port : port,
        close: () => new Promise((done) => {
          server.close(() => { done(); });
          server.closeAllConnections();
        }),
      });
    });
  });
}
