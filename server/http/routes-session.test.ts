import { createHash } from 'node:crypto';
import { privateKeyToAccount } from 'viem/accounts';
import { createSiweMessage } from 'viem/siwe';
import { describe, expect, it } from 'vitest';
import { mockChain, type MockChain } from '../chain/mock';
import { resolveConfig } from '../config';
import { memoryStore } from '../store/memory';
import type { Store } from '../store/store';
import { loadTokenKey } from '../tokens/key';
import { createApp, type AppDeps } from './app';
import { lineOf, type RequestLog } from './boundary';

const NOON = Date.parse('2026-11-21T12:00:00.000Z');
const SITE = 'http://localhost:5173';
const NONCE = 'http://api.invalid/api/v1/sign-in/nonce';
const JSON_TYPE = { 'content-type': 'application/json' };

/** Each call gives `n` bytes all equal to the call's number: the first nonce is 16 x 0x01, the second 16 x 0x02. */
const counter = (): AppDeps['random'] => {
  let calls = 0;
  return (bytes) => Buffer.alloc(bytes, ++calls);
};

interface Fixture {
  readonly app: (request: Request) => Promise<Response>;
  readonly store: Store;
  readonly chain: MockChain;
  /** The server's clock, which a test may move. */
  readonly clock: { now: number };
  readonly site: { readonly origin: string; readonly domain: string };
}
function fixture(site: { readonly origin: string; readonly domain: string } = { origin: SITE, domain: 'localhost:5173' }): Fixture {
  const store = memoryStore();
  const chain = mockChain();
  const clock = { now: NOON };
  const { config } = resolveConfig({});
  if (config === null) throw new Error('the starting config does not read');
  const deps: AppDeps = {
    store,
    chain,
    config,
    key: loadTokenKey(undefined, 'mock'),
    site: { origin: site.origin, domain: site.domain, uri: site.origin },
    clock: { now: () => clock.now },
    random: counter(),
    sim: 'test',
  };
  return { app: createApp(deps), store, chain, clock, site };
}
const post = (body: NonNullable<RequestInit['body']>, headers: Record<string, string> = JSON_TYPE): Request => new Request(NONCE, { method: 'POST', body, headers });

/** What a refused request answers, and that it wrote no nonce. */
async function refusal(request: Request): Promise<[number, string]> {
  const { app, store } = fixture();
  const response = await app(request);
  expect(store.entries('nonce')).toEqual([]);
  const answer: { error: string } = JSON.parse(await response.text());
  return [response.status, answer.error];
}

