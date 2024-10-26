import {defineConfig} from 'vitest/config';
import react from '@vitejs/plugin-react';
import {nodePolyfills} from 'vite-plugin-node-polyfills';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths(), react(), nodePolyfills()],
  test: {
    isolate: false,
    globals: true,
    include: ['src/react/**/*.spec.(ts|tsx)'],
    setupFiles: ['src/html/vitest.setup.ts'],
    browser: {
      enabled: true,
      headless: true,
      name: 'chrome',
    },
    coverage: {
      provider: 'istanbul',
      reporter: ['lcov'],
      reportsDirectory: './coverage/browser',
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
