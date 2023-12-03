import {defineConfig} from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: ['src/core/**/*.spec.ts', 'src/node/**/*.spec.ts'],
  },
});