describe('GDD-TEC-10 POST /api/v1/sign-in/nonce', () => {
  it('gives a nonce of 32 lowercase hex digits and keeps it until used', async () => {
    const { app, store } = fixture();
    const response = await app(post('{}'));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ nonce: '01'.repeat(16) });
    expect(store.entries('nonce')).toEqual([['01'.repeat(16), '{}']]);
    expect(await (await app(post('{}'))).json()).toEqual({ nonce: '02'.repeat(16) });
    expect(store.entries('nonce').length).toBe(2);
  });

  it('the Origin rule: the game\'s own origin, and none at all, get a nonce', async () => {
    for (const headers of [{ ...JSON_TYPE, origin: SITE }, JSON_TYPE]) {
      const { app, store } = fixture();
      expect((await app(post('{}', headers))).status).toBe(200);
      expect(store.entries('nonce').length).toBe(1);
    }
  });

  it.each([
    'http://localhost:5174',
    'https://localhost:5173',
    'http://localhost:5173/',
    'null',
    'http://localhost:5173, http://localhost:5173',
    'http://localhost:5173.evil.test',
    'http://elsewhere.invalid',
  ])('the Origin rule: %j gets 403 "not from the game\'s site" and no nonce is written', async (origin) => {
    expect(await refusal(post('{}', { ...JSON_TYPE, origin }))).toEqual([403, 'not from the game\'s site']);
  });

  it('a request that sends no Origin is let through (the rule refuses only an Origin other than the game\'s)', async () => {
    const { app } = fixture();
    expect((await app(post('{}'))).status).toBe(200);
  });

  it('a doubled Origin header is refused', async () => {
    const headers = new Headers(JSON_TYPE);
    headers.append('origin', SITE);
    headers.append('origin', SITE);
    expect(await refusal(new Request(NONCE, { method: 'POST', body: '{}', headers }))).toEqual([403, 'not from the game\'s site']);
  });

  it.each(['application/json', 'application/json; charset=utf-8', 'APPLICATION/JSON;charset="UTF-8"'])('the content type %j is accepted', async (type) => {
    const { app } = fixture();
    expect((await app(post('{}', { 'content-type': type }))).status).toBe(200);
  });

  it.each(['application/json; charset=utf-16', 'application/jsonx', 'xapplication/json', 'text/plain', 'application/json, text/plain', ''])('the content type %j gets 415 "not a JSON request"', async (type) => {
    expect(await refusal(post('{}', { 'content-type': type }))).toEqual([415, 'not a JSON request']);
  });

  it('no content type at all gets 415', async () => {
    expect(await refusal(post(new Uint8Array([0x7b, 0x7d]), {}))).toEqual([415, 'not a JSON request']);
  });

  it('a body of exactly 65536 bytes is read whole: it has other fields (400), not too large', async () => {
    const text = `{"x":"${'é'.repeat(32764)}"}`;
    expect(Buffer.byteLength(text)).toBe(65536);
    expect(await refusal(post(text))).toEqual([400, 'the body has other fields']);
  });

  it('a body of 65537 bytes gets 413 "the body is too large"', async () => {
    const text = `{"x":"${'é'.repeat(32764)}a"}`;
    expect(Buffer.byteLength(text)).toBe(65537);
    expect(await refusal(post(text))).toEqual([413, 'the body is too large']);
  });

  it('a declared length of 65537 over a body of 2 bytes gets 413, unread', async () => {
    expect(await refusal(post('{}', { ...JSON_TYPE, 'content-length': '65537' }))).toEqual([413, 'the body is too large']);
  });

  it('bytes that are not UTF-8 get "the body is not UTF-8"', async () => {
    expect(await refusal(post(new Uint8Array([0xff, 0xfe, 0x41])))).toEqual([400, 'the body is not UTF-8']);
  });

  it.each(['{', '', 'nope'])('%j gets "the body is not JSON"', async (text) => {
    expect(await refusal(post(text))).toEqual([400, 'the body is not JSON']);
  });

  it.each(['[]', 'null', '1', '"x"'])('%s gets "the body is not an object"', async (text) => {
    expect(await refusal(post(text))).toEqual([400, 'the body is not an object']);
  });

  it.each(['{"a":1}', '{"__proto__":{}}', '{"nonce":"x"}'])('%s gets "the body has other fields"', async (text) => {
    expect(await refusal(post(text))).toEqual([400, 'the body has other fields']);
  });

  it('an array 32768 levels deep gets 400, never a 500', async () => {
    expect(await refusal(post('['.repeat(32768) + ']'.repeat(32768)))).toEqual([400, 'the body is not an object']);
  });
});

const API = 'http://api.invalid';
const SIGN_IN = '/api/v1/sign-in';
const SESSION = '/api/v1/session';
const SIGN_OUT = '/api/v1/sign-out';
const ELSEWHERE = 'http://elsewhere.invalid';
const account = privateKeyToAccount(`0x${'11'.repeat(32)}`);
const stranger = privateKeyToAccount(`0x${'22'.repeat(32)}`);
const wallet = account.address.toLowerCase();
/** The secret of the first sign-in after the first nonce: call 2 of `counter`, 32 bytes of 0x02 in base64url (43 characters). */
const SECRET_2 = `${'AgIC'.repeat(10)}AgI`;
const WEEK_MS = 604800000; // SESSION.length on the mock, 604800 s (MOCK_PLACEHOLDERS)
const sha256hex = (text: string): string => createHash('sha256').update(text).digest('hex');

const postTo = (path: string, body: string, headers: Record<string, string> = {}): Request =>
  new Request(`${API}${path}`, { method: 'POST', body, headers: { ...JSON_TYPE, ...headers } });
