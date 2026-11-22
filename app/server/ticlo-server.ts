import {serve} from '@hono/node-server';
import {NodeStorage, SecretCipher} from '@ticlo/node';
import '@ticlo/test';
import '@ticlo/sqlite';
import '@ticlo/postgres';
import '@ticlo/mysql';
import '@ticlo/mqtt';
import {Hono} from 'hono';
import {cors} from 'hono/cors';
import {devUserAuth, type AuthProvider} from '@ticlo/file-server';
import {Root, setSecretCipher} from '@ticlo/core';
import {routeFileStorage} from '@ticlo/web-server/file-storage.ts';
import {createTicloApp, type TicloAppOptions} from '@ticlo/web-server/server.ts';
import {mkdir, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {initServerExamples, linkBrowserExamples} from './examples.ts';
import {devFrontendOrigin} from './dev-frontend.ts';

export interface ServerAppOptions extends Pick<TicloAppOptions, 'oauth'> {
  enableFrontend?: boolean;
  enableEditor?: boolean;
}

export async function createServerApp(
  rootDir = fileURLToPath(new URL('./files/', import.meta.url)),
  authProvider: AuthProvider = () => devUserAuth,
  root = Root.instance,
  browserExamples?: string,
  options?: ServerAppOptions
) {
  const enableFrontend = options?.enableFrontend ?? true;
  const enableEditor = options?.enableEditor ?? true;
  const rootProject = join(rootDir, 'serv/#root');
  if (await mkdir(rootProject, {recursive: true})) {
    await writeFile(join(rootProject, '.proj'), JSON.stringify({id: '#root', name: 'Root'}), {flag: 'wx'});
  }
  await initServerExamples(join(rootDir, 'serv'));
  const allowProjectSymlink = enableFrontend
    ? await linkBrowserExamples(join(rootDir, 'proj'), browserExamples)
    : undefined;

  const app = new Hono();
  const devCors = cors({exposeHeaders: ['ETag']});
  app.use('*', (c, next) => (c.req.header('upgrade') === 'websocket' ? next() : devCors(c, next)));
  routeFileStorage(app, {
    rootDir,
    authProvider,
    allowProjectSymlink,
    scopes: enableFrontend ? undefined : ['serv', 'usr'],
  });

  app.get('/health', (c) => c.json({status: 'ok'}));
  app.get('/', (c) =>
    c.text(
      'Ticlo server\n/ticlo — runtime WebSocket and HTTP commands\n/file — project and file storage\n/api/* — flow-defined endpoints\n/health — server health\n'
    )
  );
  return createTicloApp({
    app,
    root,
    enableEditor,
    cors: false,
    rootRoute: false,
    oauth: options?.oauth,
  });
}

async function start() {
  const hostname = '127.0.0.1';
  const port = 8010;
  const origin = `http://${hostname}:${port}`;
  const enableFrontend = !process.argv.slice(2).includes('--no-frontend');
  const rootDir = fileURLToPath(new URL('./files/', import.meta.url));
  await mkdir(rootDir, {recursive: true});
  setSecretCipher(await SecretCipher.fromFile(join(rootDir, '.ticlo-secret.key')));
  const {app, ticloWs} = await createServerApp(rootDir, undefined, Root.instance, undefined, {enableFrontend});
  await Root.instance.setStorage(
    new NodeStorage(join(rootDir, 'serv'), {
      fileBaseUrl: `${origin}/file`,
      fileUrlScope: 'serv',
      ...(enableFrontend ? {frontendDir: join(rootDir, 'proj'), frontendUrlScope: 'proj'} : undefined),
    })
  );
  await Root.instance.start();

  const server = serve({fetch: app.fetch, port, hostname});
  ticloWs?.injectWebSocket(server);
  server.on('listening', () => {
    console.log(`Ticlo runtime listening on ${origin}`);
    console.log(`File storage: ${origin}/file`);
    console.log(`Health: ${origin}/health`);
    console.log(`Local editor (served by pnpm vite-dev): ${devFrontendOrigin}/editor.html?host=${origin}/`);
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
