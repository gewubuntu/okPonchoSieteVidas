import { describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { runLimited, verdict } from './run-limited.mjs';

describe('run-limited (L-064)', () => {
  const alive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  it('gives the status and the output of a command that ends in time', async () => {
    expect(await runLimited('echo out; echo err >&2; exit 3', { seconds: 20 })).toEqual({ started: true, status: 3, output: 'out\nerr\n', stopped: false });
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
    expect(r).toEqual({ started: true, status: 0, output: '', stopped: false });
  });
  it('says so when the command could not be started', async () => {
    expect(await runLimited('true', { cwd: '/no-such-dir-for-run-limited', seconds: 20 })).toEqual({ started: false, status: null, output: '', stopped: false });
  });

  it('says so when starting the command throws, and when the child has no pipes and fails', async () => {
    const threw = await runLimited('x', { seconds: 20 }, () => { throw new Error('cannot start'); });
    expect(threw).toEqual({ started: false, status: null, output: '', stopped: false });
    expect(verdict(threw)).toBe('not started');
    // What Node gives when no file handle is left: a child without stdout and stderr, then its error.
    const child = new EventEmitter();
    const run = runLimited('x', { seconds: 20 }, () => child);
    child.emit('error', new Error('EMFILE'));
    expect(await run).toEqual({ started: false, status: null, output: '', stopped: false });
  });

  it('starts the command in a shell, in a group of its own, with what it was given', async () => {
    const seen = [];
    const child = new EventEmitter();
    const run = runLimited('the command', { cwd: '/a', env: { A: '1' }, seconds: 20 }, (...args) => { seen.push(args); return child; });
    child.emit('close', 0);
    await run;
    expect(seen).toEqual([['the command', { cwd: '/a', env: { A: '1' }, shell: true, detached: true, stdio: ['ignore', 'pipe', 'pipe'] }]]);
  });

  it('stops the command when its seconds have passed, and not a millisecond before', async () => {
    vi.useFakeTimers();
    try {
      for (const [waited, stopped] of [[19_999, false], [20_000, true]]) {
        const child = new EventEmitter();
        const run = runLimited('x', { seconds: 20 }, () => child);
        vi.advanceTimersByTime(waited);
        child.emit('close', null);
        expect((await run).stopped).toBe(stopped);
      }
    } finally {
      vi.useRealTimers();
    }
  });

  it('leaves no timer behind once the command has ended or failed', async () => {
    vi.useFakeTimers();
    try {
      for (const event of [['close', 0], ['error', new Error('x')]]) {
        const child = new EventEmitter();
        const run = runLimited('x', { seconds: 20 }, () => child);
        expect(vi.getTimerCount()).toBe(1);
        child.emit(...event);
        await run;
        expect(vi.getTimerCount()).toBe(0);
      }
    } finally {
      vi.useRealTimers();
    }
  });

  it.each(['SIGINT', 'SIGTERM', 'SIGHUP'])('ends what the command started when %s ends the runner, and ends with that signal', async (signal) => {
    const dir = mkdtempSync(join(tmpdir(), 'run-limited-'));
    try {
      const module = fileURLToPath(new URL('./run-limited.mjs', import.meta.url));
      const script = `import { runLimited } from ${JSON.stringify(module)}; await runLimited(${JSON.stringify(`sleep 60 & echo $! > ${join(dir, 'pid')}; wait`)}, { seconds: 50 });`;
      const runner = spawn(process.execPath, ['--input-type=module', '-e', script], { stdio: 'ignore' });
      const ended = new Promise((resolve) => runner.on('exit', (code, by) => resolve({ code, by })));
      for (let i = 0; i < 100 && !existsSync(join(dir, 'pid')); i++) await wait(100);
      await wait(100);
      const pid = Number(readFileSync(join(dir, 'pid'), 'utf8'));
      expect(alive(pid)).toBe(true);
      runner.kill(signal);
      expect(await ended).toEqual({ code: null, by: signal });
      for (let i = 0; i < 50 && alive(pid); i++) await wait(100);
      expect(alive(pid)).toBe(false);
    } finally {
      rmSync(dir, { recursive: true });
    }
  }, 30_000);

  it('takes its signal handlers off again when the command has ended', async () => {
    const before = ['SIGINT', 'SIGTERM', 'SIGHUP'].map((s) => process.listenerCount(s));
    await runLimited('true', { seconds: 20 });
    await runLimited('true', { cwd: '/no-such-dir-for-run-limited', seconds: 20 });
    expect(['SIGINT', 'SIGTERM', 'SIGHUP'].map((s) => process.listenerCount(s))).toEqual(before);
  });

  it('reads a run: only a test that went red is a kill', () => {
    const run = (over) => ({ started: true, status: 1, output: '1 failed', stopped: false, ...over });
    expect(verdict(run({}))).toBe('caught');
    expect(verdict(run({ status: 0, output: '1 passed' }))).toBe('survived');
    expect(verdict(run({ status: null, stopped: true }))).toBe('stopped');
    expect(verdict(run({ started: false, status: null, output: '' }))).toBe('not started');
    expect(verdict(run({ output: 'Running 0 tests\nError: No tests found\n' }))).toBe('no test');
    expect(verdict(run({ output: 'filter: x\nNo test files found, exiting with code 1\n' }))).toBe('no test');
    expect(verdict(run({ output: "  expect(text).toBe('Error: No tests found')\n  a test said: No test files found" }))).toBe('caught');
    // Vitest colours the line when told to; the codes are no part of it.
    expect(verdict(run({ output: '\x1b[31mNo test files found, exiting with code 1\x1b[39m\n' }))).toBe('no test');
    expect(verdict(run({ output: '\x1b[1m\x1b[31mError: No tests found\x1b[0m' }))).toBe('no test');
    // The shell's own two answers for a command it cannot run or cannot find.
    expect(verdict(run({ status: 126 }))).toBe('not started');
    expect(verdict(run({ status: 127, output: 'sh: 1: no-such-command: not found' }))).toBe('not started');
    expect(verdict(run({ status: 125 }))).toBe('caught');
    expect(verdict(run({ status: 128 }))).toBe('caught');
    // A stop or a failed start is told before the output is read, and a failed start before a stop.
    expect(verdict(run({ stopped: true, output: 'Error: No tests found' }))).toBe('stopped');
    expect(verdict(run({ started: false, stopped: true }))).toBe('not started');
  });
});
