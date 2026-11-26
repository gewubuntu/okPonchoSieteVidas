import { describe, expect, it } from 'vitest';
import { BODY_LIMIT, fieldsOf, fromElsewhere, isJsonType, json, methodOf, quietly, readBody, refuse, type RequestLog } from './boundary';

const URL_OF = 'http://api.invalid/api/v1/sign-in/nonce';
const post = (body: NonNullable<RequestInit['body']>, headers: Record<string, string> = {}): Request => new Request(URL_OF, { method: 'POST', body, headers });

/** A body of this text in bytes; the bytes of a string are what counts, not its characters. */
const objectOf = (filler: string): string => `{"x":"${filler}"}`;

/** A stream with no length: `chunks` chunks of `size` bytes of 'a', then (if `last` is given) one more of `last` bytes, counting each pull and a cancel. */
function streamOf(chunks: number, size: number, last = 0) {
  const seen = { pulls: 0, cancelled: false };
  const stream = new ReadableStream<Uint8Array>(
    {
      pull(controller) {
        seen.pulls += 1;
        if (seen.pulls <= chunks) controller.enqueue(new Uint8Array(size).fill(97));
        else if (seen.pulls === chunks + 1 && last > 0) controller.enqueue(new Uint8Array(last).fill(97));
        else controller.close();
      },
      cancel() {
        seen.cancelled = true;
      },
    },
    { highWaterMark: 0 }, // a pull only when a read is waiting, so the pulls are the reads
  );
  return { stream, seen };
}
const streamed = (stream: ReadableStream<Uint8Array>, headers: Record<string, string> = {}): Request =>
  new Request(URL_OF, { method: 'POST', body: stream, headers, duplex: 'half' });

describe('GDD-TEC-10 boundary: the body bound, in bytes', () => {
  it('BODY_LIMIT is 65536 bytes', () => {
    expect(BODY_LIMIT).toBe(65536);
  });

  it('a body of exactly 65536 bytes is read whole, though it has 32764 two-byte characters', async () => {
    const text = objectOf('é'.repeat(32764)); // 6 + 2 x 32764 + 2 = 65536 bytes
    expect(Buffer.byteLength(text)).toBe(65536);
    const read = await readBody(post(text), BODY_LIMIT);
    expect(read).toEqual({ ok: true, body: { x: 'é'.repeat(32764) } });
  });

  it('a body of 65537 bytes is too large, though it has 32773 characters', async () => {
    const text = objectOf(`${'é'.repeat(32764)}a`);
    expect(Buffer.byteLength(text)).toBe(65537);
    expect(text.length).toBe(32773);
    expect(await readBody(post(text), BODY_LIMIT)).toEqual({ ok: false, status: 413, reason: 'the body is too large' });
  });

  it('a stream of 65537 bytes with no length is refused after exactly 17 pulls, and the stream is not cancelled', async () => {
    const { stream, seen } = streamOf(16, 4096, 1); // 16 chunks are exactly 65536 bytes; the 17th pull gives the 65537th
    expect(await readBody(streamed(stream), BODY_LIMIT)).toEqual({ ok: false, status: 413, reason: 'the body is too large' });
    expect(seen.pulls).toBe(17);
    expect(seen.cancelled).toBe(false);
  });

  it('a stream of exactly 65536 bytes is read to its end, not refused after 16 pulls', async () => {
    const { stream, seen } = streamOf(16, 4096);
    // Sixteen chunks of 'a' are no JSON, which is the answer after the whole stream was read (the 17th pull closes it).
    expect(await readBody(streamed(stream), BODY_LIMIT)).toEqual({ ok: false, status: 400, reason: 'the body is not JSON' });
    expect(seen.pulls).toBe(17);
  });

  it('a declared length of 65537 is refused unread, whatever the body', async () => {
    const { stream, seen } = streamOf(1, 2);
    const read = await readBody(streamed(stream, { 'content-length': '65537' }), BODY_LIMIT);
    expect(read).toEqual({ ok: false, status: 413, reason: 'the body is too large' });
    expect(seen.pulls).toBe(0);
    expect(await readBody(post('{}', { 'content-length': '65537' }), BODY_LIMIT)).toEqual({ ok: false, status: 413, reason: 'the body is too large' });
  });

  it('a declared length of 65536 is read, and a length that is no number declares nothing', async () => {
    expect(await readBody(post('{}', { 'content-length': '65536' }), BODY_LIMIT)).toEqual({ ok: true, body: {} });
    expect(await readBody(post('{}', { 'content-length': '70000, 70000' }), BODY_LIMIT)).toEqual({ ok: true, body: {} });
  });

  it('the limit is the one given', async () => {
    expect(await readBody(post('{"a":1}'), 7)).toEqual({ ok: true, body: { a: 1 } });
    expect(await readBody(post('{"a":12}'), 7)).toEqual({ ok: false, status: 413, reason: 'the body is too large' });
  });
});

