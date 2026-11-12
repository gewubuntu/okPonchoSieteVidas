import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  appendLessons,
  bumpLevel,
  gddVersion,
  insertOwnVersion,
  lessonIds,
  lessonRenames,
  nextVersion,
  renameLessons,
  stripLessons,
  stripOwnVersion,
  syncMain,
} from './sync-main.mjs';

const gdd = (versions, body = 'Rule A.\n\nRule B.') =>
  ['# GDD', '', `Version: ${versions[0]}`, '', '## Changelog', '', ...versions.map((v) => `- **${v}** (2026-11-03) GDD-WLD-09: text ${v}`), '', '## Rules', '', body, ''].join('\n');

const lesson = (id, title, extra = '') => `## ${id} ${title}\n\n- **Rule:** rule of ${title}${extra}\n- **Recurrence:** 1\n`;
const lessons = (...entries) => ['# Lessons', '', 'Append-only.', '', entries.join('\n')].join('\n');

describe('sync-main: the GDD version (L-077)', () => {
  it('reads the version', () => {
    expect(gddVersion(gdd(['0.11.4']))).toBe('0.11.4');
    expect(gddVersion('# GDD\n')).toBeNull();
  });

  it('names the part of the version a branch raised', () => {
    expect(bumpLevel('0.11.4', '0.11.5')).toBe('patch');
    expect(bumpLevel('0.11.4', '0.12.0')).toBe('minor');
    expect(bumpLevel('0.11.4', '1.0.0')).toBe('major');
  });

  it('counts on from main at that level', () => {
    expect(nextVersion('0.11.5', 'patch')).toBe('0.11.6');
    expect(nextVersion('0.11.5', 'minor')).toBe('0.12.0');
    expect(nextVersion('0.11.5', 'major')).toBe('1.0.0');
  });

  it('takes the branch\'s own version out and puts the base\'s back', () => {
    const base = gdd(['0.11.4', '0.11.3']);
    const { text, lines } = stripOwnVersion(base, gdd(['0.11.5', '0.11.4', '0.11.3']));
    expect(text).toBe(base);
    expect(lines).toEqual(['- **0.11.5** (2026-11-03) GDD-WLD-09: text 0.11.5']);
  });

  it('leaves a GDD with no version of its own as it is', () => {
    const base = gdd(['0.11.4', '0.11.3']);
    expect(stripOwnVersion(base, gdd(['0.11.4', '0.11.3'], 'Rule C.'))).toEqual({ text: gdd(['0.11.4', '0.11.3'], 'Rule C.'), lines: [] });
  });

  it('puts the branch\'s line back on top under the new version', () => {
    const out = insertOwnVersion(gdd(['0.11.5', '0.11.4']), '- **0.11.5** (2026-11-12) GDD-BOS-03: mine', '0.11.6');
    expect(gddVersion(out)).toBe('0.11.6');
    expect(out.split('\n').filter((l) => l.startsWith('- **'))).toEqual([
      '- **0.11.6** (2026-11-12) GDD-BOS-03: mine',
      '- **0.11.5** (2026-11-03) GDD-WLD-09: text 0.11.5',
      '- **0.11.4** (2026-11-03) GDD-WLD-09: text 0.11.4',
    ]);
    expect(() => insertOwnVersion('# GDD\n\nVersion: 0.1.0\n', '- **0.1.0** x', '0.1.1')).toThrow();
  });
});

