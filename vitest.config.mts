import {defineConfig} from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    globalSetup: 'src/node/vitest.global.setup.ts',
    setupFiles: 'src/node/vitest.setup.ts',
    include: ['src/core/**/*.spec.ts', 'src/node/**/*.spec.ts'],
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
      'src/editor/**',
      'bin/**',
      'example/**',
      'tool/**',
    ],
  },
});
