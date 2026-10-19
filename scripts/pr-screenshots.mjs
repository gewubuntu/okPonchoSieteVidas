#!/usr/bin/env node
// Warns when a pull request changes what the player sees but adds no screenshots.
//   node scripts/pr-screenshots.mjs [base-ref]     default base: origin/main
// Visible code is anything under src/scenes or src/ui (tests excluded), index.html and art under assets/.
// Approved screenshots live in docs/screenshots/<slug>/ (see CLAUDE.md). Warns only; it never fails.

import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const VISIBLE = /^(src\/(scenes|ui)\/(?!.*\.test\.)|index\.html$|assets\/(?!.*README))/;
const SHOTS = /^docs\/screenshots\/.+\.(png|jpe?g|gif|webp)$/;

/** Splits a list of changed files into visible changes and screenshot files. */
export function classify(files) {
  return {
    visible: files.filter((f) => VISIBLE.test(f)),
    shots: files.filter((f) => SHOTS.test(f)),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const base = process.argv[2] ?? 'origin/main';
  const r = spawnSync('git', ['diff', '--name-only', `${base}...HEAD`], { encoding: 'utf8' });
  if (r.status !== 0) {
    console.error(`pr-screenshots: git diff against ${base} failed: ${r.stderr.trim()}`);
    process.exit(0);
  }
  const { visible, shots } = classify(r.stdout.split('\n').filter(Boolean));
  if (visible.length > 0 && shots.length === 0) {
    console.log(
      `::warning title=Visible change without screenshots::${visible.length} visible file(s) changed (${visible[0]}${visible.length > 1 ? ', ...' : ''}) but no image was added under docs/screenshots/. Show the user screenshots, get approval, then commit them.`,
    );
  } else {
    console.log(`pr-screenshots: ${visible.length} visible file(s), ${shots.length} screenshot(s). OK.`);
  }
}
