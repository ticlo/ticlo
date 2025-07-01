import Websocket, {WebSocketServer} from 'ws';
import {Root} from '@ticlo/core';
import {WsServerConnection} from '../WsServerConnection';

export class MockWsServer {
  server: Websocket.Server;
  lastConnection: WsServerConnection;

  constructor(port: number) {
    this.server = new WebSocketServer({port});
  }

  init(): Promise<any> {
    this.server.on('connection', this.onConnect);
    return new Promise((resolve, reject) => {
      this.server.on('listening', () => resolve(null));
    });
  }

  onConnect = (ws: Websocket) => {
    this.lastConnection = new WsServerConnection(ws, Root.instance);
  };

  close() {
    this.server.close();
  }
}
