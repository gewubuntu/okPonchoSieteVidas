import { generateKeyPairSync } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { SIM_VERSION } from '../../src/sim/version';
import { mockChain } from '../chain/mock';
import { resolveConfig } from '../config';
import { memoryStore } from '../store/memory';
import type { Store } from '../store/store';
import { loadTokenKey } from '../tokens/key';
import { createApp, type AppDeps, type RequestLog } from './app';

const NOON = Date.parse('2026-11-21T12:00:00.000Z');
const KEY_TEXT = generateKeyPairSync('ed25519').privateKey.export({ format: 'der', type: 'pkcs8' }).toString('base64');
const site = { origin: 'http://localhost:5173', domain: 'localhost:5173', uri: 'http://localhost:5173' };

interface Fixture { readonly deps: AppDeps; readonly app: (request: Request) => Promise<Response>; readonly log: RequestLog[]; readonly store: Store; readonly reads: { clock: number } }
function fixture(over: Partial<AppDeps> = {}): Fixture {
  const store = memoryStore();
  const log: RequestLog[] = [];
  const reads = { clock: 0 };
  const { config } = resolveConfig({});
  if (config === null) throw new Error('the starting config does not read');
  const deps: AppDeps = {
    store,
    chain: mockChain(),
    config,
    key: loadTokenKey(KEY_TEXT, 'mock'),
    site,
    clock: { now: () => { reads.clock += 1; return NOON; } },
    random: (bytes) => Buffer.alloc(bytes, 1),
    sim: SIM_VERSION,
    log: (line) => { log.push(line); },
    ...over,
  };
  return { deps, app: createApp(deps), log, store, reads };
}
const GET = (path: string, init: RequestInit = {}): Request => new Request(`http://api.invalid${path}`, init);
const POST = (path: string, body = '{}', headers: Record<string, string> = { 'content-type': 'application/json' }): Request => new Request(`http://api.invalid${path}`, { method: 'POST', body, headers });
const NONCE = '/api/v1/sign-in/nonce';

describe('GDD-TEC-10 route table', () => {
  it('an unknown path gets 404 { error: "no such route" }', async () => {
    const { app } = fixture();
    const response = await app(GET('/api/v1/nope'));
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'no such route' });
  });

  it.each(['/api/v1/config/', '/api/v1/configs', '/api/v2/config', '/api/v1/CONFIG', '/config', '/', '/api/v1', '/api/v1/sign-in/nonce/'])('%s gets 404', async (path) => {
    const { app } = fixture();
    expect((await app(GET(path))).status).toBe(404);
  });

  it.each(['DELETE', 'HEAD', 'OPTIONS', 'PUT', 'POST', 'PATCH'])('%s on the config gets 405 with Allow: GET', async (method) => {
    const { app } = fixture();
    const response = await app(GET('/api/v1/config', { method }));
    expect(response.status).toBe(405);
    expect(response.headers.get('allow')).toBe('GET');
    if (method !== 'HEAD') expect(await response.json()).toEqual({ error: 'no such method' });
  });

  it.each(['GET', 'HEAD', 'OPTIONS', 'DELETE'])('%s on the nonce route gets 405 with Allow: POST', async (method) => {
    const { app, store } = fixture();
    const response = await app(GET(NONCE, { method }));
    expect(response.status).toBe(405);
    expect(response.headers.get('allow')).toBe('POST');
    expect(store.entries('nonce')).toEqual([]);
  });

  it('a method of the client\'s own is a 405 too, and an unknown path wins over any method', async () => {
    const { app } = fixture();
    expect((await app(GET('/api/v1/config', { method: 'FOO' }))).status).toBe(405);
    expect((await app(GET('/api/v1/nope', { method: 'DELETE' }))).status).toBe(404);
  });

  it('a query on a route that takes none gets 400 "no query here", on a GET and on a POST', async () => {
    const { app, store } = fixture();
    const get = await app(GET('/api/v1/config?x=1'));
    expect(get.status).toBe(400);
    expect(await get.json()).toEqual({ error: 'no query here' });
    const post = await app(POST(`${NONCE}?x=1`));
    expect(post.status).toBe(400);
    expect(await post.json()).toEqual({ error: 'no query here' });
    expect(store.entries('nonce')).toEqual([]);
  });

  it('the route is matched before the query: a wrong method with a query is a 405, an unknown path with one a 404', async () => {
    const { app } = fixture();
    expect((await app(GET('/api/v1/config?x=1', { method: 'DELETE' }))).status).toBe(405);
    expect((await app(GET('/api/v1/nope?x=1'))).status).toBe(404);
  });

  it('every answer has the two fixed headers and none a CORS header, the refusals and the 500 included', async () => {
    const { app } = fixture();
    const broken = fixture({ clock: { now: () => Number.NaN } }).app;
    const answers = await Promise.all([
      app(GET('/api/v1/config')),
      app(GET('/api/v1/config', { headers: { origin: 'http://elsewhere.invalid', 'access-control-request-method': 'POST' } })),
      app(GET('/api/v1/nope')),
      app(GET('/api/v1/config', { method: 'OPTIONS', headers: { origin: 'http://elsewhere.invalid', 'access-control-request-method': 'POST' } })),
      app(GET('/api/v1/config?x=1')),
      app(POST(NONCE, '{}', { origin: 'http://elsewhere.invalid', 'content-type': 'application/json' })),
      app(POST(NONCE, '{}', { 'content-type': 'text/plain' })),
      app(POST(NONCE, '{"a":1}')),
      app(POST(NONCE, 'x'.repeat(65537))),
      app(POST(NONCE, '{}', { 'content-type': 'application/json', origin: site.origin })),
      broken(GET('/api/v1/config')),
    ]);
    expect(answers.map((r) => r.status)).toEqual([200, 200, 404, 405, 400, 403, 415, 400, 413, 200, 500]);
    for (const response of answers) {
      expect(response.headers.get('content-type')).toBe('application/json; charset=utf-8');
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect([...response.headers.keys()].filter((name) => name.startsWith('access-control-'))).toEqual([]);
    }
  });
});

