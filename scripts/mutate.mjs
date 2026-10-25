#!/usr/bin/env node
// Mutation runner (L-010, L-020). Zero dependencies.
//   node scripts/mutate.mjs <mutants.json>   run each mutant and report whether a test went red
//   node scripts/mutate.mjs --restore        put back a file left mutated by an interrupted run
// mutants.json: { "test": "<shell command>", "mutants": [{ "name": "...", "file": "src/...", "from": "...", "to": "...", "test"?: "..." }] }
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

const spec = process.argv[2];
if (!spec) {
  console.error('usage: node scripts/mutate.mjs <mutants.json> | --restore');
  process.exit(2);
}
if (existsSync(MARKER)) {
  console.error('.mutating.json exists: an earlier run was interrupted. Run node scripts/mutate.mjs --restore first.');
  process.exit(2);
}
const { test, mutants } = JSON.parse(readFileSync(spec, 'utf8'));
let survived = 0;
for (const m of mutants) {
  const path = join(ROOT, m.file);
  const original = readFileSync(path, 'utf8');
  if (original.split(m.from).length !== 2) {
    console.log(`SKIP  ${m.name}: the text is not in ${m.file} exactly once`);
    survived++;
    continue;
  }
  writeFileSync(MARKER, JSON.stringify({ file: m.file, original }));
  try {
    writeFileSync(path, original.replace(m.from, () => m.to));
    // PONCHO_MUTATING tells scripts/check.mjs not to fail on this run's own marker, so the gate can be a mutant's test.
    const r = spawnSync(m.test ?? test, { cwd: ROOT, shell: true, stdio: 'ignore', env: { ...process.env, PONCHO_MUTATING: '1' } });
    if (r.status === 0) survived++;
    console.log(`${r.status === 0 ? 'GREEN (survived)' : 'RED  '} ${m.name}`);
  } finally {
    restore();
  }
}
console.log(survived === 0 ? '\nEvery mutant was caught.' : `\n${survived} mutant(s) survived or were skipped.`);
process.exit(survived === 0 ? 0 : 1);
