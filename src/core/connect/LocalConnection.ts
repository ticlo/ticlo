import {ServerConnection} from "./ServerConnection";
import {ClientConnection} from "./ClientConnection";
import {Root} from "../block/Block";
import {DataMap} from "../util/Types";
import {Logger} from "../util/Logger";

class LocalServerConnection extends ServerConnection {
  _client: LocalClientConnection;

  doSend(datas: DataMap[]): void {
    Logger.trace(() => 'server send ' + JSON.stringify(datas), this);
    this._client.onReceive(datas);
  }

}

class LocalClientConnection extends ClientConnection {
  _server: LocalServerConnection;

  doSend(datas: DataMap[]): void {
    Logger.trace(() => 'client send ' + JSON.stringify(datas), this);
    this._server.onReceive(datas);
  }

  destroy() {
    super.destroy();
    this._server.destroy();
  }
}

let _lastClientConnection: ClientConnection;

export function makeLocalConnection(root: Root, editorListeners: boolean = true): [ServerConnection, ClientConnection] {
  let server = new LocalServerConnection(root);
  let client = new LocalClientConnection(editorListeners);
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