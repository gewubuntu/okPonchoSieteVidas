import { generateKeyPairSync } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SIM_VERSION } from '../src/sim/version';
import { codeOf, DEFAULT_ORIGIN, DEFAULT_PORT, guardLogs, selfCheck, settingsOf, wire, type Env, type Fetch, type Settings } from './boot';
import { lineOf } from './http/boundary';

const KEY_TEXT = generateKeyPairSync('ed25519').privateKey.export({ format: 'der', type: 'pkcs8' }).toString('base64');
const NO_FILE = (path: string): string => {
  throw new Error(`no file ${path}`);
};
/** A file of overrides holding every value a real chain needs, with the chain on 'base'. */
const BASE_FILE = JSON.stringify({
  LEDGER: { packPrice: '1000' },
  SEASON: { firstStartUtc: '2026-01-01T00:00:00.000Z' },
  START_TOKEN: { startWithin: 600 },
  SESSION: { length: 604800 },
  CHAIN: { mode: 'base', confirmations: 3 },
});
const withFile = (text: string) => (path: string): string => {
  if (path !== '/etc/poncho.json') throw new Error(`no file ${path}`);
  return text;
};

function settled(env: Env, readFile: (path: string) => string = NO_FILE): Settings {
  const result = settingsOf(env, readFile);
  if ('problems' in result) throw new Error(result.problems.join(' / '));
  return result.settings;
}
const problemsOf = (env: Env, readFile: (path: string) => string = NO_FILE): readonly string[] => {
  const result = settingsOf(env, readFile);
  return 'problems' in result ? result.problems : [];
};

