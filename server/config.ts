// GDD-CHAIN-01, Conflict C13: the proposal's named config values, in one config the server owns and the client reads (GET /api/v1/config).
// None of it reaches the simulation (GDD-TEC-09). `null` is "not set" (Open Question 54 (e)).
export interface ServerConfig {
  readonly LEDGER: { readonly freePerDay: number; readonly palFreePerDay: number; readonly resetUtc: string; readonly packSize: number; readonly packPrice: string | null };
  readonly SEASON: { readonly months: number; readonly firstStartUtc: string | null };
  readonly START_TOKEN: { readonly startWithin: number | null };
  readonly SESSION: { readonly length: number | null };
  readonly CHAIN: { readonly mode: 'mock' | 'base'; readonly id: number; readonly confirmations: number | null; readonly rpcUrl: string | null; readonly livesContract: string | null; readonly activationContract: string | null; readonly palsContract: string | null; readonly startBlock: number | null };
  readonly SERVER: { readonly origin: string; readonly port: number; readonly database: string | null; readonly nonceSeconds: number; readonly pollSeconds: number; readonly maxBlockRange: number };
}

/** The GDD's starting values (GDD-LIFE-06, GDD-CHAIN-04, GDD-TEC-10); what it leaves unset is null. */
export const GDD_CONFIG: ServerConfig = {
  LEDGER: { freePerDay: 3, palFreePerDay: 7, resetUtc: '00:00', packSize: 7, packPrice: null },
  SEASON: { months: 3, firstStartUtc: null },
  START_TOKEN: { startWithin: null },
  SESSION: { length: null },
  CHAIN: { mode: 'mock', id: 8453, confirmations: null, rpcUrl: null, livesContract: null, activationContract: null, palsContract: null, startBlock: null },
  SERVER: { origin: 'http://localhost:5173', port: 8787, database: null, nonceSeconds: 300, pollSeconds: 5, maxBlockRange: 1000 },
};

/** Stand-ins for the unset values, used with the mock chain only. Not decisions (Open Question 54 (e)). */
export const MOCK_PLACEHOLDERS: Readonly<Record<string, string | number>> = { 'SEASON.firstStartUtc': '2026-01-01T00:00:00.000Z', 'START_TOKEN.startWithin': 600, 'SESSION.length': 604800, 'CHAIN.confirmations': 3, 'CHAIN.startBlock': 1 };

/** What a real chain listener may not start without. */
export const NEEDED_FOR_BASE: readonly string[] = ['LEDGER.packPrice', 'SEASON.firstStartUtc', 'START_TOKEN.startWithin', 'SESSION.length', 'CHAIN.confirmations', 'CHAIN.rpcUrl', 'CHAIN.livesContract', 'CHAIN.activationContract', 'CHAIN.palsContract', 'CHAIN.startBlock'];

type Check = (value: unknown) => boolean;
const whole = (min: number): Check => (value) => typeof value === 'number' && Number.isInteger(value) && value >= min;
const text: Check = (value) => typeof value === 'string' && value !== '';
const time: Check = (value) => typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
const instant: Check = (value) => typeof value === 'string' && !Number.isNaN(Date.parse(value));
const price: Check = (value) => typeof value === 'string' && /^\d+(\.\d+)?$/.test(value);
const address: Check = (value) => typeof value === 'string' && /^0x[0-9a-fA-F]{40}$/.test(value);
const oneOf = (...allowed: readonly unknown[]): Check => (value) => allowed.includes(value);

const CHECKS: Readonly<Record<string, Check>> = {
  'LEDGER.freePerDay': whole(0), 'LEDGER.palFreePerDay': whole(0), 'LEDGER.resetUtc': time, 'LEDGER.packSize': whole(1), 'LEDGER.packPrice': price,
  'SEASON.months': whole(1), 'SEASON.firstStartUtc': instant,
  'START_TOKEN.startWithin': whole(1),
  'SESSION.length': whole(1),
  'CHAIN.mode': oneOf('mock', 'base'), 'CHAIN.id': oneOf(8453, 84532), 'CHAIN.confirmations': whole(0), 'CHAIN.rpcUrl': text, 'CHAIN.livesContract': address, 'CHAIN.activationContract': address, 'CHAIN.palsContract': address, 'CHAIN.startBlock': whole(0),
  'SERVER.origin': text, 'SERVER.port': whole(0), 'SERVER.database': text, 'SERVER.nonceSeconds': whole(1), 'SERVER.pollSeconds': whole(1), 'SERVER.maxBlockRange': whole(1),
};

export type Resolved = { readonly config: ServerConfig; readonly problems: readonly [] } | { readonly config: null; readonly problems: readonly string[] };

/** The GDD's values with `overrides` laid over them (an object of groups, as the config file holds). A value that does not read is a problem, never a default. */
export function resolveConfig(overrides: unknown): Resolved {
  const flat = new Map<string, unknown>(Object.entries(GDD_CONFIG).flatMap(([group, values]) => Object.entries(values).map(([name, value]): [string, unknown] => [`${group}.${name}`, value])));
  const problems: string[] = [];
  for (const [group, values] of Object.entries(typeof overrides === 'object' && overrides !== null ? overrides : {})) {
    for (const [name, value] of Object.entries(typeof values === 'object' && values !== null ? values : {})) {
      const check = CHECKS[`${group}.${name}`];
      if (check === undefined) problems.push(`${group}.${name} is not a config value`);
      else if (!check(value)) problems.push(`${group}.${name} does not read`);
      else flat.set(`${group}.${name}`, value);
    }
  }
  if (flat.get('CHAIN.mode') === 'mock') {
    for (const [name, value] of Object.entries(MOCK_PLACEHOLDERS)) if (flat.get(name) === null) flat.set(name, value);
  } else {
    for (const name of NEEDED_FOR_BASE) if (flat.get(name) === null) problems.push(`${name} is not set`);
  }
  if (problems.length > 0) return { config: null, problems };
  const groups: Record<string, Record<string, unknown>> = {};
  for (const [path, value] of flat) {
    const [group = '', name = ''] = path.split('.');
    (groups[group] ??= {})[name] = value;
  }
  const config: ServerConfig = JSON.parse(JSON.stringify(groups));
  return { config, problems: [] };
}

/** What the client may read: every named value, and of the chain what a wallet needs. Never the RPC address (it can hold a key) or the server's own settings. */
export function publicConfig(config: ServerConfig): object {
  const { mode, id, confirmations, livesContract, activationContract, palsContract } = config.CHAIN;
  return { LEDGER: config.LEDGER, SEASON: config.SEASON, START_TOKEN: config.START_TOKEN, SESSION: config.SESSION, CHAIN: { mode, id, confirmations, livesContract, activationContract, palsContract } };
}
