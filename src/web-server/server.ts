import Express, {Request, Response} from 'express';
import ExpressWs from 'express-ws';
import {Root} from '../../src/core';
import {WsServerConnection} from '../../src/node';
import {requestHandlerSymbol, ServerFunction} from './ServerFunction';

// force import
((v: any) => {})(ServerFunction);

/**
 * open a port for the http:express-server service
 * @param app
 * @param basePath
 * @param globalBlockName
 */
export function routeTiclo(app: Express.Application, basePath: string, globalBlockName: string = '^local-server') {
  if (!globalBlockName.startsWith('^')) {
    globalBlockName = '^' + globalBlockName;
  }
  let globalServiceBlock = Root.instance._globalRoot.createBlock(globalBlockName, true);
  globalServiceBlock._load({'#is': 'web-server:express-server'});
  Root.run(); // output the requestHandler
  const requestHandler: (basePath: string, req: Request, res: Response) => void = (
    globalServiceBlock.getValue('#output') as any
  )?.[requestHandlerSymbol];
  if (requestHandler) {
    app.all(`${basePath}/*`, (req: Request, res: Response) => {
      requestHandler(basePath, req, res);
    });
  }
}

/**
 * open a websocket port for the editor
 * @param app
 * @param routeTicloPath
 */
export function connectTiclo(app: Express.Application, routeTicloPath: string) {
  let expressWs = ExpressWs(app);
  let wsapp = expressWs.app;
  wsapp.ws(routeTicloPath, function (ws, req) {
    let serverConn = new WsServerConnection(ws, Root.instance);
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
