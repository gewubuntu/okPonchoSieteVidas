#!/usr/bin/env node
// Warns when a pull request is larger than the small-PR guideline in CLAUDE.md.
//   node scripts/pr-size.mjs [base-ref]     default base: origin/main
// Counts added plus deleted lines against the merge base, ignoring lockfiles. Warns only; it never fails.

import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export const LIMIT = 300;
const IGNORED = new Set(['package-lock.json']);

/** Sums added and deleted lines from `git diff --numstat` output. Binary files ("-") count as 0. */
export function countChangedLines(numstat) {
  let total = 0;
  for (const line of numstat.split('\n')) {
    const [added, deleted, file] = line.split('\t');
    if (!file || IGNORED.has(file)) continue;
    total += (Number(added) || 0) + (Number(deleted) || 0);
  }
  return total;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const base = process.argv[2] ?? 'origin/main';
  const r = spawnSync('git', ['diff', '--numstat', `${base}...HEAD`], { encoding: 'utf8' });
  if (r.status !== 0) {
    console.error(`pr-size: git diff against ${base} failed: ${r.stderr.trim()}`);
    process.exit(0);
  }
  const total = countChangedLines(r.stdout);
  if (total > LIMIT) {
    console.log(`::warning title=Large pull request::${total} changed lines (guideline is about ${LIMIT}, lockfiles excluded). Consider splitting it.`);
  } else {
    console.log(`pr-size: ${total} changed lines, within the guideline of ${LIMIT}.`);
  }
}
