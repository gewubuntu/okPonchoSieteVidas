#!/usr/bin/env node
// Merges origin/main into the branch and renumbers what parallel streams both allocate (L-077, docs/HARNESS.md "Parallel streams"):
// the GDD version with its changelog line, and new lesson IDs.
//   node scripts/sync-main.mjs              fetch origin main, merge it, renumber, commit the merge
//   node scripts/sync-main.mjs --no-fetch   the same against the origin/main already fetched
// It never rebases (L-052). A conflict it cannot settle is left in the working tree, listed, and the merge is not committed.

import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { addedVersions } from './gdd-version.mjs';

const GDD = 'docs/GDD.md';
const LESSONS = 'docs/LESSONS.md';
const VERSION_LINE = /^Version: (\d+\.\d+\.\d+)[ \t]*$/m;
const LESSON_HEAD = /^## (L-\d{3})\b/gm;
const LESSON_ID = /\bL-(\d{3})\b/g;
const TEXT_FILE = /\.(md|ts|tsx|js|mjs|cjs|json|ya?ml|html|css|txt)$/;

// ---- GDD version ---------------------------------------------------------------

/** The `Version:` of a GDD text, or null. */
export function gddVersion(text) {
  return VERSION_LINE.exec(text)?.[1] ?? null;
}

/** Which part of the version the branch raised over its base: 'major', 'minor' or 'patch'. */
export function bumpLevel(baseVersion, ownVersion) {
  const [a, b] = [baseVersion, ownVersion].map((v) => v.split('.').map(Number));
  if (a[0] !== b[0]) return 'major';
  return a[1] !== b[1] ? 'minor' : 'patch';
}

/** The version after `version` at that level. */
export function nextVersion(version, level) {
  const [major, minor, patch] = version.split('.').map(Number);
  if (level === 'major') return `${major + 1}.0.0`;
  return level === 'minor' ? `${major}.${minor + 1}.0` : `${major}.${minor}.${patch + 1}`;
}

/**
 * The branch's GDD without its own version: the changelog lines of versions the base lacks are taken out and the `Version:`
 * line is set back to the base's, so that the head of the file merges cleanly with main's. Returns the text and those lines.
 */
export function stripOwnVersion(baseText, oursText) {
  const own = new Set(addedVersions(baseText, oursText));
  const lines = [];
  const kept = oursText.split('\n').filter((line) => {
    const v = /^- \*\*(\d+\.\d+\.\d+)\*\*/.exec(line)?.[1];
    if (v === undefined || !own.has(v)) return true;
    lines.push(line);
    return false;
  });
  const baseVersion = gddVersion(baseText);
  const text = baseVersion === null ? kept.join('\n') : kept.join('\n').replace(VERSION_LINE, `Version: ${baseVersion}`);
  return { text, lines };
}

/** Puts the branch's changelog line back at the top of the list as `version`, and sets the `Version:` line to it. */
export function insertOwnVersion(text, line, version) {
  const entry = line.replace(/^- \*\*\d+\.\d+\.\d+\*\*/, `- **${version}**`);
  const at = text.search(/^- \*\*\d+\.\d+\.\d+\*\*/m);
  if (at === -1) throw new Error('the GDD has no changelog line to put the branch\'s before');
  return (text.slice(0, at) + entry + '\n' + text.slice(at)).replace(VERSION_LINE, `Version: ${version}`);
}

// ---- lessons -------------------------------------------------------------------

/** The lesson IDs that head an entry, in file order. */
export function lessonIds(text) {
  return [...text.matchAll(LESSON_HEAD)].map((m) => m[1]);
}

const number = (id) => Number(id.slice(2));
const lessonId = (n) => `L-${String(n).padStart(3, '0')}`;

/**
 * The new IDs for the lessons the branch added, when main added lessons too: they follow main's highest, in the branch's order.
 * A Map of old ID to new ID; empty when main added none or the branch added none.
 */
export function lessonRenames(baseText, oursText, theirsText) {
  const base = new Set(lessonIds(baseText));
  const ours = lessonIds(oursText).filter((id) => !base.has(id));
  if (ours.length === 0 || !lessonIds(theirsText).some((id) => !base.has(id))) return new Map();
  let next = Math.max(...lessonIds(theirsText).map(number)) + 1;
  return new Map(ours.map((id) => [id, lessonId(next++)]));
}

