// harness-paths: a repository path that a harness file or the design documents name in backticks must exist, so a renamed
// or deleted file cannot leave a sentence pointing at nothing (L-013: "checked by" a test that moved). The gate runs it over
// CLAUDE.md, the skills and the subagents, and over docs/GDD.md (its changelog aside, which is history) and docs/BACKLOG.md.
// In the two documents a file that is designed and not built yet is marked ` (planned)` right after its backticks; the
// mark fails once the path exists, so "planned" cannot outlive the build.

const ROOTS = /^(src|server|e2e|scripts|docs|assets|\.claude|\.github)\//;
const PLANNED = ' (planned)';

/** The repository paths a line names in backticks, each with whether its span is marked ` (planned)`. A placeholder such as `docs/screenshots/<slug>/` is no path. */
export function pathsIn(line) {
  const found = [];
  for (const m of line.matchAll(/`([^`]+)`/g)) {
    const planned = line.startsWith(PLANNED, m.index + m[0].length);
    for (const word of m[1].split(/\s+/)) {
      const path = word.replace(/^["'(]+|["'),.:;]+$/g, '').replace(/:\d+(-\d+)?$/, '');
      if (!ROOTS.test(path) || /[<>*{}$]/.test(path)) continue;
      found.push({ path, planned });
    }
  }
  return found;
}

/**
 * The error strings for one file's text. `exists(path)` says whether a repository path exists. `planned` says whether the
 * file may mark paths ` (planned)` (the design documents may, the harness files may not: there a missing path always fails).
 * `skip(i)` is true for a line index the check leaves alone (the GDD's changelog).
 */
export function pathErrors(file, text, exists, { planned = false, skip = () => false } = {}) {
  const errors = [];
  text.split('\n').forEach((line, i) => {
    if (skip(i)) return;
    for (const p of pathsIn(line)) {
      const there = exists(p.path);
      if (planned && p.planned) {
        if (there) errors.push(`${file}:${i + 1}: \`${p.path}\` is marked (planned) but exists; remove the mark and say what is built`);
      } else if (!there) {
        errors.push(`${file}:${i + 1}: \`${p.path}\` does not exist; fix the text that names it${planned ? ', or mark a file that is designed and not built yet with " (planned)" right after its backticks' : ''}`);
      }
    }
  });
  return errors;
}

/** The first and last line index of the list under `## Changelog`, or null: the lines up to the next heading of level 1 or 2 or a `---` rule. */
export function changelogRange(lines) {
  const start = lines.findIndex((l) => /^## Changelog\s*$/.test(l));
  if (start < 0) return null;
  let end = start;
  while (end + 1 < lines.length && !/^(#{1,2}\s|---\s*$)/.test(lines[end + 1])) end++;
  return { start, end };
}
