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

async function runNpmScript(script: string) {
  const {stderr} = await execAsync(`npm run ${script}`);
  if (stderr) {
    console.error(`Error: ${stderr}`);
  }
}

async function checkFiles() {
  if (checked) {
    return;
  }
  if (!fs.existsSync('i18n/core/en.json')) {
    console.log('Building i18n files...');
    await runNpmScript('build-i18n');
  }
  if (!fs.existsSync('css')) {
    fs.mkdirSync('css', {recursive: true});
  }
  if (!fs.existsSync('css/editor.css')) {
    console.log('Building editor css...');
    await runNpmScript('build-less');
  }
  if (!fs.existsSync('css/antd.css')) {
    console.log('Building antd css...');
    await runNpmScript('build-antd-css');
  }
  if (!fs.existsSync('css/icons.css')) {
    console.log('Building icons...');
    await runNpmScript('build-icons');
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
  const cssDir = './css';
  const inputs: Record<string, string> = {};

  if (fs.existsSync(cssDir)) {
    const cssFiles = fs.readdirSync(cssDir).filter((file) => file.endsWith('.css'));
    for (const file of cssFiles) {
      const name = path.basename(file, '.css');
      inputs[name] = fileURLToPath(new URL(`./css/${file}`, import.meta.url));
    }
  }

  return inputs;
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [preProcess(), tsconfigPaths(), react(), nodePolyfills()],
  base: '',
  resolve: {
    alias: {
      '/css': fileURLToPath(new URL('./css', import.meta.url)),
    },
  },
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
