// GDD-TEC-09: a run is reproduced from its inputs on every engine, so what a step can reach calls nothing an engine may approximate in
// its own way, reads no clock and draws no unseeded random number. Every `.ts` file under `src/sim/` and `src/levels/` (tests aside, test
// support included) is read line by line; a forbidden call on a line that is not a comment line is an error unless the line says why it
// never reaches a step, in a `// GDD-TEC-09: <reason>` comment. Exact by the standard, and allowed: `Math.sqrt`, `abs`, `floor`, `ceil`,
// `round`, `trunc`, `sign`, `min`, `max`, `fround`, `imul`, `clz32` and the constants.

/** The `Math` functions the language lets an engine approximate. */
const INEXACT = ['sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'atan2', 'sinh', 'cosh', 'tanh', 'asinh', 'acosh', 'atanh', 'exp', 'expm1', 'log', 'log1p', 'log2', 'log10', 'pow', 'cbrt', 'hypot'];

/** Each forbidden call: what the error names, and the pattern that finds it on a line. */
export const FORBIDDEN = [
  { what: 'Math.random', re: /\bMath\.random\b/ },
  { what: 'Date.now', re: /\bDate\.now\b/ },
  { what: 'performance.now', re: /\bperformance\.now\b/ },
  { what: 'new Date', re: /\bnew Date\b/ },
  ...INEXACT.map((f) => ({ what: `Math.${f}`, re: new RegExp(`\\bMath\\.${f}\\b`) })),
  // The standard lets an engine approximate `**` as it does `Math.pow`.
  { what: 'the ** operator', re: /\*\*/ },
];

/** Whether the check reads the file at `path` (`/`-separated, from the repository's root). */
export const covered = (path) => /^src\/(sim|levels)\//.test(path) && path.endsWith('.ts') && !path.endsWith('.test.ts');

const COMMENT_LINE = /^\s*(\/\/|\*|\/\*)/;
const MARKER = /\/\/ GDD-TEC-09: *\w/;

/** One error per line of a covered file (`{ path, text }`) that holds a forbidden call and does not say why it is let through. */
export function determinismErrors(files) {
  const errors = [];
  for (const { path, text } of files.filter((f) => covered(f.path))) {
    text.split('\n').forEach((line, i) => {
      if (COMMENT_LINE.test(line) || MARKER.test(line)) return;
      const found = FORBIDDEN.filter((f) => f.re.test(line)).map((f) => f.what);
      if (found.length > 0) errors.push(`${path}:${i + 1}: ${found.join(', ')} is not the same in every engine or run (GDD-TEC-09); use src/sim/detmath.ts, or say on the line why it never reaches a step: // GDD-TEC-09: <reason>`);
    });
  }
  return errors;
}
