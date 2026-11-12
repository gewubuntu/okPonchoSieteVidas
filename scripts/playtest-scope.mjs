#!/usr/bin/env node
// Tells CI whether a pull request needs the playtests (L-077): one that changes only documents does not, since no playtest reads
// them. The gate always runs.
//   node scripts/playtest-scope.mjs [base-ref]     prints `playtests=true` or `playtests=false`; default base: origin/main
// When unsure (no base, a failed diff, nothing changed) the answer is true.

import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

// Markdown anywhere (the GDD, the backlog, lessons, skills, agents) and everything under docs/ (approved screenshots too).
const DOCUMENT = /^docs\/|\.md$/;

/** Does a change to these files need the playtests? Only a list made up of documents alone does not. */
export function needsPlaytests(files) {
  return files.length === 0 || files.some((f) => !DOCUMENT.test(f));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const base = process.argv[2] ?? 'origin/main';
  const r = spawnSync('git', ['diff', '--name-only', `${base}...HEAD`], { encoding: 'utf8' });
  const needed = r.status !== 0 || needsPlaytests(r.stdout.split('\n').filter(Boolean));
  console.log(`playtests=${needed}`);
}