/** Rewrites every cited lesson ID that `renames` has, all at once (so that a new ID which is also an old one is not renamed twice). */
export function renameLessons(text, renames) {
  return text.replace(LESSON_ID, (id) => renames.get(id) ?? id);
}

/** The lessons text without the entries of `ids` (heading to the next heading or the end), and those entries in file order. */
export function stripLessons(text, ids) {
  const heads = [...text.matchAll(LESSON_HEAD)];
  const entries = [];
  let kept = heads.length > 0 ? text.slice(0, heads[0].index) : text;
  heads.forEach((m, i) => {
    const part = text.slice(m.index, i + 1 < heads.length ? heads[i + 1].index : text.length);
    if (ids.has(m[1])) entries.push(part);
    else kept += part;
  });
  // With the last entries gone the file ends as it did before them, so main's own new entries merge onto that end.
  const last = heads.at(-1);
  return { text: last && ids.has(last[1]) ? kept.trimEnd() + '\n' : kept, entries };
}

/** Appends lesson entries to the end of the file, a blank line between entries and one newline at the end. */
export function appendLessons(text, entries) {
  return [text, ...entries].map((part) => part.trimEnd()).join('\n\n') + '\n';
}

// ---- the merge -----------------------------------------------------------------

function git(cwd, ...args) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

