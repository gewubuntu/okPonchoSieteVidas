// GDD-TEC-10, docs/decisions/0004-game-server.md ("HTTP"): the only socket code. It turns a node:http request into a standard Request and
// a standard Response back into bytes; every rule is in app.ts, which a test calls with no socket.
// It never reads Host or X-Forwarded-*: the Request's URL has a host of its own that no client sets.
import { createServer, STATUS_CODES, type IncomingMessage, type ServerResponse } from 'node:http';
import { Readable, type Duplex } from 'node:stream';
import { Socket } from 'node:net';
import { codeOf, FIXED_HEADERS, lineOf, methodOf, quietly, refuse, REASON, withLine, type RequestLog } from './boundary';

/**
 * The server's own settings, not GDD values, in ms: how long a client may take to send a whole request and its headers; how often node
 * checks those two (by its default of 30 s a client could hold a socket that long past them); how long a connection may make no
 * progress either way, as when a client reads none of its answers; and how long a kept connection may wait from an answer to the next
 * request, whatever it sends meanwhile (node skips blank lines between requests, and each byte would put off the idle limit).
 */
export interface SocketLimits { readonly requestMs: number; readonly headersMs: number; readonly checkMs: number; readonly idleMs: number; readonly keptMs: number }
// keptMs runs until node has the next request's headers whole: a request still coming in then is closed unanswered.
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

/**
 * Whether `req` asks for a 100 Continue in the one form RFC 9110 gives it: node takes any Expect in which the words stand apart. Node
 * strips the spaces around a header's value, so none is left to trim (L-025).
 */
const expectsContinue = (req: IncomingMessage): boolean => req.headers.expect?.toLowerCase() === '100-continue';

/** Whether the app read each request's body to its end, for the requests whose body it was handed (`send` reads it). */
const bodies = new WeakMap<IncomingMessage, { ended: boolean }>();

/** The body the app is handed: `req`'s bytes as the app asks for them, so that reading to the end is known (`bodies`). */
function bodyOf(req: IncomingMessage): ReadableStream<Uint8Array> {
  const read = { ended: false };
  bodies.set(req, read);
  const source = Readable.toWeb(req).getReader();
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { done, value } = await source.read();
      if (done) {
        read.ended = true;
        controller.close();
      } else controller.enqueue(value);
    },
    // Cancelling destroys the request, and node then takes its socket from it: answerInTurn holds the socket from before the app ran.
    cancel: (reason) => source.cancel(reason),
  }, { highWaterMark: 0 });
}

/**
 * The Request for a node request, or the status to answer with: 405 for a method `Request` refuses (TRACE; a CONNECT never comes here,
 * see `serve`), 400 for a target or a header that does not read and for an HTTP/1.1 request with no Host (RFC 9112, 3.2; node's own
 * check is off, see `serve`), 417 for an Expect other than 100-continue, on any version.
 */
export function toRequest(req: IncomingMessage): { readonly request: Request } | { readonly status: 400 | 405 | 417; readonly reason: string } {
  const method = req.method ?? 'GET';
  try {
    new Request(BASE, { method });
  } catch {
    return { status: 405, reason: REASON.noMethod };
  }
  const target = targetOf(req.url ?? '');
  if (target === null) return { status: 400, reason: REASON.noRoute };
  if (req.httpVersion === '1.1' && req.headers.host === undefined) return { status: 400, reason: REASON.noHost };
  if (req.headers.expect !== undefined && !expectsContinue(req)) return { status: 417, reason: REASON.noExpectation };
  try {
    const headers = new Headers();
    // rawHeaders is name, value, name, value: always of even length.
    for (let i = 0; i < req.rawHeaders.length; i += 2) headers.append(req.rawHeaders[i] ?? '', req.rawHeaders[i + 1] ?? '');
    // A GET and a HEAD have no body to read, nor has a request that declares none (no length and no chunks, or a length of 0), so
    // nothing of it is left unread; any other's body is read from the stream as the handler asks for it.
    const declares = req.headers['transfer-encoding'] !== undefined || (req.headers['content-length'] ?? '0') !== '0';
    if (method === 'GET' || method === 'HEAD' || !declares) return { request: new Request(`${BASE}${target}`, { method, headers }) };
    return { request: new Request(`${BASE}${target}`, { method, headers, body: bodyOf(req), duplex: 'half' }) };
  } catch {
    return { status: 400, reason: REASON.noRoute };
  }
}

/**
 * Writes the Response: its status, every header with each Set-Cookie on its own line, and its bytes. A request body not read to its end
 * closes the connection. Known and not done: a client still sending then may lose the answer to the connection's reset (the lingering
 * close of RFC 9112, 9.6); the game's own client never sends a body that is refused unread.
 */
