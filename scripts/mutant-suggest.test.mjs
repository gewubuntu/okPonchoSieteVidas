import { describe, expect, it } from 'vitest';
import { BOUNDS, changedLines, covered, suggest } from './mutant-suggest.mjs';

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
    expect(mutants.map((m) => m.name)).toEqual(['src/a.ts:1 bound: < becomes <=', 'src/a.ts:2 bound: <= becomes <', 'src/a.ts:3 bound: > becomes >=', 'src/a.ts:4 bound: >= becomes >']);
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
    expect(suggest('src/a.ts', text, new Set([3])).map((m) => m.name)).toEqual(['src/a.ts:3 bound: > becomes >=']);
    expect(suggest('src/a.ts', text, new Set()).length).toBe(0);
    const atStart = 'const b = y\n> 2;\nconst c = 1;\n';
    expect(suggest('src/a.ts', atStart, new Set([2])).map((m) => [m.name, m.from, m.to])).toEqual([['src/a.ts:2 bound: > becomes >=', '> 2;', '>= 2;']]);
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
      'src/a.ts:1 clause dropped from &&: a.left === b.left',
      'src/a.ts:1 clause dropped from &&: a.right === b.right',
      'src/a.ts:1 clause dropped from &&: near(a, b)',
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
      ['src/a.ts:2 clause dropped from &&: second(a)', 'const ok = first(a) &&'],
    ]);
    const [m] = suggest('src/a.ts', text, new Set([2]));
    expect(applied(text, m)).toBe('const ok = first(a) &&\n  third(a);\nconst v = a ?? b;\n');
  });

  it('cuts a long operand short in the name, to sixty characters', () => {
    const long = `check(${'x'.repeat(70)})`;
    const exact = `check(${'y'.repeat(53)})`;
    const names = suggest('src/a.ts', `const ok = ${long} && ${exact};\n`, new Set([1])).map((m) => m.name);
    expect(names).toEqual([`src/a.ts:1 clause dropped from &&: ${long.slice(0, 59)}…`, `src/a.ts:1 clause dropped from &&: ${exact}`]);
    const over = `check(${'z'.repeat(54)})`;
    expect(suggest('src/a.ts', `const ok = ${over} && y;\n`, new Set([1]))[0].name).toBe(`src/a.ts:1 clause dropped from &&: ${over.slice(0, 59)}…`);
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

  it('hands the parser the path and the text, and reads what it returns', () => {
    const seen = [];
    const parse = (path, text) => { seen.push([path, text]); return { program: { type: 'Program', body: [] }, comments: [] }; };
    expect(suggest('src/a.ts', 'x < 1', new Set([1]), parse)).toEqual([]);
    expect(seen).toEqual([['src/a.ts', 'x < 1']]);
  });
});
