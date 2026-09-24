import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/types.ts', 'src/index.ts'],
      thresholds: {
        // Global floor — CI fails if overall coverage drops below these
        lines: 74.81,
        branches: 71.02,
        functions: 85.49,
        statements: 76.07,
        // autoUpdate ratchets these numbers up when coverage improves
        autoUpdate: true,
      },
      reporter: ['text', 'json-summary'],
    },
  },
});