import {ClientConnection} from '@ticlo/core/connect/ClientConnection.js';
import {DataMap} from '@ticlo/core/util/DataTypes.js';
import {Logger} from '@ticlo/core/util/Logger.js';
import {decode, encode} from '@ticlo/core/util/Serialize.js';

export class WsBrowserConnection extends ClientConnection {
  _ws: WebSocket;
  _wsUrl: string;

  constructor(url: string, editorListeners = true) {
    super(editorListeners);
    this._wsUrl = url;
    this.reconnect();
  }

  reconnect() {
    this._ws = new WebSocket(this._wsUrl);
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
    const json = encode(datas);
    Logger.trace(() => 'server send ' + json, this);
    this._ws.send(json);
  }

  onMessage = (e: MessageEvent) => {
    if (typeof e.data === 'string') {
      Logger.trace(() => 'server receive ' + e.data, this);
      const decoded = decode(e.data);
      if (Array.isArray(decoded)) {
        this.onReceive(decoded);
      }
    }
  };

  destroy() {
    super.destroy();
    if (this._ws) {
      this._ws.close();
      this._ws = null;
    }
  }
}