describe('GDD-TEC-10 pipeline order', () => {
  it('on a POST: the Origin rule, then the content type, then the body, then the fields', async () => {
    const { app } = fixture();
    const elsewhere = { origin: 'http://elsewhere.invalid' };
    const reason = async (request: Request): Promise<[number, unknown]> => {
      const response = await app(request);
      const answer: { error: string } = JSON.parse(await response.text());
      return [response.status, answer.error];
    };
    expect(await reason(POST(NONCE, 'garbage', { ...elsewhere, 'content-type': 'text/plain' }))).toEqual([403, 'not from the game\'s site']);
    expect(await reason(POST(NONCE, 'garbage', { 'content-type': 'text/plain' }))).toEqual([415, 'not a JSON request']);
    expect(await reason(POST(NONCE, 'garbage'))).toEqual([400, 'the body is not JSON']);
    expect(await reason(POST(NONCE, '{"a":1}'))).toEqual([400, 'the body has other fields']);
  });

  it('two Content-Type headers are never JSON, even when the first has a parameter: 415, and no nonce is written', async () => {
    const { app, store } = fixture();
    for (const [first, second] of [['application/json; a=b', 'text/plain'], ['application/json;', 'application/x-www-form-urlencoded'], ['application/json', 'application/json']] as const) {
      const headers = new Headers();
      headers.append('content-type', first);
      headers.append('content-type', second);
      const response = await app(new Request(`http://api.invalid${NONCE}`, { method: 'POST', body: '{}', headers }));
      expect(response.status).toBe(415);
    }
    expect(store.entries('nonce')).toEqual([]);
  });

  it('the clock is read once after the body: not at all for a request refused before it, once for one that gets through', async () => {
    const refused = fixture();
    await refused.app(POST(NONCE, 'garbage'));
    await refused.app(POST(NONCE, '{}', { 'content-type': 'text/plain' }));
    await refused.app(GET('/api/v1/nope'));
    expect(refused.reads.clock).toBe(0);
    const given = fixture();
    await given.app(POST(NONCE));
    expect(given.reads.clock).toBe(1);
    await given.app(GET('/api/v1/config'));
    expect(given.reads.clock).toBe(2);
  });
});

describe('GDD-TEC-10 config over HTTP', () => {
  it('GET /api/v1/config answers the public config, the token key\'s public text, the simulation version and the server\'s time', async () => {
    const { app, deps } = fixture();
    const response = await app(GET('/api/v1/config'));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      LEDGER: { freePerDay: 3, palFreePerDay: 7, resetUtc: '00:00', packSize: 7, packPrice: null },
      SEASON: { months: 3, firstStartUtc: '2026-01-01T00:00:00.000Z' },
      START_TOKEN: { startWithin: 600 },
      SESSION: { length: 604800 },
      CHAIN: { mode: 'mock', id: 8453, confirmations: 3 },
      tokenKey: deps.key.publicText,
      sim: SIM_VERSION,
      now: NOON,
    });
  });

  it('a foreign Origin is never refused on a GET', async () => {
    const { app } = fixture();
    expect((await app(GET('/api/v1/config', { headers: { origin: 'http://elsewhere.invalid' } }))).status).toBe(200);
  });

  it('the body holds neither the private key nor the text the key was loaded from, nor any PONCHO_ name', async () => {
    const { app, deps } = fixture();
    const text = await (await app(GET('/api/v1/config'))).text();
    expect(deps.key.generated).toBe(false);
    expect(text).not.toContain(KEY_TEXT);
    expect(text).not.toContain(deps.key.privateKey.export({ format: 'der', type: 'pkcs8' }).toString('base64'));
    expect(text).not.toContain('PONCHO_');
    expect(text).toContain(deps.key.publicText);
  });
});

