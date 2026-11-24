// GDD-TEC-09: the simulation version, a hash of the simulation's source: a record replays only against its own. One version for the
// whole game, not one per level: a change to one level's data makes every level's records a new version. `vite.config.ts` gives it to
// the game, the build and `npm test` as `__SIM_VERSION__` (`src/sim/version.ts`). It hashes the folders (all of `src/sim/` and
// `src/levels/`, and `src/config/tuning.ts`, tests and test support aside), not the files a step imports: a file no step reads (the
// save, the settings, the sounds) still makes a new version, which errs towards refusing a record, never towards replaying one on the
// wrong code.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
/** The test support beside the levels that no step reads (GDD-TEC-06). */
const SUPPORT = ['src/levels/bots.ts', 'src/levels/sightSweep.ts', 'src/levels/tape.ts'];

/** Is this path (`/`-separated, from the repository's root) part of the simulation a record is made with? */
export const inSimulation = (path) =>
  (path === 'src/config/tuning.ts' || /^src\/(sim|levels)\/[^/]+\.ts$/.test(path)) && !/\.(test|setup|drive)\.ts$/.test(path) && !SUPPORT.includes(path);

/** The version of `files` (`{ path, text }`): 16 hex digits of the SHA-256 of each simulation file's path and text, in path order, CRLF read as LF. */
export function simVersion(files) {
  const hash = createHash('sha256');
  const sim = files.filter((f) => inSimulation(f.path)).sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  for (const f of sim) hash.update(`${f.path}\0${f.text.replace(/\r\n/g, '\n')}\0`);
  return hash.digest('hex').slice(0, 16);
}

/** The `.ts` files directly in the three folders the simulation is in, of the checkout at `root`. */
export function readSimFiles(root = ROOT) {
  return ['src/config', 'src/sim', 'src/levels'].flatMap((d) =>
    readdirSync(join(root, d))
      .filter((n) => n.endsWith('.ts'))
      .map((n) => ({ path: `${d}/${n}`, text: readFileSync(join(root, d, n), 'utf8') })),
  );
}

/** The simulation version of the checkout at `root`. */
export const currentSimVersion = (root = ROOT) => simVersion(readSimFiles(root));
