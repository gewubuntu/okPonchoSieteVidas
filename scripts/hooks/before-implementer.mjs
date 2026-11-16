#!/usr/bin/env node
// PreToolUse hook for launching the implementer subagent (see .claude/settings.json), the automated check for L-077.
// The implementer builds only from a plan in .plans/. Before it starts, the plan must show the main session worked the new rules' own
// cases through by hand (harness-feature step 5): a "## Worked cases" section with at least two lines that carry numbers, and an
// "## Existing fixtures" section that says what the new rules do to the fixtures already in the files they land in (L-077, recurrence 4:
// a new validator rule failed 13 existing fixtures the plan never named). The hook cannot tell whether either is right; it makes the step
// impossible to skip, which is how L-077 recurred.
// It denies the launch with the reason, also when the plan it names cannot be read; a launch that names no plan, or a malformed input,
// prints nothing and exits 0.

import { readFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { pathToFileURL } from 'node:url';

/** The heading the plan must carry. */
export const HEADING = '## Worked cases';
/** The heading of what the plan's new rules do to the existing fixtures of the files they land in ("none newly fail", with why, counts). */
export const FIXTURES = '## Existing fixtures';

/**
 * The plan path a prompt names: any path with a `.plans` folder in it and a `.md` file, relative or absolute, bare or wrapped in quotes,
 * backticks, brackets, parentheses or bold (`./.plans/x.md`, `**.plans/a/x.md**`, `[.plans/x.md]`), or null. The name after `.plans/` ends at
 * the first `.md` not followed by a word character, so what wraps it after (`]`, `**`, `)`) is never part of it.
 */
export const planPath = (prompt) => /((?:[^\s`'"()[\]*<>]*\/)?\.plans\/\S+?\.md)(?![\w-])/.exec(prompt ?? '')?.[1] ?? null;

/** Where a plan path is read from: as given if absolute, else under `cwd` (the hook input's working directory, or the project's). */
export const planFile = (path, cwd) => (isAbsolute(path) || !cwd ? path : join(cwd, path));

/** The lines under the plan's "## Worked cases" heading, up to the next heading of the same or a higher level, that carry a digit. */
export function workedLines(plan) {
  return sectionLines(plan, HEADING)?.filter((l) => /\d/.test(l)) ?? null;
}

/** The lines under the plan's `heading` (alone, or with a note after it), up to the next heading of the same or a higher level, or null. */
export function sectionLines(plan, heading) {
  const lines = plan.split('\n');
  const start = lines.findIndex((l) => l.trim() === heading || l.trim().startsWith(`${heading} `));
  if (start < 0) return null;
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((l) => /^#{1,2}\s/.test(l));
  return end < 0 ? rest : rest.slice(0, end);
}

/**
 * The reason to deny a launch of the implementer, or null. `read` reads a file's text (it throws if the file is missing); a relative plan
 * path is read under `cwd`. Only an Agent call with `subagent_type` "implementer" whose prompt names a plan file is checked, and a plan it
 * names that cannot be read is denied too (a typo would otherwise skip the check).
 */
export function workedCasesProblem(input, read = (p) => readFileSync(p, 'utf8'), cwd = input?.cwd ?? process.env.CLAUDE_PROJECT_DIR) {
  if (input?.tool_name !== 'Agent' || input?.tool_input?.subagent_type !== 'implementer') return null;
  const path = planPath(input.tool_input.prompt);
  if (path === null) return null;
  let plan;
  try {
    plan = read(planFile(path, cwd));
  } catch {
    return `L-077: the plan ${path} named in the launch cannot be read from ${cwd ?? 'the working directory'}. Name a plan file that exists, with its "${HEADING}" section (harness-feature step 5).`;
  }
  const worked = workedLines(plan);
  if (worked === null) return `L-077: the plan ${path} has no "${HEADING}" section. Work two cases of each new rule through its definition, one that must pass and one that must fail, with the numbers, before the implementer starts (harness-feature step 5).`;
  if (worked.length < 2) return `L-077: the "${HEADING}" section of ${path} has fewer than two lines with numbers. Each case is worked with its numbers (harness-feature step 5).`;
  const fixtures = sectionLines(plan, FIXTURES);
  if (fixtures === null || !fixtures.some((l) => l.trim() !== '')) {
    return `L-077: the plan ${path} has no "${FIXTURES}" section with a line in it. Grep the test files each new rule lands in for fixtures it would newly fail (the same world, kind or flag) and say what happens to each, or that none fail and why (harness-feature step 5).`;
  }
  return null;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let raw = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => (raw += chunk));
  process.stdin.on('end', () => {
    try {
      const reason = workedCasesProblem(JSON.parse(raw));
      if (reason) {
        process.stdout.write(
          JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason } }),
        );
      }
    } catch {
      // Never break the session over a malformed input.
    }
    process.exit(0);
  });
}
