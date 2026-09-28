import {serve} from '@hono/node-server';
import {FileFlowStorage, FileStorage} from '@ticlo/node';
import '@ticlo/test';
import {Hono} from 'hono';
import {cors} from 'hono/cors';
import {routeFileStorage, devUserAuth} from '@ticlo/file-server';
import {Root, setStorageFunctionProvider} from '@ticlo/core';
import {createTicloApp, getEditorUrl} from '@ticlo/web-server/server.ts';
import {mkdir, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';

export async function createServerApp(rootDir = fileURLToPath(new URL('./files/', import.meta.url))) {
  const rootProject = join(rootDir, 'proj/#root');
  if (await mkdir(rootProject, {recursive: true})) {
    await writeFile(join(rootProject, '_proj.json'), JSON.stringify({id: '#root', name: 'Root'}), {flag: 'wx'});
  }

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

  const runtimeCors = cors({allowMethods: ['GET', 'POST', 'OPTIONS'], allowHeaders: ['Content-Type']});
  for (const path of ['/ticlo', '/ticlo/*', '/api', '/api/*']) {
    app.use(path, (c, next) => (c.req.header('upgrade') === 'websocket' ? next() : runtimeCors(c, next)));
  }
  app.get('/health', (c) => c.json({status: 'ok'}));
  app.get('/', (c) =>
    c.text(
      'Ticlo server\n/ticlo — runtime WebSocket and HTTP commands\n/file — project and file storage\n/api/* — flow-defined endpoints\n/health — server health\n'
    )
  );
  return createTicloApp({app, enableEditor: true, cors: false, rootRoute: false});
}

async function start() {
  setStorageFunctionProvider(() => new FileStorage('./app/server/storage', '.str'));

  await Root.instance.setStorage(new FileFlowStorage('./app/server/flows'));
  await Root.instance.start();

  const {app, ticloWs} = await createServerApp();

  const server = serve({fetch: app.fetch, port: 8010, hostname: '127.0.0.1'});
  ticloWs?.injectWebSocket(server);
  server.on('listening', () => {
    console.log('Server listening on http://localhost:8010');
    console.log('File storage: http://127.0.0.1:8010/file');
    console.log('Health: http://127.0.0.1:8010/health');
    console.log(getEditorUrl('ws://127.0.0.1:8010/ticlo', ''));
    console.log('http://localhost:5173/editor.html?host=ws://127.0.0.1:8010/ticlo');
  });
  server.on('error', (err) => {
    console.error(err);
    process.exit(1);
  });
}

if (import.meta.main) {
  start().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
