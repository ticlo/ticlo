import {DataMap} from '../../core/util/DataTypes';
import {decode, encode} from '../../core/util/Serialize';
import {Logger} from '../../core/util/Logger';
import {ServerConnection} from '../../core/connect/ServerConnection';
import {Root} from '../../core/block/Block';

export class FrameServerConnection extends ServerConnection {
  constructor(public remote: Window, root: Root) {
    super(root);
    remote.addEventListener('message', this.onMessage);
    this.onConnect();
  }

  onClose = () => {
    if (!this._destroyed) {
      this.onDisconnect();
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
    window.removeEventListener('message', this.onMessage);
  }
}
