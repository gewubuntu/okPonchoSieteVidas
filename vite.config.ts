import { defineConfig } from 'vitest/config';

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
    environment: 'node',
  },
});
