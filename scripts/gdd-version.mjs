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
 * except under CI, where it fails so that a checkout without the full history cannot turn it off unseen. `check(baseText,
 * headText)` is the comparison to run: `oneVersionErrors`, or `changelogSectionErrors` for the gate's second check.
 */
export function gddVersionErrors(git, headText, ci, check = oneVersionErrors) {
  // L-088: while a merge is in progress, compare with the merge base the merge commit will have (`git merge-base A B C`
  // is the base of A and a merge of B and C), not HEAD's old one.
  const merging = git('rev-parse', '-q', '--verify', 'MERGE_HEAD').status === 0;
  const base = merging ? git('merge-base', 'origin/main', 'HEAD', 'MERGE_HEAD') : git('merge-base', 'origin/main', 'HEAD');
  if (base.status !== 0) {
    return ci ? ['GDD: no merge base with origin/main, so gdd-one-version cannot compare versions; the CI job that runs the gate needs the full history (`fetch-depth: 0`, L-057)'] : [];
  }
  const old = git('show', `${base.stdout.trim()}:docs/GDD.md`);
  if (old.status !== 0) return [];
  return check(old.stdout, headText);
}

// L-013: a pull request's changelog line names every section its diff changes and no other (`harness-gdd-update` step 3),
// so the line can be trusted and a section edited in passing is not left out of it.

const SECTION = /^### (GDD-[A-Z]+-\d+)\b/;

/** Each `### GDD-XXX-NN` section's text by ID: its heading line to the line before the next heading of level 1 to 3 or `---` rule. */
export function sectionTexts(text) {
  const out = new Map();
  let id = null;
  for (const line of text.split('\n')) {
    if (/^(#{1,3}\s|---\s*$)/.test(line)) id = SECTION.exec(line)?.[1] ?? null;
    if (id !== null) out.set(id, `${out.get(id) ?? ''}${line}\n`);
  }
  return out;
}

/** A section's text as compared: without the blank lines at its end, and with each number of the Open Questions it cites read as the same (how many it cites still counts), since removing an answered question renumbers the ones after it in every section (`harness-gdd-update` step 4). */
const compared = (text) => text?.trimEnd().replace(/Open Questions? \d+(?:(?:, | and | to | or )\d+)*/g, (cited) => cited.replace(/\d+/g, 'N'));

/**
 * The IDs whose section differs between the two texts, blank end lines aside: the head's sections in its order, then the
 * ones it lost. Open Question numbers are left out of the comparison too, unless `exact`: then a section whose only change
 * is such a number counts as changed.
 */
export function changedSections(baseText, headText, exact = false) {
  const base = sectionTexts(baseText);
  const head = sectionTexts(headText);
  const as = exact ? (text) => text?.trimEnd() : compared;
  const changed = [...head.keys()].filter((id) => as(base.get(id)) !== as(head.get(id)));
  return [...changed, ...[...base.keys()].filter((id) => !head.has(id))];
}

/** The GDD IDs a text names, with a range such as `GDD-CHAIN-01 to GDD-CHAIN-06` written out, whichever end comes first. */
export function idsIn(text) {
  const ids = [];
  for (const m of text.matchAll(/GDD-([A-Z]+)-(\d+)(?: to GDD-\1-(\d+))?/g)) {
    const ends = [Number(m[2]), Number(m[3] ?? m[2])];
    for (let n = Math.min(...ends); n <= Math.max(...ends); n++) ids.push(`GDD-${m[1]}-${String(n).padStart(m[2].length, '0')}`);
  }
  return ids;
}

/** The IDs a changelog line names before its first colon. */
export function namedSections(line) {
  const colon = line.indexOf(':');
  return idsIn(colon < 0 ? line : line.slice(0, colon));
}

/** A changelog line may name this section without changing it: a dependency review (`harness-gdd-update` step 2). */
const REVIEW_ONLY = 'GDD-TEC-07';

/** The error strings for a branch whose newest added changelog line and changed sections disagree, or none. */
export function changelogSectionErrors(baseText, headText, baseName = 'origin/main') {
  const changed = changedSections(baseText, headText);
  const version = addedVersions(baseText, headText)[0];
  const stale = `If ${baseName} is stale, run \`git fetch origin main\` first.`;
  if (version === undefined) {
    if (changed.length === 0) return [];
    return [`GDD: ${changed.join(', ')} changed since ${baseName} and the changelog has no new version; bump \`Version:\` and add its line (harness-gdd-update steps 2 and 3). ${stale}`];
  }
  const named = namedSections(headText.split('\n').find((l) => l.startsWith(`- **${version}**`)) ?? '');
  const unnamed = changed.filter((id) => !named.includes(id));
  // A section whose only change is a renumbered Open Question may be named or left out: it is in `touched`, not in `changed`.
  const touched = changedSections(baseText, headText, true);
  const untouched = named.filter((id) => !touched.includes(id) && id !== REVIEW_ONLY);
  const errors = [];
  if (unnamed.length > 0) errors.push(`GDD: the changelog line of ${version} does not name ${unnamed.join(', ')}, which changed since ${baseName}; the line names every section the diff changes (harness-gdd-update step 3, L-013). ${stale}`);
  if (untouched.length > 0) errors.push(`GDD: the changelog line of ${version} names ${untouched.join(', ')}, which did not change since ${baseName}; the line names no section the diff leaves alone (harness-gdd-update step 3, L-013). ${stale}`);
  return errors;
}
