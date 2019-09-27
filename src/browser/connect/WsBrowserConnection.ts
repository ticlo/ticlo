import {ClientConnection} from '../../core/connect/ClientConnection';
import {DataMap} from '../../core/util/Types';
import {Logger} from '../../core/util/Logger';
import {decode, encode} from '../../core/util/Serialize';

class WsServerConnection extends ClientConnection {
  _ws: WebSocket;
  _url: string;

  constructor(url: string, editorListeners = true) {
    super(editorListeners);
    this._url = url;
  }

  connect() {
    this.reconnect();
  }

  reconnect() {
    this._ws = new WebSocket(this._url);
    this._ws.addEventListener('message', this.onMessage);
    this._ws.addEventListener('open', () => this.onConnect());
    this._ws.addEventListener('error', () => this.onClose);
    this._ws.addEventListener('close', () => this.onClose);
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

  onMessage = (e: MessageEvent) => {
    if (e.data) {
      Logger.trace(() => 'server receive ' + e.data, this);
      let decoded = decode(e.data);
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
