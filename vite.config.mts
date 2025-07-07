import {defineConfig, Plugin} from 'vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'url';
import {nodePolyfills} from 'vite-plugin-node-polyfills';
import tsconfigPaths from 'vite-tsconfig-paths';
import fs from 'fs';
import {exec} from 'child_process';
import util from 'util';
import path from 'path';

const execAsync = util.promisify(exec);
let checked = false; // shared across both hooks

async function checkFiles() {
  if (checked) {
    return;
  }
  if (!fs.existsSync('i18n/core/en.json')) {
    console.log('Building i18n files...');
    const {stderr} = await execAsync('npm run build-i18n');
    if (stderr) {
      console.error(`Error: ${stderr}`);
    }
  }
  if (!fs.existsSync('app/css')) {
    fs.mkdirSync('app/css', {recursive: true});
  }
  if (!fs.existsSync('app/css/editor.css')) {
    console.log('Building editor css...');
    const {stderr} = await execAsync('npm run build-less');
    if (stderr) {
      console.error(`Error: ${stderr}`);
    }
  }
  if (!fs.existsSync('app/css/icons.css')) {
    console.log('Building icons...');
    const {stderr} = await execAsync('npm run build-icons');
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

// Get all CSS files from the css folder
function getCssInputs() {
  const cssDir = './app/css';
  const inputs: Record<string, string> = {};

  if (fs.existsSync(cssDir)) {
    const cssFiles = fs.readdirSync(cssDir).filter((file) => file.endsWith('.css'));
    for (const file of cssFiles) {
      const name = path.basename(file, '.css');
      inputs[name] = fileURLToPath(new URL(`./app/css/${file}`, import.meta.url));
    }
  }

  return inputs;
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
        ...getCssInputs(),
      },
      output: {
        entryFileNames: `assets/[name].js`,
        chunkFileNames: `assets/[name].js`,
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith('.css')) {
            return `css/[name].[ext]`;
          }
          return `assets/[name].[ext]`;
        },
      },
      // https://rollupjs.org/guide/en/#big-list-of-options
    },
  },
});
