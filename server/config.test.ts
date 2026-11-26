import { describe, expect, it } from 'vitest';
import { BASE_CHAIN_ID, GDD_CONFIG, SERVER_SETTINGS, publicConfig, resolveConfig } from './config';

const SET = {
  LEDGER: { packPrice: '1000' },
  SEASON: { firstStartUtc: '2026-01-01T00:00:00.000Z' },
  START_TOKEN: { startWithin: 600 },
  SESSION: { length: 604800 },
  CHAIN: { mode: 'base', confirmations: 3 },
};

/** `SET` with one value (`GROUP.name`) left out. */
function setWithout(path: string): Record<string, Record<string, unknown>> {
  const [group = '', name = ''] = path.split('.');
  const copy: Record<string, Record<string, unknown>> = JSON.parse(JSON.stringify(SET));
  delete copy[group]?.[name];
  return copy;
}

/** The problems of one value laid over the starting values. */
const problemsOf = (group: string, name: string, value: unknown): readonly string[] => resolveConfig({ [group]: { [name]: value } }).problems;

describe('GDD-TEC-10 config', () => {
  it.each([['START_TOKEN', 'startWithin'], ['SESSION', 'length']])('%s.%s is whole seconds whose milliseconds are a safe whole number', (group, name) => {
    const most = Math.floor(Number.MAX_SAFE_INTEGER / 1000); // 9007199254740: its milliseconds 9007199254740000 are safe
    expect(problemsOf(group, name, most)).toEqual([]);
    expect(problemsOf(group, name, most + 1)).toEqual([`${group}.${name} does not read`]);
    expect(problemsOf(group, name, Number.MAX_SAFE_INTEGER)).toEqual([`${group}.${name} does not read`]);
    expect(problemsOf(group, name, 2 ** 53)).toEqual([`${group}.${name} does not read`]);
    expect(problemsOf(group, name, 1.5)).toEqual([`${group}.${name} does not read`]);
    expect(problemsOf(group, name, 1)).toEqual([]);
    expect(problemsOf(group, name, 0)).toEqual([`${group}.${name} does not read`]);
  });

  it('the GDD starting values, and null for what it leaves unset', () => {
    expect(GDD_CONFIG).toEqual({
      LEDGER: { freePerDay: 3, palFreePerDay: 7, resetUtc: '00:00', packSize: 7, packPrice: null },
      SEASON: { months: 3, firstStartUtc: null },
      START_TOKEN: { startWithin: null },
      SESSION: { length: null },
      CHAIN: { confirmations: null },
    });
  });

  it('the server reads the mock chain unless told otherwise, a setting of its own', () => {
    expect(SERVER_SETTINGS).toEqual({ CHAIN: { mode: 'mock' } });
    expect(resolveConfig({}).config?.CHAIN.mode).toBe('mock');
  });

  it('the chain is Base, chain ID 8453', () => {
    expect(BASE_CHAIN_ID).toBe(8453);
  });

  it('placeholder Open Question 54 e: with the mock chain the unset values take the stand-ins', () => {
    const { config, problems } = resolveConfig({});
    expect(problems).toEqual([]);
    expect(config?.SEASON.firstStartUtc).toBe('2026-01-01T00:00:00.000Z');
    expect(config?.START_TOKEN.startWithin).toBe(600);
    expect(config?.SESSION.length).toBe(604800);
    expect(config?.CHAIN.confirmations).toBe(3);
    expect(config?.LEDGER.packPrice).toBeNull();
  });

  it('a value set by hand is kept with the mock chain', () => {
    expect(resolveConfig({ START_TOKEN: { startWithin: 30 } }).config?.START_TOKEN.startWithin).toBe(30);
  });

  it('a real chain is refused while any value is not set', () => {
    const { config, problems } = resolveConfig({ CHAIN: { mode: 'base' } });
    expect(config).toBeNull();
    expect(problems).toEqual([
      'LEDGER.packPrice is not set',
      'SEASON.firstStartUtc is not set',
      'START_TOKEN.startWithin is not set',
      'SESSION.length is not set',
      'CHAIN.confirmations is not set',
    ]);
  });

  it.each(['LEDGER.packPrice', 'SEASON.firstStartUtc', 'START_TOKEN.startWithin', 'SESSION.length', 'CHAIN.confirmations'])(
    'base mode is refused without %s alone',
    (name) => {
      expect(resolveConfig(setWithout(name)).problems).toEqual([`${name} is not set`]);
    },
  );

  it('base mode with every value set starts', () => {
    const { config, problems } = resolveConfig(SET);
    expect(problems).toEqual([]);
    expect(config?.CHAIN.mode).toBe('base');
  });

  it.each([
    ['LEDGER', 'freePerDay', 2.5],
    ['LEDGER', 'resetUtc', '24:00'],
    ['SEASON', 'firstStartUtc', 'soon'],
    ['CHAIN', 'mode', 'main'],
    ['LEDGER', 'packPrice', 'cheap'],
  ])('a value that does not read is a problem, never a default: %s.%s %j', (group, name, value) => {
    expect(problemsOf(group, name, value)).toEqual([`${group}.${name} does not read`]);
  });

  it.each([
    ['LEDGER', 'freePerDay', 0],
    ['LEDGER', 'palFreePerDay', 0],
    ['LEDGER', 'packSize', 1],
    ['SEASON', 'months', 1],
    ['START_TOKEN', 'startWithin', 1],
    ['SESSION', 'length', 1],
    ['CHAIN', 'confirmations', 0],
  ])('the least %s.%s is %i: it reads, and one less does not', (group, name, least) => {
    expect(problemsOf(group, name, least)).toEqual([]);
    expect(problemsOf(group, name, least - 1)).toEqual([`${group}.${name} does not read`]);
  });

  it.each([
    ['00:00', true],
    ['23:59', true],
    ['19:59', true],
    ['20:00', true],
    ['00:59', true],
    ['24:00', false],
    ['00:60', false],
    ['000:00', false],
    ['00:000', false],
    ['0:00', false],
  ])('LEDGER.resetUtc as a time of day: %s reads %s', (value, reads) => {
    expect(problemsOf('LEDGER', 'resetUtc', value)).toEqual(reads ? [] : ['LEDGER.resetUtc does not read']);
  });

  it.each([
    ['1000', true],
    ['0.5', true],
    ['1.', false],
    ['.5', false],
    ['1e3', false],
    ['-1', false],
    [1000, false],
  ])('LEDGER.packPrice as a decimal price: %j reads %s', (value, reads) => {
    expect(problemsOf('LEDGER', 'packPrice', value)).toEqual(reads ? [] : ['LEDGER.packPrice does not read']);
  });

  it.each([
    ['2026-01-01T00:00:00.000Z', true],
    ['2026-01-01T00:00:00+01:00', true],
    ['2026-01-01T00:00:00-05:00', true],
    ['2026-01-01T00:00:00', false],
    ['2026-01-01', false],
    ['1 Jan 2026 Z', false],
    ['2026-13-01T00:00:00Z', false],
  ])('SEASON.firstStartUtc is an instant with its zone: %s reads %s', (value, reads) => {
    expect(problemsOf('SEASON', 'firstStartUtc', value)).toEqual(reads ? [] : ['SEASON.firstStartUtc does not read']);
  });

  it('a name the config does not have is a problem', () => {
    expect(resolveConfig({ LEDGER: { pakSize: 7 } }).problems).toEqual(['LEDGER.pakSize is not a config value']);
  });

  it.each([
    [{ LEDGER: 5 }, ['LEDGER is not a group of values']],
    [{ CHAIN: 'base' }, ['CHAIN is not a group of values']],
    [{ LEDGER: null }, ['LEDGER is not a group of values']],
    [{ LEDGER: [3] }, ['LEDGER is not a group of values']],
    ['x', ['the overrides are not an object of groups']],
    [null, ['the overrides are not an object of groups']],
    [[], ['the overrides are not an object of groups']],
  ])('a group or overrides of the wrong shape is a problem, never defaults: %j', (overrides, problems) => {
    expect(resolveConfig(overrides)).toEqual({ config: null, problems });
  });

  it('an override replaces the starting value', () => {
    const { config } = resolveConfig({ LEDGER: { freePerDay: 5 } });
    expect(config?.LEDGER.freePerDay).toBe(5);
    expect(config?.LEDGER.palFreePerDay).toBe(7);
  });

  it('placeholder Conflict C13 and Open Question 54 f: the client reads the named values from the server config', () => {
    const { config } = resolveConfig(SET);
    if (config === null) throw new Error('SET does not resolve');
    expect(publicConfig(config)).toEqual({
      LEDGER: { freePerDay: 3, palFreePerDay: 7, resetUtc: '00:00', packSize: 7, packPrice: '1000' },
      SEASON: { months: 3, firstStartUtc: '2026-01-01T00:00:00.000Z' },
      START_TOKEN: { startWithin: 600 },
      SESSION: { length: 604800 },
      CHAIN: { mode: 'base', id: 8453, confirmations: 3 },
    });
  });
});
