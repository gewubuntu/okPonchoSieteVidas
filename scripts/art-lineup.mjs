#!/usr/bin/env node
// The art lineup (L-066): new art on one image beside the approved art it must match and the user's references, so it is judged against its
// neighbours (silhouette, profile, proportions, shading depth, pattern, outline, face) before the user sees it.
//   node scripts/art-lineup.mjs <out.png> <folder or file>... [--zoom N]
// Each folder adds its .png sheets and its .jpg/.jpeg references, its subfolders' too; a file adds itself. The output is a .png outside the
// repository (a scratch folder) and outside every input folder, so a lineup never overwrites a sheet, a reference or a committed screenshot.
// Sheets are drawn at their own size times the zoom, pixels unsmoothed (the game's scale); references, drawn by hand or photographed at any size, are scaled to REF_HEIGHT px times the zoom.
// e.g. node scripts/art-lineup.mjs "$SCRATCH/lineup.png" assets/sprites/enemies
//      node scripts/art-lineup.mjs "$SCRATCH/lineup.png" assets/sprites/poncho.png assets/sprites/poncho assets/characters/poncho
// Writes the PNG where it is told (a scratch folder, not the repository); look at it, then send it with the art.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, dirname, extname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

/** The height every reference is drawn at, in px before the zoom: about a sprite sheet row's, so the two read side by side. */
export const REF_HEIGHT = 160;

/** The repository: its sheets, references and committed screenshots live in it, so a lineup is never written there. */
export const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Whether `path` is `dir` itself or lies anywhere under it (a name that only starts with dots, such as `..l.png`, is under it). */
export function isWithin(dir, path) {
  const r = relative(resolve(dir), resolve(path));
  return !(r === '..' || r.startsWith(`..${sep}`));
}

const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' };

const DISK = { isDir: (p) => statSync(p).isDirectory(), list: (p) => readdirSync(p) };

/** Each image a path names: a file itself, or a folder's .png, .jpg and .jpeg files in name order, each subfolder's in its place. Anything else is skipped. */
export function imagesOf(paths, fs = DISK) {
  const walk = (p) => (fs.isDir(p) ? [...fs.list(p)].sort().flatMap((f) => walk(join(p, f))) : [p]);
  return paths.flatMap(walk).filter((f) => extname(f).toLowerCase() in MIME);
}

/**
 * The command line: `<out.png> <folder or file>... [--zoom N]`. Returns `{ out, paths, zoom }`, or `{ error }` when the output is missing, is
 * not a .png (in any case), lies in the repository (it would overwrite a sheet, a reference or a committed screenshot: a sheet named first,
 * with the output left out, becomes the output) or in an input folder or is an input, when no input is named, or when the zoom is not a
 * positive number.
 */
export function parseArgs(args) {
  const zi = args.indexOf('--zoom');
  const zoom = zi >= 0 ? Number(args[zi + 1]) : 1;
  if (!(zoom > 0)) return { error: '--zoom takes a positive number' };
  const [out, ...paths] = zi >= 0 ? args.filter((_, i) => i !== zi && i !== zi + 1) : args;
  if (!out || paths.length === 0) return { error: 'name the output .png first, then at least one folder or file' };
  if (!out.toLowerCase().endsWith('.png')) return { error: `the output ${out} is not a .png` };
  if (isWithin(REPO, out)) return { error: `the output ${out} is in the repository, where the art and screenshots live; write it to a scratch folder` };
  const inside = paths.find((p) => isWithin(p, out));
  if (inside !== undefined) return { error: `the output ${out} would overwrite ${inside} or a file in it; name the output first` };
  return { out, paths, zoom };
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
  const parsed = parseArgs(process.argv.slice(2));
  if ('error' in parsed) {
    console.error(`${parsed.error}\nusage: node scripts/art-lineup.mjs <out.png> <folder or file>... [--zoom N]`);
    process.exit(2);
  }
  const { out, paths, zoom } = parsed;
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