const getFrom = (path: string, headers: Record<string, string> = {}): Request => new Request(`${API}${path}`, { headers });
/** A GET of the session, with `cookie` as its Cookie header if given. */
const sessionWith = (cookie?: string, headers: Record<string, string> = {}): Request => getFrom(SESSION, cookie === undefined ? headers : { ...headers, cookie });
async function nonceOf(f: Fixture): Promise<string> {
  const answer: { nonce: string } = JSON.parse(await (await f.app(post('{}'))).text());
  return answer.nonce;
}
interface Fields { address?: `0x${string}`; expirationTime?: Date }
/** The message the game's client writes for the fixture's site, as `server/sessions.test.ts` writes it. */
const messageOf = (f: Fixture, nonce: string, fields: Fields = {}): string =>
  createSiweMessage({
    address: fields.address ?? account.address,
    domain: f.site.domain,
    uri: f.site.origin,
    chainId: 8453,
    nonce,
    version: '1',
    issuedAt: new Date(NOON - 1000),
    ...(fields.expirationTime === undefined ? {} : { expirationTime: fields.expirationTime }),
  });
async function signedBody(f: Fixture, nonce: string, fields: Fields = {}, signer = account): Promise<string> {
  const message = messageOf(f, nonce, fields);
  return JSON.stringify({ message, signature: await signer.signMessage({ message }) });
}
/** A sign-in with a nonce from the nonce route, signed by `account`. */
async function signedIn(f: Fixture, headers: Record<string, string> = {}): Promise<Response> {
  return f.app(postTo(SIGN_IN, await signedBody(f, await nonceOf(f)), headers));
}
/** The `name=value` part of an answer's one Set-Cookie text, as a browser sends it back. */
function cookieOf(response: Response): string {
  const [text = ''] = response.headers.getSetCookie();
  return text.split(';')[0] ?? '';
}
async function walletOf(f: Fixture, cookie: string): Promise<unknown> {
  const answer: { wallet: unknown } = JSON.parse(await (await f.app(sessionWith(cookie))).text());
  return answer.wallet;
}
const errorOf = async (response: Response): Promise<[number, string]> => {
  const answer: { error: string } = JSON.parse(await response.text());
  return [response.status, answer.error];
};

describe('GDD-TEC-10 POST /api/v1/sign-in', () => {
  it('a wallet that signs the game\'s message opens a session and gets its cookie', async () => {
    const f = fixture();
    const response = await signedIn(f);
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(JSON.parse(text)).toEqual({ wallet, expiresAt: NOON + WEEK_MS });
    expect(response.headers.getSetCookie()).toEqual([`poncho_session=${SECRET_2}; Max-Age=604800; Path=/api; HttpOnly; SameSite=Lax`]);
    const rows = f.store.entries('session');
    expect(rows.map(([key]) => key)).toEqual([sha256hex(SECRET_2)]);
    expect(JSON.parse(rows[0]?.[1] ?? 'null')).toEqual({ wallet, expiresAt: NOON + WEEK_MS });
    expect(text).not.toContain(SECRET_2);
    expect(f.store.entries('nonce')).toEqual([]);
  });

  it('on an https site the cookie is Secure', async () => {
    const f = fixture({ origin: 'https://poncho.example', domain: 'poncho.example' });
    const response = await signedIn(f, { origin: 'https://poncho.example' });
    expect(response.status).toBe(200);
    const cookies = response.headers.getSetCookie();
    expect(cookies).toHaveLength(1);
    expect(cookies[0]).toMatch(/; SameSite=Lax; Secure$/);
  });

  it.each([
    ['a message that is a number', async () => '{"message":7,"signature":"0x00"}', 'not a sign-in message'],
    ['a signature that is not text', async () => '{"message":"x","signature":null}', 'not a sign-in message'],
    ['a nonce the server never gave', async (f: Fixture) => signedBody(f, 'ab'.repeat(16)), 'the nonce was not given out, or was used'],
    ['a message signed by another key', async (f: Fixture) => signedBody(f, await nonceOf(f), {}, stranger), 'the signature is not this wallet\'s'],
    ['a message that ran out', async (f: Fixture) => signedBody(f, await nonceOf(f), { expirationTime: new Date(NOON) }), 'the message has run out'],
  ] as const)('a sign-in refused: %s gets 403 with its reason, no cookie and no session', async (_name, bodyOf, reason) => {
    const f = fixture();
    const response = await f.app(postTo(SIGN_IN, await bodyOf(f)));
    expect(response.headers.getSetCookie()).toEqual([]);
    expect(await errorOf(response)).toEqual([403, reason]);
    expect(f.store.entries('session')).toEqual([]);
  });

  it('a sign-in sent twice opens one session', async () => {
    const f = fixture();
    const body = await signedBody(f, await nonceOf(f));
    expect((await f.app(postTo(SIGN_IN, body))).status).toBe(200);
    expect(await errorOf(await f.app(postTo(SIGN_IN, body)))).toEqual([403, 'the nonce was not given out, or was used']);
    expect(f.store.entries('session')).toHaveLength(1);
  });

  it.each([
    ['no field', '{}'],
    ['the message alone', '{"message":"x"}'],
    ['the signature alone', '{"signature":"0x"}'],
    ['a third field', '{"message":"x","signature":"0x","wallet":"0x"}'],
  ])('a body without exactly its fields is refused: %s', async (_name, body) => {
    const f = fixture();
    expect(await errorOf(await f.app(postTo(SIGN_IN, body)))).toEqual([400, 'the body has other fields']);
    expect(f.store.entries('session')).toEqual([]);
  });

  it('from another origin it is refused before the message is read', async () => {
    const f = fixture();
    const nonce = await nonceOf(f);
    const response = await f.app(postTo(SIGN_IN, await signedBody(f, nonce), { origin: ELSEWHERE }));
    expect(await errorOf(response)).toEqual([403, 'not from the game\'s site']);
    expect(f.store.entries('nonce').map(([key]) => key)).toEqual([nonce]);
    expect(f.store.entries('session')).toEqual([]);
  });

  it('a contract wallet signs in through the chain', async () => {
    const f = fixture();
    const address = `0x${'cd'.repeat(20)}` as const;
    const message = messageOf(f, await nonceOf(f), { address });
    f.chain.acceptSignature(address, message, '0x1234');
    const response = await f.app(postTo(SIGN_IN, JSON.stringify({ message, signature: '0x1234' })));
    expect(response.status).toBe(200);
    const answer: { wallet: string } = JSON.parse(await response.text());
    expect(answer.wallet).toBe(address);
  });

  it('the clock the route hands on is the server\'s', async () => {
    const f = fixture();
    f.clock.now = NOON + 5000;
    const response = await signedIn(f);
    expect(await response.json()).toEqual({ wallet, expiresAt: NOON + 5000 + WEEK_MS });
    expect(response.headers.getSetCookie()).toEqual([`poncho_session=${SECRET_2}; Max-Age=604800; Path=/api; HttpOnly; SameSite=Lax`]);
  });
});

