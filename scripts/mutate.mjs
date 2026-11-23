#!/usr/bin/env node
// Mutation runner (L-010, L-020). Zero dependencies.
//   node scripts/mutate.mjs <mutants.json>   run each mutant and report whether a test went red
//   node scripts/mutate.mjs --restore        put back a file left mutated by an interrupted run
//   node scripts/mutate.mjs --suggest [base] print a mutants file for the lines changed since the merge base with `base`
//                                            (origin/main unless given): a bound moved and a clause dropped for each one
//                                            (scripts/mutant-suggest.mjs, L-010). Its mutants name no test: give each one.
// mutants.json: { "test": "<shell command>", "timeout"?: <seconds>, "mutants": [{ "name": "...", "file": "src/...", "from": "...", "to": "...", "test"?: "..." }] }
// A mutant's test is stopped after `timeout` seconds (300 unless given), with everything it started (scripts/run-limited.mjs):
// a mutant that makes a loop endless would hang the whole run (L-064). A stopped mutant is not caught: bound the loop and
// run it again.
// A mutant's own `test` replaces the file's, so each mutant can run against the one test that must kill it (L-026).
// `from` must occur exactly once in the file. Before each mutant the original is saved to .mutating.json; it is put back
// after the mutant, and the marker deleted. If the run is killed the marker stays, and scripts/check.mjs fails until
// `--restore` has run, so a mutation can never be committed.

import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { occurrences } from './mutant-suggest.mjs';
import { runLimited } from './run-limited.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const MARKER = join(ROOT, '.mutating.json');

function restore() {
  if (!existsSync(MARKER)) return false;
  const { file, original } = JSON.parse(readFileSync(MARKER, 'utf8'));
  writeFileSync(join(ROOT, file), original);
  rmSync(MARKER);
  console.log(`restored ${file}`);
  return true;
}

if (process.argv.includes('--restore')) {
  if (!restore()) console.log('nothing to restore');
  process.exit(0);
}

const suggestArg = process.argv.indexOf('--suggest');
if (suggestArg !== -1) {
  const { changedCode, suggest } = await import('./mutant-suggest.mjs');
  const git = (...args) => spawnSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28 });
  const read = (path) => readFileSync(join(ROOT, path), 'utf8');
  const changed = changedCode(git, read, process.argv[suggestArg + 1]);
  if (changed === null) {
    console.error('no merge base to compare with: run `git fetch origin main`, or name a base');
    process.exit(2);
  }
  const mutants = [...changed].flatMap(([path, lines]) => suggest(path, read(path), lines));
  console.log(JSON.stringify({ mutants }, null, 1));
  console.error(`${mutants.length} mutant(s) suggested. Give each its "test" (the one command that must go red), or take it out and say why it changes nothing.`);
  process.exit(0);
}

const spec = process.argv[2];
if (!spec) {
  console.error('usage: node scripts/mutate.mjs <mutants.json> | --restore | --suggest [base]');
  process.exit(2);
}
if (existsSync(MARKER)) {
  console.error('.mutating.json exists: an earlier run was interrupted. Run node scripts/mutate.mjs --restore first.');
  process.exit(2);
}
const { test, mutants, timeout = 300 } = JSON.parse(readFileSync(spec, 'utf8'));
let survived = 0;
for (const m of mutants) {
  const path = join(ROOT, m.file);
  const original = readFileSync(path, 'utf8');
  // A mutant with no test of its own and none for the file (as --suggest writes them) is not run: it has no command to run.
  if (!(m.test ?? test)) {
    console.log(`NO TEST ${m.name}: name the one test that must kill it`);
    survived++;
    continue;
  }
  if (occurrences(original, m.from) !== 1) {
    console.log(`SKIP  ${m.name}: the text is not in ${m.file} exactly once`);
    survived++;
    continue;
  }
  writeFileSync(MARKER, JSON.stringify({ file: m.file, original }));
  try {
    writeFileSync(path, original.replace(m.from, () => m.to));
    // PONCHO_MUTATING tells scripts/check.mjs not to fail on this run's own marker, so the gate can be a mutant's test.
    const r = await runLimited(m.test ?? test, { cwd: ROOT, env: { ...process.env, PONCHO_MUTATING: '1' }, seconds: timeout });
    // A test filter that matches nothing fails the run too (Playwright exits 1 on "No tests found", Vitest on a missing
    // file). No test went red, so the mutant is not caught (L-034: each mutant names the one test that must kill it).
    const noTest = /No tests found|No test files found/.test(r.output);
    const caught = r.status !== 0 && !r.stopped && !noTest;
    if (!caught) survived++;
    console.log(`${r.stopped ? `STOPPED after ${timeout} s (an endless loop? bound it and run again)` : noTest ? 'NO TEST (the filter matched none)' : caught ? 'RED  ' : 'GREEN (survived)'} ${m.name}`);
  } finally {
    restore();
  }
}
console.log(survived === 0 ? '\nEvery mutant was caught.' : `\n${survived} mutant(s) survived or were skipped.`);
process.exit(survived === 0 ? 0 : 1);