describe('sync-main: lesson IDs (L-077)', () => {
  const base = lessons(lesson('L-010', 'old'), lesson('L-011', 'older'));

  it('lists the IDs that head an entry, not the ones cited', () => {
    expect(lessonIds(lessons(lesson('L-010', 'old', ' (see L-012)'), lesson('L-011', 'older')))).toEqual(['L-010', 'L-011']);
  });

  it('numbers the branch\'s lessons after main\'s highest', () => {
    const ours = base + '\n' + lesson('L-012', 'mine') + '\n' + lesson('L-013', 'mine too');
    const theirs = base + '\n' + lesson('L-012', 'theirs');
    expect([...lessonRenames(base, ours, theirs)]).toEqual([['L-012', 'L-013'], ['L-013', 'L-014']]);
  });

  it('renames nothing when only one side added lessons', () => {
    const more = base + '\n' + lesson('L-012', 'new');
    expect(lessonRenames(base, more, base).size).toBe(0);
    expect(lessonRenames(base, base, more).size).toBe(0);
  });

  it('rewrites the cited IDs all at once, and no other', () => {
    const renames = new Map([['L-012', 'L-013'], ['L-013', 'L-014']]);
    expect(renameLessons('L-012, L-013 and L-011 (XL-012, L-0121)', renames)).toBe('L-013, L-014 and L-011 (XL-012, L-0121)');
  });

  it('takes entries out and appends them again', () => {
    const text = base + '\n' + lesson('L-012', 'mine');
    const { text: kept, entries } = stripLessons(text, new Set(['L-012']));
    expect(lessonIds(kept)).toEqual(['L-010', 'L-011']);
    expect(entries).toEqual([lesson('L-012', 'mine')]);
    expect(appendLessons(kept, entries)).toBe(text);
    // An entry from the middle takes only its own lines.
    expect(lessonIds(stripLessons(text, new Set(['L-011'])).text)).toEqual(['L-010', 'L-012']);
    expect(stripLessons('# Lessons\n', new Set(['L-012']))).toEqual({ text: '# Lessons\n', entries: [] });
  });
});

