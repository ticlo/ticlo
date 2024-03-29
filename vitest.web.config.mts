import {defineConfig} from 'vitest/config';
import react from '@vitejs/plugin-react';
import {nodePolyfills} from 'vite-plugin-node-polyfills';

export default defineConfig({
  plugins: [react(), nodePolyfills()],
  test: {
    isolate: false,
    globals: true,
    include: ['src/core/**/*.spec.ts', 'src/html/**/*.spec.ts'],
    setupFiles: ['src/html/vitest.setup.ts', 'src/react/vitest.setup.ts'],
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
