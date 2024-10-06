import Websocket from 'ws';
import {ServerConnection, DataMap, Logger, decode, encode, Root} from '@ticlo/core';

export class WsServerConnection extends ServerConnection {
  _ws: Websocket;

  constructor(ws: Websocket, root: Root) {
    super(root);
    this._ws = ws;
    ws.on('message', this.onMessage);
    ws.on('error', this.onClose);
    ws.on('close', this.onClose);
    this.onConnect();
  }

  doSend(datas: DataMap[]): void {
    let json = encode(datas);
    Logger.trace(() => 'server send ' + json, this);
    this._ws.send(json);
  }

  onMessage = (data: string, isBinary: boolean) => {
    if (!isBinary) {
      let str = data.toString();
      Logger.trace(() => 'server receive ' + str, this);
      let decoded = decode(str);
      if (Array.isArray(decoded)) {
        this.onReceive(decoded);
      }
    }
  };

  onClose = () => {
    if (!this._destroyed) {
      this.destroy();
    }
  };
}
