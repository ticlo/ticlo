import {defineConfig} from 'vitest/config';
import react from '@vitejs/plugin-react';
import {nodePolyfills} from 'vite-plugin-node-polyfills';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths(), react(), nodePolyfills()],
  test: {
    browser: {
      provider: 'webdriverio',
      enabled: true,
      // at least one instance is required
      instances: [
        {
          browser: 'chrome',
          capabilities: {
            'browserName': 'chrome',
            'webSocketUrl': true,
            'goog:chromeOptions': {
              args: ['--headless=new', '--disable-gpu'],
            },
          },
        },
      ],
    },
    isolate: false,
    globals: true,
    include: ['packages/core/**/*.spec.ts', 'packages/html/**/*.spec.ts', 'packages/react/**/*.spec.(ts|tsx)'],
    setupFiles: ['packages/html/vitest.setup.ts'],

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
      'packages/editor/**',
      'bin/**',
      'example/**',
      'tool/**',
    ],
  },
});
