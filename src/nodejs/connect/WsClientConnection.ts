import Websocket from "ws";
import {ClientConnection} from "../../core/connect/ClientConnection";
import {DataMap} from "../../core/util/Types";
import {Logger} from "../../core/util/Logger";
import {decode, encode} from "../../core/util/Serialize";

class WsServerConnection extends ClientConnection {
  _ws: Websocket;
  _url: string;

  constructor(url: string, editorListeners = true) {
    super(editorListeners);
    this._url = url;
  }

  connect() {
    this.reconnect();
  }

  reconnect() {
    this._ws = new Websocket(this._url);
    this._ws.on('message', this.onMessage);
    this._ws.on('open', () => this.onConnect());
    this._ws.on('error', () => this.onClose);
    this._ws.on('close', () => this.onClose);
  }

  onClose = () => {
    if (this._ws) {
      this._ws = null;
      this.onDisconnect();
    }
  };

  doSend(datas: DataMap[]): void {
    let json = encode(datas);
    Logger.trace(() => 'server send ' + json, this);
    this._ws.send(json);
  }

  onMessage = (data: string) => {
    if (typeof data === 'string') {
      Logger.trace(() => 'server receive ' + data, this);
      let decoded = decode(data);
      this.onData(decoded);
    }
  };
}