#!/usr/bin/env node
// The harness gate. Zero dependencies. Run before every commit and in CI.
//   node scripts/check.mjs                 run all checks
//   node scripts/check.mjs --backlog-stub  print backlog rows for GDD IDs missing from the backlog
//   node scripts/check.mjs --lessons [a,b]  print each lesson's title and rule, only those areas' if named
// See docs/HARNESS.md. When a lesson in docs/LESSONS.md is promoted to a check, name it in a comment here.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const exists = (p) => existsSync(join(ROOT, p));

const ID_RE = /GDD-[A-Z]{2,6}-\d{2,3}/g;
const DEF_RE = /^#{1,6}\s+(GDD-[A-Z]{2,6}-\d{2,3})\b/;
const GDD_STATUSES = ['Decided', 'Proposed', 'Deprecated'];
const BACKLOG_STATUSES = ['todo', 'doing', 'done', 'cut'];

const SKIP_DIRS = new Set(['.git', 'node_modules', 'dist', 'coverage', 'playwright-report', 'test-results']);
const TEXT_EXT = new Set(['.md', '.ts', '.tsx', '.js', '.mjs', '.cjs', '.json', '.yml', '.yaml', '.html', '.css', '.txt']);
const SELF = join('scripts', 'check.mjs');

function walk(dir, out = []) {
  for (const name of readdirSync(join(ROOT, dir))) {
    if (SKIP_DIRS.has(name)) continue;
    const rel = dir ? join(dir, name) : name;
    const st = statSync(join(ROOT, rel));
    if (st.isDirectory()) walk(rel, out);
    else out.push(rel);
  }
  return out;
}

const textFiles = () =>
  walk('').filter((f) => {
    if (f === SELF || f === 'package-lock.json') return false;
    const dot = f.lastIndexOf('.');
    return dot >= 0 && TEXT_EXT.has(f.slice(dot));
  });

// ---- GDD parsing -----------------------------------------------------------

