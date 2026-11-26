// GDD-TEC-10, docs/decisions/0004-game-server.md ("HTTP"): the only socket code. It turns a node:http request into a standard Request and
// a standard Response back into bytes; every rule is in app.ts, which a test calls with no socket.
// It never reads Host or X-Forwarded-*: the Request's URL has a host of its own that no client sets.
import { createServer, STATUS_CODES, type IncomingMessage, type ServerResponse } from 'node:http';
import { Readable, type Duplex } from 'node:stream';
import { codeOf, FIXED_HEADERS, methodOf, quietly, refuse, REASON, type RequestLog } from './boundary';

/**
 * The server's own settings, not GDD values, in ms: how long a client may take to send a whole request and its headers; how often node
 * checks those two (by its default of 30 s a client could hold a socket that long past them); how long a connection may make no
 * progress either way, as when a client reads none of its answers; and how long a kept connection may wait from an answer to the next
 * request, whatever it sends meanwhile (node skips blank lines between requests, and each byte would put off the idle limit).
 */
export interface SocketLimits { readonly requestMs: number; readonly headersMs: number; readonly checkMs: number; readonly idleMs: number; readonly keptMs: number }
export const SOCKET_LIMITS: SocketLimits = { requestMs: 10000, headersMs: 5000, checkMs: 1000, idleMs: 30000, keptMs: 5000 };
/**
 * The server's own setting, not a GDD value: the most requests one connection may have unanswered, the one being answered included.
 * One more closes it. Node reads on while requests only wait their turn, since no answer of theirs is queued yet, so a client that
 * sends without reading would otherwise fill the server's memory (L-104).
 */
export const UNANSWERED_LIMIT = 16;
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
  // A body not all read: the client may still be sending it, or it came whole and lies unread, as one does whose turn starts behind a
  // slow answer. Either way the connection is not kept for the next request, wherever in a pipeline the request was.
  if (!res.req.complete || res.req.readableLength > 0) res.setHeader('connection', 'close');
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

/**
 * An answer as bytes, for a socket node:http hands over with no response to write to (CONNECT, Upgrade) or one it gave up reading:
 * `{ error: reason }` with the fixed headers, and the connection closed.
 */
function rawAnswer(status: number, reason: string, allow?: string): Buffer {
  const body = JSON.stringify({ error: reason });
  const headers: Record<string, string> = { ...FIXED_HEADERS, ...(allow === undefined ? {} : { allow }), connection: 'close', 'content-length': String(Buffer.byteLength(body)) };
  return Buffer.from(`HTTP/1.1 ${status} ${STATUS_CODES[status] ?? ''}\r\n${Object.entries(headers).map(([name, value]) => `${name}: ${value}\r\n`).join('')}\r\n${body}`);
}

/** The answer to bytes node:http could not read as a request (its `clientError`), as node would give it, but with the server's headers. */
export function unreadable(error: unknown): { readonly status: 400 | 408 | 413 | 431; readonly reason: string } {
  const code = codeOf(error);
  if (code === 'ERR_HTTP_REQUEST_TIMEOUT') return { status: 408, reason: REASON.tooSlow };
  if (code === 'HPE_HEADER_OVERFLOW') return { status: 431, reason: REASON.headersTooLarge };
  if (code === 'HPE_CHUNK_EXTENSIONS_OVERFLOW') return { status: 413, reason: REASON.tooLarge };
  return { status: 400, reason: REASON.notReadable };
}

/** What the adapter keeps of one connection: its last turn, how many of its requests are unanswered, the last one run, its wait for the next. */
interface Connection {
  turn: Promise<void>;
  unanswered: number;
  /**
   * The request whose turn ran last (null for one node handed over). It is not cleared once answered (L-025): an answer to a request not
   * read to its end closes the connection (`send`), so one still kept was read whole, and `complete` tells the two apart.
   */
  running: IncomingMessage | null;
  /** Set once node gave up reading it: the requests still waiting are never run, and the connection's last answer says why. */
  broken: boolean;
  kept: NodeJS.Timeout | undefined;
}

/**
 * Serves `app` on 127.0.0.1 only (the dev routes are never on the network), at `port` (0: any free one). `log` gets the line of each
 * request the adapter answers itself, as the app's own lines are made; a log that throws changes no answer.
 * Known, not built: a client that half-closes its side after its requests loses the answers still waiting (node's own rule); and a
 * request's 10 s counts from its arrival, so a large body pipelined behind a slow answer can run out. D1's routes answer at once.
 */
