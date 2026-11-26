import { describe, expect, it } from 'vitest';
import { BOUNDS, breaksSyntax, changedCode, changedLines, covered, occurrences, suggest } from './mutant-suggest.mjs';

describe('mutant-suggest (L-010)', () => {
  const all = (text) => new Set(text.split('\n').map((_, i) => i + 1));
  /** The file with a mutant in place, as scripts/mutate.mjs would write it; the mutant's text must be there exactly once. */
  const applied = (text, m) => {
    expect(text.split(m.from)).toHaveLength(2);
    return text.replace(m.from, () => m.to);
  };

  it('covers code under src, server and scripts, and no test, declaration or other file', () => {
    for (const path of ['src/sim/run.ts', 'server/ledger.ts', 'scripts/check.mjs', 'scripts/hooks/gate-pipe.mjs']) expect(covered(path), path).toBe(true);
    for (const path of ['src/sim/run.test.ts', 'scripts/gdd-hunt.test.mjs', 'src/env.d.ts', 'e2e/boot.spec.ts', 'docs/GDD.md', 'src/a.json', 'xsrc/a.ts', 'src/a.tsx']) expect(covered(path), path).toBe(false);
  });

  it('reads the changed lines of each file from a diff with no context', () => {
    const diff = ['diff --git a/src/a.ts b/src/a.ts', '--- a/src/a.ts', '+++ b/src/a.ts', '@@ -3 +3,2 @@ function f() {', '+x', '+y', '@@ -10,2 +11 @@', '+z', '@@ -20,3 +20,0 @@', '-gone',
      'diff --git a/src/b.ts b/src/b.ts', '--- /dev/null', '+++ b/src/b.ts', '@@ -0,0 +1,3 @@', '+1', '+2', '+3',
      'diff --git a/src/c.ts b/src/c.ts', '--- a/src/c.ts', '+++ /dev/null', '@@ -1,2 +0,0 @@', '-1', '-2'].join('\n');
    const files = changedLines(diff);
    expect([...files.keys()]).toEqual(['src/a.ts', 'src/b.ts']);
    expect([...files.get('src/a.ts')]).toEqual([3, 4, 11]);
    expect([...files.get('src/b.ts')]).toEqual([1, 2, 3]);
  });

  it('moves each bound one step, and back', () => {
    expect(BOUNDS).toEqual({ '<': '<=', '<=': '<', '>': '>=', '>=': '>' });
    const text = 'const a = x < 1;\nconst b = x <= 2;\nconst c = x > 3;\nconst d = x >= 4;\nconst e = x === 5;\n';
    const mutants = suggest('src/a.ts', text, all(text));
    expect(mutants.map((m) => m.name)).toEqual(['src/a.ts:1:13 bound: < becomes <=', 'src/a.ts:2:13 bound: <= becomes <', 'src/a.ts:3:13 bound: > becomes >=', 'src/a.ts:4:13 bound: >= becomes >']);
    expect(mutants.map((m) => [m.file, m.from, m.to])).toEqual([
      ['src/a.ts', 'const a = x < 1;', 'const a = x <= 1;'],
      ['src/a.ts', 'const b = x <= 2;', 'const b = x < 2;'],
      ['src/a.ts', 'const c = x > 3;', 'const c = x >= 3;'],
      ['src/a.ts', 'const d = x >= 4;', 'const d = x > 4;'],
    ]);
  });

  it('suggests only for a comparison whose operator is on a changed line', () => {
    const text = 'const a = x < 1;\nconst b = y\n  > 2;\nconst c = z < 3;\n';
    expect(suggest('src/a.ts', text, new Set([2])).map((m) => m.name)).toEqual([]);
    expect(suggest('src/a.ts', text, new Set([3])).map((m) => m.name)).toEqual(['src/a.ts:3:3 bound: > becomes >=']);
    expect(suggest('src/a.ts', text, new Set()).length).toBe(0);
    const atStart = 'const b = y\n> 2;\nconst c = 1;\n';
    expect(suggest('src/a.ts', atStart, new Set([2])).map((m) => [m.name, m.from, m.to])).toEqual([['src/a.ts:2:1 bound: > becomes >=', '> 2;', '>= 2;']]);
    expect(suggest('src/a.ts', atStart, new Set([1, 3]))).toEqual([]);
  });

  it('finds the operator past a comment that holds one, and takes no type bracket or arrow for a bound', () => {
    const text = 'const a = x /* < */ < 1;\nconst f = (v: Array<number>): Map<string, number> => new Map<string, number>();\n';
    const mutants = suggest('src/a.ts', text, all(text));
    expect(mutants.map((m) => m.to)).toEqual(['const a = x /* < */ <= 1;']);
    const to = (line) => suggest('src/a.ts', line, new Set([1, 2])).map((m) => m.to);
    expect(to('const a = x < /* < */ 1;')).toEqual(['const a = x <= /* < */ 1;']);
    expect(to('const a = x /*<*/< 1;')).toEqual(['const a = x /*<*/<= 1;']);
    expect(to('const a = x // <\n  < 1;')).toEqual(['  <= 1;']);
  });

  it('drops each operand of a chain with the operator beside it', () => {
    const text = 'const ok = a.left === b.left && a.right === b.right && near(a, b);\n';
    const mutants = suggest('src/a.ts', text, all(text));
    expect(mutants.map((m) => m.name)).toEqual([
      'src/a.ts:1:12 clause dropped from &&: a.left === b.left',
      'src/a.ts:1:33 clause dropped from &&: a.right === b.right',
      'src/a.ts:1:56 clause dropped from &&: near(a, b)',
    ]);
    expect(mutants.map((m) => m.to)).toEqual([
      'const ok = a.right === b.right && near(a, b);',
      'const ok = a.left === b.left && near(a, b);',
      'const ok = a.left === b.left && a.right === b.right;',
    ]);
  });

  it('takes a chain of another operator, in brackets or not, for one operand, and gives it its own mutants', () => {
    const text = 'const ok = a && (b || c);\nconst or = d || e && f;\nconst and = g && h || i;\n';
    const mutants = suggest('src/a.ts', text, all(text));
    expect(mutants.map((m) => m.to)).toEqual([
      'const ok = (b || c);', 'const ok = a;', 'const ok = a && (c);', 'const ok = a && (b);',
      'const or = e && f;', 'const or = d;', 'const or = d || f;', 'const or = d || e;',
      'const and = i;', 'const and = g && h;', 'const and = h || i;', 'const and = g || i;',
    ]);
  });

  it('drops only the operands that start on a changed line, and leaves ?? alone', () => {
    const text = 'const ok = first(a) &&\n  second(a) &&\n  third(a);\nconst v = a ?? b;\n';
    expect(suggest('src/a.ts', text, new Set([2, 4])).map((m) => [m.name, m.to])).toEqual([
      ['src/a.ts:2:3 clause dropped from &&: second(a)', 'const ok = first(a) &&'],
    ]);
    const [m] = suggest('src/a.ts', text, new Set([2]));
    expect(applied(text, m)).toBe('const ok = first(a) &&\n  third(a);\nconst v = a ?? b;\n');
  });

  it('cuts a long operand short in the name, to sixty characters', () => {
    const long = `check(${'x'.repeat(70)})`;
    const exact = `check(${'y'.repeat(53)})`;
    const names = suggest('src/a.ts', `const ok = ${long} && ${exact};\n`, new Set([1])).map((m) => m.name);
    expect(names).toEqual([`src/a.ts:1:12 clause dropped from &&: ${long.slice(0, 59)}…`, `src/a.ts:1:93 clause dropped from &&: ${exact}`]);
    const over = `check(${'z'.repeat(54)})`;
    expect(suggest('src/a.ts', `const ok = ${over} && y;\n`, new Set([1]))[0].name).toBe(`src/a.ts:1:12 clause dropped from &&: ${over.slice(0, 59)}…`);
  });

  it('widens the text of a mutant until it is in the file once, so the runner can place it', () => {
    const text = ['function one(x) {', '  return x < 1;', '}', 'function two(x) {', '  return x < 1;', '}', ''].join('\n');
    const mutants = suggest('scripts/a.mjs', text, new Set([5]));
    expect(mutants).toHaveLength(1);
    expect(mutants[0].from).toBe('function two(x) {\n  return x < 1;\n}');
    expect(applied(text, mutants[0])).toBe(['function one(x) {', '  return x < 1;', '}', 'function two(x) {', '  return x <= 1;', '}', ''].join('\n'));
    const first = suggest('scripts/a.mjs', text, new Set([2]));
    expect(applied(text, first[0])).toBe(['function one(x) {', '  return x <= 1;', '}', 'function two(x) {', '  return x < 1;', '}', ''].join('\n'));
  });

  it('places a mutant on the last line of a file with no line end, and on a line that repeats to the end', () => {
    expect(suggest('src/a.ts', 'const a = x < 1;', new Set([1])).map((m) => [m.from, m.to])).toEqual([['const a = x < 1;', 'const a = x <= 1;']]);
    const twice = 'f(x < 1);\nf(x < 1);';
    const mutants = suggest('src/a.ts', twice, new Set([2]));
    expect(applied(twice, mutants[0])).toBe('f(x < 1);\nf(x <= 1);');
    expect(applied(twice, suggest('src/a.ts', twice, new Set([1]))[0])).toBe('f(x <= 1);\nf(x < 1);');
  });

  it('reads TypeScript and plain modules, each as what it is', () => {
    expect(suggest('src/a.ts', 'const a: number = x < 1;\n', new Set([1]))).toHaveLength(1);
    // In a plain module `f < g > (h)` is two comparisons; read as TypeScript it would be a call with a type argument.
    expect(suggest('scripts/a.mjs', 'const r = f < g > (h);\n', new Set([1]))).toHaveLength(2);
  });

  it('a mutant that leaves the file unparsed breaks its syntax; one that still parses, or of a file that never did, does not (L-103)', () => {
    const original = 'function f(x: unknown): boolean {\n  try {\n    return g(x);\n  } catch {\n    return false;\n  }\n}\n';
    // The try made a plain block leaves its catch with nothing to belong to.
    expect(breaksSyntax('server/a.ts', original, original.replace('  try {', '  {'))).toBe(true);
    // The whole try taken out still parses.
    expect(breaksSyntax('server/a.ts', original, 'function f(x: unknown): boolean {\n  return g(x);\n}\n')).toBe(false);
    // A type annotation is TypeScript: read as a plain module it would not parse.
    expect(breaksSyntax('server/a.ts', original, original.replace('return false', 'return true'))).toBe(false);
    expect(breaksSyntax('scripts/a.mjs', 'const a = 1;\n', 'const a = ;\n')).toBe(true);
    // A file that does not parse to begin with (not a module) is never said to be broken.
    expect(breaksSyntax('docs/a.md', '# A title {', '# A title {{')).toBe(false);
  });

  it('hands the parser the path and the text, and reads what it returns', () => {
    const seen = [];
    const parse = (path, text) => { seen.push([path, text]); return { program: { type: 'Program', body: [] }, comments: [] }; };
    expect(suggest('src/a.ts', 'x < 1', new Set([1]), parse)).toEqual([]);
    expect(seen).toEqual([['src/a.ts', 'x < 1']]);
  });
  it('tells two bounds on one line apart by their column', () => {
    expect(suggest('src/a.ts', 'const ok = a < b && c < d;\n', new Set([1])).map((m) => m.name).filter((n) => n.includes('bound'))).toEqual(['src/a.ts:1:14 bound: < becomes <=', 'src/a.ts:1:23 bound: < becomes <=']);
  });

  it('finds the operator after a left side that holds its character', () => {
    expect(suggest('src/a.ts', 'const many = xs.filter((v) => v.ok).length > 2;\n', new Set([1])).map((m) => m.to)).toEqual(['const many = xs.filter((v) => v.ok).length >= 2;']);
  });

  it('takes an operand of several lines by the line it starts on, and names it on one line', () => {
    const text = 'const ok = ready &&\n  near(\n    a,\n    b,\n  );\n';
    expect(suggest('src/a.ts', text, new Set([2])).map((m) => m.name)).toEqual(['src/a.ts:2:3 clause dropped from &&: near( a, b, )']);
    expect(suggest('src/a.ts', text, new Set([3, 4, 5]))).toEqual([]);
  });

  it('counts the places a text stands in another, overlapping ones too', () => {
    expect(occurrences('abcabc', 'bc')).toBe(2);
    expect(occurrences('abc', 'x')).toBe(0);
    expect(occurrences('aaa', 'aa')).toBe(2);
    expect(occurrences('abc', 'abc')).toBe(1);
    expect(occurrences('abc', '')).toBe(0);
  });

  it('places a mutant in a block that repeats three times in a row on the line it names', () => {
    const thrice = 'f(x < 1);\nf(x < 1);\nf(x < 1);';
    expect(applied(thrice, suggest('src/a.ts', thrice, new Set([3]))[0])).toBe('f(x < 1);\nf(x < 1);\nf(x <= 1);');
    expect(applied(thrice, suggest('src/a.ts', thrice, new Set([2]))[0])).toBe('f(x < 1);\nf(x <= 1);\nf(x < 1);');
    const pairs = 'a();\nb(x < 1);\na();\nb(x < 1);\na();\nb(x < 1);';
    expect(applied(pairs, suggest('src/a.ts', pairs, new Set([6]))[0])).toBe('a();\nb(x < 1);\na();\nb(x < 1);\na();\nb(x <= 1);');
  });

  describe('the changed code of a branch', () => {
    const diff = ['+++ b/src/a.ts', '@@ -1 +2,2 @@', '+x', '+y', '+++ b/src/a.test.ts', '@@ -1 +1 @@', '+t', '+++ b/docs/GDD.md', '@@ -1 +1 @@', '+d'].join('\n');
    const git = (answers) => (...args) => answers[args.slice(0, 2).join(' ')] ?? answers[args[0]] ?? { status: 1, stdout: '' };
    const calls = [];
    const repo = (...args) => { calls.push(args.join(' ')); return git({ 'merge-base': { status: 0, stdout: 'abc\n' }, diff: { status: 0, stdout: diff }, 'ls-files': { status: 0, stdout: 'scripts/new.mjs\nscripts/new.test.mjs\n\n' } })(...args); };
    const read = (path) => ({ 'scripts/new.mjs': 'one\ntwo\nthree', 'scripts/new.test.mjs': 'x' })[path];

    it('is the diff against the merge base and every line of an untracked file, code only', () => {
      const files = changedCode(repo, read);
      expect([...files].map(([path, lines]) => [path, [...lines]])).toEqual([['src/a.ts', [2, 3]], ['scripts/new.mjs', [1, 2, 3]]]);
      expect(calls).toEqual(['merge-base origin/main HEAD', 'diff -U0 --no-color abc -- src server scripts', 'ls-files --others --exclude-standard -- src server scripts']);
    });

    it('takes the base it is given, and is null without a merge base', () => {
      calls.length = 0;
      changedCode(repo, read, 'some/base');
      expect(calls[0]).toBe('merge-base some/base HEAD');
      expect(changedCode(git({}), read)).toBeNull();
    });
  });
});
