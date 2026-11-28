// GDD-TEC-10, docs/decisions/0004-game-server.md ("How it runs", "Config", "Keys and secrets"): what the server starts with, read from its environment.
// With nothing configured it starts on the mock chain with a memory store. A real chain does not start: its source is not built.
import { randomBytes, createPublicKey } from 'node:crypto';
import { SIM_VERSION } from '../src/sim/version';
import { createApp, type Site } from './http/app';
import { codeOf, isJsonType, isRecord } from './http/boundary';

export { codeOf };
import { mockChain } from './chain/mock';
import { resolveConfig, type ServerConfig } from './config';
import { memoryStore } from './store/memory';
import type { Store } from './store/store';
import { loadTokenKey, type TokenKey } from './tokens/key';

/** Placeholders (ADR 0004, "Not decided here": where the server runs and where the game is served are not decided): the port, and the game's origin, the Vite dev server's. */
export const DEFAULT_PORT = 8787;
export const DEFAULT_ORIGIN = 'http://localhost:5173';

export type Env = Readonly<Record<string, string | undefined>>;
export interface Settings {
  readonly config: ServerConfig;
  readonly key: TokenKey;
  /** The SQLite file (`PONCHO_STORE`); null: the memory store. */
  readonly storePath: string | null;
  readonly site: Site;
  readonly port: number;
  /** What the boot says once, in order; none holds a secret. */
  readonly notes: readonly string[];
}
export type Settled = { readonly settings: Settings } | { readonly problems: readonly string[] };

// A variable set to the empty string is unset (the shell's `PONCHO_X= node ...`, a CI variable with no value).
const given = (env: Env, name: string): string | undefined => (env[name] === '' ? undefined : env[name]);
const at = (value: unknown, ...path: readonly string[]): unknown => path.reduce((here, name) => (isRecord(here) ? here[name] : undefined), value);


interface Stream { on(event: 'error', listener: (error: unknown) => void): unknown }
/**
 * A log that cannot be written (its reader went away: EPIPE; a full disk: ENOSPC) ends the server with one line that names only the
 * code, as a start that fails does; node would print the error's whole text. A failing stderr is not written to again.
 */
export function guardLogs(out: Stream, err: Stream, complain: (text: string) => void, exit: (code: number) => void): void {
  err.on('error', () => {
    // Nothing is left to say it on.
  });
  out.on('error', (error) => {
    complain(`the log cannot be written (${codeOf(error)})`);
    exit(1);
  });
}

/** A port: a whole number from 0 (any free one) to 65535, in decimal digits only. */
const isPort = (text: string): boolean => /^\d+$/.test(text) && Number(text) <= 65535;

/** Whether `text` is exactly an origin as the URL parser writes it: no path, no trailing slash. */
function isOrigin(text: string): boolean {
  try {
    return new URL(text).origin === text;
  } catch {
    return false;
  }
}

/**
 * The server's settings from its environment, or every problem found. Pure: the file of overrides is read through `readFile`.
 * A problem names the variable and never its content, so a secret that was set wrong is not printed.
 */
export function settingsOf(env: Env, readFile: (path: string) => string): Settled {
  const problems: string[] = [];
  const notes: string[] = [];

  let overrides: unknown = {};
  const configPath = given(env, 'PONCHO_SERVER_CONFIG');
  if (configPath !== undefined) {
    try {
      overrides = JSON.parse(readFile(configPath));
    } catch {
      problems.push('PONCHO_SERVER_CONFIG cannot be read or is not JSON');
    }
  }
  const resolved = resolveConfig(overrides);
  for (const problem of resolved.problems) problems.push(`PONCHO_SERVER_CONFIG: ${problem}`);
  // The chain the file asks for, even when another of its values is wrong, so every problem of a base config is named in one run.
  const mode = resolved.config?.CHAIN.mode ?? (at(overrides, 'CHAIN', 'mode') === 'base' ? 'base' : 'mock');
  // The real chain source is not built (phase D reads the mock only), so nothing reads PONCHO_RPC_URL either.
  if (mode === 'base') problems.push('PONCHO_SERVER_CONFIG: the real chain source is not built (CHAIN.mode base)');

  let key: TokenKey | null = null;
  try {
    key = loadTokenKey(given(env, 'PONCHO_TOKEN_KEY'), mode);
    if (key.generated) notes.push('made a token key for this run');
  } catch (error) {
    // The error's text names the variable and holds none of its content (server/tokens/key.ts).
    problems.push(error instanceof Error ? error.message : 'PONCHO_TOKEN_KEY does not read');
  }

  const storePath = given(env, 'PONCHO_STORE') ?? null;
  if (storePath === null) notes.push('the store is in memory: nothing is kept after the server stops');

  const originText = given(env, 'PONCHO_SITE_ORIGIN') ?? DEFAULT_ORIGIN;
  if (!isOrigin(originText)) problems.push('PONCHO_SITE_ORIGIN is not an origin (a scheme, a host and a port, with no path or trailing slash)');

  const portText = given(env, 'PONCHO_SERVER_PORT');
  if (portText !== undefined && !isPort(portText)) problems.push('PONCHO_SERVER_PORT is not a port from 0 to 65535');

  // The config and the key are null only when a problem was named; their checks are for the type checker.
  if (problems.length > 0 || resolved.config === null || key === null) return { problems };
  return {
    settings: {
      config: resolved.config,
      key,
      storePath,
      site: { origin: originText, domain: new URL(originText).host, uri: originText },
      port: portText === undefined ? DEFAULT_PORT : Number(portText),
      notes,
    },
  };
}

