import {ServerConnection, type ServerConnectionOptions} from './ServerConnection.ts';
import {ClientConnection} from './ClientConnection.ts';
import {Root} from '../block/Flow.ts';
import {DataMap} from '../util/DataTypes.ts';
import {encode, decode} from '../util/Serialize.ts';

class LocalServerConnection extends ServerConnection {
  _client: LocalClientConnection;

  constructor(
    root: Root,
    options?: ServerConnectionOptions,
    private readonly serialize = true
  ) {
    super(root, options);
    this.onConnect();
  }

  doSend(datas: DataMap[]): void {
    if (this.serialize) {
      datas = decode(encode(datas));
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
    this._server = new LocalServerConnection(
      previous.root,
      {
        readonly: previous.readonly,
        maxMessageSize: previous.maxMessageSize,
        maxValueSize: previous.maxValueSize,
      },
      this.serialize
    );
    this._server._client = this;
    this.onConnect();
  }

  doSend(datas: DataMap[]): void {
    if (this.serialize) {
      datas = decode(encode(datas));
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
  options?: ServerConnectionOptions,
  // Match remote transport behavior by default; false passes values by reference.
  serialize: boolean = true
): [ServerConnection, ClientConnection] {
  const server = new LocalServerConnection(root, options, serialize);
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
