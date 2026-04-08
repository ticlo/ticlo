import {defineConfig} from 'vitest/config';
import react from '@vitejs/plugin-react';
import {nodePolyfills} from 'vite-plugin-node-polyfills';
import tsconfigPaths from 'vite-tsconfig-paths';

import {webdriverio} from '@vitest/browser-webdriverio';

const isHeadless = process.env.HEADLESS !== 'false';

const chromeArgs = [
  '--disable-gpu',
  '--disable-dev-shm-usage',
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-web-security',
  '--disable-features=VizDisplayCompositor',
  '--disable-background-networking',
  '--disable-background-timer-throttling',
  '--disable-backgrounding-occluded-windows',
  '--disable-renderer-backgrounding',
  '--disable-field-trial-config',
  '--disable-ipc-flooding-protection',
  '--memory-pressure-off',
];

if (isHeadless) {
  chromeArgs.unshift('--headless=new');
}

export default defineConfig({
  plugins: [tsconfigPaths(), react(), nodePolyfills()],
  server: {
    fs: {
      allow: ['..'],
    },
    watch: {
      // Disable file watching in WSL to prevent reload issues
      ignored: ['**/node_modules/**', '**/.git/**'],
      usePolling: true,
      interval: 1000,
    },
  },
  test: {
    browser: {
      provider: webdriverio({
        capabilities: {
          browserName: 'chrome',
          webSocketUrl: true,
          'goog:chromeOptions': {
            args: chromeArgs,
          },
        },
      }),
      enabled: true,
      ui: true,
      instances: [
        {
          browser: 'chrome',
        },
      ],
      api: {
        port: 63315,
        host: 'localhost',
      },
    },
    testTimeout: 60000,
    hookTimeout: 60000,
    retry: 2,
    isolate: false,
    globals: true,
    include: [
      'packages/core/**/*.spec.ts',
      'packages/html/**/*.spec.ts',
      'packages/react/**/*.spec.(ts|tsx)',
      'packages/editor/**/*.spec.(ts|tsx)',
    ],
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
      'bin/**',
      'example/**',
      'tool/**',
    ],
  },
});
