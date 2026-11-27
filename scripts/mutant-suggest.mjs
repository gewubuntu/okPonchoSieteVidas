// Mutant suggestions (L-010): the mutants a plan most often forgets, listed from the diff so none is left to memory.
//   node scripts/mutate.mjs --suggest [base]   prints a mutants file for scripts/mutate.mjs, for the lines changed since the
//                                              merge base with `base` (origin/main unless given), uncommitted lines included
// For every comparison on a changed line it moves the bound (`<` to `<=`, `>` to `>=` and back), and for every `&&` or `||`
// chain it drops each operand that starts on a changed line. Each mutant comes with no test: the author names the one test
// that must kill it, or says why the mutant changes nothing. It lists where a test may be missing; it cannot tell which
// GDD clause has no code at all.
import { createRequire } from 'node:module';

// Loaded on first use, as in scripts/sim-determinism.mjs, so the runner still works in a checkout with no `node_modules`.
const require = createRequire(import.meta.url);

/** The language a file is read in, by its extension: TypeScript (`.ts`, `.mts`, `.cts`), TSX, JSX, else a plain module. */
export const langOf = (path) => (/\.tsx$/i.test(path) ? 'tsx' : /\.jsx$/i.test(path) ? 'jsx' : /\.[cm]?ts$/i.test(path) ? 'ts' : 'js');

/** The regular expression literals of a parsed program that V8 would refuse to make (`/\d++/`, a group named twice), as errors. */
export function badRegexes(program) {
  const errors = [];
  const walk = (node) => {
    if (Array.isArray(node)) node.forEach(walk);
    else if (node !== null && typeof node === 'object') {
      if (node.regex !== undefined) {
        try {
          new RegExp(node.regex.pattern, node.regex.flags);
        } catch (error) {
          errors.push({ message: error.message });
        }
      }
      for (const key of Object.keys(node)) if (key !== 'regex') walk(node[key]);
    }
  };
  walk(program);
  return errors;
}

/**
 * Vite's parser, with the checks V8 makes when it loads a module (a `break` outside a loop, a name declared twice, a regular
 * expression it cannot make): a mutant that fails them parses, then fails to load, and every test goes red for that (L-103).
 */
const viteParse = (path, text) => {
  const parsed = require('vite').parseSync(path, text, { lang: langOf(path), showSemanticErrors: true });
  return { ...parsed, errors: [...parsed.errors, ...badRegexes(parsed.program)] };
};

/**
 * Whether a mutant of `original` into `mutated` breaks the file's syntax: the file parsed before and does not after. Such a
 * mutant turns every test red for a reason of its own, so its red proves nothing (L-103). A file that did not parse before
 * (no code, or not a module) is never said to be broken.
 */
export const breaksSyntax = (path, original, mutated, parse = viteParse) => parse(path, original).errors.length === 0 && parse(path, mutated).errors.length > 0;

/** A bound and the bound one step from it. */
export const BOUNDS = { '<': '<=', '<=': '<', '>': '>=', '>=': '>' };

/** Whether suggestions are made for the file at `path` (`/`-separated, from the repository's root): code, not its tests. */
export const covered = (path) => /^(src|server|scripts)\//.test(path) && /\.(ts|mjs)$/.test(path) && !/\.(test|d)\.(ts|mjs)$/.test(path);

/** The lines a `git diff -U0` adds or changes, by file: `Map<path, Set<line>>`, line numbers as in the new file. */
export function changedLines(diff) {
  const files = new Map();
  let lines = null;
  for (const row of diff.split('\n')) {
    const file = /^\+\+\+ (?:b\/(.+)|\/dev\/null)$/.exec(row);
    if (file) {
      lines = file[1] === undefined ? null : new Set();
      if (lines) files.set(file[1], lines);
      continue;
    }
    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/.exec(row);
    // A deleted file's hunks add no line, so `lines` is never reached while it is null.
    if (hunk) for (let n = 0; n < Number(hunk[2] ?? 1); n++) lines.add(Number(hunk[1]) + n);
  }
  return files;
}

/**
 * A command that runs Vitest or Playwright: by its name, its version (`vitest@4`), its file (`node_modules/vitest/vitest.mjs`,
 * `@playwright/test/cli.js`), or a test script (`npm test`, `npm run test:e2e`, `pnpm test`).
 */
const TEST_RUNNER = /(vitest|playwright)(@\S*|\/\S*)?(\s|$)|npm\s+(run\s+)?test/;
/** Vitest's and Playwright's filters on a test's name, each a word of its own. */
const NAME_FILTER = /\s(-t|-g|--testNamePattern|--grep)(=|\s)/;

/**
 * Whether a mutant's test command runs only the test that must kill it (L-026): a Vitest or Playwright command names that test
 * with a filter on its name, or a run of the whole file counts a kill by any other test in it. Any other command (the gate, a
 * check script) is the mutant's own test as it stands.
 */
export const namesOneTest = (command) => !TEST_RUNNER.test(command) || NAME_FILTER.test(command);

