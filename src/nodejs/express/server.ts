import Express from 'express';
import ExpressWs from 'express-ws';
import {Root} from '../../core/block/Block';
import {WsServerConnection} from '../connect/WsServerConnection';

export function route(app: Express.Application, routeWebPath: string, globalBlockName: string = 'webServer') {
  if (!globalBlockName.startsWith('^')) {
    globalBlockName = '^' + globalBlockName;
  }
  let globalBlock = Root.instance._globalBlock.createBlock(globalBlockName);
  globalBlock._load({'#is': 'express:server'});
}

export function connect(app: Express.Application, routeTicloPath: string) {
  let expressWs = ExpressWs(app);
  let wsapp = expressWs.app;
  wsapp.ws(routeTicloPath, function(ws, req) {
    let serverConn = new WsServerConnection(ws, Root.instance);
  });
}
