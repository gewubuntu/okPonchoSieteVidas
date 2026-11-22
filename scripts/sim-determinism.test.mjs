import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { determinismErrors } from './sim-determinism.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const one = (path, text) => determinismErrors([{ path, text }]);
/** The lines of `src/sim/x.ts` holding `text` that get an error, and what each names (the part before `: not the same`). */
const found = (text) => one('src/sim/x.ts', text).map((e) => e.replace(/^src\/sim\/x\.ts:/, '').replace(/: not the same.*$/, ''));

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

  // L-008: every spelling of a call, each on the line it is on.
  const spellings = {
    'a destructuring of Math': ['const { sin, cos, hypot, random } = Math;', ['1: Math']],
    'an alias of Math': ['const M = Math; M.sin(a)', ['1: Math']],
    'Math with a bracket': ["const b = Math['sin'](a);", ['1: Math[...]']],
    'Math with an optional chain': ['const b = Math?.sin(a);', ['1: Math?.sin']],
    'Math at the end of its line': ['const b = Math\n  .sin(a);', ['1: Math']],
    'a continuation line that starts with the times': ['const y = def.y + AMPLITUDE\n  * Math.sin(a);', ['2: Math.sin']],
    'a continuation line that starts with the power': ['const r = base\n  ** exponent;', ['2: the ** operator']],
    'the power assignment': ['r **= 2;', ['1: the ** operator']],
    'a line that starts with a block comment': ['/* the sway */ const y = Math.sin(a);', ['1: Math.sin']],
    'crypto getRandomValues': ['crypto.getRandomValues(buffer);', ['1: crypto.getRandomValues']],
    'crypto randomUUID': ['const id = crypto.randomUUID();', ['1: crypto.randomUUID']],
    'Date without new': ['const today = Date();', ['1: Date']],
    'Temporal': ['const t = Temporal.Now.instant();', ['1: Temporal.Now']],
    'a name that only starts like an exact one': ['const b = Math.absolute(a);', ['1: Math.absolute']],
  };
  for (const [name, [text, want]] of Object.entries(spellings)) {
    it(`fails ${name}`, () => {
      expect(found(text)).toEqual(want);
    });
  }

  it('names everything it found on a line', () => {
    expect(found("const b = Math.sin(a) + Math?.cos(a) + Math['tan'](a) + Date.now() + new Date() + a ** 2;")).toEqual([
      '1: Math.sin, Math?.cos, Math[...], Date.now, new Date, the ** operator',
    ]);
  });

  it('lets through what is exact', () => {
    const exact = ['sqrt(a)', 'abs(a)', 'floor(a)', 'ceil(a)', 'round(a)', 'trunc(a)', 'sign(a)', 'min(a, b)', 'max(a, b)', 'fround(a)', 'imul(a, b)', 'clz32(a)', 'PI', 'E', 'LN2', 'LN10', 'LOG2E', 'LOG10E', 'SQRT2', 'SQRT1_2'];
    expect(one('src/sim/x.ts', `const b = ${exact.map((m) => `Math.${m}`).join(' + ')};`)).toEqual([]);
  });

  it('a longer name holding Math or a clock is neither', () => {
    expect(found('const fooMath = 1, Mathy = 2, myDate = 3, Dates = 4, cryptography = 5;')).toEqual([]);
  });

  it('reads src/levels too', () => {
    expect(one('src/levels/y.ts', 'const a = Math.random();')).toHaveLength(1);
  });

  it('reads src/config too', () => {
    expect(one('src/config/tuning.ts', 'export const A = Math.sin(1);')).toHaveLength(1);
  });

  it('reads test support', () => {
    expect(one('src/levels/z.drive.ts', 'const a = Math.random();')).toHaveLength(1);
  });

  it('skips tests, and everything outside the three folders', () => {
    for (const path of ['src/sim/x.test.ts', 'src/ui/x.ts', 'src/scenes/x.ts', 'e2e/x.ts']) expect(one(path, 'const a = Math.random();')).toEqual([]);
  });

  it('a comment hides what it names, and nothing else', () => {
    expect(found('// Math.random')).toEqual([]);
    expect(found('/**\n * Math.sin\n */')).toEqual([]);
    // Comments are taken out before the check reads the line: a call named only in a trailing comment is not a call.
    expect(found('const a = 1; // Math.random()')).toEqual([]);
    expect(found('const a = /* Math.sin(a) */ 1;')).toEqual([]);
  });

  it('a block comment over several lines hides nothing after it ends', () => {
    expect(found('/* the sway:\n   Math.sin(a)\n */ const b = Math.sin(a);\nconst c = Math.cos(a);')).toEqual(['3: Math.sin', '4: Math.cos']);
  });

  it('a block comment ends with its slash', () => {
    expect(found('const a = /* x */ Math.sin(b) / 2;')).toEqual(['1: Math.sin']);
  });

  it('a line comment ends at its line', () => {
    expect(found('// the sway\nconst b = Math.sin(a);')).toEqual(['2: Math.sin']);
  });

  it('a string holding Math.sin or // does not confuse it', () => {
    expect(found("const s = 'Math.sin(a)';")).toEqual([]);
    expect(found('const s = "Math.random()";')).toEqual([]);
    expect(found("const s = '//'; const b = Math.sin(a);")).toEqual(['1: Math.sin']);
    expect(found('const s = "//"; const b = Math.sin(a);')).toEqual(['1: Math.sin']);
    expect(found("const s = 'it\\'s //'; const b = Math.sin(a);")).toEqual(['1: Math.sin']);
    // A bracket in a string opens no class.
    expect(found("const s = '['; const b = Math.sin(a); const c = '';")).toEqual(['1: Math.sin']);
  });

  it('a string or a regular expression ends at its line', () => {
    expect(found("const s = 'a;\nconst z = Math.sin(b); const c = '';")).toEqual(['2: Math.sin']);
    expect(found('const y = a + /2;\nconst z = Math.sin(phase) / 3;')).toEqual(['2: Math.sin']);
    expect(found('const y = ys[i]! / 2;\nconst z = Math.sin(phase) / 3;')).toEqual(['2: Math.sin']);
  });

  it('a quote not closed on its line is read as code', () => {
    expect(found("const s = 'it; const b = Math.sin(a);")).toEqual(['1: Math.sin']);
  });

  it('a division after a string', () => {
    expect(found("const r = 'a' / 2 + Math.sin(b) / 3;")).toEqual(['1: Math.sin']);
  });

  it('reads the code in a template and not its text', () => {
    expect(found('const s = `Math.sin`;')).toEqual([]);
    expect(found('const s = `${a} Math.sin`;')).toEqual([]);
    expect(found('const s = `${f({ a })} Math.sin`;')).toEqual([]);
    expect(found('const s = `x ${Math.sin(a)}`;')).toEqual(['1: Math.sin']);
    expect(found('const s = `${f({ a }) + Math.sin(a)}`;')).toEqual(['1: Math.sin']);
  });

  it('a template ends at its backquote', () => {
    expect(found('const s = `a`; const y = Math.sin(a);')).toEqual(['1: Math.sin']);
  });

  it('an escaped backquote does not end a template', () => {
    expect(found('const s = `a\\`b`; const y = Math.sin(a);')).toEqual(['1: Math.sin']);
  });

  it('the code of a template opens a regular expression', () => {
    expect(found("const s = `${/'/.test(t) ? Math.sin(a) : ''}`;")).toEqual(['1: Math.sin']);
  });

  it('reads a regular expression as one, its classes too, and a division as a division', () => {
    expect(found('const ok = /[//]/.test(s), b = Math.sin(a);')).toEqual(['1: Math.sin']);
    expect(found("const ok = /[/']/.test(s) && Math.sin(a) > 0 && t === '';")).toEqual(['1: Math.sin']);
    expect(found("const ok = /[a]'/.test(s) && Math.sin(a) > 0 && t === '';")).toEqual(['1: Math.sin']);
    expect(found('const b = a / 2 + Math.sin(c) / 3;')).toEqual(['1: Math.sin']);
    expect(found('const b = f(a) / 2 + Math.sin(c) / 3;')).toEqual(['1: Math.sin']);
  });

  it('a regular expression at the start of the text', () => {
    expect(found("/'/.test(s) && Math.sin(a) > 0 && t === '';")).toEqual(['1: Math.sin']);
  });

  it('a bang at the start of the text opens a regular expression', () => {
    expect(found("!/'/.test(s) && Math.sin(a) > 0 && t === '';")).toEqual(['1: Math.sin']);
  });

  it('a regular expression after return at the start of the text', () => {
    expect(found("return /'/.test(a) ? Math.random() : 'x';")).toEqual(['1: Math.random']);
  });

  // After each keyword that takes an expression, a `/` opens a regular expression.
  for (const keyword of ['return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void', 'throw', 'case', 'do', 'else', 'yield', 'await']) {
    it(`a regular expression after the keyword ${keyword}`, () => {
      expect(found(`a; ${keyword} /'/.test(s) && Math.sin(a) > 0 && t === '';`)).toEqual(['1: Math.sin']);
    });
  }

  // After each operator or punctuation mark, a `/` opens a regular expression: here one holding a quote, which read as a division would
  // open a string that hides the call.
  const operators = {
    'open paren': '(', comma: ',', equals: '=', colon: ':', 'open bracket': '[', bang: '!', ampersand: '&', bar: '|', question: '?',
    'open brace': '{', 'close brace': '}', semicolon: ';', plus: '+', minus: '-', star: '*', percent: '%', less: '<', greater: '>',
    tilde: '~', caret: '^',
  };
  for (const [name, op] of Object.entries(operators)) {
    it(`a regular expression after the ${name}`, () => {
      expect(found(`const t = a ${op} /'/; const b = Math.sin(a); const c = '';`)).toEqual(['1: Math.sin']);
    });
  }

  // A postfix `!`, `++` or `--` after a value: the `/` is a division (the review of 2026-11-22).
  it('a division after a name and a bang', () => {
    expect(found('const y = x! / 2 + Math.sin(a) / 3;')).toEqual(['1: Math.sin']);
  });

  it('a division after a dollar and a bang', () => {
    expect(found('const y = $! / 2 + Math.sin(a) / 3;')).toEqual(['1: Math.sin']);
  });

  it('a division after a bracket and a bang', () => {
    expect(found('const y = ys[i]! / 2 + Math.sin(phase) / 3;')).toEqual(['1: Math.sin']);
    expect(found('const d = dx[i]! / Math.hypot(a, b) / 2;')).toEqual(['1: Math.hypot']);
  });

  it('a division after a call and a bang', () => {
    expect(found('const t = m.get(k)! / Date.now() / 1000;')).toEqual(['1: Date.now']);
  });

  it('a division after plus plus', () => {
    expect(found('const r = i++ / Math.random() / 2;')).toEqual(['1: Math.random']);
  });

  it('a division after minus minus', () => {
    expect(found('const r = i-- / Math.random() / 2;')).toEqual(['1: Math.random']);
  });

  it('a division after two bangs', () => {
    expect(found('const y = x!! / 2 + Math.sin(a) / 3;')).toEqual(['1: Math.sin']);
  });

  it('a line that says why is let through, and only that line, L-028', () => {
    expect(found("const r = 2 ** n; // sim-determinism: a sound's rate\nconst a = Math.random();")).toEqual(['2: Math.random']);
  });

  it('a marker with no reason lets nothing through', () => {
    expect(found('const r = 2 ** n; // sim-determinism:')).toEqual(['1: the ** operator']);
  });

  it('a marker in a string lets nothing through', () => {
    expect(found("const why = '// sim-determinism: no'; const y = Math.random();")).toEqual(['1: Math.random']);
    expect(found('const why = `// sim-determinism: no`; const y = Math.random();')).toEqual(['1: Math.random']);
  });

  it('the marker needs its slashes', () => {
    expect(found("const r = 2 ** n; /* sim-determinism: a sound's rate */")).toEqual(['1: the ** operator']);
  });

  it('a GDD citation is not the marker', () => {
    expect(found('const seed = Date.now(); // GDD-TEC-09: the seed a record holds')).toEqual(['1: Date.now']);
  });

  it('GDD-TEC-09 the real src/sim, src/levels and src/config hold no forbidden call', () => {
    expect(determinismErrors(tree('src'))).toEqual([]);
  });
});
