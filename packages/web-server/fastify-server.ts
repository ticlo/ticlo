import {FastifyInstance, FastifyRequest, FastifyReply} from 'fastify';
import fastifyWebsocket from '@fastify/websocket';
import {Root} from '@ticlo/core';
import {WsServerConnection} from '@ticlo/node';
import {requestHandlerSymbol, FastifyServerFunction} from './FastifyServerFunction';
import {FastifyRestServerConnection} from './FastifyRestServerConnection';

// force import
((v: any) => {})(FastifyServerFunction);

/**
 * open a port for the http:fastify-server service
 * @param app
 * @param basePath
 * @param serverBlockName
 */
export async function routeTiclo(app: FastifyInstance, basePath: string, serverBlockName: string = '^local-server') {
  if (!serverBlockName.startsWith('^')) {
    serverBlockName = '^' + serverBlockName;
  }
  let globalServiceBlock = Root.instance._globalRoot.createBlock(serverBlockName, true);
  globalServiceBlock._load({'#is': 'web-server:fastify-server'});
  Root.run(); // output the requestHandler
  const requestHandler: (basePath: string, req: FastifyRequest, res: FastifyReply) => void = (
    globalServiceBlock.getValue('#output') as any
  )?.[requestHandlerSymbol];

  if (requestHandler) {
    app.all(`${basePath}/*`, async (request: FastifyRequest, reply: FastifyReply) => {
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
export async function connectTiclo(app: FastifyInstance, routeTicloPath: string) {
  const restServer = new FastifyRestServerConnection(Root.instance);

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
