import {serve} from '@hono/node-server';
import {NodeStorage, registerSystemExec, SecretCipher} from '@ticlo/node';
import '@ticlo/test';
import '@ticlo/sqlite';
import '@ticlo/postgres';
import '@ticlo/mysql';
import '@ticlo/mqtt';
import '@ticlo/tsdb';
import {Hono, type MiddlewareHandler} from 'hono';
import {cors} from 'hono/cors';
import {getSignedCookie, setSignedCookie} from 'hono/cookie';
import {randomUUID} from 'node:crypto';
import {devUserAuth, type AuthProvider} from '@ticlo/file-server';
import {Root, addConsoleLogger, setSecretCipher} from '@ticlo/core';
import {routeFileStorage} from '@ticlo/web-server/file-storage.ts';
import {createTicloApp} from '@ticlo/web-server/server.ts';
import {createFileOAuthGrantStore, registerOAuth, routeOAuth, type OAuthServerOptions} from '@ticlo/oauth/node';
import {mkdir, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {initServerExamples, linkBrowserExamples} from './examples.ts';
import {devFrontendOrigin, devFrontendPort} from './dev-frontend.ts';

export interface ServerAppOptions {
  enableFrontend?: boolean;
  enableEditor?: boolean;
  oauth?: OAuthServerOptions;
  setup?: (app: Hono) => void;
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
  options?.setup?.(app);
  const devCors = cors({exposeHeaders: ['ETag']});
  app.use('*', (c, next) => (c.req.header('upgrade') === 'websocket' ? next() : devCors(c, next)));
  registerOAuth();
  if (options?.oauth) routeOAuth(app, root, options.oauth);
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
  });
}

export function localOAuth(origin: string, rootDir: string, cipher: SecretCipher): ServerAppOptions {
  const cookie = 'ticlo-dev-oauth';
  const signingKey = randomUUID();
  const oauth: OAuthServerOptions = {
    origin,
    allowFlowClients: true,
    confirmAuthorization: false,
    store: createFileOAuthGrantStore(join(rootDir, '.oauth-grants'), cipher),
    async authorize(c) {
      const session = await getSignedCookie(c, signingKey, cookie);
      if (session) return session;
      // The OAuth handler has already validated the Editor-issued start ticket.
      if (c.req.method !== 'GET' || !c.req.path.startsWith('/oauth/start/')) return undefined;
      const nextSession = randomUUID();
      await setSignedCookie(c, cookie, nextSession, signingKey, {path: '/oauth', httpOnly: true, sameSite: 'Lax'});
      return nextSession;
    },
  };
  return {
    oauth,
    setup(app: Hono) {
      const localhost = new URL(origin);
      localhost.hostname = 'localhost';
      const runtimeOrigins = new Set([origin, localhost.origin]);
      const allowedOrigins = new Set([...runtimeOrigins, devFrontendOrigin, `http://127.0.0.1:${devFrontendPort}`]);
      const checkOrigin: MiddlewareHandler = async (c, next) => {
        const requestOrigin = c.req.header('Origin');
        // The WebSocket adapter constructs c.req.url with its own base URL.
        const target =
          c.req.header('Upgrade')?.toLowerCase() === 'websocket'
            ? `${localhost.protocol}//${c.req.header('Host')}`
            : new URL(c.req.url).origin;
        if (!runtimeOrigins.has(target) || (requestOrigin && !allowedOrigins.has(requestOrigin))) {
          return c.text('Untrusted Ticlo origin', 403);
        }
        return next();
      };
      app.use('/ticlo/*', checkOrigin);
      app.use('/file/*', checkOrigin);
      app.use('/oauth/*', checkOrigin);
    },
  };
}

async function start() {
  const hostname = '127.0.0.1';
  const port = 8010;
  const origin = `http://${hostname}:${port}`;
  const args = process.argv.slice(2);
  const enableFrontend = !args.includes('--no-frontend');
  addConsoleLogger(args.includes('--trace') ? 'trace' : 'info');
  if (args.includes('--allow-exec')) registerSystemExec();
  const rootDir = fileURLToPath(new URL('./files/', import.meta.url));
  await mkdir(rootDir, {recursive: true});
  const cipher = await SecretCipher.fromFile(join(rootDir, '.ticlo-secret.key'));
  setSecretCipher(cipher);
  const {app, ticloWs} = await createServerApp(rootDir, undefined, Root.instance, undefined, {
    ...localOAuth(origin, rootDir, cipher),
    enableFrontend,
  });
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
