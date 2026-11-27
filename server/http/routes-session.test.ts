import { describe, expect, it } from 'vitest';
import { mockChain } from '../chain/mock';
import { resolveConfig } from '../config';
import { memoryStore } from '../store/memory';
import type { Store } from '../store/store';
import { loadTokenKey } from '../tokens/key';
import { createApp, type AppDeps } from './app';

const NOON = Date.parse('2026-11-21T12:00:00.000Z');
const SITE = 'http://localhost:5173';
const NONCE = 'http://api.invalid/api/v1/sign-in/nonce';
const JSON_TYPE = { 'content-type': 'application/json' };

/** Each call gives `n` bytes all equal to the call's number: the first nonce is 16 x 0x01, the second 16 x 0x02. */
const counter = (): AppDeps['random'] => {
  let calls = 0;
  return (bytes) => Buffer.alloc(bytes, ++calls);
};

function fixture(): { readonly app: (request: Request) => Promise<Response>; readonly store: Store } {
  const store = memoryStore();
  const { config } = resolveConfig({});
  if (config === null) throw new Error('the starting config does not read');
  const deps: AppDeps = {
    store,
    chain: mockChain(),
    config,
    key: loadTokenKey(undefined, 'mock'),
    site: { origin: SITE, domain: 'localhost:5173', uri: SITE },
    clock: { now: () => NOON },
    random: counter(),
    sim: 'test',
  };
  return { app: createApp(deps), store };
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
