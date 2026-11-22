// GDD-TEC-09: a run is reproduced from its inputs on every engine, so what a step can reach calls nothing an engine may approximate in
// its own way, reads no clock and draws no unseeded random number. Every `.ts` file under `src/sim/`, `src/levels/` and `src/config/`
// (tests aside, test support included) is read as code: its comments, and the insides of its strings, template texts and regular
// expressions, are blanked first. Then any use of `Math` but a member the standard makes exact, any use of `Date`, `Temporal`,
// `performance` or `crypto`, and the `**` operator are errors (L-008: every spelling, not one per call), unless the line says why it never
// reaches a step in a `// sim-determinism: <reason>` comment.
//
// A `/` opens a regular expression only where a value cannot end: at the start of the text, after an operator or punctuation mark, or
// after a keyword that takes an expression (`return /x/`). After a name, a number, `)`, `]`, a string, or a postfix `!`, `++` or `--`
// (`x! / 2`, `i++ / 2`) it is a division. Where it cannot tell (`a+/x/`) it reads a division, so the text after the `/` is read as code:
// a blanking missed can only give a false error, which a marker or a rewrite answers; a wrong blanking could hide a call.

/** The members of `Math` that are exact by the standard: allowed. */
export const EXACT = ['sqrt', 'abs', 'floor', 'ceil', 'round', 'trunc', 'sign', 'min', 'max', 'fround', 'imul', 'clz32', 'PI', 'E', 'LN2', 'LN10', 'LOG2E', 'LOG10E', 'SQRT2', 'SQRT1_2'];

/** A use of `Math` that is not `Math.<exact member>`: a destructuring, an alias, a bracket, an optional chain, a line's end, any other member. */
const MATH = new RegExp(`\\bMath\\b(?!\\.(?:${EXACT.join('|')})(?!\\w))`, 'g');
/** A clock or a random source. */
const CLOCKS = /\b(?:new\s+)?(?:Date|Temporal|performance|crypto)\b(?:\.\w+)?/g;
/** The standard lets an engine approximate `**` (and `**=`) as it does `Math.pow`. */
const POWER = /\*\*/g;

/** Whether the check reads the file at `path` (`/`-separated, from the repository's root). */
export const covered = (path) => /^src\/(sim|levels|config)\//.test(path) && path.endsWith('.ts') && !path.endsWith('.test.ts');

/** The exemption, read from the line's comments only: a `//` comment that names the check and gives at least one word of reason. */
const MARKER = /\/\/ sim-determinism: *\w/;

/** After one of these a `/` opens a regular expression. */
const OPERATOR = /[(,=:[!&|?{};+\-*%<>~^]/;
/** The keywords after which a `/` opens a regular expression. */
const KEYWORDS = new Set(['return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void', 'throw', 'case', 'do', 'else', 'yield', 'await']);

const blank = (s) => s.replace(/[^\n]/g, ' ');

/** Whether a `/` whose last character of code before it is `text[at]` (`at` -1 at the start) opens a regular expression. */
function opensRegex(text, at) {
  if (at < 0) return true;
  const c = text[at];
  if (/[\w$]/.test(c)) {
    let s = at;
    while (s > 0 && /[\w$]/.test(text[s - 1])) s--;
    return KEYWORDS.has(text.slice(s, at + 1));
  }
  if (!OPERATOR.test(c)) return false;
  if (c !== '!' && c !== '+' && c !== '-') return true;
  // A `!`, `!!`, `++` or `--` right after a value is postfix, and the `/` a division.
  let k = at;
  while (text[k - 1] === c) k--;
  return !/[\w$)\]]/.test(text[k - 1] ?? '');
}

/**
 * The text read two ways, each the same length with every line break kept, so each line keeps its number: `code`, with every comment,
 * and the inside of every string, template text and regular expression, turned to spaces (the code in a template's `${...}` kept); and
 * `notes`, with only the comments kept.
 */
export function scan(text) {
  const code = [];
  const notes = [];
  const push = (kept, s) => {
    code.push(kept ? s : blank(s));
    notes.push(blank(s));
  };
  const open = []; // for each `${` still open, how many `{` are open inside it
  let template = false;
  let prev = -1; // where the last character of code that is not a space is
  for (let i = 0; i < text.length; ) {
    const c = text[i];
    const d = text[i + 1];
    if (template) {
      if (c === '`' || (c === '$' && d === '{')) {
        // The template ends, or its code starts.
        if (c === '$') open.push(0);
        const tok = c === '$' ? '${' : c;
        push(true, tok);
        prev = i + tok.length - 1;
        template = false;
        i += tok.length;
      } else {
        const len = c === '\\' ? 2 : 1;
        push(false, text.slice(i, i + len));
        i += len;
      }
      continue;
    }
    let end = -1;
    if (c === '/' && d === '/') end = text.indexOf('\n', i) === -1 ? text.length : text.indexOf('\n', i);
    else if (c === '/' && d === '*') end = text.indexOf('*/', i + 2) === -1 ? text.length : text.indexOf('*/', i + 2) + 2;
    if (end !== -1) {
      code.push(blank(text.slice(i, end)));
      notes.push(text.slice(i, end));
      i = end;
      continue;
    }
    if (c === "'" || c === '"' || (c === '/' && opensRegex(text, prev))) {
      let j = i + 1;
      let inClass = false;
      while (j < text.length && text[j] !== '\n' && (text[j] !== c || inClass)) {
        if (c === '/' && text[j] === '[') inClass = true;
        else if (c === '/' && text[j] === ']') inClass = false;
        j += text[j] === '\\' ? 2 : 1;
      }
      if (text[j] === c) {
        push(true, c);
        push(false, text.slice(i + 1, j));
        push(true, c);
        prev = j;
        i = j + 1;
        continue;
      }
      // An unclosed quote or slash on its line: not a literal (a division, or a slip), read as code.
    }
    if (c === '`') template = true;
    else if (c === '{' && open.length > 0) open[open.length - 1]++;
    else if (c === '}' && open.length > 0) {
      if (open.at(-1) === 0) {
        open.pop();
        template = true;
      } else open[open.length - 1]--;
    }
    push(true, c);
    if (!/\s/.test(c)) prev = i;
    i++;
  }
  return { code: code.join(''), notes: notes.join('') };
}

/** One error per line of a covered file (`{ path, text }`) that holds a forbidden use and does not say why it is let through. */
export function determinismErrors(files) {
  const errors = [];
  for (const { path, text } of files.filter((f) => covered(f.path))) {
    const { code, notes } = scan(text);
    const comments = notes.split('\n');
    code.split('\n').forEach((line, i) => {
      if (MARKER.test(comments[i])) return;
      const found = [
        ...[...line.matchAll(MATH)].map((m) => /^Math(\??\.\w+|\[)?/.exec(line.slice(m.index))[0].replace(/\[$/, '[...]')),
        ...[...line.matchAll(CLOCKS)].map((m) => m[0].replace(/\s+/, ' ')),
        ...[...line.matchAll(POWER)].map(() => 'the ** operator'),
      ];
      if (found.length > 0) errors.push(`${path}:${i + 1}: ${found.join(', ')}: not the same in every engine or run (GDD-TEC-09); use src/sim/detmath.ts, or say on the line why it never reaches a step: // sim-determinism: <reason>`);
    });
  }
  return errors;
}