export interface Wired {
  readonly app: (request: Request) => Promise<Response>;
  readonly store: Store;
  /** Closes the store, SQLite's file included. */
  close(): void;
}

/**
 * The app on its store, the mock chain, the real clock and `randomBytes`, with no socket; its answers carry their lines, which `serve`
 * logs once each is written. SQLite is imported only when a file is asked for, so Node's warning about it shows only then.
 */
export async function wire(settings: Settings): Promise<Wired> {
  let store: Store & { close?(): void };
  if (settings.storePath === null) store = memoryStore();
  else store = (await import('./store/sqlite')).sqliteStore(settings.storePath);
  const app = createApp({
    store,
    chain: mockChain(),
    config: settings.config,
    key: settings.key,
    site: settings.site,
    clock: { now: () => Date.now() },
    random: randomBytes,
    sim: SIM_VERSION,
  });
  return { app, store, close: () => { store.close?.(); } };
}

export type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

const NONCE = /^[0-9a-f]{32}$/;
const SIM = /^[0-9a-f]{16}$/;

/**
 * Whether a public key's text is exactly an Ed25519 key in SPKI DER, in base64, as `TokenKey.publicText` writes it (L-101): the decoder
 * skips stray characters and the DER reader trailing bytes, so only the text the key writes back is taken.
 */
function isEd25519(text: unknown): boolean {
  try {
    const key = createPublicKey({ key: Buffer.from(String(text), 'base64'), format: 'der', type: 'spki' });
    // Compared with `text` itself, so a value that is no text (a list holding the text) is never the key's own text (L-025: no check of its own).
    return key.asymmetricKeyType === 'ed25519' && key.export({ format: 'der', type: 'spki' }).toString('base64') === text;
  } catch {
    return false;
  }
}

/**
 * The probes of `--check`, through `fetchFn` (the real socket in main.ts, the app itself in a test): the problems found, none when it is well.
 * They read the server's own config, ask for a nonce with the game's origin and with another's, and ask for the session with no cookie,
 * which must be a guest's, so the adapter's method, header, body and Origin handling run end to end, and a build whose simulation version
 * never arrived is told apart.
 */
export async function selfCheck(fetchFn: Fetch, baseUrl: string, siteOrigin: string): Promise<readonly string[]> {
  const problems: string[] = [];
  const check = (what: string, ok: boolean): void => {
    if (!ok) problems.push(what);
  };
  const askNonce = async (origin: string): Promise<{ status: number; body: unknown }> => {
    const response = await fetchFn(`${baseUrl}/api/v1/sign-in/nonce`, { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: '{}' });
    return { status: response.status, body: await response.json().catch(() => null) };
  };

  let config: unknown = null;
  try {
    const response = await fetchFn(`${baseUrl}/api/v1/config`);
    check('the config does not answer 200', response.status === 200);
    check('the config has no JSON content type', isJsonType(response.headers.get('content-type')));
    config = await response.json();
  } catch {
    check('the config cannot be read', false);
  }
  check('the config is not the mock chain', at(config, 'CHAIN', 'mode') === 'mock');
  check('the config is not Base', at(config, 'CHAIN', 'id') === 8453);
  check('the config has no LEDGER.freePerDay', typeof at(config, 'LEDGER', 'freePerDay') === 'number');
  check('the config\'s tokenKey is not an Ed25519 public key', isEd25519(at(config, 'tokenKey')));
  // 'unbuilt', the version of a source with no define, does not match either, so the define having reached the bundle is proved.
  const sim = at(config, 'sim');
  check('the config\'s sim is not a built version', typeof sim === 'string' && SIM.test(sim));

  try {
    const own = await askNonce(siteOrigin);
    const nonce = at(own.body, 'nonce');
    check('the nonce route does not give a nonce to the game\'s origin', own.status === 200 && typeof nonce === 'string' && NONCE.test(nonce));
  } catch {
    check('the nonce route cannot be asked', false);
  }
  try {
    check('the nonce route does not refuse another origin', (await askNonce('http://elsewhere.invalid')).status === 403);
  } catch {
    check('the nonce route cannot be asked from another origin', false);
  }
  try {
    const response = await fetchFn(`${baseUrl}/api/v1/session`);
    const body: unknown = await response.json();
    check('the session route does not answer a guest', response.status === 200 && at(body, 'wallet') === null);
  } catch {
    check('the session route cannot be asked', false);
  }
  return problems;
}