describe('GDD-TEC-10 boot: the settings', () => {
  it('with nothing set: the mock chain, a memory store, a made key, the Vite dev server\'s origin and port 8787', () => {
    const settings = settled({});
    expect(settings.config.CHAIN).toEqual({ mode: 'mock', confirmations: 3 });
    expect(settings.storePath).toBeNull();
    expect(settings.key.generated).toBe(true);
    expect(settings.site).toEqual({ origin: 'http://localhost:5173', domain: 'localhost:5173', uri: 'http://localhost:5173' });
    expect(settings.port).toBe(8787);
    expect(DEFAULT_PORT).toBe(8787);
    expect(DEFAULT_ORIGIN).toBe('http://localhost:5173');
  });

  it('says once that it made a key, and that nothing is kept; no note holds the key', () => {
    const { notes, key } = settled({});
    expect(notes).toEqual(['made a token key for this run', 'the store is in memory: nothing is kept after the server stops']);
    const text = JSON.stringify(notes);
    expect(text).not.toContain(key.publicText);
    expect(text).not.toContain(key.privateKey.export({ format: 'der', type: 'pkcs8' }).toString('base64'));
  });

  it('a key from PONCHO_TOKEN_KEY is not made, so it is not announced; a SQLite file is not a memory store', () => {
    const settings = settled({ PONCHO_TOKEN_KEY: KEY_TEXT, PONCHO_STORE: '/var/poncho.db' });
    expect(settings.key.generated).toBe(false);
    expect(settings.storePath).toBe('/var/poncho.db');
    expect(settings.notes).toEqual([]);
  });

  it('a file of overrides is read through readFile and laid over the starting values', () => {
    const settings = settled({ PONCHO_SERVER_CONFIG: '/etc/poncho.json' }, withFile('{"SESSION":{"length":100}}'));
    expect(settings.config.SESSION.length).toBe(100);
    expect(settings.config.LEDGER.freePerDay).toBe(3);
  });

  it('a file whose CHAIN.mode is base, with every value set and a key, is refused: the real chain source is not built', () => {
    const env = { PONCHO_SERVER_CONFIG: '/etc/poncho.json', PONCHO_TOKEN_KEY: KEY_TEXT };
    expect(problemsOf(env, withFile(BASE_FILE))).toEqual(['PONCHO_SERVER_CONFIG: the real chain source is not built (CHAIN.mode base)']);
    // The same file on the mock passes.
    expect(problemsOf(env, withFile(BASE_FILE.replace('"base"', '"mock"')))).toEqual([]);
  });

  it('base with no key is two problems: the chain, and the key (a real chain does not make one)', () => {
    expect(problemsOf({ PONCHO_SERVER_CONFIG: '/etc/poncho.json' }, withFile(BASE_FILE))).toEqual([
      'PONCHO_SERVER_CONFIG: the real chain source is not built (CHAIN.mode base)',
      'PONCHO_TOKEN_KEY is not set',
    ]);
  });

  it('a base file with another value missing names every problem at once: the values, the chain and the key', () => {
    const problems = problemsOf({ PONCHO_SERVER_CONFIG: '/etc/poncho.json' }, withFile('{"CHAIN":{"mode":"base"}}'));
    expect(problems).toContain('PONCHO_SERVER_CONFIG: LEDGER.packPrice is not set');
    expect(problems.slice(-2)).toEqual(['PONCHO_SERVER_CONFIG: the real chain source is not built (CHAIN.mode base)', 'PONCHO_TOKEN_KEY is not set']);
    // With a value that does not read, too; and a key given is not a problem.
    const given = problemsOf({ PONCHO_SERVER_CONFIG: '/etc/poncho.json', PONCHO_TOKEN_KEY: KEY_TEXT }, withFile(BASE_FILE.replace('"packPrice":"1000"', '"packPrice":"1000","freePerDay":-1')));
    expect(given).toEqual(['PONCHO_SERVER_CONFIG: LEDGER.freePerDay does not read', 'PONCHO_SERVER_CONFIG: the real chain source is not built (CHAIN.mode base)']);
  });

  it.each(['{"CHAIN":{"mode":"mock"},"LEDGER":{"freePerDay":-1}}', '{"CHAIN":"base","LEDGER":{"freePerDay":-1}}', '{"CHAIN":{"mode":"BASE"},"LEDGER":{"freePerDay":-1}}'])('%s with a value that does not read is no base file: no chain problem, and a key is made', (text) => {
    expect(problemsOf({ PONCHO_SERVER_CONFIG: '/etc/poncho.json' }, withFile(text))).toEqual(expect.not.arrayContaining([
      'PONCHO_SERVER_CONFIG: the real chain source is not built (CHAIN.mode base)',
      'PONCHO_TOKEN_KEY is not set',
    ]));
  });

  it('a file that is not JSON, or cannot be read, names the variable and never the content or the path', () => {
    const env = { PONCHO_SERVER_CONFIG: '/etc/poncho.json' };
    expect(problemsOf(env, withFile('secret-content{'))).toEqual(['PONCHO_SERVER_CONFIG cannot be read or is not JSON']);
    expect(problemsOf(env, () => { throw new Error('secret-path'); })).toEqual(['PONCHO_SERVER_CONFIG cannot be read or is not JSON']);
    expect(problemsOf({ PONCHO_SERVER_CONFIG: '/other.json' }, withFile('{}'))).toEqual(['PONCHO_SERVER_CONFIG cannot be read or is not JSON']);
  });

  it('a value that does not read is the config\'s own problem, named after the file\'s variable', () => {
    expect(problemsOf({ PONCHO_SERVER_CONFIG: '/etc/poncho.json' }, withFile('{"LEDGER":{"freePerDay":-1}}'))).toEqual(['PONCHO_SERVER_CONFIG: LEDGER.freePerDay does not read']);
  });

  it('a token key that does not read is a problem that names the variable, not the text', () => {
    expect(problemsOf({ PONCHO_TOKEN_KEY: 'secret-key-text' })).toEqual(['PONCHO_TOKEN_KEY does not read']);
  });

  it('a variable set to the empty string is unset', () => {
    const settings = settled({ PONCHO_SERVER_CONFIG: '', PONCHO_TOKEN_KEY: '', PONCHO_STORE: '', PONCHO_SITE_ORIGIN: '', PONCHO_SERVER_PORT: '' });
    expect(settings.key.generated).toBe(true);
    expect(settings.storePath).toBeNull();
    expect(settings.site.origin).toBe('http://localhost:5173');
    expect(settings.port).toBe(8787);
  });

  it.each([
    ['0', 0],
    ['1', 1],
    ['80', 80],
    ['8787', 8787],
    ['65535', 65535],
  ])('PONCHO_SERVER_PORT %s is read as %d', (text, port) => {
    expect(settled({ PONCHO_SERVER_PORT: text }).port).toBe(port);
  });

  it.each(['65536', '-1', '80a', ' 80', '80 ', '1e3', '8.5', '0x50', '99999999999999999999', 'http'])('PONCHO_SERVER_PORT %j is a problem', (text) => {
    expect(problemsOf({ PONCHO_SERVER_PORT: text })).toEqual(['PONCHO_SERVER_PORT is not a port from 0 to 65535']);
  });

  it.each([
    ['https://poncho.example', 'poncho.example'],
    ['http://localhost:8080', 'localhost:8080'],
    ['http://127.0.0.1:4173', '127.0.0.1:4173'],
  ])('PONCHO_SITE_ORIGIN %s is the origin, its host the sign-in domain', (origin, domain) => {
    expect(settled({ PONCHO_SITE_ORIGIN: origin }).site).toEqual({ origin, domain, uri: origin });
  });

  it.each(['http://localhost:5173/', 'localhost:5173', 'http://localhost:5173/path', 'HTTP://LOCALHOST:5173', 'http://localhost:5173?x', 'http://user@localhost:5173', 'nope', 'null'])('PONCHO_SITE_ORIGIN %j is a problem', (origin) => {
    expect(problemsOf({ PONCHO_SITE_ORIGIN: origin })).toEqual(['PONCHO_SITE_ORIGIN is not an origin (a scheme, a host and a port, with no path or trailing slash)']);
  });

  it('every problem is found, not only the first', () => {
    const problems = problemsOf({ PONCHO_SERVER_PORT: '70000', PONCHO_SITE_ORIGIN: 'x', PONCHO_TOKEN_KEY: 'k' });
    expect(problems.length).toBe(3);
  });
});

