import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { determinismErrors } from './sim-determinism.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const one = (path, text) => determinismErrors([{ path, text }]);

/** Every `.ts` file under `dir`, as `{ path, text }` with the path from the repository's root, `/`-separated. */
function tree(dir) {
  return readdirSync(join(ROOT, dir), { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.ts'))
    .map((e) => join(e.parentPath, e.name))
    .map((f) => ({ path: relative(ROOT, f).split(sep).join('/'), text: readFileSync(f, 'utf8') }));
}

describe('GDD-TEC-09 sim-determinism: nothing an engine may approximate, no clock, no dice', () => {
  // One test per forbidden name: a one-line file in src/sim/ that calls it gives one error, on line 1.
  const lines = {
    'Math random': 'const a = Math.random();',
    'Date now': 'const a = Date.now();',
    'performance now': 'const a = performance.now();',
    'new Date': 'const a = new Date();',
    'Math sin': 'const b = Math.sin(a);',
    'Math cos': 'const b = Math.cos(a);',
    'Math tan': 'const b = Math.tan(a);',
    'Math asin': 'const b = Math.asin(a);',
    'Math acos': 'const b = Math.acos(a);',
    'Math atan': 'const b = Math.atan(a);',
    'Math atan2': 'const c = Math.atan2(a, b);',
    'Math sinh': 'const b = Math.sinh(a);',
    'Math cosh': 'const b = Math.cosh(a);',
    'Math tanh': 'const b = Math.tanh(a);',
    'Math asinh': 'const b = Math.asinh(a);',
    'Math acosh': 'const b = Math.acosh(a);',
    'Math atanh': 'const b = Math.atanh(a);',
    'Math exp': 'const b = Math.exp(a);',
    'Math expm1': 'const b = Math.expm1(a);',
    'Math log': 'const b = Math.log(a);',
    'Math log1p': 'const b = Math.log1p(a);',
    'Math log2': 'const b = Math.log2(a);',
    'Math log10': 'const b = Math.log10(a);',
    'Math pow': 'const b = Math.pow(a, 2);',
    'Math cbrt': 'const b = Math.cbrt(a);',
    'Math hypot': 'const c = Math.hypot(a, b);',
    'the power operator': 'const b = a ** 2;',
  };
  for (const [name, text] of Object.entries(lines)) {
    it(`fails ${name} on its line`, () => {
      const errors = one('src/sim/x.ts', text);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toMatch(/^src\/sim\/x\.ts:1: /);
    });
  }

  it('lets through what is exact', () => {
    expect(one('src/sim/x.ts', 'const b = Math.sqrt(a) + Math.abs(a) + Math.floor(a) + Math.round(a) + Math.PI + Math.SQRT2 + Math.min(a, b);')).toEqual([]);
  });

  it('reads src/levels too', () => {
    expect(one('src/levels/y.ts', 'const a = Math.random();')).toHaveLength(1);
  });

  it('reads test support', () => {
    expect(one('src/levels/z.drive.ts', 'const a = Math.random();')).toHaveLength(1);
  });

  it('skips tests, and everything outside the two folders', () => {
    for (const path of ['src/sim/x.test.ts', 'src/ui/x.ts', 'src/scenes/x.ts', 'e2e/x.ts']) expect(one(path, 'const a = Math.random();')).toEqual([]);
  });

  it('skips comment lines only', () => {
    expect(one('src/sim/x.ts', '// Math.random')).toEqual([]);
    expect(one('src/sim/x.ts', '  * Math.sin')).toEqual([]);
    // The main session's ruling (2026-11-22): a trailing comment that names a forbidden call on a code line fails.
    expect(one('src/sim/x.ts', 'const a = 1; // Math.random()')).toHaveLength(1);
  });

  it('a line that says why is let through, and only that line, L-028', () => {
    const errors = one('src/sim/x.ts', 'const r = 2 ** n; // GDD-TEC-09: a sound\'s rate\nconst a = Math.random();');
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/^src\/sim\/x\.ts:2: /);
  });

  it('a marker with no reason lets nothing through', () => {
    expect(one('src/sim/x.ts', 'const r = 2 ** n; // GDD-TEC-09:')).toHaveLength(1);
  });

  it('GDD-TEC-09 the real src/sim and src/levels hold no forbidden call', () => {
    expect(determinismErrors(tree('src'))).toEqual([]);
  });
});
