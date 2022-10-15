import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'url';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    assetsDir: './',
    rollupOptions: {
      input: {
        appMain: fileURLToPath(new URL('./example/simple-editor/server-and-editor-browser.html', import.meta.url)),
        //appOther: fileURLToPath(new URL('./resources/other/index.html', import.meta.url)),
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
