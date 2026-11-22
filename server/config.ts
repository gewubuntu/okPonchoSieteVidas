// GDD-CHAIN-01: the proposal's named config values, in one config the server owns and the client reads (GET /api/v1/config).
// Placeholder (Conflict C13, Open Question 54 (f)): the values live in the server's own file, the recommended resolution.
// None of it reaches the simulation (GDD-TEC-09). `null` is "not set" (Open Question 54 (e)).

/** The values the GDD names, each with its starting value. */
export interface GddValues {
  readonly LEDGER: { readonly freePerDay: number; readonly palFreePerDay: number; readonly resetUtc: string; readonly packSize: number; readonly packPrice: string | null };
  readonly SEASON: { readonly months: number; readonly firstStartUtc: string | null };
  readonly START_TOKEN: { readonly startWithin: number | null };
  readonly SESSION: { readonly length: number | null };
  readonly CHAIN: { readonly confirmations: number | null };
}

/** The GDD's values and the server's own settings, as `resolveConfig` gives them. */
export interface ServerConfig extends Omit<GddValues, 'CHAIN'> {
  readonly CHAIN: GddValues['CHAIN'] & { readonly mode: 'mock' | 'base' };
}

/** The GDD's starting values (GDD-LIFE-06, GDD-CHAIN-04, GDD-TEC-10); what it leaves unset is null. */
export const GDD_CONFIG: GddValues = {
  LEDGER: { freePerDay: 3, palFreePerDay: 7, resetUtc: '00:00', packSize: 7, packPrice: null },
  SEASON: { months: 3, firstStartUtc: null },
  START_TOKEN: { startWithin: null },
  SESSION: { length: null },
  CHAIN: { confirmations: null },
};

/** The server's own settings, not GDD values (docs/decisions/0004-game-server.md): it reads the mock chain until a contract exists. */
export const SERVER_SETTINGS = { CHAIN: { mode: 'mock' } } as const;

/** The chain ID of Base, which the GDD names as the chain (GDD-TEC-10). A fact of the chain, not a config choice, so no override reaches it. */
export const BASE_CHAIN_ID = 8453;

/** Placeholder (Open Question 54 (e)): stand-ins for the unset values, used with the mock chain only. Not decisions. */
export const MOCK_PLACEHOLDERS: Readonly<Record<string, string | number>> = { 'SEASON.firstStartUtc': '2026-01-01T00:00:00.000Z', 'START_TOKEN.startWithin': 600, 'SESSION.length': 604800, 'CHAIN.confirmations': 3 };

/** What a real chain may not be read without: every value the GDD leaves unset. */
export const NEEDED_FOR_BASE: readonly string[] = ['LEDGER.packPrice', 'SEASON.firstStartUtc', 'START_TOKEN.startWithin', 'SESSION.length', 'CHAIN.confirmations'];

type Check = (value: unknown) => boolean;
const whole = (min: number): Check => (value) => typeof value === 'number' && Number.isInteger(value) && value >= min;
const time: Check = (value) => typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
// An ISO 8601 instant that names its zone, so that it never reads in the host's own zone.
const instant: Check = (value) => typeof value === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d(:\d\d(\.\d+)?)?(Z|[+-]\d\d:\d\d)$/.test(value) && !Number.isNaN(Date.parse(value));
const price: Check = (value) => typeof value === 'string' && /^\d+(\.\d+)?$/.test(value);
const oneOf = (...allowed: readonly unknown[]): Check => (value) => allowed.includes(value);

const CHECKS: Readonly<Record<string, Check>> = {
  'LEDGER.freePerDay': whole(0), 'LEDGER.palFreePerDay': whole(0), 'LEDGER.resetUtc': time, 'LEDGER.packSize': whole(1), 'LEDGER.packPrice': price,
  'SEASON.months': whole(1), 'SEASON.firstStartUtc': instant,
  'START_TOKEN.startWithin': whole(1),
  'SESSION.length': whole(1),
  'CHAIN.mode': oneOf('mock', 'base'), 'CHAIN.confirmations': whole(0),
};

const isGroups = (value: unknown): value is Readonly<Record<string, unknown>> => typeof value === 'object' && value !== null && !Array.isArray(value);

export type Resolved = { readonly config: ServerConfig; readonly problems: readonly [] } | { readonly config: null; readonly problems: readonly string[] };

/** The GDD's values and the server's settings with `overrides` laid over them (an object of groups, as the config file holds). A value or a group that does not read is a problem, never a default. */
export function resolveConfig(overrides: unknown): Resolved {
  if (!isGroups(overrides)) return { config: null, problems: ['the overrides are not an object of groups'] };
  const flat = new Map<string, unknown>([GDD_CONFIG, SERVER_SETTINGS].flatMap((source) => Object.entries(source).flatMap(([group, values]) => Object.entries(values).map(([name, value]): [string, unknown] => [`${group}.${name}`, value]))));
  const problems: string[] = [];
  for (const [group, values] of Object.entries(overrides)) {
    if (!isGroups(values)) {
      problems.push(`${group} is not a group of values`);
      continue;
    }
    for (const [name, value] of Object.entries(values)) {
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

/** What the client may read: every named value, and of the chain which one it is and how it is read. */
export function publicConfig(config: ServerConfig): object {
  const { mode, confirmations } = config.CHAIN;
  return { LEDGER: config.LEDGER, SEASON: config.SEASON, START_TOKEN: config.START_TOKEN, SESSION: config.SESSION, CHAIN: { mode, id: BASE_CHAIN_ID, confirmations } };
}
