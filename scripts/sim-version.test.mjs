import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SIM_VERSION } from '../src/sim/version';
import { currentSimVersion, simVersion } from './sim-version.mjs';

/** A few files of each kind the version reads, and of none. */
const BASE = [
  { path: 'src/sim/run.ts', text: 'export const a = 1;\n' },
  { path: 'src/sim/movement.ts', text: 'export const b = 2;\n' },
  { path: 'src/config/tuning.ts', text: 'export const T = 3;\n' },
  { path: 'src/levels/level1-1.ts', text: 'export const L = 4;\n' },
];
const base = simVersion(BASE);
/** The version with one file's text changed, or with a file added. */
const changed = (path) => simVersion([...BASE.filter((f) => f.path !== path), { path, text: 'export const z = 9;\n' }]);

describe('GDD-TEC-09 simulation version', () => {
  it('GDD-TEC-09 is 16 hex digits', () => {
    expect(base).toMatch(/^[0-9a-f]{16}$/);
  });

  it('GDD-TEC-09 changes when a simulation file, tuning.ts or a level file changes', () => {
    for (const path of ['src/sim/run.ts', 'src/config/tuning.ts', 'src/levels/level1-1.ts', 'src/sim/new.ts', 'src/levels/new.ts']) expect(changed(path), path).not.toBe(base);
  });

  it('GDD-TEC-09 does not change for a file outside the simulation', () => {
    const outside = [
      'src/sim/run.test.ts',
      'src/sim/all-abilities.setup.ts',
      'src/levels/glide-unlocked.setup.ts',
      'src/levels/level3-3.drive.ts',
      'src/levels/bots.ts',
      'src/levels/sightSweep.ts',
      'src/levels/tape.ts',
      'src/config/other.ts',
      'src/config/tuning.test.ts',
      'src/ui/hud.ts',
      'src/sim/deeper/x.ts',
      'src/levels/deeper/x.ts',
      'src/scenes/PlayScene.ts',
      'scripts/sim-version.mjs',
      'src/sim/run.ts.orig',
      'x/src/sim/run.ts',
    ];
    for (const path of outside) expect(changed(path), path).toBe(base);
  });

  it('GDD-TEC-09 is the same whatever order the files are given in', () => {
    expect(simVersion([...BASE].reverse())).toBe(base);
    expect(simVersion([BASE[2], BASE[0], BASE[3], BASE[1]])).toBe(base);
  });

  it('GDD-TEC-09 is the same with CRLF line ends', () => {
    expect(simVersion(BASE.map((f) => ({ ...f, text: f.text.replace(/\n/g, '\r\n') })))).toBe(base);
    // A lone CR is not a line end that is read as one.
    expect(simVersion(BASE.map((f) => ({ ...f, text: f.text.replace(/\n/g, '\r') })))).not.toBe(base);
  });

  it('GDD-TEC-09 changes when a file is renamed', () => {
    expect(simVersion(BASE.map((f) => (f.path === 'src/sim/run.ts' ? { ...f, path: 'src/sim/run2.ts' } : f)))).not.toBe(base);
  });

  it('GDD-TEC-09 changes when text moves from one file to the next', () => {
    const a = [{ path: 'src/sim/a.ts', text: 'xy' }, { path: 'src/sim/b.ts', text: 'z' }];
    const b = [{ path: 'src/sim/a.ts', text: 'x' }, { path: 'src/sim/b.ts', text: 'yz' }];
    expect(simVersion(a)).not.toBe(simVersion(b));
    // Two files, and one file whose text holds the second's path and text: a mark after each text keeps them apart.
    const two = [{ path: 'src/sim/a.ts', text: 'x' }, { path: 'src/sim/b.ts', text: 'z' }];
    const one = [{ path: 'src/sim/a.ts', text: 'xsrc/sim/b.ts\0z' }];
    expect(simVersion(two)).not.toBe(simVersion(one));
  });

  it('GDD-TEC-09 reads the three folders of a checkout', () => {
    const root = mkdtempSync(join(tmpdir(), 'sim-version-'));
    try {
      const files = [...BASE, { path: 'src/ui/hud.ts', text: 'ui' }, { path: 'src/sim/deeper/x.ts', text: 'deep' }];
      for (const f of files) {
        mkdirSync(join(root, dirname(f.path)), { recursive: true });
        writeFileSync(join(root, f.path), f.text);
      }
      expect(currentSimVersion(root)).toBe(base);
      for (const path of ['src/sim/run.ts', 'src/config/tuning.ts', 'src/levels/level1-1.ts']) {
        writeFileSync(join(root, path), 'changed');
        expect(currentSimVersion(root), path).not.toBe(base);
        writeFileSync(join(root, path), BASE.find((f) => f.path === path).text);
      }
      expect(currentSimVersion(root)).toBe(base);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('GDD-TEC-09 the version the tests run with is the version of the files on disk', () => {
    expect(SIM_VERSION).not.toBe('unbuilt');
    expect(SIM_VERSION).toBe(currentSimVersion());
  });
});