describe('GDD-TEC-10 boot: wiring', () => {
  it('the app answers the config with the key made for the run, the build\'s simulation version and the real clock, and the answer carries its line', async () => {
    const settings = settled({});
    const wired = await wire(settings);
    const before = Date.now();
    const response = await wired.app(new Request('http://api.invalid/api/v1/config'));
    const answer: { tokenKey: string; sim: string; now: number } = JSON.parse(await response.text());
    expect(answer.tokenKey).toBe(settings.key.publicText);
    expect(answer.sim).toBe(SIM_VERSION);
    expect(answer.now).toBeGreaterThanOrEqual(before);
    expect(answer.now).toBeLessThanOrEqual(Date.now());
    expect(lineOf(response)).toEqual({ method: 'GET', route: '/api/v1/config', status: 200 });
    wired.close();
  });

  it('a nonce is made from random bytes, two different ones, and kept in the memory store', async () => {
    const wired = await wire(settled({}));
    const ask = async (): Promise<string> => {
      const answer: { nonce: string } = JSON.parse(await (await wired.app(new Request('http://api.invalid/api/v1/sign-in/nonce', { method: 'POST', body: '{}', headers: { 'content-type': 'application/json' } }))).text());
      return answer.nonce;
    };
    const [a, b] = [await ask(), await ask()];
    expect(a).toMatch(/^[0-9a-f]{32}$/);
    expect(b).not.toBe(a);
    expect(wired.store.entries('nonce').map(([key]) => key).toSorted()).toEqual([a, b].toSorted());
    wired.close();
  });

  it('with PONCHO_STORE the rows are in a SQLite file, and are there when it is opened again', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'poncho-boot-'));
    try {
      const settings = settled({ PONCHO_STORE: join(dir, 'poncho.db') });
      const first = await wire(settings);
      await first.app(new Request('http://api.invalid/api/v1/sign-in/nonce', { method: 'POST', body: '{}', headers: { 'content-type': 'application/json' } }));
      first.close();
      const second = await wire(settings);
      expect(second.store.entries('nonce').length).toBe(1);
      second.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

interface Config { CHAIN: Record<string, unknown>; LEDGER: unknown; [name: string]: unknown }
const BASE = 'http://api.invalid';
const ORIGIN = 'http://localhost:5173';
async function app(): Promise<(request: Request) => Promise<Response>> {
  return (await wire(settled({}))).app;
}
const direct = (served: (request: Request) => Promise<Response>): Fetch => (url, init) => served(new Request(url, init));
const down: Fetch = () => Promise.reject(new Error('connection refused'));

/** The real app, but its config answer is changed: `change` edits the parsed body, `status` and `type` replace those of the answer. */
async function changed(change: (config: Config) => void, status = 200, type = 'application/json; charset=utf-8'): Promise<Fetch> {
  const served = await app();
  return async (url, init) => {
    const response = await served(new Request(url, init));
    if (!url.endsWith('/api/v1/config')) return response;
    const body: Config = JSON.parse(await response.text());
    change(body);
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': type } });
  };
}
/** The real app, but the nonce request is edited before the app sees it: `edit` is given the origin it carries and gives the one to send, or null for none. */
async function asked(edit: (origin: string) => string | null): Promise<Fetch> {
  const served = await app();
  return (url, init) => {
    const request = new Request(url, init);
    if (!url.endsWith('/nonce')) return served(request);
    const headers = new Headers(request.headers);
    const origin = edit(headers.get('origin') ?? '');
    if (origin === null) headers.delete('origin');
    else headers.set('origin', origin);
    return served(new Request(url, { method: 'POST', headers, body: '{}' }));
  };
}
/** The real app, but the nonce answer is replaced. */
async function answering(status: number, body: unknown): Promise<Fetch> {
  const served = await app();
  return async (url, init) => (url.endsWith('/nonce') ? new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }) : served(new Request(url, init)));
}
/** The real app, but the session answer is replaced by `text` with `status`. */
async function sessionAnswering(status: number, text: string): Promise<Fetch> {
  const served = await app();
  return async (url, init) => (url.endsWith('/api/v1/session') ? new Response(text, { status, headers: { 'content-type': 'application/json' } }) : served(new Request(url, init)));
}