describe('GDD-TEC-10 boundary: encoding and JSON', () => {
  it('the bytes ff fe 41 are not UTF-8, which is not the same refusal as not JSON', async () => {
    expect(await readBody(post(new Uint8Array([0xff, 0xfe, 0x41])), BODY_LIMIT)).toEqual({ ok: false, status: 400, reason: 'the body is not UTF-8' });
  });

  it.each(['{', '', 'nope', '{"a":'])('%j is not JSON', async (text) => {
    expect(await readBody(post(text), BODY_LIMIT)).toEqual({ ok: false, status: 400, reason: 'the body is not JSON' });
  });

  it('no body at all is not JSON', async () => {
    expect(await readBody(new Request(URL_OF, { method: 'POST' }), BODY_LIMIT)).toEqual({ ok: false, status: 400, reason: 'the body is not JSON' });
  });

  it.each(['[]', 'null', '1', '"x"', 'true', '[{}]'])('%s is not an object', async (text) => {
    expect(await readBody(post(text), BODY_LIMIT)).toEqual({ ok: false, status: 400, reason: 'the body is not an object' });
  });

  it('a JSON __proto__ is an own key of the body', async () => {
    const read = await readBody(post('{"__proto__":{}}'), BODY_LIMIT);
    expect(read.ok && Object.keys(read.body)).toEqual(['__proto__']);
  });

  it('an array 32768 levels deep, within the limit, is refused as not an object, never thrown', async () => {
    const text = '['.repeat(32768) + ']'.repeat(32768);
    expect(Buffer.byteLength(text)).toBe(65536);
    expect(await readBody(post(text), BODY_LIMIT)).toEqual({ ok: false, status: 400, reason: 'the body is not an object' });
  });
});

describe('GDD-TEC-10 boundary: the content type', () => {
  it.each(['application/json', 'application/json; charset=utf-8', 'APPLICATION/JSON;charset="UTF-8"', 'application/json;charset=UTF-8', 'Application/Json ; Charset = "utf-8" ', 'application/json; boundary=x'])('%j is JSON', (header) => {
    expect(isJsonType(header)).toBe(true);
  });

  it.each([
    'application/json; charset=utf-16',
    'application/json; CHARSET=utf-16',
    'application/json; charset=',
    'application/json; charset="utf-16"',
    'application/json; charset=utf-8; charset=utf-16',
    'application/json; charset=utf-8x',
    'application/jsonx',
    'xapplication/json',
    'application/json, text/plain',
    // A comma is never JSON, whatever comes before it: two headers, the first with a parameter, read 'a; b, c'.
    'application/json; a=b, text/plain',
    'application/json;, text/plain',
    'application/json; charset=utf-8, application/x-www-form-urlencoded',
    'application/json, application/json',
    'text/plain',
    'text/plain; application/json',
    '',
    null,
  ])('%j is not', (header) => {
    expect(isJsonType(header)).toBe(false);
  });
});

