import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { determinismErrors } from './sim-determinism.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const one = (path, text) => determinismErrors([{ path, text }]);
/** The lines of `src/sim/x.ts` holding `text` that get an error, and what each names (the part before ` is not the same`). */
const found = (text) => one('src/sim/x.ts', text).map((e) => e.replace(/^src\/sim\/x\.ts:/, '').replace(/ is not the same.*$/, ''));

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
    'Math with a bracket round an exact name': ['const b = Math[sqrt](a);', ['1: Math[...]']],
    'Math with an optional chain': ['const b = Math?.sin(a);', ['1: Math?.sin']],
    'Math with an optional chain to an exact member': ['const b = Math?.sqrt(a);', ['1: Math?.sqrt']],
    'Math at the end of its line': ['const b = Math\n  .sin(a);', ['1: Math.sin']],
    'Math as the key of an object': ['const o = { Math: 1 };', ['1: Math']],
    'Math as the name of a property': ['const b = o.Math;', ['1: Math']],
    'Math as a type': ['let t: Math;', ['1: Math']],
    'Date as a type': ['let t: Date;', ['1: Date']],
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

  it('names what it found in the order it stands, line by line', () => {
    expect(found('const b = Math.sin(a) ** 2;')).toEqual(['1: Math.sin, the ** operator']);
    expect(found('const r = Math.sin(a)\n  ** 2;')).toEqual(['1: Math.sin', '2: the ** operator']);
  });

  it('a power after a comment holding two stars', () => {
    expect(found('const r = base /* x ** y */\n  ** exponent;')).toEqual(['2: the ** operator']);
  });

  it('Math in a shorthand is named once', () => {
    expect(found('const o = { Math };')).toEqual(['1: Math']);
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

  it('a file that does not parse gives its one error', () => {
    const errors = one('src/sim/x.ts', "const ok = 1;\nconst s = 'a;\nconst b = Math.sin(a);");
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/^src\/sim\/x\.ts:2: does not parse /);
  });

  it('a comment hides what it names, and nothing else', () => {
    expect(found('// Math.random')).toEqual([]);
    expect(found('/**\n * Math.sin\n */')).toEqual([]);
    // A call named only in a trailing comment is not a call.
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
    expect(found("const s = '['; const b = Math.sin(a); const c = '';")).toEqual(['1: Math.sin']);
  });

  it('the division on the next line', () => {
    expect(found('const y = a\n  / 2 + Math.sin(b) / 3;')).toEqual(['2: Math.sin']);
    expect(found('const y = ys[i]! / 2;\nconst z = Math.sin(phase) / 3;')).toEqual(['2: Math.sin']);
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

  it('a division inside the code of a template', () => {
    expect(found('const s = `${o.in / 2 + Math.sin(a) / 3}`;')).toEqual(['1: Math.sin']);
  });

  it('reads a regular expression as one, its classes too, and a division as a division', () => {
    expect(found('const ok = /[//]/.test(s), b = Math.sin(a);')).toEqual(['1: Math.sin']);
    expect(found("const ok = /[/']/.test(s) && Math.sin(a) > 0 && t === '';")).toEqual(['1: Math.sin']);
    expect(found("const ok = /[a]'/.test(s) && Math.sin(a) > 0 && t === '';")).toEqual(['1: Math.sin']);
    expect(found('const ok = /Math.sin/.test(s);')).toEqual([]);
    expect(found('const b = a / 2 + Math.sin(c) / 3;')).toEqual(['1: Math.sin']);
    expect(found('const b = f(a) / 2 + Math.sin(c) / 3;')).toEqual(['1: Math.sin']);
  });

  it('a regular expression at the start of the text', () => {
    expect(found("/'/.test(s) && Math.sin(a) > 0 && t === '';")).toEqual(['1: Math.sin']);
  });

  it('a bang at the start of the text opens a regular expression', () => {
    expect(found("!/'/.test(s) && Math.sin(a) > 0 && t === '';")).toEqual(['1: Math.sin']);
  });

  // After each keyword that takes an expression, a `/` opens a regular expression holding a quote: read as a division, it would open a
  // string that hides the call.
  const keywords = {
    return: "function f() { return /'/.test(s) && Math.sin(a) > 0 && t === ''; }",
    typeof: "const y = typeof /'/ === 'object' && Math.sin(a) > 0;",
    instanceof: "const y = a instanceof /'/.constructor && Math.sin(a) > 0 && t === '';",
    in: "const y = 'x' in /'/ && Math.sin(a) > 0 && t === '';",
    of: "for (const x of /'/.exec(s) ?? []) f(x, Math.sin(a), '');",
    new: "const y = new /'/.constructor() && Math.sin(a) > 0 && t === '';",
    delete: "const y = delete /'/.x && Math.sin(a) > 0 && t === '';",
    void: "const y = void /'/ && Math.sin(a) > 0 && t === '';",
    throw: "function f() { throw /'/.test(s) && Math.sin(a) > 0 && t === ''; }",
    case: "switch (a) { case /'/.test(s) && Math.sin(a) > 0 && t === '': break; }",
    do: "do /'/.test(s) && Math.sin(a) > 0 && t === ''; while (a);",
    else: "if (a) b(); else /'/.test(s) && Math.sin(a) > 0 && t === '';",
    yield: "function* g() { yield /'/.test(s) && Math.sin(a) > 0 && t === ''; }",
    await: "async function g() { await /'/.test(s) && Math.sin(a) > 0 && t === ''; }",
  };
  for (const [keyword, text] of Object.entries(keywords)) {
    it(`a regular expression after the keyword ${keyword}`, () => {
      expect(found(text)).toEqual(['1: Math.sin']);
    });
  }

  // A property named like a keyword, before a division (the review of 2026-11-22).
  for (const property of ['in', 'new', 'of', 'do', 'case', 'else', 'delete', 'void', 'throw', 'typeof', 'instanceof', 'yield', 'await', 'return']) {
    it(`a division after a property named ${property}`, () => {
      expect(found(`const y = o${property === 'do' ? '?.' : '.'}${property} / 2 + Math.sin(a) / 3;`)).toEqual(['1: Math.sin']);
    });
  }

  it('a division after a private name in', () => {
    expect(found('class A { #in = 1; f() { return this.#in / 2 + Math.sin(a) / 3; } }')).toEqual(['1: Math.sin']);
  });

  it('a division after a variable named of', () => {
    expect(found('const of = 1; const y = of / 2 + Math.sin(a) / 3;')).toEqual(['1: Math.sin']);
  });

  it('a division after a cast to a generic type', () => {
    expect(found('const y = x as Px<number> / 2 + Math.sin(b) / 3;')).toEqual(['1: Math.sin']);
  });

  // After each operator or punctuation mark, a `/` opens a regular expression holding a quote.
  const operators = {
    'open paren': "f(/'/); const b = Math.sin(a); const c = '';",
    comma: "const t = [1, /'/]; const b = Math.sin(a); const c = '';",
    equals: "const t = /'/; const b = Math.sin(a); const c = '';",
    colon: "const t = c ? 1 : /'/; const b = Math.sin(a); const c = '';",
    'open bracket': "const t = [/'/]; const b = Math.sin(a); const c = '';",
    bang: "const t = !/'/; const b = Math.sin(a); const c = '';",
    question: "const t = c ? /'/ : 1; const b = Math.sin(a); const c = '';",
    'open brace': "{ /'/.test(s); } const b = Math.sin(a); const c = '';",
    'close brace': "if (a) {} /'/.test(s); const b = Math.sin(a); const c = '';",
    semicolon: "a; /'/.test(s); const b = Math.sin(a); const c = '';",
    tilde: "const t = ~/'/; const b = Math.sin(a); const c = '';",
    ...Object.fromEntries(
      Object.entries({ ampersand: '&', bar: '|', plus: '+', minus: '-', star: '*', percent: '%', less: '<', greater: '>', caret: '^' }).map(([n, op]) => [n, `const t = a ${op} /'/; const b = Math.sin(a); const c = '';`]),
    ),
  };
  for (const [name, text] of Object.entries(operators)) {
    it(`a regular expression after the ${name}`, () => {
      expect(found(text)).toEqual(['1: Math.sin']);
    });
  }

  // Where a regular expression can be taken for a division (the review of 2026-11-22).
  const regexes = {
    'after a plus with no space': "a+/'/.test(s) ? Math.random() : 'x';",
    'with a slash after a plus with no space': 'a+/\\//.test(s) ? Math.random() : 0;',
    'after return and a bang with no space': "function f() { return!/'/.test(a) ? Math.random() : 0; }",
    'after an if': 'if (ok) /\\//.test(s) && f(Math.random());',
    'after export default': "export default /'/.test(s) ? Math.random() : 0;",
  };
  for (const [name, text] of Object.entries(regexes)) {
    it(`a regular expression ${name}`, () => {
      expect(found(text)).toEqual(['1: Math.random']);
    });
  }

  // A postfix `!`, `++` or `--` after a value: the `/` is a division.
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

  it('a division after a spaced postfix', () => {
    expect(found('const y = x ! / 2 + Math.sin(a) / 3;')).toEqual(['1: Math.sin']);
    expect(found('const r = i ++ / Math.random() / 2;')).toEqual(['1: Math.random']);
  });

  it('a line that says why is let through, and only that line, L-028', () => {
    expect(found("const r = 2 ** n; // sim-determinism: a sound's rate\nconst a = Math.random();")).toEqual(['2: Math.random']);
  });

  it('a marker with no reason lets nothing through', () => {
    expect(found('const r = 2 ** n; // sim-determinism:')).toEqual(['1: the ** operator']);
  });

  it('a marker on the line above lets nothing through', () => {
    expect(found("// sim-determinism: a sound's rate\nconst r = 2 ** n;")).toEqual(['2: the ** operator']);
  });

  it('the marker starts its comment', () => {
    expect(found('const r = 2 ** n; // see sim-determinism: a rate')).toEqual(['1: the ** operator']);
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
