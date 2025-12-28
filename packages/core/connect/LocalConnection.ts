import {ServerConnection} from './ServerConnection.js';
import {ClientConnection} from './ClientConnection.js';
import {Root} from '../block/Flow.js';
import {DataMap} from '../util/DataTypes.js';
import {Logger} from '../util/Logger.js';
import {encode, decode} from '../util/Serialize.js';

class LocalServerConnection extends ServerConnection {
  _client: LocalClientConnection;

  constructor(root: Root) {
    super(root);
    this.onConnect();
  }

  doSend(datas: DataMap[]): void {
    const str = encode(datas);
    Logger.trace(() => 'server send ' + str, this);
    const decoded = decode(str);
    this._client.onReceive(decoded);
  }
}

class LocalClientConnection extends ClientConnection {
  _server: LocalServerConnection;

  constructor(editorListeners: boolean) {
    super(editorListeners);
    this.onConnect();
  }

  onDisconnect() {
    this._server.destroy();
    super.onDisconnect();
  }

  reconnect(): void {
    this._server = new LocalServerConnection(this._server.root);
    this._server._client = this;
    this.onConnect();
  }

  doSend(datas: DataMap[]): void {
    const str = encode(datas);
    Logger.trace(() => 'client send ' + str, this);
    const decoded = decode(str);
    this._server.onReceive(decoded);
  }

  destroy() {
    super.destroy();
    this._server.destroy();
  }
}

let _lastClientConnection: ClientConnection;

export function makeLocalConnection(root: Root, editorListeners: boolean = true): [ServerConnection, ClientConnection] {
  const server = new LocalServerConnection(root);
  const client = new LocalClientConnection(editorListeners);
  server._client = client;
  client._server = server;
  _lastClientConnection = client;
  return [server, client];
}

export function destroyLastLocalConnection() {
  if (_lastClientConnection) {
    _lastClientConnection.destroy();
    _lastClientConnection = null;
  }
}
