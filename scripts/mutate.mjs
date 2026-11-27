#!/usr/bin/env node
// Mutation runner (L-010, L-020). Zero dependencies.
//   node scripts/mutate.mjs <mutants.json>   run each mutant and report whether a test went red
//   node scripts/mutate.mjs --restore        put back a file left mutated by an interrupted run
//   node scripts/mutate.mjs --suggest [base] print a mutants file for the lines changed since the merge base with `base`
//                                            (origin/main unless given): a bound moved and a clause dropped for each one
//                                            (scripts/mutant-suggest.mjs, L-010). Its mutants name no test: give each one.
// mutants.json: { "test": "<shell command>", "timeout"?: <seconds>, "mutants": [{ "name": "...", "file": "src/...", "from": "...", "to": "...", "test"?: "..." }] }
// A mutant's test is stopped after `timeout` seconds (300 unless given), with its process group (scripts/run-limited.mjs):
// a mutant that makes a loop endless would hang the whole run (L-064). A stopped mutant is not caught: bound the loop and
// run it again. Nor is a mutant whose red run reports more than one test (RAN MORE, `mutantVerdict` in scripts/run-limited.mjs):
// it made the filter match others than the one test it names, as by renaming tests or building them from its data (L-026).
// A mutant's own `test` replaces the file's, so each mutant can run against the one test that must kill it (L-026). Each command
// is first run once on the unmutated code: one that fails there, finds no test, or runs other than one test by its Vitest or
// Playwright summary is refused, reported REFUSED and its mutants counted as not caught, since a run of more counts a kill by any
// test in it (`baselineProblem` in scripts/run-limited.mjs). One that reports no tests (a check script; the gate prints its test
// runs' summaries) is taken as it stands, unless it runs a test runner, by name or through a package script however npm, pnpm,
// yarn, bun or node --run is asked for it (`namesTestRunner`), whose summary must then be read. Three limits of the summary: one printed
// twice (two reporters, a test whose own output holds summary lines) counts twice and is refused; a Vitest test that skips
// itself after its checks (`ctx.skip()`) counts as not run, as the summary does not tell it from a test the filter left out; and
// a playtest filter that also matches a skipped test counts it, as Playwright's `Running N tests` does, and is refused.
// `from` must occur exactly once in the file, and the file must still parse with the mutant in it (L-103). Before each mutant the original is saved to .mutating.json; it is put back
// after the mutant, and the marker deleted. If the run is killed the marker stays, and scripts/check.mjs fails until
// `--restore` has run, so a mutation can never be committed.

import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { breaksSyntax, occurrences } from './mutant-suggest.mjs';
import { baselineProblem, mutantVerdict, runLimited, testsRun } from './run-limited.mjs';

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
/** Each test command's run on the unmutated code: null when it may be a mutant's test, or why not. */
const baselines = new Map();
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
  const mutated = original.replace(m.from, () => m.to);
  if (breaksSyntax(m.file, original, mutated)) {
    console.log(`BROKEN ${m.name}: the mutant does not parse, so any test goes red on it (L-103); write one that does`);
    survived++;
    continue;
  }
  // On the unmutated code, once for each command: every file is as it was, the last mutant put back.
  if (!baselines.has(m.test ?? test)) {
    const problem = baselineProblem(await runLimited(m.test ?? test, { cwd: ROOT, env: process.env, seconds: timeout }), m.test ?? test);
    baselines.set(m.test ?? test, problem);
    console.log(problem === null ? `BASELINE ok: ${m.test ?? test}` : `BASELINE ${problem}: ${m.test ?? test}`);
  }
  if (baselines.get(m.test ?? test) !== null) {
    console.log(`REFUSED ${m.name}: its test ${baselines.get(m.test ?? test)} (L-026)`);
    survived++;
    continue;
  }
  writeFileSync(MARKER, JSON.stringify({ file: m.file, original }));
  try {
    writeFileSync(path, mutated);
    // PONCHO_MUTATING tells scripts/check.mjs not to fail on this run's own marker, so the gate can be a mutant's test.
    const r = await runLimited(m.test ?? test, { cwd: ROOT, env: { ...process.env, PONCHO_MUTATING: '1' }, seconds: timeout });
    const says = mutantVerdict(r);
    if (says !== 'caught') survived++;
    const shown = { 'not started': 'NOT RUN (the test command could not be started)', stopped: `STOPPED after ${timeout} s (an endless loop? bound it and run again)`, 'no test': 'NO TEST (the filter matched none)', 'ran more': `RAN MORE (red, but it reports ${testsRun(r.output)} tests on the mutant, not the one it names: not counted)`, caught: 'RED  ', survived: 'GREEN (survived)' };
    console.log(`${shown[says]} ${m.name}`);
  } finally {
    restore();
  }
}
console.log(survived === 0 ? '\nEvery mutant was caught.' : `\n${survived} mutant(s) survived or were skipped.`);
process.exit(survived === 0 ? 0 : 1);
