import {ServerConnection} from './ServerConnection.ts';
import {ClientConnection} from './ClientConnection.ts';
import {Root} from '../block/Flow.ts';
import {DataMap} from '../util/DataTypes.ts';
import {Logger} from '../util/Logger.ts';
import {encode, decode} from '../util/Serialize.ts';
import type {EditPolicy} from '../policy/EditPolicy.ts';

class LocalServerConnection extends ServerConnection {
  _client: LocalClientConnection;

  constructor(root: Root, policy?: EditPolicy) {
    super(root, policy);
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
    this._server = new LocalServerConnection(this._server.root, this._server.getEditPolicy());
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

export function makeLocalConnection(
  root: Root,
  editorListeners: boolean = true,
  serverPolicy?: EditPolicy
): [ServerConnection, ClientConnection] {
  const server = new LocalServerConnection(root, serverPolicy);
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