export function serve(app: App, port: number, log: (line: RequestLog) => void, limits: SocketLimits = SOCKET_LIMITS): Promise<{ readonly port: number; close(): Promise<void> }> {
  const note = quietly(log);
  // The requests of one connection take turns: each waits until the answer before it is sent. A request pipelined behind an answer that
  // closed the connection is so never processed (RFC 9112, 9.6), where node would run it and drop its answer; and a client that reads
  // none of its answers is read no further than UNANSWERED_LIMIT requests.
  const connections = new WeakMap<object, Connection>();
  const connectionOf = (socket: Duplex): Connection => {
    let found = connections.get(socket);
    if (found === undefined) {
      found = { turn: Promise.resolve(), unanswered: 0, running: null, broken: false, kept: undefined };
      connections.set(socket, found);
    }
    return found;
  };
  /**
   * Runs `step` on `socket` once the turns before it are done, unless the connection is gone or broken by then; once no later turn waits,
   * the connection's wait for its next request (keptMs) starts.
   */
  const inTurn = (socket: Duplex, req: IncomingMessage | null, step: () => Promise<void>): void => {
    const connection = connectionOf(socket);
    clearTimeout(connection.kept);
    connection.unanswered += 1;
    // The turn below then runs nothing, since its socket is gone (L-025: no return of its own).
    if (connection.unanswered > UNANSWERED_LIMIT) socket.destroy();
    const turn = connection.turn.then(async () => {
      if (!socket.writableEnded && !socket.destroyed && !connection.broken) {
        connection.running = req;
        await step();
      }
      connection.unanswered -= 1;
      // A later request already waiting has a turn of its own; a gone connection's wait only destroys it again (L-025: no check of its own).
      if (connection.turn === turn) connection.kept = setTimeout(() => { socket.destroy(); }, limits.keptMs).unref();
    });
    connection.turn = turn;
  };
  /** Ends `socket` with `bytes` and destroys it once they are written, logging its line. */
  const finish = (socket: Duplex, bytes: Buffer, line: RequestLog): void => {
    socket.end(bytes, () => { socket.destroy(); });
    note(line);
  };
  /** Answers `req` in its turn with `answer`, the adapter's own 500 if that fails, and lets the next turn start once the answer is sent. */
  const answerInTurn = (req: IncomingMessage, res: ServerResponse, answer: () => Promise<void>): void => {
    inTurn(req.socket, req, async () => {
      // Listened for before anything is written: node's own 'finish', which ends a connection the answer closes, has then run by the next turn.
      const answered = new Promise<void>((done) => {
        res.once('finish', done);
        res.once('close', done);
      });
      await answer().catch(() => {
        lastResort(res);
        // Its line names the status sent. If the app had answered and its answer could not be written, the app's own line is there too.
        note({ method: methodOf(req.method ?? ''), route: '(none)', status: 500 });
      });
      await answered;
    });
  };
  const server = createServer({ requestTimeout: limits.requestMs, headersTimeout: limits.headersMs, connectionsCheckingInterval: limits.checkMs }, (req, res) => {
    answerInTurn(req, res, () => handle(app, note, req, res));
  });
  // createServer's options do not take it: a socket with no bytes either way for this long is destroyed. An answer is written in one
  // write, which node counts as one step of progress, so the limit also bounds how long a client may take to read one answer (D1's are
  // about 1 KB).
  server.timeout = limits.idleMs;
  // An Expect other than 100-continue: node would answer 417 itself, with neither fixed header nor a line. It is answered in its turn.
  server.on('checkExpectation', (req: IncomingMessage, res: ServerResponse) => {
    answerInTurn(req, res, async () => {
      await send(res, refuse(417, REASON.noExpectation));
      note({ method: methodOf(req.method ?? ''), route: '(none)', status: 417 });
    });
  });
  // Bytes node could not read as a request (400, 431, 413) and a client too slow (408). Node would answer at once and destroy the
  // socket, cutting the answer of a request it had already run. A request still coming in, being answered, is the one node gave up
  // on: it is answered now. Otherwise the request being answered is sent first, those still waiting are never run, and then this.
  server.on('clientError', (error: unknown, socket: Duplex) => {
    // A reset or a closed socket has no one to answer.
    if (!socket.writable) {
      socket.destroy();
      return;
    }
    const { status, reason } = unreadable(error);
    const line: RequestLog = { method: '(other)', route: '(none)', status };
    const connection = connectionOf(socket);
    if (connection.running !== null && !connection.running.complete) {
      finish(socket, rawAnswer(status, reason), line);
      return;
    }
    connection.broken = true;
    void connection.turn.then(() => {
      if (!socket.destroyed) finish(socket, rawAnswer(status, reason), line);
    });
  });
  // node:http hands a CONNECT, and a request that asks for an Upgrade, to events of their own, with the socket and no response, and
  // tracks the socket no more: close() destroys it here. With no listener a CONNECT is closed unanswered, and an Upgrade is served with
  // the rest of its read thrown away, so the requests after it would be answered out of step. Each is refused in its turn and its
  // connection closed. Node takes its own error and timeout listeners off the socket, so both are put back: an answer before it that
  // is never read is cut as any is.
  const handedOver = new Set<Duplex>();
  const refuseHandedOver = (socket: Duplex, method: string, status: 400 | 405, reason: string, allow?: string): void => {
    handedOver.add(socket);
    socket.on('close', () => { handedOver.delete(socket); });
    socket.on('error', () => { socket.destroy(); });
    socket.on('timeout', () => { socket.destroy(); });
    inTurn(socket, null, async () => {
      finish(socket, rawAnswer(status, reason, allow), { method: methodOf(method), route: '(none)', status });
    });
  };
  server.on('connect', (req: IncomingMessage, socket: Duplex) => { refuseHandedOver(socket, req.method ?? '', 405, REASON.noMethod, 'GET, POST'); });
  server.on('upgrade', (req: IncomingMessage, socket: Duplex) => { refuseHandedOver(socket, req.method ?? '', 400, REASON.noUpgrade); });
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
          for (const socket of handedOver) socket.destroy();
        }),
      });
    });
  });
}
