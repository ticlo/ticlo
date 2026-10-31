import {defineConfig} from 'vitest/config';

export default defineConfig({
  resolve: {tsconfigPaths: true},
  test: {
    globals: true,
    setupFiles: 'packages/node/vitest.setup.ts',
    include: [
      'app/**/*.spec.ts',
      'packages/core/**/*.spec.ts',
      'packages/node/**/*.spec.ts',
      'packages/test/**/*.spec.ts',
      'packages/web-server/**/*.spec.ts',
      'packages/remote-storage/**/*.spec.ts',
      'packages/editor/**/*.node.test.ts',
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
      'packages/editor/**/*.spec.ts',
      'packages/editor/**/*.spec.tsx',
      'bin/**',
      'example/**',
      'tool/**',
    ],
  },
});
