import {ClientConnection} from '../../../src/core/connect/ClientConnection';
import {DataMap} from '../../../src/core/util/DataTypes';
import {Logger} from '../../../src/core/util/Logger';
import {decode, encode} from '../../../src/core/util/Serialize';

export class FrameClientConnection extends ClientConnection {
  constructor(public remote: Window, editorListeners = true) {
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
    let json = encode({ticloRequests: datas});
    Logger.trace(() => 'client send ' + json, this);
    this.remote.postMessage(json, '*');
  }

  onMessage = (e: MessageEvent) => {
    if (typeof e.data === 'string' && e.source === this.remote) {
      Logger.trace(() => 'client receive ' + e.data, this);
      let decoded = decode(e.data);
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
