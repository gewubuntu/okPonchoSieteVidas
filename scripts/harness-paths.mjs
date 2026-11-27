// harness-paths: a repository path that a harness file or the design documents name in backticks must exist, so a renamed
// or deleted file cannot leave a sentence pointing at nothing (L-013: "checked by" a test that moved). The gate runs it over
// CLAUDE.md, the skills and the subagents, and over docs/GDD.md (its changelog aside, which is history) and docs/BACKLOG.md.
// In the two documents a file that is designed and not built yet is marked ` (planned)` right after its backticks; the
// mark fails once the path exists, so "planned" cannot outlive the build.
import { spawnSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { isAbsolute, join, posix, relative, sep } from 'node:path';

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

/**
 * The paths among `paths` that git ignores. The gate counts them as missing: a build output on this disk (`server/dist/`
 * after a build) is not in a fresh checkout, as CI's is, so a sentence naming it passed here and failed there (L-083).
 * `checkIgnore(input)` runs `git check-ignore -z --stdin` with the paths each ended by a NUL, so git neither quotes nor escapes
 * them, and gives `{ status, stdout }`: status 0 when some are ignored, each written back as given and ended by a NUL; 1 when none
 * is; any other (git refused a path, or there is no git) says nothing of the rest. A path that leaves the repository once its `..`
 * are read is not asked, since git refuses it and with it every path asked at once; one git refuses for another reason (beyond a
 * symbolic link, in a submodule) makes each path be asked alone. A path git says nothing of is not ignored.
 */
/**
 * What a named path reaches in the repository at `root`, following any symbolic link on the way, as a path from the root
 * (`/`-separated, its trailing `/` kept); null when nothing is there, or what is there lies outside the repository. A fresh checkout
 * has what a link reaches only where git keeps that, so the gate judges the path reached, not the text that names it (L-083).
 */
export const realIn = (root) => {
  const base = realpathSync(root);
  return (path) => {
    let reached;
    try {
      reached = realpathSync(join(root, path));
    } catch {
      return null;
    }
    const from = relative(base, reached);
    // Above the root, or on another drive: outside. (`isAbsolute` cannot hold on POSIX, where `relative` gives no absolute path.)
    if (from.split(sep)[0] === '..' || isAbsolute(from)) return null;
    // The root itself is there, as a fresh checkout has it.
    const real = from === '' ? '.' : from.split(sep).join('/');
    return path.endsWith('/') ? `${real}/` : real;
  };
};

/**
 * Whether `path` stays in the repository once its `.` and `..` are read. A named path starts with one of the roots, so it may leave
 * only upward, never be absolute (L-025).
 */
export const inRepository = (path) => {
  const read = posix.normalize(path);
  return read !== '..' && !read.startsWith('../');
};

export function ignoredAmong(paths, checkIgnore) {
  const unique = [...new Set(paths)].filter(inRepository);
  if (unique.length === 0) return new Set();
  const ask = (some) => {
    const r = checkIgnore(`${some.join('\0')}\0`);
    if (r.status === 0) return r.stdout.split('\0').filter((p) => some.includes(p));
    return r.status === 1 ? [] : null;
  };
  return new Set(ask(unique) ?? unique.flatMap((p) => ask([p]) ?? []));
}

/** The `checkIgnore` the gate gives `ignoredAmong`: the git of the repository at `root`. */
export const gitCheckIgnore = (root) => (input) => spawnSync('git', ['check-ignore', '-z', '--stdin'], { cwd: root, input, encoding: 'utf8' });

/**
 * The `holdsFiles` the gate gives `presentWhen`: whether the folder `path` holds a file git tracks or would track (one not ignored)
 * in the repository at `root`. Where git cannot say, the folder is taken to hold one, so the check only ever fails on git's word.
 */
export const gitHoldsFiles = (root) => (path) => {
  const r = spawnSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z', '--', path], { cwd: root, encoding: 'utf8' });
  return r.status !== 0 || r.stdout.length > 0;
};

/**
 * Whether a named path is there as a fresh checkout has it: inside the repository (one beside it on this disk is in no checkout), on
 * this disk, not among the `ignored`, and, for a folder, holding a file git keeps, since a fresh checkout has no empty folder and none
 * of ignored files only (L-083).
 */
export const presentWhen = (exists, ignored, isFolder = () => false, holdsFiles = () => true) => (p) => inRepository(p) && exists(p) && !ignored.has(p) && (!isFolder(p) || holdsFiles(p));

/** The first and last line index of the list under `## Changelog`, or null: the lines up to the next heading of level 1 or 2 or a `---` rule. */
export function changelogRange(lines) {
  const start = lines.findIndex((l) => /^## Changelog\s*$/.test(l));
  if (start < 0) return null;
  let end = start;
  while (end + 1 < lines.length && !/^(#{1,2}\s|---\s*$)/.test(lines[end + 1])) end++;
  return { start, end };
}
