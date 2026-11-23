import {DataMap} from '@ticlo/core/util/DataTypes.ts';
import {decode, encode} from '@ticlo/core/util/Serialize.ts';
import {Logger} from '@ticlo/core/util/Logger.ts';
import {ServerConnection, type ServerConnectionOptions} from '@ticlo/core/connect/ServerConnection.ts';
import {Root} from '@ticlo/core/block/Flow.ts';

export class FrameServerConnection extends ServerConnection {
  checkClosedTimer: any;
  constructor(
    public remote: Window,
    root: Root,
    options?: ServerConnectionOptions
  ) {
    super(root, options);
    this.checkClosedTimer = setInterval(this.checkClosed, 1000);
    window.addEventListener('message', this.onMessage);
  }

  checkClosed = () => {
    if (this.remote.closed && !this._destroyed) {
      this.destroy();
    }
  };

  doSend(datas: DataMap[]): void {
    const json = encode({ticloResponses: datas});
    this.remote.postMessage(json, '*');
  }

  onMessage = (e: MessageEvent) => {
    if (typeof e.data === 'string' && e.source === this.remote) {
      const decoded = decode(e.data);
      if (decoded?.ticloReady) {
        this.onConnect();
        this.onReceive([]);
      } else if (decoded && Array.isArray(decoded.ticloRequests)) {
        this.onReceive(decoded.ticloRequests);
      }
    }
  };

  destroy() {
    super.destroy();
    if (this.checkClosedTimer) {
      clearInterval(this.checkClosedTimer);
      this.checkClosedTimer = null;
    }
    window.removeEventListener('message', this.onMessage);
  }
}
