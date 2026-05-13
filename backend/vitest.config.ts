import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Child-process pool preserves `node:` prefixes that the default vite
    // worker pool can strip (breaks `node:sqlite` resolution).
    pool: 'forks',
    coverage: {
      include: ['src/**/*.ts'],
      provider: 'v8',
    },
    snapshotFormat: {
      maxOutputLength: Number.MAX_SAFE_INTEGER,
    },
  },
});
