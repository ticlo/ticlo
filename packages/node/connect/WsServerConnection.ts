import Websocket from 'ws';
import {ServerConnection, DataMap, Logger, decode, encode, Root, type ServerConnectionOptions} from '@ticlo/core';

export class WsServerConnection extends ServerConnection {
  _ws: Websocket;

  constructor(ws: Websocket, root: Root, options?: ServerConnectionOptions) {
    super(root, options);
    this._ws = ws;
    ws.on('message', this.onMessage);
    ws.on('error', this.onClose);
    ws.on('close', this.onClose);
    this.onConnect();
  }

  doSend(datas: DataMap[]): void {
    const json = encode(datas);
    this._ws.send(json);
  }

  onMessage = (data: string, isBinary: boolean) => {
    if (!isBinary) {
      const str = data.toString();
      try {
        const decoded = decode(str);
        if (Array.isArray(decoded)) {
          this.onReceive(decoded);
        }
      } catch (error) {
        Logger.warn('server received an invalid websocket message');
      }
    }
  };

  onClose = () => {
    if (!this._destroyed) {
      this.destroy();
    }
  };
}
