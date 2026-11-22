// GDD-TEC-09: a run is reproduced from its inputs on every engine, so what a step can reach calls nothing an engine may approximate in
// its own way, reads no clock and draws no unseeded random number. Every `.ts` file under `src/sim/`, `src/levels/` and `src/config/`
// (tests aside, test support included) is parsed (the oxc parser Vite carries), and its syntax tree read, so strings, template text,
// regular expressions and comments are never taken for code (L-008: every spelling, not one per call). An error: every identifier `Math`
// but `Math.<exact member>`; every identifier `Date`, `Temporal`, `performance` or `crypto`, wherever it stands; every `**` and `**=`.
// A `// sim-determinism: <reason>` comment lets through what starts on its line; a file that does not parse is one error.
import { parseSync } from 'vite';

/** The members of `Math` that are exact by the standard: allowed. */
export const EXACT = ['sqrt', 'abs', 'floor', 'ceil', 'round', 'trunc', 'sign', 'min', 'max', 'fround', 'imul', 'clz32', 'PI', 'E', 'LN2', 'LN10', 'LOG2E', 'LOG10E', 'SQRT2', 'SQRT1_2'];
/** A clock or a random source: an error wherever the name stands, strict on purpose. */
const CLOCKS = ['Date', 'Temporal', 'performance', 'crypto'];

/** Whether the check reads the file at `path` (`/`-separated, from the repository's root). */
export const covered = (path) => /^src\/(sim|levels|config)\//.test(path) && path.endsWith('.ts') && !path.endsWith('.test.ts');

/** The exemption: a line comment (after its `//`) that names the check and gives a reason. */
const MARKER = /^ sim-determinism: \S/;

/** Every node of the tree with its parent, in source order. */
function* nodes(node, parent = null) {
  yield [node, parent];
  for (const value of Object.values(node)) {
    for (const child of Array.isArray(value) ? value : [value]) if (child && typeof child.type === 'string') yield* nodes(child, node);
  }
}

/** What a forbidden use is called in an error, and where it starts; null for an allowed one. */
function forbidden(node, parent, text, comments) {
  const member = parent?.type === 'MemberExpression' && parent.object === node ? parent : null;
  if (node.type === 'Identifier' && node.name === 'Math') {
    // Math as a member's property has the name Math, never an exact one, so the list alone keeps the exception to the object (L-025).
    if (parent?.type === 'MemberExpression' && !parent.computed && !parent.optional && EXACT.includes(parent.property.name)) return null;
    if (!member) return { at: node.start, what: 'Math' };
    return { at: node.start, what: member.computed ? 'Math[...]' : `Math${member.optional ? '?.' : '.'}${member.property.name}` };
  }
  if (node.type === 'Identifier' && CLOCKS.includes(node.name)) {
    if (parent?.type === 'NewExpression' && parent.callee === node) return { at: parent.start, what: `new ${node.name}` };
    return { at: node.start, what: member && !member.computed ? `${node.name}.${member.property.name}` : node.name };
  }
  const power = (node.type === 'BinaryExpression' && node.operator === '**') || (node.type === 'AssignmentExpression' && node.operator === '**=');
  if (!power) return null;
  // At the operator, which can stand on the line after its left side; a comment between the two sides is skipped.
  let at = node.left.end;
  while (at < node.right.start && (!text.startsWith('**', at) || comments.some((c) => c.start <= at && at < c.end))) at++;
  return { at, what: 'the ** operator' };
}

/** One error per line of a covered file (`{ path, text }`) that holds a forbidden use and does not say why it is let through. */
export function determinismErrors(files) {
  const errors = [];
  for (const { path, text } of files.filter((f) => covered(f.path))) {
    const lineOf = (at) => text.slice(0, at).split('\n').length;
    const { program, comments, errors: broken } = parseSync(path, text, { lang: 'ts' });
    // The parser gives an empty program for a file it cannot parse, so nothing else is read from it (L-025); were it to keep a part,
    // that part would only add errors.
    if (broken.length > 0) errors.push(`${path}:${lineOf(broken[0].labels[0]?.start ?? 0)}: does not parse (${broken[0].message}), so the check cannot read it (GDD-TEC-09)`);
    const exempt = new Set(comments.filter((c) => c.type === 'Line' && MARKER.test(c.value)).map((c) => lineOf(c.start)));
    const byLine = new Map();
    for (const [node, parent] of nodes(program)) {
      const f = forbidden(node, parent, text, comments);
      if (!f || exempt.has(lineOf(f.at))) continue;
      const line = lineOf(f.at);
      // A shorthand `{ Math }` is one name read twice, as key and value.
      if (!(byLine.get(line) ?? []).some((g) => g.at === f.at)) byLine.set(line, [...(byLine.get(line) ?? []), f]);
    }
    for (const [line, found] of [...byLine].sort(([a], [b]) => a - b)) {
      const what = found.sort((a, b) => a.at - b.at).map((f) => f.what).join(', ');
      errors.push(`${path}:${line}: ${what} is not the same in every engine or run (GDD-TEC-09); use src/sim/detmath.ts, or say on the line why it never reaches a step: // sim-determinism: <reason>`);
    }
  }
  return errors;
}
