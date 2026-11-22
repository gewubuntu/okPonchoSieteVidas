import { describe, expect, it } from 'vitest';
import { GDD_CONFIG, publicConfig, resolveConfig } from './config';

const SET = {
  LEDGER: { packPrice: '1000' },
  SEASON: { firstStartUtc: '2026-01-01T00:00:00.000Z' },
  START_TOKEN: { startWithin: 600 },
  SESSION: { length: 604800 },
  CHAIN: {
    mode: 'base',
    confirmations: 3,
    rpcUrl: 'https://rpc.example/secret-key',
    livesContract: '0x' + 'a'.repeat(40),
    activationContract: '0x' + 'b'.repeat(40),
    palsContract: '0x' + 'c'.repeat(40),
    startBlock: 100,
  },
};

/** `SET` with one value (`GROUP.name`) left out. */
function setWithout(path: string): Record<string, Record<string, unknown>> {
  const [group = '', name = ''] = path.split('.');
  const copy: Record<string, Record<string, unknown>> = JSON.parse(JSON.stringify(SET));
  delete copy[group]?.[name];
  return copy;
}

describe('GDD-TEC-10 config', () => {
  it('the GDD starting values, and null for what it leaves unset', () => {
    expect(GDD_CONFIG.LEDGER).toEqual({ freePerDay: 3, palFreePerDay: 7, resetUtc: '00:00', packSize: 7, packPrice: null });
    expect(GDD_CONFIG.SEASON).toEqual({ months: 3, firstStartUtc: null });
    expect(GDD_CONFIG.START_TOKEN.startWithin).toBeNull();
    expect(GDD_CONFIG.SESSION.length).toBeNull();
    expect(GDD_CONFIG.CHAIN.confirmations).toBeNull();
    expect(GDD_CONFIG.CHAIN.id).toBe(8453);
  });

  it('with the mock chain the unset values take the stand-ins', () => {
    const { config, problems } = resolveConfig({});
    expect(problems).toEqual([]);
    expect(config?.SEASON.firstStartUtc).toBe('2026-01-01T00:00:00.000Z');
    expect(config?.START_TOKEN.startWithin).toBe(600);
    expect(config?.SESSION.length).toBe(604800);
    expect(config?.CHAIN.confirmations).toBe(3);
    expect(config?.CHAIN.startBlock).toBe(1);
    expect(config?.LEDGER.packPrice).toBeNull();
  });

  it('a value set by hand is kept with the mock chain', () => {
    expect(resolveConfig({ START_TOKEN: { startWithin: 30 } }).config?.START_TOKEN.startWithin).toBe(30);
  });

  it('a real chain listener is refused while any value is not set', () => {
    const { config, problems } = resolveConfig({ CHAIN: { mode: 'base' } });
    expect(config).toBeNull();
    expect(problems).toEqual([
      'LEDGER.packPrice is not set',
      'SEASON.firstStartUtc is not set',
      'START_TOKEN.startWithin is not set',
      'SESSION.length is not set',
      'CHAIN.confirmations is not set',
      'CHAIN.rpcUrl is not set',
      'CHAIN.livesContract is not set',
      'CHAIN.activationContract is not set',
      'CHAIN.palsContract is not set',
      'CHAIN.startBlock is not set',
    ]);
  });

  it.each([
    'LEDGER.packPrice',
    'SEASON.firstStartUtc',
    'START_TOKEN.startWithin',
    'SESSION.length',
    'CHAIN.confirmations',
    'CHAIN.rpcUrl',
    'CHAIN.livesContract',
    'CHAIN.activationContract',
    'CHAIN.palsContract',
    'CHAIN.startBlock',
  ])('base mode is refused without %s alone', (name) => {
    expect(resolveConfig(setWithout(name)).problems).toEqual([`${name} is not set`]);
  });

  it('base mode with every value set starts', () => {
    const { config, problems } = resolveConfig(SET);
    expect(problems).toEqual([]);
    expect(config?.CHAIN.mode).toBe('base');
  });

  it.each([
    ['LEDGER', 'freePerDay', 2.5],
    ['LEDGER', 'resetUtc', '24:00'],
    ['SEASON', 'firstStartUtc', 'soon'],
    ['CHAIN', 'livesContract', '0x12'],
    ['CHAIN', 'mode', 'main'],
    ['CHAIN', 'id', 1],
    ['LEDGER', 'packPrice', 'cheap'],
    ['CHAIN', 'rpcUrl', ''],
  ])('a value that does not read is a problem, never a default: %s.%s %j', (group, name, value) => {
    expect(resolveConfig({ [group]: { [name]: value } }).problems).toEqual([`${group}.${name} does not read`]);
  });

  it('a name the config does not have is a problem', () => {
    expect(resolveConfig({ LEDGER: { pakSize: 7 } }).problems).toEqual(['LEDGER.pakSize is not a config value']);
  });

  it('an override replaces the starting value', () => {
    const { config } = resolveConfig({ LEDGER: { freePerDay: 5 } });
    expect(config?.LEDGER.freePerDay).toBe(5);
    expect(config?.LEDGER.palFreePerDay).toBe(7);
  });

  it('the client reads every named value and never the RPC address', () => {
    const { config } = resolveConfig(SET);
    if (config === null) throw new Error('SET does not resolve');
    const seen = publicConfig(config);
    expect(seen).toEqual({
      LEDGER: { freePerDay: 3, palFreePerDay: 7, resetUtc: '00:00', packSize: 7, packPrice: '1000' },
      SEASON: { months: 3, firstStartUtc: '2026-01-01T00:00:00.000Z' },
      START_TOKEN: { startWithin: 600 },
      SESSION: { length: 604800 },
      CHAIN: {
        mode: 'base',
        id: 8453,
        confirmations: 3,
        livesContract: '0x' + 'a'.repeat(40),
        activationContract: '0x' + 'b'.repeat(40),
        palsContract: '0x' + 'c'.repeat(40),
      },
    });
    const json = JSON.stringify(seen);
    for (const hidden of ['secret-key', 'rpcUrl', 'startBlock', 'SERVER']) expect(json).not.toContain(hidden);
  });
});
