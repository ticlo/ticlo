import {DataMap} from '@ticlo/core/util/DataTypes';
import {decode, encode} from '@ticlo/core/util/Serialize';
import {Logger} from '@ticlo/core/util/Logger';
import {ServerConnection} from '@ticlo/core/connect/ServerConnection';
import {Root} from '@ticlo/core/block/Flow';

export class FrameServerConnection extends ServerConnection {
  checkClosedTimer: any;
  constructor(
    public remote: Window,
    root: Root
  ) {
    super(root);
    this.checkClosedTimer = setInterval(this.checkClosed, 1000);
    window.addEventListener('message', this.onMessage);
    this.onConnect();
  }

  checkClosed = () => {
    if (this.remote.closed && !this._destroyed) {
      this.destroy();
    }
  };

  doSend(datas: DataMap[]): void {
    let json = encode({ticloResponses: datas});
    Logger.trace(() => 'server send ' + json, this);
    this.remote.postMessage(json, '*');
  }

  onMessage = (e: MessageEvent) => {
    if (typeof e.data === 'string' && e.source === this.remote) {
      Logger.trace(() => 'server receive ' + e.data, this);
      let decoded = decode(e.data);
      if (decoded && Array.isArray(decoded.ticloRequests)) {
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
