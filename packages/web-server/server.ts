import {createNodeWebSocket} from '@hono/node-ws';
import {Hono} from 'hono';
import {cors} from 'hono/cors';
import {DefinedBlock, Root} from '@ticlo/core';
import {WsServerConnection, RestServerConnection} from '@ticlo/node';
import {decodeReviver} from '@ticlo/core/util/Serialize.ts';
import {requestHandlerSymbol, ServerFunction} from './ServerFunction.ts';
import {HonoRequestData, HonoResponse} from './HttpRequest.ts';

type HonoApp = Hono<any>;

export interface TicloAppOptions {
  app?: HonoApp;
  root?: Root;
  apiPath?: string;
  editorPath?: string;
  serverBlockName?: string;
  enableEditor?: boolean;
  cors?: boolean;
  rootRoute?: boolean;
}

export interface TicloApp {
  app: HonoApp;
  ticloWs?: Awaited<ReturnType<typeof connectTiclo>>;
}

function getQuery(url: string): {[key: string]: string} {
  return Object.fromEntries(new URL(url).searchParams.entries());
}

function getHeaders(request: Request): {[key: string]: string} {
  const result: {[key: string]: string} = {};
  request.headers.forEach((value, key) => {
    result[key] = value;
  });
  return result;
}

function getBodyReader(request: Request, headers: {[key: string]: string}) {
  let loaded = false;
  let body: any;
  return async () => {
    if (loaded) {
      return body;
    }
    loaded = true;
    try {
      const contentTypeHeader = headers['content-type'];

      if (contentTypeHeader?.includes('application/json')) {
        const text = await request.text();
        try {
          body = text ? JSON.parse(text, decodeReviver) : undefined;
        } catch (e) {
          body = text;
        }
      } else if (contentTypeHeader?.includes('text/plain')) {
        body = await request.text();
      } else if (contentTypeHeader?.includes('application/x-www-form-urlencoded')) {
        body = Object.fromEntries(new URLSearchParams(await request.text()).entries());
      } else if (contentTypeHeader?.includes('application/octet-stream')) {
        body = new Uint8Array(await request.arrayBuffer());
      }
    } catch (e) {
      body = undefined;
    }
    return body;
  };
}

function getRequestData(c: any): HonoRequestData {
  const request = c.req.raw as Request;
  const headers = getHeaders(request);
  const url = new URL(request.url);

  return {
    method: request.method,
    url: url.pathname + url.search,
    query: getQuery(request.url),
    headers,
    getBody: getBodyReader(request, headers),
  };
}

/**
 * Attach the host's HTTP routes to a code-defined global service.
 * @param app
 * @param basePath
 * @param serverBlockName
 */
export async function routeTiclo(
  app: HonoApp,
  basePath: string,
  serverBlockName: string = '^web-server',
  root = Root.instance
) {
  if (!serverBlockName.startsWith('^')) {
    serverBlockName = '^' + serverBlockName;
  }
  const existing = root._globalRoot.getValue(serverBlockName);
  // The host owns this service; the ordinary server function's lifecycle is separate.
  const service =
    existing instanceof DefinedBlock
      ? (existing.getValue('#output') as ServerFunction['service'])
      : new ServerFunction().service;
  if (existing instanceof DefinedBlock && typeof service?.[requestHandlerSymbol] !== 'function') {
    throw new Error(`Global definition is not an HTTP server: ${serverBlockName}`);
  }
  if (!(existing instanceof DefinedBlock)) {
    root.defineGlobal(serverBlockName, {'#is': 'web-server:server', '#output': service});
  }

  app.all(`${basePath}/*`, async (c) => {
    const requestHandler = service?.[requestHandlerSymbol];
    if (!requestHandler) return c.body(null, 404);
    const res = new HonoResponse();
    Promise.resolve(requestHandler(basePath, getRequestData(c), res)).catch(() => res.code(400).send());
    return res.response;
  });
}

/**
 * open a websocket port for the editor
 * @param app
 * @param routeTicloPath
 */
export async function connectTiclo(app: HonoApp, routeTicloPath: string, root = Root.instance) {
  const restServer = new RestServerConnection(root);
  const {injectWebSocket, upgradeWebSocket} = createNodeWebSocket({app});

  app.get(
    routeTicloPath,
    upgradeWebSocket(() => ({
      onOpen(_event, ws) {
        new WsServerConnection(ws.raw as any, root);
      },
    }))
  );

  // REST routes
  app.post(routeTicloPath, async (c) => {
    const res = new HonoResponse();
    const req = getRequestData(c);
    await restServer.onHttpPost({...req, body: await req.getBody()}, res);
    return res.response;
  });

  app.get(`${routeTicloPath}/*`, async (c) => {
    const res = new HonoResponse();
    await restServer.onHttpGetFile(getRequestData(c), res);
    return res.response;
  });

  return {injectWebSocket};
}

export async function createTicloApp(options: TicloAppOptions = {}): Promise<TicloApp> {
  const app = options.app ?? new Hono();
  const root = options.root ?? Root.instance;

  if (options.cors !== false) {
    const corsMiddleware = cors({allowMethods: ['GET', 'POST', 'OPTIONS'], allowHeaders: ['Content-Type']});
    app.use('*', (c, next) => (c.req.header('upgrade') === 'websocket' ? next() : corsMiddleware(c, next)));
  }

  await routeTiclo(app, options.apiPath ?? '/api', options.serverBlockName, root);
  const ticloWs = options.enableEditor ? await connectTiclo(app, options.editorPath ?? '/ticlo', root) : undefined;

  if (options.rootRoute !== false) {
    app.get('/', (c) => c.text(''));
  }

  return {app, ticloWs};
}

export function getEditorUrl(host: string, defaultFlow: string) {
  const url = new URL(`${host.startsWith('wss://') ? 'https' : 'http'}://ticlo.org/editor.html`);
  url.searchParams.set('host', host);
  if (defaultFlow) {
    url.searchParams.set('flow', defaultFlow);
  }
  return url.toString();
}
