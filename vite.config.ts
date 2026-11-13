import { configDefaults, defineConfig } from 'vitest/config';

// L-063: worktrees that symlink node_modules would share Vite's dependency cache; one server re-optimizing it reloads the others'
// pages mid-test. A playtest server on its own port (PONCHO_E2E_PORT, L-060) gets its own cache.
const port = process.env['PONCHO_E2E_PORT'];

export default defineConfig({
  cacheDir: port ? `node_modules/.vite-${port}` : 'node_modules/.vite',
  server: { host: true, port: 5173 },
  build: {
    target: 'es2022',
    rollupOptions: {
      output: {
        // Keep the large engine bundle separate so game code changes do not invalidate it (GDD-TEC-03).
        manualChunks: (id: string) => (id.includes('node_modules/phaser') ? 'phaser' : undefined),
      },
    },
    chunkSizeWarningLimit: 1500,
  },
  test: {
    include: ['src/**/*.test.ts', 'scripts/**/*.test.mjs'],
    // GDD-WLD-03: the sight sweep runs on its own (`npm run test:sight`, `vitest.sight.config.ts`).
    exclude: [...configDefaults.exclude, 'src/levels/sight.test.ts'],
    environment: 'node',
    // L-079: under load from parallel worktrees a level test of 4 s takes 9 s; the default 5 s limit measured the load.
    testTimeout: 30000,
  },
});