/** A three-way merge of texts with `git merge-file`; null when the texts conflict. */
function merge3(cwd, ours, base, theirs) {
  const dir = mkdtempSync(join(tmpdir(), 'sync-main-'));
  try {
    const paths = ['ours', 'base', 'theirs'].map((name) => join(dir, name));
    [ours, base, theirs].forEach((text, i) => writeFileSync(paths[i], text));
    const r = git(cwd, 'merge-file', '-p', ...paths);
    return r.status === 0 ? r.stdout : null;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Runs the sync in the repository at `cwd`. Returns the exit code; `log` gets each line of the report. */
export function syncMain(cwd, { fetch = true, log = console.log } = {}) {
  const show = (ref, path) => {
    const r = git(cwd, 'show', `${ref}:${path}`);
    return r.status === 0 ? r.stdout : null;
  };
  if (fetch && git(cwd, 'fetch', '--quiet', 'origin', 'main').status !== 0) {
    log('sync-main: git fetch origin main failed; nothing was merged');
    return 1;
  }
  if (git(cwd, 'status', '--porcelain').stdout.trim() !== '') {
    log('sync-main: the working tree has uncommitted changes; commit them first');
    return 1;
  }
  const base = git(cwd, 'merge-base', 'origin/main', 'HEAD').stdout.trim();
  const main = git(cwd, 'rev-parse', 'origin/main').stdout.trim();
  if (base === '' || main === '') {
    log('sync-main: no merge base with origin/main');
    return 1;
  }
  if (base === main) {
    log('sync-main: the branch already contains origin/main');
    return 0;
  }

  const [gddBase, gddOurs, gddTheirs] = [base, 'HEAD', main].map((ref) => show(ref, GDD));
  const [lesBase, lesOurs, lesTheirs] = [base, 'HEAD', main].map((ref) => show(ref, LESSONS));
  const changed = (from, to) => git(cwd, 'diff', '--name-only', from, to).stdout.split('\n').filter(Boolean);
  const oursFiles = changed(base, 'HEAD');
  const theirsFiles = new Set(changed(base, main));

  // Work out every file's new text before the merge touches the tree: a path maps to its text, or to null for a conflict
  // left to git's own markers.
  const resolved = new Map();
  const renames = lesBase && lesOurs && lesTheirs ? lessonRenames(lesBase, lesOurs, lesTheirs) : new Map();
  const moved = [...renames].filter(([from, to]) => from !== to);
  const cited = new RegExp(`\\b(${moved.map(([from]) => from).join('|')})\\b`);

  if (lesBase && lesOurs && lesTheirs && renames.size > 0) {
    // Main's new lessons take the end of the file; the branch's follow them under their new IDs.
    const stripped = stripLessons(renameLessons(lesOurs, renames), new Set(renames.values()));
    const merged = merge3(cwd, stripped.text, lesBase, lesTheirs);
    resolved.set(LESSONS, merged === null ? null : appendLessons(merged, stripped.entries));
  }

  let version = null;
  if (gddBase && gddOurs && gddTheirs && gddVersion(gddTheirs) !== gddVersion(gddBase)) {
    const stripped = stripOwnVersion(gddBase, gddOurs);
    if (stripped.lines.length === 1) {
      const from = gddVersion(gddOurs);
      const to = nextVersion(gddVersion(gddTheirs), bumpLevel(gddVersion(gddBase), from));
      const merged = merge3(cwd, moved.length > 0 ? renameLessons(stripped.text, renames) : stripped.text, gddBase, gddTheirs);
      resolved.set(GDD, merged === null ? null : insertOwnVersion(merged, moved.length > 0 ? renameLessons(stripped.lines[0], renames) : stripped.lines[0], to));
      version = { from, to };
    }
  }

  if (moved.length > 0) {
    for (const path of oursFiles) {
      if (resolved.has(path) || !TEXT_FILE.test(path)) continue;
      const ours = show('HEAD', path);
      if (ours === null || !cited.test(ours)) continue;
      const renamed = renameLessons(ours, renames);
      if (!theirsFiles.has(path)) resolved.set(path, renamed);
      else {
        const [b, t] = [show(base, path), show(main, path)];
        resolved.set(path, b === null || t === null ? null : merge3(cwd, renamed, b, t));
      }
    }
  }

  const merge = git(cwd, 'merge', '--no-commit', '--no-ff', 'origin/main');
  if (merge.status !== 0 && !/conflict/i.test(merge.stdout + merge.stderr)) {
    log(`sync-main: git merge origin/main failed: ${(merge.stderr || merge.stdout).trim()}`);
    return 1;
  }
  for (const [path, text] of resolved) {
    if (text === null) continue;
    writeFileSync(join(cwd, path), text);
    git(cwd, 'add', '--', path);
  }

  for (const [from, to] of moved) log(`sync-main: lesson ${from} is now ${to} (main took ${from})`);
  if (version && version.from !== version.to) {
    log(`sync-main: GDD version ${version.from} is now ${version.to} (main is at ${gddVersion(gddTheirs)})`);
    const mentions = oursFiles.filter((p) => p !== GDD && TEXT_FILE.test(p) && (show('HEAD', p) ?? '').includes(version.from));
    if (mentions.length > 0) log(`sync-main: ${version.from} is also written in ${mentions.join(', ')}; check those by hand`);
  }
  if (moved.length > 0 || (version && version.from !== version.to)) log('sync-main: the pull request description may name the old numbers; rewrite it (L-070)');

  // A file whose renumbered text did not merge is not left to git's own merge, which can come out clean and wrong (two
  // lessons under one ID).
  const unsettled = [...resolved].filter(([, text]) => text === null).map(([path]) => path);
  const unmerged = [...new Set([...unsettled, ...git(cwd, 'diff', '--name-only', '--diff-filter=U').stdout.split('\n').filter(Boolean)])];
  if (unmerged.length > 0) {
    log(`sync-main: conflicts left for you in ${unmerged.join(', ')}. Resolve them (renumbering by hand where this script could not), \`git add\` them and \`git commit --no-edit\`; never rebase (L-052)`);
    return 1;
  }
  const commit = git(cwd, 'commit', '--no-edit');
  if (commit.status !== 0) {
    log(`sync-main: the merge could not be committed: ${(commit.stderr || commit.stdout).trim()}`);
    return 1;
  }
  log('sync-main: merged origin/main. Read its new GDD changelog lines, then run the gate and the touched playtests (L-052)');
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const top = spawnSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' });
  if (top.status !== 0) {
    console.error('sync-main: not in a git repository');
    process.exit(1);
  }
  process.exit(syncMain(top.stdout.trim(), { fetch: !process.argv.includes('--no-fetch') }));
}

