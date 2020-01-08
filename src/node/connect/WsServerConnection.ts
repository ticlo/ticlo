import Websocket from 'ws';
import {ServerConnection} from '../../../src/core/connect/ServerConnection';
import {DataMap} from '../../../src/core/util/DataTypes';
import {Logger} from '../../../src/core/util/Logger';
import {decode, encode} from '../../../src/core/util/Serialize';
import {Root} from '../../../src/core/block/Block';

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

  onMessage = (data: string) => {
    if (typeof data === 'string') {
      Logger.trace(() => 'server receive ' + data, this);
      let decoded = decode(data);
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
