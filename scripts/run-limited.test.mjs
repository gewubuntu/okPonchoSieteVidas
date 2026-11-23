import { describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runLimited } from './run-limited.mjs';

describe('run-limited (L-064)', () => {
  const alive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  it('gives the status and the output of a command that ends in time', async () => {
    expect(await runLimited('echo out; echo err >&2; exit 3', { seconds: 20 })).toEqual({ status: 3, output: 'out\nerr\n', stopped: false });
    expect((await runLimited('true', { seconds: 20 })).status).toBe(0);
  });

  it('runs the command where and with what it is told', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'run-limited-'));
    try {
      const r = await runLimited('pwd; echo "$PONCHO_TEST_VALUE"', { cwd: dir, env: { ...process.env, PONCHO_TEST_VALUE: 'seen' }, seconds: 20 });
      expect(r.output.trim().split('\n').map((l) => l.split('/').at(-1))).toEqual([dir.split('/').at(-1), 'seen']);
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  it('stops a command at its limit, and what the command started with it', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'run-limited-'));
    try {
      // The shell starts a child that would outlive it, notes the child's id, and waits.
      const started = Date.now();
      const r = await runLimited(`sleep 60 & echo $! > ${join(dir, 'pid')}; wait`, { seconds: 1 });
      expect(r.stopped).toBe(true);
      expect(r.status).toBeNull();
      expect(Date.now() - started).toBeLessThan(20_000);
      const pid = Number(readFileSync(join(dir, 'pid'), 'utf8'));
      expect(pid).toBeGreaterThan(1);
      for (let i = 0; i < 50 && alive(pid); i++) await wait(100);
      expect(alive(pid)).toBe(false);
    } finally {
      rmSync(dir, { recursive: true });
    }
  }, 30_000);

  it('does not call a command stopped that ended before its limit', async () => {
    const r = await runLimited('sleep 0.2', { seconds: 20 });
    expect(r).toEqual({ status: 0, output: '', stopped: false });
  });
});
