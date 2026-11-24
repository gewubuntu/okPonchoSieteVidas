// GDD-TEC-09: the simulation version this build was made with (`scripts/sim-version.mjs`), which a record carries in its header.
// `vite.config.ts` defines it for the dev server, the build and `npm test`; a tool that loads the source with no such define (the
// other Vitest configs, Playwright's own process) sees 'unbuilt'. The dev server works it out once, at its start.
declare const __SIM_VERSION__: string | undefined;

export const SIM_VERSION: string = typeof __SIM_VERSION__ === 'string' ? __SIM_VERSION__ : 'unbuilt';
