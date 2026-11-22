import {defineConfig, Plugin} from 'vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'url';
import {nodePolyfills} from 'vite-plugin-node-polyfills';
import fs from 'fs';
import {exec} from 'child_process';
import util from 'util';
import path from 'path';
import {buildCss, stylePackages} from './tool/package-styles.ts';
import {buildIcons} from './tool/icon-styles.ts';
import {copyStaticStorage, serveStaticStorage} from './tool/static-storage.ts';
import {devFrontendPort} from './app/server/dev-frontend.ts';

const execAsync = util.promisify(exec);
let checked = false; // shared across both hooks
const staticStorageDir = fileURLToPath(new URL('./app/static-storage', import.meta.url));

async function runNpmScript(script: string) {
  const {stderr} = await execAsync(`npm run ${script}`);
  if (stderr) {
    process.stderr.write(stderr);
  }
}

async function checkFiles() {
  if (checked) {
    return;
  }
  if (
    !fs.existsSync('i18n/core/en.json') ||
    !fs.existsSync('i18n/sqlite/en.json') ||
    !fs.existsSync('i18n/postgres/en.json') ||
    !fs.existsSync('i18n/mysql/en.json')
  ) {
    console.log('Building i18n files...');
    await runNpmScript('build-i18n');
  }
  if (!fs.existsSync('css')) {
    fs.mkdirSync('css', {recursive: true});
  }
  buildCss();
  if (!fs.existsSync('css/antd.css')) {
    console.log('Building antd css...');
    await runNpmScript('build-antd-style');
  }
  buildIcons();

  checked = true;
}

function preProcess(): Plugin {
  return {
    name: 'prep-assets-once',

    /** Runs once when you start `vite dev` */
    async configureServer(server) {
      await checkFiles();
    },

    /** Runs once at the very start of `vite build` */
    async buildStart() {
      await checkFiles();
    },
  };
}

function staticStorage(): Plugin {
  return {
    name: 'ticlo-static-storage',
    async configureServer({config, middlewares}) {
      middlewares.use(`${config.base}storage`, await serveStaticStorage(staticStorageDir, true));
    },

    async configurePreviewServer({config, middlewares}) {
      const output = path.resolve(config.root, config.build.outDir, 'storage');
      // Vite preview skips dotfiles in its default static handler.
      if (fs.existsSync(output)) middlewares.use(`${config.base}storage`, await serveStaticStorage(output));
    },

    async writeBundle({dir}) {
      const output = path.join(dir, 'storage');
      await fs.promises.rm(output, {recursive: true, force: true});
      await copyStaticStorage(staticStorageDir, output);
    },
  };
}

// Get all CSS files from the css folder
function getCssInputs() {
  const cssDir = './css';
  const inputs: Record<string, string> = {};

  if (fs.existsSync(cssDir)) {
    const cssFiles = fs
      .readdirSync(cssDir)
      .filter((file) => file.endsWith('.css') && !stylePackages.includes(path.basename(file, '.css')));
    for (const file of cssFiles) {
      const name = path.basename(file, '.css');
      inputs[name] = fileURLToPath(new URL(`./css/${file}`, import.meta.url));
    }
  }

  return inputs;
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [preProcess(), staticStorage(), react(), nodePolyfills()],
  base: '',
  resolve: {
    tsconfigPaths: true,
    dedupe: ['axios'],
    alias: {
      '/css': fileURLToPath(new URL('./css', import.meta.url)),
    },
  },
  server: {
    host: '0.0.0.0',
    hmr: false,
    port: devFrontendPort,
    strictPort: true,
  },
  root: './app',
  build: {
    outDir: '../dist',
    assetsDir: './',
    rollupOptions: {
      input: {
        'dataflow': fileURLToPath(new URL('./app/dataflow.html', import.meta.url)),
        'designer-app': fileURLToPath(new URL('./app/designer.html', import.meta.url)),
        'viewer': fileURLToPath(new URL('./app/viewer.html', import.meta.url)),
        'oauth-callback': fileURLToPath(new URL('./app/oauth-callback.html', import.meta.url)),
        'stage-test': fileURLToPath(new URL('./app/stage-test.html', import.meta.url)),
        'index': fileURLToPath(new URL('./app/editor.html', import.meta.url)),
        'server': fileURLToPath(new URL('./app/server.html', import.meta.url)),
        'static-server': fileURLToPath(new URL('./app/static-server.html', import.meta.url)),
        'file-server': fileURLToPath(new URL('./app/file-server.html', import.meta.url)),
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
