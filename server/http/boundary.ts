// GDD-TEC-10, docs/decisions/0004-game-server.md ("HTTP"): the checks every route shares, on the standard Request and Response.
// What a client sends is unknown until these have checked it (L-102): no client value is logged, echoed or given to JSON.stringify here.

/**
 * The most bytes of a request body the server reads. The server's own setting, not a GDD value: it must hold a contract wallet's
 * signature (ERC-6492) and a save text (docs/decisions/0004-game-server.md, "HTTP").
 */
export const BODY_LIMIT = 65536;

/** Each refusal's reason, as the answer's `{ error }` says it. They are a contract with the client, not words on screen. */
export const REASON = {
  notUtf8: 'the body is not UTF-8',
  notJson: 'the body is not JSON',
  notObject: 'the body is not an object',
  otherFields: 'the body has other fields',
  tooLarge: 'the body is too large',
  notWhole: 'the body did not arrive whole',
  notJsonRequest: 'not a JSON request',
  notFromSite: 'not from the game\'s site',
  noRoute: 'no such route',
  noMethod: 'no such method',
  noQuery: 'no query here',
  serverError: 'server error',
  notReadable: 'the request does not read',
  tooSlow: 'the request took too long',
  headersTooLarge: 'the headers are too large',
  noUpgrade: 'no upgrade here',
  noExpectation: 'no such expectation',
} as const;

/** An error's code (EADDRINUSE, EPIPE, HPE_HEADER_OVERFLOW), the one thing of it a line or an answer may name: its text could hold a path or a key. */
export function codeOf(error: unknown): string {
  const code: unknown = typeof error === 'object' && error !== null ? Reflect.get(error, 'code') : undefined;
  return typeof code === 'string' ? code : 'unknown';
}

/** The one line a request leaves in the log: nothing the client wrote but the method, and that only if it is a usual one. */
export interface RequestLog { readonly method: string; readonly route: string; readonly status: number }

// The methods a log line names as the client wrote them; any other is "(other)", so no client text reaches a line.
const USUAL_METHODS: ReadonlySet<string> = new Set(['GET', 'HEAD', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS']);
/** A method as a log line names it: as written if it is one of the usual seven, else "(other)". */
export const methodOf = (method: string): string => (USUAL_METHODS.has(method) ? method : '(other)');

/** `log`, made so that a log that throws changes nothing of the answer: nothing of what it threw is kept or answered. */
export const quietly = (log: (line: RequestLog) => void) => (line: RequestLog): void => {
  try {
    log(line);
  } catch {
    // A line that cannot be logged is dropped.
  }
};

/** Whether a value read from JSON is a plain object (an array and null are not). */
export const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

export type Read =
  | { readonly ok: true; readonly body: Readonly<Record<string, unknown>> }
  | { readonly ok: false; readonly status: 400 | 408 | 413; readonly reason: string };

const refused = (status: 400 | 408 | 413, reason: string): Read => ({ ok: false, status, reason });

/**
 * The request's body as a JSON object: at most `limit` bytes (counted in bytes, not characters), strict UTF-8, JSON, a plain object.
 * A declared length over the limit is refused unread. Otherwise the stream is read until it ends or passes the limit; then the reader is
 * released, never cancelled: a cancel would destroy the socket and the client would lose the answer (node.ts). A stream that fails (the
 * client went away, or node's request timeout cut it and answered 408 itself) is a 408, so the request's log line names what node sent.
 */
export async function readBody(request: Request, limit: number): Promise<Read> {
  // A length that is no number (a doubled header reads 'a, b') declares nothing: the stream is counted anyway.
  if (Number(request.headers.get('content-length')) > limit) return refused(413, REASON.tooLarge);
  const chunks: Uint8Array[] = [];
  let total = 0;
  if (request.body !== null) {
    const reader = request.body.getReader();
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > limit) return refused(413, REASON.tooLarge);
        chunks.push(value);
      }
    } catch {
      return refused(408, REASON.notWhole);
    } finally {
      reader.releaseLock();
    }
  }
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks));
  } catch {
    return refused(400, REASON.notUtf8);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return refused(400, REASON.notJson);
  }
  if (!isRecord(parsed)) return refused(400, REASON.notObject);
  return { ok: true, body: parsed };
}

/**
 * `application/json`, with parameters allowed; a `charset` among them must be UTF-8 (in any case, quoted or not). A comma is never JSON:
 * two Content-Type headers read 'a, b', and a list is no one type.
 */
export function isJsonType(header: string | null): boolean {
  if (header === null || header.includes(',')) return false;
  const [type = '', ...parameters] = header.split(';');
  if (type.trim().toLowerCase() !== 'application/json') return false;
  return parameters.every((parameter) => {
    const [name = '', ...value] = parameter.split('=');
    if (name.trim().toLowerCase() !== 'charset') return true;
    return value.join('=').trim().replace(/^"(.*)"$/, '$1').toLowerCase() === 'utf-8';
  });
}

/** Whether the body has exactly these keys of its own, no more and no fewer (a JSON `__proto__` is an own key, so it counts). */
export function fieldsOf(body: Readonly<Record<string, unknown>>, keys: readonly string[]): boolean {
  const own = Object.keys(body);
  return own.length === keys.length && keys.every((key) => own.includes(key));
}

/** Whether the request carries an Origin other than the site's, compared exactly. No Origin at all is not elsewhere (curl, a GET). A doubled header reads 'a, b' and so is elsewhere. */
export function fromElsewhere(request: Request, siteOrigin: string): boolean {
  const origin = request.headers.get('origin');
  return origin !== null && origin !== siteOrigin;
}

/** The headers every answer has, the adapter's own 500 included (node.ts). */
export const FIXED_HEADERS: Readonly<Record<string, string>> = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };

const answer = (status: number, body: unknown, extra: readonly (readonly [string, string])[] = []): Response => {
  const headers = new Headers(FIXED_HEADERS);
  for (const [name, value] of extra) headers.append(name, value);
  return new Response(JSON.stringify(body), { status, headers });
};

/** An answer from a value of the server's own (never a client's), with each Set-Cookie text on a line of its own. */
export const json = (status: number, body: unknown, cookies: readonly string[] = []): Response => answer(status, body, cookies.map((cookie) => ['set-cookie', cookie] as const));

/** A refusal: `{ error: reason }`, `reason` one of `REASON`. `allow` names the methods of a 405. */
export const refuse = (status: number, reason: string, allow?: string): Response => answer(status, { error: reason }, allow === undefined ? [] : [['allow', allow]]);
