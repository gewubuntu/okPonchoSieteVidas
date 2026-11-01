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
