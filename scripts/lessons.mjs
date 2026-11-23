// Reading one lesson before work (L-098): `node scripts/check.mjs --lesson L-013,L-010` prints each entry with only its
// newest occurrences, so a lesson that has come back dozens of times is still quick to read. docs/LESSONS.md keeps them all.

// One line may record two (`- **Recurrence 2 and 3 (...`).
const OCCURRENCE = /^- \*\*Recurrence \d+(?: and \d+)? \(/;

/** The entry of lesson `id` (`L-013`) in the lessons file's text, the template's code fence aside, or null. */
export function lessonEntry(text, id) {
  const parts = text.replace(/```[\s\S]*?```/g, '').split(/^(?=## L-\d{3}\b)/m).slice(1);
  return parts.find((p) => p.startsWith(`## ${id} `))?.trimEnd() ?? null;
}

/**
 * An entry cut for reading: its heading and fields, with only the last `keep` occurrence lines (`- **Recurrence N (...):**`),
 * and where the first left-out one stood a line saying how many earlier occurrences the file holds.
 */
export function lessonBrief(entry, keep = 3) {
  const lines = entry.split('\n');
  const occurrences = lines.filter((l) => OCCURRENCE.test(l));
  const cut = new Set(occurrences.slice(0, Math.max(0, occurrences.length - keep)));
  if (cut.size === 0) return entry;
  const out = [];
  let told = false;
  for (const line of lines) {
    if (!cut.has(line)) out.push(line);
    else if (!told) {
      out.push(`- (${cut.size} earlier occurrence${cut.size === 1 ? '' : 's'} left out; docs/LESSONS.md has ${cut.size === 1 ? 'it' : 'them'})`);
      told = true;
    }
  }
  return out.join('\n');
}
