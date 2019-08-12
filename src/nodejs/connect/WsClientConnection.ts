import Websocket from "ws";
import {ClientConnection} from "../../core/connect/ClientConnection";
import {DataMap} from "../../core/util/Types";
import {Logger} from "../../core/util/Logger";
import {decode, encode} from "../../core/util/Serialize";

export class WsClientConnection extends ClientConnection {
  _ws: Websocket;
  _url: string;

  constructor(url: string, editorListeners = true) {
    super(editorListeners);
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

  onMessage = (data: string) => {
    if (typeof data === 'string') {
      Logger.trace(() => 'client receive ' + data, this);
      let decoded = decode(data);
      this.onReceive(decoded);
    }
  };

  destroy() {
    super.destroy();
    if (this._ws) {
      this._ws.close();
    }
  }
}