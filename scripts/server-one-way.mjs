// server-one-way (docs/decisions/0004-game-server.md, L-008): the server imports the game, never the other way round, so the
// game's build holds none of it. Every file under `src/` is parsed, and each text in it that is a relative path leading
// into the top-level `server/` folder is an error, however it is used: `import ... from`, a bare `import '...'`, `import()`,
// `export ... from`, `import.meta.glob(...)`, `vi.mock(...)`; so is a path from the project's root (`/server/...`), which a
// glob may use. Comments are not read, and a folder named `server` inside `src/` is not the server. A glob with a wildcard
// where the folder's name stands (`../../*/ledger.ts`) is not read.
import { createRequire } from 'node:module';
import { posix } from 'node:path';

// Loaded on first use, as in scripts/sim-determinism.mjs, so the gate's other commands run without `node_modules`.
const require = createRequire(import.meta.url);

/** Whether the check reads the file at `path` (`/`-separated, from the repository's root). */
export const covered = (path) => path.startsWith('src/') && /\.(ts|mjs)$/.test(path);

/** Every node of the tree, in source order. */
function* nodes(node) {
  yield node;
  for (const value of Object.values(node)) {
    for (const child of Array.isArray(value) ? value : [value]) if (child && typeof child.type === 'string') yield* nodes(child);
  }
}

/**
 * Where a path written in the file at `from` leads, from the repository's root: a relative one from that file's folder, one
 * that starts with `/` from the root itself, as Vite reads it (a glob may be written so). Null for any other text.
 */
export function target(from, written) {
  if (written.startsWith('/')) return posix.join('.', written); // join drops the leading slash and takes the `..` out
  if (!/^\.\.?\//.test(written)) return null;
  return posix.join(posix.dirname(from), written); // join also takes the `..` out
}

/** One error per text in a covered file (`{ path, text }`) that leads into `server/`. A file that does not parse is one error. */
export function serverImportErrors(files, parse = (p, t) => require('vite').parseSync(p, t, { lang: p.endsWith('.ts') ? 'ts' : 'js' })) {
  const errors = [];
  for (const { path, text } of files.filter((f) => covered(f.path))) {
    const { program, errors: broken } = parse(path, text);
    if (broken?.length) errors.push(`${path}: does not parse, so its imports cannot be read`);
    for (const node of nodes(program)) {
      // A plain text (only a text's node has a string for its value), or a template's text up to the first thing put into it.
      const written = typeof node.value === 'string' ? node.value : node.type === 'TemplateLiteral' ? node.quasis[0].value.cooked : null;
      const to = written === null ? null : target(path, written);
      if (to === 'server' || to?.startsWith('server/')) {
        errors.push(`${path}:${text.slice(0, node.start).split('\n').length}: \`${written}\` leads into server/; only the server imports the game (docs/decisions/0004-game-server.md)`);
      }
    }
  }
  return errors;
}
