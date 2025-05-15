import {defineConfig, Plugin} from 'vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'url';
import {nodePolyfills} from 'vite-plugin-node-polyfills';
import tsconfigPaths from 'vite-tsconfig-paths';
import fs from 'fs';
import {exec} from 'child_process';
import util from 'util';

const execAsync = util.promisify(exec);
let checked = false; // shared across both hooks

async function checkFiles() {
  if (checked) {
    return;
  }
  if (!fs.existsSync('app/editor.css')) {
    const {stderr} = await exec('npm run build-less');
    if (stderr) {
      console.error(`Error: ${stderr}`);
    }
  }
  if (!fs.existsSync('app/icons.css')) {
    const {stderr} = await exec('npm run build-icons');
    if (stderr) {
      console.error(`Error: ${stderr}`);
    }
  }
  if (!fs.existsSync('i18n/core/en.json')) {
    const {stderr} = await exec('npm run build-i18n');
    if (stderr) {
      console.error(`Error: ${stderr}`);
    }
  }
  checked = true;
}

function preProcess(): Plugin {
  return {
    name: 'prep-assets-once',

    /** Runs once when you start `vite dev` */
    async configureServer() {
      await checkFiles();
    },

    /** Runs once at the very start of `vite build` */
    async buildStart() {
      await checkFiles();
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [preProcess(), tsconfigPaths(), react(), nodePolyfills()],
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
