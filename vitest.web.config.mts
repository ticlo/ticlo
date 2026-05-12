import {defineConfig} from 'vitest/config';
import react from '@vitejs/plugin-react';
import {nodePolyfills} from 'vite-plugin-node-polyfills';
import tsconfigPaths from 'vite-tsconfig-paths';
import {playwright} from '@vitest/browser-playwright';
import {fileURLToPath} from 'node:url';

const isHeadless = process.env.HEADLESS !== 'false';
const coreNodeModules = (name: string) => fileURLToPath(new URL(`./packages/core/node_modules/${name}`, import.meta.url));

export default defineConfig({
  plugins: [tsconfigPaths(), react(), nodePolyfills()],
  resolve: {
    // Browser tests run through Vite's dependency optimizer. On a cold cache,
    // duplicate dependency instances can make constructor-identity checks fail
    // before the optimized deps are warmed.
    dedupe: ['arrow-code', 'i18next', 'luxon'],
    alias: {
      // These are package-level deps, so pin them to one workspace instance.
      // That lets optimizeDeps resolve them from this root config and prevents
      // browser tests from mixing package-local copies during cold startup.
      'arrow-code': coreNodeModules('arrow-code'),
      i18next: coreNodeModules('i18next'),
      luxon: coreNodeModules('luxon'),
    },
  },
  optimizeDeps: {
    // Pre-optimize these browser-test dependencies so the first run uses the
    // same module shape and constructor identities as later cached runs. The
    // polyfill entries prevent Vite from reloading the browser mid-test when it
    // discovers them during the first cold run.
    include: [
      'arrow-code',
      'i18next',
      'luxon',
      'url',
      'vite-plugin-node-polyfills/shims/buffer',
      'vite-plugin-node-polyfills/shims/global',
      'vite-plugin-node-polyfills/shims/process',
    ],
  },
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
      provider: playwright({
        launchOptions: {
          args: [
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
          ],
        },
      }),
      headless: isHeadless,
      enabled: true,
      ui: true,
      instances: [
        {
          browser: 'chromium',
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
