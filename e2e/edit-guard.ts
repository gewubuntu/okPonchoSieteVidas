// L-040: the playtests run against the live dev server, which reloads on any change under `src/`, and a scenario edited mid-run
// is not the one that ran. This global setup notes when the run started; its teardown fails the run if a file under `src/` or
// `e2e/`, or `index.html`, changed since, so the run is done again with nothing edited.
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const files = (path: string): string[] => {
  const stat = statSync(path, { throwIfNoEntry: false });
  if (!stat) return [];
  if (!stat.isDirectory()) return [path];
  return readdirSync(path).flatMap((name) => files(join(path, name)));
};

export default function editGuard(): () => void {
  const started = Date.now();
  return () => {
    const changed = ['src', 'e2e', 'index.html'].flatMap(files).filter((f) => statSync(f).mtimeMs > started);
    if (changed.length > 0) throw new Error(`L-040: edited while the playtests ran, so run them again: ${changed.join(', ')}`);
  };
}