describe('GDD-TEC-10 faults', () => {
  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])('a clock that gives %s gets 500 "server error" on every route, and nothing is written', async (time) => {
    const { app, store } = fixture({ clock: { now: () => time } });
    for (const request of [GET('/api/v1/config'), POST(NONCE)]) {
      const response = await app(request);
      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({ error: 'server error' });
    }
    expect(store.entries('nonce')).toEqual([]);
  });

  it('a clock that throws gets 500 too', async () => {
    const { app } = fixture({ clock: { now: () => { throw new Error('the clock broke'); } } });
    const response = await app(GET('/api/v1/config'));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'server error' });
  });

  it('a handler that throws gets 500 "server error", and neither the answer nor the log says why', async () => {
    const { store, deps, log } = fixture();
    const broken: Store = { ...store, put: () => { throw new Error('secret-store-text'); } };
    const app = createApp({ ...deps, store: broken });
    const response = await app(POST(NONCE));
    expect(response.status).toBe(500);
    expect(await response.text()).toBe('{"error":"server error"}');
    expect(JSON.stringify(log)).not.toContain('secret-store-text');
    expect(log).toEqual([{ method: 'POST', route: NONCE, status: 500 }]);
  });
});

describe('GDD-TEC-10 the request log', () => {
  it('one line per request with the method, the route and the status, and nothing else', async () => {
    const { app, log } = fixture();
    await app(GET('/api/v1/config'));
    expect(log).toEqual([{ method: 'GET', route: '/api/v1/config', status: 200 }]);
    expect(Object.keys(log[0] ?? {})).toEqual(['method', 'route', 'status']);
  });

  it('a query, a body, a cookie and an Origin never reach it', async () => {
    const { app, log } = fixture();
    await app(GET('/api/v1/config?secret=abc'));
    await app(POST(NONCE, '{"secret":"abc"}', { 'content-type': 'application/json', cookie: 'poncho_session=secret-cookie', origin: 'http://secret-origin.invalid' }));
    expect(log).toEqual([
      { method: 'GET', route: '/api/v1/config', status: 400 },
      { method: 'POST', route: NONCE, status: 403 },
    ]);
    expect(JSON.stringify(log)).not.toMatch(/secret/);
  });

  it('a path no route has is "(none)", whatever the client wrote; a method on a route that has none is the route\'s own path', async () => {
    const { app, log } = fixture();
    await app(GET('/api/v1/secret-path'));
    await app(GET('/api/v1/config', { method: 'DELETE' }));
    expect(log).toEqual([
      { method: 'GET', route: '(none)', status: 404 },
      { method: 'DELETE', route: '/api/v1/config', status: 405 },
    ]);
  });

  it('a method outside the usual ones is logged as "(other)", never as the client wrote it', async () => {
    const { app, log } = fixture();
    await app(GET('/api/v1/config', { method: 'SECRETVERB' }));
    expect(log).toEqual([{ method: '(other)', route: '/api/v1/config', status: 405 }]);
  });

  it('a log that throws changes no answer: the config is still 200 with the fixed headers, an unknown path still 404', async () => {
    const { app } = fixture({ log: () => { throw new Error('zz-log'); } });
    const config = await app(GET('/api/v1/config'));
    expect(config.status).toBe(200);
    expect(config.headers.get('content-type')).toBe('application/json; charset=utf-8');
    expect(config.headers.get('cache-control')).toBe('no-store');
    const none = await app(GET('/nope'));
    expect(none.status).toBe(404);
    expect(await none.text()).not.toContain('zz-log');
  });

  it.each(['GET', 'HEAD', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'])('%s is logged as itself', async (method) => {
    const { app, log } = fixture();
    await app(GET('/api/v1/nope', { method }));
    expect(log[0]?.method).toBe(method);
  });
});
