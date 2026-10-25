#!/usr/bin/env node
// The PR overview sheet (L-031): every screenshot in a docs/screenshots/<slug>/ folder on one image, each file name under it.
//   node scripts/overview.mjs docs/screenshots/<slug>
// Writes <folder>/overview.png from the committed screenshots only (never from shots/). Look at it before committing.

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';

const dir = process.argv[2];
if (!dir) {
  console.error('usage: node scripts/overview.mjs docs/screenshots/<slug>');
  process.exit(2);
}
const files = readdirSync(dir)
  .filter((f) => f.endsWith('.png') && f !== 'overview.png')
  .sort();
if (files.length === 0) {
  console.error(`no screenshots in ${dir}`);
  process.exit(1);
}

const COLUMNS = 2;
const WIDTH = 640; // each image is scaled to this width
const cells = files
  .map((f) => `<figure><img src="data:image/png;base64,${readFileSync(join(dir, f)).toString('base64')}"><figcaption>${f}</figcaption></figure>`)
  .join('');
const html = `<!doctype html><html><body style="margin:0;background:#1b1e2e;font:14px monospace;color:#e6e6e6">
<div id="sheet" style="display:grid;grid-template-columns:repeat(${COLUMNS},${WIDTH}px);gap:16px;padding:16px;width:max-content;align-items:start">${cells}</div>
<style>figure{margin:0}img{width:${WIDTH}px;display:block}figcaption{padding:4px 0}</style></body></html>`;

// The same browser as playwright.config.ts: the cloud environment ships Chromium, so do not download one there.
const preinstalled = '/opt/pw-browsers/chromium';
const executablePath = process.env['PLAYWRIGHT_CHROMIUM_PATH'] || (existsSync(preinstalled) ? preinstalled : undefined);
const browser = await chromium.launch(executablePath ? { executablePath } : {});
const page = await browser.newPage();
await page.setContent(html);
const png = await page.locator('#sheet').screenshot();
await browser.close();
writeFileSync(join(dir, 'overview.png'), png);
console.log(`${join(dir, 'overview.png')}: ${files.length} screenshots`);
