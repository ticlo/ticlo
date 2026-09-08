import {defineConfig} from 'vitest/config';

export default defineConfig({
  resolve: {tsconfigPaths: true},
  test: {
    globals: true,
    globalSetup: 'packages/node/vitest.global.setup.ts',
    setupFiles: 'packages/node/vitest.setup.ts',
    include: [
      'packages/core/**/*.spec.ts',
      'packages/node/**/*.spec.ts',
      'packages/test/**/*.spec.ts',
      'packages/web-server/**/*.spec.ts',
    ],
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
