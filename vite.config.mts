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
  },
  build: {
    assetsDir: './',
    rollupOptions: {
      input: {
        'server-and-editor': fileURLToPath(
          new URL('./example/simple-editor/server-and-editor-browser.html', import.meta.url)
        ),
        'editor': fileURLToPath(new URL('./example/simple-editor/editor.html', import.meta.url)),
        'server': fileURLToPath(new URL('./example/simple-editor/server.html', import.meta.url)),
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
