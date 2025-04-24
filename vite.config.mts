import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'url';
import {nodePolyfills} from 'vite-plugin-node-polyfills';
import tsconfigPaths from 'vite-tsconfig-paths';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [tsconfigPaths(), react(), nodePolyfills()],
  base: '',
  server: {
    hmr: false,
    port: 3003,
  },
  root: './app',
  build: {
    outDir: '../dist',
    assetsDir: './',
    rollupOptions: {
      input: {
        playground: fileURLToPath(new URL('./app/playground.html', import.meta.url)),
        index: fileURLToPath(new URL('./app/editor.html', import.meta.url)),
        server: fileURLToPath(new URL('./app/server.html', import.meta.url)),
      },
      output: {
        entryFileNames: `assets/[name].js`,
        chunkFileNames: `assets/[name].js`,
        assetFileNames: `assets/[name].[ext]`,
      },
      // https://rollupjs.org/guide/en/#big-list-of-options
    },
  },
});
