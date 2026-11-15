#!/usr/bin/env node
// The art lineup (L-066): every sprite sheet in a folder on one image, at the same scale, each named, so new art is judged beside the
// approved art it must match (profile, proportions, shading depth, outline, face) before the user sees it.
//   node scripts/art-lineup.mjs <folder of sheets> <out.png> [--zoom N]
// e.g. node scripts/art-lineup.mjs assets/sprites/enemies "$SCRATCH/lineup.png"
// Writes a PNG outside the repository's committed folders; look at it, then send it with the art.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';

/** The HTML of the lineup: one labelled row per sheet, in name order, each scaled by `zoom` with no smoothing. */
export function lineupHtml(sheets, zoom = 1) {
  const rows = [...sheets]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((s) => `<div class="name">${s.name}</div><img src="data:image/png;base64,${s.png.toString('base64')}" style="zoom:${zoom}">`)
    .join('');
  return `<!doctype html><html><body style="margin:0;background:#3a3350;font:14px monospace;color:#fff">
<div id="sheet" style="padding:12px;width:max-content">${rows}</div>
<style>.name{margin:8px 0 4px}img{display:block;image-rendering:pixelated}</style></body></html>`;
}

async function main() {
  const [dir, out, ...rest] = process.argv.slice(2);
  if (!dir || !out) {
    console.error('usage: node scripts/art-lineup.mjs <folder of sheets> <out.png> [--zoom N]');
    process.exit(2);
  }
  const zi = rest.indexOf('--zoom');
  const zoom = zi >= 0 ? Number(rest[zi + 1]) : 1;
  const sheets = readdirSync(dir)
    .filter((f) => f.endsWith('.png'))
    .map((f) => ({ name: f.replace(/\.png$/, ''), png: readFileSync(join(dir, f)) }));
  if (sheets.length === 0) {
    console.error(`no sheets in ${dir}`);
    process.exit(1);
  }
  // The same browser as playwright.config.ts and scripts/overview.mjs: the cloud environment ships Chromium.
  const preinstalled = '/opt/pw-browsers/chromium';
  const executablePath = process.env['PLAYWRIGHT_CHROMIUM_PATH'] || (existsSync(preinstalled) ? preinstalled : undefined);
  const browser = await chromium.launch(executablePath ? { executablePath } : {});
  const page = await browser.newPage();
  await page.setContent(lineupHtml(sheets, zoom));
  await page.locator('#sheet').screenshot({ path: out });
  await browser.close();
  console.log(`${out}: ${sheets.length} sheets`);
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