describe('GDD-TEC-10 boot: the self check', () => {
  it('an app that is well has no problem', async () => {
    expect(await selfCheck(direct(await app()), BASE, ORIGIN)).toEqual([]);
  });

  it('it asks with the origin it was given', async () => {
    const seen: string[] = [];
    const served = await app();
    const fetchFn: Fetch = (url, init) => {
      const request = new Request(url, init);
      if (url.endsWith('/nonce')) seen.push(request.headers.get('origin') ?? '');
      return served(request);
    };
    await selfCheck(fetchFn, BASE, 'https://poncho.example'); // not the app's own origin, which refuses it: only what was asked with matters here
    expect(seen).toEqual(['https://poncho.example', 'http://elsewhere.invalid']);
  });

  it('a config that does not answer 200 is named', async () => {
    expect(await selfCheck(await changed(() => undefined, 500), BASE, ORIGIN)).toEqual(['the config does not answer 200']);
  });

  it('a config with no JSON content type is named', async () => {
    expect(await selfCheck(await changed(() => undefined, 200, 'text/plain'), BASE, ORIGIN)).toEqual(['the config has no JSON content type']);
  });

  it('a config on another chain, another chain ID or with no daily free lives is named, each by itself', async () => {
    expect(await selfCheck(await changed((c) => { c.CHAIN['mode'] = 'base'; }), BASE, ORIGIN)).toEqual(['the config is not the mock chain']);
    expect(await selfCheck(await changed((c) => { c.CHAIN['id'] = 84532; }), BASE, ORIGIN)).toEqual(['the config is not Base']);
    expect(await selfCheck(await changed((c) => { c.LEDGER = { freePerDay: '3' }; }), BASE, ORIGIN)).toEqual(['the config has no LEDGER.freePerDay']);
    expect(await selfCheck(await changed((c) => { c.LEDGER = 7; }), BASE, ORIGIN)).toEqual(['the config has no LEDGER.freePerDay']);
  });

  it('a token key that is not an Ed25519 public key in SPKI DER is named, whatever it is instead', async () => {
    const other = generateKeyPairSync('x25519').publicKey.export({ format: 'der', type: 'spki' }).toString('base64');
    for (const tokenKey of ['AAAA', '', other, 7, null]) {
      expect(await selfCheck(await changed((c) => { c['tokenKey'] = tokenKey; }), BASE, ORIGIN)).toEqual(['the config\'s tokenKey is not an Ed25519 public key']);
    }
    expect(await selfCheck(await changed((c) => { delete c['tokenKey']; }), BASE, ORIGIN)).toEqual(['the config\'s tokenKey is not an Ed25519 public key']);
  });

  it('a token key is taken only as the key writes it: not in a list, nor with stray characters, base64url or bytes after the key', async () => {
    const edits: readonly ((text: string) => unknown)[] = [
      (text) => [text],
      (text) => text.split(''),
      (text) => text.split('').join('!'),
      (text) => text.split('').join(' '),
      (text) => `${text} `,
      (text) => Buffer.from(text, 'base64').toString('base64url'),
      (text) => Buffer.concat([Buffer.from(text, 'base64'), Buffer.from([0x41])]).toString('base64'),
    ];
    for (const edit of edits) {
      expect(await selfCheck(await changed((c) => { c['tokenKey'] = edit(String(c['tokenKey'])); }), BASE, ORIGIN)).toEqual(['the config\'s tokenKey is not an Ed25519 public key']);
    }
  });

  it('a simulation version that is not 16 lowercase hex digits is named: unbuilt, one digit short, one too many, capitals', async () => {
    const good = '0123456789abcdef';
    expect(await selfCheck(await changed((c) => { c['sim'] = good; }), BASE, ORIGIN)).toEqual([]);
    for (const sim of ['unbuilt', good.slice(1), `${good}0`, good.toUpperCase(), `x${good.slice(1)}`, `${good.slice(1)}x`, '', 16, 1234567890123456, [good], null]) {
      expect(await selfCheck(await changed((c) => { c['sim'] = sim; }), BASE, ORIGIN)).toEqual(['the config\'s sim is not a built version']);
    }
  });

  it('a nonce route that does not give the game\'s origin a nonce is named', async () => {
    expect(await selfCheck(await asked((origin) => (origin === ORIGIN ? 'http://elsewhere.invalid' : origin)), BASE, ORIGIN)).toEqual(['the nonce route does not give a nonce to the game\'s origin']);
  });

  it('a nonce that is not 32 lowercase hex digits is named: 31, 33, capitals, none, and a status other than 200', async () => {
    const good = '0123456789abcdef0123456789abcdef';
    expect(await selfCheck(await answering(200, { nonce: good }), BASE, ORIGIN)).toEqual(['the nonce route does not refuse another origin']);
    for (const nonce of [good.slice(1), `${good}0`, good.toUpperCase(), `x${good.slice(1)}`, `${good.slice(1)}x`, '', 32, [good], null]) {
      expect(await selfCheck(await answering(200, { nonce }), BASE, ORIGIN)).toContain('the nonce route does not give a nonce to the game\'s origin');
    }
    expect(await selfCheck(await answering(200, {}), BASE, ORIGIN)).toContain('the nonce route does not give a nonce to the game\'s origin');
    expect(await selfCheck(await answering(201, { nonce: good }), BASE, ORIGIN)).toContain('the nonce route does not give a nonce to the game\'s origin');
  });

  it('a nonce route that gives another origin a nonce too is named', async () => {
    expect(await selfCheck(await asked(() => ORIGIN), BASE, ORIGIN)).toEqual(['the nonce route does not refuse another origin']);
    expect(await selfCheck(await asked(() => null), BASE, ORIGIN)).toEqual(['the nonce route does not refuse another origin']);
  });

  it('a nonce route that answers another origin with anything but 403 is named', async () => {
    const served = await app();
    for (const status of [200, 400, 401, 500]) {
      const fetchFn: Fetch = async (url, init) => {
        const request = new Request(url, init);
        return url.endsWith('/nonce') && request.headers.get('origin') !== ORIGIN ? new Response('{}', { status }) : served(request);
      };
      expect(await selfCheck(fetchFn, BASE, ORIGIN)).toEqual(['the nonce route does not refuse another origin']);
    }
  });

  it('a server that cannot be reached is every problem, and nothing is thrown', async () => {
    expect(await selfCheck(down, BASE, ORIGIN)).toEqual([
      'the config cannot be read',
      'the config is not the mock chain',
      'the config is not Base',
      'the config has no LEDGER.freePerDay',
      'the config\'s tokenKey is not an Ed25519 public key',
      'the config\'s sim is not a built version',
      'the nonce route cannot be asked',
      'the nonce route cannot be asked from another origin',
      'the session route cannot be asked',
    ]);
  });

  it('a session route that does not answer a guest 200 with no wallet is named', async () => {
    expect(await selfCheck(await sessionAnswering(200, JSON.stringify({ wallet: `0x${'11'.repeat(20)}` })), BASE, ORIGIN)).toEqual(['the session route does not answer a guest']);
    expect(await selfCheck(await sessionAnswering(500, JSON.stringify({ wallet: null })), BASE, ORIGIN)).toEqual(['the session route does not answer a guest']);
  });

  it('a session answer that is not JSON is named as unaskable', async () => {
    expect(await selfCheck(await sessionAnswering(200, '<html>'), BASE, ORIGIN)).toEqual(['the session route cannot be asked']);
  });

  it('a config answer that is not JSON is named as unreadable', async () => {
    const served = await app();
    const fetchFn: Fetch = async (url, init) => (url.endsWith('/config') ? new Response('<html>', { status: 200, headers: { 'content-type': 'application/json' } }) : served(new Request(url, init)));
    expect(await selfCheck(fetchFn, BASE, ORIGIN)).toContain('the config cannot be read');
  });
});

describe('GDD-TEC-10 boot: a log that cannot be written', () => {
  it('an error\'s code is all a line names of it', () => {
    expect(codeOf(Object.assign(new Error('/secret/path'), { code: 'EPIPE' }))).toBe('EPIPE');
    expect([new Error('/secret/path'), { code: 7 }, 'EPIPE', null, undefined].map(codeOf)).toEqual(['unknown', 'unknown', 'unknown', 'unknown', 'unknown']);
  });

  it('a stdout that fails ends the server with one line of its code; a stderr that fails says nothing and ends nothing', () => {
    const out = new EventEmitter();
    const err = new EventEmitter();
    const said: string[] = [];
    const exits: number[] = [];
    guardLogs(out, err, (text) => { said.push(text); }, (code) => { exits.push(code); });
    err.emit('error', Object.assign(new Error('/secret/path'), { code: 'EPIPE' }));
    expect({ said, exits }).toEqual({ said: [], exits: [] });
    out.emit('error', Object.assign(new Error('/secret/path'), { code: 'ENOSPC' }));
    expect({ said, exits }).toEqual({ said: ['the log cannot be written (ENOSPC)'], exits: [1] });
  });
});
