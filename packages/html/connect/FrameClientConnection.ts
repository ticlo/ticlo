import {ClientConnection} from '@ticlo/core/connect/ClientConnection.js';
import {DataMap} from '@ticlo/core/util/DataTypes.js';
import {Logger} from '@ticlo/core/util/Logger.js';
import {decode, encode} from '@ticlo/core/util/Serialize.js';

export class FrameClientConnection extends ClientConnection {
  constructor(
    public remote: Window,
    editorListeners = true
  ) {
    super(editorListeners);
    this.reconnect();
  }

  reconnect() {
    window.addEventListener('message', this.onMessage);
    this.onConnect();
  }

  doSend(datas: DataMap[]): void {
    if (this.remote.closed) {
      if (!this._destroyed) {
        this.destroy();
      }
      return;
    }
    const json = encode({ticloRequests: datas});
    Logger.trace(() => 'client send ' + json, this);
    this.remote.postMessage(json, '*');
  }

  onMessage = (e: MessageEvent) => {
    if (typeof e.data === 'string' && e.source === this.remote) {
      Logger.trace(() => 'client receive ' + e.data, this);
      const decoded = decode(e.data);
      if (decoded && Array.isArray(decoded.ticloResponses)) {
        this.onReceive(decoded.ticloResponses);
      }
    }
  };

  destroy() {
    super.destroy();
    window.removeEventListener('message', this.onMessage);
  }
}
