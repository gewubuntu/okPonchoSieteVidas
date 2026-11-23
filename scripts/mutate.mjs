#!/usr/bin/env node
// Mutation runner (L-010, L-020). Zero dependencies.
//   node scripts/mutate.mjs <mutants.json>   run each mutant and report whether a test went red
//   node scripts/mutate.mjs --restore        put back a file left mutated by an interrupted run
//   node scripts/mutate.mjs --suggest [base] print a mutants file for the lines changed since the merge base with `base`
//                                            (origin/main unless given): a bound moved and a clause dropped for each one
//                                            (scripts/mutant-suggest.mjs, L-010). Its mutants name no test: give each one.
// mutants.json: { "test": "<shell command>", "timeout"?: <seconds>, "mutants": [{ "name": "...", "file": "src/...", "from": "...", "to": "...", "test"?: "..." }] }
// A mutant's test is stopped after `timeout` seconds (600 unless given): a mutant that makes a loop endless would hang the
// whole run (L-064). A stopped mutant is not caught: bound the loop and run it again.
// A mutant's own `test` replaces the file's, so each mutant can run against the one test that must kill it (L-026).
// `from` must occur exactly once in the file. Before each mutant the original is saved to .mutating.json; it is put back
// after the mutant, and the marker deleted. If the run is killed the marker stays, and scripts/check.mjs fails until
// `--restore` has run, so a mutation can never be committed.

import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

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
  const { changedLines, covered, suggest } = await import('./mutant-suggest.mjs');
  const git = (...args) => spawnSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28 });
  const base = git('merge-base', process.argv[suggestArg + 1] ?? 'origin/main', 'HEAD');
  if (base.status !== 0) {
    console.error('no merge base to compare with: run `git fetch origin main`, or name a base');
    process.exit(2);
  }
  // Against the working tree, so lines not committed yet are read too.
  const diff = git('diff', '-U0', '--no-color', base.stdout.trim(), '--', 'src', 'server', 'scripts').stdout;
  const changed = changedLines(diff);
  // A file git does not track yet is new from its first line to its last.
  for (const path of git('ls-files', '--others', '--exclude-standard', '--', 'src', 'server', 'scripts').stdout.split('\n').filter(Boolean)) {
    changed.set(path, new Set(readFileSync(join(ROOT, path), 'utf8').split('\n').map((_, i) => i + 1)));
  }
  const mutants = [...changed].filter(([path]) => covered(path) && existsSync(join(ROOT, path)))
    .flatMap(([path, lines]) => suggest(path, readFileSync(join(ROOT, path), 'utf8'), lines));
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
const { test, mutants, timeout = 600 } = JSON.parse(readFileSync(spec, 'utf8'));
let survived = 0;
for (const m of mutants) {
  const path = join(ROOT, m.file);
  const original = readFileSync(path, 'utf8');
  // A mutant with no test of its own and none for the file (as --suggest writes them) is not run: an empty command would
  // fail, and the runner counts any failure as a kill.
  if (!(m.test ?? test)) {
    console.log(`NO TEST ${m.name}: name the one test that must kill it`);
    survived++;
    continue;
  }
  if (original.split(m.from).length !== 2) {
    console.log(`SKIP  ${m.name}: the text is not in ${m.file} exactly once`);
    survived++;
    continue;
  }
  writeFileSync(MARKER, JSON.stringify({ file: m.file, original }));
  try {
    writeFileSync(path, original.replace(m.from, () => m.to));
    // PONCHO_MUTATING tells scripts/check.mjs not to fail on this run's own marker, so the gate can be a mutant's test.
    const r = spawnSync(m.test ?? test, { cwd: ROOT, shell: true, encoding: 'utf8', maxBuffer: 1 << 28, timeout: timeout * 1000, killSignal: 'SIGKILL', env: { ...process.env, PONCHO_MUTATING: '1' } });
    // A test filter that matches nothing fails the run too (Playwright exits 1 on "No tests found", Vitest on a missing
    // file). No test went red, so the mutant is not caught (L-034: each mutant names the one test that must kill it).
    const noTest = /No tests found|No test files found/.test(`${r.stdout}${r.stderr}`);
    const caught = r.status !== 0 && !r.error && !noTest;
    if (!caught) survived++;
    const stopped = r.error?.code === 'ETIMEDOUT';
    console.log(`${stopped ? `STOPPED after ${timeout} s (an endless loop? bound it and run again)` : noTest ? 'NO TEST (the filter matched none)' : caught ? 'RED  ' : 'GREEN (survived)'} ${m.name}`);
  } finally {
    restore();
  }
}
console.log(survived === 0 ? '\nEvery mutant was caught.' : `\n${survived} mutant(s) survived or were skipped.`);
process.exit(survived === 0 ? 0 : 1);
