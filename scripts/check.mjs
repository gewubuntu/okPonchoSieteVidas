#!/usr/bin/env node
// The harness gate. Zero dependencies. Run before every commit and in CI.
//   node scripts/check.mjs                 run all checks
//   node scripts/check.mjs --backlog-stub  print backlog rows for GDD IDs missing from the backlog
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
function checkLessons() {
  if (!exists('docs/LESSONS.md')) return ['docs/LESSONS.md is missing'];
  const errors = [];
  const text = read('docs/LESSONS.md');
  const body = text.replace(/```[\s\S]*?```/g, ''); // ignore the template in the code fence
  const parts = body.split(/^(?=## L-\d{3}\b)/m).slice(1);
  const seen = new Set();
  for (const part of parts) {
    const id = /^## (L-\d{3})\b/.exec(part)[1];
    if (seen.has(id)) errors.push(`LESSONS: duplicate ${id}`);
    seen.add(id);
    const field = (name) => new RegExp(`^- \\*\\*${name}:\\*\\*\\s*(.+)$`, 'm').exec(part)?.[1].trim();
    for (const name of ['Date', 'What went wrong', 'Root cause', 'Rule', 'Recurrence', 'Promoted']) {
      if (!field(name)) errors.push(`LESSONS: ${id} is missing the "${name}" field`);
    }
    const date = field('Date');
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) errors.push(`LESSONS: ${id} Date must be YYYY-MM-DD`);
    const rec = field('Recurrence');
    if (rec !== undefined && !/^\d+$/.test(rec)) errors.push(`LESSONS: ${id} Recurrence must be a number`);
    else if (rec !== undefined && Number(rec) >= 2 && /^no\b/i.test(field('Promoted') ?? 'no')) {
      errors.push(`LESSONS: ${id} has Recurrence ${rec} but is not promoted (see the promotion rule)`);
    }
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
    const name = get('name');
    if (!name || !/^[a-z0-9][a-z0-9-]*$/.test(name)) errors.push(`AGENT: ${file} needs a name of lowercase letters, digits and dashes (no ":")`);
    else if (`${name}.md` !== entry) errors.push(`AGENT: ${file} name "${name}" must match the file name`);
    if (!get('description')) errors.push(`AGENT: ${file} has no description`);
    if (!get('tools')) errors.push(`AGENT: ${file} lists no tools; an agent without a tools line inherits everything`);
    const model = get('model');
    if (model && model.replace(/["']/g, '') !== 'inherit') {
      errors.push(`AGENT: ${file} model must be "inherit": repository files do not name models (CLAUDE.md)`);
    }
  }
  return errors;
}

// Project Claude Code settings: valid JSON, and every hook script it points at exists.
function checkClaudeSettings() {
  const file = join('.claude', 'settings.json');
  if (!exists(file)) return [];
  let settings;
  try { settings = JSON.parse(read(file)); } catch (e) { return [`SETTINGS: ${file} is not valid JSON: ${e.message}`]; }
  const errors = [];
  for (const [event, groups] of Object.entries(settings.hooks ?? {})) {
    for (const group of groups) {
      for (const hook of group.hooks ?? []) {
        for (const arg of hook.args ?? []) {
          const m = /^\$\{CLAUDE_PROJECT_DIR\}\/(.+)$/.exec(arg);
          if (m && !exists(m[1])) errors.push(`SETTINGS: ${event} hook points at ${m[1]}, which does not exist`);
        }
      }
    }
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
  for (const name of ['lint', 'typecheck', 'test']) {
    if (!scripts[name]) continue;
    console.log(`  running npm run ${name} ...`);
    const r = spawnSync('npm', ['run', name, '--silent'], { cwd: ROOT, stdio: 'inherit' });
    if (r.status !== 0) errors.push(`npm run ${name} failed`);
  }
  return errors;
}

const checks = [
  ['gdd', checkGdd],
  ['gdd-references', checkReferences],
  ['backlog', checkBacklog],
  ['lessons', checkLessons],
  ['skills', checkSkills],
  ['agents', checkAgents],
  ['claude-settings', checkClaudeSettings],
  ['no-model-ids', checkNoModelIds],
  ['toolchain', checkToolchain],
];

// ---- main ------------------------------------------------------------------

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
