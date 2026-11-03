// L-057: a pull request bumps the GDD version once (`harness-gdd-update` step 2). A later edit on the same branch, a
// review fix or a second commit, amends that version's changelog line instead of adding another one.

const ENTRY = /^- \*\*(\d+\.\d+\.\d+)\*\*/gm;

/** The changelog versions in `head` that `base` does not have, newest first. */
export function addedVersions(baseText, headText) {
  const old = new Set([...baseText.matchAll(ENTRY)].map((m) => m[1]));
  return [...headText.matchAll(ENTRY)].map((m) => m[1]).filter((v) => !old.has(v));
}

/** The error strings for a branch whose GDD adds more than one version since its base, or none. */
export function oneVersionErrors(baseText, headText, baseName = 'origin/main') {
  const added = addedVersions(baseText, headText);
  if (added.length <= 1) return [];
  return [
    `GDD: ${added.length} changelog versions added since ${baseName} (${added.join(', ')}); a PR bumps the version once, and a later edit amends that version's line (harness-gdd-update step 2, L-057). If ${baseName} is stale, run \`git fetch origin main\` first: a version main already has counts as added until then`,
  ];
}

/**
 * The gate's check. `git(...args)` runs git and returns `{ status, stdout }`; `headText` is the working tree's GDD.
 * Without a merge base with origin/main (no origin/main, a shallow clone) there is nothing to compare: the check passes,
 * except under CI, where it fails so that a checkout without the full history cannot turn it off unseen.
 */
export function gddVersionErrors(git, headText, ci) {
  const base = git('merge-base', 'origin/main', 'HEAD');
  if (base.status !== 0) {
    return ci ? ['GDD: no merge base with origin/main, so gdd-one-version cannot compare versions; the CI job that runs the gate needs the full history (`fetch-depth: 0`, L-057)'] : [];
  }
  const old = git('show', `${base.stdout.trim()}:docs/GDD.md`);
  if (old.status !== 0) return [];
  return oneVersionErrors(old.stdout, headText);
}