describe('GDD-TEC-10 boundary: the log line', () => {
  it('a method is named as written only if it is one of the usual seven', () => {
    expect(['GET', 'HEAD', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'].map(methodOf)).toEqual(['GET', 'HEAD', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS']);
    expect(['get', 'TRACE', 'CONNECT', 'SECRETVERB', ''].map(methodOf)).toEqual(['(other)', '(other)', '(other)', '(other)', '(other)']);
  });

  it('a log made quiet passes each line on, and one that throws throws nothing', () => {
    const lines: RequestLog[] = [];
    quietly((line) => { lines.push(line); })({ method: 'GET', route: '(none)', status: 404 });
    expect(lines).toEqual([{ method: 'GET', route: '(none)', status: 404 }]);
    expect(() => { quietly(() => { throw new Error('zz-log'); })({ method: 'GET', route: '(none)', status: 404 }); }).not.toThrow();
  });
});

describe('GDD-TEC-10 boundary: the fields', () => {
  it('exactly the keys given: no more, no fewer, in any order', () => {
    expect(fieldsOf({}, [])).toBe(true);
    expect(fieldsOf({ a: 1, b: 2 }, ['a', 'b'])).toBe(true);
    expect(fieldsOf({ b: 2, a: 1 }, ['a', 'b'])).toBe(true);
    expect(fieldsOf({ a: 1 }, [])).toBe(false);
    expect(fieldsOf({ a: 1, b: 2, c: 3 }, ['a', 'b'])).toBe(false);
    expect(fieldsOf({ a: 1 }, ['a', 'b'])).toBe(false);
    expect(fieldsOf({}, ['a'])).toBe(false);
    // As many keys as asked for, but not these.
    expect(fieldsOf({ a: 1, c: 3 }, ['a', 'b'])).toBe(false);
  });

  it('a key only the prototype has is not a field of the body', () => {
    expect(fieldsOf({}, ['toString'])).toBe(false);
  });
});

const withOrigin = (value?: string): Request => new Request(URL_OF, { method: 'POST', headers: value === undefined ? {} : { origin: value } });

describe('GDD-TEC-10 boundary: the Origin rule', () => {
  const SITE = 'http://localhost:5173';

  it('the site\'s own origin, and no Origin at all, are not from elsewhere', () => {
    expect(fromElsewhere(withOrigin(SITE), SITE)).toBe(false);
    expect(fromElsewhere(withOrigin(), SITE)).toBe(false);
  });

  it.each([
    'http://localhost:5174',
    'https://localhost:5173',
    'http://localhost:5173/',
    'null',
    '',
    'http://localhost:5173, http://localhost:5173',
    'http://localhost:5173.evil.test',
    'HTTP://LOCALHOST:5173',
  ])('%j is from elsewhere', (origin) => {
    expect(fromElsewhere(withOrigin(origin), SITE)).toBe(true);
  });

  it('two Origin headers read as one doubled text', () => {
    const headers = new Headers();
    headers.append('origin', SITE);
    headers.append('origin', SITE);
    expect(fromElsewhere(new Request(URL_OF, { method: 'POST', headers }), SITE)).toBe(true);
  });
});

describe('GDD-TEC-10 boundary: the answers', () => {
  it('json answers with the fixed headers and each Set-Cookie on its own line', async () => {
    const response = json(200, { a: 1 }, ['x=1; Path=/api', 'y=2']);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/json; charset=utf-8');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.getSetCookie()).toEqual(['x=1; Path=/api', 'y=2']);
    expect(await response.json()).toEqual({ a: 1 });
    expect([...json(200, {}).headers.keys()].toSorted()).toEqual(['cache-control', 'content-type']);
  });

  it('refuse answers { error: reason } with the fixed headers, and Allow only when asked', async () => {
    const response = refuse(403, 'why');
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'why' });
    expect(response.headers.get('content-type')).toBe('application/json; charset=utf-8');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.has('allow')).toBe(false);
    expect(refuse(405, 'why', 'GET').headers.get('allow')).toBe('GET');
  });

  it('no answer carries a CORS header', () => {
    for (const response of [json(200, {}), refuse(403, 'x'), refuse(405, 'x', 'GET')]) {
      expect([...response.headers.keys()].filter((name) => name.startsWith('access-control-'))).toEqual([]);
    }
  });
});
