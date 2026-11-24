import { describe, expect, it } from 'vitest';
import { covered, serverImportErrors, target } from './server-one-way.mjs';

describe('server-one-way (L-008)', () => {
  const errorsOf = (text, path = 'src/sim/a.ts') => serverImportErrors([{ path, text }]);
  const at = (line, written) => `src/sim/a.ts:${line}: \`${written}\` leads into server/; only the server imports the game (docs/decisions/0004-game-server.md)`;

  it('reads the code under src and nothing else', () => {
    for (const path of ['src/sim/run.ts', 'src/a.mjs', 'src/sim/run.test.ts']) expect(covered(path), path).toBe(true);
    for (const path of ['server/ledger.ts', 'scripts/check.mjs', 'xsrc/a.ts', 'src/a.json', 'src/a.tsx', 'e2e/a.spec.ts']) expect(covered(path), path).toBe(false);
    expect(serverImportErrors([{ path: 'server/a.ts', text: "import '../server/ledger';" }, { path: 'e2e/a.spec.ts', text: "import '../server/ledger';" }])).toEqual([]);
  });

  it('works out where a relative path leads, and leaves any other alone', () => {
    expect(target('src/sim/a.ts', '../../server/ledger')).toBe('server/ledger');
    expect(target('src/a.ts', '../server/store/store')).toBe('server/store/store');
    expect(target('src/ui/a.ts', './server/api')).toBe('src/ui/server/api');
    expect(target('src/sim/a.ts', './b')).toBe('src/sim/b');
    expect(target('src/sim/a.ts', 'server/ledger')).toBeNull();
    expect(target('src/sim/a.ts', '/server/ledger.ts')).toBe('server/ledger.ts');
    expect(target('src/sim/a.ts', '/assets/x.png')).toBe('assets/x.png');
    expect(target('src/sim/a.ts', '/server/../src/x')).toBe('src/x');
    expect(target('src/sim/a.ts', '//server/x')).toBe('server/x');
    expect(target('src/sim/a.ts', 'viem')).toBeNull();
    expect(target('src/sim/a.ts', '.hidden/x')).toBeNull();
    expect(target('src/sim/a.ts', '...')).toBeNull();
    expect(target('src/sim/a.ts', 'lib/../../../server/x')).toBeNull();
  });

  it('fails every spelling of an import that leads into the server, with its line', () => {
    expect(errorsOf("import { takeLife } from '../../server/ledger';")).toEqual([at(1, '../../server/ledger')]);
    expect(errorsOf("const a = 1;\nimport '../../server/ledger';")).toEqual([at(2, '../../server/ledger')]);
    expect(errorsOf("import type { Took } from '../../server/ledger';")).toEqual([at(1, '../../server/ledger')]);
    expect(errorsOf("export { takeLife } from '../../server/ledger';")).toEqual([at(1, '../../server/ledger')]);
    expect(errorsOf("export * from \"../../server/ledger\";")).toEqual([at(1, '../../server/ledger')]);
    expect(errorsOf("const m = await import('../../server/ledger');")).toEqual([at(1, '../../server/ledger')]);
    expect(errorsOf('const m = await import(`../../server/ledger`);')).toEqual([at(1, '../../server/ledger')]);
    expect(errorsOf("const all = import.meta.glob('../../server/*.ts');")).toEqual([at(1, '../../server/*.ts')]);
    expect(errorsOf("vi.mock('../../server/ledger');")).toEqual([at(1, '../../server/ledger')]);
    expect(errorsOf("const l = import.meta.glob('/server/ledger.ts', { eager: true });")).toEqual([at(1, '/server/ledger.ts')]);
    expect(errorsOf("import '../../server';")).toEqual([at(1, '../../server')]);
    expect(errorsOf('const m = await import(`../../server/${name}`);')).toEqual([at(1, '../../server/')]);
  });

  it('lets through what does not lead there', () => {
    expect(errorsOf("// moved here from '../../server/ledger' so the game needs no server\nexport const x = 1;")).toEqual([]);
    expect(errorsOf("import { api } from './server/api';", 'src/ui/a.ts')).toEqual([]);
    expect(errorsOf("import { step } from './run';\nimport { x } from '../config/tuning';")).toEqual([]);
    expect(errorsOf("const name = 'server/ledger';\nconst other = '../../servers/x';\nconst near = '../../serverless';")).toEqual([]);
    expect(errorsOf('const p = `../../${folder}/ledger`;')).toEqual([]);
    expect(errorsOf('const n = 5;\nconst r = /..\\/server/;')).toEqual([]);
    expect(errorsOf("const img = '/assets/x.png';\nconst main = '/src/main.ts';\nconst s = '/servers/x';")).toEqual([]);
  });

  it('reads a plain module as one, and says so when a file does not parse', () => {
    expect(serverImportErrors([{ path: 'src/a.mjs', text: "import '../server/ledger';" }])).toHaveLength(1);
    const errors = errorsOf("import { from '../../server/ledger';");
    expect(errors[0]).toBe('src/sim/a.ts: does not parse, so its imports cannot be read');
  });

  it('hands the parser the path and the text', () => {
    const seen = [];
    const parse = (path, text) => { seen.push([path, text]); return { program: { type: 'Program', body: [] }, errors: [] }; };
    expect(serverImportErrors([{ path: 'src/a.ts', text: 'x' }, { path: 'docs/a.ts', text: 'y' }], parse)).toEqual([]);
    expect(seen).toEqual([['src/a.ts', 'x']]);
  });
});
