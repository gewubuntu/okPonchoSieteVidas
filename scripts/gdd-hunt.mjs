// gdd-hunt (L-013, L-053): the stale-sentence hunt's search, done the same way every time. From the sections a branch changed
// (and any IDs and terms the author adds: a feature's ID, a level's name, an old number) it lists the sentences to read, in
// the GDD (its changelog aside), the backlog and the harness files (CLAUDE.md, docs/HARNESS.md, .claude/): outside the changed sections those that name a changed
// ID or hold a term, with the status-word sentences on their line; inside them those with a status word or a term. It finds
// where to read; whether a sentence is now false still takes reading it.
//   node scripts/check.mjs --gdd-hunt [GDD-XXX-NN,...] [term,...]

import { idsIn } from './gdd-version.mjs';

/** Words that say what is built, drawn or decided so far: the sentences a change most often leaves false. */
export const STATUS_WORDS = /\b(yet|so far|only|not built|built for|checked by|to come|to be|pending|stand-in|placeholder|until|still)\b/i;

/** A line's sentences: split after a full stop, question or exclamation mark (and a closing bracket or quote after it) before a capital, a quote, a bracket, a backtick or bold. */
export function sentences(line) {
  return line.split(/(?<=[.!?][)"']?)\s+(?=[A-Z("'`*])/).map((s) => s.trim()).filter(Boolean);
}

/**
 * For each line of a document, the ID of the part it belongs to, or null: in the GDD the `### GDD-XXX-NN` section (to the
 * next heading of level 1 to 3 or `---` rule), in the backlog the row's own ID.
 */
export function ownerOf(lines) {
  let id = null;
  return lines.map((line) => {
    const row = /^\| (GDD-[A-Z]+-\d+) \|/.exec(line);
    if (row) return row[1];
    if (/^(#{1,3}\s|---\s*$)/.test(line)) id = /^### (GDD-[A-Z]+-\d+)\b/.exec(line)?.[1] ?? null;
    return id;
  });
}

/** A term as a pattern: the text itself, case ignored, as a whole word where it starts or ends with a letter or a digit ("top" is not in "stop"). */
export function termPattern(term) {
  const text = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`${/^\w/.test(term) ? '\\b' : ''}${text}${/\w$/.test(term) ? '\\b' : ''}`, 'i');
}

/**
 * The sentences to read. `ids` are the changed sections, `terms` plain texts to search for, `files` a list of
 * `{ name, text, skip }` where `skip(i)` leaves line `i` out (the changelog). A term that starts with `in:` is searched
 * inside the changed sections only: a position word such as "left" or "top" is in hundreds of sentences elsewhere.
 * - Outside the changed sections (and outside a changed ID's own backlog row) a sentence is listed when it names one of
 *   `ids` or holds a term, and so is every sentence with a status word on the same line: "none of it is in code yet"
 *   seldom repeats the ID the sentence before it named.
 * - Inside them a sentence is listed when it carries a status word or holds a term, never for naming an ID.
 * Each result is `{ file, line, owner, text, status }`; `status` is whether it carries a status word. Sentences with one
 * come first, then file and line order.
 */
export function hunt({ ids, terms = [], files }) {
  const found = [];
  const want = new Set(ids);
  const words = terms.filter((t) => t && t !== 'in:').map((t) => (t.startsWith('in:') ? { pattern: termPattern(t.slice(3)), insideOnly: true } : { pattern: termPattern(t), insideOnly: false }));
  for (const { name, text, skip = () => false } of files) {
    const lines = text.split('\n');
    const owners = ownerOf(lines);
    lines.forEach((line, i) => {
      if (skip(i)) return;
      const inside = want.has(owners[i]);
      const parts = sentences(line).map((sentence) => ({
        sentence,
        status: STATUS_WORDS.test(sentence),
        named: idsIn(sentence).some((id) => want.has(id)),
        term: words.some((w) => (inside || !w.insideOnly) && w.pattern.test(sentence)),
      }));
      const hit = parts.some((p) => p.named || p.term);
      for (const p of parts) {
        if (p.term || (inside ? p.status : p.named || (hit && p.status))) found.push({ file: name, line: i + 1, owner: owners[i], text: p.sentence, status: p.status });
      }
    });
  }
  return [...found.filter((f) => f.status), ...found.filter((f) => !f.status)];
}

/** One result as a line of the report: `! file:line [owner] text`, the text cut to `width` characters. */
export function reportLine(f, width = 300) {
  const text = f.text.length <= width ? f.text : `${f.text.slice(0, width - 1)}…`;
  return `${f.status ? '!' : ' '} ${f.file}:${f.line}${f.owner ? ` [${f.owner}]` : ''} ${text}`;
}