describe('GDD-TEC-10 GET /api/v1/session', () => {
  it('a guest', async () => {
    const f = fixture();
    const response = await f.app(sessionWith());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ wallet: null });
    expect(response.headers.getSetCookie()).toEqual([]);
  });

  it('the session\'s wallet, restored with no prompt', async () => {
    const f = fixture();
    expect((await signedIn(f)).status).toBe(200);
    for (const cookie of [`poncho_session=${SECRET_2}`, `a=1; poncho_session=${SECRET_2}; b=2`]) {
      const response = await f.app(sessionWith(cookie));
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ wallet });
      expect(response.headers.getSetCookie()).toEqual([]);
    }
  });

  it('a session running out leaves a guest', async () => {
    const f = fixture();
    expect((await signedIn(f)).status).toBe(200);
    f.clock.now = NOON + WEEK_MS - 1;
    expect(await walletOf(f, `poncho_session=${SECRET_2}`)).toBe(wallet);
    f.clock.now = NOON + WEEK_MS;
    expect(await walletOf(f, `poncho_session=${SECRET_2}`)).toBeNull();
    expect(f.store.entries('session')).toEqual([]);
  });

  it.each([
    ['a secret of 43 other characters', `poncho_session=${'A'.repeat(43)}`],
    ['the secret twice', `poncho_session=${SECRET_2}; poncho_session=${SECRET_2}`],
    ['the secret with a character after it', `poncho_session=${SECRET_2}x`],
    ['the name in other letters', `Poncho_Session=${SECRET_2}`],
  ])('a cookie that is a guest with a session open: %s', async (_name, cookie) => {
    const f = fixture();
    expect((await signedIn(f)).status).toBe(200);
    expect(await walletOf(f, cookie)).toBeNull();
  });

  it('another origin may ask, a GET changes nothing, and no answer carries a cross-origin header', async () => {
    const f = fixture();
    expect((await signedIn(f)).status).toBe(200);
    const response = await f.app(sessionWith(`poncho_session=${SECRET_2}`, { origin: ELSEWHERE }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ wallet });
    expect(response.headers.get('access-control-allow-origin')).toBeNull();
    expect(response.headers.get('access-control-allow-credentials')).toBeNull();
  });

  it('several sessions of one wallet are all good', async () => {
    const f = fixture();
    const first = cookieOf(await signedIn(f));
    const second = cookieOf(await signedIn(f));
    expect(first).not.toBe(second);
    expect(await walletOf(f, first)).toBe(wallet);
    expect(await walletOf(f, second)).toBe(wallet);
  });
});