// Each test starts some forty git processes, which is slow on Windows: a time limit well above the default.
describe('sync-main: the merge, in a scratch repository (L-077)', { timeout: 60_000 }, () => {
  let dir;
  afterEach(() => dir && rmSync(dir, { recursive: true, force: true }));

  const git = (...args) => {
    const r = spawnSync('git', args, { cwd: dir, encoding: 'utf8' });
    if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr}`);
    return r.stdout.trim();
  };
  const write = (files) => {
    for (const [path, text] of Object.entries(files)) {
      mkdirSync(dirname(join(dir, path)), { recursive: true });
      writeFileSync(join(dir, path), text);
    }
  };
  const commit = (message, files) => {
    write(files);
    git('add', '-A');
    git('commit', '-q', '-m', message);
  };
  const file = (path) => readFileSync(join(dir, path), 'utf8');

  /** A base commit, then main and the branch each on top of it; the branch is checked out and main is `origin/main`. */
  const repo = (mainFiles, branchFiles) => {
    dir = mkdtempSync(join(tmpdir(), 'sync-main-test-'));
    git('init', '-q', '-b', 'main');
    for (const [k, v] of [['user.name', 'test'], ['user.email', 'test@example.invalid'], ['commit.gpgsign', 'false'], ['core.autocrlf', 'false']]) git('config', k, v);
    commit('base', {
      'docs/GDD.md': gdd(['0.1.0']),
      'docs/LESSONS.md': lessons(lesson('L-001', 'first')),
      'src/a.ts': 'export const a = 1;\n',
      'src/b.ts': 'export const b = 1;\n',
    });
    git('checkout', '-q', '-b', 'stream');
    commit('branch', branchFiles);
    git('checkout', '-q', 'main');
    commit('main', mainFiles);
    git('update-ref', 'refs/remotes/origin/main', 'HEAD');
    git('checkout', '-q', 'stream');
  };

  const mainFiles = {
    'docs/GDD.md': gdd(['0.1.1', '0.1.0'], 'Rule A, changed on main.\n\nRule B.'),
    'docs/LESSONS.md': lessons(lesson('L-001', 'first'), lesson('L-002', 'from main')),
    'src/b.ts': 'export const b = 1; // L-002\n',
  };
  const branchFiles = {
    'docs/GDD.md': gdd(['0.1.1', '0.1.0'], 'Rule A.\n\nRule B, changed on the branch (L-002).').replace('text 0.1.1', 'the branch\'s line'),
    'docs/LESSONS.md': lessons(lesson('L-001', 'first', ' (again in L-002)'), lesson('L-002', 'from the branch')),
    'src/a.ts': 'export const a = 1; // L-002, see L-001\n',
  };

  it('keeps both sides and renumbers the branch\'s version and lesson', () => {
    repo(mainFiles, branchFiles);
    const said = [];
    expect(syncMain(dir, { fetch: false, log: (line) => said.push(line) })).toBe(0);

    const merged = file('docs/GDD.md');
    expect(gddVersion(merged)).toBe('0.1.2');
    expect(merged.split('\n').filter((l) => l.startsWith('- **'))).toEqual([
      '- **0.1.2** (2026-11-03) GDD-WLD-09: the branch\'s line',
      '- **0.1.1** (2026-11-03) GDD-WLD-09: text 0.1.1',
      '- **0.1.0** (2026-11-03) GDD-WLD-09: text 0.1.0',
    ]);
    expect(merged).toContain('Rule A, changed on main.');
    expect(merged).toContain('Rule B, changed on the branch (L-003).');

    const log = file('docs/LESSONS.md');
    expect(lessonIds(log)).toEqual(['L-001', 'L-002', 'L-003']);
    expect(log).toContain('## L-002 from main');
    expect(log).toContain('## L-003 from the branch');
    expect(log).toContain('(again in L-003)');
    expect(file('src/a.ts')).toBe('export const a = 1; // L-003, see L-001\n');
    expect(file('src/b.ts')).toBe('export const b = 1; // L-002\n'); // main's own citation keeps its ID

    expect(git('status', '--porcelain')).toBe('');
    expect(git('rev-list', '--parents', '-n', '1', 'HEAD').split(' ')).toHaveLength(3); // a merge commit, not a rebase
    expect(said.join('\n')).toContain('lesson L-002 is now L-003');
    expect(said.join('\n')).toContain('GDD version 0.1.1 is now 0.1.2');
  });

  it('renames a lesson cited in a file both sides changed, without touching main\'s citation', () => {
    repo({ ...mainFiles, 'src/a.ts': 'export const a = 1;\n// main cites L-002\n' }, { ...branchFiles, 'src/a.ts': '// the branch cites L-002\nexport const a = 1;\n' });
    expect(syncMain(dir, { fetch: false, log: () => {} })).toBe(0);
    expect(file('src/a.ts')).toBe('// the branch cites L-003\nexport const a = 1;\n// main cites L-002\n');
  });

  it('leaves a conflict it cannot settle to the session, and does not commit', () => {
    repo({ ...mainFiles, 'src/a.ts': 'export const a = 2;\n' }, { ...branchFiles, 'src/a.ts': 'export const a = 3;\n' });
    const said = [];
    expect(syncMain(dir, { fetch: false, log: (line) => said.push(line) })).toBe(1);
    expect(said.join('\n')).toContain('conflicts left for you in src/a.ts');
    expect(existsSync(join(dir, '.git', 'MERGE_HEAD'))).toBe(true);
    // What it could settle is settled and staged.
    expect(gddVersion(file('docs/GDD.md'))).toBe('0.1.2');
    expect(lessonIds(file('docs/LESSONS.md'))).toEqual(['L-001', 'L-002', 'L-003']);
  });

  it('merges plainly when the branch added no version and no lesson', () => {
    repo(mainFiles, { 'src/a.ts': 'export const a = 4;\n' });
    expect(syncMain(dir, { fetch: false, log: () => {} })).toBe(0);
    expect(gddVersion(file('docs/GDD.md'))).toBe('0.1.1');
    expect(lessonIds(file('docs/LESSONS.md'))).toEqual(['L-001', 'L-002']);
    expect(file('src/a.ts')).toBe('export const a = 4;\n');
  });

  it('does nothing when the branch already contains main, and refuses a dirty tree', () => {
    repo(mainFiles, branchFiles);
    write({ 'src/a.ts': 'export const a = 5;\n' });
    const said = [];
    expect(syncMain(dir, { fetch: false, log: (line) => said.push(line) })).toBe(1);
    expect(said.join('\n')).toContain('uncommitted changes');
    git('checkout', '-q', '--', 'src/a.ts');
    expect(syncMain(dir, { fetch: false, log: () => {} })).toBe(0);
    const head = git('rev-parse', 'HEAD');
    expect(syncMain(dir, { fetch: false, log: (line) => said.push(line) })).toBe(0);
    expect(said.join('\n')).toContain('already contains origin/main');
    expect(git('rev-parse', 'HEAD')).toBe(head);
  });
});
