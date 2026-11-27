import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { changelogRange, gitCheckIgnore, gitHoldsFiles, ignoredAmong, pathErrors, pathsIn, presentWhen } from './harness-paths.mjs';

describe('harness-paths (L-013)', () => {
  const have = new Set(['src/sim/run.ts', 'docs/GDD.md', 'assets/sprites/', 'e2e/boot.spec.ts']);
  const exists = (p) => have.has(p);

  it('reads each repository path in a backtick span, with its punctuation and line number removed', () => {
    expect(pathsIn('see `src/sim/run.ts:12-14`, `(docs/GDD.md),` and `node scripts/x.mjs e2e/a.spec.ts`')).toEqual([
      { path: 'src/sim/run.ts', planned: false },
      { path: 'docs/GDD.md', planned: false },
      { path: 'scripts/x.mjs', planned: false },
      { path: 'e2e/a.spec.ts', planned: false },
    ]);
  });

  it('takes a stop, a colon, a semicolon or a quote round a path for no part of it, and a single line number', () => {
    const paths = (line) => pathsIn(line).map((p) => p.path);
    expect(paths('`src/a.ts.` `src/b.ts:` `src/c.ts;` `"src/d.ts"` `\'src/e.ts\'` `src/f.ts:12`')).toEqual(['src/a.ts', 'src/b.ts', 'src/c.ts', 'src/d.ts', 'src/e.ts', 'src/f.ts']);
  });

  it('splits a span on any white space', () => {
    expect(pathsIn('`node  scripts/x.mjs\te2e/a.spec.ts`').map((p) => p.path)).toEqual(['scripts/x.mjs', 'e2e/a.spec.ts']);
  });

  it('reads a path under each root, and nothing outside them', () => {
    const roots = ['src/a', 'server/a', 'e2e/a', 'scripts/a', 'docs/a', 'assets/a', '.claude/a', '.github/a'];
    expect(pathsIn(roots.map((r) => `\`${r}\``).join(' ')).map((p) => p.path)).toEqual(roots);
    expect(pathsIn('`node_modules/a` `dist/a` `xsrc/a` `servers/a` `npm run test` src/not/in/backticks.ts')).toEqual([]);
  });

  it('takes a placeholder for no path', () => {
    expect(pathsIn('`docs/screenshots/<slug>/` `src/**/*.test.ts` `e2e/{a,b}.ts` `scripts/$NAME.mjs`')).toEqual([]);
    expect(pathsIn('`docs/a<b` `docs/a>b` `e2e/a{b` `e2e/a}b`')).toEqual([]);
  });

  it('marks a span planned only when the mark follows its closing backtick at once', () => {
    expect(pathsIn('`src/a.ts` (planned) and `src/b.ts`, (planned) later; `src/c.ts`  (planned)')).toEqual([
      { path: 'src/a.ts', planned: true },
      { path: 'src/b.ts', planned: false },
      { path: 'src/c.ts', planned: false },
    ]);
  });

  it('fails a path that does not exist, with its file and line', () => {
    expect(pathErrors('CLAUDE.md', 'ok `src/sim/run.ts`\nbad `src/sim/gone.ts`', exists)).toEqual([
      'CLAUDE.md:2: `src/sim/gone.ts` does not exist; fix the text that names it',
    ]);
  });

  it('lets a planned path through in a design document while it does not exist, and tells how to mark one', () => {
    const text = 'art goes into `assets/pals/` (planned)\nand `assets/gone/`';
    const errors = pathErrors('docs/GDD.md', text, exists, { planned: true });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('docs/GDD.md:2: `assets/gone/` does not exist');
    expect(errors[0]).toContain('" (planned)"');
  });

  it('fails a planned mark on a path that exists', () => {
    expect(pathErrors('docs/GDD.md', '`assets/sprites/` (planned)', exists, { planned: true })).toEqual([
      'docs/GDD.md:1: `assets/sprites/` is marked (planned) but exists; remove the mark and say what is built',
    ]);
  });

  it('ignores the planned mark in a harness file: a missing path fails there, an existing one passes', () => {
    expect(pathErrors('CLAUDE.md', '`assets/pals/` (planned)', exists)).toEqual(['CLAUDE.md:1: `assets/pals/` does not exist; fix the text that names it']);
    expect(pathErrors('CLAUDE.md', '`assets/sprites/` (planned)', exists)).toEqual([]);
  });

  it('leaves skipped lines alone and counts line numbers through them', () => {
    const text = '`src/gone1.ts`\n`src/gone2.ts`\n`src/gone3.ts`';
    expect(pathErrors('docs/GDD.md', text, exists, { skip: (i) => i === 1 })).toEqual([
      'docs/GDD.md:1: `src/gone1.ts` does not exist; fix the text that names it',
      'docs/GDD.md:3: `src/gone3.ts` does not exist; fix the text that names it',
    ]);
  });

  it('finds the changelog list: from its heading to the line before the next heading or rule', () => {
    expect(changelogRange(['# GDD', '## Changelog', '', '- **0.1.1** a', '- **0.1.0** b', '', '---', '## 1. Vision'])).toEqual({ start: 1, end: 5 });
    expect(changelogRange(['## Changelog', '- a', '## 1. Vision', '- b'])).toEqual({ start: 0, end: 1 });
    expect(changelogRange(['## Changelog', '- a', '# Top'])).toEqual({ start: 0, end: 1 });
    expect(changelogRange(['## Changelog', '### not an end', '- a'])).toEqual({ start: 0, end: 2 });
    expect(changelogRange(['## Changelog', '- a', '- b'])).toEqual({ start: 0, end: 2 });
    expect(changelogRange(['## Changelog  ', '- a', '---  ', '- b'])).toEqual({ start: 0, end: 1 });
    expect(changelogRange(['## Changelog', '- a', '--- a dash line that is no rule', '- b'])).toEqual({ start: 0, end: 3 });
  });

  it('finds no changelog where there is none, and not one whose heading only starts that way', () => {
    expect(changelogRange(['# GDD', '## 1. Vision'])).toBeNull();
    expect(changelogRange(['## Changelog of the art', '- a'])).toBeNull();
  });

  describe('a path git ignores counts as missing (L-083)', () => {
    it('gives the paths git writes back as ignored, asking once with each path ended by a NUL', () => {
      const asked = [];
      const checkIgnore = (input) => { asked.push(input); return { status: 0, stdout: 'server/dist/\0' }; };
      expect(ignoredAmong(['server/dist/', 'server/boot.ts', 'server/dist/'], checkIgnore)).toEqual(new Set(['server/dist/']));
      expect(asked).toEqual(['server/dist/\0server/boot.ts\0']);
    });

    it('asks nothing of a path that leaves the repository, and asks each path alone when git refuses one for another reason', () => {
      const asked = [];
      const checkIgnore = (input) => {
        asked.push(input);
        if (input.includes('server/link/')) return { status: 128, stdout: '' };
        return input === 'server/dist/\0' ? { status: 0, stdout: 'server/dist/\0' } : { status: 1, stdout: '' };
      };
      expect(ignoredAmong(['assets/../../poncho-art/', 'docs/../..', 'server/dist/', 'server/link/a.ts', 'docs/GDD.md'], checkIgnore)).toEqual(new Set(['server/dist/']));
      expect(asked).toEqual(['server/dist/\0server/link/a.ts\0docs/GDD.md\0', 'server/dist/\0', 'server/link/a.ts\0', 'docs/GDD.md\0']);
    });

    it('ignores none when git says none is ignored, when git cannot run, or when nothing is asked', () => {
      expect(ignoredAmong(['server/boot.ts'], () => ({ status: 1, stdout: '' }))).toEqual(new Set());
      expect(ignoredAmong(['server/dist/'], () => ({ status: 128, stdout: 'server/dist/\0' }))).toEqual(new Set());
      expect(ignoredAmong(['server/dist/'], () => ({ status: null, stdout: null }))).toEqual(new Set());
      const asked = [];
      expect(ignoredAmong([], (input) => { asked.push(input); return { status: 0, stdout: '' }; })).toEqual(new Set());
      expect(asked).toEqual([]);
    });

    it('asks the repository\'s own git: a build output it ignores is ignored, a tracked file is not, on any disk', () => {
      const root = fileURLToPath(new URL('..', import.meta.url));
      expect(ignoredAmong(['server/dist/main.js', 'docs/GDD.md', 'server/dist/main.js'], gitCheckIgnore(root))).toEqual(new Set(['server/dist/main.js']));
    });

    it('asks the git of the root it is given, not the one the gate runs in', () => {
      const root = mkdtempSync(join(tmpdir(), 'poncho-ignore-'));
      try {
        spawnSync('git', ['init', '-q'], { cwd: root });
        writeFileSync(join(root, '.gitignore'), 'build/\n');
        // A name git would quote (an accent, a quote mark) is written back as given.
        expect(ignoredAmong(['build/out.js', 'src/a.ts', 'build/café.js', 'build/a"b.js'], gitCheckIgnore(root))).toEqual(new Set(['build/out.js', 'build/café.js', 'build/a"b.js']));
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    });

    it('counts a path as there only when it is on this disk and not ignored, and a folder only when it holds a file git keeps', () => {
      const there = presentWhen((p) => p !== 'docs/gone.md', new Set(['server/dist/main.js', 'server/dist/']), (p) => p.endsWith('/'), (p) => p === 'docs/kept/' || p === 'server/dist/');
      expect(there('docs/GDD.md')).toBe(true);
      expect(there('docs/gone.md')).toBe(false);
      expect(there('server/dist/main.js')).toBe(false);
      expect(there('server/dist/')).toBe(false);
      expect(there('docs/kept/')).toBe(true);
      expect(there('docs/empty/')).toBe(false);
    });

    it('asks git whether a folder holds a file it tracks or would track: an empty folder, or one of ignored files only, holds none', () => {
      const root = mkdtempSync(join(tmpdir(), 'poncho-holds-'));
      try {
        spawnSync('git', ['init', '-q'], { cwd: root });
        writeFileSync(join(root, '.gitignore'), '*.log\n');
        for (const dir of ['tracked', 'untracked', 'logs', 'empty']) mkdirSync(join(root, dir));
        writeFileSync(join(root, 'tracked', 'a.md'), 'a');
        spawnSync('git', ['add', 'tracked/a.md'], { cwd: root });
        writeFileSync(join(root, 'untracked', 'b.md'), 'b');
        writeFileSync(join(root, 'logs', 'run.log'), 'c');
        const holds = gitHoldsFiles(root);
        expect(['tracked/', 'untracked/', 'logs/', 'empty/'].map(holds)).toEqual([true, true, false, false]);
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    });

    it('takes a folder to hold files where git cannot say, as outside any repository', () => {
      const root = mkdtempSync(join(tmpdir(), 'poncho-no-git-'));
      try {
        mkdirSync(join(root, 'empty'));
        expect(gitHoldsFiles(root)('empty/')).toBe(true);
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    });

    it('takes no line git writes that was not asked', () => {
      expect(ignoredAmong(['server/dist/'], () => ({ status: 0, stdout: 'server/dist/\0src/other.ts\0' }))).toEqual(new Set(['server/dist/']));
    });
  });
});
