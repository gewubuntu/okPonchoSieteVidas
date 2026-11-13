// The gate's toolchain slots (lint, typecheck, the test suites) run in concurrent lanes instead of one after another (L-080).
// Measured on 4 cores: `test` alone is 244 s on about 3.6 cores, `test:sight` is 341 s on ONE core, `lint`, `typecheck`,
// `test:abilities` and `test:glide` together under 40 s; serial, the gate was about 10 minutes, and while the sight sweep ran,
// three cores sat idle.
//
// A lane is a list of slot names that run one after another (suites that each fill every core go in one lane so they do not
// fight each other, and a later suite never starts on a machine already loaded by the one before it). Lanes run side by side.
// Nothing is skipped and nothing is narrowed: every slot runs in full and every failure is reported by name, with its own
// output kept whole, printed in the slot order the caller gave, never interleaved.

/**
 * @param {readonly (readonly string[])[]} lanes slot names per lane; every name appears once
 * @param {(name: string) => Promise<{ status: number | null; output: string }>} run runs one slot to the end
 * @param {(line: string) => void} [log] progress lines ("started", "finished in Ns"), written as they happen
 * @param {() => number} [now] a clock in milliseconds
 * @param {(result: { name: string; ok: boolean; output: string; seconds: number }) => void} [onDone] called the moment a slot ends, so a failure can be shown at once
 * @returns {Promise<{ name: string; ok: boolean; output: string; seconds: number }[]>} one result per slot, in lane order, lane by lane
 */
export async function runLanes(lanes, run, log = () => {}, now = Date.now, onDone = () => {}) {
  const done = new Map();
  await Promise.all(
    lanes.map(async (lane) => {
      for (const name of lane) {
        const t0 = now();
        log(`  started  ${name}`);
        let r;
        try {
          r = await run(name);
        } catch (e) {
          r = { status: null, output: `could not run: ${e instanceof Error ? e.message : String(e)}\n` };
        }
        const seconds = Math.round((now() - t0) / 1000);
        log(`  finished ${name} in ${seconds}s (${r.status === 0 ? 'ok' : 'FAILED'})`);
        const result = { name, ok: r.status === 0, output: r.output, seconds };
        done.set(name, result);
        onDone(result);
      }
    }),
  );
  return lanes.flat().map((name) => done.get(name));
}

/**
 * The lanes for the slots a package defines, in the order they are listed in `order`: the slots of one lane keep their relative
 * order, a slot the package does not define is left out and an empty lane disappears. `serial` puts every slot in one lane.
 * @param {readonly (readonly string[])[]} order
 * @param {ReadonlySet<string> | readonly string[]} defined
 * @param {boolean} [serial]
 */
export function lanesFor(order, defined, serial = false) {
  const have = new Set(defined);
  const lanes = order.map((lane) => lane.filter((n) => have.has(n))).filter((lane) => lane.length > 0);
  return serial && lanes.length > 0 ? [lanes.flat()] : lanes;
}