/**
 * Writes `body` as `res`'s whole answer, its length given, in one write with nothing after it, so node's 'finish' comes on the turn
 * the socket has taken it all (answerInTurn). An end in the same turn adds an empty piece to that write. What the socket cannot take
 * at once is written on later turns of the loop, an empty last piece too, and a client that has read the answer and reset by then
 * makes that piece fail, and with it the whole write: node 22 then emits 'finish' with the socket destroyed, and node 24 none. So the
 * end waits for the write. Node drops an empty piece it can write at once, so an empty body needs nothing of its own, and it writes no
 * body for a HEAD, a 204 or a 304, calling the write back at once (L-025).
 */
function writeWhole(res: ServerResponse, body: Buffer | string): void {
  // A 204 and a 304 carry no length (RFC 9110, 8.6), the app's own included.
  if (res.statusCode === 204 || res.statusCode === 304) res.removeHeader('content-length');
  else res.setHeader('content-length', String(Buffer.byteLength(body)));
  res.write(body, () => { res.end(); });
}

/**
 * The headers that frame an answer or concern only its connection (RFC 9110, 7.6.1): the adapter alone sets them, so an app's
 * Response that carries one (as a fetched Response passed on would) cannot make an answer no client reads, keep a connection that
 * closes, or make node throw as it writes. An app's content-length needs no place here: writeWhole sets the length over it (L-025).
 */
const FRAMING = new Set(['connection', 'keep-alive', 'proxy-connection', 'te', 'trailer', 'transfer-encoding', 'upgrade']);

export async function send(res: ServerResponse, response: Response): Promise<void> {
  // A network error (Response.error(), status 0) is no answer to send: node would throw on its status only once it writes, which a
  // client gone by then puts after every catch. The adapter's own 500 answers it.
  if (response.type === 'error') throw new Error('an app answered with a network error');
  const bytes = Buffer.from(await response.arrayBuffer());
  res.statusCode = response.status;
  for (const [name, value] of response.headers) if (name !== 'set-cookie' && !FRAMING.has(name)) res.setHeader(name, value);
  // An empty list writes no header, so an answer with no cookie needs no check of its own (L-025; the socket test reads none back).
  res.setHeader('set-cookie', response.headers.getSetCookie());
  // A body not all read: the client may still be sending it, or it came whole and lies unread (in node's buffer, or in the queue of the
  // stream the app was handed), wherever in a pipeline the request was. Either way the connection is not kept for the next request.
  // Node may run a turn between a request's headers and the rest of the same read (an empty chunked body's trailer), so a request not
  // yet complete is given that read first.
  if (!res.req.complete) await new Promise((done) => { setImmediate(done); });
  const read = bodies.get(res.req);
  if (read === undefined ? !res.req.complete || res.req.readableLength > 0 : !read.ended) res.setHeader('connection', 'close');
  writeWhole(res, bytes);
}

/** The adapter's own refusal of a method: Allow names the methods the server serves at all, since no route is matched here. */
const noMethod = (): Response => refuse(405, REASON.noMethod, 'GET, POST');

/** The answer to `req`, with its line: the app's, or the adapter's own refusal, whose line names no route since none was accepted. */
async function answerOf(app: App, req: IncomingMessage): Promise<Response> {
  const made = toRequest(req);
  if ('request' in made) return app(made.request);
  const refusal = made.status === 405 ? noMethod() : refuse(made.status, made.reason);
  return withLine(refusal, { method: methodOf(req.method ?? ''), route: '(none)', status: made.status });
}

/**
 * The adapter's own 500, when a request could not be answered: nothing is known of why, so nothing of it is said, and the connection is
 * not kept. Nothing has been sent by then: `send` writes the headers in its last call, `writeWhole`, and nothing after it can throw (L-025).
 */
