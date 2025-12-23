import Websocket from 'ws';
import {ClientConnection} from '@ticlo/core/connect/ClientConnection.js';
import {DataMap, Logger, decode, encode} from '@ticlo/core';

export class WsClientConnection extends ClientConnection {
  _ws: Websocket;
  _url: string;

  constructor(url: string, editorListeners = true) {
    super(editorListeners);
    if (url.startsWith('http')) {
      url = url.replace('http', 'ws');
    }
    this._url = url;
    this.reconnect();
  }

  reconnect() {
    this._ws = new Websocket(this._url);
    this._ws.on('message', this.onMessage);
    this._ws.on('open', this.onOpen);
    this._ws.on('error', this.onClose);
    this._ws.on('close', this.onClose);
  }

  onOpen = () => {
    this.onConnect();
  };

  onClose = () => {
    if (this._ws) {
      this._ws = null;
      this.onDisconnect();
    }
  };

  doSend(datas: DataMap[]): void {
    let json = encode(datas);
    Logger.trace(() => 'client send ' + json, this);
    this._ws.send(json);
  }

  onMessage = (data: string, isBinary: boolean) => {
    if (!isBinary) {
      let str = data.toString();
      Logger.trace(() => 'client receive ' + str, this);
      let decoded = decode(str);
      if (Array.isArray(decoded)) {
        this.onReceive(decoded);
      }
    }
  };

  destroy() {
    super.destroy();
    if (this._ws) {
      this._ws.close();
    }
  }
}
