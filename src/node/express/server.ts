import Express, {Request, Response} from 'express';
import ExpressWs from 'express-ws';
import {Root} from '../../../src/core/block/Block';
import {WsServerConnection} from '../connect/WsServerConnection';
import {ServerFunction} from './ServerFunction';

// force import
console.log(ServerFunction);

export function routeTiclo(app: Express.Application, basePath: string, globalBlockName: string = 'server') {
  if (!globalBlockName.startsWith('^')) {
    globalBlockName = '^' + globalBlockName;
  }
  let globalBlock = Root.instance._globalBlock.createBlock(globalBlockName);
  globalBlock._load({'#is': 'http:express-server'});
  let serverFunction: ServerFunction = globalBlock._function as ServerFunction;
  app.all(`${basePath}/*`, (req: Request, res: Response) => {
    serverFunction.requestHandler(basePath, req, res);
  });
}

export function connectTiclo(app: Express.Application, routeTicloPath: string) {
  let expressWs = ExpressWs(app);
  let wsapp = expressWs.app;
  wsapp.ws(routeTicloPath, function(ws, req) {
    let serverConn = new WsServerConnection(ws, Root.instance);
  });
}