function parseGdd() {
  const text = read('docs/GDD.md');
  const lines = text.split('\n');
  const defs = []; // { id, line, status }
  for (let i = 0; i < lines.length; i++) {
    const m = DEF_RE.exec(lines[i]);
    if (!m) continue;
    let end = lines.length;
    for (let j = i + 1; j < lines.length; j++) {
      if (/^#{1,6}\s/.test(lines[j])) { end = j; break; }
    }
    const section = lines.slice(i + 1, end).join('\n');
    const s = /^Status:\s*(\w+)\b.*$/m.exec(section);
    defs.push({ id: m[1], line: i + 1, status: s ? s[1] : null });
  }
  return { text, defs };
}

// ---- checks ----------------------------------------------------------------
// Each check returns an array of error strings.

function checkGdd() {
  const errors = [];
  if (!exists('docs/GDD.md')) return ['docs/GDD.md is missing'];
  const { text, defs } = parseGdd();

  const v = /^Version:\s*(\d+\.\d+\.\d+)\s*$/m.exec(text);
  if (!v) errors.push('GDD: missing "Version: x.y.z" line');
  else if (!new RegExp(`^- \\*\\*${v[1].replace(/\./g, '\\.')}\\*\\*`, 'm').test(text)) {
    errors.push(`GDD: changelog has no entry "- **${v[1]}** (date) ..." for the current version`);
  }

  const seen = new Map();
  for (const d of defs) {
    if (seen.has(d.id)) errors.push(`GDD: duplicate ID ${d.id} (lines ${seen.get(d.id)} and ${d.line})`);
    else seen.set(d.id, d.line);
    if (!d.status) errors.push(`GDD: ${d.id} (line ${d.line}) has no "Status:" line`);
    else if (!GDD_STATUSES.includes(d.status)) {
      errors.push(`GDD: ${d.id} has invalid status "${d.status}" (use ${GDD_STATUSES.join(' | ')})`);
    }
  }
  if (defs.length === 0) errors.push('GDD: no "### GDD-XXX-NN" sections found');
  return errors;
}

// Open Questions are a numbered list, so removing one renumbers the ones after it. A reference past the end of the list is
// stale (GDD 0.7.0 kept "Open Question 16" after question 15 was removed; fixed in 0.7.1). The changelog keeps old numbers.
function checkOpenQuestionRefs() {
  if (!exists('docs/GDD.md')) return [];
  const lines = read('docs/GDD.md').split('\n');
  const start = lines.findIndex((l) => /^## Open Questions\s*$/.test(l));
  if (start < 0) return ['GDD: no "## Open Questions" section'];
  let count = 0;
  for (let i = start + 1; i < lines.length && !/^#{1,2}\s/.test(lines[i]); i++) if (/^\d+\.\s/.test(lines[i])) count++;
  const log = lines.findIndex((l) => /^## Changelog\s*$/.test(l));
  let logEnd = log;
  while (log >= 0 && logEnd + 1 < lines.length && !/^(#{1,2}\s|---\s*$)/.test(lines[logEnd + 1])) logEnd++;
  const errors = [];
  const scan = (file, fileLines, skip) => fileLines.forEach((line, i) => {
    if (skip(i)) return;
    for (const m of line.matchAll(/Open Questions? (\d+(?:(?:, | and | to | or )\d+)*)/g)) {
      for (const n of m[1].match(/\d+/g)) {
        if (Number(n) < 1 || Number(n) > count) errors.push(`${file}:${i + 1}: "Open Question ${n}", but the GDD lists ${count}: renumbered?`);
      }
    }
  });
  scan('docs/GDD.md', lines, (i) => log >= 0 && i > log && i <= logEnd);
  if (exists('docs/BACKLOG.md')) scan('docs/BACKLOG.md', read('docs/BACKLOG.md').split('\n'), () => false);
  return errors;
}

function checkReferences() {
  if (!exists('docs/GDD.md')) return [];
  const known = new Set(parseGdd().defs.map((d) => d.id));
  const errors = [];
  for (const f of textFiles()) {
    const lines = read(f).split('\n');
    lines.forEach((line, i) => {
      for (const id of line.match(ID_RE) ?? []) {
        if (!known.has(id)) errors.push(`${f.split(sep).join('/')}:${i + 1}: unknown GDD ID ${id}`);
      }
    });
  }
  return errors;
}

function parseBacklog() {
  const rows = [];
  if (!exists('docs/BACKLOG.md')) return rows;
  read('docs/BACKLOG.md').split('\n').forEach((line, i) => {
    const m = /^\|\s*(GDD-[A-Z]{2,6}-\d{2,3})\s*\|\s*([^|]*?)\s*\|/.exec(line);
    if (m) rows.push({ id: m[1], status: m[2], line: i + 1 });
  });
  return rows;
}

function checkBacklog() {
  if (!exists('docs/GDD.md')) return [];
  if (!exists('docs/BACKLOG.md')) return ['docs/BACKLOG.md is missing'];
  const errors = [];
  const defs = parseGdd().defs;
  const byId = new Map(defs.map((d) => [d.id, d]));
  const rows = parseBacklog();
  const seen = new Set();
  for (const r of rows) {
    if (seen.has(r.id)) errors.push(`BACKLOG: duplicate row for ${r.id} (line ${r.line})`);
    seen.add(r.id);
    if (!byId.has(r.id)) errors.push(`BACKLOG: ${r.id} (line ${r.line}) is not in the GDD`);
    if (!BACKLOG_STATUSES.includes(r.status)) {
      errors.push(`BACKLOG: ${r.id} has invalid status "${r.status}" (use ${BACKLOG_STATUSES.join(' | ')})`);
    }
    if (byId.get(r.id)?.status === 'Deprecated' && r.status !== 'cut') {
      errors.push(`BACKLOG: ${r.id} is Deprecated in the GDD, so its backlog status must be "cut"`);
    }
  }
  for (const d of defs) {
    if (!seen.has(d.id)) errors.push(`BACKLOG: missing row for ${d.id} (run with --backlog-stub)`);
  }
  return errors;
}

// Entries: "## L-001 Title" followed by labelled bullet fields.
// The areas a lesson belongs to, in the order the template lists them (docs/LESSONS.md).
const LESSON_AREAS = ['input', 'tests', 'playtest', 'gdd', 'level', 'ui', 'art', 'process', 'harness'];

// `--lessons [area,...]`: each lesson's title, recurrence and rule, so a task reads the rules it needs without the whole
// file and opens the full entries that apply. With no areas it prints them all.
function printLessons(areas) {
  const bad = areas.filter((a) => !LESSON_AREAS.includes(a));
  if (bad.length) {
    console.error(`unknown area ${bad.join(', ')}; the areas are ${LESSON_AREAS.join(', ')}`);
    return 2;
  }
  const body = read('docs/LESSONS.md').replace(/```[\s\S]*?```/g, '');
  for (const part of body.split(/^(?=## L-\d{3}\b)/m).slice(1)) {
    const field = (name) => new RegExp(`^- \\*\\*${name}:\\*\\*\\s*(.+)$`, 'm').exec(part)?.[1].trim();
    const own = (field('Area') ?? '').split(/,\s*/);
    if (areas.length && !own.some((a) => areas.includes(a))) continue;
    console.log(`${part.split('\n')[0].slice(3)} [${own.join(', ')}] (Recurrence ${field('Recurrence')})\n  ${field('Rule')}\n`);
  }
  return 0;
}

function checkLessons() {
  if (!exists('docs/LESSONS.md')) return ['docs/LESSONS.md is missing'];
  const errors = [];
  const text = read('docs/LESSONS.md');
  const body = text.replace(/```[\s\S]*?```/g, ''); // ignore the template in the code fence
  const parts = body.split(/^(?=## L-\d{3}\b)/m).slice(1);
  const seen = new Set();
  const order = [];
  for (const part of parts) {
    const id = /^## (L-\d{3})\b/.exec(part)[1];
    if (seen.has(id)) errors.push(`LESSONS: duplicate ${id}`);
    seen.add(id);
    order.push(Number(id.slice(2)));
    const field = (name) => new RegExp(`^- \\*\\*${name}:\\*\\*\\s*(.+)$`, 'm').exec(part)?.[1].trim();
    for (const name of ['Date', 'Area', 'What went wrong', 'Root cause', 'Rule', 'Recurrence', 'Promoted']) {
      if (!field(name)) errors.push(`LESSONS: ${id} is missing the "${name}" field`);
    }
    // `--lessons` prints a field's first line only, so each field stays on one line (L-001: encode the consumer's rules).
    const wrapped = part.split('\n').slice(1).find((l) => l.trim() && !/^- \*\*/.test(l));
    if (wrapped) errors.push(`LESSONS: ${id} has a line that is not a "- **Field:**" bullet: "${wrapped.trim().slice(0, 50)}"; keep each field on one line`);
    // The Area is the index `--lessons <area>` reads, so a lesson outside the list would never be shown.
    for (const area of (field('Area') ?? '').split(/,\s*/).filter(Boolean)) {
      if (!LESSON_AREAS.includes(area)) errors.push(`LESSONS: ${id} has Area "${area}"; use one or more of ${LESSON_AREAS.join(', ')}`);
    }
    const date = field('Date');
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) errors.push(`LESSONS: ${id} Date must be YYYY-MM-DD`);
    const rec = field('Recurrence');
    if (rec !== undefined && !/^\d+$/.test(rec)) errors.push(`LESSONS: ${id} Recurrence must be a number`);
    else if (rec !== undefined && Number(rec) >= 2 && /^no\b/i.test(field('Promoted') ?? 'no')) {
      errors.push(`LESSONS: ${id} has Recurrence ${rec} but is not promoted (see the promotion rule)`);
    }
    // A lesson back a third time has outlived a prose rule: Promoted names its automated guard, or says why none can work.
    if (Number(rec) >= 3) {
      const guard = /\bGuard: (?:`([^`]+)`|none \([^)\s][^)]*\))/.exec(field('Promoted') ?? '');
      if (!guard) errors.push(`LESSONS: ${id} has Recurrence ${rec}, so Promoted must contain "Guard: \`<path of its check, test, hook or script>\`" or "Guard: none (<why no automated check can catch it>)" (see the promotion rule)`);
      else if (guard[1]?.endsWith('.md')) errors.push(`LESSONS: ${id} Guard \`${guard[1]}\` is prose, not a check, test, hook or script`);
      else if (guard[1] && !exists(guard[1])) errors.push(`LESSONS: ${id} Guard \`${guard[1]}\` does not exist`);
    }
  }
  // IDs count up and are never deleted, renumbered or reused. L-046 went into L-014 before this check, so it is listed after "Retired IDs:".
  const retired = new Set((/^Retired IDs:(.*)$/m.exec(body)?.[1] ?? '').match(/L-\d{3}/g) ?? []);
  order.forEach((n, i) => { if (i > 0 && n <= order[i - 1]) errors.push(`LESSONS: L-${String(n).padStart(3, '0')} is out of order; IDs count up`); });
  for (let n = 1; n < Math.max(0, ...order); n++) {
    const id = `L-${String(n).padStart(3, '0')}`;
    if (!seen.has(id) && !retired.has(id)) errors.push(`LESSONS: ${id} is missing; entries are never deleted or renumbered (see the promotion rule)`);
  }
  return errors;
}

// Lesson IDs cited anywhere (skills, docs, code comments) name a lesson that exists or is retired, so a promoted rule
// keeps its source. L-000 is the template's placeholder.
function checkLessonRefs() {
  if (!exists('docs/LESSONS.md')) return [];
  const lessons = read('docs/LESSONS.md');
  const known = new Set([...lessons.matchAll(/^## (L-\d{3})\b/gm)].map((m) => m[1]));
  for (const id of (/^Retired IDs:(.*)$/m.exec(lessons)?.[1] ?? '').match(/L-\d{3}/g) ?? []) known.add(id);
  const errors = [];
  for (const f of textFiles()) {
    read(f).split('\n').forEach((line, i) => {
      for (const id of line.match(/\bL-\d{3}\b/g) ?? []) {
        if (id !== 'L-000' && !known.has(id)) errors.push(`${f.split(sep).join('/')}:${i + 1}: unknown lesson ${id}`);
      }
    });
  }
  return errors;
}

/**
 * Parses and validates the YAML frontmatter shared by skills and agents.
 * L-001: a regex is not the real YAML parser. Plain scalars may not contain ": " or " #", so they must be quoted.
 */
function readFrontmatter(file, label, errors) {
  const fm = /^---\n([\s\S]*?)\n---\n/.exec(read(file));
  if (!fm) { errors.push(`${label}: ${file} has no frontmatter`); return null; }
  for (const line of fm[1].split('\n')) {
    const m = /^([A-Za-z-]+):\s*(.*)$/.exec(line);
    if (m && m[2] && !/^["']/.test(m[2]) && /: | #/.test(m[2])) {
      errors.push(`${label}: ${file} value of "${m[1]}" has ": " or " #" and must be quoted (invalid YAML otherwise)`);
    }
  }
  return (key) => new RegExp(`^${key}:\\s*(.+)$`, 'm').exec(fm[1])?.[1].trim();
}

function checkSkills() {
  const errors = [];
  const dir = join('.claude', 'skills');
  if (!exists(dir)) return ['.claude/skills is missing'];
  for (const name of readdirSync(join(ROOT, dir))) {
    if (!statSync(join(ROOT, dir, name)).isDirectory()) continue;
    const file = join(dir, name, 'SKILL.md');
    if (!exists(file)) { errors.push(`SKILL: ${name} has no SKILL.md`); continue; }
    const get = readFrontmatter(file, 'SKILL', errors);
    if (!get) continue;
    if (get('name') !== name) errors.push(`SKILL: ${file} name must be "${name}"`);
    if (!name.startsWith('harness-')) errors.push(`SKILL: ${name} must start with "harness-" so its command shows it is a harness skill`);
    if (!get('description')) errors.push(`SKILL: ${file} has no description`);
  }
  return errors;
}

// Subagents in .claude/agents. Claude Code silently skips an agent with bad frontmatter, so the gate must not.
function checkAgents() {
  const errors = [];
  const dir = join('.claude', 'agents');
  if (!exists(dir)) return errors;
  for (const entry of readdirSync(join(ROOT, dir)).filter((f) => f.endsWith('.md'))) {
    const file = join(dir, entry);
    const get = readFrontmatter(file, 'AGENT', errors);
    if (!get) continue;
    const name = get('name')?.replace(/^["']|["']$/g, '');
    if (!name || !/^[a-z0-9][a-z0-9-]*$/.test(name)) errors.push(`AGENT: ${file} needs a name of lowercase letters, digits and dashes (no ":")`);
    else if (`${name}.md` !== entry) errors.push(`AGENT: ${file} name "${name}" must match the file name`);
    if (!get('description')) errors.push(`AGENT: ${file} has no description`);
    if (!get('tools')) errors.push(`AGENT: ${file} lists no tools; an agent without a tools line inherits everything`);
    const model = get('model');
    if (model && model.replace(/["']/g, '') !== 'inherit') {
      errors.push(`AGENT: ${file} model must be "inherit": repository files do not name models (CLAUDE.md)`);
    }
    // The reviewer must stay on the main session's model; only the implementer is launched on a cheaper one (HARNESS.md).
    if (name === 'pr-reviewer' && model?.replace(/["']/g, '') !== 'inherit') {
      errors.push(`AGENT: ${file} must set model: inherit, so the review runs on the main session's model`);
    }
  }
  return errors;
}

/** Does a hook matcher (an exact name, `|` alternatives or a regular expression; empty or `*` for all) take the Bash tool? */
function readsShell(matcher) {
  if (!matcher || matcher === '*') return true;
  try { return new RegExp(`^(?:${matcher})$`).test('Bash'); } catch { return false; }
}

// Project Claude Code settings: valid JSON, and every hook script it points at exists.
function checkClaudeSettings() {
  const file = join('.claude', 'settings.json');
  if (!exists(file)) return [];
  let settings;
  try { settings = JSON.parse(read(file)); } catch (e) { return [`SETTINGS: ${file} is not valid JSON: ${e.message}`]; }
  const errors = [];
  const hooks = settings.hooks ?? {};
  if (typeof hooks !== 'object' || Array.isArray(hooks)) return [`SETTINGS: ${file} "hooks" must be an object keyed by event`];
  for (const [event, groups] of Object.entries(hooks)) {
    if (!Array.isArray(groups)) { errors.push(`SETTINGS: hooks.${event} must be a list of matcher groups`); continue; }
    for (const group of groups) {
      if (!Array.isArray(group?.hooks)) { errors.push(`SETTINGS: a hooks.${event} group has no "hooks" list`); continue; }
      for (const hook of group.hooks) {
        if (hook === null || typeof hook !== 'object' || Array.isArray(hook)) { errors.push(`SETTINGS: a hooks.${event} entry is not an object`); continue; }
        // Both the exec form (args) and a plain command string can point at a project script.
        const text = [hook.command, ...(Array.isArray(hook.args) ? hook.args : [])].filter((s) => typeof s === 'string').join(' ');
        for (const m of text.matchAll(/["']?\$\{?CLAUDE_PROJECT_DIR\}?["']?\/([^\s"']+)/g)) {
          if (!exists(m[1])) errors.push(`SETTINGS: ${event} hook points at ${m[1]}, which does not exist`);
          // A hook decides in a pure function its test pins (HARNESS.md), so a hook script without a test beside it fails.
          else if (m[1].endsWith('.mjs') && !exists(m[1].replace(/\.mjs$/, '.test.mjs'))) errors.push(`SETTINGS: ${event} hook ${m[1]} has no test beside it (${m[1].replace(/\.mjs$/, '.test.mjs')})`);
          // L-008: a hook that reads shell commands sees commit messages too, which are written as here-documents and name
          // the very commands it looks for. Its test holds such a here-document, which it must let through.
          else if (m[1].endsWith('.mjs') && readsShell(group.matcher) && !/<<-?\s*\\?['"]?EOF/.test(read(m[1].replace(/\.mjs$/, '.test.mjs')))) {
            errors.push(`SETTINGS: ${event} hook ${m[1]} reads shell commands, but its test holds no here-document (<<'EOF') it must let through (L-008)`);
          }
          // L-053: a hook that answers `ask` on shell commands reads them through command-text.mjs, as docs/HARNESS.md says,
          // so a change to how commands are read reaches every such hook at once.
          else if (m[1].endsWith('.mjs') && readsShell(group.matcher) && /permissionDecision: 'ask'/.test(read(m[1])) && !/from '\.\/command-text\.mjs'/.test(read(m[1]))) {
            errors.push(`SETTINGS: ${event} hook ${m[1]} answers ask on shell commands but does not read them through scripts/hooks/command-text.mjs (docs/HARNESS.md, Adding a check; L-053)`);
          }
        }
      }
    }
  }
  return errors;
}

// Skills, agents and CLAUDE.md tell the model which files to read, run or edit, and like the GDD (L-013) that text goes
// stale when the code moves. A renamed or deleted file fails here instead of sending a session to a path that is gone.
// Every word in backticks that starts with a top-level folder of the repository is checked; a placeholder such as
// `docs/screenshots/<slug>/` is skipped, and so is a `:line` suffix.
function checkHarnessPaths() {
  const files = ['CLAUDE.md', ...[join('.claude', 'skills'), join('.claude', 'agents')].filter(exists).flatMap((d) => walk(d))]
    .filter((f) => f.endsWith('.md') && exists(f));
  const errors = [];
  for (const f of files) {
    read(f).split('\n').forEach((line, i) => {
      for (const [, span] of line.matchAll(/`([^`]+)`/g)) {
        for (const word of span.split(/\s+/)) {
          const p = word.replace(/^["'(]+|["'),.:;]+$/g, '').replace(/:\d+(-\d+)?$/, '');
          if (!/^(src|e2e|scripts|docs|assets|\.claude|\.github)\//.test(p) || /[<>*{}$]/.test(p)) continue;
          if (!exists(p)) errors.push(`${f.split(sep).join('/')}:${i + 1}: \`${p}\` does not exist; fix the text that names it`);
        }
      }
    });
  }
  return errors;
}

// Repository files must not name AI models (see CLAUDE.md conventions).
function checkNoModelIds() {
  const re = /\b(claude-(opus|sonnet|haiku|fable)[\w.-]*|(opus|sonnet|haiku|fable)\s+\d|model:\s*["']?(opus|sonnet|haiku|fable)\b)/i;
  const errors = [];
  for (const f of textFiles()) {
    read(f).split('\n').forEach((line, i) => {
      const m = re.exec(line);
      if (m) errors.push(`${f.split(sep).join('/')}:${i + 1}: AI model name "${m[0]}" must not appear in repository files`);
    });
  }
  return errors;
}

// Toolchain slots: run the project's own lint/typecheck/test once package.json defines them.
function checkToolchain() {
  if (!exists('package.json')) return [];
  const scripts = JSON.parse(read('package.json')).scripts ?? {};
  const errors = [];
  // test:abilities reruns the simulation tests with every progression ability on (L-024).
  for (const name of ['lint', 'typecheck', 'test', 'test:abilities']) {
    if (!scripts[name]) continue;
    console.log(`  running npm run ${name} ...`);
    const r = spawnSync('npm', ['run', name, '--silent'], { cwd: ROOT, stdio: 'inherit' });
    if (r.status !== 0) errors.push(`npm run ${name} failed`);
  }
  return errors;
}

// L-006: Phaser's Key 'down' event can fire again for a press when a press and release land in one frame. Only an
// idempotent latch press may hang on a Phaser key event. An allowlist: every line in src/ (tests aside) that names a Phaser
// key-down event ('down', Events.DOWN, 'keydown-X') must be exactly that one-line form, so a multi-line or named handler
// fails by default. Raw window 'keydown' listeners are not Phaser's and are allowed.
function checkKeyDownHandlers() {
  const errors = [];
  const names = /['"]down['"]|Events\.DOWN\b|['"]keydown-/;
  const allowed = /^\s*for \(const k of this\.keys\.\w+\) k\.on\('down', \(\) => this\.\w+Latch\.press\(\)\);$/;
  for (const f of textFiles().filter((p) => p.startsWith(join('src', '')) && p.endsWith('.ts') && !p.endsWith('.test.ts'))) {
    read(f).split('\n').forEach((line, i) => {
      if (/^\s*(\/\/|\*|\/\*)/.test(line)) return; // comments may name the events
      if (names.test(line) && !allowed.test(line)) errors.push(`${f.split(sep).join('/')}:${i + 1}: a Phaser key-down event may only press a latch, as \`for (const k of this.keys.x) k.on('down', () => this.xLatch.press());\` (L-006)`);
    });
  }
  return errors;
}

// L-042: a playtest times the game in simulation steps, never in real time: headless frames are slow and uneven, so a real-time
// wait lets a different number of steps run on each machine and each run. Every waitForTimeout or setTimeout in e2e/ (a test's own
// time limit aside) says why real time is fine there in an `// L-042:` comment on its line (a frame to draw, a browser event to
// land). The waits written before this check are counted per file below; a count may only go down.
const REALTIME_WAITS = {
  'e2e/block.spec.ts': 1, 'e2e/boot.spec.ts': 2, 'e2e/collision.spec.ts': 2, 'e2e/gameover.spec.ts': 1, 'e2e/gamepad.spec.ts': 16,
  'e2e/hud.spec.ts': 4, 'e2e/language.spec.ts': 2, 'e2e/ofrenda.spec.ts': 3, 'e2e/pause.spec.ts': 8, 'e2e/pit.spec.ts': 3,
  'e2e/settings.spec.ts': 9, 'e2e/sfx.spec.ts': 1, 'e2e/sprite.spec.ts': 4, 'e2e/subframe.spec.ts': 9, 'e2e/title.spec.ts': 12,
  'e2e/touch.spec.ts': 3, 'e2e/shots/pit.spec.ts': 2, 'e2e/shots/title.spec.ts': 2,
  ...Object.fromEntries(['block', 'cactus', 'claw', 'crumble', 'desert', 'door', 'enemy', 'flip', 'fuego', 'gameover', 'glide', 'hilo', 'hud',
    'last-life', 'level', 'level0-1', 'level1-1', 'life-loss', 'ofrenda', 'pause', 'pinata', 'platform', 'progress', 'settings', 'spikes', 'spring',
    'taco', 'tips', 'tlacuache', 'touch', 'wallcling', 'zopilote'].map((n) => [`e2e/shots/${n}.spec.ts`, 1])),
};

function checkRealtimeWaits() {
  const errors = [];
  const wait = /(\b\w+\.)?\b(waitForTimeout|setTimeout)\(/g;
  for (const f of textFiles().filter((p) => p.startsWith(join('e2e', '')) && p.endsWith('.ts'))) {
    const file = f.split(sep).join('/');
    const found = [];
    read(f).split('\n').forEach((line, i) => {
      if (/^\s*(\/\/|\*|\/\*)/.test(line) || /\/\/.*\bL-042\b/.test(line)) return; // comments, and waits marked with their reason
      for (const m of line.matchAll(wait)) if (!/^(test|testInfo|info)\.$/.test(m[1] ?? '')) found.push(i + 1);
    });
    const allowed = REALTIME_WAITS[file] ?? 0;
    if (found.length > allowed) {
      errors.push(`${file}:${found.join(',')}: ${found.length} real-time waits where ${allowed} are allowed. Wait for simulation steps instead (a ticks() count, phaseSince(), stepUntil in e2e/helpers.ts), or say why real time is fine in an \`// L-042:\` comment on the line (L-042)`);
    } else if (found.length < allowed) {
      errors.push(`${file}: ${found.length} real-time waits, fewer than the ${allowed} allowed: lower its count in REALTIME_WAITS in scripts/check.mjs (L-042)`);
    }
  }
  for (const file of Object.keys(REALTIME_WAITS)) if (!exists(file)) errors.push(`${file} is gone: remove it from REALTIME_WAITS in scripts/check.mjs (L-042)`);
  return errors;
}

// L-054: a playtest that pins the whole saved game, or the whole saved settings, with toEqual breaks on every new field of the
// save. Read the fields the rule is about with toMatchObject; a test of the save format itself marks its line `// L-054: format`.
function checkWholeSavePins() {
  const errors = [];
  const pin = /(savedGame\([^)]*\)\)?(\?\.\w+)?\)|\.settings\))\.toEqual\(/;
  for (const f of textFiles().filter((p) => p.startsWith(join('e2e', '')) && p.endsWith('.ts'))) {
    read(f).split('\n').forEach((line, i) => {
      if (pin.test(line) && !/\/\/.*\bL-054: format\b/.test(line)) errors.push(`${f.split(sep).join('/')}:${i + 1}: the saved game or settings compared whole with toEqual; check the fields the rule is about with toMatchObject (L-054)`);
    });
  }
  return errors;
}

// L-045: a screenshot scenario that only the phone takes shows what a phone player sees, so it is driven by touch: no keyboard
// press in a test that skips the desktop (the phone project has a keyboard, and its key presses switch the tips to the keyboard's words).
function checkPhoneShotsByTouch() {
  const errors = [];
  for (const f of textFiles().filter((p) => p.startsWith(join('e2e', 'shots', '')) && p.endsWith('.ts'))) {
    const blocks = read(f).split(/\n(?=test\()/);
    for (const block of blocks) {
      if (!/test\.skip\(!isMobile\b/.test(block)) continue;
      if (/\bpress\(|\.keyboard\./.test(block)) errors.push(`${f.split(sep).join('/')}: "${block.slice(0, 80).split('\n')[0]}" takes the phone only but presses keys; drive it by touch as a phone player does (L-045)`);
    }
  }
  return errors;
}

// L-020: a mutation run that was killed leaves its marker, and the mutated file, behind (scripts/mutate.mjs). The runner
// itself sets PONCHO_MUTATING for the test it runs, so a mutant tested against the gate is judged by the other checks.
function checkNoMutation() {
  if (process.env['PONCHO_MUTATING'] === '1') return [];
  return exists('.mutating.json') ? ['.mutating.json exists: a mutation run was interrupted and a file may still be mutated. Run node scripts/mutate.mjs --restore'] : [];
}

const checks = [
  ['no-mutation', checkNoMutation],
  ['key-down-handlers', checkKeyDownHandlers],
  ['realtime-waits', checkRealtimeWaits],
  ['whole-save-pins', checkWholeSavePins],
  ['phone-shots-by-touch', checkPhoneShotsByTouch],
  ['gdd', checkGdd],
  ['gdd-open-questions', checkOpenQuestionRefs],
  ['gdd-references', checkReferences],
  ['backlog', checkBacklog],
  ['lessons', checkLessons],
  ['lesson-references', checkLessonRefs],
  ['skills', checkSkills],
  ['agents', checkAgents],
  ['claude-settings', checkClaudeSettings],
  ['harness-paths', checkHarnessPaths],
  ['no-model-ids', checkNoModelIds],
  ['toolchain', checkToolchain],
];

// ---- main ------------------------------------------------------------------

const lessonsArg = process.argv.indexOf('--lessons');
if (lessonsArg !== -1) {
  const next = process.argv[lessonsArg + 1];
  process.exit(printLessons(next && !next.startsWith('--') ? next.split(',').map((a) => a.trim()).filter(Boolean) : []));
}

if (process.argv.includes('--backlog-stub')) {
  const have = new Set(parseBacklog().map((r) => r.id));
  for (const d of parseGdd().defs) {
    if (!have.has(d.id)) console.log(`| ${d.id} | ${d.status === 'Deprecated' ? 'cut' : 'todo'} |  |`);
  }
  process.exit(0);
}

let failed = 0;
for (const [name, fn] of checks) {
  const errors = fn();
  if (errors.length === 0) {
    console.log(`ok    ${name}`);
  } else {
    failed += errors.length;
    console.log(`FAIL  ${name}`);
    for (const e of errors) console.log(`      ${e}`);
  }
}
console.log(failed === 0 ? '\nAll checks passed.' : `\n${failed} problem(s) found.`);
process.exit(failed === 0 ? 0 : 1);