function lastResort(res: ServerResponse): void {
  // None of the failed answer's headers: send may have set some before node refused one.
  for (const name of res.getHeaderNames()) res.removeHeader(name);
  res.statusCode = 500;
  for (const [name, value] of Object.entries(FIXED_HEADERS)) res.setHeader(name, value);
  res.setHeader('connection', 'close');
  writeWhole(res, JSON.stringify({ error: REASON.serverError }));
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

/** A request node emitted, with the response node gave it. */
interface Exchange { readonly req: IncomingMessage; readonly res: ServerResponse }

/** What the adapter keeps of one connection: its last turn, how many of its requests are unanswered, the last one run, its wait for the next. */
interface Connection {
  turn: Promise<void>;
  unanswered: number;
  /**
   * The request whose turn ran last, with its response (null for one node handed over). It is not cleared once answered (L-025): an
   * answer to a request not read to its end closes the connection (`send`), so one still kept was read whole, and `complete` tells the
   * two apart.
   */
  running: Exchange | null;
  /**
   * Set once node gave up reading it, when the connection is read no further: a request still waiting that node had not read whole
   * is never run, and the connection's last answer says why.
   */
  broken: boolean;
  kept: NodeJS.Timeout | undefined;
}

/**
 * Serves `app` on 127.0.0.1 only (the dev routes are never on the network), at `port` (0: any free one). `log` gets each answer's line
 * (the app's, `lineOf`, and the adapter's own) once the answer is written, so an answer no client gets leaves none; a log that throws
 * changes no answer.
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
   * Runs `step` on `socket` once the turns before it are done, unless the connection is gone by then, or broken with `current`'s request
   * not read whole (one node gave up on part way); once no later turn waits, the connection's wait for its next request (keptMs) starts.
   */
  const inTurn = (socket: Duplex, current: Exchange | null, step: () => Promise<void>): void => {
    const connection = connectionOf(socket);
    clearTimeout(connection.kept);
    connection.unanswered += 1;
    // The turn below then runs nothing, since its socket is gone (L-025: no return of its own).
    if (connection.unanswered > UNANSWERED_LIMIT) socket.destroy();
    const turn = connection.turn.then(async () => {
      if (!socket.writableEnded && !socket.destroyed && !(connection.broken && current?.req.complete === false)) {
        connection.running = current;
        await step();
      }
      connection.unanswered -= 1;
      // A later request already waiting has a turn of its own; a gone connection's wait only destroys it again (L-025: no check of its own).
      // A socket an answer has ended waits for that answer to go out, under its deadline, not for a next request.
      if (connection.turn === turn && !socket.writableEnded) connection.kept = setTimeout(() => { socket.destroy(); }, limits.keptMs).unref();
    });
    connection.turn = turn;
  };
  /**
   * Destroys `socket` unless the answer just written to it is out within the idle limit. Node's own idle timer lets a write that makes
   * no progress run twice its limit, and each byte the client sends puts it off, so a client that reads nothing could hold the socket
   * for as long as it keeps sending. `done` ends the wait.
   */
  const deadline = (socket: Duplex): (() => void) => {
    const timer = setTimeout(() => { socket.destroy(); }, limits.idleMs).unref();
    return () => { clearTimeout(timer); };
  };
  /** Ends `socket` with `bytes` and destroys it, logging `line` once they are written. A socket already ended or gone gets nothing. */
  const finish = (socket: Duplex, bytes: Buffer, line: RequestLog): void => {
    // Node still reports a request timeout after bytes it could not read, so a second raw answer can come while the first is going
    // out: ending the socket again would destroy it under that answer. A kept survivor: no test here can hold an answer of about 200
    // bytes in the socket's buffers.
    if (!socket.writable) return;
    // The connection now waits for this answer to go out, under its deadline, not for a next request: neither the kept wait nor
    // node's own, which it arms once an answer has finished and which would destroy the socket with this answer still in its buffer.
    // A kept survivor, as above.
    clearTimeout(connectionOf(socket).kept);
    // Node's events type the socket as a Duplex; a server made with createServer hands over a net.Socket, so this always holds.
    if (socket instanceof Socket) socket.setTimeout(0);
    const done = deadline(socket);
    socket.end(bytes, (error?: Error | null) => {
      done();
      if (!(error instanceof Error)) note(line);
      socket.destroy();
    });
  };
  /**
   * Answers `req` in its turn with the app's answer, the adapter's own 500 if that fails, and lets the next turn start once the answer
   * is sent. The answer's line is logged on node's 'finish', once it is written: a response whose connection is gone never finishes.
   */
  const answerInTurn = (req: IncomingMessage, res: ServerResponse): void => {
    // Taken before the app runs: node takes the socket from a request whose body is destroyed.
    const socket = req.socket;
    inTurn(socket, { req, res }, async () => {
      // Listened for before anything is written: node's own 'finish', which ends a connection the answer closes, has then run by the next turn.
      const answered = new Promise<void>((done) => {
        res.once('finish', done);
        res.once('close', done);
      });
      let line: RequestLog | undefined;
      // Node 22 emits 'finish' also when the connection is destroyed with the answer still going out (a reset, the deadline, close()),
      // and node 24 none then; an answer that went out whole finds its socket there, since its 'finish' follows the write at once
      // (writeWhole). Node's own 'finish' listener, before this one, only ends a connection the answer closes (L-025).
      res.once('finish', () => { if (line !== undefined && !socket.destroyed) note(line); });
      try {
        const response = await answerOf(app, req);
        line = lineOf(response);
        await send(res, response);
      } catch {
        // Nothing has been written then (lastResort), so the 500 is the one answer, and its line the one line.
        line = { method: methodOf(req.method ?? ''), route: '(none)', status: 500 };
        lastResort(res);
      }
      const done = deadline(socket);
      await answered;
      done();
    });
  };
  // requireHostHeader: node would answer an HTTP/1.1 request with no Host itself, out of its turn, with neither fixed header nor a line;
  // toRequest refuses it instead.
  const server = createServer({ requestTimeout: limits.requestMs, headersTimeout: limits.headersMs, connectionsCheckingInterval: limits.checkMs, requireHostHeader: false }, (req, res) => {
    answerInTurn(req, res);
  });
  // createServer's options do not take it: a socket with no bytes either way for this long is destroyed. An answer must also be out
  // within it once written (deadline), so the limit bounds how long a client may take to read one answer (D1's are about 1 KB).
  server.timeout = limits.idleMs;
  // An HTTP/1.1 Expect: node hands one it takes for 100-continue to 'checkContinue' and any other to 'checkExpectation', and would answer
  // the second 417 itself, with neither fixed header nor a line. Both are answered in their turn, and toRequest refuses every Expect but
  // 100-continue itself (node takes '100-continue' among other words for it); only that one gets its 100 Continue, which node writes in
  // order behind the answers before it. An HTTP/1.0 Expect node passes on as it is.
  server.on('checkContinue', (req: IncomingMessage, res: ServerResponse) => {
    if (expectsContinue(req)) res.writeContinue();
    answerInTurn(req, res);
  });
  server.on('checkExpectation', (req: IncomingMessage, res: ServerResponse) => { answerInTurn(req, res); });
  // Bytes node could not read as a request (400, 431, 413) and a client too slow (408). Node would answer at once and destroy the
  // socket, cutting the answer of a request it had already run. A request still coming in, being answered, is the one node gave up
  // on: it is answered now. Otherwise the bytes came after every request node had read, so each of those is answered first, in its turn,
  // and then this; a waiting request node gave up on part way is never run.
  server.on('clientError', (error: unknown, socket: Duplex) => {
    // Node would say it again for each later read of a connection it gave up on, queuing one answer per read (L-106); no later read
    // comes, since the connection is read no further (below), so that needs no check of its own (L-025). Nor does a reset: finish
    // writes nothing to a socket that is gone.
    const connection = connectionOf(socket);
    // Nothing more is read once node has given up: after a timeout node would read on, so a request it gave up on could still come in
    // whole before its turn, a running one's body could reach the app after this answer, and a later request could be read. Node
    // itself resumes the socket in several places (once an answer drains, once a body it held back is read, after a 100 Continue),
    // and each resume starts the handle reading before its 'resume' event, whatever the stream's state. So on each resume the read
    // is stopped again: node's own 'pause' listener stops the handle, and it is told so even when the stream already counts as paused,
    // where pause() tells no one. The stream's own state needs no pause of its own (L-025): node's parser reads the handle itself, so
    // the stream never starts a read again. Once per connection: a listener added on each of node's reports would grow with what the
    // client sends if reading ever went on (L-106; a kept survivor, as no report comes once reading stops).
    if (!connection.broken) socket.on('resume', () => { socket.emit('pause'); });
    connection.broken = true;
    socket.pause();
    // Bytes after a request that closes the connection (node's HPE_CLOSED_CONNECTION) need no check of their own (L-025): that
    // request's answer ends the connection, and the answer queued here behind it then finds the socket ended (finish).
    const { status, reason } = unreadable(error);
    const line: RequestLog = { method: '(other)', route: '(none)', status };
    const running = connection.running;
    if (running !== null && !running.req.complete) {
      // An answer already started for it closes the connection (`send`): nothing more is sent, also while it is still going out.
      if (!running.res.headersSent) finish(socket, rawAnswer(status, reason), line);
      return;
    }
    // The one answer waiting behind the turns (nothing more is read, so no second comes), not counted toward UNANSWERED_LIMIT: 16
    // requests and bad bytes after them get 16 answers and this. A connection ended meanwhile, as by an answer that closed it, gets
    // nothing (finish).
    void connection.turn.then(() => { finish(socket, rawAnswer(status, reason), line); });
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
