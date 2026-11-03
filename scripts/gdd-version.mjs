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
    `GDD: ${added.length} changelog versions added since ${baseName} (${added.join(', ')}); a PR bumps the version once, and a later edit amends that version's line (harness-gdd-update step 2, L-057)`,
  ];
}