describe('GDD-TEC-10 POST /api/v1/sign-out', () => {
  it('signing out leaves a guest and takes the cookie away', async () => {
    const f = fixture();
    const cookie = cookieOf(await signedIn(f));
    const response = await f.app(postTo(SIGN_OUT, '{}', { cookie }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({});
    expect(response.headers.getSetCookie()).toEqual(['poncho_session=; Max-Age=0; Path=/api; HttpOnly; SameSite=Lax']);
    expect(f.store.entries('session')).toEqual([]);
    expect(await walletOf(f, cookie)).toBeNull();
  });

  it('with no session it answers the same', async () => {
    const f = fixture();
    const response = await f.app(postTo(SIGN_OUT, '{}'));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({});
    expect(response.headers.getSetCookie()).toEqual(['poncho_session=; Max-Age=0; Path=/api; HttpOnly; SameSite=Lax']);
  });

  it('it ends only its own session', async () => {
    const f = fixture();
    const first = cookieOf(await signedIn(f));
    const second = cookieOf(await signedIn(f));
    expect((await f.app(postTo(SIGN_OUT, '{}', { cookie: first }))).status).toBe(200);
    expect(await walletOf(f, first)).toBeNull();
    expect(await walletOf(f, second)).toBe(wallet);
  });

  it('from another origin it is refused and the session stays', async () => {
    const f = fixture();
    const cookie = cookieOf(await signedIn(f));
    const response = await f.app(postTo(SIGN_OUT, '{}', { cookie, origin: ELSEWHERE }));
    expect(response.headers.getSetCookie()).toEqual([]);
    expect(await errorOf(response)).toEqual([403, 'not from the game\'s site']);
    expect(await walletOf(f, cookie)).toBe(wallet);
  });

  it('on an https site the cleared cookie is Secure', async () => {
    const f = fixture({ origin: 'https://poncho.example', domain: 'poncho.example' });
    const cookies = (await f.app(postTo(SIGN_OUT, '{}', { origin: 'https://poncho.example' }))).headers.getSetCookie();
    expect(cookies).toHaveLength(1);
    expect(cookies[0]).toMatch(/; SameSite=Lax; Secure$/);
  });

  it('a body with a field is refused', async () => {
    const f = fixture();
    const cookie = cookieOf(await signedIn(f));
    expect(await errorOf(await f.app(postTo(SIGN_OUT, '{"all":true}', { cookie })))).toEqual([400, 'the body has other fields']);
    expect(await walletOf(f, cookie)).toBe(wallet);
  });
});

describe('GDD-TEC-10 the session routes in the table', () => {
  it.each([
    ['GET', SIGN_IN, 'POST'],
    ['GET', SIGN_OUT, 'POST'],
    ['POST', SESSION, 'GET'],
  ])('%s on %s is 405 and allows %s', async (method, path, allow) => {
    const f = fixture();
    const response = await f.app(method === 'GET' ? getFrom(path) : postTo(path, '{}'));
    expect(response.status).toBe(405);
    expect(response.headers.get('allow')).toBe(allow);
  });

  it('the nonce and the config set no cookie', async () => {
    const f = fixture();
    expect((await f.app(post('{}'))).headers.getSetCookie()).toEqual([]);
    expect((await f.app(getFrom('/api/v1/config'))).headers.getSetCookie()).toEqual([]);
  });

  it('each route leaves its line and nothing of the cookie', async () => {
    const f = fixture();
    const signing = await signedIn(f);
    const cookie = cookieOf(signing);
    const lines: (RequestLog | undefined)[] = [lineOf(signing), lineOf(await f.app(sessionWith(cookie))), lineOf(await f.app(postTo(SIGN_OUT, '{}', { cookie })))];
    expect(lines).toEqual([
      { method: 'POST', route: '/api/v1/sign-in', status: 200 },
      { method: 'GET', route: '/api/v1/session', status: 200 },
      { method: 'POST', route: '/api/v1/sign-out', status: 200 },
    ]);
  });
});
