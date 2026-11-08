import {serve} from '@hono/node-server';
import {NodeStorage} from '@ticlo/node';
import '@ticlo/test';
import {Hono} from 'hono';
import {cors} from 'hono/cors';
import {devUserAuth, type AuthProvider} from '@ticlo/file-server';
import {Root} from '@ticlo/core';
import {routeFileStorage} from '@ticlo/web-server/file-storage.ts';
import {createTicloApp, getEditorUrl} from '@ticlo/web-server/server.ts';
import {mkdir, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';

export async function createServerApp(
  rootDir = fileURLToPath(new URL('./files/', import.meta.url)),
  authProvider: AuthProvider = () => devUserAuth,
  root = Root.instance
) {
  const rootProject = join(rootDir, 'serv/#root');
  if (await mkdir(rootProject, {recursive: true})) {
    await writeFile(join(rootProject, '.proj'), JSON.stringify({id: '#root', name: 'Root'}), {flag: 'wx'});
  }

  const app = new Hono();
  const devCors = cors({exposeHeaders: ['ETag']});
  app.use('*', (c, next) => (c.req.header('upgrade') === 'websocket' ? next() : devCors(c, next)));
  routeFileStorage(app, {rootDir, authProvider});

  app.get('/health', (c) => c.json({status: 'ok'}));
  app.get('/', (c) =>
    c.text(
      'Ticlo server\n/ticlo — runtime WebSocket and HTTP commands\n/file — project and file storage\n/api/* — flow-defined endpoints\n/health — server health\n'
    )
  );
  return createTicloApp({app, root, enableEditor: true, cors: false, rootRoute: false});
}

async function start() {
  const {app, ticloWs} = await createServerApp();
  await Root.instance.setStorage(new NodeStorage(fileURLToPath(new URL('./files/serv/', import.meta.url))));
  await Root.instance.start();

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
