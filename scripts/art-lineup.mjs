#!/usr/bin/env node
// The art lineup (L-066): new art on one image beside the approved art it must match and the user's references, so it is judged against its
// neighbours (silhouette, profile, proportions, shading depth, pattern, outline, face) before the user sees it.
//   node scripts/art-lineup.mjs <out.png> <folder or file>... [--zoom N]
// Each folder adds its .png sheets and its .jpg/.jpeg references; a file adds itself. Sheets are drawn at their own size times the zoom, pixels
// unsmoothed (the game's scale); references, drawn by hand or photographed at any size, are scaled to REF_HEIGHT px times the zoom.
// e.g. node scripts/art-lineup.mjs "$SCRATCH/lineup.png" assets/sprites/enemies
//      node scripts/art-lineup.mjs "$SCRATCH/lineup.png" assets/sprites/poncho.png assets/sprites/poncho assets/characters/poncho
// Writes the PNG where it is told (a scratch folder, not the repository); look at it, then send it with the art.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, extname, join } from 'node:path';
import { chromium } from 'playwright';

/** The height every reference is drawn at, in px before the zoom: about a sprite sheet row's, so the two read side by side. */
export const REF_HEIGHT = 160;

const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' };

/** Each image a path names: a file itself, or a folder's .png, .jpg and .jpeg files in name order. Anything else is skipped. */
export function imagesOf(paths, fs = { isDir: (p) => statSync(p).isDirectory(), list: (p) => readdirSync(p) }) {
  return paths.flatMap((p) => (fs.isDir(p) ? fs.list(p).sort().map((f) => join(p, f)) : [p])).filter((f) => extname(f).toLowerCase() in MIME);
}

/**
 * The HTML of the lineup: one labelled row per image, in the order given. A PNG is a sprite sheet, drawn at its own size times `zoom` with no
 * smoothing; a JPEG is a reference, drawn REF_HEIGHT * zoom px high.
 */
export function lineupHtml(images, zoom = 1) {
  const rows = images
    .map((im) => {
      const mime = MIME[extname(im.file).toLowerCase()];
      const size = mime === 'image/png' ? `zoom:${zoom}` : `height:${REF_HEIGHT * zoom}px`;
      return `<div class="name">${im.file}</div><img src="data:${mime};base64,${im.data.toString('base64')}" style="${size}">`;
    })
    .join('');
  return `<!doctype html><html><body style="margin:0;background:#3a3350;font:14px monospace;color:#fff">
<div id="sheet" style="padding:12px;width:max-content">${rows}</div>
<style>.name{margin:8px 0 4px}img{display:block;image-rendering:pixelated}</style></body></html>`;
}

async function main() {
  const args = process.argv.slice(2);
  const zi = args.indexOf('--zoom');
  const zoom = zi >= 0 ? Number(args[zi + 1]) : 1;
  const [out, ...paths] = zi >= 0 ? args.filter((_, i) => i !== zi && i !== zi + 1) : args;
  if (!out || paths.length === 0 || !out.endsWith('.png')) {
    console.error('usage: node scripts/art-lineup.mjs <out.png> <folder or file>... [--zoom N]');
    process.exit(2);
  }
  const files = imagesOf(paths);
  if (files.length === 0) {
    console.error(`no .png, .jpg or .jpeg images in ${paths.join(', ')}`);
    process.exit(1);
  }
  // The same browser as playwright.config.ts and scripts/overview.mjs: the cloud environment ships Chromium.
  const preinstalled = '/opt/pw-browsers/chromium';
  const executablePath = process.env['PLAYWRIGHT_CHROMIUM_PATH'] || (existsSync(preinstalled) ? preinstalled : undefined);
  const browser = await chromium.launch(executablePath ? { executablePath } : {});
  const page = await browser.newPage();
  await page.setContent(lineupHtml(files.map((file) => ({ file, data: readFileSync(file) })), zoom));
  await page.locator('#sheet').screenshot({ path: out });
  await browser.close();
  console.log(`${out}: ${files.length} images (${files.map((f) => basename(f)).join(', ')})`);
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
