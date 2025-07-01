import {defineConfig} from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    globalSetup: 'packages/node/vitest.global.setup.ts',
    setupFiles: 'packages/node/vitest.setup.ts',
    include: ['packages/core/**/*.spec.ts', 'packages/node/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['lcov'],
      reportsDirectory: './coverage/node',
    },
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/cypress/**',
      '**/.{idea,git,cache,output,temp}/**',
      'packages/editor/**',
      'bin/**',
      'example/**',
      'tool/**',
    ],
  },
});
