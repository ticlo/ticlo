import {defineConfig} from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: ['src/editor/icon/**/*.spec.ts'],
  },
});
