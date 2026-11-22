// GDD-TEC-09: a run is reproduced from its inputs on every engine, so what a step can reach calls nothing an engine may approximate in
// its own way, reads no clock and draws no unseeded random number. Every `.ts` file under `src/sim/`, `src/levels/` and `src/config/`
// (tests aside, test support included) is read as code: its comments, and the insides of its strings, template texts and regular
// expressions, are blanked first. Then any use of `Math` but a member the standard makes exact, any use of `Date`, `performance` or
// `crypto`, and the `**` operator are errors (L-008: every spelling, not one per call), unless the line says why it never reaches a step in
// a `// sim-determinism: <reason>` comment.

/** The members of `Math` that are exact by the standard: allowed. */
export const EXACT = ['sqrt', 'abs', 'floor', 'ceil', 'round', 'trunc', 'sign', 'min', 'max', 'fround', 'imul', 'clz32', 'PI', 'E', 'LN2', 'LN10', 'LOG2E', 'LOG10E', 'SQRT2', 'SQRT1_2'];

/** A use of `Math` that is not `Math.<exact member>`: a destructuring, an alias, a bracket, an optional chain, a line's end, any other member. */
const MATH = new RegExp(`\\bMath\\b(?!\\.(?:${EXACT.join('|')})(?!\\w))`, 'g');
/** A clock or a random source. */
const CLOCKS = /\b(?:new\s+)?(?:Date|performance|crypto)\b(?:\.\w+)?/g;
/** The standard lets an engine approximate `**` (and `**=`) as it does `Math.pow`. */
const POWER = /\*\*/g;

/** Whether the check reads the file at `path` (`/`-separated, from the repository's root). */
export const covered = (path) => /^src\/(sim|levels|config)\//.test(path) && path.endsWith('.ts') && !path.endsWith('.test.ts');

/** The exemption, read from the line as written: a comment that names the check and gives at least one word of reason. */
const MARKER = /\/\/ sim-determinism: *\w/;

/** After these a `/` starts a regular expression, not a division. */
const BEFORE_REGEX = /^$|[(,=:[!&|?{};+\-*%<>~^]/;

const blank = (s) => s.replace(/[^\n]/g, ' ');

/**
 * The text with every comment, and the inside of every string, template text and regular expression, turned to spaces; the code in a
 * template's `${...}` is kept, and so is every line break, so each line keeps its number.
 */
export function codeOnly(text) {
  const out = [];
  const open = []; // for each `${` still open, how many `{` are open inside it
  let template = false;
  let prev = ''; // the last character of code that is not a space
  for (let i = 0; i < text.length; ) {
    const c = text[i];
    const d = text[i + 1];
    if (template) {
      if (c === '`' || (c === '$' && d === '{')) {
        // The template ends, or its code starts.
        if (c === '$') open.push(0);
        const tok = c === '$' ? '${' : c;
        out.push(tok);
        prev = tok.at(-1);
        template = false;
        i += tok.length;
      } else {
        const len = c === '\\' ? 2 : 1;
        out.push(blank(text.slice(i, i + len)));
        i += len;
      }
      continue;
    }
    let end = -1;
    if (c === '/' && d === '/') end = text.indexOf('\n', i) === -1 ? text.length : text.indexOf('\n', i);
    else if (c === '/' && d === '*') end = text.indexOf('*/', i + 2) === -1 ? text.length : text.indexOf('*/', i + 2) + 2;
    if (end !== -1) {
      out.push(blank(text.slice(i, end)));
      i = end;
      continue;
    }
    if (c === "'" || c === '"' || (c === '/' && BEFORE_REGEX.test(prev))) {
      let j = i + 1;
      let inClass = false;
      while (j < text.length && text[j] !== '\n' && (text[j] !== c || inClass)) {
        if (c === '/' && text[j] === '[') inClass = true;
        else if (c === '/' && text[j] === ']') inClass = false;
        j += text[j] === '\\' ? 2 : 1;
      }
      if (text[j] === c) {
        out.push(c + blank(text.slice(i + 1, j)) + c);
        prev = c;
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
    out.push(c);
    if (!/\s/.test(c)) prev = c;
    i++;
  }
  return out.join('');
}

/** One error per line of a covered file (`{ path, text }`) that holds a forbidden use and does not say why it is let through. */
export function determinismErrors(files) {
  const errors = [];
  for (const { path, text } of files.filter((f) => covered(f.path))) {
    const written = text.split('\n');
    codeOnly(text)
      .split('\n')
      .forEach((line, i) => {
        if (MARKER.test(written[i])) return;
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
