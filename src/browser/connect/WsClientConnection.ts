import {ClientConnection} from "../../core/connect/ClientConnection";
import {DataMap} from "../../core/util/Types";
import {Logger} from "../../core/util/Logger";
import {decode, encode} from "../../core/util/Serialize";
import {Root} from "../../core/block/Block";

class WsServerConnection extends ClientConnection {
  _ws: WebSocket;

  constructor(url: string, editorListeners = true) {
    super(editorListeners);
  }

  connect() {

  }

  reconnect() {

  }

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
  }
}