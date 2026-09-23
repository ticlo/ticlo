import {serve} from '@hono/node-server';
import {Hono} from 'hono';
import {cors} from 'hono/cors';
import {routeFileStorage, devUserAuth} from '@ticlo/file-server';
import {mkdir, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {encodeSorted} from '@ticlo/core';
import {data} from '../sample-data/data.ts';

const rootDir = fileURLToPath(new URL('./files/', import.meta.url));

async function seed(path: string, content: string) {
  try {
    await writeFile(path, content, {flag: 'wx'});
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
  }
}

async function start() {
  const rootProject = join(rootDir, 'proj/_root');
  await mkdir(rootProject, {recursive: true});
  await seed(join(rootProject, '_proj.json'), JSON.stringify({id: '_root', name: 'Root'}));
  await seed(join(rootProject, '#global.ticlo'), encodeSorted({'#is': ''}));
  await seed(join(rootProject, 'example.ticlo'), encodeSorted(data));

  const app = new Hono();
  app.use(
    '/file/*',
    cors({
      origin: (origin) => (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) ? origin : undefined),
      allowMethods: ['GET', 'POST', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'If-Match', 'If-None-Match'],
      exposeHeaders: ['ETag'],
    })
  );
  routeFileStorage(app, {rootDir, authProvider: () => devUserAuth});
  const server = serve({fetch: app.fetch, port: 8012, hostname: '127.0.0.1'}, () => {
    console.log('File server listening on http://127.0.0.1:8012/file');
    console.log('Run pnpm vite-dev, then open /file-server.html on the Vite URL');
  });
  server.on('error', (error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

start().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
