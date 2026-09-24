import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/types.ts', 'src/index.ts'],
      thresholds: {
        // Global floor — CI fails if overall coverage drops below these
        lines: 97.79,
        branches: 88.69,
        functions: 99.24,
        statements: 97.13,
        // autoUpdate ratchets these numbers up when coverage improves
        autoUpdate: true,
      },
      reporter: ['text', 'json-summary'],
    },
  },
});