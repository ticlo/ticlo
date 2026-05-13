import {createNodeWebSocket} from '@hono/node-ws';
import type {Hono} from 'hono';
import {Root} from '@ticlo/core';
import {WsServerConnection, RestServerConnection} from '@ticlo/node';
import {decodeReviver} from '@ticlo/core/util/Serialize.js';
import {requestHandlerSymbol, ServerFunction} from './ServerFunction.js';
import {HonoRequestData, HonoResponse} from './HttpRequest.js';

// force import
((v: any) => {})(ServerFunction);

type HonoApp = Hono<any>;

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

async function getRequestData(c: any): Promise<HonoRequestData> {
  const request = c.req.raw as Request;
  const headers = getHeaders(request);
  const contentTypeHeader = headers['content-type'];
  let body: any;

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

  return {
    method: request.method,
    url: new URL(request.url).pathname + new URL(request.url).search,
    body,
    query: getQuery(request.url),
    headers,
  };
}

/**
 * open a port for the http:server service
 * @param app
 * @param basePath
 * @param serverBlockName
 */
export async function routeTiclo(app: HonoApp, basePath: string, serverBlockName: string = '^local-server') {
  if (!serverBlockName.startsWith('^')) {
    serverBlockName = '^' + serverBlockName;
  }
  const globalServiceBlock = Root.instance._globalRoot.createBlock(serverBlockName, true);
  globalServiceBlock._load({'#is': 'web-server:server'});
  Root.run(); // output the requestHandler
  const requestHandler: (basePath: string, req: HonoRequestData, res: HonoResponse) => void = (
    globalServiceBlock.getValue('#output') as any
  )?.[requestHandlerSymbol];

  if (requestHandler) {
    app.all(`${basePath}/*`, async (c) => {
      const res = new HonoResponse();
      requestHandler(basePath, await getRequestData(c), res);
      return res.response;
    });
  }
}

/**
 * open a websocket port for the editor
 * @param app
 * @param routeTicloPath
 */
export async function connectTiclo(app: HonoApp, routeTicloPath: string) {
  const restServer = new RestServerConnection(Root.instance);
  const {injectWebSocket, upgradeWebSocket} = createNodeWebSocket({app});

  app.get(
    routeTicloPath,
    upgradeWebSocket(() => ({
      onOpen(_event, ws) {
        new WsServerConnection(ws.raw as any, Root.instance);
      },
    }))
  );

  // REST routes
  app.post(routeTicloPath, async (c) => {
    const res = new HonoResponse();
    await restServer.onHttpPost(await getRequestData(c), res);
    return res.response;
  });

  app.get(`${routeTicloPath}/*`, async (c) => {
    const res = new HonoResponse();
    await restServer.onHttpGetFile(await getRequestData(c), res);
    return res.response;
  });

  return {injectWebSocket};
}

export function getEditorUrl(host: string, defaultFlow: string) {
  let protocol = 'http';
  if (host.startsWith('wss://')) {
    protocol = 'https';
  }
  let url = `${protocol}://ticlo.org/editor.html?host=${host}`;
  if (defaultFlow) {
    url += `&flow=${defaultFlow}`;
  }
  return url;
}