/** How often `part` stands in `text`, places that overlap counted too (three equal lines hold a pair of them twice); never for the empty text. */
export function occurrences(text, part) {
  // The empty text stands everywhere, and searching on for it would never end (L-064).
  if (part === '') return 0;
  let n = 0;
  for (let at = text.indexOf(part); at !== -1; at = text.indexOf(part, at + 1)) n++;
  return n;
}

/**
 * The changed lines to suggest for, by file: the lines `git diff -U0` gives against the merge base with `base` (the working
 * tree's, so uncommitted ones too), and every line of a file git does not track yet; only files `covered` takes. `git(...args)`
 * runs git and returns `{ status, stdout }`, `read(path)` a file's text. Null when there is no merge base.
 */
export function changedCode(git, read, base = 'origin/main') {
  const from = git('merge-base', base, 'HEAD');
  if (from.status !== 0) return null;
  const files = changedLines(git('diff', '-U0', '--no-color', from.stdout.trim(), '--', 'src', 'server', 'scripts').stdout);
  for (const path of git('ls-files', '--others', '--exclude-standard', '--', 'src', 'server', 'scripts').stdout.split('\n').filter(Boolean)) {
    files.set(path, new Set(read(path).split('\n').map((_, i) => i + 1)));
  }
  // A deleted file is not among them: `changedLines` leaves it out, and git lists no deleted file as untracked.
  return new Map([...files].filter(([path]) => covered(path)));
}

/** Every node of the tree with its parent, in source order. */
function* nodes(node, parent = null) {
  yield [node, parent];
  for (const value of Object.values(node)) {
    for (const child of Array.isArray(value) ? value : [value]) if (child && typeof child.type === 'string') yield* nodes(child, node);
  }
}

/** The operands of a chain of one logical operator, left to right: `a && b && c` is three, `a && (b || c)` two. */
function operands(node) {
  // Only another logical expression has the same operator.
  return node.left.operator === node.operator ? [...operands(node.left), node.right] : [node.left, node.right];
}

/**
 * The mutants for one file. `text` is its source, `lines` the set of its changed lines, `parse(path, text)` gives
 * `{ program, comments }` (Vite's `parseSync` by default). Each mutant is `{ name, file, from, to }` with `from` in the file
 * exactly once: the whole lines the change stands on, widened line by line until no other place in the file reads the same.
 * Its name gives the line and the column of what it changes.
 */
export function suggest(path, text, lines, parse = viteParse) {
  const { program, comments } = parse(path, text);
  const starts = [0, ...[...text.matchAll(/\n/g)].map((m) => m.index + 1)];
  // The source with every comment blanked, so an operator is never found inside one.
  const code = comments.reduce((t, c) => t.slice(0, c.start) + ' '.repeat(c.end - c.start) + t.slice(c.end), text);
  const lineOf = (at) => starts.findLastIndex((s) => s <= at) + 1;
  const mutants = [];
  const add = (at, start, end, replacement, what) => {
    let first = lineOf(start);
    let last = lineOf(Math.max(start, end - 1));
    const slice = () => [starts[first - 1], last < starts.length ? starts[last] - 1 : text.length];
    // The whole file is in the file once, so the widening ends there at the latest; the second condition only keeps a broken
    // line count from looping for ever (L-064).
    while (occurrences(text, text.slice(...slice())) !== 1 && (first > 1 || last < starts.length)) {
      first = Math.max(1, first - 1);
      last = Math.min(starts.length, last + 1);
    }
    const [from, to] = slice();
    mutants.push({ name: `${path}:${lineOf(at)}:${at - starts[lineOf(at) - 1] + 1} ${what}`, file: path, from: text.slice(from, to), to: text.slice(from, start) + replacement + text.slice(end, to) });
  };
  for (const [node, parent] of nodes(program)) {
    // Only a binary expression has one of these operators. It stands between the two sides, after any comment.
    if (node.operator in BOUNDS) {
      const at = code.indexOf(node.operator, node.left.end);
      if (lines.has(lineOf(at))) add(at, at, at + node.operator.length, BOUNDS[node.operator], `bound: ${node.operator} becomes ${BOUNDS[node.operator]}`);
    }
    // A chain is taken once, at its top: a logical expression under the same operator is its parent's left side.
    const chain = node.operator === '&&' || node.operator === '||';
    if (chain && parent?.operator !== node.operator) {
      const parts = operands(node);
      parts.forEach((part, i) => {
        if (!lines.has(lineOf(part.start))) return;
        // The operand goes with the operator beside it: the one after the first operand, the one before any other.
        const [start, end] = i === 0 ? [part.start, parts[1].start] : [parts[i - 1].end, part.end];
        const shown = text.slice(part.start, part.end).replace(/\s+/g, ' ');
        add(part.start, start, end, '', `clause dropped from ${node.operator}: ${shown.length > 60 ? `${shown.slice(0, 59)}…` : shown}`);
      });
    }
  }
  return mutants;
}
