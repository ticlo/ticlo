import {ServerConnection} from './ServerConnection.ts';
import {ClientConnection} from './ClientConnection.ts';
import {Root} from '../block/Flow.ts';
import {DataMap} from '../util/DataTypes.ts';
import {Logger} from '../util/Logger.ts';
import {encode, decode} from '../util/Serialize.ts';
import type {EditPolicy} from '../policy/EditPolicy.ts';
import type {ConnectionOptions} from './Connection.ts';

class LocalServerConnection extends ServerConnection {
  _client: LocalClientConnection;

  constructor(
    root: Root,
    policy?: EditPolicy,
    private readonly serialize = true,
    options?: ConnectionOptions
  ) {
    super(root, policy, options);
    this.onConnect();
  }

  doSend(datas: DataMap[]): void {
    if (this.serialize) {
      const str = encode(datas);
      Logger.trace(() => 'server send ' + str, this);
      datas = decode(str);
    } else {
      Logger.trace(() => `server send ${datas.length} messages`, this);
    }
    this._client.onReceive(datas);
  }
}

class LocalClientConnection extends ClientConnection {
  _server: LocalServerConnection;

  constructor(
    editorListeners: boolean,
    private readonly serialize = true
  ) {
    super(editorListeners);
    this.onConnect();
  }

  onDisconnect() {
    this._server.destroy();
    super.onDisconnect();
  }

  reconnect(): void {
    const previous = this._server;
    this._server = new LocalServerConnection(previous.root, previous.getEditPolicy(), this.serialize, {
      maxMessageSize: previous.maxMessageSize,
      maxValueSize: previous.maxValueSize,
    });
    this._server._client = this;
    this.onConnect();
  }

  doSend(datas: DataMap[]): void {
    if (this.serialize) {
      const str = encode(datas);
      Logger.trace(() => 'client send ' + str, this);
      datas = decode(str);
    } else {
      Logger.trace(() => `client send ${datas.length} messages`, this);
    }
    this._server.onReceive(datas);
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
  serverPolicy?: EditPolicy,
  // Match remote transport behavior by default; false passes values by reference.
  serialize: boolean = true,
  options?: ConnectionOptions
): [ServerConnection, ClientConnection] {
  const server = new LocalServerConnection(root, serverPolicy, serialize, options);
  const client = new LocalClientConnection(editorListeners, serialize);
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
