import {ClientConnection} from '@ticlo/core/connect/ClientConnection.js';
import {DataMap} from '@ticlo/core/util/DataTypes.js';
import {Logger} from '@ticlo/core/util/Logger.js';
import {decode, encode} from '@ticlo/core/util/Serialize.js';
import type {Restricted} from '@ticlo/core/restricted/Restricted.js';

export class WsBrowserConnection extends ClientConnection {
  _ws: WebSocket;
  _wsUrl: string;

  constructor(url: string, editorListeners = true, restricted?: Restricted) {
    super(editorListeners, restricted);
    this._wsUrl = url;
    this.reconnect();
  }

  reconnect() {
    const previous = this._ws;
    const ws = new WebSocket(this._wsUrl);
    this._ws = ws;
    ws.addEventListener('message', (event) => this.onMessage(event, ws));
    ws.addEventListener('open', () => {
      if (this._ws === ws) {
        this.onConnect();
      }
    });
    ws.addEventListener('error', () => this.onClose(ws));
    ws.addEventListener('close', () => this.onClose(ws));
    previous?.close();
  }

  onClose = (ws: WebSocket = this._ws) => {
    if (ws && this._ws === ws) {
      this._ws = null;
      this.onDisconnect();
    }
  };

  doSend(datas: DataMap[]): void {
    const json = encode(datas);
    Logger.trace(() => 'server send ' + json, this);
    this._ws.send(json);
  }

  onMessage = (e: MessageEvent, ws: WebSocket = this._ws) => {
    if (this._ws === ws && typeof e.data === 'string') {
      Logger.trace(() => 'server receive ' + e.data, this);
      try {
        const decoded = decode(e.data);
        if (Array.isArray(decoded)) {
          this.onReceive(decoded);
        }
      } catch (error) {
        Logger.warn('client received an invalid websocket message', this);
      }
    }
  };

  destroy() {
    super.destroy();
    if (this._ws) {
      const ws = this._ws;
      this._ws = null;
      ws.close();
    }
  }
}
