import { describe, expect, it } from 'vitest';
import { lanesFor, runLanes } from './gate-lanes.mjs';

const tick = (ms) => new Promise((r) => setTimeout(r, ms)); // L-042: only a slot's own length; no test orders two timers against each other

/** A runner whose slots take the given milliseconds and end with the given status; it records the order of starts and ends. */
function fake(spec) {
  const events = [];
  const run = async (name) => {
    events.push(`start ${name}`);
    await tick(spec[name].ms);
    events.push(`end ${name}`);
    return { status: spec[name].status ?? 0, output: `output of ${name}\n` };
  };
  return { run, events };
}

describe('runLanes (L-080)', () => {
  it('runs the lanes side by side and the slots of one lane one after another', async () => {
    // Deferred slots: each ends only when the test says so, so no clock decides the order.
    const started = [];
    const ends = {};
    const run = (name) => new Promise((resolve) => { started.push(name); ends[name] = () => resolve({ status: 0, output: '' }); });
    const flush = () => new Promise((r) => setImmediate(r));
    const all = runLanes([['a'], ['b', 'c']], run);
    await flush();
    expect(started).toEqual(['a', 'b']); // both lanes started; c waits behind b
    ends['b']();
    await flush();
    expect(started).toEqual(['a', 'b', 'c']); // c starts once b ended, while a still runs
    ends['c']();
    ends['a']();
    await all;
  });

  it('returns every slot in lane order, whichever finishes first, each with its own output', async () => {
    const { run } = fake({ slow: { ms: 40 }, fast: { ms: 1 } });
    const r = await runLanes([['slow'], ['fast']], run);
    expect(r.map((x) => x.name)).toEqual(['slow', 'fast']);
    expect(r.map((x) => x.output)).toEqual(['output of slow\n', 'output of fast\n']);
  });

  it('reports a failing slot by name and still runs every other slot, also the ones after it in its lane', async () => {
    const { run, events } = fake({ a: { ms: 1, status: 1 }, b: { ms: 1 }, c: { ms: 1, status: 2 } });
    const r = await runLanes([['a', 'b'], ['c']], run);
    expect(r.map((x) => [x.name, x.ok])).toEqual([['a', false], ['b', true], ['c', false]]);
    expect(events).toContain('end b');
  });

  it('counts a slot that could not start, or ended on a signal (status null), as a failure with the reason kept', async () => {
    const r = await runLanes([['x'], ['y']], async (name) => {
      if (name === 'x') throw new Error('spawn npm ENOENT');
      return { status: null, output: '' };
    });
    expect(r.map((x) => x.ok)).toEqual([false, false]);
    expect(r[0].output).toContain('spawn npm ENOENT');
  });

  it('hands each slot to onDone the moment it ends', async () => {
    const seen = [];
    await runLanes([['a', 'b']], async (n) => ({ status: n === 'a' ? 1 : 0, output: n }), () => {}, Date.now, (r) => seen.push([r.name, r.ok, r.output]));
    expect(seen).toEqual([['a', false, 'a'], ['b', true, 'b']]);
  });

  it('times each slot and logs its start and end', async () => {
    let t = 0;
    const lines = [];
    const r = await runLanes([['a']], async () => { t += 3400; return { status: 0, output: '' }; }, (l) => lines.push(l), () => t);
    expect(r[0].seconds).toBe(3);
    expect(lines).toEqual(['  started  a', '  finished a in 3s (ok)']);
  });

  it('names a failed slot in the log', async () => {
    const lines = [];
    await runLanes([['a']], async () => ({ status: 1, output: '' }), (l) => lines.push(l));
    expect(lines[1]).toContain('FAILED');
  });
});

describe('lanesFor (L-080)', () => {
  const order = [['sight'], ['lint'], ['typecheck'], ['test', 'test:abilities', 'test:glide']];

  it('keeps the lanes and the order inside a lane', () => {
    expect(lanesFor(order, ['lint', 'typecheck', 'test', 'test:abilities', 'test:glide', 'sight'])).toEqual(order);
  });

  it('leaves out slots the package does not define, and a lane left empty', () => {
    expect(lanesFor(order, ['lint', 'test:glide', 'test'])).toEqual([['lint'], ['test', 'test:glide']]);
  });

  it('puts every slot in one lane when serial', () => {
    expect(lanesFor(order, ['lint', 'test', 'sight'], true)).toEqual([['sight', 'lint', 'test']]);
  });

  it('is empty when the package defines none', () => {
    expect(lanesFor(order, [])).toEqual([]);
    expect(lanesFor(order, [], true)).toEqual([]);
  });
});
