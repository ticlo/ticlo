import {FastifyInstance, FastifyRequest, FastifyReply, RawServerBase} from 'fastify';
import fastifyWebsocket from '@fastify/websocket';
import {Root} from '@ticlo/core';
import {WsServerConnection, RestServerConnection} from '@ticlo/node';
import {requestHandlerSymbol, ServerFunction} from './ServerFunction';

// force import
((v: any) => {})(ServerFunction);

/**
 * open a port for the http:server service
 * @param app
 * @param basePath
 * @param serverBlockName
 */
export async function routeTiclo<TServer extends RawServerBase = RawServerBase>(
  app: FastifyInstance<TServer>,
  basePath: string,
  serverBlockName: string = '^local-server'
) {
  if (!serverBlockName.startsWith('^')) {
    serverBlockName = '^' + serverBlockName;
  }
  let globalServiceBlock = Root.instance._globalRoot.createBlock(serverBlockName, true);
  globalServiceBlock._load({'#is': 'web-server:server'});
  Root.run(); // output the requestHandler
  const requestHandler: (basePath: string, req: FastifyRequest, res: FastifyReply) => void = (
    globalServiceBlock.getValue('#output') as any
  )?.[requestHandlerSymbol];

  if (requestHandler) {
    app.all(`${basePath}/*`, async (request, reply) => {
      // Adapt Fastify request/reply to match expected interface
      const req = request as any;
      const res = reply as any;
      requestHandler(basePath, req, res);
    });
  }
}

/**
 * open a websocket port for the editor
 * @param app
 * @param routeTicloPath
 */
export async function connectTiclo<TServer extends RawServerBase = RawServerBase>(
  app: FastifyInstance<TServer>,
  routeTicloPath: string
) {
  const restServer = new RestServerConnection(Root.instance);

  // Register WebSocket plugin
  await app.register(fastifyWebsocket);

  // WebSocket route
  app.register(async function (fastify) {
    fastify.get(routeTicloPath, {websocket: true}, (socket, request) => {
      const serverConn = new WsServerConnection(socket, Root.instance);
    });
  });

  // REST routes
  app.post(routeTicloPath, async (request, reply) => {
    return restServer.onHttpPost(request as any, reply as any);
  });

  app.get(`${routeTicloPath}/*`, async (request, reply) => {
    return restServer.onHttpGetFile(request as any, reply as any);
  });
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
